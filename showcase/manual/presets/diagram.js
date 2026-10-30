/* preset: diagram — an SVG, INLINED at build time (params._svg) so it can move:
   it builds up in STEPS — edges (unfilled path / line / polyline) DRAW on, nodes rise — and data
   PACKETS travel along chosen paths. The diagram is the scene's MOTION; the copy column is support.
   Authoring the SVG for motion: an id on every node, data-step="1..N"
   on the groups to reveal together, data-hit="<name>" on anything fx should target, and an id on
   every <path> a packet should follow. No data-step at all → each top-level element is one step.
   params: src (required, .svg — inlined at build time as _svg, scripts and on* handlers stripped),
           alt? (accessible description), kicker?, title?, body?, layout? hero (default) | full,
           steps? [{ at (s), select? (CSS selector inside the SVG; default [data-step="k"]) }],
           cadence? (s between default steps; default auto = min(span / steps, 1.2) — v2: a step never waits
             longer than 1.2 s, so the ground card and the first nodes are not alone on screen for seconds),
           packets? [{ path (CSS selector or data-hit name of <path> elements), at? (s), per? (dots per
             path, default 2), speed? (paths per second, default 0.5),
             v2, all optional, defaults = today:
             label? (a tiny caption riding the dot), trail? (0..6 fading ghost dots behind it),
             arrive? (a data-hit / id of the node that PULSES when a packet lands; true = ring at the path end),
             role? action | signal (dot colour from tokens; signal = orange, decoration only),
             size? (dot radius multiplier), loop? (false = fly once, land, pulse, done) }]
   hits: diagram · every data-hit inside the SVG */
(function () {
  'use strict';
  (window.PRESETS = window.PRESETS || {}).diagram = function (c) {
    var p = c.p, el = c.el, at = c.at, tl = c.tl, S = c.S, FX = c.FX, h = c.h;
    var full = p.layout === 'full';
    if (full) el.classList.add('stack');
    var col = (p.kicker || p.title || p.body) ? c.textCol(el, p) : null;
    var wrap = h('div', 'diagram visual' + (full ? ' is-full' : ''));
    wrap.setAttribute('data-hit', 'diagram');
    wrap.innerHTML = p._svg || '';
    var svg = wrap.querySelector('svg');
    if (!svg) throw new Error('diagram: no inline SVG in chapter ' + el.id + ' — params.src must be an .svg (build-piece inlines it)');
    svg.removeAttribute('width'); svg.removeAttribute('height');
    svg.classList.add('diagram-svg');
    svg.setAttribute('role', 'img');
    if (p.alt) svg.setAttribute('aria-label', p.alt);
    el.appendChild(wrap);
    var vb = (svg.getAttribute('viewBox') || '0 0 100 100').split(/[\s,]+/).map(Number), VW = vb[2] || 100, VH = vb[3] || 100;

    // ---- steps -------------------------------------------------------------------------------
    var groups = [];
    if (p.steps && p.steps.length) {
      groups = p.steps.map(function (st, k) {
        var sel = st.select || '[data-step="' + (k + 1) + '"]';
        return { at: st.at != null ? at + Number(st.at) : null, els: Array.prototype.slice.call(svg.querySelectorAll(sel)) };
      });
    } else {
      var tagged = Array.prototype.slice.call(svg.querySelectorAll('[data-step]'));
      if (tagged.length) {
        var by = {};
        tagged.forEach(function (n) { var k = Number(n.getAttribute('data-step')) || 0; (by[k] = by[k] || []).push(n); });
        groups = Object.keys(by).map(Number).sort(function (a, b) { return a - b; }).map(function (k) { return { at: null, els: by[k] }; });
      } else {
        groups = Array.prototype.slice.call(svg.children).filter(function (n) { return !/^(defs|style|title|desc|metadata)$/i.test(n.tagName); })
          .slice(0, 14).map(function (n) { return { at: null, els: [n] }; });
      }
    }
    var next = col ? c.headIn(tl, col, at) : at + 0.2;
    var span = Math.max(1.2, c.dur * 0.55), n = Math.max(1, groups.length);
    // v2 (D-018 D-030): default step spacing is capped, and step 1 (ground card + first node) lands AT `next`
    var gap = p.cadence != null ? Number(p.cadence) : Math.min(span / n, 1.2);
    function isEdge(n) { return /^(path|line|polyline)$/i.test(n.tagName) && getComputedStyle(n).fill === 'none'; }
    groups.forEach(function (g, k) {
      var t = g.at != null ? g.at : next + k * gap;
      g.els.forEach(function (node) {
        var shapes = isEdge(node) ? [node] : Array.prototype.slice.call(node.querySelectorAll ? node.querySelectorAll('path, line, polyline') : []).filter(isEdge);
        if (shapes.length) S.preset('draw', tl, shapes, t + 0.15);
        if (!isEdge(node)) {
          // fade + small lift in SVG user units (a px lift would be huge in a 100-unit viewBox)
          var bodies = shapes.length ? Array.prototype.slice.call(node.children).filter(function (x) { return shapes.indexOf(x) < 0; }) : [node];
          if (bodies.length) tl.fromTo(bodies, { opacity: 0, y: VH * 0.02 }, { opacity: 1, y: 0, duration: S.durOf('rise'), ease: S.ease('out'), immediateRender: true }, t);
        }
      });
    });

    // ---- packets -----------------------------------------------------------------------------
    function find(sel) {
      var q = /^[.#[]/.test(sel) || /\s/.test(sel) ? sel : '[data-hit="' + sel + '"], #' + sel;
      return svg.querySelector(q);
    }
    var paints = (p.packets || []).map(function (pk) {
      var sel = /^[.#[]/.test(pk.path) || /\s/.test(pk.path) ? pk.path : '[data-hit="' + pk.path + '"], #' + pk.path;
      var paths = Array.prototype.slice.call(svg.querySelectorAll(sel)).filter(function (x) { return x.tagName.toLowerCase() === 'path'; });
      if (!paths.length) throw new Error('diagram: packets.path "' + pk.path + '" matches no <path> in chapter ' + el.id);
      var start = pk.at != null ? at + Number(pk.at) : next + span + 0.3;
      tl.call(c.audio.cue, ['tick'], start);
      var arrive = pk.arrive;
      if (typeof arrive === 'string') {
        arrive = find(arrive);
        if (!arrive) throw new Error('diagram: packets.arrive "' + pk.arrive + '" matches no node in chapter ' + el.id);
      }
      var o = { start: start, per: pk.per || 2, speed: pk.speed || 0.5, r: Math.max(VW, VH) / 160 };
      if (pk.label != null) o.label = pk.label;
      if (pk.trail) o.trail = pk.trail;
      if (arrive) o.arrive = arrive;
      if (pk.role) o.role = pk.role;
      if (pk.size != null) o.size = pk.size;
      if (pk.loop === false) o.loop = false;
      return FX.travel(svg, paths, o);
    });
    return {
      rig: wrap, focusRig: svg, camera: 'breathe',
      render: paints.length ? function (_l, t) { paints.forEach(function (f) { f(t); }); } : null
    };
  };
})();
