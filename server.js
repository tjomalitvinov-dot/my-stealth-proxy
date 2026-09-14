const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());
const puppeteerCore = require('puppeteer-core');
const app = express();

const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, Gecko) Chrome/128.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, Gecko) Chrome/128.0.0.0 Safari/537.36'
];

// Функция, которая на лету чистит твой скопированный список от мусора
const parseRawInputList = (linesArray) => {
    let cleanList = [];
    linesArray.forEach(line => {
        // Ищем регуляркой классический формат IP:Порт в начале или середине строки
        const match = line.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\s*[\s\t:]\s*(\d{2,5})/);
        if (match) {
            const ip = match[1];
            const port = match[2];
            // Игнорируем технические заглушки вроде локалхоста
            if (ip !== '0.0.0.0' && ip !== '127.0.0.7') {
                cleanList.push(`${ip}:${port}`);
            }
        }
    });
    return cleanList;
};

const handleParse = async (req, res) => {
    const targetUrl = req.query.url || req.body?.url;
    if (!targetUrl) return res.status(400).send("<h1>Ошибка: Параметр ?url= не найден!</h1>");
    
    console.log(`📡 Заходим на живой сайт: ${targetUrl}`);
    
    // СЮДА ТЫ ПРОСТО ВСТАВЛЯЕШЬ СВОЙ СПИСОК «КАК ЕСТЬ» ИЗ ТЕКСТОВОГО ФАЙЛА
    const myRawProxyList = [
        "156.38.112.11	80	GH	Ghana	elite proxy	no	no	25 secs ago",
        "109.199.119.160	80	FR	France	anonymous	no	no	25 secs ago",
        "162.214.74.29	3128	US	United States	anonymous	no	no	25 secs ago",
        "80.74.54.148	3128	DE	Germany	anonymous	no	no	25 secs ago",
        "162.214.159.94	3128	US	United States	anonymous	no	no	25 secs ago",
        "167.234.251.155	8880	BR	Brazil	anonymous	no	no	25 secs ago",
        "8.215.25.3	2080	ID	Indonesia	elite proxy	no	no	25 secs ago",
        "167.99.236.14	80	US	United States	elite proxy	no	no	25 secs ago",
        "195.26.224.135	80	NL	Netherlands	anonymous	no	no	25 secs ago",
        "163.172.53.142	80	FR	France	elite proxy	no	no	25 secs ago",
        "149.248.18.106	8118	US	United States	elite proxy	yes	yes	25 secs ago",
        "103.237.102.191	11111	DE	Germany	elite proxy	yes	yes	25 secs ago",
        "158.179.58.126	3128	DE	Germany	anonymous		no	1 min ago",
        "45.10.163.12	80	DE	Germany	elite proxy		no	1 min ago",
        "185.21.8.66	1080	DE	Germany	anonymous		yes	1 min ago"
    ];
    
    // Запускаем парсер строк, получаем массив чистого вида ["IP:Порт", "IP:Порт"]
    const processedProxies = parseRawInputList(myRawProxyList);
    console.log(`🤖 Успешно распознано ${processedProxies.length} тестовых прокси для проверки.`);

    let badProxiesReport = [];
    let cleanHtmlOutput = null;

    // Скрипт по очереди крутит твой личный список
    for (let i = 0; i < processedProxies.length; i++) {
        const currentProxy = processedProxies[i];
        const proxyServerUrl = "http://" + currentProxy;
        let browser = null;

        console.log(`🔄 Попытка №${i + 1}/${processedProxies.length}. Тест Chrome через прокси: ${proxyServerUrl}`);
        
        try {
            const selectedUA = userAgents[Math.floor(Math.random() * userAgents.length)];

            browser = await puppeteerCore.launch({ 
                executablePath: '/usr/bin/google-chrome-stable', 
                headless: true, 
                args: [
                    '--no-sandbox', 
                    '--disable-setuid-sandbox', 
                    `--proxy-server=${proxyServerUrl}`,
                    '--disable-dev-shm-usage', 
                    '--disable-gpu',
                    '--start-maximized',
                    '--single-process', 
                    '--no-zygote',
                    '--lang=de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7' // Для LEGO лучше слать европейский язык
                ] 
            });
            
            const page = await browser.newPage();
            await page.setUserAgent(selectedUA);
            await page.setViewport({ width: 1440, height: 900 });
            
            await page.setExtraHTTPHeaders({
                'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Upgrade-Insecure-Requests': '1'
            });
            
            // Ставим 6 секунд таймаута на бесплатный прокси. Если за 6 сек страница не ответила — берем следующий IP
            await page.setDefaultNavigationTimeout(6000); 
            
            await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
            
            cleanHtmlOutput = await page.content();
            
            // Проверяем на жесткие маркеры блокировок
            if (cleanHtmlOutput.includes('403 Forbidden') || cleanHtmlOutput.includes('Access Denied') || cleanHtmlOutput.length < 900) {
                throw new Error("Сайт заблокировал бесплатный дата-центровый IP (Код 403 / Заглушка)");
            }

            console.log(`✅ Победили! Страница успешно скачана через живой IP: ${proxyServerUrl}`);
            await browser.close();
            break; 

        } catch (error) {
            console.error(`❌ Сбой ноды ${proxyServerUrl}: ${error.message}`);
            badProxiesReport.push({ ip: proxyServerUrl, error: error.message });
        } finally {
            if (browser !== null) {
                try { await browser.close(); } catch (e) {}
            }
        }
    }

    if (!cleanHtmlOutput) {
        res.setHeader('Content-Type', 'text/html; charset=UTF-8');
        let errorHtml = `<h1>❌ Все тестовые прокси из твоего списка не смогли пробить сайт!</h1><h3>Отчет перебора:</h3><ul>`;
        badProxiesReport.forEach(item => {
            errorHtml += `<li><b>${item.ip}</b> — <span style="color:red;">${item.error}</span></li>`;
        });
        errorHtml += `</ul>`;
        return res.status(502).send(errorHtml);
    }

    res.setHeader('Content-Type', 'text/html; charset=UTF-8');
    return res.send(cleanHtmlOutput);
};

app.get('/parse', handleParse);
app.post('/parse', express.json(), handleParse);

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => { console.log(`🚀 Тестовый всеядный конвейер запущен на порту ${PORT}`); });
