dockerfile
FROM node:20-bullseye

WORKDIR /app

COPY package*.json ./

RUN npm install

# Устанавливаем Playwright, Chromium и все необходимые Linux библиотеки
RUN npx playwright install chromium --with-deps

COPY server.js ./

EXPOSE 10000

CMD ["node", "server.js"]
