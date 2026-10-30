/**
 * @ddx       util
 * @domain    misc
 * @topic     engine
 * @purpose   Core of the one cue runtime for player, studio and capture: registry, clock, snapshot/restore and a seek(tMs) that is a pure, rewindable function of time.
 * @status    reusable
 */
/* ============================================================
   cue-runtime.js — window.DDXCue core (plain browser script, no modules)
   ------------------------------------------------------------
   Load order — the ONE ordered list is scripts/cue-files.mjs (CUE_FILES,
   cueRuntimeSource()); loaders import it, there is no bundle file:
     cue-runtime.js -> cue-types-reveal.js -> cue-types-motion.js -> cue-types-data.js
   The type files register their primitives with DDXCue.defineTypes().

   DATA
     DDXCue.load({ id, durMs, cues:[{id,target,type,startMs,durMs,params}],
                   phrases? }, { root, defaultEasing, defaultDur, flavor, fades })
     Legacy flat cues ({target,type,startMs,duration,…params}) are accepted:
     every key outside the core set becomes a param.

   SCHEDULER (the rewind contract, ported from deck-anim.js)
     · load() resolves targets with querySelectorAll, runs each primitive's
       one-time setup, then snapshots every node a primitive writes (all
       attributes, plus innerHTML for text types) ONCE. A later load restores
       that snapshot; it never re-snapshots an animated frame.
     · seek(tMs) restores every snapshot, runs measure hooks on the restored
       frame, parks not-yet-started cues at local 0, applies started cues at
       tMs - startMs, then drives paused GSAP timelines, then stages.

   CLOCK   The runtime never reads performance.now/Date: setClock({now}) + tick().
   ERRORS  Unknown type, 0-match target, bad selector, a throwing primitive,
           a malformed timeline/stage: console.error('[cue-runtime] …') AND a
           row on window.__cueErrors. Nothing is dropped silently.

   Primitive shape: { apply(el, tSec, p, i), setup?(el, p, i), nodes?(el, p),
   measure?(el, p), text?, prime? (default true), selfReset?, dur? (s) }.
   ============================================================ */

/* ---- 1. namespace + error channel ---- */
(function () {
  'use strict';
  if (window.DDXCue) { window.DDXCue.__dupLoad = true; return; }   // one runtime per page
  var errs = window.__cueErrors = window.__cueErrors || [];
  var seen = {};
  function report(kind, msg, extra) {
    var key = kind + '|' + msg;
    if (seen[key]) return;
    seen[key] = 1;
    var row = { kind: kind, message: msg };
    if (extra) for (var k in extra) row[k] = extra[k];
    errs.push(row);
    console.error('[cue-runtime] ' + msg);
  }
  window.DDXCue = {
    version: 2,
    primitives: {},
    errors: errs,
    _lib: { report: report },
    _k: {},
    _s: { T: null, tLast: 0, clock: null, timelines: window.__timelines = window.__timelines || [], stages: [] }
  };
})();

