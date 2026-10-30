/* preset: agenda — the table of contents AS A SCENE (the player's T-key overlay is the other half).
   Items come from the piece's own chapters (ctx.chapters: number, label, start time), so the agenda
   never drifts from the piece. The list rises as one block (no top-down stagger), a rail DRAWS down
   the number column and a marker TRAVELS to the current chapter ("you are here").
   params: kicker?, title?, body?, current? (chapter id to mark; default = the next chapter),
           from? / to? (1-based chapter numbers to list, e.g. one act), times? (show m:ss, default true)
   v2 layout: > 12 rows -> stacked head + 3-column list (4 above 24 rows); <= 12 rows keep the side list.
   v5 walk (2026-10-27): walk [{ items: [chapter ids], at? (s in the chapter), label? }] lights each group's rows in turn —
           a solid accent state (number chip filled, row tinted, label in ink) that MOVES group to group with the narration;
           earlier groups stay marked as visited. Works in every layout (the 3-column list hides the rail marker, the walk
           does not). Omitted `at` = groups spread over the scene. Reduced motion: every row shown visited.
   v5.4 soft (2026-10-28, owner): soft: true = a row state never changes text metrics (no bold, no filled chip, no scale),
           so a label can never grow into the time column; the time column is fixed-width + right-aligned, labels stay on
           one line; the current row (default: the next chapter) only fades in a soft accent tint. Use it for act openers.
   hits: item-N (N = chapter number) · marker. fx.highlight on item-N sweeps a marker band over the row's LABEL (data-hl), voice-sync with `say`. */
(function () {
  'use strict';
  function clock(t) { var s = Math.max(0, Math.round(t)); return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }
  (window.PRESETS = window.PRESETS || {}).agenda = function (c) {
    var p = c.p, el = c.el, at = c.at, tl = c.tl, S = c.S, h = c.h;
    var all = c.chapters || [];
    var lo = Math.max(1, Number(p.from || 1)), hi = Math.min(all.length, Number(p.to || all.length));
    var items = all.filter(function (ch) { return ch.n >= lo && ch.n <= hi && ch.id !== c.chapter; });
    var self = all.filter(function (ch) { return ch.id === c.chapter; })[0];
    var curId = p.current || (self && all[self.n] ? all[self.n].id : (items[0] && items[0].id));
    // v2: more than 12 rows = the head stacks above a full-width, column-major list (3 columns, top to bottom),
    // so 22 chapters fit 1920x1080 at the label size (D-042). 10..12 rows keep the two-column list beside the copy.
    var multi = items.length > 12, cols = items.length > 24 ? 4 : 3;
    if (multi) el.classList.add('stack');
    var col = c.textCol(el, p);
    var wrap = h('div', 'agenda visual' + (multi ? ' is-multi' : items.length > 10 ? ' is-two' : '') + (p.soft ? ' is-soft' : ''));
    if (multi) { wrap.style.setProperty('--acols', String(cols)); wrap.style.setProperty('--arows', String(Math.ceil(items.length / cols))); }
    var rail = h('i', 'agenda-rail'), marker = h('i', 'agenda-marker'); marker.setAttribute('data-hit', 'marker');
    var list = h('ol', 'agenda-items');
    var curRow = null, rowById = {};
    items.forEach(function (ch) {
      var li = h('li', 'agenda-item' + (ch.id === curId ? ' is-current' : '')); li.setAttribute('data-hit', 'item-' + ch.n); li.setAttribute('data-hl', '.agenda-l'); // fx.highlight on item-N marks the label text (v2d), not the row box
      li.appendChild(h('span', 'agenda-n', ('0' + ch.n).slice(-2)));
      li.appendChild(h('span', 'agenda-l', String(ch.label).replace(/^\d+\s*·\s*/, '')));
      if (p.times !== false) li.appendChild(h('span', 'agenda-t', clock(ch.t)));
      list.appendChild(li);
      rowById[ch.id] = li;
      if (ch.id === curId) curRow = li;
    });
    wrap.appendChild(rail); wrap.appendChild(list); wrap.appendChild(marker);
    el.appendChild(wrap);
    var next = c.headIn(tl, col, at);
    S.preset('rise', tl, list, next);
    S.preset('bar-grow', tl, rail, next + 0.1);
    // marker travels from the first row to the current row (measured once laid out, painted from t)
    var M = { k: 0 }, from = null, to = null;
    tl.fromTo(M, { k: 0 }, { k: 1, duration: S.reduced ? 0 : 1.2, ease: S.ease('move'), immediateRender: true }, next + 0.6);
    // mark: false skips the built-in 'you are here' band (use it when fx.highlight `say` entries walk the rows)
    var walk = (p.walk || []).map(function (g) { return (g.items || []).map(function (id) { return rowById[id]; }).filter(Boolean); });
    if (curRow && p.soft && p.mark !== false && !walk.length) {
      if (S.reduced) tl.set(curRow, { '--walk': 1 }, at);
      else tl.fromTo(curRow, { '--walk': 0 }, { '--walk': 1, duration: 0.6, ease: S.ease('out'), immediateRender: true }, next + 1.7);
    } else if (curRow && p.mark !== false && !walk.length) S.preset('highlight', tl, curRow.querySelector('.agenda-l'), next + 1.7);
    var w0 = next - at + 1.2, w1 = Math.max(w0, c.dur - 1.4), wn = walk.length;
    var wts = (p.walk || []).map(function (g, k) { return typeof g.at === 'number' ? g.at : (wn > 1 ? w0 + (w1 - w0) * k / (wn - 1) : w0); });
    walk.forEach(function (rows, k) {
      if (!S.reduced) {
        tl.fromTo(rows, { '--walk': 0 }, { '--walk': 1, duration: 0.45, ease: S.ease('out'), stagger: 0.07, immediateRender: true }, at + wts[k]);
        tl.call(c.audio.cue, ['tick'], at + wts[k]);
      }
    });
    var lastW = -2;
    return {
      rig: wrap, camera: 'hold',
      render: function (local) {
        if (walk.length) {
          var g = -1; for (var i = 0; i < wts.length; i++) if (local >= wts[i]) g = i;
          if (S.reduced) g = walk.length;
          if (g !== lastW) {
            lastW = g;
            walk.forEach(function (rows, k) { rows.forEach(function (r) { r.classList.toggle('is-walk', k === g); r.classList.toggle('is-walked', k < g); }); });
            if (g >= 0 && g < walk.length && walk[g][0]) curRow = walk[g][0], from = null;
          }
        }
        if (from == null) {
          // layout offsets, not getBoundingClientRect: the list is mid-rise (transformed) at first paint
          var first = list.firstChild; if (!first || !wrap.offsetHeight) return;
          var cur = curRow || first;
          from = { x: first.offsetLeft, y: first.offsetTop + first.offsetHeight / 2 }; to = { x: cur.offsetLeft, y: cur.offsetTop + cur.offsetHeight / 2 };
        }
        marker.style.transform = 'translate(' + (from.x + (to.x - from.x) * M.k).toFixed(1) + 'px,' + (from.y + (to.y - from.y) * M.k).toFixed(1) + 'px)';
        marker.style.opacity = M.k > 0 ? '1' : '0';
      }
    };
  };
})();
