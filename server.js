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

    console.log(`📡 [DOCKER HYBRID BATCH] Пакетный GraphQL прогон для SKU: [${productSku}]`);

    const login = "mmnvhwqe";
    const pass = "pt6brfln6blc";
    const rawIps = [
        "157.245.70.5:10000", "194.163.175.167:40000", "134.209.29.120:3128",
        "159.195.194.242:8080", "178.16.54.240:44444", "178.128.165.127:10000",
        "161.35.70.249:80", "213.111.146.36:18080", "93.115.20.101:1080", 
        "157.90.10.50:80", "87.199.202.58:443", "213.199.53.16:8888", 
        "95.211.174.135:3128", "109.236.88.82:80", "163.172.53.142:80", "185.200.177.61:3128"
    ];

    const shuffledIps = rawIps.sort(() => Math.random() - 0.5);
    
    // Каноническое тело GraphQL запроса со знаками доллара \$
    const graphqlPayload = {
        operationName: "ProductDetails",
        variables: { 
            productCode: productSku, 
            locale: "de-DE" 
        },
        query: "query ProductDetails(\(productCode: String!,\)locale: String!) { product(productCode: \(productCode, locale:\)locale) { name productCode variant { price { centAmount formattedAmount } } } }"
    };

    let successHtml = null;
    let errorHistory = [];

    // === ВНУТРЕННИЙ СЕТЕВОЙ ЦИКЛ ПЕРЕБОРА НОД ===
    for (let i = 0; i < shuffledIps.length; i++) {
        const currentIp = shuffledIps[i];
        const [proxyHost, proxyPort] = currentIp.split(':');
        
        console.log(`🔄 Сетевой прогон №${i + 1}/${shuffledIps.length} через IP: ${currentIp}...`);

        const axiosConfig = {
            timeout: 6000, // Жесткий лимит 6 секунд на ноду
            headers: {
                'content-type': 'application/json',
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
                'accept': '*/*',
                'accept-language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7',
                'origin': 'https://www.lego.com',
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
            const response = await axios.post('https://lego.com', graphqlPayload, axiosConfig);
            const apiData = response.data;

            if (apiData && apiData.data && apiData.data.product) {
                const prodName = apiData.data.product.name || "LEGO Product";
                const variant = apiData.data.product.variant;
                const centAmount = variant && variant.price ? variant.price.centAmount : 0;
                const formattedAmount = variant && variant.price ? variant.price.formattedAmount : "0,00 €";

                console.log(`🎯 [УСПЕХ В ЦИКЛЕ] Нода ${currentIp} пробила базу! ЦЕНА: [${formattedAmount}]`);
                
                // Генерируем идеальную Next.js обертку для твоей таблицы
                successHtml = `<!DOCTYPE html><html><head><title>${prodName}</title></head><body><script id="__NEXT_DATA__" type="application/json">{"price":{"__typename":"ProductVariantPrice","formattedAmount":"${formattedAmount}","centAmount":${centAmount}},"product":{"name":"${prodName}","productCode":"${productSku}"}}</script></body></html>`;
                break; // Победный разрыв цикла!
            } else {
                let errDetails = apiData.errors ? JSON.stringify(apiData.errors) : "Пустой объект product";
                errorHistory.push(`${currentIp} -> Ошибка GraphQL: ${errDetails}`);
            }
        } catch (error) {
            errorHistory.push(`${currentIp} -> Сбой сети (${error.message})`);
        }
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
app.listen(PORT, () => { console.log(`🚀 Сверхскоростной GraphQL шлюз запущен на порту ${PORT}`); });

