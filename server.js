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
    
    console.log(`\n📡 [RENDER ENGINE] Поступил запрос на парсинг LEGO: ${targetUrl}`);
    
    // БЕЗОПАСНАЯ АВТОРИЗАЦИОННАЯ СТРУКТУРА ПУЛА (БЕЗ ОПАСНЫХ РАЗДЕЛИТЕЛЕЙ ТЕКСТА)
    const authConfig = { username: "sp0xrsat1f", password: "jwNxAS1z4ey=wE6x9i" };
    const baseHost = "dc" + "." + "decodo" + "." + "com";
    const proxyHosts = [
        baseHost + ":" + "10001",
        baseHost + ":" + "10002",
        baseHost + ":" + "10003",
        baseHost + ":" + "10004",
        baseHost + ":" + "10005",
        baseHost + ":" + "10006",
        baseHost + ":" + "10007",
        baseHost + ":" + "10008",
        baseHost + ":" + "10009",
        baseHost + ":" + "10010"
    ];


    // Перемешиваем твои 10 портов при каждом запросе таблицы, чтобы распределять нагрузку
    let activeAttemptsPool = [...proxyHosts].sort(() => Math.random() - 0.5);
    
    let badProxiesReport = [];
    let cleanHtmlOutput = null;

    // Скрипт сделает максимум 5 попыток перебора портов, чтобы не упереться в лимит времени Google
    const maxAttempts = Math.min(activeAttemptsPool.length, 5);
    console.log(`🚀 Запускаем ротационный перебор из ${maxAttempts} твоих приватных портов...`);

    for (let i = 0; i < maxAttempts; i++) {
        const currentHost = activeAttemptsPool[i];
        const proxyServerUrl = "http://" + currentHost;
        let browser = null;

        console.log(`🔄 [Попытка №${i + 1}/${maxAttempts}] Открываем Chrome через порт: ${currentHost}`);
        
        try {
            const selectedUA = userAgents[Math.floor(Math.random() * userAgents.length)];

            browser = await puppeteerCore.launch({ 
                executablePath: '/usr/bin/google-chrome-stable', 
                headless: true, 
                args: [
                    '--no-sandbox', 
                    '--disable-setuid-sandbox', 
                    `--proxy-server=${proxyServerUrl}`, // Силой пускаем трафик через выбранный порт
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

            // Жестко передаем логин и пароль во вкладку Chrome
            await page.authenticate(authConfig);

            await page.setUserAgent(selectedUA);
            await page.setViewport({ width: 1440, height: 900 });

            // Блокируем картинки, чтобы твои приватные порты не висли на тяжелом медиа-контенте LEGO
            await page.setRequestInterception(true);
            page.on('request', (request) => {
                if (['image', 'font', 'media'].includes(request.resourceType())) {
                    request.abort();
                } else {
                    request.continue();
                }
            });

            // КРИТИЧЕСКИЙ ХАК: Заходим на домен LEGO и принудительно инжектим куки локализации Германии
            // Это ликвидирует баннеры согласия и Country Selector, которые ломали структуру данных
            await page.goto('https://lego.com', { waitUntil: 'domcontentloaded' }).catch(() => {});
            await page.setCookie(
                { name: 'LegoRegionCode', value: 'DE', domain: '.lego.com', path: '/' },
                { name: 'LEGO_COUNTRY', value: 'DE', domain: '.lego.com', path: '/' },
                { name: 'LegoCookieConsent', value: '{"necessary":true,"marketing":true,"analytics":true}', domain: '.lego.com', path: '/' }
            );
            
            // Выделяем 12 секунд таймаута на один порт
            await page.setDefaultNavigationTimeout(12000); 
            
            // Переходим на саму карточку конструктора. Ждем networkidle2, пока подгрузятся аякс-цены
            await page.goto(targetUrl, { waitUntil: 'networkidle2' });
            
            // Мягкий скролл для ленивой загрузки элементов
            await page.evaluate(() => { window.scrollBy(0, 400); });
            await new Promise(resolve => setTimeout(resolve, 3000)); // 3 секунды жесткого ожидания рендеринга цен
            
            cleanHtmlOutput = await page.content();
            
            // Если порт поймал капчу или пустой каркас страницы
            if (cleanHtmlOutput.includes('403 Forbidden') || cleanHtmlOutput.includes('Access Denied') || cleanHtmlOutput.length < 15000) {
                throw new Error("Защита сайта выдала заглушку капчи (Код 403 / Каркас)");
            }

            console.log(`✅ ПОБЕДА! Страница LEGO полностью отрендерена через приватный порт: ${currentHost}`);
            await browser.close();
            break; // Выходим из цикла, результат получен!

        } catch (error) {
            console.error(`❌ Сбой приватного порта ${currentHost}: ${error.message}`);
            badProxiesReport.push({ ip: currentHost, error: error.message });
        } finally {
            if (browser !== null) {
                try { await browser.close(); } catch (e) {}
            }
        }
    }

    if (!cleanHtmlOutput) {
        res.setHeader('Content-Type', 'text/html; charset=UTF-8');
        let errorHtml = `<h1>❌ Ни один из твоих приватных портов не смог вытащить данные LEGO!</h1><h3>Лог перебора:</h3><ul>`;
        badProxiesReport.forEach(item => {
            errorHtml += `<li><b>${item.ip}</b> — <span style="color:red;">${item.error}</span></li>`;
        });
        errorHtml += `</ul>`;
        return res.status(502).send(errorHtml);
    }

    // Возвращаем полноценный, полностью отрендеренный HTML-код в Google Таблицу
    res.setHeader('Content-Type', 'text/html; charset=UTF-8');
    return res.send(cleanHtmlOutput);
};

app.get('/parse', handleParse);
app.post('/parse', express.json(), handleParse);

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => { console.log(`🚀 Приватный ротационный Puppeteer-шлюз запущен на порту ${PORT}`); });
