const express = require('express');
const { chromium } = require('playwright-extra');
const stealthPlugin = require('puppeteer-extra-plugin-stealth');
const axios = require('axios');

chromium.use(stealthPlugin());

const app = express();
app.use(express.json());

let cachedFreeProxies = [];
let lastFetchTime = 0;

// 🕵️‍♂️ НЕУБИВАЕМЫЙ ТЕКСТОВЫЙ СБОРЩИК
const fetchFreeListDirectly = async () => {
    const now = Date.now();
    // Держим кэш в памяти 5 минут
    if (cachedFreeProxies.length > 0 && (now - lastFetchTime) < 5 * 60 * 1000) {
        return cachedFreeProxies;
    }

    console.log("🔄 Кэш пуст. Загрузка текстовых листов IP с GitHub-баз...");
    
    // Список текстовых URL, которые отдают голые IP:PORT без капчи Cloudflare
    const sources = [
        'https://githubusercontent.com',
        'https://githubusercontent.com',
        'https://githubusercontent.com'
    ];

    let allRawText = "";
    for (const source of sources) {
        try {
            const response = await axios.get(source, { timeout: 4000 });
            if (response.data && typeof response.data === 'string') {
                allRawText += "\n" + response.data;
            }
        } catch (e) {
            console.warn(`⚠️ База ${source} временно недоступна, берем следующую.`);
        }
    }

    if (allRawText.length > 10) {
        // Вырезаем регуляркой все чистые паттерны вида IP:PORT
        const parsed = allRawText.split(/[\s\n\r]+/)
            .map(item => item.trim())
            .filter(item => item.includes(':') && item.match(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}:\d{2,5}\$/));

        if (parsed.length > 0) {
            // Удаляем дубликаты IP из общего списка
            cachedFreeProxies = [...new Set(parsed)];
            lastFetchTime = now;
            console.log(`✅ ТЕСТ СБОРЩИКА: Из GitHub баз успешно извлечено ${cachedFreeProxies.length} уникальных IP-адресов.`);
            return cachedFreeProxies;
        }
    }
    
    return cachedFreeProxies;
};

const handleParse = async (req, res) => {
    const targetUrl = req.query.url || req.body?.url;
    if (!targetUrl) return res.status(400).send("<h1>Помилка: Параметр url не знайдено!</h1>");

    console.log(`📡 [КОНВЕЙЕР] Запрос к сайту: ${targetUrl}`);
    let proxyPool = await fetchFreeListDirectly();

    let renderedHtmlOutput = null;
    let badProxiesReport = [];

    if (proxyPool.length === 0) {
        console.log("⚠️ Пул пуст. Пробуем напрямую.");
        proxyPool = [null];
    }

    // 🔥 ЧЕСТНЫЙ ПЕРЕБОР: Прогоняем до 15 разных IP подряд из скачанного списка!
    const totalAttempts = Math.min(proxyPool.length, 15);
    console.log(`🚀 Старт ротации. Конвейер проверит до ${totalAttempts} IP по очереди.`);

    for (let i = 0; i < totalAttempts; i++) {
        const currentProxy = proxyPool[i];
        console.log(`🔎 [УЗЕЛ №${i + 1}/${totalAttempts}] Пробуем узел: ${currentProxy || 'Direct'}`);

        let browser = null;
        try {
            browser = await chromium.launch({
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-blink-features=AutomationControlled',
                    '--lang=de-DE,de;q=0.9'
                ],
                proxy: currentProxy ? { server: `http://${currentProxy}` } : undefined
            });

            const context = await browser.newContext({
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
                locale: 'de-DE',
                timezoneId: 'Europe/Berlin',
                viewport: { width: 1280, height: 720 }
            });

            const page = await context.newPage();

            await page.route('**/*', (route) => {
                if (['image', 'media', 'font', 'analytics'].includes(route.request().resourceType())) {
                    route.abort();
                } else {
                    route.continue();
                }
            });

            await page.evaluate(() => { Object.defineProperty(navigator, 'webdriver', { get: () => undefined }); });

            // Каждому IP даем 10 секунд на попытку
            await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
            await page.waitForTimeout(4000); 

            const content = await page.content();

            if (content.includes('Sicherheitsüberprüfung') || content.includes('Access Denied') || content.includes('403 Forbidden') || content.includes('captcha')) {
                throw new Error("Заблокировано Cloudflare Turnstile Challenge.");
            }

            console.log(`🎉 [УСПЕХ КОНВЕЙЕРА] На шаге №${i + 1} узел успешно пробил защиту!`);
            renderedHtmlOutput = content;
            await browser.close();
            break; // Рабочий IP найден — прерываем цикл и отдаем HTML!

        } catch (error) {
            console.error(`❌ [СБОЙ УЗЛА №${i + 1}] Ошибка на ${currentProxy || 'Direct'}: ${error.message}`);
            badProxiesReport.push({ ip: currentProxy || 'Direct', error: error.message });
            
            if (currentProxy) {
                cachedFreeProxies = cachedFreeProxies.filter(p => p !== currentProxy);
            }
        } finally {
            if (browser) await browser.close();
        }
    }

    if (!renderedHtmlOutput) {
        res.setHeader('Content-Type', 'text/html; charset=UTF-8');
        let errorHtml = `<h1>🚨 Все протестированные бесплатные IP из списка (${totalAttempts} шт.) заблокированы Cloudflare</h1><h3>Лог пошаговых тестов конвейера:</h3><ul>`;
        badProxiesReport.forEach(item => {
            errorHtml += `<li><b>${item.ip}</b> — <span style="color:red;">${item.error}</span></li>`;
        });
        errorHtml += `</ul>`;
        return res.status(502).send(errorHtml);
    }

    res.setHeader('Content-Type', 'text/html; charset=UTF-8');
    return res.send(renderedHtmlOutput);
};

app.get('/refresh-list', async (req, res) => {
    cachedFreeProxies = [];
    await fetchFreeListDirectly();
    res.send(`Кэш сброшен. Из текстовых баз загружено новых IP: ${cachedFreeProxies.length}`);
});

app.get('/parse', handleParse);
app.post('/parse', handleParse);
app.get('/', (req, res) => res.send(`Автономний Stealth-міст з автосбором IP працює! В пуле: ${cachedFreeProxies.length}`));

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Сервер запущен на порту ${PORT}`));
