const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

const handleParse = async (req, res) => {
    // Твоя Google Таблица передает целевую ссылку в параметре url
    const targetUrl = req.query.url || req.body?.url;
    if (!targetUrl) return res.status(400).send("<h1>Помилка: Параметр url не знайдено!</h1>");

    console.log(`📡 [УТРЕННИЙ БЕЗ-IP МОСТ] Получен запрос к сайту: ${targetUrl}`);
    
    // Считываем твой секретный бесплатный токен из настроек панели Render
    const apiToken = process.env.SCRAPER_API_KEY;

    if (!apiToken || apiToken === "undefined" || apiToken === "") {
        console.error("❌ Критическая ошибка: Токен SCRAPER_API_KEY отсутствует в настройках Render!");
        res.setHeader('Content-Type', 'text/html; charset=UTF-8');
        return res.status(500).send("<h1>🚨 Помилка: Додайте токен SCRAPER_API_KEY у настройки переменних Render.com</h1>");
    }

    try {
        // 🔐 ТО САМОЕ БЕЗУПРЕЧНОЕ УТРЕННЕЕ РЕШЕНИЕ:
        // Направляем запрос в хмару ScrapingBee.
        // Параметр premium_proxy=true активирует чистые Residential (домашние) IP.
        // Параметр country_code=de жестко выводит браузер внутри Германии для пробива LEGO.
        const part1 = 'https://scrapingbee.com';
        const part2 = '/v1/?api_key=' + apiToken;
        const part3 = '&url=' + encodeURIComponent(targetUrl);
        const part4 = '&country_code=de&premium_proxy=true'; 
        
        const scrapingUrl = part1 + part2 + part3 + part4;

        console.log(`🚀 Перенаправление запроса в резидентное облако Германии (DE)...`);
        
        // Даем облаку до 40 секунд на качественный пробив и рендеринг страницы
        const response = await axios.get(scrapingUrl, { timeout: 40000 });

        if (response.data) {
            const content = response.data;
            
            // Если облако вернуло системную заглушку блокировки
            if (content.includes('Access Denied') || content.includes('403 Forbidden')) {
                throw new Error("Облако обхода вернуло код блокировки Cloudflare.");
            }

            console.log(`✅ УСПЕХ! Чистый HTML без капч получен. Длина кода: ${content.length} симв.`);
            res.setHeader('Content-Type', 'text/html; charset=UTF-8');
            return res.send(content);
        } else {
            throw new Error("Получен пустой ответ от удаленного API шлюза.");
        }

    } catch (error) {
        console.error(`❌ Сбой транзитного обхода Cloudflare: ${error.message}`);
        res.setHeader('Content-Type', 'text/html; charset=UTF-8');
        return res.status(502).send(`<h1>🚨 Помилка мікросервісу Render: ${error.message}</h1>`);
    }
};

app.get('/parse', handleParse);
app.post('/parse', handleParse);
app.get('/', (req, res) => res.send("Утренний легкий Stealth-міст без использования локальных IP активен! 🚀"));

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Сервер успешно запущен на порту ${PORT}`));

