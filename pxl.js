document.addEventListener("DOMContentLoaded", () => {
  // Facebook Pixel
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
      console.error('Ошибка парсинга fbEventSent:', error);
    }
  }

  const pxl = sessionStorage.getItem('pxl');
  if (!pxl) {
    console.warn('Facebook Pixel ID отсутствует');
    return;
  }

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
  img.onerror = () => console.error('Ошибка загрузки Facebook Pixel:', fbUrl.toString());
  img.onload = () => console.log('Facebook Pixel отправлен:', fbUrl.toString());
  document.body.appendChild(img);

  localStorage.setItem(eventKey, JSON.stringify({ timestamp: now }));

  // Дата и время конверсии
  if (subid && subid !== '{subid}') {
    try {
      const clickid = subid;
      const address = `${window.location.protocol}//${window.location.hostname}?_update_tokens=1&sub_id=${clickid}`;

      // Получаем текущую дату и время в MSK (UTC+3)
      const mskDate = new Date();
      mskDate.setTime(mskDate.getTime() + (3 * 60 * 60 * 1000)); // Добавляем 3 часа к UTC

      // Форматируем дату (YYYY-MM-DD)
      const year = mskDate.getUTCFullYear();
      const month = String(mskDate.getUTCMonth() + 1).padStart(2, '0');
      const day = String(mskDate.getUTCDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;

      // Форматируем время (HH:MM:SS)
      const hours = String(mskDate.getUTCHours()).padStart(2, '0');
      const minutes = String(mskDate.getUTCMinutes()).padStart(2, '0');
      const seconds = String(mskDate.getUTCSeconds()).padStart(2, '0');
      const timeStr = `${hours}:${minutes}:${seconds}`;

      // Формируем URL пикселя
      const pixelUrl = `${address}&sub_id_22=${encodeURIComponent(dateStr)}&sub_id_23=${encodeURIComponent(timeStr)}`;
      console.log('Отправка пикселя Keitaro:', pixelUrl);

      // Отправляем пиксель
      createPixel(pixelUrl);
    } catch (error) {
      console.error('Ошибка при отправке Keitaro пикселя:', error);
    }
  } else {
    console.warn('Keitaro пиксель не отправлен: subid отсутствует или равен "{subid}"', subid);
  }
});

function createPixel(url) {
  try {
    const img = document.createElement('img');
    img.src = url;
    img.referrerPolicy = 'no-referrer-when-downgrade';
    img.style.display = 'none';
    img.onerror = () => console.error('Ошибка загрузки пикселя:', url);
    img.onload = () => console.log('Пиксель успешно загружен:', url);
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

  if (!gt || gt === "gt") {
    console.warn('Google Tag ID отсутствует или неверный:', gt);
    return;
  }

  // Функция для обновления URL с добавлением UTM-параметров
  const updateURL = () => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("gt", gt);
      url.searchParams.set("pt", pt);
      url.searchParams.set("ad_id", ad_id);
      url.searchParams.set("acc", acc);
      url.searchParams.set("buyer", buyer);
      window.history.replaceState({ path: url.toString() }, "", url.toString());
      loadGTM(gt, pt);
    } catch (error) {
      console.error('Ошибка в updateURL:', error);
    }
  };

  // Функция для загрузки и инициализации Google Tag Manager
  const loadGTM = (gt, pt) => {
    try {
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
        console.log('Google Tag отправлен:', gt, pt);
      };
      gtmScript.onerror = () => console.error('Ошибка загрузки GTM скрипта:', gt);
    } catch (error) {
      console.error('Ошибка в loadGTM:', error);
    }
  };

  // Выполнение функции
  updateURL();
})();
