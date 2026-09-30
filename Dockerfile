FROM ://microsoft.com

WORKDIR /app

# Копируем списки зависимостей
COPY package*.json ./

# Устанавливаем зависимости и принудительно скачиваем Chromium с системными библиотеками
RUN npm install
RUN npx playwright install chromium --with-deps

# Копируем серверный скрипт
COPY server.js ./

# Открываем порт для Render
EXPOSE 10000

CMD ["node", "server.js"]
