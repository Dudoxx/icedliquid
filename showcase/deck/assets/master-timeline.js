/**
 * @ddx       util
 * @domain    misc
 * @topic     engine
 * @purpose   One paused GSAP master timeline per page, one labelled child per timeline.json v3 scene, seeked through the DDXCue clock (double-seek) and exposed on window.__timelines.
 * @status    reusable
 */
/* ============================================================
   master-timeline.js — window.DDXMaster (plain browser script, no modules)
   ------------------------------------------------------------
   Load: after the cue runtime (scripts/cue-files.mjs CUE_FILES) and before
   any scene code; vendor/gsap/gsap.min.js must be loaded before build().

     DDXMaster.scene('s02', function (child, sceneEl, scene) {
       child.fromTo('#kpi', { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6 }, 0.2);
     });
     DDXMaster.build(timelineV3, { mode: 'capture' });   // or 'live'

   build()   gsap.timeline({ paused: true, id: 'master' }); per scene a child
             timeline at pictureStartMs, master label = scene.id. Children keep
             GSAP's default immediateRender:true for from()/fromTo(): a tween
             that starts mid-scene shows its from-state from build on, so a
             fresh page and a long backward jump agree (task 034; an explicit
             immediateRender:false is still honoured). Each child is padded to
             scene.durMs, the master to totalMs. Then the master is PRIMED:
             double-seek to its end, then back to 0, so every tween has rendered
             once (a never-rendered tween has no inline transform and can paint
             differently) and a fresh seek(0) == a replay seek(0). The master is
             registered on the DDXCue clock, so DDXCue.seek drives cues ->
             master -> stages.
   seek(tMs) = DDXCue.seek(tMs): double-seek totalTime(t+0.001,true) then
             totalTime(t,false), then every stage renderAt(tMs).
   live      go(idOrTitle) = master.tweenTo(label); play() / pause() for the
             film player. Capture mode refuses them (no wall clock in capture).
   Forbidden inside the master (thrown at build): repeat:-1 and callbacks
   (onStart/onUpdate/onComplete/... and tl.call) — frames are visited out of
   order during capture, so state changes must be tweens or sets.
   Cue adapter: cueTween(child, cue, scene, root) turns one v3 cue into a
   callback-free proxy tween that runs the DDXCue primitive at local time;
   build({ cues: true }) adapts every scene's cues. Adapted cues on one scene
   should target disjoint nodes (each tween restores its own nodes).
   ============================================================ */
