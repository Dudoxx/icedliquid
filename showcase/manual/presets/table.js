/* preset: table — a grid with a travelling row-focus bar and counting cells. Numeric cells COUNT UP
   from 0 (a proxy per row, painted in render(t) — GSAP suppresses onUpdate on seek), so a cell never
   reflows (lockWidth) and the same t always paints the same text. A solid focus bar slides row to row
   by transform only (translateY via yPercent; it fades in at full width — never scaleX, top or height). Rows rise in a
   stagger as support, never as the cue. A focus entry with `col` also lights that one cell.
   Numeric cells: a column with numeric:true, or a JS number. A string cell such as "96.5%" keeps its
   prefix / suffix and its decimals; "." is the decimal mark, "," a thousands mark.
   params: columns (required, [{ label, align? left|right, numeric? }]), rows (required, [[cell…]], 1..10),
           focus? [{ at (s into the scene), row (1-based), col? (1-based) }], kicker?, title?, body?
   hits: table · row-N · cell-R-C · focus */
(function () {
  'use strict';
  function parseCell(v) {
    if (typeof v === 'number') return { pre: '', suf: '', n: v, dec: (String(v).split('.')[1] || '').length };
    var m = /^([^\d-]*)(-?\d[\d,]*(?:\.\d+)?)(.*)$/.exec(String(v == null ? '' : v).trim());
    if (!m) return null;
    return { pre: m[1], suf: m[3], n: parseFloat(m[2].replace(/,/g, '')), dec: (m[2].split('.')[1] || '').length };
  }
  (window.PRESETS = window.PRESETS || {}).table = function (c) {
    var p = c.p, el = c.el, at = c.at, tl = c.tl, S = c.S, h = c.h;
    var cols = (p.columns || []).slice(0, 8), list = (p.rows || []).slice(0, 10), n = list.length;
    var col = (p.kicker || p.title || p.body) ? c.textCol(el, p) : null;
    var wrap = h('div', 'tbl visual' + (col ? '' : ' tbl--solo'));
    wrap.setAttribute('data-hit', 'table');
    wrap.style.setProperty('--tbl-cols', '2.2fr ' + 'repeat(' + Math.max(1, cols.length - 1) + ', minmax(0, 1fr))');
    wrap.style.setProperty('--row-h', (n <= 5 ? 4.6 : n <= 8 ? 3.6 : 3.0) + 'cqw');
    var head = h('div', 'tbl-row tbl-head');
    cols.forEach(function (cd) { var s = h('span', 'tbl-th', cd.label || ''); if (cd.align === 'right' || cd.numeric) s.classList.add('is-num'); head.appendChild(s); });
    wrap.appendChild(head);
    var body = h('div', 'tbl-body'), bar = h('span', 'tbl-focus');
    bar.setAttribute('data-hit', 'focus'); body.appendChild(bar);
    var cellOf = {}, rows = list.map(function (r, i) {
      var row = h('div', 'tbl-row'); row.setAttribute('data-hit', 'row-' + (i + 1));
      var counters = [];
      cols.forEach(function (cd, j) {
        var raw = r[j], cell = h('span', 'tbl-td', raw == null ? '' : String(raw));
        cell.setAttribute('data-hit', 'cell-' + (i + 1) + '-' + (j + 1));
        var num = (cd.numeric || typeof raw === 'number') ? parseCell(raw) : null;
        if (cd.align === 'right' || cd.numeric || typeof raw === 'number') cell.classList.add('is-num');
        if (num) counters.push({ node: cell, num: num, fmt: c.formatter({ decimals: num.dec, prefix: num.pre, suffix: num.suf }) });
        cellOf[(i + 1) + '-' + (j + 1)] = cell; row.appendChild(cell);
      });
      body.appendChild(row);
      return { row: row, counters: counters, P: { v: 0 } };
    });
    body.style.setProperty('--n', String(Math.max(1, n)));
    wrap.appendChild(body); el.appendChild(wrap);
    rows.forEach(function (r) {
      r.counters.forEach(function (k) {
        k.node.textContent = k.fmt(0);
        c.lockWidth(k.node, c.numberSamples(k.fmt, k.num.n).concat([k.fmt(0)]));
      });
    });

    var next = col ? c.headIn(tl, col, at) : at + 0.2, g = Math.min(0.3, Math.max(0.06, (c.dur * 0.3) / Math.max(1, n)));
    S.preset('rise-stagger', tl, [head].concat(rows.map(function (r) { return r.row; })), next, { stagger: g });
    var cd = S.durOf('count-up');
    rows.forEach(function (r, i) {
      if (!r.counters.length) return;
      tl.fromTo(r.P, { v: 0 }, { v: 1, duration: S.reduced ? 0 : cd, ease: S.ease('expo'), immediateRender: true }, next + 0.3 + i * g);
    });

    // the focus bar: fades in at full width, then slides row to row by yPercent (a transform)
    var fx = (p.focus || []).slice().sort(function (a, b) { return a.at - b.at; }), prev = null;
    fx.forEach(function (f) {
      var row = Math.min(n, Math.max(1, Math.round(f.row || 1))) - 1, t = at + Number(f.at || 0), d = S.reduced ? 0 : 0.55;
      if (prev === null) {
        tl.fromTo(bar, { opacity: 0, yPercent: row * 100 }, { opacity: 1, yPercent: row * 100, duration: d, ease: S.ease('out'), immediateRender: true }, t); // D-057: a fade, never scaleX - the bar is always the FULL row width
      } else {
        tl.fromTo(bar, { yPercent: prev * 100 }, { yPercent: row * 100, duration: d, ease: S.ease('expo'), immediateRender: false }, t);
      }
      prev = row;
      if (f.col && cellOf[(row + 1) + '-' + f.col]) {
        var cell = cellOf[(row + 1) + '-' + f.col];
        tl.fromTo(cell, { '--hot': 0 }, { '--hot': 1, duration: S.reduced ? 0 : 0.3, ease: S.ease('out'), immediateRender: false }, t + d * 0.6);
        var nx = fx[fx.indexOf(f) + 1];
        if (nx) tl.to(cell, { '--hot': 0, duration: S.reduced ? 0 : 0.25, ease: S.ease('out'), immediateRender: false }, at + Number(nx.at));
      }
      tl.call(c.audio.cue, ['tick'], t);
    });
    if (prev === null) tl.set(bar, { opacity: 0 }, 0);
    return {
      rig: wrap, camera: 'breathe',
      render: function () { rows.forEach(function (r) { r.counters.forEach(function (k) { k.node.textContent = k.fmt(k.num.n * r.P.v); }); }); }
    };
  };
})();
