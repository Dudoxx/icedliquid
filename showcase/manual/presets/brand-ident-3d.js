/* preset: brand-ident-3d — v2 "orbit lockup in space" (owner 2026-10-29: v1 porcelain card "very basic"; asked for
   3D effects, FX, glow, smoother motion and Dudoxx 3D typo objects).
   Deep space with three parallax starfields, drifting nebulae, bokeh and slow god rays. "Dudoxx presents" on a solid
   night pill. The toucan flies in out of depth as a 3D OBJECT, spinning to face camera; then the six letters of the
   wordmark fly in one by one as 3D OBJECTS and lock into the word. A light bloom opens behind the lockup (the cobalt
   word always lands on light), the camera orbits the lockup so the extrusion depth shows, a sheen sweeps the letters,
   an orange signal rule draws under them, a white star comets in and ticks onto the last x with a shockwave, the
   tagline lands on its own pill, and the camera pushes through into a flash.
   3D objects: every object is a stack of slices of the REAL artwork (the logo PNG / the wordmark PNG clipped per
   letter) at translateZ steps; the front slice is the untouched artwork, the slices behind it are darkened to read as
   the extruded side. Nothing is typeset: the letters are cut from the wordmark file, never set in a font.
   OWNER OVERRIDE of the D-016 no-glow/no-gradient rule for THIS opener (glow on light, bloom, star, wordmark halo);
   the front face of the mark and of each letter stays unfiltered and unrecoloured.
   Pure CSS 3D + GSAP: seek-pure (every move is a tween on the master timeline), file://-safe, no WebGL.
   No filter / opacity < 1 is ever left on a 3D container at rest (both flatten preserve-3d); fades are short.
   © Dudoxx UG / Acceleate Consulting - Walid Boudabbous <walid@acceleate.com>
   params: presents?, tagline?, wordmark? (default brand/<id>-typography.png), star? (default true),
           depth? (extrusion slices, 6..18, default 12), flash? (default true)
   hits: mark · wordmark · star · tagline */
