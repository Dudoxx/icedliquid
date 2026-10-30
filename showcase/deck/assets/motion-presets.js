/**
 * @ddx       registry
 * @domain    misc
 * @topic     engine
 * @purpose   Named motion presets (fixed duration + palette ease) built as callback-free GSAP tweens on the master timeline, also registered as DDXCue primitives so timeline cues can name them.
 * @status    reusable
 */
/* ============================================================
   motion-presets.js — window.DDXPresets + DDXMaster.preset (plain browser script)
   ------------------------------------------------------------
   Data: engine/motion-presets.json is the one registry (runtime, storyboard
   builder 017, motion gate 019, deck builder 010). REG below is its copy minus
   "palette" (that lives in cue-runtime.js L.PALETTE); scripts/preset-test.mjs
   fails on any drift between the two.

     DDXMaster.preset('rise', child, sceneEl.querySelectorAll('.kpi'), 0.4);
     DDXMaster.preset('count-up', child, '#s02-kpi', 1.2, { to: 1250 });
     DDXMaster.preset('exit-fade', child, '#s02-head', 6, { after: 'line-mask' });

   preset(name, tl, targets, atS, opts) adds the preset's tweens to tl at atS.
   name may be a legacyMap key (fade-up -> rise). Duration is FIXED by the
   registry (exits = 0.6 x the paired entrance, opts.after). Ambient presets are
   finite (repeat count from opts.sceneDurS). No callbacks, no repeat:-1.
   Entrances park at their from-state from build (immediateRender), exits do not.
   Reduced motion (prefers-reduced-motion, DDXPresets.reducedMotion, or
   opts.reduced): 'opacity-150' presets become a 150 ms opacity fade (camera
   jumps to its end framing), 'end-state' presets jump to their end (count-up
   keeps its end value, ambient stays still).
   opts: root (selector scope) · to/from (count-up values, morph shape, flip
   source) · path (flow) · focus/zoom/dx/dy/world (camera) · nodes/dot (draw,
   line-chart follow-ups) · amp (depth-parallax) · decimals/format (count-up).
   Cue path: every preset name and legacy alias that is not already a DDXCue
   type is registered as a primitive (fixed duration, private paused timeline
   force-rendered at the cue's local time), so a v3 cue { preset: 'rise' }
   resolves through DDXMaster.cueTween and DDXCue.load alike.
   Load: after cue-runtime.js (any position in CUE_FILES). If DDXMaster is not
   loaded yet, preset() is attached the moment master-timeline.js creates it.
   ============================================================ */
