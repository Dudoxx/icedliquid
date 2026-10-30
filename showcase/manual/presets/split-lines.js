/* preset: split-lines — a headline that reveals LINE BY LINE through a real SplitText line mask
   (SplitText 3.13+: mask 'lines', autoSplit, onSplit). The split runs AFTER document.fonts.ready,
   so the line breaks are the final ones (a split before the web font loads measures the fallback
   face and wraps wrong). Also the engine behind `split: 'lines'` on headline, quote and endcard
   (window.SPLIT_LINES.reveal).
   Seek purity: the timeline owns ONE proxy tween (p 0 -> 1 over the reveal window); the line
   transforms are painted from p by render(t). A re-split (fonts, a real width change) only swaps
   the line nodes and repaints from the same p, so a seek before, during or after a re-split lands
   on the same frame. Reduced motion: no split, the final text.
   params: text (required), kicker?, accent? (a word → marker highlight), tag? h1 | h2 | p (default h1)
   hits: text
   @vendor gsap/SplitText.min.js
 */
(function () {
  'use strict';
  // Same picture as the studio line-mask (studio.js masked()): part capped at MASK_MAX s on the
  // 'out' curve, faded over its first 55 %, descender room on the mask box while it clips.
  var GAP = 0.08, SPREAD = 0.24, MASK_MAX = 0.55, FADE = 0.55, PAD = '0.16em', PAD_T = '0.06em';
  function clamp(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function strip(x) { return String(x || '').replace(/[.,!?;:…»«"]+/g, ''); }
  function esc(s) { return window.CSS && CSS.escape ? CSS.escape(s) : s; }

  // reveal(c, el, at) → paint() for the preset's render(t), or null (reduced motion / no SplitText).
  // Inline children with a class (accent word, quote mark) keep their node identity across re-splits,
  // so a highlight registered on them before the split keeps measuring the live node.
  function reveal(c, el, at) {
    var S = c.S, tl = c.tl;
    if (!el) return null;
    if (S.reduced) return null; // reduced motion: no split, the final text, no animation
    if (!window.SplitText) { S.preset('line-mask', tl, el, at); return null; } // studio fallback (plain rise)
    var dm = Math.min(S.durOf('line-mask'), MASK_MAX), W = dm + SPREAD;
    var ez = gsap.parseEase(S.ease('out'));
    var proxy = { p: 0 }, lines = [], masks = [], parked = [], st = null;
    var keep = Array.prototype.slice.call(el.querySelectorAll('[class]')).filter(function (k) { return !/\bhl-/.test(k.className); });
    tl.fromTo(proxy, { p: 0 }, { p: 1, duration: W, ease: 'none', immediateRender: true }, at);

    function paint() {
      var tau = proxy.p * W, n = lines.length;
      if (!n) { el.style.opacity = String(clamp(tau / (dm * FADE))); return; } // not split yet (fonts pending)
      var gap = n > 1 ? Math.min(GAP, SPREAD / (n - 1)) : 0, done = proxy.p >= 1;
      for (var i = 0; i < n; i++) {
        var q = clamp((tau - i * gap) / dm), s = lines[i].style;
        s.transform = q >= 1 ? '' : 'translate3d(0,' + (100 * (1 - ez(q))).toFixed(3) + '%,0)';
        s.opacity = q >= 1 ? '' : String(clamp(q / FADE));
      }
      for (var k = 0; k < masks.length; k++) masks[k].style.overflow = done ? 'visible' : 'clip';
    }
    // A studio highlight layer (<i class="hl-layer">) is attached lazily to the host; park it outside
    // the split so SplitText never wraps or snapshots it, put it back after.
    function park() {
      Array.prototype.slice.call(el.querySelectorAll('.hl-layer')).forEach(function (l) { l.parentNode.removeChild(l); parked.push(l); });
    }
    function after(self) {
      keep.forEach(function (k) {
        var cls = k.classList[0]; if (!cls) return;
        var nn = el.querySelectorAll('.' + esc(cls));
        if (nn.length === 1 && nn[0] !== k) nn[0].parentNode.replaceChild(k, nn[0]);
      });
      lines = Array.prototype.slice.call(self.lines || []);
      masks = Array.prototype.slice.call(self.masks || []);
      masks.forEach(function (m) { m.style.paddingBottom = PAD; m.style.marginBottom = '-' + PAD; m.style.paddingTop = PAD_T; m.style.marginTop = '-' + PAD_T; });
      while (parked.length) el.appendChild(parked.shift());
      el.style.opacity = '';
      paint();
    }
    function split() {
      if (st) return;
      park();
      // deepSlice false: a marked phrase that wraps stays ONE node (its line box holds both rows), so
      // its highlight keeps a live root. autoSplit: SplitText re-splits on a real width change and on
      // a late font load (200 ms settle), calling onRevert / onSplit around it.
      st = window.SplitText.create(el, { type: 'lines', mask: 'lines', deepSlice: false, autoSplit: true, onRevert: park, onSplit: after });
    }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(split, split);
    else setTimeout(split, 0);
    paint();
    return paint;
  }
  window.SPLIT_LINES = { reveal: reveal, MASK_MAX: MASK_MAX, SPREAD: SPREAD };

  (window.PRESETS = window.PRESETS || {})['split-lines'] = function (c) {
    var p = c.p, el = c.el, at = c.at, tl = c.tl, S = c.S, h = c.h;
    var tag = p.tag === 'h2' || p.tag === 'p' ? p.tag : 'h1';
    var col = h('div', 'col-text intro-copy');
    if (p.kicker) { var eb = h('p', 'kicker eyebrow'); eb.appendChild(h('span', 'eyebrow-rule')); eb.appendChild(h('span', 'eyebrow-text', p.kicker)); col.appendChild(eb); }
    var txt = h(tag, tag === 'h1' ? 'headline' : tag === 'h2' ? 'title' : 'hook'), accent = null;
    txt.setAttribute('data-hit', 'text');
    String(p.text || '').split(/(\s+)/).forEach(function (w) {
      if (p.accent && !accent && strip(w) === strip(p.accent)) { accent = h('span', 'accent', w); txt.appendChild(accent); }
      else txt.appendChild(document.createTextNode(w));
    });
    col.appendChild(txt);
    el.appendChild(col);
    if (p.kicker) { S.preset('bar-grow', tl, col.querySelector('.eyebrow-rule'), at + 0.1, { axis: 'x' }); S.preset('clip-wipe', tl, col.querySelector('.eyebrow-text'), at + 0.2); }
    var lead = at + (p.kicker ? 0.35 : S.ENTER.headStart);
    if (accent) S.preset('highlight', tl, accent, lead + S.durOf('line-mask'));
    var paint = reveal(c, txt, lead);
    var out = { rig: col, camera: 'breathe' };
    if (paint) { out.render = function () { paint(); }; out.render.idle = paint; } // idle: runtime calls it outside the chapter window, so the lines stay a pure function of t
    return out;
  };
})();
