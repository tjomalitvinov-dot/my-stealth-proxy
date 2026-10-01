const express = require('express');
const { chromium } = require('playwright-extra');
const stealthPlugin = require('puppeteer-extra-plugin-stealth');

// Включаем максимальную маскировку автоматизации браузера
chromium.use(stealthPlugin());

const app = express();
app.use(express.json());

const handleParse = async (req, res) => {
    // Принимаем целевой URL от макроса Google Таблицы
    const targetUrl = req.query.url || req.body?.url;
    if (!targetUrl) return res.status(400).send("<h1>Помилка: Параметр url не знайдено!</h1>");

    console.log(`📡 [ЧИСТЫЙ STEALTH МОСТ] Запрос без использования прокси к: ${targetUrl}`);
    
    let browser = null;
    try {
        // Запуск Headless-браузера без каких-либо настроек прокси (чистый родной канал)
        browser = await chromium.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-blink-features=AutomationControlled',
                '--lang=de-DE,de;q=0.9,en-US;q=0.8' // Немецкая локализация ядра
            ]
        });

        // Создаем контекст чистого европейского пользователя Chrome
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
            locale: 'de-DE',
            timezoneId: 'Europe/Berlin', // Немецкая таймзона для LEGO
            viewport: { width: 1280, height: 720 }
        });

        const page = await context.newPage();
        
        // Диета ОЗУ: блокируем картинки и аналитику, чтобы ускорить загрузку на бесплатном хостинге
        await page.route('**/*', (route) => {
            if (['image', 'media', 'font', 'analytics'].includes(route.request().resourceType())) {
                route.abort();
            } else {
                route.continue();
            }
        });

        // Скрываем маркеры автоматизации на уровне DOM-дерева
        await page.addInitScript(() => { 
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined }); 
            Object.defineProperty(navigator, 'languages', { get: () => ['de-DE', 'de', 'en-US', 'en'] });
        });

        console.log(`🚀 Переход на сайт LEGO и ожидание стабилизации сети...`);
        
        // ⚡ ЖЕСТКОЕ ОЖИДАНИЕ: Чекаем полную загрузку фоновых скриптов
        await page.goto(targetUrl, { 
            waitUntil: 'networkidle', // Ждем, пока полностью затихнут все запросы сети
            timeout: 45000 
        });

        // Дополнительная stealth-пауза 6 секунд, чтобы Next.js на сайте LEGO полностью раскрыл тег __NEXT_DATA__
        console.log(`⏳ Ожидание генерации динамических цен в DOM...`);
        await page.waitForTimeout(6000);

        const content = await page.content();
        
        // Проверяем, не наткнулись ли мы на жесткий бан
        if (content.includes('Access Denied') || content.includes('403 Forbidden')) {
            throw new Error("Доступ отклонен защитой сайта Cloudflare (403).");
        }

        let pageTitle = "Без заголовка";
        try { pageTitle = await page.title(); } catch (e) {}

        console.log(`✅ УСПЕХ! Страница успешно пробита без прокси. Длина HTML: ${content.length} симв. [${pageTitle}]`);
        
        res.setHeader('Content-Type', 'text/html; charset=UTF-8');
        return res.send(content);

    } catch (error) {
        console.error(`❌ Критический сбой чистого обхода: ${error.message}`);
        res.setHeader('Content-Type', 'text/html; charset=UTF-8');
        return res.status(502).send(`<h1>🚨 Помилка мікросервісу Render: ${error.message}</h1>`);
    } finally {
        if (browser) await browser.close();
    }
};

app.get('/parse', handleParse);
app.post('/parse', handleParse);
app.get('/', (req, res) => res.send("Наш оригинальный чистый Stealth-міст без IP работает! 🚀"));

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Сервер успешно запущен на порту ${PORT}`));

