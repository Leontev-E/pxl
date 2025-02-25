(function () {
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
})();