/* preset: quote — studio quote (kit/patterns/quote.mjs) with an avatar: the quote REVEALS LINES
   (line-mask), a key phrase gets a marker highlight, the speaker chip (avatar + name + role)
   scales in. Avatar = person photo (injected image) or initials on a token disc — never a
   generated face of a real person.
   params: text (required), who (required, { name, role?, src? }), mark? (a phrase of text to highlight), kicker?,
           split? 'lines' (SplitText line mask split after the fonts load; default off)
   hits: quote · who
   @requires split-lines */
(function () {
  'use strict';
  (window.PRESETS = window.PRESETS || {}).quote = function (c) {
    var p = c.p, el = c.el, at = c.at, tl = c.tl, S = c.S, FX = c.FX, h = c.h;
    var wrap = h('figure', 'quote visual');
    if (p.kicker) wrap.appendChild(h('p', 'kicker', p.kicker));
    var q = h('blockquote', 'quote-text'); q.setAttribute('data-hit', 'quote');
    var text = String(p.text || ''), i = p.mark ? text.indexOf(p.mark) : -1, markEl = null;
    if (i >= 0) {
      q.appendChild(document.createTextNode(text.slice(0, i)));
      markEl = h('span', 'quote-mark', p.mark); q.appendChild(markEl);
      q.appendChild(document.createTextNode(text.slice(i + p.mark.length)));
    } else q.textContent = text;
    wrap.appendChild(q);
    var who = h('figcaption', 'quote-who'); who.setAttribute('data-hit', 'who');
    var w = p.who || {};
    who.appendChild(FX.avatar({ name: w.name, src: w.src, size: 'lg' }));
    var nm = h('div', 'quote-name'); nm.appendChild(h('b', null, w.name || '')); if (w.role) nm.appendChild(h('span', null, w.role));
    who.appendChild(nm); wrap.appendChild(who);
    el.appendChild(wrap);
    if (p.kicker) S.preset('clip-wipe', tl, wrap.querySelector('.kicker'), at + 0.1);
    var SL = p.split === 'lines' && window.SPLIT_LINES;
    var paint = SL ? SL.reveal(c, q, at + S.ENTER.headStart + 0.1) : S.preset('line-mask', tl, q, at + S.ENTER.headStart + 0.1);
    var lead = at + 0.25 + S.durOf('line-mask') * 1.4;
    if (markEl) S.preset('highlight', tl, markEl, lead);
    S.preset('scale-in', tl, who, lead + 0.2, { ease: 'spring' });
    var out = { rig: wrap, camera: 'push' };
    if (SL && paint) { out.render = function () { paint(); }; out.render.idle = paint; }
    return out;
  };
})();
