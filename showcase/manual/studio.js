/* Motion system for the piece presets (window.STUDIO).
   The presets live in studio-presets.js (window.STUDIO_REG): durations, palette eases and
   choreography. Rule: REVEAL is not MOTION, every content scene needs >=1 motion effect.
   Not a copy of engine/motion-presets.js: that file needs the DDXCue runtime; here every preset
   is a callback-free fromTo on the ONE master timeline (seek-pure, finite, no repeat:-1).

     STUDIO.preset('rise', tl, els, at)               fixed duration + ease from the registry
     STUDIO.preset('exit-fade', tl, els, at)           0.6 x its paired entrance
     STUDIO.camera(tl, rig, 'breathe', at, dur)        push · pull · pan · breathe · orbit · hold
     STUDIO.enter(tl, head, items, at, dur)            kit entrance plan: head 0.15 s, items 0.45 s, clamped stagger
     STUDIO.durOf(name)                               seconds
     STUDIO.preset('highlight', tl, el, at, { hold }) marker bands measured from the text lines (see highlight below)
     STUDIO.hlSync(t)                                 runtime render(t) calls it: measures the highlights that are due */
(function () {
  'use strict';
  var gsap = window.gsap;
  var REG = window.STUDIO_REG;
  if (!REG || !REG.presets) throw new Error('studio: studio-presets.js missing — rebuild with build-piece.mjs');
  var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  ['CustomEase', 'SplitText', 'DrawSVGPlugin'].forEach(function (n) { if (window[n]) gsap.registerPlugin(window[n]); });

  // Palette: "a,b,c,d" = cubic-bezier → CustomEase; anything else is a GSAP ease name.
  var eases = {};
  function ease(key) {
    if (eases[key]) return eases[key];
    var v = REG.palette[key] || key;
    eases[key] = /^[\d.\-]+(,[\d.\-]+){3}$/.test(v) && window.CustomEase ? window.CustomEase.create('studio-' + key, v) : v;
    return eases[key];
  }
  function spec(name) { var n = REG.presets[name] ? name : (REG.legacyMap || {})[name]; return n ? REG.presets[n] : null; }
  function durOf(name, after) {
    var s = spec(name);
    if (!s) throw new Error('studio: unknown preset "' + name + '"');
    var pair = s.pairs && spec(after || s.pairs);
    return pair ? Math.round(pair.durS * REG.choreography.exitFraction * 1000) / 1000 : s.durS;
  }
  function els(t) {
    if (!t) return [];
    if (typeof t === 'string') return Array.prototype.slice.call(document.querySelectorAll(t));
    if (t.nodeType === 1) return [t];
    return Array.prototype.slice.call(t).filter(function (n) { return n && n.nodeType === 1; });
  }
  function ft(tl, T, at, d, e, from, to, x) {
    x = x || {};
    var v = {}; for (var k in to) v[k] = to[k];
    v.duration = d; v.ease = e; v.immediateRender = !x.exit;
    if (x.stagger && T.length > 1) v.stagger = x.stagger;
    if (x.repeat) { v.repeat = x.repeat; v.yoyo = true; }
    tl.fromTo(T, from, v, at);
  }
  // From -> to pairs copied from engine/motion-presets.js part 2 (same pictures).
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
  // Rail = bar-grow along x (slide-design-rules Rule 7 "Rail-scale-X": accent lines, timelines, bars).
  var RAIL = [{ scaleX: 0, transformOrigin: '0% 50%' }, { scaleX: 1, transformOrigin: '0% 50%' }];

  // Word / line masks: SplitText when vendored (it is, via scaffold), else a plain rise.
  // v2 (D-037 D-039 D-043): a mask reveal slices glyphs horizontally while it runs, and the registry
  // curve (expo, 0.9 s) spends ~0.6 s in the last 10 %. So the part is (1) capped at MASK_MAX s on a
  // plain decelerate curve, (2) faded in over its first 55 % so the cut is faint, never a row of
  // fragments, and (3) given descender room (padding + negative margin on the mask box) which is
  // released (overflow visible) the moment the reveal ends. Legible within ~250 ms of its start.
  var MASK_MAX = 0.55, MASK_PAD = '0.16em';
  function split(el, type) {
    if (!window.SplitText) return null;
    if (!el.__studioSplit) {
      el.__studioSplit = window.SplitText.create
        ? window.SplitText.create(el, { type: type, mask: type, autoSplit: false })
        : new window.SplitText(el, { type: type });
      (el.__studioSplit.masks || []).forEach(function (m) {
        m.style.paddingBottom = MASK_PAD; m.style.marginBottom = '-' + MASK_PAD;
        m.style.paddingTop = '0.06em'; m.style.marginTop = '-0.06em';
      });
    }
    return el.__studioSplit[type] || null;
  }
  function masked(type) {
    return function (tl, T, at, d, e, s) {
      var parts = [], masks = [];
      T.forEach(function (el) {
        var p = split(el, type);
        if (p) { parts = parts.concat(Array.prototype.slice.call(p)); masks = masks.concat(el.__studioSplit.masks || []); }
      });
      if (!parts.length) return ft(tl, T, at, d, e, FT.rise[0], FT.rise[1]);
      var dm = Math.min(d, MASK_MAX), st = s.stagger || 0;
      tl.fromTo(parts, { yPercent: 100 }, { yPercent: 0, duration: dm, ease: ease('out'), stagger: st, immediateRender: true }, at);
      tl.fromTo(parts, { opacity: 0 }, { opacity: 1, duration: dm * 0.55, ease: 'none', stagger: st, immediateRender: true }, at);
      if (masks.length) {
        var done = at + dm + st * Math.max(0, parts.length - 1);
        tl.fromTo(masks, { overflow: 'clip' }, { overflow: 'visible', duration: 0.001, ease: 'none', immediateRender: false }, done);
      }
    };
  }
  function drawOn(tl, T, at, d, e) {
    T.forEach(function (el) {
      var len = el.getTotalLength ? Math.ceil(el.getTotalLength()) || 1 : 1000;
      ft(tl, [el], at, d, e, { strokeDasharray: len, strokeDashoffset: len }, { strokeDasharray: len, strokeDashoffset: 0 });
    });
  }
  // ---- highlight: a marker band MEASURED from the text (v2d, 2026-10-18) -----------------------------
  // The v2 marker was the host's ::after (bottom 42 % of the BOX): on a padded pill it covered half the
  // text, shifted off it. Now: one <i class="hl-band"> per rendered text LINE, sized from a Range over the
  // target's text nodes (the line rect, not the outer box), padded 0.15em x / 0.08em y, behind the text
  // (host = isolation: isolate, layer z-index -1), grown left -> right by transform scaleX(var(--hl)) with
  // transform-origin left. Multi-line text = one band per line, lines sweep one after the other.
  // Seek-safe: the only tween is --hl (0 -> 1) on a per-call layer; band geometry is a pure function of the
  // laid-out text, measured by hlSync(t) from render(t) - the first time the highlight is due, again after
  // fonts load and on every stage resize (controls.js fit() resizes #stage; a ResizeObserver bumps the epoch).
  // Coordinates are taken relative to the host and divided by the host's own scale (rect / offsetSize), so a
  // host that is mid scale-in / rise / camera push at measure time still yields exact layout offsets.
  // Target resolution: [data-hl="<selector>"] on the hit element names the text element inside it (agenda
  // rows: the label, not the number or the time); a <tr> gets one layer per cell; the host is the nearest
  // non-inline ancestor of the text root (a headline word marks inside its h1 / line). SVG nodes get no
  // marker (fx.js falls back to the ring). The layer is attached lazily, so SplitText / textContent writes
  // that happen at build never see it; hlSync re-attaches it if a preset repaint wiped it.
  var HL = { items: [], epoch: 0, ro: null, W: -1 }, HL_PAD_X = 0.15, HL_PAD_Y = 0.08;
  function hlHost(root) {
    var n = root;
    while (n && n.parentElement && n !== document.body) {
      var disp = getComputedStyle(n).display;
      if (disp !== 'inline' && disp !== 'contents') return n;
      n = n.parentElement;
    }
    return root;
  }
  function hlTargets(el) {
    if (el.tagName === 'TR') return Array.prototype.slice.call(el.cells || []);
    var sel = el.getAttribute && el.getAttribute('data-hl');
    return [sel ? (el.querySelector(sel) || el) : el];
  }
  function hlTextRects(root) { // client rects of every non-blank text node under root (text inside a hl-layer is skipped)
    var out = [], w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        if (!/\S/.test(n.data)) return NodeFilter.FILTER_REJECT;
        for (var p = n.parentNode; p && p !== root; p = p.parentNode) if (p.classList && p.classList.contains('hl-layer')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    }), r = document.createRange(), n;
    while ((n = w.nextNode())) {
      r.selectNodeContents(n);
      var rs = r.getClientRects();
      for (var i = 0; i < rs.length; i++) if (rs[i].width > 0.5 && rs[i].height > 0.5) out.push({ l: rs[i].left, r: rs[i].right, t: rs[i].top, b: rs[i].bottom });
    }
    return out;
  }
  function hlLines(rects) { // merge rects that share a line (vertical overlap > half the smaller height) into one box per line
    var lines = [];
    rects.sort(function (a, b) { return a.t - b.t || a.l - b.l; });
    rects.forEach(function (q) {
      for (var i = 0; i < lines.length; i++) {
        var g = lines[i], ov = Math.min(g.b, q.b) - Math.max(g.t, q.t);
        if (ov > 0.5 * Math.min(g.b - g.t, q.b - q.t)) { g.l = Math.min(g.l, q.l); g.r = Math.max(g.r, q.r); g.t = Math.min(g.t, q.t); g.b = Math.max(g.b, q.b); return; }
      }
      lines.push({ l: q.l, r: q.r, t: q.t, b: q.b });
    });
    return lines;
  }
  function hlMeasure(e) {
    var H = e.host.getBoundingClientRect();
    if (!H.width && !H.height) return false; // not laid out (yet): try again on the next render
    var rects = hlTextRects(e.root);
    if (!rects.length) return false;
    var sx = e.host.offsetWidth ? H.width / e.host.offsetWidth : 1, sy = e.host.offsetHeight ? H.height / e.host.offsetHeight : 1;
    if (!(sx > 0.01)) sx = 1; if (!(sy > 0.01)) sy = 1;
    var fs = parseFloat(getComputedStyle(e.root).fontSize) || 16, px = fs * HL_PAD_X, py = fs * HL_PAD_Y;
    var lines = hlLines(rects), bl = e.host.clientLeft || 0, bt = e.host.clientTop || 0;
    lines.forEach(function (g, i) {
      var b = e.bands[i];
      if (!b) { b = document.createElement('i'); b.className = 'hl-band'; b.setAttribute('aria-hidden', 'true'); e.layer.appendChild(b); e.bands[i] = b; }
      b.style.display = '';
      b.style.left = (((g.l - H.left) / sx) - bl - px).toFixed(2) + 'px';
      b.style.top = (((g.t - H.top) / sy) - bt - py).toFixed(2) + 'px';
      b.style.width = (((g.r - g.l) / sx) + px * 2).toFixed(2) + 'px';
      b.style.height = (((g.b - g.t) / sy) + py * 2).toFixed(2) + 'px';
      b.style.setProperty('--n', String(lines.length)); b.style.setProperty('--i', String(i));
    });
    for (var k = lines.length; k < e.bands.length; k++) e.bands[k].style.display = 'none';
    return true;
  }
  function hlAttach(e) {
    if (e.layer.parentNode === e.host) return false;
    if (!e.host.classList.contains('hl-host')) {
      e.host.classList.add('hl-host');
      if (getComputedStyle(e.host).position === 'static') e.host.classList.add('hl-rel');
    }
    e.host.appendChild(e.layer);
    return true; // newly attached: geometry must be (re)measured
  }
  // Called from render(t): measure the highlights that are due, once, and again only when fonts / stage size changed.
  function hlSync(t) {
    for (var i = 0; i < HL.items.length; i++) {
      var e = HL.items[i];
      if (t < e.at - 0.05 || t > e.until) continue;
      if (hlAttach(e)) e.done = false;
      if (e.done && e.epoch === HL.epoch) continue;
      if (hlMeasure(e)) { e.done = true; e.epoch = HL.epoch; }
    }
  }
  function hlWatch() {
    if (HL.ro || HL.watching) return; HL.watching = true;
    var bump = function () { HL.epoch++; };
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(bump);
    if (document.fonts && document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', bump);
    var stage = document.getElementById('stage');
    if (stage && window.ResizeObserver) { HL.ro = new window.ResizeObserver(bump); HL.ro.observe(stage); }
    else window.addEventListener('resize', bump);
  }
  // o.hold (s, optional): seconds the band stays fully visible after its sweep, then it fades out (0.25 s). Omitted = stays.
  function highlight(tl, T, at, d, e, _s, o) {
    o = o || {};
    T.forEach(function (el) {
      if (el.ownerSVGElement || el instanceof SVGElement) return; // no DOM child can paint inside an SVG node: the caller uses the ring
      hlTargets(el).forEach(function (root) {
        var layer = document.createElement('i'); layer.className = 'hl-layer'; layer.setAttribute('aria-hidden', 'true');
        HL.items.push({ root: root, host: hlHost(root), layer: layer, bands: [], at: at, until: at + d + (o.hold != null ? o.hold : 0) + (o.hold != null ? 1 : 130), done: false, epoch: -1 });
        if (reduce) { // end state: the band is simply there (no sweep), fading in over 0.15 s
          layer.style.setProperty('--hl', '1');
          tl.fromTo(layer, { opacity: 0 }, { opacity: 1, duration: 0.15, ease: 'none', immediateRender: true }, at);
        } else ft(tl, [layer], at, d, e, { '--hl': 0 }, { '--hl': 1 });
        if (o.hold != null) tl.fromTo(layer, { opacity: 1 }, { opacity: 0, duration: reduce ? 0.15 : 0.25, ease: reduce ? 'none' : ease('exit'), immediateRender: false }, at + (reduce ? 0.15 : d) + o.hold);
      });
    });
    hlWatch();
  }
  // Ambient: finite yoyo whose half-cycles fill the rest of the scene (never repeat:-1).
  function drift(tl, T, at, d, e, _s, o) {
    var half = d / 2, span = o.sceneDurS > 0 ? Math.max(half, o.sceneDurS - at) : d;
    ft(tl, T, at, half, e, { y: -4, rotation: -0.5 }, { y: 4, rotation: 0.5 }, { repeat: Math.max(0, Math.floor(span / half) - 1) });
  }
  var BUILD = {
    'line-mask': masked('lines'), 'word-mask': masked('words'), draw: drawOn, 'line-chart': drawOn,
    highlight: highlight, 'ambient-drift': drift,
    'depth-parallax': function (tl, T, at, d, e) { ft(tl, T, at, d, e, { scale: 1.06, xPercent: -1.5 }, { scale: 1.06, xPercent: 1.5 }); }
  };

  function preset(name, tl, targets, at, opts) {
    var s = spec(name), o = opts || {};
    if (!s) throw new Error('studio: unknown preset "' + name + '" — engine/motion-presets.json');
    var T = els(targets);
    if (!T.length) return tl;
    at = Math.max(0, Number(at) || 0);
    var d = durOf(s.name, o.after), e = ease(o.ease || s.ease);
    if (s.name === 'highlight') { highlight(tl, T, at, d, e, s, o); return tl; } // handles reduced motion itself (band shown, no sweep)
    if (reduce) {
      if (s.reducedMotion === 'end-state') return tl;
      var exit = s.kind === 'exit';
      tl.fromTo(T, { opacity: exit ? 1 : 0 }, { opacity: exit ? 0 : 1, duration: 0.15, ease: 'none', immediateRender: !exit }, at);
      return tl;
    }
    if (o.axis === 'x' && s.name === 'bar-grow') ft(tl, T, at, d, e, RAIL[0], RAIL[1], { stagger: o.stagger != null ? o.stagger : s.stagger });
    else if (BUILD[s.name]) BUILD[s.name](tl, T, at, d, e, s, o);
    else if (FT[s.name]) ft(tl, T, at, d, e, FT[s.name][0], FT[s.name][1], { stagger: o.stagger != null ? o.stagger : s.stagger, exit: s.kind === 'exit' });
    else throw new Error('studio: preset "' + s.name + '" has no piece builder (count-up = a proxy painted in render(t))');
    return tl;
  }

  // Stage camera (engine/stage-camera.js moves), on a rig that holds the VISUAL only — text sits
  // outside the rig (layer contract), so it never drifts. Scale stays <= 1.08 (Rule 7: no
  // scale > 1.10 on heroes). Every move starts at identity and ends inside the scene.
  // Seek purity: entrances tween the SAME rig's scale / x / y / opacity. Two overlapping tweens on
  // one transform component resolve by render order, which flips with seek direction. So the camera
  // owns components no entrance uses: z (depth under transformPerspective 1200 reads as a zoom of
  // 1200 / (1200 - z)), xPercent (pan), rotationY (orbit). GSAP keeps each component apart.
  var CAM_P = 1200;
  function zOf(s) { return CAM_P * (1 - 1 / s); } // depth that looks like scale s
  function camera(tl, rig, move, at, dur) {
    if (!rig || reduce || !move || move === 'hold') return;
    var e = ease('cam');
    tl.set(rig, { z: 0, xPercent: 0, rotationY: 0, transformPerspective: CAM_P, immediateRender: true }, at);
    if (move === 'push') tl.fromTo(rig, { z: 0 }, { z: zOf(1.06), duration: dur, ease: e, immediateRender: false }, at);
    else if (move === 'pull') tl.fromTo(rig, { z: zOf(1.06) }, { z: 0, duration: dur, ease: e, immediateRender: false }, at); // zoom out
    else if (move === 'pan') tl.fromTo(rig, { xPercent: 2 }, { xPercent: -2, duration: dur, ease: e, immediateRender: false }, at);
    else if (move === 'orbit') tl.fromTo(rig, { rotationY: 3 }, { rotationY: -3, duration: dur, ease: e, immediateRender: false }, at);
    else tl.fromTo(rig, { z: 0 }, { z: zOf(1.015), duration: dur / 2, ease: e, yoyo: true, repeat: 1, immediateRender: false }, at); // breathe
  }

  // Entrance plan (ENTER + ACCENT): head at 0.1 s for 0.7 s, items
  // from 0.3 s in a stagger that spreads them over 40 % of the scene, clamped 60..350 ms.
  // v3 tempo: first content lands sooner after a cut; the 0.6 s voice lead still starts after it.
  var ENTER = { headStart: 0.1, firstItem: 0.3, itemDur: 0.65, windowFrac: 0.4, minStagger: 0.06, maxStagger: 0.35 };
  var ACCENT = { count: 1.2, draw: 0.45, drawLag: 0.2, bars: 1.2, barsStagger: 0.1 };
  function stagger(n, dur) {
    if (n < 2) return 0;
    var g = (Math.max(ENTER.firstItem + ENTER.itemDur, dur * ENTER.windowFrac) - ENTER.firstItem - ENTER.itemDur) / (n - 1);
    return Math.min(ENTER.maxStagger, Math.max(ENTER.minStagger, g));
  }
  function enter(tl, head, items, at, dur, itemPreset) {
    var H = els(head), I = els(items);
    if (H.length) preset('line-mask', tl, H, at + ENTER.headStart);
    var g = stagger(I.length, dur);
    if (I.length) preset(itemPreset || 'rise-stagger', tl, I, at + ENTER.firstItem, { stagger: g });
    return { first: at + ENTER.firstItem, gap: g, end: at + ENTER.firstItem + g * Math.max(0, I.length - 1) + durOf(itemPreset || 'rise-stagger') };
  }

  window.STUDIO = {
    reg: REG, reduced: reduce, ease: ease, durOf: durOf, preset: preset, camera: camera, enter: enter, hlSync: hlSync,
    ENTER: ENTER, ACCENT: ACCENT, choreography: REG.choreography
  };
})();
