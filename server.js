const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const axios = require('axios'); // Нужен для авто-скачивания свежих IP

puppeteer.use(StealthPlugin());
const puppeteerCore = require('puppeteer-core');
const app = express();

const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
];

// Функция, которая стягивает свежие бесплатные IP, которые обновились пару минут назад
const getFreshFreeProxies = async () => {
    try {
        // Скачиваем проверенный бесплатный список прокси (HTTP/HTTPS)
        const response = await axios.get('https://proxyscrape.com', { timeout: 5000 });
        if (response.data && typeof response.data === 'string') {
            const ips = response.data.split('\r\n').filter(line => line.trim() !== '');
            console.log(`✅ Успешно скачан свежий пул из ${ips.length} живых прокси-нод!`);
            return ips;
        }
    } catch (e) {
        console.error('⚠️ Не удалось скачать пул автоматически, берем резервный список');
    }
    // Резервный список на случай, если паблик-база упала
    return ["31.59.20.176:6754", "45.38.107.97:6014", "64.137.96.74:6641"];
};

const handleParse = async (req, res) => {
    const targetUrl = req.query.url || req.body?.url;
    if (!targetUrl) return res.status(400).send("<h1>Ошибка: Параметр ?url= не найден!</h1>");
    
    console.log(`📡 Заходим на живой сайт: ${targetUrl}`);
    
    // Автоматически получаем свежайшие прокси из сети
    console.log(`📡 Подключаемся к глобальному No-Code пулу прокси...`);
    const rawIps = await getFreshFreeProxies();
    
    let badProxiesReport = [];
    let cleanHtmlOutput = null;

    // Ограничим мясорубку максимум 12 случайными нодами из скачанных сотен, чтобы запрос не шел вечность
    const maxAttempts = Math.min(rawIps.length, 12);
    console.log(`📡 [DOCKER AUTOMATION] Запуск мясорубки из ${maxAttempts} случайных живых нод...`);

    for (let i = 0; i < maxAttempts; i++) {
        // Берем случайный IP из свежескачанной базы
        const randomIndex = Math.floor(Math.random() * rawIps.length);
        const currentIp = rawIps[randomIndex];
        // Удаляем выбранный, чтобы не повторяться
        rawIps.splice(randomIndex, 1);

        const proxyServerUrl = "http://" + currentIp;
        let browser = null;

        console.log(`🔄 Попытка №${i + 1}/${maxAttempts}. Запуск Docker-Chrome через авто-ноду: ${currentIp}`);
        
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
                    '--single-process', 
                    '--no-zygote',
                    '--lang=ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7'
                ] 
            });
            
            const page = await browser.newPage();
            
            // Бесплатные паблик-прокси НЕ имеют логина и пароля, заходим напрямую!
            await page.setUserAgent(selectedUA);
            await page.setViewport({ width: 1440, height: 900 });
            
            // Жесткий таймаут в 4.5 секунды. Если бесплатный IP тупит — сразу бросаем его и берем следующий
            await page.setDefaultNavigationTimeout(4500); 
            
            await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
            
            cleanHtmlOutput = await page.content();
            
            // Проверяем, не подсунул ли сайт заглушку блокировки Cloudflare
            if (cleanHtmlOutput.includes('cloudflare') || cleanHtmlOutput.includes('Turnstile') || cleanHtmlOutput.includes('403 Forbidden')) {
                throw new Error("Блокировка Cloudflare Turnstile (HTTP 403)");
            }

            console.log(`✅ Победили! Сайт успешно взломан и скачан через ноду: ${currentIp}`);
            await browser.close();
            break; // Выходим, цель достигнута!

        } catch (error) {
            console.error(`❌ Сбой соединения (${error.message})`);
            badProxiesReport.push({ ip: currentIp, error: error.message });
        } finally {
            if (browser !== null) {
                try { await browser.close(); } catch (e) {}
            }
        }
    }

    // Если все 12 свежих попыток провалились
    if (!cleanHtmlOutput) {
        res.setHeader('Content-Type', 'text/html; charset=UTF-8');
        let errorHtml = `<h1>❌ Все прокси-ноды из пула лежат!</h1><h3>Отчет о нерабочих нодах:</h3><ul>`;
        badProxiesReport.forEach(item => {
            errorHtml += `<li><b>${item.ip}</b> — <span style="color:red;">${item.error}</span></li>`;
        });
        errorHtml += `</ul><p>Попробуйте обновить страницу, скрипт скачает совершенно другие IP!</p>`;
        return res.status(502).send(errorHtml);
    }

    res.setHeader('Content-Type', 'text/html; charset=UTF-8');
    return res.send(cleanHtmlOutput);
};

app.get('/parse', handleParse);
app.post('/parse', express.json(), handleParse);

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => { console.log(`🚀 Автономный бессмертный конвейер прокси запущен на порту ${PORT}`); });




