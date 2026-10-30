/**
 * @ddx       registry
 * @domain    misc
 * @topic     engine
 * @purpose   Emphasis, fill, loop, 3D and camera cue types for cue-runtime.js — sweep, draw-path, fills, pulses, motion-bits cards, flip, parallax, ken-burns, viewport-zoom and marquee.
 * @status    reusable
 */
/* Load after cue-runtime.js. Each defineTypes() group is one small factory. */

/* ---- emphasis + fills ---- */
window.DDXCue.defineTypes(function (L) {
  'use strict';
  var ease = L.ease;
  function highlightColor(c) {
    return c === 'coral' ? 'var(--coral, #ff6b35)' : c === 'accent' ? 'var(--accent)'
      : c === 'teal' ? 'var(--teal, #00d084)' : c === 'yellow' ? '#ffe066' : c;
  }
  return {
    // Two CSS contracts: capture anim.css (.anim-highlight, --sweep 0..1),
    // deck deck-anim.css (.anim-sweep, --sweep 0%..100%).
    'highlight-sweep': {
      dur: 0.5, prime: false,
      setup: function (el, p) {
        if (p.flavor !== 'capture') return;
        el.classList.add('anim-highlight');
        if (p.color) el.style.setProperty('--anim-highlight-color', highlightColor(p.color));
        if (p.opacity != null) el.style.setProperty('--anim-highlight-opacity', String(p.opacity));
      },
      apply: function (el, t, p) {
        var k = ease(p.easing, t / p.dur);
        if (p.flavor === 'capture') { el.style.setProperty('--sweep', String(k)); return; }
        el.classList.add('anim-sweep');
        el.style.setProperty('--sweep', (k * 100).toFixed(1) + '%');
      }
    },
    'draw-path': {
      dur: 0.8,
      setup: function (el) { el.classList.add('anim-draw'); },
      apply: function (el, t, p) {
        if (el.__len === undefined) { try { el.__len = el.getTotalLength(); } catch (e) { el.__len = 0; } }
        if (!el.__len) return;
        el.style.strokeDasharray = el.__len;
        el.style.strokeDashoffset = (el.__len * (1 - ease(p.easing, t / p.dur))).toFixed(2);
      }
    },
    'arc-fill': {
      dur: 0.6, text: true, prime: false,
      apply: function (el, t, p) {
        var k = ease(p.easing, t / p.dur), target = p.to != null ? p.to : 100;
        el.style.setProperty('--fill', (target * k).toFixed(2) + '%');   // deck-anim.css
        el.style.setProperty('--arc', String(target * k));                // anim.css
        if (el.dataset.fillText) el.textContent = L.fmt(target * k, p.format, p.flavor) + (p.suffix || '');
      }
    },
    'progress-bar': {
      dur: 0.6,
      setup: function (el) { el.classList.add('rb-progress'); var f = el.querySelector('.rb-progress-fill'); if (f) f.style.width = '0%'; },
      nodes: function (el) { var f = el.querySelector('.rb-progress-fill'); return f ? [f] : []; },
      apply: function (el, t, p) {
        var fill = el.querySelector('.rb-progress-fill');
        if (fill) fill.style.width = ((p.to != null ? p.to : 100) * L.clamp01(ease(p.easing, t / Math.max(0.001, p.dur)))).toFixed(2) + '%';
      }
    }
  };
});

