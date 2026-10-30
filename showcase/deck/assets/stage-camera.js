/**
 * @ddx       util
 * @domain    misc
 * @topic     engine
 * @purpose   2.5D stage camera (cam-push, cam-pan, breathe, orbit-lite) and the ambient layer (drift, depth-parallax, grain) baked onto each DDXMaster scene child, seek-pure and finite.
 * @status    reusable
 */
/* ============================================================
   stage-camera.js — DDXMaster.camera (plain browser script, no modules)
   ------------------------------------------------------------
   Load: in CUE_FILES order (scripts/cue-files.mjs), after motion-presets.js.
   Works whether DDXMaster exists yet or not (compose-stage loads the cue
   files before master-timeline.js): it attaches when DDXMaster is created
   and wraps DDXMaster.build() when that is defined.

   build(tl3, opts) then rigs every scene when opts.camera === true, or when
   any scene carries a camera field (storyboard-authored); opts.camera ===
   false turns it off. Pages without camera data keep their pixels.
     camera   scene.camera = 'push' | { move, zoom, focus|target, from, to } (or the
              section's data-camera attribute). Moves:
                push   (cam-push)   scale 1 -> zoom (1.6) toward the focus anchor
                pan    (cam-pan)    translate from anchor [data-cam-from] to [data-cam-to]
                breathe             scale 1 -> 1.015 -> 1, sine
                orbit  (orbit-lite) rotateY 0 -> +3 -> -3 -> 0 deg, perspective 1200
                hold   (none)       no camera move
              Rig = the section's .ddx-camera (layer contract: text sits
              outside it), else the section. #stage-world stays owned by the
              camera TRANSITION (engine/transitions.js): section transforms
              compose under the world anchor, they never fight it.
     ambient  background layers (.ambient-blob, .parallax-bg, [data-ambient],
              [data-layer="bg"]) drift (y +-4 px, rotation +-0.5 deg, 8-12 s
              period); [data-depth-map] layers get depth-parallax; a section
              with none — and every 'hold' scene — gets a grain shift (seeded
              noise overlay [data-ddx-grain], background-position stepped).
              Text (h1-h6, p, li, .frame, .textlayer, own text) never drifts.
   Every tween sits on the scene child, starts at the identity state (a fresh
   seek and a rewind agree), and ends inside scene.durMs: finite, no
   repeat:-1, no callbacks, no wall clock, no unseeded random. Seek order
   (task 046): that identity is also set at build, and SVG text in a scene
   gets text-rendering: geometricPrecision, so a forward and a reverse walk
   leave the same DOM and raster.
   prefers-reduced-motion (DDXPresets.isReduced): no camera, no ambient.
   Title-safe (task 041): push / pan / breathe / orbit are clamped at build so
   every text box in the rig stays inside the section box inset 5% for the
   whole move (camera.safe = false turns it off, a number sets the inset).

   Manual: DDXMaster.camera(child, sceneEl, scene) inside a DDXMaster.scene
   builder (then build with { camera: false } for that page).
   View:   DDXMaster.cameraPlan() -> [{ scene, move, rig, ambient: [...] }].
           DDXMaster.cameraFraming() -> [{ scene, move, want, got, clamped }].
   ============================================================ */
