const express = require('express');
const { chromium } = require('playwright-extra');
const stealthPlugin = require('puppeteer-extra-plugin-stealth');

// Увімкнення маскировки від розпізнавання автоматизації
chromium.use(stealthPlugin());

const app = express();
app.use(express.json());

// Головний ендпоінт, куди Google Sheets надсилатиме запити
const handleParse = async (req, res) => {
    // Google Sheets може надсилати URL як в query, так і в body
    const targetUrl = req.query.url || req.body?.url;
    
    if (!targetUrl) {
        return res.status(400).send("<h1>Помилка: Параметр url не знайдено в запиті від Google Sheets!</h1>");
    }

    console.log(`📡 Отримано запит від Google Sheets для сайту: ${targetUrl}`);

    let browser = null;
    try {
        // Запуск Headless-браузера з налаштуваннями обходу бот-детекторів
        browser = await chromium.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-blink-features=AutomationControlled',
                '--disable-infobars',
                '--window-size=1280,720'
            ]
        });

        // Створення контексту з чистими відбитками (Fingerprints) реального Chrome
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            locale: 'uk-UA,uk;q=0.9,en-US;q=0.8',
            timezoneId: 'Europe/Kyiv',
            viewport: { width: 1280, height: 720 }
        });

        const page = await context.newPage();

        // Емуляція природного руху миші та поведінки людини для обману Cloudflare
        await page.addInitScript(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        });

        console.log(`🚀 Перехід на сторінку...`);
        
        // Переходимо на сайт (наприклад, LEGO) і чекаємо повного завантаження
        await page.goto(targetUrl, { 
            waitUntil: 'networkidle', // Чекаємо, поки затихне мережа
            timeout: 25000            // Даємо 25 секунд на проходження перевірок
        });

        // Технічна пауза 3 секунди на випадок, якщо Cloudflare показує вікно "Just a moment..."
        await page.waitForTimeout(3500);

        // Перевіряємо, чи є на сторінці явні ознаки блокування
        const content = await page.content();
        
        if (content.includes('Access Denied') || content.includes('403 Forbidden') || content.includes('Cloudflare') && content.includes('error-code')) {
            throw new Error("Блокування Cloudflare (Доступ відхилено)");
        }

        console.log(`✅ Сторінку успішно завантажено. Довжина HTML: ${content.length} символів.`);
        
        // Повертаємо чистий HTML назад в Google Apps Script
        res.setHeader('Content-Type', 'text/html; charset=UTF-8');
        return res.send(content);

    } catch (error) {
        console.error(`❌ Критична помилка парсингу: ${error.message}`);
        res.setHeader('Content-Type', 'text/html; charset=UTF-8');
        return res.status(502).send(`<h1>🚨 Помилка мікросервісу Render: ${error.message}</h1>`);
    } finally {
        if (browser) {
            await browser.close();
            console.log(`🧹 Браузер закрито, пам'ять очищено.`);
        }
    }
};

// Налаштування маршрутів під ваші виклики з Google Sheets
app.get('/parse', handleParse);
app.post('/parse', handleParse);
app.get('/', (req, res) => res.send("Міст Playwright для Google Sheets працює на Render.com! 🚀"));

// Render.com автоматично передає порт у змінну оточення process.env.PORT
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => { 
    console.log(`🚀 Сервер автоматизації Playwright запущено на порту ${PORT}`); 
});
