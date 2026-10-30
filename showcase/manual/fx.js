/* Shared effects for piece presets (window.FX). Every effect is seek-pure: tweens on the one master
   timeline, or a proxy painted in render(t) — never onUpdate, never its own clock.
   Hit names: presets tag their parts with data-hit="<name>" (kpi-1, submit, field-email, row-2,
   node-3, line-4 …). Chapter-level cursor / focus / highlight lists target those names.

   FX.typer(text)                          -> { el, P, render() }  typewriter proxy (P.n = chars shown)
   FX.typeOn(tl, typer, at, cps)            schedule a typewriter at cps chars/s, returns end time
   FX.hit(scene, name)                      element for a hit name ('#sel' / '.sel' also accepted)
   FX.cursor(ctx, moves)                    pointer that travels, hovers and clicks hit targets
   FX.focus(ctx, rig, moves, opts?)         zoom into / out of an area (camera on the rig); chapter
                                            fx.crop = the same with cap 6 (deep zoom to ONE field)
   FX.spotlight(ctx, moves)                 dim everything except an area
   FX.highlight(ctx, list)                  marker sweep or glow on hit targets
   FX.hitFlash(el, tl, at, opts?)           0.28 s typed --flash pulse; opts.ring keeps a --ring (bbox-flash.css)
   FX.travel(path, dots, opts)              -> render(t) moving bullets / data packets on SVG paths (v2: label · trail ·
                                            arrive · role · size · loop)
   FX.ground(tl, node, at, d?)               a panel fades in WITH its first content
   FX.riseSolid(tl, nodes, at, stagger?)     cards arrive opaque fast, travel on y (no ghost card)
   FX.spline(points, w, h)                  smooth Catmull-Rom path "d" through points
   FX.image(src, cls, alt)                  <img> (decorative when alt is empty)
   FX.avatar(person)                        avatar: photo when person.src, else initials on a token disc
   FX.code(text, lang)                      highlighted code lines (token classes, no hex) */
