/* preset: image — an image from assets/, FRAMED and treated.
   Layout hero (copy + framed image) or full (image fills the stage, copy on top).
   frame     card (default) | browser (title bar + url pill) | polaroid (paper, caption inside, static
             tilt) | circle | arch | tilt (static 3D angle, TURNS IN) | stack (two ghost sheets fan out) |
             fan (count-1 ghost sheets FAN OUT from a bottom-centre pivot, followers 180 ms) | none
   backdrop  none (default) | panel (offset recessed slab) | blob (soft primary field, drifts) |
             rings (concentric rings DRAW) | dots (dot grid)
   overlay   veil | scrim-light | scrim-dark | scrim-duo | duotone | grain | vignette | tint — one or a list
             (studio kit/img-treat.css, adopted: scrims run from the copy side outward)
   glow      none (default) | pulse (halo breathes) | sweep (light sheen crosses) | ring (glowing
             border runs around) | edge (inner edge light breathes) — all painted from t, seek-safe
   motion    parallax (default) | zoom | zoom-out | still — moves the picture inside its frame
   The frame WIPES in (clip-wipe), or TURNS IN for tilt; real photos only — no generated people.
   params: src (required), alt? (empty = decorative), layout?, frame?, backdrop?, overlay?, glow?, motion?,
           position? (object-position), veil? (0..0.9), url? (browser frame), caption?, kicker?, title?, body?,
           count? (fan: 2..12 sheets, default 6), spread? (fan: deg, default 18), at? (fan: s into the scene)
           srcs? (fan: [url] one image per back sheet, back to front — real pages instead of blank sheets)
   hits: image · caption */
