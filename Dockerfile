FROM ://microsoft.com

WORKDIR /app

# Копируем списки зависимостей
COPY package*.json ./

# Чистая установка только prod-зависимостей
RUN npm ci --omit=dev

# Копируем серверный скрипт
COPY server.js ./

# Открываем порт для Render
EXPOSE 10000

CMD ["node", "server.js"]


