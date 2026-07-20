// Proxies /api/* to the Express server.
//
// This used to be a next.config.ts rewrite, but a rewrite's destination is
// resolved at build time and written into routes-manifest.json, which pinned
// the API port into the compiled output — so it could not be changed without a
// rebuild, and the prebuilt Docker image could never be repointed at all.
// Reading API_PORT here resolves it per request instead, which is what lets the
// web port and the API port be set independently on a machine where either
// default is already taken.

const HOP_BY_HOP = ['connection', 'keep-alive', 'transfer-encoding', 'upgrade', 'host'];

function apiOrigin() {
  return `http://127.0.0.1:${process.env.API_PORT || 3001}`;
}

async function proxy(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const { search } = new URL(request.url);
  const target = `${apiOrigin()}/api/${path.join('/')}${search}`;

  const headers = new Headers(request.headers);
  for (const header of [...HOP_BY_HOP, 'content-length']) headers.delete(header);

  const init: RequestInit = { method: request.method, headers, redirect: 'manual' };
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = await request.arrayBuffer();
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, init);
  } catch {
    // Almost always the API not being up on the expected port, so say which
    // port was tried rather than surfacing an opaque 500.
    return Response.json(
      { error: `Cannot reach the BananaBook API at ${apiOrigin()}. Is it running, and does API_PORT match?` },
      { status: 502 }
    );
  }

  const responseHeaders = new Headers(upstream.headers);
  // fetch has already decoded the body, so the upstream framing headers no
  // longer describe what is being sent on.
  for (const header of [...HOP_BY_HOP, 'content-encoding', 'content-length']) {
    responseHeaders.delete(header);
  }

  return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const HEAD = proxy;
export const OPTIONS = proxy;

// The proxy must run per request; never prerender or cache it.
export const dynamic = 'force-dynamic';
