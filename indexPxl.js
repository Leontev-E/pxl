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
    const ttPixel = urlParams.get('pixel') || '';
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
    setSessionItem('tt_pixel', ttPixel);

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

    // Init TikTok Pixel PageView when tt pixel present.
(function initTikTokPageView() {
    const urlParams = new URLSearchParams(window.location.search);
    const pixelId = (urlParams.get('pixel') || sessionStorage.getItem('tt_pixel') || '').trim();
    if (!pixelId) return;

    try {
        const key = 'tt_pageview_sent_' + pixelId;
        if (sessionStorage.getItem(key) === '1') return;
        sessionStorage.setItem(key, '1');
    } catch (e) { }

    // грузим events.js только один раз
    if (!window.ttq) {
        !function (w, d, t) {
            w.TiktokAnalyticsObject = t;
            var ttq = w[t] = w[t] || [];
            ttq.methods = ["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"];
            ttq.setAndDefer = function (t, e) {
                t[e] = function () { t.push([e].concat([].slice.call(arguments, 0))); };
            };
            for (var i = 0; i < ttq.methods.length; i++) ttq.setAndDefer(ttq, ttq.methods[i]);
            ttq.instance = function (t) {
                for (var e = ttq._i[t] || [], n = 0; n < ttq.methods.length; n++) ttq.setAndDefer(e, ttq.methods[n]);
                return e;
            };
            ttq.load = function (e, n) {
                var i = "https://analytics.tiktok.com/i18n/pixel/events.js";
                ttq._i = ttq._i || {};
                ttq._i[e] = [];
                ttq._i[e]._u = i;
                ttq._t = ttq._t || {};
                ttq._t[e] = +new Date;
                ttq._o = ttq._o || {};
                ttq._o[e] = n || {};
                var o = d.createElement("script");
                o.type = "text/javascript";
                o.async = !0;
                o.src = i + "?sdkid=" + e + "&lib=" + t;
                var a = d.getElementsByTagName("script")[0];
                a.parentNode.insertBefore(o, a);
            };
        }(window, document, 'ttq');
    }

    try {
        window.ttq.load(pixelId);
        window.ttq.page();
    } catch (e) { }
})();


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


