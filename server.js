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
    const proxyServerUrl = `http://${proxyLogin}:${proxyPass}@${randomIp}`;
    
    res.setHeader('Content-Type', 'text/html; charset=UTF-8');

    if (needRender) {
        console.log(`📡 [PUPPETEER] Запуск браузера для: ${targetUrl}`);
        let browser = null;
        try {
            browser = await puppeteer.launch({ 
                headless: true, 
                args: [
                    '--no-sandbox', 
                    '--disable-setuid-sandbox', 
                    `--proxy-server=http://${randomIp}`, 
                    '--disable-blink-features=AutomationControlled', 
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                    '--disable-web-security', // 🎯 Отключаем блокировку CORS, чтобы JSON-цены загружались свободно
                    '--lang=de-DE,de'
                ] 
            });
            const page = await browser.newPage();
            
            await page.authenticate({ username: proxyLogin, password: proxyPass });
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
            
            // Ставим оптимальный таймаут 45 секунд
            await page.setDefaultNavigationTimeout(45000);
            
            // 🎯 Возвращаем domcontentloaded (он не зависнет), но даем жесткую паузу после загрузки
            await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
            
            console.log(`⏳ Базовый HTML получен, ждем 6 секунд для выполнения JS скриптов цен...`);
            await new Promise(resolve => setTimeout(resolve, 6000)); 
            
            const cleanHtmlOutput = await page.content();
            return res.send(cleanHtmlOutput);
            
        } catch (error) { 
            console.error("🚨 Ошибка Puppeteer: " + error.message);
            return res.status(500).send(`<h1>Ошибка маскированного браузера: ${error.message}</h1>`); 
        } finally { 
            if (browser !== null) await browser.close(); 
        }
    } 
    else {
        console.log(`⚡ [FAST HTTP] Запрос без браузера: ${targetUrl}`);
        try {
            const agent = new HttpProxyAgent(proxyServerUrl);
            const response = await axios.get(targetUrl, {
                httpAgent: agent,
                httpsAgent: agent,
                timeout: 25000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept-Language': 'de-DE,de;q=0.9'
                }
            });
            return res.send(response.data);
        } catch (error) {
            console.error("🚨 Ошибка Fast HTTP: " + error.message);
            return res.status(500).send(`<h1>Ошибка быстрого шлюза: ${error.message}</h1>`);
        }
    }
};

app.get('/parse', handleParse);
app.post('/parse', express.json(), handleParse);

const PORT = process.env.PORT || 7860;
app.listen(PORT, () => { console.log(`🚀 Шлюз запущен на порту ${PORT}`); });

