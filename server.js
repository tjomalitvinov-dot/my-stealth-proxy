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
"101.32.65.42:8888", "101.36.112.205:1081", "102.208.228.90:8080", "103.109.96.86:3030", "103.11.218.223:8787", "103.113.152.73:14158", "103.131.19.51:8080", "103.141.70.18:8080", "103.166.0.25:1111", "103.169.138.4:8081", "103.17.215.9:8089", "103.174.122.98:3128", "103.178.86.93:8080", "103.20.102.155:8181", "103.208.102.1:8080", "103.237.102.191:11111", "103.31.103.71:8080", "103.7.4.15:8082", "103.88.234.239:40019", "104.251.93.95:16062", "108.61.29.163:10001", "113.203.237.210:8080", "122.52.27.1:8080", "125.209.110.83:39617", "128.199.202.122:8080", "129.150.57.5:55555", "134.209.29.120:3128", "138.124.125.198:3128", "138.68.60.8:3128", "139.162.78.109:8080"

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
    
    // Перебираем до 4 разных уникальных прокси по порядку, пока товар не спарсится
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

app.get('/stats', (req, res) => {
    // 1. Формируем массив данных
    const sortedList = rawIps.map(ip => {
        const stats = proxyStats[ip] || { success: 0, failed: 0, networkErrors: 0, cfBlocks: 0 };
        const total = stats.success + stats.failed;
        const rate = total > 0 ? parseFloat(((stats.success / total) * 100).toFixed(1)) : 0.0;
        return { ip, stats, total, rate };
    });

    // 2. Сортируем массив по убыванию (от 100% до 0%)
    sortedList.sort((a, b) => b.rate - a.rate);

    // 3. Отбираем прокси с эффективностью 50% и выше, у которых был ХОТЯ БЫ один успешный запрос
    const goodIps = sortedList
        .filter(item => item.rate >= 50.0 && item.stats.success > 0)
        .map(item => `"${item.ip}"`);

    // Форматируем их в красивую JS-строку для легкого копирования
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
            
            /* Стили для зоны копирования */
            .export-box { background: #fff; box-shadow: 0 4px 6px rgba(0,0,0,0.1); border-radius: 8px; padding: 20px; margin-top: 20px; }
            textarea { width: 100%; height: 120px; font-family: 'Courier New', Courier, monospace; background: #2c3e50; color: #2ecc71; padding: 15px; border: none; border-radius: 6px; font-size: 14px; resize: vertical; box-sizing: border-box; }
            h3 { color: #2c3e50; margin-top: 0; }
        </style>
    </head>
    <body>
        <h2>📊 Рейтинг эффективности резидентных прокси (от 100% вниз)</h2>
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

        <!-- НОВЫЙ БЛОК: Готовый массив для копирования -->
        <div class="export-box">
            <h3>📋 Экспорт «белого списка» прокси (SR >= 50%)</h3>
            <p style="font-size: 13px; color: #7f8c8d; margin-bottom: 10px;">
                Сюда попадают только эффективные IP, которые успешно пробили Cloudflare хотя бы 1 раз и имеют общий показатель успеха от 50% и выше. Скопируй этот блок и вставь вместо массива <code>rawIps</code> в коде.
            </p>
            <textarea readonly onclick="this.select()">${formattedGoodIpsStr}</textarea>
            <small style="color: #95a5a6; display: block; margin-top: 5px;">💡 Нажми на текстовое поле выше, чтобы автоматически выделить весь список для копирования.</small>
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
app.listen(PORT, () => { console.log(`🚀 Сортируемый конвейер с умным экспортом запущен на порту ${PORT}`); });
