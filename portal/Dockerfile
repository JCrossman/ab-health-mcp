# Alberta Health Portal — Docker image for Azure Container Apps
#
# Multi-stage build: install deps + build Next.js, then create minimal runtime image.
# Includes Chromium for headless Puppeteer (streamed cloud browser auth).

# ── Build stage ────────────────────────────────────────────────────────────────
FROM node:22-slim AS builder

WORKDIR /app

COPY portal/package.json portal/package-lock.json ./
RUN npm ci

COPY portal/ ./
RUN npm run build

# ── Runtime stage ──────────────────────────────────────────────────────────────
FROM node:22-slim

# Install Chromium and dependencies for headless Puppeteer
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

# Tell Puppeteer where to find Chromium
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV CHROME_PATH=/usr/bin/chromium

WORKDIR /app

COPY portal/package.json portal/package-lock.json ./
RUN npm ci --omit=dev

# Copy Next.js standalone build output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Non-root user for security
RUN groupadd -r portal && useradd -r -g portal portal \
    && mkdir -p /home/portal /dev/shm \
    && chown -R portal:portal /app /home/portal
USER portal

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
# Chrome sandbox works with non-root user + --disable-setuid-sandbox
# Container must be run with --shm-size=256m or tmpfs mount at /dev/shm

EXPOSE 3000

CMD ["node", "server.js"]