/* ---- loops + glow (pure functions of t modulo a period) ---- */
window.DDXCue.defineTypes(function (L) {
  'use strict';
  return {
    pulse: { dur: 0.6, prime: false, apply: function (el, t, p) {
      var per = p.period || 1.6, amt = p.amount != null ? p.amount : 0.04;
      L.compose(el, 'scale(' + (1 + amt * Math.sin(((t % per) / per) * Math.PI * 2)).toFixed(4) + ')');
    } },
    'spring-pulse': { dur: 0.6, prime: false, apply: function (el, t, p) {
      var period = p.period || 2, wobble = L.spring(((t % period) / period) * 1.2, p.damping || 8, 90, 1);
      L.compose(el, 'scale(' + (1 + (p.amount != null ? p.amount : 0.06) * (wobble - 1)).toFixed(4) + ')');
    } },
    shimmer: {
      dur: 0.6, prime: false,
      setup: function (el, p) { el.classList.add('rb-shimmer'); if (p.color) el.style.setProperty('--rb-shimmer-color', p.color); },
      apply: function (el, t, p) { var period = p.period || 2.4; el.style.setProperty('--rb-sweep', ((t % period) / period).toFixed(4)); }
    },
    'pop-glow': {
      dur: 0.6,
      setup: function (el, p) { if (p.glowColor) el.style.setProperty('--rb-glow', p.glowColor); },
      apply: function (el, t, p) {
        var k = L.spring((t / Math.max(0.001, p.dur)) * 1.4, p.damping || 10, 110, 1);
        var scaleFrom = p.scaleFrom != null ? p.scaleFrom : 0.82;
        var pulse = Math.max(0, 1 - Math.abs(k - 1) * 2.2);
        L.compose(el, 'scale(' + (scaleFrom + (1 - scaleFrom) * Math.max(0, Math.min(1.15, k))).toFixed(4) + ')');
        el.style.filter = pulse > 0.01 ? 'drop-shadow(0 0 ' + (18 * pulse).toFixed(1) + 'px var(--rb-glow, oklch(0.75 0.12 200 / 0.9)))' : 'none';
      }
    }
  };
});

/* ---- motion-bits entrances ---- */
window.DDXCue.defineTypes(function (L) {
  'use strict';
  var ease = L.ease, clamp01 = L.clamp01;
  return {
    'wipe-in': { dur: 0.6, apply: function (el, t, p) {
      var k = clamp01(ease(p.easing, t / Math.max(0.001, p.dur)));
      if (k >= 1) { el.style.clipPath = 'none'; return; }
      var soft = p.soft != null ? p.soft : 8, r = 100 - clamp01(k * (100 + soft) / 100 - soft / 100) * 100;
      el.style.clipPath = ({ right: 'inset(0 0 0 ' + r + '%)', top: 'inset(' + r + '% 0 0 0)', bottom: 'inset(0 0 ' + r + '% 0)' })[p.from] || 'inset(0 ' + r + '% 0 0)';
    } },
    'glass-card': {
      dur: 0.6,
      setup: function (el, p) {
        el.classList.add('rb-glass');
        if (p.tint) el.style.setProperty('--rb-tint', p.tint);
        if (p.blur != null) el.style.setProperty('--rb-blur', p.blur + 'px');
      },
      apply: function (el, t, p) {
        var k = clamp01(ease(p.easing, (t - (p.delaySelf || 0)) / Math.max(0.001, p.dur)));
        var rise = p.rise != null ? p.rise : 24, scaleFrom = p.scaleFrom != null ? p.scaleFrom : 0.96;
        el.style.opacity = String(k);
        L.compose(el, 'translateY(' + ((1 - k) * rise).toFixed(2) + 'px) scale(' + (1 - (1 - k) * (1 - scaleFrom)).toFixed(4) + ')');
      }
    },
    'pop-chip': {
      dur: 0.6,
      setup: function (el, p) { el.classList.add('rb-chip'); if (p.accent) el.style.setProperty('--rb-chip-accent', p.accent); },
      apply: function (el, t, p) {
        var local = t - (p.delaySelf || 0), durS = Math.max(0.001, p.dur);
        var k = p.overshoot === false ? ease(p.easing, local / durS) : L.spring((Math.max(0, local) / durS) * 1.5, 11, 130, 1);
        var d = p.distance != null ? p.distance : 32, from = p.from || 'bottom', kc = clamp01(k), inv = 1 - kc;
        var dx = from === 'left' ? -d * inv : from === 'right' ? d * inv : 0;
        var dy = from === 'top' ? -d * inv : from === 'bottom' ? d * inv : 0;
        el.style.opacity = String(clamp01(k * 2));
        L.compose(el, 'translate(' + dx.toFixed(2) + 'px,' + dy.toFixed(2) + 'px) scale(' + (0.85 + 0.15 * kc).toFixed(4) + ')');
      }
    },
    'gradient-wipe': {
      dur: 0.6,
      setup: function (el, p) {
        el.classList.add('rb-wipe');
        if (p.angle != null) el.style.setProperty('--rb-wipe-angle', p.angle + 'deg');
        if (p.color) el.style.setProperty('--rb-wipe-color', p.color);
      },
      apply: function (el, t, p) {   // cover -> hold -> uncover
        var dur = Math.max(0.001, p.dur), hold = p.hold != null ? p.hold : 0.15, total = dur * 2 + hold;
        var tc = Math.max(0, Math.min(t, total));
        var k = tc < dur ? ease(p.easing, tc / dur) : tc < dur + hold ? 1 : 1 - ease(p.easing, (tc - dur - hold) / dur);
        el.style.setProperty('--rb-wipe-pos', String(clamp01(k)));
        el.style.opacity = tc >= total ? '0' : '1';
      }
    }
  };
});

