/* preset: step-rail — a numbered procedure (1..8 steps) on a vertical rail: the rail FILLS to the active step
   (a typed @property --mk-fill painted from t), each bead lights as its step starts, done steps keep a tick,
   and a "Step 2 of 5" counter rides above the list (width-locked). With `src`, a capture sits beside the rail
   and pans + zooms to each step's `focus` rect (image %), so the procedure and the screen stay in lockstep —
   the core "how do I…" scene of a manual. Seek-pure: fill, counter and states are painted in render(t).
   © Dudoxx UG / Acceleate Consulting - Walid Boudabbous <walid@acceleate.com>
   params: steps (required, 2..8 [{ title, text?, at? (s in the unit), focus? { x, y, w?, h?, zoom? } }]),
           kicker?, title?, src? (+ url?, alt?, chrome?), zoom? (default 1.6 for focus rects)
   hits: rail · step-1 … step-N · counter · screen (with src)
   @requires manual-kit */
(function () {
  'use strict';
  (window.PRESETS = window.PRESETS || {})['step-rail'] = function (c) {
    var p = c.p, el = c.el, at = c.at, tl = c.tl, S = c.S, h = c.h, K = window.MANUAL_KIT, W = K.words(c);
    var steps = (p.steps || []).slice(0, 8), n = steps.length;
    var col = c.textCol(el, { kicker: p.kicker, title: p.title });
    var counter = h('p', 'sr-counter'); counter.setAttribute('data-hit', 'counter');
    var cnum = h('b', null, '1'); counter.appendChild(h('span', null, W.step + ' ')); counter.appendChild(cnum);
    counter.appendChild(h('span', null, ' ' + W.of + ' ' + n));
    col.appendChild(counter);
    var rail = h('ol', 'sr-rail'); rail.setAttribute('data-hit', 'rail');
    var items = steps.map(function (s, k) {
      var li = h('li', 'sr-step'); li.setAttribute('data-hit', 'step-' + (k + 1));
      li.appendChild(h('i', 'sr-bead', String(k + 1)));
      var tx = h('div', 'sr-copy'); tx.appendChild(h('b', null, s.title || ''));
      if (s.text) tx.appendChild(h('span', null, s.text));
      li.appendChild(tx); rail.appendChild(li); return li;
    });
    col.appendChild(rail);
    if (!p.src) el.classList.add('sr-solo');
    var sc = p.src ? K.screen(c, p, { maxW: 50, maxH: 34 }) : null;
    if (sc) el.appendChild(sc.frame);
    c.lockWidth(cnum, String(n).split('').map(function () { return '8'; }).concat([String(n)]), 'center');

    var next = c.headIn(tl, col, at);
    S.preset('rise-stagger', tl, items, next, { stagger: Math.min(0.12, 1.2 / Math.max(1, n)) });
    S.preset('rise', tl, counter, next);
    if (sc) S.preset('rise', tl, sc.frame, at + 0.1);
    var from = Math.max(1.0, next - at + 0.6), to = Math.max(from, c.dur - 1.4);
    var ts = K.times(steps, from, to);
    steps.forEach(function (s, k) {
      tl.call(c.audio.cue, ['tick'], at + ts[k]);
      if (sc && s.focus) K.zoomTo(c, sc.pan, s.focus, s.focus.zoom || p.zoom || 1.6, at + ts[k] - 0.3, 0.8);
    });
    if (sc && steps.some(function (s) { return s.focus; })) K.zoomTo(c, sc.pan, { x: 50, y: 50 }, 1, at + Math.min(c.dur - 0.9, to + 1), 0.8);

    var curStops = sc && p.cursor !== false ? steps.map(function (s, k) { return s.focus ? { x: s.focus.x + (s.focus.w || 0) / 2, y: s.focus.y + (s.focus.h || 0) / 2, at: ts[k] } : null; }).filter(Boolean) : [];
    var paintCur = curStops.length ? K.cursor(c, sc, curStops) : null;
    var last = -2;
    function render(local) {
      if (paintCur) paintCur(local);
      var k = S.reduced ? n - 1 : K.active(ts, local);
      // rail fill: from bead k to bead k+1 as the step plays out (0..1 of the whole rail)
      var seg = k < 0 ? 0 : k >= n - 1 ? 1 : Math.min(1, (local - ts[k]) / Math.max(0.4, ts[k + 1] - ts[k]));
      var fill = n > 1 ? Math.max(0, (Math.max(0, k) + (k < 0 ? 0 : seg)) / (n - 1)) : 1;
      rail.style.setProperty('--mk-fill', Math.min(1, fill).toFixed(4));
      if (k === last) return; last = k;
      cnum.textContent = String(Math.max(1, k + 1));
      items.forEach(function (li, i) { li.classList.toggle('is-on', i === k); li.classList.toggle('is-done', i < k); });
    }
    return sc ? { rig: sc.frame, camera: 'breathe', render: render } : { rig: rail, camera: 'hold', render: render };
  };
})();
