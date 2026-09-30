FROM node:20-bookworm

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

# Устанавливаем Playwright, Chrome, а также xvfb и утилиту xauth для авторизации виртуального экрана
RUN npx playwright install chromium --with-deps
RUN apt-get update && apt-get install -y xvfb xauth && rm -rf /var/lib/apt/lists/*

COPY server.js ./

EXPOSE 10000

# Запускаем через виртуальный монитор 1920x1080
CMD ["xvfb-run", "--server-args=-screen 0 1920x1080x24", "node", "server.js"]
