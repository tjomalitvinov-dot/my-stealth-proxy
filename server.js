const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());
const app = express();

// Поддерживаем оба метода сразу для максимальной универсальности!
const handleParse = async (req, res) => {
    // Умный поиск: берем URL либо из GET-параметров (?url=), либо из POST-тела пакета!
    const targetUrl = req.query.url || req.body?.url;
    
    if (!targetUrl) {
        return res.status(400).send("<h1>Ошибка: Параметр ?url= отсутствует в запросе!</h1>");
    }

    console.log(`📡 Боевой перехват URL в стиле ZenRows: ${targetUrl}`);
    
    const proxyList = [
        'http://45.152.188.243:3128',
        'http://185.162.229.42:3128',
        'http://81.94.156.46:8080',
        'http://95.214.55.234:3128',
        'http://194.67.212.182:3128'
    ];
    const randomProxy = proxyList[Math.floor(Math.random() * proxyList.length)];
    let browser = null;

    try {
        browser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                `--proxy-server=${randomProxy}`,
                '--disable-blink-features=AutomationControlled'
            ]
        });

        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        await page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        });

        await page.goto(targetUrl, { waitUntil: 'networkidle2' });
        await new Promise(resolve => setTimeout(resolve, 3500));

        const cleanHtmlOutput = await page.content();
        res.setHeader('Content-Type', 'text/html; charset=UTF-8');
        return res.send(cleanHtmlOutput);

    } catch (error) {
        return res.status(500).send(`<h1>Ошибка Puppeteer: ${error.message}</h1>`);
    } finally {
        if (browser !== null) await browser.close();
    }
};

// Твой сервер теперь одинаково мощно отвечает и на GET, и на POST роуты!
app.get('/parse', handleParse);
app.post('/parse', express.json(), handleParse);

const PORT = process.env.PORT || 7860;
app.listen(PORT, () => { console.log(`🚀 Канонический ZenRows-клон запущен на порту ${PORT}`); });

