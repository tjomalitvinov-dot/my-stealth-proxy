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

    // ТВОЙ СВЕЖИЙ ПУЛ БЕСПЛАТНЫХ IP-АДРЕСОВ (Без логинов и паролей)
    const rawIps = [
        "80.74.54.148:3128", "188.165.199.207:80", "195.114.209.50:80", "206.245.131.160:80", 
        "159.195.194.242:8080", "31.76.51.152:80", "109.199.119.160:80", "37.187.74.125:80", 
        "45.10.163.12:80", "157.90.10.50:80", "163.172.53.142:80", "163.172.167.48:80", 
        "77.242.177.57:3128", "176.61.151.123:80", "207.180.254.198:8080", "66.151.34.89:80", 
        "31.220.78.244:80", "135.181.79.187:40001", "194.163.175.167:40000", "65.108.103.19:80", 
        "31.57.28.179:4433", "46.47.197.210:3128", "46.102.156.44:3128", "185.85.111.18:80", 
        "202.133.88.173:80", "194.150.110.134:80", "91.217.33.161:8080"
    ];

    // Перемешиваем массив случайным образом при каждом запросе таблицы, чтобы снизить нагрузку на первые ноды
    const shuffledIps = rawIps.sort(() => Math.random() - 0.5);
    
    console.log(`📡 [ВНУТРЕННИЙ КОНВЕЙЕР] Начинаем перебор пула из ${shuffledIps.length} нод для SKU: [${productSku}]`);

    const graphqlQuery = {
        "operationName": "ProductDetails",
        "variables": { "productCode": productSku, "locale": "de-DE" },
        "query": "query ProductDetails($productCode: String!, $locale: String!) { product(productCode: $productCode, locale: $locale) { name productCode variant { price { centAmount formattedAmount } } } }"
    };

    // Флаг для отслеживания успешного пробития
    let successData = null;
    let errorHistory = [];

    // --- ВНУТРЕННИЙ ЦИКЛ БЕССМЕРТНОЙ РОТАЦИИ ---
    for (let i = 0; i < shuffledIps.length; i++) {
        const currentProxy = shuffledIps[i];
        const [proxyHost, proxyPort] = currentProxy.split(':');
        
        console.log(`🔄 Попытка №${i + 1}/${shuffledIps.length}. Проверяем ноду: ${currentProxy}...`);

        const axiosConfig = {
            timeout: 6000, // Ставим жесткий короткий таймаут 6 сек. Если бесплатный IP висит — сбрасываем и бежим к следующему!
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
                port: parseInt(proxyPort, 10)
            }
        };

        try {
            const response = await axios.post('https://lego.com', graphqlQuery, axiosConfig);
            const apiData = response.data;

            if (apiData && apiData.errors) {
                const msg = `Нода ${currentProxy} отклонена LEGO (GraphQL Error: ${JSON.stringify(apiData.errors)})`;
                console.warn(`⚠️ ${msg}`);
                errorHistory.push(msg);
                continue; // Идем на следующий круг цикла
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

            console.log(`🎯 [ПРОБИТИЕ УСПЕШНО] Нода ${currentProxy} выдала данные! Имя: [${prodName}] | Цена: [${formattedAmount}]`);
            
            // Формируем симулированный HTML кэш
            successData = `<!DOCTYPE html><html><head><title>${prodName}</title></head><body><script id="__NEXT_DATA__" type="application/json">{"price":{"__typename":"ProductVariantPrice","formattedAmount":"${formattedAmount}","centAmount":${centAmount}},"product":{"name":"${prodName}","productCode":"${productSku}"}}</script></body></html>`;
            break; // Мгновенно РАЗРЫВАЕМ цикл, так как цель достигнута!

        } catch (error) {
            let details = error.message;
            if (error.response) {
                details = `HTTP ${error.response.status} (Детали: ${JSON.stringify(error.response.data).substring(0, 30)})`;
            }
            const errorMsg = `Нода ${currentProxy} заблокирована или мертва [${details}]`;
            console.warn(`❌ ${errorMsg}`);
            errorHistory.push(errorMsg);
            // Цикл автоматически перейдет к следующему индексу i++
        }
    }

    // --- ФИНАЛЬНЫЙ СУДНЫЙ ОТВЕТ СЕРВЕРА ---
    if (successData !== null) {
        res.setHeader('Content-Type', 'text/html; charset=UTF-8');
        return res.send(successData);
    } else {
        // Если весь массив из 27 прокси прогнан и никто не ответил, выплевываем полный текстовый отчет
        console.error("💀 Крах: Весь пул прокси полностью лег.");
        res.setHeader('Content-Type', 'text/plain; charset=UTF-8');
        return res.status(500).send(`[ПОЛНЫЙ КРАХ ПУЛА] Ни один прокси не смог пробить API LEGO.\n\nЖурнал падений нод:\n${errorHistory.join('\n')}`);
    }
};

app.get('/parse', handleParse);
app.post('/parse', express.json(), handleParse);

const PORT = process.env.PORT || 7860;
app.listen(PORT, () => { console.log(`🚀 Бессмертный конвейерный GraphQL шлюз запущен на порту ${PORT}`); });



