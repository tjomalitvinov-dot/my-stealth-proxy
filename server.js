const express = require('express');
const { chromium } = require('playwright-extra');
const stealthPlugin = require('puppeteer-extra-plugin-stealth');

chromium.use(stealthPlugin());

const app = express();
app.use(express.json());

const handleParse = async (req, res) => {
    const targetUrl = req.query.url || req.body?.url;
    if (!targetUrl) return res.status(400).send("<h1>Помилка: Параметр url не знайдено!</h1>");

    console.log(`📡 [Експрес Stealth] Запит до: ${targetUrl}`);
    const scraperApiKey = process.env.SCRAPER_API_KEY;

    let browser = null;
    try {
        let proxySettings = undefined;
        if (scraperApiKey && scraperApiKey !== "undefined" && scraperApiKey !== "") {
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

        // ⚡ АГРЕСИВНЕ БЛОКУВАННЯ РЕКЛАМИ: Вирізаємо все, крім чистого документа сторінки
        await page.route('**/*', (route) => {
            const type = route.request().resourceType();
            if (['document', 'script'].includes(type)) {
                route.continue(); // Пропускаємо лише сам HTML та внутрішні скрипти розмітки
            } else {
                route.abort(); // Миттєво блокуємо картинки, стилі, шрифти, аналітику та банери
            }
        });

        await page.addInitScript(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        });

        console.log(`🚀 Експрес-завантаження...`);
        
        // ⚡ НАДШВИДКИЙ РЕЖИМ: Чекаємо лише відповіді сервера (commit), а не повної загрузки мережі
        await page.goto(targetUrl, { 
            waitUntil: 'commit', 
            timeout: 25000 
        });

        // Коротка stealth-пауза 2 секунди, щоб встиг відпрацювати базовий DOM
        await page.waitForTimeout(2000);

        const content = await page.content();
        
        if (content.includes('Access Denied') || content.includes('403 Forbidden')) {
            throw new Error("Заблоковано Cloudflare.");
        }

        console.log(`✅ УСПІХ! Експрес HTML отримано. Довжина: ${content.length}`);
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
app.get('/', (req, res) => res.send("Експрес Stealth-міст активовано! 🚀"));

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Сервер запущено на порту ${PORT}`));
