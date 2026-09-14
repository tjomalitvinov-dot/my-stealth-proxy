const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const axios = require('axios');

puppeteer.use(StealthPlugin());
const puppeteerCore = require('puppeteer-core');
const app = express();

const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
];

// Глобальное хранилище для прокси прямо в оперативной памяти сервера
let GLOBAL_PROXY_POOL = [];

// Фоновая функция автоматического сбора свежих IP
const downloadFreshProxies = async () => {
    try {
        console.log("📥 Авто-сборщик: скачиваем свежие бесплатные IP...");
        // Скачиваем сырой список в формате IP:Порт напрямую с бесплатного провайдера
        const response = await axios.get('https://proxyscrape.com', { timeout: 8000 });
        
        if (response.data && typeof response.data === 'string') {
            const cleanIPs = response.data.split('\r\n')
                .map(line => line.trim())
                .filter(line => line.includes(':') && !line.startsWith('0.0.0.0') && !line.startsWith('127.0.0.7'));
            
            if (cleanIPs.length > 0) {
                GLOBAL_PROXY_POOL = cleanIPs;
                console.log(`🔥 [POOL UPDATE] Успешно загружено ${GLOBAL_PROXY_POOL.length} свежих бесплатных IP-нод!`);
                return;
            }
        }
    } catch (e) {
        console.error("⚠️ Авто-сборщик не смог обновить базу: " + e.message);
    }

    // Если сеть упала, оставляем старый проверенный резерв
    if (GLOBAL_PROXY_POOL.length === 0) {
        GLOBAL_PROXY_POOL = ["80.74.54.148:3128", "157.90.10.50:80", "85.214.107.177:80"];
    }
};

// Запускаем автоматическое обновление пула каждые 15 минут (900 000 миллисекунд)
setInterval(downloadFreshProxies, 15 * 60 * 1000);

// Принудительно скачиваем базу один раз прямо при холодном старте сервера на Render
downloadFreshProxies();

const handleParse = async (req, res) => {
    const targetUrl = req.query.url || req.body?.url;
    if (!targetUrl) return res.status(400).send("<h1>Ошибка: Параметр ?url= не найден!</h1>");
    
    console.log(`📡 Поступил запрос на парсинг: ${targetUrl}`);
    
    // Делаем копию пула для текущего запроса, чтобы безопасно вычеркивать мертвые IP
    let currentAttemptPool = [...GLOBAL_PROXY_POOL];
    let badProxiesReport = [];
    let cleanHtmlOutput = null;

    // Скрипт сделает максимум 15 попыток пробить сайт через разные живые IP
    const maxLoops = Math.min(currentAttemptPool.length, 15);
    console.log(`🚀 [DOCKER AUTOMATION] Начинаем перебор из ${maxLoops} случайных свежих авто-нод...`);

    for (let i = 0; i < maxLoops; i++) {
        // Берем случайный IP из свежих скачанных, чтобы распределять нагрузку
        const randomIndex = Math.floor(Math.random() * currentAttemptPool.length);
        const currentProxy = currentAttemptPool[randomIndex];
        // Убираем его из пула попыток, чтобы не тестировать дважды
        currentAttemptPool.splice(randomIndex, 1);

        const proxyServerUrl = "http://" + currentProxy;
        let browser = null;

        console.log(`🔄 Попытка №${i + 1}/${maxLoops}. Открываем Docker-Chrome через ноду: ${proxyServerUrl}`);
        
        try {
            const selectedUA = userAgents[Math.floor(Math.random() * userAgents.length)];

            browser = await puppeteerCore.launch({ 
                executablePath: '/usr/bin/google-chrome-stable', 
                headless: true, 
                args: [
                    '--no-sandbox', 
                    '--disable-setuid-sandbox', 
                    `--proxy-server=${proxyServerUrl}`,
                    '--disable-dev-shm-usage', 
                    '--disable-gpu',
                    '--start-maximized',
                    '--single-process', 
                    '--no-zygote',
                    '--lang=de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7' // Маскировка под Германию для LEGO
                ] 
            });
            
            const page = await browser.newPage();
            await page.setUserAgent(selectedUA);
            await page.setViewport({ width: 1440, height: 900 });
            
            await page.setExtraHTTPHeaders({
                'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Upgrade-Insecure-Requests': '1'
            });
            
            // Ставим жесткий таймаут 6.5 секунд. Если бесплатный IP медленный — сбрасываем, берем следующий
            await page.setDefaultNavigationTimeout(6500); 
            
            // Пробуем зайти на сайт
            await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
            
            cleanHtmlOutput = await page.content();
            
            // Если прокси рабочий, но сайт выдал пустую страницу или защиту Cloudflare
            if (cleanHtmlOutput.includes('403 Forbidden') || cleanHtmlOutput.includes('Access Denied') || cleanHtmlOutput.length < 1500) {
                throw new Error("Сайт заблокировал этот IP (Код 403 / Заглушка защиты)");
            }

            console.log(`✅ ПОБЕДА! Страница успешно считана через бесплатный IP: ${proxyServerUrl}`);
            await browser.close();
            break; // Успех, выходим из цикла!

        } catch (error) {
            console.error(`❌ Сбой ноды ${proxyServerUrl}: ${error.message}`);
            badProxiesReport.push({ ip: proxyServerUrl, error: error.message });
            
            // УДАЛЯЕМ МЕРТВЫЙ IP из глобального пула навсегда, чтобы другие запросы на него не натыкались!
            GLOBAL_PROXY_POOL = GLOBAL_PROXY_POOL.filter(ip => ip !== currentProxy);
        } finally {
            if (browser !== null) {
                try { await browser.close(); } catch (e) {}
            }
        }
    }

    // Если все 15 свежих попыток из пула не смогли открыть сайт
    if (!cleanHtmlOutput) {
        res.setHeader('Content-Type', 'text/html; charset=UTF-8');
        let errorHtml = `<h1>❌ Все авто-прокси из текущего пула не смогли пробить сайт!</h1><h3>Лог мясорубки чекера:</h3><ul>`;
        badProxiesReport.forEach(item => {
            errorHtml += `<li><b>${item.ip}</b> — <span style="color:red;">${item.error}</span></li>`;
        });
        errorHtml += `</ul><p>Обновите страницу. Скрипт автоматически возьмет другие 15 IP из пула!</p>`;
        return res.status(502).send(errorHtml);
    }

    res.setHeader('Content-Type', 'text/html; charset=UTF-8');
    return res.send(cleanHtmlOutput);
};

app.get('/parse', handleParse);
app.post('/parse', express.json(), handleParse);

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => { console.log(`🚀 Бессмертный авто-чекер запущен на порту ${PORT}`); });

