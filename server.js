const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// Активируем плагин маскировки
puppeteer.use(StealthPlugin());

// Подключаем облегченное ядро для Docker
const puppeteerCore = require('puppeteer-core');
const app = express();

const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
];

const viewports = [
    { width: 1920, height: 1080 },
    { width: 1440, height: 900 }
];

const handleParse = async (req, res) => {
    const targetUrl = req.query.url || req.body?.url;
    if (!targetUrl) return res.status(400).send("<h1>Ошибка: Параметр ?url= не найден!</h1>");
    
    console.log(`📡 Запрос на парсинг сайта: ${targetUrl}`);
    
    const login = "qkldfjel";
    const pass = "vocepvsvpszv";
    const rawIps = [
        "123.45.67.89:8000",
    "98.76.54.321:8000"
    ];
    
    let badProxiesReport = []; // Сюда собираем отчет о нерабочих прокси
    let cleanHtmlOutput = null;
    let successfulIp = null;

    // Циклический перебор всех доступных прокси по очереди
    for (let i = 0; i < rawIps.length; i++) {
        const currentIp = rawIps[i];
        const proxyServerUrl = "http://" + currentIp;
        let browser = null;

        console.log(`🔄 Попытка №${i + 1}/${rawIps.length}. Тестируем IP: ${currentIp}`);
        
        try {
            const selectedUA = userAgents[Math.floor(Math.random() * userAgents.length)];
            const selectedViewport = viewports[Math.floor(Math.random() * viewports.length)];

            browser = await puppeteerCore.launch({ 
                executablePath: '/usr/bin/google-chrome-stable', 
                headless: true, 
                args: [
                    '--no-sandbox', 
                    '--disable-setuid-sandbox', 
                    `--proxy-server=${proxyServerUrl}`,
                    '--disable-dev-shm-usage', 
                    '--disable-gpu',
                    '--start-maximized',
                    '--single-process', 
                    '--no-zygote',
                    '--lang=ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7'
                ] 
            });
            
            const page = await browser.newPage();
            await page.authenticate({ username: login, password: pass });
            
            await page.setUserAgent(selectedUA);
            await page.setViewport(selectedViewport);
            
            await page.setExtraHTTPHeaders({
                'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Upgrade-Insecure-Requests': '1'
            });
            
            // Уменьшаем таймаут до 15 секунд на одну ноду, чтобы не ждать вечность мертвые IP
            await page.setDefaultNavigationTimeout(15000); 
            
            // Пробуем зайти на сайт
            await page.goto(targetUrl, { waitUntil: 'networkidle2' });
            
            // Если зашли успешно — имитируем человека и забираем код страницы
            await page.evaluate(() => { window.scrollBy(0, window.innerHeight / 2); });
            const randomDelay = Math.floor(Math.random() * (3000 - 1500 + 1)) + 1500;
            await new Promise(resolve => setTimeout(resolve, randomDelay));
            
            cleanHtmlOutput = await page.content();
            successfulIp = currentIp;
            
            console.log(`✅ Успех! Сайт успешно открыт через прокси: ${currentIp}`);
            await browser.close();
            break; // Выходим из цикла перебора, так как нашли рабочий канал!

        } catch (error) {
            console.error(`❌ Прокси ${currentIp} не ответил. Ошибка: ${error.message}`);
            badProxiesReport.push({ ip: currentIp, error: error.message });
        } finally {
            if (browser !== null) {
                try { await browser.close(); } catch (e) {}
            }
        }
    }

    // Если ни один прокси не сработал
    if (!cleanHtmlOutput) {
        res.setHeader('Content-Type', 'text/html; charset=UTF-8');
        let errorHtml = `<h1>❌ Все прокси-ноды из пула лежат!</h1><h3>Отчет о нерабочих нодах:</h3><ul>`;
        badProxiesReport.forEach(item => {
            errorHtml += `<li><b>${item.ip}</b> — <span style="color:red;">${item.error}</span></li>`;
        });
        errorHtml += `</ul>`;
        return res.status(502).send(errorHtml);
    }

    // Если всё прошло успешно, возвращаем HTML целевого сайта
    res.setHeader('Content-Type', 'text/html; charset=UTF-8');
    return res.send(cleanHtmlOutput);
};

app.get('/parse', handleParse);
app.post('/parse', express.json(), handleParse);

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => { console.log(`🚀 Шлюз запущен на порту ${PORT}`); });


