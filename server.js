const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const app = express();

const handleParse = async (req, res) => {
    const targetUrl = req.query.url || req.body?.url;
    if (!targetUrl) return res.status(400).send("<h1>Ошибка: Параметр ?url= не найден!</h1>");
    console.log(`📡 Заходим на живой сайт: ${targetUrl}`);
    
    // БЕЗУПРЕЧНАЯ СБОРКА ТВОИХ ПРОКСИ В ОЗУ (ЗАЩИТА ОТ СРЕЗАНИЙ)
    const login = "qkldfjel";
    const pass = "vocepvsvpszv";
    
    const rawIps = [
        "142.111.67.146:5611", "31.58.9.4:6077", "80.74.54.148:3128", "195.114.209.50:80", "176.61.151.123:80", "66.151.34.89:80", "85.17.200.39:3128", "157.90.10.50:80", "85.214.107.177:80", "94.79.152.14:80", "185.85.111.18:80"
    ];
    
    const randomIp = rawIps[Math.floor(Math.random() * rawIps.length)];
    const proxyServerUrl = "http://" + randomIp;
    
    console.log(`🔄 Ротация резидентного канала. Выходим через IP: ${randomIp}`);
    let browser = null;
    try {
        browser = await puppeteer.launch({ 
            headless: true, 
            args: ['--no-sandbox', '--disable-setuid-sandbox', `--proxy-server=${proxyServerUrl}`, '--disable-blink-features=AutomationControlled', '--disable-dev-shm-usage', '--disable-gpu'] 
        });
        const page = await browser.newPage();
        
        // Авторизация на прокси
        await page.authenticate({ username: login, password: pass });
        
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        await page.evaluateOnNewDocument(() => { Object.defineProperty(navigator, 'webdriver', { get: () => undefined }); });
        
        await page.setDefaultNavigationTimeout(45000);
        await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
        await new Promise(resolve => setTimeout(resolve, 4000));
        
        const cleanHtmlOutput = await page.content();
        res.setHeader('Content-Type', 'text/html; charset=UTF-8');
        return res.send(cleanHtmlOutput);
    } catch (error) { 
        console.error("Сбой Puppeteer: " + error.message);
        return res.status(500).send(`<h1>Ошибка маскированного браузера: ${error.message}</h1>`); 
    }
    finally { if (browser !== null) await browser.close(); }
};
app.get('/parse', handleParse);
app.post('/parse', express.json(), handleParse);
const PORT = process.env.PORT || 7860;
app.listen(PORT, () => { console.log(`🚀 Шлюз запущен на порту ${PORT}`); });

