FROM ghcr.io/puppeteer/puppeteer:22.12.0

WORKDIR /app

COPY package.json ./
RUN npm install

COPY server.js ./

# Мы убрали EXPOSE, так как Render сам переназначит внутренний порт через PORT env
CMD ["node", "server.js"]
