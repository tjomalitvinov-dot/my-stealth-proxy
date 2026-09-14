    try {
        const selectedUA = userAgents[Math.floor(Math.random() * userAgents.length)];
        
        // УМНЫЙ ПЕРЕХВАТ: Читаем IP-адрес, который передала Google Таблица через ссылку
        const incomingProxy = req.query.proxy || req.body?.proxy;
        let puppeteerArgs = [
            '--no-sandbox', 
            '--disable-setuid-sandbox', 
            '--disable-dev-shm-usage', 
            '--disable-gpu',
            '--single-process', 
            '--no-zygote',
            '--lang=de-DE,de;q=0.9'
        ];

        if (incomingProxy) {
            console.log(`🔄 [PROXY DETECTED] Направляем Хром через IP из таблицы: http://${incomingProxy}`);
            puppeteerArgs.push(`--proxy-server=http://${incomingProxy}`);
        } else {
            console.log(`🌐 [DIRECT CONNECTION] IP из таблицы не передан. Заходим через домашний IP сервера.`);
        }

        browser = await puppeteerCore.launch({ 
            executablePath: '/usr/bin/google-chrome-stable', 
            headless: true, 
            args: puppeteerArgs
        });
        
        const page = await browser.newPage();
        
        // Если прокси приватный (логин:пароль@IP:порт), вырезаем доступы для авторизации
        if (incomingProxy && incomingProxy.includes('@')) {
            const [authPart] = incomingProxy.split('@');
            const [username, password] = authPart.split(':');
            await page.authenticate({ username, password });
            console.log(`🔑 Авторизация для приватного прокси выполнена успешно!`);
        }
