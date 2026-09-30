const express = require('express');
const { chromium } = require('playwright-extra');
const stealthPlugin = require('puppeteer-extra-plugin-stealth');

chromium.use(stealthPlugin());
const app = express();
app.use(express.json());

const handleParse = async (req, res) => {
    const targetUrl = req.query.url || req.body?.url;
    if (!targetUrl) return res.status(400).send("ОШИБКА: Пропущен параметр url!");

    // Твой свежий Webshare с чистыми лимитами
    const login = "mmnvhwqe";
    const pass = "pt6brfln6blc";

    const rawIps = [
        "31.59.20.176:6754", "45.38.107.97:6014", "64.137.96.74:6641",
        "198.23.243.226:6361", "38.154.185.97:6370", "84.247.60.125:6095",
        "142.111.67.146:5611", "191.96.254.138:6185", "31.58.9.4:6077", // 🇩🇪 Германия
        "198.46.161.42:5092"
    ];

    const shuffledIps = rawIps.sort(() => Math.random() - 0.5);
    console.log(`📡 [DOCKER TRACKER] Старт пула из ${shuffledIps.length} нод...`);

    let successHtml = null;
    let badProxiesList = []; 

    for (let i = 0; i < shuffledIps.length; i++) {
        const currentIp = shuffledIps[i];
        const proxyServerUrl = "http://" + currentIp;

        console.log(`🔄 Проверка №${i + 1}/${shuffledIps.length}. Нода: ${currentIp}...`);

        let browser = null;
        try {
            browser = await chromium.launch({ 
                headless: true, 
                // Жестко указываем путь к Chrome, который ставится через apt-get в Bookworm
                executablePath: '/usr/bin/chromium', 
                args: [
                    '--no-sandbox', 
                    '--disable-setuid-sandbox', 
                    '--disable-blink-features=AutomationControlled', 
                    '--disable-dev-shm-usage', 
                    '--disable-gpu'
                ],
                proxy: {
                    server: proxyServerUrl,
                    username: login,
                    password: pass
                }
            });

            const context = await browser.newContext({
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
                locale: 'de-DE',
                timezoneId: 'Europe/Berlin',
                viewport: { width: 1280, height: 720 }
            });

            const page = await context.newPage();
            
            await page.route('**/*', (route) => {
                if (['image', 'media', 'font', 'analytics'].includes(route.request().resourceType())) {
                    route.abort();
                } else {
                    route.continue();
                }
            });

            await page.addInitScript(() => { 
                Object.defineProperty(navigator, 'webdriver', { get: () => undefined }); 
                Object.defineProperty(navigator, 'languages', { get: () => ['de-DE', 'de', 'en-US', 'en'] });
            });

            const response = await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
            const httpStatus = response ? response.status() : "Unknown";
            
            await page.waitForTimeout(4000); 
            const htmlContent = await page.content();
            
            const hasNextData = htmlContent.includes('__NEXT_DATA__') || htmlContent.includes('__INITIAL_STATE__') || htmlContent.toLowerCase().includes('price');
            
            // Безопасное извлечение тайтла без регулярок, чтобы Node.js не падал
            let pageTitle = "Без заголовка";
            try { pageTitle = await page.title(); } catch (e) {}

            if (httpStatus === 200 && hasNextData && !pageTitle.toLowerCase().includes('access denied') && !pageTitle.toLowerCase().includes('just a moment') && !htmlContent.includes('Sicherheitsüberprüfung')) {
                console.log(`🎯 [ПРОБИТИЕ] Нода ${currentIp} зашла! Заголовок: "${pageTitle}"`);
                successHtml = htmlContent;
                await browser.close();
                break; 
            } else {
                let reason = "Пустой HTML / Нет маркеров данных";
                if (pageTitle.toLowerCase().includes('just a moment') || htmlContent.includes('Sicherheitsüberprüfung')) reason = "Cloudflare Turnstile Заглушка";
                if (pageTitle.toLowerCase().includes('access denied')) reason = "PerimeterX Access Denied";
                if (htmlContent.includes('Proxy connection limit exceeded')) reason = "Провайдер: Превышен лимит сессий";
                if (httpStatus === 402) reason = "Провайдер: Нет баланса (402 Payment Required)";
                if (httpStatus === 403) reason = "Забанен сайтом (403 Forbidden)";

                console.warn(`⚠️ Нода ${currentIp} забракована: ${reason}`);
                badProxiesList.push(`${currentIp}::${reason} (HTTP ${httpStatus})`);
            }

        } catch (error) {
            console.warn(`❌ Нода ${currentIp} упала: ${error.message}`);
            badProxiesList.push(`${currentIp}::Крах соединения (${error.message})`);
        } finally {
            if (browser !== null) { try { await browser.close(); } catch(e) {} }
        }
    }

    res.setHeader('X-Bad-Proxies', badProxiesList.join('||'));

    if (successHtml !== null) {
        res.setHeader('Content-Type', 'text/html; charset=UTF-8');
        return res.send(successHtml);
    } else {
        console.error("💀 КРАХ ПУЛА: Ни один прокси не пробил защиту.");
        res.setHeader('Content-Type', 'text/plain; charset=UTF-8');
        return res.status(500).send(`[КРАХ ПУЛА] Ни один прокси не пробил защиту.`);
    }
};

app.get('/parse', handleParse);
app.post('/parse', handleParse);

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => { console.log(`🚀 Docker конвейер Playwright Extra запущен на порту ${PORT}`); });


