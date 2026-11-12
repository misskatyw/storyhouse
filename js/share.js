(function () {
  'use strict';
  var SITE = 'Katy的小小故事屋';
  var timer = null;

  function toast(msg) {
    var el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(timer);
    timer = setTimeout(function () { el.classList.remove('show'); }, 2600);
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return legacyCopy(text); });
    }
    return Promise.resolve(legacyCopy(text));
  }

  function legacyCopy(text) {
    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;font-size:16px';
      document.body.appendChild(ta);
      ta.select();
      ta.setSelectionRange(0, text.length);
      var ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch (e) { return false; }
  }

  function copyLink(url) {
    return copyText(url || location.href).then(function (ok) {
      toast(ok ? '連結已複製，去貼俾朋友啦' : '複製唔到，請手動複製網址');
      return ok;
    });
  }

  function share(opts) {
    opts = opts || {};
    var url = opts.url || location.href;
    var data = { title: opts.title || SITE, text: (opts.text ? opts.text + ' · ' : '') + SITE, url: url };
    if (navigator.share) {
      return navigator.share(data).then(function () { return 'shared'; }, function (e) {
        if (e && e.name === 'AbortError') return 'cancel';
        return copyLink(url).then(function () { return 'copied'; });
      });
    }
    return copyLink(url).then(function () { return 'copied'; });
  }

  window.Share = { share: share, copyLink: copyLink, copyText: copyText, toast: toast, SITE: SITE };
})();
