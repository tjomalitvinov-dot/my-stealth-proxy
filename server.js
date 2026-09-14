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

// Автоматический встроенный чистильщик текстовой каши
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
    
    console.log(`\n📡 [RENDER ENGINE] Поступил запрос на парсинг: ${targetUrl}`);
    
    // ТВОЙ ТОТ САМЫЙ СВЕЖИЙ ПУЛ, КОТОРЫЙ ПРОБИВАЛ CLOUDFLARE
    const myRawProxyList = [
        "80.74.54.148	3128	DE	Germany	anonymous	no	no	25 secs ago",
        "103.237.102.191	11111	DE	Germany	elite proxy	yes	yes	25 secs ago",
        "158.179.58.126	3128	DE	Germany	anonymous		no	1 min ago",
        "45.10.163.12	80	DE	Germany	elite proxy		no	1 min ago",
        "185.21.8.66	1080	DE	Germany	anonymous		yes	1 min ago",
        "109.199.119.160	80	FR	France	anonymous	no	no	25 secs ago",
        "163.172.53.142	80	FR	France	elite proxy	no	no	25 secs ago",
        "158.220.99.85	4545	FR	France	elite proxy		no	1 min ago",
        "162.214.74.29	3128	US	United States	anonymous	no	no	25 secs ago",
        "162.214.159.94	3128	US	United States	anonymous	no	no	25 secs ago",
        "167.99.236.14	80	US	United States	elite proxy	no	no	25 secs ago",
        "149.248.18.106	8118	US	United States	elite proxy	yes	yes	25 secs ago"
    ];
    
    // Превращаем строки в чистые адреса и перемешиваем пул для уникальности тестов
    let proxyPool = parseRawInputList(myRawProxyList);
    proxyPool = [...new Set(proxyPool)].sort(() => Math.random() - 0.5);
    console.log(`📊 Пул успешно инициализирован. Доступно [${proxyPool.length}] встроенных нод.`);

    let badProxiesReport = [];
    let cleanHtmlOutput = null;

    // Циклический перебор пула (максимум 12 попыток)
    const maxAttempts = Math.min(proxyPool.length, 12);
    console.log(`🚀 Стартуем конвейер перебора из ${maxAttempts} нод...`);

    for (let i = 0; i < maxAttempts; i++) {
        const currentProxy = proxyPool[i];
        const proxyServerUrl = "http://" + currentProxy;
        let browser = null;

        console.log(`🔄 [Попытка №${i + 1}/${maxAttempts}] Запуск Chrome через встроенный IP: ${currentProxy}`);
        
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
                    '--single-process', 
                    '--no-zygote',
                    '--lang=de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7'
                ] 
            });
            
            const page = await browser.newPage();
            
            // Защита от детекции автоматизации
            await page.evaluateOnNewDocument(() => {
                Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            });

            await page.setUserAgent(selectedUA);
            await page.setViewport({ width: 1440, height: 900 });

            // ЖЕСТКАЯ ПРЕДЗАГРУЗКА КУКИ: Сначала прыгаем на главный домен и вживляем куки региона DE
            // Это ликвидирует любые всплывающие окна выбора стран, которые ломали структуру данных!
            await page.goto('https://lego.com', { waitUntil: 'domcontentloaded' }).catch(() => {});
            await page.setCookie(
                { name: 'LegoRegionCode', value: 'DE', domain: '.lego.com', path: '/' },
                { name: 'LEGO_COUNTRY', value: 'DE', domain: '.lego.com', path: '/' },
                { name: 'LegoCookieConsent', value: '{"necessary":true,"marketing":true,"analytics":true}', domain: '.lego.com', path: '/' }
            );
            
            // Выделяем 12 секунд таймаута на загрузку целевого товара через бесплатную ноду
            await page.setDefaultNavigationTimeout(12000); 
            
            // Заходим на саму карточку товара LEGO. Ждем networkidle2 (пока затихнет сеть и подгрузятся цены)
            await page.goto(targetUrl, { waitUntil: 'networkidle2' });
            
            // Имитируем микро-скролл человека для активации ленивых скриптов
            await page.evaluate(() => { window.scrollBy(0, 400); });
            await new Promise(resolve => setTimeout(resolve, 3000)); // Жестко ждем 3 секунды финализации рендеринга DOM
            
            cleanHtmlOutput = await page.content();
            
            // Если прокси пропустил вместо сайта ошибку блокировки или заглушку
            if (cleanHtmlOutput.includes('403 Forbidden') || cleanHtmlOutput.includes('Access Denied') || cleanHtmlOutput.length < 15000) {
                throw new Error("Сайт подсунул капчу или заблокировал IP (Код 403 / Каркас)");
            }

            console.log(`✅ ПОБЕДА! Защита взломана, тег __NEXT_DATA__ на месте через IP: ${currentProxy}`);
            await browser.close();
            break; 

        } catch (error) {
            console.error(`❌ Сбой встроенной ноды ${currentProxy}: ${error.message}`);
            badProxiesReport.push({ ip: currentProxy, error: error.message });
        } finally {
            if (browser !== null) {
                try { await browser.close(); } catch (e) {}
            }
        }
    }

    if (!cleanHtmlOutput) {
        res.setHeader('Content-Type', 'text/html; charset=UTF-8');
        let errorHtml = `<h1>❌ Все встроенные прокси из списка отклонили запрос!</h1><h3>Лог мясорубки:</h3><ul>`;
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
app.listen(PORT, () => { console.log(`🚀 Бессмертный Puppeteer-шлюз с пулом запущен на порту ${PORT}`); });
