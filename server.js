const express = require('express');
const { chromium } = require('playwright-extra');
const stealthPlugin = require('puppeteer-extra-plugin-stealth');
const axios = require('axios');

chromium.use(stealthPlugin());

const app = express();
app.use(express.json());
app.use(express.text()); // Важно: для приема сырого текста от Webshare

// ВНУТРЕННЕЕ ХРАНИЛИЩЕ ДЛЯ ТВОИХ ПРИВАТНЫХ ПРОКСИ
let myPrivateProxies = [];
let cachedFreeProxies = [];
let lastFetchTime = 0;

// Умный парсер: превращает любой сырой скопированный текст Webshare в массив проксей с паролями
const parseRawInputList = (rawText) => {
    if (!rawText) return [];
    let cleanList = [];
    
    // Разбиваем текст по строкам
    const lines = rawText.split('\n');
    let currentProxy = {};

    lines.forEach(line => {
        const text = line.trim();
        if (!text) return;

        // 1. Ищем IP-адрес
        const ipMatch = text.match(/^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\$/);
        if (ipMatch) {
            if (currentProxy.server) cleanList.push(currentProxy); // Сохраняем предыдущий, если нашли новый
            currentProxy = { ip: ipMatch[1] };
            return;
        }

        // 2. Ищем Порт (4-5 цифр)
        const portMatch = text.match(/^(\d{4,5})\$/);
        if (portMatch && currentProxy.ip && !currentProxy.port) {
            currentProxy.port = portMatch[1];
            currentProxy.server = `http://${currentProxy.ip}:${currentProxy.port}`;
            return;
        }

        // 3. Ищем Логин и Пароль (строки из случайных букв/цифр 8-15 символов)
        const credMatch = text.match(/^([a-zA-Z0-9]{8,15})\$/);
        if (credMatch && currentProxy.server) {
            if (!currentProxy.username) {
                currentProxy.username = credMatch[1];
            } else if (!currentProxy.password) {
                currentProxy.password = credMatch[1];
            }
            return;
        }
    });
    
    if (currentProxy.server) cleanList.push(currentProxy); // Дописываем последний прокси из блока
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
            const parsed = response.data.split('\n').map(l => l.trim()).filter(l => l.includes(':'));
            if (parsed.length > 0) {
                cachedFreeProxies = parsed.map(p => ({ server: `http://${p}` }));
                lastFetchTime = now;
                return cachedFreeProxies;
            }
        }
    } catch (e) { console.error("Ошибка автосборщика: " + e.message); }
    return cachedFreeProxies;
};

const handleParse = async (req, res) => {
    const targetUrl = req.query.url || req.body?.url;
    if (!targetUrl) return res.status(400).send("<h1>Помилка: Параметр url не знайдено!</h1>");

    console.log(`📡 Запрос к сайту: ${targetUrl}`);
    
    // Выбираем пул: если загружен твой список из Webshare — берем его, иначе берем бесплатный резерв
    let activePool = [];
    if (myPrivateProxies.length > 0) {
        console.log(`🔑 Используем твои приватные прокси из Webshare. В пуле: ${myPrivateProxies.length} шт.`);
        activePool = [...myPrivateProxies];
    } else {
        console.log("⚠️ Личный пул пуст. Подключаем бесплатный резерв ротации.");
        activePool = await refreshFreeProxies();
    }

    if (activePool.length === 0) activePool = [{ server: null }];

    let renderedHtmlOutput = null;
    let badProxiesReport = [];
    const attempts = Math.min(activePool.length, 5);

    for (let i = 0; i < attempts; i++) {
        const proxy = activePool[i];
        console.log(`🔄 Попытка №${i + 1}/${attempts} через: ${proxy.server || 'Direct IP'}`);

        let browser = null;
        try {
            browser = await chromium.launch({
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled', '--lang=de-DE,de;q=0.9'],
                proxy: proxy.server ? { server: proxy.server, username: proxy.username, password: proxy.password } : undefined
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

            await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
            await page.waitForTimeout(4000); 

            const content = await page.content();

            if (content.includes('Sicherheitsüberprüfung') || content.includes('Access Denied') || content.includes('403 Forbidden')) {
                throw new Error("Заблокировано Cloudflare Turnstile.");
            }

            console.log(`✅ УСПЕХ! Прокси пробил защиту.`);
            renderedHtmlOutput = content;
            await browser.close();
            break; 

        } catch (error) {
            console.error(`❌ Збой проксі ${proxy.server || 'Direct'}: ${error.message}`);
            badProxiesReport.push({ ip: proxy.server || 'Direct', error: error.message });
        } finally {
            if (browser) await browser.close();
        }
    }

    if (!renderedHtmlOutput) {
        res.setHeader('Content-Type', 'text/html; charset=UTF-8');
        let errorHtml = `<h1>🚨 Все прокси заблокированы Cloudflare</h1><h3>Лог ротации:</h3><ul>`;
        badProxiesReport.forEach(item => { errorHtml += `<li><b>${item.ip}</b> — <span style="color:red;">${item.error}</span></li>`; });
        errorHtml += `</ul>`;
        return res.status(502).send(errorHtml);
    }

    res.setHeader('Content-Type', 'text/html; charset=UTF-8');
    return res.send(renderedHtmlOutput);
};

// 🔥 СЕКРЕТНЫЙ ЭНДПОИНТ ДЛЯ ВСТАВКИ ТЕКСТА ИЗ WEBSHARE
app.post('/update-proxies', (req, res) => {
    const rawText = req.body;
    const parsed = parseRawInputList(rawText);
    
    if (parsed.length > 0) {
        myPrivateProxies = parsed;
        console.log(`📥 Личный пул Webshare успешно загружен! Добавлено проксей: ${myPrivateProxies.length}`);
        console.log(myPrivateProxies);
        return res.send(`Успех! В память загружено приватных проксей Webshare: ${myPrivateProxies.length}`);
    } else {
        return res.status(400).send("Не удалось распознать структуру IP, портов и паролей.");
    }
});

app.get('/clear-proxies', (req, res) => {
    myPrivateProxies = [];
    res.send("Личный пул очищен. Сервер вернулся к бесплатному автосборщику.");
});

app.get('/parse', handleParse);
app.post('/parse', handleParse);
app.get('/', (req, res) => res.send(`Наш гибридный Stealth-міст работает! Личных IP в памяти: ${myPrivateProxies.length}`));

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Сервер запущен на порту ${PORT}`));

