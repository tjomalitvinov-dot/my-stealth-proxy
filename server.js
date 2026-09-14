const express = require('express');
const { chromium } = require('playwright-extra');
const stealthPlugin = require('puppeteer-extra-plugin-stealth');

// Подключаем Stealth-плагин для обхода детекта автоматизации
chromium.use(stealthPlugin());

const app = express();
app.use(express.json());

const handleParse = async (req, res) => {
    const targetUrl = req.query.url || req.body?.url;
    // Пример формата: http://username:password@ip:port
    const proxyString = req.query.proxy || req.body?.proxy; 
    // Предпочитаемый язык, например: de-DE, fr-FR, zh-CN
    const locale = req.query.locale || req.body?.locale || 'de-DE'; 

    if (!targetUrl) {
        return res.status(400).send("<h1>Ошибка: Параметр ?url= не найден!</h1>");
    }

    console.log(`🌐 Запуск браузерного рендеринга для: ${targetUrl}`);
    let browser = null;

    try {
        // Конфигурация прокси, если передан в запросе
        const launchOptions = {
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-blink-features=AutomationControlled'
            ]
        };

        if (proxyString) {
            // Парсим строку прокси формата http://user:pass@ip:port
            try {
                const urlToken = new URL(proxyString);
                launchOptions.proxy = {
                    server: `${urlToken.protocol}//${urlToken.host}`,
                    username: urlToken.username || undefined,
                    password: urlToken.password || undefined
                };
                console.log(`🛰 Используем прокси: ${urlToken.host}`);
            } catch (e) {
                console.error("❌ Ошибка парсинга прокси-строки, запускаем без прокси");
            }
        }

        // Запуск скрытого браузера
        browser = await chromium.launch(launchOptions);
        
        // Создаем контекст с эмуляцией локали и таймзоны под ГЕО прокси
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            locale: locale,
            timezoneId: locale.startsWith('de') ? 'Europe/Berlin' : locale.startsWith('fr') ? 'Europe/Paris' : 'Asia/Shanghai',
            viewport: { width: 1920, height: 1080 }
        });

        const page = await context.newPage();
        
        // Переходим на сайт и ждем полной загрузки DOM и сети
        await page.goto(targetUrl, { 
            waitUntil: 'networkidle', 
            timeout: 30000 
        });

        // Извлекаем отрендеренный HTML со всеми скриптами
        const renderedHtml = await page.content();

        res.setHeader('Content-Type', 'text/html; charset=UTF-8');
        return res.send(renderedHtml);

    } catch (error) {
        console.error(`❌ Ошибка рендеринга страницы: ${error.message}`);
        return res.status(502).send(`<h1>Ошибка рендеринга:</h1><p>${error.message}</p>`);
    } finally {
        if (browser) {
            await browser.close();
        }
    }
};

app.get('/parse', handleParse);
app.post('/parse', handleParse);

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => { 
    console.log(`🚀 Браузерный TLS-мост (Playwright Stealth) запущен на порту ${PORT}`); 
});



