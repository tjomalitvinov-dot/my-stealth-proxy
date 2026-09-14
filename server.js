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

// Глобальное хранилище прокси в ОЗУ
let GLOBAL_PROXY_POOL = [];

// Функция авто-сбора свежих прокси
const downloadFreshProxies = async () => {
    try {
        console.log("📥 Авто-сборщик: скачиваем свежие бесплатные IP...");
        const response = await axios.get('https://proxyscrape.com', { timeout: 6000 });
        
        if (response.data && typeof response.data === 'string') {
            const cleanIPs = response.data.split('\r\n')
                .map(line => line.trim())
                // СТРОГАЯ ВАЛИДАЦИЯ: Пропускаем только строки, которые состоят строго из цифр, точек и двоеточия (защита от HTML-каши)
                .filter(line => /^([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}):([0-9]{2,5})$/.test(line));
            
            if (cleanIPs.length > 0) {
                GLOBAL_PROXY_POOL = cleanIPs;
                console.log(`🔥 [POOL UPDATE] Успешно загружено ${GLOBAL_PROXY_POOL.length} чистых IP-нод!`);
                return;
            }
        }
    } catch (e) {
        console.error("⚠️ Авто-сборщик не смог обновить базу: " + e.message);
    }

    if (GLOBAL_PROXY_POOL.length === 0) {
        GLOBAL_PROXY_POOL = ["80.74.54.148:3128", "157.90.10.50:80", "85.214.107.177:80"];
    }
};

// Ротация пула в фоне каждые 15 минут
setInterval(downloadFreshProxies, 15 * 60 * 1000);
downloadFreshProxies();

const handleParse = async (req, res) => {
    const targetUrl = req.query.url || req.body?.url;
    if (!targetUrl) return res.status(400).send("<h1>Ошибка: Параметр ?url= не найден!</h1>");
    
    console.log(`📡 Поступил запрос на парсинг: ${targetUrl}`);
    
    // Безопасная копия пула
    let currentAttemptPool = [...GLOBAL_PROXY_POOL].filter(line => /^([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}):([0-9]{2,5})$/.test(line));
    let badProxiesReport = [];
    let cleanHtmlOutput = null;

    // Делаем максимум 12 попыток перебора на один запрос
    const maxLoops = Math.min(currentAttemptPool.length, 12);
    console.log(`🚀 [DOCKER AUTOMATION] Начинаем перебор из ${maxLoops} случайных свежих авто-нод...`);

    for (let i = 0; i < maxLoops; i++) {
        if (currentAttemptPool.length === 0) break;

        const randomIndex = Math.floor(Math.random() * currentAttemptPool.length);
        const currentProxy = currentAttemptPool[randomIndex];
        currentAttemptPool.splice(randomIndex, 1);

        // Еще одна проверка, что нам не подсунуло кусок HTML
        if (!currentProxy || typeof currentProxy !== 'string' || currentProxy.includes('<')) {
            continue;
        }

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
                    '--lang=de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7',
                    '--disable-blink-features=AutomationControlled'
                ] 
            });
            
            const page = await browser.newPage();
            
            // Маскировка под реального пользователя
            await page.evaluateOnNewDocument(() => {
                Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            });

            await page.setUserAgent(selectedUA);
            await page.setViewport({ width: 1920, height: 1080 });
            
            await page.setExtraHTTPHeaders({
                'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Upgrade-Insecure-Requests': '1',
                'Cache-Control': 'max-age=0'
            });
            
            // Ставим 10 секунд на ожидание ответа от прокси
            await page.setDefaultNavigationTimeout(10000); 
            
            // ИСПРАВЛЕНО: Ждем networkidle2, чтобы подгрузились все аякс-запросы цен LEGO
            await page.goto(targetUrl, { waitUntil: 'networkidle2' });
            
            // ИСПРАВЛЕНО: Делаем мягкий скролл и жестко ждем 3 секунды для генерации скриптов Next.js цен
            await page.evaluate(() => { window.scrollBy(0, 400); });
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            cleanHtmlOutput = await page.content();
            
            // Если прокси пропустил вместо сайта ошибку или пустой лист
            if (cleanHtmlOutput.includes('403 Forbidden') || cleanHtmlOutput.includes('Access Denied') || cleanHtmlOutput.length < 5000) {
                throw new Error("Сайт заблокировал этот IP (Код 403 / Заглушка защиты)");
            }

            console.log(`✅ ПОБЕДА! Страница успешно считана через бесплатный IP: ${proxyServerUrl}`);
            await browser.close();
            break; 

        } catch (error) {
            console.error(`❌ Сбой ноды ${proxyServerUrl}: ${error.message}`);
            badProxiesReport.push({ ip: currentProxy, error: error.message });
            
            // Удаляем этот мертвый IP из глобальной памяти навсегда
            GLOBAL_PROXY_POOL = GLOBAL_PROXY_POOL.filter(ip => ip !== currentProxy);
        } finally {
            if (browser !== null) {
                try { await browser.close(); } catch (e) {}
            }
        }
    }

    if (!cleanHtmlOutput) {
        res.setHeader('Content-Type', 'text/html; charset=UTF-8');
        let errorHtml = `<h1>❌ Все авто-прокси из текущего пула не смогли пробить сайт!</h1><h3>Лог мясорубки чекера:</h3><ul>`;
        badProxiesReport.forEach(item => {
            errorHtml += `<li><b>${item.ip}</b> — <span style="color:red;">${item.error}</span></li>`;
        });
        errorHtml += `</ul><p>Обновите страницу. Скрипт автоматически возьмет другие 12 IP из пула!</p>`;
        return res.status(502).send(errorHtml);
    }

    res.setHeader('Content-Type', 'text/html; charset=UTF-8');
    return res.send(cleanHtmlOutput);
};

app.get('/parse', handleParse);
app.post('/parse', express.json(), handleParse);

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => { console.log(`🚀 Железобетонный авто-чекер запущен на порту ${PORT}`); });

