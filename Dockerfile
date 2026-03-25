# Alberta Health MCP Server — Docker image for Azure Container Apps
#
# Multi-stage build: install deps + build TypeScript, then create minimal runtime image.
# Includes Chromium for the OAuth authorize flow (server-side Puppeteer auth).

FROM node:22-slim AS builder

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY tsconfig.json ./
COPY src/ ./src/
RUN npx tsc --skipLibCheck

# ── Runtime stage ──────────────────────────────────────────────────────────────
FROM node:22-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

COPY --from=builder /app/build ./build

# Non-root user for security
RUN groupadd -r mcp && useradd -r -g mcp mcp \
    && mkdir -p /home/mcp/.mhr-records \
    && chown -R mcp:mcp /app /home/mcp
USER mcp

ENV NODE_ENV=production
ENV MHR_HTTP_PORT=8080

EXPOSE 8080

CMD ["node", "build/server/http-index.js"]
