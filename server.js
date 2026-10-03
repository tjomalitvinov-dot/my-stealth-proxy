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

// Путь к файлу бессмертной базы данных на сервере Render
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
            console.log(`💾 Бессмертная база успешно загружена! Прокси в ротации: ${rawIps.length}`);
        } else {
            console.log("📝 Первичная генерация базы данных...");
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
    return res.status(500).send("[ОШИБКА] Очередь из 4-х прокси подряд не смогла пробить защиту.");
};

// ИСПРАВЛЕНО: Железное разделение токенов по любым типам пробелов/табов/запятых
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

        // Тотальное очищение строки от кавычек и замена любых табуляций/запятых на чистые одиночные пробелы
        let cleanLine = trimmed.replace(/["']/g, '').replace(/[\t,]/g, ' ');
        // Схлопываем множественные пробелы в один, чтобы split не ошибался
        cleanLine = cleanLine.replace(/\s+/g, ' ');
        const tokens = cleanLine.split(' ');

        // Находим реальные индексы параметров, сдвигая их относительно IP
        const ipIdx = tokens.indexOf(ip);
        const country = (ipIdx > -1 && tokens[ipIdx + 1]) ? tokens[ipIdx + 1] : "-";
        const anonymity = (ipIdx > -1 && tokens[ipIdx + 2]) ? tokens[ipIdx + 2] : "-";
        const google = (ipIdx > -1 && tokens[ipIdx + 3]) ? tokens[ipIdx + 3] : "-";
        const https = (ipIdx > -1 && tokens[ipIdx + 4]) ? tokens[ipIdx + 4] : "-";

        if (!rawIps.includes(ip)) { rawIps.push(ip); addedCount++; }
        proxyStats[ip] = {
            success: proxyStats[ip]?.success || 0, failed: proxyStats[ip]?.failed || 0,
            networkErrors: proxyStats[ip]?.networkErrors || 0, cfBlocks: proxyStats[ip]?.cfBlocks || 0,
            totalDuration: proxyStats[ip]?.totalDuration || 0, totalSessions: proxyStats[ip]?.totalSessions || 0,
            country: country, anonymity: anonymity, google: google, https: https
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
        if (deletedCount > 0) { saveDatabase(); }
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

    const eliteIps = sortedList.filter(item => item.rate === 100.0 && item.stats.success > 0).map(item => '"' + item.ip + '"');
    const stableIps = sortedList.filter(item => item.rate >= 75.0 && item.rate < 100.0 && item.stats.success > 0).map(item => '"' + item.ip + '"');
    const mediumIps = sortedList.filter(item => item.rate >= 50.0 && item.rate < 75.0 && item.stats.success > 0).map(item => '"' + item.ip + '"');
    const fastIps = sortedList.filter(item => item.avgTime > 0.00 && item.avgTime <= 15.00 && item.stats.success > 0).map(item => '"' + item.ip + '"');
    const normalIps = sortedList.filter(item => item.avgTime > 15.00 && item.avgTime <= 30.00 && item.stats.success > 0).map(item => '"' + item.ip + '"');
    const slowIps = sortedList.filter(item => item.avgTime > 30.00 && item.stats.success > 0).map(item => '"' + item.ip + '"');

    const formatField = (arr) => arr.length > 0 ? arr.join(",\n    ") : "// Нет подходящих IP";

    let htmlReport = '<!DOCTYPE html><html><head><title>⚙️ Менеджер Прокси Про</title>';
    htmlReport += '<style>';
    htmlReport += 'body { font-family: -apple-system, BlinkMacSystemFont, Arial, sans-serif; margin: 25px; background: #f8fafc; color: #334155; font-size: 11.5px; line-height: 1.4; }';
    htmlReport += '.control-panel { display: flex; gap: 20px; background: #1e293b; padding: 15px; border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); margin-bottom: 20px; color: #f1f5f9; }';
    htmlReport += '.form-packet { flex: 1; display: flex; flex-direction: column; gap: 5px; }';
    htmlReport += '.form-packet span { font-size: 12px; font-weight: 600; color: #38bdf8; }';
    htmlReport += '.form-packet textarea { height: 60px; padding: 6px; background: #0f172a; color: #34d399; border: 1px solid #334155; border-radius: 4px; font-size: 11px; font-family: monospace; resize: none; box-sizing: border-box; }';
    htmlReport += '.btn-submit { padding: 6px 12px; background: #0ea5e9; color: #fff; font-weight: bold; border: none; border-radius: 4px; cursor: pointer; font-size: 11px; align-self: flex-end; }';
    htmlReport += '.btn-clear { padding: 8px 12px; background: #ef4444; color: white; border-radius: 4px; font-weight: bold; text-decoration: none; font-size: 11px; align-self: center; }';
    htmlReport += '.btn-delete-mass { padding: 6px 12px; background: #ef4444; color: white; border: none; border-radius: 4px; font-weight: bold; cursor: pointer; font-size: 11px; margin-bottom: 10px; display: inline-block; }';
    htmlReport += '.btn-delete { color: #ef4444; text-decoration: none; font-weight: bold; font-size: 12px; }';
    htmlReport += '.refresh-control { background: #334155; padding: 12px; border-radius: 5px; margin-bottom: 15px; display: flex; align-items: center; gap: 15px; color: white; box-shadow: 0 2px 5px rgba(0,0,0,0.05); }';
    htmlReport += '.refresh-control select { padding: 4px 8px; border-radius: 4px; background: #0f172a; color: white; border: 1px solid #475569; font-size: 11.5px; cursor: pointer; }';
    htmlReport += '.btn-toggle-refresh { padding: 5px 12px; border: none; border-radius: 4px; font-weight: bold; cursor: pointer; font-size: 11px; transition: 0.1s; }';
    htmlReport += '.btn-on { background: #10b981; color: white; } .btn-off { background: #ef4444; color: white; }';
    htmlReport += '.status-text { font-size: 11px; font-weight: 600; }';
    htmlReport += 'table { width: 100%; border-collapse: collapse; background: #fff; box-shadow: 0 2px 5px rgba(0,0,0,0.02); border-radius: 6px; overflow: hidden; margin-bottom: 20px; }';
    htmlReport += 'th, td { padding: 6px 8px; text-align: left; border-bottom: 1px solid #e2e8f0; font-size: 11px; }';
    htmlReport += 'th { background-color: #334155; color: #f8fafc; font-weight: 600; text-transform: uppercase; font-size: 10px; letter-spacing: 0.3px; }';
    htmlReport += 'tr:hover { background-color: #f1f5f9; }';
    htmlReport += '.badge { padding: 3px 6px; border-radius: 3px; font-weight: bold; color: white; display: inline-block; min-width: 90px; text-align: center; }';
    htmlReport += '.good { background-color: #10b981; } .medium { background-color: #f59e0b; } .low-range { background-color: #f97316; } .zero-failed { background-color: #7f1d1d; }';
    htmlReport += '.details { font-size: 10px; color: #64748b; margin-top: 2px; } .rank { font-weight: bold; color: #94a3b8; width: 25px; text-align: center; } .text-bold { font-weight: 600; color: #1e293b; }';
    htmlReport += '.export-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-top: 10px; margin-bottom: 15px; }';
    htmlReport += '.export-box { background: #fff; box-shadow: 0 2px 5px rgba(0,0,0,0.02); border-radius: 6px; padding: 10px; }';
    htmlReport += 'textarea.field-out { width: 100%; height: 95px; font-family: "Courier New", monospace; background: #1e293b; color: #38bdf8; padding: 6px; border: none; border-radius: 4px; font-size: 11px; resize: vertical; box-sizing: border-box; margin-top: 6px; }';
    htmlReport += '</style>';
    htmlReport += '<script>';
    htmlReport += 'window.onload = function() {';
    htmlReport += '  var isEnabled = localStorage.getItem("refresh_enabled") !== "false";';
    htmlReport += '  var interval = localStorage.getItem("refresh_interval") || "10000";';
    htmlReport += '  var selectEl = document.getElementById("refreshIntervalSelect");';
    htmlReport += '  var btnEl = document.getElementById("refreshToggleBtn");';
    htmlReport += '  var statusEl = document.getElementById("refreshStatusText");';
    htmlReport += '  if(selectEl) selectEl.value = interval;';
    htmlReport += '  if(btnEl && isEnabled) {';
    htmlReport += '    btnEl.innerText = "⏸️ Выключить автообновление"; btnEl.className = "btn-toggle-refresh btn-off";';
    htmlReport += '    if(statusEl) statusEl.innerHTML = "Активно (каждые " + (interval/1000) + "с) 🟢";';
    htmlReport += '    window.refreshTimer = setTimeout(function() { window.location.reload(); }, parseInt(interval));';
    htmlReport += '  } else if(btnEl) {';
    htmlReport += '    btnEl.innerText = "▶️ Включить автообновление"; btnEl.className = "btn-toggle-refresh btn-on";';
    htmlReport += '    if(statusEl) statusEl.innerHTML = "Отключено 🔴";';
    htmlReport += '  }';
    htmlReport += '};';
    htmlReport += 'function toggleRefresh() {';
    htmlReport += '  var current = localStorage.getItem("refresh_enabled") !== "false";';
    htmlReport += '  localStorage.setItem("refresh_enabled", !current); window.location.reload();';
    htmlReport += '}';
    htmlReport += 'function changeInterval(val) {';
    htmlReport += '  localStorage.setItem("refresh_interval", val); window.location.reload();';
    htmlReport += '}';
    htmlReport += 'function toggleAll(source) {';
    htmlReport += '  var checkboxes = document.getElementsByName("selectedIps");';
    htmlReport += '  for(var i=0; i<checkboxes.length; i++) { checkboxes[i].checked = source.checked; }';
    htmlReport += '}';
    htmlReport += '</script></head><body>';
    
    htmlReport += '<h2>🛠️ Панель управления и пакетного добавления прокси</h2>';
    htmlReport += '<div class="control-panel">';
    htmlReport += '<form action="/stats/add-packet" method="POST" class="form-packet">';
    htmlReport += '<span>📥 Пакетный импорт прокси с параметрами (Country, Anonymity, Google, Https):</span>';
    htmlReport += '<textarea name="packetData" placeholder="Вставляй строками формата: IP:PORT  Japan  elite proxy  yes  yes"></textarea>';
    htmlReport += '<button type="submit" class="btn-submit">⚡ Добавить пакет в ротацию</button>';
    htmlReport += '</form>';
    htmlReport += '<a href="/stats/clear-metrics" class="btn-clear" onclick="return confirm(\'Обнулить метрики?\')">🧹 Сбросить статистику</a>';
    htmlReport += '</div>';

    htmlReport += '<h2>🎛️ Интерактивный пульт мониторинга</h2>';
    htmlReport += '<div class="refresh-control">';
    htmlReport += '<button id="refreshToggleBtn" onclick="toggleRefresh()"></button>';
    htmlReport += '<div><span>⏱️ Интервал: </span><select id="refreshIntervalSelect" onChange="changeInterval(this.value)">';
    htmlReport += '<option value="10000">10 секунд</option><option value="30000">30 секунд</option>';
    htmlReport += '<option value="60000">1 минута</option><option value="300000">5 минут</option>';
    htmlReport += '</select></div>';
    htmlReport += '<div>Статус автообновления: <span id="refreshStatusText" class="status-text"></span></div>';
    htmlReport += '</div>';

    htmlReport += '<h2>📊 Рейтинг прокси (Управление ротацией)</h2>';
    htmlReport += '<p style="margin-top: -5px; color: #7f8c8d; font-size: 12px;">Всего уникальных прокси в ротации: <b>' + rawIps.length + '</b></p>';
    
    htmlReport += '<form action="/stats/delete-multiple" method="POST" onsubmit="return confirm(\'Навсегда удалить выбранные прокси?\')">';
    htmlReport += '<button type="submit" class="btn-delete-mass">🗑️ Удалить выбранные галочками</button>';
    htmlReport += '<table><tr>';
    htmlReport += '<th style="width: 30px; text-align: center;"><input type="checkbox" onClick="toggleAll(this)" /></th>';
    htmlReport += '<th style="width: 25px; text-align: center;">№</th>';
    htmlReport += '<th style="width: 130px;">IP Адрес</th>';
    htmlReport += '<th style="width: 85px;">Country</th>';
    htmlReport += '<th style="width: 85px;">Anonymity</th>';
    htmlReport += '<th style="width: 45px;">Google</th>';
    htmlReport += '<th style="width: 45px;">Https</th>';
    htmlReport += '<th style="width: 75px;">⏱️ Ср. время</th>';
    htmlReport += '<th style="width: 60px;">🎯 Успех</th>';
    htmlReport += '<th style="width: 110px;">⚠️ Сбои</th>';
    htmlReport += '<th style="width: 45px;">Всего</th>';
    htmlReport += '<th style="width: 140px;">Процент (SR)</th>';
    htmlReport += '<th style="width: 35px; text-align: center;">DEL</th></tr>';

    sortedList.forEach((item, index) => {
        let rateClass = "good";
        if (item.rate === 0.0) rateClass = "zero-failed";
        else if (item.rate < 50.0) rateClass = "low-range";
        else if (item.rate < 75.0) rateClass = "medium";
        
        let timeStr = item.avgTime > 0 ? item.avgTime.toFixed(2) + "с" : "0.00с";

        htmlReport += '<tr>';
        htmlReport += '<td style="text-align: center;"><input type="checkbox" name="selectedIps" value="' + item.ip + '" /></td>';
        htmlReport += '<td class="rank">' + (index + 1) + '</td>';
        htmlReport += '<td class="text-bold">' + item.ip + '</td>';
        htmlReport += '<td>' + (item.stats.country || "-") + '</td>';
        htmlReport += '<td>' + (item.stats.anonymity || "-") + '</td>';
        htmlReport += '<td>' + (item.stats.google || "-") + '</td>';
        htmlReport += '<td>' + (item.stats.https || "-") + '</td>';
        htmlReport += '<td style="font-weight: 600; color: #475569;">⏱️ ' + timeStr + '</td>';
        htmlReport += '<td style="color: #10b981; font-weight:bold;">' + item.stats.success + '</td>';
        htmlReport += '<td style="color: #ef4444;">' + item.stats.failed + '<div class="details">Net: ' + item.stats.networkErrors + ' | CF: ' + item.stats.cfBlocks + '</div></td>';
        htmlReport += '<td>' + item.total + '</td>';
        htmlReport += '<td><span class="badge ' + rateClass + '">' + item.rate + '%</span></td>';
        htmlReport += '<td style="text-align: center;"><a href="/stats/delete/' + encodeURIComponent(item.ip) + '" class="btn-delete" onclick="return confirm(\'Удалить?\')">❌</a></td>';
        htmlReport += '</tr>';
    });

    htmlReport += '</table></form>';

    htmlReport += '<h2>📋 Экспорт по ПРОЦЕНТУ ПРОБИВАЕМОСТИ</h2>';
    htmlReport += '<div class="export-grid">';
    htmlReport += '<div class="export-box" style="border-top: 3px solid #10b981;"><h3>🥇 Идеальные прокси (100% SR)</h3><textarea readonly onclick="this.select()" class="field-out">' + formatField(eliteIps) + '</textarea></div>';
    htmlReport += '<div class="export-box" style="border-top: 3px solid #0ea5e9;"><h3>🥈 Стабильные прокси (75% - 99%)</h3><textarea readonly onclick="this.select()" class="field-out">' + formatField(stableIps) + '</textarea></div>';
    htmlReport += '<div class="export-box" style="border-top: 3px solid #f59e0b;"><h3>🥉 Удовлетворительные (50% - 74%)</h3><textarea readonly onclick="this.select()" class="field-out">' + formatField(mediumIps) + '</textarea></div>';
    htmlReport += '</div>';

    htmlReport += '<h2>📋 Экспорт по СКОРОСТИ ОТВЕТА (Временные отрезки)</h2>';
    htmlReport += '<div class="export-grid">';
    htmlReport += '<div class="export-box" style="border-top: 3px solid #00ced1;"><h3>⚡ Супер-быстрые (До 15 сек)</h3><textarea readonly onclick="this.select()" class="field-out">' + formatField(fastIps) + '</textarea></div>';
    htmlReport += '<div class="export-box" style="border-top: 3px solid #9370db;"><h3>🚗 Обычные (От 15 до 30 сек)</h3><textarea readonly onclick="this.select()" class="field-out">' + formatField(normalIps) + '</textarea></div>';
    htmlReport += '<div class="export-box" style="border-top: 3px solid #ff1493;"><h3>🐢 Медленные (Более 30 сек)</h3><textarea readonly onclick="this.select()" class="field-out">' + formatField(slowIps) + '</textarea></div>';
    htmlReport += '</div></body></html>';

    res.setHeader('Content-Type', 'text/html; charset=UTF-8');
    res.send(htmlReport);
});

app.get('/parse', handleParse);
app.post('/parse', express.json(), handleParse);

const PORT = process.env.PORT || 7860;
app.listen(PORT, () => { console.log('🚀 Менеджер прокси Про полностью запущен!'); });

