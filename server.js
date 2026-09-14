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
    // Считываем флаг render из запроса основного скрипта (true/false)
    const isRenderMode = req.query.render === 'true' || req.body?.render === true;

    if (!targetUrl) return res.status(400).send("<h1>Ошибка: Параметр ?url= не найден!</h1>");
    
    if (!gotScraping && !isRenderMode) {
        return res.status(503).send("<h1>Шлюз инициализируется, повторите запрос через секунду...</h1>");
    }

    // ТВОЙ ТЕСТОВЫЙ СПИСОК ПРОКСИ
    const myRawProxyList = [
        "34.220.80.147	12345	US	United States	elite proxy	no	yes	17 secs ago",
        "195.114.209.50	80	ES	Spain	elite proxy	no	no	17 secs ago",
        "47.85.161.37	3128	US	United States	elite proxy	no	no	17 secs ago",
        "104.225.220.233	80	US	United States	elite proxy		no	17 secs ago",
        "51.75.206.209	80	FR	France	elite proxy	no	no	17 secs ago",
        "103.65.237.92	5678	ID	Indonesia	anonymous		no	17 secs ago",
        "58.187.104.62	2113	VN	Vietnam	elite proxy	no	yes	17 secs ago",
        "47.79.78.59	18080	HK	Hong Kong	elite proxy		no	17 secs ago",
        "165.154.162.73	8888	US	United States	elite proxy	no	yes	17 secs ago",
        "114.111.151.41	80	AU	Australia	elite proxy		no	17 secs ago",
        "69.87.216.54	7989	US	United States	elite proxy	yes	yes	17 secs ago",
        "73.162.86.230	443	US	United States	anonymous	no	yes	17 secs ago",
        "194.163.175.167	40000	FR	France	elite proxy		no	17 secs ago",
        "107.150.41.226	18080	US	United States	elite proxy	no	yes	17 secs ago",
        "47.91.104.88	3128	AE	United Arab Emirates	elite proxy		no	17 secs ago",
        "91.103.120.48	80	HK	Hong Kong	anonymous	no	no	17 secs ago",
        "8.215.112.214	7777	ID	Indonesia	elite proxy	no	yes	17 secs ago",
        "8.215.112.240	7777	ID	Indonesia	elite proxy	no	yes	17 secs ago",
        "14.251.13.20	8080	VN	Vietnam	elite proxy	yes	yes	17 secs ago",
        "103.237.102.191	11111	DE	Germany	elite proxy	no	yes	17 secs ago",
        "166.1.61.57	1080	JP	Japan	elite proxy		no	17 secs ago",
        "14.161.10.46	80	VN	Vietnam	anonymous	no	no	17 secs ago",
        "69.48.201.94	80	US	United States	elite proxy		no	17 secs ago",
        "47.81.56.193	8888	TH	Thailand	elite proxy	yes	yes	17 secs ago",
        "39.109.113.97	4090	HK	Hong Kong	anonymous		no	17 secs ago",
        "5.42.127.131	80	DE	Germany	anonymous		no	17 secs ago",
        "34.134.231.117	3129	US	United States	anonymous	no	yes	17 secs ago",
        "47.237.138.184	3128	SG	Singapore	elite proxy		no	17 secs ago",
        "197.221.240.247	80	ZW	Zimbabwe	anonymous		no	17 secs ago",
        "176.99.134.183	8090	RU	Russian Federation	elite proxy		no	17 secs ago",
        "45.194.41.141	8080	IN	India	anonymous		no	17 secs ago",
        "46.47.197.210	3128	RU	Russian Federation	elite proxy	no	no	17 secs ago",
        "219.93.101.63	80	MY	Malaysia	anonymous	no	no	17 secs ago",
        "219.93.101.62	80	MY	Malaysia	anonymous	no	no	17 secs ago",
        "5.45.126.128	8080	EE	Estonia	anonymous	no	no	17 secs ago",
        "8.219.97.248	80	SG	Singapore	anonymous	no	no	17 secs ago",
        "197.255.126.69	80	GH	Ghana	elite proxy		no	24 secs ago",
        "54.238.38.227	8080	JP	Japan	elite proxy	no	yes	1 min ago"
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
