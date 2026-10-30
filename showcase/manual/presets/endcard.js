/* preset: endcard — the outro:
   a brand-token sweep clears the frame → the OFFICIAL lockup reveals on the copy line (left-aligned since review round 1, F08) → the CTA card
   lands (one CTA line, URL, contact) → the composed frame holds still >= 1 s. Never ends on black.
   Logo = brand asset only (logo-map lockup, else brand.js logo), else the brand id as wordmark TEXT.
   params: cta? (one next step; tagline = v1 name), url?, contact?, use? mark | lockup (default mark = the bird-icon logo),
           split? 'lines' (the CTA reveals through a SplitText line mask; default off)
   hits: logo · cta · url
   @requires split-lines */
(function () {
  'use strict';
  (window.PRESETS = window.PRESETS || {}).endcard = function (c) {
    var p = c.p, el = c.el, at = c.at, tl = c.tl, S = c.S, h = c.h;
    var sweep = h('div', 'outro-sweep'); el.appendChild(sweep);
    var card = h('div', 'endcard');
    // Default = the bird-icon MARK (owner rule 2026-10-18); use: 'lockup' for the text-only typography file.
    var useMark = p.use !== 'lockup', src = (useMark ? c.marks.mark : c.marks.lockup) || c.brand.logo, mark;
    if (src) mark = c.FX.image(src, 'logo' + (useMark ? ' is-mark' : ''), (c.brand.id || '') + ' logo');
    else mark = h('p', 'wordmark', c.brand.id || '');
    mark.setAttribute('data-hit', 'logo');
    card.appendChild(mark);
    var cta = p.cta || p.tagline;
    var box = h('div', 'cta-card');
    var ct = null, SL = p.split === 'lines' && window.SPLIT_LINES, paint = null;
    if (cta) { ct = h('p', 'cta', cta); ct.setAttribute('data-hit', 'cta'); box.appendChild(ct); }
    if (p.url) { var u = h('p', 'url', p.url); u.setAttribute('data-hit', 'url'); box.appendChild(u); }
    if (p.contact) box.appendChild(h('p', 'contact', p.contact));
    if (box.children.length) card.appendChild(box);
    el.appendChild(card);
    // sweep: covers from the left, then uncovers to the right (0.9 s, brand primary)
    var e = S.ease('move');
    tl.fromTo(sweep, { clipPath: 'inset(0% 100% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.45, ease: e, immediateRender: true }, at)
      .to(sweep, { clipPath: 'inset(0% 0% 0% 100%)', duration: 0.45, ease: e }, at + 0.45)
      .call(c.audio.cue, ['chime'], at + 0.6);
    S.preset('blur-in', tl, mark, at + 0.6);
    if (box.children.length) {
      S.preset('scale-in', tl, box, at + 0.6 + S.durOf('blur-in') * S.choreography.nextBeatAtLeadFraction);
      var restAt = at + 0.8 + S.durOf('blur-in') * S.choreography.nextBeatAtLeadFraction;
      if (SL && ct) {
        paint = SL.reveal(c, ct, restAt);
        S.preset('rise-stagger', tl, Array.prototype.filter.call(box.children, function (n) { return n !== ct; }), restAt);
      } else S.preset('rise-stagger', tl, box.children, restAt);
    }
    var out = { rig: card, camera: 'hold' };
    if (paint) { out.render = function () { paint(); }; out.render.idle = paint; }
    return out;
  };
})();
