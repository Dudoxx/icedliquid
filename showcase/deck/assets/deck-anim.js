/**
 * @ddx       util
 * @domain    holding
 * @topic     engine
 * @purpose   Player shim over cue-runtime.js — slide activation, the per-slide clock (narration <audio> or wall time) and window.DECK_ANIM for the browsable deck.
 * @status    legacy
 * Primitives, rewind and phrase bus live in cue-runtime.js + cue-types-*.js (DDXCue).
 * Data, per slide id: window.DECK_TIMELINES (baked slides/_anim/<id>.timeline.json,
 * the same document capture and the studio load), else the legacy DECK_CUES /
 * DECK_PHRASES tables. None of them -> no-op.
 * Clock: <audio data-slide-audio="<id>"> currentTime while the narration plays;
 * wall time while it is silent, blocked by autoplay, or absent. The first user
 * gesture restarts the current slide with sound (autoplay policy).
 * Two plain scripts' worth of IIFEs (no modules — file:// loadable): part 1 is the
 * core (state, clock, slide start/stop) on window.__deckAnimCore; part 2 wires
 * activation, gestures and the DECK_ANIM API over it.
 * Master path (parts 3-4, task 010): when window.__TIMELINE_V3 exists and every
 * scene has its .slide[data-slide-id] in the page, parts 1-2 stand down and the
 * deck runs on ONE paused DDXMaster timeline (mode 'live', root #stage, cues
 * adapted). Slide activation (deck-engine show) = master.tweenTo(scene label)
 * from the start of that scene's incoming transition, then master.tweenTo(hold)
 * — hold = start of the outgoing transition, so the slide settles and waits.
 * A new activation kills the in-flight tweens. Kit bookends (DDXKit.scene
 * 'kit-<kind>') build into their scene's master child. P / #pauseBtn pause the
 * master (WCAG 2.2.2). Reduced motion: seek to the hold + 150 ms opacity fade.
 */