(function () {
  'use strict';
  if (window.DDXMaster) return;
  var M = window.DDXMaster = {};
  var builders = {};
  var st = { master: null, mode: 'capture', scenes: [], children: {}, driver: null, root: null };
  var CALLBACKS = ['onStart', 'onUpdate', 'onComplete', 'onRepeat', 'onReverseComplete', 'onInterrupt'];

  function D() {
    if (!window.DDXCue) throw new Error('master-timeline: load the cue runtime (scripts/cue-files.mjs CUE_FILES) first');
    return window.DDXCue;
  }
  function report(kind, msg) { D()._lib.report(kind, msg); }
  function gsap() {
    if (!window.gsap) throw new Error('master-timeline: load vendor/gsap/gsap.min.js before DDXMaster.build()');
    return window.gsap;
  }
  function sceneElOf(root, id) {
    var q = '[data-scene="' + id + '"],[data-slide-id="' + id + '"]';
    return root.querySelector(q) || document.getElementById(id);
  }

  // Rejects what breaks out-of-order seeking: endless repeats and callbacks.
  function lint(tl, where) {
    var all = [tl].concat(tl.getChildren(true, true, true));
    all.forEach(function (c) {
      if (c.repeat() === -1) throw new Error('master-timeline ' + where + ': repeat:-1 is forbidden — use a finite timeline');
      var v = c.vars || {};
      CALLBACKS.forEach(function (k) {
        if (typeof v[k] === 'function') throw new Error('master-timeline ' + where + ': ' + k + ' callback is forbidden (frames are seeked out of order) — use a tween or a set');
      });
    });
  }

  /* ---- cue -> tween adapter ---- */
  M.cueTween = function (child, cue, scene, root) {
    var C = D(), K = C._k;
    var raw = { id: cue.id, type: cue.type || cue.preset, preset: cue.preset, target: cue.target, startMs: cue.startMs, durMs: cue.durMs, params: cue.params };
    var c = K.normalize(raw, 0, { id: scene.id, durMs: scene.durMs }, { flavor: 'capture' });
    var label = 'cue ' + c.id + ' (' + c.type + ') in master scene ' + scene.id;
    if (!c.prim) { report('unknown-type', label + ': unknown type "' + c.type + '"'); return null; }
    var els = K.resolve(root || document, c.target, label);
    if (!els.length) return null;
    var nodes = [];
    els.forEach(function (el, i) {
      try { if (c.prim.setup) c.prim.setup(el, c.p, i); } catch (e) { report('primitive-threw', 'setup of ' + label + ' threw: ' + e.message); }
      K.snapshotNode(el, c.prim.text);
      nodes.push(el);
      if (c.prim.nodes) c.prim.nodes(el, c.p).forEach(function (n) { if (n && n.nodeType === 1) { K.snapshotNode(n, false); nodes.push(n); } });
    });
    nodes.forEach(function (n) { n.__baseT = (C._lib.isSvg(n) ? n.getAttribute('transform') : n.style.transform) || ''; });
    var prime = c.prim.selfReset || c.prim.prime !== false, cur = 0;
    // GSAP treats a function property as getter (no args) / setter (one arg):
    // the primitive runs as part of the render, never as an event callback.
    var proxy = { t: function (v) {
      if (!arguments.length) return cur;
      cur = v;
      nodes.forEach(K.restoreNode);
      if (v <= 0 && !prime) return;
      els.forEach(function (el, i) {
        try { if (c.prim.measure) c.prim.measure(el, c.p); c.prim.apply(el, v, c.p, i); }
        catch (e) { report('primitive-threw', label + ' threw: ' + e.message); }
      });
    } };
    var at = Math.max(0, (c.start - scene.pictureStartMs) / 1000);
    // immediateRender:true parks the cue at local 0 from build on (the cue
    // runtime's park rule): a fresh seek and a rewind then agree.
    child.fromTo(proxy, { t: 0 }, { t: c.p.dur, duration: Math.max(c.p.dur, 0.001), ease: 'none', immediateRender: true }, at);
    return proxy;
  };

  // Build-time prime (task 034): render every tween once, end then 0, through
  // the clock's own seek (DDXCue._k.seekTl), so the first seek of a fresh page
  // starts from the DOM state a replayed page has.
  function prime(tl) {
    var K = D()._k;
    K.seekTl(tl, tl.totalDuration());
    K.seekTl(tl, 0);
  }

  // Shared with parts 2 and 3 (one file, three IIFEs: no function over 100 lines).
  // childDefaults / prime are read at build time; master-seek-test swaps them for
  // the pre-034 behaviour ({ immediateRender:false }, no prime) in its controls.
  M._p = { st: st, builders: builders, D: D, report: report, gsap: gsap, sceneElOf: sceneElOf, lint: lint,
    childDefaults: {}, prime: prime };
})();

