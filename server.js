const express = require('express');
const axios = require('axios');

const app = express();

const handleParse = async (req, res) => {
    const targetUrl = req.query.url || req.body?.url;
    if (!targetUrl) return res.status(400).send("ОШИБКА: Пропущен параметр url!");
    
    console.log(`📡 [GRAPHQL INTERCEPT] Анализ API LEGO для: ${targetUrl}`);
    
    const skuMatch = targetUrl.match(/-(\d+)\b/);
    const productSku = skuMatch ? skuMatch[1] : null;
    
    if (!productSku) {
        res.setHeader('Content-Type', 'text/plain; charset=UTF-8');
        return res.status(400).send(`[ДИАГНОСТИКА] Ошибка: Не удалось выкусить артикул из ссылки: ${targetUrl}`);
    }

    const graphqlQuery = {
        "operationName": "ProductDetails",
        "variables": { "productCode": productSku, "locale": "de-DE" },
        "query": "query ProductDetails($productCode: String!, $locale: String!) { product(productCode: $productCode, locale: $locale) { name productCode variants { attributes { price { centAmount formattedAmount } } } } }"
    };

    try {
        const response = await axios.post('https://lego.com', graphqlQuery, {
            timeout: 20000,
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Referer': targetUrl,
                'x-locale': 'de-DE',
                'x-apollo-operation-name': 'ProductDetails',
                'apollo-require-preflight': 'true'
            }
        });

        const apiData = response.data;
        
        // --- ТЕСТ 1: Ошибка внутренней валидации самого GraphQL JSON-пакета ---
        if (apiData && apiData.errors) {
            res.setHeader('Content-Type', 'text/plain; charset=UTF-8');
            return res.status(500).send(`[ОШИБКА API LEGO] Сервер LEGO вернул ошибку GraphQL: ${JSON.stringify(apiData.errors)}`);
        }

        let prodName = "LEGO Product";
        let centAmount = 0;
        let formattedAmount = "0,00 €";

        if (apiData && apiData.data && apiData.data.product) {
            prodName = apiData.data.product.name || prodName;
            const variants = apiData.data.product.variants;
            if (variants && variants[0] && variants[0].attributes && variants[0].attributes.price) {
                centAmount = variants[0].attributes.price.centAmount || centAmount;
                formattedAmount = variants[0].attributes.price.formattedAmount || formattedAmount;
            }
        }

        // Если всё успешно, отдаем идеальный симулированный NEXT_DATA кэш
        const simulatedHtml = `<!DOCTYPE html><html><head><title>${prodName}</title></head><body><script id="__NEXT_DATA__" type="application/json">{"price":{"__typename":"ProductVariantPrice","formattedAmount":"${formattedAmount}","centAmount":${centAmount}},"product":{"name":"${prodName}","productCode":"${productSku}"}}</script></body></html>`;
        res.setHeader('Content-Type', 'text/html; charset=UTF-8');
        return res.send(simulatedHtml);

    } catch (error) {
        // --- ТЕСТ 2: Полный сетевой перехват краха (Теневой бан, CSRF, Блокировка IP) ---
        let errorReport = `[КРИТИЧЕСКИЙ КРАХ СЕТИ] Ошибка: ${error.message}`;
        
        if (error.response) {
            errorReport += ` | HTTP Код ответа LEGO: ${error.response.status} | Сырые данные ответа: ${JSON.stringify(error.response.data)}`;
        }
        
        console.error("❌ " + errorReport);
        res.setHeader('Content-Type', 'text/plain; charset=UTF-8');
        return res.status(500).send(errorReport);
    }
};

app.get('/parse', handleParse);
app.post('/parse', express.json(), handleParse);

const PORT = process.env.PORT || 7860;
app.listen(PORT, () => { console.log(`🚀 Текстовый диагностический шлюз запущен на порту ${PORT}`); });