/* ---- part 1: core ---- */
(function () {
  'use strict';
  var TLS = window.DECK_TIMELINES || null, CUES = window.DECK_CUES || null, PHRASES = window.DECK_PHRASES || null, V3 = window.__TIMELINE_V3 || null;
  if (!TLS && !CUES && !PHRASES && !V3) return;
  var me = document.currentScript;
  var CUE_FILES = ['cue-runtime.js', 'cue-types-reveal.js', 'cue-types-motion.js', 'cue-types-data.js', 'master-timeline.js', 'transitions.js', 'motion-presets.js', 'stage-camera.js'];   // = scripts/cue-files.mjs
  if (!window.DDXCue && me && me.src && document.readyState === 'loading') CUE_FILES.forEach(function (f) { document.write('<script src="' + me.src.replace(/deck-anim\.js(\?.*)?$/, f) + '"><\/script>'); });
  // Master path (parts 3-4): a v3 timeline AND every scene's section in this
  // page. A one-slide split page (deck-gates) keeps the per-slide clock below.
  var all = V3 && Array.isArray(V3.scenes) && V3.scenes.length && V3.scenes.every(function (s) {
    return s && s.id && document.querySelector('.slide[data-slide-id="' + s.id + '"]');
  });
  if (all) { window.__deckAnimMode = 'master'; return; }
  if (!TLS && !CUES && !PHRASES) return;
  var K = window.__deckAnimCore = { current: null, paused: false, pausedAt: 0,
    reduce: !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) };
  K.C = function () { return window.DDXCue; };
  K.seek = function (tSec) { K.C().seek(tSec * 1000); };
  K.clockTime = function () {
    var cur = K.current;
    if (K.paused) return K.pausedAt;
    if (!cur) return 0;
    if (cur.audio && cur.live) return cur.audio.currentTime;
    return (performance.now() - cur.t0) / 1000;
  };
  function stage() { return document.getElementById('stage'); }
  K.markClock = function () { var st = stage(); if (st) { if (K.paused) st.setAttribute('data-clock', 'virtual'); else st.removeAttribute('data-clock'); } };
  K.announce = function (t) {   // hand-off to deck.css (--deck-t) and timeline.js
    var st = stage(); if (st) st.style.setProperty('--deck-t', String(t));
    window.dispatchEvent(new CustomEvent('deckanim:seek', { detail: { t: t, virtual: K.paused } }));
  };
  // timeline.json phrases [{startMs,endMs,text}] -> the runtime phrase-bus shape.
  function phraseTrack(tl) {
    if (!Array.isArray(tl.phrases) || !tl.phrases.length) return null;
    return { total: (tl.durMs || 0) / 1000, phrases: tl.phrases.map(function (p) { return { debut: p.startMs / 1000, duree: (p.endMs - p.startMs) / 1000, phrase: p.text }; }) };
  }
  // Baked timelines load with the capture defaults (same timing as the MP4);
  // legacy tables keep deck-anim's seconds-based defaults.
  function timelineFor(id) {
    var tl = TLS && TLS[id];
    if (tl) return { data: { id: id, durMs: tl.durMs, cues: tl.cues || [], phrases: phraseTrack(tl) }, opts: { defaultEasing: 'ease-out' } };
    var cues = (CUES && CUES[id]) || [], ph = (PHRASES && PHRASES[id]) || null;
    if (!cues.length && !ph) return null;
    return { data: { id: id, cues: cues, phrases: ph }, opts: { defaultEasing: 'expo', defaultDur: 0.6 } };
  }
  K.playAudio = function (cur) {
    var p = cur.audio.play();
    if (p && p.catch) p.catch(function () { cur.blocked = true; });   // autoplay blocked: wall clock until a gesture
  };
  function attachAudio(cur) {
    var a = cur.audio;
    a.onplaying = function () { if (K.current === cur) { cur.live = true; cur.blocked = false; } };
    // Narration paused or ended: the wall clock carries on from the audio position.
    a.onpause = function () { if (K.current === cur) { cur.live = false; cur.t0 = performance.now() - a.currentTime * 1000; } };
    try { a.currentTime = 0; } catch (e) { /* metadata not loaded yet */ }
    if (!K.paused && !K.reduce) K.playAudio(cur);
  }
  K.stop = function () {
    var cur = K.current;
    if (!cur) return;
    if (cur.raf) cancelAnimationFrame(cur.raf);
    if (cur.audio) { cur.audio.onplaying = cur.audio.onpause = null; cur.audio.pause(); }
    K.current = null;
  };
  function runtimeMissing() {
    (window.__cueErrors = window.__cueErrors || []).push({ kind: 'runtime-missing', message: 'deck-anim.js: DDXCue missing' });
    console.error('[cue-runtime] deck-anim.js: DDXCue missing — ship engine/cue-runtime.js + cue-types-*.js beside it');
  }
  K.start = function (slideEl) {
    K.stop();
    var id = slideEl.dataset.slideId || slideEl.id; if (!id) return;
    K.pausedAt = 0; if (K.paused) K.announce(0);
    var tl = timelineFor(id); if (!tl) return;
    if (!K.C()) { runtimeMissing(); return; }
    var o = tl.opts; o.root = slideEl; o.flavor = 'deck';
    K.C().load(tl.data, o);
    var cur = K.current = { el: slideEl, t0: performance.now(), raf: 0, audio: document.querySelector('audio[data-slide-audio="' + id + '"]'), live: false, blocked: false };
    K.C().setClock({ now: function () { return K.clockTime() * 1000; } });
    if (cur.audio) attachAudio(cur);
    if (K.reduce) { K.seek(1e6); return; }
    (function loop() {
      if (K.current !== cur) return;
      if (!K.paused) K.C().tick();
      cur.raf = requestAnimationFrame(loop);
    })();
  };
})();

/* ---- part 2: activation, gestures, DECK_ANIM ---- */
(function () {
  'use strict';
  var K = window.__deckAnimCore;
  if (!K) return;
  function activeSlide() { return document.querySelector('.slide.active'); }
  var obs = new MutationObserver(function (muts) {
    for (var i = 0; i < muts.length; i++) {
      var t = muts[i].target;
      if (t.classList && t.classList.contains('slide') && t.classList.contains('active')) { if (!K.current || K.current.el !== t) K.start(t); return; }
    }
  });
  Array.prototype.forEach.call(document.querySelectorAll('.slide'), function (s) { obs.observe(s, { attributes: true, attributeFilter: ['class'] }); });
  function boot() { var a = activeSlide(); if (a) K.start(a); }
  if (document.readyState === 'complete') boot(); else window.addEventListener('load', boot, { once: true });
  window.addEventListener('keydown', function (e) { if (e.key && e.key.toLowerCase() === 'r') boot(); });
  // First gesture after a blocked autoplay: replay the current slide with sound.
  function onGesture() { if (K.current && K.current.blocked && !K.paused) K.start(K.current.el); }
  window.addEventListener('pointerdown', onGesture, true);
  window.addEventListener('keydown', onGesture, true);
  function setAudioTime(t) { try { K.current.audio.currentTime = t; } catch (e) { /* not seekable yet */ } }
  window.DECK_ANIM = {
    seek: function (t) {
      if (K.paused) K.pausedAt = t;
      if (!K.current) { K.announce(K.clockTime()); return; }
      if (K.current.audio) setAudioTime(t);
      if (!K.paused) K.current.t0 = performance.now() - t * 1000;
      K.seek(t); K.announce(t);
    },
    pause: function () {
      if (K.paused) return; K.pausedAt = K.clockTime(); K.paused = true; K.markClock();
      if (K.current && K.current.audio) K.current.audio.pause();
      if (K.current) K.seek(K.pausedAt); K.announce(K.pausedAt);
    },
    resume: function () {
      if (!K.paused) return; K.paused = false;
      if (K.current) {
        K.current.t0 = performance.now() - K.pausedAt * 1000;
        if (K.current.audio) { setAudioTime(K.pausedAt); K.playAudio(K.current); }
      }
      K.markClock(); K.announce(K.pausedAt);
    },
    isPaused: function () { return K.paused; }, restart: boot, time: K.clockTime,
    get primitives() { return K.C() ? K.C().primitives : {}; }
  };
})();

