const express = require('express');
const { chromium } = require('playwright-extra');
const stealthPlugin = require('puppeteer-extra-plugin-stealth');
const axios = require('axios');

chromium.use(stealthPlugin());

const app = express();
app.use(express.json());
app.use(express.text({ limit: '5mb' })); // Увеличили лимит

let myPrivateProxies = [];
let cachedFreeProxies = [];
let lastFetchTime = 0;

// 🕵️‍♂️ УЛЬТРА-ВСЕЯДНЫЙ АНАЛИЗАТОР (Достанет прокси из любого хаоса текста)
const parseRawInputList = (rawText) => {
    if (!rawText) return [];
    
    // 1. Вытаскиваем абсолютно все IP-адреса из текста
    const ips = rawText.match(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g) || [];
    
    // 2. Вытаскиваем все цифровые порты (4-5 цифр)
    const ports = rawText.match(/(?:\s+|:|^)(\d{4,5})(?:\s+|\n|\$)/g) || [];
    const cleanPorts = ports.map(p => p.trim().replace(':', '')).filter(Boolean);

    // 3. Вытаскиваем все потенциальные логины/пароли (буквы и цифры от 6 до 15 символов, без точек и дат)
    const tokens = rawText.split(/[\s,;\t\n\r]+/).map(t => t.trim()).filter(Boolean);
    const credentials = tokens.filter(t => t.match(/^[a-zA-Z0-9]{6,15}\(/) && !t.match(/^\d+\)/) && !['Working', 'minutes', 'minute', 'ago', 'London', 'Madrid', 'Spain', 'Kingdom', 'United'].includes(t));

    console.log(`📋 [АНАЛИЗ ТЕКСТА] Найдено в тексте -> IP: ${ips.length} шт., Портов: ${cleanPorts.length} шт., Учетных данных: ${credentials.length} шт.`);

    let cleanList = [];
    
    // Склеиваем всё в единую рабочую структуру
    for (let i = 0; i < ips.length; i++) {
        if (!ips[i] || !cleanPorts[i]) continue;
        
        // Webshare выдает данные блоками, поэтому логин и пароль идут парами для каждого IP
        const userIndex = i * 2;
        const passIndex = (i * 2) + 1;

        cleanList.push({
            server: `http://${ips[i]}:${cleanPorts[i]}`,
            username: credentials[userIndex] || null,
            password: credentials[passIndex] || null
        });
    }

    console.log(`🤖 [ИТОГ ПАРСЕРА] Успешно сформировано приватных проксей: ${cleanList.length}`);
    if (cleanList.length > 0) {
        console.log(`🎯 [ПЕРВЫЙ УЗЕЛ В ПАМЯТИ]:`, cleanList[0]);
    }
    return cleanList;
};

// Резервный автосборщик бесплатных IP
const refreshFreeProxies = async () => {
    const now = Date.now();
    if (cachedFreeProxies.length > 0 && (now - lastFetchTime) < 5 * 60 * 1000) return cachedFreeProxies;
    try {
        const p1 = 'https://proxyscrape.com';
        const p2 = '/v2/?request=displayproxies&protocol=http&timeout=5000&country=de,nl,fr,pl,es,gb&ssl=all&anonymity=anonymous';
        const response = await axios.get(p1 + p2, { timeout: 8000 });
        if (response.data && typeof response.data === 'string') {
            const lines = response.data.split(/[\s\n\r]+/).map(l => l.trim()).filter(l => l.includes(':'));
            if (lines.length > 0) {
                cachedFreeProxies = lines.map(p => ({ server: `http://${p}`, username: null, password: null }));
                lastFetchTime = now;
                return cachedFreeProxies;
            }
        }
    } catch (e) { console.error("⚠️ Резервный сборщик недоступен."); }
    return cachedFreeProxies;
};

