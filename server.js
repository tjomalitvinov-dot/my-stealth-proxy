const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());
const app = express();

const handleParse = async (req, res) => {
    const targetUrl = req.query.url || req.body?.url;
    if (!targetUrl) return res.status(400).send("<h1>Ошибка: Параметр ?url= не найден!</h1>");
    console.log(`📡 Заходим на живой сайт LEGO/Conrad: ${targetUrl}`);
    
    // ТВОЙ НОВЫЙ РАБОЧИЙ ПУЛ РЕЗИДЕНТНЫХ ПРОКСИ
    const login = "mmnvhwqe";
    const pass = "pt6brfln6blc";
    
    const rawIps = [
        "157.245.70.5:10000",    // Netherlands
        "194.163.175.167:40000", // France
        "134.209.29.120:3128",   // United Kingdom
        "159.195.194.242:8080",  // Germany
        "178.16.54.240:44444",   // Netherlands
        "178.128.165.127:10000", // United Kingdom
        "161.35.70.249:80",      // Germany
        "213.111.146.36:18080",  // Netherlands
        "93.115.20.101:1080",    // Netherlands
        "157.90.10.50:80",       // Germany
        "87.199.202.58:443",     // Netherlands
        "213.199.53.16:8888",    // France
        "95.211.174.135:3128",   // Netherlands
        "109.236.88.82:80",      // Netherlands
        "163.172.53.142:80",     // France
        "185.200.177.61:3128"    // Netherlands
    ];
    
    const randomIp = rawIps[Math.floor(Math.random() * rawIps.length)];
    const proxyServerUrl = "http://" + randomIp;
    
    console.log(`🔄 Ротация резидентного канала. Выходим через IP: ${randomIp}`);
    let browser = null;
    try {
        browser = await puppeteer.launch({ 
            headless: true, 
            executablePath: '/usr/bin/google-chrome', // Твоя эталонная привязка к Docker-Chrome
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
        
        // === ЖЕСТКАЯ ДИЕТА: БЛОКИРУЕМ МЕДИА-МУСОР ДЛЯ СКОРОСТИ ГЕНЕРАЦИИ КЭША ЦЕН ===
        await page.setRequestInterception(true);
        page.on('request', (request) => {
            if (['image', 'stylesheet', 'font', 'media', 'svg'].includes(request.resourceType())) {
                request.abort();
            } else {
                request.continue();
            }
        });
        
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, Gecko) Chrome/124.0.0.0 Safari/537.36');
        await page.evaluateOnNewDocument(() => { Object.defineProperty(navigator, 'webdriver', { get: () => undefined }); });
        
        await page.setDefaultNavigationTimeout(50000);
        
        // Ожидание полной прогрузки сетевых скриптов 'networkidle2'
        await page.goto(targetUrl, { waitUntil: 'networkidle2' });
        // Наша эталонная утренняя пауза 4.5 секунды для фиксации стейта React в HTML
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

// ПЕРЕМЕННАЯ ПОРТА ОБЪЯВЛЕНА СТРОГО ОДИН РАЗ В САМОМ КОНЦЕ ФАЙЛА
const PORT = process.env.PORT || 7860;
app.listen(PORT, () => { console.log(`🚀 Шлюз успешно запущен на порту ${PORT}`); });
