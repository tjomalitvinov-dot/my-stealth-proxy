const express = require('express');
const axios = require('axios');
const app = express();

const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
];

// Умный чистильщик твоего скопированного текстового списка
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
    
    console.log(`📡 Скоростной запуск. Качаем сырой текст страницы: ${targetUrl}`);
    
    // СЮДА ТЫ ВСТАВЛЯЕШЬ СВОЙ СПИСОК «КАК ЕСТЬ»
    const myRawProxyList = [
        "IP Address	Port	Code	Country	Anonymity	Google	Https	Last Checked
"109.199.119.160:80", "176.61.151.123:80", "45.10.163.12:80", "72.56.73.23:80", "195.26.224.135:80", "195.114.209.50:80", "65.21.201.149:8081", "37.187.74.125:80", "202.133.88.173:80", "5.45.126.128:8080", "163.172.53.142:80", "51.75.206.209:80", "80.74.54.148:3128"
    ];
    
    const processedProxies = parseRawInputList(myRawProxyList);
    let badProxiesReport = [];
    let rawHtmlOutput = null;

    // Цикл быстрого текстового перебора
    for (let i = 0; i < processedProxies.length; i++) {
        const currentProxy = processedProxies[i];
        const [proxyHost, proxyPort] = currentProxy.split(':');
        
        console.log(`🔄 Текстовый прорыв №${i + 1}/${processedProxies.length} через IP: ${currentProxy}`);
        
        try {
            const selectedUA = userAgents[Math.floor(Math.random() * userAgents.length)];

            // Делаем чистый GET-запрос без запуска браузера
            const response = await axios.get(targetUrl, {
                proxy: {
                    protocol: 'http',
                    host: proxyHost,
                    port: parseInt(proxyPort, 10)
                },
                headers: {
                    'User-Agent': selectedUA,
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                    'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7',
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                },
                timeout: 5000, // Жесткие 5 секунд на отдачу текста. Быстрые прокси отдадут его мгновенно
                responseType: 'text'
            });

            if (response.data && response.data.length > 5000) {
                // Защита: проверяем, не подсунул ли сайт заглушку блокировки
                if (response.data.includes('403 Forbidden') || response.data.includes('Access Denied')) {
                    throw new Error("Блокировка Akamai/Cloudflare (Код 403)");
                }
                
                rawHtmlOutput = response.data;
                console.log(`✅ УСПЕХ! Сырой HTML текст страницы успешно скачан через: ${currentProxy}`);
                break; // Выходим из цикла, цель достигнута!
            } else {
                throw new Error("Сайт вернул пустой или слишком короткий ответ");
            }

        } catch (error) {
            const errMsg = error.response ? `HTTP ${error.response.status}` : error.message;
            console.error(`❌ Сбой ноды ${currentProxy}: ${errMsg}`);
            badProxiesReport.push({ ip: currentProxy, error: errMsg });
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

    // Отдаем чистый сырой HTML-текст страницы прямо в Google Таблицу
    res.setHeader('Content-Type', 'text/html; charset=UTF-8');
    return res.send(rawHtmlOutput);
};

app.get('/parse', handleParse);
app.post('/parse', express.json(), handleParse);

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => { console.log(`🚀 Высокоскоростной HTTP-шлюз запущен на порту ${PORT}`); });
