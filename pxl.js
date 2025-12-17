document.addEventListener("DOMContentLoaded", () => {
    const eventKey = "fbEventSent";
    const now = Date.now();
    const twoHours = 7200 * 1000;

    const storedEvent = localStorage.getItem(eventKey);
    if (storedEvent) {
        try {
            const { timestamp } = JSON.parse(storedEvent);
            if (timestamp && now - timestamp < twoHours) return;
        } catch (e) { }
    }

    const pxl = sessionStorage.getItem('pxl');
    const subid = sessionStorage.getItem('external_id');
    const eventId = sessionStorage.getItem('event_id');
    const contentIds = sessionStorage.getItem('content_ids');

    if (!pxl) return;

    // Инициализация Facebook Pixel
    !function (f, b, e, v, n, t, s) {
        if (f.fbq) return;
        n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
        if (!f._fbq) f._fbq = n;
        n.push = n;
        n.loaded = !0;
        n.version = '2.0';
        n.queue = [];
        t = b.createElement(e);
        t.async = !0;
        t.src = v;
        s = b.getElementsByTagName(e)[0];
        s.parentNode.insertBefore(t, s)
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
    // Берём сабайди: если boostclicks — логируем, если чужой трекер — не шлём.
    var trackerSubid = sessionStorage.getItem('external_id') || sessionStorage.getItem('boostclicks_subid');
    var subid = null;
    if (trackerSubid) {
        trackerSubid = String(trackerSubid).trim();
        if (trackerSubid.indexOf('boostclicks_') === 0) {
            subid = trackerSubid;
        } else {
            return; // чужой трекер, сервер всё равно заблокирует
        }
    }

    var hostname = window.location.hostname;
    var isSubdomain = ((hostname.match(/\./g) || []).length > 1);

    // do not log lead if coming from subdomain (сервер тоже режет поддомены)
    if (isSubdomain) return;

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

    var tags = null;
    try {
        var storedTags = sessionStorage.getItem('analytics_tags');
        if (storedTags) {
            var parsed = JSON.parse(storedTags);
            if (parsed && typeof parsed === 'object') {
                tags = parsed;
            }
        }
    } catch (e) { }

    if (!tags) {
        // fallback: собрать из URL/cookie, если по какой-то причине не сохранили на клике
        var allow = { gclid: 1, buyer: 1, acc: 1, gt: 1, pt: 1 };
        var searchParams = new URLSearchParams(window.location.search);
        var t = {};
        searchParams.forEach(function (value, key) {
            if (!value) return;
            var k = String(key).toLowerCase();
            if (k.indexOf('utm_') === 0 || allow[k]) {
                var v = decodeSafe(value).trim();
                if (v) t[k] = v.slice(0, 200);
            }
        });
        var getCookie = function (name) {
            var full = '; ' + document.cookie;
            var parts = full.split('; ' + name + '=');
            if (parts.length < 2) return null;
            return decodeSafe(parts.pop().split(';').shift());
        };
        Object.keys(allow).forEach(function (k) {
            if (t[k]) return;
            var cv = getCookie(k);
            if (!cv) return;
            cv = decodeSafe(cv).trim();
            if (cv) t[k] = cv.slice(0, 200);
        });
        if (Object.keys(t).length) tags = t;
    }

    var payload = {
        domain: hostname,
        name: name,
        phone: phone,
        click_id: clickId ? parseInt(clickId, 10) : null,
        subid: subid
    };

    if (tags && Object.keys(tags).length) {
        payload.tags = tags;
    }

    try {
        fetch('https://analytics.boostclicks.ru/api/log-lead.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        }).catch(function () { });
    } catch (e) { }
})();
