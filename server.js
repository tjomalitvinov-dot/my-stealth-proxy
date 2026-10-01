const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());
const app = NodeExpress = express();

const handleParse = async (req, res) => {
    const targetUrl = req.query.url || req.body?.url;
    if (!targetUrl) return res.status(400).send("<h1>Ошибка: Параметр url не найден!</h1>");
    
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
    
    console.log(`🔄 [ТЕСТ ЗАЩИТЫ] Выходим через IP: ${randomIp}`);
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
                // УБИРАЕМ --disable-gpu! Включаем программный WebGL рендеринг для обмана PerimeterX
                '--use-gl=angle',
                '--use-angle=swiftshader',
                '--disable-peer-connection-id-generator',
                '--disable-webrtc-encryption',
                '--ignore-certificate-errors',
                '--window-size=1920,1080' // Имитируем FullHD монитор на уровне запуска
            ] 
        });
        const page = await browser.newPage();
        
        // Жестко выставляем FullHD разрешение для обхода проверки размеров окна
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
        
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36');
        
        await page.evaluateOnNewDocument(() => { 
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined }); 
            Object.defineProperty(navigator, 'languages', { get: () => ['de-DE', 'de', 'en-US', 'en'] });
            // Фейкуем аппаратные параметры ПК
            Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
            Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 4 });
            window.chrome = { runtime: {}, loadTimes: function() {}, csi: function() {} };
        });
        
        await page.setDefaultNavigationTimeout(50000);
        const response = await page.goto(targetUrl, { waitUntil: 'networkidle2' });
        const httpStatus = response ? response.status() : "Unknown";
        
        await new Promise(resolve => setTimeout(resolve, 4500));
        const cleanHtmlOutput = await page.content();
        
        // =========================================================================
        // 🔮 АВТОНОМНЫЙ ТЕСТ-РЕНТГЕН НАШЕЙ ЗАЩИТЫ
        // =========================================================================
        const htmlLength = cleanHtmlOutput.length;
        const titleMatch = cleanHtmlOutput.match(/<title>([^<]+)<\/title>/i);
        const pageTitle = titleMatch ? titleMatch[1] : "Без заголовка";
        
        const hasNextData = cleanHtmlOutput.includes('__NEXT_DATA__');
        const isBlockPX = cleanHtmlOutput.toLowerCase().includes('perimeterx') || cleanHtmlOutput.includes('access denied');
        const isBlockCF = pageTitle.toLowerCase().includes('just a moment') || cleanHtmlOutput.includes('cloudflare');

        console.log(`📊 [АНАЛИЗ] Длина: ${htmlLength} | Заголовок: "${pageTitle}" | NextData: [${hasNextData}]`);

        // Если сработал антибот — принудительно выплевываем плоский ТЕКСТОВЫЙ отчет в Google Таблицу!
        if (isBlockPX || isBlockCF || !hasNextData || htmlLength < 30000) {
            let blockReason = "Неизвестная заглушка (Next.js кэш отсутствует)";
            if (isBlockPX) blockReason = "ПОЙМАН АНТИБОТОМ PERIMETERX (Access Denied)";
            if (isBlockCF) blockReason = "ЗАСТРЯЛ НА КАПЧЕ CLOUDFLARE (Just a moment...)";
            
            res.setHeader('Content-Type', 'text/plain; charset=UTF-8');
            return res.status(500).send(`[ОТЧЕТ РЕНТГЕНА] Нас заблокировали!\nПричина: ${blockReason}\nHTTP Код: ${httpStatus}\nДлина кода: ${htmlLength} симв.\nЗаголовок <title>: "${pageTitle}"\n\n=== СРЕЗ ПЕРВЫХ 1000 СИМВОЛОВ ЗАГЛУШКИ ===\n${cleanHtmlOutput.substring(0, 1000)}`);
        }
        // =========================================================================

        res.setHeader('Content-Type', 'text/html; charset=UTF-8');
        return res.send(cleanHtmlOutput);
    } catch (error) { 
        console.error("Сбой Puppeteer: " + error.message);
        res.setHeader('Content-Type', 'text/plain; charset=UTF-8');
        return res.status(500).send(`[КРИТИЧЕСКИЙ СБОЙ СЕРВЕРА]: ${error.message}`); 
    }
    finally { if (browser !== null) await browser.close(); }
};

app.get('/parse', handleParse);
app.post('/parse', express.json(), handleParse);

const PORT = process.env.PORT || 7860;
app.listen(PORT, () => { console.log(`🚀 Зрячий маскированный шлюз запущен на порту ${PORT}`); });

app.post('/parse', express.json(), handleParse);

const PORT = process.env.PORT || 7860;
app.listen(PORT, () => { console.log(`🚀 Шлюз успешно запущен на порту ${PORT}`); });