/* ---- 2. easing, spring, number formats ---- */
(function (D) {
  'use strict';
  if (D.__dupLoad) return;
  var L = D._lib;
  /* Ease palette = engine/motion-presets.json "palette" (preset-test.mjs fails
     on drift). A name resolves palette key -> legacy CSS name -> GSAP ease name
     or "x1,y1,x2,y2" bezier. With GSAP loaded, beziers are CustomEase curves and
     names gsap.parseEase; without GSAP the closed forms below are the fallback
     (a bezier is solved exactly, never approximated by another curve). */
  var PALETTE = { out: '0.23,1,0.32,1', expo: 'expo.out', quint: 'power4.out', move: '0.77,0,0.175,1',
    'enter-x': '0,0,0.3,1', exit: '0.4,0.14,1,1', spring: 'back.out(1.4)', cam: 'power2.inOut', soft: 'power2.out', linear: 'none' };
  var LEGACY = { 'ease-in': 'power1.in', 'ease-out': 'power1.out', 'ease-in-out': 'power1.inOut', 'cubic-out': 'power2.out',
    'cubic-bezier(.4,0,.2,1)': '0.4,0,0.2,1', 'cubic-bezier(.34,1.56,.64,1)': '0.34,1.56,0.64,1', back: 'back.out(1.70158)' };
  function backOut(c) { return function (t) { var c3 = c + 1; return 1 + c3 * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); }; }
  var CLOSED = {
    none: function (t) { return t; },
    'power1.in': function (t) { return t * t; },
    'power1.out': function (t) { return 1 - (1 - t) * (1 - t); },
    'power1.inOut': function (t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; },
    'power2.out': function (t) { return 1 - Math.pow(1 - t, 3); },
    'power2.inOut': function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; },
    'power4.out': function (t) { return 1 - Math.pow(1 - t, 5); },
    'expo.out': function (t) { return t === 1 ? 1 : 1 - Math.pow(2, -10 * t); },
    'back.out(1.4)': backOut(1.4),
    'back.out(1.70158)': backOut(1.70158)
  };
  // Exact cubic-bezier(x1,y1,x2,y2): solve x(s) = t (Newton, then bisection), return y(s).
  function bezier(x1, y1, x2, y2) {
    function at(a, b, s) { return 3 * a * s * (1 - s) * (1 - s) + 3 * b * s * s * (1 - s) + s * s * s; }
    function dx(s) { return 3 * x1 * (1 - s) * (1 - s) + 6 * (x2 - x1) * s * (1 - s) + 3 * (1 - x2) * s * s; }
    return function (t) {
      if (t <= 0 || t >= 1) return t <= 0 ? 0 : 1;
      var s = t, i, d;
      for (i = 0; i < 8; i++) { d = dx(s); if (Math.abs(d) < 1e-6) break; s -= (at(x1, x2, s) - t) / d; }
      if (!(s >= 0 && s <= 1) || Math.abs(at(x1, x2, s) - t) > 1e-6) {
        var lo = 0, hi = 1;
        for (i = 0; i < 40; i++) { s = (lo + hi) / 2; if (at(x1, x2, s) < t) lo = s; else hi = s; }
      }
      return at(y1, y2, s);
    };
  }
  var cache = {};
  L.PALETTE = PALETTE;
  L.bezier = bezier;
  L.easeSpec = function (name) { return PALETTE[name] || LEGACY[name] || (name === 'linear' ? 'none' : name); };
  // name -> ease function. Unknown names fall back to 'ease-out' (power1.out), as before.
  L.easeFn = function (name) {
    var spec = L.easeSpec(name), g = window.gsap, key = (g ? 'g|' : 'c|') + spec;
    if (cache[key]) return cache[key];
    var fn = null, bz = /^\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*$/.exec(spec || '');
    if (bz && g && window.CustomEase) {
      try { fn = window.CustomEase.create('ddx-bz-' + bz.slice(1).join('_').replace(/[.-]/g, 'p'), 'M0,0 C' + bz[1] + ',' + bz[2] + ' ' + bz[3] + ',' + bz[4] + ' 1,1'); }
      catch (e) { L.report('ease', 'CustomEase.create(' + spec + ') threw: ' + e.message + ' — using the exact bezier solver'); }
    }
    if (bz) { if (typeof fn !== 'function') fn = bezier(+bz[1], +bz[2], +bz[3], +bz[4]); }
    else if (g && CLOSED[spec]) fn = g.parseEase(spec);
    else fn = CLOSED[spec];
    if (typeof fn !== 'function') return name === 'ease-out' ? CLOSED['power1.out'] : L.easeFn('ease-out');
    return (cache[key] = fn);
  };
  L.clamp01 = function (t) { return Math.max(0, Math.min(1, t)); };
  L.ease = function (name, t) { return L.easeFn(name)(L.clamp01(t)); };

  // Remotion's spring as a closed form of elapsed seconds (from motion-bits.js).
  L.spring = function (tSec, damping, stiffness, mass) {
    var zeta = damping / (2 * Math.sqrt(stiffness * mass));
    var omega0 = Math.sqrt(stiffness / mass);
    if (zeta >= 1) return 1 - Math.exp(-zeta * omega0 * tSec);
    var wD = omega0 * Math.sqrt(1 - zeta * zeta);
    var env = Math.exp(-zeta * omega0 * tSec);
    return 1 - env * (Math.cos(wD * tSec) + ((zeta * omega0) / wD) * Math.sin(wD * tSec));
  };

  /* flavor 'deck' = deck-anim's fr-FR grouping; flavor 'capture' = anim.js's
     plain digits / en-US currency. One primitive, two authored contracts. */
  L.fmtDeck = function (v, spec) {
    spec = spec || 'int';
    if (spec.indexOf('decimal:') === 0) {
      var d = Number(spec.split(':')[1]) || 0;
      return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d }).format(v);
    }
    if (spec.indexOf('currency:') === 0) {
      return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: spec.split(':')[1] || 'EUR', maximumFractionDigits: 0 }).format(v);
    }
    if (spec === 'group') return new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 }).format(Math.round(v));
    return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(Math.round(v));
  };
  function fmtCapture(v, spec) {
    if (spec && spec.indexOf('decimal:') === 0) return v.toFixed(Number(spec.split(':')[1]) || 1);
    if (spec && spec.indexOf('currency:') === 0) {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: spec.split(':')[1] || 'USD', maximumFractionDigits: 0 }).format(v);
    }
    return String(Math.round(v));
  }
  L.fmt = function (v, spec, flavor) { return flavor === 'capture' ? fmtCapture(v, spec) : L.fmtDeck(v, spec); };
})(window.DDXCue);

