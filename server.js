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

// Глобальный объект аналитики пробиваемости
const proxyStats = {};
rawIps.forEach(ip => {
    proxyStats[ip] = { success: 0, failed: 0, networkErrors: 0, cfBlocks: 0 };
});

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
        
        await page.setDefaultNavigationTimeout(45000);
        
        let cleanHtmlOutput = "";
        let isSuccessParse = false;
        let lastSeenTitle = "Без заголовка";
        
        // === ВОЗВРАЩЕН ВАШ 100% ПРОБИВАЮЩИЙ ЦИКЛ ПЕРЕЗАГРУЗОК СТРАНИЦЫ ===
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
            lastSeenTitle = titleMatch ? titleMatch[1] : "Без заголовка";
            const hasNextData = cleanHtmlOutput.includes('__NEXT_DATA__') || cleanHtmlOutput.includes('__INITIAL_STATE__');
            
            if (hasNextData && !lastSeenTitle.toLowerCase().includes('just a moment') && !cleanHtmlOutput.includes('access denied')) {
                console.log(`🎯 [ПРОБИТИЕ НА ПОПЫТКЕ №${attempt}!] Заголовок страницы: "${lastSeenTitle}". Кэш вырезан!`);
                isSuccessParse = true;
                break; 
            } else {
                console.warn(`⚠️ Попытка №${attempt} застряла на проверке Cloudflare/PX (Экран: "${lastSeenTitle}"). Выжидаем паузу...`);
                await new Promise(resolve => setTimeout(resolve, 3000));
            }
        }
        
        if (isSuccessParse) {
            return { success: true, html: cleanHtmlOutput };
        } else {
            return { success: false, errorType: 'cf_block', reason: `Застрял на проверке (Экран: "${lastSeenTitle}")` };
        }
        
    } catch (error) {
        // Сюда в статистику летят ERR_TUNNEL_CONNECTION_FAILED, ERR_TIMED_OUT и т.д.
        return { success: false, errorType: 'network_error', reason: error.message };
    } finally {
        if (browser !== null) await browser.close();
    }
};

const handleParse = async (req, res) => {
    const targetUrl = req.query.url || req.body?.url;
    if (!targetUrl) return res.status(400).send("<h1>Ошибка: Параметр ?url= не найден!</h1>");
    console.log(`📡 Заходим на живой сайт LEGO/Conrad: ${targetUrl}`);
    
    // Перебираем до 4 разных прокси по порядку, пока товар не спарсится
    for (let proxyAttempt = 1; proxyAttempt <= 4; proxyAttempt++) {
        const selectedIp = rawIps[currentProxyIndex];
        currentProxyIndex = (currentProxyIndex + 1) % rawIps.length;
        
        console.log(`🚀 [Шаг прокси по порядку №${proxyAttempt}/4] Берем IP: ${selectedIp}`);
        const result = await executeParsingSession(targetUrl, selectedIp);
        
        if (result.success) {
            if (proxyStats[selectedIp]) proxyStats[selectedIp].success += 1;
            res.setHeader('Content-Type', 'text/html; charset=UTF-8');
            return res.send(result.html);
        }
        
        // Распределяем сбои по категориям в статистику
        if (proxyStats[selectedIp]) {
            proxyStats[selectedIp].failed += 1;
            if (result.errorType === 'network_error') proxyStats[selectedIp].networkErrors += 1;
            if (result.errorType === 'cf_block') proxyStats[selectedIp].cfBlocks += 1;
        }
        console.warn(`❌ Прокси ${selectedIp} не подошел: (${result.reason}). Срочно меняем канал...`);
    }
    
    res.setHeader('Content-Type', 'text/plain; charset=UTF-8');
    return res.status(500).send("[ОШИБКА] Очередь из 4-х прокси подряд не смогла пробить защиту Cloudflare.");
};

// === ИНФОРМАТИВНЫЙ ЭНДПОИНТ СТАТИСТИКИ ПРОБИВАЕМОСТИ ===
app.get('/stats', (req, res) => {
    let htmlReport = `
    <html>
    <head>
        <title>📊 Детальный отчет прокси</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 40px; background: #f4f6f9; color: #333; }
            table { width: 100%; border-collapse: collapse; background: #fff; box-shadow: 0 4px 6px rgba(0,0,0,0.1); border-radius: 8px; overflow: hidden; }
            th, td { padding: 12px 15px; text-align: left; border-bottom: 1px solid #ddd; }
            th { background-color: #2c3e50; color: white; }
            tr:hover { background-color: #f5f5f5; }
            .badge { padding: 5px 10px; border-radius: 4px; font-weight: bold; color: white; display: inline-block; }
            .good { background-color: #2ecc71; }
            .medium { background-color: #f39c12; }
            .bad { background-color: #e74c3c; }
            .details { font-size: 11px; color: #7f8c8d; margin-top: 4px; }
        </style>
    </head>
    <body>
        <h2>📊 Процентное соотношение пробивки целевых сайтов по каждому IP</h2>
        <table>
            <tr>
                <th>IP Адрес прокси</th>
                <th>Успешных пробитий</th>
                <th>Всего сбоев</th>
                <th>Всего запросов</th>
                <th>Процент пробиваемости (SR)</th>
            </tr>
    `;

    for (const ip of rawIps) {
        const stats = proxyStats[ip] || { success: 0, failed: 0, networkErrors: 0, cfBlocks: 0 };
        const total = stats.success + stats.failed;
        const rate = total > 0 ? ((stats.success / total) * 100).toFixed(1) : "0.0";
        
        let rateClass = "bad";
        if (parseFloat(rate) >= 65) rateClass = "good";
        else if (parseFloat(rate) >= 25) rateClass = "medium";

        htmlReport += `
            <tr>
                <td><b>${ip}</b></td>
                <td style="color: #27ae60; font-weight:bold;">🎯 ${stats.success}</td>
                <td style="color: #c0392b;">
                    ⚠️ ${stats.failed}
                    <div class="details">Из них сетевых: ${stats.networkErrors} | В бане CF: ${stats.cfBlocks}</div>
                </td>
                <td>${total}</td>
                <td><span class="badge ${rateClass}">${rate}%</span></td>
            </tr>
        `;
    }

    htmlReport += `
        </table>
        <p style="margin-top:20px; color:#7f8c8d;">* Отчет обновляется в реальном времени. Приложение удерживает товар в очереди, пока один из IP не отдаст кэш.</p>
    </body>
    </html>
    `;

    res.setHeader('Content-Type', 'text/html; charset=UTF-8');
    res.send(htmlReport);
});

app.get('/parse', handleParse);
app.post('/parse', express.json(), handleParse);

const PORT = process.env.PORT || 7860;
app.listen(PORT, () => { console.log(`🚀 Железобетонный конвейер с аналитикой запущен на порту ${PORT}`); });


app.get('/parse', handleParse);
app.post('/parse', express.json(), handleParse);

const PORT = process.env.PORT || 7860;
app.listen(PORT, () => { console.log(`🚀 Скоростной конвейер с быстрой ротацией запущен на порту ${PORT}`); });
