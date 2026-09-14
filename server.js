const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());
const puppeteerCore = require('puppeteer-core');
const app = express();

// Встроенный автоматический чистильщик твоей текстовой базы
const parseRawInputList = (linesArray) => {
    let cleanList = [];
    linesArray.forEach(line => {
        const match = line.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\s*[\s\t:]\s*(\d{2,5})/);
        if (match) {
            const ip = match[1];
            const port = match[2];
            if (ip !== '0.0.0.0' && ip !== '127.0.0.7') {
                cleanList.push(`${ip}:${port}`);
            }
        }
    });
    return cleanList;
};

const handleCheck = async (req, res) => {
    const targetUrl = req.query.url || "https://lego.com";
    console.log(`\n===============================================================`);
    console.log(`🚀 [RADAR SCANNER] Тотальный перебор твоего текстового пула!`);
    console.log(`🎯 Цель: ${targetUrl}`);
    console.log(`===============================================================`);

    // ТВОЙ ОГРОМНЫЙ ЛИЧНЫЙ СПИСОК ПРЯМО ИЗ ТВОЕГО ТЕКСТОВОГО ФАЙЛА
    // Я вставил сюда пачку самых свежих элитных нод из твоего дампа (Германия, США, Франция, Финляндия)
    const myRawTextList = [
        "80.74.54.148	3128	DE	Germany	anonymous	no	no	25 secs ago",
        "103.237.102.191	11111	DE	Germany	elite proxy	yes	yes	25 secs ago",
        "158.179.58.126	3128	DE	Germany	anonymous		no	1 min ago",
        "45.10.163.12	80	DE	Germany	elite proxy		no	1 min ago",
        "185.21.8.66	1080	DE	Germany	anonymous		yes	1 min ago",
        "109.199.119.160	80	FR	France	anonymous	no	no	25 secs ago",
        "163.172.53.142	80	FR	France	elite proxy	no	no	25 secs ago",
        "158.220.99.85	4545	FR	France	elite proxy		no	1 min ago",
        "51.75.206.209	80	FR	France	elite proxy	no	no	11 mins ago",
        "162.214.74.29	3128	US	United States	anonymous	no	no	25 secs ago",
        "162.214.159.94	3128	US	United States	anonymous	no	no	25 secs ago",
        "167.99.236.14	80	US	United States	elite proxy	no	no	25 secs ago",
        "149.248.18.106	8118	US	United States	elite proxy	yes	yes	25 secs ago",
        "65.109.217.164	3128	FI	Finland	elite proxy	yes	yes	25 secs ago",
        "135.181.79.187	40001	FI	Finland	anonymous	no	yes	25 secs ago",
        "65.109.87.121	28080	FI	Finland	elite proxy		no	50 mins ago",
        "65.109.65.238	28080	FI	Finland	elite proxy		no	51 mins ago"
    ];

    // Чистим список от мусора таблицы, оставляем только чистые IP:Порт
    let proxyPool = parseRawInputList(myRawTextList);
    
    // Перемешиваем, чтобы при каждом клике кнопки тесты шли в случайном порядке
    proxyPool = [...new Set(proxyPool)].sort(() => Math.random() - 0.5);
    console.log(`📊 Радар успешно подготовил [${proxyPool.length}] чистых тестовых IP-нод из встроенной базы.`);

    let workingProxy = null;
    let badProxiesCount = 0;

    // Ограничиваем перебор максимум 15 попытками за один раз, чтобы сберечь ресурсы
    const maxTests = Math.min(proxyPool.length, 15);
    console.log(`🚀 Начинаем циклическую мясорубку Хрома для ${maxTests} нод...`);

    for (let i = 0; i < maxTests; i++) {
        const currentProxy = proxyPool[i];
        const proxyServerUrl = "http://" + currentProxy;
        let browser = null;

        console.log(`🔄 [Тест ${i + 1}/${maxTests}] Проверяем встроенный канал: ${currentProxy}`);

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
                    '--lang=de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7' // Немецкий/европейский профиль для LEGO
                ] 
            });

            const page = await browser.newPage();
            
            // Блокируем картинки для экономии времени бесплатных нод
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

            // 6.5 секунд таймаута на одну ноду
            await page.setDefaultNavigationTimeout(6500); 

            await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
            
            // Жестко ждем 2.5 секунды, пока Remix/Next.js отрендерит тег цен
            await new Promise(resolve => setTimeout(resolve, 2500));

            const html = await page.content();

            // Жесткая проверка: если на странице есть тег данных гидратации и нет надписей бана
            if (html.includes('id="__NEXT_DATA__"') && !html.includes('403 Forbidden') && !html.includes('Access Denied') && html.length > 15000) {
                console.log(`🎉 🎉 🎉 ЗАЩИТА ЛЕГО СЛОМАНА! Рабочая встроенная нода найдена: [${currentProxy}]`);
                workingProxy = currentProxy;
                await browser.close();
                break; 
            } else {
                throw new Error("Капча или пустой HTML каркас страницы");
            }

        } catch (err) {
            console.log(`   ❌ Нода ${currentProxy} отклонена: ${err.message}`);
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
            message: `Успех! Рабочий IP зафиксирован.`
        });
    } else {
        return res.status(502).json({
            success: false,
            ip: null,
            message: `Мясорубка завершена. Все проверенные встроенные ноды (${badProxiesCount} шт) заблокированы сайтом.`
        });
    }
};

app.get('/find-live-proxy', handleCheck);

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => { console.log(`🚀 Радар-чекер запущен на порту ${PORT}`); });




