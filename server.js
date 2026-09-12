const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// Включаем Stealth-маскировку для обхода PerimeterX и Cloudflare
puppeteer.use(StealthPlugin());
const app = express();

// Универсальный обработчик, который достает URL из любого места!
const handleParse = async (req, res) => {
    // Движок проверяет: если ссылка пришла в GET-строке (?url=), берем её. Если в POST — из тела пакета.
    const targetUrl = req.query.url || req.body?.url;
    
    if (!targetUrl) {
        return res.status(400).send("<h1>Ошибка: Параметр ?url= не найден в запросе!</h1>");
    }

    console.log(`📡 Перехват No-Code движка. Заходим на живой сайт: ${targetUrl}`);
    
    // Пул резидентных прокси для ротации IP внутри Render
    const proxyList = [
        'http://45.152.188.243:3128',
        'http://185.162.229.42:3128',
        'http://81.94.156.46:8080',
        'http://95.214.55.234:3128',
        'http://194.67.212.182:3128'
    ];
    const randomProxy = proxyList[Math.floor(Math.random() * proxyList.length)];

    let browser = null;
    try {
        browser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                `--proxy-server=${randomProxy}`,
                '--disable-blink-features=AutomationControlled'
            ]
        });

        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        // Стираем флаг navigator.webdriver на аппаратном уровне браузера
        await page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        });

        // Загружаем целевую страницу товара
        await page.goto(targetUrl, { waitUntil: 'networkidle2' });
        
        // No-Code пауза в 3.5 секунды, чтобы прогрузился весь скрытый JavaScript
        await new Promise(resolve => setTimeout(resolve, 3500));

        const cleanHtmlOutput = await page.content();
        
        // Возвращаем полноценный, чистый HTML обратно в Google Таблицу
        res.setHeader('Content-Type', 'text/html; charset=UTF-8');
        return res.send(cleanHtmlOutput);

    } catch (error) {
        return res.status(500).send(`<h1>Ошибка маскированного браузера: ${error.message}</h1>`);
    } finally {
        if (browser !== null) await browser.close();
    }
};

// Прописываем Express-маршруты: теперь сервер одинаково мощно слушает и GET, и POST!
app.get('/parse', handleParse);
app.post('/parse', express.json(), handleParse);

const PORT = process.env.PORT || 7860;
app.listen(PORT, () => { console.log(`🚀 Универсальный GET/POST шлюз успешно запущен на порту ${PORT}`); });
