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

    // Persist lead fields for thank-you page when URL params are missing.
    var LEAD_NAME_KEY = 'bc_lead_name';
    var LEAD_PHONE_KEY = 'bc_lead_phone';
    var LEAD_SUBID_KEY = 'bc_lead_subid';
    var LEAD_TS_KEY = 'bc_lead_ts';
    // Prevent accidental double-pings on fast double-submit / handler re-entry.
    var KEITARO_PING_TS_KEY = 'bc_keitaro_ping_ts';
    // Anti-spam: limit lead form submissions per browser to N/day (cookie + localStorage).
    var SUBMIT_CAP_MAX = 3;
    var SUBMIT_CAP_KEY = 'bc_submit_cap_v1';

    function sanitizeName(v) {
        if (v === undefined || v === null) return '';
        v = String(v).replace(/\s+/g, ' ').trim();
        if (!v) return '';
        if (v.length > 120) v = v.slice(0, 120);
        return v;
    }

    function sanitizePhone(v) {
        if (v === undefined || v === null) return '';
        v = String(v).trim();
        if (!v) return '';
        v = v.replace(/(?!^)\+/g, '');
        v = v.replace(/[^0-9+]/g, '');
        var digits = v.replace(/\D/g, '');
        if (digits.length < 7) return '';
        if (v.length > 40) v = v.slice(0, 40);
        return v;
    }

    function secondsToNextLocalMidnight() {
        try {
            var now = new Date();
            var next = new Date(now.getTime());
            next.setHours(24, 0, 0, 0);
            var diffMs = next.getTime() - now.getTime();
            var sec = Math.floor(diffMs / 1000);
            // keep it sane (at least 60s, at most 36h)
            if (!sec || sec < 60) return 60;
            if (sec > 36 * 3600) return 36 * 3600;
            return sec;
        } catch (e) {
            return 24 * 3600;
        }
    }

    function todayLocalKey() {
        try {
            var d = new Date();
            var y = d.getFullYear();
            var m = String(d.getMonth() + 1).padStart(2, '0');
            var day = String(d.getDate()).padStart(2, '0');
            return y + '-' + m + '-' + day;
        } catch (e) {
            return '';
        }
    }

    function readCapRaw() {
        // Prefer localStorage; cookie is fallback.
        try {
            var v = localStorage.getItem(SUBMIT_CAP_KEY);
            if (v) return String(v);
        } catch (e) { }
        return getCookie(SUBMIT_CAP_KEY) || '';
    }

    function writeCapRaw(raw, ttlSec) {
        try { localStorage.setItem(SUBMIT_CAP_KEY, raw); } catch (e) { }
        setCookie(SUBMIT_CAP_KEY, raw, ttlSec);
    }

    function getCapState() {
        var raw = readCapRaw();
        if (!raw) return { day: todayLocalKey(), count: 0 };
        try {
            var obj = JSON.parse(raw);
            var day = (obj && obj.day) ? String(obj.day) : todayLocalKey();
            var count = (obj && typeof obj.count !== 'undefined') ? parseInt(obj.count, 10) : 0;
            if (!isFinite(count) || count < 0) count = 0;
            return { day: day, count: count };
        } catch (e) {
            return { day: todayLocalKey(), count: 0 };
        }
    }

    function setCapState(day, count) {
        var ttl = secondsToNextLocalMidnight();
        var obj = { day: day, count: count };
        writeCapRaw(JSON.stringify(obj), ttl);
    }

    function isLikelyLeadForm(form) {
        if (!form || form.nodeType !== 1) return false;
        try {
            // Most of our lead forms have a phone input or a {subid} placeholder.
            if (form.querySelector('input[type="tel"], input[name="phone"], input[name*="phone" i], input[name*="tel" i], input[name*="тел" i]')) return true;
            if (form.querySelector('input[value="' + PLACEHOLDER_SUBID + '"], input[name*="subid" i], input[data-boostclicks-subid="1"]')) return true;
        } catch (e) { }
        return false;
    }

    function enforceDailySubmitCap(form) {
        if (!isLikelyLeadForm(form)) return true;

        var day = todayLocalKey();
        if (!day) return true;

        var st = getCapState();
        if (st.day !== day) {
            st.day = day;
            st.count = 0;
        }

        if (st.count >= SUBMIT_CAP_MAX) {
            try {
                alert('Лимит отправок для этого устройства: ' + SUBMIT_CAP_MAX + ' в сутки. Попробуйте завтра.');
            } catch (e) { }
            return false;
        }

        st.count += 1;
        setCapState(st.day, st.count);
        return true;
    }

    // Send name/phone into Keitaro tokens (sub_id_22/sub_id_23) only when the click is Keitaro (_subid cookie).
    // No preventDefault; fire-and-forget to avoid breaking existing site handlers.
    function pingKeitaroNamePhone(keitaroSubid, nameClean, phoneClean) {
        if (!keitaroSubid || keitaroSubid === PLACEHOLDER_SUBID) return;
        if (!nameClean || !phoneClean) return;

        // Deduplicate within a short window.
        try {
            var lastTs = parseInt(sessionStorage.getItem(KEITARO_PING_TS_KEY) || '0', 10) || 0;
            var nowTs = Date.now();
            if (lastTs && (nowTs - lastTs) < 2000) return;
            sessionStorage.setItem(KEITARO_PING_TS_KEY, String(nowTs));
        } catch (e) { }

        try {
            var base = window.location.protocol + '//' + window.location.hostname;
            var url = base +
                '?_update_tokens=1' +
                '&sub_id=' + encodeURIComponent(String(keitaroSubid)) +
                '&sub_id_22=' + encodeURIComponent(String(nameClean)) +
                '&sub_id_23=' + encodeURIComponent(String(phoneClean));

            // Best-effort: keepalive fetch survives navigation in modern browsers.
            try {
                if (window.fetch) {
                    // no-cors: we don't need to read response; keepalive: try to send during unload.
                    fetch(url, { method: 'GET', mode: 'no-cors', keepalive: true, credentials: 'omit' })
                        .catch(function () { });
                    return;
                }
            } catch (e) { }

            // Fallback: image ping.
            try {
                var img = new Image();
                img.referrerPolicy = 'no-referrer-when-downgrade';
                img.src = url;
            } catch (e) { }
        } catch (e) { }
    }

    function pickFromFormData(fd, reKey) {
        try {
            var it = fd.entries();
            var step = it.next();
            while (!step.done) {
                var k = step.value[0];
                var v = step.value[1];
                if (k && reKey.test(String(k))) {
                    return v;
                }
                step = it.next();
            }
        } catch (e) { }
        return '';
    }

    function captureLeadFieldsFromForm(form, subid) {
        if (!form || form.nodeType !== 1) return;
        var nameVal = '';
        var phoneVal = '';

        try {
            if (window.FormData) {
                var fd = new FormData(form);
                nameVal = pickFromFormData(fd, /^(name|fullname|fio|first_name|last_name|имя)$/i);
                phoneVal = pickFromFormData(fd, /^(phone|tel|telephone|mobile|phone_number|телефон)$/i);
            }
        } catch (e) { }

        if (!nameVal) {
            try {
                var elName = form.querySelector('input[name="name"], input[name="fullname"], input[name="fio"], input[name*="name" i], input[name*="fio" i], input[name*="имя" i]');
                if (elName && elName.value) nameVal = elName.value;
            } catch (e) { }
        }
        if (!phoneVal) {
            try {
                var elPhone = form.querySelector('input[type="tel"], input[name="phone"], input[name*="phone" i], input[name*="tel" i], input[name*="тел" i]');
                if (elPhone && elPhone.value) phoneVal = elPhone.value;
            } catch (e) { }
        }

        var nameClean = sanitizeName(nameVal);
        var phoneClean = sanitizePhone(phoneVal);
        if (!nameClean && !phoneClean) return;

        try {
            if (nameClean) sessionStorage.setItem(LEAD_NAME_KEY, nameClean);
            if (phoneClean) sessionStorage.setItem(LEAD_PHONE_KEY, phoneClean);
            if (subid) sessionStorage.setItem(LEAD_SUBID_KEY, String(subid));
            sessionStorage.setItem(LEAD_TS_KEY, String(Date.now()));
        } catch (e) { }

        // If this is a Keitaro click, push name/phone into tracker tokens right on submit.
        // This replaces the thank-you-page-only approach and avoids depending on URL params.
        try {
            if (hasValidKeitaroSubid()) {
                var ks = getCookie(KEITARO_COOKIE);
                pingKeitaroNamePhone(ks, nameClean, phoneClean);
            }
        } catch (e) { }
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
        document.addEventListener('submit', function (ev) {
            try {
                var form0 = ev && ev.target ? ev.target : null;
                if (!enforceDailySubmitCap(form0)) {
                    if (ev && ev.preventDefault) ev.preventDefault();
                    if (ev && ev.stopImmediatePropagation) ev.stopImmediatePropagation();
                    if (ev && ev.stopPropagation) ev.stopPropagation();
                    return;
                }
            } catch (e) { }

            var sid = null;
            try { sid = ensureSubidApplied(); } catch (e) { sid = null; }
            try {
                var form = ev && ev.target ? ev.target : null;
                captureLeadFieldsFromForm(form, sid || getSession('external_id'));
            } catch (e) { }
        }, true);
    }

    function patchNativeSubmit() {
        if (window.__boostclicksFormSubmitPatched) return;
        window.__boostclicksFormSubmitPatched = true;

        var native = HTMLFormElement.prototype.submit;
        HTMLFormElement.prototype.submit = function () {
            try {
                if (!enforceDailySubmitCap(this)) {
                    return;
                }
            } catch (e) { }

            var sid = null;
            try { sid = ensureSubidApplied(); } catch (e) { sid = null; }
            try { captureLeadFieldsFromForm(this, sid || getSession('external_id')); } catch (e) { }
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

    // Snapshot landing query string once per tab (sessionStorage) so we can forward
    // full tag set to domonetka even after in-site navigation or URL mutations.
    var LANDING_QS_KEY = 'bc_lp_qs';
    function readSearchNoQuestion() {
        try { return String(window.location.search || '').replace(/^\?/, ''); }
        catch (e) { return ''; }
    }
    function refreshLandingSnapshot() {
        var now = readSearchNoQuestion();
        if (!now) return;
        try {
            var prev = String(sessionStorage.getItem(LANDING_QS_KEY) || '');
            // Prefer the richest snapshot (longer query string usually means more tags).
            if (!prev || now.length > prev.length) {
                sessionStorage.setItem(LANDING_QS_KEY, now);
            }
        } catch (e) { }
    }
    function getLandingParams() {
        var raw = '';
        try { raw = String(sessionStorage.getItem(LANDING_QS_KEY) || ''); } catch (e) { raw = ''; }
        if (!raw) {
            raw = readSearchNoQuestion();
            try { if (raw) sessionStorage.setItem(LANDING_QS_KEY, raw); } catch (e) { }
        }
        return new URLSearchParams(raw);
    }

    function buildDomonetkaUrlWithMappedParams(domUrl) {
        // Always use landing snapshot for stability.
        const srcParams = getLandingParams();

        // Merge: keep domonetka URL params, then add all tag params from landing.
        const u = new URL(domUrl, window.location.href);
        const out = new URLSearchParams(u.search);

        // Pass-through everything except internal keys (starts with "_").
        srcParams.forEach(function (value, key) {
            if (!key) return;
            const k = String(key);
            if (k[0] === '_') return;

            // ❌ запретить ad_id
            if (k === 'ad_id') return;
            // Не прокидываем ad/sub_id_11 на домонетку (иначе Keitaro/fbtool может подтягивать spend по ad).
            if (k === 'ad' || k === 'sub_id_11') return;

            if (!out.has(k)) out.set(k, value);
        });

        // если domUrl уже содержит ad_id — тоже вычищаем
        out.delete('ad_id');
        // и на всякий случай вычищаем ad/sub_id_11 даже если они были в исходной domonetka URL
        out.delete('ad');
        out.delete('sub_id_11');

        // Ensure keitaro aliases are always present (both directions).
        const pairs = [
            ['acc', 'sub_id_2'],
            ['placement', 'sub_id_3'],
            ['buyer', 'sub_id_4'],
            ['adset', 'sub_id_5'],
        ];
        pairs.forEach(function (p) {
            const a = p[0];
            const b = p[1];
            if (srcParams.has(a) && !out.has(b)) out.set(b, srcParams.get(a));
            if (srcParams.has(b) && !out.has(a)) out.set(a, srcParams.get(b));
        });

        u.search = out.toString() ? ('?' + out.toString()) : '';
        return u.toString();
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
    // - if comes from global variable domonetka => keep redirect mode (unless forced by Keitaro+gclid rule)
    // - if comes from API lookup (domonetka.php) => use frame mode
    const domFromGlobal = getDomonetkaFromGlobal();
    const domFromStorage = domFromGlobal ? '' : getDomonetkaFromStorage();
    const domonetkaUrlNow = domFromGlobal || domFromStorage;

    // Capture/refresh landing tags; Keitaro pages sometimes mutate URL after load.
    refreshLandingSnapshot();
    setTimeout(refreshLandingSnapshot, 1500);
    setTimeout(refreshLandingSnapshot, 3500);

    // ---- NEW: Force iframe mode when Keitaro click + gclid present (not empty).
    function hasValidKeitaroClick() {
        try {
            var s = safeTrim(getCookie('_subid'));
            return !!(s && s !== '{subid}');
        } catch (e) { }
        return false;
    }

    function getParamFromLandingOrUrlOrCookie(key) {
        key = String(key || '').trim();
        if (!key) return '';

        // 1) landing snapshot (stable)
        try {
            var lp = getLandingParams();
            var v1 = safeTrim(lp.get(key));
            if (v1) return v1;
        } catch (e) { }

        // 2) current URL
        try {
            var v2 = safeTrim(urlParams.get(key));
            if (v2) return v2;
        } catch (e) { }

        // 3) cookie fallback
        try {
            var v3 = safeTrim(getCookie(key));
            if (v3) return v3;
        } catch (e) { }

        return '';
    }

    var gclidVal = getParamFromLandingOrUrlOrCookie('gclid');
    var forceFrameBecauseGclid = hasValidKeitaroClick() && !!gclidVal;

    if (domonetkaUrlNow) {
        if (domFromGlobal) {
            setDomonetkaStorage(domonetkaUrlNow, 'global');
            initDomonetka(domonetkaUrlNow, forceFrameBecauseGclid ? 'frame' : 'redirect');
        } else {
            const src = getDomonetkaSourceFromStorage() || 'api';
            var baseMode = (src === 'global') ? 'redirect' : 'frame';
            initDomonetka(domonetkaUrlNow, forceFrameBecauseGclid ? 'frame' : baseMode);
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
