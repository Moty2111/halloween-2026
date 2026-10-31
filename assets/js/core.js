/* ============================================================
   HALLOWEEN · core runtime  ·  v1
   HW.scene()      — boot fog + particles + overlays
   HW.pointerGlow()
   HW.parallax()
   HW.transitions()
   HW.reveal()
   HW.storage / HW.store
   Classic script · global HW namespace · no build step
   ============================================================ */
(function (global) {
  'use strict';

  var HW = global.HW = global.HW || {};

  /* ---------------- helpers ---------------- */
  HW.$  = function (sel, root) { return (root || document).querySelector(sel); };
  HW.$$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  HW.reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  HW.coarse  = window.matchMedia('(pointer: coarse)').matches;
  HW.lowPower = HW.coarse || (navigator.hardwareConcurrency || 8) <= 4;

  HW.ready = function (fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  };

  HW.clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
  HW.rand  = function (a, b) { return a + Math.random() * (b - a); };

  /* ---------------- safe storage ---------------- */
  var memStore = {};
  HW.storage = {
    get: function (key, fallback) {
      try {
        var raw = localStorage.getItem(key);
        return raw === null ? fallback : JSON.parse(raw);
      } catch (e) {
        return Object.prototype.hasOwnProperty.call(memStore, key) ? memStore[key] : fallback;
      }
    },
    set: function (key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); }
      catch (e) { memStore[key] = value; }
      return value;
    },
    del: function (key) {
      try { localStorage.removeItem(key); } catch (e) { delete memStore[key]; }
    }
  };

  /* ---------------- scene bootstrap ---------------- */
  HW.scene = function (opts) {
    var o = Object.assign({
      fog: true,
      moon: [0.74, 0.81],
      fogGain: 0.72,
      rayGain: 0.34,
      particles: { embers: 44, fireflies: 14, bats: 6, leaves: 10 },
      grain: true,
      vignette: true,
      cursorGlow: true,
      parallax: true
    }, opts || {});

    var api = { fog: null, parts: null };

    /* atmospheric overlays */
    if (o.vignette && !HW.$('.vignette')) document.body.appendChild(Object.assign(document.createElement('div'), { className: 'vignette' }));
    if (o.grain && !HW.$('.grain')) document.body.appendChild(Object.assign(document.createElement('div'), { className: 'grain' }));

    /* WebGL fog */
    if (o.fog) {
      var c = HW.$('#bg-fog') || HW.$('[data-fog]');
      if (c) {
        if (!HW.$('.fallback-sky')) {
          document.body.insertBefore(Object.assign(document.createElement('div'), { className: 'fallback-sky' }), document.body.firstChild);
        }
        api.fog = HW.fogBackground(c, { moon: o.moon, fogGain: o.fogGain, rayGain: o.rayGain });
      }
    }

    /* canvas particles */
    if (o.particles) {
      var pc = HW.$('#fx-parts');
      if (pc) api.parts = HW.particles(pc, o.particles);
    }

    if (o.cursorGlow) HW.pointerGlow();
    if (o.parallax) HW.parallax();

    return api;
  };

  /* ---------------- cursor glow ---------------- */
  HW.pointerGlow = function () {
    if (HW.coarse || HW.reduced) return null;
    if (HW.$('.pointer-glow')) return null;

    var el = document.createElement('div');
    el.className = 'pointer-glow';
    document.body.appendChild(el);

    var x = 0, y = 0, tx = 0, ty = 0, raf = 0, on = false;

    function loop() {
      x += (tx - x) * 0.16;
      y += (ty - y) * 0.16;
      el.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0)';
      raf = requestAnimationFrame(loop);
    }

    function move(e) {
      tx = e.clientX; ty = e.clientY;
      if (!on) { on = true; el.classList.add('is-on'); if (!raf) raf = requestAnimationFrame(loop); }
    }
    function leave() { on = false; el.classList.remove('is-on'); }

    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('pointerleave', leave, { passive: true });
    window.addEventListener('blur', leave);
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') { leave(); if (raf) { cancelAnimationFrame(raf); raf = 0; } }
      else if (on && !raf) raf = requestAnimationFrame(loop);
    });

    return el;
  };

  /* ---------------- pointer parallax ---------------- */
  HW.parallax = function (root) {
    var layers = HW.$$('[data-depth]', root);
    if (!layers.length) return null;
    if (HW.reduced || HW.coarse) {
      layers.forEach(function (l) { l.style.transform = ''; });
      return null;
    }

    var px = 0, py = 0, cx = 0, cy = 0, raf = 0, visible = true;

    function loop() {
      cx += (px - cx) * 0.07;
      cy += (py - cy) * 0.07;
      for (var i = 0; i < layers.length; i++) {
        var d = parseFloat(layers[i].getAttribute('data-depth')) || 0;
        layers[i].style.transform =
          'translate3d(' + (cx * d).toFixed(2) + 'px,' + (cy * d).toFixed(2) + 'px,0)';
      }
      if (Math.abs(px - cx) < 0.05 && Math.abs(py - cy) < 0.05) {
        raf = requestAnimationFrame(loop);
      } else {
        raf = requestAnimationFrame(loop);
      }
    }

    function onMove(e) {
      px = (e.clientX / window.innerWidth - 0.5) * 2;
      py = (e.clientY / window.innerHeight - 0.5) * 2;
    }

    window.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('visibilitychange', function () {
      visible = document.visibilityState === 'visible';
      if (!visible && raf) { cancelAnimationFrame(raf); raf = 0; }
      else if (visible && !raf) raf = requestAnimationFrame(loop);
    });
    raf = requestAnimationFrame(loop);

    return layers;
  };

  /* ---------------- reveal on scroll ---------------- */
  HW.reveal = function (root) {
    var items = HW.$$('[data-reveal]', root);
    if (!items.length) return;

    if (HW.reduced || !('IntersectionObserver' in global)) {
      items.forEach(function (el) { el.classList.add('is-in'); });
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        en.target.classList.add('is-in');
        io.unobserve(en.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });

    items.forEach(function (el) {
      var d = el.getAttribute('data-reveal');
      if (d && d !== '' && !isNaN(parseFloat(d))) el.style.setProperty('--reveal-delay', d + 's');
      io.observe(el);
    });
  };

  /* ---------------- fog page transition ---------------- */
  HW.transitions = function () {
    var wipe = HW.$('.fog-wipe');
    if (!wipe) {
      wipe = document.createElement('div');
      wipe.className = 'fog-wipe';
      document.body.appendChild(wipe);
    }

    function isInternal(a) {
      if (!a || !a.href) return false;
      if (a.target && a.target !== '_self') return false;
      if (a.hasAttribute('download')) return false;
      if (a.dataset.noTransition !== undefined) return false;
      var href = a.getAttribute('href');
      if (!href || href.charAt(0) === '#' || /^(mailto:|tel:|javascript:)/i.test(href)) return false;
      return a.origin === location.origin;
    }

    document.addEventListener('click', function (e) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var a = e.target.closest ? e.target.closest('a') : null;
      if (!a || !isInternal(a)) return;

      var target = a.href;
      var hash = a.getAttribute('href').split('#')[1];
      if (target.split('#')[0] === location.href.split('#')[0] && hash) return; // same page anchor

      e.preventDefault();
      wipe.classList.add('is-on');
      document.body.classList.add('is-locked');
      setTimeout(function () {
        location.href = target;
      }, HW.reduced ? 60 : 560);
    }, false);

    global.addEventListener('pageshow', function (e) {
      if (e.persisted) {
        wipe.classList.remove('is-on');
        document.body.classList.remove('is-locked');
      }
    });
    global.addEventListener('pagehide', function () {
      wipe.classList.remove('is-on');
    });

    return wipe;
  };

  /* ---------------- nav current page ---------------- */
  HW.markNav = function (key) {
    HW.$$('.navlinks a').forEach(function (a) {
      if (a.getAttribute('data-page') === key) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
  };

  /* ---------------- misc ---------------- */
  HW.rafThrottle = function (fn) {
    var queued = false;
    return function () {
      var self = this, args = arguments;
      if (queued) return;
      queued = true;
      requestAnimationFrame(function () { queued = false; fn.apply(self, args); });
    };
  };

  HW.ready(function () {
    document.documentElement.classList.remove('no-js');
    if (!HW.$('.grain') && !HW.$('.vignette')) {
      /* overlays are opt-in per scene; nothing to do here */
    }
  });
})(window);