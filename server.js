const express = require('express');
const { chromium } = require('playwright-extra');
const stealthPlugin = require('puppeteer-extra-plugin-stealth');

// Включаем максимальную маскировку браузера
chromium.use(stealthPlugin());

const app = express();
app.use(express.json());

const handleParse = async (req, res) => {
    const targetUrl = req.query.url || req.body?.url;
    if (!targetUrl) return res.status(400).send("<h1>Помилка: Параметр url не знайдено!</h1>");

    console.log(`📡 [НАШ STEALTH-МОСТ] Запит до: ${targetUrl}`);
    const scraperApiKey = process.env.SCRAPER_API_KEY;

    let browser = null;
    try {
        let proxySettings = undefined;
        
        if (scraperApiKey && scraperApiKey !== "undefined" && scraperApiKey !== "") {
            console.log("🔑 Активація резидентного шлюзу Німеччини (DE) через ScraperAPI...");
            
            // ВАЖНО: Передаем параметры резидентской сети прямо в строку юзернейма!
            // render=true заставляет ScraperAPI использовать чистые Residential IP
            // country_code=de жестко фиксирует выход через Германию
            proxySettings = {
                server: 'http://scraperapi.com',
                username: `scraperapi.render=true.country_code=de`, 
                password: scraperApiKey
            };
        } else {
            console.warn("⚠️ Токен SCRAPER_API_KEY порожній! Запит йде через прямий IP хостинга Render.");
        }

        browser = await chromium.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-blink-features=AutomationControlled',
                '--lang=de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7' // Немецкий язык браузера
            ],
            proxy: proxySettings
        });

        // Создаем чистый контекст европейского пользователя
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
            locale: 'de-DE',
            timezoneId: 'Europe/Berlin', // Немецкая таймзона
            viewport: { width: 1440, height: 900 },
            extraHTTPHeaders: {
                'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8'
            }
        });

        const page = await context.newPage();

        await page.addInitScript(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            window.navigator.chrome = { runtime: {}, loadTimes: function() {}, csi: function() {}, app: {} };
        });

        console.log(`🚀 Завантаження сторінки через німецький резидентний тоннель...`);
        
        // Переходим на сайт и ждем полной загрузки структуры документа
        await page.goto(targetUrl, { 
            waitUntil: 'domcontentloaded', 
            timeout: 60000 // Даем 60 секунд на прохождение тяжелого Cloudflare
        });

        // Обязательная пауза 5 секунд, чтобы подгрузились динамические цены в евро
        console.log(`⏳ Stealth-пауза для генерації цін...`);
        await page.waitForTimeout(5000);

        const content = await page.content();
        
        if (content.includes('Access Denied') || content.includes('403 Forbidden')) {
            throw new Error("Блокування Cloudflare. Спробуйте оновити токен або змінити провайдера.");
        }

        // Техническая проверка: видит ли наш сервер теперь цену в евро
        if (content.includes('site-currency-attention') || content.includes('data-price')) {
            console.log(`✅ ІДЕАЛЬНО! Ціни знайдені в HTML коді.`);
        } else {
            console.warn("⚠️ Попередження: Ціна не знайдена в HTML коді. Можливо, сайт змінив верстку.");
        }

        console.log(`✅ УСПІХ! HTML відправлено в Google Таблицю. Довжина: ${content.length}`);
        res.setHeader('Content-Type', 'text/html; charset=UTF-8');
        return res.send(content);

    } catch (error) {
        console.error(`❌ Критична помилка: ${error.message}`);
        res.setHeader('Content-Type', 'text/html; charset=UTF-8');
        return res.status(502).send(`<h1>🚨 Помилка мікросервісу Render: ${error.message}</h1>`);
    } finally {
        if (browser) await browser.close();
    }
};

app.get('/parse', handleParse);
app.post('/parse', handleParse);
app.get('/', (req, res) => res.send("Наш покращений Резидентний Stealth-міст працює! 🚀"));

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Сервер запущено на порту ${PORT}`));
