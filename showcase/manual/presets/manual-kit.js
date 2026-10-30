/* support: manual-kit — the shared screen frame, timing helpers and UI words for the tutorial presets
   (ui-tour · click-path · step-rail · form-fill · record-wave · doc-forge). Carries manual-kit.css.
   © Dudoxx UG / Acceleate Consulting - Walid Boudabbous <walid@acceleate.com>

   window.MANUAL_KIT = {
     screen(c, p, opts) -> { frame, view, pan, img, layer, place(node, x, y, w?, h?), ratio }
         a macOS-style window (traffic lights + `window` title; `urlBar: true` = old URL pill) holding ONE real capture (p.src); children are placed in IMAGE percent, so a
         hotspot stays on its button at any stage size. opts.maxW / opts.maxH in cqw (defaults 58 / 33).
     times(items, from, to) -> [s]   item.at (unit seconds) wins; the rest spread evenly over [from, to]
     zoomTo(c, pan, rect, zoom, at, d, max?) pans + scales the capture so rect {x,y,w?,h?} (image %) sits centred,
         clamped so no empty edge shows; seek-pure (timeline tween); reduced motion = no move; zoom cap = max (default 2.6)
     words(c) -> { recording, stopped, transcribing, drafted, saved, total, signed, step, … } for c.lang;
         a param `words` map overrides any key (the piece owns its vocabulary, no hard-coded copy)
     active(ts, local) -> index of the last time <= local (-1 before the first)
     cursor(c, sc, stops) -> paint(local): a virtual pointer in image % that travels (arc) and clicks (ripple) per stop
   }
   Reduced motion: every preset that uses the kit shows its END state (all hotspots, filled fields, the
   finished document) — the kit only ever adds motion on top of a complete, readable frame. */
