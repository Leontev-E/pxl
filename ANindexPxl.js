(function () {
  'use strict';
  var domonetkaUrl = (typeof window.domonetka === 'string' && window.domonetka.trim())
    ? window.domonetka.trim()
    : '';

  function setupDomonetkaBackRedirect(url) {
    if (!url) return;

    try {
      history.pushState({ domonetkaTrap: 1 }, document.title, location.href);
    } catch (e) {}

    window.addEventListener('popstate', function () {
      window.location.replace(url);
    }, { passive: true });
  }

  setupDomonetkaBackRedirect(domonetkaUrl);

  function getQueryParam(name) {
    try {
      var params = new URLSearchParams(window.location.search);
      return params.get(name) || '';
    } catch (e) {
      var m = window.location.search.match(new RegExp('[?&]' + name + '=([^&]+)'));
      return m ? decodeURIComponent(m[1]) : '';
    }
  }

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
