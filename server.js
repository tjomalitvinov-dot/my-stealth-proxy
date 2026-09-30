const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const app = express();

const handleParse = async (req, res) => {
    const targetUrl = req.query.url || req.body?.url;
    if (!targetUrl) return res.status(400).send("<h1>Ошибка: Параметр ?url= не найден!</h1>");
    
    console.log(`📡 Заходим на живой сайт: ${targetUrl}`);
    
    const login = "mmnvhwqe";
    const pass = "pt6brfln6blc";
    
    const rawIps = [
        "31.59.20.176:6754", "45.38.107.97:6014", "64.137.96.74:6641",
        "198.23.243.226:6361", "38.154.185.97:6370", "84.247.60.125:6095",
        "142.111.67.146:5611", "191.96.254.138:6185", "31.58.9.4:6077", 
        "198.46.161.42:5092"
    ];
    
    const randomIp = rawIps[Math.floor(Math.random() * rawIps.length)];
    const proxyServerUrl = "http://" + randomIp;
    
    console.log(`🔄 Ротация резидентного канала. Выходим через IP: ${randomIp}`);
    let browser = null;
    
    try {
        browser = await puppeteer.launch({ 
            headless: true, 
            args: [
                '--no-sandbox', 
                '--disable-setuid-sandbox', 
                `--proxy-server=${proxyServerUrl}`, 
                '--disable-blink-features=AutomationControlled', 
                '--disable-dev-shm-usage', 
                '--disable-gpu',
                '--no-zygote',         
                '--single-process',    // Запуск в один поток спасает ОЗУ бесплатного тарифа
                '--disable-extensions'
            ] 
        });
        
        const page = await browser.newPage();
        
        // ВАЖНО: Мы полностью УБРАЛИ блок setRequestInterception!
        // Теперь Stealth-плагин работает на 100% мощности и Cloudflare пропускает бота.
        
        // Авторизация на резидентном прокси
        await page.authenticate({ username: login, password: pass });
        
        // Качественный User-Agent реального пользователя
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
        
        // Защита от детекта переменной webdriver
        await page.evaluateOnNewDocument(() => { 
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined }); 
        });
        
        await page.setDefaultNavigationTimeout(45000);
        
        // Ждем полной загрузки сети (networkidle2), чтобы JS успел полностью отработать 
        // и сгенерировать блок __NEXT_DATA__ для вашей таблицы
        await page.goto(targetUrl, { waitUntil: 'networkidle2' });
        
        // Дополнительная небольшая пауза для стабильности
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        const cleanHtmlOutput = await page.content();
        res.setHeader('Content-Type', 'text/html; charset=UTF-8');
        return res.send(cleanHtmlOutput);
        
    } catch (error) { 
        console.error("Сбой Puppeteer: " + error.message);
        return res.status(500).send(`<h1>Ошибка маскированного браузера: ${error.message}</h1>`); 
    } finally { 
        if (browser !== null) {
            try {
                await browser.close();
            } catch (err) {
                console.error("Ошибка при закрытии браузера: " + err.message);
            }
        } 
    }
};

app.get('/parse', handleParse);
app.post('/parse', express.json(), handleParse);

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => { 
    console.log(`🚀 Шлюз успешно запущен на порту ${PORT}`); 
});
