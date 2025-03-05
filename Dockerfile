FROM node:18
RUN apt-get update && apt-get install -y \
    libxss1 libxtst6 libx11-xcb1 libxrandr2 libasound2 \
    libpangocairo-1.0-0 libatk1.0-0 libatk-bridge2.0-0 \
    libgtk-3-0 libnss3 libxcomposite1 libxcursor1 \
    libxdamage1 libxi6 libgdk-pixbuf2.0-0 libpango-1.0-0 \
    libcups2 libdrm2 libgbm1 libxkbcommon0 \
    libwayland-client0 libwayland-server0 libgles2 libopengl0 \
    fonts-liberation --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
CMD ["node", "index.js"]