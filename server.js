const express = require('express');
const axios = require('axios');

const app = express();

const handleParse = async (req, res) => {
    const targetUrl = req.query.url || req.body?.url;
    if (!targetUrl) return res.status(400).send("<h1>Ошибка: URL не найден</h1>");
    
    const skuMatch = targetUrl.match(/-(\d+)\b/);
    const productSku = skuMatch ? skuMatch : null;

    // ТВОИ НОВЫЕ СВЕЖИЕ РЕЗИДЕНТНЫЕ ПРОКСИ
    const login = "mmnvhwqe";
    const pass = "pt6brfln6blc";
    const rawIps = [
        "31.59.20.176:6754", "45.38.107.97:6014", "64.137.96.74:6641",
        "198.23.243.226:6361", "38.154.185.97:6370", "84.247.60.125:6095",
        "142.111.67.146:5611", "191.96.254.138:6185", "31.58.9.4:6077", "198.46.161.42:5092"
    ];

    const shuffledIps = rawIps.sort(() => Math.random() - 0.5);
    console.log(`📡 [DOCKER ULTRA FAST] Сверхбыстрый запуск сетевого перебора по ${shuffledIps.length} нодам...`);
    
    // Формируем чистый GraphQL payload, который использует сам сайт LEGO
    const graphqlPayload = {
        operationName: "ProductDetails",
        variables: { productCode: productSku, locale: "de-DE" },
        query: "query ProductDetails(\(productCode: String!,\)locale: String!) { product(productCode: \(productCode, locale:\)locale) { name productCode variant { price { centAmount formattedAmount } } } }"
    };

    let successHtml = null;
    let errorHistory = [];

    // === СУПЕР-ПЕРЕБОР НА УРОВНЕ СЕТЕВЫХ ПАКЕТОВ AXIOS ЧЕРЕЗ ТВОИ ПРОКСИ ===
    for (let i = 0; i < shuffledIps.length; i++) {
        const currentIp = shuffledIps[i];
        const [proxyHost, proxyPort] = currentIp.split(':');
        
        console.log(`🔄 Сетевой прогон №${i + 1}/${shuffledIps.length} через IP: ${currentIp}...`);

        const axiosConfig = {
            timeout: 5000, // Мега-быстрый таймаут 5 секунд на ноду!
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
            // Бьем прямо в GraphQL LEGO через прокси-туннель без запуска Хрома!
            const response = await axios.post('https://lego.com/api/graphql', graphqlPayload, axiosConfig);
            const apiData = response.data;

            if (apiData && apiData.data && apiData.data.product) {
                const prodName = apiData.data.product.name || "LEGO Product";
                const variant = apiData.data.product.variant;
                const centAmount = variant && variant.price ? variant.price.centAmount : 0;
                const formattedAmount = variant && variant.price ? variant.price.formattedAmount : "0,00 €";

                console.log(`🎯 [УСПЕХ] Прокси ${currentIp} пробил базу LEGO! Имя: [${prodName}] | Цена: [${formattedAmount}]`);
                
                // Симулируем оригинальный Next.js кэш для твоей таблицы
                successHtml = `<!DOCTYPE html><html><head><title>${prodName}</title></head><body><script id="__NEXT_DATA__" type="application/json">{"price":{"__typename":"ProductVariantPrice","formattedAmount":"${formattedAmount}","centAmount":${centAmount}},"product":{"name":"${prodName}","productCode":"${productSku}"}}</script></body></html>`;
                break; // Победный разрыв цикла!
            } else {
                errorHistory.push(`${currentIp} -> Результат 0 (Пустой ответ GraphQL)`);
            }
        } catch (error) {
            let details = error.message;
            if (error.response) details = `HTTP ${error.response.status}`;
            console.warn(`❌ Нода ${currentIp} отклонена: ${details}`);
            errorHistory.push(`${currentIp} -> Сбой ноды (${details})`);
        }
    }

    if (errorHistory.length > 0) {
        res.setHeader('X-Bad-Proxies', errorHistory.join('||'));
    }

    if (successHtml !== null) {
        res.setHeader('Content-Type', 'text/html; charset=UTF-8');
        return res.send(successHtml);
    } else {
        res.setHeader('Content-Type', 'text/plain; charset=UTF-8');
        return res.status(500).send(`[ТОТАЛЬНЫЙ КРАХ ПУЛА] Ни один прокси не смог пробить GraphQL LEGO.\n\nЖурнал:\n${errorHistory.join('\n')}`);
    }
};

app.get('/parse', handleParse);
app.post('/parse', express.json(), handleParse);

const PORT = process.env.PORT || 7860;
app.listen(PORT, () => { console.log(`🚀 Сверхскоростной гибридный GraphQL шлюз запущен на порту ${PORT}`); });
