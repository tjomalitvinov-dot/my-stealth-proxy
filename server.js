const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());
const puppeteerCore = require('puppeteer-core');
const app = express();

const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
];

const parseRawInputList = (linesArray) => {
    let cleanList = [];
    linesArray.forEach(line => {
        const match = line.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\s*[\s\t:]\s*(\d{2,5})/);
        if (match) {
            const ip = match[1];
            const port = match[2];
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
    
    console.log(`\n===============================================================`);
    console.log(`📡 [НОВЫЙ ЗАПРОС] Стартуем детальный дамп-анализ страницы!`);
    console.log(`🔗 Целевой URL: ${targetUrl}`);
    console.log(`===============================================================`);
    
    const myRawProxyList = [
        "156.38.112.11	80	GH	Ghana	elite proxy	no	no	25 secs ago",
        "109.199.119.160	80	FR	France	anonymous	no	no	25 secs ago",
        "162.214.74.29	3128	US	United States	anonymous	no	no	25 secs ago",
        "80.74.54.148	3128	DE	Germany	anonymous	no	no	25 secs ago",
        "162.214.159.94	3128	US	United States	anonymous	no	no	25 secs ago",
        "167.234.251.155	8880	BR	Brazil	anonymous	no	no	25 secs ago",
        "195.26.224.135	80	NL	Netherlands	anonymous	no	no	25 secs ago",
        "163.172.53.142	80	FR	France	elite proxy	no	no	25 secs ago",
        "149.248.18.106	8118	US	United States	elite proxy	yes	yes	25 secs ago",
        "103.237.102.191	11111	DE	Germany	elite proxy	yes	yes	25 secs ago",
        "158.179.58.126	3128	DE	Germany	anonymous		no	1 min ago",
        "45.10.163.12	80	DE	Germany	elite proxy		no	1 min ago",
        "185.21.8.66	1080	DE	Germany	anonymous		yes	1 min ago"
    ];
    
    const processedProxies = parseRawInputList(myRawProxyList);
    console.log(`🤖 [CHECKER] Распознано ${processedProxies.length} IP для циклической проверки.`);
    
    let badProxiesReport = [];
    let cleanHtmlOutput = null;

    for (let i = 0; i < processedProxies.length; i++) {
        const currentProxy = processedProxies[i];
        const proxyServerUrl = "http://" + currentProxy;
        let browser = null;

        console.log(`\n---------------------------------------------------------------`);
        console.log(`🔄 [ПОПЫТКА №${i + 1}/${processedProxies.length}] Тестируем прокси-канал: ${proxyServerUrl}`);
        console.log(`---------------------------------------------------------------`);
        
        try {
            const selectedUA = userAgents[Math.floor(Math.random() * userAgents.length)];
            console.log(`🕵️‍♂️ Генерируем фингерпринт сессии:`);
            console.log(`   - User-Agent: ${selectedUA}`);

            console.log(`⚙️ Запуск изолированного ядра Chromium внутри Docker...`);
            browser = await puppeteerCore.launch({ 
                executablePath: '/usr/bin/google-chrome-stable', 
                headless: true, 
                args: [
                    '--no-sandbox', 
                    '--disable-setuid-sandbox', 
                    `--proxy-server=${proxyServerUrl}`,
                    '--disable-dev-shm-usage', 
                    '--disable-gpu',
                    '--single-process', 
                    '--no-zygote',
                    '--lang=de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7'
                ] 
            });
            
            console.log(`📥 Открываем новую анонимную вкладку (Page)...`);
            const page = await browser.newPage();
            
            // Включаем перехват сетевых запросов с детальным логом в консоль Render
            await page.setRequestInterception(true);
            page.on('request', (request) => {
                const type = request.resourceType();
                const reqUrl = request.url();
                
                // Чтобы логи не взрывались от тысяч строк, пишем только типы
                if (['image', 'font', 'media'].includes(type)) {
                    // console.log(`   🚫 Блокируем медиа-ресурс [${type}]: ${reqUrl.substring(0, 60)}...`);
                    request.abort();
                } else {
                    // console.log(`   🟢 Пропускаем скрипт/документ [${type}]: ${reqUrl.substring(0, 60)}...`);
                    request.continue();
                }
            });

            // Логируем все ошибки JavaScript со страницы, если они возникнут
            page.on('pageerror', (err) => {
                console.log(`   ⚠️ [PAGE JS ERROR] Скрипт сайта выдал ошибку: ${err.toString()}`);
            });

            // Логируем коды ответов (HTTP Status Codes) всех подгружаемых файлов
            page.on('response', (response) => {
                if (response.url() === targetUrl) {
                    console.log(`   🚨 [HTTP STATUS] Ответ сервера LEGO для главного URL: Код ${response.status()}`);
                }
            });

            await page.setUserAgent(selectedUA);
            await page.setViewport({ width: 1280, height: 800 });
            
            console.log(`⏱ Устанавливаем лимит ожидания прокси в 10 секунд...`);
            await page.setDefaultNavigationTimeout(10000); 
            
            console.log(`📡 Команда page.goto(). Прокси начинает стучаться в шлюз сайта LEGO...`);
            await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
            console.log(`⏳ Событие DOMContentLoaded успешно поймано! Ждем жесткую паузу 4 сек...`);
            
            await new Promise(resolve => setTimeout(resolve, 4000));
            
            console.log(`📸 Извлекаем финальный слепок (snapshot) HTML кода страницы...`);
            cleanHtmlOutput = await page.content();
            
            console.log(`📊 Анализ полученного текста:`);
            console.log(`   - Длина строки контента: ${cleanHtmlOutput.length} символов.`);
            
            // Выводим в лог Render первые 300 символов, чтобы глазами увидеть теги (<html... или капчу)
            console.log(`   - Начало HTML кода (первые 300 симв): \n${cleanHtmlOutput.substring(0, 300).trim()}`);
            
            // Проверяем наличие ключевых маркеров
            const hasNextData = cleanHtmlOutput.includes('id="__NEXT_DATA__"');
            const hasCloudflare = cleanHtmlOutput.includes('cloudflare') || cleanHtmlOutput.includes('Turnstile');
            const hasAccessDenied = cleanHtmlOutput.includes('Access Denied') || cleanHtmlOutput.includes('403 Forbidden');
            
            console.log(`   - Наличие тега __NEXT_DATA__: [${hasNextData}]`);
            console.log(`   - Обнаружена защита Cloudflare: [${hasCloudflare}]`);
            console.log(`   - Обнаружена блокировка Access Denied: [${hasAccessDenied}]`);

            console.log(`✅ Сессия завершена успешно. Закрываем браузер.`);
            await browser.close();
            break; 

        } catch (error) {
            console.error(`❌ [КРАХ ПОПЫТКИ] Нода ${proxyServerUrl} рухнула. Причина: ${error.message}`);
            badProxiesReport.push({ ip: currentProxy, error: error.message });
        } finally {
            if (browser !== null) {
                try { await browser.close(); } catch (e) {}
            }
        }
    }

    if (cleanHtmlOutput) {
        console.log(`\n🎉 [ЗАПРОС УСПЕШНО ВЫПОЛНЕН] Отправляем дамп на сторону Google Таблицы.`);
        res.setHeader('Content-Type', 'text/html; charset=UTF-8');
        return res.send(cleanHtmlOutput);
    }

    console.log(`\n🛑 [КРАХ ПУЛА] Ни один прокси не смог отдать контент.`);
    res.setHeader('Content-Type', 'text/html; charset=UTF-8');
    let errorHtml = `<h1>❌ Полный сетевой тайм-аут всего пула бесплатных прокси!</h1><h3>Детальный лог:</h3><ul>`;
    badProxiesReport.forEach(item => {
        errorHtml += `<li><b>${item.ip}</b> — <span style="color:red;">${item.error}</span></li>`;
    });
    errorHtml += `</ul>`;
    return res.status(502).send(errorHtml);
};

app.get('/parse', handleParse);
app.post('/parse', express.json(), handleParse);

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => { console.log(`🚀 Дамп-шлюз с глубоким логированием запущен на порту ${PORT}`); });
