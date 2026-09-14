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

const handleParse = async (req, res) => {
    const targetUrl = req.query.url || req.body?.url;
    if (!targetUrl) return res.status(400).send("<h1>Ошибка: Параметр ?url= не найден!</h1>");
    
    console.log(`📡 Заходим на живой сайт: ${targetUrl}`);
    
    // ТВОЙ ЛИЧНЫЙ ТЕСТОВЫЙ СПИСОК ПРОКСИ. 
    // Сюда можно кидать ЛЮБЫЕ прокси: и бесплатные (IP:порт), и с паролями (логин:пароль@IP:порт)
    const rawIps = [
        "31.59.20.176:6754", 
        "45.38.107.97:6014", 
        "64.137.96.74:6641", 
        "198.23.243.226:6361",
        // Сюда же можешь вставить тест с логином, если появится: "user:pass@1.2.3.4:8080"
    ];
    
    let badProxiesReport = [];
    let cleanHtmlOutput = null;

    // Скрипт по очереди перебирает твой список
    for (let i = 0; i < rawIps.length; i++) {
        const rawProxyLine = rawIps[i].trim();
        let proxyServerUrl = "";
        let authCredentials = null;

        // Автоматическое распознавание формата (с паролем или без)
        if (rawProxyLine.includes('@')) {
            const [authPart, ipPart] = rawProxyLine.split('@');
            const [username, password] = authPart.split(':');
            proxyServerUrl = `http://${ipPart}`;
            authCredentials = { username, password };
        } else {
            proxyServerUrl = `http://${rawProxyLine}`;
        }

        let browser = null;
        console.log(`🔄 Попытка №${i + 1}/${rawIps.length}. Chrome через прокси: ${proxyServerUrl}`);
        
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
                    '--lang=ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7'
                ] 
            });
            
            const page = await browser.newPage();
            
            // Если прокси с паролем — авторизуемся, если паблик — идем напролом
            if (authCredentials) {
                await page.authenticate(authCredentials);
            }
            
            await page.setUserAgent(selectedUA);
            await page.setViewport({ width: 1440, height: 900 });
            
            // 15 секунд таймаута — идеальный баланс для бесплатных прокси, чтобы дождаться ответа
            await page.setDefaultNavigationTimeout(15000); 
            
            // Загружаем сайт
            await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
            
            cleanHtmlOutput = await page.content();
            
            // Если бесплатный IP выдал пустую заглушку или ошибку блокировки
            if (cleanHtmlOutput.includes('403 Forbidden') || cleanHtmlOutput.length < 500) {
                throw new Error("Сайт заблокировал этот IP (Код 403 / Пустая страница)");
            }

            console.log(`✅ Победили! Страница успешно скачана через: ${proxyServerUrl}`);
            await browser.close();
            break; // Нашли рабочий прокси, выходим из цикла!

        } catch (error) {
            console.error(`❌ Сбой ноды ${proxyServerUrl}: ${error.message}`);
            badProxiesReport.push({ ip: proxyServerUrl, error: error.message });
        } finally {
            if (browser !== null) {
                try { await browser.close(); } catch (e) {}
            }
        }
    }

    // Если весь твой список провалился
    if (!cleanHtmlOutput) {
        res.setHeader('Content-Type', 'text/html; charset=UTF-8');
        let errorHtml = `<h1>❌ Все прокси из твоего списка не смогли пробить сайт!</h1><h3>Отчет перебора:</h3><ul>`;
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
app.listen(PORT, () => { console.log(`🚀 Универсальный тестовый конвейер запущен на порту ${PORT}`); });





