const express = require('express');
const { chromium } = require('playwright-extra');
const stealthPlugin = require('puppeteer-extra-plugin-stealth');

// Включаем ядро маскировки
chromium.use(stealthPlugin());

const app = express();
app.use(express.json());

const PROXY_AUTH = {
    username: "mmnvhwqe", 
    password: "pt6brfln6blc"
};

const MY_PROXY_POOL = [
    { ip: "31.59.20.176:6754", country: "🇬🇧 UK (London)" },
    { ip: "45.38.107.97:6014", country: "🇬🇧 UK (London)" },
    { ip: "64.137.96.74:6641", country: "🇪🇸 Spain (Madrid)" },
    { ip: "198.23.243.226:6361", country: "🇺🇸 USA (Los Angeles)" },
    { ip: "38.154.185.97:6370", country: "🇺🇸 USA (Piscataway)" },
    { ip: "84.247.60.125:6095", country: "🇵🇱 Poland (Warsaw)" },
    { ip: "142.111.67.146:5611", country: "🇯🇵 Japan (Tokyo)" },
    { ip: "191.96.254.138:6185", country: "🇺🇸 USA (Los Angeles)" },
    { ip: "31.58.9.4:6077", country: "🇩🇪 Germany (Frankfurt)" }, 
    { ip: "198.46.161.42:5092", country: "🇺🇸 USA (Los Angeles)" }
];

