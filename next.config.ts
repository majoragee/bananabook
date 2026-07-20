import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emits .next/standalone with only the files and dependencies actually
  // reachable at runtime, instead of requiring the full node_modules tree.
  output: 'standalone',
  // /api/* is proxied to the Express server by app/api/[...path]/route.ts, not
  // by a rewrite here: a rewrite's destination is baked into the build, which
  // pinned the API port into the compiled output. See that file.
};

export default nextConfig;
