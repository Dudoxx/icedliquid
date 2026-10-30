/* preset: split-compare — studio split-compare (kit/patterns/split-compare.mjs): the left panel
   enters, the right panel follows 400 ms later and the arrow DRAWS while it enters (same start,
   same duration) — never pointing at an empty slot.
   params: a (required, { title, points?: [text], src?, alt?, tone?: muted | primary }), b (required, same), kicker?, title?,
           mid? ('arrow' default = A then B | 'none' | any copy, e.g. "or" = a text chip, for two ALTERNATIVES)
   v2: src = a page image shown above the title (one beat: clean page next to a fax page). Both panels are elevated
       cards by default (neither reads disabled); tone: 'muted' opts a panel out.
   hits: a · b · arrow (the middle element) · a-1 … · b-1 … */
(function () {
  'use strict';
  function panel(c, x, key) {
    var h = c.h, pn = h('div', 'split-panel split-panel--' + key + (x.tone !== 'muted' ? ' is-primary' : ''));
    pn.setAttribute('data-hit', key);
    if (x.src) pn.appendChild(c.FX.image(x.src, 'split-img', x.alt || ''));
    pn.appendChild(h('h3', 'split-title', x.title));
    var ul = h('ul', 'split-points');
    (x.points || []).slice(0, 4).forEach(function (t, k) { var li = h('li', null, t); li.setAttribute('data-hit', key + '-' + (k + 1)); ul.appendChild(li); });
    pn.appendChild(ul);
    return pn;
  }
  (window.PRESETS = window.PRESETS || {})['split-compare'] = function (c) {
    var p = c.p, el = c.el, at = c.at, tl = c.tl, S = c.S, FX = c.FX, h = c.h;
    el.classList.add('stack');
    var col = c.textCol(el, p), wrap = h('div', 'split visual');
    var A = panel(c, p.a || {}, 'a'), B = panel(c, p.b || {}, 'b');
    var mid = p.mid == null ? 'arrow' : String(p.mid), path = null;
    var arrowBox = h('div', 'split-mid'); arrowBox.setAttribute('data-hit', 'arrow');
    if (mid === 'arrow') {
      var g = FX.svg('svg', { viewBox: '0 0 40 20', class: 'split-arrow', 'aria-hidden': 'true' });
      path = FX.svg('path', { d: 'M4 10 H34 M28 4 L35 10 L28 16', class: 'arrow' }); g.appendChild(path); arrowBox.appendChild(g);
    } else if (mid !== 'none') arrowBox.appendChild(h('span', 'split-or', mid));
    wrap.appendChild(A); wrap.appendChild(arrowBox); wrap.appendChild(B);
    el.appendChild(wrap);
    var next = c.headIn(tl, col, at), bAt = next + 0.4;
    S.preset('rise', tl, A, next);
    S.preset('rise-stagger', tl, A.querySelectorAll('li'), next + 0.2);
    S.preset('rise', tl, B, bAt);
    if (!path && mid !== 'none') S.preset('rise', tl, arrowBox, bAt);
    if (path) tl.fromTo(path, { strokeDasharray: 60, strokeDashoffset: 60 }, { strokeDasharray: 60, strokeDashoffset: 0, duration: S.durOf('rise'), ease: S.ease('cam'), immediateRender: true }, bAt);
    S.preset('rise-stagger', tl, B.querySelectorAll('li'), bAt + 0.2);
    tl.call(c.audio.cue, ['whoosh'], bAt);
    return { rig: wrap, camera: 'breathe' };
  };
})();
