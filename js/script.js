// declaraction of document.ready() function.
(function () {
    var ie = !!(window.attachEvent && !window.opera);
    var wk = /webkit\/(\d+)/i.test(navigator.userAgent) && (RegExp.$1 < 525);
    var fn = [];
    var run = function () {
        for (var i = 0; i < fn.length; i++) fn[i]();
    };
    var d = document;
    d.ready = function (f) {
        if (!ie && !wk && d.addEventListener)
            return d.addEventListener('DOMContentLoaded', f, false);
        if (fn.push(f) > 1) return;
        if (ie)
            (function () {
                try {
                    d.documentElement.doScroll('left');
                    run();
                } catch (err) {
                    setTimeout(arguments.callee, 0);
                }
            })();
        else if (wk)
            var t = setInterval(function () {
                if (/^(loaded|complete)$/.test(d.readyState))
                    clearInterval(t), run();
            }, 0);
    };
})();


document.ready(
    // toggleTheme function.
    // this script shouldn't be changed.
    () => {
        const pagebody = document.getElementsByTagName('body')[0]

        const systemTheme = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'

        function setTheme(status = 'light') {
            if (status === 'dark') {
                window.localStorage.setItem('theme', 'dark')
                pagebody.classList.add('dark-theme');
                document.getElementById("switch_default").checked = true
                document.getElementById("mobile-toggle-theme").innerText = "· Dark"
            } else {
                window.localStorage.setItem('theme', 'light')
                pagebody.classList.remove('dark-theme');
                document.getElementById("switch_default").checked = false
                document.getElementById("mobile-toggle-theme").innerText = "· Light"
            }
        };

        setTheme(window.localStorage.getItem('theme') || systemTheme)

        document.getElementsByClassName('toggleBtn')[0].addEventListener('click', (event) => {
            event.preventDefault()
            setTheme(window.localStorage.getItem('theme') === 'dark' ? 'light' : 'dark')
        })
        document.getElementById('mobile-toggle-theme').addEventListener('click', (event) => {
            event.preventDefault()
            setTheme(window.localStorage.getItem('theme') === 'dark' ? 'light' : 'dark')
        })
    }
);

document.ready(function () {
    document.querySelectorAll('.post-content figure.highlight').forEach(function (block) {
        if (block.querySelector('.copy-code-button')) return;

        var code = block.querySelector('.code pre') || block.querySelector('pre code') || block.querySelector('pre');
        if (!code) return;

        var button = document.createElement('button');
        button.type = 'button';
        button.className = 'copy-code-button';
        button.setAttribute('aria-label', '复制代码');
        button.textContent = '复制';

        function copied() {
            button.textContent = '已复制';
            setTimeout(function () { button.textContent = '复制'; }, 1600);
        }

        function fallbackCopy() {
            var textarea = document.createElement('textarea');
            textarea.value = code.innerText;
            textarea.setAttribute('readonly', '');
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            var copiedSuccessfully = document.execCommand('copy');
            document.body.removeChild(textarea);
            if (copiedSuccessfully) copied();
            else button.textContent = '复制失败';
        }

        button.addEventListener('click', function () {
            if (navigator.clipboard && window.isSecureContext) {
                navigator.clipboard.writeText(code.innerText).then(copied).catch(fallbackCopy);
            } else {
                fallbackCopy();
            }
        });

        block.appendChild(button);
    });
});