(function () {
  'use strict';
  if (window.DDXPresets) return;
  var D = window.DDXCue;
  if (!D) throw new Error('motion-presets: load the cue runtime (scripts/cue-files.mjs CUE_FILES) first');
  var L = D._lib, report = L.report;
  var REG = {
    "version": 1, "source": "Dudoxx motion presets",
    "choreography": {"followerDelayMs": [150, 250], "staggerMs": [40, 80], "leadsPerBeat": 1, "nextBeatAtLeadFraction": 0.7, "exitFraction": 0.6},
    "presets": {
      "rise": {"name": "rise", "kind": "entrance", "durS": 0.7, "ease": "expo", "plugins": [], "loopSafe": false, "mover": "lead", "reducedMotion": "opacity-150"},
      "rise-stagger": {"name": "rise-stagger", "kind": "entrance", "durS": 0.7, "ease": "expo", "stagger": 0.06, "plugins": [], "loopSafe": false, "mover": "follower", "reducedMotion": "opacity-150"},
      "line-mask": {"name": "line-mask", "kind": "entrance", "durS": 0.9, "ease": "expo", "stagger": 0.08, "plugins": ["SplitText"], "loopSafe": false, "mover": "lead", "reducedMotion": "opacity-150"},
      "word-mask": {"name": "word-mask", "kind": "entrance", "durS": 0.6, "ease": "out", "stagger": 0.04, "plugins": ["SplitText"], "loopSafe": false, "mover": "lead", "reducedMotion": "opacity-150"},
      "char-scramble": {"name": "char-scramble", "kind": "entrance", "durS": 0.8, "ease": "linear", "stagger": 0.015, "plugins": ["SplitText"], "loopSafe": false, "mover": "lead", "reducedMotion": "opacity-150"},
      "scale-in": {"name": "scale-in", "kind": "entrance", "durS": 0.6, "ease": "out", "plugins": [], "loopSafe": false, "mover": "follower", "reducedMotion": "opacity-150"},
      "blur-in": {"name": "blur-in", "kind": "entrance", "durS": 0.8, "ease": "out", "plugins": [], "loopSafe": false, "mover": "lead", "reducedMotion": "opacity-150"},
      "clip-wipe": {"name": "clip-wipe", "kind": "entrance", "durS": 0.9, "ease": "move", "plugins": [], "loopSafe": false, "mover": "lead", "reducedMotion": "opacity-150"},
      "draw": {"name": "draw", "kind": "entrance", "durS": 1.2, "ease": "cam", "plugins": ["DrawSVGPlugin"], "loopSafe": false, "mover": "lead", "reducedMotion": "opacity-150"},
      "morph": {"name": "morph", "kind": "emphasis", "durS": 0.9, "ease": "move", "plugins": ["MorphSVGPlugin"], "loopSafe": false, "mover": "lead", "reducedMotion": "opacity-150"},
      "flow": {"name": "flow", "kind": "ambient", "durS": 1.6, "ease": "linear", "plugins": ["MotionPathPlugin"], "loopSafe": true, "mover": "ambient", "reducedMotion": "end-state"},
      "count-up": {"name": "count-up", "kind": "data", "durS": 1.4, "ease": "expo", "plugins": [], "loopSafe": false, "mover": "lead", "reducedMotion": "end-state"},
      "bar-grow": {"name": "bar-grow", "kind": "data", "durS": 0.9, "ease": "expo", "stagger": 0.05, "plugins": [], "loopSafe": false, "mover": "follower", "reducedMotion": "opacity-150"},
      "line-chart": {"name": "line-chart", "kind": "data", "durS": 1.4, "ease": "soft", "plugins": ["DrawSVGPlugin"], "loopSafe": false, "mover": "lead", "reducedMotion": "opacity-150"},
      "highlight": {"name": "highlight", "kind": "emphasis", "durS": 0.5, "ease": "out", "plugins": [], "loopSafe": false, "mover": "follower", "reducedMotion": "end-state"},
      "magic-move": {"name": "magic-move", "kind": "emphasis", "durS": 0.9, "ease": "move", "plugins": ["Flip"], "loopSafe": false, "mover": "lead", "reducedMotion": "opacity-150"},
      "cam-push": {"name": "cam-push", "kind": "camera", "durS": 1.2, "ease": "cam", "plugins": [], "loopSafe": false, "mover": "lead", "reducedMotion": "opacity-150"},
      "cam-pan": {"name": "cam-pan", "kind": "camera", "durS": 1.4, "ease": "cam", "plugins": [], "loopSafe": false, "mover": "lead", "reducedMotion": "opacity-150"},
      "depth-parallax": {"name": "depth-parallax", "kind": "ambient", "durS": 8, "ease": "linear", "plugins": [], "loopSafe": true, "mover": "ambient", "reducedMotion": "end-state"},
      "ambient-drift": {"name": "ambient-drift", "kind": "ambient", "durS": 10, "ease": "linear", "plugins": [], "loopSafe": true, "mover": "ambient", "reducedMotion": "end-state"},
      "exit-fade": {"name": "exit-fade", "kind": "exit", "durS": 0.42, "ease": "exit", "pairs": "rise", "plugins": [], "loopSafe": false, "mover": "follower", "reducedMotion": "opacity-150"},
      "3d-reveal": {"name": "3d-reveal", "kind": "3d", "durS": 1.8, "ease": "expo", "plugins": [], "loopSafe": false, "mover": "lead", "reducedMotion": "opacity-150"}
    },
    "legacyMap": {"stagger-fade-slide": "rise-stagger", "draw-path": "draw", "count-up": "count-up", "chart-bars": "bar-grow", "chart-line": "line-chart", "ken-burns": "depth-parallax", "parallax-layer": "ambient-drift", "highlight-sweep": "highlight", "wipe-in": "clip-wipe", "viewport-zoom": "cam-push", "fade-up": "rise", "fade-out": "exit-fade"}
  };   // = engine/motion-presets.json minus "palette";
  var P = window.DDXPresets = { version: REG.version, reducedMotion: null };
  var PLUGINS = ['CustomEase', 'MotionPathPlugin', 'SplitText', 'DrawSVGPlugin', 'MorphSVGPlugin', 'Flip'];
  var registered = {};

  P.registry = function () {
    var r = JSON.parse(JSON.stringify(REG));
    r.palette = JSON.parse(JSON.stringify(L.PALETTE));
    return r;
  };
  P.names = function () { return Object.keys(REG.presets); };
  P.resolve = function (name) { return REG.presets[name] ? name : (REG.legacyMap[name] || null); };
  P.spec = function (name) { var n = P.resolve(name); return n ? REG.presets[n] : null; };
  P.durOf = function (name, o) {
    var s = P.spec(name);
    if (!s) return 0;
    var pair = s.pairs && P.spec((o && o.after) || s.pairs);
    return pair ? Math.round(pair.durS * REG.choreography.exitFraction * 1000) / 1000 : s.durS;
  };
  P.isReduced = function (o) {
    if (o && o.reduced != null) return !!o.reduced;
    if (P.reducedMotion != null) return !!P.reducedMotion;
    return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  };
  P.plugin = function (name) {
    var g = window.gsap, p = window[name];
    if (g && p && !registered[name]) { g.registerPlugin(p); registered[name] = 1; }
    return p || null;
  };
  // Palette key -> ease function (CustomEase curve when GSAP + CustomEase are loaded).
  P.ease = function (key) { P.plugin('CustomEase'); return L.easeFn(key); };
  P.els = function (targets, root) {
    if (!targets) return [];
    if (typeof targets === 'string') {
      try { return Array.prototype.slice.call((root || document).querySelectorAll(targets)); }
      catch (e) { report('bad-selector', 'preset target "' + targets + '" is not a valid selector'); return []; }
    }
    if (targets.nodeType === 1) return [targets];
    return Array.prototype.slice.call(targets).filter(function (n) { return n && n.nodeType === 1; });
  };

  // DDXMaster may load later (compose-stage loads cue files first): attach on creation.
  function attach(M) { if (M && !M.preset) M.preset = function () { return P.preset.apply(P, arguments); }; }
  if (window.DDXMaster) attach(window.DDXMaster);
  else {
    var held;
    Object.defineProperty(window, 'DDXMaster', { configurable: true, enumerable: true,
      get: function () { return held; }, set: function (v) { held = v; attach(v); } });
  }
  P._REG = REG;
})();

