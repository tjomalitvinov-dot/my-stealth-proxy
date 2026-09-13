FROM ghcr.io/puppeteer/puppeteer:22.12.0

# ВРЕМЕННО ПЕРЕКЛЮЧАЕМСЯ ПОД СУПЕРПОЛЬЗОВАТЕЛЯ ДЛЯ ОБОЙДЕНИЯ БЛОКИРОВКИ ПРАВ
USER root

# Обновляем репозитории Linux и устанавливаем службу TOR
RUN apt-get update && apt-get install -y tor netcat-openbsd curl && rm -rf /var/lib/apt/lists/*

# Прописываем неуязвимые No-Code настройки ротации портов TOR
RUN echo "SocksPort 127.0.0.1:9050" >> /etc/tor/torrc && \
    echo "ControlPort 127.0.0.1:9051" >> /etc/tor/torrc && \
    echo "CookieAuthentication 0" >> /etc/tor/torrc && \
    echo "AllowNewCircuits 1" >> /etc/tor/torrc

# ВОЗВРАЩАЕМ ПРАВА БЕЗОПАСНОСТИ ПОЛЬЗОВАТЕЛЮ NODE ДЛЯ СТАБИЛЬНОЙ РАБОТЫ PUPPETEER
USER node

WORKDIR /app
COPY package.json ./
RUN npm install
COPY server.js ./

EXPOSE 7860

# Запускаем одновременно системную службу TOR и наше Node.js ядро
CMD tor & node server.js

