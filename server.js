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

const viewports = [
    { width: 1920, height: 1080 },
    { width: 1440, height: 900 }
];

const handleParse = async (req, res) => {
    const targetUrl = req.query.url || req.body?.url;
    if (!targetUrl) return res.status(400).send("<h1>Ошибка: Параметр ?url= не найден!</h1>");
    
    console.log(`📡 Запрос на парсинг сайта: ${targetUrl}`);
    
    // УНИВЕРСАЛЬНЫЙ ПУЛ. Сюда можно кидать IP как с паролями, так и без них!
    const rawIps = [
        // Пример прокси БЕЗ логина (универсальный код их подхватит):
        "31.59.20.176:6754", 
        "45.38.107.97:6014",
        
        // Пример, если у тебя появятся прокси вида логин:пароль@IP:порт
        // "myuser:mypassword@94.79.152.14:80" 
    ];
    
    let badProxiesReport = [];
    let cleanHtmlOutput = null;

    for (let i = 0; i < rawIps.length; i++) {
        const rawProxyLine = rawIps[i].trim();
        let proxyServerUrl = "";
        let authCredentials = null;

        // УМНЫЙ ПАРСИНГ СТРОКИ ПРОКСИ
        // Если в строке есть символ '@', значит это формат логин:пароль@IP:порт
        if (rawProxyLine.includes('@')) {
            const [authPart, ipPart] = rawProxyLine.split('@');
            const [username, password] = authPart.split(':');
            proxyServerUrl = `http://${ipPart}`;
            authCredentials = { username, password };
        } else {
            // Обычный формат IP:порт
            proxyServerUrl = `http://${rawProxyLine}`;
        }

        let browser = null;
        console.log(`🔄 Попытка №${i + 1}/${rawIps.length}. Тестируем канал: ${proxyServerUrl}`);
        
        try {
            const selectedUA = userAgents[Math.floor(Math.random() * userAgents.length)];
            const selectedViewport = viewports[Math.floor(Math.random() * viewports.length)];

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
                    '--lang=ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7'
                ] 
            });
            
            const page = await browser.newPage();
            
            // Если умный парсер нашел логин и пароль — включаем авторизацию в Chrome
            if (authCredentials) {
                await page.authenticate(authCredentials);
            }
            
            await page.setUserAgent(selectedUA);
            await page.setViewport(selectedViewport);
            
            await page.setExtraHTTPHeaders({
                'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Upgrade-Insecure-Requests': '1'
            });
            
            // Ставим 12 секунд таймаута, чтобы быстро отсекать мертвые каналы
            await page.setDefaultNavigationTimeout(12000); 
            
            await page.goto(targetUrl, { waitUntil: 'networkidle2' });
            await page.evaluate(() => { window.scrollBy(0, window.innerHeight / 2); });
            
            cleanHtmlOutput = await page.content();
            console.log(`✅ Успех! Сайт пробит через ноду: ${proxyServerUrl}`);
            await browser.close();
            break; 

        } catch (error) {
            console.error(`❌ Канал ${proxyServerUrl} отклонен. Ошибка: ${error.message}`);
            badProxiesReport.push({ ip: proxyServerUrl, error: error.message });
        } finally {
            if (browser !== null) {
                try { await browser.close(); } catch (e) {}
            }
        }
    }

    if (!cleanHtmlOutput) {
        res.setHeader('Content-Type', 'text/html; charset=UTF-8');
        let errorHtml = `<h1>❌ Все прокси-ноды из пула отклонены сервером!</h1><h3>Диагностический отчет:</h3><ul>`;
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
app.listen(PORT, () => { console.log(`🚀 Шлюз запущен на порту ${PORT}`); });



