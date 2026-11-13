(function () {
  'use strict';
  var CDN = {
    h2c: 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
    jspdf: 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
  };
  var JPEG_Q = 0.85;
  var loading = {};

  function loadScript(src) {
    if (!loading[src]) {
      loading[src] = new Promise(function (resolve, reject) {
        var s = document.createElement('script');
        s.src = src;
        s.onload = resolve;
        s.onerror = function () { delete loading[src]; reject(new Error('載入失敗：' + src)); };
        document.head.appendChild(s);
      });
    }
    return loading[src];
  }

  function withTimeout(p, ms, msg) {
    return Promise.race([p, new Promise(function (_, rej) { setTimeout(function () { rej(new Error(msg)); }, ms); })]);
  }

  function isIOS() {
    return /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }

  // 每張圖先縮到闊 ≤1080、JPEG 0.85，再入頁面；一次一張，用完即放記憶
  function shrinkImage(file) {
    return new Promise(function (resolve, reject) {
      var im = new Image();
      im.onload = function () {
        var w = Math.min(im.naturalWidth, Book.MAX_IMG_W);
        var h = Math.round(im.naturalHeight * w / im.naturalWidth);
        var c = document.createElement('canvas');
        c.width = w; c.height = h;
        var ctx = c.getContext('2d');
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(im, 0, 0, w, h);
        c.toBlob(function (blob) {
          c.width = c.height = 0;
          if (blob) resolve(URL.createObjectURL(blob)); else reject(new Error('縮圖失敗'));
        }, 'image/jpeg', JPEG_Q);
      };
      im.onerror = function () { reject(new Error('圖片載入失敗：' + file)); };
      im.src = /^(blob:|data:|https?:)/.test(file) ? file : 'assets/' + file;
    });
  }

  function shrinkAll(files, onProgress) {
    var map = {}, seq = Promise.resolve();
    files.forEach(function (f, i) {
      seq = seq.then(function () {
        if (onProgress) onProgress('縮圖', i + 1, files.length);
        return shrinkImage(f).then(function (u) { map[f] = u; });
      });
    });
    return seq.then(function () { return map; });
  }

  function waitImages(root) {
    var imgs = Array.prototype.slice.call(root.querySelectorAll('img'));
    return Promise.all(imgs.map(function (im) {
      if (im.complete && im.naturalWidth) return null;
      return new Promise(function (r) { im.onload = im.onerror = r; });
    }));
  }

  // pages = [{img:'x.webp'|blobURL, ...}] 由 Book.pagesFor 或自訂；回傳每頁 JPEG dataURL＋尺寸
  function renderPages(pack, o, onProgress, specsOverride) {
    var fmt = Book.FORMATS[o.fmt] || Book.FORMATS.a4;
    var libs = [loadScript(CDN.h2c)];
    if (fmt.kind === 'pdf') libs.push(loadScript(CDN.jspdf));
    var specs = specsOverride || Book.pagesFor(pack);
    var files = specs.map(function (s) { return s.img; }).filter(Boolean);
    var imgMap = {}, host = null;
    function cleanup() {
      if (host && host.parentNode) host.parentNode.removeChild(host);
      Object.keys(imgMap).forEach(function (k) { URL.revokeObjectURL(imgMap[k]); });
    }
    return Promise.all(libs.concat([document.fonts ? document.fonts.ready : null])).then(function () {
      return shrinkAll(files, onProgress);
    }).then(function (map) {
      imgMap = map;
      host = document.createElement('div');
      host.className = 'export-host';
      document.body.appendChild(host);
      var pages = Book.buildAll(pack, { lang: o.lang, name: o.name, fmt: o.fmt, imgMap: imgMap }, fmt.w, specs);
      pages.forEach(function (p) { p.style.width = fmt.w + 'px'; host.appendChild(p); });
      var out = [], chain = waitImages(host);
      pages.forEach(function (p, i) {
        chain = chain.then(function () {
          if (onProgress) onProgress('排版', i + 1, pages.length);
          var h = Math.ceil(p.getBoundingClientRect().height);
          return withTimeout(window.html2canvas(p, {
            scale: 1, useCORS: true, logging: false, backgroundColor: '#FFF8E8',
            width: fmt.w, height: h, scrollX: 0, scrollY: 0,
            onclone: function (doc) { var hh = doc.querySelector('.export-host'); if (hh) { hh.style.left = '0'; hh.style.top = '0'; } }
          }), 60000, '第 ' + (i + 1) + ' 頁排版逾時').then(function (c) {
            var rec = { data: c.toDataURL('image/jpeg', JPEG_Q), w: c.width, h: c.height };
            c.width = c.height = 0;
            out.push(rec);
          });
        });
      });
      return chain.then(function () { cleanup(); return { pages: out, fmt: fmt }; });
    }).catch(function (e) { cleanup(); throw e; });
  }

  function safeName(s) { return String(s).replace(/[\\/:*?"<>|\s]+/g, '_'); }

  function dataToBlob(dataUrl) {
    var b = atob(dataUrl.split(',')[1]), u = new Uint8Array(b.length);
    for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);
    return new Blob([u], { type: 'image/jpeg' });
  }

  // 回傳 { files:[{blob,name}] }；唔再喺非用戶手勢嘅非同步尾巴 doc.save()
  function exportPdf(pack, o, onProgress, specsOverride, titleOverride) {
    return renderPages(pack, o, onProgress, specsOverride).then(function (r) {
      if (onProgress) onProgress('合成 PDF', 1, 1);
      var w = r.fmt.w, first = r.pages[0];
      var doc = new window.jspdf.jsPDF({ orientation: first.w >= first.h ? 'l' : 'p', unit: 'px', format: [first.w, first.h], hotfixes: ['px_scaling'], compress: true });
      r.pages.forEach(function (pg, i) {
        if (i > 0) doc.addPage([pg.w, pg.h], pg.w >= pg.h ? 'l' : 'p');
        doc.addImage(pg.data, 'JPEG', 0, 0, pg.w, pg.h);
      });
      var name = safeName(titleOverride || Book.bookTitle(pack, o.lang, o.name)) + '.pdf';
      return { files: [{ blob: doc.output('blob'), name: name }] };
    });
  }

  function exportImages(pack, o, onProgress, specsOverride, titleOverride) {
    return renderPages(pack, o, onProgress, specsOverride).then(function (r) {
      var base = safeName(titleOverride || Book.bookTitle(pack, o.lang, o.name));
      return { files: r.pages.map(function (pg, i) { return { blob: dataToBlob(pg.data), name: base + '-' + String(i + 1).padStart(2, '0') + '.jpg' }; }) };
    });
  }

  function saveFile(f) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(f.blob);
    a.download = f.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return a.href;
  }

  // 結果面板：用戶自己㩒掣（真手勢）先開／存，iOS 唔靠自動下載
  function showResult(host, res, kindLabel) {
    var old = host.querySelector('.pdfpanel');
    if (old) old.parentNode.removeChild(old);
    var panel = document.createElement('div');
    panel.className = 'pdfpanel';
    var p = document.createElement('p');
    p.textContent = kindLabel + '整好啦！' + (isIOS() ? '㩒下面掣開啟，再用分享鍵「儲存到檔案」。' : '如果冇自動下載，㩒下面掣。');
    panel.appendChild(p);
    var urls = [];
    res.files.forEach(function (f, i) {
      var url = URL.createObjectURL(f.blob);
      urls.push(url);
      var a = document.createElement('a');
      a.className = 'cta done';
      a.style.marginTop = '8px';
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener';
      if (!isIOS()) a.download = f.name;
      a.textContent = res.files.length > 1 ? '開啟／儲存 第 ' + (i + 1) + ' 張' : '開啟／儲存 ' + f.name;
      panel.appendChild(a);
    });
    host.appendChild(panel);
    return panel;
  }

  function showError(host, msg) {
    var old = host.querySelector('.pdfpanel');
    if (old) old.parentNode.removeChild(old);
    var panel = document.createElement('div');
    panel.className = 'pdfpanel err';
    var p = document.createElement('p');
    p.textContent = msg;
    panel.appendChild(p);
    host.appendChild(panel);
  }

  // 一條龍：進行中狀態＋成功／失敗訊息＋iOS 後備
  function run(btn, host, fn, isImg) {
    var label = btn.textContent, kind = isImg ? '圖檔' : 'PDF';
    btn.disabled = true;
    var old = host.querySelector('.pdfpanel');
    if (old) old.parentNode.removeChild(old);
    return fn(function (stage, i, n) { btn.textContent = stage + ' ' + i + ' / ' + n + '…'; })
      .then(function (res) {
        showResult(host, res, kind);
        if (!isIOS() && res.files.length === 1) { try { saveFile(res.files[0]); } catch (e) { /* 面板有後備掣 */ } }
        Share.toast(kind + ' 整好啦');
      })
      .catch(function (e) {
        showError(host, kind + '整唔成功（' + (e && e.message ? e.message : '未知原因') + '）。請確認網絡，㩒掣再試一次；仲唔得就用「複製連結」喺另一部機開。');
        Share.toast(kind + '整唔成功，請再試');
      })
      .then(function () { btn.disabled = false; btn.textContent = label; });
  }

  window.PDFExport = { exportPdf: exportPdf, exportImages: exportImages, run: run, isIOS: isIOS };
})();
