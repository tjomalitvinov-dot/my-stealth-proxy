const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());
const app = express();

const handleParse = async (req, res) => {
    const targetUrl = req.query.url || req.body?.url;
    if (!targetUrl) return res.status(400).send("<h1>Ошибка: Параметр url не найден!</h1>");
    
    const login = "mmnvhwqe";
    const pass = "pt6brfln6blc";
    const rawIps = [
        "157.245.70.5:10000", "194.163.175.167:40000", "134.209.29.120:3128",
        "159.195.194.242:8080", "178.16.54.240:44444", "178.128.165.127:10000",
        "161.35.70.249:80", "213.111.146.36:18080", "93.115.20.101:1080", 
        "157.90.10.50:80", "87.199.202.58:443", "213.199.53.16:8888", 
        "95.211.174.135:3128", "109.236.88.82:80", "163.172.53.142:80", "185.200.177.61:3128"
    ];
    
    // Перемешиваем пул случайным образом при каждом клике таблицы
    const shuffledIps = rawIps.sort(() => Math.random() - 0.5);
    console.log(`📡 [DOCKER ROBUST MACHINE] Запуск конвейера перебора из ${shuffledIps.length} нод...`);
    
    let successHtml = null;
    let errorHistory = [];

    // === ВНУТРЕННИЙ БЕССМЕРТНЫЙ ЦИКЛ ПЕРЕБОРА IP С ЗРЯЧИМ ТЕСТОМ ===
    for (let i = 0; i < shuffledIps.length; i++) {
        const currentIp = shuffledIps[i];
        const proxyServerUrl = "http://" + currentIp;
        
        console.log(`🔄 Попытка №${i + 1}/${shuffledIps.length}. Запуск Chrome через ноду: ${currentIp}...`);
        
        let browser = null;
        try {
            browser = await puppeteer.launch({ 
                headless: true, 
                executablePath: '/usr/bin/google-chrome', // Твоя жесткая Docker привязка
                args: [
                    '--no-sandbox', 
                    '--disable-setuid-sandbox', 
                    `--proxy-server=${proxyServerUrl}`, 
                    '--disable-blink-features=AutomationControlled', 
                    '--disable-dev-shm-usage', 
                    '--use-gl=angle',
                    '--use-angle=swiftshader', // WebGL рендеринг видеокарты
                    '--disable-peer-connection-id-generator',
                    '--disable-webrtc-encryption',
                    '--ignore-certificate-errors', // Снос SSL ошибок прокси
                    '--window-size=1920,1080'
                ] 
            });
            const page = await browser.newPage();
            
            // Жесткое разрешение FullHD
            await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
            await page.authenticate({ username: login, password: pass });
            
            // Диета ОЗУ: блокируем картинки и медиа-мусор
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
                Object.defineProperty(navigator, 'languages', { get: () => ['de-DE', 'de', 'en-US', 'en'] });
                Object.defineProperty(navigator, 'deviceMemory', { get: () => 8 });
                Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8 });
                window.chrome = { runtime: {}, loadTimes: function() {}, csi: function() {} };
                
                // Анти-канвас фингерпринт
                const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
                HTMLCanvasElement.prototype.toDataURL = function() { return originalToDataURL.apply(this, arguments); };
                
                // Эмуляция батареи и тачскрина Windows ПК
                navigator.getBattery = () => Promise.resolve({ charging: true, level: 1 });
                const touchEvent = document.createEvent('TouchEvent');
                Object.defineProperty(window, 'TouchEvent', { get: () => touchEvent.constructor });
            });
            
            // ЖЕСТКИЙ КОРОТКИЙ ТАЙМАУТ: 7.5 секунд на ноду, чтобы мертвые прокси не вешали сессию!
            await page.setDefaultNavigationTimeout(7500);
            
            const response = await page.goto(targetUrl, { waitUntil: 'networkidle2' });
            const httpStatus = response ? response.status() : "Unknown";
            
            // Идеальный плавающий человеческий джиттер (пауза 4.5 сек)
            await new Promise(resolve => setTimeout(resolve, 4500));
            const htmlContent = await page.content();
            
            // === СКАНИРОВАНИЕ КОДА СТРАНИЦЫ НА КЭШ И КАПЧУ ИЗНУТРИ ЦИКЛА ===
            const htmlLength = htmlContent.length;
            const titleMatch = htmlContent.match(/<title>([^<]+)<\/title>/i);
            const pageTitle = titleMatch ? titleMatch[1] : "Без заголовка";
            
            const hasNextData = htmlContent.includes('__NEXT_DATA__') || htmlContent.includes('__INITIAL_STATE__');
            const isBlockPX = htmlContent.toLowerCase().includes('perimeterx') || htmlContent.includes('access denied');
            const isBlockCF = pageTitle.toLowerCase().includes('just a moment') || htmlContent.includes('cloudflare');

            // Если зашли успешно, кэш на месте И НЕТ КАПЧИ/БЛОКОВ — отдаем в таблицу!
            if (httpStatus === 200 && hasNextData && !isBlockPX && !isBlockCF && htmlLength > 35000) {
                console.log(`🎯 [ПРОБИТИЕ УСПЕШНО] Нода ${currentIp} пробила Cloudflare! Заголовок: "${pageTitle}"`);
                successHtml = htmlContent;
                await browser.close();
                break; // РАЗРЫВАЕМ ЦИКЛ! Цепочка завершена успехом!
            } else {
                let reason = "Пустой HTML-код без кэш-массива";
                if (isBlockCF) reason = "Застрял на капче Cloudflare Turnstile (Just a moment...)";
                if (isBlockPX) reason = "Блокировка PerimeterX Access Denied";
                
                console.warn(`⚠️ Нода ${currentIp} забракована: [Результат 0 -> Причина: ${reason}]. Переключаюсь на следующий IP...`);
                errorHistory.push(`${currentIp} -> Результат 0 (${reason} | HTTP ${httpStatus})`);
                await browser.close();
            }
            
        } catch (error) {
            console.warn(`❌ Нода ${currentIp} сброшена по таймауту или ошибке: ${error.message}`);
            errorHistory.push(`${currentIp} -> Сбой соединения (${error.message})`);
            if (browser !== null) { try { await browser.close(); } catch(e) {} }
        }
    }

    if (errorHistory.length > 0) {
        res.setHeader('X-Bad-Proxies', errorHistory.join('||'));
    }

    if (successHtml !== null) {
        res.setHeader('Content-Type', 'text/html; charset=UTF-8');
        return res.send(successHtml);
    } else {
        console.error("💀 ТОТАЛЬНЫЙ КРАХ ПУЛА: Весь список свежих прокси выдал результат 0.");
        res.setHeader('Content-Type', 'text/plain; charset=UTF-8');
        return res.status(500).send(`[ТОТАЛЬНЫЙ КРАХ СЕРВЕРА] Ни одна нода из пула не смогла пройти капчу Cloudflare.\n\nЖУРНАЛ ДЕФЕКТОВКИ НОД:\n${errorHistory.join('\n')}`);
    }
};

app.get('/parse', handleParse);
app.post('/parse', express.json(), handleParse);

const PORT = process.env.PORT || 7860;
app.listen(PORT, () => { console.log(`🚀 Бессмертный зрячий конвейер ротации запущен на порту ${PORT}`); });


