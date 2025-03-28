(function () {
    // Вспомогательная функция для получения значения cookie
    function getCookie(name) {
        const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
        return match ? match[2] : null;
    }

    // Получаем URL-параметры один раз
    const urlParams = new URLSearchParams(window.location.search);
    const pxl = urlParams.get('pxl') || '';
    const contentIds = urlParams.get('content_ids');
    const subid = getCookie('_subid');

    // Вспомогательная функция для записи в sessionStorage, если значение существует
    const setSessionItem = (key, value) => {
        if (value) sessionStorage.setItem(key, value);
    };

    setSessionItem('pxl', pxl);
    setSessionItem('external_id', subid);
    setSessionItem('event_id', subid);
    setSessionItem('content_ids', contentIds);

    // Проверяем, что переменная domonetka определена и не пустая
    if (typeof domonetka !== 'undefined' && domonetka) {
        setSessionItem('dom', domonetka);
    }

    // Инициализация Facebook Pixel, если указан pxl
    if (pxl) {
        !function (f, b, e, v, n, t, s) {
            if (f.fbq) return;
            n = f.fbq = function () {
                n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
            };
            if (!f._fbq) f._fbq = n;
            n.push = n;
            n.loaded = true;
            n.version = '2.0';
            n.queue = [];
            t = b.createElement(e);
            t.async = true;
            t.src = v;
            s = b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t, s);
        }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');

        fbq('init', pxl);

        if (contentIds) {
            fbq('track', 'PageView', { content_ids: contentIds });
        } else {
            fbq('track', 'PageView');
        }
    }

    // Обработка переходов для domonetka
if (typeof domonetka !== 'undefined' && domonetka && domonetka.trim() !== '' && domonetka !== '{domonetka}') {
    try {
        window.onpopstate = function (event) {
            const currentUrlParams = new URLSearchParams(window.location.search);
            const newUrlParams = new URLSearchParams();

            if (currentUrlParams.has('source')) {
                newUrlParams.set('source', currentUrlParams.get('source'));
            }
            if (currentUrlParams.has('ev')) {
                newUrlParams.set('ev', currentUrlParams.get('ev'));
            }
            if (currentUrlParams.has('acc')) {
                newUrlParams.set('sub_id_2', currentUrlParams.get('acc'));
            }
            if (currentUrlParams.has('placement')) {
                newUrlParams.set('sub_id_3', currentUrlParams.get('placement'));
            }
            if (currentUrlParams.has('buyer')) {
                newUrlParams.set('sub_id_4', currentUrlParams.get('buyer'));
            }
            if (currentUrlParams.has('pxl')) {
                newUrlParams.set('pxl', currentUrlParams.get('pxl'));
            }
            if (currentUrlParams.has('adset')) {
                newUrlParams.set('sub_id_5', currentUrlParams.get('adset'));
            }

            newUrlParams.set('sub_id_22', 'domonetka');

            const newUrl = `${domonetka}?${newUrlParams.toString()}`;
            location.replace(newUrl);
        };

        for (let i = 0; i < 10; i++) {
            setTimeout(() => history.pushState({}, "", window.location.href), i * 50);
        }
    } catch (error) {
        console.error(error);
    }
}

    // Установка UTMCookies и интеграция Google Tag Manager
    function setUTMCookies() {
        const utmParameters = ['gt', 'pt', 'ad_id', 'acc', 'buyer'];
        utmParameters.forEach(param => {
            if (urlParams.has(param)) {
                const value = urlParams.get(param);
                document.cookie = `${param}=${encodeURIComponent(value)}; path=/; max-age=3600`;
            }
        });
    }
    setUTMCookies();

    if (urlParams.has('gt')) {
        const gt = urlParams.get('gt');
        const gtmScript = document.createElement('script');
        gtmScript.async = true;
        gtmScript.src = `https://www.googletagmanager.com/gtag/js?id=${gt}`;
        document.head.appendChild(gtmScript);
        window.dataLayer = window.dataLayer || [];
        window.gtag = function () {
            window.dataLayer.push(arguments);
        };
        gtag('js', new Date());
        gtag('config', gt);
    }

    // Отслеживание времени нахождения на сайте (sub_id_21)
    if (subid && subid !== '{subid}') {
        const clickid = subid;
        const address = `${window.location.protocol}//${window.location.hostname}?_update_tokens=1&sub_id=${clickid}`;
    
        var step = 5;
        var counter = 0;
        setInterval(function () {
            counter += step;
            createPixel(`${address}&sub_id_21=${counter}`);
        }, step * 1000);
    }
    
    function createPixel(url) {
        var img = document.createElement('img');
        img.src = url;
        img.referrerPolicy = 'no-referrer-when-downgrade';
        img.style.display = 'none';
        document.body.appendChild(img);
    }
})();
