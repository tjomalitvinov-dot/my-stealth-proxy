const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const compression = require('compression'); // Добавляем модуль сжатия трафика!

puppeteer.use(StealthPlugin());
const app = express();

// Включаем GZIP-сжатие на лету, чтобы огромный Next.js кэш LEGO не обрезался буфером Render!
app.use(compression());

const handleParse = async (req, res) => {
    const targetUrl = req.query.url || req.body?.url;
    if (!targetUrl) return res.status(400).send("<h1>Ошибка: Параметр ?url= не найден!</h1>");
    console.log(`📡 Заходим на живой сайт LEGO/Conrad: ${targetUrl}`);
    
    const login = "mmnvhwqe";
    const pass = "pt6brfln6blc";
    
    const rawIps = [
        "157.245.70.5:10000", "194.163.175.167:40000", "134.209.29.120:3128",
        "159.195.194.242:8080", "178.16.54.240:44444", "178.128.165.127:10000",
        "161.35.70.249:80", "213.111.146.36:18080", "93.115.20.101:1080", 
        "157.90.10.50:80", "87.199.202.58:443", "213.199.53.16:8888", 
        "95.211.174.135:3128", "109.236.88.82:80", "163.172.53.142:80", "185.200.177.61:3128"
    ];
    
    const randomIp = rawIps[Math.floor(Math.random() * rawIps.length)];
    const proxyServerUrl = "http://" + randomIp;
    
    console.log(`🔄 Ротация резидентного канала. Выходим через IP: ${randomIp}`);
    let browser = null;
    try {
        browser = await puppeteer.launch({ 
            headless: true, 
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
        
        // === ЖЕСТКАЯ ДИЕТА: БЛОКИРУЕМ КАРТИНКИ И СТИЛИ ===
        await page.setRequestInterception(true);
        page.on('request', (request) => {
            if (['image', 'stylesheet', 'font', 'media', 'svg'].includes(request.resourceType())) {
                request.abort();
            } else {
                request.continue();
            }
        });
        
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
        await page.evaluateOnNewDocument(() => { Object.defineProperty(navigator, 'webdriver', { get: () => undefined }); });
        
        await page.setDefaultNavigationTimeout(50000);
        
        await page.goto(targetUrl, { waitUntil: 'networkidle2' });
        await new Promise(resolve => setTimeout(resolve, 5500)); // Даем уверенную JS-паузу 5.5 сек
        
        // БУФЕРНЫЙ ВЫВОД: Забираем сырой HTML-код
        const cleanHtmlOutput = await page.content();
        
        // Передаем заголовки сжатия, сообщая Google Таблице, что данные упакованы безопасным gzip
        res.setHeader('Content-Type', 'text/html; charset=UTF-8');
        res.setHeader('Content-Encoding', 'gzip');
        
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
