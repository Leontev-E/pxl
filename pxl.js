// Facebook Pixel
document.addEventListener("DOMContentLoaded", () => {
  const eventKey = "fbEventSent";
  const now = Date.now();
  const twoHours = 7200 * 1000;

  const storedEvent = localStorage.getItem(eventKey);
  if (storedEvent) {
    try {
      const { timestamp } = JSON.parse(storedEvent);
      if (timestamp && now - timestamp < twoHours) {
        return;
      }
    } catch (error) {
    }
  }

  const pxl = sessionStorage.getItem('pxl');
  if (!pxl) return;

  const subid = sessionStorage.getItem('external_id');
  const contentIds = sessionStorage.getItem('content_ids');

  const fbUrl = new URL("https://www.facebook.com/tr");
  fbUrl.searchParams.set("id", pxl);
  fbUrl.searchParams.set("ev", "Lead");
  fbUrl.searchParams.set("noscript", "1");

  if (subid) {
    fbUrl.searchParams.set("external_id", subid);
    fbUrl.searchParams.set("event_id", subid);
  }
  if (contentIds) {
    fbUrl.searchParams.set("content_ids", contentIds);
  }

  const img = new Image(1, 1);
  img.style.display = "none";
  img.src = fbUrl.toString();
  document.body.appendChild(img);

  localStorage.setItem(eventKey, JSON.stringify({ timestamp: now }));
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

  // Функция для обновления URL с добавлением UTM-параметров
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

  // Функция для загрузки и инициализации Google Tag Manager
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

  // Выполнение функции обновления URL и загрузки GTM, если gt валидный
  updateURL();
})();
