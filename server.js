const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());
const app = express();
app.use(express.json());

const handleParse = async (req, res) => {
    const targetUrl = req.query.url || req.body?.url;
    if (!targetUrl) return res.status(400).send("<h1>Ошибка: Параметр URL отсутствует</h1>");
    
    console.log(`📡 Заходим на живой сайт под РЕНДЕР: ${targetUrl}`);

    const login = "mmnvhwqe";
    const pass = "pt6brfln6blc";
    const rawIps = [
        "31.59.20.176:6754", "45.38.107.97:6014", "64.137.96.74:6641",
        "198.23.243.226:6361", "38.154.185.97:6370", "84.247.60.125:6095",
        "142.111.67.146:5611", "191.96.254.138:6185", "31.58.9.4:6077", 
        "198.46.161.42:5092"
    ];
    
    const randomIp = rawIps[Math.floor(Math.random() * rawIps.length)];
    // ИСПРАВЛЕНО: Передаем в аргументы чистый IP, без логина и пароля, чтобы избежать ERR_NO_SUPPORTED_PROXIES
    const proxyServerUrl = `http://${randomIp}`;
    
    console.log(`🔄 Ротация резидентного канала. Выходим через IP: ${randomIp}`);
    let browser = null;

    try {
        browser = await puppeteer.launch({
            headless: true,
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome-stable',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                `--proxy-server=${proxyServerUrl}`,
                '--disable-blink-features=AutomationControlled',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--disable-web-security'
            ]
        });

        const page = await browser.newPage();
        
        // Авторизация на резидентном прокси-канале
        await page.authenticate({ username: login, password: pass });
        
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        await page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        });

        await page.setDefaultNavigationTimeout(55000);

        // Ждем полной остановки сетевой активности (РЕНДЕР ИЗ ОРИГИНАЛА)
        await page.goto(targetUrl, { waitUntil: 'networkidle2' });
        await new Promise(resolve => setTimeout(resolve, 4000));

        let htmlContent = await page.content();

        // 🎯 СУПЕР-АДАПТЕР ДЛЯ LEGO: Спасаем метод next_json
        if (targetUrl.includes('lego.com')) {
            console.log("🧩 Lego детектирован. Извлекаем чистую цену из Schema.org...");
            
            // Находим блок Schema.org, который ты прислал в Файле 3
            const schemaMatch = htmlContent.match(/type="application\/ld\+json"\s*>\s*({.+?})\s*<\/script>/s) ||
                                htmlContent.match(/({[^{]*"@type"\s*:\s*"Product"[^}]*})/s);
                                
            if (schemaMatch && schemaMatch[1]) {
                try {
                    const schemaJson = JSON.parse(schemaMatch[1].trim());
                    const realPrice = schemaJson.offers?.price || "0.00";
                    const currency = schemaJson.offers?.priceCurrency || "EUR";
                    
                    console.log(`💰 Найдена чистая цена во вшитой Schema: ${realPrice} ${currency}`);
                    
                    // Собираем эмуляцию структуры, под которую написаны твои цепочки путей Apollo!
                    const emulatedData = {
                        props: {
                            pageProps: {
                                __APOLLO_STATE__: {
                                    "ROOT_QUERY": {},
                                    "ProductVariant:FAKE_ID": {
                                        "__typename": "ProductVariant",
                                        "price": {
                                            "__typename": "Price",
                                            "formattedValue": parseFloat(realPrice)
                                        }
                                    }
                                }
                            }
                        }
                    };
                    
                    // Генерируем искусственный тег __NEXT_DATA__
                    const fakeTag = `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify(emulatedData)}</script>`;
                    
                    // Дописываем его в самый конец HTML и отдаем таблице
                    htmlContent = htmlContent + fakeTag;
                    
                } catch (eJson) {
                    console.error("Ошибка парсинга Schema JSON: " + eJson.message);
                }
            }
        }

        res.setHeader('Content-Type', 'text/html; charset=UTF-8');
        return res.send(htmlContent);

    } catch (error) {
        console.error("Сбой Puppeteer: " + error.message);
        return res.status(500).send(`<h1>Ошибка маскированного браузера: ${error.message}</h1>`);
    } finally {
        if (browser !== null) await browser.close();
    }
};

app.get('/parse', handleParse);
app.post('/parse', handleParse);

const PORT = process.env.PORT || 7860;
app.listen(PORT, () => { console.log(`🚀 Сервер запущен на порту ${PORT}`); });

