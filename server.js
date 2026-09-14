const express = require('express');
const app = express();

let gotScraping;
import('got-scraping').then(module => {
    gotScraping = module.gotScraping;
});

const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
];

const handleParse = async (req, res) => {
    const targetUrl = req.query.url || req.body?.url;
    if (!targetUrl) return res.status(400).send("<h1>Ошибка: Параметр ?url= не найден!</h1>");
    if (!gotScraping) return res.status(503).send("<h1>Инициализация TLS...</h1>");

    console.log(`📡 Высокоскоростной TLS-запрос текста: ${targetUrl}`);
    
    // ВСТАВЛЯЙ СЮДА СВОИ СВЕЖИЕ ПРОКСИ, КОГДА ТЕСТИРУЕШЬ
    const proxyLine = req.query.proxy || "159.195.194.242:8080"; 
    const proxyServerUrl = proxyLine.startsWith('http') ? proxyLine : `http://${proxyLine}`;

    try {
        const selectedUA = userAgents[Math.floor(Math.random() * userAgents.length)];

        // Библиотека got-scraping полностью подменяет JA3/TLS отпечаток под Chrome, обходя Akamai
        const response = await gotScraping({
            url: targetUrl,
            proxyUrl: proxyServerUrl,
            headers: {
                'User-Agent': selectedUA,
                'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7',
                'Cache-Control': 'no-cache'
            },
            timeout: { request: 6000 }, 
            retry: { limit: 0 }
        });

        if (response.body && response.body.length > 5000) {
            if (response.body.includes('403 Forbidden') || response.body.includes('Access Denied')) {
                throw new Error("Заблокировано Akamai на уровне HTTP 403");
            }
            res.setHeader('Content-Type', 'text/html; charset=UTF-8');
            return res.send(response.body);
        } else {
            throw new Error("Пустой ответ от прокси");
        }
    } catch (error) {
        console.error(`❌ Сбой ноды ${proxyServerUrl}: ${error.message}`);
        res.setHeader('Content-Type', 'text/html; charset=UTF-8');
        return res.status(502).send(`<h1>Ошибка прокси ${proxyServerUrl}: ${error.message}</h1>`);
    }
};

// Привязываем назад наш родной проверенный эндпоинт парсинга страниц
app.get('/parse', handleParse);
app.post('/parse', express.json(), handleParse);

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => { console.log(`🚀 TLS-шлюз запущен на порту ${PORT}`); });



