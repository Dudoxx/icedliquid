/**
 * @ddx       util
 * @domain    misc
 * @topic     engine
 * @purpose   Four GSAP scene-transition kinds (continuity Flip/morph, camera pan/zoom, chapter wipe, cut+rise) baked onto the DDXMaster timeline, each ending at the incoming scene's pictureStartMs.
 * @status    reusable
 */
/* ============================================================
   transitions.js — DDXMaster.transition (plain browser script, no modules)
   ------------------------------------------------------------
   Load: right after master-timeline.js (scripts/cue-files.mjs CUE_FILES).
   Optional vendored plugins, loaded before build(): vendor/gsap/Flip.min.js
   (continuity), MorphSVGPlugin.min.js (data-morph-id paths).

   DDXMaster.build() calls wire() once per build: one transition per scene
   boundary, placed on the master so it ENDS at the incoming scene's
   pictureStartMs (A/V contract: picture start = transition end). Each one is
   a child timeline id "transition:<toId>:<kind>".

   Kinds
     continuity  incoming section (stacked above) fades in over the whole
                 window, outgoing hides at its end; every element sharing a
                 data-flip-id across the two sections moves from the outgoing
                 box to its own (Flip.fit measured at BUILD time and baked into
                 a fromTo — never Flip.from at play time); <path>s sharing a
                 data-morph-id morph (MorphSVG). Default durMs 600.
     camera      the shared #stage-world wrapper (transform-origin 0 0) moves
                 from the outgoing to the incoming section anchor, ease "cam"
                 (= power2.inOut). Anchor = data-cam-x / data-cam-y (world px
                 shown at the stage top-left) / data-cam-zoom on the section.
                 Default durMs 1000. No #stage-world -> reported, cut-rise.
     chapter     full-bleed clip-path inset wipe, 0.9 s, background
                 var(--brand-color-primary): covers in 0.45 s, scenes swap
                 under cover, uncovers in 0.45 s. The wipe layer's hidden
                 state is set inline when it is created (outside the timeline).
                 BRAND variant (page holds <template id="ddx-wipe-mark"> with
                 the official mark <img>): 1.2 s,
                 the same wipe covers in 0.25 s, holds 0.7 s with the Dudoxx
                 brand loader (Sentinel BrandLoaderMark rings + speeds), then
                 uncovers to the right in 0.25 s.
     cut-rise    0.35 s exit fade of the outgoing section, 0.15 s gap, the
                 incoming section appears at pictureStartMs and its own
                 entrances (the scene builder / cues) do the rise.
   Every kind leaves the outgoing section at autoAlpha 0 at pictureStartMs.
   Every kind stacks the incoming section above the outgoing one (z-index 2
   over 1) for its whole window, on the timeline; see stack().
   Non-first sections are hidden at build by a set outside the timeline;
   pages should also hide them in CSS so no frame shows before boot runs.

   Selection (selectKind): scene.transitionIn.kind from timeline v3 when it is
   one of the four; else continuity if the two sections share a data-flip-id,
   chapter if scene.section (or the section's data-section) changes, else
   cut-rise. Mix rule: more than 2 kinds among any 3 consecutive boundaries ->
   DDXCue report "transition-mix" (a warning finding; the film still builds).
   Durations: chapter 900 and cut-rise 500 are fixed; continuity / camera use
   transitionIn.durMs when > 0. All are clamped to the outgoing scene span.
   ============================================================ */
