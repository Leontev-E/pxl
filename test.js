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
            if (event.state) {
                const currentUrlParams = new URLSearchParams(window.location.search);
                const newUrlParams = new URLSearchParams();

                const paramMap = {
                    source: 'source',
                    ev: 'ev',
                    acc: 'sub_id_2',
                    ad: 'sub_id_11',
                    placement: 'sub_id_3',
                    buyer: 'sub_id_4',
                    pxl: 'pxl',
                    adset: 'sub_id_5',
                    gclid: 'gclid',
                    gt: 'gt',
                    pt: 'pt'
                };

                Object.entries(paramMap).forEach(([srcParam, targetParam]) => {
                    if (currentUrlParams.has(srcParam)) {
                        newUrlParams.set(targetParam, currentUrlParams.get(srcParam));
                    }
                });

                const newUrl = `${domonetka}?${newUrlParams.toString()}`;
                location.replace(newUrl);
            }
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

(function () {
  function getCookie(name) {
    const matches = document.cookie.match(
      new RegExp('(?:^|; )' + name.replace(/([$?*|{}()[\]\\/+^])/g, '\\$1') + '=([^;]*)')
    );
    return matches ? decodeURIComponent(matches[1]) : null;
  }

  var subid = getCookie('_subid');
  if (subid) {
    // клик с Кейтаро, здесь аналитику не пишем
    return;
  }

  // чтобы не спамить кликами на каждой перезагрузке
  if (sessionStorage.getItem('analytics_click_logged') === '1') {
    return;
  }

  var payload = {
    domain: window.location.hostname,
    subid: null
  };

  try {
    fetch('https://analytics.boostclicks.ru/api/log-click.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data && data.success && data.click_id) {
          sessionStorage.setItem('analytics_click_id', String(data.click_id));
          sessionStorage.setItem('analytics_click_logged', '1');
        }
      })
      .catch(function () { /* тихо падаем */ });
  } catch (e) {
    // игнор
  }
})();

------------
    pxl

document.addEventListener("DOMContentLoaded", () => {
  const eventKey = "fbEventSent";
  const now = Date.now();
  const twoHours = 7200 * 1000;

  const storedEvent = localStorage.getItem(eventKey);
  if (storedEvent) {
    try {
      const { timestamp } = JSON.parse(storedEvent);
      if (timestamp && now - timestamp < twoHours) return;
    } catch (e) {}
  }

  const pxl = sessionStorage.getItem('pxl');
  const subid = sessionStorage.getItem('external_id');
  const eventId = sessionStorage.getItem('event_id');
  const contentIds = sessionStorage.getItem('content_ids');

  if (!pxl) return;

  // Инициализация Facebook Pixel
  !function(f,b,e,v,n,t,s){
    if(f.fbq)return;
    n=f.fbq=function(){ n.callMethod ? n.callMethod.apply(n,arguments) : n.queue.push(arguments); };
    if(!f._fbq)f._fbq=n;
    n.push=n;
    n.loaded=!0;
    n.version='2.0';
    n.queue=[];
    t=b.createElement(e);
    t.async=!0;
    t.src=v;
    s=b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t,s)
  }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');

  fbq('init', pxl);

  const customData = {};
  if (subid) customData.external_id = subid;
  if (contentIds) customData.content_ids = contentIds;

  if (eventId) {
    fbq('track', 'Lead', customData, { eventID: eventId });
  } else {
    fbq('track', 'Lead', customData);
  }

  localStorage.setItem(eventKey, JSON.stringify({ timestamp: now }));

  // Отправка name и phone как sub_id_22 и sub_id_23
  const name = new URLSearchParams(window.location.search).get("name");
  const phone = new URLSearchParams(window.location.search).get("phone");
  if (subid && name && phone) {
    const pingUrl = `${location.protocol}//${location.hostname}?_update_tokens=1&sub_id=${encodeURIComponent(subid)}&sub_id_22=${encodeURIComponent(name)}&sub_id_23=${encodeURIComponent(phone)}`;
    const trackingImg = new Image();
    trackingImg.src = pingUrl;
    trackingImg.referrerPolicy = 'no-referrer-when-downgrade';
    trackingImg.style.display = 'none';
    document.body.appendChild(trackingImg);
  }
});

// Google Tag
(() => {
  const getCookie = name => {
    const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? match[2] : "";
  };

  const gt = getCookie("gt");
  const pt = getCookie("pt");
  const ad_id = getCookie("ad_id");
  const acc = getCookie("acc");
  const buyer = getCookie("buyer");

  if (!gt || gt === "gt") return;

  const updateURL = () => {
    const url = new URL(window.location.href);
    url.searchParams.set("gt", gt);
    url.searchParams.set("pt", pt);
    url.searchParams.set("ad_id", ad_id);
    url.searchParams.set("acc", acc);
    url.searchParams.set("buyer", buyer);
    window.history.replaceState({ path: url.toString() }, "", url.toString());
    loadGTM(gt, pt);
  };

  const loadGTM = (gt, pt) => {
    const gtmScript = document.createElement("script");
    gtmScript.src = `https://www.googletagmanager.com/gtag/js?id=${gt}`;
    gtmScript.async = true;
    document.head.appendChild(gtmScript);

    gtmScript.onload = () => {
      window.dataLayer = window.dataLayer || [];

      if (typeof window.gtag !== "function") {
        window.gtag = function () {
          window.dataLayer.push(arguments);
        };
      }

      window.gtag("js", new Date());
      window.gtag("config", gt);

      // Вызов conversion после полной загрузки
      window.gtag("event", "conversion", {
        send_to: `${gt}/${pt}`,
        event_callback: function () {
          console.log("✅ Конверсия отправлена в Google Ads");
        }
      });
    };
  };

  updateURL();
})();

    (function () {
        var subid = sessionStorage.getItem('external_id');
        if (subid) return;

        var params = new URLSearchParams(window.location.search);

        function decodeSafe(value) {
            if (!value) return '';
            try { return decodeURIComponent(value.replace(/\+/g, ' ')); }
            catch (e) { return value; }
        }

        var rawName = params.get('name') || '';
        var rawPhone = params.get('phone') || '';

        var name = decodeSafe(rawName).replace(/\s+/g, ' ').trim();
        var phone = decodeSafe(rawPhone).replace(/[^0-9+]/g, '');

        var clickId = sessionStorage.getItem('analytics_click_id') || null;

        var payload = {
            domain: window.location.hostname,
            name: name,
            phone: phone,
            click_id: clickId ? parseInt(clickId, 10) : null,
            subid: null
        };

        try {
            fetch('https://analytics.boostclicks.ru/api/log-lead.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            }).catch(function () { });
        } catch (e) { }
    })();