(function () {
  'use strict';
  (window.PRESETS = window.PRESETS || {}).image = function (c) {
    var p = c.p, el = c.el, at = c.at, tl = c.tl, S = c.S, FX = c.FX, h = c.h;
    var full = p.layout === 'full', frame = full ? 'none' : (p.frame || 'card');
    if (full) el.classList.add('img-full');
    var wrap = h('div', 'imgwrap visual imgwrap--' + frame);
    var back = null;
    if (!full && p.backdrop && p.backdrop !== 'none') {
      back = h('div', 'img-back img-back--' + p.backdrop);
      if (p.backdrop === 'rings') {
        var g = FX.svg('svg', { viewBox: '0 0 100 100', 'aria-hidden': 'true' });
        [22, 34, 46].forEach(function (r) { g.appendChild(FX.svg('circle', { cx: 50, cy: 50, r: r, class: 'sig-orbit' })); });
        back.appendChild(g);
      }
      wrap.appendChild(back);
    }
    var ghosts = [];
    if (frame === 'stack') for (var k = 0; k < 2; k++) { var gh = h('i', 'img-ghost img-ghost--' + (k + 1)); wrap.appendChild(gh); ghosts.push(gh); }
    var fanN = 0;
    if (frame === 'fan') {
      fanN = Math.max(2, Math.min(12, Math.round(Number(p.count) || 6))) - 1; // the source image is the top sheet
      // srcs (v2e): one image per back sheet (back to front), so the fan shows real pages, not blank sheets
      var srcs = Array.isArray(p.srcs) ? p.srcs : [];
      for (var f = 0; f < fanN; f++) {
        var fg = h('i', 'img-ghost img-ghost--fan' + (f % 2 ? ' img-ghost--2' : '') + (srcs[f] ? ' img-ghost--page' : ''));
        if (srcs[f]) { var gi = h('img'); gi.src = srcs[f]; gi.alt = ''; gi.decoding = 'async'; fg.appendChild(gi); }
        wrap.appendChild(fg); ghosts.push(fg);
      }
    }
    var fig = h('figure', 'imgfig imgfig--' + frame); fig.setAttribute('data-hit', 'image');
    if (frame === 'browser') {
      var bar = h('div', 'img-bar'); bar.appendChild(h('i')); bar.appendChild(h('i')); bar.appendChild(h('i'));
      bar.appendChild(h('span', 'img-url', p.url || '')); fig.appendChild(bar);
    }
    var view = h('div', 'imgfig-view');
    var zoom = h('div', 'imgfig-zoom'), img = FX.image(p.src, 'imgfig-img', p.alt || '');
    if (p.position) img.style.objectPosition = p.position;
    zoom.appendChild(img); view.appendChild(zoom);
    FX.treat(view, img, p.overlay || (full ? 'veil' : null), { veil: p.veil, side: 'left' });
    fig.appendChild(view);
    if (p.caption) { var cap = h('figcaption', null, p.caption); cap.setAttribute('data-hit', 'caption'); fig.appendChild(cap); }
    wrap.appendChild(fig);
    // copy column FIRST (left), visual second (right) — the same order as every other preset; the old
    // order put a hero image on the left and pushed the copy over the plate (QA 2026-10-18)
    var col = (p.kicker || p.title || p.body) ? c.textCol(el, p) : null;
    el.appendChild(wrap);

    var t0 = at + 0.1;
    if (back) {
      if (p.backdrop === 'rings') S.preset('draw', tl, back.querySelectorAll('circle'), t0);
      else S.preset('scale-in', tl, back, t0);
      if (p.backdrop === 'blob') S.preset('ambient-drift', tl, back, t0 + 0.6, { sceneDurS: at + c.dur - t0 });
    }
    if (frame === 'tilt') S.preset('3d-reveal', tl, fig, t0 + 0.1);
    else if (frame === 'circle' || frame === 'polaroid') S.preset('scale-in', tl, fig, t0 + 0.1, { ease: 'spring' });
    else S.preset('clip-wipe', tl, fig, t0 + 0.1);
    if (frame === 'fan') {
      // Fan: sheets turn out around a bottom-centre pivot (rotate + translate, never scale), 180 ms apart.
      var spread = p.spread != null ? Number(p.spread) : 18, tf = p.at != null ? at + Number(p.at) : t0 + 0.5;
      ghosts.forEach(function (gh, k) {
        var u = fanN === 1 ? 1 : (k / (fanN - 1)) * 2 - 1, ang = u * spread;
        tl.fromTo(gh, { rotation: 0, x: 0 }, { rotation: ang, x: (u * 3).toFixed(3) + 'cqw', duration: S.reduced ? 0 : 0.9, ease: S.ease('move'), immediateRender: true }, tf + k * 0.18);
      });
    } else ghosts.forEach(function (gh, k) {
      tl.fromTo(gh, { rotation: 0, x: 0, y: 0 }, { rotation: k ? 7 : -5, x: k ? '2.4cqw' : '-1.6cqw', y: k ? '1cqw' : '0.6cqw', duration: 0.9, ease: S.ease('move'), immediateRender: true }, t0 + 0.5 + k * 0.1);
    });
    if (!S.reduced) {
      var m = p.motion || 'parallax', d = c.dur;
      if (m === 'zoom') tl.fromTo(img, { scale: 1 }, { scale: 1.08, duration: d, ease: 'none', immediateRender: true }, at);
      else if (m === 'zoom-out') tl.fromTo(img, { scale: 1.08 }, { scale: 1, duration: d, ease: 'none', immediateRender: true }, at);
      else if (m === 'parallax') tl.fromTo(img, { scale: 1.08, xPercent: -1.5, yPercent: 0.6 }, { scale: 1.08, xPercent: 1.5, yPercent: -0.6, duration: d, ease: 'none', immediateRender: true }, at);
    }
    var paintGlow = FX.glow(c, full ? view : fig, p.glow, t0 + S.durOf('clip-wipe'));
    if (col) c.headIn(tl, col, at + 0.3);
    if (p.caption) S.preset('rise', tl, fig.querySelector('figcaption'), t0 + S.durOf('clip-wipe'));
    return { rig: full ? null : wrap, focusRig: zoom, camera: 'hold', render: paintGlow };
  };
})();
