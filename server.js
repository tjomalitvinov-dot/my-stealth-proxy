const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());
const app = express();

// Глобальный счетчик для строгого перебора IP по порядку
let currentProxyIndex = 0;

const login = "mmnvhwqe";
const pass = "pt6brfln6blc";

// Исходный список (содержит дубликаты)
const duplicateIps = [
"103.237.102.191:11111",
    "69.87.216.54:7989",
    "95.211.174.135:3128",
    "184.75.221.82:3118",
    "195.144.24.57:3128",
    "140.238.32.108:3128",
    "107.150.41.226:18080",
    "159.89.239.204:10000",
    "36.64.157.154:8080",
    "38.18.230.153:8888",
"184.75.221.82:3118",
    "178.92.72.78:8080",
    "139.99.121.31:18080",
    "45.198.11.219:9191",
    "45.80.37.229:10801",
    "87.199.202.58:443",
    "85.155.228.112:3128",
    "103.237.102.191:11111",
    "213.163.198.77:8080",
    "89.169.2.163:10808",
    "213.163.192.247:8080",
    "159.89.239.204:10000",
    "195.144.24.57:3128",
    "210.16.122.12:1080",
    "185.220.249.77:3128",
    "108.61.29.163:10001",
    "178.128.146.125:10000",
    "147.78.1.156:3128",
    "47.81.56.193:8888",
    "194.62.55.84:40001",
    "57.128.183.212:21",
    "178.92.72.149:8080",
    "178.92.72.229:8080",
"103.178.86.93:8080",
    "103.237.102.191:11111",
    "103.31.103.71:8080",
    "108.61.29.163:10001",
    "102.208.228.90:8080",
    "103.169.138.4:8081",
    "103.17.215.9:8089",
"140.238.32.108:3128",
    "147.78.1.156:3128",
    "184.75.221.82:3118",
    "154.201.127.198:8080",
    "154.201.127.230:8080",
    "163.43.113.134:80",
    "172.85.99.17:16062",
    "178.92.72.54:8080",
    "185.139.7.97:8080",
    "185.183.35.62:3128",
    "188.164.201.197:666",
"45.80.37.229:10801",
    "46.17.43.219:7890",
    "57.128.183.212:21",
    "85.155.228.112:3128",
    "89.169.2.163:10808",
    "45.225.207.248:999",
"195.144.24.57:3128",
    "210.16.122.12:1080",
    "213.163.198.77:8080"
];

// Автоматически убираем все дубликаты из массива, делая его идеально чистым
const rawIps = [...new Set(duplicateIps)];

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
        
        // Снижаем таймаут до 12 секунд. Мертвые прокси отсекаются мгновенно
        await page.setDefaultNavigationTimeout(12000);
        
        let cleanHtmlOutput = "";
        let isSuccessParse = false;
        let lastSeenTitle = "Без заголовка";
        
        for (let attempt = 1; attempt <= 3; attempt++) {
            console.log(`📡 Попытка загрузки №${attempt}/3...`);
            
            // Используем скоростной режим 'commit' вместо тяжелого 'networkidle2'
            if (attempt === 1) {
                await page.goto(targetUrl, { waitUntil: 'commit' });
            } else {
                await page.reload({ waitUntil: 'commit' });
            }
            
            // Умная динамическая пауза: проверяем страницу каждые 400мс в течение 5 секунд
            for (let tick = 0; tick < 12; tick++) {
                await new Promise(resolve => setTimeout(resolve, 400));
                
                cleanHtmlOutput = await page.content();
                const titleMatch = cleanHtmlOutput.match(/<title>([^<]+)<\/title>/i);
                lastSeenTitle = titleMatch ? titleMatch[1] : "Без заголовка";
                const hasNextData = cleanHtmlOutput.includes('__NEXT_DATA__') || cleanHtmlOutput.includes('__INITIAL_STATE__');
                
                if (hasNextData && !lastSeenTitle.toLowerCase().includes('just a moment') && !cleanHtmlOutput.includes('access denied')) {
                    isSuccessParse = true;
                    break;
                }
            }
            
            if (isSuccessParse) {
                console.log(`🎯 [ПРОБИТИЕ НА ПОПЫТКЕ №${attempt}!] Заголовок: "${lastSeenTitle}". Скоростной кэш взят!`);
                break;
            } else {
                console.warn(`⚠️ Попытка №${attempt} пока не прошла защиту (Экран: "${lastSeenTitle}"). Ожидаем мини-паузу перед релоадом...`);
                await new Promise(resolve => setTimeout(resolve, 1500));
            }
        }
        
        if (isSuccessParse) {
            return { success: true, html: cleanHtmlOutput };
        } else {
            return { success: false, errorType: 'cf_block', reason: `Застрял на проверке (Экран: "${lastSeenTitle}")` };
        }
        
    } catch (error) {
        return { success: false, errorType: 'network_error', reason: error.message };
    } finally {
        if (browser !== null) await browser.close();
    }
};

