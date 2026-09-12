const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());
const app = express();
app.use(express.json());

const proxyList = [
    'http://45.152.188.243:3128',
    'http://185.162.229.42:3128',
    'http://81.94.156.46:8080',
    'http://95.214.55.234:3128',
    'http://194.67.212.182:3128'
];

app.get('/parse', async (req, res) => {
    const targetUrl = req.query.url;
    if (!targetUrl) return res.status(400).json({ error: "Параметр URL отсутствует" });

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
        res.setHeader('Content-Type', 'text/html');
        return res.send(cleanHtmlOutput);

    } catch (error) {
        return res.status(500).json({ error: error.message });
    } finally {
        if (browser !== null) await browser.close();
    }
});

const PORT = process.env.PORT || 7860;
app.listen(PORT, () => { console.log(`🚀 Сервер запущен на порту ${PORT}`); });
