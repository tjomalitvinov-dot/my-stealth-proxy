const express = require('express');
const axios = require('axios');

const app = express();

const handleParse = async (req, res) => {
    const targetUrl = req.query.url || req.body?.url;
    if (!targetUrl) return res.status(400).send("ОШИБКА: Пропущен параметр url!");
    
    // ТВОИ ПРИВАТНЫЕ РЕЗИДЕНТНЫЕ ПРОКСИ ДЛЯ ПРОБИТИЯ CLOUDFLARE
    const login = "qkldfjel";
    const pass = "vocepvsvpszv";
    const rawIps = [
        "31.59.20.176:6754", "45.38.107.97:6014", "64.137.96.74:6641", "198.23.243.226:6361", 
        "38.154.185.97:6370", "84.247.60.125:6095", "142.111.67.146:5611", "31.58.9.4:6077", 
        "80.74.54.148:3128", "195.114.209.50:80", "176.61.151.123:80", "66.151.34.89:80", 
        "85.17.200.39:3128", "157.90.10.50:80", "85.214.107.177:80", "94.79.152.14:80", "185.85.111.18:80"
    ];
    
    const randomIp = rawIps[Math.floor(Math.random() * rawIps.length)];
    const [proxyHost, proxyPort] = randomIp.split(':');
    
    console.log(`🥷 [CONRAD PROXY BRIDGE] Пробиваем Cloudflare через ноду: ${randomIp} для: ${targetUrl}`);

    const axiosConfig = {
        timeout: 20000, // Жесткий короткий лимит 20 секунд
        headers: {
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'accept-language': 'nl-NL,nl;q=0.9,en-US;q=0.8,en;q=0.7',
            'cache-control': 'no-cache',
            'pragma': 'no-cache',
            'referer': 'https://conrad.nl'
        },
        // Подключаем резидентную ноду с авторизацией
        proxy: {
            protocol: 'http',
            host: proxyHost,
            port: parseInt(proxyPort, 10),
            auth: { username: login, password: pass }
        }
    };

    try {
        // Делаем легкий и сверхскоростной прямой GET-запрос страницы через прокси-туннель
        const response = await axios.get(targetUrl, axiosConfig);
        const html = response.data;
        
        if (!html) {
            res.setHeader('Content-Type', 'text/plain; charset=UTF-8');
            return res.status(500).send("[ОШИБКА] Шлюз вернул пустой HTML");
        }

        const htmlLength = html.length;
        const hasInitialState = html.includes('__INITIAL_STATE__');
        console.log(`✅ [УСПЕХ] Страница Конрада выкачана! Длина: ${htmlLength} симв. | Наличие стейта: [${hasInitialState}]`);

        // Возвращаем полный пробитый HTML обратно в твою Google Таблицу для функции regex
        res.setHeader('Content-Type', 'text/html; charset=UTF-8');
        return res.send(html);

    } catch (error) {
        let errorReport = `[КРАХ ТУННЕЛЯ КОНРАДА] Ошибка: ${error.message} на ноде ${randomIp}`;
        if (error.response) {
            errorReport += ` | HTTP Код: ${error.response.status} | Детали: ${JSON.stringify(error.response.data).substring(0, 100)}`;
        }
        console.error("❌ " + errorReport);
        res.setHeader('Content-Type', 'text/plain; charset=UTF-8');
        return res.status(500).send(errorReport);
    }
};

app.get('/parse', handleParse);
app.post('/parse', express.json(), handleParse);

const PORT = process.env.PORT || 7860;
app.listen(PORT, () => { console.log(`🚀 Легкий гибридный шлюз Conrad успешно запущен на порту ${PORT}`); });



