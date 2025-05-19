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

  const pxl = sessionStorage.getItem('pxl');
  const subid = sessionStorage.getItem('external_id');
  const eventId = sessionStorage.getItem('event_id');
  const contentIds = sessionStorage.getItem('content_ids');

  if (!pxl) return;

  // Инициализация Facebook Pixel
  !function(f,b,e,v,n,t,s){
    if(f.fbq)return;
    n=f.fbq=function(){ n.callMethod ? n.callMethod.apply(n,arguments) : n.queue.push(arguments); };
    if(!f._fbq)f._fbq=n;
    n.push=n;
    n.loaded=!0;
    n.version='2.0';
    n.queue=[];
    t=b.createElement(e);
    t.async=!0;
    t.src=v;
    s=b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t,s)
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
      const gtag = (...args) => dataLayer.push(args);
      gtag("js", new Date());
      gtag("config", gt);
      gtag("event", "conversion", { send_to: `${gt}/${pt}` });
    };
  };

  updateURL();
})();