/* ---- part 2: build, late scene registration, seek ---- */
(function () {
  'use strict';
  var M = window.DDXMaster, P = M._p;
  if (M.build) return;
  var st = P.st, builders = P.builders, D = P.D, report = P.report, gsap = P.gsap, sceneElOf = P.sceneElOf, lint = P.lint;

  function fillChild(id) {
    var child = st.children[id], scene = st.scenes.filter(function (s) { return s.id === id; })[0];
    if (!child || !scene || !builders[id]) return;
    builders[id](child, sceneElOf(st.root, id), scene);
    lint(child, 'scene ' + id);
  }

  /* ---- build ---- */
  M.build = function (tl3, opts) {
    opts = opts || {};
    var g = gsap(), C = D(), S = C._s;
    if (!tl3 || !Array.isArray(tl3.scenes)) throw new Error('master-timeline: build() needs a timeline.json v3 document with scenes[]');
    if (opts.mode && opts.mode !== 'capture' && opts.mode !== 'live') throw new Error('master-timeline: mode must be capture|live, got ' + opts.mode);
    if (st.master) {
      M.pause();
      var old = S.timelines.indexOf(st.master);
      if (old >= 0) S.timelines.splice(old, 1);
      st.master.kill();
    }
    g.config({ force3D: false });   // seek-pure rendering, as kit/gsap-scene.js
    g.ticker.lagSmoothing(0);
    st.mode = opts.mode || 'capture';
    st.root = opts.root || document;
    st.scenes = tl3.scenes.slice();
    st.children = {};
    var master = g.timeline({ paused: true, id: 'master' });
    st.scenes.forEach(function (scene) {
      if (!scene.id) throw new Error('master-timeline: a scene has no id');
      var t = (scene.pictureStartMs || 0) / 1000;
      var child = g.timeline({ id: 'scene:' + scene.id, defaults: Object.assign({}, P.childDefaults) });
      st.children[scene.id] = child;
      if (opts.cues) (scene.cues || []).forEach(function (cue) { M.cueTween(child, cue, scene, sceneElOf(st.root, scene.id) || st.root); });
      fillChild(scene.id);
      if (scene.durMs > 0) child.set({}, {}, scene.durMs / 1000);   // pad: child spans the scene
      master.add(child, t);
      master.addLabel(scene.id, t);
    });
    // Scene boundaries: engine/transitions.js (4 kinds). Without it no
    // transition is added (compose-stage then hard-cuts at pictureStartMs).
    if (M._wireTransitions) M._wireTransitions(master, st.scenes, st.root, function (id) { return sceneElOf(st.root, id); });
    if (tl3.totalMs > 0) master.set({}, {}, tl3.totalMs / 1000);
    lint(master, 'master');
    P.prime(master);
    st.master = master;
    var others = S.timelines.length;
    C.registerTimeline(master);   // double-seeks it to the current clock time
    if (others) report('mixed-timelines', others + ' per-slide GSAP timeline(s) registered beside the master — build every scene with DDXMaster.scene()');
    if (st.mode === 'capture') {
      // Seeking re-wakes the ticker (GSAP _wake); stages run last in each seek.
      C.registerStage({ id: 'gsap-ticker-sleep:master', renderAt: function () { g.ticker.sleep(); } });
      g.ticker.sleep();
    }
    window.__ddxSeek = M.seek;
    return master;
  };

  /* Late registration fills an already-built child, then re-seeks. */
  M.scene = function (id, fn) {
    if (!id || typeof fn !== 'function') throw new Error('master-timeline: scene(id, fn(child, sceneEl, scene)) needs an id and a function');
    builders[id] = fn;
    if (st.master && st.children[id]) {
      if (st.children[id].getChildren(false).length > 1) report('scene-rebuilt', 'scene ' + id + ' registered after build into a non-empty child');
      fillChild(id);
      P.prime(st.master);
      D().seek(D().time());
    }
  };

  M.seek = function (tMs) { return D().seek(tMs); };
})();

/* ---- part 3: live driving (deck + film player) and read-only views ---- */
(function () {
  'use strict';
  var M = window.DDXMaster, P = M._p;
  if (M.go) return;
  var st = P.st, D = P.D, report = P.report, gsap = P.gsap;

  function live(what) {
    if (!st.master) { report('master-live', what + '() before DDXMaster.build()'); return false; }
    if (st.mode !== 'live') { report('master-live', what + '() needs mode:"live" — capture moves only by seek(tMs)'); return false; }
    return true;
  }
  function drive(position, vars) {
    M.pause();
    var g = gsap();
    vars = vars || {};
    var reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { D().seek((typeof position === 'number' ? position : st.master.labels[position]) * 1000); return null; }
    g.ticker.wake();
    // The driver tween lives outside the master; its onUpdate only mirrors the
    // master's time onto cues and stages through the same seek path.
    st.driver = st.master.tweenTo(position, { duration: vars.duration, ease: vars.ease || 'power2.inOut',
      onUpdate: function () { D().seek(st.master.totalTime() * 1000); } });
    return st.driver;
  }
  M.labelOf = function (key) {
    if (!st.master) return null;
    if (st.master.labels[key] != null) return key;
    var hit = st.scenes.filter(function (s) { return s.label === key; })[0];
    return hit ? hit.id : null;
  };
  M.go = function (key, vars) {
    if (!live('go')) return null;
    var label = M.labelOf(key);
    if (label == null) { report('master-label', 'go("' + key + '"): no scene with that id or title'); return null; }
    return drive(label, vars);
  };
  M.play = function () {
    if (!live('play')) return null;
    var dur = st.master.duration();
    return drive(dur, { duration: dur - st.master.totalTime(), ease: 'none' });
  };
  M.pause = function () {
    if (st.driver) { st.driver.kill(); st.driver = null; }
  };

  /* ---- read-only views ---- */
  M.master = function () { return st.master; };
  M.mode = function () { return st.mode; };
  M.durationMs = function () { return st.master ? Math.round(st.master.duration() * 1000) : 0; };
  M.labels = function () {
    if (!st.master) return [];
    var L = st.master.labels;
    return Object.keys(L).map(function (k) { return { id: k, ms: Math.round(L[k] * 1000) }; })
      .sort(function (a, b) { return a.ms - b.ms; });
  };
})();
