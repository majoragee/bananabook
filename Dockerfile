# Build stage: needs the full dependency tree (Next's SWC compiler, TypeScript).
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Produces .next/standalone (traced runtime files + static assets) and dist/
# (the Express API compiled to plain CommonJS).
RUN npm run build

# Next traces sharp's binaries for every libc, but this image is Alpine, so the
# glibc builds can never load. The glob deliberately does not match "linuxmusl".
# Pruned here rather than in the runtime stage: deleting in a later layer would
# leave the files in the layer below and reclaim nothing.
RUN rm -rf .next/standalone/node_modules/@img/sharp-libvips-linux-* \
           .next/standalone/node_modules/@img/sharp-linux-*

# Dependency stage: the runtime needs the API's dependencies, which Next's
# tracing does not cover because Next never imports them.
FROM node:20-alpine AS deps

WORKDIR /app

COPY package*.json ./

# Everything removed here is build-time only. Next itself is not needed: the
# standalone output ships its own traced copy. Dropping the full next/@next
# packages is most of the size win, since @next/swc alone is ~250MB and also
# installs a glibc build that can never load on Alpine.
RUN npm ci --omit=dev && npm cache clean --force \
 && rm -rf node_modules/next \
           node_modules/@next \
           node_modules/@img \
           node_modules/typescript \
           node_modules/tsx \
           node_modules/esbuild \
           node_modules/@esbuild

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

# Used by the docker-compose healthcheck.
RUN apk add --no-cache wget

ENV NODE_ENV=production
ENV DATA_DIR=/app/data
# Docker sets HOSTNAME to the container ID, which the Next server would then try
# to bind to. Pin it so the app is reachable through published ports.
ENV HOSTNAME=0.0.0.0

# API dependencies first; the standalone copy below merges its traced
# node_modules (including next) into the same tree.
COPY --from=deps /app/node_modules ./node_modules

# Brings server.js, the .next runtime files, and .next/static.
COPY --from=builder /app/.next/standalone ./

# The compiled Express API.
COPY --from=builder /app/dist ./dist

# Only the data directory needs to be writable by the app. Chowning all of /app
# would duplicate every file into a new layer and inflate the image.
RUN mkdir -p /app/data && chown node:node /app/data

USER node

# 3000 Next.js frontend, 3001 Express API.
EXPOSE 3000 3001

# PORT is deliberately left unset: the API falls back to 3001 and the Next
# server to 3000. Setting it would point both at the same port.
CMD ["node_modules/.bin/concurrently", "--kill-others", "--names", "api,web", "node dist/index.js", "node server.js"]
