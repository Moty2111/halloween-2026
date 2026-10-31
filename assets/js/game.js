(function (global) {
  'use strict';

  var HW = global.HW;
  if (!HW) return;

  var LW = 960;
  var LH = 600;
  var TAU = Math.PI * 2;
  var ROUND_TIME = 60;
  var STEP_TIME = 8;
  var MAX_LEVEL = 8;
  var LIVES_MAX = 3;
  var GRAV = 1180;
  var GROUND_Y = 586;
  var BK_SCALE = 1;
  var BK_SPR = 156;
  var BK_RIM = 36;
  var BK_DROP = 94;
  var BY = GROUND_Y - BK_DROP * BK_SCALE - 6;
  var CA_Y = LH - 56;
  var WORLD_K = 1;
  var BHW = 50;
  var SLOW_DUR = 0.45;
  var SLOW_MIN = 0.4;
  var KEY_BASE = 720;
  var KEY_SPEED = KEY_BASE;
  var BEST_KEY = 'hw.candycatch.best';
  var ENDLESS_KEY = 'hw.candycatch.endless';
  var MODE_KEY = 'hw.candycatch.mode';

  /* Мир игры. На десктопе — 960×600, на телефоне — вытянутый 620×940:
     с фиксированными 960×600 портретный кадр получался 371×232, и играть
     было нечем. Высота и ширина мира меняются вместе, поэтому круги
     остаются кругами: draw() масштабирует x и y независимо, но отношения
     совпадают с кадром. */
  var PORTRAIT_W = 620;
  var PORTRAIT_H = 940;
  var isPortraitWorld = false;

  var FOG_MIN = 320;
  var FOG_MAX = 548;

  function wantPortraitWorld() {
    var vw = global.innerWidth || 0;
    var vh = global.innerHeight || 0;
    return vw > 0 && vw <= 700 && vh > vw * 1.05;
  }

  /* Пересобирает производные от размера мира константы.
     Возвращает true, если мир действительно сменился. */
  function applyWorld() {
    var p = wantPortraitWorld();
    if (p === isPortraitWorld) return false;
    isPortraitWorld = p;

    if (p) {
      LW = PORTRAIT_W;
      LH = PORTRAIT_H;
      GROUND_Y = LH - 14;
    } else {
      LW = 960;
      LH = 600;
      GROUND_Y = 586;
    }

    BY = GROUND_Y - BK_DROP * BK_SCALE - 6;
    CA_Y = LH - 56;
    FOG_MIN = GROUND_Y - 266;
    FOG_MAX = GROUND_Y - 38;

    /* горизонтальные скорости — в долях ширины мира: в узком мире те же
       пиксели в секунду означали бы вдвое более быструю игру на экране */
    var k = LW / 960;
    KEY_SPEED = KEY_BASE * k;
    WORLD_K = k;

    return true;
  }

  var REDUCED = !!HW.reduced;
  var LOW = !!HW.lowPower;

  var TYPES = {
    pumpkin: { w: 34, r: 23, pts: 10, poison: false, name: 'тыквенная конфета' },
    bat:     { w: 26, r: 22, pts: 15, poison: false, name: 'леденец-летучая мышь' },
    ghost:   { w: 20, r: 24, pts: 20, poison: false, name: 'мармелан-призрак' },
    rat:     { w: 14, r: 22, pts: 0,  poison: true,  name: 'крыса' },
    slime:   { w: 12, r: 23, pts: 0,  poison: true,  name: 'зелёная слизь' }
  };
  var TYPE_KEYS = ['pumpkin', 'bat', 'ghost', 'rat', 'slime'];

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

  function multOf(streak) {
    if (streak >= 7) return 4;
    if (streak >= 5) return 3;
    if (streak >= 3) return 2;
    return 1;
  }

  function makeCanvas(w, h) {
    var c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }

  function makeSprite(fn, size) {
    var s = size || 96;
    var c = makeCanvas(s, s);
    var g = c.getContext('2d');
    if (g) fn(g, s / 2, s / 2);
    return c;
  }

  function halo(g, x, y, r, rgb, a) {
    var gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(' + rgb + ',' + a + ')');
    gr.addColorStop(0.45, 'rgba(' + rgb + ',' + (a * 0.34).toFixed(3) + ')');
    gr.addColorStop(1, 'rgba(' + rgb + ',0)');
    g.fillStyle = gr;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }

  function wing(g, x, y, w, h, f) {
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + w * 0.30, y - h * 0.50 - f * h * 0.80, x + w * 0.60, y - h * 0.20 + f * h * 0.20);
    g.quadraticCurveTo(x + w * 0.84, y + h * 0.04 - f * h * 0.30, x + w, y + h * 0.22 - f * h * 0.40);
    g.quadraticCurveTo(x + w * 0.78, y + h * 0.56 + f * h * 0.10, x + w * 0.54, y + h * 0.32);
    g.quadraticCurveTo(x + w * 0.33, y + h * 0.48, x + w * 0.10, y + h * 0.26);
    g.closePath();
    g.fill();
  }

  function sprPumpkin(g, cx, cy) {
    halo(g, cx, cy, 42, '255,138,30', 0.5);

    g.fillStyle = '#c9550f';
    g.beginPath();
    g.moveTo(cx - 15, cy - 8);
    g.lineTo(cx - 38, cy - 17);
    g.lineTo(cx - 31, cy - 1);
    g.lineTo(cx - 38, cy + 15);
    g.closePath();
    g.fill();
    g.beginPath();
    g.moveTo(cx + 15, cy - 8);
    g.lineTo(cx + 38, cy - 17);
    g.lineTo(cx + 31, cy - 1);
    g.lineTo(cx + 38, cy + 15);
    g.closePath();
    g.fill();

    var stem = g.createLinearGradient(cx, cy - 31, cx, cy - 15);
    stem.addColorStop(0, '#4a3a7a');
    stem.addColorStop(1, '#2b1b57');
    g.fillStyle = stem;
    g.beginPath();
    g.moveTo(cx - 4.5, cy - 15);
    g.lineTo(cx - 3.5, cy - 31);
    g.lineTo(cx + 4.5, cy - 29);
    g.lineTo(cx + 3.5, cy - 15);
    g.closePath();
    g.fill();

    var body = g.createRadialGradient(cx - 8, cy - 9, 2, cx, cy + 3, 27);
    body.addColorStop(0, '#ffd9a0');
    body.addColorStop(0.4, '#ff8a1e');
    body.addColorStop(1, '#9c3706');
    g.fillStyle = body;
    g.beginPath();
    g.ellipse(cx, cy, 21, 19.5, 0, 0, TAU);
    g.fill();

    g.strokeStyle = 'rgba(122,45,4,0.42)';
    g.lineWidth = 1.5;
    var i, dx;
    for (i = 1; i <= 2; i++) {
      dx = i * 7.2;
      g.beginPath();
      g.ellipse(cx, cy, dx, 18.4, 0, Math.PI * 0.16, Math.PI * 0.84);
      g.stroke();
      g.beginPath();
      g.ellipse(cx, cy, dx, 18.4, 0, Math.PI * 1.16, Math.PI * 1.84);
      g.stroke();
    }

    g.fillStyle = '#3a0d02';
    g.beginPath();
    g.moveTo(cx - 12.5, cy - 8);
    g.lineTo(cx - 4, cy - 8);
    g.lineTo(cx - 8.2, cy - 0.5);
    g.closePath();
    g.fill();
    g.beginPath();
    g.moveTo(cx + 4, cy - 8);
    g.lineTo(cx + 12.5, cy - 8);
    g.lineTo(cx + 8.2, cy - 0.5);
    g.closePath();
    g.fill();
    g.beginPath();
    g.moveTo(cx - 12, cy + 3.5);
    g.lineTo(cx - 6.6, cy + 9);
    g.lineTo(cx - 2.2, cy + 3.5);
    g.lineTo(cx + 2.2, cy + 9);
    g.lineTo(cx + 6.6, cy + 3.5);
    g.lineTo(cx + 12, cy + 9);
    g.lineTo(cx + 12, cy + 2.5);
    g.closePath();
    g.fill();

    g.fillStyle = 'rgba(255,255,255,0.3)';
    g.beginPath();
    g.ellipse(cx - 9, cy - 11, 5.2, 3.2, -0.5, 0, TAU);
    g.fill();
  }

  function sprBat(g, cx, cy) {
    halo(g, cx, cy - 6, 40, '122,92,255', 0.46);

    g.strokeStyle = 'rgba(239,230,210,0.8)';
    g.lineWidth = 4;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(cx, cy + 15);
    g.lineTo(cx, cy + 37);
    g.stroke();

    var head = g.createRadialGradient(cx - 8, cy - 11, 2, cx, cy - 2, 23);
    head.addColorStop(0, '#ffffff');
    head.addColorStop(0.35, '#efe6d2');
    head.addColorStop(0.72, '#b9b2d8');
    head.addColorStop(1, '#7a5cff');
    g.fillStyle = head;
    g.beginPath();
    g.arc(cx, cy - 2, 21, 0, TAU);
    g.fill();

    g.save();
    g.beginPath();
    g.arc(cx, cy - 2, 20, 0, TAU);
    g.clip();
    g.strokeStyle = 'rgba(122,92,255,0.55)';
    g.lineWidth = 3.6;
    g.beginPath();
    var i, u, a, r, x, y;
    for (i = 0; i <= 140; i++) {
      u = i / 140;
      a = u * TAU * 2.15;
      r = 1.5 + u * 20;
      x = cx + Math.cos(a) * r;
      y = cy - 2 + Math.sin(a) * r;
      if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.stroke();
    g.restore();

    g.fillStyle = '#0b0913';
    wing(g, cx + 3, cy - 9, 30, 17, 0.4);
    g.save();
    g.translate(cx * 2, 0);
    g.scale(-1, 1);
    wing(g, cx + 3, cy - 9, 30, 17, -0.4);
    g.restore();

    g.fillStyle = 'rgba(224,27,60,0.95)';
    g.beginPath();
    g.arc(cx - 6, cy - 5, 2.4, 0, TAU);
    g.fill();
    g.beginPath();
    g.arc(cx + 6, cy - 5, 2.4, 0, TAU);
    g.fill();
  }

  function sprGhost(g, cx, cy) {
    halo(g, cx, cy - 4, 40, '185,178,216', 0.4);

    var body = g.createLinearGradient(cx, cy - 28, cx, cy + 26);
    body.addColorStop(0, '#ffffff');
    body.addColorStop(0.4, '#efe6d2');
    body.addColorStop(1, '#9f96cc');

    g.fillStyle = body;
    g.beginPath();
    g.moveTo(cx - 20, cy + 17);
    g.lineTo(cx - 20, cy - 6);
    g.quadraticCurveTo(cx - 20, cy - 27, cx, cy - 27);
    g.quadraticCurveTo(cx + 20, cy - 27, cx + 20, cy - 6);
    g.lineTo(cx + 20, cy + 17);
    var i, n = 4, xa, xb;
    for (i = 0; i < n; i++) {
      xa = cx + 20 - (40 / n) * i;
      xb = cx + 20 - (40 / n) * (i + 1);
      g.quadraticCurveTo((xa + xb) / 2, cy + 17 + (i % 2 === 0 ? 11 : -9), xb, cy + 17);
    }
    g.closePath();
    g.fill();

    g.fillStyle = 'rgba(43,27,87,0.88)';
    g.beginPath();
    g.ellipse(cx - 8, cy - 6, 4.2, 5.6, 0, 0, TAU);
    g.fill();
    g.beginPath();
    g.ellipse(cx + 8, cy - 6, 4.2, 5.6, 0, 0, TAU);
    g.fill();
    g.beginPath();
    g.ellipse(cx, cy + 6, 3.2, 4.4, 0, 0, TAU);
    g.fill();

    g.fillStyle = 'rgba(255,255,255,0.4)';
    g.beginPath();
    g.ellipse(cx - 10, cy - 16, 5, 3, -0.6, 0, TAU);
    g.fill();
  }

  function sprRat(g, cx, cy) {
    halo(g, cx, cy + 2, 38, '124,224,138', 0.3);

    g.strokeStyle = '#4a2c66';
    g.lineWidth = 3.6;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(cx - 20, cy + 8);
    g.bezierCurveTo(cx - 38, cy + 12, cx - 34, cy - 8, cx - 22, cy - 6);
    g.stroke();

    g.fillStyle = '#3a2a5c';
    g.beginPath();
    g.arc(cx - 9, cy - 14, 8.5, 0, TAU);
    g.fill();
    g.beginPath();
    g.arc(cx + 11, cy - 13, 7.5, 0, TAU);
    g.fill();

    var body = g.createLinearGradient(cx, cy - 18, cx, cy + 20);
    body.addColorStop(0, '#2b1b57');
    body.addColorStop(0.55, '#161327');
    body.addColorStop(1, '#06050a');
    g.fillStyle = body;
    g.beginPath();
    g.ellipse(cx - 2, cy + 1, 21, 14, 0, 0, TAU);
    g.fill();

    g.fillStyle = '#241a44';
    g.beginPath();
    g.ellipse(cx + 18, cy + 2, 10, 7.5, 0.15, 0, TAU);
    g.fill();
    g.fillStyle = '#e01b3c';
    g.beginPath();
    g.ellipse(cx + 26, cy + 3, 2.8, 2.2, 0, 0, TAU);
    g.fill();

    g.fillStyle = '#e01b3c';
    g.beginPath();
    g.arc(cx + 4, cy - 13, 7, 0, TAU);
    g.fill();
    g.fillStyle = '#7ce08a';
    g.beginPath();
    g.arc(cx + 6, cy - 13, 3, 0, TAU);
    g.fill();

    g.strokeStyle = 'rgba(239,230,210,0.45)';
    g.lineWidth = 1.1;
    g.beginPath();
    g.moveTo(cx + 24, cy + 1); g.lineTo(cx + 34, cy - 4);
    g.moveTo(cx + 24, cy + 4); g.lineTo(cx + 34, cy + 8);
    g.stroke();

    g.fillStyle = '#161327';
    g.beginPath();
    g.ellipse(cx - 8, cy + 14, 5, 3.4, 0, 0, TAU);
    g.fill();
    g.beginPath();
    g.ellipse(cx + 8, cy + 14, 5, 3.4, 0, 0, TAU);
    g.fill();
  }

  function sprSlime(g, cx, cy) {
    halo(g, cx, cy + 4, 40, '124,224,138', 0.36);

    var body = g.createRadialGradient(cx - 8, cy - 14, 3, cx, cy + 6, 32);
    body.addColorStop(0, '#d9ffd6');
    body.addColorStop(0.3, '#7ce08a');
    body.addColorStop(0.75, '#35a35a');
    body.addColorStop(1, '#124a2c');

    g.fillStyle = body;
    g.beginPath();
    g.moveTo(cx - 22, cy + 17);
    g.quadraticCurveTo(cx - 27, cy - 16, cx, cy - 21);
    g.quadraticCurveTo(cx + 27, cy - 16, cx + 22, cy + 17);
    var i, n = 5, xa, xb;
    for (i = 0; i < n; i++) {
      xa = cx - 22 + (44 / n) * i;
      xb = cx - 22 + (44 / n) * (i + 1);
      g.quadraticCurveTo((xa + xb) / 2, cy + 17 + (i % 2 === 0 ? 13 : 4), xb, cy + 17);
    }
    g.closePath();
    g.fill();

    g.fillStyle = 'rgba(6,40,20,0.42)';
    g.beginPath();
    g.arc(cx - 9, cy + 4, 2.6, 0, TAU);
    g.fill();
    g.beginPath();
    g.arc(cx + 7, cy + 9, 2, 0, TAU);
    g.fill();
    g.beginPath();
    g.arc(cx + 2, cy - 6, 1.8, 0, TAU);
    g.fill();

    g.fillStyle = 'rgba(255,255,255,0.42)';
    g.beginPath();
    g.ellipse(cx - 10, cy - 12, 6, 3.4, -0.5, 0, TAU);
    g.fill();
  }

  function sprBasket(g, cx, cy) {
    var w = 48;
    var rimY = cy - BK_DROP * 0.5;
    var botY = rimY + BK_DROP;

    halo(g, cx, rimY + 10, 62, '255,178,87', 0.24);

    var body = g.createLinearGradient(cx - w, rimY, cx + w * 0.6, botY);
    body.addColorStop(0, '#2b1b57');
    body.addColorStop(0.45, '#161327');
    body.addColorStop(1, '#0b0913');
    g.fillStyle = body;
    g.beginPath();
    g.moveTo(cx - w, rimY + 6);
    g.lineTo(cx - w * 0.66, botY - 12);
    g.quadraticCurveTo(cx - w * 0.58, botY, cx - w * 0.3, botY);
    g.lineTo(cx + w * 0.3, botY);
    g.quadraticCurveTo(cx + w * 0.58, botY, cx + w * 0.66, botY - 12);
    g.lineTo(cx + w, rimY + 6);
    g.closePath();
    g.fill();

    g.strokeStyle = 'rgba(185,178,216,0.22)';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(cx - w * 0.94, rimY + 22);
    g.quadraticCurveTo(cx, rimY + 30, cx + w * 0.94, rimY + 22);
    g.stroke();
    g.beginPath();
    g.moveTo(cx - w * 0.8, rimY + 44);
    g.quadraticCurveTo(cx, rimY + 52, cx + w * 0.8, rimY + 44);
    g.stroke();

    g.fillStyle = 'rgba(239,230,210,0.55)';
    g.beginPath();
    g.arc(cx - w * 0.78, rimY + 25, 1.7, 0, TAU);
    g.fill();
    g.beginPath();
    g.arc(cx + w * 0.78, rimY + 25, 1.7, 0, TAU);
    g.fill();
    g.beginPath();
    g.arc(cx - w * 0.68, rimY + 47, 1.7, 0, TAU);
    g.fill();
    g.beginPath();
    g.arc(cx + w * 0.68, rimY + 47, 1.7, 0, TAU);
    g.fill();

    g.save();
    g.shadowColor = '#ffb257';
    g.shadowBlur = 12;
    g.fillStyle = '#ffd9a0';
    g.beginPath();
    g.ellipse(cx - 13, rimY + 30, 5, 6.4, 0, 0, TAU);
    g.fill();
    g.beginPath();
    g.ellipse(cx + 13, rimY + 30, 5, 6.4, 0, 0, TAU);
    g.fill();
    g.restore();
    g.fillStyle = '#3a0d02';
    g.beginPath();
    g.arc(cx - 12, rimY + 31, 1.9, 0, TAU);
    g.fill();
    g.beginPath();
    g.arc(cx + 14, rimY + 31, 1.9, 0, TAU);
    g.fill();

    var rim = g.createLinearGradient(cx, rimY - 12, cx, rimY + 12);
    rim.addColorStop(0, '#efe6d2');
    rim.addColorStop(0.5, '#b9b2d8');
    rim.addColorStop(1, '#4a3a7a');
    g.fillStyle = rim;
    g.beginPath();
    g.ellipse(cx, rimY, w + 3, 12.5, 0, 0, TAU);
    g.fill();

    var hole = g.createLinearGradient(cx, rimY - 8, cx, rimY + 9);
    hole.addColorStop(0, '#2b1b57');
    hole.addColorStop(0.45, '#0b0913');
    hole.addColorStop(1, '#06050a');
    g.fillStyle = hole;
    g.beginPath();
    g.ellipse(cx, rimY + 0.5, w - 4, 9, 0, 0, TAU);
    g.fill();

    g.strokeStyle = 'rgba(255,217,160,0.55)';
    g.lineWidth = 1.6;
    g.beginPath();
    g.ellipse(cx, rimY + 0.5, w - 4, 9, 0, Math.PI * 1.08, Math.PI * 1.92);
    g.stroke();
  }

  function sprGlow(r, g1, b) {
    var s = 64;
    var c = makeCanvas(s, s);
    var x = c.getContext('2d');
    if (!x) return c;
    var gr = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    gr.addColorStop(0, 'rgba(' + r + ',' + g1 + ',' + b + ',0.9)');
    gr.addColorStop(0.35, 'rgba(' + r + ',' + g1 + ',' + b + ',0.32)');
    gr.addColorStop(1, 'rgba(' + r + ',' + g1 + ',' + b + ',0)');
    x.fillStyle = gr;
    x.fillRect(0, 0, s, s);
    return c;
  }

  function pinePath(g, x, baseY, h, w) {
    var tiers = 4;
    var i;

    g.beginPath();
    for (i = 1; i <= tiers; i++) {
      var t = i / tiers;
      var topY = baseY - h * t;
      var botY = baseY - h * (t - 1.18 / tiers);
      var halfW = w * (1 - t * 0.56);
      g.moveTo(x, topY);
      g.lineTo(x - halfW, botY);
      g.lineTo(x + halfW, botY);
      g.closePath();
    }
    g.rect(x - w * 0.06, baseY - h * 0.08, w * 0.12, h * 0.1);
  }

  function pineRow(g, baseY, count, h, w, color, seed) {
    g.fillStyle = color;
    var step = LW / count;
    for (var i = 0; i < count + 1; i++) {
      var j = ((i * 9301 + seed * 49297) % 233280) / 233280;
      var x = -step * 0.4 + i * step + (j - 0.5) * step * 0.6;
      var hh = h * (0.66 + j * 0.66);
      pinePath(g, x, baseY, hh, w * (0.72 + j * 0.56));
      g.fill();
    }
  }

  function bareTree(g, x, baseY, h, color, seed) {
    g.strokeStyle = color;
    g.lineCap = 'round';
    var branches = 7;
    var i;
    g.lineWidth = Math.max(1.6, h * 0.026);
    g.beginPath();
    g.moveTo(x, baseY);
    g.quadraticCurveTo(x + h * 0.06, baseY - h * 0.5, x - h * 0.03, baseY - h);
    g.stroke();
    for (i = 0; i < branches; i++) {
      var t = 0.24 + (i / branches) * 0.7;
      var by = baseY - h * t;
      var bx = x - h * 0.03 * t;
      var dir = i % 2 ? 1 : -1;
      var len = h * (0.42 - t * 0.22);
      var jj = ((i * 71 + seed * 13) % 97) / 97;
      g.lineWidth = Math.max(1, h * 0.016 * (1 - t * 0.6));
      g.beginPath();
      g.moveTo(bx, by);
      g.quadraticCurveTo(
        bx + dir * len * 0.6,
        by - len * (0.2 + jj * 0.2),
        bx + dir * len, by - len * (0.5 + jj * 0.4)
      );
      g.stroke();
      g.beginPath();
      g.moveTo(bx + dir * len * 0.6, by - len * 0.3);
      g.lineTo(bx + dir * len * 0.86, by - len * 0.9);
      g.stroke();
    }
  }

  function buildBackground() {
    var c = makeCanvas(LW, LH);
    var g = c.getContext('2d');
    if (!g) return c;

    var i;
    var k;

    /* ── sky ── */
    var sky = g.createLinearGradient(0, 0, 0, LH);
    sky.addColorStop(0, '#150f2c');
    sky.addColorStop(0.28, '#120d25');
    sky.addColorStop(0.62, '#0b0818');
    sky.addColorStop(1, '#050409');
    g.fillStyle = sky;
    g.fillRect(0, 0, LW, LH);

    /* ── stars ── */
    for (i = 0; i < 150; i++) {
      k = ((i * 104729) % 99991) / 99991;
      var sx = k * LW;
      var sy = ((i * 7919) % 611) / 611 * LH * 0.62;
      var sr = 0.35 + (((i * 313) % 97) / 97) * 0.9;
      var sa = 0.14 + (((i * 457) % 89) / 89) * 0.5;
      g.fillStyle = 'rgba(226,222,255,' + sa.toFixed(2) + ')';
      g.beginPath();
      g.arc(sx, sy, sr, 0, TAU);
      g.fill();
      if (i % 23 === 0) {
        g.strokeStyle = 'rgba(226,222,255,' + (sa * 0.5).toFixed(2) + ')';
        g.lineWidth = 0.7;
        g.beginPath();
        g.moveTo(sx - sr * 4, sy); g.lineTo(sx + sr * 4, sy);
        g.moveTo(sx, sy - sr * 4); g.lineTo(sx, sy + sr * 4);
        g.stroke();
      }
    }

    /* ── moon ── */
    g.globalCompositeOperation = 'lighter';
    halo(g, 742, 104, 250, '140,124,232', 0.26);
    halo(g, 742, 104, 92, '226,220,255', 0.3);
    g.globalCompositeOperation = 'source-over';

    g.save();
    g.beginPath();
    g.arc(742, 104, 34, 0, TAU);
    g.clip();
    var mg = g.createLinearGradient(714, 74, 772, 136);
    mg.addColorStop(0, '#fdfbf4');
    mg.addColorStop(0.55, '#ddd5f2');
    mg.addColorStop(1, '#a79ccb');
    g.fillStyle = mg;
    g.fillRect(700, 62, 90, 90);
    g.fillStyle = 'rgba(126,114,164,0.5)';
    var craters = [[728, 92, 7], [752, 118, 5], [756, 88, 3.4], [722, 124, 4], [766, 106, 2.6]];
    for (i = 0; i < craters.length; i++) {
      g.beginPath();
      g.arc(craters[i][0], craters[i][1], craters[i][2], 0, TAU);
      g.fill();
    }
    g.restore();

    /* ── cloud bands crossing the moon ── */
    g.fillStyle = 'rgba(46,38,74,0.5)';
    for (i = 0; i < 5; i++) {
      var cy2 = 132 + i * 19;
      g.beginPath();
      g.ellipse(560 + i * 96, cy2, 190 - i * 18, 11 - i * 1.2, 0, 0, TAU);
      g.fill();
    }

    /* ── far treeline, hazier ── */
    g.fillStyle = 'rgba(20,16,38,0.85)';
    pineRow(g, 404, 15, 100, 17, 'rgba(20,16,38,0.85)', 7);

    /* ── fog band behind the near treeline ── */
    var fg = g.createLinearGradient(0, 360, 0, 452);
    fg.addColorStop(0, 'rgba(108,96,164,0)');
    fg.addColorStop(0.5, 'rgba(108,96,164,0.17)');
    fg.addColorStop(1, 'rgba(108,96,164,0)');
    g.fillStyle = fg;
    g.fillRect(0, 360, LW, 92);

    /* ── near treeline ── */
    pineRow(g, 470, 12, 158, 26, 'rgba(11,9,21,0.97)', 23);

    /* ── rolling hill ── */
    g.fillStyle = '#090714';
    g.beginPath();
    g.moveTo(0, 520);
    g.quadraticCurveTo(150, 470, 330, 506);
    g.quadraticCurveTo(520, 542, 700, 494);
    g.quadraticCurveTo(860, 452, LW, 500);
    g.lineTo(LW, LH);
    g.lineTo(0, LH);
    g.closePath();
    g.fill();

    /* ── bare twisted trees ── */
    bareTree(g, 84, 512, 176, 'rgba(8,6,15,0.96)', 3);
    bareTree(g, 884, 506, 158, 'rgba(8,6,15,0.96)', 5);

    /* ── fence ── */
    g.fillStyle = 'rgba(8,6,14,0.95)';
    for (i = 0; i < 26; i++) {
      var fx = 8 + i * 38;
      var fh = 46 + ((i * 37) % 24);
      g.fillRect(fx, 520 - fh, 6, fh);
      g.beginPath();
      g.moveTo(fx - 2, 520 - fh);
      g.lineTo(fx + 3, 520 - fh - 9);
      g.lineTo(fx + 8, 520 - fh);
      g.closePath();
      g.fill();
    }
    g.fillRect(0, 480, LW, 6);
    g.fillRect(0, 508, LW, 5);
    g.fillStyle = 'rgba(150,140,200,0.08)';
    g.fillRect(0, 480, LW, 1.4);
    g.fillRect(0, 508, LW, 1.1);

    /* ── graves ── */
    var graves = [
      { x: 118, w: 44, h: 76, r: 21 },
      { x: 238, w: 32, h: 52, r: 14 },
      { x: 700, w: 30, h: 44, r: 13 },
      { x: 830, w: 48, h: 68, r: 22 }
    ];
    for (i = 0; i < graves.length; i++) {
      var gr = graves[i];
      g.fillStyle = 'rgba(11,9,19,0.97)';
      g.beginPath();
      g.moveTo(gr.x - gr.w / 2, GROUND_Y + 4);
      g.lineTo(gr.x - gr.w / 2, GROUND_Y - gr.h + gr.r);
      g.arc(gr.x, GROUND_Y - gr.h + gr.r, gr.w / 2, Math.PI, 0);
      g.lineTo(gr.x + gr.w / 2, GROUND_Y + 4);
      g.closePath();
      g.fill();
      g.fillStyle = 'rgba(196,186,228,0.12)';
      g.beginPath();
      g.moveTo(gr.x - gr.w / 2, GROUND_Y + 4);
      g.lineTo(gr.x - gr.w / 2, GROUND_Y - gr.h + gr.r);
      g.arc(gr.x, GROUND_Y - gr.h + gr.r, gr.w / 2, Math.PI, Math.PI * 1.5);
      g.closePath();
      g.fill();
      g.fillStyle = 'rgba(239,230,210,0.11)';
      g.fillRect(gr.x - gr.w / 2 + 6, GROUND_Y - gr.h + gr.r + 16, gr.w - 12, 3);
      g.fillRect(gr.x - gr.w / 2 + 6, GROUND_Y - gr.h + gr.r + 26, gr.w - 12, 3);
    }

    /* cross */
    g.fillStyle = 'rgba(11,9,19,0.97)';
    g.fillRect(612, GROUND_Y - 96, 9, 100);
    g.fillRect(588, GROUND_Y - 78, 57, 9);

    /* ── ground ── */
    var gg = g.createLinearGradient(0, GROUND_Y - 12, 0, LH);
    gg.addColorStop(0, '#0b0812');
    gg.addColorStop(0.4, '#060509');
    gg.addColorStop(1, '#030206');
    g.fillStyle = gg;
    g.fillRect(0, GROUND_Y - 4, LW, LH - GROUND_Y + 4);
    g.fillStyle = 'rgba(196,188,232,0.11)';
    g.fillRect(0, GROUND_Y - 4, LW, 1.6);

    /* ground speckle */
    for (i = 0; i < 120; i++) {
      var tx = ((i * 27109) % 9973) / 9973 * LW;
      var ty = GROUND_Y + ((i * 6131) % 977) / 977 * (LH - GROUND_Y);
      g.fillStyle = 'rgba(150,140,200,' + (0.03 + ((i * 71) % 53) / 53 * 0.05).toFixed(3) + ')';
      g.fillRect(tx, ty, 2, 1);
    }

    /* ── foreground grass ── */
    g.strokeStyle = '#030206';
    g.lineCap = 'round';
    for (i = 0; i < 130; i++) {
      var gx = (i / 130) * LW + ((i * 37) % 11) - 5;
      var gh = 14 + ((i * 53) % 26);
      var lean = ((i * 29) % 13) - 6;
      g.lineWidth = 1.2 + ((i * 17) % 9) * 0.28;
      g.beginPath();
      g.moveTo(gx, LH);
      g.quadraticCurveTo(gx + lean * 0.5, LH - gh * 0.6, gx + lean, LH - gh);
      g.stroke();
    }

    /* ── foreground pumpkin ── */
    g.fillStyle = '#030206';
    g.beginPath();
    g.ellipse(58, LH - 4, 46, 34, 0, 0, TAU);
    g.fill();
    g.fillRect(52, LH - 46, 11, 18);
    g.globalCompositeOperation = 'lighter';
    halo(g, 58, LH - 16, 118, '255,138,30', 0.2);
    g.globalCompositeOperation = 'source-over';

    /* ── globalCompositeOperation resets ── */
    g.globalCompositeOperation = 'lighter';
    halo(g, 742, 104, 400, '122,92,255', 0.07);
    halo(g, 96, 470, 320, '255,138,30', 0.1);
    g.globalCompositeOperation = 'source-over';

    /* ── vignette ── */
    var vig = g.createRadialGradient(LW * 0.5, LH * 0.42, LH * 0.28, LW * 0.5, LH * 0.42, LH * 0.98);
    vig.addColorStop(0, 'rgba(2,1,4,0)');
    vig.addColorStop(0.7, 'rgba(2,1,4,0.4)');
    vig.addColorStop(1, 'rgba(2,1,4,0.92)');
    g.fillStyle = vig;
    g.fillRect(0, 0, LW, LH);

    return c;
  }

  /* ── фон для портретного мира 620×940 ──
     Отдельная композиция, а не растянутый на 960×600: при растяжении
     луна уезжала бы в середину кадра, а сосны вырастали бы выше неба. */
  function buildPortraitBackground() {
    var c = makeCanvas(LW, LH);
    var g = c.getContext('2d');
    if (!g) return c;

    var i;
    var GY = GROUND_Y;
    var MX = LW * 0.68;
    var MY = LH * 0.145;
    var MR = 52;

    /* небо */
    var sky = g.createLinearGradient(0, 0, 0, LH);
    sky.addColorStop(0, '#150f2c');
    sky.addColorStop(0.3, '#120d25');
    sky.addColorStop(0.66, '#0b0818');
    sky.addColorStop(1, '#050409');
    g.fillStyle = sky;
    g.fillRect(0, 0, LW, LH);

    /* звёзды */
    g.fillStyle = '#f3ecff';
    for (i = 0; i < 150; i++) {
      var sx = ((i * 733) % 619) + 1;
      var sy = (((i * 7919) % 611) / 611) * GY * 0.62;
      var sr = 0.35 + ((i * 31) % 9) * 0.1;
      g.globalAlpha = 0.25 + ((i * 17) % 7) * 0.1;
      g.beginPath();
      g.arc(sx, sy, sr, 0, TAU);
      g.fill();
      if (i % 23 === 0) {
        g.globalAlpha = 0.5;
        g.fillRect(sx - 2.6, sy - 0.4, 5.2, 0.8);
        g.fillRect(sx - 0.4, sy - 2.6, 0.8, 5.2);
      }
    }
    g.globalAlpha = 1;

    /* луна: большая, с ореолами и кратерами */
    g.globalCompositeOperation = 'lighter';
    halo(g, MX, MY, 250, '122,92,255', 0.1);
    halo(g, MX, MY, 120, '214,196,255', 0.14);
    g.globalCompositeOperation = 'source-over';

    var moonG = g.createRadialGradient(MX - MR * 0.35, MY - MR * 0.4, MR * 0.15, MX, MY, MR);
    moonG.addColorStop(0, '#fbf6ea');
    moonG.addColorStop(0.72, '#e9def6');
    moonG.addColorStop(1, '#c9bce8');
    g.fillStyle = moonG;
    g.beginPath();
    g.arc(MX, MY, MR, 0, TAU);
    g.fill();

    g.fillStyle = 'rgba(164,150,196,0.5)';
    var craters = [
      [MX - 14, MY - 12, 10], [MX + 22, MY + 16, 7.4],
      [MX + 26, MY - 18, 5], [MX - 22, MY + 22, 6],
      [MX + 40, MY + 4, 3.8]
    ];
    for (i = 0; i < craters.length; i++) {
      g.beginPath();
      g.arc(craters[i][0], craters[i][1], craters[i][2], 0, TAU);
      g.fill();
    }

    /* облачные полосы */
    for (i = 0; i < 4; i++) {
      g.fillStyle = 'rgba(24,20,46,' + (0.5 - i * 0.07).toFixed(2) + ')';
      g.beginPath();
      g.ellipse(LW * 0.46 + i * LW * 0.12, LH * 0.245 + i * 21, 220 - i * 30, 12 - i * 1.4, 0, 0, TAU);
      g.fill();
    }

    /* дальние сосны */
    pineRow(g, GY - 208, 11, 128, 22, 'rgba(20,16,38,0.85)', 7);

    /* туман у подножия */
    var fog = g.createLinearGradient(0, GY - 250, 0, GY - 60);
    fog.addColorStop(0, 'rgba(126,112,180,0)');
    fog.addColorStop(0.5, 'rgba(126,112,180,0.13)');
    fog.addColorStop(1, 'rgba(126,112,180,0)');
    g.fillStyle = fog;
    g.fillRect(0, GY - 250, LW, 190);

    /* ближние сосны */
    pineRow(g, GY - 116, 8, 190, 34, 'rgba(11,9,21,0.97)', 23);

    /* холм */
    g.fillStyle = '#090714';
    g.beginPath();
    g.moveTo(0, GY - 92);
    g.quadraticCurveTo(LW * 0.22, GY - 142, LW * 0.46, GY - 104);
    g.quadraticCurveTo(LW * 0.7, GY - 62, LW * 0.86, GY - 96);
    g.quadraticCurveTo(LW * 0.95, GY - 112, LW, GY - 92);
    g.lineTo(LW, LH);
    g.lineTo(0, LH);
    g.closePath();
    g.fill();

    /* голые деревья */
    bareTree(g, LW * 0.13, GY - 70, 214, '#0a0814', 3);
    bareTree(g, LW * 0.88, GY - 64, 186, '#0a0814', 9);

    /* забор */
    var posts = 17;
    var step = LW / posts;
    g.fillStyle = '#0a0817';
    for (i = 0; i < posts; i++) {
      var fx = 4 + i * step;
      var fh = 44 + ((i * 37) % 24);
      g.fillRect(fx, GY - 38 - fh, 9, fh);
      g.fillStyle = 'rgba(118,106,166,0.22)';
      g.fillRect(fx, GY - 38 - fh, 2.4, fh);
      g.fillStyle = '#0a0817';
    }
    g.fillRect(0, GY - 106, LW, 6);
    g.fillRect(0, GY - 78, LW, 5);

    /* надгробья */
    var graves = [
      { x: LW * 0.14, w: 46, h: 80, r: 23 },
      { x: LW * 0.52, w: 36, h: 54, r: 16 },
      { x: LW * 0.84, w: 48, h: 72, r: 21 }
    ];
    for (i = 0; i < graves.length; i++) {
      var gv = graves[i];
      g.fillStyle = '#08060f';
      g.beginPath();
      g.moveTo(gv.x - gv.w / 2, GY - 30);
      g.lineTo(gv.x - gv.w / 2, GY - 30 - gv.h + gv.r);
      g.arc(gv.x, GY - 30 - gv.h + gv.r, gv.r, Math.PI, 0);
      g.lineTo(gv.x + gv.w / 2, GY - 30);
      g.closePath();
      g.fill();
      g.fillStyle = 'rgba(150,138,205,0.16)';
      g.fillRect(gv.x - gv.w / 2, GY - 30 - gv.h + gv.r, 2, gv.h - gv.r);
    }

    /* крест */
    g.fillStyle = '#08060f';
    g.fillRect(LW * 0.45, GY - 132, 9, 100);
    g.fillRect(LW * 0.45 - 24, GY - 114, 57, 9);

    /* земля */
    var grd = g.createLinearGradient(0, GY - 12, 0, LH);
    grd.addColorStop(0, '#0b0812');
    grd.addColorStop(0.35, '#060509');
    grd.addColorStop(1, '#030206');
    g.fillStyle = grd;
    g.fillRect(0, GY - 12, LW, LH - GY + 12);

    g.strokeStyle = 'rgba(150,138,205,0.18)';
    g.lineWidth = 1.6;
    g.beginPath();
    g.moveTo(0, GY - 4);
    g.lineTo(LW, GY - 4);
    g.stroke();

    /* камешки и трава */
    g.fillStyle = 'rgba(126,116,168,0.22)';
    for (i = 0; i < 90; i++) {
      var px = ((i * 977) % 619) + 1;
      var py = GY + ((i * 431) % 12);
      g.fillRect(px, py, 1 + (i % 3), 1);
    }

    g.strokeStyle = 'rgba(24,20,40,0.9)';
    for (i = 0; i < 80; i++) {
      var gx = (i / 80) * LW + ((i * 37) % 11) - 5;
      var gh = 14 + ((i * 53) % 26);
      var lean = ((i * 29) % 13) - 6;
      g.lineWidth = 1.2 + ((i * 17) % 9) * 0.28;
      g.beginPath();
      g.moveTo(gx, LH);
      g.quadraticCurveTo(gx + lean * 0.5, LH - gh * 0.6, gx + lean, LH - gh);
      g.stroke();
    }

    /* фонарь-тыква слева внизу */
    g.fillStyle = '#030206';
    g.beginPath();
    g.ellipse(48, LH - 6, 50, 38, 0, 0, TAU);
    g.fill();
    g.fillRect(42, LH - 52, 11, 18);
    g.globalCompositeOperation = 'lighter';
    halo(g, 48, LH - 20, 130, '255,138,30', 0.2);
    halo(g, MX, MY, 400, '122,92,255', 0.06);
    g.globalCompositeOperation = 'source-over';

    /* виньетка */
    var vig = g.createRadialGradient(LW * 0.5, LH * 0.4, LH * 0.25, LW * 0.5, LH * 0.4, LH * 0.95);
    vig.addColorStop(0, 'rgba(2,1,4,0)');
    vig.addColorStop(0.7, 'rgba(2,1,4,0.4)');
    vig.addColorStop(1, 'rgba(2,1,4,0.92)');
    g.fillStyle = vig;
    g.fillRect(0, 0, LW, LH);

    return c;
  }

  function paintBackground() {
    return isPortraitWorld ? buildPortraitBackground() : buildBackground();
  }

  /* ── animated ambience: fog wisps, drifting leaves, distant bats ── */
  var amb = null;

  function buildAmbience() {
    var i;
    var wisps = [];
    var leaves = [];
    var flier = [];

    for (i = 0; i < 6; i++) {
      wisps.push({
        x: rnd(-300, LW),
        y: rnd(FOG_MIN, FOG_MAX),
        rx: rnd(230, 430),
        ry: rnd(26, 62),
        sp: rnd(4, 12),
        a: rnd(0.014, 0.042),
        tint: i % 2 ? '150,140,205' : '180,150,205'
      });
    }

    for (i = 0; i < 14; i++) {
      leaves.push({
        x: rnd(0, LW),
        y: rnd(-40, LH * 0.8),
        vy: rnd(16, 34),
        amp: rnd(14, 42),
        freq: rnd(0.5, 1.3),
        phase: rnd(0, TAU),
        rot: rnd(0, TAU),
        spin: rnd(-1.4, 1.4),
        r: rnd(2.2, 4.6)
      });
    }

    var n = LOW ? 2 : 4;
    for (i = 0; i < n; i++) {
      flier.push({
        x: rnd(-140, LW + 140),
        y: rnd(80, 250),
        size: rnd(9, 17),
        sp: rnd(34, 66),
        dir: Math.random() > 0.5 ? 1 : -1,
        flap: rnd(0, TAU),
        rate: rnd(7, 11),
        drift: rnd(0.2, 0.8),
        sway: rnd(0, TAU)
      });
    }

    amb = { wisps: wisps, leaves: leaves, flier: flier };
  }

  function updateAmbience(dt) {
    if (!amb) return;
    var i;
    var p;

    for (i = 0; i < amb.wisps.length; i++) {
      p = amb.wisps[i];
      p.x += p.sp * dt;
      if (p.x - p.rx > LW) { p.x = -p.rx; p.y = rnd(FOG_MIN, FOG_MAX); }
    }

    for (i = 0; i < amb.leaves.length; i++) {
      p = amb.leaves[i];
      p.phase += dt * p.freq;
      p.rot += p.spin * dt;
      p.y += p.vy * dt;
      p.x += Math.cos(p.phase) * p.amp * dt;
      if (p.y > LH + 20) { p.y = -20; p.x = rnd(-20, LW + 20); }
      if (p.x < -30) p.x = LW + 20;
      if (p.x > LW + 30) p.x = -20;
    }

    for (i = 0; i < amb.flier.length; i++) {
      p = amb.flier[i];
      p.flap += dt * p.rate;
      p.sway += dt * 0.7;
      p.x += p.sp * p.dir * dt;
      p.y += Math.sin(p.sway) * p.drift * dt;
      if (p.dir > 0 && p.x > LW + 40) { p.x = -40; p.y = rnd(80, 250); }
      if (p.dir < 0 && p.x < -40) { p.x = LW + 40; p.y = rnd(80, 250); }
    }
  }

  function drawAmbience(ctx) {
    if (!amb) return;
    var i;
    var p;

    /* fog wisps */
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (i = 0; i < amb.wisps.length; i++) {
      p = amb.wisps[i];
      var wg = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.rx);
      wg.addColorStop(0, 'rgba(' + p.tint + ',' + p.a.toFixed(3) + ')');
      wg.addColorStop(1, 'rgba(' + p.tint + ',0)');
      ctx.fillStyle = wg;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, p.rx, p.ry, 0, 0, TAU);
      ctx.fill();
    }
    ctx.restore();

    /* leaves */
    ctx.save();
    ctx.fillStyle = 'rgba(126,72,32,0.5)';
    for (i = 0; i < amb.leaves.length; i++) {
      p = amb.leaves[i];
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.scale(1, 0.4 + Math.abs(Math.cos(p.rot * 0.7)) * 0.6);
      ctx.beginPath();
      ctx.ellipse(0, 0, p.r, p.r * 0.5, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();

    /* distant bats */
    ctx.save();
    ctx.fillStyle = 'rgba(6,5,14,0.66)';
    for (i = 0; i < amb.flier.length; i++) {
      p = amb.flier[i];
      var ph = p.flap % TAU;
      var f = ph < Math.PI ? Math.sin(ph / Math.PI) : -Math.sin((ph - Math.PI) / Math.PI) * 0.8;
      var w = p.size;
      var h = p.size * 0.42;
      var up = -f;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.scale(p.dir > 0 ? -1 : 1, 1);

      ctx.beginPath();
      ctx.moveTo(0, -h * 0.1);
      ctx.quadraticCurveTo(w * 0.4, -h * (0.5 + up * 0.9), w * 0.72, -h * (0.05 + up * 0.55));
      ctx.quadraticCurveTo(w * 0.9, h * 0.05, w, h * (0.22 - up * 0.42));
      ctx.quadraticCurveTo(w * 0.72, h * 0.5, w * 0.48, h * 0.26);
      ctx.quadraticCurveTo(w * 0.26, h * 0.44, 0, -h * 0.1);
      ctx.closePath();
      ctx.fill();

      ctx.save();
      ctx.scale(-1, 1);
      ctx.beginPath();
      ctx.moveTo(0, -h * 0.1);
      ctx.quadraticCurveTo(w * 0.4, -h * (0.5 + up * 0.9), w * 0.72, -h * (0.05 + up * 0.55));
      ctx.quadraticCurveTo(w * 0.9, h * 0.05, w, h * (0.22 - up * 0.42));
      ctx.quadraticCurveTo(w * 0.72, h * 0.5, w * 0.48, h * 0.26);
      ctx.quadraticCurveTo(w * 0.26, h * 0.44, 0, -h * 0.1);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      ctx.beginPath();
      ctx.ellipse(0, 0, w * 0.13, h * 0.34, 0, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-w * 0.09, -h * 0.3);
      ctx.lineTo(-w * 0.05, -h * 0.56);
      ctx.lineTo(w * 0.02, -h * 0.34);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(w * 0.09, -h * 0.3);
      ctx.lineTo(w * 0.05, -h * 0.56);
      ctx.lineTo(-w * 0.02, -h * 0.34);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    }
    ctx.restore();
  }

  var CandyCatch = (function () {
    var canvas, ctx, stageEl, stage, els, scene;
    var trail, tctx, glowWarm, glowPoison, bgSprite, basketSprite, sprites, glowGrd;
    var best = 0;
    var state = 'idle';
    var prevState = 'playing';
    var autoPaused = false;

    var score = 0;
    var lives = LIVES_MAX;
    var streak = 0;
    var bestStreak = 0;
    var caught = 0;
    var timeLeft = ROUND_TIME;
    var level = 1;
    var wave = 1;
var endless = false;
    var gameMode = HW.storage.get(MODE_KEY, 'candy') === 'cauldron' ? 'cauldron' : 'candy';
    var speedFactor = 1;
    var spawnEvery = 1;
    var spawnT = 0.55;
    var shake = 0;
    var slowT = 0;
    var timeScale = 1;

    var shownScore = -1;
    var shownSec = -1;
    var shownLives = -1;
var shownLevel = -1;
    var countShown = -1;

    var objects = [];
    var shards = [];

    var basket = { x: LW / 2, vx: 0, tilt: 0, sq: 0, sqv: 0 };
    var targetX = LW / 2;
    var ptrX = LW / 2;
    var hasPtr = false;
    var keyL = false;
    var keyR = false;

    var t = 0;
    var last = 0;
    var raf = 0;
    var countT = 0;
    var liveT = 0;
    var liveQueued = '';
    var maxObjects = LOW ? 7 : 10;

    function pickType() {
      var pf = 1 + Math.min(1.7, (level - 1) * 0.12);
      var total = 0;
      var w = [];
      var i;
      for (i = 0; i < TYPE_KEYS.length; i++) {
        var def = TYPES[TYPE_KEYS[i]];
        var v = def.w * (def.poison ? pf : 1);
        w.push(v);
        total += v;
      }
      var r = Math.random() * total;
      for (i = 0; i < w.length; i++) {
        r -= w[i];
        if (r <= 0) return TYPE_KEYS[i];
      }
      return 'pumpkin';
    }

    function spawn() {
      var kind = pickType();
      var def = TYPES[kind];
      var amp = rnd(16, 44) * (LW / 960);
      var bx = rnd(amp + 34, LW - amp - 34);
      objects.push({
        kind: kind,
        poison: def.poison,
        pts: def.pts,
        name: def.name,
        r: def.r * rnd(0.94, 1.08),
        sprite: sprites[kind],
        baseX: bx,
        x: bx,
        y: -rnd(34, 96),
        vy: rnd(26, 66),
        rot: rnd(0, TAU),
        spin: rnd(-2.3, 2.3),
        phase: rnd(0, TAU),
        swayRate: rnd(0.7, 1.6),
        swayAmp: amp,
        t: 0,
        checked: false
      });
    }

    function burstShards(x, y, rgb, n, up) {
      var total = REDUCED ? Math.min(n, 5) : n;
      var i;
      for (i = 0; i < total; i++) {
        var a = rnd(-Math.PI * 0.92, -Math.PI * 0.08);
        var sp = rnd(110, 330);
        shards.push({
          x: x,
          y: y,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp * (up ? 0.85 : 1),
          r: rnd(1.6, 3.8),
          rot: rnd(0, TAU),
          spin: rnd(-9, 9),
          t: 0,
          life: rnd(0.38, 0.86),
          rgb: rgb
        });
      }
      while (shards.length > (LOW ? 110 : 220)) shards.shift();
    }

    function sceneBurst(x, y, color, count) {
      if (!scene || !scene.parts) return;
      var r = canvas.getBoundingClientRect();
      if (!r.width) return;
      scene.parts.burst(
        r.left + (x / LW) * r.width,
        r.top + (y / LH) * r.height,
        { count: LOW ? Math.min(count, 8) : count, color: color }
      );
    }

    function bump(el) {
      if (!el) return;
      el.classList.remove('is-pop');
      void el.offsetWidth;
      el.classList.add('is-pop');
    }

    function say(msg) {
      if (!els.live) return;
      if (liveT <= 0) {
        els.live.textContent = msg;
        liveT = 0.45;
      } else {
        liveQueued = msg;
      }
    }

    function showCombo(mult) {
      if (!els.combo) return;
      els.combo.textContent = 'Комбо ×' + mult;
      els.combo.classList.remove('is-fly');
      void els.combo.offsetWidth;
      els.combo.classList.add('is-fly');
      els.combo.classList.toggle('is-hot', mult >= 3);
    }

    function hideCombo() {
      if (!els.combo) return;
      els.combo.classList.remove('is-fly');
    }

    function showScreen(el) {
      if (els.start) els.start.hidden = el !== els.start;
      if (els.over) els.over.hidden = el !== els.over;
      if (els.pause) els.pause.hidden = el !== els.pause;
    }

    function hudScore(doBump) {
      if (shownScore !== score) {
        els.score.textContent = String(score);
        shownScore = score;
      }
      if (doBump) bump(els.score);
    }

    function hudLives() {
      if (shownLives === lives) return;
      var i;
      for (i = 0; i < els.lives.length; i++) {
        var off = i >= lives;
        var wasOff = els.lives[i].classList.contains('is-off');
        els.lives[i].classList.toggle('is-off', off);
        if (wasOff && !off) {
          els.lives[i].classList.remove('is-lost');
          void els.lives[i].offsetWidth;
          els.lives[i].classList.add('is-lost');
        }
      }
      els.livesBox.setAttribute('aria-label', 'Жизни: ' + lives);
      shownLives = lives;
    }

    function hudTime() {
      var s = Math.max(0, Math.ceil(timeLeft));
      if (shownSec !== s) {
        els.time.textContent = String(s);
        shownSec = s;
        els.timeChip.classList.toggle('is-low', timeLeft <= 10 && state !== 'idle');
      }
      els.timeFill.style.transform = 'scaleX(' + Math.max(0, timeLeft / ROUND_TIME).toFixed(3) + ')';
    }

    function hudLevel() {
      if (shownLevel === level) return;
      els.level.textContent = endless ? 'Волна ' + wave + ' · раунд ' + level : 'Раунд ' + level;
      shownLevel = level;
      bump(els.level);
    }

    function setPauseBtn(show) {
      if (els.pauseBtn) els.pauseBtn.hidden = !show;
    }

    function clearObjects() {
      objects.length = 0;
      shards.length = 0;
      if (tctx) {
        tctx.globalCompositeOperation = 'source-over';
        tctx.clearRect(0, 0, LW, LH);
      }
    }

    function resetRound() {
      score = 0;
      lives = LIVES_MAX;
      streak = 0;
      bestStreak = 0;
      caught = 0;
      timeLeft = ROUND_TIME;
      level = 1;
      wave = 1;
      speedFactor = 1;
      spawnEvery = 1;
      spawnT = 0.55;
      shake = 0;
      slowT = 0;
      timeScale = 1;
      shownScore = -1;
      shownSec = -1;
      shownLives = -1;
      shownLevel = -1;
      countShown = -1;
      basket.x = LW / 2;
      basket.vx = 0;
      basket.tilt = 0;
      basket.sq = 0;
      basket.sqv = 0;
      targetX = LW / 2;
      ptrX = LW / 2;
      clearObjects();
      hideCombo();
      hudScore(false);
      hudLives();
      hudTime();
      hudLevel();
    }

    function startRound() {
      if (gameMode === 'cauldron') caNewGame();
      resetRound();
      autoPaused = false;
      state = 'countdown';
      countT = 0;
      showScreen(null);
      setPauseBtn(true);
      last = 0;
      if (gameMode === 'cauldron') hudCauldron();
    }

    function setMode(next, silent) {
      gameMode = next === 'cauldron' ? 'cauldron' : 'candy';
      HW.storage.set(MODE_KEY, gameMode);

      HW.$$('[data-mode]').forEach(function (btn) {
        var on = btn.getAttribute('data-mode') === gameMode;
        btn.classList.toggle('is-on', on);
        btn.setAttribute('aria-selected', on ? 'true' : 'false');
      });

      if (els.level) els.level.hidden = gameMode !== 'candy';
      if (els.ca) els.ca.hidden = gameMode !== 'cauldron';
      if (els.rulesCandy) els.rulesCandy.hidden = gameMode !== 'candy';
      if (els.rulesCauldron) els.rulesCauldron.hidden = gameMode !== 'cauldron';
      if (els.endlessWrap) els.endlessWrap.hidden = gameMode !== 'candy';

      if (els.startBtn) {
        els.startBtn.textContent = gameMode === 'cauldron' ? 'Разжечь котёл' : 'Начать охоту';
      }

      if (gameMode === 'cauldron') caNewGame();
      else ca = null;

      state = 'idle';
      showScreen(els.start);
      setPauseBtn(false);
      if (!silent) {
        say(gameMode === 'cauldron'
          ? 'Котёл: отбивай тыкву и разбивай надгробья.'
          : 'Candy Catch: лови конфеты, не лови крыс.');
      }
    }

    /* бесконечная ночь: таймер не завершает игру, а начинает новую волну */
    function nextWave() {
      wave += 1;
      if (lives < LIVES_MAX) {
        lives += 1;
        hudLives();
      }
      timeLeft = ROUND_TIME;
      streak = 0;
clearObjects();
      hideCombo();
      shownSec = -1;
      shownLevel = -1;
      shake = 6;
      sceneBurst(basket.x, BY, 'warm', 22);
      els.count.textContent = 'ВОЛНА ' + wave;
      els.count.classList.remove('is-on', 'is-wave');
      void els.count.offsetWidth;
      els.count.classList.add('is-on', 'is-wave');
      state = 'countdown';
      countT = 0;
      countShown = -1;
      hudTime();
      hudLevel();
      last = 0;
    }

    function endRound(reason) {
      if (state === 'over') return;
      if (reason === 'time' && endless) {
        nextWave();
        return;
      }
      state = 'over';
      setPauseBtn(false);
      hideCombo();
      streak = 0;

      var fresh = score > best;
      if (fresh) {
        best = score;
        HW.storage.set(BEST_KEY, best);
      }

      els.overEyebrow.textContent = reason === 'time' ? 'Рассвет наступил' : 'Жизни кончились';
      els.overTitle.textContent = reason === 'time' ? 'Смена окончена' : 'Тебя растерзали';
      els.overNote.hidden = !fresh;
      els.finalScore.textContent = String(score);
      els.finalBest.textContent = String(best);
      els.finalCandy.textContent = String(caught);
      els.finalCombo.textContent = '×' + multOf(bestStreak) + ' · ' + bestStreak;
      if (els.bestStart) els.bestStart.textContent = String(best);

      showScreen(els.over);
      say(reason === 'time' ? 'Время вышло. Счёт ' + score + '.' : 'Игра окончена. Счёт ' + score + '.');
      if (els.retryBtn) els.retryBtn.focus({ preventScroll: true });
    }

    function pause() {
      if (state !== 'playing' && state !== 'countdown') return;
      state = 'paused';
      showScreen(els.pause);
      say('Пауза.');
    }

    function resume() {
      if (state !== 'paused') return;
      autoPaused = false;
      state = prevState;
      showScreen(null);
      last = 0;
      say('Продолжаем.');
    }

    function togglePause() {
      if (state === 'paused') {
        resume();
      } else if (state === 'playing' || state === 'countdown') {
        prevState = state;
        pause();
      }
    }

    function toStart() {
      state = 'idle';
      autoPaused = false;
      setPauseBtn(false);
      resetRound();
      if (els.bestStart) els.bestStart.textContent = String(best);
      showScreen(els.start);
      if (els.startBtn) els.startBtn.focus({ preventScroll: true });
    }

    function catchObject(o, i) {
      objects.splice(i, 1);
      basket.sq = 1;

      if (o.poison) {
        burstShards(o.x, BY - 6, '124,224,138', 18, false);
        sceneBurst(o.x, BY - 10, 'green', 20);
        lives--;
        streak = 0;
        hideCombo();
        hudLives();
        hudScore(false);
        if (!REDUCED) {
          shake = 17;
          if (els.flash && els.flash.animate) {
            els.flash.animate(
              [
                { opacity: 0 },
                { opacity: 0.62 },
                { opacity: 0 }
              ],
              { duration: 460, easing: 'cubic-bezier(0.16,1,0.3,1)' }
            );
          }
        }
        say(lives > 0 ? 'Яд. Жизней осталось: ' + lives + '.' : 'Яд. Жизни кончились.');
        if (lives <= 0) endRound('lives');
        return;
      }

      caught++;
      streak++;
      if (streak > bestStreak) bestStreak = streak;
      var mult = multOf(streak);
      var gain = o.pts * mult;
      score += gain;
      burstShards(o.x, BY - 6, mult >= 3 ? '255,217,160' : '255,138,30', mult >= 3 ? 16 : 11, false);
      sceneBurst(o.x, BY - 10, 'warm', mult >= 3 ? 20 : 13);
      hudScore(true);
      if (mult > 1) showCombo(mult);
      if (streak % 5 === 0 && !REDUCED) slowT = SLOW_DUR;
      say('Поймана ' + o.name + '. Плюс ' + gain + (mult > 1 ? '. Множитель на ' + mult : '') + '. Счёт ' + score + '.');
    }

    function smashObject(o) {
      burstShards(o.x, GROUND_Y, o.poison ? '124,224,138' : '255,138,30', o.poison ? 7 : 10, false);
      if (!REDUCED && !o.poison) shake = Math.max(shake, 3.4);
    }

    function updateBasket(dt) {
      var steps = Math.max(1, Math.min(8, Math.ceil(dt / 0.008)));
      var h = dt / steps;
      var i;
      var minX = BHW - 4;
      var maxX = LW - BHW + 4;
      for (i = 0; i < steps; i++) {
        var a = (targetX - basket.x) * 236 - basket.vx * 22;
        basket.vx += a * h;
        basket.x += basket.vx * h;
        var sAcc = -basket.sq * 260 - basket.sqv * 20;
        basket.sqv += sAcc * h;
        basket.sq += basket.sqv * h;
      }
      if (basket.x <= minX || basket.x >= maxX) {
        basket.x = clamp(basket.x, minX, maxX);
        basket.vx *= 0.35;
      }
      if (basket.sq < 0) {
        basket.sq = 0;
        if (basket.sqv < 0) basket.sqv = 0;
      }

      var tiltT = clamp(basket.vx * 0.00052, -0.34, 0.34);
      basket.tilt += (tiltT - basket.tilt) * Math.min(1, dt * 13);
    }

    function updateTrail() {
      if (REDUCED || !tctx) return;
      tctx.globalCompositeOperation = 'destination-out';
      tctx.fillStyle = 'rgba(0,0,0,0.17)';
      tctx.fillRect(0, 0, LW, LH);
      tctx.globalCompositeOperation = 'lighter';
      tctx.globalAlpha = 0.4;
      var i;
      for (i = 0; i < objects.length; i++) {
        var o = objects[i];
        var sp = o.poison ? glowPoison : glowWarm;
        tctx.drawImage(sp, o.x - 13, o.y - 13, 26, 26);
      }
      tctx.globalAlpha = 1;
      tctx.globalCompositeOperation = 'source-over';
    }

    function update(dt) {
      var gdt = dt * timeScale;
      var i;

      var dir = (keyR ? 1 : 0) - (keyL ? 1 : 0);
      if (dir !== 0) {
        hasPtr = false;
        targetX += dir * KEY_SPEED * dt;
      } else if (hasPtr) {
        targetX = ptrX;
      }
      targetX = clamp(targetX, BHW - 4, LW - BHW + 4);

      updateBasket(dt);

      if (gameMode === 'cauldron') {
        updateCauldronShell(dt);
        return;
      }

      if (state === 'playing') {
        timeLeft -= dt;
        hudTime();

        if (timeLeft <= 0) {
          timeLeft = 0;
          hudTime();
          endRound('time');
        } else {
          var nl = 1 + Math.floor((ROUND_TIME - timeLeft) / STEP_TIME);
          if (nl !== level && nl <= MAX_LEVEL) {
            level = nl;
            speedFactor = 1 + (level - 1) * 0.13;
            spawnEvery = Math.max(0.32, 1 - (level - 1) * 0.08);
            hudLevel();
          }

          spawnT -= gdt;
          if (spawnT <= 0) {
            spawnT = spawnEvery;
            if (objects.length < maxObjects) spawn();
          }

          for (i = objects.length - 1; i >= 0; i--) {
            var o = objects[i];
            o.t += gdt;
            o.vy += GRAV * speedFactor * gdt;
            o.y += o.vy * gdt;
            o.x = o.baseX + Math.sin(o.t * o.swayRate + o.phase) * o.swayAmp;
            o.rot += o.spin * gdt;

            if (!o.checked && o.y >= BY - 22) {
              o.checked = true;
              if (Math.abs(o.x - basket.x) < BHW + o.r * 0.22) {
                catchObject(o, i);
                continue;
              }
              if (streak > 0) {
                streak = 0;
                hideCombo();
              }
            }

            if (o.y > GROUND_Y + 26) {
              smashObject(o);
              objects.splice(i, 1);
            }
          }
        }
      } else if (state === 'countdown') {
        countT += dt;
        var n = 3 - Math.floor(countT / 0.8);
        if (n !== countShown) {
          countShown = n;
          els.count.textContent = n > 0 ? String(n) : 'Лови';
          els.count.classList.remove('is-on', 'is-wave');
          void els.count.offsetWidth;
          els.count.classList.add('is-on');
        }
        if (countT >= 2.45) {
          els.count.classList.remove('is-on', 'is-wave');
          state = 'playing';
          say('Поехали. Лови конфеты.');
        }
      }

      for (i = shards.length - 1; i >= 0; i--) {
        var s = shards[i];
        s.t += gdt;
        s.vy += 1150 * gdt;
        s.x += s.vx * gdt;
        s.y += s.vy * gdt;
        s.rot += s.spin * gdt;
        if (s.t >= s.life) shards.splice(i, 1);
      }

      if (slowT > 0) {
        slowT = Math.max(0, slowT - dt);
        var p = 1 - slowT / SLOW_DUR;
        timeScale = p < 0.18
          ? lerp(1, SLOW_MIN, p / 0.18)
          : lerp(SLOW_MIN, 1, easeOutCubic((p - 0.18) / 0.82));
      } else {
        timeScale = 1;
      }

      if (shake > 0) shake = Math.max(0, shake - dt * 46);

      if (liveT > 0) {
        liveT -= dt;
        if (liveT <= 0 && liveQueued) {
          els.live.textContent = liveQueued;
          liveQueued = '';
          liveT = 0.45;
        }
      }

      updateTrail();
    }

    /* ═══════════════════════════════════════════════════════════
   ВТОРАЯ ИГРА · «КОТЁЛ»
   Тыква отбивается котлом, надгробья разбиваются рядами.
   Позиция котла берётся из basket — ввод остаётся общим.
   ═══════════════════════════════════════════════════════════ */
var CA = {
      W: 112,            // ширина котла
      H: 24,             // высота котла
      BALL_R: 15,
      BRICK_H: 26,
      BRICK_GAP: 7,
      TOP: 72,
      LEFT: 26,
      RIGHT: 26,
      MAX_ROWS: 5,
      BASE_SPEED: 420,
      MAX_SPEED: 1060
    };

    var ca = null;

    function caBuildWave(n) {
      var rows = Math.max(2, CA.MAX_ROWS - Math.floor((n - 1) / 2));
      var cols = 9 + Math.min(3, Math.floor((n - 1) / 2));
      var gapX = CA.BRICK_GAP;
      var totalW = cols * CA.BRICK_H + (cols - 1) * gapX;
      var x0 = (LW - totalW) / 2 + CA.BRICK_H / 2;
      var bricks = [];
      var i, j;

      for (i = 0; i < rows; i++) {
        for (j = 0; j < cols; j++) {
          var rowIn = rows - i;
          var poison = (rowIn === 1) && (j % 3 === 1);
          bricks.push({
            x: x0 + j * (CA.BRICK_H + gapX),
            y: CA.TOP + i * (CA.BRICK_H + gapX),
            poison: poison,
            hp: poison ? 2 : 1,
            pts: poison ? 0 : 10 + rowIn * 5,
            hit: 0
          });
        }
      }
      return { bricks: bricks, rows: rows, cols: cols, total: bricks.length, left: bricks.length };
    }

    function caResetBall() {
      ca.ball = {
        x: basket.x,
        y: CA_Y - 38,
        vx: 0,
        vy: 0,
        r: CA.BALL_R,
        stuck: true,
        speed: Math.min(CA.MAX_SPEED * WORLD_K, (CA.BASE_SPEED + (ca.wave - 1) * 62) * WORLD_K)
      };
    }

    function caLaunch() {
      var b = ca.ball;
      if (!b.stuck) return;
      var a = rnd(-0.62, 0.62);
      b.vx = Math.sin(a) * b.speed;
      b.vy = -Math.cos(a) * b.speed;
      b.stuck = false;
    }

    function caStartWave() {
      var layout = caBuildWave(ca.wave);
      ca.layout = layout;
      ca.bricks = layout.bricks;
      ca.broken = 0;
      caWave = 0;
      caResetBall();
      hudCauldron();
    }

    function caNewGame() {
      ca = { wave: 1, bricks: [], ball: null, broken: 0, launched: false, flash: 0 };
      caStartWave();
    }

    function caSpeedUp() {
      var b = ca.ball;
      var sp = Math.hypot(b.vx, b.vy) || 1;
      var next = Math.min(CA.MAX_SPEED, sp * 1.012);
      b.vx = (b.vx / sp) * next;
      b.vy = (b.vy / sp) * next;
    }

    function caBrickHit(br) {
      br.hp -= 1;
      br.hit = 1;
      if (br.hp > 0) return;
      ca.broken++;
      caWave++;
      if (br.poison) {
        lives -= 1;
        hudLives();
        shake = REDUCED ? 0 : 11;
        flashPoison = REDUCED ? 0 : 1;
        burstShards(br.x, br.y, '140,230,150', 16, false);
        sceneBurst(br.x, br.y, 'poison', 18);
        say('Слизь. Не трогай зелёное.');
        if (lives <= 0) { endRound('lives'); return; }
        hudScore(true);
        hudCauldron();
        return;
      }
      score += br.pts * caWave;
      bestStreak = Math.max(bestStreak, caWave);
      burstShards(br.x, br.y, '255,178,87', 8, false);
      sceneBurst(br.x, br.y, 'warm', 9);
      hudScore(true);
      hudCauldron();
      if (ca.broken >= ca.layout.total) {
        ca.wave++;
        ca.waveFlash = 1;
        shake = REDUCED ? 0 : 7;
        sceneBurst(LW / 2, 260, 'warm', 26);
        els.count.textContent = 'ВОЛНА ' + ca.wave;
        els.count.classList.remove('is-on', 'is-wave');
        void els.count.offsetWidth;
        els.count.classList.add('is-on', 'is-wave');
        state = 'countdown';
        countT = 0;
        countShown = -1;
        hudCauldron();
      }
    }

    function caUpdate(dt) {
      var b = ca.ball;
      var i, k;

      if (ca.waveFlash > 0) {
        ca.waveFlash -= dt * 1.6;
        if (ca.waveFlash <= 0) ca.waveFlash = 0;
      }

      if (b.stuck) {
        b.x = basket.x;
        b.y = CA_Y - 38;
        if (hasPtr || keyL || keyR || ca.launched) caLaunch();
        return;
      }

      var steps = Math.max(1, Math.min(6, Math.ceil(dt / 0.006)));
      var h = dt / steps;

      for (k = 0; k < steps; k++) {
        b.x += b.vx * h;
        b.y += b.vy * h;

        if (b.x - b.r < CA.LEFT) { b.x = CA.LEFT + b.r; b.vx = Math.abs(b.vx); spark(b.x, b.y, 6); }
        if (b.x + b.r > LW - CA.RIGHT) { b.x = LW - CA.RIGHT - b.r; b.vx = -Math.abs(b.vx); spark(b.x, b.y, 6); }
        if (b.y - b.r < CA.TOP - 46) { b.y = CA.TOP - 46 + b.r; b.vy = Math.abs(b.vy); spark(b.x, b.y, 5); }

        /* котёл */
        var py = CA_Y - CA.H / 2;
        if (b.vy > 0 && b.y + b.r >= py && b.y - b.r < py + CA.H + 8 &&
            Math.abs(b.x - basket.x) < CA.W / 2 + b.r) {
          var rel = clamp((b.x - basket.x) / (CA.W / 2), -1, 1);
          var ang = rel * 1.02;
          var sp = Math.hypot(b.vx, b.vy) || ca.ball.speed;
          b.vx = Math.sin(ang) * sp;
          b.vy = -Math.cos(ang) * sp;
          b.y = py - b.r - 0.5;
          basket.sq = 0.34;
          spark(b.x, py, 9);
          caSpeedUp();
        }

        /* надгробья */
        for (i = 0; i < ca.bricks.length; i++) {
          var br = ca.bricks[i];
          if (br.hp <= 0) continue;
          var bx = br.x, by = br.y, br2 = CA.BRICK_H / 2;
          if (Math.abs(b.x - bx) > br2 + b.r) continue;
          if (Math.abs(b.y - by) > br2 + b.r) continue;

          var ox = br2 + b.r - Math.abs(b.x - bx);
          var oy = br2 + b.r - Math.abs(b.y - by);
          if (oy < ox) {
            b.y = by + (b.y > by ? 1 : -1) * (br2 + b.r);
            b.vy = -b.vy;
          } else {
            b.x = bx + (b.x > bx ? 1 : -1) * (br2 + b.r);
            b.vx = -b.vx;
          }
          caBrickHit(br);
          if (state !== 'playing') return;
          break;
        }

        if (b.y - b.r > LH + 30) {
          lives -= 1;
          hudLives();
          shake = REDUCED ? 0 : 9;
          sceneBurst(b.x, LH - 24, 'warm', 16);
          if (lives <= 0) { endRound('lives'); return; }
          caResetBall();
          ca.launched = false;
          hudCauldron();
          return;
        }
      }

      caSpeedUpThrottle -= dt;
      if (caSpeedUpThrottle <= 0) {
        caSpeedUpThrottle = 1.6;
        caSpeedUp();
      }
    }

    function caDraw() {
      var b = ca.ball;
      var i;

      for (i = 0; i < ca.bricks.length; i++) {
        var br = ca.bricks[i];
        if (br.hp <= 0) continue;
        var h = CA.BRICK_H / 2;
        ctx.save();
        ctx.translate(br.x, br.y);
        if (br.hit > 0) {
          ctx.translate(rnd(-2, 2), rnd(-2, 2));
          br.hit = Math.max(0, br.hit - 0.25);
        }
        var dead = br.hp <= 0;
        if (br.poison) {
          ctx.fillStyle = 'rgba(74,120,70,0.95)';
        } else {
          ctx.fillStyle = 'rgba(24,20,36,0.96)';
        }
        ctx.beginPath();
        ctx.moveTo(-h, h);
        ctx.lineTo(-h, -h * 0.15);
        ctx.arc(0, -h * 0.15, h, Math.PI, 0);
        ctx.lineTo(h, h);
        ctx.closePath();
        ctx.fill();

        if (!br.poison) {
          ctx.strokeStyle = 'rgba(196,186,228,0.16)';
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(-h + 4, -h * 0.15);
          ctx.lineTo(-h + 4, h - 6);
          ctx.moveTo(-h + 4, h - 12);
          ctx.lineTo(h - 5, h - 12);
          ctx.stroke();
          ctx.fillStyle = 'rgba(255,138,30,0.34)';
          ctx.beginPath();
          ctx.ellipse(0, -h * 0.15, h * 0.42, h * 0.3, 0, 0, TAU);
          ctx.fill();
        } else {
          ctx.fillStyle = 'rgba(124,224,138,0.5)';
          ctx.beginPath();
          ctx.arc(0, -h * 0.1, h * 0.34, 0, TAU);
          ctx.fill();
        }
        ctx.restore();
      }

      if (flashPoison > 0) {
        flashPoison = Math.max(0, flashPoison - 0.04);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = 'rgba(124,224,138,' + (flashPoison * 0.28).toFixed(3) + ')';
        ctx.fillRect(0, 0, LW, LH);
        ctx.restore();
      }

      if (!b.stuck) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        var gg = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, 40);
        gg.addColorStop(0, 'rgba(255,178,87,0.5)');
        gg.addColorStop(1, 'rgba(255,138,30,0)');
        ctx.fillStyle = gg;
        ctx.beginPath();
        ctx.arc(b.x, b.y, 40, 0, TAU);
        ctx.fill();
        ctx.restore();
      }

      var d = b.r * 2.5;
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.drawImage(sprites.pumpkin, -d / 2, -d / 2, d, d);
      ctx.restore();

      if (b.stuck) {
        ctx.save();
        ctx.globalAlpha = 0.35 + Math.sin(t * 5) * 0.22;
        ctx.fillStyle = '#cfc6ea';
        ctx.font = '600 15px Manrope, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('жми или тапни', b.x, b.y - 30);
        ctx.restore();
      }
    }

function hudCauldron() {
      els.time.textContent = String(ca ? ca.wave : 1);
      els.timeChip.classList.remove('is-low');
      var frac = ca && ca.layout ? ca.broken / ca.layout.total : 0;
      els.timeFill.style.transform = 'scaleX(' + (1 - frac).toFixed(3) + ')';
      var tag = 'Рядов: ' + (ca && ca.layout ? ca.layout.rows : CA.MAX_ROWS) + ' · ×' + caWave;
      if (els.ca) els.ca.textContent = tag;
      els.live.textContent = ca && ca.launched
        ? 'Мышь, стрелки или A и D — котёл твой'
        : 'Жми или тапни, чтобы запустить тыкву';
    }

function spark(x, y, n) {
      if (REDUCED) return;
      for (var i = 0; i < n; i++) {
        shards.push({
          x: x, y: y,
          vx: rnd(-150, 150),
          vy: rnd(-160, 40),
          r: rnd(1, 2.6),
          rgb: '255,190,120',
          t: 0,
          life: rnd(0.25, 0.6)
        });
      }
    }

    var flashPoison = 0;
    var caWave = 0;
    var caSpeedUpThrottle = 0;

    function updateCauldronShell(dt) {
      if (shake > 0) shake = Math.max(0, shake - dt * 46);

      if (liveT > 0) {
        liveT -= dt;
        if (liveT <= 0 && liveQueued) {
          els.live.textContent = liveQueued;
          liveQueued = '';
          liveT = 0.45;
        }
      }

      if (state === 'countdown') {
        countT += dt;
        if (countT >= 2.45) {
          els.count.classList.remove('is-on', 'is-wave');
          state = 'playing';
          hudCauldron();
        }
        return;
      }

      if (state === 'playing') caUpdate(dt);

      updateTrail();
    }

    function draw() {
      var kx = canvas.width / LW;
      var ky = canvas.height / LH;
      var ox = 0;
      var oy = 0;

      if (shake > 0 && !REDUCED) {
        ox = rnd(-shake, shake);
        oy = rnd(-shake, shake) * 0.6;
      }

      ctx.setTransform(kx, 0, 0, ky, 0, 0);
      ctx.drawImage(bgSprite, -26, -26, LW + 52, LH + 52);
      ctx.translate(ox, oy);

      if (!REDUCED) drawAmbience(ctx);

      if (!REDUCED && tctx) ctx.drawImage(trail, 0, 0, LW, LH);

      if (gameMode === 'cauldron') {
        caDraw();
        drawCauldronPaddle();
        drawShards();
        return;
      }

      var i;
      for (i = 0; i < objects.length; i++) {
        var o = objects[i];
        var d = o.r * 2.9;
        ctx.save();
        ctx.translate(o.x, o.y);
        ctx.rotate(o.rot);
        ctx.drawImage(o.sprite, -d / 2, -d / 2, d, d);
        ctx.restore();
      }

      var sw = BK_SPR * BK_SCALE;
      ctx.save();
      ctx.translate(basket.x, BY);
      ctx.rotate(basket.tilt + Math.sin(t * 2.1) * 0.018);
      ctx.scale(1 + basket.sq * 0.16, 1 - basket.sq * 0.2);
      ctx.drawImage(basketSprite, -sw / 2, -BK_RIM * BK_SCALE, sw, sw);
      ctx.restore();

      if (glowGrd) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.translate(basket.x, BY);
        ctx.fillStyle = glowGrd;
        ctx.fillRect(-70, -70, 140, 140);
        ctx.restore();
      }

      ctx.globalAlpha = 1;
      for (i = 0; i < shards.length; i++) {
        var s = shards[i];
        ctx.globalAlpha = clamp((1 - s.t / s.life) * 1.4, 0, 1);
        ctx.fillStyle = 'rgb(' + s.rgb + ')';
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(s.rot);
        ctx.fillRect(-s.r, -s.r * 0.6, s.r * 2, s.r * 1.2);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    }

    function drawShards() {
      ctx.globalAlpha = 1;
      for (var i = 0; i < shards.length; i++) {
        var s = shards[i];
        ctx.globalAlpha = clamp((1 - s.t / s.life) * 1.4, 0, 1);
        ctx.fillStyle = 'rgb(' + s.rgb + ')';
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(s.rot);
        ctx.fillRect(-s.r, -s.r * 0.6, s.r * 2, s.r * 1.2);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    }

    function drawCauldronPaddle() {
      var hw = CA.W / 2;
      var hh = CA.H / 2;
      var y = CA_Y;

      ctx.save();
      ctx.translate(basket.x, y);
      ctx.rotate(basket.tilt * 0.8);

      ctx.fillStyle = 'rgba(6,5,14,0.95)';
      ctx.beginPath();
      ctx.moveTo(-hw, -hh);
      ctx.lineTo(hw, -hh);
      ctx.lineTo(hw * 0.78, hh);
      ctx.quadraticCurveTo(0, hh * 1.5, -hw * 0.78, hh);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = 'rgba(196,186,228,0.34)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(-hw + 5, -hh + 4);
      ctx.lineTo(hw - 5, -hh + 4);
      ctx.stroke();

ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      var pg = ctx.createLinearGradient(0, -hh - 6, 0, -hh + 2);
      pg.addColorStop(0, 'rgba(255,178,87,0)');
      pg.addColorStop(0.6, 'rgba(255,178,87,0.55)');
      pg.addColorStop(1, 'rgba(255,138,30,0.18)');
      ctx.fillStyle = pg;
      ctx.fillRect(-hw - 10, -hh - 6, hw * 2 + 20, 10);
      ctx.restore();

      ctx.strokeStyle = 'rgba(255,196,120,0.4)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(-hw + 4, -hh + 1);
      ctx.lineTo(hw - 4, -hh + 1);
      ctx.stroke();

      ctx.restore();

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.translate(basket.x, y - 4);
      if (glowGrd) ctx.fillStyle = glowGrd;
      ctx.fillRect(-70, -70, 140, 140);
      ctx.restore();
    }

    function tick(now) {
      raf = requestAnimationFrame(tick);
      if (!last) last = now;
      var dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      t += dt;
      if (!REDUCED) updateAmbience(dt);
      if (state !== 'paused') update(dt);
      draw();
    }

    function fit() {
      /* поворот телефона меняет мир; в середине раунда не трогаем,
         иначе счёт и жизни сбросятся без предупреждения */
      if ((state === 'idle' || state === 'over') && applyWorld()) {
        bgSprite = paintBackground();
        buildAmbience();
        if (!REDUCED) {
          trail = makeCanvas(LW, LH);
          tctx = trail.getContext('2d');
        }
        resetRound();
      }

      var box = stage.getBoundingClientRect();
      var availW = Math.max(140, box.width);
      var availH = Math.max(90, box.height);
      var ratio = LW / LH;
      var w = availW;
      var h = w / ratio;
      if (h > availH) {
        h = availH;
        w = h * ratio;
      }
      w = Math.floor(w);
      h = Math.floor(h);
      stageEl.style.width = w + 'px';
      stageEl.style.height = h + 'px';
      var dpr = Math.min(global.devicePixelRatio || 1, LOW ? 1.6 : 2);
      var cw = Math.round(w * dpr);
      var ch = Math.round(h * dpr);
      if (canvas.width !== cw || canvas.height !== ch) {
        canvas.width = cw;
        canvas.height = ch;
      }
    }

    function onPointer(e) {
      var r = stageEl.getBoundingClientRect();
      if (!r.width) return;
      ptrX = clamp(((e.clientX - r.left) / r.width) * LW, BHW - 4, LW - BHW + 4);
      hasPtr = true;
    }

    function isLeftKey(k) {
      return k === 'ArrowLeft' || k === 'a' || k === 'A' || k === 'ф' || k === 'Ф';
    }

    function isRightKey(k) {
      return k === 'ArrowRight' || k === 'd' || k === 'D' || k === 'в' || k === 'В';
    }

    function onKey(e) {
      var k = e.key;

      if (isLeftKey(k) || isRightKey(k)) {
        keyL = isLeftKey(k);
        keyR = isRightKey(k);
        if (state === 'playing' || state === 'countdown') e.preventDefault();
        return;
      }

      if (k === 'Escape') {
        if (state !== 'idle') {
          e.preventDefault();
          togglePause();
        }
        return;
      }

      if (k === ' ' || k === 'Spacebar' || k === 'p' || k === 'P' || k === 'з' || k === 'З') {
        e.preventDefault();
        if (state === 'idle' || state === 'over') startRound();
        else togglePause();
        return;
      }

      if (k === 'Enter') {
        if (state === 'idle' || state === 'over') { e.preventDefault(); startRound(); }
        else if (state === 'paused') { e.preventDefault(); togglePause(); }
      }
    }

    function onKeyUp(e) {
      if (isLeftKey(e.key)) keyL = false;
      if (isRightKey(e.key)) keyR = false;
    }

    function onVisibility() {
      if (document.visibilityState === 'hidden') {
        last = 0;
        if (state === 'playing' || state === 'countdown') {
          prevState = state;
          autoPaused = true;
          pause();
        }
      } else {
        last = performance.now();
        if (autoPaused) {
          autoPaused = false;
          state = prevState;
          showScreen(null);
          say('Продолжаем.');
        }
      }
    }

    function init(sceneApi) {
      scene = sceneApi;

      canvas = HW.$('#cc-canvas');
      stageEl = HW.$('#cc-frame');
      stage = HW.$('#cc-stage');
      if (!canvas || !stageEl || !stage) return false;

      ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) return false;

      els = {
        score: HW.$('#cc-score'),
        time: HW.$('#cc-time'),
        timeFill: HW.$('#cc-timefill'),
        timeChip: HW.$('#cc-timechip'),
        level: HW.$('#cc-level'),
        lives: HW.$$('.cc-life'),
        livesBox: HW.$('#cc-lives'),
        combo: HW.$('#cc-combo'),
        count: HW.$('#cc-count'),
        flash: HW.$('#cc-flash'),
        start: HW.$('#cc-screen-start'),
        over: HW.$('#cc-screen-over'),
        pause: HW.$('#cc-screen-pause'),
        startBtn: HW.$('#cc-start-btn'),
        retryBtn: HW.$('#cc-retry-btn'),
        resumeBtn: HW.$('#cc-resume-btn'),
        quitBtn: HW.$('#cc-quit-btn'),
        pauseBtn: HW.$('#cc-pause-btn'),
        bestStart: HW.$('#cc-best-start'),
        overEyebrow: HW.$('#cc-over-eyebrow'),
        overTitle: HW.$('#cc-over-title'),
        overNote: HW.$('#cc-over-note'),
        finalScore: HW.$('#cc-final-score'),
        finalBest: HW.$('#cc-final-best'),
        finalCandy: HW.$('#cc-final-candy'),
        finalCombo: HW.$('#cc-final-combo'),
        live: HW.$('#cc-live'),
        endless: HW.$('#cc-endless'),
        endlessWrap: HW.$('#cc-endless-wrap'),
        ca: HW.$('#cc-ca'),
        rulesCandy: HW.$('#cc-rules-candy'),
        rulesCauldron: HW.$('#cc-rules-cauldron')
      };

      if (!els.score || !els.time || !els.livesBox || !els.startBtn || !els.over) return false;

      /* мир выбирается до отрисовки фона и спрайтов: на телефоне он
         вытянутый, иначе кадр получался 371×232 */
      applyWorld();

      glowWarm = sprGlow(255, 168, 60);
      glowPoison = sprGlow(140, 230, 150);
      bgSprite = paintBackground();
      buildAmbience();

      sprites = {
        pumpkin: makeSprite(sprPumpkin),
        bat: makeSprite(sprBat),
        ghost: makeSprite(sprGhost),
        rat: makeSprite(sprRat),
        slime: makeSprite(sprSlime)
      };
      basketSprite = makeSprite(sprBasket, BK_SPR);

      if (!REDUCED) {
        trail = makeCanvas(LW, LH);
        tctx = trail.getContext('2d');
      }

      glowGrd = ctx.createRadialGradient(0, 0, 4, 0, 0, 70);
      glowGrd.addColorStop(0, 'rgba(255,178,87,0.22)');
      glowGrd.addColorStop(0.5, 'rgba(255,138,30,0.08)');
      glowGrd.addColorStop(1, 'rgba(255,138,30,0)');

      best = HW.storage.get(BEST_KEY, 0) || 0;

      resetRound();
      if (els.bestStart) els.bestStart.textContent = String(best);
      showScreen(els.start);
      setPauseBtn(false);

      stageEl.addEventListener('pointermove', onPointer, { passive: true });
      stageEl.addEventListener('pointerdown', onPointer, { passive: true });
      stageEl.addEventListener('pointerleave', function () { hasPtr = false; }, { passive: true });

      window.addEventListener('keydown', onKey);
      window.addEventListener('keyup', onKeyUp);
      window.addEventListener('blur', function () {
        keyL = false;
        keyR = false;
      });
      window.addEventListener('resize', fit, { passive: true });
      global.addEventListener('orientationchange', fit, { passive: true });
      global.addEventListener('load', fit, { passive: true });
      if (typeof ResizeObserver === 'function') {
        var ro = new ResizeObserver(fit);
        ro.observe(stage);
      }
      document.addEventListener('visibilitychange', onVisibility);

      els.startBtn.addEventListener('click', startRound);
      if (els.retryBtn) els.retryBtn.addEventListener('click', startRound);
      if (els.resumeBtn) els.resumeBtn.addEventListener('click', togglePause);
      if (els.quitBtn) els.quitBtn.addEventListener('click', toStart);
      if (els.pauseBtn) els.pauseBtn.addEventListener('click', togglePause);

      /* режимы и бесконечная ночь */
      if (els.endless) {
        endless = !!els.endless.checked;
        els.endless.addEventListener('change', function () {
          endless = !!els.endless.checked;
          HW.storage.set(ENDLESS_KEY, endless);
        });
      }

      HW.$$('[data-mode]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          if (state === 'playing' || state === 'countdown') return;
          setMode(btn.getAttribute('data-mode'));
        });
      });

      stageEl.addEventListener('pointerdown', function () {
        if (gameMode === 'cauldron' && ca && ca.ball && ca.ball.stuck && state === 'playing') {
          ca.launched = true;
          caLaunch();
        }
      });

      setMode(gameMode, true);

      fit();
      raf = requestAnimationFrame(tick);
      return true;
    }

    return {
      init: init,
      start: startRound,
      toggle: togglePause,
      destroy: function () {
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
      }
    };
  })();

  HW.ready(function () {
    var scene = HW.scene({
      moon: [0.72, 0.80],
      fogGain: 0.55,
      rayGain: 0.22,
      particles: { embers: 30, fireflies: 8, bats: 4, leaves: 8 }
    });
    HW.transitions();
    HW.markNav('game');
    CandyCatch.init(scene);
  });

  HW.game = CandyCatch;
})(window);