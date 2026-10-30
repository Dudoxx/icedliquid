/* preset: ui-tour — a guided tour of ONE real screen: the capture rises in a quiet browser frame, then each
   hotspot in turn draws a ring on its control, drops a numbered pin and lights the matching callout in the
   note list beside the screen (task → where → what it does). follow: true pans + zooms the capture onto each
   hotspot (≤ 2.2, clamped to the image edge) and back out for the last beat. Seek-pure: entrances are
   timeline tweens, the active note / past rings are painted from t in render.
   © Dudoxx UG / Acceleate Consulting - Walid Boudabbous <walid@acceleate.com>
   params: src (required, a capture; its size is read into _aspect at build time), url? (browser bar text), alt?,
           spots (required, 1..8 [{ x, y, w, h (image %), label, text?, at? (s in the unit), zoom?, pin? }]),
           pin? (v5.4) = the side the badge prefers: 'tl' | 'tr' | 'bl' | 'br' (ring corners) | 'l' | 'r' (beside the ring,
           vertically centred) — tried first, the usual fallbacks follow; 'none' = no badge (ring + callout stay). Use it
           to put the badge in empty space beside its target, never over UI text,
           kicker?, title?, body? (text column; the note list sits under it), follow? (v6: default TRUE; false = no zoom),
           zoom? (zoom CAP when follow, default 2.2; each spot zooms by its size, or its own `zoom`),
           view? (v5.5, beat or spot; follow only) = { x, y, zoom } the camera window: visible top-left corner in image % +
           zoom 1..3.4 — replaces the auto centring so the window edges sit on clean gaps (a spot's view wins over the beat's),
           spot click? (default true; false = the pointer arrives without a ripple, for an info block that is not a control), chrome? (false = no browser bar), side? 'left' (default) | 'right', cursor? (default true: a virtual pointer clicks each spot)
   hits: screen · spot-1 … spot-N · pin-1 … · note-1 …
   @requires manual-kit */
