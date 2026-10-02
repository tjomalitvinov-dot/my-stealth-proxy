const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());
const app = express();

const handleParse = async (req, res) => {
    const targetUrl = req.query.url || req.body?.url;
    if (!targetUrl) return res.status(400).send("<h1>Ошибка: Параметр url не найден!</h1>");
    
    const incomingProxyIp = req.query.proxy_ip || req.body?.proxy_ip;
    if (!incomingProxyIp) {
        res.setHeader('Content-Type', 'text/plain; charset=UTF-8');
        return res.status(400).send("[ОШИБКА СЕРВЕРА] Не передан параметр proxy_ip.");
    }

    const proxyServerUrl = "http://" + incomingProxyIp;
    console.log(`🔄 [DOCKER HYBRID CONTROL] Открываем Chrome через туннель: [${incomingProxyIp}]`);

    // Твой бессмертный паспорт авторизации резидентных каналов
    const login = "mmnvhwqe";
    const pass = "pt6brfln6blc";

    let browser = null;
    try {
        browser = await puppeteer.launch({ 
            headless: true, 
            executablePath: '/usr/bin/google-chrome', 
            args: [
                '--no-sandbox', 
                '--disable-setuid-sandbox', 
                `--proxy-server=${proxyServerUrl}`, 
                '--disable-blink-features=AutomationControlled', 
                '--disable-dev-shm-usage', 
                '--disable-gpu',
                '--disable-peer-connection-id-generator',
                '--disable-webrtc-encryption',
                '--ignore-certificate-errors', 
                '--window-size=1920,1080'
            ] 
        });
        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
        
        // ХАКЕРСКИЙ ПАСПОРТ: Защищает от ошибок ERR_INVALID_AUTH_CREDENTIALS!
        await page.authenticate({ username: login, password: pass });
        
        await page.setRequestInterception(true);
        page.on('request', (request) => {
            if (['image', 'stylesheet', 'font', 'media', 'svg'].includes(request.resourceType())) {
                request.abort();
            } else {
                request.continue();
            }
        });
        
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
        await page.evaluateOnNewDocument(() => { 
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined }); 
            Object.defineProperty(navigator, 'languages', { get: () => ['de-DE', 'de', 'en-US', 'en'] });
            window.chrome = { runtime: {}, loadTimes: function() {}, csi: function() {} };
        });
        
        await page.setDefaultNavigationTimeout(40000);
        
        let cleanHtmlOutput = "";
        let isSuccessParse = false;
        
        for (let attempt = 1; attempt <= 3; attempt++) {
            if (attempt === 1) {
                await page.goto(targetUrl, { waitUntil: 'networkidle2' });
            } else {
                await page.reload({ waitUntil: 'networkidle2' });
            }
            
            await new Promise(resolve => setTimeout(resolve, 4500));
            cleanHtmlOutput = await page.content();
            
            const titleMatch = cleanHtmlOutput.match(/<title>([^<]+)<\/title>/i);
            const pageTitle = titleMatch ? titleMatch : "Без заголовка";
            const hasNextData = cleanHtmlOutput.includes('__NEXT_DATA__') || cleanHtmlOutput.includes('__INITIAL_STATE__');
            
            if (hasNextData && !pageTitle.toLowerCase().includes('just a moment') && !cleanHtmlOutput.includes('access denied')) {
                isSuccessParse = true;
                break; 
            }
            await new Promise(resolve => setTimeout(resolve, 2500));
        }
        
        if (!isSuccessParse) {
            res.setHeader('Content-Type', 'text/plain; charset=UTF-8');
            return res.status(502).send(`[ПРОКСИ_ВЫГОРЕЛ] Капча на ноде.`);
        }
        
        res.setHeader('Content-Type', 'text/html; charset=UTF-8');
        return res.send(cleanHtmlOutput);
        
    } catch (error) { 
        res.setHeader('Content-Type', 'text/plain; charset=UTF-8');
        return res.status(502).send(`[ПРОКСИ_ВЫГОРЕЛ] Сбой IP: ${error.message}`); 
    }
    finally { if (browser !== null) { try { await browser.close(); } catch(e) {} } }
};

app.get('/parse', handleParse);
app.post('/parse', express.json(), handleParse);

const PORT = process.env.PORT || 7860;
app.listen(PORT, () => { console.log(`🚀 Шлюз запущен на порту ${PORT}`); });

