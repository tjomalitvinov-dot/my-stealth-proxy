const express = require('express');
const axios = require('axios');
const app = express();

const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
];

// Умный чистильщик твоего скопированного текстового списка
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
    
    console.log(`📡 Скоростной запуск. Качаем сырой текст страницы: ${targetUrl}`);
    
    // СЮДА ТЫ ВСТАВЛЯЕШЬ СВОЙ СПИСОК «КАК ЕСТЬ»
    const myRawProxyList = [
IP Address	Port	Code	Country	Anonymity	Google	Https	Last Checked
109.199.119.160	80	FR	France	anonymous	no	no	1 min ago
14.225.2.98	808	VN	Vietnam	elite proxy	no	yes	1 min ago
176.61.151.123	80	PT	Portugal	elite proxy	no	no	1 min ago
196.1.93.10	80	SN	Senegal	elite proxy	no	no	1 min ago
8.219.94.23	7890	SG	Singapore	elite proxy	yes	yes	1 min ago
103.3.59.209	8080	ID	Indonesia	anonymous		yes	1 min ago
172.104.56.95	8888	SG	Singapore	anonymous	no	yes	1 min ago
45.10.163.12	80	DE	Germany	elite proxy		no	1 min ago
91.103.120.48	80	HK	Hong Kong	anonymous	no	no	1 min ago
197.221.249.199	80	ZW	Zimbabwe	anonymous		no	1 min ago
197.221.234.252	80	ZW	Zimbabwe	anonymous		no	1 min ago
183.110.216.128	8090	KR	South Korea	anonymous		no	1 min ago
138.0.21.81	1020	BR	Brazil	elite proxy		no	1 min ago
219.65.73.80	80	IN	India	anonymous	no	no	1 min ago
156.67.110.124	10808	IN	India	elite proxy		no	1 min ago
41.220.22.7	80	ZW	Zimbabwe	anonymous		no	1 min ago
149.248.18.106	8118	US	United States	elite proxy		no	1 min ago
196.1.93.16	80	SN	Senegal	elite proxy	no	no	1 min ago
117.236.124.166	3128	IN	India	elite proxy	yes	yes	1 min ago
34.69.61.247	80	US	United States	anonymous		no	1 min ago
154.68.64.6	80	RW	Rwanda	anonymous		no	1 min ago
45.43.60.220	8080	JP	Japan	anonymous		no	1 min ago
138.68.235.51	80	US	United States	elite proxy	no	no	1 min ago
5.39.255.142	8118	DE	Germany	transparent	no	no	1 min ago
3.10.170.234	3128	GB	United Kingdom	elite proxy	no	yes	1 min ago
72.56.73.23	80	NL	Netherlands	anonymous		no	1 min ago
14.251.13.20	8080	VN	Vietnam	elite proxy	no	yes	1 min ago
45.194.41.16	8080	IN	India	anonymous		no	1 min ago
103.237.102.191	11111	DE	Germany	elite proxy	yes	yes	1 min ago
65.109.217.164	3128	FI	Finland	elite proxy	no	yes	1 min ago
47.81.56.193	8888	TH	Thailand	elite proxy	yes	yes	1 min ago
152.53.183.107	8081	DE	Germany	elite proxy	no	yes	1 min ago
194.31.108.109	2080	IR	Iran	elite proxy	no	yes	1 min ago
197.221.240.247	80	ZW	Zimbabwe	anonymous		no	1 min ago
14.139.235.82	3128	IN	India	anonymous		yes	1 min ago
101.32.65.42	8888	HK	Hong Kong	elite proxy		yes	1 min ago
2.56.109.190	8082	TR	Turkey	anonymous		yes	1 min ago
146.56.110.131	8118	KR	South Korea	elite proxy		yes	1 min ago
195.26.224.135	80	NL	Netherlands	anonymous	no	no	1 min ago
195.114.209.50	80	ES	Spain	elite proxy	no	no	1 min ago
41.184.92.221	80	NG	Nigeria	anonymous	no	no	1 min ago
143.42.66.91	80	SG	Singapore	anonymous	no	no	1 min ago
103.65.237.92	5678	ID	Indonesia	anonymous		no	1 min ago
159.65.245.255	80	US	United States	elite proxy	no	no	1 min ago
65.21.201.149	8081	FI	Finland	anonymous		no	1 min ago
37.187.74.125	80	FR	France	elite proxy	no	no	1 min ago
197.221.237.248	80	ZW	Zimbabwe	anonymous		no	1 min ago
97.74.87.226	80	SG	Singapore	anonymous	no	no	1 min ago
41.220.16.215	80	ZW	Zimbabwe	anonymous		no	1 min ago
47.84.84.1	3128	SG	Singapore	elite proxy	no	yes	1 min ago
73.162.86.230	443	US	United States	anonymous	yes	yes	1 min ago
202.133.88.173	80	FR	France	anonymous	no	no	1 min ago
107.150.41.226	18080	US	United States	elite proxy	no	yes	1 min ago
103.95.34.186	3128	MY	Malaysia	anonymous	no	no	1 min ago
14.161.10.46	80	VN	Vietnam	anonymous	no	no	1 min ago
45.146.163.31	80	JP	Japan	anonymous	no	no	1 min ago
202.28.194.139	31280	TH	Thailand	elite proxy	no	yes	1 min ago
45.91.248.107	80	US	United States	anonymous	no	no	1 min ago
43.133.175.183	7890	JP	Japan	anonymous		no	1 min ago
39.109.113.97	4090	HK	Hong Kong	anonymous	no	no	1 min ago
219.65.73.81	80	IN	India	anonymous	no	no	1 min ago
34.44.49.215	80	US	United States	elite proxy	no	no	1 min ago
46.47.197.210	3128	RU	Russian Federation	elite proxy		no	1 min ago
219.93.101.60	80	MY	Malaysia	anonymous	no	no	1 min ago
219.93.101.62	80	MY	Malaysia	anonymous	no	no	1 min ago
156.38.112.11	80	GH	Ghana	elite proxy	no	no	1 min ago
162.214.74.29	3128	US	United States	anonymous	no	no	1 min ago
167.99.124.118	80	US	United States	anonymous	no	no	1 min ago
162.214.159.94	3128	US	United States	anonymous	no	no	1 min ago
79.137.78.133	8005	FR	France	elite proxy	yes	yes	1 min ago
47.85.161.37	3128	US	United States	elite proxy	no	no	1 min ago
195.158.8.123	3128	UZ	Uzbekistan	elite proxy	no	yes	1 min ago
165.154.162.73	8888	US	United States	elite proxy	no	yes	1 min ago
190.58.248.86	80	TT	Trinidad and Tobago	anonymous	no	no	1 min ago
32.223.6.94	80	US	United States	anonymous	no	no	1 min ago
196.1.95.124	80	SN	Senegal	elite proxy	no	no	1 min ago
52.34.243.150	8080	US	United States	elite proxy	no	no	1 min ago
219.93.101.63	80	MY	Malaysia	anonymous	no	no	1 min ago
0.0.0.0	80		Unknown	anonymous	no	no	1 min ago
8.219.97.248	80	SG	Singapore	anonymous	no	yes	1 min ago
127.0.0.7	80		Unknown	anonymous	no	no	1 min ago
41.33.89.100	1976	EG	Egypt	anonymous	yes	yes	1 min ago
43.153.123.79	80	US	United States	anonymous	yes	yes	1 min ago
41.33.245.138	1981	EG	Egypt	anonymous	yes	yes	1 min ago
152.166.69.34	8080	DO	Dominican Republic	anonymous	yes	yes	1 min ago
45.194.41.141	8080	IN	India	anonymous	yes	yes	1 min ago
184.75.221.82	3118	CA	Canada	anonymous	no	yes	1 min ago
186.235.123.3	8080	BR	Brazil	transparent	no	no	1 min ago
172.237.11.129	3128	JP	Japan	anonymous		no	1 min ago
5.45.126.128	8080	EE	Estonia	anonymous		no	1 min ago
163.172.53.142	80	FR	France	elite proxy		no	1 min ago
51.75.206.209	80	FR	France	elite proxy		no	1 min ago
196.1.97.198	80	SN	Senegal	elite proxy		no	1 min ago
38.58.182.147	18080	US	United States	elite proxy	yes	yes	1 min ago
47.91.104.88	3128	AE	United Arab Emirates	elite proxy		no	1 min ago
80.74.54.148	3128	DE	Germany	anonymous		no	2 mins ago
8.215.25.3	2080	ID	Indonesia	elite proxy	no	yes	2 mins ago
174.138.119.88	80	US	United States	elite proxy	no	no	2 mins ago
45.194.41.231	8080	IN	India	anonymous		no	2 mins ago
41.220.16.223	80	ZW	Zimbabwe	anonymous		no	2 mins ago
104.154.186.48	80	US	United States	anonymous		no	2 mins ago
34.134.231.117	3129	US	United States	anonymous	no	yes	2 mins ago
103.154.119.45	8080	ID	Indonesia	transparent	no	no	4 mins ago
38.41.0.87	999	VE	Venezuela	transparent	no	no	4 mins ago
38.101.88.246	999	MX	Mexico	transparent	no	no	4 mins ago
36.64.193.226	8080	ID	Indonesia	transparent	no	no	4 mins ago
103.169.138.13	8081	ID	Indonesia	transparent	no	no	5 mins ago
45.180.26.1	999	CL	Chile	transparent	no	no	7 mins ago
        "185.21.8.66	1080	DE	Germany	anonymous		yes	1 min ago"
    ];
    
    const processedProxies = parseRawInputList(myRawProxyList);
    let badProxiesReport = [];
    let rawHtmlOutput = null;

    // Цикл быстрого текстового перебора
    for (let i = 0; i < processedProxies.length; i++) {
        const currentProxy = processedProxies[i];
        const [proxyHost, proxyPort] = currentProxy.split(':');
        
        console.log(`🔄 Текстовый прорыв №${i + 1}/${processedProxies.length} через IP: ${currentProxy}`);
        
        try {
            const selectedUA = userAgents[Math.floor(Math.random() * userAgents.length)];

            // Делаем чистый GET-запрос без запуска браузера
            const response = await axios.get(targetUrl, {
                proxy: {
                    protocol: 'http',
                    host: proxyHost,
                    port: parseInt(proxyPort, 10)
                },
                headers: {
                    'User-Agent': selectedUA,
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                    'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7',
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                },
                timeout: 2500, // Жесткие 5 секунд на отдачу текста. Быстрые прокси отдадут его мгновенно
                responseType: 'text'
            });

            if (response.data && response.data.length > 5000) {
                // Защита: проверяем, не подсунул ли сайт заглушку блокировки
                if (response.data.includes('403 Forbidden') || response.data.includes('Access Denied')) {
                    throw new Error("Блокировка Akamai/Cloudflare (Код 403)");
                }
                
                rawHtmlOutput = response.data;
                console.log(`✅ УСПЕХ! Сырой HTML текст страницы успешно скачан через: ${currentProxy}`);
                break; // Выходим из цикла, цель достигнута!
            } else {
                throw new Error("Сайт вернул пустой или слишком короткий ответ");
            }

        } catch (error) {
            const errMsg = error.response ? `HTTP ${error.response.status}` : error.message;
            console.error(`❌ Сбой ноды ${currentProxy}: ${errMsg}`);
            badProxiesReport.push({ ip: currentProxy, error: errMsg });
        }
    }

    if (!rawHtmlOutput) {
        res.setHeader('Content-Type', 'text/html; charset=UTF-8');
        let errorHtml = `<h1>❌ Все прокси из твоего текстового списка отклонили запрос!</h1><h3>Отчет перебора:</h3><ul>`;
        badProxiesReport.forEach(item => {
            errorHtml += `<li><b>${item.ip}</b> — <span style="color:red;">${item.error}</span></li>`;
        });
        errorHtml += `</ul>`;
        return res.status(502).send(errorHtml);
    }

    // Отдаем чистый сырой HTML-текст страницы прямо в Google Таблицу
    res.setHeader('Content-Type', 'text/html; charset=UTF-8');
    return res.send(rawHtmlOutput);
};

app.get('/parse', handleParse);
app.post('/parse', express.json(), handleParse);

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => { console.log(`🚀 Высокоскоростной HTTP-шлюз запущен на порту ${PORT}`); });


