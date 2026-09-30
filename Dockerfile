FROM node:20-bookworm

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

# Устанавливаем Chrome, системные зависимости и утилиту виртуального экрана xvfb
RUN npx playwright install chromium --with-deps
RUN apt-get update && apt-get install -y xvfb && rm -rf /var/lib/apt/lists/*

COPY server.js ./

EXPOSE 10000

# Запускаем сервер через xvfb-run (имитируем монитор 1920x1080)
CMD ["xvfb-run", "--server-args=-screen 0 1920x1080x24", "node", "server.js"]
