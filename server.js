const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());
const app = express();

const handleParse = async (req, res) => {
    const targetUrl = req.query.url || req.body?.url;
    if (!targetUrl) return res.status(400).send("ОШИБКА: Пропущен параметр url!");
    
    const skuMatch = targetUrl.match(/-(\d+)\b/);
    const productSku = skuMatch ? skuMatch : null;

    const login = "qkldfjel";
    const pass = "vocepvsvpszv";
    const rawIps = [
        "31.59.20.176:6754", "45.38.107.97:6014", "64.137.96.74:6641", "198.23.243.226:6361"
    ];

    const shuffledIps = rawIps.sort(() => Math.random() - 0.5);
    console.log(`📡 [DOCKER SPEED CONVEYOR] Анализ пула из ${shuffledIps.length} нод...`);
    
    let successHtml = null;
    let errorHistory = [];

    for (let i = 0; i < shuffledIps.length; i++) {
        const currentIp = shuffledIps[i];
        const proxyServerUrl = "http://" + currentIp;
        
        console.log(`🔄 Попытка №${i + 1}/${shuffledIps.length}. Запуск Docker-Chrome через ноду: ${currentIp}...`);
        
        let browser = null;
        try {
            browser = await puppeteer.launch({ 
                headless: true, 
                executablePath: '/usr/bin/google-chrome', 
                args: [
                    '--no-sandbox', '--disable-setuid-sandbox', `--proxy-server=${proxyServerUrl}`, 
                    '--disable-blink-features=AutomationControlled', '--disable-dev-shm-usage', '--disable-gpu',
                    '--disable-peer-connection-id-generator', '--disable-webrtc-encryption',
                    '--accept-lang=nl-NL,nl,de-DE,de,en-US,en'
                ] 
            });
            const page = await browser.newPage();
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
                Object.defineProperty(navigator, 'languages', { get: () => ['nl-NL', 'nl', 'de-DE', 'de'] });
            });
            
            // СКОРОСТНОЙ АПГРЕЙД: Ставим лимит 4.5 секунды на ноду. Сервер больше никогда не уйдет в тайм-аут 502!
            await page.setDefaultNavigationTimeout(4500); 
            
            const response = await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
            const httpStatus = response ? response.status() : "Unknown";
            
            await new Promise(resolve => setTimeout(resolve, 3500));
            const htmlContent = await page.content();
            
            const hasNextData = htmlContent.includes('__NEXT_DATA__') || htmlContent.includes('__INITIAL_STATE__') || htmlContent.toLowerCase().includes('price');
            const titleMatch = htmlContent.match(/<title>([^<]+)<\/title>/i);
            const pageTitle = titleMatch ? titleMatch[1] : "Без заголовка";

            if (httpStatus === 200 && hasNextData && !pageTitle.toLowerCase().includes('access denied') && !pageTitle.toLowerCase().includes('just a moment')) {
                console.log(`🎯 [УСПЕХ] Нода ${currentIp} взяла сайт! Заголовок: "${pageTitle}"`);
                successHtml = htmlContent;
                await browser.close();
                break; 
            } else {
                let reason = `Пустой кэш. Экран: "${pageTitle}"`;
                if (pageTitle.toLowerCase().includes('just a moment')) reason = "Блокировка Cloudflare Turnstile";
                if (pageTitle.toLowerCase().includes('access denied')) reason = "Блокировка PerimeterX";
                
                const errorMsg = `${currentIp}::${reason} (HTTP ${httpStatus})`;
                console.warn(`⚠️ ${errorMsg}`);
                errorHistory.push(errorMsg);
            }
            
        } catch (error) {
            const errorMsg = `${currentIp}::Сбой соединения (${error.message})`;
            console.warn(`❌ ${errorMsg}`);
            errorHistory.push(errorMsg);
        } finally {
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
        console.error("💀 КРАХ СЕРВЕРА: Весь пул прокси лег.");
        res.setHeader('Content-Type', 'text/plain; charset=UTF-8');
        return res.status(500).send(`[ТОТАЛЬНЫЙ КРАХ DOCKER-СЕРВЕРА] Ни один маскированный Chrome через весь пул IP не смог пробить защиту сайта.\n\nЖУРНАЛ ДЕФЕКТОВКИ НОД:\n${errorHistory.join('\n')}`);
    }
};

app.get('/parse', handleParse);
app.post('/parse', express.json(), handleParse);

const PORT = process.env.PORT || 7860;
app.listen(PORT, () => { console.log(`🚀 Скоростной Docker Chrome-конвейер запущен на порту ${PORT}`); });


const PORT = process.env.PORT || 7860;
app.listen(PORT, () => { console.log(`🚀 Docker конвейер с дефектовкой IP запущен на порту ${PORT}`); });
