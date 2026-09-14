FROM ://microsoft.com

WORKDIR /app

# Копируем списки зависимостей
COPY package*.json ./

# Устанавливаем библиотеки (пропуская dev-пакеты)
RUN npm ci --omit=dev

# Копируем серверный скрипт
COPY server.js ./

# Открываем порт для Google Таблиц / Веб-запросов
EXPOSE 10000

CMD ["node", "server.js"]

