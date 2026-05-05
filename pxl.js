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

    const pxl = sessionStorage.getItem("pxl");
    if (!pxl) return;

    const subid = sessionStorage.getItem("external_id") || "";
    const contentIds = sessionStorage.getItem("content_ids");

    // ---------- helpers (mirror server-side normalization for stable matching) ----------
    function getCookie(name) {
        try {
            const m = document.cookie.match(
                new RegExp(
                    "(?:^|; )" +
                        name.replace(/([$?*|{}()[\]\\/+^])/g, "\\$1") +
                        "=([^;]*)",
                ),
            );
            return m ? decodeURIComponent(m[1]) : null;
        } catch (e) {
            return null;
        }
    }
    function asciiFold(s) {
        if (!s) return "";
        try {
            return String(s)
                .normalize("NFD")
                .replace(/[̀-ͯ]/g, "");
        } catch (e) {
            return String(s);
        }
    }
    function normName(s) {
        if (!s) return "";
        s = String(s).trim().toLowerCase();
        try {
            // ES2018+: keep Unicode letters + combining marks; drop spaces/digits/punct.
            s = s.replace(/[^\p{L}\p{M}]+/gu, "");
        } catch (e) {
            s = s.replace(/[\s\d\W_]+/g, "");
        }
        return s;
    }
    function normCity(s) {
        if (!s) return "";
        return asciiFold(String(s).toLowerCase()).replace(/[^a-z]+/g, "");
    }
    function normState(s) {
        return normCity(s);
    }
    function normCountry(s) {
        if (!s) return "";
        return String(s).trim().toLowerCase();
    }
    function normZip(s) {
        if (!s) return "";
        return String(s).trim().toLowerCase().replace(/\s+/g, "");
    }
    function normEmail(s) {
        if (!s) return "";
        return String(s).trim().toLowerCase();
    }

    // Country -> phone code (digits, no '+'). Mirrors server-side getCountryPhoneCode().
    const COUNTRY_PHONE_CODES = {
        es: "34", pt: "351", it: "39", fr: "33", de: "49",
        nl: "31", be: "32", at: "43", ch: "41", lu: "352",
        gb: "44", uk: "44", ie: "353", dk: "45", no: "47", se: "46", fi: "358", is: "354",
        pl: "48", cz: "420", sk: "421", hu: "36", ro: "40", bg: "359", gr: "30",
        lv: "371", lt: "370", ee: "372", si: "386", hr: "385", rs: "381",
        cy: "357", mt: "356",
        us: "1", ca: "1", mx: "52",
        br: "55", ar: "54", co: "57", cl: "56", pe: "51", ec: "593", ve: "58", uy: "598", py: "595", bo: "591", cr: "506", pa: "507", do: "1",
        tr: "90", ua: "380", ru: "7", kz: "7", by: "375", md: "373",
        in: "91", pk: "92", bd: "880",
        id: "62", th: "66", vn: "84", my: "60", ph: "63", sg: "65",
        jp: "81", kr: "82", cn: "86", hk: "852", tw: "886",
        au: "61", nz: "64",
        za: "27", eg: "20", ma: "212", dz: "213", tn: "216", ng: "234", ke: "254",
        sa: "966", ae: "971", qa: "974", kw: "965", il: "972",
    };
    function normPhoneE164(phone, country) {
        if (!phone) return "";
        let digits = String(phone).replace(/\D+/g, "");
        if (!digits) return "";
        if (digits.length > 4 && digits.indexOf("00") === 0) digits = digits.slice(2);
        const cc = COUNTRY_PHONE_CODES[(country || "").toLowerCase()] || "";
        if (cc) {
            if (digits.indexOf(cc) === 0 && digits.length >= cc.length + 7) {
                // already international
            } else {
                digits = digits.replace(/^0+/, "");
                digits = cc + digits;
            }
        }
        return digits;
    }

    // ---------- gather user data from URL params / session / cookies ----------
    const urlParams = new URLSearchParams(window.location.search);
    function pick(key) {
        const v = urlParams.get(key);
        if (v) return v;
        try {
            const s = sessionStorage.getItem("bc_" + key);
            if (s) return s;
        } catch (e) {}
        const c = getCookie(key);
        return c || "";
    }

    const rawName =
        pick("name") || sessionStorage.getItem("bc_lead_name") || "";
    const rawPhone =
        pick("phone") || sessionStorage.getItem("bc_lead_phone") || "";
    const rawEmail = pick("email");
    const rawCountry = pick("country") || pick("country_code");
    const rawCity = pick("city");
    const rawZip = pick("zip") || pick("postal_code");
    const rawState = pick("state") || pick("region");

    const country = normCountry(rawCountry);
    const phoneE164 = normPhoneE164(rawPhone, country);

    let fn = "",
        ln = "";
    if (rawName) {
        const cleaned = String(rawName).replace(/\s+/g, " ").trim();
        if (cleaned) {
            const parts = cleaned.split(" ");
            fn = parts[0] || "";
            if (parts.length >= 2) ln = parts[parts.length - 1] || "";
        }
    }

    // Manual Advanced Matching — Pixel SDK SHA-256-hashes these on the client.
    // Pass PLAIN normalized values; do not pre-hash (Pixel double-hash detection
    // is by 64-char hex; if you pre-hash the result is treated as opaque).
    const advancedMatching = {};
    if (subid) advancedMatching.external_id = String(subid);
    if (rawEmail) advancedMatching.em = normEmail(rawEmail);
    if (phoneE164) advancedMatching.ph = phoneE164;
    if (fn) advancedMatching.fn = normName(fn);
    if (ln) advancedMatching.ln = normName(ln);
    if (country) advancedMatching.country = country;
    if (rawCity) advancedMatching.ct = normCity(rawCity);
    if (rawZip) advancedMatching.zp = normZip(rawZip);
    if (rawState) advancedMatching.st = normState(rawState);

    // ---------- init Pixel ----------
    !(function (f, b, e, v, n, t, s) {
        if (f.fbq) return;
        n = f.fbq = function () {
            n.callMethod
                ? n.callMethod.apply(n, arguments)
                : n.queue.push(arguments);
        };
        if (!f._fbq) f._fbq = n;
        n.push = n;
        n.loaded = !0;
        n.version = "2.0";
        n.queue = [];
        t = b.createElement(e);
        t.async = !0;
        t.src = v;
        s = b.getElementsByTagName(e)[0];
        s.parentNode.insertBefore(t, s);
    })(
        window,
        document,
        "script",
        "https://connect.facebook.net/en_US/fbevents.js",
    );

    if (Object.keys(advancedMatching).length > 0) {
        fbq("init", pxl, advancedMatching);
    } else {
        fbq("init", pxl);
    }

    // ---------- fire Lead with eventID matching server's <clickid>_lead ----------
    // Server-side postback.php uses event_id = clickid + '_' + action; we mirror
    // that here so Meta can deduplicate Pixel + CAPI events (48h window).
    const eventId = subid ? String(subid) + "_lead" : "";

    const customData = {};
    if (contentIds) customData.content_ids = contentIds;

    if (eventId) {
        fbq("track", "Lead", customData, { eventID: eventId });
    } else {
        fbq("track", "Lead", customData);
    }

    localStorage.setItem(eventKey, JSON.stringify({ timestamp: now }));

    // ---------- forward _fbp / _fbc to CAPI server (defense in depth) ----------
    // The lander already pushes these via collect.php; doing it again on the
    // thank-you page covers the case where the lander couldn't reach the API.
    setTimeout(function () {
        try {
            if (!subid) return;
            let fbp = getCookie("_fbp") || "";
            let fbc = getCookie("_fbc") || "";
            if (!fbc) {
                const fbclidUrl = urlParams.get("fbclid");
                if (fbclidUrl) fbc = "fb.1." + Date.now() + "." + fbclidUrl;
            }
            if (!fbp && !fbc) return;

            const qs =
                "clickid=" +
                encodeURIComponent(subid) +
                "&ts=" +
                Math.floor(Date.now() / 1000) +
                (fbp ? "&fbp=" + encodeURIComponent(fbp) : "") +
                (fbc ? "&fbc=" + encodeURIComponent(fbc) : "") +
                "&user_agent=" +
                encodeURIComponent(navigator.userAgent || "");
            const url = "https://klm-team.pw/lander/capi_v2/collect.php?" + qs;

            if (window.fetch) {
                fetch(url, {
                    method: "GET",
                    mode: "no-cors",
                    keepalive: true,
                    credentials: "omit",
                }).catch(function () {});
            } else {
                const im = new Image();
                im.referrerPolicy = "no-referrer-when-downgrade";
                im.src = url;
            }
        } catch (e) {}
    }, 1500);
});

