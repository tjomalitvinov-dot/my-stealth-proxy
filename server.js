const express = require('express');
const axios = require('axios');
const compression = require('compression');

const app = express();
app.use(compression()); // Включаем GZIP-сжатие потока трафика

const handleParse = async (req, res) => {
    const targetUrl = req.query.url || req.body?.url;
    if (!targetUrl) return res.status(400).send("<h1>Ошибка: URL не найден</h1>");
    
    const skuMatch = targetUrl.match(/-(\d+)\b/);
    const productSku = skuMatch ? skuMatch[1] : null;

    console.log(`📡 [DOCKER GRAPHQL] Прямой проброс пакета для SKU: [${productSku}]`);

    const login = "mmnvhwqe";
    const pass = "pt6brfln6blc";
    const rawIps = [
        "198.46.161.42:5092", "31.59.20.176:6754", "45.38.107.97:6014", 
        "64.137.96.74:6641", "198.23.243.226:6361", "38.154.185.97:6370", 
        "84.247.60.125:6095", "142.111.67.146:5611", "191.96.254.138:6185", "31.58.9.4:6077"
    ];

    const randomIp = rawIps[Math.floor(Math.random() * rawIps.length)];
    const [proxyHost, proxyPort] = randomIp.split(':');
    
    console.log(`🔄 Сетевой прогон напрямую через прокси-ноду: ${randomIp}...`);

    // Каноническое тело GraphQL запроса со знаками доллара \$
    const graphqlPayload = {
        operationName: "ProductDetails",
        variables: { 
            productCode: productSku, 
            locale: "de-DE" 
        },
        query: "query ProductDetails(productCode: String!, locale: String!) { product(productCode: productCode, locale: locale) { name productCode variant { price { centAmount formattedAmount } } } }"
    };

    const axiosConfig = {
        timeout: 15000, // Лимит 15 секунд на запрос
        headers: {
            'content-type': 'application/json',
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
            'accept': '*/*',
            'accept-language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7',
            'origin': 'https://lego.com',
            'referer': targetUrl,
            'x-locale': 'de-DE',
            'x-apollo-operation-name': 'ProductDetails',
            'apollo-require-preflight': 'true'
        },
        proxy: {
            protocol: 'http',
            host: proxyHost,
            port: parseInt(proxyPort, 10),
            auth: { username: login, password: pass }
        }
    };

    try {
        const response = await axios.post('https://lego.com/api/graphql', graphqlPayload, axiosConfig);
        const apiData = response.data;

        if (apiData && apiData.data && apiData.data.product) {
            const prodName = apiData.data.product.name || "LEGO Product";
            const variant = apiData.data.product.variant;
            const centAmount = variant && variant.price ? variant.price.centAmount : 0;
            const formattedAmount = variant && variant.price ? variant.price.formattedAmount : "0,00 €";

            console.log(`🎯 [ПРОБИТИЕ УСПЕШНО] База LEGO ответила! ЦЕНА: [${formattedAmount}]`);
            
            // Генерируем идеальную Next.js обертку для твоей таблицы
            const successHtml = `<!DOCTYPE html><html><head><title>${prodName}</title></head><body><script id="__NEXT_DATA__" type="application/json">{"price":{"__typename":"ProductVariantPrice","formattedAmount":"${formattedAmount}","centAmount":${centAmount}},"product":{"name":"${prodName}","productCode":"${productSku}"}}</script></body></html>`;
            
            res.setHeader('Content-Type', 'text/html; charset=UTF-8');
            return res.send(successHtml);
        } else {
            let errDetails = apiData.errors ? JSON.stringify(apiData.errors) : "Пустой объект product";
            return res.status(500).send(`[ОШИБКА GRAPHQL] Сервер LEGO вернул сбой: ${errDetails}`);
        }
    } catch (error) {
        let details = error.message;
        if (error.response) details = `HTTP ${error.response.status} | ${JSON.stringify(error.response.data)}`;
        return res.status(500).send(`[КРАХ СЕТЕВОГО ТУННЕЛЯ]: ${details}`);
    }
};

app.get('/parse', handleParse);
app.post('/parse', express.json(), handleParse);

const PORT = process.env.PORT || 7860;
app.listen(PORT, () => { console.log(`🚀 Сверхскоростной GraphQL шлюз запущен на порту ${PORT}`); });
