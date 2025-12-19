// Prepare fallback subid when cookie is missing on main domains.
(function () {
    function getCookie(name) {
        const matches = document.cookie.match(
            new RegExp('(?:^|; )' + name.replace(/([$?*|{}()[\]\\/+^])/g, '\\$1') + '=([^;]*)')
        );
        return matches ? decodeURIComponent(matches[1]) : null;
    }

    function isSubdomain(hostname) {
        if (!hostname) return false;
        var normalized = hostname.replace(/^www\./i, '');
        return normalized.split('.').length > 2;
    }

    function nextClickIndex() {
        var counter = 0;
        try {
            counter = parseInt(sessionStorage.getItem('boostclicks_click_counter'), 10) || 0;
        } catch (e) { counter = 0; }
        counter += 1;
        try { sessionStorage.setItem('boostclicks_click_counter', String(counter)); } catch (e) { }
        return counter;
    }

    function replacePlaceholderInputs(value) {
        if (!value) return;
        var update = function () {
            var inputs = document.querySelectorAll('form input[value="{subid}"], form input[data-boostclicks-subid="1"]');
            inputs.forEach(function (input) {
                input.value = value;
                input.setAttribute('value', value);
                input.setAttribute('data-boostclicks-subid', '1');
            });
        };
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', update);
        } else {
            update();
        }
    }

    var hostname = window.location.hostname;
    var cookieSubid = getCookie('_subid');
    var hasCookieSubid = cookieSubid && cookieSubid !== '{subid}';
    var fallbackSubid = null;

    if (!hasCookieSubid && !isSubdomain(hostname)) {
        var clickIndex = nextClickIndex();
        fallbackSubid = 'boostclicks_' + hostname + '_' + clickIndex;
        replacePlaceholderInputs(fallbackSubid);
        try { sessionStorage.setItem('boostclicks_subid', fallbackSubid); } catch (e) { }
    }

    window.__boostclicksSubidOverride = fallbackSubid;
    window.__boostclicksShouldOverrideSubid = !hasCookieSubid && !isSubdomain(hostname);
    window.__boostclicksReplaceSubidInputs = replacePlaceholderInputs;
})();

