const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');

puppeteer.use(StealthPlugin());
const app = express();

// Глобальный счетчик для строгого перебора IP по порядку
let currentProxyIndex = 0;

const login = "mmnvhwqe";
const pass = "pt6brfln6blc";

// Путь к файлу базы данных на сервере Render
const dbPath = path.join(__dirname, 'proxy_database.json');

// Базовый список на случай, если файл базы данных еще не создан
const initialIps = [
    "103.237.102.191:11111", "69.87.216.54:7989", "95.211.174.135:3128", "184.75.221.82:3118",
    "195.144.24.57:3128", "140.238.32.108:3128", "107.150.41.226:18080", "159.89.239.204:10000",
    "36.64.157.154:8080", "38.18.230.153:8888", "178.92.72.78:8080", "139.99.121.31:18080",
    "45.198.11.219:9191", "45.80.37.229:10801", "87.199.202.58:443", "85.155.228.112:3128",
    "213.163.198.77:8080", "89.169.2.163:10808", "213.163.192.247:8080", "210.16.122.12:1080",
    "185.220.249.77:3128", "108.61.29.163:10001", "178.128.146.125:10000", "147.78.1.156:3128",
    "47.81.56.193:8888", "194.62.55.84:40001", "57.128.183.212:21", "178.92.72.149:8080",
    "178.92.72.229:8080", "103.178.86.93:8080", "103.31.103.71:8080", "102.208.228.90:8080",
    "103.169.138.4:8081", "103.17.215.9:8089", "154.201.127.198:8080", "154.201.127.230:8080",
    "163.43.113.134:80", "172.85.99.17:16062", "178.92.72.54:8080", "185.139.7.97:8080",
    "185.183.35.62:3128", "188.164.201.197:666", "46.17.43.219:7890", "45.225.207.248:999"
];

// Глобальные рабочие структуры данных
let rawIps = [];
let proxyStats = {};

// Функция загрузки данных из файла
const loadDatabase = () => {
    try {
        if (fs.existsSync(dbPath)) {
            const fileData = fs.readFileSync(dbPath, 'utf8');
            const parsed = JSON.parse(fileData);
            rawIps = parsed.rawIps || [];
            proxyStats = parsed.proxyStats || {};
            console.log(`💾 Бессмертная база успешно загружена! Найдено уникальных IP: ${rawIps.length}`);
        } else {
            console.log("📝 Файл базы данных не найден. Первичная генерация из стартового списка...");
            rawIps = [...new Set(initialIps)];
            rawIps.forEach(ip => {
                proxyStats[ip] = { success: 0, failed: 0, networkErrors: 0, cfBlocks: 0, totalDuration: 0, totalSessions: 0 };
            });
            saveDatabase();
        }
    } catch (err) {
        console.error("❌ Ошибка при чтении базы JSON, откат на память: " + err.message);
        rawIps = [...new Set(initialIps)];
    }
};

// Функция записи данных в файл
const saveDatabase = () => {
    try {
        const dataToSave = { rawIps, proxyStats };
        fs.writeFileSync(dbPath, JSON.stringify(dataToSave, null, 4), 'utf8');
    } catch (err) {
        console.error("❌ Не удалось сохранить базу на диск: " + err.message);
    }
};

// Вызов загрузки при старте приложения
loadDatabase();
const executeParsingSession = async (targetUrl, proxyIp) => {
    const proxyServerUrl = "http://" + proxyIp;
    console.log(`🔄 Инициализация Docker-Chrome через канал: ${proxyIp}`);
    const startTime = Date.now();
    
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
            lastSeenTitle = titleMatch ? titleMatch : "Без заголовка";
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
        
        const duration = Date.now() - startTime;
        if (isSuccessParse) {
            return { success: true, html: cleanHtmlOutput, duration };
        } else {
            return { success: false, errorType: 'cf_block', reason: `Застрял на проверке (Экран: "${lastSeenTitle}")`, duration };
        }
        
    } catch (error) {
        return { success: false, errorType: 'network_error', reason: error.message, duration: Date.now() - startTime };
    } finally {
        if (browser !== null) await browser.close();
    }
};

