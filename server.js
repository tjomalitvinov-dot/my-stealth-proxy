const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const axios = require('axios'); // Для быстрых запросов без рендера
const { HttpProxyAgent } = require('http-proxy-agent');

puppeteer.use(StealthPlugin());
const app = express();

const handleParse = async (req, res) => {
    const targetUrl = req.query.url || req.body?.url;
    if (!targetUrl) return res.status(400).send("<h1>Ошибка: Параметр ?url= не найден!</h1>");
    
    // Проверяем, требует ли Google Таблица полноценный рендеринг браузером
    const needRender = req.query.render === 'true' || req.body?.render === true;
    
    // БЕЗУПРЕЧНАЯ СБОРКА ТВОИХ РЕЗИДЕНТНЫХ ПРОКСИ В ОЗУ (ЗАШИТА В КОД)
    const proxyLogin = "mmnvhwqe";
    const proxyPass = "pt6brfln6blc";
    const rawIps = [
        "31.59.20.176:6754", "45.38.107.97:6014", "64.137.96.74:6641",
        "198.23.243.226:6361", "38.154.185.97:6370", "84.247.60.125:6095",
        "142.111.67.146:5611", "191.96.254.138:6185", "31.58.9.4:6077", 
        "198.46.161.42:5092"
    ];
    
    const randomIp = rawIps[Math.floor(Math.random() * rawIps.length)];
    const proxyServerUrl = `http://${proxyLogin}:${proxyPass}@${randomIp}`;
    
    res.setHeader('Content-Type', 'text/html; charset=UTF-8');

    // =========================================================================
    // РЕЖИМ 1: СУПЕР-РЕНДЕР ЧЕРЕЗ PUPPETEER (Для тяжелых сайтов вроде Lego)
    // =========================================================================
    if (needRender) {
        console.log(`📡 [PUPPETEER BROWSER] Заходим на: ${targetUrl} через резидентный IP: ${randomIp}`);
        let browser = null;
        try {
            browser = await puppeteer.launch({ 
                headless: true, 
                args: [
                    '--no-sandbox', 
                    '--disable-setuid-sandbox', 
                    `--proxy-server=http://${randomIp}`, 
                    '--disable-blink-features=AutomationControlled', 
                    '--disable-dev-shm-usage', // Экономия RAM на Render
                    '--disable-gpu',
                    '--lang=de-DE,de' // Защита от авто-редиректа Lego на регион США
                ] 
            });
            const page = await browser.newPage();
            
            // Авторизация на твоем резидентном прокси-канале
            await page.authenticate({ username: proxyLogin, password: proxyPass });
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
            
            await page.setDefaultNavigationTimeout(55000);
            
            // Ждем networkidle2, чтобы скрипты Lego успели выплюнуть цену в HTML!
            await page.goto(targetUrl, { waitUntil: 'networkidle2' });
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            const cleanHtmlOutput = await page.content();
            return res.send(cleanHtmlOutput);
            
        } catch (error) { 
            console.error("Сбой Puppeteer: " + error.message);
            return res.status(500).send(`<h1>Ошибка маскированного браузера: ${error.message}</h1>`); 
        } finally { 
            if (browser !== null) await browser.close(); 
        }
    } 
    
    // =========================================================================
    // РЕЖИМ 2: БЫСТРЫЙ СЫРОЙ ЗАПРОС (Для простых сайтов, чтобы экономить ресурсы)
    // =========================================================================
    else {
        console.log(`⚡ [FAST HTTP] Заходим напрямую на: ${targetUrl} через резидентный IP: ${randomIp}`);
        try {
            const agent = new HttpProxyAgent(proxyServerUrl);
            const response = await axios.get(targetUrl, {
                httpAgent: agent,
                httpsAgent: agent,
                timeout: 30000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7'
                }
            });
            return res.send(response.data);
        } catch (error) {
            console.error("Сбой Fast HTTP: " + error.message);
            return res.status(500).send(`<h1>Ошибка быстрого шлюза: ${error.message}</h1>`);
        }
    }
};

app.get('/parse', handleParse);
app.post('/parse', express.json(), handleParse);

const PORT = process.env.PORT || 7860;
app.listen(PORT, () => { console.log(`🚀 Шлюз запущен на порту ${PORT}`); });

