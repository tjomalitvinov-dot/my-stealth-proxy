FROM node:20-bookworm

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

# Устанавливаем Playwright, Chrome и утилиту виртуального экрана xvfb
RUN npx playwright install chromium --with-deps
RUN apt-get update && apt-get install -y xvfb xauth && rm -rf /var/lib/apt/lists/*

COPY server.js ./

EXPOSE 10000

# Жесткий прямой запуск Node.js, чтобы Render моментально увидел открытый порт 10000!
CMD ["node", "server.js"]
