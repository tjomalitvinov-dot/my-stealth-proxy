const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const axios = require('axios');
const { HttpProxyAgent } = require('http-proxy-agent');

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
        console.log(`📡 [ANTIDETECT BROWSER] Прорыв на: ${targetUrl}`);
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
            
            // Включаем жесткий перехват запросов (Блокируем рекламу и трекеры, которые палят Render)
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
            
            // Выставляем идеальный человеческий User-Agent
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
            
            // Глубокие хакерские инъекции для затирания следов автоматизации Puppeteer
            await page.evaluateOnNewDocument(() => {
                // Стираем navigator.webdriver
                Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
                // Имитируем реальные языки системы
                Object.defineProperty(navigator, 'languages', { get: () => ['de-DE', 'de', 'en-US', 'en'] });
                // Имитируем наличие плагинов в браузере
                Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
                // Подменяем WebGL отпечаток видеокарты на стандартный пользовательский
                const getParameter = WebGLRenderingContext.prototype.getParameter;
                WebGLRenderingContext.prototype.getParameter = function(parameter) {
                    if (parameter === 37445) return 'Intel Open Source Technology Center';
                    if (parameter === 37446) return 'Intel(R) HD Graphics 4000';
                    return getParameter(parameter);
                };
            });

            await page.setViewport({ width: 1920, height: 1080 });
            await page.setDefaultNavigationTimeout(45000);
            
            // Заходим на сайт
            await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
            
            // Даем паузу, чтобы отработал именно стейт
            await new Promise(resolve => setTimeout(resolve, 8000)); 
            
            const htmlContent = await page.content();
            
            // Формируем эмуляцию __NEXT_DATA__ на основе реального стейта Apollo
            if (targetUrl.includes('lego.com')) {
                let apolloJsonText = "";
                const matchApollo = htmlContent.match(/window\.__APOLLO_STATE__\s*=\s*({.+?});/s) || 
                                    htmlContent.match(/__APOLLO_STATE__\s*=\s*({.+?});/s);
                                    
                if (matchApollo && matchApollo[1]) {
                    apolloJsonText = matchApollo[1].trim();
                }
                
                if (apolloJsonText) {
                    try {
                        const parsedState = JSON.parse(apolloJsonText);
                        const emulatedNextData = {
                            props: { pageProps: { __APOLLO_STATE__: parsedState } }
                        };
                        const fakeNextTag = `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify(emulatedNextData)}</script>`;
                        console.log("🎯 [SUCCESS] Эмуляция __NEXT_DATA__ успешно создана и внедрена!");
                        return res.send(htmlContent + fakeNextTag);
                    } catch (eJson) {
                        console.error("Ошибка парсинга Apollo JSON: " + eJson.message);
                    }
                } else {
                    console.log("⚠️ [WARNING] __APOLLO_STATE__ не найден в текущем HTML коде.");
                }
            }
            
            return res.send(htmlContent);
            
        } catch (error) { 
            console.error("🚨 Крах в браузере: " + error.message);
            return res.status(500).send(`<h1>Ошибка маскированного браузера: ${error.message}</h1>`); 
        } finally { 
            if (browser !== null) await browser.close(); 
        }
    } else {
        // Режим FAST HTTP без изменений
        try {
            const agent = new HttpProxyAgent(proxyServerUrl);
            const response = await axios.get(targetUrl, {
                httpAgent: agent,
                httpsAgent: agent,
                timeout: 25000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                    'Accept-Language': 'de-DE,de;q=0.9'
                }
            });
            return res.send(response.data);
        } catch (error) {
            return res.status(500).send(`<h1>Ошибка быстрого шлюза: ${error.message}</h1>`);
        }
    }
};

app.get('/parse', handleParse);
app.post('/parse', express.json(), handleParse);

const PORT = process.env.PORT || 7860;
app.listen(PORT, () => { console.log(`🚀 Шлюз запущен на порту ${PORT}`); });


