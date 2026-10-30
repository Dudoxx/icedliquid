/* preset: hub — one centre SLAMS in (scale-in, spring), spokes DRAW (studio draw 1.2 s), nodes
   follow in a stagger, then data packets FLOW out along every spoke (FX.travel, painted from t).
   params: center (required), nodes (required, 3..8), kicker?, title?, body?, packets? (per spoke, default 2),
           inbound? (true = packets flow to the centre),
           v2 packet options (all optional, defaults = today): packetLabels? ([caption per spoke] riding the dot),
           trail? (0..6 ghost dots), arrive? (accepted, no longer drawn: review round 1), packetRole? action | signal
   hits: center · node-1 … node-N */
(function () {
  'use strict';
  (window.PRESETS = window.PRESETS || {}).hub = function (c) {
    var p = c.p, el = c.el, at = c.at, tl = c.tl, S = c.S, FX = c.FX, h = c.h;
    var col = c.textCol(el, p);
    var nodes = p.nodes || [], N = nodes.length;
    var box = h('div', 'hub visual');
    var g = FX.svg('svg', { viewBox: '0 0 150 100', class: 'hub-svg', 'aria-hidden': 'true' });
    var cx = 75, cy = 50, RX = 52, RY = 37; // v2 (D-048): a 3:2 box, an ellipse of nodes; side nodes pin to the ground edges
    // D-056: side nodes are FIXED-width pills (13.5cqw, pinned 1.2cqw from the ground edge: see .hub-node.is-l / .is-r), so their
    // inner edge is known without measuring (seek-safe, no layout read): every spoke ends exactly on that edge.
    var BOX_CQW = 52, SIDE_W = 13.5, SIDE_PAD = 1.2, EDGE = (SIDE_PAD + SIDE_W) * 150 / BOX_CQW; // inner edge in viewBox units from the box side
    var pts = nodes.map(function (_, k) {
      var a = -Math.PI / 2 + k * 2 * Math.PI / N, c = Math.cos(a), x = cx + c * RX;
      if (c > 0.45) x = 150 - EDGE; else if (c < -0.45) x = EDGE;
      return { x: x, y: cy + Math.sin(a) * RY, c: c };
    });
    var spokes = pts.map(function (q) {
      var a = p.inbound ? q : { x: cx, y: cy }, b = p.inbound ? { x: cx, y: cy } : q;
      var l = FX.svg('path', { d: 'M' + a.x.toFixed(2) + ' ' + a.y.toFixed(2) + ' L' + b.x.toFixed(2) + ' ' + b.y.toFixed(2), class: 'spoke' });
      g.appendChild(l); return l;
    });
    box.appendChild(g);
    var hubEl = h('div', 'hub-center', p.center); hubEl.setAttribute('data-hit', 'center'); box.appendChild(hubEl);
    var labels = nodes.map(function (n, k) {
      var lab = h('span', 'hub-node', n); lab.setAttribute('data-hit', 'node-' + (k + 1));
      lab.style.top = pts[k].y + '%';
      // side nodes (left / right of the centre pill) pin to the ground edge and wrap to <= 13.5cqw, so a long label can
      // never slide under the centre pill; the spoke ends under the label. Top / bottom nodes stay centred on their point.
      if (pts[k].c > 0.45) lab.classList.add('is-r'); else if (pts[k].c < -0.45) lab.classList.add('is-l');
      else lab.style.left = (pts[k].x / 1.5).toFixed(2) + '%'; // top / bottom: centred on the spoke end
      box.appendChild(lab); return lab;
    });
    el.appendChild(box);
    var next = c.headIn(tl, col, at), t1 = next;
    S.preset('scale-in', tl, hubEl, t1, { ease: 'spring' });
    tl.call(c.audio.cue, ['impact'], t1);
    S.preset('draw', tl, spokes, t1 + 0.2);
    S.preset('scale-in', tl, labels, t1 + 0.2 + S.durOf('draw') * 0.7, { stagger: 0.06 });
    var flowAt = t1 + 0.2 + S.durOf('draw') + 0.2;
    tl.call(c.audio.cue, ['tick'], flowAt);
    var po = { start: flowAt, per: p.packets || 2, speed: 1 / S.durOf('flow') };
    if (p.packetLabels) { po.label = p.packetLabels; po.labelSize = 1.3; }
    if (p.trail) po.trail = p.trail;
    // `arrive` is accepted but no ring is drawn: the ring sat UNDER the pills and read as clipped arcs (R1-c-08 R1-e-04)
    if (p.packetRole) po.role = p.packetRole;
    var paint = FX.travel(g, spokes, po);
    return { rig: box, camera: 'breathe', render: function (_l, t) { paint(t); } };
  };
})();
