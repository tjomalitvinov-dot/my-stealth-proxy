const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());
const app = express();

const handleParse = async (req, res) => {
    const targetUrl = req.query.url || req.body?.url;
    if (!targetUrl) return res.status(400).send("<h1>Ошибка: Параметр ?url= не найден!</h1>");
    console.log(`📡 Заходим на живой сайт LEGO/Conrad: ${targetUrl}`);
    
    const login = "mmnvhwqe";
    const pass = "pt6brfln6blc";
    
    // ПРИНИМАЕМ ИЗ ТАБЛИЦЫ СТРОГИЙ ОЧЕРЕДНОЙ IP
    const incomingProxyIp = req.query.proxy_ip || req.body?.proxy_ip;
    if (!incomingProxyIp) {
        res.setHeader('Content-Type', 'text/plain; charset=UTF-8');
        return res.status(400).send("[ОШИБКА СЕРВЕРА] Запрос отклонен: таблица не передала очередной proxy_ip.");
    }

    const proxyServerUrl = "http://" + incomingProxyIp;
    console.log(`🔄 [КОНВЕЙЕРНАЯ ОЧЕРЕДЬ] Запуск Docker-Chrome через туннель: ${incomingProxyIp}`);
    
    let browser = null;
    try {
        browser = await puppeteer.launch({ 
            headless: true, 
            executablePath: '/usr/bin/google-chrome', // Жесткая привязка к Docker-Chrome
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
        await page.authenticate({ username: login, password: pass });
        
        // Жесткая блокировка картинок и тяжелого медиа-мусора
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
        
        await page.setDefaultNavigationTimeout(45000);
        
        let cleanHtmlOutput = "";
        let isSuccessParse = false;
        
        // === ЦИКЛ ТРЕХ УМНЫХ ПЕРЕЗАГРУЗОК СТРАНИЦЫ ВНУТРИ ОДНОЙ СЕССИИ ===
        for (let attempt = 1; attempt <= 3; attempt++) {
            console.log(`📡 Попытка загрузки №${attempt}/3...`);
            if (attempt === 1) {
                await page.goto(targetUrl, { waitUntil: 'networkidle2' });
            } else {
                await page.reload({ waitUntil: 'networkidle2' });
            }
            
            await new Promise(resolve => setTimeout(resolve, 4500));
            cleanHtmlOutput = await page.content();
            
            const titleMatch = cleanHtmlOutput.match(/<title>([^<]+)<\/title>/i);
            const pageTitle = titleMatch ? titleMatch[1] : "Без заголовка";
            const hasNextData = cleanHtmlOutput.includes('__NEXT_DATA__') || cleanHtmlOutput.includes('__INITIAL_STATE__');
            
            if (hasNextData && !pageTitle.toLowerCase().includes('just a moment') && !cleanHtmlOutput.includes('access denied')) {
                console.log(`🎯 [ПРОБИТИЕ НА ПОПЫТКЕ №${attempt}!] Заголовок страницы: "${pageTitle}". Кэш вырезан!`);
                isSuccessParse = true;
                break; 
            } else {
                console.warn(`⚠️ Попытка №${attempt} застряла на проверке Cloudflare/PX (Экран: "${pageTitle}"). Выжидаем паузу и перезагружаем страницу...`);
                await new Promise(resolve => setTimeout(resolve, 3000));
            }
        }
        
        // Передаем точный IP обратно таблице для ведения статистики успехов/ошибок
        res.setHeader('X-Proxy-Execution-IP', incomingProxyIp);
        
        if (!isSuccessParse) {
            res.setHeader('X-Proxy-Execution-Status', 'FAIL');
            res.setHeader('Content-Type', 'text/plain; charset=UTF-8');
            return res.status(502).send("[ОШИБКА] Ни одна из 3 перезагрузок страницы не смогла обойти капчу Cloudflare Turnstile.");
        }
        
        res.setHeader('X-Proxy-Execution-Status', 'SUCCESS');
        res.setHeader('Content-Type', 'text/html; charset=UTF-8');
        return res.send(cleanHtmlOutput);
        
    } catch (error) { 
        console.error("Сбой Puppeteer: " + error.message);
        res.setHeader('X-Proxy-Execution-IP', incomingProxyIp);
        res.setHeader('X-Proxy-Execution-Status', 'FAIL');
        res.setHeader('Content-Type', 'text/plain; charset=UTF-8');
        return res.status(502).send(`<h1>Ошибка маскированного браузера: ${error.message}</h1>`); 
    }
    finally { if (browser !== null) await browser.close(); }
};

app.get('/parse', handleParse);
app.post('/parse', express.json(), handleParse);

const PORT = process.env.PORT || 7860;
app.listen(PORT, () => { console.log(`🚀 Конвейерный зрячий шлюз запущен на порту ${PORT}`); });
