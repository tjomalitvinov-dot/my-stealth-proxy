const express = require('express');
const { chromium } = require('playwright-extra');
const stealthPlugin = require('puppeteer-extra-plugin-stealth');

chromium.use(stealthPlugin());

const app = express();
app.use(express.json());

const handleParse = async (req, res) => {
    const targetUrl = req.query.url || req.body?.url;
    if (!targetUrl) return res.status(400).send("<h1>Помилка: Параметр url не знайдено!</h1>");

    console.log(`📡 [НАШ STEALTH-МОСТ] Запит до: ${targetUrl}`);
    
    // Подтягиваем настройки твоего личного прокси из панели Render
    const proxyServer = process.env.MY_PROXY_SERVER; // Формат: http://ip:port
    const proxyUser = process.env.MY_PROXY_USER;     // Логин
    const proxyPass = process.env.MY_PROXY_PASS;     // Пароль

    let browser = null;
    try {
        let proxySettings = undefined;
        if (proxyServer) {
            console.log(`🔑 Підключення особистого проксі-сервера: ${proxyServer}`);
            proxySettings = {
                server: proxyServer,
                username: proxyUser || undefined,
                password: proxyPass || undefined
            };
        } else {
            console.warn("⚠️ Внимание: Прокси не задан в настройках Render! Запрос идет через прямой IP хостинга.");
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
            viewport: { width: 1440, height: 900 }
        });

        const page = await context.newPage();

        // Оставляем стили и скрипты для прохождения Turnstile
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

        console.log(`🚀 Завантаження сторінки...`);
        await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });

        // Даем 5 секунд на отработку скриптов и отрисовку цен
        await page.waitForTimeout(5000);

        const content = await page.content();
        
        if (content.includes('Sicherheitsüberprüfung') || content.includes('Access Denied') || content.includes('403 Forbidden')) {
            throw new Error("Cloudflare не пропустив браузер (застрягли на сторінці перевірки).");
        }

        console.log(`✅ УСПІХ! HTML отримано. Довжина: ${content.length}`);
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
app.get('/', (req, res) => res.send("Універсальний проксі-міст активовано! 🚀"));

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Сервер запущено на порту ${PORT}`));