(function () {
  'use strict';
  var WORDS = {
    en: { recording: 'Recording', stopped: 'Stopped', transcribing: 'Transcribing', drafted: 'Draft ready', saved: 'Saved',
      total: 'Total', signed: 'Signed', step: 'Step', of: 'of', live: 'LIVE', you: 'You are here', done: 'Done' },
    de: { recording: 'Aufnahme', stopped: 'Gestoppt', transcribing: 'Transkription', drafted: 'Entwurf bereit', saved: 'Gespeichert',
      total: 'Summe', signed: 'Signiert', step: 'Schritt', of: 'von', live: 'LIVE', you: 'Sie sind hier', done: 'Fertig' },
    fr: { recording: 'Enregistrement', stopped: 'Arrêté', transcribing: 'Transcription', drafted: 'Brouillon prêt', saved: 'Enregistré',
      total: 'Total', signed: 'Signé', step: 'Étape', of: 'sur', live: 'EN DIRECT', you: 'Vous êtes ici', done: 'Terminé' },
    es: { recording: 'Grabando', stopped: 'Detenido', transcribing: 'Transcribiendo', drafted: 'Borrador listo', saved: 'Guardado',
      total: 'Total', signed: 'Firmado', step: 'Paso', of: 'de', live: 'EN VIVO', you: 'Está aquí', done: 'Listo' }
  };
  function words(c) {
    var out = {}, k, base = WORDS.en, loc = WORDS[c.lang] || {}, over = (c.p && c.p.words) || {};
    for (k in base) out[k] = base[k];
    for (k in loc) out[k] = loc[k];
    for (k in over) out[k] = over[k];
    return out;
  }
  function ratioOf(p) {
    var a = String(p._aspect || p.aspect || '16/10').split('/');
    var r = Number(a[0]) / Number(a[1] || 1);
    return isFinite(r) && r > 0 ? r : 1.6;
  }
  // v6 (owner 2026-10-29): the macOS window chrome (traffic lights + a per-topic title) is retired as "ugly"; the
  // capture now sits in a 3D LAPTOP — a dark bezel lid (camera dot, faint glass reflection) over a porcelain base deck.
  // The frame stays the stage-camera rig (2D); the 3D pose lives on the inner lid, so the camera never fights it.
  // Hotspots, pins and the cursor live in the capture layer inside the lid: they tilt with it and stay on their control.
  // p.chrome === false keeps a bare frame (no device).
  var PAD = 0.8, CHIN = 0.5, BASE = 1.2; // cqw — bezel, extra bottom bezel, base deck height
  function screen(c, p, opts) {
    var h = c.h, o = opts || {}, ratio = ratioOf(p), laptop = p.chrome !== false;
    var maxW = o.maxW || 58, maxH = (o.maxH || 33) - (laptop ? 2 * PAD + CHIN + BASE + 0.6 : 0);
    var w = Math.min(maxW - (laptop ? 2 * PAD : 0), maxH * ratio);
    var frame = h('div', 'mk-frame visual' + (laptop ? ' mk-laptop' : '') + (o.cls ? ' ' + o.cls : ''));
    frame.setAttribute('data-hit', 'screen');
    frame.style.width = (w + (laptop ? 2 * PAD : 0)).toFixed(2) + 'cqw';
    var view = h('div', 'mk-view'), pan = h('div', 'mk-pan'), layer = h('div', 'mk-layer');
    view.style.height = (w / ratio).toFixed(2) + 'cqw';
    var img = document.createElement('img');
    img.className = 'mk-img'; img.alt = p.alt || ''; img.decoding = 'async'; img.draggable = false;
    if (p.src) img.src = p.src;
    pan.appendChild(img); pan.appendChild(layer); view.appendChild(pan);
    if (laptop) {
      var device = h('div', 'mk-device'), lid = h('div', 'mk-lid');
      lid.appendChild(h('i', 'mk-cam')); lid.appendChild(view); lid.appendChild(h('i', 'mk-glass'));
      device.appendChild(lid); device.appendChild(h('i', 'mk-base')); frame.appendChild(device);
      if (!c.S.reduced && c.tl) {
        // three-quarter pose: the screen turns toward the notes column (ui-tour side: notes left -> turn left), swings in
        // from a deep turn, rests at ~8° turned + 5° tilted back, then sways a little around that pose
        var turn = p.side === 'right' ? 1 : -1;
        // the TURN is on the device (lid + base move as one body); only the tilt-back is on the lid (hinge at its foot)
        c.tl.fromTo(device, { rotateY: 30 * turn, z: -120 }, { rotateY: 8 * turn, z: 0, duration: 1.8, ease: 'power3.out', immediateRender: true }, c.at + 0.1);
        c.tl.fromTo(lid, { rotateX: 24 }, { rotateX: 5, duration: 1.8, ease: 'power3.out', immediateRender: true }, c.at + 0.1);
        if (c.dur > 3) c.tl.fromTo(device, { rotateY: 8 * turn }, { rotateY: 5 * turn, duration: c.dur - 2, ease: 'sine.inOut', immediateRender: false }, c.at + 1.9);
      }
    } else frame.appendChild(view);
    function place(node, x, y, ww, hh) {
      node.style.left = x + '%'; node.style.top = y + '%';
      if (ww != null) node.style.width = ww + '%';
      if (hh != null) node.style.height = hh + '%';
      layer.appendChild(node);
      return node;
    }
    return { frame: frame, view: view, pan: pan, img: img, layer: layer, place: place, ratio: ratio, w: w };
  }
  function times(items, from, to) {
    var free = items.filter(function (x) { return !(x && typeof x.at === 'number'); }).length, k = 0;
    var gap = free > 1 ? (to - from) / (free - 1) : 0;
    return items.map(function (x) {
      if (x && typeof x.at === 'number') return x.at;
      var t = free > 1 ? from + gap * k : from; k++;
      return t;
    });
  }
  function zoomTo(c, pan, r, z, at, d, max) {
    if (c.S.reduced) return;
    z = Math.max(1, Math.min(z || 1.5, max || 2.6)); // max (v5.5): only an explicit ui-tour `view` raises the cap (<= 3.4)
    var cx = r.x + (r.w || 0) / 2, cy = r.y + (r.h || 0) / 2;
    var tx = Math.max(100 - 100 * z, Math.min(0, 50 - z * cx)), ty = Math.max(100 - 100 * z, Math.min(0, 50 - z * cy));
    if (z === 1) { tx = 0; ty = 0; }
    c.tl.to(pan, { scale: z, xPercent: tx, yPercent: ty, transformOrigin: '0% 0%', duration: d || 0.9, ease: c.S.ease('cam') }, at);
  }
  function active(ts, local) {
    var k = -1;
    for (var i = 0; i < ts.length; i++) if (local >= ts[i]) k = i;
    return k;
  }
  // v5.1 virtual cursor INSIDE the capture layer (image %), so it rides the follow-zoom and stays on its control.
  // stops: [{ x, y, at (unit s, arrival), click? (default true) }]. Painted from local t; the arrow is counter-scaled
  // against the pan zoom so it keeps one size. Returns paint(local) or null (reduced motion = no cursor).
  function cursor(c, sc, stops) {
    if (c.S.reduced || !stops || !stops.length) return null;
    var h = c.h, cur = h('i', 'mk-cursor'), ring = h('i', 'mk-click');
    cur.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 2l15 11.2-6.6 1.1 3.9 7.4-3 1.6-3.9-7.5L4 20z"/></svg>';
    sc.layer.appendChild(ring); sc.layer.appendChild(cur);
    var start = { x: Math.min(96, stops[0].x + 18), y: Math.min(96, stops[0].y + 22) }, TRAVEL = 0.75;
    return function paint(local) {
      var from = start, x = start.x, y = start.y, clickK = 0, vis = local >= stops[0].at - TRAVEL - 0.3;
      for (var i = 0; i < stops.length; i++) {
        var s = stops[i], a = s.at - TRAVEL;
        if (local < a) break;
        var k = Math.min(1, (local - a) / TRAVEL), e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
        x = from.x + (s.x - from.x) * e; y = from.y + (s.y - from.y) * e - Math.sin(Math.PI * e) * 2.5;
        if (s.click !== false && local >= s.at) clickK = Math.max(0, 1 - (local - s.at) / 0.5);
        from = { x: s.x, y: s.y };
      }
      var z = (window.gsap && gsap.getProperty(sc.pan, 'scale')) || 1;
      cur.style.left = x.toFixed(2) + '%'; cur.style.top = y.toFixed(2) + '%';
      cur.style.transform = 'scale(' + (1 / z * (clickK > 0.55 ? 0.86 : 1)).toFixed(3) + ')';
      cur.style.opacity = vis ? '1' : '0';
      ring.style.left = x.toFixed(2) + '%'; ring.style.top = y.toFixed(2) + '%';
      ring.style.setProperty('--k', clickK.toFixed(3)); ring.style.setProperty('--z', (1 / z).toFixed(3));
    };
  }
  window.MANUAL_KIT = { screen: screen, times: times, zoomTo: zoomTo, words: words, active: active, ratioOf: ratioOf, cursor: cursor };
})();
