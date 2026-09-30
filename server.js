const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());
const app = express();

app.use(express.json());

const handleParse = async (req, res) => {
    const targetUrl = req.query.url || req.body?.url;
    if (!targetUrl) return res.status(400).send("ОШИБКА: Пропущен параметр url!");

    // Твой новый свежий аккаунт Webshare со свободным лимитом трафика
    const login = "mmnvhwqe";
    const pass = "pt6brfln6blc";

    // Твой личный пул бесплатных IP Webshare, скопированный из кабинета
    const rawIps = [
        "31.59.20.176:6754",
        "45.38.107.97:6014",
        "64.137.96.74:6641",
        "198.23.243.226:6361",
        "38.154.185.97:6370",
        "84.247.60.125:6095",
        "142.111.67.146:5611",
        "191.96.254.138:6185",
        "31.58.9.4:6077", // 🌟 Наша главная немецкая нода Франкфурта для LEGO!
        "198.46.161.42:5092"
    ];

    // Перемешиваем ноды для честной ротации пула
    const shuffledIps = rawIps.sort(() => Math.random() - 0.5);
    console.log(`📡 [DOCKER TRACKER] Начинаем прогон пула из ${shuffledIps.length} нод...`);

    let successHtml = null;
    let badProxiesList = []; // Твой массив для сбора плохих IP для передачи в Google Таблицу

    for (let i = 0; i < shuffledIps.length; i++) {
        const currentIp = shuffledIps[i];
        const proxyServerUrl = "http://" + currentIp;

        console.log(`🔄 Проверка №${i + 1}/${shuffledIps.length}. Нода: ${currentIp}...`);

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
                    '--disable-peer-connection-id-generator',
                    '--disable-webrtc-encryption',
                    '--accept-lang=de-DE,de,en-US,en' // Локаль под европейские маркетплейсы
                ] 
            });
            const page = await browser.newPage();
            
            // Авторизация в Webshare
            await page.authenticate({ username: login, password: pass });

            // Твоя фирменная Диета ОЗУ: блокируем картинки и весь лишний мусор
            await page.setRequestInterception(true);
            page.on('request', (request) => {
                if (['image', 'stylesheet', 'font', 'media', 'svg'].includes(request.resourceType())) {
                    request.abort();
                } else {
                    request.continue();
                }
            });

            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
            
            // Подмена скрытых параметров маскировки на уровне DOM
            await page.evaluateOnNewDocument(() => { 
                Object.defineProperty(navigator, 'webdriver', { get: () => undefined }); 
                Object.defineProperty(navigator, 'languages', { get: () => ['de-DE', 'de', 'en-US', 'en'] });
            });
            
            // Жорсткий лимит 15 секунд на ноду, как у тебя в коде
            await page.setDefaultNavigationTimeout(15000); 

            const response = await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
            const httpStatus = response ? response.status() : "Unknown";
            
            // Твоя stealth-пауза 3.5 секунды
            await new Promise(resolve => setTimeout(resolve, 3500));
            const htmlContent = await page.content();
            
            // Проверка маркеров наличия данных на странице
            const hasNextData = htmlContent.includes('__NEXT_DATA__') || htmlContent.includes('__INITIAL_STATE__') || htmlContent.toLowerCase().includes('price');
            const titleMatch = htmlContent.match(/<title>([^<]+)<\/title>/i);
            const pageTitle = titleMatch ? titleMatch[1] : "Без заголовка";

            // Если зашли успешно и нашли данные — это победа!
            if (httpStatus === 200 && hasNextData && !pageTitle.toLowerCase().includes('access denied') && !pageTitle.toLowerCase().includes('just a moment') && !htmlContent.includes('Sicherheitsüberprüfung')) {
                console.log(`🎯 [ПРОБИТИЕ] Нода ${currentIp} зашла! Заголовок: "${pageTitle}"`);
                successHtml = htmlContent;
                await browser.close();
                break; 
            } else {
                // Твоя кастомная дефектовка причин блокировки
                let reason = "Пустой HTML / Нет маркеров данных";
                if (pageTitle.toLowerCase().includes('just a moment') || htmlContent.includes('Sicherheitsüberprüfung')) reason = "Cloudflare Turnstile Заглушка";
                if (pageTitle.toLowerCase().includes('access denied')) reason = "PerimeterX Access Denied";
                if (htmlContent.includes('Proxy connection limit exceeded')) reason = "Провайдер: Превышен лимит сессий";
                if (httpStatus === 402) reason = "Провайдер: Нет баланса (402 Payment Required)";
                if (httpStatus === 403) reason = "Забанен сайтом (403 Forbidden)";

                console.warn(`⚠️ Нода ${currentIp} забракована: ${reason}`);
                // Собираем лог для передачи обратно в Apps Script
                badProxiesList.push(`${currentIp}::${reason} (HTTP ${httpStatus})`);
            }

        } catch (error) {
            console.warn(`❌ Нода ${currentIp} упала: ${error.message}`);
            badProxiesList.push(`${currentIp}::Крах соединения (${error.message})`);
        } finally {
            if (browser !== null) { 
                try { await browser.close(); } catch(e) {} 
            }
        }
    }

    // Твоя секретная отправка массива плохих IP обратно в Google Таблицу через заголовок!
    res.setHeader('X-Bad-Proxies', badProxiesList.join('||'));

    if (successHtml !== null) {
        res.setHeader('Content-Type', 'text/html; charset=UTF-8');
        return res.send(successHtml);
    } else {
        console.error("💀 КРАХ ПУЛА: Ни один прокси не пробил защиту.");
        res.setHeader('Content-Type', 'text/plain; charset=UTF-8');
        return res.status(500).send(`[КРАХ ПУЛА] Ни один прокси не пробил защиту.\n\nПроверенные плохие ноды переданы на лист Bad_IPs.`);
    }
};

app.get('/parse', handleParse);
app.post('/parse', handleParse);

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => { console.log(`🚀 Docker конвейер с дефектовкой IP запущен на порту ${PORT}`); });