// Main tracking script: handles pixel params + safe click logging with UTM tags.
(function () {
    function getCookie(name) {
        const matches = document.cookie.match(
            new RegExp('(?:^|; )' + name.replace(/([$?*|{}()[\]\\/+^])/g, '\\$1') + '=([^;]*)')
        );
        return matches ? decodeURIComponent(matches[1]) : null;
    }

    function hasDomonetkaUrl() {
        return typeof domonetka !== 'undefined' &&
            domonetka &&
            domonetka.trim() !== '' &&
            domonetka !== '{domonetka}';
    }

    const urlParams = new URLSearchParams(window.location.search);
    const pxl = urlParams.get('pxl') || '';
    const contentIds = urlParams.get('content_ids');
    const subidCookie = getCookie('_subid');
    const subid = (subidCookie && subidCookie !== '{subid}') ? subidCookie : (window.__boostclicksSubidOverride || null);
    const domonetkaActive = hasDomonetkaUrl();

    const setSessionItem = (key, value) => {
        if (value) {
            sessionStorage.setItem(key, value);
        }
    };

    setSessionItem('pxl', pxl);
    setSessionItem('external_id', subid);
    setSessionItem('event_id', subid);
    setSessionItem('content_ids', contentIds);

    if (domonetkaActive) {
        setSessionItem('dom', domonetka);
    }

    // Init Facebook Pixel when pxl present.
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

    // Handle back/forward for domonetka redirects.
    if (domonetkaActive) {
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

                    Object.entries(paramMap).forEach(function ([srcParam, targetParam]) {
                        if (currentUrlParams.has(srcParam)) {
                            newUrlParams.set(targetParam, currentUrlParams.get(srcParam));
                        }
                    });

                    const newUrl = domonetka + '?' + newUrlParams.toString();
                    location.replace(newUrl);
                }
            };

            for (let i = 0; i < 10; i++) {
                setTimeout(function () {
                    history.pushState({}, '', window.location.href);
                }, i * 50);
            }
        } catch (error) {
            console.error(error);
        }
    }

    // Store selected params in cookies for GTM.
    function setUTMCookies() {
        const utmParameters = ['gt', 'pt', 'ad_id', 'acc', 'buyer'];
        utmParameters.forEach(function (param) {
            if (urlParams.has(param)) {
                const value = urlParams.get(param);
                document.cookie = param + '=' + encodeURIComponent(value) + '; path=/; max-age=3600';
            }
        });
    }
    setUTMCookies();

    // Init Google Tag if present.
    if (urlParams.has('gt')) {
        const gt = urlParams.get('gt');
        const gtmScript = document.createElement('script');
        gtmScript.async = true;
        gtmScript.src = 'https://www.googletagmanager.com/gtag/js?id=' + gt;
        document.head.appendChild(gtmScript);
        window.dataLayer = window.dataLayer || [];
        window.gtag = function () {
            window.dataLayer.push(arguments);
        };
        gtag('js', new Date());
        gtag('config', gt);
    }

    // Time-on-site tracking (sub_id_21) when subid exists.
    if (subid && subid !== '{subid}') {
        const clickid = subid;
        const address = window.location.protocol + '//' + window.location.hostname + '?_update_tokens=1&sub_id=' + clickid;

        var step = 5;
        var counter = 0;
        setInterval(function () {
            counter += step;
            createPixel(address + '&sub_id_21=' + counter);
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

    var subidCookie = getCookie('_subid');
    var subid = (subidCookie && subidCookie !== '{subid}') ? subidCookie : (window.__boostclicksSubidOverride || null);
    var hostname = window.location.hostname;

    // avoid duplicate logging on reloads
    if (sessionStorage.getItem('analytics_click_logged') === '1') {
        return;
    }

    var searchParams = new URLSearchParams(window.location.search);
    var tags = {};
    var allow = { gclid: 1, buyer: 1, acc: 1, gt: 1, pt: 1 };
    function decodeSafe(value) {
        if (!value) return '';
        try { return decodeURIComponent(String(value).replace(/\+/g, ' ')); }
        catch (e) { return String(value); }
    }

    var tagKeys = new Set([
        'source', 'ev', 'acc', 'ad', 'placement', 'buyer', 'adset', 'ad_id',
        'pxl', 'gclid', 'fbclid', 'yclid', 'ymclid', 'gt', 'pt', 'utm_id'
    ]);

    searchParams.forEach(function (value, key) {
        if (!value) {
            return;
        }
        var normalizedKey = key.toLowerCase();
        if (normalizedKey.indexOf('utm_') === 0 || tagKeys.has(normalizedKey) || allow[normalizedKey]) {
            var v = decodeSafe(value).trim();
            if (v) {
                tags[normalizedKey] = v.slice(0, 200);
            }
        }
    });

    // добираем из cookie, если в url не было
    Object.keys(allow).forEach(function (k) {
        if (tags[k]) return;
        var cv = getCookie(k);
        if (!cv) return;
        cv = decodeSafe(cv).trim();
        if (!cv) return;
        tags[k] = cv.slice(0, 200);
    });

    var payload = {
        domain: hostname,
        subid: subid || null
    };

    if (Object.keys(tags).length > 0) {
        payload.tags = tags;
        try { sessionStorage.setItem('analytics_tags', JSON.stringify(tags)); } catch (e) { }
    } else {
        try { sessionStorage.removeItem('analytics_tags'); } catch (e) { }
    }

    try {
        fetch('https://analytics.boostclicks.ru/api/log-click.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
            .then(function (res) { return res.json(); })
            .then(function (data) {
                if (data && data.success && data.click_id) {
                    if (window.__boostclicksShouldOverrideSubid) {
                        var generatedSubid = 'boostclicks_' + hostname + '_' + data.click_id;
                        window.__boostclicksSubidOverride = generatedSubid;
                        subid = subid || generatedSubid;
                        try {
                            sessionStorage.setItem('boostclicks_subid', generatedSubid);
                            sessionStorage.setItem('external_id', generatedSubid);
                            sessionStorage.setItem('event_id', generatedSubid);
                        } catch (e) { }
                        try {
                            if (window.__boostclicksReplaceSubidInputs) {
                                window.__boostclicksReplaceSubidInputs(generatedSubid);
                            }
                        } catch (e) { }
                    }
                    sessionStorage.setItem('analytics_click_id', String(data.click_id));
                    sessionStorage.setItem('analytics_click_logged', '1');
                }
            })
            .catch(function () { /* ignore silently */ });
    } catch (e) {
        // ignore
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
