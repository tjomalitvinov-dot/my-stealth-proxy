# Ипользуем официальный готовый образ Microsoft Playwright с Chromium на борту
FROM ://microsoft.com

WORKDIR /app

# Копируем списки зависимостей проекта
COPY package*.json ./

# Устанавливаем библиотеки без лишнего мусора для разработки
RUN npm install --omit=dev

# Копируем наш основной рабочий скрипт сервера
COPY server.js ./

# Открываем порт для входящих запросов Render
EXPOSE 10000

# Запуск нашего моста автоматизации
CMD ["node", "server.js"]
