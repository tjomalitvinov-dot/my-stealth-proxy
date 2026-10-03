const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');

puppeteer.use(StealthPlugin());
const app = express();

let currentProxyIndex = 0;
const login = "mmnvhwqe";
const pass = "pt6brfln6blc";

const dbPath = path.join(__dirname, 'proxy_database.json');

const initialIps = [

];

let rawIps = [];
let proxyStats = {};

const loadDatabase = () => {
    try {
        if (fs.existsSync(dbPath)) {
            const fileData = fs.readFileSync(dbPath, 'utf8');
            const parsed = JSON.parse(fileData);
            rawIps = parsed.rawIps || [];
            proxyStats = parsed.proxyStats || {};
            console.log(`💾 База загружена. IP: ${rawIps.length}`);
        } else {
            rawIps = [...new Set(initialIps)];
            rawIps.forEach(ip => {
                proxyStats[ip] = { 
                    success: 0, failed: 0, networkErrors: 0, cfBlocks: 0, totalDuration: 0, totalSessions: 0,
                    country: "-", anonymity: "-", google: "-", https: "-"
                };
            });
            saveDatabase();
        }
    } catch (err) {
        rawIps = [...new Set(initialIps)];
    }
};

const saveDatabase = () => {
    try {
        fs.writeFileSync(dbPath, JSON.stringify({ rawIps, proxyStats }, null, 4), 'utf8');
    } catch (err) {}
};

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
                '--no-sandbox', '--disable-setuid-sandbox', `--proxy-server=${proxyServerUrl}`, 
                '--disable-blink-features=AutomationControlled', '--disable-dev-shm-usage', 
                '--disable-gpu', '--disable-peer-connection-id-generator', '--disable-webrtc-encryption',
                '--ignore-certificate-errors', '--window-size=1920,1080'
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
                console.log(`🎯 [ПРОБИТИЕ НА ПОПЫТКЕ №${attempt}!] Заголовок: "${lastSeenTitle}".`);
                isSuccessParse = true;
                break; 
            } else {
                console.warn(`⚠️ Попытка №${attempt} застряла (Экран: "${lastSeenTitle}"). Пауза...`);
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
    if (rawIps.length === 0) return res.status(500).send("<h1>Ошибка: Список прокси пуст!</h1>");
    const targetUrl = req.query.url || req.body?.url;
    if (!targetUrl) return res.status(400).send("<h1>Ошибка: Параметр ?url= не найден!</h1>");
    
    for (let proxyAttempt = 1; proxyAttempt <= 4; proxyAttempt++) {
        currentProxyIndex = currentProxyIndex % rawIps.length;
        const selectedIp = rawIps[currentProxyIndex];
        currentProxyIndex = (currentProxyIndex + 1) % rawIps.length;
        
        const result = await executeParsingSession(targetUrl, selectedIp);
        if (proxyStats[selectedIp]) {
            proxyStats[selectedIp].totalSessions += 1;
            proxyStats[selectedIp].totalDuration += result.duration;
        }
        if (result.success) {
            if (proxyStats[selectedIp]) proxyStats[selectedIp].success += 1;
            saveDatabase();
            res.setHeader('Content-Type', 'text/html; charset=UTF-8');
            return res.send(result.html);
        }
        if (proxyStats[selectedIp]) {
            proxyStats[selectedIp].failed += 1;
            if (result.errorType === 'network_error') proxyStats[selectedIp].networkErrors += 1;
            if (result.errorType === 'cf_block') proxyStats[selectedIp].cfBlocks += 1;
        }
        saveDatabase();
    }
    return res.status(500).send("[ОШИБКА] 4 прокси подряд не пробили защиту.");
};

