const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());
const app = express();

const login = "mmnvhwqe";
const pass = "pt6brfln6blc";
const rawIps = [
    "103.237.102.191:11111", 
    "213.111.146.36:18080", 
    "107.150.41.226:18080", 
    "184.75.221.82:3118"
];

// Глобальный счетчик для строгого перебора прокси по порядку
let currentProxyIndex = 0;

// Глобальный пул запущенных браузеров, чтобы не инициализировать Chrome каждый раз с нуля
const browserPool = {};

// Функция предварительной инициализации пула браузеров при старте сервера
const initBrowserPool = async () => {
    console.log("🏗️  Инициализация бессмертного пула Docker-Chrome...");
    for (const ip of rawIps) {
        try {
            const proxyServerUrl = "http://" + ip;
            const browser = await puppeteer.launch({ 
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
            browserPool[ip] = browser;
            console.log(`✅ Браузер для прокси ${ip} успешно запущен и готов к работе.`);
        } catch (err) {
            console.error(`❌ Не удалось запустить браузер для прокси ${ip}: ${err.message}`);
        }
    }
    console.log("🚀 Все инстансы Chrome прогреты и находятся в памяти!");
};

const handleParse = async (req, res) => {
    const targetUrl = req.query.url || req.body?.url;
    if (!targetUrl) return res.status(400).send("<h1>Ошибка: Параметр ?url= не найден!</h1>");
    
    // Выбираем прокси строго по порядку (Round-Robin)
    const selectedIp = rawIps[currentProxyIndex];
    currentProxyIndex = (currentProxyIndex + 1) % rawIps.length;
    
    console.log(`📡 Заходим на живой сайт LEGO/Conrad: ${targetUrl}`);
    console.log(`🔄 Используем прогретый Docker-Chrome через резидентный канал (по порядку): ${selectedIp}`);
    
    let browser = browserPool[selectedIp];
    
    // Страховка: если браузер из пула почему-то упал или закрылся, пересоздаем его на лету
    if (!browser || !browser.isConnected()) {
        console.warn(`⚠️  Браузер для ${selectedIp} был закрыт или не создан. Пересоздаем инстанс...`);
        const proxyServerUrl = "http://" + selectedIp;
        browser = await puppeteer.launch({ 
            headless: true, 
            executablePath: '/usr/bin/google-chrome',
            args: [
                '--no-sandbox', '--disable-setuid-sandbox', `--proxy-server=${proxyServerUrl}`, 
                '--disable-blink-features=AutomationControlled', '--disable-dev-shm-usage', 
                '--disable-gpu', '--disable-peer-connection-id-generator', '--disable-webrtc-encryption',
                '--ignore-certificate-errors', '--window-size=1920,1080'
            ] 
        });
        browserPool[selectedIp] = browser;
    }

    let page = null;
    try {
        // Открываем новую вкладку в уже работающем браузере (это занимает миллисекунды)
        page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
        await page.authenticate({ username: login, password: pass });
        
        // Ваша 100% рабочая блокировка медиа и стилей
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
        
        await page.setDefaultNavigationTimeout(45000);
        
        let cleanHtmlOutput = "";
        let isSuccessParse = false;
        
        // === ВАШ ОРИГИНАЛЬНЫЙ ЦИКЛ ТРЕХ УМНЫХ ПЕРЕЗАГРУЗОК (БЕЗ ИЗМЕНЕНИЙ КАНАЛА) ===
        for (let attempt = 1; attempt <= 3; attempt++) {
            console.log(`📡 Попытка загрузки №${attempt}/3...`);
            
            if (attempt === 1) {
                await page.goto(targetUrl, { waitUntil: 'networkidle2' });
            } else {
                await page.reload({ waitUntil: 'networkidle2' });
            }
            
            await new Promise(resolve => setTimeout(resolve, 4500));
            cleanHtmlOutput = await page.content();
            
            const titleMatch = cleanHtmlOutput.match(/<title>([^<]+)<\/title>/i);
            const pageTitle = titleMatch ? titleMatch[1] : "Без заголовка";
            const hasNextData = cleanHtmlOutput.includes('__NEXT_DATA__') || cleanHtmlOutput.includes('__INITIAL_STATE__');
            
            if (hasNextData && !pageTitle.toLowerCase().includes('just a moment') && !cleanHtmlOutput.includes('access denied')) {
                console.log(`🎯 [ПРОБИТИЕ НА ПОПЫТКЕ №${attempt}!] Заголовок страницы: "${pageTitle}". Кэш вырезан!`);
                isSuccessParse = true;
                break; 
            } else {
                console.warn(`⚠️ Попытка №${attempt} застряла на проверке Cloudflare/PX (Экран: "${pageTitle}"). Выжидаем паузу и перезагружаем страницу...`);
                await new Promise(resolve => setTimeout(resolve, 3000));
            }
        }
        
        if (!isSuccessParse) {
            res.setHeader('Content-Type', 'text/plain; charset=UTF-8');
            return res.status(500).send("[ОШИБКА] Ни одна из 3 перезагрузок страницы не смогла обойти капчу Cloudflare Turnstile.");
        }
        
        res.setHeader('Content-Type', 'text/html; charset=UTF-8');
        return res.send(cleanHtmlOutput);
        
    } catch (error) { 
        console.error("Сбой Puppeteer: " + error.message);
        return res.status(500).send(`<h1>Ошибка маскированного браузера: ${error.message}</h1>`); 
    } finally { 
        // Закрываем ТОЛЬКО вкладку, сам браузер остается жить в пуле для следующих запросов
        if (page !== null) await page.close().catch(() => {}); 
    }
};

app.get('/parse', handleParse);
app.post('/parse', express.json(), handleParse);

const PORT = process.env.PORT || 7860;
app.listen(PORT, async () => { 
    console.log(`🚀 Бессмертный конвейер перезагрузок запущен на порту ${PORT}`); 
    // Запускаем браузеры сразу при старте приложения
    await initBrowserPool();
});

