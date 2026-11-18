# ============================================
# Dockerfile untuk Railway / Render - WhatsApp Scheduler
# ============================================

FROM node:20-slim

# Install Chromium dependencies untuk Puppeteer
RUN apt-get update && apt-get install -y \
    chromium \
    chromium-driver \
    fonts-liberation \
    fonts-noto-color-emoji \
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
    libxfixes3 \
    libxrandr2 \
    libxss1 \
    libxtst6 \
    wget \
    xdg-utils \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Set Puppeteer untuk pakai Chromium sistem (bukan download sendiri)
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

# Copy package.json dari folder cli
COPY cli/package.json ./package.json

# Install dependencies
RUN npm install --omit=dev

# Copy semua file cli
COPY cli/ ./

# Port default (Render inject $PORT otomatis)
EXPOSE 3000

# Start server
CMD ["node", "server.js"]
