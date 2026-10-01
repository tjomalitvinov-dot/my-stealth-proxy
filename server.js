const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());
const app = express();

const handleParse = async (req, res) => {
    const targetUrl = req.query.url || req.body?.url;
    if (!targetUrl) return res.status(400).send("<h1>Ошибка: Параметр ?url= не найден!</h1>");
    console.log(`📡 Заходим на живой сайт: ${targetUrl}`);
    
    // ТВОЙ РАБОЧИЙ ПУЛ ПРИВАТНЫХ РЕЗИДЕНТНЫХ ПРОКСИ
    const login = "mmnvhwqe";
    const pass = "pt6brfln6blc";
    
    const rawIps = [
        "31.59.20.176:6754", "45.38.107.97:6014", "64.137.96.74:6641",
        "198.23.243.226:6361", "38.154.185.97:6370", "84.247.60.125:6095",
        "142.111.67.146:5611", "191.96.254.138:6185", "31.58.9.4:6077", 
        "198.46.161.42:5092"
    ];
    
    const randomIp = rawIps[Math.floor(Math.random() * rawIps.length)];
    const proxyServerUrl = "http://" + randomIp;
    
    console.log(`🔄 Ротация резидентного канала. Выходим через IP: ${randomIp}`);
    let browser = null;
    try {
        browser = await puppeteer.launch({ 
            headless: true, 
            // ЖЕСТКАЯ ПРИВЯЗКА К СИСТЕМНОМУ CHROME ВНУТРИ ТВОЕГО DOCKER-ОБРАЗА
            executablePath: '/usr/bin/google-chrome', 
            args: [
                '--no-sandbox', 
                '--disable-setuid-sandbox', 
                `--proxy-server=${proxyServerUrl}`, 
                '--disable-blink-features=AutomationControlled', 
                '--disable-dev-shm-usage', 
                '--disable-gpu',
                '--disable-peer-connection-id-generator',
                '--disable-webrtc-encryption'
            ] 
        });
        const page = await browser.newPage();
        
        await page.authenticate({ username: login, password: pass });
        
        // УМНАЯ ДИЕТА ОЗУ: Блокируем ТОЛЬКО картинки и медиа.
        // Стили и шрифты оставляем, чтобы антибот LEGO верил, что это реальный человек!
        await page.setRequestInterception(true);
        page.on('request', (request) => {
            if (['image', 'media', 'svg'].includes(request.resourceType())) {
                request.abort();
            } else {
                request.continue();
            }
        });
        
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36');
        await page.evaluateOnNewDocument(() => { Object.defineProperty(navigator, 'webdriver', { get: () => undefined }); });
        
        await page.setDefaultNavigationTimeout(50000);
        
        // ЖДЕМ ПОЛНОЙ ПРОГРУЗКИ СЕТЕВЫХ СКРИПТОВ 'networkidle2' Вместо поверхностного domcontentloaded
        await page.goto(targetUrl, { waitUntil: 'networkidle2' });
        // Даем фиксационную паузу 4.5 секунды, чтобы React разложил JSON-стейты в HTML
        await new Promise(resolve => setTimeout(resolve, 4500));
        
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
