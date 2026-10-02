const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());
const app = express();

let currentProxyIndex = 0;

const handleParse = async (req, res) => {
    const targetUrl = req.query.url || req.body?.url;
    if (!targetUrl) return res.status(400).send("<h1>Ошибка: Параметр ?url= не найден!</h1>");
    console.log(`📡 Заходим на живой сайт LEGO/Conrad: ${targetUrl}`);
    
    const login = "mmnvhwqe";
    const pass = "pt6brfln6blc";
    
    // ВАЖНО: Убедитесь, что здесь стоят ваши РЕЗИДЕНТНЫЕ рабочие прокси
    const rawIps = [
        "193.37.71.46:10808", "180.149.44.182:3128", "47.91.104.88:3128", "164.52.11.194:18080", "156.67.110.124:10808", "161.35.70.249:80", "54.238.38.227:8080", "95.81.107.33:3128", "128.199.202.122:8080", "209.97.150.167:3128", "117.236.124.166:3128", "69.87.216.54:7989", "83.166.247.254:10808", "138.68.60.8:3128", "159.195.194.242:8080", "139.162.78.109:8080", "170.205.37.145:443", "65.108.159.129:8081", "166.1.61.57:1080", "159.203.61.169:3128", "47.254.122.220:5443", "37.148.9.84:2080", "104.161.23.122:5042", "110.74.195.34:25", "43.173.120.13:8899", "165.154.162.73:8888", "164.52.11.194:18080", "180.149.44.182:3128", "107.150.41.226:18080", "38.175.202.151:443", "54.238.38.227:8080", "95.81.107.33:3128", "8.215.112.214:7777", "8.215.112.240:7777", "178.128.26.157:10000", "185.195.71.218:18080", "65.109.215.187:8090", "156.67.110.124:10808", "213.111.146.36:18080", "159.89.87.80:10000", "159.89.239.204:10000", "176.99.134.183:8090", "195.158.8.123:3128", "2.28.105.45:8888", "103.237.102.191:11111", "47.81.56.193:8888", "8.219.74.197:8081", "139.59.1.14:8080", "138.68.60.8:3128", "178.128.146.125:10000", "93.115.20.101:1080", "170.81.131.70:3128", "43.203.114.231:3128", "69.87.216.54:7989", "161.35.70.249:80", "101.36.112.205:1081", "3.211.120.181:443", "198.199.86.11:3128", "138.124.125.198:3128", "166.1.61.57:1080", "140.238.32.108:3128", "129.213.162.27:17777", "159.203.61.169:3128", "195.144.24.57:3128", "45.139.226.199:10804", "85.209.156.148:1080", "47.236.188.63:10808"

    ];
    
    const selectedIp = rawIps[currentProxyIndex];
    currentProxyIndex = (currentProxyIndex + 1) % rawIps.length;
    const proxyServerUrl = "http://" + selectedIp;
    
    console.log(`🔄 Инициализация Docker-Chrome через резидентный канал (по порядку): ${selectedIp}`);
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
            // Оставляем стили (CSS) и скрипты обязательными, иначе Cloudflare/Next.js не отработают
            if (['image', 'media', 'font', 'svg'].includes(request.resourceType())) {
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
        
        // Увеличиваем таймаут на загрузку, так как резидентные прокси могут долго думать
        await page.setDefaultNavigationTimeout(30000);
        
        // Возвращаем 'commit' или 'load' — это дает браузеру принять страницу и начать выполнять JS капчи
        console.log(`📡 Первичный переход на сайт...`);
        await page.goto(targetUrl, { waitUntil: 'load' });
        
        let cleanHtmlOutput = "";
        let isSuccessParse = false;
        
        // === УМНОЕ ДИНАМИЧЕСКОЕ ОЖИДАНИЕ БЕЗ ПЕРЕЗАГРУЗОК СТРАНИЦЫ ===
        // Просто сидим на странице и ждем до 12 секунд, проверяя её каждые 400мс.
        // Если Cloudflare пропустит нас быстрее (например за 1.5 сек), скрипт сработает мгновенно!
        console.log(`⏳ Запуск динамического мониторинга Cloudflare Turnstile...`);
        
        for (let check = 1; check <= 30; check++) {
            await new Promise(resolve => setTimeout(resolve, 400));
            
            cleanHtmlOutput = await page.content();
            const titleMatch = cleanHtmlOutput.match(/<title>([^<]+)<\/title>/i);
            const pageTitle = titleMatch ? titleMatch[1] : "Без заголовка";
            const hasNextData = cleanHtmlOutput.includes('__NEXT_DATA__') || cleanHtmlOutput.includes('__INITIAL_STATE__');
            
            if (hasNextData && !pageTitle.toLowerCase().includes('just a moment') && !cleanHtmlOutput.includes('access denied')) {
                console.log(`🎯 [ПРОБИТИЕ!] Заголовок страницы: "${pageTitle}". Проверка пройдена на ${check * 0.4} сек.`);
                isSuccessParse = true;
                break;
            }
            
            if (pageTitle.toLowerCase().includes('access denied')) {
                console.warn(`❌ Прокси заблокирован целевым сайтом (Access Denied).`);
                break;
            }
        }
        
        if (!isSuccessParse) {
            res.setHeader('Content-Type', 'text/plain; charset=UTF-8');
            return res.status(500).send("[ОШИБКА] Не удалось дождаться пробития защиты Cloudflare за отведенное время.");
        }
        
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
app.listen(PORT, () => { console.log(`🚀 Скрипт плавного ожидания запущен на порту ${PORT}`); });

