const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());
const app = express();

const handleParse = async (req, res) => {
    const targetUrl = req.query.url || req.body?.url;
    if (!targetUrl) return res.status(400).send("<h1>Ошибка: Параметр url не найден!</h1>");
    
    const login = "mmnvhwqe";
    const pass = "pt6brfln6blc";
    
    // ТВОЙ СВЕЖИЙ ЧИСТЫЙ СПИСОК РАБОЧИХ НОД
    const rawIps = [
        "198.46.161.42:5092", "31.59.20.176:6754", "45.38.107.97:6014", 
        "64.137.96.74:6641", "198.23.243.226:6361", "38.154.185.97:6370", 
        "84.247.60.125:6095", "142.111.67.146:5611", "191.96.254.138:6185", "31.58.9.4:6077"
    ];
    
    const shuffledIps = rawIps.sort(() => Math.random() - 0.5);
    console.log(`📡 [DOCKER MULTI-LANG] Запуск конвейера перебора из ${shuffledIps.length} нод...`);
    
    let successHtml = null;
    let errorHistory = [];

    for (let i = 0; i < shuffledIps.length; i++) {
        const currentIp = shuffledIps[i];
        const proxyServerUrl = "http://" + currentIp;
        
        console.log(`🔄 Попытка №${i + 1}/${shuffledIps.length}. Запуск Chrome через ноду: ${currentIp}...`);
        
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
                    '--use-gl=angle',
                    '--use-angle=swiftshader', 
                    '--disable-peer-connection-id-generator',
                    '--disable-webrtc-encryption',
                    '--ignore-certificate-errors', 
                    '--window-size=1920,1080'
                    // УБРАЛИ ЖЕСТКИЙ --accept-lang! Браузер возьмет язык из плагина скрытности автоматически!
                ] 
            });
            const page = await browser.newPage();
            
            await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
            await page.authenticate({ username: login, password: pass });
            
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
                Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
                Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
                window.chrome = { runtime: {}, loadTimes: function() {}, csi: function() {} };
                
                const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
                HTMLCanvasElement.prototype.toDataURL = function() { return originalToDataURL.apply(this, arguments); };
                
                navigator.getBattery = () => Promise.resolve({ charging: true, level: 1 });
            });
            
            // Ставим короткий таймаут 7.5 секунд, чтобы быстро пролетать капчи!
            await page.setDefaultNavigationTimeout(7500);
            
            const response = await page.goto(targetUrl, { waitUntil: 'networkidle2' });
            const httpStatus = response ? response.status() : "Unknown";
            
            await new Promise(resolve => setTimeout(resolve, 4500));
            const htmlContent = await page.content();
            
            const htmlLength = htmlContent.length;
            const titleMatch = htmlContent.match(/<title>([^<]+)<\/title>/i);
            const pageTitle = titleMatch ? titleMatch[1] : "Без заголовка";
            
            const hasNextData = htmlContent.includes('__NEXT_DATA__') || htmlContent.includes('__INITIAL_STATE__');
            const isBlockPX = htmlContent.toLowerCase().includes('perimeterx') || htmlContent.includes('access denied');
            const isBlockCF = pageTitle.toLowerCase().includes('just a moment') || htmlContent.includes('cloudflare') || pageTitle.toLowerCase().includes('cloudflare');

            if (httpStatus === 200 && hasNextData && !isBlockPX && !isBlockCF && htmlLength > 35000) {
                console.log(`🎯 [ПРОБИТИЕ УСПЕШНО] Нода ${currentIp} пробила Cloudflare! Заголовок: "${pageTitle}"`);
                successHtml = htmlContent;
                await browser.close();
                break; 
            } else {
                let reason = "Пустой HTML без Next.js кэша";
                if (isBlockCF) reason = "Застрял на капче Cloudflare Turnstile (Just a moment...)";
                if (isBlockPX) reason = "Блокировка PerimeterX Access Denied";
                
                console.warn(`⚠️ Нода ${currentIp} выдала РЕЗУЛЬТАТ 0 [Причина: ${reason}]. Переключаюсь на следующий IP...`);
                errorHistory.push(`${currentIp} -> Результат 0 (${reason} | HTTP ${httpStatus})`);
                await browser.close();
            }
            
        } catch (error) {
            console.warn(`❌ Нода ${currentIp} сброшена по таймауту/ошибке: ${error.message}`);
            errorHistory.push(`${currentIp} -> Сбой соединения (${error.message})`);
            if (browser !== null) { try { await browser.close(); } catch(e) {} }
        }
    }

    if (errorHistory.length > 0) {
        res.setHeader('X-Bad-Proxies', errorHistory.join('||'));
    }

    if (successHtml !== null) {
        res.setHeader('Content-Type', 'text/html; charset=UTF-8');
        return res.send(successHtml);
    } else {
        console.error("💀 ТОТАЛЬНЫЙ КРАХ ПУЛА: Все ноды выдали результат 0.");
        res.setHeader('Content-Type', 'text/plain; charset=UTF-8');
        return res.status(500).send(`[ТОТАЛЬНЫЙ КРАХ СЕРВЕРА] Ни одна нода из пула не смогла пройти капчу.\n\nЖУРНАЛ ДЕФЕКТОВКИ НОД:\n${errorHistory.join('\n')}`);
    }
};

app.get('/parse', handleParse);
app.post('/parse', express.json(), handleParse);

const PORT = process.env.PORT || 7860;
app.listen(PORT, () => { console.log(`🚀 Всеядный бессмертный шлюз запущен на порту ${PORT}`); });
