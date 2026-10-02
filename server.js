const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());
const app = express();

// Изначальный полный список ваших прокси
const rawIps = [
    "95.211.174.135:3128", "103.237.102.191:11111", "103.82.20.76:8080", "107.150.41.226:18080", "152.53.183.107:8081", "159.89.239.204:10000", "160.19.146.82:2022", "178.128.146.125:10000", "184.75.221.82:3118", "185.195.71.218:18080", "213.111.146.36:18080", "213.199.53.16:8888", "36.64.157.154:8080", "38.18.230.153:8888", "87.199.202.58:443", "85.209.156.148:1080", "43.203.114.231:3128", "15.235.145.229:1081", "147.139.173.50:7777", "165.154.162.73:8888", "38.175.202.151:443", "65.109.215.187:8090", "47.81.56.193:8888", "101.36.112.205:1081", "111.119.162.248:10909", "43.173.120.13:8899", "80.71.232.83:8082", "107.175.215.32:1080", "193.37.71.46:10808", "180.149.44.182:3128", "47.91.104.88:3128", "164.52.11.194:18080", "156.67.110.124:10808", "161.35.70.249:80", "54.238.38.227:8080", "95.81.107.33:3128", "128.199.202.122:8080", "209.97.150.167:3128", "117.236.124.166:3128", "69.87.216.54:7989", "83.166.247.254:10808", "138.68.60.8:3128", "159.195.194.242:8080", "139.162.78.109:8080", "170.205.37.145:443", "65.108.159.129:8081", "166.1.61.57:1080", "159.203.61.169:3128", "47.254.122.220:5443", "37.148.9.84:2080", "104.161.23.122:5042", "110.74.195.34:25", "43.173.120.13:8899", "165.154.162.73:8888", "164.52.11.194:18080", "180.149.44.182:3128", "107.150.41.226:18080", "38.175.202.151:443", "54.238.38.227:8080", "95.81.107.33:3128", "8.215.112.214:7777", "8.215.112.240:7777", "178.128.26.157:10000", "185.195.71.218:18080", "65.109.215.187:8090", "156.67.110.124:10808", "213.111.146.36:18080", "159.89.87.80:10000", "159.89.239.204:10000", "176.99.134.183:8090", "195.158.8.123:3128", "2.28.105.45:8888", "103.237.102.191:11111", "47.81.56.193:8888", "8.219.74.197:8081", "139.59.1.14:8080", "138.68.60.8:3128", "178.128.146.125:10000", "93.115.20.101:1080", "170.81.131.70:3128", "43.203.114.231:3128", "69.87.216.54:7989", "161.35.70.249:80", "101.36.112.205:1081", "3.211.120.181:443", "198.199.86.11:3128", "138.124.125.198:3128", "166.1.61.57:1080", "140.238.32.108:3128", "129.213.162.27:17777", "159.203.61.169:3128", "195.144.24.57:3128", "45.139.226.199:10804", "85.209.156.148:1080", "47.236.188.63:10808"
];

// Массив для хранения ТОЛЬКО ЖИВЫХ прокси, прошедших прогрев
let activeIps = [];
// Глобальный счетчик для строгого перебора активных IP по порядку
let currentProxyIndex = 0;

const login = "mmnvhwqe";
const pass = "pt6brfln6blc";

// Глобальный объект аналитики пробиваемости (инициализируем все IP изначально)
const proxyStats = {};
rawIps.forEach(ip => {
    proxyStats[ip] = { success: 0, failed: 0, networkErrors: 0, cfBlocks: 0, status: "Ожидает прогрева ⏳" };
});

// Функция прогрева пула прокси при старте
const warmupProxyPool = async () => {
    console.log("🏗️  Запуск предварительного прогрева и валидации прокси...");
    const testUrl = "https://lego.com"; // Тестируем сразу на целевом домене
    
    for (const ip of rawIps) {
        console.log(`📡 Тестируем прокси на доступность: ${ip}`);
        const proxyServerUrl = "http://" + ip;
        let browser = null;
        try {
            browser = await puppeteer.launch({ 
                headless: true, 
                executablePath: '/usr/bin/google-chrome',
                args: [
                    '--no-sandbox', '--disable-setuid-sandbox', `--proxy-server=${proxyServerUrl}`,
                    '--disable-dev-shm-usage', '--disable-gpu', '--ignore-certificate-errors'
                ] 
            });
            const page = await browser.newPage();
            await page.authenticate({ username: login, password: pass });
            
            // Быстрый таймаут для теста: если за 10 секунд прокси не ответил, он нам не нужен
            await page.setDefaultNavigationTimeout(10000);
            await page.goto(testUrl, { waitUntil: 'domcontentloaded' });
            
            console.log(`✅ Прокси ${ip} успешно прошёл прогрев. Добавлен в рабочий пул!`);
            activeIps.push(ip);
            proxyStats[ip].status = "Активен (Живой) 🔥";
        } catch (err) {
            console.error(`❌ Прокси ${ip} не прошёл прогрев (Сбой: ${err.message}). Исключен из пула.`);
            proxyStats[ip].failed += 1;
            proxyStats[ip].networkErrors += 1;
            proxyStats[ip].status = "Мёртв (Отсеян при прогреве) 💀";
        } finally {
            if (browser !== null) await browser.close();
        }
    }
    
    console.log(`🚀 Прогрев окончен! Живых прокси в строю: ${activeIps.length} из ${rawIps.length}`);
    if (activeIps.length === 0) {
        console.warn("⚠️ Внимание: Ни один прокси не прошёл прогрев! Откат на базовый список.");
        activeIps = [...rawIps];
    }
};
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
        return { success: false, errorType: 'network_error', reason: error.message };
    } finally {
        if (browser !== null) await browser.close();
    }
};

