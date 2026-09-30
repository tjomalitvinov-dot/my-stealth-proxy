FROM node:20-bookworm

WORKDIR /app

COPY package*.json ./

RUN npm install

RUN npx playwright install chromium --with-deps

COPY server.js ./

EXPOSE 10000

CMD ["node", "server.js"]
