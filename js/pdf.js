(function () {
  'use strict';
  var CDN = {
    jspdf: 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'
  };
  var JPEG_Q = 0.85;
  var W = 1240;
  var FONT = '"Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif';
  var SERIF = '"Noto Serif TC","Noto Sans TC","PingFang TC","Microsoft JhengHei",serif';
  var INK = '#2B1B14', INK2 = '#5C463C', GOLD = '#E9A13B', CREAM = '#FFF8E8', BOXBG = '#F6E8D2';
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

  function isIOS() {
    return /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }

  // 版面幾何：A4 橫版 1754x1240；正方形 1240x1240；圖檔（非 PDF）保持直版 1240x1754
  function geometry(fmt) {
    if (fmt.square) return { W: 1240, H: 1240, mm: [210, 210], imgH: 640, textMaxW: 1144 };
    if (fmt.landscape) return { W: 1754, H: 1240, mm: [297, 210], imgH: 760, textMaxW: 1658 };
    return { W: 1240, H: 1754, mm: [210, 297], imgH: 940, textMaxW: 1144 };
  }

  function loadImage(file) {
    return new Promise(function (resolve, reject) {
      var im = new Image();
      var ext = /^(blob:|data:|https?:)/.test(file);
      if (/^https?:/.test(file)) im.crossOrigin = 'anonymous';
      im.onload = function () { resolve(im); };
      im.onerror = function () { reject(new Error('圖片載入失敗：' + file)); };
      im.src = ext ? file : 'assets/' + file;
    });
  }

  function loadAll(files, onProgress) {
    var map = {}, seq = Promise.resolve();
    files.forEach(function (f, i) {
      seq = seq.then(function () {
        if (onProgress) onProgress('載入圖', i + 1, files.length);
        return loadImage(f).then(function (im) { map[f] = im; });
      });
    });
    return seq.then(function () { return map; });
  }

  function wrapEn(ctx, text, maxW) {
    var words = String(text).split(/\s+/).filter(Boolean), lines = [], cur = '';
    words.forEach(function (w) {
      var t = cur ? cur + ' ' + w : w;
      if (cur && ctx.measureText(t).width > maxW) { lines.push(cur); cur = w; } else cur = t;
    });
    if (cur) lines.push(cur);
    return lines;
  }

  function drawContain(ctx, im, x, y, w, h) {
    var r = Math.min(w / im.naturalWidth, h / im.naturalHeight);
    var dw = im.naturalWidth * r, dh = im.naturalHeight * r;
    ctx.drawImage(im, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  }

  function drawCover(ctx, im, x, y, w, h, fx) {
    var r = Math.max(w / im.naturalWidth, h / im.naturalHeight);
    var sw = w / r, sh = h / r;
    var sx = (im.naturalWidth - sw) * fx, sy = (im.naturalHeight - sh) / 2;
    ctx.drawImage(im, sx, sy, sw, sh, x, y, w, h);
  }

  // 延伸頁：先按 cover 取景，再向中心放大 EXT_ZOOM 倍（source-rect 置中裁切）
  function drawCoverZoom(ctx, im, x, y, w, h, z) {
    var r = Math.max(w / im.naturalWidth, h / im.naturalHeight);
    var sw = w / r / z, sh = h / r / z;
    ctx.drawImage(im, (im.naturalWidth - sw) / 2, (im.naturalHeight - sh) / 2, sw, sh, x, y, w, h);
  }

  // 將主／副行排成逐行清單；放唔落就整體縮細（f<1），保證唔出界
  function layoutText(ctx, lines, sizes, isCover, scale, f, maxW) {
    var out = [], gap = 10 * scale * f, h = 0;
    lines.forEach(function (ln, i) {
      var main = i === 0;
      var base = isCover ? (ln.cls === 'zh' ? sizes.czh : sizes.cen) : (ln.cls === 'zh' ? sizes.zh : sizes.en);
      var px = Math.round(base * scale * (main ? 1 : 0.8) * f);
      var font = isCover ? '900 ' + px + 'px ' + SERIF : (main ? '700 ' : '400 ') + px + 'px ' + FONT;
      ctx.font = font;
      var parts = ln.cls === 'zh' ? Book.wrapZh(ln.text, isCover ? sizes.ccpl : sizes.cpl) : wrapEn(ctx, ln.text, maxW || 1144);
      if (!ln.text) parts = [];
      if (i > 0 && parts.length) h += gap;
      parts.forEach(function (t) {
        var lh = px * 1.35;
        out.push({ text: t, font: font, color: main ? INK : INK2, y: h + lh / 2 });
        h += lh;
      });
    });
    return { items: out, h: h };
  }

  function fitText(ctx, lines, sizes, isCover, scale, availH, maxW) {
    var f = 1, L = layoutText(ctx, lines, sizes, isCover, scale, f, maxW);
    while (L.h > availH && f > 0.5) { f -= 0.05; L = layoutText(ctx, lines, sizes, isCover, scale, f, maxW); }
    return L;
  }

  function drawItems(ctx, L, top, cx, maxW) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    L.items.forEach(function (it) {
      ctx.font = it.font;
      ctx.fillStyle = it.color;
      ctx.fillText(it.text, cx, top + it.y, maxW);
    });
  }

  function drawPage(ctx, spec, pack, o, imgs, G, num) {
    var H = G.H, GW = G.W, scale = W / Book.BASE, sizes = Book.sizesFor(pack.age);
    var type = spec.type;
    ctx.fillStyle = CREAM;
    ctx.fillRect(0, 0, GW, H);
    var hasNum = type === 'img' || type === 'scene' || type === 'ext' || (!type && !!spec.pg);
    var lines = Book.specLines(type === 'cover' ? { type: 'cover', pack: pack } : spec, o.lang, o.name);
    var textTop = 48 + G.imgH + 40, textBot = H - (hasNum ? 110 : 60), L;

    if (spec.img) {
      ctx.fillStyle = BOXBG;
      ctx.fillRect(48, 48, GW - 96, G.imgH);
      if (type === 'ext') drawCoverZoom(ctx, imgs[spec.img], 48, 48, GW - 96, G.imgH, Book.EXT_ZOOM);
      else drawContain(ctx, imgs[spec.img], 48, 48, GW - 96, G.imgH);
    }

    {
      L = fitText(ctx, lines, sizes, type === 'cover', scale, textBot - textTop, G.textMaxW);
      // 字區 clip：就算自訂文字超長、縮到 0.5 倍都排唔落，都唔會畫出界壓圖／壓頁碼
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, textTop - 24, GW, textBot - textTop + 24);
      ctx.clip();
      drawItems(ctx, L, textTop + Math.max(0, (textBot - textTop - L.h) / 2), GW / 2, G.textMaxW);
      ctx.restore();
    }

    if (hasNum) {
      ctx.font = '700 ' + Math.round(sizes.num * scale) + 'px ' + FONT;
      ctx.fillStyle = INK2;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(num), GW / 2, H - 56);
    }
  }

  function textSample(specs, pack, o) {
    var t = '';
    specs.forEach(function (sp) {
      Book.specLines(sp.type === 'cover' ? { type: 'cover', pack: pack } : sp, o.lang, o.name).forEach(function (l) { t += l.text; });
    });
    return t;
  }

  function loadFonts(sample) {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    var tasks = ['700 40px "Noto Sans TC"', '400 40px "Noto Sans TC"', '900 40px "Noto Serif TC"'].map(function (f) {
      return document.fonts.load(f, sample).catch(function () {});
    });
    return Promise.all(tasks).then(function () { return document.fonts.ready; });
  }

  // 逐頁畫上 canvas，即時轉 JPEG dataURL；回傳 { pages:[{data,w,h}], fmt, G }
  function renderPages(pack, o, onProgress, specsOverride) {
    var fmt = Book.FORMATS[o.fmt] || Book.FORMATS.a4, G = geometry(fmt);
    var specs = specsOverride || Book.pagesFor(pack);
    var files = [];
    specs.forEach(function (s) {
      if (s.img && files.indexOf(s.img) < 0) files.push(s.img);
    });
    var libs = fmt.kind === 'pdf' ? [loadScript(CDN.jspdf)] : [];
    return Promise.all(libs.concat([loadFonts(textSample(specs, pack, o))])).then(function () {
      return loadAll(files, onProgress);
    }).then(function (imgs) {
      var c = document.createElement('canvas');
      c.width = G.W; c.height = G.H;
      var ctx = c.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      var out = [];
      specs.forEach(function (spec, i) {
        if (onProgress) onProgress('排版', i + 1, specs.length);
        drawPage(ctx, spec, pack, o, imgs, G, i + 1);
        out.push({ data: c.toDataURL('image/jpeg', JPEG_Q), w: G.W, h: G.H });
      });
      c.width = c.height = 0;
      return { pages: out, fmt: fmt, G: G };
    });
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
      var mm = r.G.mm, fmtArr = mm[0] === mm[1] ? mm : 'a4';
      var orient = r.fmt.landscape ? 'landscape' : 'portrait';
      var doc = new window.jspdf.jsPDF({ orientation: orient, unit: 'mm', format: fmtArr, compress: true });
      r.pages.forEach(function (pg, i) {
        if (i > 0) doc.addPage(fmtArr, orient);
        doc.addImage(pg.data, 'JPEG', 0, 0, mm[0], mm[1]);
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
    panel.style.gridColumn = '1 / -1';
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
    panel.style.gridColumn = '1 / -1';
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