/* ---- 3D + layered ---- */
window.DDXCue.defineTypes(function (L) {
  'use strict';
  return {
    'flip-card': {
      dur: 0.8,
      setup: function (el) {
        el.style.transformStyle = 'preserve-3d';
        el.style.perspective = '1400px';
        var back = el.querySelector('.face-back'), front = el.querySelector('.face-front');
        if (back) { back.style.transform = 'rotateY(180deg)'; back.style.backfaceVisibility = 'hidden'; }
        if (front) front.style.backfaceVisibility = 'hidden';
      },
      apply: function (el, t, p) { L.compose(el, 'rotateY(' + (180 * L.ease(p.easing, Math.min(t / p.dur, 1))).toFixed(3) + 'deg)'); }
    },
    // Moves by a fraction of SLIDE progress (t / slideDurMs), not its own window.
    'parallax-layer': { dur: 4.0, prime: false, apply: function (el, t, p) {
      var prog = L.clamp01(t / ((p.slideDurMs || 5000) / 1000)), depth = p.depth != null ? p.depth : 0.5;
      var dx = (p.x != null ? p.x : 60) * (1 - depth) * prog, dy = (p.y != null ? p.y : 0) * (1 - depth) * prog;
      L.compose(el, 'translate(' + dx.toFixed(2) + 'px,' + dy.toFixed(2) + 'px) scale(' + (1 + (p.zoom || 0) * prog).toFixed(4) + ')');
      if (p.fade) el.style.opacity = String(Math.min(t / Math.max(0.001, p.fadeIn || 0.6), 1));
    } },
    'ken-burns': {
      dur: 3.0, prime: false,
      setup: function (el) { el.classList.add('anim-kenburns'); },
      apply: function (el, t, p) {
        var a = p.from || { x: 0, y: 0, w: 100, h: 100 }, b = p.to || { x: 20, y: 15, w: 65, h: 65 };
        var k = L.ease(p.easing, t / p.dur);
        var w = a.w + (b.w - a.w) * k, x = a.x + (b.x - a.x) * k, y = a.y + (b.y - a.y) * k;
        L.compose(el, 'scale(' + (100 / w).toFixed(4) + ') translate(' + (-x).toFixed(2) + '%,' + (-y).toFixed(2) + '%)');
      }
    }
  };
});

/* ---- viewport-zoom: camera push (deck-anim 2026-09-18 rewrite) — target
   measured on the restored frame, translate-then-scale about the centre,
   data-depth parallax layers, clipped by its pane. ---- */
