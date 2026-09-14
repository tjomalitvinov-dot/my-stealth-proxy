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
    
    console.log(`📡 Запуск браузерного фильтра. Ищем тег данных на: ${targetUrl}`);
    
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

    for (let i = 0; i < processedProxies.length; i++) {
        const currentProxy = processedProxies[i];
        const proxyServerUrl = "http://" + currentProxy;
        let browser = null;

        console.log(`🔄 Попытка №${i + 1}/${processedProxies.length}. Эмуляция Chrome через IP: ${proxyServerUrl}`);
        
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
            
            // Включаем перехват запросов для блокировки тяжелого мусора
            await page.setRequestInterception(true);
            page.on('request', (request) => {
                const resourceType = request.resourceType();
                // Блокируем картинки, стили, шрифты и медиа, чтобы разгрузить бесплатный прокси
                if (['image', 'stylesheet', 'font', 'media', 'imageset'].includes(resourceType)) {
                    request.abort();
                } else {
                    request.continue();
                }
            });

            await page.setUserAgent(selectedUA);
            await page.setViewport({ width: 1280, height: 800 });
            
            // Ставим 10 секунд на общую загрузку
            await page.setDefaultNavigationTimeout(10000); 
            
            // Заходим в режиме domcontentloaded (очень быстро)
            await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
            
            // ЖЕСТКОЕ ТОЧЕЧНОЕ ОЖИДАНИЕ: Ждем появления скрытого тега NEXT_DATA на странице
            // Если вылезла капча, этого тега не будет, и скрипт уйдет в catch, переключив прокси!
            await page.waitForSelector('script[id="__NEXT_DATA__"]', { timeout: 4000 });
            
            cleanHtmlOutput = await page.content();
            
            console.log(`✅ ПРОРЫВ! Тег __NEXT_DATA__ успешно обнаружен через: ${proxyServerUrl}`);
            await browser.close();
            break; 

        } catch (error) {
            console.error(`❌ Сбой ноды ${proxyServerUrl}: ${error.message}`);
            badProxiesReport.push({ ip: currentProxy, error: error.message });
        } finally {
            if (browser !== null) {
                try { await browser.close(); } catch (e) {}
            }
        }
    }

    if (!cleanHtmlOutput) {
        res.setHeader('Content-Type', 'text/html; charset=UTF-8');
        let errorHtml = `<h1>❌ Ни один прокси не смог выдать страницу с тегом __NEXT_DATA__!</h1><h3>Отчет:</h3><ul>`;
        badProxiesReport.forEach(item => {
            errorHtml += `<li><b>${item.ip}</b> — <span style="color:red;">${item.error}</span></li>`;
        });
        errorHtml += `</ul>`;
        return res.status(502).send(errorHtml);
    }

    res.setHeader('Content-Type', 'text/html; charset=UTF-8');
    return res.send(cleanHtmlOutput);
};

app.get('/parse', handleParse);
app.post('/parse', express.json(), handleParse);

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => { console.log(`🚀 Мощный Puppeteer-фильтр запущен на порту ${PORT}`); });

