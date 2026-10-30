/* preset: headline — the intro:
   light ground, left editorial stack (eyebrow + signal rule → hero line → hook → promise) and a
   token-drawn signal scene on the right (recessed disc, two orbits, three arcs, signal dots, the
   OFFICIAL brand mark in the disc — never a drawn mark). Beats: disc .05 · orbits .1 · eyebrow
   rule .35 · arcs .45 · mark .55 · hero line .6 (line masks) · hook 1.3 · promise follows.
   params: text (hero line, required), kicker?, accent? (a word → marker highlight), hook?, promise?,
           scene? (default true), split? 'lines' (hero + hook reveal through a SplitText line mask split after
           the fonts load; default off = the plain line-mask)
   @requires split-lines */
(function () {
  'use strict';
  function strip(x) { return String(x || '').replace(/[.,!?;:…»«"]+/g, ''); }
  (window.PRESETS = window.PRESETS || {}).headline = function (c) {
    var p = c.p, el = c.el, at = c.at, tl = c.tl, S = c.S, FX = c.FX, h = c.h;
    var col = h('div', 'col-text intro-copy');
    if (p.kicker) { var eb = h('p', 'kicker eyebrow'); eb.appendChild(h('span', 'eyebrow-rule')); eb.appendChild(h('span', 'eyebrow-text', p.kicker)); col.appendChild(eb); }
    var hero = h('h1', 'headline'), accent = null;
    String(p.text || '').split(/(\s+)/).forEach(function (w) {
      if (p.accent && !accent && strip(w) === strip(p.accent)) { accent = h('span', 'accent', w); hero.appendChild(accent); }
      else hero.appendChild(document.createTextNode(w));
    });
    col.appendChild(hero);
    if (p.hook) col.appendChild(h('p', 'hook', p.hook));
    if (p.promise) col.appendChild(h('p', 'promise', p.promise));
    el.appendChild(col);

    var rig = null, orbits = [];
    if (p.scene !== false) {
      rig = h('div', 'signal visual'); rig.setAttribute('data-hit', 'scene');
      var g = FX.svg('svg', { viewBox: '0 0 100 100', class: 'signal-svg', 'aria-hidden': 'true' });
      var disc = FX.svg('circle', { cx: 50, cy: 50, r: 24, class: 'sig-disc' });
      g.appendChild(disc);
      [34, 44].forEach(function (r, k) {
        var o = FX.svg('g', {});
        o.appendChild(FX.svg('circle', { cx: 50, cy: 50, r: r, class: 'sig-orbit' }));
        o.appendChild(FX.svg('circle', { cx: 50 + r, cy: 50, r: 1.4, class: 'sig-dot' + (k ? ' alt' : '') }));
        g.appendChild(o); orbits.push({ g: o, speed: k ? -9 : 14 });
      });
      var arcs = [[30, 200, 300], [38, 20, 110], [47, 250, 320]].map(function (a) {
        var r = a[0], s0 = a[1] * Math.PI / 180, s1 = a[2] * Math.PI / 180;
        var x1 = 50 + r * Math.cos(s1), y1 = 50 + r * Math.sin(s1);
        var path = FX.svg('path', { d: 'M' + (50 + r * Math.cos(s0)).toFixed(2) + ' ' + (50 + r * Math.sin(s0)).toFixed(2) + ' A' + r + ' ' + r + ' 0 0 1 ' + x1.toFixed(2) + ' ' + y1.toFixed(2), class: 'sig-arc' });
        var end = FX.svg('circle', { cx: x1.toFixed(2), cy: y1.toFixed(2), r: 1.6, class: 'sig-end' });
        g.appendChild(path); g.appendChild(end);
        return { path: path, end: end };
      });
      rig.appendChild(g);
      var markSrc = c.marks.mark || c.brand.logo;
      if (markSrc) rig.appendChild(FX.image(markSrc, 'sig-mark', ''));
      el.appendChild(rig);
      S.preset('scale-in', tl, disc, at + 0.05);
      S.preset('draw', tl, rig.querySelectorAll('.sig-orbit'), at + 0.1);
      arcs.forEach(function (a, k) {
        S.preset('draw', tl, a.path, at + 0.45 + k * 0.15);
        S.preset('scale-in', tl, a.end, at + 0.45 + k * 0.15 + S.durOf('draw') * 0.7);
      });
      if (markSrc) S.preset('blur-in', tl, rig.querySelector('.sig-mark'), at + 0.55);
    }
    tl.call(c.audio.cue, ['whoosh'], at);
    if (p.kicker) { S.preset('bar-grow', tl, col.querySelector('.eyebrow-rule'), at + 0.35, { axis: 'x' }); S.preset('clip-wipe', tl, col.querySelector('.eyebrow-text'), at + 0.45); }
    var SL = p.split === 'lines' && window.SPLIT_LINES, paints = [];
    function mask(node, t0) { var f = SL ? SL.reveal(c, node, t0) : S.preset('line-mask', tl, node, t0); if (SL && f) paints.push(f); }
    mask(hero, at + 0.6);
    if (accent) S.preset('highlight', tl, accent, at + 0.6 + S.durOf('line-mask'));
    var hookAt = at + 1.3;
    if (p.hook) mask(col.querySelector('.hook'), hookAt);
    if (p.promise) S.preset('rise', tl, col.querySelector('.promise'), hookAt + S.durOf('line-mask') * S.choreography.nextBeatAtLeadFraction);
    function paintLines() { for (var i = 0; i < paints.length; i++) paints[i](); }
    var render = function (local) {
      orbits.forEach(function (o) { o.g.setAttribute('transform', 'rotate(' + (local * o.speed).toFixed(2) + ' 50 50)'); });
      paintLines();
    };
    if (paints.length) render.idle = paintLines; // split lines stay a pure function of t outside the chapter window too
    return { rig: rig, camera: 'breathe', render: render };
  };
})();
