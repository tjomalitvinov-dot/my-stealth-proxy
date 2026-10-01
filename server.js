const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());
const app = express();

const handleParse = async (req, res) => {
    const targetUrl = req.query.url || req.body?.url;
    if (!targetUrl) return res.status(400).send("<h1>Ошибка: Параметр url не найден!</h1>");
    
    // ТВОИ НОВЫЕ СВЕЖИЕ ПРИВАТНЫЕ РЕЗИДЕНТНЫЕ ПРОКСИ (АВТОРИЗАЦИЯ ОКТЯБРЬ 2026)
    const login = "mmnvhwqe";
    const pass = "pt6brfln6blc";
    const rawIps = [
        "31.59.20.176:6754",   // United Kingdom
        "45.38.107.97:6014",   // United Kingdom
        "64.137.96.74:6641",   // Spain
        "198.23.243.226:6361", // United States
        "38.154.185.97:6370",  // United States
        "84.247.60.125:6095",  // Poland
        "142.111.67.146:5611", // Japan
        "191.96.254.138:6185", // United States
        "31.58.9.4:6077",      // Germany
        "198.46.161.42:5092"   // United States
    ];

    // Перемешиваем пул, чтобы запросы распределялись случайно
    const shuffledIps = rawIps.sort(() => Math.random() - 0.5);
    console.log(`📡 [DOCKER CONVEYOR 2026] Мясорубка запущена. В пуле: ${shuffledIps.length} свежих нод.`);
    
    let successHtml = null;
    let errorHistory = [];

    // === ВНУТРЕННИЙ ЦИКЛ БЫСТРОГО ПЕРЕБОРА IP ===
    for (let i = 0; i < shuffledIps.length; i++) {
        const currentIp = shuffledIps[i];
        const proxyServerUrl = "http://" + currentIp;
        
        console.log(`🔄 Попытка №${i + 1}/${shuffledIps.length}. Запуск Docker-Chrome через ноду: ${currentIp}...`);
        
        let browser = null;
        try {
            browser = await puppeteer.launch({ 
                headless: true, 
                executablePath: '/usr/bin/google-chrome', // Строгая Docker привязка
                args: [
                    '--no-sandbox', 
                    '--disable-setuid-sandbox', 
                    `--proxy-server=${proxyServerUrl}`, 
                    '--disable-blink-features=AutomationControlled', 
                    '--disable-dev-shm-usage', 
                    '--disable-gpu',
                    '--disable-peer-connection-id-generator',
                    '--disable-webrtc-encryption',
                    '--accept-lang=de-DE,de,en-US,en'
                ] 
            });
            const page = await browser.newPage();
            
            // Включаем авторизацию на твоих новых прокси
            await page.authenticate({ username: login, password: pass });
            
            // Жесткая диета ОЗУ: блокируем картинки и медиа, спасая 512 МБ памяти Render
            await page.setRequestInterception(true);
            page.on('request', (request) => {
                if (['image', 'media', 'svg'].includes(request.resourceType())) {
                    request.abort();
                } else {
                    request.continue();
                }
            });

            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36');
            await page.evaluateOnNewDocument(() => { 
                Object.defineProperty(navigator, 'webdriver', { get: () => undefined }); 
                Object.defineProperty(navigator, 'languages', { get: () => ['de-DE', 'de'] });
            });
            
            // СКОРОСТНОЙ АПГРЕЙД: Ставим 5.5 секунд лимит ожидания на ноду!
            await page.setDefaultNavigationTimeout(5500); 
            
            const response = await page.goto(targetUrl, { waitUntil: 'networkidle2' });
            const httpStatus = response ? response.status() : "Unknown";
            
            // Фиксационная микро-пауза для сборки кэша React
            await new Promise(resolve => setTimeout(resolve, 3500));
            const htmlContent = await page.content();
            
            // Сканируем HTML на наличие реальной цены внутри Next.js кэша
            const hasNextData = htmlContent.includes('__NEXT_DATA__') || htmlContent.includes('__INITIAL_STATE__');
            const hasRealPrice = htmlContent.includes('formattedAmount') || htmlContent.includes('centAmount') || htmlContent.includes('priceValue');
            const titleMatch = htmlContent.match(/<title>([^<]+)<\/title>/i);
            const pageTitle = titleMatch ? titleMatch[1] : "Без заголовка";

            // Если зашли успешно, кэш на месте И ТАМ ЕСТЬ ЦЕНА — отдаем в таблицу!
            if (httpStatus === 200 && hasNextData && hasRealPrice && !pageTitle.toLowerCase().includes('access denied')) {
                console.log(`🎯 [ПРОБИТИЕ УСПЕШНО] Нода ${currentIp} выдала живой кэш! Экран: "${pageTitle}"`);
                successHtml = htmlContent;
                await browser.close();
                break; // Разрываем цикл сессии, цель достигнута!
            } else {
                let reason = "Пустой стейт (цены нет в коде)";
                if (pageTitle.toLowerCase().includes('access denied')) reason = "Блокировка PerimeterX (Access Denied)";
                if (pageTitle.toLowerCase().includes('just a moment')) reason = "Блокировка Cloudflare Turnstile капчи";
                
                console.warn(`⚠️ Нода ${currentIp} выдала РЕЗУЛЬТАТ 0 [Причина: ${reason} | Код: ${httpStatus}]. Переключаемся...`);
                errorHistory.push(`${currentIp} -> Результат 0 (${reason})`);
            }
            
        } catch (error) {
            console.warn(`❌ Нода ${currentIp} сброшена по таймауту/ошибке: ${error.message}`);
            errorHistory.push(`${currentIp} -> Сбой ноды (${error.message})`);
        } finally {
            if (browser !== null) { try { await browser.close(); } catch(e) {} }
        }
    }

    // Если в таблицу летит лог ошибок, пакуем заголовок дефектовки для твоего листа Bad_IPs
    if (errorHistory.length > 0) {
        res.setHeader('X-Bad-Proxies', errorHistory.join('||'));
    }

    if (successHtml !== null) {
        res.setHeader('Content-Type', 'text/html; charset=UTF-8');
        return res.send(successHtml);
    } else {
        console.error("💀 ТОТАЛЬНЫЙ КРАХ ПУЛА: Весь список свежих прокси выдал результат 0.");
        res.setHeader('Content-Type', 'text/plain; charset=UTF-8');
        return res.status(500).send(`[ТОТАЛЬНЫЙ КРАХ DOCKER-СЕРВЕРА] Ни один маскированный Chrome через свежий пул IP не смог достать цену.\n\nЖУРНАЛ ДЕФЕКТОВКИ:\n${errorHistory.join('\n')}`);
    }
};

app.get('/parse', handleParse);
app.post('/parse', express.json(), handleParse);

const PORT = process.env.PORT || 7860;
app.listen(PORT, () => { console.log(`🚀 Бессмертный Docker Chrome-конвейер запущен на порту ${PORT}`); });