const handleParse = async (req, res) => {
    const targetUrl = req.query.url || req.body?.url;
    if (!targetUrl) return res.status(400).send("<h1>Помилка: Параметр url не знайдено!</h1>");

    console.log(`📡 [ЗАПРОС] Рендеринг для: ${targetUrl}`);
    
    let activePool = [];
    let isPrivate = false;

    if (myPrivateProxies.length > 0) {
        activePool = [...myPrivateProxies];
        isPrivate = true;
    } else {
        activePool = await refreshFreeProxies();
    }

    if (activePool.length === 0) {
        activePool.push({ server: null, username: null, password: null });
    }

    let renderedHtmlOutput = null;
    let badProxiesReport = [];
    
    // ЧЕСТНЫЙ ПЕРЕБОР ВСЕХ IP ИЗ ТВОЕГО СПИСКА ПО ОЧЕРЕДИ
    const totalAttempts = activePool.length;
    console.log(`🚀 [РОТАЦИЯ] Запуск перебора пула. Всего доступно попыток: ${totalAttempts}`);

    for (let i = 0; i < totalAttempts; i++) {
        const proxy = activePool[i];
        const proxyLabel = proxy.server || 'Direct (Без прокси)';
        console.log(`🔎 [ПРОКСИ СТЕП №${i + 1}/${totalAttempts}] Пробуем узел: ${proxyLabel}`);

        let browser = null;
        try {
            browser = await chromium.launch({
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled', '--lang=de-DE,de;q=0.9'],
                proxy: proxy.server ? { server: proxy.server, username: proxy.username || undefined, password: proxy.password || undefined } : undefined
            });

            const context = await browser.newContext({
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
                locale: 'de-DE',
                timezoneId: 'Europe/Berlin',
                viewport: { width: 1280, height: 720 }
            });

            const page = await context.newPage();

            await page.route('**/*', (route) => {
                if (['image', 'media', 'font', 'analytics'].includes(route.request().resourceType())) { route.abort(); } else { route.continue(); }
            });

            await page.addInitScript(() => { Object.defineProperty(navigator, 'webdriver', { get: () => undefined }); });

            await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 12000 });
            await page.waitForTimeout(4000); 

            const content = await page.content();

            if (content.includes('Sicherheitsüberprüfung') || content.includes('Access Denied') || content.includes('403 Forbidden')) {
                throw new Error("Заблокировано Cloudflare Turnstile.");
            }

            console.log(`🎉 [УСПЕХ] Прокси ${proxyLabel} успешно пробил защиту!`);
            renderedHtmlOutput = content;
            await browser.close();
            break; 

        } catch (error) {
            console.error(`🚨 [СБОЙ УЗЛА] Ошибка на ${proxyLabel} -> ${error.message}`);
            badProxiesReport.push({ ip: proxyLabel, error: error.message });
            
            if (!isPrivate && proxy.server) {
                cachedFreeProxies = cachedFreeProxies.filter(p => p.server !== proxy.server);
            }
        } finally {
            if (browser) await browser.close();
        }
    }

    if (!renderedHtmlOutput) {
        res.setHeader('Content-Type', 'text/html; charset=UTF-8');
        let errorHtml = `<h1>🚨 Все прокси из списка (${totalAttempts} шт.) заблокированы Cloudflare</h1><h3>Лог пошаговых спотыканий:</h3><ul>`;
        badProxiesReport.forEach(item => { errorHtml += `<li><b>${item.ip}</b> — <span style="color:red;">${item.error}</span></li>`; });
        errorHtml += `</ul>`;
        return res.status(502).send(errorHtml);
    }

    res.setHeader('Content-Type', 'text/html; charset=UTF-8');
    return res.send(renderedHtmlOutput);
};

// ЭНДПОИНТ ДЛЯ ЗАГРУЗКИ КАТАЛОГА WEBSHARE
app.post('/update-proxies', (req, res) => {
    const rawText = req.body;
    console.log("📥 Получен сырой текст пула. Длина: " + (rawText ? rawText.length : 0));
    
    const parsed = parseRawInputList(rawText);
    
    if (parsed.length > 0) {
        myPrivateProxies = parsed;
        return res.send(`Успех! Распознано и загружено приватных проксей Webshare: ${myPrivateProxies.length}`);
    } else {
        return res.status(400).send("Ошибка: Анализатор не смог выделить структуру IP и Портов.");
    }
});

app.get('/clear-proxies', (req, res) => {
    myPrivateProxies = [];
    res.send("Приватный пул очищен.");
});

app.get('/parse', handleParse);
app.post('/parse', handleParse);
app.get('/', (req, res) => res.send(`Stealth-міст працює! Приватних IP в пам'яті: ${myPrivateProxies.length}`));

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Сервер запущен на порту ${PORT}`));
