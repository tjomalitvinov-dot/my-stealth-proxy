const express = require('express');
const app = express();

// Легковесная функция, которая будет импортирована динамически для обхода TLS-банов
let gotScraping;
import('got-scraping').then(module => {
    gotScraping = module.gotScraping;
});

const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
];

const parseRawInputList = (linesArray) => {
    let cleanList = [];
    linesArray.forEach(line => {
        const match = line.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\s*[\s\t:]\s*(\d{2,5})/);
        if (match) {
            const ip = match[1];
            const port = match[2];
            if (ip !== '0.0.0.0' && ip !== '127.0.0.7') {
                cleanList.push(`${ip}:${port}`);
            }
        }
    });
    return cleanList;
};

const handleParse = async (req, res) => {
    const targetUrl = req.query.url || req.body?.url;
    if (!targetUrl) return res.status(400).send("<h1>Ошибка: Параметр ?url= не найден!</h1>");
    
    if (!gotScraping) {
        return res.status(503).send("<h1>Шлюз инициализируется, повторите запрос через секунду...</h1>");
    }

    console.log(`📡 Запуск TLS-мимикрии. Качаем HTML LEGO: ${targetUrl}`);
    
    // ТВОЙ ТЕСТОВЫЙ СПИСОК ПРОКСИ
    const myRawProxyList = [
        "156.38.112.11	80	GH	Ghana	elite proxy	no	no	25 secs ago",
        "109.199.119.160	80	FR	France	anonymous	no	no	25 secs ago",
        "162.214.74.29	3128	US	United States	anonymous	no	no	25 secs ago",
        "80.74.54.148	3128	DE	Germany	anonymous	no	no	25 secs ago",
        "162.214.159.94	3128	US	United States	anonymous	no	no	25 secs ago",
        "167.234.251.155	8880	BR	Brazil	anonymous	no	no	25 secs ago",
        "195.26.224.135	80	NL	Netherlands	anonymous	no	no	25 secs ago",
        "163.172.53.142	80	FR	France	elite proxy	no	no	25 secs ago",
        "149.248.18.106	8118	US	United States	elite proxy	yes	yes	25 secs ago",
        "103.237.102.191	11111	DE	Germany	elite proxy	yes	yes	25 secs ago",
        "158.179.58.126	3128	DE	Germany	anonymous		no	1 min ago",
        "45.10.163.12	80	DE	Germany	elite proxy		no	1 min ago",
        "185.21.8.66	1080	DE	Germany	anonymous		yes	1 min ago"
    ];
    
    const processedProxies = parseRawInputList(myRawProxyList);
    let badProxiesReport = [];
    let rawHtmlOutput = null;

    for (let i = 0; i < processedProxies.length; i++) {
        const currentProxy = processedProxies[i];
        
        console.log(`🔄 Прорыв №${i + 1}/${processedProxies.length} через HTTP-TLS маскировку IP: ${currentProxy}`);
        
        try {
            const selectedUA = userAgents[Math.floor(Math.random() * userAgents.length)];

            // Используем gotScraping — он автоматически подделывает подпись TLS под Chrome
            const response = await gotScraping({
                url: targetUrl,
                proxyUrl: `http://${currentProxy}`,
                headers: {
                    'User-Agent': selectedUA,
                    'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7',
                    'Cache-Control': 'no-cache'
                },
                // Зажимаем таймаут до 3 секунд, чтобы Google Таблица не висела по 3 минуты!
                timeout: { request: 3000 }, 
                retry: { limit: 0 }
            });

            if (response.body && response.body.length > 5000) {
                if (response.body.includes('403 Forbidden') || response.body.includes('Access Denied')) {
                    throw new Error("Заблокировано Akamai на уровне HTTP 403");
                }
                
                rawHtmlOutput = response.body;
                console.log(`✅ УСПЕХ! Сгенерированный HTML успешно стянут через: ${currentProxy}`);
                break; 
            } else {
                throw new Error("Пустой ответ от прокси");
            }

        } catch (error) {
            console.error(`❌ Сбой ноды ${currentProxy}: ${error.message}`);
            badProxiesReport.push({ ip: currentProxy, error: error.message });
        }
    }

    if (!rawHtmlOutput) {
        res.setHeader('Content-Type', 'text/html; charset=UTF-8');
        let errorHtml = `<h1>❌ Все прокси из твоего текстового списка отклонили запрос!</h1><h3>Отчет перебора:</h3><ul>`;
        badProxiesReport.forEach(item => {
            errorHtml += `<li><b>${item.ip}</b> — <span style="color:red;">${item.error}</span></li>`;
        });
        errorHtml += `</ul>`;
        return res.status(502).send(errorHtml);
    }

    res.setHeader('Content-Type', 'text/html; charset=UTF-8');
    return res.send(rawHtmlOutput);
};

app.get('/parse', handleParse);
app.post('/parse', express.json(), handleParse);

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => { console.log(`🚀 Высокоскоростной TLS-мост запущен на порту ${PORT}`); });