/* ---- 3. transform composition + applyFade ----
   A primitive never writes a bare transform: it composes onto the node's
   pristine transform. SVG writes the ATTRIBUTE (unitless, space grammar),
   HTML writes style. */
(function (D) {
  'use strict';
  if (D.__dupLoad) return;
  var L = D._lib;
  L.isSvg = function (el) { return !!el.ownerSVGElement || el.namespaceURI === 'http://www.w3.org/2000/svg'; };
  L.baseTransform = function (el) {
    if (el.__baseT === undefined) el.__baseT = (L.isSvg(el) ? el.getAttribute('transform') : el.style.transform) || '';
    return el.__baseT;
  };
  L.compose = function (el, delta) {
    var v = (L.baseTransform(el) + ' ' + delta).trim();
    if (L.isSvg(el)) el.setAttribute('transform', v); else el.style.transform = v;
  };
  L.setOpacity = function (el, v) { if (L.isSvg(el)) el.setAttribute('opacity', String(v)); else el.style.opacity = String(v); };
  L.translate = function (el, dx, dy) {
    return L.isSvg(el)
      ? 'translate(' + dx.toFixed(2) + ' ' + dy.toFixed(2) + ')'
      : 'translate(' + dx.toFixed(2) + 'px,' + dy.toFixed(2) + 'px)';
  };

  /* applyFade (from anim.js; exported). Pure function of tMs. Opacity
     multiplies the base opacity; a first-touch 0 is a pre-reveal sentinel. */
  function applyFade(el, tMs, opts) {
    if (!el || !opts) return;
    var svg = L.isSvg(el), easing = opts.easing || 'ease-out', rise = opts.rise || 0;
    var outAt = opts.outAt != null ? opts.outAt : null, outMs = opts.outMs != null ? opts.outMs : 400;
    if (el.dataset.baseTransform === undefined) el.dataset.baseTransform = (svg ? el.getAttribute('transform') : el.style.transform) || '';
    if (el.dataset.baseOpacity === undefined) {
      var cur = Number(svg ? el.getAttribute('opacity') : el.style.opacity);
      el.dataset.baseOpacity = (!cur || isNaN(cur)) ? '1' : String(cur);
    }
    var base = el.dataset.baseTransform, k = 1;
    if (opts.inAt != null && opts.inMs != null) k = L.ease(easing, (tMs - opts.inAt) / opts.inMs);
    if (outAt != null && tMs > outAt) k = Math.min(k, L.ease(easing, 1 - (tMs - outAt) / outMs));
    k = L.clamp01(k);
    L.setOpacity(el, Number(el.dataset.baseOpacity) * k);
    var dy = (1 - k) * rise;
    var v = !dy ? base : (base + (svg ? ' translate(0 ' + dy.toFixed(2) + ')' : ' translateY(' + dy.toFixed(2) + 'px)')).trim();
    if (svg) el.setAttribute('transform', v); else el.style.transform = v;
  }
  L.applyFade = applyFade;
  D.applyFade = applyFade;
})(window.DDXCue);

