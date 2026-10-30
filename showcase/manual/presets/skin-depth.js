/* support: skin-depth — motion half of the depth skin (piece.skin = "depth"; the runtime calls
   window.SKIN.decorate(ctx, host) after every preset run). Depth is shown, not painted: each container LIFTS from
   elev-1 to its resting elevation as it lands, cards tilt in from depth and sway slowly, card photos drift.
   Brand easing (cubic-bezier 0.16,1,0.3,1). Every tween sits on the master timeline (seek-pure).
   Reduced motion: resting state only.
   © Dudoxx UG / Acceleate Consulting - Walid Boudabbous <walid@acceleate.com> */
(function () {
  'use strict';
  document.documentElement.classList.add('skin-depth');
  var SEL = '.card, .kpi-tile, .cta-card, .big, .mk-frame';
  function decorate(c, host) {
    var tl = c.tl, at = c.at, D = c.dur, set = [];
    if (c.S.reduced) return;
    host.querySelectorAll(SEL).forEach(function (n) { if (!n.__skin) { n.__skin = 1; set.push(n); } });
    var ease = 'cubic-bezier(0.16,1,0.3,1)';
    set.forEach(function (n, k) {
      var t0 = at + 0.45 + k * 0.14, card = n.classList.contains('card') || n.classList.contains('kpi-tile');
      // v6 (2026-10-29): the boxShadow LOW -> rest tween is gone. The rest shadows are oklch, which GSAP cannot
      // interpolate: mid-tween frames painted garbage-coloured ghost blocks (owner screenshots, ToC cards).
      if (!card) return;
      tl.fromTo(n, { rotateX: 18, transformPerspective: 1400 }, { rotateX: 0, duration: 0.9, ease: ease, immediateRender: true }, t0 - 0.15);
      tl.fromTo(n, { rotateY: k % 2 ? 1.6 : -1.6 }, { rotateY: k % 2 ? -1.6 : 1.6, duration: Math.max(1, D - 0.6), ease: 'sine.inOut', immediateRender: true }, at + 0.6);
      var img = n.querySelector('.card-img');
      if (img) tl.fromTo(img, { scale: 1.02 }, { scale: 1.1, duration: D, ease: 'none', immediateRender: true }, at);
    });
  }
  window.SKIN = { name: 'depth', decorate: decorate };
})();
