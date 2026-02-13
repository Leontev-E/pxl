document.addEventListener("DOMContentLoaded", function () {
  'use strict';

  var eventKey = "fbEventSent";
  var now = Date.now();
  var twoHours = 7200 * 1000;

  try {
    var storedEvent = localStorage.getItem(eventKey);
    if (storedEvent) {
      try {
        var parsed = JSON.parse(storedEvent);
        if (parsed && parsed.timestamp && (now - parsed.timestamp) < twoHours) return;
      } catch (e) {}
    }
  } catch (e) {}

  var pxl = '';
  try { pxl = (sessionStorage.getItem('pxl') || '').trim(); } catch (e) {}
  if (!pxl) {
    try { pxl = (localStorage.getItem('pxl') || '').trim(); } catch (e) {}
  }

  if (!pxl) return;

  if (!/^\d{5,20}$/.test(pxl)) return;

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
    fbq('init', pxl);

    // Только Lead. Без subid/event_id/content_ids — ты сказал всё удалить.
    fbq('track', 'Lead');
  } catch (e) {}

  try {
    localStorage.setItem(eventKey, JSON.stringify({ timestamp: now }));
  } catch (e) {}
});
