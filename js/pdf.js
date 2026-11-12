(function () {
  'use strict';
  var CDN = {
    h2c: 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
    jspdf: 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
  };
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

  function waitImages(root) {
    var imgs = Array.prototype.slice.call(root.querySelectorAll('img'));
    return Promise.all(imgs.map(function (im) {
      if (im.complete && im.naturalWidth) return null;
      return new Promise(function (r) { im.onload = im.onerror = r; });
    }));
  }

  function renderCanvases(pack, o, onProgress) {
    var fmt = Book.FORMATS[o.fmt] || Book.FORMATS.a4;
    var needPdf = fmt.kind === 'pdf';
    var libs = [loadScript(CDN.h2c)];
    if (needPdf) libs.push(loadScript(CDN.jspdf));
    return Promise.all(libs.concat([document.fonts ? document.fonts.ready : null])).then(function () {
      var host = document.createElement('div');
      host.className = 'export-host';
      document.body.appendChild(host);
      var pages = Book.buildAll(pack, o, fmt.w);
      pages.forEach(function (p) { p.style.width = fmt.w + 'px'; p.style.height = fmt.h + 'px'; p.style.aspectRatio = 'auto'; host.appendChild(p); });
      var canvases = [];
      var chain = waitImages(host);
      pages.forEach(function (p, i) {
        chain = chain.then(function () {
          if (onProgress) onProgress(i + 1, pages.length);
          return window.html2canvas(p, {
            scale: 1, useCORS: true, logging: false, backgroundColor: '#FFFDF8',
            width: fmt.w, height: fmt.h, scrollX: 0, scrollY: 0,
            onclone: function (doc) { var h = doc.querySelector('.export-host'); if (h) { h.style.left = '0'; h.style.top = '0'; } }
          }).then(function (c) { canvases.push(c); });
        });
      });
      return chain.then(function () { document.body.removeChild(host); return { canvases: canvases, fmt: fmt }; },
        function (e) { if (host.parentNode) host.parentNode.removeChild(host); throw e; });
    });
  }

  function safeName(s) { return String(s).replace(/[\\/:*?"<>|\s]+/g, '_'); }

  function exportPdf(pack, o, onProgress) {
    return renderCanvases(pack, o, onProgress).then(function (r) {
      var w = r.fmt.w, h = r.fmt.h;
      var orient = w >= h ? 'l' : 'p';
      var doc = new window.jspdf.jsPDF({ orientation: orient, unit: 'px', format: [w, h], hotfixes: ['px_scaling'], compress: true });
      r.canvases.forEach(function (c, i) {
        if (i > 0) doc.addPage([w, h], orient);
        doc.addImage(c.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, w, h);
      });
      doc.save(safeName(Book.bookTitle(pack, o.lang, o.name)) + '.pdf');
    });
  }

  function exportImages(pack, o, onProgress) {
    return renderCanvases(pack, o, onProgress).then(function (r) {
      var base = safeName(Book.bookTitle(pack, o.lang, o.name));
      var seq = Promise.resolve();
      r.canvases.forEach(function (c, i) {
        seq = seq.then(function () {
          return new Promise(function (resolve) {
            c.toBlob(function (blob) {
              var a = document.createElement('a');
              a.href = URL.createObjectURL(blob);
              a.download = base + '-' + String(i + 1).padStart(2, '0') + '.png';
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              setTimeout(function () { URL.revokeObjectURL(a.href); resolve(); }, 350);
            }, 'image/png');
          });
        });
      });
      return seq;
    });
  }

  window.PDFExport = { exportPdf: exportPdf, exportImages: exportImages };
})();