(function () {
  'use strict';
  var M = window.DDXMaster;
  if (!M) throw new Error('transitions.js: load master-timeline.js first (scripts/cue-files.mjs CUE_FILES)');
  if (M._tp) return;
  var KINDS = ['continuity', 'camera', 'chapter', 'cut-rise'];
  var DUR = { continuity: 600, camera: 1000, chapter: 900, 'cut-rise': 500, chapterBrand: 1200 };
  var FIXED = { chapter: true, 'cut-rise': true };
  var st = { list: [], cam: null };

  function report(kind, msg) { window.DDXCue._lib.report(kind, msg); }
  function G() { return window.gsap; }
  function plugins() {
    var g = G(), p = [window.Flip, window.MorphSVGPlugin].filter(Boolean);
    if (p.length) g.registerPlugin.apply(g, p);
    g.registerEase('cam', g.parseEase('power2.inOut'));
  }
  function shared(fromEl, toEl, attr) {
    var pairs = [];
    if (!fromEl || !toEl) return pairs;
    toEl.querySelectorAll('[' + attr + ']').forEach(function (b) {
      var a = fromEl.querySelector('[' + attr + '="' + b.getAttribute(attr) + '"]');
      if (a) pairs.push([a, b]);
    });
    return pairs;
  }
  function sectionOf(scene, el) { return scene && scene.section != null ? scene.section : (el && el.getAttribute('data-section')); }

  /* ---- selection ---- */
  M.selectKind = function (prev, scene, fromEl, toEl) {
    var k = scene && scene.transitionIn && scene.transitionIn.kind;
    if (k && KINDS.indexOf(k) >= 0) return { kind: k, inferred: false };
    if (k) report('transition-kind', 'scene ' + scene.id + ': unknown transitionIn.kind "' + k + '" — inferred instead');
    if (shared(fromEl, toEl, 'data-flip-id').length) return { kind: 'continuity', inferred: true };
    var a = sectionOf(prev, fromEl), b = sectionOf(scene, toEl);
    if (a != null && b != null && a !== b) return { kind: 'chapter', inferred: true };
    return { kind: 'cut-rise', inferred: true };
  };
  M.checkMix = function (kinds, ids) {
    var bad = [];
    for (var i = 0; i + 2 < kinds.length; i++) {
      var w = kinds.slice(i, i + 3), u = w.filter(function (k, j) { return w.indexOf(k) === j; });
      if (u.length > 2) {
        bad.push(i);
        report('transition-mix', 'scenes ' + ids.slice(i, i + 3).join(',') + ' enter by ' + w.join(' / ') + ' — more than 2 transition kinds in a 3-scene window');
      }
    }
    return bad;
  };

  // Shared with parts 1b, 2 and 3 (one file, four IIFEs: no function over 100 lines).
  M._tp = { st: st, KINDS: KINDS, DUR: DUR, FIXED: FIXED, report: report, G: G, plugins: plugins, shared: shared };
})();

