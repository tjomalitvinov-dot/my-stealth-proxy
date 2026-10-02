const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());
const app = express();

let currentProxyIndex = 0;

// Функция для запуска браузера со строго определенным прокси
const parseWithProxy = async (targetUrl, selectedIp, login, pass) => {
    const proxyServerUrl = "http://" + selectedIp;
    console.log(`🔄 Пробуем канал: ${selectedIp}`);
    
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
        
        // Снижаем таймаут до 15 сек. Если прокси не загрузил базу за 15 секунд — он труп, меняем его.
        await page.setDefaultNavigationTimeout(15000);
        
        await page.goto(targetUrl, { waitUntil: 'load' });
        
        let cleanHtmlOutput = "";
        let isSuccessParse = false;
        
        // Динамический мониторинг (до 8 секунд)
        for (let check = 1; check <= 20; check++) {
            await new Promise(resolve => setTimeout(resolve, 400));
            
            cleanHtmlOutput = await page.content();
            const titleMatch = cleanHtmlOutput.match(/<title>([^<]+)<\/title>/i);
            const pageTitle = titleMatch ? titleMatch[1] : "Без заголовка";
            const hasNextData = cleanHtmlOutput.includes('__NEXT_DATA__') || cleanHtmlOutput.includes('__INITIAL_STATE__');
            
            if (hasNextData && !pageTitle.toLowerCase().includes('just a moment') && !cleanHtmlOutput.includes('access denied')) {
                console.log(`🎯 [ПРОБИТИЕ!] Страница загружена успешно.`);
                isSuccessParse = true;
                break;
            }
            
            if (cleanHtmlOutput.includes('access denied') || pageTitle.toLowerCase().includes('access denied')) {
                console.warn(`❌ Этот IP заблокирован (Access Denied).`);
                break; 
            }
        }
        
        if (isSuccessParse) {
            return { success: true, html: cleanHtmlOutput };
        } else {
            return { success: false, reason: "Не пробился сквозь Cloudflare" };
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
    
    const login = "mmnvhwqe";
    const pass = "pt6brfln6blc";
    
    // СЮДА ОБЯЗАТЕЛЬНО ВСТАВЬТЕ РАБОЧИЕ РЕЗИДЕНТНЫЕ IP
    const rawIps = [
  "103.237.102.191:11111", "213.111.146.36:18080", "107.150.41.226:18080", "184.75.221.82:3118"

    ];
    
    // Пытаемся по очереди использовать до 3 разных прокси из списка, если предыдущие падают
    for (let proxyAttempt = 1; proxyAttempt <= 3; proxyAttempt++) {
        const selectedIp = rawIps[currentProxyIndex];
        currentProxyIndex = (currentProxyIndex + 1) % rawIps.length;
        
        console.log(`📡 Попытка парсинга через прокси №${proxyAttempt}/3...`);
        const result = await parseWithProxy(targetUrl, selectedIp, login, pass);
        
        if (result.success) {
            res.setHeader('Content-Type', 'text/html; charset=UTF-8');
            return res.send(result.html);
        } else {
            console.warn(`⚠️ Прокси ${selectedIp} не справился (${result.reason}). Переключаемся на следующий...`);
        }
    }
    
    res.setHeader('Content-Type', 'text/plain; charset=UTF-8');
    return res.status(500).send("[ОШИБКА] Три разных прокси подряд не смогли загрузить страницу или упали по таймауту.");
};

app.get('/parse', handleParse);
app.post('/parse', express.json(), handleParse);

const PORT = process.env.PORT || 7860;
app.listen(PORT, () => { console.log(`🚀 Отказоустойчивый ротатор прокси запущен на порту ${PORT}`); });