window.DDXCue.defineTypes(function (L) {
  'use strict';
  function zoomHost(el) {
    var root = el.closest('.slide, .stage') || document.body;
    return root.querySelector('.zoom-layer') || root;
  }
  function curve(t, p) {
    var hold = p.hold != null ? p.hold : 1.0, inD = p.dur, outD = p.outDur || inD, k;
    if (t < inD) k = L.ease(p.easing, t / inD);
    else if (t < inD + hold) k = 1;
    else if (t < inD + hold + outD) k = 1 - L.ease('ease-in-out', (t - inD - hold) / outD);
    else k = 0;
    k = L.clamp01(k);
    return k < 0.01 ? 0 : k;   // snap the asymptotic tail home
  }
  function layers(host, g, k, scale) {   // depth 0 = locked to frame, 1 = full push
    host.querySelectorAll('[data-depth]').forEach(function (lay) {
      var d = parseFloat(lay.getAttribute('data-depth'));
      if (isNaN(d)) return;
      var inv = 1 - d;
      L.compose(lay, 'translate(' + (g.dx * k * scale * inv).toFixed(2) + 'px,' + (g.dy * k * scale * inv).toFixed(2) + 'px) scale(' + (1 / (1 + (scale - 1) * inv)).toFixed(4) + ')');
    });
  }
  return {
    'viewport-zoom': {
      dur: 1.2, prime: false,
      nodes: function (el) {
        var host = zoomHost(el), out = [host];
        if (host.parentElement) out.push(host.parentElement);
        return out.concat(Array.from(host.querySelectorAll('[data-depth]')));
      },
      // Runs on the RESTORED frame, so the cache never depends on which t measured it.
      measure: function (el) {
        var host = zoomHost(el);
        if (el.__vz && el.__vzHost === host) return;
        var hb = host.getBoundingClientRect(), tb = el.getBoundingClientRect();
        if (!hb.width || !tb.width) return;
        el.__vzHost = host;
        el.__vz = { dx: (tb.left + tb.width / 2) - (hb.left + hb.width / 2), dy: (tb.top + tb.height / 2) - (hb.top + hb.height / 2) };
      },
      apply: function (el, t, p) {
        var host = zoomHost(el), k = curve(t, p);
        if (!el.__vz || el.__vzHost !== host) return;   // measure() found no box
        host.classList.add('zoom-host', 'anim-viewport-zoom-root');
        if (host.parentElement) host.parentElement.classList.add('zoom-pane');
        if (k <= 0.001) return;   // the restored snapshot IS the home frame
        var g = el.__vz, scale = 1 + ((p.scale || 2.0) - 1) * k;
        host.style.transformOrigin = '50% 50%';
        host.style.transform = 'translate(' + (-g.dx * k * scale).toFixed(2) + 'px,' + (-g.dy * k * scale).toFixed(2) + 'px) scale(' + scale.toFixed(4) + ')';
        layers(host, g, k, scale);
      }
    }
  };
});

/* ---- marquee: deck-anim's duplicated track (px/s `speed`), or the
   motion-bits `period` form (half-track per period) when only period is set. ---- */
window.DDXCue.defineTypes(function () {
  'use strict';
  return {
    marquee: {
      dur: 0.6, prime: false,
      setup: function (el) {
        if (el.__track) return;
        el.classList.add('anim-marquee');
        var inner = el.querySelector('.mq-track');
        if (!inner) {
          inner = document.createElement('div');
          inner.className = 'mq-track';
          while (el.firstChild) inner.appendChild(el.firstChild);
          el.appendChild(inner);
        }
        if (!inner.dataset.doubled) { inner.dataset.doubled = '1'; inner.innerHTML = inner.innerHTML + inner.innerHTML; }
        el.__track = inner;
      },
      nodes: function (el) { return el.__track ? [el.__track] : []; },
      apply: function (el, t, p) {
        var track = el.__track;
        if (!track) return;
        if (p.speed == null && p.period != null) {
          track.style.transform = 'translateX(' + (-((t % p.period) / p.period) * 50).toFixed(3) + '%)';
          return;
        }
        var half = track.scrollWidth / 2;
        if (half) track.style.transform = 'translateX(' + (((t * (p.speed || 60)) % half) * (p.direction === 'right' ? 1 : -1)).toFixed(2) + 'px)';
      }
    }
  };
});
