/* preset: card-grid — studio card-grid (kit/patterns/card-grid.mjs): up to eight elevated cards
   (shade + elevation, no borders — Rule 1) ASSEMBLE in a stagger; each card's number badge
   scales in after its card.
   params: cards (required, [{ title, text?, src?, imgFit?, stat?, tag?, hi? }], 1..8; 7-8 cards = 4 columns x 2 rows), kicker?, title?,
     num? (v5.5) false = no number badge (cards whose tag would share the badge's top row)
     src      a picture. Default = a 16:9 strip cropped to the card top (imgFit 'cover').
     imgFit   'contain' = the WHOLE portrait page on a paper-white mat, no crop (a page image, v2); the card
              turns into a media + copy pair, the page takes the height the safe zone leaves (5-6 cards: 2 rows, page left of its copy, >= 300 px at 1920; 1-4 cards: one row, page above its copy)
     stat     a large tabular figure line, e.g. "12 items" (shown under the title). Keep it short; a stat over 14
              characters drops to title size and wraps inside the card (never overflows). A sentence belongs in text.
     tag      a small label chip above the title, e.g. "Photographed"
     hi       true = the card starts highlighted (ring); fx.highlight / fx.cursor can target card-N too
     icon     (v6, owner 2026-10-29) a Lucide name from window.MOTION_ICONS (site/icons.js topic set, e.g. 'stethoscope',
              'inbox', 'message-circle-more', 'clipboard-pen-line'): a tinted icon tile in the card's head row beside the tag;
              it pops in after its card lands. An unknown name is skipped (no broken tile).
   hits: card-1 … card-8 */
(function () {
  'use strict';
  (window.PRESETS = window.PRESETS || {})['card-grid'] = function (c) {
    var p = c.p, el = c.el, at = c.at, tl = c.tl, S = c.S, h = c.h;
    el.classList.add('stack');
    var col = c.textCol(el, p), grid = h('div', 'cards visual'), cards = [], badges = [], icons = [], ICONS = window.MOTION_ICONS || {};
    var list = (p.cards || []).slice(0, 8);
    var pages = list.some(function (x) { return x.src && x.imgFit === 'contain'; });
    if (pages) { grid.classList.add('cards--pages'); if (list.length <= 4) grid.classList.add('cards--one'); grid.style.setProperty('--rows', list.length <= 4 ? '1' : '2'); }
    grid.style.setProperty('--cols', String(list.length > 6 ? 4 : list.length > 4 ? 3 : list.length));
    if (list.length > 6) grid.classList.add('cards--four');
    list.forEach(function (x, k) {
      var cd = h('article', 'card' + (x.hi ? ' is-hi' : '')); cd.setAttribute('data-hit', 'card-' + (k + 1));
      var page = x.src && x.imgFit === 'contain';
      var tx = cd;
      if (page) {
        cd.classList.add('has-page');
        var media = h('div', 'card-media'), mat = h('div', 'card-page');
        mat.appendChild(c.FX.image(x.src, 'card-pg', x.alt || ''));
        media.appendChild(mat); cd.appendChild(media);
        tx = h('div', 'card-tx'); cd.appendChild(tx);
      } else if (x.src) { cd.classList.add('has-img'); cd.appendChild(c.FX.image(x.src, 'card-img', '')); }
      var b = p.num === false ? null : h('i', 'card-num', String(k + 1).padStart(2, '0')); if (b) cd.appendChild(b); // v5.5 num: false = no badge
      var ico = x.icon && ICONS[x.icon] ? h('i', 'card-ico') : null;
      if (ico) { ico.innerHTML = ICONS[x.icon]; icons.push(ico); }
      if (ico || x.tag) {
        var head = h('div', 'card-head');
        if (ico) head.appendChild(ico);
        if (x.tag) head.appendChild(h('span', 'card-tag', x.tag));
        tx.appendChild(head);
      }
      tx.appendChild(h('h3', null, x.title));
      if (x.stat) tx.appendChild(h('p', 'card-stat' + (String(x.stat).length > 14 ? ' is-long' : ''), x.stat)); // a long stat wraps at title size (owner fix 2026-10-18)
      if (x.text) tx.appendChild(h('p', null, x.text));
      grid.appendChild(cd); cards.push(cd); if (b) badges.push(b);
    });
    el.appendChild(grid);
    var next = c.headIn(tl, col, at), g = Math.min(0.35, Math.max(0.06, (c.dur * 0.4) / Math.max(1, list.length)));
    c.FX.riseSolid(tl, cards, next, g); // v2 (D-026): cards arrive opaque in 0.28 s and travel on y - no ghost card mid-stagger
    if (badges.length) S.preset('scale-in', tl, badges, next + 0.2, { stagger: g });
    if (icons.length && !S.reduced) tl.fromTo(icons, { scale: 0.3, rotate: -35, opacity: 0 }, { scale: 1, rotate: 0, opacity: 1, duration: 0.55, ease: 'back.out(2.2)', stagger: g, immediateRender: true }, next + 0.22);
    // v5.3 scroll-up (owner 2026-10-27: "motion up scrolling up to render the bottom cards"): when the grid runs past the
    // caption band, the whole scene glides up once the first row has been read (40 % → 62 % of the unit, or p.scrollAt
    // [from, to] as fractions), so the second row comes into view. The overflow is measured from LAYOUT offsets
    // (unaffected by the camera transform) on the first painted frame and cached — same t, same frame.
    var over = null, sA = (p.scrollAt && p.scrollAt[0]) || 0.4, sB = (p.scrollAt && p.scrollAt[1]) || 0.62;
    function measure() {
      var stage = document.getElementById('stage'); if (!stage || !grid.offsetHeight) return null;
      var y = 0; for (var n = grid; n && n !== stage; n = n.offsetParent) y += n.offsetTop;
      var safe = stage.clientHeight * 0.83; // keep clear of the caption band
      return Math.max(0, y + grid.offsetHeight - safe);
    }
    function render(local) {
      if (over === null) over = measure();
      if (!over || S.reduced) { el.style.translate = over && S.reduced ? '0 ' + (-over).toFixed(1) + 'px' : ''; return; }
      var q = Math.min(1, Math.max(0, (local / c.dur - sA) / (sB - sA))), e = q < 0.5 ? 4 * q * q * q : 1 - Math.pow(-2 * q + 2, 3) / 2;
      el.style.translate = '0 ' + (-over * e).toFixed(1) + 'px';
    }
    // the runtime lifts the chapter strap out for the scroll window (and back at the beat's end) when this grid can overflow:
    // 7+ cards, or 5-6 cards with photos (two rows of 16:9 strips) — measured overflow 0 simply means no scroll and the
    // strap leaves only if the window is declared, so declare it only when overflow is likely
    var likely = list.length > 6 || (list.length > 4 && list.some(function (x) { return x.src && x.imgFit !== 'contain'; }));
    return { rig: grid, camera: 'breathe', render: render, away: likely ? { from: at + c.dur * sA, to: at + c.dur * sB, end: at + c.dur } : null };
  };
})();
