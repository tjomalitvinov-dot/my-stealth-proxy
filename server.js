const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());
const app = express();

const handleParse = async (req, res) => {
    const targetUrl = req.query.url || req.body?.url;
    if (!targetUrl) return res.status(400).send("<h1>Ошибка: Параметр ?url= не найден!</h1>");
    console.log(`📡 [ЧИСТЫЙ STEALTH КАНАЛ] Заходим на сайт БЕЗ IP: ${targetUrl}`);
    
    let browser = null;
    try {
        browser = await puppeteer.launch({ 
            headless: true, 
            executablePath: '/usr/bin/google-chrome', // Твой проверенный Docker-путь к Chrome
            args: [
                '--no-sandbox', 
                '--disable-setuid-sandbox', 
                '--disable-blink-features=AutomationControlled', 
                '--disable-dev-shm-usage', 
                '--disable-gpu',
                '--accept-lang=de-DE,de;q=0.9,en-US;q=0.8' // Немецкая локаль на родном канале Render
            ] 
        });
        const page = await browser.newPage();
        
        // === МОДИФИЦИРОВАННАЯ ДИЕТА: Стили (stylesheet) НЕ БЛОКИРУЕМ! ===
        // Они жизненно необходимы сайту LEGO, чтобы отработал скрипт __NEXT_DATA__
        await page.setRequestInterception(true);
        page.on('request', (request) => {
            if (['image', 'font', 'media', 'svg'].includes(request.resourceType())) {
                request.abort();
            } else {
                request.continue();
            }
        });
        
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
        await page.evaluateOnNewDocument(() => { Object.defineProperty(navigator, 'webdriver', { get: () => undefined }); });
        
        await page.setDefaultNavigationTimeout(50000);
        
        // Ждем полной прогрузки сетевых скриптов 'networkidle2' вместо domcontentloaded!
        console.log("🚀 Переход на страницу и ожидание networkidle2...");
        await page.goto(targetUrl, { waitUntil: 'networkidle2' });
        
        // Даем фиксационную паузу 5 секунд, чтобы React гарантированно разложил стейты цен
        console.log("⏳ Фиксационная stealth-пауза 5 секунд...");
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        const cleanHtmlOutput = await page.content();
        
        // Проверка в лог Render
        if (cleanHtmlOutput.includes('__NEXT_DATA__')) {
            console.log("✅ ИДЕАЛЬНО! Тег __NEXT_DATA__ успешно сгенерирован в коде страницы.");
        } else {
            console.warn("⚠️ Предупреждение: __NEXT_DATA__ не найден в HTML-коде.");
        }

        res.setHeader('Content-Type', 'text/html; charset=UTF-8');
        return res.send(cleanHtmlOutput);

    } catch (error) { 
        console.error("Сбой Puppeteer: " + error.message);
        return res.status(500).send(`<h1>Ошибка маскированного браузера: ${error.message}</h1>`); 
    } finally { 
        if (browser !== null) await browser.close(); 
    }
};

app.get('/parse', handleParse);
app.post('/parse', express.json(), handleParse);

const PORT = process.env.PORT || 10000; // Настраиваем под стандартный порт Render
app.listen(PORT, () => { console.log(`🚀 Бессмертный конвейер БЕЗ IP запущен на порту ${PORT}`); });

