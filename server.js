const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const axios = require('axios');
const { HttpProxyAgent } = require('http-proxy-agent');

puppeteer.use(StealthPlugin());
const app = express();

const handleParse = async (req, res) => {
    const targetUrl = req.query.url || req.body?.url;
    if (!targetUrl) return res.status(400).send("<h1>Ошибка: Параметр ?url= не найден!</h1>");
    
    const needRender = req.query.render === 'true' || req.body?.render === true;
    
    const proxyLogin = "mmnvhwqe";
    const proxyPass = "pt6brfln6blc";
    const rawIps = [
        "31.59.20.176:6754", "45.38.107.97:6014", "64.137.96.74:6641",
        "198.23.243.226:6361", "38.154.185.97:6370", "84.247.60.125:6095",
        "142.111.67.146:5611", "191.96.254.138:6185", "31.58.9.4:6077", 
        "198.46.161.42:5092"
    ];
    
    const randomIp = rawIps[Math.floor(Math.random() * rawIps.length)];
    const proxyServerUrl = `http://${proxyLogin}:${proxyPass}@${randomIp}`;
    
    res.setHeader('Content-Type', 'text/html; charset=UTF-8');

    if (needRender) {
        console.log(`📡 [PUPPETEER] Запуск браузера для: ${targetUrl}`);
        let browser = null;
        try {
            browser = await puppeteer.launch({ 
                headless: true, 
                args: [
                    '--no-sandbox', 
                    '--disable-setuid-sandbox', 
                    `--proxy-server=http://${randomIp}`, 
                    '--disable-blink-features=AutomationControlled', 
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                    '--disable-web-security',
                    '--lang=de-DE,de'
                ] 
            });
            const page = await browser.newPage();
            
            await page.authenticate({ username: proxyLogin, password: proxyPass });
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
            
            await page.setDefaultNavigationTimeout(45000);
            await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
            
            console.log(`⏳ Ожидаем отрисовку скриптов Lego...`);
            await new Promise(resolve => setTimeout(resolve, 6000)); 
            
            const htmlContent = await page.content();
            
            // 🎯 СВЕРХУМНАЯ АДАПТАЦИЯ ДЛЯ EMULATION NEXT_DATA БЛОКА
            if (targetUrl.includes('lego.com')) {
                console.log(`🧩 Применяем No-Code адаптер для Lego Apollo State...`);
                let apolloJsonText = "";
                
                // Ищем стейт по разным возможным маркерам Lego
                const matchApollo = htmlContent.match(/window\.__APOLLO_STATE__\s*=\s*({.+?});/s) || 
                                    htmlContent.match(/__APOLLO_STATE__\s*=\s*({.+?});/s);
                                    
                if (matchApollo && matchApollo[1]) {
                    apolloJsonText = matchApollo[1].trim();
                }
                
                if (apolloJsonText) {
                    try {
                        const parsedState = JSON.parse(apolloJsonText);
                        // Оборачиваем данные обратно в структуру, которую на 100% понимает твой GAS движок!
                        const emulatedNextData = {
                            props: {
                                pageProps: {
                                    __APOLLO_STATE__: parsedState
                                }
                            }
                        };
                        
                        // Собираем фейковый тег __NEXT_DATA__, под который заточен метод next_json в GAS
                        const fakeNextTag = `<script id="__NEXT_DATA__" type="application/json">${JSON.stringify(emulatedNextData)}</script>`;
                        
                        // Вшиваем его в тело ответа и отдаем таблице!
                        return res.send(htmlContent + fakeNextTag);
                    } catch (eJson) {
                        console.error("Ошибка упаковки Apollo: " + eJson.message);
                    }
                }
            }
            
            return res.send(htmlContent);
            
        } catch (error) { 
            console.error("🚨 Ошибка Puppeteer: " + error.message);
            return res.status(500).send(`<h1>Ошибка маскированного браузера: ${error.message}</h1>`); 
        } finally { 
            if (browser !== null) await browser.close(); 
        }
    } 
    else {
        // Обычный FAST HTTP режим
        try {
            const agent = new HttpProxyAgent(proxyServerUrl);
            const response = await axios.get(targetUrl, {
                httpAgent: agent,
                httpsAgent: agent,
                timeout: 25000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept-Language': 'de-DE,de;q=0.9'
                }
            });
            return res.send(response.data);
        } catch (error) {
            return res.status(500).send(`<h1>Ошибка быстрого шлюза: ${error.message}</h1>`);
        }
    }
};

app.get('/parse', handleParse);
app.post('/parse', express.json(), handleParse);

const PORT = process.env.PORT || 7860;
app.listen(PORT, () => { console.log(`🚀 Шлюз запущен на порту ${PORT}`); });


