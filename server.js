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
        "172.104.56.95	8888	SG	Singapore	anonymous	no	yes	1 sec ago","65.109.217.164	3128	FI	Finland	elite proxy	no	yes	1 sec ago","47.81.56.193	8888	TH	Thailand	elite proxy	yes	yes	5 secs ago","195.158.8.123	3128	UZ	Uzbekistan	elite proxy	no	yes	13 secs ago","41.33.219.140	1976	EG	Egypt	anonymous	no	yes	13 secs ago","165.154.162.73	8888	US	United States	elite proxy	no	yes	13 secs ago","194.163.175.167	40000	FR	France	elite proxy	no	yes	13 secs ago","193.233.91.64	3129	RU	Russian Federation	elite proxy	no	yes	13 secs ago","14.139.235.82	3128	IN	India	anonymous	no	yes	1 min ago","58.187.104.62	2113	VN	Vietnam	elite proxy	no	yes	1 min ago",
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

