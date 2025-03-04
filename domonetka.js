(function () {
    function getCookie(name) {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
    }

    const urlParams = new URLSearchParams(window.location.search);
    const pxl = urlParams.get('pxl') || 'default_pxl';
    const contentIds = urlParams.get('content_ids');
    const subid = getCookie('_subid');

    if (pxl) {
        sessionStorage.setItem('pxl', pxl);
    }

    if (subid) {
        sessionStorage.setItem('external_id', subid);
        sessionStorage.setItem('event_id', subid);
        sessionStorage.setItem('dom', domonetka);
    }

    if (contentIds) {
        sessionStorage.setItem('content_ids', contentIds);
    }

    if (pxl) {
        !function (f, b, e, v, n, t, s) {
            if (f.fbq) return;
            n = f.fbq = function () {
                n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
            };
            if (!f._fbq) f._fbq = n;
            n.push = n;
            n.loaded = !0;
            n.version = '2.0';
            n.queue = [];
            t = b.createElement(e);
            t.async = !0;
            t.src = v;
            s = b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t, s);
        }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');

        fbq('init', pxl);

        if (contentIds) {
            fbq('track', 'PageView', { content_ids: contentIds });
        } else {
            fbq('track', 'PageView');
        }
    }

    if (domonetka && domonetka.trim() !== '' && domonetka !== '{domonetka}') {
        (async function () {
            try {
                onpopstate = function (event) {
                    if (event.state) {
                        const newUrl = `${domonetka}?pxl=${pxl}`;
                        location.replace(newUrl);
                    }
                };

                for (let i = 0; i < 10; i++) {
                    setTimeout(function () {
                        history.pushState({}, "");
                    }, i * 50);
                }
            } catch (error) {
                console.log(error);
            }
        })();
    }
})();

(function() {
  function setUTMCookies() {
    const utmParameters = ['gt', 'pt', 'ad_id', 'acc', 'buyer'];
    const params = new URLSearchParams(window.location.search);
    utmParameters.forEach(param => {
      if (params.has(param)) {
        const value = params.get(param);
        document.cookie = `${param}=${encodeURIComponent(value)}; path=/; max-age=3600`;
      }
    });
  }

  setUTMCookies();

  const params = new URLSearchParams(window.location.search);
  if (params.has('gt')) {
    const gt = params.get('gt');
    const gtmScript = document.createElement('script');
    gtmScript.async = true;
    gtmScript.src = `https://www.googletagmanager.com/gtag/js?id=${gt}`;
    document.head.appendChild(gtmScript);
    window.dataLayer = window.dataLayer || [];
    function gtag() {
      window.dataLayer.push(arguments);
    }
    window.gtag = gtag;
    gtag('js', new Date());
    gtag('config', gt);
  }
})();
