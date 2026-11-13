(function () {
  'use strict';

  var D = null;
  var SAMPLE = '小晴';
  var FEATURED = ['road-girl', 'school', 'transport-girl'];
  var AGES = ['0–2 歲', '2–3 歲', '3–4 歲', '5–6 歲'];
  var GENDERS = ['女仔', '男仔'];
  var KATY_SITE = 'https://misskatyw.github.io/katy-site/';
  var KATY_IG = 'https://www.instagram.com/misskw3_3';

  var filter = { age: 'all', gender: 'all' };
  var C = { art: null, name: '', lang: 'c', fmt: 'a4', step: 'form' };
  var P = null;
  var viewer = null;

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function packByArt(a) { return D.packs.filter(function (p) { return p.art === a; })[0]; }
  function packMeta(p) { return p.theme + ' · ' + p.age + ' · ' + p.gender + ' · 共 ' + totalPages(p) + ' 頁'; }
  function imageFiles(p) { return Book.pagesFor(p).map(function (sp) { return sp.img; }).filter(Boolean); }
  function totalPages(p) { return 1 + p.pages.length; }
  function cleanName(s) { return String(s || '').replace(/\s+/g, ' ').trim().slice(0, 8); }
  function scrollKeep(fn) { var y = window.scrollY; fn(); window.scrollTo(0, y); }

  function chipsHtml(items, sel) {
    return items.map(function (it) {
      return '<button type="button" class="opt' + (it.v === sel ? ' sel' : '') + '" data-v="' + esc(it.v) + '" aria-pressed="' + (it.v === sel) + '">' + esc(it.label) + '</button>';
    }).join('');
  }
  function onChips(root, sel, cb) {
    var box = $(sel, root);
    if (!box) return;
    box.addEventListener('click', function (e) {
      var b = e.target.closest('[data-v]');
      if (b && box.contains(b)) cb(b.getAttribute('data-v'));
    });
  }
  function langItems(withPromptOnly) {
    return Object.keys(Book.LANGS).filter(function (k) { return withPromptOnly || !Book.LANGS[k].promptOnly; })
      .map(function (k) { return { v: k, label: Book.LANGS[k].label }; });
  }
  function fmtItems() {
    return Object.keys(Book.FORMATS).map(function (k) { return { v: k, label: Book.FORMATS[k].label }; });
  }

  /* ---------- 首頁 ---------- */
  function packCard(p, badge) {
    var title = Book.fill(p.title.zh, SAMPLE);
    return '<a class="packcard" href="#/create/can/' + esc(p.art) + '">' +
      '<img src="assets/' + esc(p.cover) + '" alt="' + esc(title) + '封面" loading="lazy">' +
      '<div class="pbody">' + (badge ? '<span class="tag alt">即刻出書</span>' : '') +
      '<h3>《' + esc(title) + '》</h3>' +
      '<p>' + esc(p.theme) + ' · ' + esc(p.age) + ' · ' + esc(p.gender) + '</p>' +
      '<span class="pages">共 ' + totalPages(p) + ' 頁</span></div></a>';
  }

  function renderFeatured() {
    $('#featured').innerHTML = FEATURED.map(packByArt).filter(Boolean).map(function (p) { return packCard(p, true); }).join('');
  }

  function renderFilters() {
    var ages = [{ v: 'all', label: '全部' }].concat(AGES.map(function (a) { return { v: a, label: a }; }));
    var gens = [{ v: 'all', label: '全部' }].concat(GENDERS.map(function (g) { return { v: g, label: g }; }));
    function html(items, sel) {
      return items.map(function (it) { return '<button type="button" class="' + (it.v === sel ? 'on' : '') + '" data-v="' + esc(it.v) + '">' + esc(it.label) + '</button>'; }).join('');
    }
    $('#ageFilter').innerHTML = html(ages, filter.age);
    $('#genderFilter').innerHTML = html(gens, filter.gender);
  }

  function renderShelf() {
    var list = D.packs.filter(function (p) {
      return (filter.age === 'all' || p.age === filter.age) && (filter.gender === 'all' || p.gender === filter.gender);
    });
    $('#shelfGrid').innerHTML = list.map(function (p) { return packCard(p, false); }).join('');
    var empty = $('#shelfEmpty');
    if (!list.length) {
      empty.hidden = false;
      empty.innerHTML = esc(filter.age === 'all' ? '' : filter.age) + ' 嘅罐頭套裝仲未有（或者呢個組合未有）。可以試吓其他年齡，或者用 <a href="#/create/prompt"><strong>Prompt 制</strong></a> 整一本最似你小朋友嘅。';
    } else empty.hidden = true;
  }

  function renderAgeTiles() {
    var tiles = ['0–2 歲', '2–3 歲', '3–4 歲'].map(function (a) {
      var n = D.packs.filter(function (p) { return p.age === a; }).length;
      return '<a class="modecard" href="#/shelf?age=' + encodeURIComponent(a) + '"><h3>' + esc(a) + '</h3><p>' + n + ' 套現成繪本</p></a>';
    });
    tiles.push('<a class="modecard sel" href="#/create/prompt"><h3>✍️ Prompt 制</h3><p>幾多歲都得，自己生圖</p></a>');
    $('#ageTiles').innerHTML = tiles.join('');
  }

  function initHome() {
    renderFeatured();
    renderAgeTiles();
    renderFilters();
    renderShelf();
    function bind(id, key) {
      $(id).addEventListener('click', function (e) {
        var b = e.target.closest('[data-v]');
        if (!b) return;
        filter[key] = b.getAttribute('data-v');
        renderFilters(); renderShelf();
      });
    }
    bind('#ageFilter', 'age');
    bind('#genderFilter', 'gender');
  }

  /* ---------- 製作：揀整法 ---------- */
  function renderChooser(root) {
    root.innerHTML =
      '<div class="formwrap"><div class="q-head"><h2>開始整書</h2><p>揀一種整法</p></div>' +
      '<div class="modegrid" style="margin-top:16px">' +
      '<a class="modecard" href="#/shelf"><span class="tag alt">即刻出書</span><h3>🥫 罐頭素材制</h3><p>喺書架揀一套現成插圖，填個名就出書連 PDF。</p></a>' +
      '<a class="modecard sel" href="#/create/prompt"><span class="tag">最似你小朋友 · 推介</span><h3>✍️ Prompt 制</h3><p>網站幫你寫好成套 Prompt，拎去 ChatGPT／Gemini 生圖。</p></a>' +
      '</div></div>';
  }

  /*CANNED-FORM-START*/
  function renderCanned(root, art) {
    var pack = packByArt(art);
    if (C.art !== art) { C.art = art; C.step = 'form'; }
    if (C.step === 'gen') C.step = 'form';
    if (C.step === 'confirm') return canConfirm(root, pack);
    var title = Book.fill(pack.title.zh, C.name || SAMPLE);
    root.innerHTML =
      '<div class="formwrap"><a class="backlink" href="#/shelf">‹ 換套書</a>' +
      '<div class="q-head"><span class="tag alt">即刻出書</span><h2>罐頭素材制</h2><p>填晒下面三樣就出書。</p></div>' +
      '<div class="card mt14">' +
      '<div class="packmini mt0"><img src="assets/' + esc(pack.cover) + '" alt="" loading="lazy"><div><h3>《' + esc(title) + '》</h3><p>' + esc(packMeta(pack)) + '</p></div></div>' +
      '<label class="flabel" for="cName">小朋友叫咩名？</label>' +
      '<input class="txtin" id="cName" data-field="name" type="text" maxlength="8" autocomplete="off" placeholder="例如：' + SAMPLE + '" value="' + esc(C.name) + '">' +
      '<div class="flabel" id="cLangLbl">用咩語言？</div>' +
      '<div class="row" id="cLang" data-field="lang" role="group" aria-labelledby="cLangLbl">' + chipsHtml(langItems(false), C.lang) + '</div>' +
      '<div class="flabel" id="cFmtLbl">想要咩格式？</div>' +
      '<div class="row" id="cFmt" data-field="format" role="group" aria-labelledby="cFmtLbl">' + chipsHtml(fmtItems(), C.fmt) + '</div>' +
      '<button type="button" class="cta big mt24" id="cNext">睇確認 →</button>' +
      '</div></div>';
    var inp = $('#cName', root);
    inp.addEventListener('input', function () { C.name = inp.value; inp.classList.remove('bad'); });
    onChips(root, '#cLang', function (v) { C.lang = v; scrollKeep(function () { renderCanned(root, art); }); });
    onChips(root, '#cFmt', function (v) { C.fmt = v; scrollKeep(function () { renderCanned(root, art); }); });
    $('#cNext', root).addEventListener('click', function () {
      C.name = cleanName(inp.value);
      if (!C.name) { inp.classList.add('bad'); inp.focus(); Share.toast('先寫低小朋友個名喇'); return; }
      C.step = 'confirm';
      renderCanned(root, art);
      window.scrollTo(0, 0);
    });
  }

  function canConfirm(root, pack) {
    var title = Book.bookTitle(pack, C.lang, C.name);
    root.innerHTML =
      '<div class="formwrap"><div class="q-head"><span class="tag alt">確認</span><h2>確認一下</h2><p>無問題就生成繪本。</p></div>' +
      '<div class="card mt14">' +
      '<div class="packmini mt0"><img src="assets/' + esc(pack.cover) + '" alt="" loading="lazy"><div><h3>《' + esc(title) + '》</h3><p>' + esc(packMeta(pack)) + '</p></div></div>' +
      '<dl class="summary"><dt>小朋友名</dt><dd>' + esc(C.name) + '</dd><dt>語言</dt><dd>' + esc(Book.LANGS[C.lang].label) + '</dd><dt>格式</dt><dd>' + esc(Book.FORMATS[C.fmt].label) + '</dd></dl>' +
      '<div class="btnrow"><button type="button" class="cta ghost" id="cBack">‹ 返去改</button><button type="button" class="cta big grow2" id="cGo">生成繪本</button></div>' +
      '</div></div>';
    $('#cBack', root).addEventListener('click', function () { C.step = 'form'; renderCanned(root, pack.art); window.scrollTo(0, 0); });
    $('#cGo', root).addEventListener('click', function () { canGenerate(root, pack); });
  }

  function canGenerate(root, pack) {
    C.step = 'gen';
    root.innerHTML = '<div class="formwrap"><div class="card genbox"><div class="spinner"></div><h2 class="gen-title">整緊 ' + esc(C.name) + ' 嘅繪本…</h2><p class="gen-sub">執緊插圖同文字</p></div></div>';
    var imgs = imageFiles(pack);
    var loads = imgs.map(function (f) { return new Promise(function (r) { var i = new Image(); i.onload = i.onerror = r; i.src = 'assets/' + f; }); });
    var wait = new Promise(function (r) { setTimeout(r, 900); });
    var cap = new Promise(function (r) { setTimeout(r, 6000); });
    Promise.all([wait, Promise.race([Promise.all(loads), cap])]).then(function () {
      C.step = 'form';
      location.hash = '#/book/' + encodeURIComponent(pack.art) + '?n=' + encodeURIComponent(C.name) + '&l=' + C.lang + '&f=' + C.fmt;
    });
  }
  /*CANNED-FORM-END*/

  /*PROMPT-FORM-START*/
  function newPrompt() {
    return { step: 'form', name: '', age: '3–4 歲', gender: '女仔', theme: Object.keys(D.titles)[0], lang: 'c', pinyin: false,
      pages: 0, style: 0, photoText: '', photoURL: '', photoName: '', extras: '', fmt: 'a4', cpl: '' };
  }
  function storyFor(theme, age) {
    var bb = age === '0–2 歲' && D.promptStoriesBB[theme];
    return bb || D.promptStories[theme] || D.promptStories._default;
  }
  function pageOptions(P) {
    var out = [];
    for (var i = 4; i <= 14; i++) out.push(i);
    return out;
  }
  function pickBeats(list, k) {
    if (k >= list.length) return list.slice();
    if (k <= 1) return [list[0]];
    var out = [];
    for (var i = 0; i < k; i++) out.push(list[Math.round(i * (list.length - 1) / (k - 1))]);
    return out;
  }
  function matchingPack(P) {
    var same = D.packs.filter(function (p) { return p.theme === P.theme; });
    return same.filter(function (p) { return p.age === P.age && p.gender === P.gender; })[0] ||
      same.filter(function (p) { return p.gender === P.gender; })[0] || same[0] || null;
  }
  function langText(map, keys, name) {
    return keys.map(function (k) { return Book.fill(map[k], name); });
  }

  function buildModel(P) {
    var name = P.name;
    var keys = Book.LANGS[P.lang].keys;
    var T = D.titles[P.theme] || { zh: '{N}的故事', canto: '{N}的故事', en: "{N}'s Story" };
    var title = langText({ w: T.zh, c: T.canto, e: T.en }, keys, name);
    var st = D.styles[P.style];
    var age = D.ageType[P.age];
    var fmt = Book.FORMATS[P.fmt];
    var beats = pickBeats(storyFor(P.theme, P.age), P.pages - 1);
    var cp = matchingPack(P);
    var cpl = parseInt(P.cpl, 10);
    var zhCpl = cpl > 0 ? cpl : age.maxZh;
    var cplTxt = '中文每行最多 ' + zhCpl + ' 隻字、英文每行最多 ' + age.maxEn + ' 個字，最多 ' + age.maxLines + ' 行' + (cpl > 0 ? '（自訂）' : '（照年齡建議）');
    var coverScene = cp ? Book.fill(cp.coverScene, name) : '封面：' + name + '（' + P.age + P.gender + '）喺「' + P.theme + '」故事裏最有代表性嘅一幕，畫面中央清楚見到主角';
    var rows = [{ n: 1, label: '封面', scene: coverScene, lines: title }];
    beats.forEach(function (b, i) { rows.push({ n: i + 2, label: String(i + 2), scene: Book.fill(b.scene, name), lines: langText(b, keys, name) }); });
    var photo = P.photoText.trim();
    var photoTxt = photo ? photo : '（冇文字形容）';
    if (P.photoURL) photoTxt += (photo ? '；' : '') + '已準備相片「' + P.photoName + '」，生圖時請一併上載做參考（相片只喺你部機預覽，網站冇上傳）';
    var card = [
      ['主角名', name], ['年齡', P.age], ['性別', P.gender],
      ['畫風', st.n.replace(/\s*★預設/, '') + '：' + st.spec],
      ['相片參考', photoTxt], ['加嘢', P.extras.trim() || '冇'],
      ['語言', Book.LANGS[P.lang].label + (P.lang === 'wce' ? '（拼音：' + (P.pinyin ? '要' : '唔要') + '）' : '')],
      ['格式', fmt.label], ['頁數', P.pages + ' 頁（封面 ＋ ' + (P.pages - 1) + ' 頁內文）'], ['每行字數', cplTxt]
    ];
    var ratio = P.fmt === 'sq' ? '正方形 1:1' : P.fmt === 'img' ? '橫向 3:2' : '橫向 A4（297:210）';
    var instr = [
      '逐頁生圖：每頁一張獨立插圖，畫面比例用「' + ratio + '」，按「逐頁表」嘅場景畫。',
      '全書主角「' + name + '」（' + P.age + P.gender + '）外貌、髮型、衣著、五官畫法保持一致；畫風統一用「' + st.n.replace(/\s*★預設/, '') + '」：' + st.spec + '。',
      photo || P.photoURL ? '主角外觀跟相片參考：' + photoTxt + '。' : '冇相片參考，請畫一個親切、符合年齡嘅小朋友。',
      '圖入面唔好出現任何文字、字母、數字或水印；文字之後再排上去。',
      '圖唔好內嵌文字；畫面底部留一段平靜空間，主角面同重點唔好放喺最底（文字會排喺圖下面獨立字區）。',
      P.pages - 1 > beats.length ? '下面逐頁表得 ' + beats.length + ' 個節拍，但用家要 ' + (P.pages - 1) + ' 頁內文：請將節拍拆細，並喺中段加一次「練習→失敗→再試」，擴展到剛好 ' + (P.pages - 1) + ' 頁，每頁同樣寫出場景同文字。' : '',
      '喺同一個對話裏面逐頁生成，每次貼一個場景，並提醒「保持同上一張同一個主角同畫風」。'
    ];
    if (P.extras.trim()) instr.push('額外要求：' + P.extras.trim());
    instr.push('排版：' + cplTxt + '；文字喺圖下方字區，字體大細跟年齡（書頁闊 900px 時約 ' + Book.AGE_TYPE[P.age].zh + 'px），唔好縮細。');
    instr = instr.filter(Boolean);
    if (P.lang === 'wce' && P.pinyin) instr.push('每句中文下面加一行拼音。');
    return { title: title, card: card, rows: rows, instr: instr, comp: cp, name: name };
  }

  function toMd(M) {
    var out = ['# 《' + M.title[0] + '》Prompt 包', ''];
    out.push('## 人物設定卡', '');
    M.card.forEach(function (kv) { out.push('- **' + kv[0] + '**：' + kv[1]); });
    out.push('', '## 逐頁表', '', '| 頁 | 場景 | 文字 |', '|---|---|---|');
    M.rows.forEach(function (r) { out.push('| ' + r.label + ' | ' + r.scene + ' | ' + r.lines.join('<br>') + ' |'); });
    out.push('', '## 生圖指示', '');
    M.instr.forEach(function (t, i) { out.push((i + 1) + '. ' + t); });
    return out.join('\n');
  }

  function renderPrompt(root) {
    if (!P) P = newPrompt();
    if (P.step !== 'form') return wizard(root);
    var opts = pageOptions(P);
    if (opts.indexOf(P.pages) < 0) P.pages = opts[opts.length - 1];
    var themes = Object.keys(D.titles).map(function (t) { return { v: t, label: t }; });
    var bbNote = P.age === '0–2 歲' && D.promptStoriesBB[P.theme] ? '<div class="notebox">呢個主題有 0–2 歲專用 BB 版故事，已自動用。</div>' : '';
    var cp = matchingPack(P);
    var styleHtml = D.styles.map(function (s, i) {
      return '<button type="button" class="opt' + (i === P.style ? ' sel' : '') + '" data-v="' + i + '">' +
        (s.img ? '<img src="assets/' + esc(s.img) + '" alt="" loading="lazy">' : '<div class="noimg">🖼</div>') + esc(s.n.replace(/\s*★預設/, '')) + '</button>';
    }).join('');
    var age = D.ageType[P.age];
    root.innerHTML =
      '<div class="formwrap"><a class="backlink" href="#/create">‹ 返去揀整法</a>' +
      '<div class="q-head"><span class="tag">最似你小朋友 · 推介</span><h2>Prompt 制：主角同書嘅設定</h2><p>一頁填晒，下一步出 Prompt 包。</p></div>' +
      '<div class="card" style="margin-top:14px">' +
      '<label class="flabel" for="pName">小朋友名</label><input class="txtin" id="pName" type="text" maxlength="8" autocomplete="off" placeholder="例如：' + SAMPLE + '" value="' + esc(P.name) + '">' +
      '<div class="flabel">年齡</div><div class="row" id="pAge">' + chipsHtml(AGES.map(function (a) { return { v: a, label: a }; }), P.age) + '</div>' +
      '<div class="flabel">性別</div><div class="row" id="pGender">' + chipsHtml(GENDERS.map(function (g) { return { v: g, label: g }; }), P.gender) + '</div>' +
      '<div class="flabel">主題</div><div class="row" id="pTheme">' + chipsHtml(themes, P.theme) + '</div>' + bbNote +
      (cp ? '<div class="notebox warm">呢個主題有罐頭版，可以即刻出書 → <a href="#/create/can/' + esc(cp.art) + '">用罐頭版《' + esc(Book.fill(cp.title.zh, SAMPLE)) + '》</a></div>' : '') +
      '<div class="flabel">語言<small>揀一次，鎖死</small></div><div class="row" id="pLang">' + chipsHtml(langItems(true), P.lang) + '</div>' +
      (P.lang === 'wce' ? '<div class="flabel">拼音</div><div class="row" id="pPinyin">' + chipsHtml([{ v: 'on', label: '要拼音' }, { v: 'off', label: '唔要拼音' }], P.pinyin ? 'on' : 'off') + '</div>' : '') +
      '<div class="flabel">頁數<small>跟故事節拍，最多 ' + opts[opts.length - 1] + ' 頁</small></div><div class="row" id="pPages">' + chipsHtml(opts.map(function (n) { return { v: String(n), label: n + ' 頁' }; }), String(P.pages)) + '</div>' +
      '<div class="flabel">畫風</div><div class="styles" id="pStyle">' + styleHtml + '</div>' +
      '<label class="flabel" for="pPhoto">相片參考<small>文字形容；相片可選，只做預覽，唔會上傳去任何伺服器</small></label>' +
      '<textarea class="areain" id="pPhoto" placeholder="例如：短髮、圓臉、笑起上嚟有酒窩、鍾意著黃色衫">' + esc(P.photoText) + '</textarea>' +
      '<div class="photo-prev"><button type="button" class="opt" id="pPhotoBtn">上載一張相（預覽）</button><input type="file" id="pPhotoFile" accept="image/*" hidden>' +
      (P.photoURL ? '<img src="' + esc(P.photoURL) + '" alt="相片預覽"><button type="button" class="linkbtn" id="pPhotoDel">移除</button>' : '') + '</div>' +
      '<label class="flabel" for="pExtras">加嘢<small>選填</small></label>' +
      '<textarea class="areain" id="pExtras" placeholder="例如：加一隻小白兔做朋友、背景多啲花">' + esc(P.extras) + '</textarea>' +
      '<div class="flabel">格式</div><div class="row" id="pFmt">' + chipsHtml(fmtItems(), P.fmt) + '</div>' +
      '<details class="fold"' + (P.cpl ? ' open' : '') + '><summary>進階：一行幾多隻字（選填，預設照年齡建議）</summary><div class="fold-body">' +
      '<p style="margin:0 0 8px;color:var(--ink2);font-size:14.5px">照年齡建議：中文每行最多 ' + age.maxZh + ' 隻字、英文 ' + age.maxEn + ' 個字、最多 ' + age.maxLines + ' 行。唔撳開就唔使答。</p>' +
      '<label for="pCpl" style="font-weight:700;font-size:15px">中文每行最多</label> <input class="numin" id="pCpl" type="number" min="4" max="30" inputmode="numeric" placeholder="' + age.maxZh + '" value="' + esc(P.cpl) + '"> 隻字</div></details>' +
      '<button type="button" class="cta big" id="pGo" style="margin-top:24px">確認，繼續 →</button>' +
      '</div></div>';

    var redraw = function () { scrollKeep(function () { renderPrompt(root); }); };
    $('#pName', root).addEventListener('input', function (e) { P.name = e.target.value; e.target.classList.remove('bad'); });
    $('#pPhoto', root).addEventListener('input', function (e) { P.photoText = e.target.value; });
    $('#pExtras', root).addEventListener('input', function (e) { P.extras = e.target.value; });
    $('#pCpl', root).addEventListener('input', function (e) { P.cpl = e.target.value; });
    onChips(root, '#pAge', function (v) { P.age = v; P.pages = 0; redraw(); });
    onChips(root, '#pGender', function (v) { P.gender = v; redraw(); });
    onChips(root, '#pTheme', function (v) { P.theme = v; P.pages = 0; redraw(); });
    onChips(root, '#pLang', function (v) { P.lang = v; redraw(); });
    onChips(root, '#pPinyin', function (v) { P.pinyin = v === 'on'; redraw(); });
    onChips(root, '#pPages', function (v) { P.pages = parseInt(v, 10); redraw(); });
    onChips(root, '#pStyle', function (v) { P.style = parseInt(v, 10); redraw(); });
    onChips(root, '#pFmt', function (v) { P.fmt = v; redraw(); });
    var file = $('#pPhotoFile', root);
    $('#pPhotoBtn', root).addEventListener('click', function () { file.click(); });
    file.addEventListener('change', function () {
      var f = file.files && file.files[0];
      if (!f) return;
      if (P.photoURL) URL.revokeObjectURL(P.photoURL);
      P.photoURL = URL.createObjectURL(f); P.photoName = f.name;
      redraw();
    });
    var del = $('#pPhotoDel', root);
    if (del) del.addEventListener('click', function () { URL.revokeObjectURL(P.photoURL); P.photoURL = ''; P.photoName = ''; redraw(); });
    $('#pGo', root).addEventListener('click', function () {
      P.name = cleanName($('#pName', root).value);
      if (!P.name) { var i = $('#pName', root); i.classList.add('bad'); i.focus(); Share.toast('先寫低小朋友個名喇'); return; }
      P.step = 'cover';
      renderPrompt(root);
      window.scrollTo(0, 0);
    });
  }

  function promptResult(root) {
    var M = buildModel(P);
    var md = toMd(M);
    root.innerHTML =
      '<div class="formwrap"><div class="q-head"><span class="tag alt">已完成</span><h2>《' + esc(M.title[0]) + '》Prompt 包</h2><p>複製全文，貼落 ChatGPT／Gemini，逐頁生圖。</p></div>' +
      (M.comp ? '<div class="notebox warm">呢個主題有罐頭版，可以即刻出書 → <a href="#/create/can/' + esc(M.comp.art) + '">用罐頭版《' + esc(Book.fill(M.comp.title.zh, SAMPLE)) + '》</a></div>' : '') +
      '<div class="actions"><button type="button" class="cta" id="rCopy">複製全文</button><button type="button" class="cta done" id="rDl">下載 .md</button></div>' +
      '<div class="card pp-card"><h3>人物設定卡</h3><dl class="pp-kv">' + M.card.map(function (kv) { return '<dt>' + esc(kv[0]) + '</dt><dd>' + esc(kv[1]) + '</dd>'; }).join('') + '</dl></div>' +
      '<div class="card pp-card"><h3>逐頁表</h3><div class="pp-table-wrap"><table class="pp-table"><thead><tr><th>頁</th><th>場景</th><th>文字</th></tr></thead><tbody>' +
      M.rows.map(function (r) { return '<tr><td class="n">' + esc(r.label) + '</td><td>' + esc(r.scene) + '</td><td>' + r.lines.map(function (l) { return '<span class="line">' + esc(l) + '</span>'; }).join('') + '</td></tr>'; }).join('') +
      '</tbody></table></div></div>' +
      '<div class="card pp-card"><h3>生圖指示</h3><ol class="pp-inst">' + M.instr.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ol></div>' +
      '<div class="btnrow"><button type="button" class="cta ghost" id="rBack">‹ 返去改設定</button></div></div>';
    $('#rCopy', root).addEventListener('click', function () {
      Share.copyText(md).then(function (ok) { Share.toast(ok ? '已複製全文，去貼俾 AI 啦' : '複製唔到，請手動揀字複製'); });
    });
    $('#rDl', root).addEventListener('click', function () {
      var blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = M.title[0].replace(/[\\/:*?"<>|\s]+/g, '_') + '-prompt.md';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 500);
    });
    $('#rBack', root).addEventListener('click', function () { P.step = 'form'; renderPrompt(root); window.scrollTo(0, 0); });
  }
  function wizHead(n, title, todo) {
    var names = ['揀設定', '封面', '畫風', 'Overview＋砌書'];
    return '<div class="formwrap"><div class="wizsteps">' + names.map(function (t, i) { return '<span class="' + (i + 1 === n ? 'on' : i + 1 < n ? 'ok' : '') + '">' + (i + 1) + ' ' + t + '</span>'; }).join('') + '</div>' +
      '<div class="q-head"><h2>' + esc(title) + '</h2><p>' + esc(todo) + '</p></div>';
  }
  function pbox(i, title, text) {
    return '<div class="flabel">' + esc(title) + '</div><div class="promptbox">' + esc(text) + '</div><button type="button" class="cta ghost mt14" data-copy="' + i + '">複製呢段 Prompt</button>';
  }

  function wizard(root) {
    var M = buildModel(P), PR = [];
    var st = D.styles[P.style], sn = st.n.replace(/\s*★預設/, '');
    var look = P.photoText.trim() || '親切、符合年齡嘅小朋友';
    var ratio = P.fmt === 'sq' ? '正方形 1:1' : '橫向 3:2';
    var chara = '主角「' + P.name + '」（' + P.age + P.gender + '），外貌：' + look + '；畫風：' + sn + '（' + st.spec + '）';
    var rule = '圖入面唔好有任何文字、字母、數字或水印；畫面底部留一段平靜空間；比例「' + ratio + '」。';
    var coverP = '請畫一張兒童繪本封面插圖。\n' + chara + '\n封面畫面：' + M.rows[0].scene + '\n要求：' + rule + '主角面清楚。';
    var nContent = P.pages - 1, beatN = M.rows.length - 1;
    var scenes = M.rows.slice(1).map(function (r) { return r.label + '. ' + r.scene; }).join('\n');
    var expand = nContent > beatN ? '\n故事得 ' + beatN + ' 個節拍，但要 ' + nContent + ' 頁內文：請將節拍拆細，並喺中段加一次「練習→失敗→再試」，擴展到剛好 ' + nContent + ' 頁，每頁寫出場景同文字（' + Book.LANGS[P.lang].label + '）。' : '';
    var ovP = '請一次過畫「一張」全書分鏡總覽圖（contact sheet）：全書 ' + P.pages + ' 頁（封面＋' + nContent + ' 頁內文）按次序排成格仔，每格一個畫面，唔好一張張散生。\n同時用文字列出「角色一致性設定」（外貌、髮型、衣著、五官、色板），之後逐頁畫圖一定要跟。\n' + chara + '\n節拍：\n' + scenes + expand + '\n' + rule;
    var pageP = M.rows.slice(1).map(function (r) { return '第 ' + r.label + ' 頁：' + r.scene + '\n要求：跟總覽圖同角色設定；' + rule; }).join('\n\n') + (expand ? '\n\n（擴展出嚟嘅頁數都用同一格式：場景＋「' + rule + '」）' : '');
    function go(s) { P.step = s; renderPrompt(root); window.scrollTo(0, 0); }
    function copyBind() {
      $$('[data-copy]', root).forEach(function (b) {
        b.addEventListener('click', function () { Share.copyText(PR[+b.getAttribute('data-copy')]).then(function (ok) { Share.toast(ok ? '已複製，去貼俾 AI 啦' : '複製唔到，請手動揀字複製'); }); });
      });
    }
    var html;
    if (P.step === 'cover') {
      PR.push(coverP);
      html = wizHead(2, '封面確認', '睇清楚封面內容，OK 就繼續。') +
        '<div class="card"><dl class="pp-kv"><dt>書名</dt><dd>《' + esc(M.title[0]) + '》</dd><dt>主角設定</dt><dd>' + esc(chara) + '</dd><dt>封面畫面</dt><dd>' + esc(M.rows[0].scene) + '</dd><dt>已揀畫風</dt><dd>' + esc(sn) + '</dd></dl>' +
        pbox(0, '封面專用 Prompt', coverP) + '<div class="donewhen">完成條件：封面內容冇問題，㩒「確認，繼續」。</div>' +
        '<div class="btnrow"><button type="button" class="cta ghost" id="wBack">‹ 改設定</button><button type="button" class="cta grow2" id="wNext">確認，繼續</button></div></div></div>';
      root.innerHTML = html; copyBind();
      $('#wBack', root).addEventListener('click', function () { go('form'); });
      $('#wNext', root).addEventListener('click', function () { go('style'); });
    } else if (P.step === 'style') {
      PR.push(coverP);
      root.innerHTML = wizHead(3, '畫風確認', '先生一張封面圖，對吓畫風啱唔啱。') +
        '<div class="card"><ol class="pp-inst"><li>複製下面封面 Prompt，貼去 ChatGPT／Gemini 生一張封面圖。</li><li>睇吓畫風係咪你想要嘅（' + esc(sn) + '）。</li><li>OK 就㩒「畫風 OK」；唔啱就返去改畫風。</li></ol>' +
        '<button type="button" class="cta ghost mt14" data-copy="0">複製封面 Prompt</button><div class="donewhen">完成條件：你手上有一張畫風滿意嘅封面圖。</div>' +
        '<div class="btnrow"><button type="button" class="cta ghost" id="wStyle">‹ 返去改畫風</button><button type="button" class="cta grow2" id="wNext">畫風 OK，繼續</button></div></div></div>';
      copyBind();
      $('#wStyle', root).addEventListener('click', function () { go('form'); });
      $('#wNext', root).addEventListener('click', function () { P.ov = false; go('overview'); });
    } else {
      PR.push(ovP, pageP, toMd(M));
      var slots = ['封面'].concat(M.rows.slice(1).map(function (r) { return '第 ' + r.label + ' 頁'; }));
      for (var k = M.rows.length; k < P.pages; k++) slots.push('第 ' + (k + 1) + ' 頁');
      P.ups = P.ups || []; P.texts = P.texts || [];
      html = wizHead(4, 'Overview＋砌成書', '先出全書總覽，再逐頁定稿，最後上載成品圖砌書。') +
        '<div class="card">' + pbox(0, 'A. 全書 overview Prompt（一次過出一張分鏡總覽圖＋角色一致性設定）', ovP) +
        '<div class="donewhen">完成條件：AI 俾咗你一張全書總覽圖同角色設定，你覺得 OK。</div>';
      if (!P.ov) html += '<button type="button" class="cta big mt24" id="wOv">Overview OK，繼續</button></div></div>';
      else {
        html += '</div><div class="card mt14"><h3>B. 逐頁定稿 Prompt</h3><p>喺同一個對話逐頁貼，每頁一張成品圖（圖唔好內嵌文字、底部留平靜空間）。</p>' + pbox(1, '逐頁 Prompt', pageP) +
          '<button type="button" class="cta ghost mt14" data-copy="2">複製整包 .md</button></div>' +
          '<div class="card mt14"><h3>C. 拎圖返嚟砌書</h3><p>逐頁上載成品圖（封面＋' + nContent + ' 頁）；文字可改，雙語每行一種語言。圖會排喺上、字喺下。</p><div class="uplist">' +
          slots.map(function (s, i) {
            var u = P.ups[i], tx = P.texts[i] != null ? P.texts[i] : (i > 0 && M.rows[i] ? M.rows[i].lines.join('\n') : '');
            return '<div class="uprow"><div class="nm">' + esc(s) + '</div>' + (u ? '<img src="' + esc(u.url) + '" alt="">' : '') + '<button type="button" class="opt" data-up="' + i + '">' + (u ? '換圖' : '上載圖') + '</button>' +
              (i > 0 ? '</div><textarea class="areain" data-tx="' + i + '" placeholder="呢頁文字">' + esc(tx) + '</textarea>' : '</div>');
          }).join('') + '</div><input type="file" id="wFile" accept="image/*" hidden>' +
          '<button type="button" class="cta big mt24" id="wBuild">砌成書 →</button><div id="wBook"></div></div><div class="btnrow"><button type="button" class="cta ghost" id="wBack">‹ 返去畫風</button></div></div>';
      }
      root.innerHTML = html; copyBind();
      var ovb = $('#wOv', root);
      if (ovb) ovb.addEventListener('click', function () { P.ov = true; renderPrompt(root); });
      $('#wBack', root).addEventListener('click', function () { go('style'); });
      if (!P.ov) return;
      var file = $('#wFile', root), cur = 0;
      $$('[data-up]', root).forEach(function (b) { b.addEventListener('click', function () { cur = +b.getAttribute('data-up'); file.click(); }); });
      $$('[data-tx]', root).forEach(function (t) { t.addEventListener('input', function () { P.texts[+t.getAttribute('data-tx')] = t.value; }); });
      file.addEventListener('change', function () {
        var f = file.files && file.files[0]; if (!f) return;
        P.ups[cur] = { url: URL.createObjectURL(f), name: f.name };
        scrollKeep(function () { renderPrompt(root); });
      });
      $('#wBuild', root).addEventListener('click', function () {
        for (var i = 0; i < slots.length; i++) if (!P.ups[i]) { Share.toast('「' + slots[i] + '」未上載圖'); return; }
        var keys = Book.LANGS[P.lang].keys, T = D.titles[P.theme];
        var pack = { age: P.age, title: { zh: T.zh, canto: T.canto, en: T.en }, cover: P.ups[0].url, pages: [] };
        for (var j = 1; j < slots.length; j++) {
          var tx = P.texts[j] != null ? P.texts[j] : (M.rows[j] ? M.rows[j].lines.join('\n') : ''), ls = tx.split('\n'), pg = { img: P.ups[j].url };
          keys.forEach(function (key, n) { pg[key] = ls[n] || ''; });
          pack.pages.push(pg);
        }
        var opt = { name: P.name, lang: P.lang, fmt: P.fmt }, box = $('#wBook', root);
        box.innerHTML = '<div class="bookframe"><div id="wViewer"></div></div><div class="actions"><button type="button" class="cta done wide" id="wDl">' + (P.fmt === 'img' ? '下載圖檔' : '下載 PDF') + '</button></div>';
        if (viewer) viewer.destroy();
        viewer = Book.mount($('#wViewer', box), pack, opt);
        $('#wDl', box).addEventListener('click', function () {
          var fn = P.fmt === 'img' ? PDFExport.exportImages : PDFExport.exportPdf;
          PDFExport.run($('#wDl', box), box, function (prog) { return fn(pack, opt, prog); }, P.fmt === 'img');
        });
      });
    }
  }
  /*PROMPT-FORM-END*/

  /* ---------- 成品頁 ---------- */
  function renderBook(root, art, q) {
    var pack = packByArt(art);
    if (!pack) return false;
    var name = cleanName(q.get('n')) || SAMPLE;
    var lang = Book.LANGS[q.get('l')] && !Book.LANGS[q.get('l')].promptOnly ? q.get('l') : 'c';
    var fmt = Book.FORMATS[q.get('f')] ? q.get('f') : 'a4';
    var title = Book.bookTitle(pack, lang, name);
    var isImg = fmt === 'img';
    document.title = '《' + title + '》· Katy的小小故事屋';
    root.innerHTML =
      '<div class="bookwrap"><a class="backlink" href="#/shelf">‹ 揀其他書</a>' +
      '<div class="q-head bookhead"><span class="tag alt">已完成</span><h2>《' + esc(title) + '》</h2><p>' + esc(pack.theme) + ' · ' + esc(pack.age) + ' · ' + esc(Book.LANGS[lang].label) + '</p></div>' +
      '<div class="bookframe"><div id="viewer"></div></div>' +
      '<div style="margin-top:20px"><button type="button" class="cta big" id="bShare">↗ 分享俾朋友</button></div>' +
      '<div class="actions"><button type="button" class="cta done" id="bDl">' + (isImg ? '下載圖檔' : '下載 PDF') + '</button><button type="button" class="cta ghost" id="bCopy">複製連結</button></div>' +
      '<section class="block"><div class="card"><div class="kata"><div class="avatar">K</div><div><h3>認識 Katy</h3><p>幫小朋友整專屬繪本嘅媽媽。</p></div></div>' +
      '<div class="links"><a href="' + KATY_SITE + '" target="_blank" rel="noopener">個人網站</a><a href="' + KATY_IG + '" target="_blank" rel="noopener">Instagram @misskw3_3</a></div></div></section></div>';
    viewer = Book.mount($('#viewer', root), pack, { name: name, lang: lang, fmt: fmt });
    $('#bShare', root).addEventListener('click', function () {
      Share.share({ title: '《' + title + '》', text: name + '嘅專屬繪本，一齊睇', url: location.href });
    });
    $('#bCopy', root).addEventListener('click', function () { Share.copyLink(location.href); });
    var dl = $('#bDl', root);
    dl.addEventListener('click', function () {
      var fn = isImg ? PDFExport.exportImages : PDFExport.exportPdf;
      PDFExport.run(dl, $('.actions', root).parentNode, function (prog) { return fn(pack, { name: name, lang: lang, fmt: fmt }, prog); }, isImg);
    });
    return true;
  }

  /* ---------- 路由 ---------- */
  function parseHash() {
    var h = location.hash.replace(/^#\/?/, '');
    var i = h.indexOf('?');
    var path = i >= 0 ? h.slice(0, i) : h;
    return { parts: path.split('/').filter(Boolean).map(decodeURIComponent), q: new URLSearchParams(i >= 0 ? h.slice(i + 1) : '') };
  }

  function showView(name) {
    $$('.view').forEach(function (v) { v.hidden = v.getAttribute('data-view') !== name; });
  }

  function route() {
    if (!D) return;
    var r = parseHash(), p0 = r.parts[0] || 'home';
    if (viewer) { viewer.destroy(); viewer = null; }
    document.title = 'Katy的小小故事屋 · 個人化兒童繪本';
    var view = 'home', nav = p0, scroll = null;
    if (p0 === 'shelf') {
      view = 'shelf';
      var qa = r.q.get('age');
      filter.age = qa && AGES.indexOf(qa) >= 0 ? qa : 'all';
      renderFilters(); renderShelf();
    } else if (p0 === 'create') {
      view = 'create';
      var root = $('#view-create');
      if (r.parts[1] === 'prompt') renderPrompt(root);
      else if (r.parts[1] === 'can' && packByArt(r.parts[2])) renderCanned(root, r.parts[2]);
      else renderChooser(root);
    } else if (p0 === 'book') {
      if (renderBook($('#view-book'), r.parts[1], r.q)) { view = 'book'; nav = ''; }
      else { location.replace('#/home'); return; }
    } else nav = 'home';
    showView(view);
    $$('.nav a').forEach(function (a) { a.classList.toggle('on', a.getAttribute('data-nav') === nav); });
    if (scroll) { var t = document.getElementById(scroll); if (t) t.scrollIntoView(); }
    else window.scrollTo(0, 0);
  }

  function fail(msg) {
    var m = $('.main');
    m.innerHTML = '<div class="card" style="margin-top:20px"><h2>載入唔到資料</h2><p>' + esc(msg) + '</p></div>';
  }

  function boot() {
    $('#siteShare').addEventListener('click', function () {
      Share.share({ title: Share.SITE, text: '幫小朋友整專屬繪本', url: location.origin + location.pathname });
    });
    fetch('data/site-data.json').then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function (d) {
      D = d;
      Book.init(d);
      initHome();
      window.addEventListener('hashchange', route);
      route();
    }).catch(function (e) {
      fail('請用網址（http／https）打開呢個網站，唔好直接雙擊檔案。（' + e.message + '）');
    });
  }

  boot();
})();
