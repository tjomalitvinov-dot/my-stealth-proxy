const express = require('express');
const { chromium } = require('playwright-extra');
const stealthPlugin = require('puppeteer-extra-plugin-stealth');
const axios = require('axios');

chromium.use(stealthPlugin());

const app = express();
app.use(express.json());
app.use(express.text({ limit: '2mb' })); // Увеличили лимит для больших списков

// ВНУТРЕННЕЕ ХРАНИЛИЩЕ
let myPrivateProxies = [];
let cachedFreeProxies = [];
let lastFetchTime = 0;

// 🕵️‍♂️ УЛЬТРА-ВСЕЯДНЫЙ ПАРСЕР С ТЕСТАМИ ТЕКСТА
const parseRawInputList = (rawText) => {
    if (!rawText) return [];
    let cleanList = [];
    
    // Разбиваем весь входящий блок текста на массив отдельных слов/строк
    const tokens = rawText.split(/[\s,;\t\n\r]+/).map(t => t.trim()).filter(Boolean);
    console.log(`🔍 [ТЕСТ ПАРСЕРА] Всего токенов (слов/строк) для анализа: ${tokens.length}`);

    let i = 0;
    while (i < tokens.length) {
        const token = tokens[i];
        
        // Проверяем, похоже ли слово на IP-адрес
        const ipMatch = token.match(/^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
        
        if (ipMatch) {
            const ip = ipMatch[1];
            const port = tokens[i + 1] || '';
            const user = tokens[i + 2] || '';
            const pass = tokens[i + 3] || '';

            // Проверяем, что следующий токен — это действительно цифровой порт
            if (port.match(/^\d{4,5}$/)) {
                // Проверяем, являются ли последующие 2 токена логином и паролем (Webshare формат)
                // Логины и пароли обычно состоят из букв и цифр, без точек и спецсимволов
                const hasUser = user && user.match(/^[a-zA-Z0-9]{6,15}$/) && !user.includes('.');
                const hasPass = pass && pass.match(/^[a-zA-Z0-9]{6,15}$/) && !pass.includes('.');

                cleanList.push({
                    server: `http://${ip}:${port}`,
                    username: hasUser ? user : null,
                    password: (hasUser && hasPass) ? pass : null
                });

                // Сдвигаем указатель вперед в зависимости от того, сколько данных нашли
                i += (hasUser && hasPass) ? 4 : 2;
                continue;
            }
        }
        i++;
    }
    
    console.log(`🤖 [ТЕСТ ПАРСЕРА] Успешно распознано и собрано проксей: ${cleanList.length}`);
    if (cleanList.length > 0) {
        console.log(`📋 [ТЕСТ ПУЛА] Первый распознанный прокси:`, {
            server: cleanList[0].server,
            username: cleanList[0].username ? "Есть" : "Нет",
            password: cleanList[0].password ? "Есть" : "Нет"
        });
    }
    return cleanList;
};

// Резервный автосборщик бесплатных IP
const refreshFreeProxies = async () => {
    const now = Date.now();
    if (cachedFreeProxies.length > 0 && (now - lastFetchTime) < 5 * 60 * 1000) return cachedFreeProxies;
    try {
        console.log("🔄 Сборщик делает резервный запрос к бесплатной базе...");
        const p1 = 'https://proxyscrape.com';
        const p2 = '/v2/?request=displayproxies&protocol=http&timeout=5000&country=de,nl,fr,pl,es,gb&ssl=all&anonymity=anonymous';
        const response = await axios.get(p1 + p2, { timeout: 8000 });
        if (response.data && typeof response.data === 'string') {
            const lines = response.data.split(/[\s\n\r]+/).map(l => l.trim()).filter(l => l.includes(':'));
            if (lines.length > 0) {
                cachedFreeProxies = lines.map(p => ({ server: `http://${p}`, username: null, password: null }));
                lastFetchTime = now;
                console.log(`✅ Бесплатный резерв обновлен: ${cachedFreeProxies.length} IP`);
                return cachedFreeProxies;
            }
        }
    } catch (e) { console.error("⚠️ Резервный сборщик временно недоступен: " + e.message); }
    return cachedFreeProxies;
};

const handleParse = async (req, res) => {
    const targetUrl = req.query.url || req.body?.url;
    if (!targetUrl) return res.status(400).send("<h1>Помилка: Параметр url не знайдено!</h1>");

    console.log(`📡 [ВХОДЯЩИЙ ЗАПРОС] Рендеринг для: ${targetUrl}`);
    
    // Формируем пул для тестирования
    let activePool = [];
    let isPrivate = false;

    if (myPrivateProxies.length > 0) {
        activePool = [...myPrivateProxies];
        isPrivate = true;
    } else {
        activePool = await refreshFreeProxies();
    }

    // Если всё пусто — добавляем прямую попытку без прокси
    if (activePool.length === 0) {
        console.log("⚠️ Пул абсолютно пуст. Вынужденная попытка напрямую.");
        activePool.push({ server: null, username: null, password: null });
    }

    let renderedHtmlOutput = null;
    let badProxiesReport = [];
    
    // 🔥 ГЛАВНОЕ ИЗМЕНЕНИЕ: Идем честно по ВСЕМ проксям из списка по очереди (до 15 штук)
    const totalAttempts = Math.min(activePool.length, 15);
    console.log(`🚀 [КОНВЕЙЕР СТАРТ] Начинаем поочередный перебор пула. Всего попыток: ${totalAttempts}`);

    for (let i = 0; i < totalAttempts; i++) {
        const proxy = activePool[i];
        const proxyLabel = proxy.server || 'Direct (Без прокси)';
        console.log(`🔎 [ПРОКСИ СТЕП №${i + 1}/${totalAttempts}] Тестируем узел: ${proxyLabel}`);

        let browser = null;
        try {
            let pSettings = undefined;
            if (proxy.server) {
                pSettings = {
                    server: proxy.server,
                    username: proxy.username || undefined,
                    password: proxy.password || undefined
                };
            }

            browser = await chromium.launch({
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-blink-features=AutomationControlled',
                    '--lang=de-DE,de;q=0.9'
                ],
                proxy: pSettings
            });

            const context = await browser.newContext({
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
                locale: 'de-DE',
                timezoneId: 'Europe/Berlin',
                viewport: { width: 1280, height: 720 }
            });

            const page = await context.newPage();

            await page.route('**/*', (route) => {
                if (['image', 'media', 'font', 'analytics'].includes(route.request().resourceType())) { route.abort(); } else { route.continue(); }
            });

            await page.addInitScript(() => { Object.defineProperty(navigator, 'webdriver', { get: () => undefined }); });

            // Каждому прокси даем максимум 12 секунд, чтобы успеть перебрать много IP
            await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 12000 });
            await page.waitForTimeout(4000); 

            const content = await page.content();

            // Проверка на Cloudflare
            if (content.includes('Sicherheitsüberprüfung') || content.includes('Access Denied') || content.includes('403 Forbidden')) {
                throw new Error("Cloudflare Turnstile заблокировал этот IP.");
            }

            console.log(`🎉 [УСПЕХ ПОТОКА] Прокси ${proxyLabel} пробил Cloudflare! Выходим из цикла.`);
            renderedHtmlOutput = content;
            await browser.close();
            break; // Ротация успешна, прерываем цикл!

        } catch (error) {
            console.error(`🚨 [ОШИБКА УЗЛА] Споткнулись на ${proxyLabel} -> Причина: ${error.message}`);
            badProxiesReport.push({ ip: proxyLabel, error: error.message });
            
            // Если бесплатный прокси подвёл — вычёркиваем его, приватные из Webshare не трогаем
            if (!isPrivate && proxy.server) {
                cachedFreeProxies = cachedFreeProxies.filter(p => p.server !== proxy.server);
            }
        } finally {
            if (browser) await browser.close();
        }
    }

    // Если перебрали весь пул и никто не пробил защиту
    if (!renderedHtmlOutput) {
        console.error(`💀 [КРАХ РОТАЦИИ] Все ${totalAttempts} IP из пула были заблокированы Cloudflare.`);
        res.setHeader('Content-Type', 'text/html; charset=UTF-8');
        let errorHtml = `<h1>🚨 Все прокси из списка (${totalAttempts} шт.) заблокированы Cloudflare</h1><h3>Лог пошаговых спотыканий:</h3><ul>`;
        badProxiesReport.forEach(item => {
            errorHtml += `<li><b>${item.ip}</b> — <span style="color:red;">${item.error}</span></li>`;
        });
        errorHtml += `</ul>`;
        return res.status(502).send(errorHtml);
    }

    res.setHeader('Content-Type', 'text/html; charset=UTF-8');
    return res.send(renderedHtmlOutput);
};

