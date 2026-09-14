const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());
const puppeteerCore = require('puppeteer-core');
const app = express();

const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
];

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

const handleParse = async (req, res) => {
    const targetUrl = req.query.url || req.body?.url;
    if (!targetUrl) return res.status(400).send("<h1>Ошибка: Параметр ?url= не найден!</h1>");
    
    console.log(`\n===============================================================`);
    console.log(`📡 [НОВЫЙ ЗАПРОС] Стартуем детальный дамп-анализ страницы!`);
    console.log(`🔗 Целевой URL: ${targetUrl}`);
    console.log(`===============================================================`);
    
    const myRawProxyList = [
        "154.17.8.103	1680	US	United States	elite proxy	no	yes	12 secs ago","112.216.54.226	12121	KR	South Korea	elite proxy		yes	12 secs ago","34.134.231.117	3129	US	United States	anonymous	no	yes	12 secs ago","107.174.36.15	8888	US	United States	elite proxy		yes	12 secs ago","123.58.199.232	8168	VN	Vietnam	anonymous		no	16 secs ago","167.99.124.118	80	US	United States	anonymous		no	16 secs ago","8.215.25.3	2080	ID	Indonesia	elite proxy	yes	yes	16 secs ago","163.172.53.142	80	FR	France	elite proxy		no	16 secs ago","104.225.220.233	80	US	United States	elite proxy		no	16 secs ago","34.87.80.221	30000	SG	Singapore	anonymous		no	16 secs ago","65.21.201.149	8081	FI	Finland	anonymous		no	16 secs ago","66.151.34.89	80	FI	Finland	anonymous		no	16 secs ago","164.52.11.194	18080	TW	Taiwan	elite proxy		no	16 secs ago","178.236.16.4	8888	KZ	Kazakhstan	elite proxy		no	16 secs ago","103.112.71.166	3128	NL	Netherlands	elite proxy		no	16 secs ago","202.133.88.173	80	FR	France	anonymous		no	16 secs ago","101.32.65.42	8888	HK	Hong Kong	elite proxy		no	16 secs ago","2.56.109.190	8082	TR	Turkey	anonymous		no	16 secs ago","172.104.56.95	8888	SG	Singapore	anonymous		no	16 secs ago","27.133.238.94	80	JP	Japan	transparent	no	no	16 secs ago","72.56.73.23	80	NL	Netherlands	anonymous		no	16 secs ago","162.240.19.30	80	US	United States	elite proxy		no	16 secs ago","197.221.234.252	80	ZW	Zimbabwe	anonymous		no	16 secs ago","41.220.16.208	80	ZW	Zimbabwe	anonymous		no	16 secs ago","15.235.21.254	8080	CA	Canada	anonymous	no	yes	16 secs ago","46.47.197.210	3128	RU	Russian Federation	elite proxy		no	16 secs ago","5.45.126.128	8080	EE	Estonia	anonymous		no	16 secs ago","109.199.119.160	80	FR	France	anonymous	no	no	24 secs ago","162.214.74.29	3128	US	United States	anonymous	no	no	24 secs ago","162.214.159.94	3128	US	United States	anonymous	no	no	24 secs ago","14.225.2.98	808	VN	Vietnam	elite proxy	yes	yes	24 secs ago","47.85.161.37	3128	US	United States	elite proxy	no	no	24 secs ago","51.75.206.209	80	FR	France	elite proxy	no	no	24 secs ago","195.158.8.123	3128	UZ	Uzbekistan	elite proxy		no	24 secs ago","176.61.151.123	80	PT	Portugal	elite proxy	no	no	24 secs ago","103.109.96.180	6321	BD	Bangladesh	elite proxy		no	24 secs ago","165.154.162.73	8888	US	United States	elite proxy	no	yes	24 secs ago","45.43.60.220	8080	JP	Japan	anonymous	yes	yes	24 secs ago","47.84.84.1	3128	SG	Singapore	elite proxy	no	yes	24 secs ago","73.162.86.230	443	US	United States	anonymous	no	yes	24 secs ago","193.33.157.2	8080	SY	Syrian Arab Republic	transparent	no	no	24 secs ago","181.205.205.170	999	CO	Colombia	transparent	no	no	24 secs ago","47.91.104.88	3128	AE	United Arab Emirates	elite proxy	no	no	24 secs ago","14.251.13.20	8080	VN	Vietnam	elite proxy	yes	yes	24 secs ago","103.237.102.191	11111	DE	Germany	elite proxy	no	yes	24 secs ago","45.146.163.31	80	JP	Japan	anonymous	no	no	24 secs ago","202.28.194.139	31280	TH	Thailand	elite proxy	no	yes	24 secs ago","45.91.248.107	80	US	United States	anonymous	no	no	24 secs ago","47.81.56.193	8888	TH	Thailand	elite proxy	no	yes	24 secs ago","195.86.215.2	3128	PH	Philippines	anonymous		no	24 secs ago","176.99.134.183	8090	RU	Russian Federation	elite proxy		no	24 secs ago","219.65.73.80	80	IN	India	anonymous	no	no	24 secs ago","219.65.73.81	80	IN	India	anonymous	no	no	24 secs ago","34.44.49.215	80	US	United States	elite proxy	no	no	24 secs ago","219.93.101.63	80	MY	Malaysia	anonymous	no	no	24 secs ago","219.93.101.60	80	MY	Malaysia	anonymous	no	no	24 secs ago","219.93.101.62	80	MY	Malaysia	anonymous	no	no	24 secs ago","45.194.41.103	8080	IN	India	anonymous	yes	no	1 min ago","80.74.54.148	3128	DE	Germany	anonymous		no	1 min ago","195.114.209.50	80	ES	Spain	elite proxy		no	1 min ago","159.65.245.255	80	US	United States	elite proxy		no	1 min ago","38.58.182.147	18080	US	United States	elite proxy	no	yes	1 min ago","37.187.74.125	80	FR	France	elite proxy	no	no	1 min ago","97.74.87.226	80	SG	Singapore	anonymous	no	no	1 min ago","91.103.120.48	80	HK	Hong Kong	anonymous	no	no	1 min ago","13.208.166.217	8079	JP	Japan	elite proxy	no	yes	1 min ago","65.109.217.164	3128	FI	Finland	elite proxy		no	1 min ago","194.31.108.109	2080	IR	Iran	elite proxy	no	yes	1 min ago","156.245.246.51	7890	SC	Seychelles	elite proxy	no	yes	1 min ago","193.233.91.64	3129	RU	Russian Federation	elite proxy		no	1 min ago","157.90.10.50	80	DE	Germany	anonymous	no	no	1 min ago","8.211.200.183	10000	GB	United Kingdom	elite proxy	no	yes	1 min ago","194.163.175.167	40000	FR	France	anonymous	no	yes	1 min ago","2.27.63.250	8888	US	United States	anonymous	no	yes	1 min ago","45.194.41.141	8080	IN	India	anonymous	no	yes	1 min ago","56.112.93.245	5555	CA	Canada	elite proxy	no	yes	1 min ago","143.42.66.91	80	SG	Singapore	anonymous	no	no	1 min ago","69.87.216.54	7989	US	United States	elite proxy	yes	yes	1 min ago","190.58.248.86	80	TT	Trinidad and Tobago	anonymous	no	no	1 min ago","32.223.6.94	80	US	United States	anonymous	no	no	1 min ago","184.75.221.82	3118	CA	Canada	anonymous	no	yes	1 min ago"
    ];
    
    const processedProxies = parseRawInputList(myRawProxyList);
    console.log(`🤖 [CHECKER] Распознано ${processedProxies.length} IP для циклической проверки.`);
    
    let badProxiesReport = [];
    let cleanHtmlOutput = null;

    for (let i = 0; i < processedProxies.length; i++) {
        const currentProxy = processedProxies[i];
        const proxyServerUrl = "http://" + currentProxy;
        let browser = null;

        console.log(`\n---------------------------------------------------------------`);
        console.log(`🔄 [ПОПЫТКА №${i + 1}/${processedProxies.length}] Тестируем прокси-канал: ${proxyServerUrl}`);
        console.log(`---------------------------------------------------------------`);
        
        try {
            const selectedUA = userAgents[Math.floor(Math.random() * userAgents.length)];
            console.log(`🕵️‍♂️ Генерируем фингерпринт сессии:`);
            console.log(`   - User-Agent: ${selectedUA}`);

            console.log(`⚙️ Запуск изолированного ядра Chromium внутри Docker...`);
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
            
            console.log(`📥 Открываем новую анонимную вкладку (Page)...`);
            const page = await browser.newPage();
            
            // Включаем перехват сетевых запросов с детальным логом в консоль Render
            await page.setRequestInterception(true);
            page.on('request', (request) => {
                const type = request.resourceType();
                const reqUrl = request.url();
                
                // Чтобы логи не взрывались от тысяч строк, пишем только типы
                if (['image', 'font', 'media'].includes(type)) {
                    // console.log(`   🚫 Блокируем медиа-ресурс [${type}]: ${reqUrl.substring(0, 60)}...`);
                    request.abort();
                } else {
                    // console.log(`   🟢 Пропускаем скрипт/документ [${type}]: ${reqUrl.substring(0, 60)}...`);
                    request.continue();
                }
            });

            // Логируем все ошибки JavaScript со страницы, если они возникнут
            page.on('pageerror', (err) => {
                console.log(`   ⚠️ [PAGE JS ERROR] Скрипт сайта выдал ошибку: ${err.toString()}`);
            });

            // Логируем коды ответов (HTTP Status Codes) всех подгружаемых файлов
            page.on('response', (response) => {
                if (response.url() === targetUrl) {
                    console.log(`   🚨 [HTTP STATUS] Ответ сервера LEGO для главного URL: Код ${response.status()}`);
                }
            });

            await page.setUserAgent(selectedUA);
            await page.setViewport({ width: 1280, height: 800 });
            
            console.log(`⏱ Устанавливаем лимит ожидания прокси в 10 секунд...`);
            await page.setDefaultNavigationTimeout(10000); 
            
            console.log(`📡 Команда page.goto(). Прокси начинает стучаться в шлюз сайта LEGO...`);
            await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
            console.log(`⏳ Событие DOMContentLoaded успешно поймано! Ждем жесткую паузу 4 сек...`);
            
            await new Promise(resolve => setTimeout(resolve, 4000));
            
            console.log(`📸 Извлекаем финальный слепок (snapshot) HTML кода страницы...`);
            cleanHtmlOutput = await page.content();
            
            console.log(`📊 Анализ полученного текста:`);
            console.log(`   - Длина строки контента: ${cleanHtmlOutput.length} символов.`);
            
            // Выводим в лог Render первые 300 символов, чтобы глазами увидеть теги (<html... или капчу)
            console.log(`   - Начало HTML кода (первые 300 симв): \n${cleanHtmlOutput.substring(0, 300).trim()}`);
            
            // Проверяем наличие ключевых маркеров
            const hasNextData = cleanHtmlOutput.includes('id="__NEXT_DATA__"');
            const hasCloudflare = cleanHtmlOutput.includes('cloudflare') || cleanHtmlOutput.includes('Turnstile');
            const hasAccessDenied = cleanHtmlOutput.includes('Access Denied') || cleanHtmlOutput.includes('403 Forbidden');
            
            console.log(`   - Наличие тега __NEXT_DATA__: [${hasNextData}]`);
            console.log(`   - Обнаружена защита Cloudflare: [${hasCloudflare}]`);
            console.log(`   - Обнаружена блокировка Access Denied: [${hasAccessDenied}]`);

            console.log(`✅ Сессия завершена успешно. Закрываем браузер.`);
            await browser.close();
            break; 

        } catch (error) {
            console.error(`❌ [КРАХ ПОПЫТКИ] Нода ${proxyServerUrl} рухнула. Причина: ${error.message}`);
            badProxiesReport.push({ ip: currentProxy, error: error.message });
        } finally {
            if (browser !== null) {
                try { await browser.close(); } catch (e) {}
            }
        }
    }

    if (cleanHtmlOutput) {
        console.log(`\n🎉 [ЗАПРОС УСПЕШНО ВЫПОЛНЕН] Отправляем дамп на сторону Google Таблицы.`);
        res.setHeader('Content-Type', 'text/html; charset=UTF-8');
        return res.send(cleanHtmlOutput);
    }

    console.log(`\n🛑 [КРАХ ПУЛА] Ни один прокси не смог отдать контент.`);
    res.setHeader('Content-Type', 'text/html; charset=UTF-8');
    let errorHtml = `<h1>❌ Полный сетевой тайм-аут всего пула бесплатных прокси!</h1><h3>Детальный лог:</h3><ul>`;
    badProxiesReport.forEach(item => {
        errorHtml += `<li><b>${item.ip}</b> — <span style="color:red;">${item.error}</span></li>`;
    });
    errorHtml += `</ul>`;
    return res.status(502).send(errorHtml);
};

app.get('/parse', handleParse);
app.post('/parse', express.json(), handleParse);

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => { console.log(`🚀 Дамп-шлюз с глубоким логированием запущен на порту ${PORT}`); });
