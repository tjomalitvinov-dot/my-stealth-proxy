const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());
const app = express();

const handleParse = async (req, res) => {
    const targetUrl = req.query.url || req.body?.url;
    if (!targetUrl) return res.status(400).send("<h1>Ошибка: Параметр ?url= не найден!</h1>");
    
    // ТВОЙ РАБОЧИЙ ПУЛ ПРИВАТНЫХ РЕЗИДЕНТНЫХ ПРОКСИ
    const login = "mmnvhwqe";
    const pass = "pt6brfln6blc";
    const rawIps = [
        "31.59.20.176:6754", "45.38.107.97:6014", "64.137.96.74:6641",
        "198.23.243.226:6361", "38.154.185.97:6370", "84.247.60.125:6095",
        "142.111.67.146:5611", "191.96.254.138:6185", "31.58.9.4:6077", 
        "198.46.161.42:5092"
    ];

    // Перемешиваем пул случайным образом при каждом запросе
    const shuffledIps = rawIps.sort(() => Math.random() - 0.5);
    console.log(`📡 [DOCKER ROBUST CONVEYOR] Запуск мясорубки из ${shuffledIps.length} нод...`);
    
    let successHtml = null;
    let errorHistory = [];

    // === ВНУТРЕННИЙ БЕССМЕРТНЫЙ ЦИКЛ ПЕРЕБОРА IP ===
    for (let i = 0; i < shuffledIps.length; i++) {
        const currentIp = shuffledIps[i];
        const proxyServerUrl = "http://" + currentIp;
        
        console.log(`🔄 Попытка №${i + 1}/${shuffledIps.length}. Тестируем ноду: ${currentIp}...`);
        
        let browser = null;
        try {
            browser = await puppeteer.launch({ 
                headless: true, 
                executablePath: '/usr/bin/google-chrome', // Строгая привязка к Docker-Chrome
                args: [
                    '--no-sandbox', 
                    '--disable-setuid-sandbox', 
                    `--proxy-server=${proxyServerUrl}`, 
                    '--disable-blink-features=AutomationControlled', 
                    '--disable-dev-shm-usage', 
                    '--disable-gpu',
                    '--disable-peer-connection-id-generator',
                    '--disable-webrtc-encryption',
                    '--accept-lang=de-DE,de,en-US,en'
                ] 
            });
            const page = await browser.newPage();
            await page.authenticate({ username: login, password: pass });
            
            // Диета ОЗУ: блокируем мусорные картинки, оставляя стили для маскировки
            await page.setRequestInterception(true);
            page.on('request', (request) => {
                if (['image', 'media', 'svg'].includes(request.resourceType())) {
                    request.abort();
                } else {
                    request.continue();
                }
            });

            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36');
            await page.evaluateOnNewDocument(() => { 
                Object.defineProperty(navigator, 'webdriver', { get: () => undefined }); 
                Object.defineProperty(navigator, 'languages', { get: () => ['de-DE', 'de'] });
            });
            
            // АГРЕССИВНЫЙ ТАЙМАУТ: 6 секунд на ноду, чтобы мертвые сокеты не вешали Render!
            await page.setDefaultNavigationTimeout(6000); 
            
            const response = await page.goto(targetUrl, { waitUntil: 'networkidle2' });
            const httpStatus = response ? response.status() : "Unknown";
            
            // Краткая фиксационная пауза для сборки стейта React
            await new Promise(resolve => setTimeout(resolve, 3500));
            const htmlContent = await page.content();
            
            // --- СУПЕР-ПЕРЕХВАТ 2026: Проверяем, есть ли РЕАЛЬНАЯ ЦЕНА внутри Next.js кэша ---
            const hasNextData = htmlContent.includes('__NEXT_DATA__') || htmlContent.includes('__INITIAL_STATE__');
            const hasRealPrice = htmlContent.includes('formattedAmount') || htmlContent.includes('centAmount') || htmlContent.includes('priceValue');
            const titleMatch = htmlContent.match(/<title>([^<]+)<\/title>/i);
            const pageTitle = titleMatch ? titleMatch[1] : "Без заголовка";

            // Если код ответа 200, кэш на месте И ТАМ ЕСТЬ СЛОВА ЦЕНЫ (пробили теневой бан) — отдаем!
            if (httpStatus === 200 && hasNextData && hasRealPrice && !pageTitle.toLowerCase().includes('access denied')) {
                console.log(`🎯 [ПРОБИТИЕ УСПЕШНО!] Нода ${currentIp} выдала чистый кэш с ценой!`);
                successHtml = htmlContent;
                await browser.close();
                break; // Мгновенно РАЗРЫВАЕМ цикл, цель достигнута!
            } else {
                // Если прилетела фейковая заглушка, пишем "Результат 0" и крутим цикл дальше!
                let reason = "Теневой бан (кэш пустой, цены нет)";
                if (pageTitle.toLowerCase().includes('access denied')) reason = "Блокировка PerimeterX Access Denied";
                
                console.warn(`⚠️ Нода ${currentIp} выдала РЕЗУЛЬТАТ 0 [Причина: ${reason}]. Идем к следующему IP...`);
                errorHistory.push(`${currentIp} -> Результат 0 (${reason})`);
            }
            
        } catch (error) {
            console.warn(`❌ Нода ${currentIp} легла по таймауту/ошибке: ${error.message}. Сбрасываем...`);
            errorHistory.push(`${currentIp} -> Сбой сети (${error.message})`);
        } finally {
            if (browser !== null) { try { await browser.close(); } catch(e) {} }
        }
    }

    // Если хоть один прокси за все круги пробил сайт
    if (successHtml !== null) {
        res.setHeader('Content-Type', 'text/html; charset=UTF-8');
        return res.send(successHtml);
    } else {
        console.error("💀 ТОТАЛЬНЫЙ КРАХ ПУЛА: Весь список прокси выдал результат 0.");
        res.setHeader('Content-Type', 'text/plain; charset=UTF-8');
        return res.status(500).send(`[ТОТАЛЬНЫЙ КРАХ] Ни одна нода не смогла достать реальную цену.\n\nЖурнал дефектовки:\n${errorHistory.join('\n')}`);
    }
};

app.get('/parse', handleParse);
app.post('/parse', express.json(), handleParse);

const PORT = process.env.PORT || 7860;
app.listen(PORT, () => { console.log(`🚀 Бессмертный конвейер ротации запущен на порту ${PORT}`); });

