(function () {
  "use strict";

  function getCookie(name) {
    try {
      var matches = document.cookie.match(
        new RegExp(
          "(?:^|; )" +
            name.replace(/([$?*|{}()[\]\\/+^])/g, "\\$1") +
            "=([^;]*)",
        ),
      );
      return matches ? decodeURIComponent(matches[1]) : null;
    } catch (e) {
      return null;
    }
  }

  function decodeSafe(value) {
    if (!value) return "";
    try {
      return decodeURIComponent(String(value).replace(/\+/g, " "));
    } catch (e) {
      return String(value);
    }
  }

  var hostname = window.location.hostname;
  var subidCookie = getCookie("_subid");
  var subid =
    subidCookie && subidCookie !== "{subid}" ? subidCookie : null;

  try {
    if (sessionStorage.getItem("analytics_click_logged_white") === "1") return;
  } catch (e) {}

  var searchParams = new URLSearchParams(window.location.search);
  var tags = {};
  var allow = { gclid: 1, buyer: 1, acc: 1, gt: 1, pt: 1, sub8: 1, sub9: 1 };

  var tagKeys = new Set([
    "source",
    "ev",
    "acc",
    "ad",
    "placement",
    "buyer",
    "adset",
    "ad_id",
    "pxl",
    "gclid",
    "fbclid",
    "yclid",
    "ymclid",
    "gt",
    "pt",
    "utm_id",
    "sub8",
    "sub9",
  ]);

  searchParams.forEach(function (value, key) {
    if (!value) return;
    var normalizedKey = key.toLowerCase();
    if (
      normalizedKey.indexOf("utm_") === 0 ||
      tagKeys.has(normalizedKey) ||
      allow[normalizedKey]
    ) {
      var v = decodeSafe(value).trim();
      if (v) tags[normalizedKey] = v.slice(0, 200);
    }
  });

  Object.keys(allow).forEach(function (k) {
    if (tags[k]) return;
    var cv = getCookie(k);
    if (!cv) return;
    cv = decodeSafe(cv).trim();
    if (!cv) return;
    tags[k] = cv.slice(0, 200);
  });

  var payload = {
    domain: hostname,
    traffic_variant: "white",
  };

  if (subid) payload.subid = subid;
  if (Object.keys(tags).length > 0) payload.tags = tags;

  try {
    fetch("https://analytics.boostclicks.ru/api/log-click.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then(function (res) {
        return res.json();
      })
      .then(function (data) {
        if (data && data.success) {
          try {
            if (data.click_id) {
              sessionStorage.setItem(
                "analytics_click_id_white",
                String(data.click_id),
              );
            }
            sessionStorage.setItem("analytics_click_logged_white", "1");
          } catch (e) {}
        }
      })
      .catch(function () {});
  } catch (e) {}
})();