/* ---- 4. snapshot/restore + target resolution ---- */
(function (D) {
  'use strict';
  if (D.__dupLoad) return;
  var K = D._k, report = D._lib.report;
  K.snapshotNode = function (node, withHtml) {
    var s = node.__cueSnap;
    if (!s) {
      s = node.__cueSnap = { attrs: [] };
      for (var a = 0; a < node.attributes.length; a++) s.attrs.push([node.attributes[a].name, node.attributes[a].value]);
    }
    if (withHtml && s.html === undefined) s.html = node.innerHTML;
    return s;
  };
  K.restoreNode = function (node) {
    var s = node.__cueSnap;
    if (!s) return;
    if (s.html !== undefined && node.innerHTML !== s.html) node.innerHTML = s.html;
    var want = {}, i;
    for (i = 0; i < s.attrs.length; i++) want[s.attrs[i][0]] = s.attrs[i][1];
    for (i = node.attributes.length - 1; i >= 0; i--) {
      if (!(node.attributes[i].name in want)) node.removeAttribute(node.attributes[i].name);
    }
    for (i = 0; i < s.attrs.length; i++) {
      if (node.getAttribute(s.attrs[i][0]) !== s.attrs[i][1]) node.setAttribute(s.attrs[i][0], s.attrs[i][1]);
    }
  };
  K.resolve = function (root, target, label) {
    if (target && target.nodeType === 1) return [target];
    if (typeof target !== 'string' || !target) { report('no-target', label + ' has no target selector'); return []; }
    var els;
    try { els = Array.prototype.slice.call(root.querySelectorAll(target)); }
    catch (e) { report('bad-selector', label + ' target "' + target + '" is not a valid selector', { target: target }); return []; }
    if (!els.length && target === '.anim-cursor') {   // anim.js contract: auto-inject the cursor
      var c = document.createElement('div');
      c.className = 'anim-cursor';
      (root.nodeType === 1 ? root : document.body).appendChild(c);
      els = [c];
    }
    if (!els.length) report('no-target', label + ' target "' + target + '" matches 0 nodes', { target: target });
    return els;
  };
  // data-fade-in / data-fade-out ("<ms>" or "<at>:<dur>") -> `fade` cues at startMs 0.
  K.scanFades = function (root) {
    function parse(v) {
      if (v == null) return null;
      var s = String(v);
      if (s.indexOf(':') >= 0) { var parts = s.split(':').map(Number); return { at: parts[0] || 0, dur: parts[1] || 400 }; }
      return { at: 0, dur: Number(s) || 400 };
    }
    var out = [], nodes = root.querySelectorAll('[data-fade-in],[data-fade-out]');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i], fi = parse(el.dataset.fadeIn), fo = parse(el.dataset.fadeOut);
      out.push({ id: 'fade-' + i, target: el, type: 'fade', startMs: 0, durMs: 400, params: {
        inAt: fi ? fi.at : null, inMs: fi ? fi.dur : null, outAt: fo ? fo.at : null, outMs: fo ? fo.dur : 400,
        rise: Number(el.dataset.fadeRise || '0') } });
    }
    return out;
  };
})(window.DDXCue);