(function () {
  'use strict';
  (window.PRESETS = window.PRESETS || {})['ui-tour'] = function (c) {
    var p = c.p, el = c.el, at = c.at, tl = c.tl, S = c.S, h = c.h, K = window.MANUAL_KIT;
    var spots = (p.spots || []).slice(0, 8);
    // v6 (owner 2026-10-29: "screenshots are barely readable"): follow-zoom is ON by default; `follow: false` opts out
    var follow = p.follow !== false;
    var col = c.textCol(el, p);
    if (p.side === 'right') el.classList.add('mk-flip');
    var list = h('ol', 'mk-notes'), notes = spots.map(function (s, k) {
      var li = h('li', 'mk-note'); li.setAttribute('data-hit', 'note-' + (k + 1));
      li.appendChild(h('i', 'mk-num', String(k + 1))); li.appendChild(h('b', null, s.label || ''));
      if (s.text) li.appendChild(h('span', null, s.text));
      list.appendChild(li); return li;
    });
    if (spots.length > 4) list.classList.add('is-dense');
    col.appendChild(list);
    var sc = K.screen(c, p, { maxW: 56, maxH: 34 });
    var rings = [], pins = [];
    spots.forEach(function (s, k) {
      var r = h('i', 'mk-spot'); r.setAttribute('data-hit', 'spot-' + (k + 1));
      rings.push(sc.place(r, s.x, s.y, s.w || 6, s.h || 4));
      var pin = h('i', 'mk-pin', String(k + 1)); pin.setAttribute('data-hit', 'pin-' + (k + 1));
      pins.push(sc.place(pin, s.x, s.y));
    });
    // v5.3 pin de-collision (audit-overlaps.js found stacked pins on neighbouring spots). Done once, on the first painted
    // frame, from LAYOUT boxes (offset*, unaffected by the zoom / GSAP transforms): each pin tries its ring's corners —
    // top-left (the old default), top-right, bottom-left, bottom-right — then the ring's sides and a second column, and keeps the first one inside the capture and
    // clear of every earlier pin. Cached, so every seek paints the same layout.
    var laid = false;
    function layPins() {
      var W = sc.layer.offsetWidth, H = sc.layer.offsetHeight; if (!W || !H) return;
      laid = true; var taken = [];
      pins.forEach(function (pin, k) {
        var rg = rings[k], pw = pin.offsetWidth, ph = pin.offsetHeight, gap = 2;
        var L = rg.offsetLeft, T = rg.offsetTop, R = L + rg.offsetWidth, B = T + rg.offsetHeight;
        var M = T + (B - T - ph) / 2; // vertically centred on the ring
        var opts = [[L - pw + gap * 2, T - ph + gap * 2], [R - gap * 2, T - ph + gap * 2], [L - pw + gap * 2, B - gap * 2], [R - gap * 2, B - gap * 2],
          [L - pw - gap, M], [R + gap, M], [L - 2 * pw - gap * 2, M], [L - 2 * pw - gap * 2, T - ph + gap * 2]]; // corners, then sides, then a second column
        var want = spots[k].pin;
        if (want === 'none' || want === false) { pin.style.display = 'none'; return; }
        var pref = { tl: 0, tr: 1, bl: 2, br: 3, l: 4, r: 5 }[want];
        if (pref != null) opts = [opts[pref]].concat(opts);
        var pick = opts.filter(function (o) {
          return o[0] >= 0 && o[1] >= 0 && o[0] + pw <= W && o[1] + ph <= H &&
            taken.every(function (q) { return o[0] + pw + gap <= q[0] || q[0] + pw + gap <= o[0] || o[1] + ph + gap <= q[1] || q[1] + ph + gap <= o[1]; });
        })[0] || opts[0];
        taken.push(pick);
        pin.style.translate = '0 0';
        pin.style.left = (pick[0] / W * 100).toFixed(3) + '%'; pin.style.top = (pick[1] / H * 100).toFixed(3) + '%';
      });
    }
    el.appendChild(sc.frame);

    var next = (p.kicker || p.title || p.body) ? c.headIn(tl, col, at) : at + 0.2;
    S.preset('rise', tl, sc.frame, at + 0.1);
    var from = Math.max(0.9, next - at + 0.5), to = Math.max(from, c.dur - 1.6);
    var ts = K.times(spots, from, to);
    spots.forEach(function (s, k) {
      var t = at + ts[k];
      if (S.reduced) { tl.set([rings[k], pins[k], notes[k]], { opacity: 1 }, at); return; }
      tl.fromTo(rings[k], { opacity: 0, scale: 1.35 }, { opacity: 1, scale: 1, duration: 0.45, ease: S.ease('out'), immediateRender: true }, t);
      tl.fromTo(pins[k], { opacity: 0, scale: 0.4 }, { opacity: 1, scale: 1, duration: 0.4, ease: S.ease('spring'), immediateRender: true }, t + 0.12);
      tl.fromTo(notes[k], { opacity: 0, y: '0.8cqw' }, { opacity: 1, y: 0, duration: 0.45, ease: S.ease('out'), immediateRender: true }, t + 0.05);
      tl.call(c.audio.cue, ['tick'], t);
      // auto zoom per spot: a small control comes closer, a wide panel stays wide (cap = p.zoom, default 2.2)
      var zCap = p.zoom || 2.2, zAuto = Math.max(1.6, Math.min(zCap, 46 / Math.max(s.w || 6, (s.h || 4) * 1.2)));
      // v6: never crop the spot itself — the zoom fits the whole spot with an 8 % margin (a wide row stays ~1.15x;
      // owner screenshot 2026-10-29: "Qualifications" row cut mid-word at 1.6x). An explicit spot zoom / view wins.
      zAuto = Math.max(1, Math.min(zAuto, 92 / Math.max(s.w || 6, 1), 92 / Math.max(s.h || 4, 1)));
      // v5.5 `view` (spot, else beat): an explicit camera window instead of centring on the spot — {x, y} = the visible
      // top-left corner in image %, zoom (1..3.4) — so the crop edges fall on clean column / row gaps, never mid-word
      var v = s.view || p.view;
      if (follow && v) { var vz = Math.max(1, Math.min(v.zoom || 1, 3.4)); K.zoomTo(c, sc.pan, { x: v.x + 50 / vz, y: v.y + 50 / vz }, vz, t - 0.35, 0.8, 3.4); }
      else if (follow) K.zoomTo(c, sc.pan, s, s.zoom || zAuto, t - 0.35, 0.8);
    });
    if (follow && spots.length) K.zoomTo(c, sc.pan, { x: 50, y: 50 }, 1, at + Math.min(c.dur - 0.9, to + 1.1), 0.8);

    // v5.1: a virtual pointer travels to each spot and clicks as it lights (cursor: false turns it off)
    var paintCur = p.cursor === false ? null : K.cursor(c, sc, spots.map(function (s, k) { return { x: s.x + (s.w || 6) / 2, y: s.y + (s.h || 4) / 2, at: ts[k], click: s.click !== false }; }));
    var last = -2, lastZ = 1;
    function render(local) {
      if (!laid) layPins();
      if (paintCur) paintCur(local);
      // v6: pins live in the zoomed layer; counter-scale them (CSS `scale`, independent of the entrance tween) so a
      // follow-zoom never blows a badge up over the UI text it sits beside (owner screenshot 2026-10-29)
      var z = follow && window.gsap ? Number(window.gsap.getProperty(sc.pan, 'scale')) || 1 : 1;
      if (Math.abs(z - lastZ) > 0.001) { lastZ = z; for (var j = 0; j < pins.length; j++) pins[j].style.scale = (1 / z).toFixed(4); }
      var k = S.reduced ? spots.length - 1 : K.active(ts, local);
      // past spots step back (30 %) so the active ring and pin always lead; future ones stay as the timeline left them
      for (var i = 0; i < spots.length; i++) if (i < k) { rings[i].style.opacity = '0.3'; pins[i].style.opacity = '0.3'; }
      else if (i === k && !S.reduced) { rings[i].style.opacity = '1'; pins[i].style.opacity = '1'; }
      if (k === last) return; last = k;
      notes.forEach(function (n, i) { n.classList.toggle('is-on', i === k); n.classList.toggle('is-done', i < k); });
      rings.forEach(function (r, i) { r.classList.toggle('is-past', i < k); });
    }
    return { rig: sc.frame, focusRig: follow ? null : sc.pan, camera: 'breathe', render: render };
  };
})();
