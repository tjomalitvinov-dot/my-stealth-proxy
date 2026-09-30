const express = require('express');
const { chromium } = require('playwright-extra');
const stealthPlugin = require('puppeteer-extra-plugin-stealth');

// Максимальное скрытие следов автоматизации Playwright
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
            console.log("🔑 Активація німецького (DE) резидентного тунелю через ScraperAPI...");
            // Форсируем резидентную сеть Германии для пробива жесткого Cloudflare Turnstile
            proxySettings = {
                server: 'http://scraperapi.com',
                username: 'scraperapi.render=true.country_code=de', 
                password: scraperApiKey
            };
        } else {
            console.warn("⚠️ Токен SCRAPER_API_KEY відсутній в Render. Запит йде безпосередньо.");
        }

        browser = await chromium.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-blink-features=AutomationControlled',
                '--lang=de-DE,de;q=0.9,en-US;q=0.8' // Язык немецкого браузера
            ],
            proxy: proxySettings
        });

        // Контекст реального европейского Chrome
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
            locale: 'de-DE',
            timezoneId: 'Europe/Berlin', // Немецкая таймзона
            viewport: { width: 1440, height: 900 }
        });

        const page = await context.newPage();

        // Мягкое блокирование: убираем только тяжелые картинки, видео, шрифты и рекламу.
        // Стили (stylesheet) и Скрипты (script) ОБЯЗАТЕЛЬНО оставляем, чтобы Cloudflare прошел проверку!
        await page.route('**/*', (route) => {
            const type = route.request().resourceType();
            if (['image', 'media', 'font', 'analytics', 'google'].includes(type)) {
                route.abort(); 
            } else {
                route.continue();
            }
        });

        await page.addInitScript(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        });

        console.log(`🚀 Завантаження сторінки з проходженням перевірки ботів...`);
        
        // Переходим и ждем загрузки базовой структуры элементов (DOM)
        await page.goto(targetUrl, { 
            waitUntil: 'domcontentloaded', 
            timeout: 60000 
        });

        // Жизненно важная stealth-пауза 6 секунд, чтобы Cloudflare Turnstile успел 
        // обработать отпечатки и выдать нашему браузеру куки доступа, а сайт LEGO/Proshop отрендерил цены
        console.log(`⏳ Очікування завершення перевірки Cloudflare та генерації цін...`);
        await page.waitForTimeout(6000);

        const content = await page.content();
        
        // Жесткая проверка: если мы все еще на заглушке Cloudflare — выкидываем ошибку ротации
        if (content.includes('Sicherheitsüberprüfung') || content.includes('Access Denied') || content.includes('403 Forbidden')) {
            throw new Error("Cloudflare не пропустив браузер (застрягли на сторінці перевірки).");
        }

        console.log(`✅ УСПІХ! Сторінку повністю відрендерено. HTML відправлено в Google Таблицю. Довжина: ${content.length}`);
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
app.get('/', (req, res) => res.send("Наш покращений Резидентний Stealth-міст активовано! 🚀"));

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Сервер запущено на порту ${PORT}`));

