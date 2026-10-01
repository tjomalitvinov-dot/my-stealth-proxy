const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());
const app = express();

const handleParse = async (req, res) => {
    const targetUrl = req.query.url || req.body?.url;
    if (!targetUrl) return res.status(400).send("<h1>Ошибка: Параметр ?url= не найден!</h1>");
    
    // ТВОЙ ОФИЦИАЛЬНЫЙ РЕЗИДЕНТНЫЙ ПАСПОРТ АВТОРИЗАЦИИ
    const login = "mmnvhwqe";
    const pass = "pt6brfln6blc";
    
    // ТВОЙ СВЕЖИЙ ЭЛИТНЫЙ ЕВРОПЕЙСКИЙ ПУЛ ПРОКСИ ИЗ ФАЙЛА (СУПЕР-ФИЛЬТРАЦИЯ 2026)
    const rawIps = [
        "157.245.70.5:10000",     // Netherlands (elite)
        "194.163.175.167:40000", // France (elite)
        "134.209.29.120:3128",   // United Kingdom (elite)
        "159.195.194.242:8080",  // Germany (elite)
        "178.16.54.240:44444",   // Netherlands (elite)
        "178.128.165.127:10000", // United Kingdom (elite)
        "161.35.70.249:80",      // Germany (elite)
        "213.111.146.36:18080",  // Netherlands (elite)
        "93.115.20.101:1080",    // Netherlands (elite)
        "157.90.10.50:80",       // Germany (anonymous)
        "87.199.202.58:443",     // Netherlands (elite)
        "213.199.53.16:8888",    // France (anonymous)
        "95.211.174.135:3128",   // Netherlands (anonymous)
        "109.236.88.82:80",      // Netherlands (anonymous)
        "163.172.53.142:80",     // France (elite)
        "185.200.177.61:3128"    // Netherlands (elite)
    ];

    // Перемешиваем ноды случайным образом, чтобы снизить нагрузку и обмануть антифрод
    const shuffledIps = rawIps.sort(() => Math.random() - 0.5);
    console.log(`📡 [DOCKER MEGA STEALTH] Запуск пулеметного перебора из ${shuffledIps.length} элитных нод...`);
    
    let successHtml = null;
    let errorHistory = [];

    // === ВНУТРЕННИЙ БЕССМЕРТНЫЙ ЦИКЛ РОТАЦИИ «НА ЛЕТУ» ===
    for (let i = 0; i < shuffledIps.length; i++) {
        const currentIp = shuffledIps[i];
        const proxyServerUrl = "http://" + currentIp;
        
        console.log(`🔄 Попытка №${i + 1}/${shuffledIps.length}. Запуск Docker-Chrome через ноду: ${currentIp}...`);
        
        let browser = null;
        try {
            browser = await puppeteer.launch({ 
                headless: true, 
                executablePath: '/usr/bin/google-chrome', // Твоя жесткая эталонная привязка к Docker
                args: [
                    '--no-sandbox', 
                    '--disable-setuid-sandbox', 
                    `--proxy-server=${proxyServerUrl}`, 
                    '--disable-blink-features=AutomationControlled', 
                    '--disable-dev-shm-usage', 
                    '--disable-gpu',
                    // УЛЬТРА-МАСКИРОВКА: Скрываем сетевые фингерпринты WebRTC туннелей хостинга
                    '--disable-peer-connection-id-generator',
                    '--disable-webrtc-encryption',
                    '--accept-lang=de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7'
                ] 
            });
            const page = await browser.newPage();
            
            await page.authenticate({ username: login, password: pass });
            
            // === ТВОЯ ЭТАЛОННАЯ СУПЕР-ДИЕТА ОЗУ ДЛЯ СКОРОСТИ ГЕНЕРАЦИИ ЦЕН ===
            await page.setRequestInterception(true);
            page.on('request', (request) => {
                if (['image', 'stylesheet', 'font', 'media', 'svg'].includes(request.resourceType())) {
                    request.abort();
                } else {
                    request.continue();
                }
            });

            // ЭЛИТНЫЙ ПАКЕТ МАСКИРОВКИ ЦИФРОВОГО ОТПЕЧАТКА WINDOWS CHROME
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36');
            
            await page.evaluateOnNewDocument(() => { 
                // Стираем любые следы автоматизации Puppeteer
                Object.defineProperty(navigator, 'webdriver', { get: () => undefined }); 
                Object.defineProperty(navigator, 'languages', { get: () => ['de-DE', 'de', 'en-US', 'en'] });
                Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
                
                // Эмуляция реального экрана и аппаратной поддержки
                window.chrome = { runtime: {}, loadTimes: function() {}, csi: function() {} };
                Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
                Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
            });
            
            // ЖЕСТКИЙ ТАЙМАУТ: 7.5 секунд на ноду. Сервер больше никогда не упадет по лимиту 502!
            await page.setDefaultNavigationTimeout(7500); 
            
            const response = await page.goto(targetUrl, { waitUntil: 'networkidle2' });
            const httpStatus = response ? response.status() : "Unknown";
            
            // Твоя эталонная фиксационная пауза для сборки стейта React
            await new Promise(resolve => setTimeout(resolve, 4500));
            const htmlContent = await page.content();
            
            // --- ТЕСТ ЗРЯЧЕСТИ КЭША: Проверяем наличие Next.js / Initial_State и маркеров цен ---
            const hasNextData = htmlContent.includes('__NEXT_DATA__') || htmlContent.includes('__INITIAL_STATE__');
            const hasRealPrice = htmlContent.includes('formattedAmount') || htmlContent.includes('centAmount') || htmlContent.includes('priceValue') || htmlContent.includes('priceWithVat');
            const titleMatch = htmlContent.match(/<title>([^<]+)<\/title>/i);
            const pageTitle = titleMatch ? titleMatch[1] : "Без заголовка";

            // Если код 200, кэш на месте И ТАМ ЕСТЬ СЛОВА ЦЕНЫ (обошли теневой белый экран-заглушку) — УСПЕХ!
            if (httpStatus === 200 && hasNextData && hasRealPrice && !pageTitle.toLowerCase().includes('access denied') && !pageTitle.toLowerCase().includes('just a moment')) {
                console.log(`🎯 [ПРОБИТИЕ УСПЕШНО] Нода ${currentIp} взяла реальные данные! Экран: "${pageTitle}"`);
                successHtml = htmlContent;
                await browser.close();
                break; // Мгновенно РАЗРЫВАЕМ цикл, отдаем HTML в таблицу!
            } else {
                // Если прилетел фейковый белый экран или блок капчи — пишем "Результат 0" и бежим дальше!
                let reason = "Теневой пустой экран (папки цен отсутствуют в коде)";
                if (pageTitle.toLowerCase().includes('just a moment')) reason = "Cloudflare Turnstile Заглушка капчи";
                if (pageTitle.toLowerCase().includes('access denied')) reason = "PerimeterX Access Denied Блокировка";
                
                console.warn(`⚠️ Нода ${currentIp} выдала РЕЗУЛЬТАТ 0 [Причина: ${reason} | HTTP: ${httpStatus}]. Идем к следующему IP...`);
                errorHistory.push(`${currentIp}::Результат 0 (${reason})`);
            }
            
        } catch (error) {
            console.warn(`❌ Нода ${currentIp} сброшена по таймауту или ошибке сети: ${error.message}`);
            errorHistory.push(`${currentIp}::Сбой соединения (${error.message})`);
        } finally {
            if (browser !== null) { try { await browser.close(); } catch(e) {} }
        }
    }

    // Если по дороге накопились плохие ноды, швыряем их в заголовок для твоего листа Bad_IPs!
    if (errorHistory.length > 0) {
        res.setHeader('X-Bad-Proxies', errorHistory.join('||'));
    }

    if (successHtml !== null) {
        res.setHeader('Content-Type', 'text/html; charset=UTF-8');
        return res.send(successHtml);
    } else {
        console.error("💀 ТОТАЛЬНЫЙ КРАХ ПУЛА: Весь список свежих прокси выдал результат 0.");
        res.setHeader('Content-Type', 'text/plain; charset=UTF-8');
        return res.status(500).send(`[ТОТАЛЬНЫЙ КРАХ DOCKER-СЕРВЕРА] Ни одна нода из пула не смогла пробить теневой бан сайта.\n\nЖУРНАЛ ДЕФЕКТОВКИ НОД:\n${errorHistory.join('\n')}`);
    }
};

app.get('/parse', handleParse);
app.post('/parse', express.json(), handleParse);

const PORT = process.env.PORT || 7860;
app.listen(PORT, () => { console.log(`🚀 Ультимативный маскированный Chrome-конвейер успешно запущен на порту ${PORT}`); });

app.get('/parse', handleParse);
app.post('/parse', express.json(), handleParse);
const PORT = process.env.PORT || 7860;
app.listen(PORT, () => { console.log(`🚀 Шлюз запущен на порту ${PORT}`); });

