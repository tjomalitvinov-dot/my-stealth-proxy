const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const path = require('path');

puppeteer.use(StealthPlugin());
const app = express();

const handleParse = async (req, res) => {
    const targetUrl = req.query.url || req.body?.url;
    if (!targetUrl) return res.status(400).send("ОШИБКА: Пропущен параметр url!");
    
    console.log(`📡 [INTERTOYS КОНВЕЙЕР] Запуск нативного Chrome для: ${targetUrl}`);
    let browser = null;
    
    try {
        // Абсолютный вектор до нашего локально скачанного Хрома внутри папки проекта
        const localChromePath = path.join(__dirname, '.puppeteer_cache', 'chrome', 'linux-127.0.6533.88', 'chrome-linux64', 'chrome');
        
        browser = await puppeteer.launch({ 
            headless: true, 
            executablePath: localChromePath, // Железная привязка к локальной папке проекта!
            args: [
                '--no-sandbox', 
                '--disable-setuid-sandbox', 
                '--disable-blink-features=AutomationControlled',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--mute-audio'
            ] 
        });
        
        const page = await browser.newPage();
        
        // === ЖЕСТКАЯ No-Code ДИЕТА: Запрещаем Хрому качать картинки и стили, спасая 512МБ RAM ===
        await page.setRequestInterception(true);
        page.on('request', (request) => {
            if (['image', 'stylesheet', 'font', 'media', 'svg'].includes(request.resourceType())) {
                request.abort();
            } else {
                request.continue();
            }
        });

        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
        await page.setDefaultNavigationTimeout(40000);
        
        // Летим на сайт Intertoys напрямую без единого прокси!
        await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
        await new Promise(resolve => setTimeout(resolve, 3500)); // Небольшая пауза для прогрузки текста
        
        const cleanHtmlOutput = await page.content();
        
        res.setHeader('Content-Type', 'text/html; charset=UTF-8');
        return res.send(cleanHtmlOutput);
        
    } catch (error) { 
        console.error("❌ Крах нативного Puppeteer: " + error.message);
        res.setHeader('Content-Type', 'text/plain; charset=UTF-8');
        return res.status(500).send(`[ОТЧЕТ КРАХА] Сбой Хрома на сервере Render: ${error.message}`);
    }
    finally { if (browser !== null) await browser.close(); }
};

app.get('/parse', handleParse);
app.post('/parse', express.json(), handleParse);

const PORT = process.env.PORT || 7860;
app.listen(PORT, () => { console.log(`🚀 Нативный Chrome-шлюз Intertoys успешно запущен на порту ${PORT}`); });


