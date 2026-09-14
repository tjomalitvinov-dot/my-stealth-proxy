const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());
const puppeteerCore = require('puppeteer-core');
const app = express();

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
    
    console.log(`📡 Режим ДАМПА. Качаем абсолютно любой контент с: ${targetUrl}`);
    
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
    let cleanHtmlOutput = null;
    let fallbackHtml = null; // Сюда сохраним хоть какой-то текст, если все будет плохо

    for (let i = 0; i < processedProxies.length; i++) {
        const currentProxy = processedProxies[i];
        const proxyServerUrl = "http://" + currentProxy;
        let browser = null;

        console.log(`🔄 Попытка №${i + 1}/${processedProxies.length}. Снимаем слепок через IP: ${proxyServerUrl}`);
        
        try {
            const selectedUA = userAgents[Math.floor(Math.random() * userAgents.length)];

            browser = await puppeteerCore.launch({ 
                executablePath: '/usr/bin/google-chrome-stable', 
                headless: true, 
                args: [
                    '--no-sandbox', 
                    '--disable-setuid-sandbox', 
                    `--proxy-server=${proxyServerUrl}`,
                    '--disable-dev-shm-usage', 
                    '--disable-gpu',
                    '--single-process', 
                    '--no-zygote',
                    '--lang=de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7'
                ] 
            });
            
            const page = await browser.newPage();
            
            // Включаем перехват запросов (блокируем только картинки и шрифты, стили оставляем на случай если капче они нужны)
            await page.setRequestInterception(true);
            page.on('request', (request) => {
                if (['image', 'font', 'media'].includes(request.resourceType())) {
                    request.abort();
                } else {
                    request.continue();
                }
            });

            await page.setUserAgent(selectedUA);
            await page.setViewport({ width: 1280, height: 800 });
            
            await page.setDefaultNavigationTimeout(10000); 
            
            // Заходим на сайт
            await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
            
            // Просто ждем 4 секунды. Вообще ничего не проверяем!
            await new Promise(resolve => setTimeout(resolve, 4000));
            
            // Забираем всё, что отрендерилось в HTML
            cleanHtmlOutput = await page.content();
            
            console.log(`✅ Текст успешно вытянут! Длина строки: ${cleanHtmlOutput.length} символов.`);
            await browser.close();
            break; // Нам нужен первый попавшийся ответ, выходим!

        } catch (error) {
            console.error(`❌ Ошибка на ноде ${proxyServerUrl}: ${error.message}`);
            badProxiesReport.push({ ip: currentProxy, error: error.message });
        } finally {
            if (browser !== null) {
                try { await browser.close(); } catch (e) {}
            }
        }
    }

    // Если прокси выдал хоть какой-то контент
    if (cleanHtmlOutput) {
        res.setHeader('Content-Type', 'text/html; charset=UTF-8');
        return res.send(cleanHtmlOutput);
    }

    // Если абсолютно все прокси упали по таймауту сети
    res.setHeader('Content-Type', 'text/html; charset=UTF-8');
    let errorHtml = `<h1><h1>❌ Полный сетевой тайм-аут всего пула!</h1><ul>`;
    badProxiesReport.forEach(item => {
        errorHtml += `<li><b>${item.ip}</b> — <span style="color:red;">${item.error}</span></li>`;
    });
    errorHtml += `</ul>`;
    return res.status(502).send(errorHtml);
};

app.get('/parse', handleParse);
app.post('/parse', express.json(), handleParse);

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => { console.log(`🚀 Дамп-шлюз запущен на порту ${PORT}`); });
