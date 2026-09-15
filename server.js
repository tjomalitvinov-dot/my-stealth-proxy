const express = require('express');
const { chromium } = require('playwright-extra');
const stealthPlugin = require('puppeteer-extra-plugin-stealth');

// Включаем маскировку под реального пользователя
chromium.use(stealthPlugin());

const app = express();
app.use(express.json());

// ТВОЙ ОРИГИНАЛЬНЫЙ ТЕКСТОВЫЙ СПИСОК ПРОКСИ
const myRawProxyList = [
    "65.20.183.178	8080	IQ	Iraq	elite proxy		no	28 secs ago",
    "104.225.220.233	80	US	United States	elite proxy		no	28 secs ago",
    "108.161.135.118	80	US	United States	elite proxy		no	28 secs ago",
    "201.222.50.218	80	PY	Paraguay	elite proxy		no	28 secs ago",
    "41.220.16.215	80	ZW	Zimbabwe	anonymous		no	28 secs ago"
];

// Парсинг: Исправлен синтаксис работы с массивом совпадений match[...]
const parseRawInputList = (linesArray) => {
    let cleanList = [];
    linesArray.forEach(line => {
        const match = line.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\s+(\d{2,5})\s+([A-Z]{2})/);
        if (match) {
            const ip = match[1];        // ИСПРАВЛЕНО: квадратные скобки вместо круглых
            const port = match[2];      // ИСПРАВЛЕНО: квадратные скобки вместо круглых
            const country = match[3].toLowerCase(); // ИСПРАВЛЕНО: квадратные скобки вместо круглых
            
            if (ip !== '0.0.0.0' && ip !== '127.0.0.7') {
                cleanList.push({
                    ipPort: `${ip}:${port}`,
                    country: country
                });
            }
        }
    });
    return cleanList;
};

const getLocaleSettings = (countryCode) => {
    switch (countryCode) {
        case 'de': return { locale: 'de-DE', tz: 'Europe/Berlin' };
        case 'fr': return { locale: 'fr-FR', tz: 'Europe/Paris' };
        case 'cn': return { locale: 'zh-CN', tz: 'Asia/Shanghai' };
        case 'ru': return { locale: 'ru-RU', tz: 'Europe/Moscow' };
        default: return { locale: 'en-US', tz: 'America/New_York' };
    }
};

const handleParse = async (req, res) => {
    const targetUrl = req.query.url || req.body?.url;
    if (!targetUrl) return res.status(400).send("<h1>Ошибка: Параметр ?url= не найден!</h1>");

    const processedProxies = parseRawInputList(myRawProxyList);
    let badProxiesReport = [];
    let renderedHtmlOutput = null;

    console.log(`📡 Запуск рендеринга Playwright для: ${targetUrl}`);

    for (let i = 0; i < processedProxies.length; i++) {
        const currentProxy = processedProxies[i];
        const geoSettings = getLocaleSettings(currentProxy.country);
        
        console.log(`🔄 Прокси №${i + 1}/${processedProxies.length} -> [${currentProxy.country.toUpperCase()}] http://${currentProxy.ipPort}`);
        
        let browser = null;
        try {
            browser = await chromium.launch({
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-blink-features=AutomationControlled'
                ],
                proxy: { server: `http://${currentProxy.ipPort}` }
            });

            const context = await browser.newContext({
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                locale: geoSettings.locale,
                timezoneId: geoSettings.tz,
                viewport: { width: 1280, height: 720 }
            });

            const page = await context.newPage();
            
            // Ставим короткий таймаут 5 секунд на один прокси
            await page.goto(targetUrl, { 
                waitUntil: 'domcontentloaded', 
                timeout: 5000 
            });

            const content = await page.content();

            if (content && content.length > 5000 && !content.includes('Access Denied') && !content.includes('403 Forbidden')) {
                renderedHtmlOutput = content;
                console.log(`✅ УСПЕХ! Страница отрендерена через IP: ${currentProxy.ipPort}`);
                await browser.close();
                break; 
            } else {
                throw new Error("Пустой ответ или бан прокси");
            }

        } catch (error) {
            console.error(`❌ Сбой прокси ${currentProxy.ipPort}: ${error.message}`);
            badProxiesReport.push({ ip: currentProxy.ipPort, error: error.message });
        } finally {
            if (browser) await browser.close();
        }
    }

    if (!renderedHtmlOutput) {
        res.setHeader('Content-Type', 'text/html; charset=UTF-8');
        let errorHtml = `<h1>❌ Ошибка: все прокси заблокированы или недоступны.</h1><h3>Лог:</h3><ul>`;
        badProxiesReport.forEach(item => {
            errorHtml += `<li><b>${item.ip}</b> — <span style="color:red;">${item.error}</span></li>`;
        });
        errorHtml += `</ul>`;
        return res.status(502).send(errorHtml);
    }

    res.setHeader('Content-Type', 'text/html; charset=UTF-8');
    return res.send(renderedHtmlOutput);
};

app.get('/parse', handleParse);
app.post('/parse', handleParse);

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => { 
    console.log(`🚀 Высокоскоростной headless-мост запущен на порту ${PORT}`); 
});
