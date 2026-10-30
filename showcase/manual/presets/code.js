/* preset: code — a terminal / editor window (studio terminal-window chrome) whose code comes in
   one of two ways, then gets LIT line by line:
     mode "type"   typewriter (studio type-on: allowed for code), caret at the head
     mode "phase"  lines phase in: each line clip-wipes in, staggered (default)
   light: [{ at (s into chapter), lines: [n, …] }] — a band slides to those lines, the rest dims.
   Highlighting = token classes (keyword, string, number, comment, function), no hex.
   params: code (required, text with \n), lang?, file? (title bar), mode? phase | type, cps? (type speed,
           default 40), light?, output? (a result line that rises after the code), kicker?, title?, body?
   hits: window · line-1 … line-N · output */
(function () {
  'use strict';
  (window.PRESETS = window.PRESETS || {}).code = function (c) {
    var p = c.p, el = c.el, at = c.at, tl = c.tl, S = c.S, FX = c.FX, h = c.h;
    var col = (p.kicker || p.title || p.body) ? c.textCol(el, p) : null;
    var win = h('div', 'codewin visual'); win.setAttribute('data-hit', 'window');
    var bar = h('div', 'codewin-bar'); bar.appendChild(h('i')); bar.appendChild(h('i')); bar.appendChild(h('i'));
    bar.appendChild(h('span', null, p.file || p.lang || '')); win.appendChild(bar);
    var body = h('div', 'codewin-body'), band = h('span', 'code-band'); body.appendChild(band);
    var src = String(p.code || '').replace(/\t/g, '  ').split('\n');
    var lines = src.map(function (ln, k) {
      var row = h('div', 'code-line'); row.setAttribute('data-hit', 'line-' + (k + 1));
      row.appendChild(h('span', 'ln', String(k + 1)));
      var tx = h('code', 'lc'); tx.innerHTML = FX.codeLine(ln) || ' '; row.appendChild(tx);
      body.appendChild(row); return { row: row, tx: tx, text: ln };
    });
    win.appendChild(body);
    var out = null;
    if (p.output) { out = h('div', 'code-out', p.output); out.setAttribute('data-hit', 'output'); win.appendChild(out); }
    el.appendChild(win);

    var t1 = col ? c.headIn(tl, col, at) : at + 0.3, end;
    S.preset('scale-in', tl, win, at + 0.15);
    if (p.mode === 'type') {
      // Type through the whole file: one proxy, chars revealed by clipping each highlighted line.
      var total = src.reduce(function (n, l) { return n + l.length + 1; }, 0), P = { n: 0 }, cps = p.cps || 40;
      var caret = h('span', 'caret'); body.appendChild(caret);
      var d = total / cps;
      tl.fromTo(P, { n: 0 }, { n: total, duration: S.reduced ? 0 : d, ease: 'none', immediateRender: true }, t1);
      end = t1 + d;
      var typed = function () {
        var left = Math.round(P.n), last = null;
        lines.forEach(function (L) {
          var show = Math.max(0, Math.min(L.text.length, left)), vis = left >= 0;
          L.row.style.visibility = vis ? 'visible' : 'hidden';
          L.tx.style.clipPath = 'inset(0 calc(100% - ' + show + 'ch) 0 0)';
          if (vis && show <= L.text.length && left <= L.text.length) last = { L: L, show: show };
          left -= L.text.length + 1;
        });
        if (last) { caret.style.top = last.L.row.offsetTop + 'px'; caret.style.left = 'calc(' + last.L.tx.offsetLeft + 'px + ' + last.show + 'ch)'; }
        caret.style.opacity = P.n > 0 && P.n < total ? '1' : '0';
      };
    } else {
      var g = Math.min(0.12, Math.max(0.04, (c.dur * 0.35) / Math.max(1, lines.length)));
      S.preset('clip-wipe', tl, lines.map(function (L) { return L.row; }), t1, { stagger: g });
      end = t1 + g * lines.length + S.durOf('clip-wipe');
    }
    if (out) { S.preset('rise', tl, out, end + 0.2); tl.call(c.audio.cue, ['tick'], end + 0.2); }
    // Line lighting: band position + dim factor are proxies painted in render(t).
    var LP = { top: 0, height: 0, on: 0 }, rows = lines.map(function (L) { return L.row; });
    (p.light || []).forEach(function (m) {
      var ls = (m.lines || []).map(Number).filter(function (n) { return n >= 1 && n <= lines.length; });
      if (!ls.length) return;
      var a = rows[Math.min.apply(null, ls) - 1], b = rows[Math.max.apply(null, ls) - 1], t = at + m.at;
      tl.to(LP, { top: a.offsetTop, height: b.offsetTop + b.offsetHeight - a.offsetTop, on: 1, duration: S.durOf('highlight'), ease: S.ease('move') }, t);
      if (m.hold) tl.to(LP, { on: 0, duration: 0.4, ease: S.ease('exit') }, t + S.durOf('highlight') + m.hold);
      tl.set(rows, { '--lit': 0 }, t).set(ls.map(function (n) { return rows[n - 1]; }), { '--lit': 1 }, t);
    });
    return {
      rig: win, focusRig: body, camera: 'push',
      render: function () {
        if (typed) typed();
        band.style.transform = 'translateY(' + LP.top.toFixed(1) + 'px)'; band.style.height = LP.height.toFixed(1) + 'px';
        band.style.opacity = LP.on.toFixed(3); body.style.setProperty('--dim', (LP.on * 0.22).toFixed(3)); // dimmed lines stay >= 4.5:1
      }
    };
  };
})();
