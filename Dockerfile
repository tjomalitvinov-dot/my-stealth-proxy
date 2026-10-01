FROM node:20-bookworm

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

# Playwright сам скачает стабильный Chrome и все нужные Linux-зависимости и шрифты
RUN npx playwright install chromium --with-deps

COPY server.js ./

EXPOSE 10000

# Прямой запуск Node.js, чтобы Render моментально увидел открытый порт 10000
CMD ["node", "server.js"]
