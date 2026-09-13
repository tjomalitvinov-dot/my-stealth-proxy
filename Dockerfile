const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());
const app = express();

const handleParse = async (req, res) => {
    const targetUrl = req.query.url || req.body?.url;
    if (!targetUrl) return res.status(400).send("ОШИБКА: Пропущен параметр url!");
    
    // ТВОЙ ПОЛНЫЙ ПУЛ РЕЗИДЕНТНЫХ И ПУБЛИЧНЫХ IP ДЛЯ СУДНОГО ПЕРЕБОРА
    const login = "qkldfjel";
    const pass = "vocepvsvpszv";
    const rawIps = [
        "31.59.20.176:6754", "45.38.107.97:6014", "64.137.96.74:6641", "198.23.243.226:6361", 
        "38.154.185.97:6370", "84.247.60.125:6095", "142.111.67.146:5611", "31.58.9.4:6077", 
        "80.74.54.148:3128", "195.114.209.50:80", "176.61.151.123:80", "66.151.34.89:80", 
        "85.17.200.39:3128", "157.90.10.50:80", "85.214.107.177:80", "94.79.152.14:80", "185.85.111.18:80"
    ];

    // Перемешиваем пул, чтобы запросы распределялись равномерно
    const shuffledIps = rawIps.sort(() => Math.random() - 0.5);
    
    console.log(`📡 [БРАУЗЕРНЫЙ КОНВЕЙЕР] Запуск перебора пула из ${shuffledIps.length} нод...`);
    
    let successHtml = null;
    let errorHistory = [];

    // === ЦИКЛ МГНОВЕННОГО ПЕРЕЗАПУСКА БРАУЗЕРА ПРИ БЛОКИРОВКАХ ===
    for (let i = 0; i < shuffledIps.length; i++) {
        const currentIp = shuffledIps[i];
        const proxyServerUrl = "http://" + currentIp;
        
        console.log(`🔄 Попытка №${i + 1}/${shuffledIps.length}. Запуск Chrome через ноду: ${currentIp}...`);
        
        let browser = null;
        try {
            browser = await puppeteer.launch({ 
                headless: true, 
                args: [
                    '--no-sandbox', 
                    '--disable-setuid-sandbox', 
                    `--proxy-server=${proxyServerUrl}`, 
                    '--disable-blink-features=AutomationControlled', 
                    '--disable-dev-shm-usage', 
                    '--disable-gpu',
                    // Умные обманы отпечатков на уровне движка Chromium
                    '--disable-peer-connection-id-generator',
                    '--disable-webrtc-encryption',
                    '--accept-lang=nl-NL,nl,de-DE,de,en-US,en'
                ] 
            });
            const page = await browser.newPage();
            
            // Если нода резидентная, срабатывает авторизация, если публичная — Хром пропустит этот шаг автоматически
            await page.authenticate({ username: login, password: pass });
            
            // СВЕРХУМНАЯ ДИЕТА ОЗУ: Полностью режем картинки, стили и шрифты прямо в потоке!
            await page.setRequestInterception(true);
            page.on('request', (request) => {
                if (['image', 'stylesheet', 'font', 'media', 'svg'].includes(request.resourceType())) {
                    request.abort();
                } else {
                    request.continue();
                }
            });

            // Накатываем элитные цифровые маскировки
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
            await page.evaluateOnNewDocument(() => { 
                Object.defineProperty(navigator, 'webdriver', { get: () => undefined }); 
                Object.defineProperty(navigator, 'languages', { get: () => ['nl-NL', 'nl', 'de-DE', 'de'] });
            });
            
            // Короткий жесткий таймаут загрузки страницы (15 сек), чтобы мертвый прокси не вешал сервер!
            await page.setDefaultNavigationTimeout(15000);
            
            const response = await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
            const httpStatus = response ? response.status() : "Unknown";
            
            // Выжидаем микро-паузу для рендеринга текста скриптов
            await new Promise(resolve => setTimeout(resolve, 3500));
            const htmlContent = await page.content();
            
            // Проверяем страницу на наличие главного маркера кэша или цены
            const hasNextData = htmlContent.includes('__NEXT_DATA__') || htmlContent.includes('__INITIAL_STATE__') || htmlContent.toLowerCase().includes('price');
            const titleMatch = htmlContent.match(/<title>([^<]+)<\/title>/i);
            const pageTitle = titleMatch ? titleMatch[1] : "Без заголовка";

            if (httpStatus === 200 && hasNextData && !pageTitle.toLowerCase().includes('access denied') && !pageTitle.toLowerCase().includes('just a moment')) {
                console.log(`🎯 [ПРОБИТИЕ!] Нода ${currentIp} успешно взяла сайт! Заголовок: "${pageTitle}"`);
                successHtml = htmlContent;
                await browser.close();
                break; // МГНОВЕННО ПРЕРЫВАЕМ ЦИКЛ! Цель достигнута!
            } else {
                // Если Cloudflare выставил заглушку или стейт пуст — фиксируем ошибку ноды
                let reason = `Пустой кэш данных. Заголовок страницы: "${pageTitle}"`;
                if (pageTitle.toLowerCase().includes('just a moment')) reason = "Блокировка Cloudflare Turnstile капчи";
                if (pageTitle.toLowerCase().includes('access denied')) reason = "Блокировка PerimeterX (Access Denied)";
                
                const errorMsg = `Нода ${currentIp} отклонена сайтом [Причина: ${reason} | HTTP Код: ${httpStatus}]`;
                console.warn(`⚠️ ${errorMsg}`);
                errorHistory.push(errorMsg);
            }
            
        } catch (error) {
            const errorMsg = `Нода ${currentIp} полностью легла [Ошибка: ${error.message}]`;
            console.warn(`❌ ${errorMsg}`);
            errorHistory.push(errorMsg);
        } finally {
            if (browser !== null) { try { await browser.close(); } catch(e) {} }
        }
    }

    // === ФИНАЛЬНЫЙ СУДНЫЙ ВЕРДИКТ КОНВЕЙЕРА ===
    if (successHtml !== null) {
        res.setHeader('Content-Type', 'text/html; charset=UTF-8');
        return res.send(successHtml);
    } else {
        console.error("💀 ТОТАЛЬНЫЙ КРАХ ПУЛА: Все браузерные сессии были уничтожены или заблокированы.");
        res.setHeader('Content-Type', 'text/plain; charset=UTF-8');
        return res.status(500).send(`[ТОТАЛЬНЫЙ КРАХ СЕРВЕРА] Ни один маскированный Chrome через весь пул IP не смог пробить защиту сайта.\n\nПОДРОБНЫЙ ЖУРНАЛ ДЕФЕКТОВКИ НОД:\n${errorHistory.join('\n')}`);
    }
};

app.get('/parse', handleParse);
app.post('/parse', express.json(), handleParse);

const PORT = process.env.PORT || 7860;
app.listen(PORT, () => { console.log(`🚀 Бессмертный маскированный Chrome-конвейер запущен на порту ${PORT}`); });
