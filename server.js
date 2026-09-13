const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const axios = require('axios'); // Подключаем axios для авто-скачивания списков

puppeteer.use(StealthPlugin());
const app = express();

const handleParse = async (req, res) => {
    const targetUrl = req.query.url || req.body?.url;
    if (!targetUrl) return res.status(400).send("ОШИБКА: Пропущен параметр url!");
    
    const skuMatch = targetUrl.match(/-(\d+)\b/);
    const productSku = skuMatch ? skuMatch : null;

    let rawIps = [];
    
    // === ХАКЕРСКИЙ АВТО-ЗАГРУЗЧИК СВЕЖИХ IP ИЗ ИНТЕРНЕТА ===
    try {
        console.log("📡 Подключаемся к глобальному No-Code пулу прокси...");
        // Скачиваем текстовый список прокси (HTTP, таймаут до 4 сек, из любых стран) в один клик!
        const proxySource = await axios.get('https://proxyscrape.com', { timeout: 5000 });
        
        if (proxySource.data && proxySource.data.trim() !== "") {
            // Разбиваем полученный текст по строкам, очищая от пустых пробелов
            rawIps = proxySource.data.split('\n').map(ip => ip.trim()).filter(ip => ip.length > 0);
            console.log(`✅ Успешно скачан свежий пул из ${rawIps.length} живых прокси-нод!`);
        }
    } catch (apiErr) {
        console.warn("⚠️ Внешнее API прокси недоступно, используем аварийный резервный список...");
        // Наш старый резервный список, если сайт упадет
        rawIps = ["157.90.10.50:80", "85.214.107.177:80", "94.79.152.14:80", "185.85.111.18:80", "66.151.34.89:80"];
    }

    // Перемешиваем скачанные IP случайным образом
    const shuffledIps = rawIps.sort(() => Math.random() - 0.5);
    // Берем для этого запроса первые 15 случайных свежих нод, чтобы не висеть долго
    const finalBatchIps = shuffledIps.slice(0, 15);
    
    console.log(`📡 [DOCKER AUTOMATION] Запуск мясорубки из ${finalBatchIps.length} случайных живых нод...`);
    
    let successHtml = null;
    let errorHistory = [];

    for (let i = 0; i < finalBatchIps.length; i++) {
        const currentIp = finalBatchIps[i];
        const proxyServerUrl = "http://" + currentIp;
        
        console.log(`🔄 Попытка №${i + 1}/${finalBatchIps.length}. Запуск Docker-Chrome через авто-ноду: ${currentIp}...`);
        
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
            
            // Диета ОЗУ
            await page.setRequestInterception(true);
            page.on('request', (request) => {
                if (['image', 'stylesheet', 'font', 'media', 'svg'].includes(request.resourceType())) {
                    request.abort();
                } else {
                    request.continue();
                }
            });

            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
            await page.setDefaultNavigationTimeout(4500); // 4.5 секунды лимит на ноду
            
            const response = await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
            const httpStatus = response ? response.status() : "Unknown";
            
            await new Promise(resolve => setTimeout(resolve, 3500));
            const htmlContent = await page.content();
            
            const hasNextData = htmlContent.includes('__NEXT_DATA__') || htmlContent.includes('__INITIAL_STATE__') || htmlContent.toLowerCase().includes('price');
            const titleMatch = htmlContent.match(/<title>([^<]+)<\/title>/i);
            const pageTitle = titleMatch ? titleMatch[1] : "Без заголовка";

            if (httpStatus === 200 && hasNextData && !pageTitle.toLowerCase().includes('access denied') && !pageTitle.toLowerCase().includes('just a moment')) {
                console.log(`🎯 [УСПЕХ] Авто-нода ${currentIp} пробила защиту! Заголовок: "${pageTitle}"`);
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
        console.error("💀 КРАХ СЕРВЕРА: Весь авто-пул прокси лег.");
        res.setHeader('Content-Type', 'text/plain; charset=UTF-8');
        return res.status(500).send(`[ТОТАЛЬНЫЙ КРАХ DOCKER-СЕРВЕРА] Ни один авто-скачанный Chrome прокси не смог пробить защиту сайта.\n\nЖУРНАЛ ДЕФЕКТОВКИ НОД:\n${errorHistory.join('\n')}`);
    }
};

app.get('/parse', handleParse);
app.post('/parse', express.json(), handleParse);

const PORT = process.env.PORT || 7860;
app.listen(PORT, () => { console.log(`🚀 Автономный бессмертный конвейер прокси запущен на порту ${PORT}`); });


