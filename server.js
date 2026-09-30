const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const axios = require('axios'); 

puppeteer.use(StealthPlugin());
const app = express();
app.use(express.json());

const handleParse = async (req, res) => {
    const targetUrl = req.query.url || req.body?.url;
    if (!targetUrl) return res.status(400).send("<h1>Ошибка: Параметр ?url= не найден!</h1>");
    
    console.log(`📡 Заходим на живой сайт: ${targetUrl}`);
    
    // Твои чистые данные авторизации Webshare
    const login = "mmnvhwqe"; 
    const pass = "pt6brfln6blc";
    
    // Твой аварийный резервный список IP
    let rawIpsList = [
       "157.90.10.50:80", "85.214.107.177:80", "94.79.152.14:80", "185.85.111.18:80", "66.151.34.89:80"
    ];

    // === АВТО-ЗАГРУЗЧИК СВЕЖИХ IP ИЗ ИНТЕРНЕТА ===
    try {
        console.log("📡 Скачиваем свежий пул живых прокси...");
        const p1 = 'https://proxyscrape.com';
        const p2 = '/v2/?request=displayproxies&protocol=http&timeout=4000&country=all&ssl=all&anonymity=anonymous';
        
        const proxySource = await axios.get(p1 + p2, { timeout: 6000 });
        
        if (proxySource.data && typeof proxySource.data === 'string') {
            const downloadedIps = proxySource.data.split(/[\s\n\r]+/)
                .map(ip => ip.trim())
                .filter(ip => ip.length > 5 && ip.includes(':'));
            
            if (downloadedIps.length > 0) {
                rawIpsList = downloadedIps;
                console.log(`✅ Успешно скачан пул из ${rawIpsList.length} прокси!`);
            }
        }
    } catch (apiErr) {
        console.warn("⚠️ Внешнее API прокси недоступно, используем аварийный резервный список...");
    }

    // Перемешиваем скачанные IP случайным образом
    const shuffledIps = rawIpsList.sort(() => Math.random() - 0.5);
    // Берем первые 15 случайных нод для "мясорубки"
    const finalBatchIps = shuffledIps.slice(0, 15);
    
    console.log(`📡 [AUTOMATION] Запуск мясорубки из ${finalBatchIps.length} нод...`);
    
    let successHtml = null;
    let errorHistory = [];

    // Главный конвейер перебора нод
    for (let i = 0; i < finalBatchIps.length; i++) {
        const currentIp = finalBatchIps[i];
        const proxyServerUrl = "http://" + currentIp;
        console.log(`🔄 Попытка №${i + 1}/${finalBatchIps.length}. Запуск Chrome через ноду: ${currentIp}...`);

        let nodeBrowser = null;
        try {
            nodeBrowser = await puppeteer.launch({ 
                headless: true, 
                args: [
                    '--no-sandbox', 
                    '--disable-setuid-sandbox', 
                    `--proxy-server=${proxyServerUrl}`, 
                    '--disable-blink-features=AutomationControlled', 
                    '--disable-dev-shm-usage', 
                    '--disable-gpu'
                ] 
            });
            
            const page = await nodeBrowser.newPage();
            
            // Диета ОЗУ (Блокируем картинки, стили и шрифты)
            await page.setRequestInterception(true);
            page.on('request', (request) => {
                if (['image', 'stylesheet', 'font', 'media', 'svg'].includes(request.resourceType())) {
                    request.abort();
                } else {
                    request.continue();
                }
            });

            // Авторизация на твоем новом рабочем прокси Webshare
            await page.authenticate({ username: login, password: pass });

            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
            await page.evaluateOnNewDocument(() => { Object.defineProperty(navigator, 'webdriver', { get: () => undefined }); });
            
            // Оптимальный таймаут 14 секунд на одну ноду, чтобы бесплатные IP успевали ответить на Render
            await page.setDefaultNavigationTimeout(14000); 
            
            const response = await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
            const httpStatus = response ? response.status() : "Unknown";
            
            // Короткая stealth-пауза
            await new Promise(resolve => setTimeout(resolve, 3500));
            const htmlContent = await page.content();
            
            const titleMatch = htmlContent.match(/<title>([^<]+)<\/title>/i);
            const pageTitle = titleMatch ? titleMatch[1] : "Без заголовка";

            // Проверка успешности захода на LEGO
            if (httpStatus === 200 && !htmlContent.includes('Access Denied') && !pageTitle.toLowerCase().includes('just a moment') && !htmlContent.includes('Sicherheitsüberprüfung')) {
                console.log(`🎯 [УСПЕХ] Нода ${currentIp} пробила защиту! Заголовок: "${pageTitle}"`);
                successHtml = htmlContent;
                await nodeBrowser.close();
                break; // Победа! Выходим из цикла ротации
            } else {
                let reason = `Экран: "${pageTitle}"`;
                if (pageTitle.toLowerCase().includes('just a moment') || htmlContent.includes('Sicherheitsüberprüfung')) reason = "Блокировка Cloudflare Turnstile";
                if (htmlContent.includes('Access Denied')) reason = "Блокировка Бот-Детектора";
                
                const errorMsg = `${currentIp}::${reason} (HTTP ${httpStatus})`;
                console.warn(`⚠️ ${errorMsg}`);
                errorHistory.push(errorMsg);
            }
            
        } catch (error) {
            const errorMsg = `${currentIp}::Сбой соединения (${error.message})`;
            console.warn(`❌ ${errorMsg}`);
            errorHistory.push(errorMsg);
        } finally {
            if (nodeBrowser !== null) {
                try { await nodeBrowser.close(); } catch(e) {}
            }
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
        return res.status(502).send(`[ТОТАЛЬНЫЙ КРАХ] Ни один прокси не смог пробить защиту сайта.\n\nЖУРНАЛ ДЕФЕКТОВКИ НОД:\n${errorHistory.join('\n')}`);
    }
};

app.get('/parse', handleParse);
app.post('/parse', handleParse);

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => { console.log(`🚀 Автономный бессмертный конвейер запущен на порту ${PORT}`); });


