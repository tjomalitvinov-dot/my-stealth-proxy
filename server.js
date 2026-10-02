const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());
const app = express();

// Глобальный счетчик для строгого перебора IP по порядку
let currentProxyIndex = 0;

const login = "mmnvhwqe";
const pass = "pt6brfln6blc";
const rawIps = [
    "87.199.202.58:443", "159.89.239.204:10000", "134.209.29.120:3128",
    "178.16.54.240:44444", "213.111.146.36:18080", 
    "157.90.10.50:80", "213.199.53.16:8888", 
    "95.211.174.135:3128", "163.172.53.142:80"
];

// Сессия парсинга теперь делает только ОДНУ попытку загрузки на один IP
const executeParsingSession = async (targetUrl, proxyIp) => {
    const proxyServerUrl = "http://" + proxyIp;
    console.log(`🔄 Инициализация Docker-Chrome через канал: ${proxyIp}`);
    
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
                '--disable-webrtc-encryption',
                '--ignore-certificate-errors',
                '--window-size=1920,1080'
            ] 
        });
        
        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
        await page.authenticate({ username: login, password: pass });
        
        await page.setRequestInterception(true);
        page.on('request', (request) => {
            if (['image', 'stylesheet', 'font', 'media', 'svg'].includes(request.resourceType())) {
                request.abort();
            } else {
                request.continue();
            }
        });
        
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
        await page.evaluateOnNewDocument(() => { 
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined }); 
            Object.defineProperty(navigator, 'languages', { get: () => ['de-DE', 'de', 'en-US', 'en'] });
            window.chrome = { runtime: {}, loadTimes: function() {}, csi: function() {} };
        });
        
        // Понижаем таймаут до 25 секунд. Если за это время прокси даже не ответил — он мертв.
        await page.setDefaultNavigationTimeout(25000);
        
        console.log(`📡 Загрузка страницы...`);
        await page.goto(targetUrl, { waitUntil: 'networkidle2' });
        
        // Ваша проверенная фиксационная пауза
        await new Promise(resolve => setTimeout(resolve, 4500));
        const cleanHtmlOutput = await page.content();
        
        const titleMatch = cleanHtmlOutput.match(/<title>([^<]+)<\/title>/i);
        const pageTitle = titleMatch ? titleMatch[1] : "Без заголовка";
        const hasNextData = cleanHtmlOutput.includes('__NEXT_DATA__') || cleanHtmlOutput.includes('__INITIAL_STATE__');
        
        // Проверяем успешность
        if (hasNextData && !pageTitle.toLowerCase().includes('just a moment') && !cleanHtmlOutput.includes('access denied')) {
            console.log(`🎯 [ПРОБИТИЕ!] Заголовок страницы: "${pageTitle}". Данные получены!`);
            return { success: true, html: cleanHtmlOutput };
        } else {
            return { success: false, reason: `Застрял на проверке (Экран: "${pageTitle}")` };
        }
        
    } catch (error) {
        return { success: false, reason: error.message };
    } finally {
        if (browser !== null) await browser.close();
    }
};

const handleParse = async (req, res) => {
    const targetUrl = req.query.url || req.body?.url;
    if (!targetUrl) return res.status(400).send("<h1>Ошибка: Параметр ?url= не найден!</h1>");
    console.log(`📡 Заходим на живой сайт LEGO/Conrad: ${targetUrl}`);
    
    // Перебираем до 4 РАЗНЫХ прокси по порядку, если предыдущие не справились.
    // Больше никаких перезагрузок внутри одного IP — только быстрая смена каналов!
    for (let proxyAttempt = 1; proxyAttempt <= 4; proxyAttempt++) {
        const selectedIp = rawIps[currentProxyIndex];
        currentProxyIndex = (currentProxyIndex + 1) % rawIps.length;
        
        console.log(`🚀 [Шаг прокси по порядку №${proxyAttempt}/4] Берем IP: ${selectedIp}`);
        const result = await executeParsingSession(targetUrl, selectedIp);
        
        if (result.success) {
            res.setHeader('Content-Type', 'text/html; charset=UTF-8');
            return res.send(result.html);
        }
        
        console.warn(`❌ Прокси ${selectedIp} не подошел: (${result.reason}). Срочно меняем канал...`);
    }
    
    res.setHeader('Content-Type', 'text/plain; charset=UTF-8');
    return res.status(500).send("[ОШИБКА] 4 разных прокси по порядку не смогли пробить защиту Cloudflare.");
};

app.get('/parse', handleParse);
app.post('/parse', express.json(), handleParse);

const PORT = process.env.PORT || 7860;
app.listen(PORT, () => { console.log(`🚀 Скоростной конвейер с быстрой ротацией запущен на порту ${PORT}`); });