// =========================
// currency: USD
// value: 10..20
// content_id: random
// =========================
(function () {
    const now = Date.now();
    const twoHours = 7200 * 1000;

    const ttPixel = (sessionStorage.getItem("tt_pixel") || "").trim();
    if (!ttPixel) return;
    if (!/^[A-Za-z0-9]+$/.test(ttPixel)) return;

    const subid = (sessionStorage.getItem("external_id") || "").trim();

    const ttKey = "ttEventSent";
    const stored = localStorage.getItem(ttKey);
    if (stored) {
        try {
            const { timestamp } = JSON.parse(stored);
            if (timestamp && now - timestamp < twoHours) return;
        } catch (e) {}
    }

    function randInt(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    function randContentId() {
        // Короткий стабильный формат для тиктока: буквы/цифры/подчёркивание/дефис
        const part = Math.random().toString(36).slice(2, 10);
        return "sku_" + part;
    }

    const contentId = randContentId();
    const value = randInt(10, 20);

    !(function (w, d, t) {
        w.TiktokAnalyticsObject = t;
        var ttq = (w[t] = w[t] || []);
        ttq.methods = [
            "page",
            "track",
            "identify",
            "instances",
            "debug",
            "on",
            "off",
            "once",
            "ready",
            "alias",
            "group",
            "enableCookie",
            "disableCookie",
        ];
        ttq.setAndDefer = function (t, e) {
            t[e] = function () {
                t.push([e].concat([].slice.call(arguments, 0)));
            };
        };
        for (var i = 0; i < ttq.methods.length; i++)
            ttq.setAndDefer(ttq, ttq.methods[i]);
        ttq.instance = function (t) {
            for (var e = ttq._i[t] || [], n = 0; n < ttq.methods.length; n++)
                ttq.setAndDefer(e, ttq.methods[n]);
            return e;
        };
        ttq.load = function (e, n) {
            var i = "https://analytics.tiktok.com/i18n/pixel/events.js";
            ttq._i = ttq._i || {};
            ttq._i[e] = [];
            ttq._i[e]._u = i;
            ttq._t = ttq._t || {};
            ttq._t[e] = +new Date();
            ttq._o = ttq._o || {};
            ttq._o[e] = n || {};
            var o = d.createElement("script");
            o.type = "text/javascript";
            o.async = !0;
            o.src = i + "?sdkid=" + e + "&lib=" + t;
            var a = d.getElementsByTagName("script")[0];
            a.parentNode.insertBefore(o, a);
        };

        ttq.load(ttPixel);
        ttq.page();
    })(window, document, "ttq");

    try {
        const ttData = {
            content_type: "product",
            currency: "USD",
            value: value,
            // чтобы закрыть warning VSA:
            content_id: contentId,
            // и современный формат:
            content_ids: [contentId],
        };

        if (subid) ttData.external_id = subid;

        window.ttq && window.ttq.track && window.ttq.track("Purchase", ttData);
    } catch (e) {}

    localStorage.setItem(ttKey, JSON.stringify({ timestamp: now }));
})();

// Google Tag
(() => {
    const getCookie = (name) => {
        const match = document.cookie.match(
            new RegExp("(^| )" + name + "=([^;]+)"),
        );
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
        window.history.replaceState(
            { path: url.toString() },
            "",
            url.toString(),
        );
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
                },
            });
        };
    };

    updateURL();
})();

