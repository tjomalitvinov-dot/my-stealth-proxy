const express = require('express');

// Правильно связываем puppeteer-extra с облегченным ядром puppeteer-core для Docker
const puppeteer = require('puppeteer-extra').withValue(require('puppeteer-core'));
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// Активируем плагин маскировки (строго один раз)
puppeteer.use(StealthPlugin());

const app = express();

// Список актуальных User-Agents и разрешений для мимикрии
const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
];

const viewports = [
    { width: 1920, height: 1080 },
    { width: 1440, height: 900 },
    { width: 1366, height: 768 }
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
        // Выбираем случайные фингерпринты для этой сессии
        const selectedUA = userAgents[Math.floor(Math.random() * userAgents.length)];
        const selectedViewport = viewports[Math.floor(Math.random() * viewports.length)];

        browser = await puppeteer.launch({ 
            executablePath: '/usr/bin/google-chrome', // Обязательный путь к браузеру внутри официального Docker-образа
            headless: true, 
            args: [
                '--no-sandbox', 
                '--disable-setuid-sandbox', 
                `--proxy-server=${proxyServerUrl}`,
                '--disable-dev-shm-usage', 
                '--disable-gpu',
                '--start-maximized',
                '--lang=ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7' // Маскировка языка системы
            ] 
        });
        
        const page = await browser.newPage();
        
        // Авторизация на прокси
        await page.authenticate({ username: login, password: pass });
        
        // Настройка фингерпринтов страницы
        await page.setUserAgent(selectedUA);
        await page.setViewport(selectedViewport);
        
        // Установка реалистичных HTTP-заголовков браузера
        await page.setExtraHTTPHeaders({
            'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'Upgrade-Insecure-Requests': '1'
        });
        
        await page.setDefaultNavigationTimeout(45000);
        
        // Переход. Использование networkidle2 вместо domcontentloaded лучше имитирует полную загрузку скриптов метрик
        await page.goto(targetUrl, { waitUntil: 'networkidle2' });
        
        // Легкая имитация человеческого поведения (скролл)
        await page.evaluate(() => {
            window.scrollBy(0, window.innerHeight / 2);
        });

        // Случайная пауза от 3 до 5 секунд перед снятием слепка HTML
        const randomDelay = Math.floor(Math.random() * (5000 - 3000 + 1)) + 3000;
        await new Promise(resolve => setTimeout(resolve, randomDelay));
        
        const cleanHtmlOutput = await page.content();
        res.setHeader('Content-Type', 'text/html; charset=UTF-8');
        return res.send(cleanHtmlOutput);
        
    } catch (error) { 
        console.error("Сбой Puppeteer: " + error.message);
        return res.status(500).send(`<h1>Ошибка маскированного браузера: ${error.message}</h1>`); 
    } finally { 
        if (browser !== null) await browser.close(); 
    }
};

app.get('/parse', handleParse);
app.post('/parse', express.json(), handleParse);

const PORT = process.env.PORT || 7860;
app.listen(PORT, () => { console.log(`🚀 Шлюз запущен на порту ${PORT}`); });
