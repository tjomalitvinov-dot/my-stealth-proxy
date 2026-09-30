FROM node:20-bookworm-slim

# Устанавливаем системные зависимости, немецкие/европейские шрифты и официальный Google Chrome
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    fonts-liberation \
    fonts-dejavu \
    fonts-freefont-ttf \
    libgconf-2-4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libgdk-pixbuf2.0-0 \
    libgtk-3-0 \
    libgbm-dev \
    libnss3 \
    libxss1 \
    libasound2 \
    xvfb \
    --no-install-recommends \
    && wget -q -O - https://google.com | apt-key add - \
    && sh -c 'echo "deb [arch=amd64] http://google.com stable main" >> /etc/apt/sources.list.d/google.list' \
    && apt-get update && apt-get install -y google-chrome-stable --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY server.js ./

EXPOSE 10000

# Запуск через виртуальный дисплей Xvfb (имитируем наличие монитора у сервера для обхода отпечатков WebGL)
CMD ["xvfb-run", "--server-args=-screen 0 1920x1080x24", "node", "server.js"]
