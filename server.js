const express = require('express');
const { chromium } = require('playwright-extra');
const stealthPlugin = require('puppeteer-extra-plugin-stealth');

chromium.use(stealthPlugin());

const app = express();
app.use(express.json());

let cachedFreeProxies = [];
let lastFetchTime = 0;

// 🕵️‍♂️ ПРЯМОЙ ПАРСЕР ДОНОРА: Заходит на free-proxy-list.net и вырезает текст
const fetchFreeListDirectly = async () => {
    const now = Date.now();
    if (cachedFreeProxies.length > 0 && (now - lastFetchTime) < 5 * 60 * 1000) {
        return cachedFreeProxies;
    }

    console.log("🔄 Кэш пуст. Прямой переход на free-proxy-list.net...");
    let listBrowser = null;
    try {
        listBrowser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
        const context = await listBrowser.newContext();
        const page = await context.newPage();
        
        // Ждем пока утихнет сеть, чтобы JavaScript донора успел сгенерировать IP
        await page.goto('https://free-proxy-list.net', { waitUntil: 'networkidle', timeout: 30000 });
        
        // Принудительная пауза 4 секунды для железной генерации текста в поле
        await page.waitForTimeout(4000);
        
        // 🔐 БЕЗОПАСНЫЙ СИНТАКСИС: Извлекаем текст без использования знака доллара
        const rawText = await page.evaluate(() => {
            const textarea = document.querySelector('textarea');
            return textarea ? textarea.value : '';
        });
        
        if (rawText && rawText.length > 10) {
            const parsed = rawText.split(/[\s\n\r]+/)
                .map(item => item.trim())
                .filter(item => item.includes(':') && item.match(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}:\d{2,5}\$/));

            if (parsed.length > 0) {
                cachedFreeProxies = parsed;
                lastFetchTime = now;
                console.log(`✅ Напрямую вырезано ${cachedFreeProxies.length} IP для ротации.`);
                return cachedFreeProxies;
            }
        }
    } catch (err) {
        console.error(`❌ Сбой прямого парсинга free-proxy-list.net: ${err.message}`);
    } finally {
        if (listBrowser) await listBrowser.close();
    }
    return cachedFreeProxies;
};

const handleParse = async (req, res) => {
    const targetUrl = req.query.url || req.body?.url;
    if (!targetUrl) return res.status(400).send("<h1>Помилка: Параметр url не знайдено!</h1>");

    console.log(`📡 [КОНВЕЙЕР ЗАПУЩЕН] Обработка целевой ссылки: ${targetUrl}`);
    let proxyPool = await fetchFreeListDirectly();

    let renderedHtmlOutput = null;
    let badProxiesReport = [];

    if (proxyPool.length === 0) {
        console.log("⚠️ Пул проксей пуст, пробуем сделать одну попытку напрямую.");
        proxyPool = [null];
    }

    // Честно перебираем до 15 разных IP по очереди!
    const totalAttempts = Math.min(proxyPool.length, 15);
    console.log(`🚀 Начинаем пошаговую проверку. Максимум попыток в цикле: ${totalAttempts}`);

    for (let i = 0; i < totalAttempts; i++) {
        const currentProxy = proxyPool[i];
        console.log(`🔎 [ТЕСТ УЗЛА №${i + 1}/${totalAttempts}] Пробуем зайти через IP: ${currentProxy || 'Direct (Без прокси)'}`);

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

            // 10 секунд на один узел для быстрого перебора пула
            await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
            await page.waitForTimeout(4000); 

            const content = await page.content();

            if (content.includes('Sicherheitsüberprüfung') || content.includes('Access Denied') || content.includes('403 Forbidden')) {
                throw new Error("Заблокировано Cloudflare Turnstile.");
            }

            console.log(`🎉 [УСПЕХ КОНВЕЙЕРА] На отметке №${i + 1} прокси успешно пробил защиту!`);
            renderedHtmlOutput = content;
            await browser.close();
            break; 

        } catch (error) {
            console.error(`❌ [СБОЙ УЗЛА №${i + 1}] Узел ${currentProxy || 'Direct'} выдал ошибку: ${error.message}`);
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
        let errorHtml = `<h1>🚨 Все протестированные бесплатные IP из пула (${totalAttempts} шт.) заблокированы Cloudflare</h1><h3>Лог пошаговых тестов конвейера:</h3><ul>`;
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
    res.send(`Кэш сброшен. Напрямую с free-proxy-list.net загружено новых IP: ${cachedFreeProxies.length}`);
});

app.get('/parse', handleParse);
app.post('/parse', handleParse);
app.get('/', (req, res) => res.send(`Автономний Stealth-міст з прямим парсингом free-proxy-list.net працює! В пуле: ${cachedFreeProxies.length}`));

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Сервер запущен на порту ${PORT}`));

