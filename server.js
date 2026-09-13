const express = require('express');
const axios = require('axios');

const app = express();

const handleParse = async (req, res) => {
    const targetUrl = req.query.url || req.body?.url;
    if (!targetUrl) return res.status(400).send("ОШИБКА: Пропущен параметр url!");
    
    console.log(`📡 [БРАУЗЕРНАЯ ИМИТАЦИЯ] Прямой GraphQL прорыв для: ${targetUrl}`);
    
    const skuMatch = targetUrl.match(/-(\d+)\b/);
    const productSku = skuMatch ? skuMatch : null;
    
    if (!productSku) {
        res.setHeader('Content-Type', 'text/plain; charset=UTF-8');
        return res.status(400).send(`[ДИАГНОСТИКА] Ошибка: Не удалось выкусить артикул из ссылки: ${targetUrl}`);
    }

    // Идеальная каноническая GraphQL-структура запроса к LEGO
    const graphqlQuery = {
        operationName: "ProductDetails",
        variables: { 
            productCode: productSku, 
            locale: "de-DE" 
        },
        query: "query ProductDetails($productCode: String!, $locale: String!) { product(productCode: $productCode, locale: $locale) { name productCode variant { price { centAmount formattedAmount } } } }"
    };

    const axiosConfig = {
        timeout: 15000, 
        headers: {
            'connection': 'keep-alive',
            'content-type': 'application/json',
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'accept': '*/*',
            'accept-language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7',
            'accept-encoding': 'gzip, deflate, br',
            'cache-control': 'no-cache',
            'pragma': 'no-cache',
            'origin': 'https://lego.com',
            'referer': targetUrl,
            'x-locale': 'de-DE',
            'x-apollo-operation-name': 'ProductDetails',
            'apollo-require-preflight': 'true'
        }
    };

    try {
        const response = await axios.post('https://lego.com/api/graphql', JSON.stringify(graphqlQuery), axiosConfig);
        const apiData = response.data;
        
        if (apiData && apiData.errors) {
            res.setHeader('Content-Type', 'text/plain; charset=UTF-8');
            return res.status(500).send(`[ОШИБКА API LEGO] Сервер LEGO вернул ошибку GraphQL: ${JSON.stringify(apiData.errors)}`);
        }

        let prodName = "LEGO Product";
        let centAmount = 0;
        let formattedAmount = "0,00 €";

        if (apiData && apiData.data && apiData.data.product) {
            prodName = apiData.data.product.name || prodName;
            const variant = apiData.data.product.variant;
            if (variant && variant.price) {
                centAmount = variant.price.centAmount || centAmount;
                formattedAmount = variant.price.formattedAmount || formattedAmount;
            }
        }

        console.log(`🎯 [БЕЗПРОКСИЙНЫЙ ПРОРЫВ УСПЕШЕН] Данные извлечены! Имя: [${prodName}] | Цена: [${formattedAmount}]`);

        const simulatedHtml = `<!DOCTYPE html><html><head><title>${prodName}</title></head><body><script id="__NEXT_DATA__" type="application/json">{"price":{"__typename":"ProductVariantPrice","formattedAmount":"${formattedAmount}","centAmount":${centAmount}},"product":{"name":"${prodName}","productCode":"${productSku}"}}</script></body></html>`;
        res.setHeader('Content-Type', 'text/html; charset=UTF-8');
        return res.send(simulatedHtml);

    } catch (error) {
        let details = error.message;
        if (error.response) {
            details = `HTTP ${error.response.status} | Ответ: ${JSON.stringify(error.response.data).substring(0, 150)}`;
        }
        console.error("❌ " + details);
        res.setHeader('Content-Type', 'text/plain; charset=UTF-8');
        return res.status(500).send(`[ОТЧЕТ ТЕСТЕРА] Сбой прямого GraphQL: ${details}`);
    }
};

app.get('/parse', handleParse);
app.post('/parse', express.json(), handleParse);

const PORT = process.env.PORT || 7860;
app.listen(PORT, () => { console.log(`🚀 Всеядный беспроксийный GraphQL шлюз запущен на порту ${PORT}`); });



