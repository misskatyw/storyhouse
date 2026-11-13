(function () {
  'use strict';

  var LANGS = {
    w:   { label: '繁體書面語', keys: ['w'] },
    c:   { label: '廣東話口語', keys: ['c'] },
    e:   { label: 'English', keys: ['e'] },
    we:  { label: '雙語（書面＋英文）', keys: ['w', 'e'] },
    ew:  { label: '雙語（英文＋書面）', keys: ['e', 'w'] },
    wce: { label: '三語（書面＋廣東話＋English）', keys: ['w', 'c', 'e'], promptOnly: true }
  };
  var FORMATS = {
    a4:  { label: 'A4 橫版 PDF', w: 1528, h: 1080, kind: 'pdf', landscape: true },
    sq:  { label: '正方形 PDF', w: 1080, kind: 'pdf', square: true },
    img: { label: '只要圖檔', w: 1080, kind: 'img' }
  };
  var BASE = 900;
  var MAX_IMG_W = 1080;
  var data = null;
  var scenesByTheme = {};

  var EXT_ZOOM = 1.6;

  // 900px 基準 px：內文中／英（舊值 37/35、35/32、32/31、29/29 的兩倍左右）、每行中文字數上限
  var AGE_TYPE = {
    '0–2 歲': { zh: 72, en: 68, cpl: 11 },
    '2–3 歲': { zh: 68, en: 62, cpl: 12 },
    '3–4 歲': { zh: 64, en: 62, cpl: 13 },
    '5–6 歲': { zh: 58, en: 58, cpl: 14 }
  };
  var COVER_PX = { zh: 80, en: 60, num: 17 };

  function init(d) { data = d; }

  function setScenes(arr) {
    scenesByTheme = {};
    (arr || []).forEach(function (sc) { if (sc && sc.theme) scenesByTheme[sc.theme] = sc; });
  }

  function sizesFor(age) {
    var a = AGE_TYPE[age] || AGE_TYPE['3–4 歲'];
    return { zh: a.zh, en: a.en, cpl: a.cpl, czh: COVER_PX.zh, cen: COVER_PX.en, num: COVER_PX.num, ccpl: Math.floor((BASE - 56) / COVER_PX.zh) };
  }

  var OPEN_P = '，。！？、；：」』）”’';
  function wrapZh(text, n) {
    var clauses = String(text).match(/[^，。！？、；：]+[，。！？、；：]?|[，。！？、；：]/g) || [String(text)];
    var lines = [], cur = '';
    clauses.forEach(function (c) {
      while (c.length > n) {
        var cut = n;
        if (OPEN_P.indexOf(c.charAt(cut)) >= 0) cut -= 1;
        if (cur) { lines.push(cur); cur = ''; }
        lines.push(c.slice(0, cut));
        c = c.slice(cut);
      }
      if (!c) return;
      if ((cur + c).length <= n) cur += c;
      else { if (cur) lines.push(cur); cur = c; }
    });
    if (cur) lines.push(cur);
    return lines;
  }

  function fill(t, name, theme) { var r = String(t == null ? '' : t).replace(/\{N\}/g, name); return theme == null ? r : r.replace(/\{T\}/g, theme); }
  function isEn(k) { return k === 'e'; }

  function titleParts(pack, lang, name) {
    var T = pack.title;
    var map = { w: T.zh, c: T.canto, e: T.en };
    return LANGS[lang].keys.slice(0, 2).map(function (k) {
      return { cls: isEn(k) ? 'en' : 'zh', text: fill(map[k], name) };
    });
  }

  function bookTitle(pack, lang, name) { return titleParts(pack, lang, name)[0].text; }

  function pageLines(pg, lang, name) {
    return LANGS[lang].keys.map(function (k) {
      return { cls: isEn(k) ? 'en' : 'zh', text: fill(pg[k], name) };
    });
  }

  function specLines(spec, lang, name) {
    if (spec.type === 'cover') return titleParts(spec.pack, lang, name);
    return spec.pg ? pageLines(spec.pg, lang, name) : [];
  }

  function pagesFor(pack) {
    var list = [{ type: 'cover', img: pack.cover }];
    pack.pages.forEach(function (pg) { list.push({ type: 'img', pg: pg, img: pg.img }); });
    var sc = scenesByTheme[pack.theme];
    if (sc) list.push({ type: 'scene', img: sc.img, pg: sc });
    if (sc && sc.ext && pack.pages.length) list.push({ type: 'ext', img: pack.pages[pack.pages.length - 1].img, pg: sc.ext });
    return list;
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function textLines(cls, text, n) {
    var box = el('span', 'lns');
    (cls === 'zh' ? wrapZh(text, n) : [text]).forEach(function (t) { box.appendChild(el('span', 'ln', t)); });
    return box;
  }

  function lineEls(lines, parent, n) {
    lines.forEach(function (ln, i) {
      var d = el('div', (i === 0 ? 'bk-main ' : 'bk-sub ') + ln.cls);
      d.appendChild(textLines(ln.cls, ln.text, n));
      parent.appendChild(d);
    });
  }

  function buildPage(spec, o) {
    var s = sizesFor(o.pack.age);
    var page = el('div', 'bk-page' + (o.exportMode ? ' is-export' : '') + (o.fmt === 'sq' ? ' sq' : '') + (o.fmt === 'a4' ? ' a4p' : '') + (spec.type === 'ext' ? ' ext' : ''));
    page.style.setProperty('--u', (o.u || 1) + 'px');
    page.style.setProperty('--zhs', s.zh);
    page.style.setProperty('--ens', s.en);
    page.style.setProperty('--czhs', s.czh);
    page.style.setProperty('--cens', s.cen);
    page.style.setProperty('--nums', s.num);

    if (spec.img) {
      var box = el('div', 'bk-imgbox');
      var img = document.createElement('img');
      img.className = 'bk-img';
      img.alt = spec.type === 'cover' ? '封面' : '';
      if (!o.exportMode) img.loading = 'lazy';
      img.decoding = 'async';
      img.src = (o.imgMap && o.imgMap[spec.img]) || 'assets/' + spec.img;
      box.appendChild(img);
      page.appendChild(box);
    }

    var txt;
    if (spec.type === 'cover') {
      txt = el('div', 'bk-text cover');
      titleParts(o.pack, o.lang, o.name).forEach(function (t) {
        var d = el('div', 'ct ' + t.cls);
        d.appendChild(textLines(t.cls, t.text, s.ccpl));
        txt.appendChild(d);
      });
    } else {
      txt = el('div', 'bk-text');
      lineEls(specLines(spec, o.lang, o.name), txt, s.cpl);
      txt.appendChild(el('div', 'bk-num', String(o.num)));
    }
    page.appendChild(txt);
    return page;
  }

  function buildAll(pack, o, width, specs) {
    var u = width / BASE;
    return (specs || pagesFor(pack)).map(function (spec, i) {
      return buildPage(spec, { pack: pack, lang: o.lang, name: o.name, fmt: o.fmt, imgMap: o.imgMap, u: u, num: i + 1, exportMode: true });
    });
  }

  function mount(container, pack, o) {
    var fmt = FORMATS[o.fmt] || FORMATS.a4;
    var specs = pagesFor(pack);
    var total = specs.length;
    var idx = 0;

    container.innerHTML = '';
    var stage = el('div', 'bk-stage');
    var nav = el('div', 'viewer-nav');
    var prev = el('button', 'roundbtn', '‹');
    var next = el('button', 'roundbtn', '›');
    prev.type = next.type = 'button';
    prev.setAttribute('aria-label', '上一頁');
    next.setAttribute('aria-label', '下一頁');
    var pager = el('div', 'pager');
    nav.appendChild(prev); nav.appendChild(pager); nav.appendChild(next);
    var dots = el('div', 'dots');
    var dotEls = specs.map(function (_, i) {
      var d = el('button');
      d.type = 'button';
      d.setAttribute('aria-label', '去第 ' + (i + 1) + ' 頁');
      d.addEventListener('click', function () { go(i); });
      dots.appendChild(d);
      return d;
    });
    container.appendChild(stage); container.appendChild(nav); container.appendChild(dots);

    function render() {
      var u = Math.max(stage.clientWidth, 200) / BASE;
      stage.innerHTML = '';
      stage.appendChild(buildPage(specs[idx], { pack: pack, lang: o.lang, name: o.name, fmt: o.fmt, u: u, num: idx + 1 }));
      pager.textContent = '第 ' + (idx + 1) + ' 頁 / 共 ' + total + ' 頁';
      prev.disabled = idx === 0;
      next.disabled = idx === total - 1;
      dotEls.forEach(function (d, i) { d.classList.toggle('on', i === idx); });
      var ahead = specs[idx + 1];
      if (ahead && ahead.img) { var pre = new Image(); pre.src = 'assets/' + ahead.img; }
    }
    function go(i) {
      i = Math.max(0, Math.min(total - 1, i));
      if (i === idx) return;
      idx = i; render();
    }
    function onKey(e) {
      if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
      if (e.key === 'ArrowLeft') go(idx - 1);
      else if (e.key === 'ArrowRight') go(idx + 1);
    }
    prev.addEventListener('click', function () { go(idx - 1); });
    next.addEventListener('click', function () { go(idx + 1); });
    document.addEventListener('keydown', onKey);

    var sx = null;
    stage.addEventListener('touchstart', function (e) { sx = e.touches[0].clientX; }, { passive: true });
    stage.addEventListener('touchend', function (e) {
      if (sx == null) return;
      var dx = e.changedTouches[0].clientX - sx; sx = null;
      if (Math.abs(dx) > 48) go(idx + (dx < 0 ? 1 : -1));
    });

    var lastW = 0, ro = null;
    if (window.ResizeObserver) {
      ro = new ResizeObserver(function () {
        var w = stage.clientWidth;
        if (w && Math.abs(w - lastW) > 1) { lastW = w; render(); }
      });
      ro.observe(stage);
    }
    render();

    return {
      go: go,
      destroy: function () { document.removeEventListener('keydown', onKey); if (ro) ro.disconnect(); }
    };
  }

  window.Book = {
    LANGS: LANGS, FORMATS: FORMATS, EXT_ZOOM: EXT_ZOOM, BASE: BASE, MAX_IMG_W: MAX_IMG_W, AGE_TYPE: AGE_TYPE, wrapZh: wrapZh,
    init: init, setScenes: setScenes, specLines: specLines, sizesFor: sizesFor, fill: fill, titleParts: titleParts, bookTitle: bookTitle,
    pageLines: pageLines, pagesFor: pagesFor, buildPage: buildPage, buildAll: buildAll, mount: mount
  };
})();
