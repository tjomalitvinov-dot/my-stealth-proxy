const express = require('express');
const { chromium } = require('playwright-extra');
const stealthPlugin = require('puppeteer-extra-plugin-stealth');

// Включаємо повний захист від розпізнавання автоматизації
chromium.use(stealthPlugin());

const app = express();
app.use(express.json());

const handleParse = async (req, res) => {
    const targetUrl = req.query.url || req.body?.url;
    if (!targetUrl) {
        return res.status(400).send("<h1>Помилка: Параметр url не знайдено!</h1>");
    }

    console.log(`📡 Запит до LEGO: ${targetUrl}`);
    let browser = null;

    try {
        // У Docker-образі Microsoft Playwright вже налаштований, запускаємо його напряму
        browser = await chromium.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-blink-features=AutomationControlled',
                '--disable-infobars',
                '--lang=de-DE,de;q=0.9', // Емулюємо німецьку мову системи
                '--window-size=1920,1080'
            ]
        });

        // Створюємо чистий контекст реального користувача з Німеччини (Берлін)
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
            locale: 'de-DE',
            timezoneId: 'Europe/Berlin', // Часовий пояс Німеччини
            viewport: { width: 1920, height: 1080 },
            extraHTTPHeaders: {
                'Accept-Language': 'de-DE,de;q=0.9'
            }
        });

        const page = await context.newPage();

        // Маскуємо змінні браузера, щоб Cloudflare не бачив прихованих прапорців робота
        await page.addInitScript(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            window.navigator.chrome = { runtime: {}, loadTimes: function() {}, csi: function() {}, app: {} };
            Object.defineProperty(navigator, 'languages', { get: () => ['de-DE', 'de'] });
        });

        console.log(`🚀 Емуляція поведінки людини на сайті LEGO...`);
        
        // Переходимо на сайт
        await page.goto(targetUrl, { 
            waitUntil: 'networkidle', 
            timeout: 30000 
        });

        // Імітуємо легкий рух мишкою для проходження інтерактивної перевірки Turnstile
        await page.mouse.move(200, 200);
        await page.mouse.move(600, 400);
        
        // Обов'язкова пауза 4 секунди, щоб Cloudflare встиг видати куки доступу
        await page.waitForTimeout(4500);

        const content = await page.content();
        
        // Перевірка на бан
        if (content.includes('Access Denied') || content.includes('403 Forbidden')) {
            throw new Error("Cloudflare заблокував IP-адресу сервера Render.");
        }

        console.log(`✅ Сторінку успішно відрендерено. Відправляємо в Google Таблицю.`);
        res.setHeader('Content-Type', 'text/html; charset=UTF-8');
        return res.send(content);

    } catch (error) {
        console.error(`❌ Помилка: ${error.message}`);
        res.setHeader('Content-Type', 'text/html; charset=UTF-8');
        return res.status(502).send(`<h1>🚨 Помилка мікросервісу Render: ${error.message}</h1>`);
    } finally {
        if (browser) await browser.close();
    }
};

app.get('/parse', handleParse);
app.post('/parse', handleParse);
app.get('/', (req, res) => res.send("Docker Stealth-міст для Google Sheets працює! 🚀"));

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Сервер запущено на порту ${PORT}`));

