const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());
const app = express();

const handleParse = async (req, res) => {
    const targetUrl = req.query.url || req.body?.url;
    if (!targetUrl) return res.status(400).send("<h1>Ошибка: Параметр ?url= не найден!</h1>");
    
    const needRender = req.query.render === 'true' || req.body?.render === true;
    
    const proxyLogin = "mmnvhwqe";
    const proxyPass = "pt6brfln6blc";
    const rawIps = [
        "31.59.20.176:6754", "45.38.107.97:6014", "64.137.96.74:6641",
        "198.23.243.226:6361", "38.154.185.97:6370", "84.247.60.125:6095",
        "142.111.67.146:5611", "191.96.254.138:6185", "31.58.9.4:6077", 
        "198.46.161.42:5092"
    ];
    
    const randomIp = rawIps[Math.floor(Math.random() * rawIps.length)];
    
    res.setHeader('Content-Type', 'text/html; charset=UTF-8');

    if (needRender) {
        console.log(`📡 [UNIVERSAL HIDDEN PROXY] Прорыв на: ${targetUrl}`);
        let browser = null;
        try {
            browser = await puppeteer.launch({ 
                headless: true, 
                executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome-stable',
                args: [
                    '--no-sandbox', 
                    '--disable-setuid-sandbox', 
                    `--proxy-server=http://${randomIp}`, 
                    '--disable-blink-features=AutomationControlled', 
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                    '--disable-web-security',
                    '--lang=de-DE,de;q=0.9',
                    '--window-size=1920,1080',
                    '--disable-features=IsolateOrigins,site-per-process'
                ] 
            });
            const page = await browser.newPage();
            
            // Блокируем метрики и тяжелую рекламу, чтобы не палить Render
            await page.setRequestInterception(true);
            page.on('request', (request) => {
                const url = request.url().toLowerCase();
                const resourceType = request.resourceType();
                if (
                    resourceType === 'image' || 
                    resourceType === 'font' || 
                    url.includes('analytics') || 
                    url.includes('pixel') || 
                    url.includes('google-analytics') || 
                    url.includes('tiktok') || 
                    url.includes('facebook')
                ) {
                    request.abort();
                } else {
                    request.continue();
                }
            });

            await page.authenticate({ username: proxyLogin, password: proxyPass });
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
            
            // Настоящий глубокий Антидетекст (убирает navigator.webdriver)
            await page.evaluateOnNewDocument(() => {
                Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
                Object.defineProperty(navigator, 'languages', { get: () => ['de-DE', 'de', 'en-US', 'en'] });
                Object.defineProperty(navigator, 'plugins', { get: () => });
                const getParameter = WebGLRenderingContext.prototype.getParameter;
                WebGLRenderingContext.prototype.getParameter = function(parameter) {
                    if (parameter === 37445) return 'Intel Open Source Technology Center';
                    if (parameter === 37446) return 'Intel(R) HD Graphics 4000';
                    return getParameter(parameter);
                };
            });

            await page.setViewport({ width: 1920, height: 1080 });
            await page.setDefaultNavigationTimeout(45000);
            
            // Делаем сетевой запрос
            const response = await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
            
            // Даем жесткую паузу 6 секунд для полной отработки фонового JS сайтов
            await new Promise(resolve => setTimeout(resolve, 6000)); 
            
            // 🎯 ХАКЕРСКИЙ ХИТРЫЙ ХОД: Забираем ОРИГИНАЛЬНЫЙ текстовый HTML ответа сервера,
            // а не тот пересобранный DOM, который ломал маркеры в Google скрипте!
            const rawServerHtml = await response.text();
            
            return res.send(rawServerHtml);
            
        } catch (error) { 
            console.error("🚨 Крах в браузере: " + error.message);
            return res.status(500).send(`<h1>Ошибка маскированного браузера: ${error.message}</h1>`); 
        } finally { 
            if (browser !== null) await browser.close(); 
        }
    } else {
        return res.status(400).send("<h1>Ошибка: Требуется параметр render=true</h1>");
    }
};

app.get('/parse', handleParse);
app.post('/parse', express.json(), handleParse);

const PORT = process.env.PORT || 7860;
app.listen(PORT, () => { console.log(`🚀 Универсальный скрытый шлюз запущен на порту ${PORT}`); });


const PORT = process.env.PORT || 7860;
app.listen(PORT, () => { console.log(`🚀 Скрытый шлюз запущен на порту ${PORT}`); });