/* ---- 5. cue normalisation (legacy flat + timeline.json shapes) ---- */
(function (D) {
  'use strict';
  if (D.__dupLoad) return;
  var CORE = { id: 1, target: 1, type: 1, preset: 1, startMs: 1, durMs: 1, params: 1, start: 1, duration: 1, durationMs: 1 };
  function startOf(c, tl) {
    var start = c.startMs != null ? c.startMs : (c.start != null ? c.start * 1000 : null);
    if (start == null && c.phrase != null && tl.phrases && tl.phrases.phrases) {
      var ph = tl.phrases.phrases[c.phrase - 1];
      start = ph ? ph.debut * 1000 : 0;
    }
    return start || 0;
  }
  D._k.normalize = function (c, idx, tl, opts) {
    var p = {}, k, type = c.type;
    for (k in c) if (!CORE[k]) p[k] = c[k];
    if (c.params) for (k in c.params) p[k] = c.params[k];
    if (c.viseme && type !== 'viseme') {
      console.warn('[cue-runtime] legacy viseme cue (' + type + ' on ' + c.target + ') plays at startMs ' + (c.startMs || 0)
        + '; the event bus is gone — bake occurrences into timeline.json (task 007)');
      p.effect = type;
      type = 'viseme';
    }
    // A v3 cue naming a preset ({ preset:'count-up' }) resolves in the preset
    // registry (D.presetPrims), never to a same-named legacy type (task 052).
    var pp = c.preset && D.presetPrims && D.presetPrims[c.preset];
    if (pp) type = c.preset;
    var prim = pp || D.primitives[type];
    var fallback = (opts.defaultDur != null ? opts.defaultDur : (prim && prim.dur) || 0.6) * 1000;
    var durMs = c.durMs != null ? c.durMs : c.durationMs != null ? c.durationMs : c.duration != null ? c.duration * 1000 : fallback;
    if (prim && prim.fixed) durMs = prim.dur * 1000;   // motion presets own their duration (setup sets the exact span)
    p.dur = durMs / 1000;
    p.durationMs = durMs;
    p.easing = c.easing || p.easing || opts.defaultEasing || 'ease-out';
    p.flavor = opts.flavor || 'deck';
    p.slideDurMs = p.slideDurMs || tl.durMs || 5000;
    p.__target = typeof c.target === 'string' ? c.target : '(element)';
    return { id: c.id != null ? c.id : idx, type: type, prim: prim, start: startOf(c, tl), p: p, target: c.target };
  };
  // The primitive a viseme cue drives (its effect), or null.
  D._k.effectOf = function (c) { return c.type === 'viseme' ? D.primitives[c.p.effect || 'pulse'] || null : null; };
})(window.DDXCue);

/* ---- 5b. CSS animations on the cue clock ----
   A slide stylesheet may animate (a `.frame > *` fadeUp entrance, a pulsing
   dot). Left alone, the player runs it on the compositor's wall clock while
   MP4 capture pins it to the frame clock -> player != MP4 (task 020/023).
   The runtime owns it on BOTH paths: every CSSAnimation under the loaded root
   is paused and its currentTime set from the slide clock (tMs - birth), the
   same rule capture-frameseek's __clockAnimPass applies. Animations present at
   load() are born at slide t = 0; one created later is born at the tMs it is
   first seen. The motion is kept and seekable, never disabled. */
(function (D) {
  'use strict';
  if (D.__dupLoad) return;
  var K = D._k;
  var births = new WeakMap();
  function cssAnims(root) {
    if (typeof CSSAnimation === 'undefined') return [];
    var host = root && root.nodeType === 1 && typeof root.getAnimations === 'function' ? root : null;
    var list = host ? host.getAnimations({ subtree: true })
      : (typeof document.getAnimations === 'function' ? document.getAnimations() : []);
    return list.filter(function (a) { return a instanceof CSSAnimation; });
  }
  K.stampCss = function (root) {
    cssAnims(root).forEach(function (a) { births.set(a, 0); });
  };
  K.clockCss = function (root, tMs) {
    cssAnims(root).forEach(function (a) {
      if (!births.has(a)) births.set(a, tMs);
      try { a.pause(); a.currentTime = Math.max(0, tMs - births.get(a)); } catch (e) { /* inactive timeline: skip this one */ }
    });
  };
})(window.DDXCue);