// ЭНДПОИНТ ДЛЯ ЗАГРУЗКИ КАТАЛОГА WEBSHARE С ДЕТАЛЬНЫМИ ТЕСТАМИ
app.post('/update-proxies', (req, res) => {
    const rawText = req.body;
    console.log("📥 [ВХОДЯЩИЙ ПОТОК] Получен сырой текст пула. Длина строки: " + (rawText ? rawText.length : 0));
    
    const parsed = parseRawInputList(rawText);
    
    if (parsed.length > 0) {
        myPrivateProxies = parsed;
        console.log(`✅ [ОБНОВЛЕНИЕ ПУЛА] В память успешно загружено приватных проксей: ${myPrivateProxies.length}`);
        return res.send(`Успех! Распознано и загружено приватных проксей Webshare: ${myPrivateProxies.length}`);
    } else {
        console.error("❌ [ОШИБКА ОБНОВЛЕНИЯ] Не удалось вытащить ни одного IP:Порт из переданного текста.");
        return res.status(400).send("Ошибка: Текст передан, но регулярный анализатор не смог выделить структуру IP и Портов.");
    }
});

app.get('/clear-proxies', (req, res) => {
    myPrivateProxies = [];
    res.send("Приватный пул очищен. Сервер вернулся к бесплатному автосборщику.");
});

app.get('/parse', handleParse);
app.post('/parse', handleParse);
app.get('/', (req, res) => res.send(`Гибридный мост активен. Приватных IP в кэше: ${myPrivateProxies.length}`));

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(Сервер запущен на порту ${PORT}));
