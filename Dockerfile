FROM ghcr.io/puppeteer/puppeteer:22.12.0

# Переключаемся под суперпользователя root для установки системных утилит
USER root

# Устанавливаем TOR и утилиту для управления им внутри Linux
RUN apt-get update && apt-get install -y tor curl && rm -rf /var/lib/apt/lists/*

# Настраиваем конфигурацию TOR: разрешаем управление и открываем порт 9050
RUN echo "SocksPort 9050" >> /etc/tor/torrc && \
    echo "ControlPort 9051" >> /etc/tor/torrc && \
    echo "CookieAuthentication 0" >> /etc/tor/torrc && \
    echo "AllowNewCircuits 1" >> /etc/tor/torrc

WORKDIR /app
COPY package.json ./
RUN npm install
COPY server.js ./

EXPOSE 7860

# Запускаем одновременно службу TOR и наше Node.js приложение
CMD service tor start && node server.js
