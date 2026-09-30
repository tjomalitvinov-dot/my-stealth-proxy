const express = require('express');
const { chromium } = require('playwright-extra');
const stealthPlugin = require('puppeteer-extra-plugin-stealth');

// Усиленное скрытие следов автоматизации браузера
chromium.use(stealthPlugin());

const app = express();
app.use(express.json());

const handleParse = async (req, res) => {
    const targetUrl = req.query.url || req.body?.url;
    if (!targetUrl) return res.status(400).send("<h1>Помилка: Параметр url не знайдено!</h1>");

    console.log(`📡 Запрос к LEGO через прокси-шлюз: ${targetUrl}`);
    
    // Считываем секретный бесплатный токен из настроек Render
    const scraperApiKey = process.env.SCRAPER_API_KEY;

    let browser = null;
    try {
        let launchArgs = [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-blink-features=AutomationControlled',
            '--lang=de-DE,de;q=0.9,en-US;q=0.8'
        ];

        // Настройка резидентного шлюза ScraperAPI через ультра-стабильный порт 8001
        let proxySettings = undefined;
        if (scraperApiKey && scraperApiKey !== "undefined" && scraperApiKey !== "") {
            console.log("🔑 Резидентный резидентный тоннель активирован. Выходим через чистую Германию (DE)...");
            proxySettings = {
                server: 'http://scraperapi.com',
                username: 'scraperapi.country_code=de', // Суровый выход через IP провайдеров Германии
                password: scraperApiKey
            };
        } else {
            console.warn("⚠️ Токен SCRAPER_API_KEY отсутствует в Render! Запрос идет напрямую через заблокированный IP хостинга.");
        }

        browser = await chromium.launch({
            headless: true,
            args: launchArgs,
            proxy: proxySettings
        });

        // Создаем чистый контекст германского Chrome
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
            locale: 'de-DE',
            timezoneId: 'Europe/Berlin', // Немецкая таймзона Берлина
            viewport: { width: 1920, height: 1080 }
        });

        const page = await context.newPage();

        await page.addInitScript(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        });

        // Увеличиваем тайм-аут загрузки тяжелого LEGO до 60 секунд (60000ms)
        console.log(`🚀 Загрузка страницы...`);
        await page.goto(targetUrl, { 
            waitUntil: 'domcontentloaded', // Ждем загрузки структуры HTML (так быстрее и надежнее)
            timeout: 60000 
        });

        // Небольшая stealth-пауза для отработки фоновых скриптов
        await page.waitForTimeout(3000);

        const content = await page.content();
        
        // Жесткая проверка на блокировку Cloudflare
        if (content.includes('Access Denied') || content.includes('403 Forbidden') || content.includes('Please turn JavaScript on')) {
            throw new Error("Cloudflare заблокировал запрос даже через резидентский IP.");
        }

        console.log(`✅ УСПЕХ! HTML код страницы успешно получен. Длина: ${content.length} симв.`);
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
app.get('/', (req, res) => res.send("Гибридный Stealth-мост для Google Sheets готов! 🚀"));

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Сервер запущен на порту ${PORT}`));