const handleParse = async (req, res) => {
    if (rawIps.length === 0) return res.status(500).send("<h1>Ошибка: Список прокси пуст! Добавьте IP через панель управления.</h1>");
    const targetUrl = req.query.url || req.body?.url;
    if (!targetUrl) return res.status(400).send("<h1>Ошибка: Параметр ?url= не найден!</h1>");
    console.log(`📡 Заходим на живой сайт LEGO/Conrad: ${targetUrl}`);
    
    for (let proxyAttempt = 1; proxyAttempt <= 4; proxyAttempt++) {
        currentProxyIndex = currentProxyIndex % rawIps.length;
        const selectedIp = rawIps[currentProxyIndex];
        currentProxyIndex = (currentProxyIndex + 1) % rawIps.length;
        
        console.log(`🚀 [Шаг прокси по порядку №${proxyAttempt}/4] Берем IP: ${selectedIp}`);
        const result = await executeParsingSession(targetUrl, selectedIp);
        
        if (proxyStats[selectedIp]) {
            proxyStats[selectedIp].totalSessions += 1;
            proxyStats[selectedIp].totalDuration += result.duration;
        }
        
        if (result.success) {
            if (proxyStats[selectedIp]) proxyStats[selectedIp].success += 1;
            saveDatabase(); // Сохраняем успешный инкремент на диск
            res.setHeader('Content-Type', 'text/html; charset=UTF-8');
            return res.send(result.html);
        }
        
        if (proxyStats[selectedIp]) {
            proxyStats[selectedIp].failed += 1;
            if (result.errorType === 'network_error') proxyStats[selectedIp].networkErrors += 1;
            if (result.errorType === 'cf_block') proxyStats[selectedIp].cfBlocks += 1;
        }
        saveDatabase(); // Сохраняем сбой на диск
        console.warn(`❌ Прокси ${selectedIp} не подошел: (${result.reason}). Срочно меняем канал...`);
    }
    
    res.setHeader('Content-Type', 'text/plain; charset=UTF-8');
    return res.status(500).send("[ОШИБКА] Очередь из 4-х прокси подряд не смогла пробить защиту Cloudflare.");
};
// Обработчик пакетного добавления IP-адресов
app.post('/stats/add-packet', express.urlencoded({ extended: true }), (req, res) => {
    const rawInput = req.body.packetData;
    if (!rawInput) return res.redirect('/stats');

    // Умный парсинг входящей строки: ловит IP как из формата "IP:PORT", так и в кавычках через запятую
    const foundIps = rawInput.match(/(?:[0-9]{1,3}\.){3}[0-9]{1,3}:[0-9]{1,5}/g);
    
    if (foundIps && foundIps.length > 0) {
        let addedCount = 0;
        foundIps.forEach(ip => {
            if (!rawIps.includes(ip)) {
                rawIps.push(ip);
                proxyStats[ip] = { success: 0, failed: 0, networkErrors: 0, cfBlocks: 0, totalDuration: 0, totalSessions: 0 };
                addedCount++;
            }
        });
        if (addedCount > 0) saveDatabase();
        console.log(`📥 Пакетный импорт: Успешно добавлено ${addedCount} новых уникальных прокси.`);
    }
    res.redirect('/stats');
});

// Обработчик удаления одного конкретного прокси со страницы
app.get('/stats/delete/:ip', (req, res) => {
    const targetIp = req.params.ip;
    const index = rawIps.indexOf(targetIp);
    if (index > -1) {
        rawIps.splice(index, 1);
        if (proxyStats[targetIp]) delete proxyStats[targetIp];
        saveDatabase();
        console.log(`❌ Прокси ${targetIp} навсегда удален пользователем из ротации.`);
    }
    res.redirect('/stats');
});

// Обработчик очистки накопленной статистики
app.get('/stats/clear-metrics', (req, res) => {
    rawIps.forEach(ip => {
        proxyStats[ip] = { success: 0, failed: 0, networkErrors: 0, cfBlocks: 0, totalDuration: 0, totalSessions: 0 };
    });
    saveDatabase();
    console.log("🧹 Метрики и тайминги прокси сброшены в ноль. Ротация сохранена.");
    res.redirect('/stats');
});

