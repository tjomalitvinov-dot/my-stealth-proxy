# Використовуємо офіційний образ Playwright, де вже є Chromium та всі бібліотеки Linux
FROM ://microsoft.com

WORKDIR /app

# Копіюємо файли залежностей
COPY package*.json ./

# Встановлюємо лише потрібні для продакшену бібліотеки
RUN npm install --omit=dev

# Копіюємо наш серверний скрипт
COPY server.js ./

# Відкриваємо порт для Render
EXPOSE 10000

# Запускаємо сервер (Docker сам знає цю команду, вона зашита сюди)
CMD ["node", "server.js"]
