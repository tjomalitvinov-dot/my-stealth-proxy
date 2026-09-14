const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// Правильно активируем плагин маскировки
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
    
    console.log(`📡 Заходим на живой сайт: ${targetUrl}`);
    
    const login = "qkldfjel";
    const pass = "vocepvsvpszv";
    const rawIps = [
        "31.59.20.176:6754", "45.38.107.97:6014", "64.137.96.74:6641", "198.23.243.226:6361", 
        "38.154.185.97:6370", "84.247.60.125:6095", "142.111.67.146:5611", "31.58.9.4:6077", 
        "80.74.54.148:3128", "195.114.209.50:80", "176.61.151.123:80", "66.151.34.89:80", 
        "85.17.200.39:3128", "157.90.10.50:80", "85.214.107.177:80", "94.79.152.14:80", "185.85.111.18:80"
    ];
    
    const randomIp = rawIps[Math.floor(Math.random() * rawIps.length)];
    const proxyServerUrl = "http://" + randomIp;
    
    console.log(`🔄 Ротация резидентного канала. Выходим через IP: ${randomIp}`);
    let browser = null;
    
    try {
        const selectedUA = userAgents[Math.floor(Math.random() * userAgents.length)];
        const selectedViewport = viewports[Math.floor(Math.random() * viewports.length)];

        // Запуск через корректное ядро puppeteerCore
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
        
        await page.setDefaultNavigationTimeout(30000);
        await page.goto(targetUrl, { waitUntil: 'networkidle2' });
        
        await page.evaluate(() => { window.scrollBy(0, window.innerHeight / 2); });
        
        const randomDelay = Math.floor(Math.random() * (4000 - 2000 + 1)) + 2000;
        await new Promise(resolve => setTimeout(resolve, randomDelay));
        
        const cleanHtmlOutput = await page.content();
        
        res.setHeader('Content-Type', 'text/html; charset=UTF-8');
        return res.send(cleanHtmlOutput);
        
    } catch (error) { 
        console.error("Сбой Puppeteer: " + error.message);
        res.setHeader('Content-Type', 'text/html; charset=UTF-8');
        return res.status(500).send(`<h1>Ошибка шлюза: во время парсинга произошел сбой</h1>`); 
    } finally { 
        if (browser !== null) {
            try {
                await browser.close();
            } catch (e) {
                console.error("Ошибка закрытия браузера: " + e.message);
            }
        }
    }
};

app.get('/parse', handleParse);
app.post('/parse', express.json(), handleParse);

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => { console.log(`🚀 Шлюз запущен на порту ${PORT}`); });

