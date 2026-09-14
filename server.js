const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());
const puppeteerCore = require('puppeteer-core');
const app = express();

const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
];

const handleParse = async (req, res) => {
    const targetUrl = req.query.url || req.body?.url;
    if (!targetUrl) return res.status(400).send("<h1>Ошибка: Параметр ?url= не найден!</h1>");
    
    console.log(`📡 [RENDER ENGINE] Запуск Хрома для пробития цены: ${targetUrl}`);
    let browser = null;
    
    try {
        const selectedUA = userAgents[0];

        browser = await puppeteerCore.launch({ 
            executablePath: '/usr/bin/google-chrome-stable', 
            headless: true, 
            args: [
                '--no-sandbox', 
                '--disable-setuid-sandbox', 
                '--disable-dev-shm-usage', 
                '--disable-gpu',
                '--single-process', 
                '--no-zygote',
                '--lang=de-DE,de;q=0.9'
            ] 
        });
        
        const page = await browser.newPage();
        
        // Маскировка под реального пользователя
        await page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        });

        await page.setUserAgent(selectedUA);
        await page.setViewport({ width: 1440, height: 900 });

        // ХАКЕРСКИЙ ПРОРЫВ: Открываем домен LEGO и принудительно закидываем куки локализации DE
        // Это уберет любые баннеры выбора стран и согласия куки!
        await page.goto('https://lego.com', { waitUntil: 'domcontentloaded' }).catch(() => {});
        await page.setCookie(
            { name: 'LegoRegionCode', value: 'DE', domain: '.lego.com', path: '/' },
            { name: 'LEGO_COUNTRY', value: 'DE', domain: '.lego.com', path: '/' },
            { name: 'LegoCookieConsent', value: '{"necessary":true,"marketing":true,"analytics":true}', domain: '.lego.com', path: '/' }
        );

        // Ставим таймаут 25 секунд, чтобы Хром на бесплатном Render успел прожевать JS
        await page.setDefaultNavigationTimeout(25000); 
        
        // Заходим на целевую страницу товара. Ждем networkidle2 (пока затихнут аякс-запросы цен)
        await page.goto(targetUrl, { waitUntil: 'networkidle2' });
        
        // Мягкий скролл вниз, чтобы триггернуть ленивую загрузку цен, если она есть
        await page.evaluate(() => { window.scrollBy(0, 400); });
        await new Promise(resolve => setTimeout(resolve, 3000)); // Жестко ждем 3 секунды финализации рендеринга
        
        const cleanHtmlOutput = await page.content();
        
        res.setHeader('Content-Type', 'text/html; charset=UTF-8');
        return res.send(cleanHtmlOutput);

    } catch (error) {
        console.error(`❌ Сбой рендеринга на Render: ${error.message}`);
        res.setHeader('Content-Type', 'text/html; charset=UTF-8');
        return res.status(500).send(`<h1>Ошибка рендеринга шлюза: ${error.message}</h1>`); 
    } finally {
        if (browser !== null) {
            try { await browser.close(); } catch (e) {}
        }
    }
};

app.get('/parse', handleParse);
app.post('/parse', express.json(), handleParse);

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => { console.log(`🚀 Доработанный Puppeteer-шлюз запущен на порту ${PORT}`); });



