const express = require('express');
const axios = require('axios');

const app = express();

const handleParse = async (req, res) => {
    const targetUrl = req.query.url || req.body?.url;
    if (!targetUrl) return res.status(400).send("<h1>Error: URL parameter is missing!</h1>");
    
    console.log(`📡 [GRAPHQL EXPLOIT] Перехватываем API LEGO для: ${targetUrl}`);
    
    // 1. Вывлекаем номер артикула из ссылки
    const skuMatch = targetUrl.match(/-(\d+)\b/);
    const productSku = skuMatch ? skuMatch[1] : null;
    
    if (!productSku) {
        console.warn(`⚠️ Не удалось извлечь артикул из URL. Отдаем дефолтный аварийный стейт.`);
        const fallbackHtml = `<!DOCTYPE html><html><body><script id="__NEXT_DATA__" type="application/json">{"price":{"centAmount":0,"formattedAmount":"0,00 €"},"product":{"name":"Unknown","productCode":"00000"}}</script></body></html>`;
        res.setHeader('Content-Type', 'text/html; charset=UTF-8');
        return res.send(fallbackHtml);
    }
    
    console.log(`🎯 Зафиксирован артикул: [${productSku}]. Формируем боевой GraphQL-пакет...`);

    // 2. Строим канонический GraphQL пакет
    const graphqlQuery = {
        "operationName": "ProductDetails",
        "variables": { "productCode": productSku, "locale": "de-DE" },
        "query": "query ProductDetails($productCode: String!, $locale: String!) { product(productCode: $productCode, locale: $locale) { name productCode variants { attributes { price { centAmount formattedAmount } } } } }"
    };

    try {
        // 3. БЬЕМ НАПРЯМУЮ В API LEGO С ПОЛНЫМ НАБОРОМ СЕКРЕТНЫХ АНТИ-CSRF ЗАГОЛОВКОВ!
        const response = await axios.post('https://lego.com', graphqlQuery, {
            timeout: 20000,
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Referer': targetUrl,
                'x-locale': 'de-DE',
                // === ХАКЕРСКИЙ ОБХОД CSRF ЗАЩИТЫ APOLLO SERVER ===
                'x-apollo-operation-name': 'ProductDetails',
                'apollo-require-preflight': 'true'
            }
        });

        const apiData = response.data;
        
        // ГЛУБОКИЙ ТЕСТ ОШИБОК: Если API вернуло внутреннюю ошибку Graphql
        if (apiData && apiData.errors) {
            const graphQlError = apiData.errors[0].message || "Unknown GraphQL Error";
            console.error(`❌ База LEGO отклонила запрос: ${graphQlError}`);
            res.setHeader('Content-Type', 'text/html; charset=UTF-8');
            return res.status(500).send(`
                <body style="font-family:sans-serif; padding:20px; background:#fffdf5; color:#700;">
                    <h2>🚨 ТЕСТ ОШИБОК: GRAPHQL API ОТКЛОНИЛ ЗАПРОС</h2>
                    <p><b>Target SKU:</b> ${productSku}</p>
                    <hr style="border:1px solid #ffe0b2;">
                    <p><b>Официальный текст ошибки от сервера LEGO:</b></p>
                    <pre style="background:#fff; padding:15px; border:1px solid #ffe0b2; color:red; font-weight:bold;">${graphQlError}</pre>
                    <hr style="border:1px solid #ffe0b2;">
                    <h3>📄 Полный сырой JSON-ответ API для анализа:</h3>
                    <pre style="background:#fff; padding:15px; border:1px solid #ffe0b2; font-size:12px;">${JSON.stringify(apiData, null, 2)}</pre>
                </body>
            `);
        }

        let prodName = "LEGO Product";
        let centAmount = 0;
        let formattedAmount = "0,00 €";

        // Разбираем входящий GraphQL JSON-слой
        if (apiData && apiData.data && apiData.data.product) {
            prodName = apiData.data.product.name || prodName;
            const variants = apiData.data.product.variants;
            if (variants && variants[0] && variants[0].attributes && variants[0].attributes.price) {
                centAmount = variants[0].attributes.price.centAmount || centAmount;
                formattedAmount = variants[0].attributes.price.formattedAmount || formattedAmount;
            }
        }

        console.log(`✅ Данные успешно выкачаны! Имя: [${prodName}] | Цена: [${formattedAmount}]`);

        // 4. Оборачиваем чистый JSON в идеальную каноническую структуру СЕО данных
        const simulatedHtml = `
            <!DOCTYPE html>
            <html>
            <head><title>${prodName}</title></head>
            <body>
                <script id="__NEXT_DATA__" type="application/json">
                {
                    "price": {
                        "__typename": "ProductVariantPrice",
                        "formattedAmount": "${formattedAmount}",
                        "centAmount": ${centAmount}
                    },
                    "product": {
                        "name": "${prodName}",
                        "productCode": "${productSku}"
                    }
                }
                </script>
            </body>
            </html>
        `;

        res.setHeader('Content-Type', 'text/html; charset=UTF-8');
        return res.send(simulatedHtml);

    } catch (error) {
        const errorMsg = error.response ? `Код: ${error.response.status} | ${JSON.stringify(error.response.data)}` : error.message;
        console.error("❌ Сетевой крах GraphQL: " + errorMsg);
        
        res.setHeader('Content-Type', 'text/html; charset=UTF-8');
        return res.status(500).send(`
            <body style="font-family:sans-serif; padding:20px; background:#fff5f5; color:#900;">
                <h2>🚨 КРИТИЧЕСКИЙ СЕТЕВОЙ КРАХ GRAPHQL МОСТА</h2>
                <p><b>Target URL:</b> ${targetUrl}</p>
                <hr style="border:1px solid #ffcdd2;">
                <p><b>Системная сетевая ошибка:</b> ${error.message}</p>
                <hr style="border:1px solid #ffcdd2;">
                <h3>📄 Сырые детали сетевого ответа (Network Response):</h3>
                <pre style="background:#fff; padding:15px; border:1px solid #ffcdd2; overflow:auto; font-size:12px;">${errorMsg.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
            </body>
        `);
    }
};

app.get('/parse', handleParse);
app.post('/parse', express.json(), handleParse);

const PORT = process.env.PORT || 7860;
app.listen(PORT, () => { console.log(`🚀 Нативный GraphQL-перехватчик "CSRF-Bypass" запущен на порту ${PORT}`); });



const PORT = process.env.PORT || 7860;
app.listen(PORT, () => { console.log(`🚀 Бессмертный GraphQL-мост успешно запущен на порту ${PORT}`); });
