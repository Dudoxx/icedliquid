/* preset: kpi-trio — studio kpi-trio (kit/patterns/kpi-trio.mjs): copy on top, then up to three
   elevated tiles rise in a stagger; each value counts up as its tile enters (count-up 1.2 s).
   roll (per tile or for all): values roll like an odometer instead of counting as text.
   params: tiles (required, [{ value, label, prefix?, suffix?, decimals?, roll? }], 1..3), kicker?, title?, body?, roll?
   hits: kpi-1 … kpi-3 */
(function () {
  'use strict';
  // Odometer (roll: true): one clipped column per digit holding 0-9 (+0 for the wrap). Column
  // positions are computed from the proxy value in render(), so the same t always paints the same
  // digits (seek-pure). The DOM is rebuilt only when the formatted shape changes (or lockWidth's
  // re-measure replaced it with plain text).
  // v2b: prefix / suffix ("155" + " of 159") are STATIC affix text, never digit columns — rolling the suffix's
  // digits stole the value's columns (the figure stuck at 000).
  function odometer(h, node, fmt, dec, pre, suf) {
    pre = pre || ''; suf = suf || '';
    return function (v) {
      var full = fmt(v), s = full.slice(pre.length, full.length - suf.length), key = s.replace(/[0-9]/g, '0'), root = node.firstChild;
      if (!root || root.className !== 'odo' || node.__odoKey !== key) {
        node.textContent = ''; root = h('span', 'odo'); root.setAttribute('aria-hidden', 'true'); node.__odoCols = [];
        if (pre) root.appendChild(h('span', 'odo-affix', pre));
        for (var i = 0; i < s.length; i++) {
          var ch = s.charAt(i);
          if (ch >= '0' && ch <= '9') {
            var col = h('span', 'odo-col'), strip = h('span', 'odo-strip');
            for (var d = 0; d <= 10; d++) strip.appendChild(h('span', 'odo-digit', String(d % 10)));
            col.appendChild(strip); root.appendChild(col); node.__odoCols.push(strip);
          } else { var sp = h('span', 'odo-sep', ch); sp.setAttribute('data-sep', ch); root.appendChild(sp); }
        }
        if (suf) root.appendChild(h('span', 'odo-affix', suf));
        node.appendChild(root); node.__odoKey = key;
      }
      node.setAttribute('aria-label', full);
      var n = Math.abs(v) * Math.pow(10, dec), cols = node.__odoCols, m = cols.length;
      // v2 (D-029): rest on a whole digit, flick to the next in the last 30 % of each unit (same as counter.js)
      function flick(f) { var q = Math.min(1, Math.max(0, (f - 0.7) / 0.3)); return q * q * (3 - 2 * q); }
      for (var k = 0; k < m; k++) {
        var p10 = Math.pow(10, k), u, pos;
        if (k === 0) { u = n % 10; pos = Math.floor(u) + flick(u - Math.floor(u)); }
        else { u = Math.max(0, (n % p10) - (p10 - 1)); pos = Math.floor(n / p10) % 10 + flick(u); }
        cols[m - 1 - k].style.transform = 'translateY(' + (-pos * 100 / 11).toFixed(4) + '%)';
      }
    };
  }
  (window.PRESETS = window.PRESETS || {})['kpi-trio'] = function (c) {
    var p = c.p, el = c.el, at = c.at, tl = c.tl, S = c.S, h = c.h;
    el.classList.add('stack');
    var col = c.textCol(el, p), row = h('div', 'kpi-row visual'), items = [];
    (p.tiles || []).slice(0, 3).forEach(function (t, k) {
      var tile = h('div', 'kpi-tile'); tile.setAttribute('data-hit', 'kpi-' + (k + 1));
      var v = h('b', 'kpi-value'); tile.appendChild(v); tile.appendChild(h('span', 'kpi-label', t.label));
      row.appendChild(tile);
      var fmt = c.formatter(t), P = { v: 0 }; v.textContent = fmt(0);
      var roll = t.roll != null ? !!t.roll : !!p.roll;
      if (roll) v.classList.add('odo-host');
      items.push({ el: v, P: P, to: Number(t.value), fmt: fmt, tile: tile, paint: roll ? odometer(h, v, fmt, t.decimals || 0, t.prefix, t.suffix) : null });
    });
    el.appendChild(row);
    items.forEach(function (it) { c.lockWidth(it.el, c.numberSamples(it.fmt, it.to), 'left'); });
    var next = c.headIn(tl, col, at), g = 0.25;
    S.preset('rise-stagger', tl, items.map(function (i) { return i.tile; }), next, { stagger: g });
    items.forEach(function (it, k) {
      tl.fromTo(it.P, { v: 0 }, { v: it.to, duration: S.reduced ? 0 : S.ACCENT.count, ease: S.ease('expo'), immediateRender: true }, next + k * g);
    });
    tl.call(c.audio.cue, ['impact'], next + (items.length - 1) * g + S.ACCENT.count);
    return { rig: row, camera: 'breathe', render: function () { items.forEach(function (it) { if (it.paint) it.paint(it.P.v); else it.el.textContent = it.fmt(it.P.v); }); } };
  };
})();
