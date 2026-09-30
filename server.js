const express = require('express');
const { chromium } = require('playwright-extra');
const stealthPlugin = require('puppeteer-extra-plugin-stealth');

// Полная маскировка автоматизации
chromium.use(stealthPlugin());

const app = express();
app.use(express.json());

const handleParse = async (req, res) => {
    const targetUrl = req.query.url || req.body?.url;
    if (!targetUrl) {
        return res.status(400).send("<h1>Помилка: Параметр url не знайдено!</h1>");
    }

    console.log(`📡 Запрос к LEGO: ${targetUrl}`);
    let browser = null;

    try {
        // Запуск с точным указанием пути к Chromium, установленном через npm
        browser = await chromium.launch({
            headless: true,
            executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined, // Динамический путь для Render
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-blink-features=AutomationControlled',
                '--disable-infobars',
                '--lang=de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7', // Имитируем немецкий браузер
                '--window-size=1920,1080'
            ]
        });

        // Контекст с отпечатками реального пользователя из Германии (Германский IP + Язык + Таймзона)
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
            locale: 'de-DE',
            timezoneId: 'Europe/Berlin', // Сурово локация Берлина
            viewport: { width: 1920, height: 1080 },
            extraHTTPHeaders: {
                'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8'
            }
        });

        const page = await context.newPage();

        // Аппаратный обход флагов автоматизации (Скрытие переменных webdriver)
        await page.addInitScript(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            window.navigator.chrome = { runtime: {}, loadTimes: function() {}, csi: function() {}, app: {} };
            Object.defineProperty(navigator, 'languages', { get: () => ['de-DE', 'de', 'en-US', 'en'] });
            Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
        });

        console.log(`🚀 Эмуляция захода живого человека на немецкий LEGO...`);
        
        // Переход и ожидание полной загрузки аналитики
        await page.goto(targetUrl, { 
            waitUntil: 'networkidle', 
            timeout: 30000 
        });

        // Движения мыши для имитации активности перед Cloudflare
        await page.mouse.move(100, 100);
        await page.mouse.move(400, 500);
        await page.waitForTimeout(4000); // 4 секунды на прохождение JavaScript-челленджей

        const content = await page.content();
        
        if (content.includes('Access Denied') || content.includes('403 Forbidden')) {
            throw new Error("Заблокировано Cloudflare. Требуется смена IP.");
        }

        console.log(`✅ Успех! Код страницы передан в Google Таблицу.`);
        res.setHeader('Content-Type', 'text/html; charset=UTF-8');
        return res.send(content);

    } catch (error) {
        console.error(`❌ Ошибка микросервиса: ${error.message}`);
        res.setHeader('Content-Type', 'text/html; charset=UTF-8');
        return res.status(502).send(`<h1>🚨 Помилка мікросервісу Render: ${error.message}</h1>`);
    } finally {
        if (browser) await browser.close();
    }
};

app.get('/parse', handleParse);
app.post('/parse', handleParse);
app.get('/', (req, res) => res.send("Stealth-міст готов до работы! 🚀"));

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Сервер запущен на порту ${PORT}`));
