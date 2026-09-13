const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const path = require('path');

puppeteer.use(StealthPlugin());
const app = express();

const handleParse = async (req, res) => {
    const targetUrl = req.query.url || req.body?.url;
    if (!targetUrl) return res.status(400).send("ОШИБКА: Пропущен параметр url!");
    
    console.log(`📡 [ДИАГНОСТИЧЕСКИЙ ТЕСТ] Проверяем Conrad для: ${targetUrl}`);
    let browser = null;
    
    try {
        const localChromePath = path.join(__dirname, '.puppeteer_cache', 'chrome', 'linux-127.0.6533.88', 'chrome-linux64', 'chrome');
        
        browser = await puppeteer.launch({ 
            headless: true, 
            executablePath: localChromePath,
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
        
        // Жесткая диета для ОЗУ: блокируем картинки и тяжелые стили
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
        
        const response = await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
        const httpStatus = response ? response.status() : "Unknown";
        
        await new Promise(resolve => setTimeout(resolve, 3500)); 
        const cleanHtmlOutput = await page.content();
        
        // =========================================================================
        // МГНОВЕННЫЙ ТЕСТ ЗАГРУЗКИ И ПОИСК СЛЕДОВ ДАННЫХ
        // =========================================================================
        const htmlLength = cleanHtmlOutput.length;
        const hasInitialState = cleanHtmlOutput.includes('__INITIAL_STATE__');
        const hasPriceWord = cleanHtmlOutput.toLowerCase().includes('price');
        const hasPriceWithVat = cleanHtmlOutput.includes('priceWithVat');
        
        const titleMatch = cleanHtmlOutput.match(/<title>([^<]+)<\/title>/i);
        const pageTitle = titleMatch ? titleMatch[1] : "Заголовок не найден";

        console.log(`📊 [АНАЛИЗ] Длина: ${htmlLength} симв. | State: [${hasInitialState}] | priceWithVat: [${hasPriceWithVat}]`);

        // ХАКЕРСКИЙ ТЕСТ: Если регулярка на листе "Sources" выдаст EMPTY_DATA, давай принудительно проверим код
        // Если в коде нет явного маркера цены, отдаем плоский ТЕКСТОВЫЙ отчет, который Apps Script выведет целиком!
        if (!hasPriceWithVat || htmlLength < 10000) {
            res.setHeader('Content-Type', 'text/plain; charset=UTF-8');
            return res.status(500).send(`[ОТЧЕТ РЕНТГЕНА] Страница загружена! HTTP Код: ${httpStatus} | Длина HTML: ${htmlLength} симв.\nЗаголовок <title>: "${pageTitle}"\nНаличие '__INITIAL_STATE__': [${hasInitialState}]\nНаличие слова 'priceWithVat': [${hasPriceWithVat}]\nНаличие слова 'price' вообще: [${hasPriceWord}]\n\n=== СРЕЗ ПЕРВЫХ 1500 СИМВОЛОВ HTML-КОДЫ СТРАНИЦЫ ===\n${cleanHtmlOutput.substring(0, 1500)}`);
        }
        
        // Если маркер на месте, отдаем чистый HTML в твою таблицу для твоей функции regex
        res.setHeader('Content-Type', 'text/html; charset=UTF-8');
        return res.send(cleanHtmlOutput);
        
    } catch (error) { 
        console.error("❌ Крах: " + error.message);
        res.setHeader('Content-Type', 'text/plain; charset=UTF-8');
        return res.status(500).send(`[КРИТИЧЕСКИЙ СБОЙ ХРОМА] Ошибка сервера Render: ${error.message}`);
    }
    finally { if (browser !== null) await browser.close(); }
};

app.get('/parse', handleParse);
app.post('/parse', express.json(), handleParse);

const PORT = process.env.PORT || 7860;
app.listen(PORT, () => { console.log(`🚀 Диагностический шлюз Conrad запущен на порту ${PORT}`); });