/* ---- part 2: shared tween helpers + the simple from -> to presets ---- */
(function (P) {
  'use strict';
  if (P._b) return;
  var L = window.DDXCue._lib, report = L.report;
  var FT = {
    rise: [{ opacity: 0, y: 28 }, { opacity: 1, y: 0 }],
    'scale-in': [{ opacity: 0, scale: 0.95 }, { opacity: 1, scale: 1 }],
    'blur-in': [{ opacity: 0, filter: 'blur(12px)' }, { opacity: 1, filter: 'blur(0px)' }],
    'clip-wipe': [{ clipPath: 'inset(0% 100% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)' }],
    'bar-grow': [{ scaleY: 0, transformOrigin: '50% 100%' }, { scaleY: 1, transformOrigin: '50% 100%' }],
    'exit-fade': [{ opacity: 1, y: 0 }, { opacity: 0, y: -12 }],
    '3d-reveal': [{ opacity: 0, rotationY: 25, scale: 0.92, transformPerspective: 1200 }, { opacity: 1, rotationY: 0, scale: 1, transformPerspective: 1200 }]
  };
  FT['rise-stagger'] = FT.rise;
  function copy(a, b) { for (var k in a) b[k] = a[k]; return b; }
  function desc(el) { return el.id ? '#' + el.id : el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.split(/\s+/)[0] : ''); }

  // One fromTo. Entrances park at their from-state from build; exits do not.
  function ft(tl, T, at, d, e, from, to, x) {
    x = x || {};
    var v = copy(to, {});
    v.duration = d; v.ease = e; v.lazy = false; v.immediateRender = !x.exit;
    if (x.stagger && T.length > 1) v.stagger = x.stagger;
    if (x.repeat) { v.repeat = x.repeat; v.yoyo = !!x.yoyo; }
    tl.fromTo(T, copy(from, {}), v, at);
  }
  function simple(tl, T, at, d, e, s) {
    var pair = FT[s.name];
    ft(tl, T, at, d, e, pair[0], pair[1], { stagger: s.stagger, exit: s.kind === 'exit' });
  }
  function need(name, plugin, o, param) {
    if (param && (!o || o[param] == null)) { report('preset-param', 'preset ' + name + ' needs opts.' + param); return false; }
    if (plugin && !P.plugin(plugin)) { report('preset-plugin', 'preset ' + name + ' needs vendor/gsap ' + plugin + ' loaded before build'); return false; }
    return true;
  }
  // Integer hash for seeded glyph picks (no Math.random on the master clock).
  function hash(a, b) { var h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return (h ^ (h >>> 16)) >>> 0; }
  function split(el, type) {
    var ST = P.plugin('SplitText');
    if (!ST) return null;
    if (document.fonts && document.fonts.status !== 'loaded') report('preset-fonts', 'SplitText on ' + desc(el) + ' before document.fonts.ready — line breaks can differ between runs');
    var cache = el.__ddxSplit = el.__ddxSplit || {};
    if (!cache[type]) {
      var key = Object.keys(cache)[0];
      if (key) { report('preset-split', desc(el) + ' already split as ' + key + ', not as ' + type); return cache[key]; }
      cache[type] = ST.create ? ST.create(el, { type: type, mask: type === 'lines' || type === 'words' ? type : undefined, autoSplit: false })
        : new ST(el, { type: type });
    }
    return cache[type];
  }
  P._b = { FT: FT, ft: ft, simple: simple, need: need, hash: hash, split: split, desc: desc, copy: copy };
})(window.DDXPresets);

