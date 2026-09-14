# Использование официального легковесного образа с уже установленным Chromium
FROM ghcr.io/puppeteer/puppeteer:22.12.0

# Переключаемся на root, чтобы гарантировать корректное создание рабочей папки
USER root
WORKDIR /app

# Копируем зависимости и сразу выставляем владельца pptruser
COPY --chown=pptruser:pptruser package*.json ./

# Устанавливаем Node-модули (npm ci быстрее и чище для Docker, чем npm install)
RUN npm install --omit=dev

# Копируем остальной код проекта с правами pptruser
COPY --chown=pptruser:pptruser server.js ./

# Переключаемся на безопасного пользователя Puppeteer перед запуском
USER pptruser

# Открываем порт (подходит для Hugging Face / Render)
EXPOSE 7860

# Запуск сервера
CMD ["node", "server.js"]
