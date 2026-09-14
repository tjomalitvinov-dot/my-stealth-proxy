const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());
const puppeteerCore = require('puppeteer-core');
const app = express();

// Встроенный очиститель строк из таблицы SPYS.ONE
const parseGermanySpysList = (linesArray) => {
    let cleanList = [];
    linesArray.forEach(line => {
        // Ищем регуляркой классический формат IP:Порт в начале строки
        const match = line.match(/^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}):(\d{2,5})/);
        if (match) {
            cleanList.push(match[0]);
        }
    });
    return cleanList;
};

const handleCheck = async (req, res) => {
    const targetUrl = req.query.url || "https://lego.com";
    console.log(`\n===============================================================`);
    console.log(`🚀 [RADAR SCANNER] Тестируем свежий пул прокси из Германии (DE)!`);
    console.log(`🎯 Цель: ${targetUrl}`);
    console.log(`===============================================================`);

    // ТВОЙ СВЕЖИЙ ТЕКСТОВЫЙ СПИСОК С ГЕРМАНИИ СКОПИРОВАННЫЙ «КАК ЕСТЬ»
    const rawSpysGermanyLines = [
        "168.119.173.104:41346	SOCKS5	HIA	DE Nuremberg (Bavaria)	static.104.173.119.168.clients.your-server.de (Hetzner Online GmbH)",
        "49.12.99.250:9050	SOCKS5	HIA	DE Falkenstein (Saxony) !!!	static.250.99.12.49.clients.your-server.de (Hetzner Online GmbH)",
        "49.13.22.249:10808	SOCKS5	HIA	DE Falkenstein (Saxony) !!!	static.249.22.13.49.clients.your-server.de (Hetzner Online GmbH)",
        "168.119.59.172:3128	HTTP (Squid)	NOA	DE Falkenstein (Saxony)	static.172.59.119.168.clients.your-server.de (Hetzner Online GmbH)",
        "138.199.221.100:9050	SOCKS5	HIA	DE Nuremberg (Bavaria) !!!	static.100.221.199.138.clients.your-server.de (Hetzner Online GmbH)",
        "85.214.100.194:80	HTTP	HIA	DE	h2918553.stratoserver.net (Strato GmbH)",
        "178.104.234.144:8118	HTTP	HIA	DE Nuremberg (Bavaria) !!!	static.144.234.104.178.clients.your-server.de (Hetzner Online GmbH)",
        "45.13.225.169:8081	HTTP	HIA	DE	169.225.13.45.in-addr.arpa (Florian Kolb)",
        "45.13.225.169:8083	HTTPS	HIA	DE	169.225.13.45.in-addr.arpa (Florian Kolb)",
        "91.26.188.170:8080	HTTP (Mikrotik)	NOA	DE Cochem (Rheinland-Pfalz)	91.26.188.170 (Deutsche Telekom AG)",
        "159.195.194.242:8080	HTTPS	HIA	DE Nuremberg (Bavaria) !!!	v2202606367213469395.nicesrv.de",
        "85.214.107.177:80	HTTP	HIA	DE	h2945044.stratoserver.net (Strato GmbH)",
        "46.204.233.116:3128	HTTP	ANM	DE Frankfurt am Main (Hesse) !!!	46.203.233.116 (Freakhosting Ltd)",
        "185.204.170.179:1147	HTTPS	HIA	DE !!!	185.204.170.179 (Arvancloud Global Technologies L.L.C)",
        "144.31.255.9:1080	SOCKS5	HIA	DE Frankfurt am Main (Hesse)	://u1host.com (U1 Digital Services Ltd)",
        "85.14.247.185:3128	HTTPS	HIA	DE	://cincinnatibell.com (WIIT AG)",
        "46.4.141.121:3526	HTTP	HIA	DE Falkenstein (Saxony)	static.121.141.4.46.clients.your-server.de (Hetzner Online GmbH)",
        "45.10.163.12:80	HTTP	HIA	DE Karlsruhe (Baden-Wurttemberg)	vmi2383922.contaboserver.net (Contabo GmbH)",
        "78.31.64.152:3133	HTTPS (Squid)	NOA	DE	vps2426399.dedi.server-hosting.expert (WIIT AG)",
        "62.133.60.5:3128	HTTP (Squid)	NOA	DE Frankfurt am Main (Hesse)	49338.ip-ptr.tech (Global Connectivity Solutions Llp)",
        "2.27.29.96:3128	HTTP (Squid)	NOA	DE Frankfurt am Main (Hesse)	642722.senko.network (Senko Digital LLC)",
        "158.179.58.126:3128	HTTP (Squid)	ANM	DE Frankfurt am Main (Hesse)	158.179.58.126 (Oracle Corporation)",
        "57.129.24.167:3128	HTTPS (Squid)	NOA	DE Frankfurt am Main (Hesse)	ns3064998.ip-57-129-24.eu (OVH SAS)",
        "45.135.165.102:443	HTTP	NOA	DE Frankfurt am Main (Hesse)	45.135.165.102 (GLB Bulut Teknolojisi Limited Sirketi)",
        "82.22.184.158:3128	HTTP (Squid)	NOA	DE Frankfurt am Main (Hesse)	mail.radaxian.net (Freakhosting Ltd)",
        "169.58.97.115:1080	SOCKS5	HIA	DE	vmi3474994.contabocomputer.net",
        "193.135.9.36:3128	HTTP (Squid)	NOA	DE	pcg.de (IP-Projects GmbH & Co. KG)",
        "79.76.121.87:3128	HTTP (Squid)	NOA	DE Frankfurt am Main (Hesse)	79.76.121.87 (Oracle Corporation)",
        "217.12.215.163:10808	HTTP	HIA	DE Düsseldorf (North Rhine-Westphalia)	dostable77.pserver.space (Green Floid LLC)",
        "144.24.171.189:555	SOCKS5	HIA	DE Frankfurt am Main (Hesse)	144.24.171.189 (Oracle Corporation)"
    ];

    // Запускаем чистильщик строк
    let proxyPool = parseGermanySpysList(rawSpysGermanyLines);
    
    // Перемешиваем массив, чтобы тесты не шли одинаково при каждом вызове
    proxyPool = [...new Set(proxyPool)].sort(() => Math.random() - 0.5);
    console.log(`📊 Радар успешно подготовил [${proxyPool.length}] чистых немецких нод для проверки.`);

    let workingProxy = null;
    let badProxiesCount = 0;

    // Ограничиваем мясорубку максимум 15 случайными нодами из списка, чтобы уложиться в тайминги
    const maxTests = Math.min(proxyPool.length, 15);
    console.log(`🚀 Начинаем циклическую мясорубку Хрома для ${maxTests} нод...`);

    for (let i = 0; i < maxTests; i++) {
        const currentProxy = proxyPool[i];
        const proxyServerUrl = `http://${currentProxy}`;
        let browser = null;

        console.log(`🔄 [Тест ${i + 1}/${maxTests}] Проверяем немецкий канал: ${proxyServerUrl}`);

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
                    '--lang=de-DE,de;q=0.9' // Родной немецкий язык системы для лояльности Akamai
                ] 
            });

            const page = await browser.newPage();
            
            // Жестко отсекаем картинки и шрифты для разгрузки бесплатных прокси
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

            // 6.5 секунд таймаута на загрузку
            await page.setDefaultNavigationTimeout(6500); 

            await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
            
            // Жесткая пауза 3 секунды для сборкиNext.js скриптов цен в DOM
            await new Promise(resolve => setTimeout(resolve, 3000));

            const html = await page.content();

            // Железобетонная проверка: если прокси вытащил тег цен гидратации и обошел капчу
            if (html.includes('id="__NEXT_DATA__"') && !html.includes('403 Forbidden') && !html.includes('Access Denied') && html.length > 15000) {
                console.log(`🎉 🎉 🎉 ЗАЩИТА ЛЕГО ПРОБИТА! Рабочий немецкий IP найден: [${currentProxy}]`);
                workingProxy = currentProxy;
                await browser.close();
                break; 
            } else {
                throw new Error("Капча или пустой HTML каркас страницы");
            }

        } catch (err) {
            console.log(`   ❌ Нода ${proxyServerUrl} отклонена: ${err.message}`);
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
            message: `Успех! Рабочая немецкая нода зафиксирована.`
        });
    } else {
        return res.status(502).json({
            success: false,
            ip: null,
            message: `Мясорубка завершена. Все проверенные немецкие ноды (${badProxiesCount} шт) заблокированы защитой LEGO.`
        });
    }
};

app.get('/find-live-proxy', handleCheck);

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => { console.log(`🚀 Радар-чекер запущен на порту ${PORT}`); });