/* ---- part 3: text, svg and data presets ---- */
(function (P) {
  'use strict';
  if (P._B) return;
  var B = P._b, ft = B.ft, L = window.DDXCue._lib, report = L.report;
  var GLYPHS = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#%&*+=<>';

  function masked(type) {
    return function (tl, T, at, d, e, s) {
      var parts = [];
      T.forEach(function (el) { var sp = B.split(el, type); if (sp && sp[type]) parts = parts.concat(Array.prototype.slice.call(sp[type])); });
      if (!parts.length) {
        report('preset-plugin', 'preset ' + s.name + ' needs vendor/gsap SplitText — ran a plain rise on ' + T.map(B.desc).join(','));
        return ft(tl, T, at, d, e, B.FT.rise[0], B.FT.rise[1]);
      }
      ft(tl, parts, at, d, e, { yPercent: 100 }, { yPercent: 0 }, { stagger: s.stagger });
    };
  }
  // Chars appear one by one, cycling seeded glyphs until each lands on its own.
  function scramble(tl, T, at, d, e, s) {
    var chars = [];
    T.forEach(function (el) { var sp = B.split(el, 'words,chars'); if (sp && sp.chars) chars = chars.concat(Array.prototype.slice.call(sp.chars)); });
    if (!chars.length) { report('preset-plugin', 'preset char-scramble needs vendor/gsap SplitText'); return ft(tl, T, at, d, e, { opacity: 0 }, { opacity: 1 }); }
    chars.forEach(function (c, i) {
      var real = c.__ddxChar != null ? c.__ddxChar : (c.__ddxChar = c.textContent), k = 0;
      var box = { p: function (x) {
        if (!arguments.length) return k;
        k = x;
        c.style.opacity = x <= 0 ? '0' : '1';
        c.textContent = x >= 1 || !real.trim() ? real : GLYPHS.charAt(B.hash(i, Math.floor(x * 6)) % GLYPHS.length);
      } };
      tl.fromTo(box, { p: 0 }, { p: 1, duration: d, ease: e, lazy: false, immediateRender: true }, at + i * (s.stagger || 0));
    });
  }
  function drawOn(tl, T, at, d, e, s) {
    if (B.need(s.name, 'DrawSVGPlugin')) return ft(tl, T, at, d, e, { drawSVG: '0%' }, { drawSVG: '100%' });
    T.forEach(function (el) {   // reported above; the dash offset is the same picture
      var len = el.getTotalLength ? Math.ceil(el.getTotalLength()) : 1000;
      ft(tl, [el], at, d, e, { strokeDasharray: len, strokeDashoffset: len }, { strokeDasharray: len, strokeDashoffset: 0 });
    });
  }
  function follow(tl, sel, at, o) {
    var N = P.els(sel, o.root);
    if (N.length) ft(tl, N, at, 0.6, P.ease('out'), B.FT['scale-in'][0], B.FT['scale-in'][1], { stagger: 0.06 });
  }
  function draw(tl, T, at, d, e, s, o) { drawOn(tl, T, at, d, e, s); if (o.nodes) follow(tl, o.nodes, at + 0.7 * d, o); }
  function lineChart(tl, T, at, d, e, s, o) { drawOn(tl, T, at, d, e, s); if (o.dot) follow(tl, o.dot, at + d, o); }
  function morph(tl, T, at, d, e, s, o) {
    if (!B.need('morph', 'MorphSVGPlugin', o, 'to')) return;
    tl.to(T, { morphSVG: o.to, duration: d, ease: e, lazy: false }, at);
  }
  function flow(tl, T, at, d, e, s, o) {
    if (!B.need('flow', 'MotionPathPlugin', o, 'path')) return;
    var span = o.sceneDurS > 0 ? Math.max(d, o.sceneDurS - at) : d, reps = Math.max(0, Math.floor(span / d + 1e-9) - 1);
    tl.to(T, { motionPath: { path: o.path, align: o.path, alignOrigin: [0.5, 0.5] }, duration: d, ease: e, repeat: reps,
      lazy: false, immediateRender: true }, at);
  }
  // Count spec from the authored text ("42k", "$1,250.5"): target, decimals,
  // prefix/suffix, grouping; opts to/from/decimals/format override. Shared by
  // the preset and the 'count-up' cue primitive (part 5).
  P._countSpec = function (el, o) {
    var src = el.__ddxCountSrc != null ? el.__ddxCountSrc : (el.__ddxCountSrc = el.textContent);
    var m = /-?\d[\d,]*(?:\.\d+)?/.exec(src);
    var dec = o.decimals != null ? o.decimals : m && m[0].indexOf('.') >= 0 ? m[0].split('.')[1].length : 0;
    var pre = m ? src.slice(0, m.index) : '', post = m ? src.slice(m.index + m[0].length) : '';
    var group = m && m[0].indexOf(',') >= 0;
    return { to: o.to != null ? Number(o.to) : m ? parseFloat(m[0].replace(/,/g, '')) : 100,
      from: o.from != null ? Number(o.from) : 0,
      text: function (v) {
        var f = Math.pow(10, dec);
        v = Math.round(v * f) / f;
        if (o.format) return L.fmt(v, o.format, o.flavor || 'capture');
        var txt = v.toFixed(dec);
        if (group) { var parts = txt.split('.'); parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ','); txt = parts.join('.'); }
        return pre + txt + post;
      } };
  };
  function countUp(tl, T, at, d, e, s, o) {
    T.forEach(function (el, i) {
      var c = P._countSpec(el, o), cur = c.from;
      var box = { v: function (x) {
        if (!arguments.length) return cur;
        cur = x;
        el.style.fontVariantNumeric = 'tabular-nums';
        el.textContent = c.text(x);
      } };
      tl.fromTo(box, { v: c.from }, { v: c.to, duration: d, ease: e, lazy: false, immediateRender: true }, at + i * (s.stagger || 0));
    });
  }
  P._B = { 'line-mask': masked('lines'), 'word-mask': masked('words'), 'char-scramble': scramble,
    draw: draw, 'line-chart': lineChart, morph: morph, flow: flow, 'count-up': countUp };
})(window.DDXPresets);

