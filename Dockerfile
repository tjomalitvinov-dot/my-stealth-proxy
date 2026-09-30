FROM node:20-bookworm

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

# Playwright сам скачает стабильный Chrome и все нужные Linux-зависимости/шрифты
RUN npx playwright install chromium --with-deps

COPY server.js ./

EXPOSE 10000

CMD ["node", "server.js"]