/* ---- 6. load: resolve -> setup -> snapshot ---- */
(function (D) {
  'use strict';
  if (D.__dupLoad) return;
  var K = D._k, L = D._lib, S = D._s, report = L.report;

  function resolveAll(raw, tl, opts, root) {
    var cues = [];
    for (var i = 0; i < raw.length; i++) {
      var c = K.normalize(raw[i], i, tl, opts);
      var label = 'cue ' + c.id + ' (' + c.type + ') in ' + (tl.id || 'timeline');
      if (!c.prim) { report('unknown-type', label + ': unknown type "' + c.type + '"', { type: c.type, cue: c.id }); continue; }
      c.els = K.resolve(root, c.target, label);
      if (c.els.length) cues.push(c);
    }
    return cues;
  }

  function setupAll(cues) {
    cues.forEach(function (c) {
      var fx = K.effectOf(c);
      c.els.forEach(function (el, k) {
        try {
          if (c.prim.setup) c.prim.setup(el, c.p, k);
          if (fx && fx.setup) fx.setup(el, c.p, k);
        } catch (e) { report('primitive-threw', 'setup of cue ' + c.id + ' (' + c.type + ') threw: ' + e.message); }
      });
    });
  }

  function snapshotAll(cues) {
    var snaps = [], seen = new Set();
    function add(node, html) {
      if (!node || node.nodeType !== 1) return;
      K.snapshotNode(node, html);
      if (!seen.has(node)) { seen.add(node); snaps.push(node); }
    }
    cues.forEach(function (c) {
      if (c.prim.selfReset) return;
      var fx = K.effectOf(c);
      c.els.forEach(function (el) {
        add(el, c.prim.text || (fx && fx.text));
        try {
          if (c.prim.nodes) c.prim.nodes(el, c.p).forEach(function (n) { add(n, false); });
          if (fx && fx.nodes) fx.nodes(el, c.p).forEach(function (n) { add(n, false); });
        } catch (e) { report('primitive-threw', 'nodes() of cue ' + c.id + ' threw: ' + e.message); }
      });
    });
    // Restore now (no leak from a prior load), and pin compose() bases to
    // the pristine transform rather than to whichever cue touched it first.
    snaps.forEach(function (n) {
      K.restoreNode(n);
      n.__baseT = (L.isSvg(n) ? n.getAttribute('transform') : n.style.transform) || '';
    });
    return snaps;
  }

  D.load = function (timeline, opts) {
    opts = opts || {};
    var tl = timeline || {};
    if (!Array.isArray(tl.cues)) {
      if (tl.cues != null) report('bad-timeline', 'timeline ' + (tl.id || '?') + ' has a non-array cues field');
      tl = Object.assign({}, tl, { cues: [] });
    }
    var root = opts.root || document;
    var raw = opts.fades ? tl.cues.concat(K.scanFades(root)) : tl.cues.slice();
    var cues = resolveAll(raw, tl, opts, root);
    cues.forEach(function (c) { c.els.forEach(K.restoreNode); });   // a reloaded node returns to its one snapshot
    setupAll(cues);
    var snaps = snapshotAll(cues);
    S.T = { id: tl.id, durMs: tl.durMs, root: root, cues: cues, snaps: snaps, phrases: tl.phrases || null, phraseIdx: -2 };
    K.stampCss(root);
    return { cues: cues.length, dropped: raw.length - cues.length };
  };

  D.unload = function () {
    if (S.T) S.T.snaps.forEach(K.restoreNode);
    S.T = null;
  };
})(window.DDXCue);

/* ---- 7. seek: restore -> measure -> park -> apply -> phrases -> timelines -> stages ---- */
(function (D) {
  'use strict';
  if (D.__dupLoad) return;
  var K = D._k, S = D._s, report = D._lib.report;

  function applyCue(c, tSec) {
    for (var j = 0; j < c.els.length; j++) {
      try { c.prim.apply(c.els[j], tSec, c.p, j); }
      catch (e) { report('primitive-threw', 'cue ' + c.id + ' (' + c.type + ') threw: ' + e.message, { cue: c.id }); }
    }
  }

  function measureAll(T) {
    T.cues.forEach(function (c) {
      if (!c.prim.measure) return;
      c.els.forEach(function (el) {
        try { c.prim.measure(el, c.p); }
        catch (e) { report('primitive-threw', 'measure of cue ' + c.id + ' threw: ' + e.message); }
      });
    });
  }

  // Phrase bus: publishes the SPOKEN position on the timeline root.
  function phraseBus(T, tSec) {
    var ph = T.phrases;
    if (!ph || !ph.phrases) return;
    var host = T.root.nodeType === 1 ? T.root : document.body, idx = -1;
    for (var k = 0; k < ph.phrases.length; k++) { if (tSec >= ph.phrases[k].debut) idx = k; else break; }
    if (idx !== T.phraseIdx) {
      T.phraseIdx = idx;
      host.dataset.phrase = String(idx + 1);
      host.dispatchEvent(new CustomEvent('phrase', { bubbles: true,
        detail: { index: idx + 1, phrase: idx >= 0 ? ph.phrases[idx].phrase : null, t: tSec } }));
    }
    host.style.setProperty('--phrase-progress', (ph.total ? Math.min(100, (tSec / ph.total) * 100) : 0).toFixed(2) + '%');
  }

  function seekCues(T, tMs) {
    T.snaps.forEach(K.restoreNode);
    measureAll(T);
    // Park every not-yet-started cue at its own local 0 (authored order),
    // then apply the started ones over it.
    T.cues.forEach(function (c) {
      if (tMs < c.start && (c.prim.selfReset || c.prim.prime !== false)) applyCue(c, 0);
    });
    T.cues.forEach(function (c) { if (tMs >= c.start) applyCue(c, (tMs - c.start) / 1000); });
    phraseBus(T, tMs / 1000);
  }

  // GSAP double-seek: a single totalTime(t) to the time a timeline already
  // holds renders nothing (a set at 0, a fromTo at its exact start stay
  // unapplied on a fresh page); stepping past t first forces the render.
  K.seekTl = function (tl, tSec) {
    tl.totalTime(tSec + 0.001, true);
    tl.totalTime(tSec, false);
  };

  D.seek = function (tMs) {
    tMs = Number(tMs) || 0;
    S.tLast = tMs;
    if (S.T) { seekCues(S.T, tMs); K.clockCss(S.T.root, tMs); }
    S.timelines.forEach(function (tl, i) {
      try { K.seekTl(tl, tMs / 1000); }
      catch (e) { report('bad-timeline', 'registered timeline ' + i + ' threw on seek: ' + e.message); }
    });
    S.stages.forEach(function (st) {
      try { st.renderAt(tMs); }
      catch (e) { report('bad-stage', 'stage "' + st.id + '" threw on renderAt: ' + e.message); }
    });
    return tMs;
  };
})(window.DDXCue);

