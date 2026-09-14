FROM ://microsoft.com

WORKDIR /app

# Копируем файлы зависимостей
COPY package*.json ./

# Устанавливаем только prod-зависимости
RUN npm ci --omit=dev

# Копируем остальной код
COPY server.js ./

EXPOSE 10000

CMD ["node", "server.js"]