/* ---- part 3: master path — scene table, kit routing, navigation (task 010) ---- */
(function () {
  'use strict';
  if (window.__deckAnimMode !== 'master') return;
  var V3 = window.__TIMELINE_V3, scenes = V3.scenes;
  var R = window.__deckAnimMaster = { scenes: scenes, seq: null, paused: false, index: -1, built: false,
    reduce: !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) };
  function M() { return window.DDXMaster; }
  R.slideOf = function (id) { return document.querySelector('.slide[data-slide-id="' + id + '"]'); };
  R.indexOf = function (id) { for (var i = 0; i < scenes.length; i++) if (scenes[i].id === id) return i; return -1; };
  R.labelMs = function (i) { return scenes[i].pictureStartMs || 0; };
  // Hold = start of the transition out of scene i, else the next label / the end.
  R.holdMs = function (i) {
    var next = scenes[i + 1], end = next ? R.labelMs(i + 1) : (V3.totalMs || R.labelMs(i) + (scenes[i].durMs || 0));
    if (!next || !M() || !M().transitions) return end;
    var hit = M().transitions().filter(function (t) { return Math.abs(t.endMs - end) < 1; })[0];
    return hit ? Math.max(R.labelMs(i), hit.startMs) : end;
  };
  // Kit bookends build DDXKit.scene('kit-<kind>'): route it into the master
  // child of the slide holding [data-kit="<kind>"] — no second clock.
  R.routeKit = function () {
    var K = window.DDXKit = window.DDXKit || {};
    if (K.scene && K.scene.__master) return;
    var own = K.scene;
    K.scene = function (name, build) {
      var kind = /^kit-(.+)$/.exec(name), host = kind && document.querySelector('[data-kit="' + kind[1] + '"]');
      var sl = host && host.closest('.slide[data-slide-id]');
      if (!sl || !M()) return own ? own(name, build) : null;
      M().scene(sl.getAttribute('data-slide-id'), function (child) { build(child); });
      return null;
    };
    K.scene.__master = true;
  };
  R.routeKit();

  // The driver tweens live outside the master; onUpdate only mirrors the
  // master's time onto cues and stages through the one seek path (as DDXMaster.go).
  function mirror() { window.DDXCue.seek(M().master().totalTime() * 1000); }
  R.stop = function () {
    if (R.seq) { R.seq.kill(); R.seq = null; }
    if (M() && M().pause) M().pause();
  };
  // From now: master.tweenTo(label) when the playhead is before it, then tweenTo(hold).
  R.play = function (label, hold) {
    var g = window.gsap, tl = M().master(), now = tl.totalTime() * 1000;
    var seq = R.seq = g.timeline();
    function leg(toMs, fromMs) {
      if (toMs - fromMs > 0.5) seq.add(tl.tweenTo(toMs / 1000, { duration: (toMs - fromMs) / 1000, ease: 'none', onUpdate: mirror }));
    }
    leg(label, now);
    leg(hold, Math.max(now, label));
    g.ticker.wake();
  };
  function fade() {
    var st = document.getElementById('stage');
    if (st && window.gsap) window.gsap.fromTo(st, { opacity: 0 }, { opacity: 1, duration: 0.15, ease: 'none', overwrite: true });
  }
  // Slide i: start of its incoming transition -> label -> hold. A new call
  // kills the in-flight legs (rapid key presses). Paused: land on the hold.
  // Reduced motion: seek to the hold (end values kept) + a 150 ms opacity fade.
  R.go = function (i) {
    if (!R.built || i < 0) return;
    R.stop();
    R.index = i;
    var label = R.labelMs(i), hold = R.holdMs(i);
    if (R.paused || R.reduce) { M().seek(hold); if (R.reduce && !R.paused) fade(); return; }
    M().seek(i > 0 ? R.holdMs(i - 1) : label);
    R.play(label, hold);
  };
  R.setPaused = function (on) {
    if (!!on === R.paused) return;
    R.paused = !!on;
    R.stop();
    if (!R.paused && R.built && R.index >= 0 && !R.reduce) R.play(R.labelMs(R.index), R.holdMs(R.index));
    if (R.mark) R.mark();
  };
})();

