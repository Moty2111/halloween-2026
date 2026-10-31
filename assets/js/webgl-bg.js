/* ============================================================
   HALLOWEEN · webgl volumetric fog  ·  v1
   Raw WebGL1 · fullscreen quad · zero dependencies
   Sky gradient + moon w/ halo + layered drifting fog +
   god rays + stars + film grain + vignette

   Usage:  HW.fogBackground(document.getElementById('bg-fog'), { moon:[.74,.81] })
   Classic script (no modules) so it also works over file://
   ============================================================ */
(function (global) {
  'use strict';

  var VERT = [
    'attribute vec2 aPos;',
    'void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }'
  ].join('\n');

  var FRAG_BODY = [
    'uniform vec2  uRes;',
    'uniform float uTime;',
    'uniform vec2  uMouse;',
    'uniform vec2  uMoon;',
    'uniform float uOctaves;',
    'uniform float uFogGain;',
    'uniform float uRayGain;',
    '',
    'float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }',
    '',
    'float noise(vec2 p){',
    '  vec2 i = floor(p);',
    '  vec2 f = fract(p);',
    '  vec2 u = f * f * (3.0 - 2.0 * f);',
    '  return mix(',
    '    mix(hash(i + vec2(0.0,0.0)), hash(i + vec2(1.0,0.0)), u.x),',
    '    mix(hash(i + vec2(0.0,1.0)), hash(i + vec2(1.0,1.0)), u.x),',
    '    u.y);',
    '}',
    '',
    'float fbm(vec2 p){',
    '  float v = 0.0;',
    '  float a = 0.5;',
    '  mat2 m = mat2(1.62, 1.18, -1.18, 1.62);',
    '  for (int i = 0; i < 5; i++){',
    '    if (float(i) >= uOctaves) break;',
    '    v += a * noise(p);',
    '    p = m * p;',
    '    a *= 0.5;',
    '  }',
    '  return v;',
    '}',
    '',
    'void main(){',
    '  vec2 uv = gl_FragCoord.xy / uRes;',
    '  vec2 p  = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;',
    '  float t = uTime;',
    '',
    '  /* base sky */',
    '  vec3 sky = mix(vec3(0.031,0.026,0.055), vec3(0.070,0.048,0.115), smoothstep(-0.05, 0.55, p.y));',
    '  sky = mix(sky, vec3(0.016,0.012,0.026), smoothstep(0.10, -0.60, p.y));',
    '',
    '  /* stars */',
    '  vec2 sp = uv * vec2(uRes.x / uRes.y, 1.0) * 62.0;',
    '  float sh = hash(floor(sp) + 3.1);',
    '  float tw = 0.5 + 0.5 * sin(t * 1.7 + sh * 43.0);',
    '  float starMask = step(0.982, sh) * pow(max(p.y, 0.0), 1.6);',
    '  sky += vec3(0.72,0.70,0.92) * starMask * tw * 0.55 * smoothstep(-0.1, 0.6, p.y);',
    '',
    '  /* moon - aspect corrected so the disc stays round */',
    '  vec2 aspect = vec2(uRes.x / uRes.y, 1.0);',
    '  vec2 mp = uMoon + uMouse * 0.012;',
    '  float md = length((uv - mp) * aspect);',
    '  float disc = smoothstep(0.082, 0.070, md);',
    '  float halo = pow(max(0.0, 1.0 - md / 0.62), 3.4);',
    '  float craters = fbm(uv * 26.0 + 7.3);',
    '  vec3 moonCol = mix(vec3(0.94,0.92,1.00), vec3(0.74,0.72,0.90), craters * 0.85);',
    '  sky += moonCol * disc * 0.92;',
    '  sky += vec3(0.42,0.40,0.70) * halo * 0.55;',
    '  sky += vec3(0.20,0.17,0.38) * pow(max(0.0, 1.0 - md / 0.30), 2.0) * 0.7;',
    '',
    '  /* god rays */',
    '  vec2 rel = (uv - mp) * aspect;',
    '  float ang = atan(rel.y, rel.x);',
    '  float rays = fbm(vec2(ang * 5.4, t * 0.06 + 4.0));',
    '  rays = pow(max(rays - 0.34, 0.0), 1.5);',
    '  float rayMask = smoothstep(0.72, 0.02, md) * smoothstep(-0.02, 0.5, p.y);',
    '  sky += vec3(0.36,0.33,0.62) * rays * rayMask * uRayGain;',
    '',
    '  /* layered fog */',
    '  vec2 par = uMouse * 0.05;',
    '  float f1 = fbm(vec2(p.x * 1.55 + t * 0.021 + par.x, p.y * 2.30 - t * 0.010));',
    '  float f2 = fbm(vec2(p.x * 3.10 - t * 0.038 + par.y * 1.6, p.y * 3.90 - t * 0.014) + 21.0);',
    '  float f3 = noise(vec2(p.x * 6.2 + t * 0.055, p.y * 5.4)) * 0.35;',
    '  float ground = smoothstep(0.62, -0.34, p.y);',
    '  float band   = smoothstep(-0.02, 0.40, p.y);',
    '  float density = (f1 * 0.62 + f2 * 0.42 + f3) * (ground * 0.92 + band * 0.26);',
    '  vec3 fogCool = vec3(0.30,0.28,0.44);',
    '  vec3 fogWarm = vec3(0.46,0.30,0.20);',
    '  vec3 fogCol  = mix(fogCool, fogWarm, smoothstep(0.35, 0.0, p.y) * 0.55 + halo * 0.5);',
    '  sky = mix(sky, fogCol, clamp(density * uFogGain, 0.0, 0.86));',
    '',
    '  /* ground mist ribbon */',
    '  float mist = smoothstep(0.92, 0.40, p.y + 0.10 * f2) * (0.55 + 0.45 * f2);',
    '  sky = mix(sky, vec3(0.26,0.24,0.38), clamp(mist * 0.30, 0.0, 0.5));',
    '',
    '  /* ember bokeh */',
    '  float emberN = fbm(vec2(p.x * 4.0 - t * 0.10, p.y * 4.0 - t * 0.42) + 55.0);',
    '  float ember = pow(max(emberN - 0.72, 0.0) * 3.2, 1.6) * smoothstep(0.55, -0.35, p.y);',
    '  sky += vec3(1.0,0.52,0.14) * ember * 0.55;',
    '',
    '  /* film grain */',
    '  float g = hash(gl_FragCoord.xy + fract(t) * 137.0) - 0.5;',
    '  sky += g * 0.028;',
    '',
    '  /* vignette */',
    '  float vig = 1.0 - dot(p, p) * 0.62;',
    '  vig = clamp(pow(max(vig, 0.0), 1.35), 0.0, 1.0);',
    '  sky *= mix(0.42, 1.0, vig);',
    '',
    '  sky = max(sky, vec3(0.0));',
    '  gl_FragColor = vec4(sky, 1.0);',
    '}'
  ].join('\n');

  function buildFrag(precision) {
    return 'precision ' + precision + ' float;\n' + FRAG_BODY;
  }

  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }

  function createFogBackground(canvas, options) {
    if (!canvas) return null;
    var opts = options || {};
    if (opts.moon) opts = Object.assign({ moon: [0.74, 0.81], fogGain: 0.72, rayGain: 0.34, renderScale: 1, maxDpr: 1.5 }, options);
    else opts = Object.assign({ moon: [0.74, 0.81], fogGain: 0.72, rayGain: 0.34, renderScale: 1, maxDpr: 1.5 }, opts);

    var gl = null;
    try {
      gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, powerPreference: 'high-performance', preserveDrawingBuffer: false }) ||
        canvas.getContext('experimental-webgl', { alpha: false, antialias: false, depth: false });
    } catch (e) { gl = null; }

    if (!gl) { canvas.classList.add('is-unsupported'); return null; }

    function compile(type, src) {
      var sh = gl.createShader(type);
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        if (global.console) console.warn('[fog-bg] shader error:', gl.getShaderInfoLog(sh));
        gl.deleteShader(sh);
        return null;
      }
      return sh;
    }

    var vs = compile(gl.VERTEX_SHADER, VERT);
    if (!vs) { canvas.classList.add('is-unsupported'); return null; }

    var fs = compile(gl.FRAGMENT_SHADER, buildFrag('highp'));
    if (!fs) fs = compile(gl.FRAGMENT_SHADER, buildFrag('mediump'));
    if (!fs) { canvas.classList.add('is-unsupported'); return null; }

    var prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.bindAttribLocation(prog, 0, 'aPos');
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      if (global.console) console.warn('[fog-bg] link error:', gl.getProgramInfoLog(prog));
      canvas.classList.add('is-unsupported');
      return null;
    }
    gl.useProgram(prog);

    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    var uRes = gl.getUniformLocation(prog, 'uRes');
    var uTime = gl.getUniformLocation(prog, 'uTime');
    var uMouse = gl.getUniformLocation(prog, 'uMouse');
    var uMoon = gl.getUniformLocation(prog, 'uMoon');
    var uOctaves = gl.getUniformLocation(prog, 'uOctaves');
    var uFogGain = gl.getUniformLocation(prog, 'uFogGain');
    var uRayGain = gl.getUniformLocation(prog, 'uRayGain');

    var coarse = window.matchMedia('(pointer: coarse)').matches;
    var lowPower = coarse || (navigator.hardwareConcurrency || 8) <= 4;
    gl.uniform1f(uOctaves, lowPower ? 3 : 4);
    gl.uniform1f(uFogGain, opts.fogGain);
    gl.uniform1f(uRayGain, opts.rayGain);
    gl.uniform2f(uMoon, opts.moon[0], opts.moon[1]);

    var dpr = Math.min(window.devicePixelRatio || 1, lowPower ? 1 : opts.maxDpr);
    var w = 0, h = 0;

    function resize() {
      var cw = canvas.clientWidth || window.innerWidth;
      var ch = canvas.clientHeight || window.innerHeight;
      var nw = Math.max(1, Math.round(cw * dpr * opts.renderScale));
      var nh = Math.max(1, Math.round(ch * dpr * opts.renderScale));
      if (nw === w && nh === h) return;
      w = nw; h = nh;
      canvas.width = w; canvas.height = h;
      gl.viewport(0, 0, w, h);
      gl.uniform2f(uRes, w, h);
    }

    var mouse = { x: 0, y: 0, tx: 0, ty: 0 };
    var raf = 0;
    var start = performance.now();
    var elapsed = 0;
    var running = true;
    var visible = true;
    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function onPointer(e) {
      mouse.tx = clamp((e.clientX / window.innerWidth) * 2 - 1, -1, 1);
      mouse.ty = clamp(-((e.clientY / window.innerHeight) * 2 - 1), -1, 1);
    }
    function onTouch(e) {
      if (!e.touches || !e.touches.length) return;
      mouse.tx = clamp((e.touches[0].clientX / window.innerWidth) * 2 - 1, -1, 1);
      mouse.ty = clamp(-((e.touches[0].clientY / window.innerHeight) * 2 - 1), -1, 1);
    }
    function onVisibility() {
      visible = document.visibilityState === 'visible';
      if (visible) {
        start = performance.now() - elapsed * 1000;
        if (!raf) raf = requestAnimationFrame(frame);
      } else if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    }
    function onLost(e) { e.preventDefault(); running = false; if (raf) cancelAnimationFrame(raf); raf = 0; }
    function onRestored() { location.reload(); }

    function frame(now) {
      if (!running || !visible) return;
      raf = requestAnimationFrame(frame);
      elapsed = (now - start) / 1000;
      mouse.x += (mouse.tx - mouse.x) * 0.045;
      mouse.y += (mouse.ty - mouse.y) * 0.045;
      gl.uniform1f(uTime, elapsed);
      gl.uniform2f(uMouse, mouse.x, mouse.y);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    window.addEventListener('resize', resize, { passive: true });
    window.addEventListener('orientationchange', resize, { passive: true });
    window.addEventListener('pointermove', onPointer, { passive: true });
    window.addEventListener('touchmove', onTouch, { passive: true });
    document.addEventListener('visibilitychange', onVisibility);
    canvas.addEventListener('webglcontextlost', onLost);
    canvas.addEventListener('webglcontextrestored', onRestored);

    resize();

    if (reduced) {
      gl.uniform1f(uTime, 12.0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    } else {
      raf = requestAnimationFrame(frame);
    }

    return {
      gl: gl,
      resize: resize,
      setMoon: function (x, y) { gl.uniform2f(uMoon, x, y); },
      setFog: function (v) { gl.uniform1f(uFogGain, v); },
      stop: function () { running = false; if (raf) cancelAnimationFrame(raf); raf = 0; }
    };
  }

  global.HW = global.HW || {};
  global.HW.fogBackground = createFogBackground;
})(window);