FROM ghcr.io/puppeteer/puppeteer:22.12.0
WORKDIR /app
COPY package.json ./
RUN npm install
COPY server.js ./
EXPOSE 10000
CMD ["node", "server.js"]
