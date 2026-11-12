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
    a4:  { label: 'A4 橫版 PDF', ratio: 297 / 210, w: 1123, h: 794, kind: 'pdf' },
    sq:  { label: '正方形 PDF', ratio: 1, w: 1123, h: 1123, kind: 'pdf' },
    img: { label: '只要圖檔', ratio: 297 / 210, w: 1123, h: 794, kind: 'img' }
  };
  var BASE = 900;
  var data = null;

  function init(d) { data = d; }
  function px(pt) { return Math.round(pt * 4 / 3); }

  function sizesFor(age) {
    var a = data.ageType[age] || data.ageType['3–4 歲'];
    var c = data.coverType;
    return { zh: px(a.ptZh), en: px(a.ptEn), czh: px(c.ptZh), cen: px(c.ptEn), num: px(c.ptPageNum) };
  }

  function fill(t, name) { return String(t == null ? '' : t).replace(/\{N\}/g, name); }
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

  function pagesFor(pack) {
    var list = [{ type: 'cover', img: pack.cover }];
    pack.pages.forEach(function (pg) {
      list.push({ type: 'img', pg: pg, img: pg.img });
      list.push({ type: 'big', pg: pg });
    });
    return list;
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function lineEls(lines, parent) {
    lines.forEach(function (ln, i) {
      parent.appendChild(el('div', (i === 0 ? 'bk-main ' : 'bk-sub ') + ln.cls, ln.text));
    });
  }

  function buildPage(spec, o) {
    var s = sizesFor(o.pack.age);
    var page = el('div', 'bk-page' + (o.exportMode ? ' is-export' : ''));
    page.style.setProperty('--u', (o.u || 1) + 'px');
    page.style.setProperty('--ratio', String(o.ratio));
    page.style.setProperty('--zhs', s.zh);
    page.style.setProperty('--ens', s.en);
    page.style.setProperty('--czhs', s.czh);
    page.style.setProperty('--cens', s.cen);
    page.style.setProperty('--nums', s.num);

    if (spec.type !== 'big') {
      var img = document.createElement('img');
      img.className = 'bk-img';
      img.alt = spec.type === 'cover' ? '封面' : '';
      if (!o.exportMode) img.loading = 'lazy';
      img.decoding = 'async';
      img.src = 'assets/' + spec.img;
      page.appendChild(img);
    }

    if (spec.type === 'cover') {
      var plate = el('div', 'bk-cover-plate');
      titleParts(o.pack, o.lang, o.name).forEach(function (t) { plate.appendChild(el('div', 'ct ' + t.cls, t.text)); });
      page.appendChild(plate);
    } else if (spec.type === 'img') {
      var band = el('div', 'bk-band');
      var inner = el('div', 't');
      lineEls(pageLines(spec.pg, o.lang, o.name), inner);
      band.appendChild(inner);
      page.appendChild(band);
      page.appendChild(el('div', 'bk-num on-img', String(o.num)));
    } else {
      var big = el('div', 'bk-big');
      lineEls(pageLines(spec.pg, o.lang, o.name), big);
      page.appendChild(big);
      page.appendChild(el('div', 'bk-num on-big', String(o.num)));
    }
    return page;
  }

  function buildAll(pack, o, width) {
    var fmt = FORMATS[o.fmt] || FORMATS.a4;
    var u = width / BASE;
    return pagesFor(pack).map(function (spec, i) {
      return buildPage(spec, { pack: pack, lang: o.lang, name: o.name, ratio: fmt.ratio, u: u, num: i + 1, exportMode: true });
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
      stage.appendChild(buildPage(specs[idx], { pack: pack, lang: o.lang, name: o.name, ratio: fmt.ratio, u: u, num: idx + 1 }));
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
    LANGS: LANGS, FORMATS: FORMATS, BASE: BASE,
    init: init, sizesFor: sizesFor, fill: fill, titleParts: titleParts, bookTitle: bookTitle,
    pageLines: pageLines, pagesFor: pagesFor, buildPage: buildPage, buildAll: buildAll, mount: mount
  };
})();
