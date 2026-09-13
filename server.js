const express = require('express');
const axios = require('axios');

const app = express();

const handleParse = async (req, res) => {
    const targetUrl = req.query.url || req.body?.url;
    if (!targetUrl) return res.status(400).send("ОШИБКА: Пропущен параметр url!");
    
    const skuMatch = targetUrl.match(/-(\d+)\b/);
    const productSku = skuMatch ? skuMatch : null;
    
    if (!productSku) {
        res.setHeader('Content-Type', 'text/plain; charset=UTF-8');
        return res.status(400).send(`[ДИАГНОСТИКА] Ошибка: Не удалось выкусить артикул из ссылки: ${targetUrl}`);
    }

    const login = "qkldfjel";
    const pass = "vocepvsvpszv";
    const rawIps = [
        "31.59.20.176:6754", "45.38.107.97:6014", "64.137.96.74:6641", "198.23.243.226:6361", 
        "38.154.185.97:6370", "84.247.60.125:6095", "142.111.67.146:5611", "31.58.9.4:6077", 
        "80.74.54.148:3128", "195.114.209.50:80", "176.61.151.123:80", "66.151.34.89:80", 
        "85.17.200.39:3128", "157.90.10.50:80", "85.214.107.177:80", "94.79.152.14:80", "185.85.111.18:80"
    ];
    
    const randomIp = rawIps[Math.floor(Math.random() * rawIps.length)];
    
    console.log(`🥷 [ВСЕЯДНЫЙ GRAPHQL] Прорыв через ноду: ${randomIp} для SKU: [${productSku}]`);

    // ВСЕЯДНЫЙ ЗАПРОС: Тянем цену напрямую из объекта variant без глубоких attributes, что работает для ЛЮБЫХ наборов!
    const graphqlQuery = {
        "operationName": "ProductDetails",
        "variables": { "productCode": productSku, "locale": "de-DE" },
        "query": "query ProductDetails($productCode: String!, $locale: String!) { product(productCode: $productCode, locale: $locale) { name productCode variant { price { centAmount formattedAmount } } } }"
    };

    const [proxyHost, proxyPort] = randomIp.split(':');
    const axiosConfig = {
        timeout: 25000,
        headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Referer': targetUrl,
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
        const response = await axios.post('https://lego.com', graphqlQuery, axiosConfig);
        const apiData = response.data;
        
        if (apiData && apiData.errors) {
            res.setHeader('Content-Type', 'text/plain; charset=UTF-8');
            return res.status(500).send(`[ОШИБКА API LEGO] Сервер LEGO вернул ошибку GraphQL: ${JSON.stringify(apiData.errors)}`);
        }

        let prodName = "LEGO Product";
        let centAmount = 0;
        let formattedAmount = "0,00 €";

        // Разбираем новые облегченные слои JSON
        if (apiData && apiData.data && apiData.data.product) {
            prodName = apiData.data.product.name || prodName;
            const variant = apiData.data.product.variant;
            if (variant && variant.price) {
                centAmount = variant.price.centAmount || centAmount;
                formattedAmount = variant.price.formattedAmount || formattedAmount;
            }
        }

        console.log(`✅ [УСПЕХ] Данные извлечены! Имя: [${prodName}] | Цена: [${formattedAmount}]`);

        // Собираем искусственный HTML кэш
        const simulatedHtml = `<!DOCTYPE html><html><head><title>${prodName}</title></head><body><script id="__NEXT_DATA__" type="application/json">{"price":{"__typename":"ProductVariantPrice","formattedAmount":"${formattedAmount}","centAmount":${centAmount}},"product":{"name":"${prodName}","productCode":"${productSku}"}}</script></body></html>`;
        res.setHeader('Content-Type', 'text/html; charset=UTF-8');
        return res.send(simulatedHtml);

    } catch (error) {
        let errorReport = `[КРАХ ТУННЕЛЯ] Ошибка: ${error.message} на ноде ${randomIp}`;
        if (error.response) {
            errorReport += ` | HTTP Код LEGO: ${error.response.status} | Детали: ${JSON.stringify(error.response.data)}`;
        }
        console.error("❌ " + errorReport);
        res.setHeader('Content-Type', 'text/plain; charset=UTF-8');
        return res.status(500).send(errorReport);
    }
};

app.get('/parse', handleParse);
app.post('/parse', express.json(), handleParse);

const PORT = process.env.PORT || 7860;
app.listen(PORT, () => { console.log(`🚀 Всеядный гибридный GraphQL шлюз запущен на порту ${PORT}`); });



