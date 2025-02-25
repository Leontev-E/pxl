(function () {
    function getCookie(name) {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
    }

    const urlParams = new URLSearchParams(window.location.search);
    const pxl = urlParams.get('pxl');
    const contentIds = urlParams.get('content_ids');

    const subid = getCookie('_subid');

    if (pxl) {
        sessionStorage.setItem('pxl', pxl);
    }

    if (subid) {
        sessionStorage.setItem('external_id', subid);
        sessionStorage.setItem('event_id', subid);
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
})();