/* ---- part 1b: tween + stacking helpers (all callback-free; seek-pure) ---- */
(function () {
  'use strict';
  var P = window.DDXMaster._tp;
  if (P.hide) return;
  var st = P.st, G = P.G;

  function hide(tl, el, t, d, ease) { tl.fromTo(el, { autoAlpha: 1 }, { autoAlpha: 0, duration: d, ease: ease || 'power1.in', immediateRender: false }, t); }
  // The incoming section is parked hidden by a set at build (see wire), not by
  // immediateRender: a zero-duration fromTo would render its END state.
  function show(tl, el, t, d) { tl.fromTo(el, { autoAlpha: 0 }, { autoAlpha: 1, duration: d, ease: 'power1.out', immediateRender: false }, t); }
  function anchorOf(el) {
    var n = function (k, dflt) { var v = el && parseFloat(el.getAttribute('data-cam-' + k)); return isFinite(v) ? v : dflt; };
    return { x: n('x', 0), y: n('y', 0), zoom: n('zoom', 1), set: !!(el && el.hasAttribute('data-cam-x')) };
  }
  function camVars(a) { return { x: -a.x * a.zoom, y: -a.y * a.zoom, scale: a.zoom }; }
  // build({ root }) may pass #stage-world itself (compose-stage does).
  function worldOf(root) {
    root = root || document;
    return root.id === 'stage-world' ? root : root.querySelector('#stage-world');
  }
  // Non-camera kinds move the world to the incoming anchor at the swap time.
  function snapCam(tl, root, toEl, t) {
    var w = worldOf(root), b = anchorOf(toEl);
    if (!w || !b.set || !st.cam) return;
    if (b.x !== st.cam.x || b.y !== st.cam.y || b.zoom !== st.cam.zoom) {
      tl.fromTo(w, camVars(st.cam), Object.assign(camVars(b), { duration: 0, immediateRender: false }), t);
    }
    st.cam = b;
  }
  function wipeLayer(root, fromEl) {
    var host = worldOf(root) ? worldOf(root).parentNode : fromEl.parentNode;
    var el = host.querySelector(':scope > [data-ddx-wipe]');
    if (el) return el;
    el = document.createElement('div');
    el.setAttribute('data-ddx-wipe', '');
    el.setAttribute('aria-hidden', 'true');
    // Hidden state set here, outside the timeline (no light flash frame).
    el.style.cssText = 'position:absolute;inset:0;z-index:50;pointer-events:none;background:var(--brand-color-primary);clip-path:inset(0% 100% 0% 0%)';
    var mark = brandMark();
    if (mark) {
      el.setAttribute('data-ddx-wipe', 'brand');
      el.appendChild(brandLoader(mark));
    }
    host.appendChild(el);
    return el;
  }

  // Brand wipe (2026-10-21): opt-in when the page carries <template id="ddx-wipe-mark">
  // holding the official mark <img>. The wipe then gets a
  // wavy, per-boundary seeded edge and the Dudoxx brand loader (dashed orbit, 48 HUD ticks, two cobalt arcs, orange
  // satellite, breathing halo, the real mark on a card disc). Without the template the
  // plain inset wipe below is unchanged.
  function brandMark() {
    var t = document.getElementById('ddx-wipe-mark');
    var img = t && t.content && t.content.querySelector('img');
    return img ? img.getAttribute('src') : null;
  }
  function brandLoader(src) {
    var box = document.createElement('div');
    box.setAttribute('data-ddx-wipe-loader', '');
    box.style.cssText = 'position:absolute;left:50%;top:50%;width:300px;height:300px;margin:-150px 0 0 -150px;opacity:0';
    var c = 2 * Math.PI * 80, tick = c / 48;
    var arc = 2 * Math.PI * 66;
    box.innerHTML = '<svg viewBox="0 0 200 200" width="300" height="300" aria-hidden="true" style="overflow:visible">'
      + '<circle cx="100" cy="100" r="96" style="fill:var(--brand-color-bg)"/>'
      + '<circle data-l="halo" cx="100" cy="100" r="58" style="fill:var(--brand-color-primary);opacity:.15"/>'
      + '<g data-l="orbit"><circle cx="100" cy="100" r="92" style="fill:none;stroke:var(--brand-color-primary);stroke-opacity:.3;stroke-width:1"/>'
      + '<circle cx="100" cy="100" r="99" style="fill:none;stroke:var(--brand-color-primary);stroke-opacity:.35;stroke-width:1;stroke-dasharray:3 4"/></g>'
      + '<circle data-l="ticks" cx="100" cy="100" r="80" style="fill:none;stroke:var(--brand-color-primary);stroke-opacity:.55;stroke-width:5;stroke-dasharray:' + (tick * 0.29).toFixed(2) + ' ' + (tick * 0.71).toFixed(2) + '"/>'
      + '<g data-l="arc"><circle cx="100" cy="100" r="66" style="fill:none;stroke:var(--brand-color-primary);stroke-width:4;stroke-linecap:round;stroke-dasharray:' + (arc * 0.3).toFixed(2) + ' ' + (arc * 0.7).toFixed(2) + '"/>'
      + '<circle cx="100" cy="100" r="66" transform="rotate(180 100 100)" style="fill:none;stroke:var(--brand-color-link,var(--brand-color-primary));stroke-width:4;stroke-linecap:round;stroke-dasharray:' + (arc * 0.12).toFixed(2) + ' ' + (arc * 0.88).toFixed(2) + '"/></g>'
      + '<g data-l="sat"><circle cx="100" cy="4" r="5" style="fill:var(--brand-color-signal,var(--brand-color-primary))"/></g>'
      + '<circle cx="100" cy="100" r="40" style="fill:var(--brand-color-paper,var(--brand-color-bg))"/>'
      + '<image href="' + String(src).replace(/"/g, '&quot;') + '" x="76" y="76" width="48" height="48" preserveAspectRatio="xMidYMid meet"/>'
      + '</svg>';
    return box;
  }
  function stack(tl, o, d) {
    [o.from, o.to].forEach(function (el) { if (!el.style.zIndex) G().set(el, { zIndex: 1 }); });
    tl.fromTo(o.to, { zIndex: 1 }, { zIndex: 2, duration: 0, immediateRender: false }, 0);
    tl.fromTo(o.to, { zIndex: 2 }, { zIndex: 1, duration: 0, immediateRender: false }, d);
  }

  // Ground colour a scene shows (task 042): its own opaque background, else the
  // nearest opaque ancestor, else the brand page ground. Read at build, never on
  // the play/seek path. Returns { c, own } or null.
  function opaque(c) { return !!c && c !== 'transparent' && !/^rgba\(.*,\s*0\)$/.test(c); }
  function ground(el) {
    for (var n = el; n && n.nodeType === 1; n = n.parentNode) {
      var c = getComputedStyle(n).backgroundColor;
      if (opaque(c)) return { c: c, own: n === el };
    }
    var probe = document.createElement('div');
    probe.style.cssText = 'position:absolute;visibility:hidden;background:var(--brand-color-bg)';
    document.body.appendChild(probe);
    var b = getComputedStyle(probe).backgroundColor;
    document.body.removeChild(probe);
    return opaque(b) ? { c: b, own: false } : null;
  }

  // Added to the shared bag for parts 2 and 3.
  Object.assign(P, { hide: hide, show: show, anchorOf: anchorOf, camVars: camVars, worldOf: worldOf, snapCam: snapCam,
    wipeLayer: wipeLayer, stack: stack, ground: ground, brandMark: brandMark });
})();

/* ---- part 2: the four kinds, each built into tl at local time 0..d ---- */
(function () {
  'use strict';
  var P = window.DDXMaster._tp;
  if (P.BUILD) return;
  var st = P.st, report = P.report, G = P.G, shared = P.shared, hide = P.hide, show = P.show,
    anchorOf = P.anchorOf, camVars = P.camVars, worldOf = P.worldOf, snapCam = P.snapCam, wipeLayer = P.wipeLayer;
  // Brand chapter wipe (1.2 s): the plain cobalt wipe covers in 0.25 s, holds 0.7 s
  // while the Dudoxx brand loader turns, then uncovers to the right in 0.25 s.
  // Ring speeds = the Sentinel brand loader: arc 1.4 s, ticks 9 s reverse, orbit 18 s,
  // satellite 3.2 s, halo breathe 2.4 s. Transforms + clip-path only, no callbacks.
  function brandChapter(tl, o, d, L) {
    var k = d / 1.2, c = 0.25 * k, u0 = 0.95 * k;
    tl.fromTo(L, { clipPath: 'inset(0% 100% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: c, ease: 'power2.in', immediateRender: false }, 0);
    hide(tl, o.from, c, 0);
    show(tl, o.to, c, 0);
    snapCam(tl, o.root, o.to, c);
    tl.fromTo(L, { clipPath: 'inset(0% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 100%)', duration: d - u0, ease: 'power2.out', immediateRender: false }, u0);
    var box = L.querySelector('[data-ddx-wipe-loader]');
    if (!box) return;
    var q = function (n) { return box.querySelector('[data-l="' + n + '"]'); }, so = { svgOrigin: '100 100' };
    tl.fromTo(box, { autoAlpha: 0, scale: 0.86 }, { autoAlpha: 1, scale: 1, duration: 0.2 * k, ease: 'power2.out', immediateRender: false }, c * 0.6);
    tl.fromTo(box, { autoAlpha: 1, scale: 1 }, { autoAlpha: 0, scale: 1.04, duration: 0.15 * k, ease: 'power2.in', immediateRender: false }, u0 - 0.05 * k);
    [['arc', 360 / 1.4], ['ticks', -360 / 9], ['orbit', 360 / 18], ['sat', 360 / 3.2]].forEach(function (r) {
      tl.fromTo(q(r[0]), Object.assign({ rotation: 0 }, so), Object.assign({ rotation: r[1] * d, duration: d, ease: 'none', immediateRender: false }, so), 0);
    });
    tl.fromTo(q('halo'), Object.assign({ scale: 0.9, opacity: 0.45 }, so), Object.assign({ scale: 1.08, opacity: 1, duration: d, ease: 'sine.inOut', immediateRender: false }, so), 0);
  }

  P.BUILD = {
    'cut-rise': function (tl, o, d) {
      // The stage base shows once the outgoing scene is gone; at the swap the
      // incoming ground would jump from that base (black) to light. Set the
      // base to the incoming ground and fade the outgoing linearly into it, so
      // the luma path is one ramp with no flip (task 042). Behind an opaque
      // outgoing the base switches at once; else it ramps with the fade.
      var gt = P.ground(o.to), gf = P.ground(o.from), w = worldOf(o.root), host = w ? w.parentNode : o.from.parentNode;
      if (gt && host) {
        var from = gf ? gf.c : gt.c, over = gf && gf.own ? 0 : d * 0.7;
        tl.fromTo(host, { backgroundColor: from }, { backgroundColor: gt.c, duration: over, ease: 'none', immediateRender: false }, 0);
      }
      hide(tl, o.from, 0, d * 0.7, gt ? 'none' : null);
      snapCam(tl, o.root, o.to, d * 0.7);
      show(tl, o.to, d, 0);
    },
    chapter: function (tl, o, d) {
      var L = wipeLayer(o.root, o.from), h = d / 2;
      if (L.getAttribute('data-ddx-wipe') === 'brand') return brandChapter(tl, o, d, L);
      tl.fromTo(L, { clipPath: 'inset(0% 100% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: h, ease: 'power2.in', immediateRender: false }, 0);
      hide(tl, o.from, h, 0);
      show(tl, o.to, h, 0);
      snapCam(tl, o.root, o.to, h);
      tl.fromTo(L, { clipPath: 'inset(0% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 100%)', duration: h, ease: 'power2.out', immediateRender: false }, h);
    },
    continuity: function (tl, o, d) {
      var g = G();
      snapCam(tl, o.root, o.to, 0);
      shared(o.from, o.to, 'data-flip-id').forEach(function (p) {
        if (!window.Flip) { report('transition-flip', 'continuity into ' + o.id + ': vendor/gsap/Flip.min.js not loaded — crossfade only'); return; }
        // Measured now, at build: the play/seek path never reads layout.
        var fit = window.Flip.fit(p[1], p[0], { getVars: true, scale: true });
        var to = { x: g.getProperty(p[1], 'x'), y: g.getProperty(p[1], 'y'), scaleX: g.getProperty(p[1], 'scaleX'), scaleY: g.getProperty(p[1], 'scaleY') };
        tl.fromTo(p[1], { x: fit.x, y: fit.y, scaleX: fit.scaleX, scaleY: fit.scaleY },
          Object.assign(to, { duration: d, ease: 'power2.inOut', immediateRender: false }), 0);
        hide(tl, p[0], 0, 0);
      });
      shared(o.from, o.to, 'data-morph-id').forEach(function (p) {
        if (!window.MorphSVGPlugin) { report('transition-flip', 'continuity into ' + o.id + ': MorphSVGPlugin not loaded — no morph'); return; }
        tl.fromTo(p[1], { morphSVG: p[0] }, { morphSVG: p[1].getAttribute('d'), duration: d, ease: 'power2.inOut', immediateRender: false }, 0);
        hide(tl, p[0], 0, 0);
      });
      // Incoming stacks on top (stack()) and fades in over the WHOLE window;
      // the outgoing stays opaque under it and hides at the end: every frame
      // of the stamped window is a blend (task 037).
      show(tl, o.to, 0, d);
      hide(tl, o.from, d, 0);
    },
    camera: function (tl, o, d) {
      var w = worldOf(o.root), a = st.cam || anchorOf(o.from), b = anchorOf(o.to);
      tl.fromTo(w, camVars(a), Object.assign(camVars(b), { duration: d, ease: 'cam', immediateRender: false }), 0);
      st.cam = b;
      show(tl, o.to, 0, d * 0.3);
      hide(tl, o.from, d * 0.7, d * 0.3);
    },
  };

})();

/* ---- part 3: DDXMaster.transition, build() wiring, views ---- */
(function () {
  'use strict';
  var M = window.DDXMaster, P = M._tp;
  if (M.transition) return;
  var st = P.st, KINDS = P.KINDS, DUR = P.DUR, FIXED = P.FIXED, report = P.report, G = P.G,
    plugins = P.plugins, anchorOf = P.anchorOf, camVars = P.camVars, worldOf = P.worldOf, BUILD = P.BUILD;

  /* DDXMaster.transition(kind, { from, to, durMs, master, at, id?, root? })
     from/to = the two scene sections; at = end time in ms (pictureStartMs). */
  M.transition = function (kind, o) {
    if (KINDS.indexOf(kind) < 0) throw new Error('transitions: kind must be one of ' + KINDS.join('|') + ', got ' + kind);
    if (!o || !o.master || !o.from || !o.to || !(o.at >= 0)) throw new Error('transitions: transition(kind, {from, to, master, at}) needs both sections, the master and at (ms)');
    if (kind === 'camera' && !worldOf(o.root)) {
      report('transition-camera', 'camera into ' + (o.id || '?') + ': no #stage-world wrapper — cut-rise used');
      kind = 'cut-rise';
    }
    // Brand chapter wipe (mark template present) runs 1200 ms (0.7 s loader hold); plain stays 900.
    var base = kind === 'chapter' && P.brandMark() ? DUR.chapterBrand : DUR[kind];
    var d = (FIXED[kind] || !(o.durMs > 0) ? base : o.durMs) / 1000;
    if (o.maxMs > 0) d = Math.min(d, o.maxMs / 1000);
    var tl = G().timeline({ id: 'transition:' + (o.id || '') + ':' + kind });
    P.stack(tl, o, d);
    BUILD[kind](tl, o, d);
    if (tl.duration() < d) tl.set({}, {}, d);   // pad so the end lands on at
    o.master.add(tl, o.at / 1000 - d);
    var rec = { id: o.id || null, kind: kind, startMs: Math.round(o.at - d * 1000), endMs: Math.round(o.at), inferred: !!o.inferred };
    st.list.push(rec);
    return tl;
  };

  /* Called by DDXMaster.build(): one transition per boundary, in order. */
  M._wireTransitions = function (master, scenes, root, elOf) {
    plugins();
    st.list = [];
    var w = worldOf(root), first = scenes[0] && elOf(scenes[0].id);
    st.cam = w ? anchorOf(first) : null;
    if (w) G().set(w, Object.assign(camVars(st.cam), { transformOrigin: '0 0' }));   // outside the timeline
    scenes.slice(1).forEach(function (s) { var el = elOf(s.id); if (el) G().set(el, { autoAlpha: 0 }); });
    var kinds = [], ids = [];
    for (var i = 1; i < scenes.length; i++) {
      var prev = scenes[i - 1], s = scenes[i], a = elOf(prev.id), b = elOf(s.id);
      if (!a || !b) { report('transition-scene', 'boundary ' + prev.id + ' -> ' + s.id + ': scene section missing — no transition'); continue; }
      var pick = M.selectKind(prev, s, a, b);
      var tIn = s.transitionIn || {};
      M.transition(pick.kind, { id: s.id, from: a, to: b, master: master, root: root, at: s.pictureStartMs || 0,
        durMs: tIn.durMs, maxMs: (s.pictureStartMs || 0) - (prev.pictureStartMs || 0), inferred: pick.inferred });
      kinds.push(st.list[st.list.length - 1].kind);
      ids.push(s.id);
    }
    M.checkMix(kinds, ids);
    return st.list.slice();
  };

  M.transitions = function () { return st.list.slice(); };
})();
