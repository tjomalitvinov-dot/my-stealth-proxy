const express = require('express');
const { chromium } = require('playwright-extra');
const stealthPlugin = require('puppeteer-extra-plugin-stealth');

// Активируем маскировку под реального пользователя
chromium.use(stealthPlugin());

const app = express();
app.use(express.json());

// ТВОЙ ОРИГИНАЛЬНЫЙ ТЕКСТОВЫЙ СПИСОК ПРОКСИ
const myRawProxyList = [
    "34.220.80.147	12345	US	United States	elite proxy	no	yes	17 secs ago",
    "195.114.209.50	80	ES	Spain	elite proxy	no	no	17 secs ago",
    "47.85.161.37	3128	US	United States	elite proxy	no	no	17 secs ago",
    "104.225.220.233	80	US	United States	elite proxy		no	17 secs ago",
    "51.75.206.209	80	FR	France	elite proxy	no	no	17 secs ago",
    "103.65.237.92	5678	ID	Indonesia	anonymous		no	17 secs ago",
    "58.187.104.62	2113	VN	Vietnam	elite proxy	no	yes	17 secs ago",
    "47.79.78.59	18080	HK	Hong Kong	elite proxy		no	17 secs ago",
    "165.154.162.73	8888	US	United States	elite proxy	no	yes	17 secs ago",
    "114.111.151.41	80	AU	Australia	elite proxy		no	17 secs ago",
    "69.87.216.54	7989	US	United States	elite proxy	yes	yes	17 secs ago",
    "73.162.86.230	443	US	United States	anonymous	no	yes	17 secs ago",
    "194.163.175.167	40000	FR	France	elite proxy		no	17 secs ago",
    "107.150.41.226	18080	US	United States	elite proxy	no	yes	17 secs ago",
    "47.91.104.88	3128	AE	United Arab Emirates	elite proxy		no	17 secs ago",
    "91.103.120.48	80	HK	Hong Kong	anonymous	no	no	17 secs ago",
    "8.215.112.214	7777	ID	Indonesia	elite proxy	no	yes	17 secs ago",
    "8.215.112.240	7777	ID	Indonesia	elite proxy	no	yes	17 secs ago",
    "14.251.13.20	8080	VN	Vietnam	elite proxy	yes	yes	17 secs ago",
    "103.237.102.191	11111	DE	Germany	elite proxy	no	yes	17 secs ago",
    "166.1.61.57	1080	JP	Japan	elite proxy		no	17 secs ago",
    "14.161.10.46	80	VN	Vietnam	anonymous	no	no	17 secs ago",
    "69.48.201.94	80	US	United States	elite proxy		no	17 secs ago",
    "47.81.56.193	8888	TH	Thailand	elite proxy	yes	yes	17 secs ago",
    "39.109.113.97	4090	HK	Hong Kong	anonymous		no	17 secs ago",
    "5.42.127.131	80	DE	Germany	anonymous		no	17 secs ago",
    "34.134.231.117	3129	US	United States	anonymous	no	yes	17 secs ago",
    "47.237.138.184	3128	SG	Singapore	elite proxy		no	17 secs ago",
    "197.221.240.247	80	ZW	Zimbabwe	anonymous		no	17 secs ago",
    "176.99.134.183	8090	RU	Russian Federation	elite proxy		no	17 secs ago",
    "45.194.41.141	8080	IN	India	anonymous		no	17 secs ago",
    "46.47.197.210	3128	RU	Russian Federation	elite proxy	no	no	17 secs ago",
    "219.93.101.63	80	MY	Malaysia	anonymous	no	no	17 secs ago",
    "219.93.101.62	80	MY	Malaysia	anonymous	no	no	17 secs ago",
    "5.45.126.128	8080	EE	Estonia	anonymous	no	no	17 secs ago",
    "8.219.97.248	80	SG	Singapore	anonymous	no	no	17 secs ago",
    "197.255.126.69	80	GH	Ghana	elite proxy		no	24 secs ago",
    "54.238.38.227	8080	JP	Japan	elite proxy	no	yes	1 min ago"
];

// Улучшенная функция парсинга: теперь она вытаскивает IP, ПОРТ и КОД СТРАНЫ (DE, FR, US...)
const parseRawInputList = (linesArray) => {
    let cleanList = [];
    linesArray.forEach(line => {
        // Регулярка теперь ищет IP, Порт и следующий за ними двухбуквенный код страны
        const match = line.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\s+(\d{2,5})\s+([A-Z]{2})/);
        if (match) {
            const ip = match[1];
            const port = match[2];
            const country = match[3].toLowerCase();
            
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

// Функция для подбора локали и таймзоны под страну прокси
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

    console.log(`📡 Запуск браузерного перебора для: ${targetUrl}`);

    // Перебираем прокси из списка по очереди
    for (let i = 0; i < processedProxies.length; i++) {
        const currentProxy = processedProxies[i];
        const geoSettings = getLocaleSettings(currentProxy.country);
        
        console.log(`🔄 Попытка №${i + 1}/${processedProxies.length} через Браузер. ГЕО: [${currentProxy.country.toUpperCase()}], IP: ${currentProxy.ipPort}`);
        
        let browser = null;
        try {
            // Запускаем инстанс браузера под конкретный прокси
            browser = await chromium.launch({
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-blink-features=AutomationControlled'
                ],
                proxy: { server: `http://${currentProxy.ipPort}` }
            });

            // Настраиваем отпечаток системы под ГЕО текущего прокси
            const context = await browser.newContext({
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                locale: geoSettings.locale,
                timezoneId: geoSettings.tz,
                viewport: { width: 1280, height: 720 }
            });

            const page = await context.newPage();
            
            // Ставим жесткий таймаут на загрузку страницы через бесплатный прокси (6 секунд)
            await page.goto(targetUrl, { 
                waitUntil: 'domcontentloaded', 
                timeout: 6000 
            });

            // Вытаскиваем готовый отрендеренный HTML
            const content = await page.content();

            if (content && content.length > 5000 && !content.includes('Access Denied')) {
                renderedHtmlOutput = content;
                console.log(`✅ УСПЕХ! Страница полностью отрендерена через IP: ${currentProxy.ipPort}`);
                await browser.close();
                break; // Выходим из цикла, цель достигнута
            } else {
                throw new Error("Заблокировано защитой сайта или пустой ответ");
            }

        } catch (error) {
            console.error(`❌ Сбой прокси ${currentProxy.ipPort}: ${error.message}`);
            badProxiesReport.push({ ip: currentProxy.ipPort, error: error.message });
        } finally {
            if (browser) await browser.close();
        }
    }

    // Если ни один прокси из списка не смог загрузить сайт
    if (!renderedHtmlOutput) {
        res.setHeader('Content-Type', 'text/html; charset=UTF-8');
        let errorHtml = `<h1>❌ Все прокси из твоего списка не смогли отрендерить страницу!</h1><h3>Отчет:</h3><ul>`;
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
    console.log(`🚀 Высокоскоростной браузерный мост запущен на порту ${PORT}`); 
});