(function () {
  'use strict';
  if (window.DDXCameraRig) return;
  var R = window.DDXCameraRig = { plan: [], framing: [] };
  // Move names: engine/motion-verbs.json camera.moves keys (task 017), plus
  // the preset names and the timeline-v3 fixture's 'push-in'.
  var MOVES = { push: 'push', 'push-in': 'push', 'cam-push': 'push', pan: 'pan', 'cam-pan': 'pan',
    breathe: 'breathe', orbit: 'orbit', 'orbit-lite': 'orbit', hold: 'hold', none: 'hold' };
  var BG = '.ambient-blob,.parallax-bg,[data-ambient],[data-layer="bg"],[data-depth-map]';
  var TEXT = 'h1,h2,h3,h4,h5,h6,p,li,blockquote,figcaption,.frame,.textlayer';

  function report(kind, msg) { window.DDXCue._lib.report(kind, msg); }
  function ease(key, dflt) {
    var P = window.DDXPresets;
    try { return P && P.ease ? P.ease(key) : dflt; } catch (e) { return dflt; }
  }
  function reduced() { var P = window.DDXPresets; return !!(P && P.isReduced && P.isReduced({})); }

  // Seeded PRNG (mulberry32): the grain is the same on every load.
  function rng(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  var grainUrl = null;
  function grainTexture() {
    if (grainUrl) return grainUrl;
    var c = document.createElement('canvas'), n = 128, r = rng(0x5EED);
    c.width = c.height = n;
    var ctx = c.getContext('2d'), img = ctx.createImageData(n, n);
    for (var i = 0; i < img.data.length; i += 4) {
      var v = Math.floor(r() * 256);
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    grainUrl = c.toDataURL('image/png');
    return grainUrl;
  }
  // One overlay per section, created outside the timeline (identity = 0px 0px).
  function grainLayer(sec) {
    var el = sec.querySelector(':scope > [data-ddx-grain]');
    if (el) return el;
    el = document.createElement('div');
    el.setAttribute('data-ddx-grain', '');
    el.setAttribute('aria-hidden', 'true');
    el.style.cssText = 'position:absolute;inset:0;z-index:40;pointer-events:none;opacity:.06;' +
      'background-image:url(' + grainTexture() + ');background-size:128px 128px;background-position:0px 0px';
    sec.appendChild(el);
    return el;
  }

  function isText(el) {
    if (el.matches(TEXT) || el.closest('.frame,.textlayer') || el.querySelector(TEXT)) return true;
    for (var n = el.firstChild; n; n = n.nextSibling) if (n.nodeType === 3 && n.nodeValue.trim()) return true;
    return false;
  }
  function moveOf(scene, sec) {
    var c = scene.camera, raw = (c && typeof c === 'object' ? c.move : c) || (sec && sec.getAttribute('data-camera')) || null;
    if (raw == null) return { move: null, o: {} };
    var m = MOVES[String(raw)];
    if (!m) { report('camera-move', 'scene ' + scene.id + ': unknown camera move "' + raw + '" — hold used'); m = 'hold'; }
    var o = c && typeof c === 'object' ? c : {};
    if (o.target && !o.focus) o = Object.assign({}, o, { focus: o.target });   // 017 emits target = focus selector
    return { move: m, o: o };
  }
  R._h = { report: report, ease: ease, reduced: reduced, grainLayer: grainLayer, isText: isText, moveOf: moveOf, BG: BG };
})();

/* ---- part 2a: title-safe framing (task 041) ----
   Every text box in the rig (text-node ranges, so kit cards count too) must
   stay inside the title-safe area (section box, 5% inset) for the whole move.
   A box that already starts in the margin may stay there, never move further
   out. Push / pan / breathe are affine in the eased progress, so a clamped end
   state keeps every in-between frame inside too; orbit is checked per corner
   for both signs of the angle. Measured once at build with the rig at
   identity (master clock only: no per-frame or wall-clock work). */
(function (R) {
  'use strict';
  if (R.fit) return;
  // Rect r in the rig's own, untransformed px (same frame as centreIn).
  function local(rig, r) {
    var W = rig.getBoundingClientRect(), k = (rig.offsetWidth ? W.width / rig.offsetWidth : 1) || 1;
    return { x0: (r.left - W.left) / k, y0: (r.top - W.top) / k, x1: (r.right - W.left) / k, y1: (r.bottom - W.top) / k };
  }
  function textBoxes(rig) {
    var out = [], walk = document.createTreeWalker(rig, NodeFilter.SHOW_TEXT), range = document.createRange(), n;
    while ((n = walk.nextNode())) {
      if (!n.nodeValue.trim() || (n.parentElement && n.parentElement.closest('script,style,template,noscript'))) continue;
      range.selectNodeContents(n);
      var r = range.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) out.push(local(rig, r));
    }
    return out;
  }
  // limits(rig, sec, inset) -> [{ b: box, a: allowed }] or null (no text).
  function limits(rig, sec, inset) {
    var boxes = textBoxes(rig);
    if (!boxes.length) return null;
    var f = local(rig, sec.getBoundingClientRect()), ix = (f.x1 - f.x0) * inset, iy = (f.y1 - f.y0) * inset;
    var S = { x0: f.x0 + ix, y0: f.y0 + iy, x1: f.x1 - ix, y1: f.y1 - iy };
    return boxes.map(function (b) {
      return { b: b, a: { x0: Math.min(S.x0, b.x0), y0: Math.min(S.y0, b.y0), x1: Math.max(S.x1, b.x1), y1: Math.max(S.y1, b.y1) } };
    });
  }
  // Translations T on one axis that keep x' = T + z*x inside every limit.
  function span(L, z, lo, hi) {
    var s = { min: -Infinity, max: Infinity };
    L.forEach(function (e) { s.min = Math.max(s.min, e.a[lo] - z * e.b[lo]); s.max = Math.min(s.max, e.a[hi] - z * e.b[hi]); });
    return s;
  }
  function clamp(v, s) { return Math.max(s.min, Math.min(s.max, v)); }
  function fits(L, z, o) {
    var sx = span(L, z, 'x0', 'x1'), sy = span(L, z, 'y0', 'y1');
    if (!o) return sx.min <= sx.max && sy.min <= sy.max;
    var tx = (1 - z) * o.x, ty = (1 - z) * o.y;   // scale z about origin o
    return tx >= sx.min && tx <= sx.max && ty >= sy.min && ty <= sy.max;
  }
  // Largest v in [lo, hi] with ok(v); ok(lo) holds (identity).
  function most(ok, lo, hi) {
    if (ok(hi)) return hi;
    for (var i = 0; i < 30; i++) { var m = (lo + hi) / 2; if (ok(m)) lo = m; else hi = m; }
    return lo;
  }
  function orbitOk(L, deg, o, P) {
    var t = deg * Math.PI / 180, c = Math.cos(t), s = Math.sin(t), eps = 0.01;
    return L.every(function (e) {
      return [e.b.x0, e.b.x1].every(function (x) {
        return [1, -1].every(function (sg) {
          var dx = x - o.x, f = P / (P + sg * dx * s), px = o.x + dx * c * f;   // rotateY: z' = -dx sin(sg t)
          var y0 = o.y + (e.b.y0 - o.y) * f, y1 = o.y + (e.b.y1 - o.y) * f;
          return px >= e.a.x0 - eps && px <= e.a.x1 + eps && y0 >= e.a.y0 - eps && y1 <= e.a.y1 + eps;
        });
      });
    });
  }
  R.fit = {
    limits: limits,
    // push toward point p: x' = X + z*x (origin 0 0), X = c - z*p wanted.
    push: function (L, z, p, c) {
      if (L) z = most(function (v) { return fits(L, v); }, 1, z);
      var X = c.x - z * p.x, Y = c.y - z * p.y;
      if (L) { X = clamp(X, span(L, z, 'x0', 'x1')); Y = clamp(Y, span(L, z, 'y0', 'y1')); }
      return { z: z, x: X, y: Y };
    },
    pan: function (L, x, y) {
      return L ? { x: clamp(x, span(L, 1, 'x0', 'x1')), y: clamp(y, span(L, 1, 'y0', 'y1')) } : { x: x, y: y };
    },
    breathe: function (L, s, o) { return L ? most(function (v) { return fits(L, v, o); }, 1, s) : s; },
    orbit: function (L, deg, o, P) { return L ? most(function (v) { return orbitOk(L, v, o, P); }, 0, deg) : deg; },
  };
})(window.DDXCameraRig);

/* ---- part 2a2: tween + anchor helpers for the camera moves ---- */
(function (R) {
  'use strict';
  if (R._t) return;
  var H = R._h;
  // Every chain on an element starts at child time 0 with its identity state.
  // That state is also set at build, outside the timeline (task 046): a seek
  // back past the scene start renders the from-state inline (transform:
  // translate(0px, 0px) ...), a forward walk never touches the element, so the
  // DOM — and the composited raster — would depend on the seek order.
  // The origin goes in as px: a set writes '50% 50%' as given, a tween render
  // writes '960px 540px', and the two must leave the same inline style.
  function originPx(el, o) {
    var size = [el.offsetWidth || 0, el.offsetHeight || 0];
    return String(o).trim().split(/\s+/).slice(0, 2).map(function (tok, i) {
      var n = parseFloat(tok) || 0;
      return (/%$/.test(tok) ? n / 100 * size[i] : n) + 'px';
    }).join(' ');
  }
  function ft(tl, el, from, to, d, e, at) {
    if (from.transformOrigin != null) from = Object.assign({}, from, { transformOrigin: originPx(el, from.transformOrigin) });
    if (at === 0) window.gsap.set(el, from);
    tl.fromTo(el, from, Object.assign({}, to, { duration: d, ease: e, immediateRender: false }), at);
  }
  // Point of el (centre) in the rig's own, untransformed px.
  function centreIn(rig, el) {
    var W = rig.getBoundingClientRect(), k = rig.offsetWidth ? W.width / rig.offsetWidth : 1, B = el.getBoundingClientRect();
    return { x: (B.left + B.width / 2 - W.left) / (k || 1), y: (B.top + B.height / 2 - W.top) / (k || 1) };
  }
  function pick(sec, sel, attr) {
    var hit = null;
    if (sel) { try { hit = sec.querySelector(sel); } catch (e) { H.report('bad-selector', 'camera anchor "' + sel + '" is not a valid selector'); } }
    return hit || sec.querySelector('[' + attr + ']');
  }
  // Title-safe inset: camera.safe = false (off) or a ratio 0-0.25 (default 0.05).
  function safeLimits(rig, sec, o) {
    if (o.safe === false) return null;
    var k = typeof o.safe === 'number' && o.safe >= 0 && o.safe <= 0.25 ? o.safe : 0.05;
    return R.fit.limits(rig, sec, k);
  }
  R._t = { ft: ft, centreIn: centreIn, pick: pick, safeLimits: safeLimits };
})(window.DDXCameraRig);

/* ---- part 2: camera moves + ambient layer on one scene child ---- */
(function (R) {
  'use strict';
  if (R.rig) return;
  var H = R._h;
  var T = R._t, ft = T.ft, centreIn = T.centreIn, pick = T.pick, safeLimits = T.safeLimits;
  // Returns { want, got } amounts (zoom / px / scale / deg) for the framing log.
  function camera(tl, rig, sec, move, o, d) {
    var w = rig.offsetWidth || 1, h = rig.offsetHeight || 1, c = { x: w / 2, y: h / 2 }, L = safeLimits(rig, sec, o), F = R.fit;
    if (move === 'push') {
      var z = o.zoom > 0 ? Number(o.zoom) : 1.6, f = pick(sec, o.focus, 'data-cam-focus'), p = f ? centreIn(rig, f) : c, q = F.push(L, z, p, c);
      ft(tl, rig, { x: 0, y: 0, scale: 1, transformOrigin: '0 0' }, { x: q.x, y: q.y, scale: q.z }, d, H.ease('cam', 'power2.inOut'), 0);
      return { want: z, got: q.z };
    } else if (move === 'pan') {
      var a = pick(sec, o.from, 'data-cam-from'), b = pick(sec, o.to, 'data-cam-to');
      var pa = a ? centreIn(rig, a) : c, pb = b ? centreIn(rig, b) : { x: c.x + 0.06 * w, y: c.y }, t = F.pan(L, pa.x - pb.x, pa.y - pb.y);
      ft(tl, rig, { x: 0, y: 0 }, { x: t.x, y: t.y }, d, H.ease('cam', 'power2.inOut'), 0);
      return { want: Math.hypot(pa.x - pb.x, pa.y - pb.y), got: Math.hypot(t.x, t.y) };
    } else if (move === 'breathe') {
      var s = F.breathe(L, 1.015, c);
      ft(tl, rig, { scale: 1, transformOrigin: '50% 50%' }, { scale: s }, d / 2, 'sine.inOut', 0);
      ft(tl, rig, { scale: s }, { scale: 1 }, d / 2, 'sine.inOut', d / 2);
      return { want: 1.015, got: s };
    } else if (move === 'orbit') {
      var r = F.orbit(L, 3, c, 1200), v = function (x) { return { rotationY: x, transformPerspective: 1200, transformOrigin: '50% 50%' }; };
      ft(tl, rig, v(0), v(r), d / 4, 'sine.inOut', 0);
      ft(tl, rig, v(r), v(-r), d / 2, 'sine.inOut', d / 4);
      ft(tl, rig, v(-r), v(0), d / 4, 'sine.inOut', d * 3 / 4);
      return { want: 3, got: r };
    }
    return null;
  }
  // Drift: n whole cycles of 8-12 s; each cycle 0 -> -4 -> +4 -> 0.
  function drift(tl, el, d) {
    var n = Math.max(1, Math.round(d / 10)), T = d / n;
    var k = function (s) { return { y: 4 * s, rotation: 0.5 * s }; };
    for (var i = 0; i < n; i++) {
      ft(tl, el, k(0), k(-1), T / 4, 'sine.inOut', i * T);
      ft(tl, el, k(-1), k(1), T / 2, 'sine.inOut', i * T + T / 4);
      ft(tl, el, k(1), k(0), T / 4, 'sine.inOut', i * T + T * 3 / 4);
    }
  }
  function depth(tl, el, d) {
    var a = 0.03 * (el.offsetWidth || 100);
    ft(tl, el, { x: 0, y: 0, scale: 1, transformOrigin: '50% 50%' }, { x: -a, y: a / 3, scale: 1.04 }, d, 'none', 0);
  }
  // Stepped background shift: 8 jumps a second, each a new noise field.
  function grain(tl, sec, d) {
    var g = H.grainLayer(sec), n = Math.max(1, Math.round(d * 8));
    ft(tl, g, { backgroundPosition: '0px 0px' }, { backgroundPosition: (61 * n) + 'px ' + (29 * n) + 'px' }, d, 'steps(' + n + ')', 0);
  }
  function ambient(tl, sec, move, d) {
    var done = [];
    if (move !== 'hold') {
      Array.prototype.slice.call(sec.querySelectorAll(H.BG)).filter(function (el) { return !H.isText(el); }).forEach(function (el) {
        if (el.hasAttribute('data-depth-map')) { depth(tl, el, d); done.push('depth-parallax'); } else { drift(tl, el, d); done.push('ambient-drift'); }
      });
    }
    if (!done.length) { grain(tl, sec, d); done.push('grain'); }
    return done;
  }

  /* rig(child, sceneEl, scene) — camera + ambient on one scene child. */
  R.rig = function (tl, sec, scene) {
    var d = (scene.durMs || 0) / 1000;
    var rec = { scene: scene.id, move: null, rig: null, ambient: [] };
    if (!sec || !(d > 0) || H.reduced()) { R.plan.push(rec); return rec; }
    var m = H.moveOf(scene, sec), rig = sec.querySelector(':scope > .ddx-camera') || sec.querySelector('.ddx-camera') || sec;
    rec.move = m.move || 'none';
    if (m.move && m.move !== 'hold') {
      rec.rig = rig === sec ? 'section' : '.ddx-camera';
      var g = camera(tl, rig, sec, m.move, m.o, d);
      if (g) R.framing.push({ scene: scene.id, move: m.move, want: g.want, got: g.got, clamped: g.got !== g.want });
    }
    rec.ambient = ambient(tl, sec, m.move, d);
    R.plan.push(rec);
    return rec;
  };
})(window.DDXCameraRig);

/* ---- part 3: attach to DDXMaster (now or when master-timeline.js loads) ---- */
(function (R) {
  'use strict';
  if (R.attach) return;
  // SVG text under a scaled HTML ancestor is laid out with a font scaled to
  // the screen scale of its LAST layout, not the current one, so a chart label
  // inside a push rig got a different width (and raster) per seek order (task
  // 046). geometricPrecision lays it out at the unscaled size: seek-pure.
  function svgTextRule() {
    if (document.querySelector('style[data-ddx-camera-text]')) return;
    var s = document.createElement('style');
    s.setAttribute('data-ddx-camera-text', '');
    s.textContent = '[data-scene] svg text,[data-scene] svg tspan{text-rendering:geometricPrecision}';
    document.head.appendChild(s);
  }
  function wireAll(M, opts) {
    var P = M._p, st = P.st;
    R.plan = []; R.framing = [];
    svgTextRule();
    st.scenes.forEach(function (scene) {
      var child = st.children[scene.id];
      if (!child) return;
      R.rig(child, P.sceneElOf(st.root, scene.id), scene);
      P.lint(child, 'camera ' + scene.id);
    });
    P.D().seek(P.D().time());   // re-seek: the new tweens paint the current frame
  }
  function wrap(M, build) {
    if (build.__ddxCamera) return build;
    var w = function (tl3, opts) {
      var master = build.apply(this, arguments);
      var want = opts && opts.camera != null ? opts.camera === true
        : !!(tl3 && Array.isArray(tl3.scenes) && tl3.scenes.some(function (sc) { return sc && sc.camera != null; }));
      if (want) wireAll(M, opts);
      return master;
    };
    w.__ddxCamera = true;
    return w;
  }
  R.attach = function (M) {
    if (!M || M.camera) return;
    M.camera = function (child, sceneEl, scene) { return R.rig(child, sceneEl, scene); };
    M.cameraPlan = function () { return R.plan.slice(); };
    M.cameraFraming = function () { return R.framing.slice(); };
    if (M.build) { M.build = wrap(M, M.build); return; }
    var held;   // master-timeline part 2 assigns build later: wrap it on assignment
    Object.defineProperty(M, 'build', { configurable: true, enumerable: true,
      get: function () { return held; }, set: function (fn) { held = typeof fn === 'function' ? wrap(M, fn) : fn; } });
  };
  if (window.DDXMaster) R.attach(window.DDXMaster);
  else {
    // Chain any accessor already on window.DDXMaster (motion-presets.js sets one).
    var d = Object.getOwnPropertyDescriptor(window, 'DDXMaster'), held;
    Object.defineProperty(window, 'DDXMaster', { configurable: true, enumerable: true,
      get: function () { return d && d.get ? d.get() : held; },
      set: function (v) { if (d && d.set) d.set(v); else held = v; R.attach(v); } });
  }
})(window.DDXCameraRig);