/* ---- 8. clock, clock-driven libraries, registry API ---- */
(function (D) {
  'use strict';
  if (D.__dupLoad) { delete D.__dupLoad; return; }   // last core block: duplicate load ends here
  var S = D._s, L = D._lib, report = L.report;

  // GSAP: each timeline must be paused; the runtime sets its time, never GSAP's ticker.
  D.registerTimeline = function (tl) {
    if (!tl || typeof tl.totalTime !== 'function') { report('bad-timeline', 'registerTimeline needs a GSAP timeline (no totalTime())'); return false; }
    if (typeof tl.paused === 'function' && !tl.paused()) {
      report('bad-timeline', 'registered timeline was playing on its own clock; paused it — create it with { paused: true }');
      tl.pause();
    }
    if (S.timelines.indexOf(tl) < 0) S.timelines.push(tl);
    D._k.seekTl(tl, S.tLast / 1000);
    return true;
  };
  // three.js / Lottie adapters (task 013): { id, renderAt(tMs) }.
  D.registerStage = function (stage) {
    if (!stage || !stage.id || typeof stage.renderAt !== 'function') { report('bad-stage', 'registerStage needs { id, renderAt(tMs) }'); return false; }
    S.stages = S.stages.filter(function (s) { return s.id !== stage.id; });
    S.stages.push(stage);
    try { stage.renderAt(S.tLast); } catch (e) { report('bad-stage', 'stage "' + stage.id + '" threw on renderAt: ' + e.message); }
    return true;
  };
  D.setClock = function (c) {
    if (!c || typeof c.now !== 'function') { report('bad-clock', 'setClock needs { now: () => ms }'); return false; }
    S.clock = c;
    return true;
  };
  D.tick = function () {
    if (!S.clock) { report('bad-clock', 'tick() called before setClock()'); return S.tLast; }
    return D.seek(S.clock.now());
  };
  D.time = function () { return S.tLast; };
  D.register = function (name, def) {
    if (!name || !def || typeof def.apply !== 'function') { report('bad-primitive', 'register(' + name + ') needs { apply(el, tSec, params, i) }'); return false; }
    D.primitives[name] = def;
    return true;
  };
  // Type files call this: factory(lib) -> { typeName: primitive, … }.
  D.defineTypes = function (factory) {
    var defs = factory(L) || {};
    Object.keys(defs).forEach(function (name) { D.register(name, defs[name]); });
  };
  D.has = function (type) { return !!D.primitives[type]; };
  // Cue types = the cue-types.json vocabulary. Motion presets registered as
  // primitives (def.preset, engine/motion-presets.js) are their own registry
  // (motion-presets.json, scripts/preset-test.mjs): D.presetTypes().
  D.types = function () { return Object.keys(D.primitives).filter(function (n) { return !D.primitives[n].preset; }); };
  D.presetTypes = function () { return Object.keys(D.primitives).filter(function (n) { return !!D.primitives[n].preset; }); };
})(window.DDXCue);
