const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());
const app = express();
app.use(express.json());

const handleParse = async (req, res) => {
    // Поддерживаем и GET (?url=) и POST (body.url) запросы из таблицы
    const targetUrl = req.query.url || req.body?.url;
    if (!targetUrl) return res.status(400).send("<h1>Ошибка: Параметр URL отсутствует</h1>");
    
    console.log(`📡 Заходим на живой сайт под РЕНДЕР: ${targetUrl}`);

    // Твои резидентные прокси (логин и пароль вшиты в строку для стабильности на Render)
    const login = "mmnvhwqe";
    const pass = "pt6brfln6blc";
    const rawIps = [
        "31.59.20.176:6754", "45.38.107.97:6014", "64.137.96.74:6641",
        "198.23.243.226:6361", "38.154.185.97:6370", "84.247.60.125:6095",
        "142.111.67.146:5611", "191.96.254.138:6185", "31.58.9.4:6077", 
        "198.46.161.42:5092"
    ];
    
    const randomIp = rawIps[Math.floor(Math.random() * rawIps.length)];
    const proxyServerUrl = `http://${login}:${pass}@${randomIp}`;
    
    console.log(`🔄 Ротация резидентного канала. Выходим через IP: ${randomIp}`);
    let browser = null;

    try {
        browser = await puppeteer.launch({
            headless: true,
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome-stable',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                `--proxy-server=${proxyServerUrl}`,
                '--disable-blink-features=AutomationControlled',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--disable-web-security'
            ]
        });

        const page = await browser.newPage();
        
        // Авторизация на прокси
        await page.authenticate({ username: login, password: pass });
        
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        await page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        });

        await page.setDefaultNavigationTimeout(55000);

        // 🎯 ТОТ САМЫЙ РЕНДЕР ИЗ ОРИГИНАЛА (Ждем полной остановки сети)
        await page.goto(targetUrl, { waitUntil: 'networkidle2' });
        
        // Твоя оригинальная пауза 3.5 секунды (округлим до 4000 для стабильности)
        await new Promise(resolve => setTimeout(resolve, 4000));

        const cleanHtmlOutput = await page.content();
        res.setHeader('Content-Type', 'text/html; charset=UTF-8');
        return res.send(cleanHtmlOutput);

    } catch (error) {
        console.error("Сбой Puppeteer: " + error.message);
        return res.status(500).send(`<h1>Ошибка маскированного браузера: ${error.message}</h1>`);
    } finally {
        if (browser !== null) await browser.close();
    }
};

// Принимаем оба типа запросов
app.get('/parse', handleParse);
app.post('/parse', handleParse);

const PORT = process.env.PORT || 7860;
app.listen(PORT, () => { console.log(`🚀 Сервер запущен на порту ${PORT}`); });
