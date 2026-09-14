const handleCheck = async (req, res) => {
    const targetUrl = req.query.url || "https://lego.com";
    console.log(`\n===============================================================`);
    console.log(`🚀 [RADAR SCANNER] Тотальный перебор глобальных No-Code пулов!`);
    console.log(`🎯 Цель: ${targetUrl}`);
    console.log(`===============================================================`);

    let proxyPool = [];

    // СОБИРАЕМ IP ИЗ ТРЕХ ГЛОБАЛЬНЫХ БЕСПЛАТНЫХ ИСТОЧНИКОВ ОДНОВРЕМЕННО
    const sources = [
        'https://proxyscrape.com',
        'https://pubproxy.com',
        'https://githubusercontent.com' // Огромный бессмертный гит-пул на 1000+ IP
    ];

    for (const srcUrl of sources) {
        try {
            console.log(`📥 Качаем пачку IP из источника...`);
            const response = await axios.get(srcUrl, { timeout: 5000 });
            if (response.data && typeof response.data === 'string') {
                const parsed = response.data.split('\n')
                    .map(line => line.trim())
                    .filter(line => /^([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}):([0-9]{2,5})$/.test(line));
                proxyPool = [...proxyPool, ...parsed];
            }
        } catch (e) {
            console.log(`⚠️ Провайдер прокси временно недоступен`);
        }
    }

    // Убираем дубликаты и перемешиваем пул, чтобы тесты всегда были уникальными
    proxyPool = [...new Set(proxyPool)].sort(() => Math.random() - 0.5);
    console.log(`📊 Глобальный Радар собрал [${proxyPool.length}] свежих уникальных IP-нод для теста!`);

    let workingProxy = null;
    let badProxiesCount = 0;

    // Проверяем максимум 25 самых свежих случайных нод из пула
    const maxTests = Math.min(proxyPool.length, 25);
    console.log(`🚀 Начинаем циклическую мясорубку Хрома для ${maxTests} нод...`);

    for (let i = 0; i < maxTests; i++) {
        const currentProxy = proxyPool[i];
        const proxyServerUrl = "http://" + currentProxy;
        let browser = null;

        console.log(`🔄 [Тест ${i + 1}/${maxTests}] Проверяем канал: ${currentProxy}`);

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
            
            // Блокируем картинки, чтобы бесплатные прокси не висли
            await page.setRequestInterception(true);
            page.on('request', (req) => {
                if (['image', 'font', 'media'].includes(req.resourceType())) req.abort();
                else req.continue();
            });

            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36');
            await page.setViewport({ width: 1280, height: 800 });

            // 5.5 секунд на одну ноду. Медленные отсекаем сразу
            await page.setDefaultNavigationTimeout(5500); 

            await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
            await new Promise(resolve => setTimeout(resolve, 2000));

            const html = await page.content();

            // Если нашли технический блок Next.js/Remix и нет надписи "Забанено"
            if (html.includes('id="__NEXT_DATA__"') && !html.includes('403 Forbidden') && !html.includes('Access Denied') && html.length > 15000) {
                console.log(`🎉 🎉 🎉 ЗАЩИТА ЛЕГО СЛОМАНА! Рабочий IP найден: [${currentProxy}]`);
                workingProxy = currentProxy;
                await browser.close();
                break; 
            } else {
                throw new Error("Капча или пустой HTML каркас");
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
            message: `Успех! Живой IP зафиксирован.`
        });
    } else {
        return res.status(502).json({
            success: false,
            ip: null,
            message: `Мясорубка завершена. Все ${badProxiesCount} нод заблокированы сайтом.`
        });
    }
};

app.get('/find-live-proxy', handleCheck);

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => { console.log(`🚀 Радар-чекер запущен на порту ${PORT}`); });