/* ---- part 4: emphasis, camera and ambient presets ---- */
(function (P) {
  'use strict';
  if (P._B.highlight) return;
  var B = P._b, ft = B.ft, report = window.DDXCue._lib.report;
  var MARK = 'linear-gradient(transparent 58%, color-mix(in srgb, var(--accent, currentColor) 35%, transparent) 58%)';

  function markOf(el) {
    var cs = getComputedStyle(el);
    return { backgroundImage: cs.backgroundImage && cs.backgroundImage !== 'none' ? cs.backgroundImage : MARK,
      backgroundRepeat: 'no-repeat', backgroundPosition: '0% 0%' };
  }
  function highlight(tl, T, at, d, e) {
    T.forEach(function (el) {
      tl.set(el, B.copy(markOf(el), { immediateRender: true }), at);
      ft(tl, [el], at, d, e, { backgroundSize: '0% 100%' }, { backgroundSize: '100% 100%' });
    });
  }
  // Shared element: start where opts.from sits, land on the target's own box.
  function magicMove(tl, T, at, d, e, s, o) {
    var src = P.els(o.from, o.root)[0];
    if (!src) { report('preset-param', 'preset magic-move needs opts.from (the shared element it moves from)'); return; }
    var F = P.plugin('Flip');
    if (!F) report('preset-plugin', 'preset magic-move: vendor/gsap Flip not loaded — measured from bounding boxes');
    T.forEach(function (el) {
      var v;
      if (F) v = F.fit(el, src, { getVars: true, scale: true });
      else {
        var a = src.getBoundingClientRect(), b = el.getBoundingClientRect();
        v = { x: a.left + a.width / 2 - (b.left + b.width / 2), y: a.top + a.height / 2 - (b.top + b.height / 2),
          scaleX: b.width ? a.width / b.width : 1, scaleY: b.height ? a.height / b.height : 1 };
      }
      ft(tl, [el], at, d, e, { x: v.x || 0, y: v.y || 0, scaleX: v.scaleX || 1, scaleY: v.scaleY || 1 }, { x: 0, y: 0, scaleX: 1, scaleY: 1 });
    });
  }
  // Camera end vars, measured once at build: focus centre -> world box centre.
  P._cam = function (name, T, o) {
    var w = P.els(o.world, o.root)[0] || T[0];
    if (!w) return null;
    var W = w.getBoundingClientRect(), f = P.els(o.focus, o.root)[0], cx = W.width / 2, cy = W.height / 2, fx = cx, fy = cy;
    if (f) { var R = f.getBoundingClientRect(); fx = R.left + R.width / 2 - W.left; fy = R.top + R.height / 2 - W.top; }
    if (name === 'cam-push') {
      var z = o.zoom > 0 ? Number(o.zoom) : 1.6;
      return { el: w, from: { x: 0, y: 0, scale: 1, transformOrigin: '0 0' }, to: { x: cx - z * fx, y: cy - z * fy, scale: z, transformOrigin: '0 0' } };
    }
    var dx = o.dx != null ? Number(o.dx) : f ? cx - fx : -0.25 * W.width, dy = o.dy != null ? Number(o.dy) : f ? cy - fy : 0;
    return { el: w, from: { x: 0, y: 0 }, to: { x: dx, y: dy } };
  };
  function cam(tl, T, at, d, e, s, o) {
    var c = P._cam(s.name, T, o);
    if (c) ft(tl, [c.el], at, d, e, c.from, c.to);
  }
  function parallax(tl, T, at, d, e, s, o) {
    T.forEach(function (el) {
      var a = (o.amp > 0 ? Number(o.amp) : 0.03) * (el.getBoundingClientRect().width || 100);
      ft(tl, [el], at, d, e, { scale: 1.06, x: -a / 2, y: a / 6 }, { scale: 1.06, x: a / 2, y: -a / 6 });
    });
  }
  // Finite yoyo: half-cycles fit the rest of the scene (never repeat:-1).
  function drift(tl, T, at, d, e, s, o) {
    var half = d / 2, span = o.sceneDurS > 0 ? Math.max(half, o.sceneDurS - at) : d;
    var reps = Math.max(0, Math.floor(span / half + 1e-9) - 1);
    ft(tl, T, at, half, e, { y: -4, rotation: -0.5 }, { y: 4, rotation: 0.5 }, { repeat: reps, yoyo: true });
  }
  B.copy({ highlight: highlight, 'magic-move': magicMove, 'cam-push': cam, 'cam-pan': cam,
    'depth-parallax': parallax, 'ambient-drift': drift }, P._B);
})(window.DDXPresets);

