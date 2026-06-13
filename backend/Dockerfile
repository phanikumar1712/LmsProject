# ── Stage 1: Install production dependencies ──────────────────────────────────
FROM node:20-alpine AS deps

WORKDIR /app

# Copy only manifest files first for better layer caching
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

# ── Stage 2: Production runtime image ─────────────────────────────────────────
FROM node:20-alpine AS runner

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Security: run as non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Copy production node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source code (respects .dockerignore)
COPY . .

# Set correct ownership
RUN chown -R appuser:appgroup /app

USER appuser

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:5000/api/health || exit 1

# Use dumb-init as PID 1 to handle signals properly
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "src/index.js"]
