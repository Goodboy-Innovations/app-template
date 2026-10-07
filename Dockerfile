# syntax=docker/dockerfile:1
# Multi-arch (amd64 + arm64): builds on Linux, Windows (WSL2) and macOS.

FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS build
COPY . .
# SvelteKit imports server modules while analysing the build; they need *a* database URL but
# never connect. The real one is given at runtime.
RUN DATABASE_URL=postgres://build:build@localhost:5432/build npm run build

FROM node:24-alpine AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Alpine's busybox gives the runtime image sh and wget.
FROM node:24-alpine AS runtime
WORKDIR /app
# BODY_SIZE_LIMIT: adapter-node rejects bodies over 512 kB by default; file uploads need more.
ENV NODE_ENV=production \
	PORT=3000 \
	BODY_SIZE_LIMIT=12M
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/build ./build
# SQL migrations, applied by the server when it starts.
COPY drizzle ./drizzle
COPY package.json ./
USER node
EXPOSE 3000
# /robots.txt needs no database, so this checks the server itself.
HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=5 \
	CMD wget -qO /dev/null "http://127.0.0.1:${PORT}/robots.txt" || exit 1
# node is PID 1 and gets SIGTERM directly; adapter-node then shuts down cleanly.
CMD ["node", "build"]
