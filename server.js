const express = require('express');
const { chromium } = require('playwright-extra');
const stealthPlugin = require('puppeteer-extra-plugin-stealth');

chromium.use(stealthPlugin());

const app = express();
app.use(express.json());

// 🔐 ДАННЫЕ ТВОЕГО НОВОГО СВЕЖЕГО ПАКЕТА WEBSHARE (ОБНОВЛЕНО!)
const PROXY_AUTH = {
    username: "mmnvhwqe", 
    password: "pt6brfln6blc"
};

// 📋 ПОЛНЫЙ ПУЛ С ПРИВЯЗКОЙ К СТРАНАМ ДЛЯ ДЕТАЛЬНОГО ОТЧЕТА
const MY_PROXY_POOL = [
    { ip: "31.59.20.176:6754", country: "🇬🇧 UK (London)" },
    { ip: "45.38.107.97:6014", country: "🇬🇧 UK (London)" },
    { ip: "64.137.96.74:6641", country: "🇪🇸 Spain (Madrid)" },
    { ip: "198.23.243.226:6361", country: "🇺🇸 USA (Los Angeles)" },
    { ip: "38.154.185.97:6370", country: "🇺🇸 USA (Piscataway)" },
    { ip: "84.247.60.125:6095", country: "🇵🇱 Poland (Warsaw)" },
    { ip: "142.111.67.146:5611", country: "🇯🇵 Japan (Tokyo)" },
    { ip: "191.96.254.138:6185", country: "🇺🇸 USA (Los Angeles)" },
    { ip: "31.58.9.4:6077", country: "🇩🇪 Germany (Frankfurt)" }, // 🌟 НАША ГЛАВНАЯ НАДЕЖДА ДЛЯ LEGO!
    { ip: "198.46.161.42:5092", country: "🇺🇸 USA (Los Angeles)" }
];

const handleParse = async (req, res) => {
    const targetUrl = req.query.url || req.body?.url;
    if (!targetUrl) return res.status(400).send("<h1>Помилка: Параметр url не знайдено!</h1>");

    console.log(`📡 [КОНВЕЙЕР С ЛОГАМИ] Запрос к сайту: ${targetUrl}`);
    
    let renderedHtmlOutput = null;
    let badProxiesReport = [];
    const totalAttempts = MY_PROXY_POOL.length;

    for (let i = 0; i < totalAttempts; i++) {
        const proxy = MY_PROXY_POOL[i];
        const checkTime = new Date().toLocaleString('uk-UA', { timeZone: 'Europe/Kyiv' }); // Время по Киеву
        
        console.log(`🔎 [ШАГ №${i + 1}/${totalAttempts}] Тест узла: http://${proxy.ip} [${proxy.country}]`);

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
                proxy: {
                    server: `http://${proxy.ip}`,
                    username: PROXY_AUTH.username,
                    password: PROXY_AUTH.password
                }
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

            // Таймаут на узел — 12 секунд
            await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 12000 });
            await page.waitForTimeout(4000); 

            const content = await page.content();

            // Проверка лимитов Webshare
            if (content.includes('Proxy connection limit exceeded') || content.includes('Too Many Requests') || content.includes('Limit Exceeded')) {
                throw new Error("Переліміт безкоштовного пакету Webshare!");
            }

            if (content.includes('Sicherheitsüberprüfung') || content.includes('Access Denied') || content.includes('403 Forbidden')) {
                throw new Error("Блокування Cloudflare Turnstile.");
            }

            console.log(`🎉 [УСПЕХ] Узел ${proxy.ip} (${proxy.country}) пробил защиту!`);
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
            <h1 style="color: #c53030; margin-top: 0;">🚨 Все бесплатные IP Webshare заблокированы или превысили лимит</h1>
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
app.get('/', (req, res) => res.send(`Конвейер Webshare с супер-логированием активен. Узлов: ${MY_PROXY_POOL.length}`));

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Сервер запущен на порту ${PORT}`));


