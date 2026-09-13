const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());
const app = express();

const handleParse = async (req, res) => {
    const targetUrl = req.query.url || req.body?.url;
    if (!targetUrl) return res.status(400).send("ОШИБКА: Пропущен параметр url!");
    
    const skuMatch = targetUrl.match(/-(\d+)\b/);
    const productSku = skuMatch ? skuMatch : "Unknown";

    const login = "qkldfjel";
    const pass = "vocepvsvpszv";
    const rawIps = [
        "157.90.10.50:80", "85.214.107.177:80", "94.79.152.14:80", "185.85.111.18:80"
    ];

    const shuffledIps = rawIps.sort(() => Math.random() - 0.5);
    console.log(`📡 [DOCKER TRACKER] Начинаем прогон пула из ${shuffledIps.length} нод...`);
    
    let successHtml = null;
    let badProxiesList = []; // Массив для сбора плохих IP в рамках ЭТОГО запроса

    for (let i = 0; i < shuffledIps.length; i++) {
        const currentIp = shuffledIps[i];
        const proxyServerUrl = "http://" + currentIp;
        
        console.log(`🔄 Проверка №${i + 1}/${shuffledIps.length}. Нода: ${currentIp}...`);
        
        let browser = null;
        try {
            browser = await puppeteer.launch({ 
                headless: true, 
                executablePath: '/usr/bin/google-chrome', 
                args: [
                    '--no-sandbox', '--disable-setuid-sandbox', `--proxy-server=${proxyServerUrl}`, 
                    '--disable-blink-features=AutomationControlled', '--disable-dev-shm-usage', '--disable-gpu',
                    '--disable-peer-connection-id-generator', '--disable-webrtc-encryption'
                ] 
            });
            const page = await browser.newPage();
            await page.authenticate({ username: login, password: pass });
            
            // Диета ОЗУ: блокируем мусор
            await page.setRequestInterception(true);
            page.on('request', (request) => {
                if (['image', 'stylesheet', 'font', 'media', 'svg'].includes(request.resourceType())) {
                    request.abort();
                } else {
                    request.continue();
                }
            });

            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
            await page.setDefaultNavigationTimeout(15000); // 15 секунд лимит на ноду
            
            const response = await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
            const httpStatus = response ? response.status() : "Unknown";
            
            await new Promise(resolve => setTimeout(resolve, 3500));
            const htmlContent = await page.content();
            
            const hasNextData = htmlContent.includes('__NEXT_DATA__') || htmlContent.includes('__INITIAL_STATE__') || htmlContent.toLowerCase().includes('price');
            const titleMatch = htmlContent.match(/<title>([^<]+)<\/title>/i);
            const pageTitle = titleMatch ? titleMatch[1] : "Без заголовка";

            // Если зашли успешно и нашли данные
            if (httpStatus === 200 && hasNextData && !pageTitle.toLowerCase().includes('access denied') && !pageTitle.toLowerCase().includes('just a moment')) {
                console.log(`🎯 [ПРОБИТИЕ] Нода ${currentIp} зашла! Заголовок: "${pageTitle}"`);
                successHtml = htmlContent;
                await browser.close();
                break; 
            } else {
                let reason = "Пустой HTML / Нет маркеров данных";
                if (pageTitle.toLowerCase().includes('just a moment')) reason = "Cloudflare Turnstile Заглушка";
                if (pageTitle.toLowerCase().includes('access denied')) reason = "PerimeterX Access Denied";
                if (httpStatus === 402) reason = "Провайдер: Нет баланса (402 Payment Required)";
                if (httpStatus === 403) reason = "Забанен сайтом (403 Forbidden)";
                
                console.warn(`⚠️ Нода ${currentIp} забракована: ${reason}`);
                // Добавляем ноду и причину в массив через двоеточие
                badProxiesList.push(`${currentIp}::${reason} (HTTP ${httpStatus})`);
            }
            
        } catch (error) {
            console.warn(`❌ Нода ${currentIp} упала: ${error.message}`);
            badProxiesList.push(`${currentIp}::Крах соединения (${error.message})`);
        } finally {
            if (browser !== null) { try { await browser.close(); } catch(e) {} }
        }
    }

    // Отправляем массив плохих IP обратно в Google Таблицу через кастомные заголовки
    // Переводим массив в строку, разделенную знаком "||"
    res.setHeader('X-Bad-Proxies', badProxiesList.join('||'));

    if (successHtml !== null) {
        res.setHeader('Content-Type', 'text/html; charset=UTF-8');
        return res.send(successHtml);
    } else {
        res.setHeader('Content-Type', 'text/plain; charset=UTF-8');
        return res.status(500).send(`[КРАХ ПУЛА] Ни один прокси не пробил защиту.\n\nПроверенные плохие ноды переданы на лист Bad_IPs.`);
    }
};

app.get('/parse', handleParse);
app.post('/parse', express.json(), handleParse);

const PORT = process.env.PORT || 7860;
app.listen(PORT, () => { console.log(`🚀 Docker конвейер с дефектовкой IP запущен на порту ${PORT}`); });