const handleParse = async (req, res) => {
    const targetUrl = req.query.url || req.body?.url;
    if (!targetUrl) return res.status(400).send("<h1>Ошибка: Параметр ?url= не найден!</h1>");
    console.log(`📡 Заходим на живой сайт LEGO/Conrad: ${targetUrl}`);
    
    // Перебираем до 5 разных уникальных прокси по порядку ради отказоустойчивости
    for (let proxyAttempt = 1; proxyAttempt <= 5; proxyAttempt++) {
        const selectedIp = rawIps[currentProxyIndex];
        currentProxyIndex = (currentProxyIndex + 1) % rawIps.length;
        
        console.log(`🚀 [Шаг прокси по порядку №${proxyAttempt}/5] Берем IP: ${selectedIp}`);
        const result = await executeParsingSession(targetUrl, selectedIp);
        
        if (result.success) {
            if (proxyStats[selectedIp]) proxyStats[selectedIp].success += 1;
            res.setHeader('Content-Type', 'text/html; charset=UTF-8');
            return res.send(result.html);
        }
        
        if (proxyStats[selectedIp]) {
            proxyStats[selectedIp].failed += 1;
            if (result.errorType === 'network_error') proxyStats[selectedIp].networkErrors += 1;
            if (result.errorType === 'cf_block') proxyStats[selectedIp].cfBlocks += 1;
        }
        console.warn(`❌ Прокси ${selectedIp} не подошел: (${result.reason}). Срочно меняем канал...`);
    }
    
    res.setHeader('Content-Type', 'text/plain; charset=UTF-8');
    return res.status(500).send("[ОШИБКА] Очередь из 5-и прокси подряд не смогла пробить защиту Cloudflare.");
};

app.get('/stats', (req, res) => {
    const sortedList = rawIps.map(ip => {
        const stats = proxyStats[ip] || { success: 0, failed: 0, networkErrors: 0, cfBlocks: 0 };
        const total = stats.success + stats.failed;
        const rate = total > 0 ? parseFloat(((stats.success / total) * 100).toFixed(1)) : 0.0;
        return { ip, stats, total, rate };
    });

    sortedList.sort((a, b) => b.rate - a.rate);

    const goodIps = sortedList
        .filter(item => item.rate >= 50.0 && item.stats.success > 0)
        .map(item => `"${item.ip}"`);

    const formattedGoodIpsStr = goodIps.length > 0 ? goodIps.join(",\n    ") : "// Пока нет прокси с SR >= 50% и хотя бы 1 успешным пробитием";

    let htmlReport = `
    <html>
    <head>
        <title>📊 Рейтинг пробиваемости прокси</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 40px; background: #f4f6f9; color: #333; }
            table { width: 100%; border-collapse: collapse; background: #fff; box-shadow: 0 4px 6px rgba(0,0,0,0.1); border-radius: 8px; overflow: hidden; margin-bottom: 30px; }
            th, td { padding: 12px 15px; text-align: left; border-bottom: 1px solid #ddd; }
            th { background-color: #2c3e50; color: white; }
            tr:hover { background-color: #f5f5f5; }
            .badge { padding: 5px 10px; border-radius: 4px; font-weight: bold; color: white; display: inline-block; min-width: 55px; text-align: center; }
            .good { background-color: #2ecc71; }
            .medium { background-color: #f39c12; }
            .bad { background-color: #e74c3c; }
            .details { font-size: 11px; color: #7f8c8d; margin-top: 4px; }
            .rank { font-weight: bold; color: #95a5a6; }
            .export-box { background: #fff; box-shadow: 0 4px 6px rgba(0,0,0,0.1); border-radius: 8px; padding: 20px; margin-top: 20px; }
            textarea { width: 100%; height: 120px; font-family: 'Courier New', Courier, monospace; background: #2c3e50; color: #2ecc71; padding: 15px; border: none; border-radius: 6px; font-size: 14px; resize: vertical; box-sizing: border-box; }
            h3 { color: #2c3e50; margin-top: 0; }
        </style>
    </head>
    <body>
        <h2>📊 Высокоскоростной рейтинг эффективности резидентных прокси</h2>
        <p>Всего уникальных прокси в ротации: <b>${rawIps.length}</b></p>
        <table>
            <tr>
                <th style="width: 50px;">№</th>
                <th>IP Адрес прокси</th>
                <th>Успешных пробитий</th>
                <th>Всего сбоев</th>
                <th>Всего запросов</th>
                <th>Процент пробиваемости (SR)</th>
            </tr>
    `;

    sortedList.forEach((item, index) => {
        let rateClass = "bad";
        if (item.rate >= 65) rateClass = "good";
        else if (item.rate >= 25) rateClass = "medium";

        htmlReport += `
            <tr>
                <td class="rank">${index + 1}</td>
                <td><b>${item.ip}</b></td>
                <td style="color: #27ae60; font-weight:bold;">🎯 ${item.stats.success}</td>
                <td style="color: #c0392b;">
                    ⚠️ ${item.stats.failed}
                    <div class="details">Из них сетевых: ${item.stats.networkErrors} | В бане CF: ${item.stats.cfBlocks}</div>
                </td>
                <td>${item.total}</td>
                <td><span class="badge ${rateClass}">${item.rate}%</span></td>
            </tr>
        `;
    });

    htmlReport += `
        </table>
        <div class="export-box">
            <h3>📋 Экспорт «белого списка» прокси (SR >= 50%)</h3>
            <textarea readonly onclick="this.select()">${formattedGoodIpsStr}</textarea>
        </div>
    </body>
    </html>
    `;

    res.setHeader('Content-Type', 'text/html; charset=UTF-8');
    res.send(htmlReport);
});

app.get('/parse', handleParse);
app.post('/parse', express.json(), handleParse);

const PORT = process.env.PORT || 7860;
app.listen(PORT, () => { console.log(🚀 Высокоскоростной конвейер запущен на порту ${PORT}); });