const handleParse = async (req, res) => {
    const targetUrl = req.query.url || req.body?.url;
    if (!targetUrl) return res.status(400).send("<h1>Помилка: Параметр url не знайдено!</h1>");

    console.log(`📡 [УЛЬТРА STEALTH КОНВЕЙЕР] Рендеринг для: ${targetUrl}`);
    
    let renderedHtmlOutput = null;
    let badProxiesReport = [];
    const totalAttempts = MY_PROXY_POOL.length;

    for (let i = 0; i < totalAttempts; i++) {
        const proxy = MY_PROXY_POOL[i];
        const checkTime = new Date().toLocaleString('uk-UA', { timeZone: 'Europe/Kyiv' });
        
        console.log(`🔎 [УЗЕЛ №${i + 1}/${totalAttempts}] Запуск защищенной сессии через: http://${proxy.ip}`);

        let browser = null;
        try {
            browser = await chromium.launch({
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-blink-features=AutomationControlled',
                    '--lang=de-DE,de;q=0.9,en-US;q=0.8',
                    '--window-size=1920,1080',
                    '--no-default-browser-check',
                    '--disable-infobars'
                ],
                proxy: {
                    server: `http://${proxy.ip}`,
                    username: PROXY_AUTH.username,
                    password: PROXY_AUTH.password
                }
            });

            const context = await browser.newContext({
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
                locale: 'de-DE',
                timezoneId: 'Europe/Berlin', // Немецкое время
                viewport: { width: 1920, height: 1080 },
                extraHTTPHeaders: {
                    'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8'
                }
            });

            const page = await context.newPage();

            // 🔥 МАКСИМАЛЬНАЯ МАСКИРОВКА ОТПЕЧАТКОВ (Fingerprinting Bypass)
            await page.addInitScript(() => {
                // Стираем флаг робота webdriver
                Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
                
                // Подменяем объект Chrome реальными системными функциями
                window.navigator.chrome = {
                    runtime: {},
                    loadTimes: function() {},
                    csi: function() {},
                    app: {}
                };
                
                // Эмулируем стандартные браузерные плагины (PDF-просмотрщик и т.д.)
                Object.defineProperty(navigator, 'plugins', {
                    get: () => [
                        { name: 'PDF Viewer', filename: 'internal-pdf-viewer' },
                        { name: 'Chrome PDF Viewer', filename: 'internal-pdf-viewer' }
                    ]
                });
                
                // Фиксируем языки на уровне железа
                Object.defineProperty(navigator, 'languages', { get: () => ['de-DE', 'de', 'en-US', 'en'] });
            });

            // Пропускаем стили и скрипты, чтобы Turnstile мог проверить наши новые крутые отпечатки
            await page.route('**/*', (route) => {
                if (['image', 'media', 'font', 'analytics'].includes(route.request().resourceType())) {
                    route.abort();
                } else {
                    route.continue();
                }
            });

            // Увеличили таймаут до 25 секунд на узел, чтобы медленные бесплатные порты успевали ответить
            await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });

            // 🔥 ИМИТАЦИЯ ЧЕЛОВЕКА: Движения мыши и легкий скролл для пробива Turnstile
            console.log("🖱️ Эмуляция человеческих движений мыши на странице...");
            await page.mouse.move(150, 180);
            await page.mouse.move(450, 320);
            await page.evaluate(() => window.scrollBy(0, 300)); // Скроллим страницу на 300 пикселей вниз
            
            await page.waitForTimeout(5500); // 5.5 секунд stealth-паузы

            const content = await page.content();

            if (content.includes('Proxy connection limit exceeded') || content.includes('Too Many Requests') || content.includes('Limit Exceeded')) {
                throw new Error("Переліміт безкоштовного пакету Webshare!");
            }

            if (content.includes('Sicherheitsüberprüfung') || content.includes('Access Denied') || content.includes('403 Forbidden')) {
                throw new Error("Блокування Cloudflare Turnstile (IP забанений).");
            }

            console.log(`🎉 [УСПЕХ КОНВЕЙЕРА] Узел ${proxy.ip} (${proxy.country}) полностью пробил Cloudflare!`);
            renderedHtmlOutput = content;
            await browser.close();
            break; 

        } catch (error) {
            console.error(`🚨 [СБОЙ] ${proxy.ip} -> ${error.message}`);
            badProxiesReport.push({ 
                ip: proxy.ip, 
                country: proxy.country,
                error: error.message,
                time: checkTime
            });
        } finally {
            if (browser) await browser.close();
        }
    }

    if (!renderedHtmlOutput) {
        res.setHeader('Content-Type', 'text/html; charset=UTF-8');
        
        let errorHtml = `
        <div style="font-family: Arial, sans-serif; padding: 20px; background-color: #fff5f5; border: 20px solid #feb2b2; border-radius: 10px;">
            <h1 style="color: #c53030; margin-top: 0;">🚨 Все приватные IP Webshare заблокированы или превысили лимит</h1>
            <p><b>Всего проверено попыток:</b> ${totalAttempts} шт.</p>
            <hr style="border: 1px solid #fec8c8;">
            <h3>📊 Пошаговый отчет конвейера ротации:</h3>
            <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
                <thead>
                    <tr style="background-color: #feb2b2; color: #2d3748; text-align: left;">
                        <th style="padding: 10px; border: 1px solid #fc8181;">Прокси Узел (IP)</th>
                        <th style="padding: 10px; border: 1px solid #fc8181;">Локация (Страна)</th>
                        <th style="padding: 10px; border: 1px solid #fc8181;">Техническая причина сбоя</th>
                        <th style="padding: 10px; border: 1px solid #fc8181;">Время проверки (Киев)</th>
                    </tr>
                </thead>
                <tbody>`;

        badProxiesReport.forEach(item => {
            errorHtml += `
                    <tr style="background-color: #fff; color: #4a5568;">
                        <td style="padding: 10px; border: 1px solid #fec8c8;"><b>${item.ip}</b></td>
                        <td style="padding: 10px; border: 1px solid #fec8c8;">${item.country}</td>
                        <td style="padding: 10px; border: 1px solid #fec8c8; color: #c53030;">${item.error}</td>
                        <td style="padding: 10px; border: 1px solid #fec8c8; font-size: 0.9em;">${item.time}</td>
                    </tr>`;
        });

        errorHtml += `
                </tbody>
            </table>
        </div>`;
        
        return res.status(502).send(errorHtml);
    }

    res.setHeader('Content-Type', 'text/html; charset=UTF-8');
    return res.send(renderedHtmlOutput);
};

app.get('/parse', handleParse);
app.post('/parse', handleParse);
app.get('/', (req, res) => res.send("Ультра Stealth-міст з підміною заліза активовано! 🚀"));

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Сервер запущен на порту ${PORT}`));

