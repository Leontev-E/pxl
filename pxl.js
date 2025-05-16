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

// Дата и время конверсии
if (subid && subid !== '{subid}') {
    try {
        const conv_clickid = subid; // Уникальное имя
        const conv_address = `${window.location.protocol}//${window.location.hostname}?_update_tokens=1&sub_id=${conv_clickid}`; // Уникальное имя

        // Получаем текущую дату и время в MSK (UTC+3)
        const conv_mskDate = new Date(); // Уникальное имя
        conv_mskDate.setTime(conv_mskDate.getTime() + (3 * 60 * 60 * 1000)); // Добавляем 3 часа к UTC

        // Форматируем дату (YYYY-MM-DD)
        const conv_year = conv_mskDate.getUTCFullYear(); // Уникальное имя
        const conv_month = String(conv_mskDate.getUTCMonth() + 1).padStart(2, '0'); // Уникальное имя
        const conv_day = String(conv_mskDate.getUTCDate()).padStart(2, '0'); // Уникальное имя
        const conv_dateStr = `${conv_year}-${conv_month}-${conv_day}`; // Уникальное имя

        // Форматируем время (HH:MM:SS)
        const conv_hours = String(conv_mskDate.getUTCHours()).padStart(2, '0'); // Уникальное имя
        const conv_minutes = String(conv_mskDate.getUTCMinutes()).padStart(2, '0'); // Уникальное имя
        const conv_seconds = String(conv_mskDate.getUTCSeconds()).padStart(2, '0'); // Уникальное имя
        const conv_timeStr = `${conv_hours}:${conv_minutes}:${conv_seconds}`; // Уникальное имя

        // Формируем URL пикселя с sub_id_22 (дата) и sub_id_23 (время)
        const conv_pixelUrl = `${conv_address}&sub_id_22=${encodeURIComponent(conv_dateStr)}&sub_id_23=${encodeURIComponent(conv_timeStr)}`; // Уникальное имя
        console.log('Отправка Keitaro пикселя:', conv_pixelUrl); // Логирование для отладки

        // Отправляем пиксель
        createPixel(conv_pixelUrl);
    } catch (error) {
        console.error('Ошибка при отправке Keitaro пикселя:', error);
    }
} else {
    console.warn('Keitaro пиксель не отправлен: subid отсутствует или равен "{subid}"', subid);
}

function createPixel(url) {
    try {
        var img = document.createElement('img');
        img.src = url;
        img.referrerPolicy = 'no-referrer-when-downgrade';
        img.style.display = 'none';
        img.onload = () => console.log('Keitaro пиксель успешно загружен:', url); // Логирование успеха
        img.onerror = () => console.error('Ошибка загрузки Keitaro пикселя:', url); // Логирование ошибки
        document.body.appendChild(img);
    } catch (error) {
        console.error('Ошибка в createPixel:', error);
    }
}

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
