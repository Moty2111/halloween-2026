/* ============================================================
   HALLOWEEN · canvas 2D atmosphere  ·  v1
   Embers · fireflies · bats · falling leaves + burst emitter
   Everything is pre-rendered sprites / paths, DPR-capped,
   pauses when the tab is hidden.

   Usage: HW.particles(canvas, { embers: 40, fireflies: 14, bats: 6, leaves: 10 })
   ============================================================ */
(function (global) {
  'use strict';

  var TAU = Math.PI * 2;

  function rand(a, b) { return a + Math.random() * (b - a); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

  function makeGlowSprite(r, g, b) {
    var s = 64;
    var c = document.createElement('canvas');
    c.width = c.height = s;
    var x = c.getContext('2d');
    var grad = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    grad.addColorStop(0.00, 'rgba(255,255,255,1)');
    grad.addColorStop(0.16, 'rgba(' + r + ',' + g + ',' + b + ',0.95)');
    grad.addColorStop(0.42, 'rgba(' + r + ',' + g + ',' + b + ',0.32)');
    grad.addColorStop(1.00, 'rgba(' + r + ',' + g + ',' + b + ',0)');
    x.fillStyle = grad;
    x.fillRect(0, 0, s, s);
    return c;
  }

/* ── bat anatomy ──────────────────────────────────────────────
       The wing is rebuilt from the stroke angle on every frame instead of
being scaled or skewed. Two things change as the wing beats: the tip
       rides up and down along an arc, and the membrane turns out of the
       picture plane, so its depth — the chord, shoulder to ankle — shrinks
       while the span barely does. Foreshortening the *chord* is what
       separates a beating wing from a flat flag waving on a string;
       foreshortening the span instead just folds the bat into a sliver.

       Leading edge runs shoulder → elbow → wrist → tip across four span
       stations; the trailing edge walks back from tip to ankle along four
       finger bones with sagging scallops between them.

       f: -1 = wings fully down, +1 = fully up. */
    function wingGeo(w, h, f) {
      var A  = f * 1.05;
      var ck = 0.44 + 0.56 * Math.cos(A);   /* chord foreshortening */

      /* a station on the leading edge, u being the span fraction */
      function at(u) {
        return {
          x: w * u * (1 - 0.09 * u * f),
          y: -h * u * (0.34 + 0.16 * u) * f
        };
      }

      var ank = at(0.12);
      ank.y += h * 0.42 * ck;

      return {
        sh: at(0), elbow: at(0.21), wrist: at(0.52), tip: at(1),
        ank: ank, ck: ck
      };
    }

    function wingPath(g, w, h, f) {
      var q = wingGeo(w, h, f);
      var sh = q.sh, tp = q.tip, ank = q.ank;
      var i, t, qx, qy, fx, fy;

      g.beginPath();
      g.moveTo(sh.x, sh.y);

      /* leading edge — bowed so the arm reads as a limb, not a ruler */
      g.quadraticCurveTo(
        sh.x + (q.elbow.x - sh.x) * 0.5,
        sh.y + (q.elbow.y - sh.y) * 0.5 - h * 0.07,
        q.elbow.x, q.elbow.y);
      g.quadraticCurveTo(
        q.elbow.x + (q.wrist.x - q.elbow.x) * 0.5,
        q.elbow.y + (q.wrist.y - q.elbow.y) * 0.5 - h * 0.10,
        q.wrist.x, q.wrist.y);
      g.quadraticCurveTo(
        q.wrist.x + (tp.x - q.wrist.x) * 0.46,
        q.wrist.y + (tp.y - q.wrist.y) * 0.46 - h * 0.11,
        tp.x, tp.y);

      /* trailing edge — four fingers, each span sagging toward the body */
      var FING = [0.26, 0.48, 0.69, 0.88];
      qx = tp.x; qy = tp.y;
      for (i = 0; i < FING.length; i++) {
        t = FING[i];
        fx = tp.x + (ank.x - tp.x) * t;
        fy = tp.y + (ank.y - tp.y) * t;
        g.quadraticCurveTo(
          qx + (fx - qx) * 0.5,
          qy + (fy - qy) * 0.5 + h * 0.16 * q.ck * (1 - t * 0.3),
          fx, fy);
        qx = fx; qy = fy;
      }

      g.quadraticCurveTo(ank.x * 0.4, ank.y * 0.9, sh.x, sh.y);
      g.closePath();
    }

    function drawWing(g, w, h, f, skin, bone, rim) {
      var q = wingGeo(w, h, f);

      wingPath(g, w, h, f);
      g.fillStyle = skin;
      g.fill();

      /* the leading edge catches a little light — this is what makes the
         stroke readable when the membrane itself is nearly black */
      if (rim) {
        g.strokeStyle = rim;
        g.lineWidth = Math.max(0.5, w * 0.022);
        g.lineCap = 'round';
        g.lineJoin = 'round';
        g.beginPath();
        g.moveTo(q.sh.x, q.sh.y);
        g.quadraticCurveTo(
          q.sh.x + (q.elbow.x - q.sh.x) * 0.5,
          q.sh.y + (q.elbow.y - q.sh.y) * 0.5 - h * 0.07,
          q.elbow.x, q.elbow.y);
        g.quadraticCurveTo(
          q.elbow.x + (q.wrist.x - q.elbow.x) * 0.5,
          q.elbow.y + (q.wrist.y - q.elbow.y) * 0.5 - h * 0.10,
          q.wrist.x, q.wrist.y);
        g.quadraticCurveTo(
          q.wrist.x + (q.tip.x - q.wrist.x) * 0.46,
          q.wrist.y + (q.tip.y - q.wrist.y) * 0.46 - h * 0.11,
          q.tip.x, q.tip.y);
        g.stroke();
      }

      /* finger bones — only worth drawing on the near, larger bats */
      if (bone) {
        g.strokeStyle = bone;
        g.lineWidth = Math.max(0.35, w * 0.011);
        g.lineCap = 'round';
        g.beginPath();
        g.moveTo(q.sh.x, q.sh.y);
        g.lineTo(q.wrist.x, q.wrist.y);
        g.lineTo(q.tip.x, q.tip.y);
        var tips = [0.3, 0.52, 0.72, 0.9];
        for (var i = 0; i < tips.length; i++) {
          g.lineTo(q.tip.x + (q.ank.x - q.tip.x) * tips[i],
                   q.tip.y + (q.ank.y - q.tip.y) * tips[i]);
        }
        g.stroke();
      }
    }

    function drawBat(g, p, f) {
      var s = p.size;
      var sy = -f;

      /* tail membrane + legs */
      g.fillStyle = p.membrane;
      g.beginPath();
      g.moveTo(-s * 0.09, s * 0.24);
      g.quadraticCurveTo(0, s * 0.34 + sy * s * 0.03, s * 0.09, s * 0.24);
      g.lineTo(s * 0.05, s * 0.10);
      g.lineTo(-s * 0.05, s * 0.10);
      g.closePath();
      g.fill();

      /* wings */
      var ww = s * 0.72;
      var wh = s * 0.95;
      drawWing(g, ww, wh, f, p.membrane, p.bone, p.rim);
      g.save();
      g.scale(-1, 1);
      drawWing(g, ww, wh, f, p.membrane, p.bone, p.rim);
      g.restore();

      /* body */
      g.fillStyle = p.fur;
      g.beginPath();
      g.ellipse(0, s * 0.13, s * 0.155, s * 0.25, 0, 0, TAU);
      g.fill();

      /* head */
      g.beginPath();
      g.ellipse(0, -s * 0.14, s * 0.165, s * 0.15, 0, 0, TAU);
      g.fill();

      /* snout */
      g.beginPath();
      g.moveTo(-s * 0.07, -s * 0.13);
      g.lineTo(0, s * 0.01);
      g.lineTo(s * 0.07, -s * 0.13);
      g.closePath();
      g.fill();

      /* ears — tall and pointed, the main read at small sizes */
      g.beginPath();
      g.moveTo(-s * 0.14, -s * 0.20);
      g.quadraticCurveTo(-s * 0.25, -s * 0.52, -s * 0.07, -s * 0.29);
      g.closePath();
      g.fill();
      g.beginPath();
      g.moveTo(s * 0.14, -s * 0.20);
      g.quadraticCurveTo(s * 0.25, -s * 0.52, s * 0.07, -s * 0.29);
      g.closePath();
      g.fill();
    }

  function createParticles(canvas, options) {
    if (!canvas) return null;
    var ctx = canvas.getContext('2d');
    if (!ctx) return null;

    var o = Object.assign({
      embers: 44, fireflies: 14, bats: 6, leaves: 10,
      maxDpr: 2, blink: true, batScale: 1
    }, options || {});

    var coarse = window.matchMedia('(pointer: coarse)').matches;
    var dpr = Math.min(window.devicePixelRatio || 1, coarse ? 1.6 : o.maxDpr);
    var W = 0, H = 0, area = 1;

    var spriteWarm = makeGlowSprite(255, 158, 52);
    var spriteGreen = makeGlowSprite(168, 255, 140);
    var spriteBlue = makeGlowSprite(150, 176, 255);

    var embers = [], fireflies = [], bats = [], leaves = [], bursts = [];

    function scaleCounts() {
      var f = Math.max(0.35, Math.min(1.6, area / (1400 * 800)));
      if (coarse) f *= 0.6;
      o.embers = Math.max(0, Math.round(o.embers * f));
      o.fireflies = Math.max(0, Math.round(o.fireflies * f));
      o.bats = Math.max(o.bats > 0 ? 2 : 0, Math.round(o.bats * f));
      o.leaves = Math.max(0, Math.round(o.leaves * f));
    }

    /* ---------- factories ---------- */
    function makeEmber(seed) {
      return {
        x: rand(0, W),
        y: rand(H * 0.32, H + 40),
        vy: rand(-46, -14),
        drift: rand(0.4, 1.5),
        phase: rand(0, TAU),
        r: rand(0.7, 2.6),
        life: rand(0, 1),
        decay: rand(0.012, 0.04),
        warm: Math.random() > 0.22,
        blue: !seed && Math.random() > 0.94,
        flick: rand(0, TAU)
      };
    }
    function makeFirefly() {
      return {
        x: rand(0, W),
        y: rand(H * 0.34, H * 0.98),
        vx: rand(-16, 16),
        vy: rand(-11, 11),
        phase: rand(0, TAU),
        speed: rand(0.4, 1.2),
        r: rand(1.1, 2.4),
        blink: rand(0, TAU),
        blinkRate: rand(0.7, 1.9)
      };
    }
    /* bats keep to the sky — never below the treeline */
    var SKY_TOP = 0;
    var SKY_BOTTOM = 0;

    function makeBat() {
      var depth = Math.random();
      var far = depth > 0.6;
      return {
        depth: depth,
        x: Math.random() > 0.5 ? rand(-180, -40) : rand(W + 40, W + 180),
        y: rand(SKY_TOP + 8, SKY_BOTTOM - 8),
        size: lerp(13, 36, depth) * (o.batScale || 1),
        vx: (Math.random() > 0.5 ? 1 : -1) * lerp(54, 158, 1 - depth),
        vy: rand(-14, 14),
        flap: rand(0, TAU),
        flapRate: lerp(6.6, 4.2, depth) + rand(-0.4, 0.4),
        sway: rand(0.35, 1),
        swayRate: rand(0.4, 1),
        alpha: lerp(0.95, 0.42, depth),
        turn: rand(3, 8),
        bank: 0,
        bob: rand(0, TAU),
        fur: far ? 'rgba(7,6,16,' + lerp(0.78, 0.92, depth).toFixed(2) + ')'
                 : 'rgba(3,3,9,' + lerp(0.92, 1, depth).toFixed(2) + ')',
        /* the membrane sits a few steps off pure black: against the night sky
           a black bat is invisible, and an invisible bat cannot be seen to flap */
        membrane: far ? 'rgba(23,19,42,' + lerp(0.66, 0.8, depth).toFixed(2) + ')'
                      : 'rgba(11,9,22,' + lerp(0.8, 0.92, depth).toFixed(2) + ')',
        bone: depth > 0.72 ? 'rgba(168,158,220,0.34)' : 'rgba(168,158,220,0.18)',
        rim: depth > 0.6 ? 'rgba(216,208,252,' + lerp(0.44, 0.74, depth).toFixed(2) + ')'
                         : 'rgba(216,208,252,0.44)'
      };
    }
    function makeLeaf() {
      return {
        x: rand(-40, W + 40),
        y: rand(-80, -8),
        vy: rand(28, 62),
        vx: rand(-22, 22),
        rot: rand(0, TAU),
        spin: rand(-1.9, 1.9),
        r: rand(3.2, 7.2),
        phase: rand(0, TAU),
        swayAmp: rand(14, 46),
        swayRate: rand(0.5, 1.3),
        hue: Math.random() > 0.5 ? '31,18,10' : '48,26,12'
      };
    }

    function rebuild() {
      SKY_TOP = Math.max(10, H * 0.035);
      /* bats keep to the open sky — the treeline starts around 0.26, and a bat that
   flies through the pine tops reads as a glitch, not as depth */
            SKY_BOTTOM = H * (o.skyBottom != null ? o.skyBottom : 0.26);
      embers = []; fireflies = []; bats = []; leaves = [];
      var i;
      for (i = 0; i < o.embers; i++) embers.push(makeEmber(true));
      for (i = 0; i < o.fireflies; i++) fireflies.push(makeFirefly());
      for (i = 0; i < o.bats; i++) bats.push(makeBat());
      for (i = 0; i < o.leaves; i++) leaves.push(makeLeaf());
    }

    function resize() {
      W = canvas.clientWidth || window.innerWidth;
      H = canvas.clientHeight || window.innerHeight;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      area = W * H;
      scaleCounts();
      rebuild();
    }

    /* ---------- emitter ---------- */
    function burst(x, y, opts) {
      var cfg = Object.assign({ count: 22, spread: TAU, speed: [40, 190], r: [1, 3.4], life: [0.5, 1.1], color: 'warm' }, opts || {});
      var sprite = cfg.color === 'green' ? spriteGreen : cfg.color === 'blue' ? spriteBlue : spriteWarm;
      for (var i = 0; i < cfg.count; i++) {
        var a = (i / cfg.count) * cfg.spread + rand(-0.14, 0.14);
        var sp = rand(cfg.speed[0], cfg.speed[1]);
        bursts.push({
          x: x, y: y,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp - rand(10, 70),
          r: rand(cfg.r[0], cfg.r[1]),
          t: 0,
          life: rand(cfg.life[0], cfg.life[1]),
          sprite: sprite,
          grav: rand(60, 210)
        });
      }
    }

    /* ---------- update / draw ---------- */
    function update(dt) {
      var i, p;

      for (i = 0; i < embers.length; i++) {
        p = embers[i];
        p.phase += dt * p.drift;
        p.flick += dt * 6;
        p.y += p.vy * dt;
        p.x += Math.sin(p.phase) * 14 * dt + Math.cos(p.flick * 0.3) * 5 * dt;
        p.life += p.decay * dt;
        if (p.life >= 1 || p.y < -30) {
          p.life = 0;
          p.y = H + rand(4, 50);
          p.x = rand(0, W);
        }
      }

      for (i = 0; i < fireflies.length; i++) {
        p = fireflies[i];
        p.phase += dt * p.speed;
        p.blink += dt * p.blinkRate;
        p.x += (p.vx + Math.cos(p.phase * 1.7) * 22) * dt;
        p.y += (p.vy + Math.sin(p.phase * 2.3) * 16) * dt;
        if (p.x < -20) p.x = W + 20;
        if (p.x > W + 20) p.x = -20;
        if (p.y < H * 0.28) p.y = H * 0.28;
        if (p.y > H * 0.99) p.y = H * 0.99;
      }

      for (i = 0; i < bats.length; i++) {
        p = bats[i];
        p.flap += dt * p.flapRate;

        p.turn -= dt;
        if (p.turn <= 0) {
          p.turn = rand(3, 8);
          p.vy = rand(-14, 14);
          p.swayRate = rand(0.45, 1.05);
        }

        p.bob += dt * p.flapRate * 0.5;
        p.y += (p.vy + Math.sin(p.bob) * p.sway * 9) * dt;
        p.x += p.vx * dt;

        var bankT = clamp(p.vy / 90, -0.38, 0.38);
        p.bank += (bankT - p.bank) * Math.min(1, dt * 3.4);

        if (p.y < SKY_TOP) { p.y = SKY_TOP; p.vy = Math.abs(p.vy); }
        if (p.y > SKY_BOTTOM) { p.y = SKY_BOTTOM; p.vy = -Math.abs(p.vy); }

        if (p.vx > 0 && p.x > W + p.size * 2.6) { p.x = -p.size * 2.6; p.y = rand(SKY_TOP, SKY_BOTTOM); }
        if (p.vx < 0 && p.x < -p.size * 2.6) { p.x = W + p.size * 2.6; p.y = rand(SKY_TOP, SKY_BOTTOM); }
      }

      for (i = 0; i < leaves.length; i++) {
        p = leaves[i];
        p.phase += dt * p.swayRate;
        p.rot += p.spin * dt;
        p.y += p.vy * dt;
        p.x += (p.vx + Math.cos(p.phase) * p.swayAmp) * dt;
        if (p.y > H + 40) { p.y = -40; p.x = rand(-40, W + 40); }
        if (p.x < -50) p.x = W + 40;
        if (p.x > W + 50) p.x = -40;
      }

      for (i = bursts.length - 1; i >= 0; i--) {
        p = bursts[i];
        p.t += dt;
        p.vy += p.grav * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= 0.985;
        if (p.t >= p.life) bursts.splice(i, 1);
      }
    }

    function drawSprite(sprite, x, y, size, alpha) {
      if (alpha <= 0.004) return;
      ctx.globalAlpha = alpha;
      ctx.drawImage(sprite, x - size, y - size, size * 2, size * 2);
    }

    function draw(dt) {
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';

      var i, p, a;

      /* leaves first (dark, below glow) */
      ctx.globalCompositeOperation = 'source-over';
      for (i = 0; i < leaves.length; i++) {
        p = leaves[i];
        var sq = Math.abs(Math.cos(p.rot * 0.8));
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.scale(1, 0.35 + sq * 0.65);
        ctx.fillStyle = 'rgba(' + p.hue + ',0.85)';
        ctx.beginPath();
        ctx.ellipse(0, 0, p.r, p.r * 0.52, 0, 0, TAU);
        ctx.fill();
        ctx.restore();
      }

      /* bats */
      for (i = 0; i < bats.length; i++) {
        p = bats[i];

        /* asymmetric stroke: the downstroke bites, the recovery eases. A plain
           sine reads as a mechanical see-saw at these speeds. */
        var sn = Math.sin(p.flap % TAU);
        var f = sn < 0 ? -Math.pow(-sn, 1.35) : Math.pow(sn, 0.82);

        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.bank * 0.42);
        ctx.scale(p.vx > 0 ? -1 : 1, 1);
        drawBat(ctx, p, f);
        ctx.restore();
        ctx.globalAlpha = 1;
      }

      /* embers */
      ctx.globalCompositeOperation = 'lighter';
      for (i = 0; i < embers.length; i++) {
        p = embers[i];
        var fade = Math.sin(Math.PI * p.life);
        var tw = 0.65 + 0.35 * Math.sin(p.flick);
        drawSprite(p.blue ? spriteBlue : p.warm ? spriteWarm : spriteGreen, p.x, p.y, p.r * 3.2, fade * tw * 0.85);
      }

      /* fireflies */
      for (i = 0; i < fireflies.length; i++) {
        p = fireflies[i];
        var pulse = Math.max(0, Math.sin(p.blink)) ;
        pulse = Math.pow(pulse, 2.4);
        drawSprite(spriteGreen, p.x, p.y, p.r * (2.6 + pulse * 2.6), 0.20 + pulse * 0.75);
      }

      /* bursts */
      for (i = 0; i < bursts.length; i++) {
        p = bursts[i];
        var k = 1 - p.t / p.life;
        drawSprite(p.sprite, p.x, p.y, p.r * (1.6 + (1 - k) * 2.6), k * k * 0.95);
      }

      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }

    /* ---------- loop ---------- */
    var last = performance.now();
    var raf = 0;
    var running = true;
    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function frame(now) {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      var dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      update(dt);
      draw(dt);
    }

    function onVisibility() {
      if (document.visibilityState === 'visible') {
        if (!running) return;
        last = performance.now();
        if (!raf) raf = requestAnimationFrame(frame);
      } else if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    }

    window.addEventListener('resize', resize, { passive: true });
    window.addEventListener('orientationchange', resize, { passive: true });
    document.addEventListener('visibilitychange', onVisibility);

    resize();

    if (reduced) {
      update(0.016);
      draw(0.016);
      raf = requestAnimationFrame(function (t) { draw(t * 0.0001); raf = 0; });
    } else {
      raf = requestAnimationFrame(frame);
    }

    return {
      burst: burst,
      resize: resize,
      stop: function () {
        running = false;
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
      }
    };
  }

  global.HW = global.HW || {};
  global.HW.particles = createParticles;
})(window);