FROM mcr.microsoft.com/playwright:v1.49.0-noble

WORKDIR /app

# Копируем списки зависимостей
COPY package*.json ./

# ИСПРАВЛЕНО: используем обычный install вместо жесткого ci
RUN npm install --omit=dev

# Копируем серверный скрипт
COPY server.js ./

# Открываем порт для Render
EXPOSE 10000

CMD ["node", "server.js"]