/* ---- part 5: preset(), reduced motion, DDXCue primitives ---- */
(function (P) {
  'use strict';
  if (P.preset) return;
  var D = window.DDXCue, B = P._b, BUILD = P._B, report = D._lib.report;
  Object.keys(B.FT).forEach(function (n) { if (!BUILD[n]) BUILD[n] = B.simple; });

  // End states for reduced motion ('end-state', and camera/emphasis before their fade).
  var END = {
    'count-up': function (tl, T, at, s, o) { BUILD['count-up'](tl, T, at, 0, P.ease('linear'), s, o); },
    highlight: function (tl, T, at) { T.forEach(function (el) { tl.set(el, { backgroundSize: '100% 100%', backgroundRepeat: 'no-repeat', immediateRender: false }, at); }); },
    morph: function (tl, T, at, s, o) { if (B.need('morph', 'MorphSVGPlugin', o, 'to')) tl.to(T, { morphSVG: o.to, duration: 0, lazy: false }, at); },
    'cam-push': function (tl, T, at, s, o) { var c = P._cam(s.name, T, o); if (c) tl.set(c.el, B.copy(c.to, { immediateRender: false }), at); }
  };
  END['cam-pan'] = END['cam-push'];
  function reduced(tl, T, at, s, o) {
    var end = END[s.name];
    if (s.reducedMotion === 'end-state') { if (end) end(tl, T, at, s, o); return; }
    if (end) end(tl, T, at, s, o);
    var exit = s.kind === 'exit', fadeT = s.kind === 'camera' ? [(P._cam(s.name, T, o) || { el: T[0] }).el] : T;
    tl.fromTo(fadeT, { opacity: exit ? 1 : 0 }, { opacity: exit ? 0 : 1, duration: 0.15, ease: 'none', lazy: false, immediateRender: !exit }, at);
  }
  P.build = function (n, tl, T, at, o) {
    var s = P._REG.presets[n];
    o = o || {};
    if (P.isReduced(o)) return reduced(tl, T, at, s, o);
    BUILD[n](tl, T, at, P.durOf(n, o), P.ease(s.ease), s, o);
  };
  P.preset = function (name, tl, targets, atS, opts) {
    var n = P.resolve(name), o = opts || {};
    if (!n) { report('unknown-preset', 'preset "' + name + '" is not in engine/motion-presets.json'); return tl; }
    if (!tl || typeof tl.fromTo !== 'function') { report('preset-timeline', 'preset ' + n + ' needs a GSAP timeline (the scene child)'); return tl; }
    var T = P.els(targets, o.root);
    if (!T.length) { report('no-target', 'preset ' + n + ': target ' + (typeof targets === 'string' ? '"' + targets + '"' : '(nodes)') + ' matches 0 nodes'); return tl; }
    P.build(n, tl, T, Math.max(0, Number(atS) || 0), o);
    return tl;
  };

  // A private paused timeline, force-rendered: forward past its end, then back
  // to t, so every tween writes its value even after a cue snapshot restore.
  function seekPrivate(tl, t) {
    tl.render(Math.max(tl.duration(), t) + 1, true, true);
    tl.render(Math.max(0, t), true, true);
  }
  function primitive(name) {
    var s = P._REG.presets[P.resolve(name)];
    return { preset: true, fixed: true, dur: s.durS, prime: true,
      setup: function (el, p, i) {
        if (!window.gsap) { report('preset-no-gsap', 'cue preset ' + name + ' on ' + B.desc(el) + ' needs vendor/gsap/gsap.min.js'); return; }
        D._k.snapshotNode(el, false);   // pristine attributes, before the from-state is parked
        if (p.sceneDurS == null && p.slideDurMs > 0) p.sceneDurS = p.slideDurMs / 1000;
        var tl = window.gsap.timeline({ paused: true });
        P.build(s.name, tl, [el], P.isReduced(p) ? 0 : i * (s.stagger || 0), p);
        (p.__presetTls = p.__presetTls || [])[i] = tl;
        p.dur = i === 0 ? tl.duration() : Math.max(p.dur, tl.duration());
      },
      apply: function (el, t, p, i) { var tl = p.__presetTls && p.__presetTls[i]; if (tl) seekPrivate(tl, t); } };
  }
  var names = Object.keys(P._REG.presets).concat(Object.keys(P._REG.legacyMap));
  // Preset registry: every preset name and legacy alias, colliding or not. A cue
  // with a `preset` field resolves here (cue-runtime normalize); a cue with only
  // a legacy `type` keeps the legacy primitive (task 052).
  D.presetPrims = {};
  names.forEach(function (n) { D.presetPrims[n] = primitive(n); });
  D.defineTypes(function () {
    var defs = {};
    names.forEach(function (n) { if (!D.primitives[n] && !defs[n]) defs[n] = primitive(n); });
    return defs;
  });
  // 'count-up' stays the DDXCue primitive (deck params from/to/prefix/suffix).
  // A cue WITHOUT params.to (v3 { preset:'count-up' }) counts to the number in
  // the authored text, as DDXMaster.preset does — never 0 -> 0 (task 051). Its
  // setup parks the from-value ("0k") as the node's text, so the frames before
  // the count never flash the end value.
  var CU = D.primitives['count-up'];
  if (CU && !CU.authoredTarget) {
    var cuSetup = CU.setup, cuApply = CU.apply;
    CU.authoredTarget = true;
    CU.setup = function (el, p, i) {
      if (cuSetup) cuSetup(el, p, i);
      if (p.to != null) return;
      el.__ddxCount = P._countSpec(el, p);
      el.textContent = el.__ddxCount.text(el.__ddxCount.from);
    };
    CU.apply = function (el, t, p, i) {
      var c = p.to == null && el.__ddxCount;
      if (!c) return cuApply(el, t, p, i);
      el.style.fontVariantNumeric = 'tabular-nums';
      el.textContent = c.text(c.from + (c.to - c.from) * D._lib.ease(p.easing, p.dur > 0 ? t / p.dur : 1));
    };
  }
})(window.DDXPresets);