(function () {
    // Берём сабайди: если boostclicks — логируем, если чужой трекер — не шлём.
    var trackerSubid =
        sessionStorage.getItem("external_id") ||
        sessionStorage.getItem("boostclicks_subid");
    var subid = null;
    if (trackerSubid) {
        trackerSubid = String(trackerSubid).trim();
        if (trackerSubid.indexOf("boostclicks_") === 0) {
            subid = trackerSubid;
        } else {
            return;
        }
    } else {
        var getCookie = function (name) {
            var full = "; " + document.cookie;
            var parts = full.split("; " + name + "=");
            if (parts.length < 2) return null;
            return decodeSafe(parts.pop().split(";").shift());
        };
        var cookieSubid = getCookie("subidBC");
        if (cookieSubid) {
            cookieSubid = String(cookieSubid).trim();
            if (cookieSubid.indexOf("boostclicks_") === 0) {
                subid = cookieSubid;
            } else {
                return;
            }
        } else {
            return;
        }
    }

    var hostname = window.location.hostname;
    var isSubdomain = (hostname.match(/\./g) || []).length > 1;

    // do not log lead if coming from subdomain (сервер тоже режет поддомены)
    if (isSubdomain) return;

    var params = new URLSearchParams(window.location.search);

    function decodeSafe(value) {
        if (!value) return "";
        try {
            return decodeURIComponent(value.replace(/\+/g, " "));
        } catch (e) {
            return value;
        }
    }

    var rawName = params.get("name") || "";
    var rawPhone = params.get("phone") || "";

    var name = decodeSafe(rawName).replace(/\s+/g, " ").trim();
    var phone = decodeSafe(rawPhone).replace(/[^0-9+]/g, "");

    // Fallback to values captured on submit when URL params are missing/invalid, but only if subid matches.
    try {
        var sid = (subid || "").trim();
        var storedSid = (sessionStorage.getItem("bc_lead_subid") || "").trim();
        if (sid && storedSid && sid === storedSid) {
            if (!name) {
                var sn = sessionStorage.getItem("bc_lead_name") || "";
                sn = String(sn).replace(/\s+/g, " ").trim();
                if (sn) name = sn.slice(0, 120);
            }
            var digits = String(phone || "").replace(/\D/g, "");
            if (!digits || digits.length < 7) {
                var sp = sessionStorage.getItem("bc_lead_phone") || "";
                sp = String(sp)
                    .replace(/(?!^)\+/g, "")
                    .replace(/[^0-9+]/g, "");
                var spDigits = sp.replace(/\D/g, "");
                if (spDigits.length >= 7) phone = sp.slice(0, 40);
            }
        }
    } catch (e) {}

    var clickId = sessionStorage.getItem("analytics_click_id") || null;

    var tags = null;
    try {
        var storedTags = sessionStorage.getItem("analytics_tags");
        if (storedTags) {
            var parsed = JSON.parse(storedTags);
            if (parsed && typeof parsed === "object") {
                tags = parsed;
            }
        }
    } catch (e) {}

    if (!tags) {
        // fallback: собрать из URL/cookie, если по какой-то причине не сохранили на клике
        var allow = {
            gclid: 1,
            buyer: 1,
            acc: 1,
            gt: 1,
            pt: 1,
            sub8: 1,
            sub9: 1,
        };
        var searchParams = new URLSearchParams(window.location.search);
        var t = {};
        searchParams.forEach(function (value, key) {
            if (!value) return;
            var k = String(key).toLowerCase();
            if (k.indexOf("utm_") === 0 || allow[k]) {
                var v = decodeSafe(value).trim();
                if (v) t[k] = v.slice(0, 200);
            }
        });
        var getCookie = function (name) {
            var full = "; " + document.cookie;
            var parts = full.split("; " + name + "=");
            if (parts.length < 2) return null;
            return decodeSafe(parts.pop().split(";").shift());
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
        subid: subid,
    };

    if (tags && Object.keys(tags).length) {
        payload.tags = tags;
    }

    try {
        fetch("https://analytics.boostclicks.ru/api/log-lead.php", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        }).catch(function () {});
    } catch (e) {}
})();
