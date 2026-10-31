/* ===== card.js · Открытка ===== */
(function (global) {
  'use strict';

  /* ===== card content: local text + shareable link ===== */
  var DEFAULT_CARD = {
    to: '',
    from: 'Твой ночной собеседник',
    wish: 'Ты пережил ещё один день, в котором ничего не случилось. Это, между прочим, тоже удача — просто её не выдают за подвиг.\n\nПусть ночь будет к тебе доброй: в кармане найдётся конфета, чай окажется горячим, а все страшные истории закончатся общим смехом.\n\nЕсли станет не по себе — дыши. У настоящих страшных вещей, в отличие от декораций, не бывает занавески.'
  };
  var DEFAULT_ADDR = 'Кому: тебе, кто это открыл';
  var CARD_KEY = 'hw.card.v1';
  var LIMITS = { to: 40, from: 40, wish: 420 };

  function b64encode(str) {
    var bytes = new TextEncoder().encode(str);
    var bin = '';
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return global.btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }

  function b64decode(str) {
    var s = String(str).replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    var bin = global.atob(s);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  function clean(str, max) {
    return String(str == null ? '' : str).replace(/\s+/g, ' ').trim().slice(0, max);
  }

  function readHashCard() {
    var raw = location.hash.replace(/^#/, '');
    if (!raw) return null;
    try {
      var p = new URLSearchParams(raw);
      var to = p.get('k'), from = p.get('f'), wish = p.get('w');
      if (to == null && from == null && wish == null) return null;
      return {
        to: to == null ? '' : b64decode(to).slice(0, LIMITS.to),
        from: from == null ? '' : b64decode(from).slice(0, LIMITS.from),
        wish: wish == null ? '' : b64decode(wish).slice(0, LIMITS.wish)
      };
    } catch (e) {
      return null;
    }
  }

  function readCard() {
    var fromHash = readHashCard();
    if (fromHash) return { card: fromHash, shared: true };
    var saved = HW.storage.get(CARD_KEY, null);
    if (saved && typeof saved === 'object') {
      return {
        card: {
          to: clean(saved.to, LIMITS.to),
          from: clean(saved.from, LIMITS.from),
          wish: String(saved.wish || '').slice(0, LIMITS.wish)
        },
        shared: false
      };
    }
    return { card: DEFAULT_CARD, shared: false };
  }

  function wishNodes(text) {
    return String(text || '')
      .split(/\n{2,}/)
      .map(function (p) { return p.replace(/\s*\n\s*/g, ' ').trim(); })
      .filter(Boolean);
  }

  HW.ready(function () {
    var scene = HW.scene({
      moon: [0.775, 0.255],
      fogGain: 0.58,
      rayGain: 0.3,
      particles: { embers: 34, fireflies: 10, bats: 3, leaves: 12 }
    });
    HW.transitions();
    HW.markNav('card');

    var body     = document.body;
    var wrap     = HW.$('.env-wrap');
    var env      = HW.$('#env');
    var seal     = HW.$('#seal');
    var flash    = HW.$('#env-flash');
    var letter   = HW.$('#letter');
    var paper    = HW.$('#letter-paper');
    var hint     = HW.$('#cd-hint');
    var actions  = HW.$('#cd-actions');
    var reopen   = HW.$('#cd-reopen');
    var reduced  = HW.reduced;

    if (!env || !letter || !wrap) return;

    var opened = false;
    var letterRaised = false;
    var lockTimer = null;
    var crackTimer = null;

    /* ── контент открытки ── */
    var loaded = readCard();
    var card = loaded.card;
    var isShared = loaded.shared;

    var elAddr = HW.$('#cd-addr');
    var elTo = HW.$('#cd-to');
    var elWish = HW.$('#cd-wish');
    var elFrom = HW.$('#cd-from');

    var editor = HW.$('#cd-editor');
    var inTo = HW.$('#cd-in-to');
    var inFrom = HW.$('#cd-in-from');
    var inWish = HW.$('#cd-in-wish');
    var count = HW.$('#cd-count');
    var note = HW.$('#cd-editor-note');
    var btnEdit = HW.$('#cd-edit');
    var btnSave = HW.$('#cd-save');
    var btnReset = HW.$('#cd-reset');
    var btnShare = HW.$('#cd-share');
    var btnLink = HW.$('#cd-link');

    function applyCard(next, skipFit) {
      card = {
        to: clean(next.to, LIMITS.to),
        from: clean(next.from, LIMITS.from),
        wish: String(next.wish || '').trim().slice(0, LIMITS.wish)
      };

      if (elAddr) elAddr.textContent = card.to ? 'Кому: ' + card.to : DEFAULT_ADDR;

      if (elTo) {
        if (card.to) {
          elTo.textContent = card.to + ',';
          elTo.hidden = false;
        } else {
          elTo.textContent = '';
          elTo.hidden = true;
        }
      }

      if (elWish) {
        elWish.textContent = '';
        var paras = wishNodes(card.wish || DEFAULT_CARD.wish);
        paras.forEach(function (p) {
          var n = document.createElement('p');
          n.textContent = p;
          elWish.appendChild(n);
        });
      }

      if (elFrom) elFrom.textContent = card.from || DEFAULT_CARD.from;

      if (opened && !skipFit) fitLetter(true);
    }

    function fillForm() {
      if (inTo) inTo.value = card.to;
      if (inFrom) inFrom.value = card.from;
      if (inWish) inWish.value = card.wish || DEFAULT_CARD.wish;
      updateCount();
    }

    function updateCount() {
      if (count && inWish) count.textContent = inWish.value.length + ' / ' + LIMITS.wish;
    }

    function flashNote(text, good) {
      if (!note) return;
      note.textContent = text;
      note.hidden = false;
      note.style.color = good ? 'var(--poison)' : 'var(--ember)';
      clearTimeout(flashNote._t);
      flashNote._t = global.setTimeout(function () { note.hidden = true; }, 2600);
    }

    /* ── ссылка для отправки ── */
    function shareUrl() {
      var p = new URLSearchParams();
      if (card.to) p.set('k', b64encode(card.to));
      if (card.from) p.set('f', b64encode(card.from));
      if (card.wish) p.set('w', b64encode(card.wish));
      var qs = p.toString();
      return location.origin + location.pathname + (qs ? '#' + qs : '');
    }

    function copyShare(btn) {
      var url = shareUrl();
      var target = btn || btnShare;

      /* берём только «листовые» span: у кнопки в конверте внешний span содержит
         вложенные .btn__long/.btn__short, и запись в его textContent снесла бы
         всю разметку кнопки вместе с подписью */
      var labels = [];
      if (target && target.querySelectorAll) {
        labels = Array.prototype.slice.call(target.querySelectorAll('span'))
          .filter(function (s) { return !s.querySelector('span'); });
      }
      var texts = labels.map(function (s) { return s.textContent; });

      var done = function () {
        labels.forEach(function (s) { s.textContent = 'Скопировано'; });
        flashNote('Ссылка готова — отправь её кому хочешь.', true);
        global.setTimeout(function () {
          labels.forEach(function (s, i) { s.textContent = texts[i]; });
        }, 2200);
      };

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(done, fallbackCopy);
      } else {
        fallbackCopy();
      }

      function fallbackCopy() {
        var ta = document.createElement('textarea');
        ta.value = url;
        ta.setAttribute('readonly', '');
        ta.style.cssText = 'position:fixed;top:0;left:-9999px;opacity:0';
        document.body.appendChild(ta);
        ta.select();
        ta.setSelectionRange(0, url.length);
        var ok = false;
        try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
        document.body.removeChild(ta);
        if (ok) {
          done();
        } else {
          flashNote('Браузер не даёт скопировать — ссылка в адресной строке.', false);
        }
      }
    }

    /* ── открытие / закрытие редактора ── */
    function openEditor() {
      if (!editor) return;
      fillForm();
      editor.hidden = false;
      document.body.classList.add('is-editing');
      if (inWish) inWish.focus({ preventScroll: true });
    }

    function closeEditor() {
      if (!editor) return;
      editor.hidden = true;
      document.body.classList.remove('is-editing');
      /* несохранённые правки откатываем: иначе письмо оставалось бы
         с текстом из закрытого редактора */
      if (savedCard) applyCard(savedCard, true);
      var e = env;
      if (e && e.focus) e.focus({ preventScroll: true });
    }

    if (btnEdit) btnEdit.addEventListener('click', openEditor);

    /* «Ссылка на открытку»: пока письмо не переписано, сразу копировать нечего —
       отправляем в редактор вписать кому, от кого и что. Дальше — сразу копирует.
       Флаг нужен потому, что «от кого» заполнено и в исходном тексте. */
    var cardTouched = !!location.hash || !!HW.storage.get(CARD_KEY);
    if (btnLink) {
      btnLink.addEventListener('click', function () {
        if (cardTouched) copyShare(btnLink);
        else openEditor();
      });
    }

    /* с главной приходят с ?edit=1 — сразу показываем редактор */
    if (/[?&]edit=1/.test(location.search)) {
      global.setTimeout(function () { openEditor(); }, reduced ? 40 : 420);
    }
    if (HW.$('[data-close-editor]')) {
      HW.$$('[data-close-editor]').forEach(function (n) {
        n.addEventListener('click', closeEditor);
      });
    }

    if (btnSave) {
      btnSave.addEventListener('click', function () {
        applyCard({
          to: inTo ? inTo.value : '',
          from: inFrom ? inFrom.value : '',
          wish: inWish ? inWish.value : ''
        });
        HW.storage.set(CARD_KEY, card);
        savedCard = { to: card.to, from: card.from, wish: card.wish };
        cardTouched = true;
        closeEditor();
        flashNote('Сохранено. Письмо переписано.', true);
      });
    }

    if (btnReset) {
      btnReset.addEventListener('click', function () {
        applyCard(DEFAULT_CARD);
        HW.storage.del(CARD_KEY);
        savedCard = { to: card.to, from: card.from, wish: card.wish };
        cardTouched = false;
        if (location.hash) history.replaceState(null, '', location.pathname);
        fillForm();
        flashNote('Вернули исходный текст.', true);
      });
    }

    /* живой предпросмотр: пока набираешь, письмо уже переписано —
       иначе понять, что получится, было нельзя */
    function preview() {
      if (!editor || editor.hidden) return;
      applyCard({
        to: inTo ? inTo.value : '',
        from: inFrom ? inFrom.value : '',
        wish: inWish ? inWish.value : ''
      }, true);
    }
    [inTo, inFrom, inWish].forEach(function (n) {
      if (n) n.addEventListener('input', preview);
    });

    if (btnShare) btnShare.addEventListener('click', copyShare);
    if (inWish) inWish.addEventListener('input', updateCount);

    global.addEventListener('keydown', function (e) {
      if (!editor || editor.hidden) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        closeEditor();
      }
    });

    if (isShared && hint) {
      hint.innerHTML = '<span class="pumpkin-dot">✦</span> Открытка для тебя — нажми на конверт';
    }

    applyCard(card);
    /* что записано в открытке: предпросмотр в редакторе можно отменить */
    var savedCard = { to: card.to, from: card.from, wish: card.wish };

    /* ── кладбище за конвертом ── */
    var YARD = {
      w: 1440, hFar: 460, hNear: 460, hGround: 300
    };

    function el(tag, attrs) {
      var n = document.createElementNS('http://www.w3.org/2000/svg', tag);
      for (var k in attrs) if (attrs[k] != null) n.setAttribute(k, attrs[k]);
      return n;
    }

    function rnd(a, b) { return a + Math.random() * (b - a); }

    function pineD(x, baseY, h, w) {
      var d = [];
      var tiers = 4;
      var i;
      for (i = 1; i <= tiers; i++) {
        var t = i / tiers;
        var topY = baseY - h * t;
        var botY = baseY - h * (t - 1.18 / tiers);
        var half = w * (1 - t * 0.56);
        d.push('M', x.toFixed(1), topY.toFixed(1),
               'L', (x - half).toFixed(1), botY.toFixed(1),
               'L', (x + half).toFixed(1), botY.toFixed(1), 'Z');
      }
      return d.join(' ');
    }

    function pineRow(target, baseY, count, h, w, seed) {
      if (!target) return;
      var step = YARD.w / count;
      var d = [];
      var i;
      for (i = 0; i <= count; i++) {
        var j = ((i * 9301 + seed * 49297) % 233280) / 233280;
        var x = -step * 0.4 + i * step + (j - 0.5) * step * 0.62;
        d.push(pineD(x, baseY, h * (0.64 + j * 0.68), w * (0.7 + j * 0.6)));
      }
      target.textContent = '';
      target.appendChild(el('path', { d: d.join(' ') }));
    }

    function bareTree(target, x, baseY, h, seed) {
      if (!target) return;
      var i;
      var trunk = 'M' + x + ' ' + baseY + ' Q' + (x + h * 0.07) + ' ' + (baseY - h * 0.5) +
                  ' ' + (x - h * 0.04) + ' ' + (baseY - h);
      target.appendChild(el('path', {
        d: trunk,
        fill: 'none',
        stroke: '#06050d',
        'stroke-width': Math.max(1.8, h * 0.028).toFixed(1),
        'stroke-linecap': 'round'
      }));
      /* лунная кромка: без неё ствол полностью сливался с небом */
      target.appendChild(el('path', {
        d: trunk,
        fill: 'none',
        stroke: 'rgba(168, 156, 208, 0.3)',
        'stroke-width': Math.max(0.9, h * 0.008).toFixed(1),
        'stroke-linecap': 'round',
        transform: 'translate(1.6,0)'
      }));

      var frag = document.createDocumentFragment();
      for (i = 0; i < 8; i++) {
        var t = 0.2 + (i / 8) * 0.74;
        var by = baseY - h * t;
        var bx = x - h * 0.04 * t;
        var dir = i % 2 ? 1 : -1;
        var len = h * (0.46 - t * 0.24);
        var jj = ((i * 71 + seed * 13) % 97) / 97;
        frag.appendChild(el('path', {
          d: 'M' + bx.toFixed(1) + ' ' + by.toFixed(1) +
             ' Q' + (bx + dir * len * 0.6).toFixed(1) + ' ' + (by - len * (0.22 + jj * 0.2)).toFixed(1) +
             ' ' + (bx + dir * len).toFixed(1) + ' ' + (by - len * (0.5 + jj * 0.42)).toFixed(1) +
             ' M' + (bx + dir * len * 0.62).toFixed(1) + ' ' + (by - len * 0.32).toFixed(1) +
             ' L' + (bx + dir * len * 0.9).toFixed(1) + ' ' + (by - len * 0.95).toFixed(1),
          fill: 'none',
          stroke: '#06050d',
          'stroke-width': Math.max(1.1, h * 0.017 * (1 - t * 0.55)).toFixed(1),
          'stroke-linecap': 'round'
        }));
      }
      target.appendChild(frag);
    }

    function grave(target, x, baseY, w, h, tilt) {
      if (!target) return;
      var g = el('g', {
        transform: 'translate(' + x.toFixed(1) + ',' + baseY.toFixed(1) + ') rotate(' + (tilt * 57.3).toFixed(1) + ')'
      });
      g.appendChild(el('path', {
        d: 'M' + (-w / 2) + ',0 L' + (-w / 2) + ',' + (-h + w * 0.5) +
           ' A' + (w / 2) + ',' + (w / 2) + ' 0 0 1 ' + (w / 2) + ',' + (-h + w * 0.5) +
           ' L' + (w / 2) + ',0 Z',
        fill: '#08070f'
      }));
      g.appendChild(el('path', {
        d: 'M' + (-w / 2) + ',0 L' + (-w / 2) + ',' + (-h + w * 0.5) +
           ' A' + (w / 2) + ',' + (w / 2) + ' 0 0 1 0,' + (-h + w * 0.5) + ' Z',
        fill: 'rgba(178,168,214,0.07)'
      }));
      g.appendChild(el('rect', {
        x: -w / 2 + w * 0.18, y: -h + w * 0.62, width: w * 0.64, height: 2.4,
        fill: 'rgba(200,190,232,0.12)'
      }));
      g.appendChild(el('rect', {
        x: -w / 2 + w * 0.18, y: -h + w * 0.8, width: w * 0.64, height: 2.4,
        fill: 'rgba(200,190,232,0.12)'
      }));
      target.appendChild(g);
    }

    function buildYard() {
      var farS = HW.$('#yard-far-svg');
      var nearS = HW.$('#yard-near-svg');
      var groundS = HW.$('#yard-ground-svg');
      if (!farS || !nearS || !groundS) return;

      farS.setAttribute('viewBox', '0 0 ' + YARD.w + ' ' + YARD.hFar);
      nearS.setAttribute('viewBox', '0 0 ' + YARD.w + ' ' + YARD.hNear);

      var pf = HW.$('#yard-pines-far');
      if (pf) {
        pf.setAttribute('fill', '#0d0b1a');
        pineRow(pf, YARD.hFar, 26, 158, 26, 11);
      }

      var pn = HW.$('#yard-pines-near');
      if (pn) {
        pn.setAttribute('fill', '#07060e');
        pineRow(pn, YARD.hNear, 15, 196, 34, 37);
      }

      var tr = HW.$('#yard-tree');
      if (tr) {
        tr.textContent = '';
        /* деревья крупнее и их больше: раньше два тонких силуэта по краям
           читались как случайные палки на фоне.
           Важно: #yard-near-svg использует preserveAspectRatio="xMidYMax slice",
           на узких экранах видимая зона viewBox сужается примерно до
           x ∈ [0.18·W, 0.82·W] — крайние деревья обрезались и «висели».
           Поэтому координаты держим внутри этой зоны. */
        bareTree(tr, YARD.w * 0.20, YARD.hNear, 306, 3);
        bareTree(tr, YARD.w * 0.80, YARD.hNear, 268, 5);
        bareTree(tr, YARD.w * 0.42, YARD.hNear, 184, 7);
        bareTree(tr, YARD.w * 0.62, YARD.hNear, 202, 11);
      }

      var gr = HW.$('#yard-graves');
      if (gr) {
        gr.textContent = '';
        [
          { x: 0.075, w: 58, h: 104, t: -0.04 },
          { x: 0.155, w: 42, h: 76, t: 0.05 },
          { x: 0.235, w: 34, h: 62, t: -0.02 },
          { x: 0.315, w: 30, h: 54, t: 0.03 },
          { x: 0.700, w: 32, h: 58, t: -0.03 },
          { x: 0.775, w: 44, h: 84, t: 0.04 },
          { x: 0.855, w: 52, h: 96, t: -0.05 },
          { x: 0.935, w: 38, h: 70, t: 0.02 }
        ].forEach(function (v) {
          grave(gr, YARD.w * v.x, YARD.hNear - 6, v.w, v.h, v.t);
        });
      }

      var earth = HW.$('#yard-earth');
      var blades = HW.$('#yard-blades');
      var W = window.innerWidth;
      var H = Math.max(140, Math.round(window.innerHeight * 0.15));
      groundS.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
      if (earth) {
        earth.textContent = '';
        earth.appendChild(el('path', {
          d: 'M0,' + H + ' L0,' + (H * 0.5).toFixed(0) +
             ' C' + (W * 0.2).toFixed(0) + ',' + (H * 0.3).toFixed(0) +
             ' ' + (W * 0.32).toFixed(0) + ',' + (H * 0.72).toFixed(0) +
             ' ' + (W * 0.55).toFixed(0) + ',' + (H * 0.5).toFixed(0) +
             ' C' + (W * 0.78).toFixed(0) + ',' + (H * 0.28).toFixed(0) +
             ' ' + (W * 0.9).toFixed(0) + ',' + (H * 0.66).toFixed(0) +
             ' ' + W + ',' + (H * 0.44).toFixed(0) +
             ' L' + W + ',' + (H + 60) + ' Z',
          fill: '#040309'
        }));
      }
      if (blades) {
        blades.textContent = '';
        var n = Math.max(24, Math.round(W / 16));
        var frag = document.createDocumentFragment();
        for (var i = 0; i < n; i++) {
          var gx = (i / n) * W + rnd(-5, 5);
          var gTop = H * (0.42 + rnd(-0.06, 0.06));
          var bh = rnd(12, H * 0.42);
          var lean = rnd(-13, 13);
          frag.appendChild(el('path', {
            d: 'M' + gx.toFixed(1) + ',' + H +
               ' Q' + (gx + lean * 0.5).toFixed(1) + ',' + (gTop + bh * 0.5).toFixed(1) +
               ' ' + (gx + lean).toFixed(1) + ',' + (gTop + bh).toFixed(1),
            fill: 'none',
            stroke: '#030206',
            'stroke-width': rnd(1.2, 2.8).toFixed(1),
            'stroke-linecap': 'round',
            opacity: rnd(0.5, 1).toFixed(2)
          }));
        }
        blades.appendChild(frag);
      }
    }

    var yardTimer = null;
    buildYard();
    window.addEventListener('resize', function () {
      clearTimeout(yardTimer);
      yardTimer = global.setTimeout(buildYard, 160);
    }, { passive: true });
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { clearTimeout(yardTimer); yardTimer = global.setTimeout(buildYard, 60); });
    }

    function center(node) {
      var r = node.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }

    function fitLetter(silent) {
      var vh = global.innerHeight;
      if (!vh) return;

      var act = actions && !actions.hidden ? actions.getBoundingClientRect().height : 0;
      var bottomLimit = vh - (act ? act + 22 : 96);
      var topRoom = Math.max(66, vh * 0.085);
      var avail = bottomLimit - topRoom;

      var prevT = paper.style.transform;
      var prevT2 = letter.style.transform;
      var prevTr = paper.style.transition;
      var prevTr2 = letter.style.transition;

      paper.style.transition = 'none';
      letter.style.transition = 'none';
      paper.style.transform = 'none';
      letter.style.transform = 'none';

      var r = paper.getBoundingClientRect();
      var curH = r.height;

      paper.style.transform = prevT;
      letter.style.transform = prevT2;
      paper.style.transition = prevTr;
      letter.style.transition = prevTr2;

      if (!curH) return;

      var s = Math.min(1, avail / curH);
      /* на портретном телефоне не мельчим письмо до марки: лучше пусть
         страница прокрутится, чем текст шириной в 200 px. Пол зависит от
         узости экрана: телефонам (≈2.16:1) нужен высокий пол, планшетам
         (≈1.33:1) — ниже, иначе крупное письмо наезжает на кнопки.
         В альбоме пол низкий — там высота кадра и так мала */
      var portrait = vh > global.innerWidth;
      /* телефонам (≈2.16:1) нужен высокий пол, но не максимальный — иначе
         письмо вытягивается в узкую ленту-«чек» и не помещается на экран.
         0.72 → 0.66: чуть компактнее, при этом текст остаётся читаемым */
      var floor = portrait ? Math.min(0.66, Math.max(0.34, (vh / global.innerWidth) * 0.38)) : 0.34;
      if (s < floor) s = floor;

      var visH = s * curH;
      var t = topRoom - r.bottom + visH;

      var docNeed = Math.max(vh, topRoom + visH + (act ? act + 22 : 0));

      var curLt = parseFloat(getComputedStyle(letter).getPropertyValue('--lt'));
      var curLs = parseFloat(getComputedStyle(letter).getPropertyValue('--ls'));
      var moved = !(Math.abs((curLt || 0) - t) < 1.5 && Math.abs((curLs || 1) - s) < 0.01);
      if (!moved) return;

      document.documentElement.style.setProperty('--cd-doc', Math.ceil(docNeed) + 'px');

      if (silent) {
        letter.classList.add('is-fitting');
        letter.style.setProperty('--lt', t.toFixed(1) + 'px');
        letter.style.setProperty('--ls', s.toFixed(4));
        global.requestAnimationFrame(function () {
          global.requestAnimationFrame(function () {
            letter.classList.remove('is-fitting');
          });
        });
      } else {
        letter.style.setProperty('--lt', t.toFixed(1) + 'px');
        letter.style.setProperty('--ls', s.toFixed(4));
      }
    }

    function burstAt(node, opts) {
      if (!scene.parts || !scene.parts.burst) return;
      var c = center(node);
      scene.parts.burst(c.x, c.y, opts);
    }

    function raiseLetter() {
      if (letterRaised) return;
      letterRaised = true;
      fitLetter();
      global.requestAnimationFrame(function () {
        global.requestAnimationFrame(function () {
          letter.classList.remove('is-locked');
          global.setTimeout(function () {
            if (opened) fitLetter(true);
          }, 80);
        });
      });
    }

    function open() {
      if (opened) return;
      opened = true;
      letterRaised = false;
      letter.classList.add('is-locked');

      if (actions) { actions.hidden = false; }
      body.classList.add('is-open');
      env.setAttribute('aria-expanded', 'true');

      void body.offsetWidth;

      burstAt(env, { count: 34, color: 'warm', speed: [50, 240], r: [1.2, 3.8] });
      global.setTimeout(function () {
        if (opened) burstAt(env, { count: 20, color: 'blue', speed: [30, 150], r: [1, 2.6] });
      }, 240);

      if (flash) {
        flash.classList.remove('is-on');
        void flash.offsetWidth;
        flash.classList.add('is-on');
      }

      if (seal && !reduced) {
        seal.classList.remove('is-crack');
        void seal.offsetWidth;
        seal.classList.add('is-crack');
      }

      if (scene.fog && scene.fog.setFog) scene.fog.setFog(0.34);

      /* the letter stays pinned in its tucked position until the webfont has
         landed, so the rise is measured once, at final size, and the transform
         animates exactly once with no mid-flight correction */
      var go = function () {
        if (opened) raiseLetter();
      };
      if (document.fonts && document.fonts.status !== 'loaded' && document.fonts.ready) {
        document.fonts.ready.then(go, go);
        global.setTimeout(go, 450);
      } else {
        go();
      }

      clearTimeout(lockTimer);
      lockTimer = global.setTimeout(function () {
        if (paper && paper.focus) {
          paper.setAttribute('tabindex', '-1');
          try { paper.focus({ preventScroll: true }); } catch (e) { paper.focus(); }
        }
      }, reduced ? 40 : 1500);
    }

    function close() {
      opened = false;
      global.clearTimeout(crackTimer);
      body.classList.remove('is-open');
      letter.classList.remove('is-locked');
      letterRaised = false;
      env.setAttribute('aria-expanded', 'false');
      if (actions) actions.hidden = true;

      /* both keyframes end on opacity 0 with `forwards`, so leaving the class
         on would keep the wax seal and the light burst hidden for good —
         "открыть заново" has to hand back a sealed envelope */
      if (seal) { seal.classList.remove('is-crack'); seal.classList.remove('is-nope'); }
      if (flash) { flash.classList.remove('is-on'); }

      if (scene.fog && scene.fog.setFog) scene.fog.setFog(0.58);
      clearTimeout(lockTimer);
    }

    function reset() {
      close();
      global.setTimeout(function () {
        if (env.focus) env.focus({ preventScroll: true });
      }, reduced ? 40 : 220);
    }

    env.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('.seal')) return;
      open();
    });

    env.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        open();
      }
    });

    if (seal) {
      seal.addEventListener('click', function (e) {
        e.stopPropagation();
        if (opened) return;
        global.clearTimeout(crackTimer);
        seal.classList.remove('is-nope');
        void seal.offsetWidth;
        seal.classList.add('is-nope');
        burstAt(seal, { count: 12, color: 'green', speed: [30, 110], r: [1, 2.4], life: [0.4, 0.9] });
        crackTimer = global.setTimeout(function () {
          seal.classList.remove('is-nope');
          if (!opened) open();
        }, 430);
      });
    }

    if (reopen) reopen.addEventListener('click', reset);

    global.addEventListener('keydown', function (e) {
      if (opened && e.key === 'Escape') {
        e.preventDefault();
        reset();
      }
    });

    global.addEventListener('resize', HW.rafThrottle(function () {
      if (opened) fitLetter(true);
    }), { passive: true });
    global.addEventListener('orientationchange', function () {
      if (opened) global.setTimeout(function () { fitLetter(true); }, 300);
    }, { passive: true });

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { if (opened) fitLetter(true); });
    }
  });
})(window);