/* preset: counter — studio big-number (kit/patterns/big-number.mjs): one figure counts up as it
   enters (count-up, registry 1.4 s expo), a rule rail grows under it, the meaning follows.
   Width-locked, painted in render(t) from a proxy (GSAP suppresses onUpdate on seek).
   roll: true renders the figure as an odometer (one rolling column per digit, mono tabular face).
   params: value (number, required), kicker?, title?, body?, from?, decimals?, prefix?, suffix?, note?, start? (s), roll?
   hits: figure · note */
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
      // v2 (D-029): a column RESTS on a whole digit and FLICKS to the next one in the last 30 % of each unit
      // (smoothstep) - the v1 linear roll held two half glyphs on screen for the whole slow tail of the count.
      // Still a pure function of the value, so seek and play paint the same digits.
      function flick(f) { var q = Math.min(1, Math.max(0, (f - 0.7) / 0.3)); return q * q * (3 - 2 * q); }
      for (var k = 0; k < m; k++) {
        var p10 = Math.pow(10, k), u, pos;
        if (k === 0) { u = n % 10; pos = Math.floor(u) + flick(u - Math.floor(u)); }
        else { u = Math.max(0, (n % p10) - (p10 - 1)); pos = Math.floor(n / p10) % 10 + flick(u); }
        cols[m - 1 - k].style.transform = 'translateY(' + (-pos * 100 / 11).toFixed(4) + '%)';
      }
    };
  }
  (window.PRESETS = window.PRESETS || {}).counter = function (c) {
    var p = c.p, el = c.el, at = c.at, tl = c.tl, S = c.S, h = c.h;
    var col = c.textCol(el, p);
    var box = h('div', 'big visual'), num = h('span', 'big-figure'), rule = h('span', 'big-rule');
    num.setAttribute('data-hit', 'figure');
    box.appendChild(num); box.appendChild(rule);
    if (p.note) { var nt = h('p', 'big-note', p.note); nt.setAttribute('data-hit', 'note'); box.appendChild(nt); }
    el.appendChild(box);
    var to = Number(p.value), from = Number(p.from || 0), fmt = c.formatter(p), P = { v: from };
    num.textContent = fmt(from);
    if (p.roll) num.classList.add('odo-host');
    var paint = p.roll ? odometer(h, num, fmt, p.decimals || 0, p.prefix, p.suffix) : null;
    c.lockWidth(num, c.numberSamples(fmt, Math.max(Math.abs(to), Math.abs(from))));
    var next = c.headIn(tl, col, at), t1 = at + (p.start != null ? Number(p.start) : next - at + 0.2);
    var dur = S.durOf('count-up');
    S.preset('scale-in', tl, num, t1);
    tl.fromTo(P, { v: from }, { v: to, duration: S.reduced ? 0 : dur, ease: S.ease('expo'), immediateRender: true }, t1);
    S.preset('bar-grow', tl, rule, t1 + 0.2, { axis: 'x' });
    if (p.note) S.preset('rise', tl, box.querySelector('.big-note'), t1 + dur * S.choreography.nextBeatAtLeadFraction);
    tl.call(c.audio.cue, ['impact'], t1 + dur);
    return { rig: box, camera: 'push', render: function () { if (paint) paint(P.v); else num.textContent = fmt(P.v); } };
  };
})();