(function () {
  'use strict';
  var S = window.STUDIO;
  function h(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  var NS = 'http://www.w3.org/2000/svg';
  function svg(tag, attrs) { var n = document.createElementNS(NS, tag); for (var k in attrs) n.setAttribute(k, attrs[k]); return n; }

  // ---- typewriter --------------------------------------------------------------------------------
  // Typewriter text is a supported effect. It stays off body
  // copy by default — use it on code, inputs, prompts, search boxes, or where a brief names it.
  function typer(text, cls) {
    var el = h('span', 'typed' + (cls ? ' ' + cls : ''));
    var shown = h('span', 'typed-text'), caret = h('span', 'caret');
    el.appendChild(shown); el.appendChild(caret);
    var full = String(text || ''), P = { n: 0 }, last = -1;
    return {
      el: el, P: P, text: full,
      render: function () {
        var n = Math.round(P.n);
        if (n !== last) { shown.textContent = full.slice(0, n); last = n; }
        caret.style.opacity = n > 0 && n < full.length ? '1' : '0';
      }
    };
  }
  function typeOn(tl, ty, at, cps) {
    var d = Math.max(0.2, ty.text.length / (cps || 28));
    tl.fromTo(ty.P, { n: 0 }, { n: ty.text.length, duration: d, ease: 'none', immediateRender: true }, at);
    return at + d;
  }

  function hit(scene, name) {
    if (!name) return null;
    if (/^[.#[]/.test(name)) return scene.querySelector(name);
    return scene.querySelector('[data-hit="' + String(name).replace(/"/g, '') + '"]');
  }
  // Centre of an element in stage percent (layout box, transform-free so build-time measure is stable).
  function centre(stage, el) {
    var S0 = stage.getBoundingClientRect(), R = el.getBoundingClientRect();
    return { x: ((R.left + R.width / 2 - S0.left) / S0.width) * 100, y: ((R.top + R.height / 2 - S0.top) / S0.height) * 100,
      w: (R.width / S0.width) * 100, h: (R.height / S0.height) * 100 };
  }

  // ---- cursor: travel · hover · click --------------------------------------------------------------
  // moves: [{ at (s into chapter), to (hit name | {x,y} stage %), click?, hover? (default true), dur? }]
  // Positions are measured once the scene is laid out (first render), then painted from t.
  function cursor(ctx, moves) {
    if (!moves || !moves.length) return null;
    var stage = document.getElementById('stage');
    var cur = h('div', 'fx-cursor'); cur.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 2l7 19 2.6-7.4L20 11z"/></svg><i class="fx-click"></i>';
    ctx.el.appendChild(cur);
    var pts = null, hovered = null;
    function measure() {
      pts = moves.map(function (m) {
        if (m.to && typeof m.to === 'object') return { x: m.to.x, y: m.to.y, el: null };
        var el = hit(ctx.el, m.to); if (!el) throw new Error('cursor: no hit "' + m.to + '" in chapter ' + ctx.el.id);
        var c = centre(stage, el); return { x: c.x, y: c.y, el: el };
      });
    }
    var start = { x: 92, y: 88 };
    return function paint(local) {
      if (!pts) { if (!stage.getBoundingClientRect().width) return; measure(); }
      var from = start, x = start.x, y = start.y, k = -1, clickK = 0;
      for (var i = 0; i < moves.length; i++) {
        var m = moves[i], d = m.dur || 0.8, a = m.at;
        if (local < a) break;
        var p = Math.min(1, (local - a) / d), e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
        // a light arc so the pointer travels like a hand, not a ruler
        x = from.x + (pts[i].x - from.x) * e; y = from.y + (pts[i].y - from.y) * e - Math.sin(Math.PI * e) * 3;
        k = p >= 1 ? i : -1;
        if (m.click && p >= 1) clickK = Math.max(0, 1 - (local - a - d) / 0.45);
        from = pts[i];
      }
      cur.style.left = x.toFixed(2) + '%'; cur.style.top = y.toFixed(2) + '%';
      cur.style.opacity = local >= moves[0].at - 0.3 ? '1' : '0';
      cur.classList.toggle('down', clickK > 0.6);
      cur.style.setProperty('--click', clickK.toFixed(3));
      var hv = k >= 0 && moves[k].hover !== false ? pts[k].el : null;
      if (hv !== hovered) { if (hovered) hovered.classList.remove('is-hover'); if (hv) hv.classList.add('is-hover'); hovered = hv; }
      for (var j = 0; j < moves.length; j++) if (pts[j].el && moves[j].click) pts[j].el.classList.toggle('is-pressed', local >= moves[j].at + (moves[j].dur || 0.8) && local < moves[j].at + (moves[j].dur || 0.8) + 0.3);
    };
  }

  // ---- focus: zoom into an area, hold, zoom back out ------------------------------------------------
  // moves: [{ at, target (hit name) | rect {x,y} %, zoom (<= cap, default 1.5), hold (s, default 1.6), out? (default true) }]
  // opts: { cap (default 1.8; fx.crop passes 6), glow (default true — ring on the target) }
  // The rig is the preset's visual (text column stays put). Measured at build: offset to centre.
  // A deep crop (zoom > 2) needs a rig inside a CLIPPING frame (doc-stage page, image view, device
  // screen) or the zoomed content covers the text column.
  function focus(ctx, rig, moves, opts) {
    opts = opts || {};
    if (!rig || !moves || !moves.length || S.reduced) return;
    var cap = opts.cap || 1.8;
    var e = S.ease('cam'), d = S.durOf('cam-push');
    ctx.tl.set(rig, { transformOrigin: '50% 50%' }, ctx.at);
    moves.forEach(function (m) {
      var R = rig.getBoundingClientRect(), fx = 50, fy = 50;
      if (m.target) {
        var el = hit(ctx.el, m.target); if (!el) throw new Error('focus: no hit "' + m.target + '" in chapter ' + ctx.el.id);
        var T = el.getBoundingClientRect();
        if (R.width) { fx = ((T.left + T.width / 2 - R.left) / R.width) * 100; fy = ((T.top + T.height / 2 - R.top) / R.height) * 100; }
      } else if (m.rect) { fx = m.rect.x; fy = m.rect.y; }
      var z = Math.min(cap, m.zoom || (cap > 2 ? 3 : 1.5)), at = ctx.at + m.at, hold = m.hold != null ? m.hold : 1.6;
      // Clamp so the zoomed content still covers its frame (no empty strip at an edge).
      var lim = (z - 1) * 50, cl = function (v) { return Math.max(-lim, Math.min(lim, v)); };
      var to = { scale: z, xPercent: cl((50 - fx) * z), yPercent: cl((50 - fy) * z) };
      ctx.tl.to(rig, { scale: to.scale, xPercent: to.xPercent, yPercent: to.yPercent, duration: d, ease: e }, at);
      if (m.out !== false) ctx.tl.to(rig, { scale: 1, xPercent: 0, yPercent: 0, duration: d, ease: e }, at + d + hold);
      if (m.target && opts.glow !== false) {
        var el2 = hit(ctx.el, m.target);
        ctx.tl.fromTo(el2, { '--glow': 0 }, { '--glow': 1, duration: d, ease: e, immediateRender: false }, at);
        if (m.out !== false) ctx.tl.to(el2, { '--glow': 0, duration: d, ease: e }, at + d + hold);
      }
    });
  }

  // ---- spotlight: dim the scene except one area ------------------------------------------------------
  // moves: [{ at, target | rect {x,y,w,h} %, hold (s, default 2), pad (%, default 1.2) }]
  function spotlight(ctx, moves) {
    if (!moves || !moves.length) return null;
    var stage = document.getElementById('stage'), veil = h('div', 'fx-spot'); ctx.el.appendChild(veil);
    var boxes = null;
    return function paint(local) {
      if (!boxes) { if (!stage.getBoundingClientRect().width) return; boxes = moves.map(function (m) {
        if (m.rect) return m.rect;
        var el = hit(ctx.el, m.target); if (!el) throw new Error('spotlight: no hit "' + m.target + '"');
        var c = centre(stage, el); return { x: c.x - c.w / 2, y: c.y - c.h / 2, w: c.w, h: c.h };
      }); }
      var on = 0, b = null;
      moves.forEach(function (m, i) {
        var hold = m.hold != null ? m.hold : 2, k = Math.min(Math.max(0, (local - m.at) / 0.4), Math.max(0, (m.at + hold + 0.4 - local) / 0.4), 1);
        if (k > on) { on = k; b = boxes[i]; b.pad = m.pad != null ? m.pad : 1.2; }
      });
      veil.style.opacity = on.toFixed(3);
      if (b) {
        veil.style.setProperty('--x0', (b.x - b.pad) + '%'); veil.style.setProperty('--y0', (b.y - b.pad) + '%');
        veil.style.setProperty('--x1', (b.x + b.w + b.pad) + '%'); veil.style.setProperty('--y1', (b.y + b.h + b.pad) + '%');
      }
    };
  }

  // ---- highlight: marker sweep (text) or glow ring (boxes) -----------------------------------------
  // list: [{ at, target, kind? 'marker' | 'glow' (default: marker for text-only, glow otherwise), hold? }]
  // marker (v2d) = solid bands MEASURED from the target's text lines (studio.js highlight): behind the text,
  //   one per line, swept left -> right. Targets that carry data-hl="<selector>" (agenda rows: the label) default
  //   to the marker; a <tr> marks every cell; an SVG node falls back to the ring (no DOM child can paint in it).
  // hold (s): after the sweep (marker) / ring rises, the effect stays that long, then fades out. Entries built
  //   from `say` carry a hold that ends when the next term is spoken: one term at a time.
  function highlight(ctx, list) {
    (list || []).forEach(function (m) {
      var el = hit(ctx.el, m.target); if (!el) throw new Error('highlight: no hit "' + m.target + '" in chapter ' + ctx.el.id);
      // Marker = a text line; a box (children, or taller than ~1.6 text lines, e.g. a tile) gets the ring.
      var cs = getComputedStyle(el), lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.3;
      var kids = Array.prototype.filter.call(el.children, function (n) { return !(n.classList && n.classList.contains('hl-layer')); }).length;
      var boxy = !el.hasAttribute('data-hl') && (kids || el.getBoundingClientRect().height > lh * 1.6);
      var kind = m.kind || (boxy ? 'glow' : 'marker'), at = ctx.at + m.at;
      if (kind === 'marker' && el instanceof SVGElement) kind = 'glow';
      if (kind === 'marker') S.preset('highlight', ctx.tl, el, at, { hold: m.hold });
      else {
        ctx.tl.fromTo(el, { '--glow': 0 }, { '--glow': 1, duration: S.durOf('highlight'), ease: S.ease('out'), immediateRender: true }, at);
        if (m.hold) ctx.tl.to(el, { '--glow': 0, duration: 0.4, ease: S.ease('exit') }, at + S.durOf('highlight') + m.hold);
      }
    });
  }

  // ---- hit-flash: one short typed pulse on a found box (bbox-flash.css) -------
  // --flash 0 -> 1 -> 0 over 0.28 s; opts.ring = true then settles --ring 0 -> 1 (it stays: the active box).
  // Explicit fromTo pairs, immediateRender:false: a pure function of t, seek-back safe. Reduced motion = no
  // pulse, the ring is SET at `at` (final state). Needs bbox-flash.css (doc-stage loads it). Returns end time.
  function hitFlash(el, tl, at, opts) {
    if (!el) return at;
    opts = opts || {};
    el.classList.add('is-flash');
    if (S.reduced) { if (opts.ring) tl.set(el, { '--ring': 1 }, at); return at; }
    tl.fromTo(el, { '--flash': 0 }, { '--flash': 1, duration: 0.1, ease: S.ease('out'), immediateRender: false }, at)
      .fromTo(el, { '--flash': 1 }, { '--flash': 0, duration: 0.18, ease: S.ease('exit'), immediateRender: false }, at + 0.1);
    if (!opts.ring) return at + 0.28;
    tl.fromTo(el, { '--ring': 0 }, { '--ring': 1, duration: 0.3, ease: S.ease('out'), immediateRender: false }, at + 0.28);
    return at + 0.58;
  }

  // ---- moving bullets / data packets on SVG paths -----------------------------------------------------
  // paths: SVGPathElements; opts: { start (abs s), speed (paths/s, default 0.6), per (dots per path, default 2),
  //   r (dot radius, svg units), dots: 'circle' }  — v1 options, behaviour unchanged when none of the v2 ones is set.
  // v2 options (all optional, all a pure function of t, so seek and play always agree):
  //   label   string | [string per path]  a tiny caption riding the dot (solid card pill + ink text)
  //   trail   n (0..6)                    n fading ghost dots behind the head (opacity only)
  //   arrive  true | Element | [Element per path]   a ring pulses where a packet LANDS: true = the path end,
  //                                       an Element = that node's centre (a diagram hit, resolved by the preset)
  //   role    'action' | 'signal' | [role per path]   dot colour from tokens: cobalt action / orange signal
  //                                       (orange is decoration only — it never carries a status)
  //   labelSize number                    caption size multiplier (default 1; hub uses 1.3)
  //   size    number                      dot radius multiplier (default 1)
  //   loop    false                       one pass only: the packet flies once, lands, pulses, is gone
  //   reduced motion: every path rests ONE packet on its target (label shown), nothing travels.
  // travel() is split into small builders / painters (each under 100 lines); behaviour is unchanged.
  function packetGeom(svgEl, opts) { // shared geometry + options for one travel() call
    var VB = (svgEl.getAttribute && (svgEl.getAttribute('viewBox') || '0 0 100 100').split(/[\s,]+/).map(Number)) || [0, 0, 100, 100];
    var VW = VB[2] || 100, VH = VB[3] || 100, big = Math.max(VW, VH);
    return {
      per: opts.per || 2, speed: opts.speed || 0.6, baseR: opts.r || 1.1, VW: VW, VH: VH, big: big,
      trailN: Math.max(0, Math.min(6, Math.round(opts.trail || 0))),
      LFS: big * 0.021 * (opts.labelSize || 1), // caption size in svg units (~21 px at 1920 for a 200-unit diagram)
      loop: opts.loop !== false, reduced: !!(S && S.reduced), size: opts.size || 1
    };
  }
  function makeDot(svgEl, g, cls) { // one packet dot plus its trail ghosts (inserted beneath it)
    var d = svg('circle', { r: g.baseR * g.size, class: cls }); svgEl.appendChild(d);
    var tr = [];
    for (var q = 0; q < g.trailN; q++) { var gh = svg('circle', { r: g.baseR * g.size, class: cls + ' fx-trail' }); gh.style.opacity = '0'; svgEl.insertBefore(gh, d); tr.push(gh); }
    return { el: d, trail: tr };
  }
  function makeLabel(svgEl, g, text) { // caption pill: a rect + text, sized in place() once the text is measurable
    var lab = svg('g', { class: 'fx-label' }); lab.style.opacity = '0';
    var bg = svg('rect', { class: 'fx-label-bg', rx: g.big * 0.006 }), tx = svg('text', { class: 'fx-label-tx' });
    tx.textContent = String(text); tx.setAttribute('font-size', (g.LFS).toFixed(2));
    lab.appendChild(bg); lab.appendChild(tx); svgEl.appendChild(lab);
    lab.__bg = bg; lab.__tx = tx; lab.__w = 0;
    return lab;
  }
  function makeRing(svgEl, g, role) { // arrival pulse ring
    var ring = svg('circle', { class: 'fx-pulse' + (role ? ' fx-pulse--' + role : ''), r: g.baseR }); ring.style.opacity = '0'; svgEl.appendChild(ring);
    return ring;
  }
  function buildPackets(svgEl, paths, opts, g) {
    var dots = [];
    function pick(v, k) { return Array.isArray(v) ? v[k] : v; }
    paths.forEach(function (p, k) {
      var role = pick(opts.role, k), cls = 'fx-dot' + (role ? ' fx-dot--' + role : '');
      var text = pick(opts.label, k), arrive = pick(opts.arrive, k);
      for (var j = 0; j < g.per; j++) {
        var dt = makeDot(svgEl, g, cls);
        var lab = text && j === 0 ? makeLabel(svgEl, g, text) : null;
        var ring = arrive && j === 0 ? makeRing(svgEl, g, role) : null;
        dots.push({ el: dt.el, path: p, off: j / g.per + k * 0.13, trail: dt.trail, label: lab, ring: ring, target: arrive && arrive !== true ? arrive : null, k: k, j: j });
      }
    });
    return dots;
  }
  function nodeCentre(svgEl, el) { // centre of a node in the diagram's own user units (transforms on its groups included)
    try {
      var b = el.getBBox(), m = el.getCTM(), root = svgEl.getCTM && svgEl.getCTM();
      if (root && m) m = root.inverse().multiply(m);
      var cx = b.x + b.width / 2, cy = b.y + b.height / 2;
      return { x: m ? m.a * cx + m.c * cy + m.e : cx, y: m ? m.b * cx + m.d * cy + m.f : cy, r: Math.max(b.width, b.height) / 2 };
    } catch (e) { return null; }
  }
  function place(g, lab, pt, op) { // position the caption pill beside the packet at pt
    if (!lab) return;
    var w0 = lab.__w;
    if (!w0) { // cache only a real measurement: a hidden scene measures 0, and its estimate must not stick
      try { w0 = lab.__tx.getBBox().width; } catch (e) { w0 = 0; }
      if (w0) lab.__w = w0; else w0 = String(lab.__tx.textContent).length * g.LFS * 0.58;
    }
    var fs = g.LFS, padX = fs * 0.55, padY = fs * 0.32, w = w0 + padX * 2, h = fs + padY * 2, br = g.baseR;
    var left = pt.x > g.VW * 0.7, x0 = left ? pt.x - br * 2.4 - w : pt.x + br * 2.4, y0 = pt.y - br * 1.8 - h;
    if (y0 < 0) y0 = pt.y + br * 1.8;
    lab.__bg.setAttribute('x', x0.toFixed(2)); lab.__bg.setAttribute('y', y0.toFixed(2));
    lab.__bg.setAttribute('width', w.toFixed(2)); lab.__bg.setAttribute('height', h.toFixed(2));
    lab.__tx.setAttribute('x', (x0 + padX).toFixed(2)); lab.__tx.setAttribute('y', (y0 + h - padY - fs * 0.2).toFixed(2));
    lab.style.opacity = op.toFixed(3);
  }
  function paintRing(svgEl, g, d, raw, run, pt, len) { // arrival pulse: pure function of the time since the last landing
    var n = Math.floor(raw), ring = d.ring, k = -1;
    if (n >= 1 && (g.loop || n === 1)) {
      var since = (run * g.speed + d.off - n) / g.speed; // s since the packet reached the end of its path
      if (since >= 0 && since < 0.75) k = since / 0.75;
    }
    if (k < 0) { ring.style.opacity = '0'; return; }
    var c0 = d.target ? nodeCentre(svgEl, d.target) : null, cx = c0 ? c0.x : pt.x, cy = c0 ? c0.y : pt.y;
    if (!c0) { var endPt = d.path.getPointAtLength(len); cx = endPt.x; cy = endPt.y; }
    var r0 = c0 ? Math.min(c0.r, g.big * 0.1) : g.baseR * 1.4;
    ring.setAttribute('cx', cx.toFixed(2)); ring.setAttribute('cy', cy.toFixed(2));
    ring.setAttribute('r', (r0 + (1 - Math.pow(1 - k, 3)) * g.big * 0.035).toFixed(2));
    ring.style.opacity = (0.85 * (1 - k)).toFixed(3);
  }
  function hideTrail(d) { d.trail.forEach(function (gh) { gh.style.opacity = '0'; }); }
  function paintTrail(g, d, ph, len, op) {
    d.trail.forEach(function (gh, q) {
      var gp = ph - (q + 1) * (g.baseR * 2.2) / len;
      if (gp < 0) { gh.style.opacity = '0'; return; }
      var gq = d.path.getPointAtLength(gp * len);
      gh.setAttribute('cx', gq.x.toFixed(2)); gh.setAttribute('cy', gq.y.toFixed(2));
      gh.setAttribute('r', (g.baseR * g.size * (1 - (q + 1) / (g.trailN + 1.5))).toFixed(2));
      gh.style.opacity = (Math.max(0, op) * 0.55 * (1 - q / g.trailN)).toFixed(3);
    });
  }
  function paintRested(g, d, len) { // reduced motion: ONE packet rests on its target, the rest are hidden
    var e0 = d.path.getPointAtLength(len);
    d.el.style.opacity = d.j === 0 ? '1' : '0';
    d.el.setAttribute('cx', e0.x.toFixed(2)); d.el.setAttribute('cy', e0.y.toFixed(2));
    hideTrail(d);
    if (d.label) place(g, d.label, e0, 1);
    if (d.ring) d.ring.style.opacity = '0';
  }
  function travel(svgEl, paths, opts) {
    opts = opts || {};
    var g = packetGeom(svgEl, opts), dots = buildPackets(svgEl, paths, opts, g), lens = null;
    var rich = opts.label != null || opts.trail || opts.arrive || opts.role != null || opts.loop === false || opts.size != null;
    return function paint(t) {
      if (!lens) lens = paths.map(function (p) { return p.getTotalLength(); });
      dots.forEach(function (d) {
        var len = lens[paths.indexOf(d.path)];
        if (g.reduced) { paintRested(g, d, len); return; }
        var run = t - opts.start;
        if (run < 0) {
          d.el.style.opacity = '0'; hideTrail(d);
          if (d.label) d.label.style.opacity = '0'; if (d.ring) d.ring.style.opacity = '0';
          return;
        }
        var raw = run * g.speed + d.off;
        if (!g.loop && Math.floor(raw) >= 1) { // one pass: gone once it has landed (its ring still plays out below)
          d.el.style.opacity = '0'; hideTrail(d); if (d.label) d.label.style.opacity = '0';
        }
        var ph = g.loop ? raw % 1 : Math.min(raw, 1);
        var pt = d.path.getPointAtLength(ph * len);
        if (g.loop || raw < 1) {
          d.el.setAttribute('cx', pt.x.toFixed(2)); d.el.setAttribute('cy', pt.y.toFixed(2));
          // v1 fade (sin) unless a v2 option is set: a rich packet stays solid until it lands
          var op = rich ? Math.min(1, run / 0.3, ph / 0.05 + (g.loop ? 0 : 1), (1 - ph) / 0.04) : Math.min(1, run / 0.4, Math.sin(ph * Math.PI) * 2);
          d.el.style.opacity = Math.max(0, op).toFixed(3);
          paintTrail(g, d, ph, len, op);
          if (d.label) place(g, d.label, pt, Math.max(0, Math.min(1, op, ph / 0.08, (1 - ph) / 0.08)));
        }
        if (d.ring) paintRing(svgEl, g, d, raw, run, pt, len);
      });
    };
  }

  // ---- ground: a panel fades in WITH its first content (never an empty card first) -----------------------
  // v2 (D-021 D-043 D-018 D-030). Opacity only; reduced motion = a 0.15 s fade (end state visible).
  function ground(tl, node, at, d) {
    if (!node) return;
    tl.fromTo(node, { opacity: 0 }, { opacity: 1, duration: S.reduced ? 0.15 : (d || 0.35), ease: S.reduced ? 'none' : S.ease('out'), immediateRender: true }, at);
  }
  // ---- rise-solid: cards that arrive OPAQUE quickly (opacity 0.28 s) and travel on y — no ghost card -----
  // v2 (D-026). The v1 rise-stagger keeps the 3rd card at 40 % opacity for 0.3 s, which reads as a ghost.
  function riseSolid(tl, nodes, at, stagger, dist) {
    var T = Array.prototype.slice.call(nodes && nodes.length != null && !nodes.nodeType ? nodes : [nodes]).filter(Boolean);
    if (!T.length) return;
    if (S.reduced) { tl.fromTo(T, { opacity: 0 }, { opacity: 1, duration: 0.15, ease: 'none', immediateRender: true }, at); return; }
    tl.fromTo(T, { opacity: 0 }, { opacity: 1, duration: 0.28, ease: S.ease('out'), stagger: stagger || 0, immediateRender: true }, at);
    tl.fromTo(T, { y: dist != null ? dist : 24 }, { y: 0, duration: 0.6, ease: S.ease('out'), stagger: stagger || 0, immediateRender: true }, at);
  }

  // Catmull-Rom → cubic Bézier through points [{x,y}] (already in svg units).
  function spline(pts) {
    if (pts.length < 2) return '';
    var d = 'M' + pts[0].x.toFixed(2) + ' ' + pts[0].y.toFixed(2);
    for (var i = 0; i < pts.length - 1; i++) {
      var p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      d += ' C' + (p1.x + (p2.x - p0.x) / 6).toFixed(2) + ' ' + (p1.y + (p2.y - p0.y) / 6).toFixed(2) + ' '
        + (p2.x - (p3.x - p1.x) / 6).toFixed(2) + ' ' + (p2.y - (p3.y - p1.y) / 6).toFixed(2) + ' '
        + p2.x.toFixed(2) + ' ' + p2.y.toFixed(2);
    }
    return d;
  }

  function image(src, cls, alt) { var i = document.createElement('img'); i.src = src; i.className = cls || ''; i.alt = alt || ''; i.decoding = 'async'; return i; } // async: 20+ chapters of plates must not block first paint
  function avatar(p) {
    p = p || {};
    var a = h('span', 'fx-avatar' + (p.size ? ' fx-avatar--' + p.size : ''));
    if (p.src) a.appendChild(image(p.src, '', p.name || ''));
    else a.textContent = (p.initials || String(p.name || '?').split(/\s+/).map(function (w) { return w.charAt(0); }).join('').slice(0, 2)).toUpperCase();
    return a;
  }

  // Minimal highlighter: comments, strings, numbers, keywords, function names → token classes.
  var KW = /\b(const|let|var|function|return|if|else|for|while|import|from|export|default|async|await|new|class|extends|true|false|null|undefined|def|self|in|of|try|catch|throw|type|interface)\b/g;
  function esc(s) { return s.replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; }); }
  function codeLine(line) {
    var out = '', rest = line, m;
    var re = /(\/\/.*$|#.*$)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_$][\w$]*)(?=\s*\()|([A-Za-z_$][\w$]*)/g;
    var last = 0;
    while ((m = re.exec(rest))) {
      out += esc(rest.slice(last, m.index));
      if (m[1]) out += '<span class="tk-c">' + esc(m[1]) + '</span>';
      else if (m[2]) out += '<span class="tk-s">' + esc(m[2]) + '</span>';
      else if (m[3]) out += '<span class="tk-n">' + esc(m[3]) + '</span>';
      else if (m[4]) out += '<span class="tk-f">' + esc(m[4]) + '</span>';
      else out += KW.test(m[5]) ? '<span class="tk-k">' + esc(m[5]) + '</span>' : esc(m[5]);
      KW.lastIndex = 0; last = re.lastIndex;
    }
    return out + esc(rest.slice(last));
  }

  // ---- image treatment: overlays (studio kit/img-treat.css, adopted) ------------------------------
  // overlay: string or list of veil | scrim-light | scrim-dark | scrim-duo | duotone | grain | vignette | tint
  // veil = flat ground wash (opts.veil 0..0.9) · scrim-* = directional studio scrims (copy side → out)
  // duotone = brand dark → primary (one SVG filter per page) · grain = local grain.png · tint = primary wash
  function duotoneDefs() {
    if (document.getElementById('fx-duotone')) return;
    var d = document.createElement('div');
    d.innerHTML = '<svg class="fx-defs" aria-hidden="true" focusable="false" width="0" height="0"><filter id="fx-duotone" color-interpolation-filters="sRGB">'
      + '<feColorMatrix type="matrix" values="0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0.2126 0.7152 0.0722 0 0 0 0 0 1 0" result="g"/>'
      + '<feFlood class="fx-duo-shadow" result="d"/><feFlood class="fx-duo-light" result="l"/>'
      + '<feComposite in="l" in2="g" operator="arithmetic" k1="1" k2="0" k3="0" k4="0" result="lg"/>'
      + '<feComposite in="d" in2="g" operator="arithmetic" k1="-1" k2="1" k3="0" k4="0" result="dg"/>'
      + '<feComposite in="lg" in2="dg" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" result="mix"/>'
      + '<feComposite in="mix" in2="SourceGraphic" operator="in"/></filter></svg>';
    document.body.appendChild(d.firstChild);
  }
  function treat(box, img, overlay, opts) {
    opts = opts || {};
    var list = Array.isArray(overlay) ? overlay : overlay ? [overlay] : [];
    list.forEach(function (o) {
      if (o === 'duotone') { duotoneDefs(); img.classList.add('is-duotone'); return; }
      if (o === 'vignette') { box.classList.add('is-vignette'); return; }
      var l = h('div', 'fx-ov fx-ov--' + o);
      if (o === 'veil') l.style.opacity = String(opts.veil != null ? opts.veil : 0.55);
      if (/^scrim/.test(o)) l.setAttribute('data-side', opts.side || 'left');
      box.appendChild(l);
    });
  }

  // ---- glow: animated, seek-pure ----------------------------------------------------------------------
  // pulse = halo breathes (finite yoyo) · sweep = a light sheen crosses every ~2.4 s · ring = a glowing
  // border runs around the frame (angle painted from t) · edge = inner edge light breathes.
  function glow(ctx, el, kind, startAt) {
    if (!kind || kind === 'none') return null;
    var S0 = ctx.S, tl = ctx.tl, at = startAt, end = ctx.at + ctx.dur;
    el.classList.add('fx-glow', 'fx-glow--' + kind);
    if (S0.reduced) { el.style.setProperty('--glow', '0.6'); return null; }
    if (kind === 'pulse' || kind === 'edge') {
      var half = 1.2, reps = Math.max(0, Math.floor((end - at) / half) - 1);
      tl.fromTo(el, { '--glow': 0.15 }, { '--glow': 1, duration: half, ease: S0.ease('cam'), yoyo: true, repeat: reps, immediateRender: true }, at);
      return null;
    }
    if (kind === 'sweep') {
      var sh = h('i', 'fx-sheen'); el.appendChild(sh);
      var period = 2.4, n = Math.max(1, Math.floor((end - at) / period));
      tl.fromTo(sh, { xPercent: -160 }, { xPercent: 160, duration: 0.9, ease: S0.ease('move'), repeat: n - 1, repeatDelay: period - 0.9, immediateRender: true }, at);
      return null;
    }
    if (kind === 'ring') {
      var ring = h('i', 'fx-ring'); el.appendChild(ring);
      tl.fromTo(ring, { opacity: 0 }, { opacity: 1, duration: 0.6, ease: S0.ease('out'), immediateRender: true }, at);
      return function (_l, t) { ring.style.setProperty('--ang', (((t - at) * 90) % 360).toFixed(1) + 'deg'); };
    }
    return null;
  }

  window.FX = { treat: treat, glow: glow, typer: typer, typeOn: typeOn, hit: hit, cursor: cursor, focus: focus, spotlight: spotlight, highlight: highlight,
    hitFlash: hitFlash, travel: travel, ground: ground, riseSolid: riseSolid, spline: spline, image: image, avatar: avatar, codeLine: codeLine, svg: svg, h: h };
})();