app.get('/stats', (req, res) => {
    const sortedList = rawIps.map(ip => {
        const stats = proxyStats[ip] || { success: 0, failed: 0, networkErrors: 0, cfBlocks: 0, totalDuration: 0, totalSessions: 0 };
        const total = stats.success + stats.failed;
        const rate = total > 0 ? parseFloat(((stats.success / total) * 100).toFixed(1)) : 0.0;
        const avgTime = stats.totalSessions > 0 ? parseFloat(((stats.totalDuration / stats.totalSessions) / 1000).toFixed(2)) : 0.00;
        return { ip, stats, total, rate, avgTime };
    });

    sortedList.sort((a, b) => b.rate - a.rate);

    const eliteIps = sortedList.filter(item => item.rate === 100.0 && item.stats.success > 0).map(item => `"${item.ip}"`);
    const stableIps = sortedList.filter(item => item.rate >= 75.0 && item.rate < 100.0 && item.stats.success > 0).map(item => `"${item.ip}"`);
    const mediumIps = sortedList.filter(item => item.rate >= 50.0 && item.rate < 75.0 && item.stats.success > 0).map(item => `"${item.ip}"`);

    const fastIps = sortedList.filter(item => item.avgTime > 0.00 && item.avgTime <= 15.00 && item.stats.success > 0).map(item => `"${item.ip}"`);
    const normalIps = sortedList.filter(item => item.avgTime > 15.00 && item.avgTime <= 30.00 && item.stats.success > 0).map(item => `"${item.ip}"`);
    const slowIps = sortedList.filter(item => item.avgTime > 30.00 && item.stats.success > 0).map(item => `"${item.ip}"`);

    const formatField = (arr) => arr.length > 0 ? arr.join(",\n    ") : "// В данной категории пока нет подходящих IP";

    let htmlReport = `
    <html>
    <head>
        <title>📊 Бессмертная Панель Прокси</title>
        <style>
            body { font-family: Arial, sans-serif; margin: 30px; background: #f4f6f9; color: #333; font-size: 13px; }
            h2 { font-size: 16px; color: #2c3e50; margin-top: 25px; margin-bottom: 10px; border-bottom: 2px solid #ddd; padding-bottom: 5px; }
            h3 { color: #2c3e50; margin: 0; font-size: 12px; }
            
            /* Стили для форм и кнопок управления */
            .control-panel { display: flex; gap: 20px; background: #fff; padding: 15px; border-radius: 6px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); margin-bottom: 20px; }
            .form-packet { flex: 1; display: flex; flex-direction: column; gap: 8px; }
            .form-packet textarea { height: 60px; padding: 8px; border: 1px solid #ccc; border-radius: 4px; font-size: 11px; font-family: monospace; resize: none; }
            .btn-submit { padding: 8px 15px; background: #2ecc71; color: #fff; font-weight: bold; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; align-self: flex-end; }
            .btn-clear { padding: 10px 15px; background: #e74c3c; color: white; border-radius: 4px; font-weight: bold; text-decoration: none; display: inline-block; font-size: 12px; height: max-content; align-self: center; }
            .btn-delete { color: #e74c3c; text-decoration: none; font-weight: bold; font-size: 14px; margin-left: 10px; }
            .btn-delete:hover { color: #c0392b; }
            
            table { width: 100%; border-collapse: collapse; background: #fff; box-shadow: 0 4px 6px rgba(0,0,0,0.05); border-radius: 6px; overflow: hidden; margin-bottom: 20px; }
            th, td { padding: 9px 11px; text-align: left; border-bottom: 1px solid #ddd; font-size: 12px; }
            th { background-color: #2c3e50; color: white; font-weight: bold; }
            tr:hover { background-color: #f9f9f9; }
            
            .badge { padding: 4px 8px; border-radius: 4px; font-weight: bold; color: white; display: inline-block; min-width: 90px; text-align: center; }
            .good { background-color: #2ecc71; }
            .medium { background-color: #f39c12; }
            .bad { background-color: #e74c3c; }
            .details { font-size: 11px; color: #7f8c8d; margin-top: 3px; }
            .rank { font-weight: bold; color: #95a5a6; width: 35px; }
            
            .export-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-top: 10px; margin-bottom: 15px; }
            .export-box { background: #fff; box-shadow: 0 4px 6px rgba(0,0,0,0.05); border-radius: 6px; padding: 12px; }
            textarea.field-out { width: 100%; height: 110px; font-family: 'Courier New', monospace; background: #2c3e50; color: #2ecc71; padding: 8px; border: none; border-radius: 4px; font-size: 11px; resize: vertical; box-sizing: border-box; margin-top: 8px; }
        </style>
    </head>
    <body>
        <h2>🛠️ Панель управления и пакетного добавления прокси</h2>
        <div class="control-panel">
            <form action="/stats/add-packet" method="POST" class="form-packet">
                <span style="font-weight: bold; color: #34495e;">📥 Вставить пакет новых IP-адресов:</span>
                <textarea name="packetData" placeholder='Пример: "87.199.202.58:443", "159.89.239.204:10000" или списком строк...'></textarea>
                <button type="submit" class="btn-submit">➕ Добавить пакет в ротацию</button>
            </form>
            <a href="/stats/clear-metrics" class="btn-clear" onclick="return confirm('Обнулить счетчики успеваемости и тайминги?')">🧹 Очистить метрики времени</a>
        </div>

        <h2>📊 Бессмертный рейтинг прокси с динамическими таймингами</h2>
        <p style="margin-top: -5px; color: #7f8c8d; font-size: 12px;">Всего уникальных прокси в ротации: <b>${rawIps.length}</b></p>
        <table>
            <tr>
                <th style="width: 35px;">№</th>
                <th>IP Адрес прокси</th>
                <th style="width: 110px;">⏱️ Ср. время</th>
                <th style="width: 90px;">Успешных</th>
                <th>Всего сбоев</th>
                <th style="width: 80px;">Всего</th>
                <th style="width: 160px;">Процент (SR)</th>
                <th style="width: 60px;">Действие</th>
            </tr>
    `;

    sortedList.forEach((item, index) => {
        let rateClass = "bad";
        if (item.rate >= 75) rateClass = "good";
        else if (item.rate >= 50) rateClass = "medium";

        let timeStr = item.avgTime > 0 ? item.avgTime.toFixed(2) + " сек" : "0.00 сек";

        htmlReport += `
            <tr>
                <td class="rank">${index + 1}</td>
                <td><b>${item.ip}</b></td>
                <td style="font-weight: bold; color: #34495e;">⏱️ ${timeStr}</td>
                <td style="color: #27ae60; font-weight:bold;">🎯 ${item.stats.success}</td>
                <td style="color: #c0392b;">
                    ⚠️ ${item.stats.failed}
                    <div class="details">Сетевых: ${item.stats.networkErrors} | Бан CF: ${item.stats.cfBlocks}</div>
                </td>
                <td>${item.total}</td>
                <td><span class="badge ${rateClass}">${item.rate}%</span></td>
                <td><a href="/stats/delete/${encodeURIComponent(item.ip)}" class="btn-delete" onclick="return confirm('Навсегда удалить прокси ${item.ip} из ротации?')">❌</a></td>
            </tr>
        `;
    });

    htmlReport += `
        </table>

        <h2>📋 Экспорт по ПРОЦЕНТУ ПРОБИВАЕМОСТИ (Успеваемость)</h2>
        <div class="export-grid">
            <div class="export-box" style="border-top: 3px solid #2ecc71;">
                <h3>🥇 Идеальные прокси (Строго 100% SR)</h3>
                <textarea readonly onclick="this.select()" class="field-out">${formatField(eliteIps)}</textarea>
            </div>
            <div class="export-box" style="border-top: 3px solid #3498db;">
                <h3>🥈 Стабильные прокси (75% - 99%)</h3>
                <textarea readonly onclick="this.select()" class="field-out">${formatField(stableIps)}</textarea>
            </div>
            <div class="export-box" style="border-top: 3px solid #f39c12;">
                <h3>🥉 Удовлетворительные (50% - 74%)</h3>
                <textarea readonly onclick="this.select()" class="field-out">${formatField(mediumIps)}</textarea>
            </div>
        </div>

        <h2>📋 Экспорт по НАСТОЯЩЕЙ СКОРОСТИ ОТВЕТА (Временные отрезки)</h2>
        <div class="export-grid">
⚡ Супер-быстрые (До 15 сек)
${formatField(fastIps)}


🚗 Обычные (От 15 до 30 сек)
${formatField(normalIps)}


🐢 Медленные (Более 30 сек)
${formatField(slowIps)}




`;
res.setHeader('Content-Type', 'text/html; charset=UTF-8');
res.send(htmlReport);
