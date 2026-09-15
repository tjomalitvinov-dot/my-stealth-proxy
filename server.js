const express = require('express');
const app = express();

// Подключаем Puppeteer со Stealth плагином для обхода продвинутых защит
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

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
        // Регулярное выражение корректно ищет IP и Порт в строке
        const match = line.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\s*[\s\t:]\s*(\d{2,5})/);
        if (match) {
            const ip = match[1];   // ИСПРАВЛЕНО: берем именно найденный IP
            const port = match[2]; // ИСПРАВЛЕНО: берем именно найденный порт
            if (ip !== '0.0.0.0' && ip !== '127.0.0.7') {
                cleanList.push(`${ip}:${port}`);
            }
        }
    });
    return cleanList;
};



const handleParse = async (req, res) => {
    const targetUrl = req.query.url || req.body?.url;
    // Считываем флаг render из запроса основного скрипта (true/false)
    const isRenderMode = req.query.render === 'true' || req.body?.render === true;

    if (!targetUrl) return res.status(400).send("<h1>Ошибка: Параметр ?url= не найден!</h1>");
    
    if (!gotScraping && !isRenderMode) {
        return res.status(503).send("<h1>Шлюз инициализируется, повторите запрос через секунду...</h1>");
    }

    // ТВОЙ ТЕСТОВЫЙ СПИСОК ПРОКСИ
    const myRawProxyList = [
              "26.142.73.209:8080"
              "26.137.240.176:8080"
    ];
    
    const processedProxies = parseRawInputList(myRawProxyList);
    let badProxiesReport = [];
    let rawHtmlOutput = null;

    console.log(`📡 Запуск сессии. Цель: ${targetUrl} | Рендеринг: ${isRenderMode}`);

    for (let i = 0; i < processedProxies.length; i++) {
        const currentProxy = processedProxies[i];
        const selectedUA = userAgents[Math.floor(Math.random() * userAgents.length)];
        
        console.log(`🔄 Проход №${i + 1}/${processedProxies.length} через IP: ${currentProxy}`);
        
        if (isRenderMode) {
            // ---- РЕЖИМ БРАУЗЕРА (PUPPETEER STEALTH) ----
            let browser = null;
            try {
                browser = await puppeteer.launch({
                    headless: true,
                    args: [
                        `--proxy-server=http://${currentProxy}`,
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-dev-shm-usage',
                        '--disable-accelerated-2d-canvas',
                        '--disable-gpu',
                        '--no-first-run',
                        '--no-zygote',
                        '--single-process' // Экономия ОЗУ под лимиты Render.com
                    ]
                });

                const page = await browser.newPage();
                await page.setUserAgent(selectedUA);
                
                // Перехват и блокировка медиа для экономии трафика и оперативной памяти
                await page.setRequestInterception(true);
                page.on('request', (reqIntercept) => {
                    const resource = reqIntercept.resourceType();
                    if (['image', 'stylesheet', 'font', 'media'].includes(resource)) {
                        reqIntercept.abort();
                    } else {
                        reqIntercept.continue();
                    }
                });

                // Переход на LEGO с таймаутом в 15 секунд
                await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
                
                // Небольшая пауза для выполнения AJAX скриптов цены
                await new Promise(resolve => setTimeout(resolve, 2000));

                const content = await page.content();

                if (content && content.length > 5000) {
                    if (content.includes('403 Forbidden') || content.includes('Access Denied')) {
                        throw new Error("Заблокировано Akamai/Cloudflare на уровне браузера");
                    }
                    rawHtmlOutput = content;
                    console.log(`✅ [БРАУЗЕР] Успешно скачали DOM-дерево страницы через: ${currentProxy}`);
                    await browser.close();
                    break; 
                } else {
                    throw new Error("Пустая страница или ответ слишком короткий");
                }

            } catch (error) {
                console.error(`❌ [БРАУЗЕР] Ошибка на узле ${currentProxy}: ${error.message}`);
                badProxiesReport.push({ ip: currentProxy, error: error.message });
            } finally {
                if (browser) await browser.close();
            }

        } else {
            // ---- РЕЖИМ БЫСТРОГО ЗАПРОСА (GOT-SCRAPING) ----
            try {
                const response = await gotScraping({
                    url: targetUrl,
                    proxyUrl: `http://${currentProxy}`,
                    headers: {
                        'User-Agent': selectedUA,
                        'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7',
                        'Cache-Control': 'no-cache'
                    },
                    timeout: { request: 4000 }, 
                    retry: { limit: 0 }
                });

                if (response.body && response.body.length > 5000) {
                    if (response.body.includes('403 Forbidden') || response.body.includes('Access Denied')) {
                        throw new Error("Заблокировано Akamai HTTP-403");
                    }
                    
                    rawHtmlOutput = response.body;
                    console.log(`✅ [HTTP] Успешно скачали код через: ${currentProxy}`);
                    break; 
                } else {
                    throw new Error("Пустой ответ от прокси");
                }

            } catch (error) {
                console.error(`❌ [HTTP] Ошибка на узле ${currentProxy}: ${error.message}`);
                badProxiesReport.push({ ip: currentProxy, error: error.message });
            }
        }
    }

    if (!rawHtmlOutput) {
        res.setHeader('Content-Type', 'text/html; charset=UTF-8');
        let errorHtml = `<h1>❌ Все прокси отклонили запрос! (Режим рендера: ${isRenderMode})</h1><h3>Лог ошибок:</h3><ul>`;
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