/* ---- part 4: master boot, activation, pause control, DECK_ANIM ---- */
(function () {
  'use strict';
  var R = window.__deckAnimMaster;
  if (!R) return;
  function stage() { return document.getElementById('stage'); }
  function idx(el) { return el ? R.indexOf(el.getAttribute('data-slide-id')) : -1; }
  function err(kind, msg) {
    (window.__cueErrors = window.__cueErrors || []).push({ kind: kind, message: 'deck-anim.js: ' + msg });
    console.error('[cue-runtime] deck-anim.js: ' + msg);
  }
  // WCAG 2.2.2: the HUD button mirrors the paused state (P key or click).
  R.mark = function () {
    var st = stage(), b = document.getElementById('pauseBtn');
    if (st) { if (R.paused) st.setAttribute('data-clock', 'virtual'); else st.removeAttribute('data-clock'); }
    if (!b) return;
    b.setAttribute('aria-pressed', R.paused ? 'true' : 'false');
    b.title = R.paused ? 'Resume motion (P)' : 'Pause motion (P)';
    b.innerHTML = R.paused ? '&#9654;' : '&#10073;&#10073;';
  };
  function boot() {
    if (R.built) return;
    if (!window.DDXMaster || !window.gsap) { err('runtime-missing', 'DDXMaster or gsap missing — load CUE_FILES + vendor/gsap before deck-anim.js'); return; }
    R.routeKit();
    try { window.DDXMaster.build(window.__TIMELINE_V3, { mode: 'live', root: stage() || document, cues: true }); }
    catch (e) { err('master-build', 'DDXMaster.build failed: ' + e.message); return; }
    // Every scene section stays laid out; the master's transitions own visibility.
    R.scenes.forEach(function (s) { R.slideOf(s.id).style.display = 'block'; });
    var deck = document.getElementById('deck');
    if (deck) deck.setAttribute('data-master', 'live');
    R.built = true;
    R.mark();
    R.go(Math.max(0, idx(document.querySelector('.slide.active'))));
  }
  // deck-engine show() flips .active; the master follows the slide id.
  var obs = new MutationObserver(function (muts) {
    for (var i = 0; i < muts.length; i++) {
      var t = muts[i].target;
      if (t.classList && t.classList.contains('active')) { var n = idx(t); if (n >= 0 && n !== R.index) R.go(n); return; }
    }
  });
  R.scenes.forEach(function (s) { obs.observe(R.slideOf(s.id), { attributes: true, attributeFilter: ['class'] }); });
  if (document.readyState === 'complete') boot(); else window.addEventListener('load', boot, { once: true });
  window.addEventListener('keydown', function (e) {
    var k = e.key && e.key.toLowerCase();
    if (k === 'p') { e.preventDefault(); R.setPaused(!R.paused); } else if (k === 'r') R.go(R.index);
  });
  var btn = document.getElementById('pauseBtn');
  if (btn) btn.addEventListener('click', function (e) { e.stopPropagation(); R.setPaused(!R.paused); });
  function sceneT() { return R.index >= 0 ? R.labelMs(R.index) : 0; }
  // Same surface as the per-slide API; t = seconds from the active scene's label.
  window.DECK_ANIM = {
    mode: 'master',
    seek: function (t) {
      if (!R.built) return;
      R.stop();
      window.DDXMaster.seek(sceneT() + t * 1000);
      if (!R.paused && !R.reduce && R.index >= 0) R.play(R.labelMs(R.index), R.holdMs(R.index));
    },
    pause: function () { R.setPaused(true); },
    resume: function () { R.setPaused(false); },
    isPaused: function () { return R.paused; },
    restart: function () { R.go(R.index); },
    time: function () { var m = window.DDXMaster && window.DDXMaster.master(); return m ? m.totalTime() - sceneT() / 1000 : 0; },
    label: function (i) { return { id: R.scenes[i].id, ms: R.labelMs(i), holdMs: R.holdMs(i) }; },
    get primitives() { return window.DDXCue ? window.DDXCue.primitives : {}; }
  };
})();
