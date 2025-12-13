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
    const subid = getCookie('_subid');
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

    var subid = getCookie('_subid');
    var hostname = window.location.hostname;
    var domonetkaActive = typeof domonetka !== 'undefined' &&
        domonetka &&
        domonetka.trim() !== '' &&
        domonetka !== '{domonetka}';
    var isSubdomain = ((hostname.match(/\./g) || []).length > 1);

    // Only log clicks when there is no tracker, no domonetka redirect and the domain is not a subdomain.
    if (subid || domonetkaActive || isSubdomain) {
        return;
    }

    // avoid duplicate logging on reloads
    if (sessionStorage.getItem('analytics_click_logged') === '1') {
        return;
    }

    var searchParams = new URLSearchParams(window.location.search);
    var tags = {};
    var tagKeys = new Set([
        'source', 'ev', 'acc', 'ad', 'placement', 'buyer', 'adset', 'ad_id',
        'pxl', 'gclid', 'fbclid', 'yclid', 'ymclid', 'gt', 'pt', 'utm_id'
    ]);

    searchParams.forEach(function (value, key) {
        if (!value) {
            return;
        }
        var normalizedKey = key.toLowerCase();
        if (normalizedKey.indexOf('utm_') === 0 || tagKeys.has(normalizedKey)) {
            tags[normalizedKey] = value;
        }
    });

    var payload = {
        domain: hostname,
        subid: null
    };

    if (Object.keys(tags).length > 0) {
        payload.tags = tags;
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
                    sessionStorage.setItem('analytics_click_id', String(data.click_id));
                    sessionStorage.setItem('analytics_click_logged', '1');
                }
            })
            .catch(function () { /* ignore silently */ });
    } catch (e) {
        // ignore
    }
})();
