const express = require('express');
const { chromium } = require('playwright-extra');
const stealthPlugin = require('puppeteer-extra-plugin-stealth');

// Активируем маскировку от бот-детекторов
chromium.use(stealthPlugin());

const app = express();
app.use(express.json());

// 🔐 ДАННЫЕ АВТОРИЗАЦИИ ТВОЕГО ПУЛА DECODO
const PROXY_AUTH = {
    username: "sp0xrsat1f", 
    password: "jwNxAS1z4ey=wE6x9i"
};

// 📋 ТВОР ЛИЧНЫЙ СПИСОК ПОРТОВ И УЗЛОВ (На базе твоего домена dc.decodo.com)
const MY_PROXY_POOL = [
    "://decodo.com",
    "://decodo.com",
    "://decodo.com",
    "://decodo.com",
    "://decodo.com",
    "://decodo.com",
    "://decodo.com",
    "://decodo.com",
    "://decodo.com",
    "://decodo.com"
];

const handleParse = async (req, res) => {
    const targetUrl = req.query.url || req.body?.url;
    if (!targetUrl) return res.status(400).send("<h1>Помилка: Параметр url не знайдено!</h1>");

    console.log(`📡 [DECODO STEALTH POOL] Запрос к сайту: ${targetUrl}`);
    
    let renderedHtmlOutput = null;
    let badProxiesReport = [];

    // ЧЕСТНЫЙ КОНВЕЙЕР: По очереди прогоняем все 10 прокси из твоего списка
    const totalAttempts = MY_PROXY_POOL.length;
    console.log(`🚀 Начинаем поочередный перебор всех ${totalAttempts} прокси Decodo...`);

    for (let i = 0; i < totalAttempts; i++) {
        const currentProxy = MY_PROXY_POOL[i];
        console.log(`🔎 [ШАГ №${i + 1}/${totalAttempts}] Тест прокси-узла: http://${currentProxy}`);

        let browser = null;
        try {
            browser = await chromium.launch({
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-blink-features=AutomationControlled',
                    '--lang=de-DE,de;q=0.9,en-US;q=0.8' // Немецкий язык браузера
                ],
                proxy: {
                    server: `http://${currentProxy}`,
                    username: PROXY_AUTH.username,
                    password: PROXY_AUTH.password
                }
            });

            const context = await browser.newContext({
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
                locale: 'de-DE',
                timezoneId: 'Europe/Berlin', // Немецкая таймзона Берлина
                viewport: { width: 1280, height: 720 }
            });

            const page = await context.newPage();

            // Отсекаем только картинки, видео и шрифты для экономии трафика и высокой скорости
            await page.route('**/*', (route) => {
                if (['image', 'media', 'font', 'analytics'].includes(route.request().resourceType())) {
                    route.abort();
                } else {
                    route.continue();
                }
            });

            await page.evaluate(() => { Object.defineProperty(navigator, 'webdriver', { get: () => undefined }); });

            // Каждому узлу даем по 12 секунд на ответ
            await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 12000 });
            await page.waitForTimeout(4000); 

            const content = await page.content();

            // Жесткая проверка: прошли ли мы Cloudflare
            if (content.includes('Sicherheitsüberprüfung') || content.includes('Access Denied') || content.includes('403 Forbidden') || content.includes('captcha')) {
                throw new Error("Заблокировано защитой Cloudflare Turnstile.");
            }

            console.log(`🎉 [УСПЕХ КОНВЕЙЕРА] На шаге №${i + 1} узел ${currentProxy} успешно пробил Cloudflare!`);
            renderedHtmlOutput = content;
            await browser.close();
            break; // Рабочий прокси найден — прерываем цикл перебора и отдаем HTML!

        } catch (error) {
            console.error(`🚨 [СБОЙ НА ШАГЕ №${i + 1}] Узел ${currentProxy} выдал ошибку: ${error.message}`);
            badProxiesReport.push({ ip: currentProxy, error: error.message });
        } finally {
            if (browser) await browser.close();
        }
    }

    if (!renderedHtmlOutput) {
        res.setHeader('Content-Type', 'text/html; charset=UTF-8');
        let errorHtml = `<h1>🚨 Все прокси из твоего пула Decodo (${totalAttempts} шт.) заблокированы Cloudflare</h1><h3>Лог пошаговых тестов конвейера:</h3><ul>`;
        badProxiesReport.forEach(item => {
            errorHtml += `<li><b>${item.ip}</b> — <span style="color:red;">${item.error}</span></li>`;
        });
        errorHtml += `</ul>`;
        return res.status(502).send(errorHtml);
    }

    res.setHeader('Content-Type', 'text/html; charset=UTF-8');
    return res.send(renderedHtmlOutput);
};

app.get('/parse', handleParse);
app.post('/parse', handleParse);
app.get('/', (req, res) => res.send(`Конвейер под твой пул Decodo активен! В пуле жестко прописано: ${MY_PROXY_POOL.length} узлов.`));

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Сервер запущен на порту ${PORT}`));

