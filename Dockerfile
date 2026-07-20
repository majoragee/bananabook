# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build Next.js app
RUN npm run build

# Production stage
FROM node:20-alpine AS runner

WORKDIR /app

# Install wget for healthcheck
RUN apk add --no-cache wget

# Set environment to production
ENV NODE_ENV=production
ENV DATA_DIR=/app/data

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy built Next.js app from builder
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/next.config.ts ./next.config.ts

# Copy app directory (Next.js pages and components)
COPY app ./app

# Copy server code and TypeScript config
COPY server ./server
COPY tsconfig.json ./

# Copy lib for utilities
COPY lib ./lib

# Create directory for SQLite database and set permissions for entire app
RUN mkdir -p /app/data && chown -R node:node /app

# Switch to non-root user
USER node

# Expose ports
# 3000 for Next.js
# 3001 for Express API
EXPOSE 3000 3001

# Start both Next.js and Express server
CMD ["npm", "start"]
