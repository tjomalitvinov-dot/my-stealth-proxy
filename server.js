const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());
const app = express();

const handleParse = async (req, res) => {
    const targetUrl = req.query.url || req.body?.url;
    if (!targetUrl) return res.status(400).send("<h1>Ошибка: Параметр ?url= не найден!</h1>");
    console.log(`📡 Заходим на живой сайт LEGO/Conrad: ${targetUrl}`);
    
    const login = "mmnvhwqe";
    const pass = "pt6brfln6blc";
    const rawIps = [
        "85.209.156.148:1080", "43.203.114.231:3128", "15.235.145.229:1081", "147.139.173.50:7777", "165.154.162.73:8888", "38.175.202.151:443", "65.109.215.187:8090", "47.81.56.193:8888", "101.36.112.205:1081", "111.119.162.248:10909", "43.173.120.13:8899", "80.71.232.83:8082", "107.175.215.32:1080", "193.37.71.46:10808", "180.149.44.182:3128", "47.91.104.88:3128", "164.52.11.194:18080", "156.67.110.124:10808", "161.35.70.249:80", "54.238.38.227:8080", "95.81.107.33:3128", "128.199.202.122:8080", "209.97.150.167:3128", "117.236.124.166:3128", "69.87.216.54:7989", "83.166.247.254:10808", "138.68.60.8:3128", "159.195.194.242:8080", "139.162.78.109:8080", "170.205.37.145:443", "65.108.159.129:8081", "166.1.61.57:1080", "159.203.61.169:3128", "47.254.122.220:5443", "37.148.9.84:2080", "104.161.23.122:5042", "110.74.195.34:25", "43.173.120.13:8899", "165.154.162.73:8888", "164.52.11.194:18080", "180.149.44.182:3128", "107.150.41.226:18080", "38.175.202.151:443", "54.238.38.227:8080", "95.81.107.33:3128", "8.215.112.214:7777", "8.215.112.240:7777", "178.128.26.157:10000", "185.195.71.218:18080", "65.109.215.187:8090", "156.67.110.124:10808", "213.111.146.36:18080", "159.89.87.80:10000", "159.89.239.204:10000", "176.99.134.183:8090", "195.158.8.123:3128", "2.28.105.45:8888", "103.237.102.191:11111", "47.81.56.193:8888", "8.219.74.197:8081", "139.59.1.14:8080", "138.68.60.8:3128", "178.128.146.125:10000", "93.115.20.101:1080", "170.81.131.70:3128", "43.203.114.231:3128", "69.87.216.54:7989", "161.35.70.249:80", "101.36.112.205:1081", "3.211.120.181:443", "198.199.86.11:3128", "138.124.125.198:3128", "166.1.61.57:1080", "140.238.32.108:3128", "129.213.162.27:17777", "159.203.61.169:3128", "195.144.24.57:3128", "45.139.226.199:10804", "85.209.156.148:1080", "47.236.188.63:10808"

    ];
    
    const randomIp = rawIps[Math.floor(Math.random() * rawIps.length)];
    const proxyServerUrl = "http://" + randomIp;
    
    console.log(`🔄 Инициализация Docker-Chrome через резидентный канал: ${randomIp}`);
    let browser = null;
    try {
        browser = await puppeteer.launch({ 
            headless: true, 
            executablePath: '/usr/bin/google-chrome', 
            args: [
                '--no-sandbox', 
                '--disable-setuid-sandbox', 
                `--proxy-server=${proxyServerUrl}`, 
                '--disable-blink-features=AutomationControlled', 
                '--disable-dev-shm-usage', 
                '--disable-gpu',
                '--disable-peer-connection-id-generator',
                '--disable-webrtc-encryption',
                '--ignore-certificate-errors', 
                '--window-size=1920,1080'
            ] 
        });
        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
        await page.authenticate({ username: login, password: pass });
        
        // Разрешаем стили (CSS), так как без них JS-фреймворки часто не рендерят контент
        await page.setRequestInterception(true);
        page.on('request', (request) => {
            if (['image', 'media', 'font', 'svg'].includes(request.resourceType())) {
                request.abort();
            } else {
                request.continue();
            }
        });
        
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
        await page.evaluateOnNewDocument(() => { 
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined }); 
            Object.defineProperty(navigator, 'languages', { get: () => ['de-DE', 'de', 'en-US', 'en'] });
            window.chrome = { runtime: {}, loadTimes: function() {}, csi: function() {} };
        });
        
        // Уменьшаем глобальный таймаут с 45 до 20 секунд (для динамического ожидания)
        await page.setDefaultNavigationTimeout(20000);
        
        let cleanHtmlOutput = "";
        let isSuccessParse = false;
        
        for (let attempt = 1; attempt <= 3; attempt++) {
            console.log(`📡 Попытка загрузки №${attempt}/3...`);
            
            // Используем 'domcontentloaded' вместо тяжелого 'networkidle2' — это экономит до 5-10 секунд на запрос
            if (attempt === 1) {
                await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
            } else {
                await page.reload({ waitUntil: 'domcontentloaded' });
            }
            
            // Умное динамическое ожидание вместо жесткой паузы в 4.5 секунды
            cleanHtmlOutput = await page.evaluate(async () => {
                const checkData = () => {
                    const html = document.documentElement.innerHTML;
                    const hasNextData = html.includes('__NEXT_DATA__') || html.includes('__INITIAL_STATE__');
                    const isPassed = hasNextData && !document.title.toLowerCase().includes('just a moment') && !html.includes('access denied');
                    return { isPassed, html };
                };

                // Быстрая проверка сразу после загрузки DOM
                let result = checkData();
                if (result.isPassed) return result.html;

                // Если защита еще висит, плавно проверяем каждые 300мс в течение максимум 4 секунд
                for (let i = 0; i < 13; i++) {
                    await new Promise(r => setTimeout(r, 300));
                    result = checkData();
                    if (result.isPassed) return result.html;
                }
                return result.html; // возвращаем что есть, если не дождались
            });

            const titleMatch = cleanHtmlOutput.match(/<title>([^<]+)<\/title>/i);
            const pageTitle = titleMatch ? titleMatch[1] : "Без заголовка";
            const hasNextData = cleanHtmlOutput.includes('__NEXT_DATA__') || cleanHtmlOutput.includes('__INITIAL_STATE__');
            
            if (hasNextData && !pageTitle.toLowerCase().includes('just a moment') && !cleanHtmlOutput.includes('access denied')) {
                console.log(`🎯 [ПРОБИТИЕ НА ПОПЫТКЕ №${attempt}!] Заголовок страницы: "${pageTitle}".`);
                isSuccessParse = true;
                break; 
            } else {
                console.warn(`⚠️ Попытка №${attempt} не удалась ("${pageTitle}"). Смена попытки...`);
                // Убрали жесткую паузу перед перезагрузкой, сразу идем на некст круг
            }
        }
        
        if (!isSuccessParse) {
            res.setHeader('Content-Type', 'text/plain; charset=UTF-8');
            return res.status(500).send("[ОШИБКА] Ни одна из 3 перезагрузок страницы не смогла обойти капчу Cloudflare Turnstile.");
        }
        
        res.setHeader('Content-Type', 'text/html; charset=UTF-8');
        return res.send(cleanHtmlOutput);
        
    } catch (error) { 
        console.error("Сбой Puppeteer: " + error.message);
        return res.status(500).send(`<h1>Ошибка маскированного браузера: ${error.message}</h1>`); 
    }
    finally { if (browser !== null) await browser.close(); }
};

app.get('/parse', handleParse);
app.post('/parse', express.json(), handleParse);

const PORT = process.env.PORT || 7860;
app.listen(PORT, () => { console.log(`🚀 Бессмертный конвейер перезагрузок запущен на порту ${PORT}`); });