app.post('/stats/add-packet', express.urlencoded({ extended: true }), (req, res) => {
    const rawInput = req.body.packetData;
    if (!rawInput) return res.redirect('/stats');
    const lines = rawInput.split('\n');
    let addedCount = 0;

    lines.forEach(line => {
        const trimmed = line.trim(); if (!trimmed) return;
        const ipMatch = trimmed.match(/(?:[0-9]{1,3}\.){3}[0-9]{1,3}:[0-9]{1,5}/);
        if (!ipMatch) return;
        const ip = ipMatch[0];
        const cleanLine = trimmed.replace(/["',]/g, '');
        const tokens = cleanLine.split(/\s{2,}|\t/);

        if (!rawIps.includes(ip)) { rawIps.push(ip); addedCount++; }
        proxyStats[ip] = {
            success: proxyStats[ip]?.success || 0, failed: proxyStats[ip]?.failed || 0,
            networkErrors: proxyStats[ip]?.networkErrors || 0, cfBlocks: proxyStats[ip]?.cfBlocks || 0,
            totalDuration: proxyStats[ip]?.totalDuration || 0, totalSessions: proxyStats[ip]?.totalSessions || 0,
            country: tokens[1] || "-", anonymity: tokens[2] || "-", google: tokens[3] || "-", https: tokens[4] || "-"
        };
    });
    if (addedCount > 0 || lines.length > 0) saveDatabase();
    res.redirect('/stats');
});
app.post('/stats/delete-multiple', express.urlencoded({ extended: true }), (req, res) => {
    const ipsToDelete = req.body.selectedIps;
    if (ipsToDelete && ipsToDelete.length > 0) {
        const list = Array.isArray(ipsToDelete) ? ipsToDelete : [ipsToDelete];
        let deletedCount = 0;
        list.forEach(ip => {
            const index = rawIps.indexOf(ip);
            if (index > -1) { rawIps.splice(index, 1); if (proxyStats[ip]) delete proxyStats[ip]; deletedCount++; }
        });
        if (deletedCount > 0) { saveDatabase(); console.log(`🗑️ Удалено пакетом: \${deletedCount}`); }
    }
    res.redirect('/stats');
});

app.get('/stats/delete/:ip', (req, res) => {
    const targetIp = req.params.ip; const index = rawIps.indexOf(targetIp);
    if (index > -1) { rawIps.splice(index, 1); if (proxyStats[targetIp]) delete proxyStats[targetIp]; saveDatabase(); }
    res.redirect('/stats');
});

app.get('/stats/clear-metrics', (req, res) => {
    rawIps.forEach(ip => {
        proxyStats[ip].success = 0; proxyStats[ip].failed = 0; proxyStats[ip].networkErrors = 0;
        proxyStats[ip].cfBlocks = 0; proxyStats[ip].totalDuration = 0; proxyStats[ip].totalSessions = 0;
    });
    saveDatabase(); res.redirect('/stats');
});

app.get('/stats', (req, res) => {
    const sortedList = rawIps.map(ip => {
        const stats = proxyStats[ip] || { success: 0, failed: 0, networkErrors: 0, cfBlocks: 0, totalDuration: 0, totalSessions: 0, country: "-", anonymity: "-", google: "-", https: "-" };
        const total = stats.success + stats.failed;
        const rate = total > 0 ? parseFloat(((stats.success / total) * 100).toFixed(1)) : 0.0;
        const avgTime = stats.totalSessions > 0 ? parseFloat(((stats.totalDuration / stats.totalSessions) / 1000).toFixed(2)) : 0.00;
        return { ip, stats, total, rate, avgTime };
    });
    sortedList.sort((a, b) => b.rate - a.rate);

    const eliteIps = sortedList.filter(item => item.rate === 100.0 && item.stats.success > 0).map(item => `"\${item.ip}"`);
    const stableIps = sortedList.filter(item => item.rate >= 75.0 && item.rate < 100.0 && item.stats.success > 0).map(item => `"\${item.ip}"`);
    const mediumIps = sortedList.filter(item => item.rate >= 50.0 && item.rate < 75.0 && item.stats.success > 0).map(item => `"\${item.ip}"`);
    const fastIps = sortedList.filter(item => item.avgTime > 0.00 && item.avgTime <= 15.00 && item.stats.success > 0).map(item => `"\${item.ip}"`);
    const normalIps = sortedList.filter(item => item.avgTime > 15.00 && item.avgTime <= 30.00 && item.stats.success > 0).map(item => `"\${item.ip}"`);
    const slowIps = sortedList.filter(item => item.avgTime > 30.00 && item.stats.success > 0).map(item => `"\${item.ip}"`);

    const formatField = (arr) => arr.length > 0 ? arr.join(",\n    ") : "// Нет подходящих IP";

    let htmlReport = `
    <html>
    <head>
        <title>⚙️ Менеджер Прокси Про</title>
        <meta http-equiv="refresh" content="10">
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, Arial, sans-serif; margin: 25px; background: #f8fafc; color: #334155; font-size: 11px; line-height: 1.4; }
            .control-panel { display: flex; gap: 20px; background: #1e293b; padding: 15px; border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); margin-bottom: 20px; color: #f1f5f9; }
            .form-packet { flex: 1; display: flex; flex-direction: column; gap: 5px; }
            .form-packet span { font-size: 12px; font-weight: 600; color: #38bdf8; }
            .form-packet textarea { height: 60px; padding: 6px; background: #0f172a; color: #34d399; border: 1px solid #334155; border-radius: 4px; font-size: 11px; font-family: monospace; resize: none; box-sizing: border-box; }
            .btn-submit { padding: 6px 12px; background: #0ea5e9; color: #fff; font-weight: bold; border: none; border-radius: 4px; cursor: pointer; font-size: 11px; align-self: flex-end; }
            .btn-clear { padding: 8px 12px; background: #ef4444; color: white; border-radius: 4px; font-weight: bold; text-decoration: none; font-size: 11px; align-self: center; }
            .btn-delete-mass { padding: 6px 12px; background: #ef4444; color: white; border: none; border-radius: 4px; font-weight: bold; cursor: pointer; font-size: 11px; margin-bottom: 10px; display: inline-block; }
            .btn-delete { color: #ef4444; text-decoration: none; font-weight: bold; font-size: 12px; }
            table { width: 100%; border-collapse: collapse; background: #fff; box-shadow: 0 2px 5px rgba(0,0,0,0.02); border-radius: 6px; overflow: hidden; margin-bottom: 20px; }
            th, td { padding: 6px 8px; text-align: left; border-bottom: 1px solid #e2e8f0; font-size: 11px; }
            th { background-color: #334155; color: #f8fafc; font-weight: 600; text-transform: uppercase; font-size: 9.5px; letter-spacing: 0.3px; }
            tr:hover { background-color: #f1f5f9; }
            .badge { padding: 3px 6px; border-radius: 3px; font-weight: bold; color: white; display: inline-block; min-width: 90px; text-align: center; }
            .good { background-color: #10b981; } .medium { background-color: #f59e0b; } .low-range { background-color: #f97316; } .zero-failed { background-color: #7f1d1d; }
            .details { font-size: 10px; color: #64748b; margin-top: 2px; } .rank { font-weight: bold; color: #94a3b8; width: 25px; text-align: center; } .text-bold { font-weight: 600; color: #1e293b; }
            .export-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-top: 10px; margin-bottom: 15px; }
            .export-box { background: #fff; box-shadow: 0 2px 5px rgba(0,0,0,0.02); border-radius: 6px; padding: 10px; }
            textarea.field-out { width: 100%; height: 95px; font-family: 'Courier New', monospace; background: #1e293b; color: #38bdf8; padding: 6px; border: none; border-radius: 4px; font-size: 11px; resize: vertical; box-sizing: border-box; margin-top: 6px; }
        </style>
        <script>
            function toggleAll(source) {
                var checkboxes = document.getElementsByName('selectedIps');
                for(var i=0, n=checkboxes.length; i<n; i++) { checkboxes[i].checked = source.checked; }
            }
        </script>
    </head>
    <body>
        <h2>🛠️ Панель управления и пакетного добавления прокси</h2>
        <div class="control-panel">
            <form action="/stats/add-packet" method="POST" class="form-packet">
                <span>📥 Пакетный импорт прокси с параметрами (Country, Anonymity, Google, Https):</span>
                <textarea name="packetData" placeholder="Вставляй строками формата: IP:PORT  Japan  elite proxy  yes  yes"></textarea>
                <button type="submit" class="btn-submit">⚡ Добавить пакет в ротацию</button>
            </form>
            <a href="/stats/clear-metrics" class="btn-clear" onclick="return confirm('Обнулить метрики?')">🧹 Сбросить статистику</a>
        </div>

        <h2>📊 Бессмертный рейтинг прокси с таймингами (Обновление каждые 10с)</h2>
        <p style="margin-top: -5px; color: #7f8c8d; font-size: 12px;">Всего уникальных прокси в ротации: <b>\${rawIps.length}</b></p>
        
        <form action="/stats/delete-multiple" method="POST" onsubmit="return confirm('Навсегда удалить выбранные прокси?')">
            <button type="submit" class="btn-delete-mass">🗑️ Удалить выбранные галочками</button>
            <table>
                <tr>
                    <th style="width: 30px; text-align: center;"><input type="checkbox" onClick="toggleAll(this)" /></th>
                    <th style="width: 25px; text-align: center;">№</th>
                    <th style="width: 130px;">IP Адрес</th>
                    <th style="width: 85px;">Country</th>
                    <th style="width: 85px;">Anonymity</th>
                    <th style="width: 45px;">Google</th>
                    <th style="width: 45px;">Https</th>
                    <th style="width: 75px;">⏱️ Ср. время</th>
                    <th style="width: 60px;">🎯 Успех</th>
                    <th style="width: 110px;">⚠️ Сбои</th>
                    <th style="width: 45px;">Всего</th>
                    <th style="width: 140px;">Процент (SR)</th>
                    <th style="width: 35px; text-align: center;">DEL</th>
                </tr>
    `;

    sortedList.forEach((item, index) => {
        let rateClass = "good";
        if (item.rate === 0.0) rateClass = "zero-failed";
        else if (item.rate < 50.0) rateClass = "low-range";
        else if (item.rate < 75.0) rateClass = "medium";
        let timeStr = item.avgTime > 0 ? item.avgTime.toFixed(2) + "с" : "0.00с";

        htmlReport += `
                <tr>
                    <td style="text-align: center;"><input type="checkbox" name="selectedIps" value="\${item.ip}" /></td>
                    <td class="rank">\${index + 1}</td>
                    <td class="text-bold">\${item.ip}</td>
                    <td>\${item.stats.country || "-"}</td>
                    <td>\${item.stats.anonymity || "-"}</td>
                    <td>\${item.stats.google || "-"}</td>
                    <td>\${item.stats.https || "-"}</td>
                    <td style="font-weight: 600; color: #475569;">⏱️ \${timeStr}</td>
                    <td style="color: #10b981; font-weight:bold;">\${item.stats.success}</td>
                    <td style="color: #ef4444;">\${item.stats.failed}<div class="details">Net: \${item.stats.networkErrors} | CF: \${item.stats.cfBlocks}</div></td>
                    <td>\${item.total}</td>
                    <td><span class="badge \${rateClass}">\${item.rate}%</span></td>
                    <td style="text-align: center;"><a href="/stats/delete/\${encodeURIComponent(item.ip)}" class="btn-delete" onclick="return confirm('Удалить?')">❌</a></td>
                </tr>
        `;
    });

    htmlReport += `
            </table>
        </form>

        <h2>📋 Экспорт по ПРОЦЕНТУ ПРОБИВАЕМОСТИ</h2>
        <div class="export-grid">
            <div class="export-box" style="border-top: 3px solid #10b981;"><h3>🥇 Идеальные прокси (100% SR)</h3><textarea readonly onclick="this.select()" class="field-out">\${formatField(eliteIps)}</textarea></div>
            <div class="export-box" style="border-top: 3px solid #0ea5e9;"><h3>🥈 Стабильные прокси (75% - 99%)</h3><textarea readonly onclick="this.select()" class="field-out">\${formatField(stableIps)}</textarea></div>
            <div class="export-box" style="border-top: 3px solid #f59e0b;"><h3>🥉 Удовлетворительные (50% - 74%)</h3><textarea readonly onclick="this.select()" class="field-out">\${formatField(mediumIps)}</textarea></div>
        </div>

        <h2>📋 Экспорт по СКОРОСТИ ОТВЕТА (Временные отрезки)</h2>
        <div class="export-grid">
            <div class="export-box" style="border-top: 3px solid #00ced1;"><h3>⚡ Супер-быстрые (До 15 сек)</h3><textarea readonly onclick="this.select()" class="field-out">\${formatField(fastIps)}</textarea></div>
            <div class="export-box" style="border-top: 3px solid #9370db;"><h3>🚗 Обычные (От 15 до 30 сек)</h3><textarea readonly onclick="this.select()" class="field-out">\${formatField(normalIps)}</textarea></div>
            <div class="export-box" style="border-top: 3px solid #ff1493;"><h3>🐢 Медленные (Более 30 сек)</h3><textarea readonly onclick="this.select()" class="field-out">\${formatField(slowIps)}</textarea></div>
        </div>
    </body>
    </html>
    `;
    res.setHeader('Content-Type', 'text/html; charset=UTF-8'); res.send(htmlReport);
});

app.get('/parse', handleParse);
app.post('/parse', express.json(), handleParse);

const PORT = process.env.PORT || 7860;
app.listen(PORT, () => { console.log('🚀 Менеджер прокси Про полностью запущен!'); });
