const express = require('express');
const { chromium } = require('playwright-extra');
const stealthPlugin = require('puppeteer-extra-plugin-stealth');
const axios = require('axios');

// Активируем маскировку под человека
chromium.use(stealthPlugin());

const app = express();
app.use(express.json());

// Внутреннее кэш-хранилище для бесплатных IP
let cachedFreeProxies = [];
let lastFetchTime = 0;

// Функция для автосбора свежих бесплатных IP из открытых баз
const refreshFreeProxies = async () => {
    const now = Date.now();
    // Обновляем список не чаще, чем раз в 5 минут, чтобы не спамить провайдера
    if (cachedFreeProxies.length > 0 && (now - lastFetchTime) < 5 * 60 * 1000) {
        return cachedFreeProxies;
    }

    console.log("🔄 Кэш пуст или устарел. Сборщик ищет свежие бесплатные IP Европы...");
    try {
        // Запрашиваем только анонимные HTTP-прокси европейских стран (Германия, Нидерланды, Франция и др.)
        const url = 'https://proxyscrape.com';
        const response = await axios.get(url, { timeout: 7000 });
        
        if (response.data && typeof response.data === 'string') {
            // Разбиваем полученный текст по строкам и убираем лишние пробелы
            const parsed = response.data.split('\n')
                .map(line => line.trim())
                .filter(line => line.includes(':')); // Нам нужны только строки вида IP:PORT
            
            if (parsed.length > 0) {
                cachedFreeProxies = parsed;
                lastFetchTime = now;
                console.log(`✅ Найдено ${cachedFreeProxies.length} свежих бесплатных IP для ротации.`);
                return cachedFreeProxies;
            }
        }
    } catch (err) {
        console.error(`❌ Ошибка автосборщика проксей: ${err.message}`);
    }
    
    return cachedFreeProxies; // Если упало, возвращаем старый кэш
};

const handleParse = async (req, res) => {
    const targetUrl = req.query.url || req.body?.url;
    if (!targetUrl) return res.status(400).send("<h1>Помилка: Параметр url не знайдено!</h1>");

    console.log(`📡 [АВТО-ПАРСЕР] Запрос к сайту: ${targetUrl}`);
    
    // Получаем свежий пул бесплатных IP
    let proxyPool = await refreshFreeProxies();

    let renderedHtmlOutput = null;
    let badProxiesReport = [];

    // Если бесплатных проксей нет, делаем одну попытку напрямую
    if (proxyPool.length === 0) {
        proxyPool = [null];
    }

    // Берём первые 5 проксей из списка для быстрой ротации, чтобы не вешать скрипт
    const attempts = Math.min(proxyPool.length, 5);

    for (let i = 0; i < attempts; i++) {
        const currentProxy = proxyPool[i];
        console.log(`🔄 Попытка №${i + 1}/${attempts} ->через IP: ${currentProxy || 'Прямой IP Render'}`);

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

            // Оптимизация: отсекаем только картинки, видео и шрифты, оставляя CSS и JS для обхода Cloudflare
            await page.route('**/*', (route) => {
                const type = route.request().resourceType();
                if (['image', 'media', 'font', 'analytics'].includes(type)) {
                    route.abort();
                } else {
                    route.continue();
                }
            });

            await page.addInitScript(() => {
                Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
            });

            // Экспресс-переход с коротким таймаутом (бесплатные прокси должны отвечать быстро)
            await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
            await page.waitForTimeout(4000); // Короткая пауза для прохождения Turnstile

            const content = await page.content();

            // Проверяем, не наткнулись ли мы на заглушку Cloudflare
            if (content.includes('Sicherheitsüberprüfung') || content.includes('Access Denied') || content.includes('403 Forbidden')) {
                throw new Error("Заблокировано защитой Cloudflare Turnstile.");
            }

            console.log(`✅ УСПЕХ! Ротация сработала. HTML код передан в Google Таблицу.`);
            renderedHtmlOutput = content;
            await browser.close();
            break; // Если нашли рабочий прокси — выходим из цикла ротации

        } catch (error) {
            console.error(`❌ Збой проксі ${currentProxy || 'Direct'}: ${error.message}`);
            badProxiesReport.push({ ip: currentProxy || 'Direct', error: error.message });
            
            // Если прокси мертв, удаляем его из начала нашего кэша, чтобы больше не использовать
            if (currentProxy) {
                cachedFreeProxies = cachedFreeProxies.filter(p => p !== currentProxy);
            }
        } finally {
            if (browser) await browser.close();
        }
    }

    if (!renderedHtmlOutput) {
        res.setHeader('Content-Type', 'text/html; charset=UTF-8');
        let errorHtml = `<h1>🚨 Все бесплатные IP из пула ротации заблокированы Cloudflare</h1><h3>Лог тестов:</h3><ul>`;
        badProxiesReport.forEach(item => {
            errorHtml += `<li><b>${item.ip}</b> — <span style="color:red;">${item.error}</span></li>`;
        });
        errorHtml += `</ul>`;
        return res.status(502).send(errorHtml);
    }

    res.setHeader('Content-Type', 'text/html; charset=UTF-8');
    return res.send(renderedHtmlOutput);
};

// Эндпоинт для принудительного ручного сброса кэша и скачивания новых IP
app.get('/refresh-free-list', async (req, res) => {
    cachedFreeProxies = [];
    await refreshFreeProxies();
    res.send(`Список бесплатных IP принудительно обновлен. Сейчас в пуле: ${cachedFreeProxies.length}`);
});

app.get('/parse', handleParse);
app.post('/parse', handleParse);
app.get('/', (req, res) => res.send(`Автономний Stealth-міст з автосбором IP працює! Проксей в кэше: ${cachedFreeProxies.length}`));

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Сервер запущен на порту ${PORT}`));

