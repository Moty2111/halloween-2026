/* ===== index.js · Сцена «Врата» ===== */
(function (global) {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';

  HW.ready(function () {
    var scene = HW.scene({
      moon: [0.755, 0.82],
      fogGain: 0.74,
      rayGain: 0.36,
      particles: { embers: 46, fireflies: 15, bats: 9, leaves: 11 }
    });
    HW.transitions();
    HW.markNav('index');

    /* ── интро ── */
    var doc = document.documentElement;
    var curtain = HW.$('#introCurtain');
    var hasIntro = doc.classList.contains('is-intro');
    var finishTimer = null;

    HW.reveal();

    function endIntro() {
      clearTimeout(finishTimer);
      finishTimer = null;
      doc.classList.remove('is-intro');
      doc.classList.remove('is-intro-fast');
    }

    if (hasIntro) {
      try { sessionStorage.setItem('hw.intro.seen', '1'); } catch (e) {}

      var onSkipInput = function () {
        doc.classList.add('is-intro-fast');
        endIntro();
        window.removeEventListener('pointerdown', onSkipInput);
        window.removeEventListener('keydown', onSkipInput);
      };

      window.addEventListener('pointerdown', onSkipInput);
      window.addEventListener('keydown', onSkipInput);
      finishTimer = setTimeout(endIntro, 1650);

      /* страховка: если tab был свёрнут и таймер не сработал */
      document.addEventListener('visibilitychange', function () {
        if (!document.hidden) endIntro();
      });
    }

    /* клик по фонарям и тыквам работает и во время интро */
    function rnd(a, b) { return a + Math.random() * (b - a); }
    function el(tag, attrs) {
      var n = document.createElementNS(NS, tag);
      for (var k in attrs) if (attrs[k] != null) n.setAttribute(k, attrs[k]);
      return n;
    }

    /* ─────────── дальний лес ─────────── */
    function pinePath(x, baseY, h, w) {
      return [
        'M', x, baseY,
        'L', x - w, baseY,
        'L', x - w * 0.56, baseY - h * 0.30,
        'L', x - w * 0.80, baseY - h * 0.30,
        'L', x - w * 0.44, baseY - h * 0.58,
        'L', x - w * 0.64, baseY - h * 0.58,
        'L', x - w * 0.22, baseY - h * 0.84,
        'L', x, baseY - h,
        'L', x + w * 0.22, baseY - h * 0.84,
        'L', x + w * 0.64, baseY - h * 0.58,
        'L', x + w * 0.44, baseY - h * 0.58,
        'L', x + w * 0.80, baseY - h * 0.30,
        'L', x + w * 0.56, baseY - h * 0.30,
        'L', x + w, baseY,
        'Z'
      ].join(' ');
    }

    function fillPines(target, count, opts) {
      if (!target) return;
      var frag = document.createDocumentFragment();
      for (var i = 0; i < count; i++) {
        var x = -40 + (1520 / count) * i + rnd(-26, 26);
        var h = opts.h * rnd(0.62, 1.25);
        var w = h * rnd(0.26, 0.38);
        frag.appendChild(el('path', {
          d: pinePath(x, opts.baseY, h, w),
          fill: opts.fill,
          opacity: rnd(0.7, 1).toFixed(2)
        }));
        if (opts.trunk) {
          frag.appendChild(el('rect', {
            x: (x - w * 0.07).toFixed(1), y: opts.baseY,
            width: (w * 0.14).toFixed(1), height: opts.trunk,
            fill: opts.fill
          }));
        }
      }
      target.textContent = '';
      target.appendChild(frag);
    }

    fillPines(HW.$('#pine-far'), 46, { h: 190, baseY: 420, fill: '#0c0a18' });
    fillPines(HW.$('#pine-mid'), 22, { h: 250, baseY: 380, fill: '#07060f', trunk: 22 });

    /* ─────────── прутья ворот ─────────── */
    (function buildBars() {
      var g = HW.$('#gate-bars');
      if (!g) return;
      var frag = document.createDocumentFragment();
      var cx = 400, rx = 314, cy = 214, ry = 162;
      var n = 17;
      var i, x, ay;

      for (i = 1; i <= n; i++) {
        x = 86 + (628 / (n + 1)) * i;
        var k = (x - cx) / rx;
        ay = cy - ry * Math.sqrt(Math.max(0, 1 - k * k));

        frag.appendChild(el('path', {
          d: 'M' + x + ' ' + (ay + 4).toFixed(1) + ' L' + x + ' 560',
          stroke: '#2b2440',
          'stroke-width': 5,
          'stroke-linecap': 'round'
        }));
        frag.appendChild(el('path', {
          d: 'M' + x + ' ' + (ay + 4).toFixed(1) + ' L' + x + ' 560',
          stroke: '#7a6ea8',
          'stroke-width': 1.5,
          'stroke-opacity': 0.6
        }));
        frag.appendChild(el('path', {
          d: 'M' + x + ' ' + (ay + 6).toFixed(1) + ' L' + (x - 5) + ' ' + (ay - 16).toFixed(1) +
             ' L' + (x + 5) + ' ' + (ay - 16).toFixed(1) + ' Z',
          fill: '#3a3256'
        }));
        frag.appendChild(el('circle', {
          cx: x, cy: (ay - 19).toFixed(1), r: 2.6,
          fill: '#cfc6ea', 'fill-opacity': 0.5
        }));
      }

      [318, 486].forEach(function (y) {
        frag.appendChild(el('path', {
          d: 'M96 ' + y + ' H704',
          stroke: '#2b2440', 'stroke-width': 7, 'stroke-linecap': 'round'
        }));
        frag.appendChild(el('path', {
          d: 'M96 ' + (y - 2) + ' H704',
          stroke: '#7a6ea8', 'stroke-width': 1.5, 'stroke-opacity': 0.5
        }));
      });

      g.textContent = '';
      g.appendChild(frag);
    })();

    /* ─────────── передний план (пиксельные координаты) ─────────── */
    var groundY = function (H, x, W) {
      var a = H * 0.055;
      return H * 0.78
        + Math.sin(x / (W / 3.4) + 1.1) * a * 0.55
        + Math.sin(x / (W / 9) + 3.4) * a * 0.4;
    };

    /* ── кот на земле: силуэт, когти и раскалённые глаза ── */
    function groundCat(x, y, s, flip) {
      var g = el('g', {
        class: 'ground-cat',
        transform: 'translate(' + x.toFixed(1) + ',' + y.toFixed(1) + ') scale(' +
                   (s * (flip ? -1 : 1)).toFixed(3) + ',' + s.toFixed(3) + ')'
      });
      g.innerHTML =
        '<ellipse cx="2" cy="3" rx="40" ry="8" fill="#020107" opacity="0.6" filter="url(#catGlow)"/>' +
        /* хвост: длинный, загнут кверху */
        '<path d="M26,18 C48,16 60,-2 52,-22 C58,-6 52,10 40,14 C50,4 54,-6 52,-16 ' +
          'C62,2 54,22 34,26 Z" fill="#241f3e"/>' +
        '<g fill="#241f3e">' +
          /* уши острые, с внутренним ухом -->
          '<path d="M-19,-36 L-24,-62 L-4,-45 Z"/>' +
          '<path d="M17,-36 L23,-62 L3,-45 Z"/>' +
          '<path d="M-17,-41 L-20,-55 L-9,-45 Z" fill="#3a2a5e"/>' +
          '<path d="M15,-41 L19,-55 L8,-45 Z" fill="#3a2a5e"/>' +
          /* голова шире, скулы */
          '<path d="M-24,-30 C-24,-42 -14,-49 0,-49 C14,-49 24,-42 24,-30 ' +
            'C24,-20 15,-14 0,-14 C-15,-14 -24,-20 -24,-30 Z"/>' +
          /* корпус: грудь, поджарые бока, задница */
          '<path d="M-6,-16 C-22,-14 -31,2 -30,20 C-29,36 -18,45 0,45 ' +
            'C18,45 29,36 30,20 C31,2 22,-14 6,-16 Z"/>' +
          /* передние лапы с когтями -->
          '<path d="M-17,16 L-16,44 L-5,44 L-5,20 Z"/>' +
          '<path d="M6,16 L6,44 L17,44 L18,20 Z"/>' +
          '<path d="M-16,44 l-3,7 M-11,44 l-1,7 M-6,44 l1,7 ' +
            'M6,44 l-1,7 M11,44 l2,7 M16,44 l3,7" fill="none" ' +
            'stroke="#e5dcff" stroke-opacity="0.5" stroke-width="1.5" stroke-linecap="round"/>' +
        '</g>' +
        /* тень снизу и грудь */
        '<g fill="#141129">' +
          '<path d="M-24,32 C-11,43 12,43 25,31 C12,39 -11,39 -24,32 Z"/>' +
          '<path d="M-13,-12 C-8,2 -6,14 -8,26 L8,26 C6,14 8,2 13,-12 Z" opacity="0.55"/>' +
        '</g>' +
        /* лунный контур: голова, спина, хвост */
        '<g fill="none" stroke="#a79bd8" stroke-linecap="round">' +
          '<path d="M-22,-41 C-27,-49 -24,-59 -20,-60 C-17,-56 -19,-48 -20,-46" ' +
            'stroke-opacity="0.55" stroke-width="1.8"/>' +
          '<path d="M18,-41 C22,-49 20,-59 17,-60 C14,-56 16,-48 17,-46" ' +
            'stroke-opacity="0.3" stroke-width="1.6"/>' +
          '<path d="M-29,17 C-31,1 -24,-11 -10,-15" stroke-opacity="0.5" stroke-width="1.8"/>' +
          '<path d="M30,17 C34,4 33,-6 29,-13" stroke-opacity="0.28" stroke-width="1.6"/>' +
          '<path d="M52,-20 C59,-4 52,14 36,21" stroke-opacity="0.34" stroke-width="1.6"/>' +
        '</g>' +
        /* пасть: чуть приоткрыта, с клыками */
        '<path d="M-9,-19 C-4,-15 5,-15 10,-19 C6,-13 -4,-13 -9,-19 Z" fill="#0a0716"/>' +
        '<path d="M-6,-16 l1.6,4 l1.6,-4 Z" fill="#efe8ff" opacity="0.85"/>' +
        '<path d="M4,-16 l1.4,3.4 l1.4,-3.4 Z" fill="#efe8ff" opacity="0.7"/>' +
        /* глаза: ядро, ореол, вертикальный зрачок, блик */
        '<g filter="url(#catGlow)">' +
          '<ellipse cx="-9" cy="-31" rx="10" ry="7" fill="#ff7a10" opacity="0.72"/>' +
          '<ellipse cx="10" cy="-31" rx="10" ry="7" fill="#ff7a10" opacity="0.72"/>' +
        '</g>' +
        '<ellipse cx="-9" cy="-31" rx="5.8" ry="4.2" fill="#ffc46a"/>' +
        '<ellipse cx="10" cy="-31" rx="5.8" ry="4.2" fill="#ffc46a"/>' +
        '<ellipse cx="-9" cy="-31" rx="2.1" ry="4" fill="#1a0d00"/>' +
        '<ellipse cx="10" cy="-31" rx="2.1" ry="4" fill="#1a0d00"/>' +
        '<ellipse cx="-10.8" cy="-32.8" rx="1.4" ry="1.1" fill="#fff4dc" opacity="0.92"/>' +
        '<ellipse cx="8.2" cy="-32.8" rx="1.4" ry="1.1" fill="#fff4dc" opacity="0.92"/>';
      return g;
    }

    function buildFore() {
      var svg = HW.$('#fore-svg');
      var ground = HW.$('#fore-ground');
      var grass = HW.$('#grass');
      var pump = HW.$('#fore-pumpkins');
      if (!svg || !ground) return;

      var W = svg.clientWidth || window.innerWidth;
      var H = svg.clientHeight || Math.round(window.innerHeight * 0.32);
      svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);

      var horizon = H * 0.78;
      var amp = H * 0.055;

      /* ── земля: поверхность собирается в точки, из них строятся все слои ── */
      var step = Math.max(40, W / 22);
      var surf = [];
      for (var sx = 0; sx <= W + step; sx += step) {
        surf.push([Math.min(sx, W), groundY(H, Math.min(sx, W), W)]);
      }
      if (surf[surf.length - 1][0] !== W) surf.push([W, groundY(H, W, W)]);

      /* линия поверхности */
      var lineD = 'M' + surf.map(function (pt) {
        return pt[0].toFixed(1) + ' ' + pt[1].toFixed(1);
      }).join(' L');

      /* поверхность + замыкание на низ кадра.
         Замыкаем с запасом: svg не клипует (svg{overflow:visible}), и если
         документ окажется длиннее окна, земля перекрывает и этот край. */
      var BELOW = 120;
      var earthD = lineD + ' L' + W + ' ' + (H + BELOW) + ' L0 ' + (H + BELOW) + ' Z';

      /* дёрн: узкая полоса вдоль кромки, а не заливка всей земли */
      var band = Math.max(7, H * 0.035);
      var turfD = lineD + ' L' + W + ' ' + (H + BELOW);
      for (var si = surf.length - 1; si >= 0; si--) {
        turfD += ' L' + surf[si][0].toFixed(1) + ' ' + (surf[si][1] + band).toFixed(1);
      }
      turfD += ' Z';

      var gf = document.createDocumentFragment();

      /* тело земли */
      gf.appendChild(el('path', { d: earthD, fill: '#0b0916' }));

      /* вытоптанная дорожка от ворот */
      var pathL = [], pathR = [];
      for (var pi = 0; pi <= 12; pi++) {
        var pt2 = pi / 12;
        var py2 = H * 0.83 + pt2 * H * 0.17;
        var halfw = W * (0.03 + pt2 * 0.085);
        pathL.push('L' + (W * 0.5 - halfw).toFixed(1) + ' ' + py2.toFixed(1));
        pathR.unshift('L' + (W * 0.5 + halfw).toFixed(1) + ' ' + py2.toFixed(1));
      }
      gf.appendChild(el('path', {
        d: ['M' + (W * 0.5).toFixed(1) + ' ' + (H * 0.83).toFixed(1)].concat(pathL).concat(pathR).join(' ') + ' Z',
        fill: '#241f45',
        opacity: '0.9'
      }));

      /* дёрн по кромке */
      gf.appendChild(el('path', { d: turfD, fill: '#1b1633' }));
      gf.appendChild(el('path', {
        d: lineD, fill: 'none', stroke: '#8a7fc4', 'stroke-opacity': '0.34',
        'stroke-width': '1.5', 'stroke-linejoin': 'round'
      }));

      /* камешки в земле */
      var stones = document.createDocumentFragment();
      var sn = Math.max(14, Math.round(W / 85));
      for (var st = 0; st < sn; st++) {
        var stx = rnd(0, W);
        var sty = groundY(H, stx, W) + band + rnd(2, Math.max(8, H - groundY(H, stx, W) - band));
        var sr = rnd(1.5, 4.4);
        stones.appendChild(el('ellipse', {
          cx: stx.toFixed(1), cy: sty.toFixed(1), rx: sr.toFixed(1), ry: (sr * 0.62).toFixed(1),
          fill: '#2e2750', opacity: rnd(0.45, 1).toFixed(2)
        }));
      }
      gf.appendChild(stones);

      ground.textContent = '';
      ground.appendChild(gf);

      /* ── трава ── */
      var blades = Math.round(W / 11);
      var gg = document.createDocumentFragment();
      for (var i = 0; i < blades; i++) {
        var bx = (W / blades) * i + rnd(-4, 4);
        var gy = groundY(H, bx, W);
        var bh = rnd(12, H * 0.42);
        var lean = rnd(-14, 14);
        gg.appendChild(el('path', {
          d: 'M' + bx.toFixed(1) + ' ' + (gy + 6).toFixed(1) +
             ' Q' + (bx + lean * 0.5).toFixed(1) + ' ' + (gy - bh * 0.6).toFixed(1) +
             ' ' + (bx + lean).toFixed(1) + ' ' + (gy - bh).toFixed(1),
          fill: 'none',
          stroke: '#04030a',
          'stroke-width': rnd(1.4, 3.2).toFixed(1),
          'stroke-linecap': 'round',
          opacity: rnd(0.55, 1).toFixed(2)
        }));
      }
      if (grass) { grass.textContent = ''; grass.appendChild(gg); }

      /* тыквы переднего плана */
      if (pump) {
        var pf = document.createDocumentFragment();
        var defs = el('defs');
        defs.innerHTML =
          '<linearGradient id="pumpGrad" x1="0" y1="0" x2="0" y2="1">' +
            '<stop offset="0" stop-color="#ffa63c"/>' +
            '<stop offset="0.55" stop-color="#f3700d"/>' +
            '<stop offset="1" stop-color="#a83c05"/>' +
          '</linearGradient>' +
          '<radialGradient id="pumpHalo" cx="0.5" cy="0.5" r="0.5">' +
            '<stop offset="0" stop-color="#ff8a1e" stop-opacity="0.5"/>' +
            '<stop offset="0.5" stop-color="#ff8a1e" stop-opacity="0.16"/>' +
            '<stop offset="1" stop-color="#ff8a1e" stop-opacity="0"/>' +
          '</radialGradient>' +
          '<filter id="faceGlow" x="-60%" y="-60%" width="220%" height="220%">' +
            '<feGaussianBlur stdDeviation="3.4"/>' +
          '</filter>' +
          '<filter id="catGlow" x="-90%" y="-90%" width="280%" height="280%">' +
            '<feGaussianBlur stdDeviation="5"/>' +
          '</filter>';
        pf.appendChild(defs);

        var body =
          '<ellipse cx="50" cy="54" rx="96" ry="92" fill="url(#pumpHalo)"/>' +
          '<path d="M50,28 C30,10 5,23 5,51 C5,78 26,91 50,91 C74,91 95,78 95,51 C95,23 70,10 50,28 Z" fill="url(#pumpGrad)"/>' +
          '<path d="M50,28 C30,10 5,23 5,51 C5,78 26,91 50,91 C74,91 95,78 95,51 C95,23 70,10 50,28 Z" fill="#ffd9a0" opacity="0.12"/>' +
          '<g fill="none" stroke="#8c2f03" stroke-opacity="0.4" stroke-width="2.2" stroke-linecap="round">' +
            '<path d="M29,20 C20,42 21,70 31,89"/>' +
            '<path d="M71,20 C80,42 79,70 69,89"/>' +
            '<path d="M50,29 C46,48 46,74 50,90"/>' +
          '</g>' +
          '<path d="M50,28 C47,17 52,9 62,4 L67,10 C59,15 55,20 56,28 Z" fill="#4e6132"/>' +
          '<path d="M54,26 C52,18 56,12 64,8" fill="none" stroke="#7c8f52" stroke-width="1.6" stroke-opacity="0.5"/>';
        var face =
          '<path d="M24,45 L40,38 L33,55 Z"/>' +
          '<path d="M76,45 L60,38 L67,55 Z"/>' +
          '<path d="M44,59 L56,59 L50,68 Z"/>' +
          '<path d="M21,71 L31,64 L38,73 L46,66 L54,75 L62,66 L69,73 L76,64 L86,71 L79,82 L68,77 L58,86 L50,79 L41,86 L31,77 Z"/>';

        /* точки задаются долей глубины от кромки земли до низа, а не долей svg:
           иначе после подъёма линии земли тыквы остались бы в воздухе */
        var spots = [
          { x: 0.040, below: 0.34, s: 1.55, flip: 1 },
          { x: 0.300, below: 0.46, s: 0.70, flip: -1 },
          { x: 0.425, below: 0.10, s: 0.62, flip: 1 },
          { x: 0.640, below: 0.52, s: 0.70, flip: -1 },
          { x: 0.775, below: 0.14, s: 1.02, flip: 1 },
          { x: 0.875, below: 0.40, s: 1.42, flip: -1 },
          { x: 0.955, below: 0.05, s: 0.72, flip: 1 }
        ];

        spots.forEach(function (sp) {
          var size = Math.min(W * 0.062, H * 0.44) * sp.s;
          var px = W * sp.x;
          var gy = groundY(H, px, W);
          var ty = gy + (H - gy) * sp.below - size * 0.91;
          var gEl = el('g', {
            class: 'fp-pumpkin',
            transform: 'translate(' + px.toFixed(0) + ',' + ty.toFixed(0) +
                       ') scale(' + ((size / 100) * sp.flip).toFixed(4) + ',' + (size / 100).toFixed(4) + ')',
            tabindex: '0',
            role: 'button',
            'aria-label': 'Тыква — зажги'
          });
          gEl.innerHTML =
            body +
            '<g class="face" fill="#ff9c2e" filter="url(#faceGlow)" opacity="0.75">' + face + '</g>' +
            '<g class="face" fill="#3c1400">' + face + '</g>';
          pf.appendChild(gEl);
        });

        pump.textContent = '';
        pump.appendChild(pf);
      }

      /* ── кот: слева от ворот, на чистом грунте, развёрнут в сторону зрителя ── */
      var catLayer = HW.$('#ground-cat-layer');
      if (catLayer) {
        catLayer.textContent = '';
        var catX = W * 0.165;
        var catS = Math.min(W * 0.0021, H * 0.0058);
        catLayer.appendChild(groundCat(catX, groundY(H, catX, W) + 4, catS, false));
      }
    }

    buildFore();

    var resizeTimer = null;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(buildFore, 140);
    }, { passive: true });
    window.addEventListener('orientationchange', function () {
      setTimeout(buildFore, 320);
    }, { passive: true });

    /* ─────────── реакция на прикосновение ─────────── */
    function flare(node, color) {
      var r = node.getBoundingClientRect();
      var cx = r.left + r.width / 2;
      var cy = r.top + r.height / 2;
      if (scene.parts && scene.parts.burst) {
        scene.parts.burst(cx, cy, { count: 30, color: color || 'warm', speed: [40, 210], r: [1, 3.6] });
      }
      node.classList.add('is-lit');
      clearTimeout(node._hwT);
      node._hwT = setTimeout(function () { node.classList.remove('is-lit'); }, 900);
    }

    HW.$$('[data-lantern]').forEach(function (b) {
      b.addEventListener('click', function () { flare(b, 'warm'); });
      b.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
          e.preventDefault();
          flare(b, 'warm');
        }
      });
    });

    document.addEventListener('click', function (e) {
      var p = e.target.closest ? e.target.closest('.fp-pumpkin') : null;
      if (p) flare(p, 'warm');
    });
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
      var a = document.activeElement;
      if (a && a.classList && a.classList.contains('fp-pumpkin')) {
        e.preventDefault();
        flare(a, 'warm');
      }
    });

    /* ─────────── лёгкое дыхание ворот ─────────── */
    var gate = HW.$('.gate');
    if (gate && !HW.reduced) {
      var gx = 0, gy = 0, cx2 = 0, cy2 = 0, raf = 0;
      function loop(t) {
        cx2 += (gx - cx2) * 0.05;
        cy2 += (gy - cy2) * 0.05;
        var t2 = t * 0.0004;
        var s = 1 + Math.sin(t2) * 0.0016;
        gate.style.transform = 'perspective(1400px) rotateX(' + (cy2 * 1.6 - 0.6).toFixed(2) +
                               'deg) rotateY(' + (cx2 * -2.2).toFixed(2) + 'deg) scale(' + s.toFixed(4) + ')';
        raf = requestAnimationFrame(loop);
      }
      window.addEventListener('pointermove', function (e) {
        gx = e.clientX / window.innerWidth - 0.5;
        gy = e.clientY / window.innerHeight - 0.5;
      }, { passive: true });
      raf = requestAnimationFrame(loop);
      document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'hidden') { cancelAnimationFrame(raf); raf = 0; }
        else if (!raf) raf = requestAnimationFrame(loop);
      });
    }
  });
})(window);