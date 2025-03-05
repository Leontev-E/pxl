// fb pxl
document.addEventListener("DOMContentLoaded", function() {
  const pxl = sessionStorage.getItem('pxl');
  const subid = sessionStorage.getItem('external_id');
  const contentIds = sessionStorage.getItem('content_ids');

  if (pxl) {
    let url = `https://www.facebook.com/tr?id=${pxl}&ev=Lead&noscript=1`;
    if (subid) {
      url += `&external_id=${subid}&event_id=${subid}`;
    }
    if (contentIds) {
      url += `&content_ids=${encodeURIComponent(contentIds)}`;
    }
    const img = new Image(1, 1);
    img.style.display = 'none';
    img.src = url;
    document.body.appendChild(img);
  }
});

// google tag
(function() {
  function getCookie(name) {
    const value = "; " + document.cookie;
    const parts = value.split("; " + name + "=");
    if (parts.length === 2) return parts.pop().split(";").shift();
  }

  var gt = getCookie("gt") || "";
  var pt = getCookie("pt") || "";
  var ad_id = getCookie("ad_id") || "";
  var acc = getCookie("acc") || "";
  var buyer = getCookie("buyer") || "";

  function updateURL() {
    var currentURL = window.location.href;
    var hasParams = currentURL.includes("?");
    var updatedURL = currentURL + (hasParams ? "&" : "?") +
      "gt=" + encodeURIComponent(gt) +
      "&pt=" + encodeURIComponent(pt) +
      "&ad_id=" + encodeURIComponent(ad_id) +
      "&acc=" + encodeURIComponent(acc) +
      "&buyer=" + encodeURIComponent(buyer);
    window.history.replaceState({ path: updatedURL }, "", updatedURL);
    loadGTM(gt, pt);
  }

  function loadGTM(gt, pt) {
    var gtmScript = document.createElement("script");
    gtmScript.src = "https://www.googletagmanager.com/gtag/js?id=" + gt;
    gtmScript.async = true;
    document.head.appendChild(gtmScript);
    gtmScript.onload = function() {
      window.dataLayer = window.dataLayer || [];
      function gtag() { dataLayer.push(arguments); }
      gtag("js", new Date());
      gtag("config", gt);
      gtag("event", "conversion", { "send_to": gt + "/" + pt });
    };
  }

  if (gt || pt) {
    updateURL();
  }
})();