(function () {
  'use strict';
  var STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 0c.6 5.6 2.2 8.9 4 10.2 1.6 1.2 4.6 1.6 8 1.8-3.4.2-6.4.6-8 1.8-1.8 1.3-3.4 4.6-4 10.2-.6-5.6-2.2-8.9-4-10.2C6.4 12.6 3.4 12.2 0 12c3.4-.2 6.4-.6 8-1.8C9.8 8.9 11.4 5.6 12 0z"/></svg>';
  // per-letter cut of the 1702×412 Dudoxx wordmark (measured on the PNG alpha; the o/x pair overlaps, so a slanted cut)
  var W = 1702, H = 412;
  var CUTS = [
    [[30, 0], [316, 0], [316, H], [30, H]],
    [[316, 0], [577, 0], [577, H], [316, H]],
    [[577, 0], [862, 0], [862, H], [577, H]],
    [[862, 0], [1145, 0], [1145, 300], [1108, H], [862, H]],
    [[1145, 0], [1393, 0], [1393, H], [1108, H], [1145, 300]],
    [[1393, 0], [W, 0], [W, H], [1393, H]]
  ];
  function poly(pts) { return 'polygon(' + pts.map(function (q) { return (q[0] / W * 100).toFixed(2) + '% ' + (q[1] / H * 100).toFixed(2) + '%'; }).join(',') + ')'; }
  function centre(pts) { var xs = pts.map(function (q) { return q[0]; }); return ((Math.min.apply(0, xs) + Math.max.apply(0, xs)) / 2 / W * 100).toFixed(2) + '%'; }
  function seeded(k) { var x = Math.sin(k * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
  function starfield(n, seed, size, tone) {
    var out = [];
    for (var i = 0; i < n; i++) {
      var a = seeded(seed + i * 3), b = seeded(seed + i * 3 + 1), c = seeded(seed + i * 3 + 2);
      out.push((a * 120 - 10).toFixed(2) + 'cqw ' + (b * 80 - 10).toFixed(2) + 'cqw 0 ' + (c > 0.85 ? size * 0.6 : 0).toFixed(2) + 'cqw ' + tone);
    }
    return out.join(',');
  }
  // an extruded object: N slices of one artwork, front slice untouched, side slices darkened toward the back
  function extrude(h, src, cls, n, depthCqw, clip) {
    var obj = h('div', 'bo-obj ' + cls), front = null;
    for (var i = n - 1; i >= 0; i--) {
      var s = h('img', 'bo-slice'); s.src = src; s.alt = ''; s.decoding = 'async'; s.draggable = false;
      s.style.transform = 'translateZ(' + (-i * depthCqw / n).toFixed(3) + 'cqw)';
      if (clip) { s.style.clipPath = clip; s.style.webkitClipPath = clip; }
      if (i > 0) s.style.filter = 'brightness(' + (0.22 + 0.4 * (1 - i / n)).toFixed(3) + ') saturate(1.15)';
      else { front = s; s.className += ' bo-front'; }
      obj.appendChild(s);
    }
    return { el: obj, front: front };
  }

  (window.PRESETS = window.PRESETS || {})['brand-ident-3d'] = function (c) {
    var p = c.p, el = c.el, at = c.at, tl = c.tl, S = c.S, h = c.h, D = c.dur, R = S.reduced;
    var N = Math.max(6, Math.min(18, p.depth || 12));
    el.classList.add('bo-host');
    var st = h('div', 'bo visual');

    // ---- space: nebulae, three starfields, rays, bokeh ----
    var neb = [h('i', 'bo-neb bo-neb--a'), h('i', 'bo-neb bo-neb--b'), h('i', 'bo-neb bo-neb--c')];
    neb.forEach(function (n) { st.appendChild(n); });
    var stars = [0, 1, 2].map(function (k) {
      var s = h('i', 'bo-stars bo-stars--' + k);
      s.style.boxShadow = starfield([140, 70, 26][k], 11 + k * 997, [0.12, 0.18, 0.26][k], 'color-mix(in oklch, white ' + [55, 75, 95][k] + '%, var(--accent))');
      st.appendChild(s); return s;
    });
    var rays = h('i', 'bo-rays'); st.appendChild(rays);
    var bokeh = [];
    for (var b = 0; b < 12; b++) {
      var bk = h('i', 'bo-bokeh'); var sz = 1.2 + seeded(b + 40) * 4.5;
      bk.style.left = (seeded(b + 7) * 100).toFixed(1) + '%'; bk.style.top = (seeded(b + 19) * 100).toFixed(1) + '%';
      bk.style.width = sz.toFixed(2) + 'cqw'; bk.style.filter = 'blur(' + (sz * 0.12).toFixed(2) + 'cqw)';
      st.appendChild(bk); bokeh.push({ el: bk, k: b });
    }

    var presents = p.presents ? h('p', 'bo-presents', p.presents) : null;
    if (presents) st.appendChild(presents);

    // ---- the 3D world: bloom, mark object, letter objects, sheen, rule, star ----
    var cam = h('div', 'bo-cam'), world = h('div', 'bo-world');
    var bloom = h('i', 'bo-bloom'); world.appendChild(bloom);
    var floor = h('i', 'bo-floor'); world.appendChild(floor);
    var lock = h('div', 'bo-lock');
    var markSrc = (c.marks && c.marks.mark) || c.brand.logo, mark = null;
    if (markSrc) {
      mark = extrude(h, markSrc, 'bo-mark', N, 1.6, null); mark.el.setAttribute('data-hit', 'mark');
      mark.front.alt = (c.brand.id || '') + ' logo'; lock.appendChild(mark.el);
    }
    var wmSrc = p.wordmark || ('brand/' + (c.brand.id || 'dudoxx') + '-typography.png');
    var word = h('div', 'bo-word'); word.setAttribute('data-hit', 'wordmark'); word.setAttribute('role', 'img');
    word.setAttribute('aria-label', String(c.brand.id || 'dudoxx'));
    var halo = h('img', 'bo-halo'); halo.src = wmSrc; halo.alt = ''; word.appendChild(halo);
    var letters = CUTS.map(function (pts) {
      var o = extrude(h, wmSrc, 'bo-letter', N, 2.2, poly(pts));
      o.el.style.transformOrigin = centre(pts) + ' 60%';
      word.appendChild(o.el); return o.el;
    });
    var sheen = h('i', 'bo-sheen'); sheen.style.webkitMaskImage = sheen.style.maskImage = 'url("' + wmSrc + '")'; word.appendChild(sheen);
    var rule = h('i', 'bo-rule'); word.appendChild(rule);
    var star = null, trail = null, ring = null;
    if (p.star !== false) {
      star = h('i', 'bo-star'); star.setAttribute('data-hit', 'star'); star.innerHTML = STAR;
      trail = h('i', 'bo-trail'); star.appendChild(trail);
      ring = h('i', 'bo-ring'); word.appendChild(ring); word.appendChild(star);
    }
    lock.appendChild(word);
    var tag = p.tagline ? h('p', 'bo-tag', p.tagline) : null;
    if (tag) { tag.setAttribute('data-hit', 'tagline'); lock.appendChild(tag); }
    world.appendChild(lock); cam.appendChild(world); st.appendChild(cam);
    var flash = p.flash !== false ? h('i', 'bo-flash') : null; if (flash) st.appendChild(flash);
    el.appendChild(st);

    // ---- timeline: designed at D = 12; k scales it ----
    var k = Math.max(0.5, D / 12), t = function (s) { return at + s * k; };
    function ft(n, a, b, s) { b.immediateRender = true; tl.fromTo(n, a, b, s); }
    ft(st, { opacity: 0 }, { opacity: 1, duration: R ? 0.1 : 0.8, ease: 'none' }, at);
    // space parallax: near stars dolly fastest; nebulae drift; rays turn slowly
    stars.forEach(function (s, i) { ft(s, { scale: 1, x: 0 }, { scale: R ? 1 : 1 + 0.08 * (i + 1), x: R ? 0 : (-1.5 * (i + 1)) + 'cqw', duration: D, ease: 'none' }, at); });
    neb.forEach(function (n, i) { ft(n, { xPercent: 0, rotate: 0 }, { xPercent: R ? 0 : (i % 2 ? -8 : 8), rotate: R ? 0 : (i % 2 ? -10 : 12), duration: D, ease: 'sine.inOut' }, at); });
    ft(rays, { rotate: -12, opacity: 0 }, { rotate: 16, opacity: 1, duration: D, ease: 'none' }, at);
    if (!R) bokeh.forEach(function (o) {
      ft(o.el, { opacity: 0, y: 0, x: 0 }, { keyframes: [{ opacity: 0.55, duration: 1.5 * k, ease: 'sine.out' },
        { opacity: 0.25 + 0.3 * seeded(o.k + 3), y: (-6 - 8 * seeded(o.k + 5)) + 'cqw', x: ((seeded(o.k + 9) - 0.5) * 6) + 'cqw', duration: D - 1.5 * k, ease: 'none' }] }, at + 0.15 * o.k * k);
    });
    tl.call(c.audio.cue, ['whoosh'], t(0.3));
    if (presents) ft(presents, { opacity: 0, y: 12, letterSpacing: '0.8em' }, { keyframes: [
      { opacity: 1, y: 0, letterSpacing: '0.42em', duration: 1.0 * k, ease: 'expo.out' },
      { opacity: 1, duration: 0.6 * k }, { opacity: 0, y: -10, letterSpacing: '0.36em', duration: 0.5 * k, ease: 'power2.in' }] }, t(0.4));

    // camera: dolly in from deep space, then orbit the lockup (the extrusion shows), settle, push through at the end
    ft(world, { z: R ? 0 : -900, rotateX: R ? 0 : 16, rotateY: 0 }, { z: 0, rotateX: R ? 0 : 5, duration: R ? 0.2 : 3.2 * k, ease: 'power3.out' }, t(1.6));
    if (!R) {
      tl.to(world, { rotateY: -32, rotateX: -3, duration: 2.0 * k, ease: 'sine.inOut' }, t(4.9));
      tl.to(world, { rotateY: 20, rotateX: 4, duration: 2.2 * k, ease: 'sine.inOut' }, t(6.9));
      tl.to(world, { rotateY: 0, rotateX: 2, duration: 1.6 * k, ease: 'sine.inOut' }, t(9.1));
      ft(lock, { y: 0 }, { y: '-0.5cqw', duration: 1.4 * k, ease: 'sine.inOut', repeat: 3, yoyo: true }, t(5.0));
    }
    // bloom + floor light open behind the lockup
    ft(bloom, { opacity: 0, scale: 0.3 }, { opacity: 1, scale: 1, duration: 1.8 * k, ease: 'expo.out' }, t(2.6));
    ft(floor, { opacity: 0, scaleX: 0.2 }, { opacity: 1, scaleX: 1, duration: 2.0 * k, ease: 'expo.out' }, t(3.0));
    // mark: spins in out of depth
    if (mark) {
      ft(mark.el, { opacity: 0, z: R ? 0 : -1600, rotateY: R ? 0 : -540, rotateX: R ? 0 : 35, y: R ? 0 : '-8cqw' },
        { keyframes: [{ opacity: 1, duration: 0.25 * k, ease: 'none' },
          { z: 0, rotateY: 0, rotateX: 0, y: 0, duration: R ? 0.2 : 1.6 * k, ease: 'expo.out' }] }, t(2.1));
      tl.call(c.audio.cue, ['impact'], t(3.4));
    }
    // letters: each flies in from its own angle, staggered left to right, and locks into the word
    letters.forEach(function (L, i) {
      var sgn = i % 2 ? 1 : -1;
      ft(L, { opacity: 0, z: R ? 0 : -1300 - i * 90, x: R ? 0 : ((i - 2.5) * 9) + 'cqw', y: R ? 0 : (sgn * (6 + i)) + 'cqw',
              rotateY: R ? 0 : sgn * (220 + i * 40), rotateX: R ? 0 : -sgn * 70, rotateZ: R ? 0 : sgn * 25 },
        { keyframes: [{ opacity: 1, duration: 0.2 * k, ease: 'none' },
          { z: 0, x: 0, y: 0, rotateY: 0, rotateX: 0, rotateZ: 0, duration: R ? 0.2 : 1.35 * k, ease: 'expo.out' }] }, t(3.5 + i * 0.13));
    });
    tl.call(c.audio.cue, ['tick'], t(4.6));
    ft(halo, { opacity: 0 }, { keyframes: [{ opacity: 0.85, duration: 0.8 * k, ease: 'power2.out' }, { opacity: 0.45, duration: 1.2 * k, ease: 'sine.inOut' }] }, t(4.9));
    if (!R) ft(halo, { scale: 1 }, { scale: 1.04, duration: 1.1 * k, ease: 'sine.inOut', repeat: 3, yoyo: true, immediateRender: false }, t(6.9));
    ft(rule, { scaleX: 0, opacity: 1 }, { scaleX: 1, duration: 1.1 * k, ease: 'expo.inOut' }, t(5.1));
    ft(sheen, { backgroundPositionX: '-60%' }, { backgroundPositionX: '160%', duration: 1.3 * k, ease: 'power2.inOut' }, t(5.6));
    tl.to(sheen, { backgroundPositionX: '-60%', duration: 1.3 * k, ease: 'power2.inOut' }, t(9.0));
    // star: comets in from the upper left, ticks onto the last x, shockwave ring, then twinkles
    if (star) {
      ft(star.firstChild, { rotate: -200 }, { rotate: 0, duration: 0.9 * k, ease: 'power2.out' }, t(6.9));
      ft(star, { opacity: 0, x: R ? 0 : '-46cqw', y: R ? 0 : '-24cqw', scale: 0.4 },
        { keyframes: [{ opacity: 1, duration: 0.15 * k, ease: 'none' },
          { x: 0, y: 0, scale: 1.5, duration: 0.75 * k, ease: 'power3.in' },
          { scale: 1, duration: 0.4 * k, ease: 'back.out(3)' }] }, t(6.9));
      ft(trail, { opacity: 0, scaleX: 0.2 }, { keyframes: [{ opacity: 1, scaleX: 1, duration: 0.5 * k, ease: 'power2.out' },
        { opacity: 0, scaleX: 0.1, duration: 0.45 * k, ease: 'power2.in' }] }, t(7.0));
      tl.call(c.audio.cue, ['chime'], t(7.8));
      ft(ring, { opacity: 0, scale: 0.1 }, { keyframes: [{ opacity: 1, scale: 0.6, duration: 0.12 * k, ease: 'none' },
        { opacity: 0, scale: 3.2, duration: 0.9 * k, ease: 'power2.out' }] }, t(7.8));
      if (!R) ft(star.firstChild, { scale: 1, rotate: 0 }, { scale: 0.8, rotate: 45, duration: 0.7 * k, ease: 'sine.inOut', repeat: 3, yoyo: true, immediateRender: false }, t(8.4));
    }
    if (tag) ft(tag, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.9 * k, ease: 'expo.out' }, t(8.3));
    var cornerEl = document.querySelector('.brand-corner');
    if (cornerEl) ft(cornerEl, { opacity: 0 }, { opacity: 1, duration: 0.5 * k, ease: 'none' }, at + D - 0.5 * k);
    // push through the lockup into the flash
    if (!R) tl.to(world, { z: 520, duration: 1.4 * k, ease: 'power3.in' }, at + D - 1.4 * k);
    if (flash) ft(flash, { opacity: 0 }, { opacity: 1, duration: 0.6 * k, ease: 'power2.in' }, at + D - 0.6 * k);
    return {}; // no stage camera: the ident drives its own camera
  };
})();
