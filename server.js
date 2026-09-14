const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());
const puppeteerCore = require('puppeteer-core');
const app = express();

const handleCheck = async (req, res) => {
    const targetUrl = req.query.url || "https://lego.com";
    console.log(`\n===============================================================`);
    console.log(`🚀 [RADAR SCANNER] Жесткий перебор твоего приватного пула Datacenter!`);
    console.log(`🎯 Цель: ${targetUrl}`);
    console.log(`===============================================================`);

    // ЖЕСТКАЯ СТРУКТУРА ПУЛА БЕЗ ОПАСНЫХ РАЗДЕЛИТЕЛЕЙ ДЛЯ ЗАЩИТЫ ОТ СБОЕВ ПАРОЛЯ
    const credentials = { username: "sp0xrsat1f", password: "jwNxAS1z4ey=wE6x9i" };
    const rawHosts = [
        "://decodo.com", "://decodo.com", "://decodo.com",
        "://decodo.com", "://decodo.com", "://decodo.com",
        "://decodo.com", "://decodo.com", "://decodo.com",
        "://decodo.com"
    ];

    // Перемешиваем ноды, чтобы тесты шли в случайном порядке
    const proxyPool = [...new Set(rawHosts)].sort(() => Math.random() - 0.5);
    console.log(`📊 Радар подготовил [${proxyPool.length}] приватных дата-центр нод для проверки.`);

    let workingProxy = null;
    let badProxiesCount = 0;

    for (let i = 0; i < proxyPool.length; i++) {
        const currentHost = proxyPool[i];
        const proxyServerUrl = `http://${currentHost}`;
        let browser = null;

        console.log(`🔄 [Тест ${i + 1}/${proxyPool.length}] Проверяем приватный канал: ${proxyServerUrl}`);

        try {
            browser = await puppeteerCore.launch({ 
                executablePath: '/usr/bin/google-chrome-stable', 
                headless: true, 
                args: [
                    '--no-sandbox', 
                    '--disable-setuid-sandbox', 
                    `--proxy-server=${proxyServerUrl}`,
                    '--disable-dev-shm-usage', 
                    '--disable-gpu',
                    '--single-process', 
                    '--no-zygote',
                    '--lang=de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7'
                ] 
            });

            const page = await browser.newPage();
            
            // Жестко передаем логин и пароль в Chrome
            await page.authenticate(credentials);

            // Блокируем картинки для экономии трафика и времени
            await page.setRequestInterception(true);
            page.on('request', (req) => {
                if (['image', 'font', 'media'].includes(req.resourceType())) {
                    req.abort();
                } else {
                    req.continue();
                }
            });

            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36');
            await page.setViewport({ width: 1440, height: 900 });

            // Ставим 10 секунд на общую загрузку страницы
            await page.setDefaultNavigationTimeout(10000); 

            await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
            await new Promise(resolve => setTimeout(resolve, 3500)); // 3.5 секунды жесткого ожидания рендеринга цен Remix/Next

            const html = await page.content();

            // Проверяем пробитие Akamai
            if (html.includes('id="__NEXT_DATA__"') && !html.includes('403 Forbidden') && !html.includes('Access Denied') && html.length > 15000) {
                console.log(`🎉 🎉 🎉 УСПЕХ! Приватный дата-центр прокси пробил LEGO: [${proxyServerUrl}]`);
                // Формируем финальную No-Code строку для возврата в ячейку Google Таблицы
                workingProxy = `${credentials.username}:${credentials.password}@${currentHost}`;
                await browser.close();
                break; 
            } else {
                throw new Error("Капча или пустая страница (Забанено защитой LEGO)");
            }

        } catch (err) {
            console.log(`   ❌ Нода ${proxyServerUrl} линия отклонена: ${err.message}`);
            badProxiesCount++;
        } finally {
            if (browser !== null) {
                try { await browser.close(); } catch (e) {}
            }
        }
    }

    res.setHeader('Content-Type', 'application/json; charset=UTF-8');
    if (workingProxy) {
        return res.json({
            success: true,
            ip: workingProxy,
            message: `Успех! Рабочий приватный прокси зафиксирован.`
        });
    } else {
        return res.status(502).json({
            success: false,
            ip: null,
            message: `Мясорубка завершена. Все приватные ноды (${badProxiesCount} шт) заблокированы защитой LEGO.`
        });
    }
};

app.get('/find-live-proxy', handleCheck);

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => { console.log(`🚀 Радар-чекер запущен на порту ${PORT}`); });





