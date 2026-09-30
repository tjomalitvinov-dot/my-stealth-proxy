const express = require('express');
const { chromium } = require('playwright-extra');
const stealthPlugin = require('puppeteer-extra-plugin-stealth');

chromium.use(stealthPlugin());

const app = report = express();
app.use(express.json());

const handleParse = async (req, res) => {
    const targetUrl = req.query.url || req.body?.url;
    if (!targetUrl) return res.status(400).send("<h1>Помилка: Параметр url не знайдено!</h1>");

    console.log(`📡 Повноцінний рендеринг для LEGO: ${targetUrl}`);
    const scraperApiKey = process.env.SCRAPER_API_KEY;

    let browser = null;
    try {
        let proxySettings = undefined;
        if (scraperApiKey && scraperApiKey !== "undefined" && scraperApiKey !== "") {
            console.log("🔑 Підключення резидентських IP Німеччини для проходження Cloudflare Turnstile...");
            proxySettings = {
                server: 'http://scraperapi.com',
                username: 'scraperapi.country_code=de',
                password: scraperApiKey
            };
        }

        browser = await chromium.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-blink-features=AutomationControlled',
                '--lang=de-DE,de;q=0.9'
            ],
            proxy: proxySettings
        });

        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
            locale: 'de-DE',
            timezoneId: 'Europe/Berlin',
            viewport: { width: 1280, height: 720 }
        });

        const page = await context.newPage();

        // ⚡ М'ЯКА ОПТИМІЗАЦІЯ: Блокуємо ТІЛЬКИ картинки, медіа та шрифти, щоб заощадити трафік.
        // Стилі (stylesheets) та Скрипти (scripts) ми НЕ чіпаємо, вони потрібні для збирання __NEXT_DATA__!
        await page.route('**/*', (route) => {
            const type = route.request().resourceType();
            if (['image', 'media', 'font', 'analytics'].includes(type)) {
                route.abort();
            } else {
                route.continue();
            }
        });

        await page.addInitScript(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        });

        // Переходимо на сайт та чекаємо, поки завантажиться структура DOM
        await page.goto(targetUrl, { 
            waitUntil: 'domcontentloaded', 
            timeout: 60000 
        });

        // ⏳ Критично важлива stealth-пауза 5 секунд!
        // Вона дає можливість двигуну Next.js на сайті LEGO відпрацювати і згенерувати тег __NEXT_DATA__
        console.log(`⏳ Очікування генерації кешу сторінки...`);
        await page.waitForTimeout(5500);

        const content = await page.content();
        
        if (content.includes('Access Denied') || content.includes('403 Forbidden')) {
            throw new Error("Cloudflare заблокував IP-адресу.");
        }

        // Перевіряємо, чи з'явився потрібний тег у відданому коді перед відправкою
        if (!content.includes('__NEXT_DATA__')) {
            console.warn("⚠️ Увага: сторінка завантажилась, але тег __NEXT_DATA__ ще не сформований в DOM.");
        } else {
            console.log(`✅ Ідеально! Тег __NEXT_DATA__ знайдено. Довжина HTML: ${content.length}`);
        }

        res.setHeader('Content-Type', 'text/html; charset=UTF-8');
        return res.send(content);

    } catch (error) {
        console.error(`❌ Помилка мікросервісу: ${error.message}`);
        res.setHeader('Content-Type', 'text/html; charset=UTF-8');
        return res.status(502).send(`<h1>🚨 Помилка мікросервісу Render: ${error.message}</h1>`);
    } finally {
        if (browser) await browser.close();
    }
};

app.get('/parse', handleParse);
app.post('/parse', handleParse);
app.get('/', (req, res) => res.send("Stealth-міст з підтримкою Next.js працює! 🚀"));

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Сервер запущено на порту ${PORT}`));

