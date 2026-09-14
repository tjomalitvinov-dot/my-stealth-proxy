const express = require('express');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const axios = require('axios');

puppeteer.use(StealthPlugin());
const puppeteerCore = require('puppeteer-core');
const app = express();

const handleCheck = async (req, res) => {
    // Получаем целевой URL из Google Таблицы (по дефолту ставим твое LEGO)
    const targetUrl = req.query.url || "https://lego.com";
    console.log(`\n===============================================================`);
    console.log(`🚀 [CHECKER ENGINE] Запуск глубинного поиска пробивающего IP!`);
    console.log(`🎯 Цель: ${targetUrl}`);
    console.log(`===============================================================`);

    let proxyPool = [];

    // 1. АВТОМАТИЧЕСКИ СКАЧИВАЕМ СВЕЖИЙ ПУЛ С FREE-PROXY-LIST.NET
    try {
        console.log("📥 Скачиваем сырой список с free-proxy-list.net...");
        const response = await axios.get('https://proxyscrape.com', { timeout: 6000 });
        if (response.data && typeof response.data === 'string') {
            const parsedIps = response.data.split('\r\n')
                .map(line => line.trim())
                .filter(line => /^([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}):([0-9]{2,5})$/.test(line));
            proxyPool = [...parsedIps];
            console.log(`✅ Пул успешно обновлен. Загружено ${proxyPool.length} элитных SSL-нод.`);
        }
    } catch (e) {
        console.log("⚠️ Не удалось скачать паблик-пул: " + e.message);
    }

    // 2. ДОБАВЛЯЕМ ТВОЙ ЛИЧНЫЙ СПИСОК (Для надежности, если авто-пул пуст)
    const myManualList = [
        "80.74.54.148:3128", "103.237.102.191:11111", "158.179.58.126:3128", 
        "45.10.163.12:80", "185.21.8.66:1080", "157.90.10.50:80"
    ];
    
    // Склеиваем списки и убираем дубликаты
    proxyPool = [...new Set([...proxyPool, ...myManualList])];
    console.log(`📊 Итоговый массив для тотального перебора: ${proxyPool.length} IP-адресов.`);

    let workingProxy = null;
    let badProxiesCount = 0;

    // 3. ТОТАЛЬНАЯ МЯСОРУБКА ПЕРЕБОРА (Проверяем максимум 20 самых быстрых нод)
    const maxTests = Math.min(proxyPool.length, 20);

    for (let i = 0; i < maxTests; i++) {
        const currentProxy = proxyPool[i];
        const proxyServerUrl = "http://" + currentProxy;
        let browser = null;

        console.log(`🔄 [Тест ${i + 1}/${maxTests}] Проверяем IP: ${currentProxy}`);

        try {
            browser = await puppeteerCore.launch({ 
                executablePath: '/usr/bin/google-chrome-stable', 
                headless: true, 
                args: [
                    '--no-sandbox', '--disable-setuid-sandbox', 
                    `--proxy-server=${proxyServerUrl}`,
                    '--disable-dev-shm-usage', '--disable-gpu',
                    '--single-process', '--no-zygote',
                    '--lang=de-DE,de;q=0.9'
                ] 
            });

            const page = await browser.newPage();
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36');
            await page.setViewport({ width: 1280, height: 800 });

            // Таймаут зажимаем до 6 секунд. Если прокси тугой — бросаем его
            await page.setDefaultNavigationTimeout(6000); 

            // Стучимся на LEGO
            await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
            
            // Ждем 2.5 секунды, пока отработает гидратация скриптов Next/Remix
            await new Promise(resolve => setTimeout(resolve, 2500));

            const html = await page.content();

            // КРИТИЧЕСКИЙ ХАКЕРСКИЙ ФИЛЬТР: Проверяем, пробита ли защита
            if (html.includes('id="__NEXT_DATA__"') && !html.includes('403 Forbidden') && !html.includes('Access Denied')) {
                console.log(`🎉🎉🎉 КРАХ ЗАЩИТЫ! IP [${currentProxy}] успешно зашел и зафиксировал цены!`);
                workingProxy = currentProxy;
                await browser.close();
                break; // Выходим из цикла, цель найдена!
            } else {
                throw new Error("Заглушка капчи или отсутствие тега цен");
            }

        } catch (err) {
            console.log(`   ❌ Нода ${currentProxy} отсечена: ${err.message}`);
            badProxiesCount++;
        } finally {
            if (browser !== null) {
                try { await browser.close(); } catch (e) {}
            }
        }
    }

    // 4. ОТДАЕМ ОТВЕТ В GOOGLE ТАБЛИЦУ
    res.setHeader('Content-Type', 'application/json; charset=UTF-8');
    if (workingProxy) {
        return res.json({
            success: true,
            ip: workingProxy,
            message: `Найдена рабочая нода после отсева ${badProxiesCount} мертвых IP.`
        });
    } else {
        return res.status(502).json({
            success: false,
            ip: null,
            message: `Мясорубка завершена. Все ${badProxiesCount} нод заблокированы сайтом.`
        });
    }
};

// Настраиваем эндпоинт для чекера
app.get('/find-live-proxy', handleCheck);

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => { console.log(`🚀 Радар-чекер запущен на порту ${PORT}`); });