const handleParse = async (req, res) => {
    const targetUrl = req.query.url || req.body?.url;
    if (!targetUrl) return res.status(400).send("<h1>Ошибка: Параметр ?url= не найден!</h1>");
    console.log(`📡 Заходим на живой сайт LEGO/Conrad: ${targetUrl}`);
    
    const maxAttempts = Math.min(4, activeIps.length);
    for (let proxyAttempt = 1; proxyAttempt <= maxAttempts; proxyAttempt++) {
        const selectedIp = activeIps[currentProxyIndex];
        currentProxyIndex = (currentProxyIndex + 1) % activeIps.length;
        
        console.log(`🚀 [Шаг прокси по порядку №${proxyAttempt}/${maxAttempts}] Берем IP: ${selectedIp}`);
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
    return res.status(500).send("[ОШИБКА] Проверенные по порядку прокси не смогли пробить защиту Cloudflare.");
};

app.get('/stats', (req, res) => {
    const sortedList = rawIps.map(ip => {
        const stats = proxyStats[ip] || { success: 0, failed: 0, networkErrors: 0, cfBlocks: 0, status: "Неизвестно" };
        const total = stats.success + stats.failed;
        const rate = total > 0 ? parseFloat(((stats.success / total) * 100).toFixed(1)) : 0.0;
        return { ip, stats, total, rate };
    });

    sortedList.sort((a, b) => b.rate - a.rate);

    let htmlReport = `
    <html>
    <head>
        <title>📊 Рейтинг пробиваемости прокси</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 40px; background: #f4f6f9; color: #333; }
            table { width: 100%; border-collapse: collapse; background: #fff; box-shadow: 0 4px 6px rgba(0,0,0,0.1); border-radius: 8px; overflow: hidden; }
            th, td { padding: 12px 15px; text-align: left; border-bottom: 1px solid #ddd; }
            th { background-color: #2c3e50; color: white; }
            tr:hover { background-color: #f5f5f5; }
            .badge { padding: 5px 10px; border-radius: 4px; font-weight: bold; color: white; display: inline-block; min-width: 55px; text-align: center; }
            .good { background-color: #2ecc71; }
            .medium { background-color: #f39c12; }
            .bad { background-color: #e74c3c; }
            .status-info { font-size: 12px; font-weight: bold; }
            .details { font-size: 11px; color: #7f8c8d; margin-top: 4px; }
            .rank { font-weight: bold; color: #95a5a6; }
        </style>
    </head>
    <body>
        <h2>📊 Рейтинг эффективности резидентных прокси (от 100% вниз)</h2>
        <p>Сейчас в активной ротации живых каналов: <b>${activeIps.length} из ${rawIps.length}</b></p>
        <table>
            <tr>
                <th style="width: 50px;">№</th>
                <th>IP Адрес прокси</th>
                <th>Текущий статус</th>
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

        let statusColor = item.stats.status.includes("Активен") ? "#27ae60" : "#c0392b";

        htmlReport += `
            <tr>
                <td class="rank">${index + 1}</td>
                <td><b>${item.ip}</b></td>
                <td class="status-info" style="color: ${statusColor};">${item.stats.status}</td>
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
    </body>
    </html>
    `;

    res.setHeader('Content-Type', 'text/html; charset=UTF-8');
    res.send(htmlReport);
});

app.get('/parse', handleParse);
app.post('/parse', express.json(), handleParse);

const PORT = process.env.PORT || 7860;
app.listen(PORT, () => { 
    console.log(`🚀 Конвейер запущен на порту ${PORT}. Начинаем прогрев...`); 
    setTimeout(warmupProxyPool, 1000);
});


