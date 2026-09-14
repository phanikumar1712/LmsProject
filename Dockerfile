# ── Multi-stage single-service image (frontend + backend in one container) ───
# Railway prefers a root Dockerfile over language auto-detection, which removes
# any chance of the project being misdetected (e.g. as Python) at build time.
#
# Resulting image: Express serves the API (/api/*) AND the built React app
# (backend/public) on the same origin — the same layout scripts/prepare-railway.cjs
# produces, just baked in at image level.

# ── Stage 1: build the React frontend ─────────────────────────────────────────
FROM node:20-alpine AS frontend-build

WORKDIR /app/frontend

# Install dependencies first for better layer caching
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --ignore-scripts

# Copy source and build
COPY frontend/ ./

# Same-origin API in production; override only if the API lives elsewhere
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# ── Stage 2: backend production dependencies ──────────────────────────────────
FROM node:20-alpine AS backend-deps

WORKDIR /app/backend

COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

# ── Stage 3: production runtime ───────────────────────────────────────────────
FROM node:20-alpine AS runner

# dumb-init for proper signal handling (PID 1)
RUN apk add --no-cache dumb-init

# Security: run as non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

WORKDIR /app

# Root manifest (metadata only — start/migrate use npm --prefix, not workspaces,
# because only backend/node_modules ships in this image)
COPY package.json ./package.json

COPY --from=backend-deps --chown=appuser:appgroup /app/backend/node_modules /app/backend/node_modules
COPY --chown=appuser:appgroup backend/ /app/backend

# Baked-in frontend bundle — app.js serves it when backend/public exists
COPY --from=frontend-build --chown=appuser:appgroup /app/frontend/dist /app/backend/public

ENV NODE_ENV=production
EXPOSE 5000

USER appuser

# Railway injects $PORT; default to 5000 for local runs
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider "http://127.0.0.1:${PORT:-5000}/api/health" || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["npm", "start", "--prefix", "/app/backend"]
