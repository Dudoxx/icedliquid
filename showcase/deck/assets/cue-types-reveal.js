/**
 * @ddx       registry
 * @domain    misc
 * @topic     engine
 * @purpose   Entrance and text cue types for cue-runtime.js — fades, slides, blur, genie, 3D rotate, iris, count-up, type-on, terminal chrome, text-reveal and odometer.
 * @status    reusable
 */
/* Load after cue-runtime.js. Each defineTypes() group is one small factory;
   every apply() is a pure function of local seconds on the restored DOM. */

/* ---- entrances (deck-anim implementations: scrub-safe, composing) ---- */
window.DDXCue.defineTypes(function (L) {
  'use strict';
  var ease = L.ease, compose = L.compose, setOpacity = L.setOpacity;
  function fadeSlide(el, t, dur, easing, from, dist) {
    var k = ease(easing, t / dur), inv = 1 - k, dx = 0, dy = 0;
    if (from === 'top') dy = -dist * inv;
    else if (from === 'left') dx = -dist * inv;
    else if (from === 'right') dx = dist * inv;
    else dy = dist * inv;
    setOpacity(el, k);
    compose(el, L.translate(el, dx, dy));
  }
  return {
    'icon-card': { dur: 0.5, apply: function (el, t, p) {
      fadeSlide(el, Math.min(t, p.dur), p.dur, p.easing, p.from || 'bottom', p.distance || 40);
    } },
    'stagger-fade-slide': { dur: 0.5, apply: function (el, t, p, i) {
      var local = t - (p.stagger || 0.08) * i;
      if (local <= 0) {
        var d = p.distance || 40;
        var dx = p.from === 'left' ? -d : p.from === 'right' ? d : 0;
        var dy = p.from === 'top' ? -d : (p.from === 'left' || p.from === 'right') ? 0 : d;
        setOpacity(el, 0);
        compose(el, L.translate(el, dx, dy));
        return;
      }
      fadeSlide(el, Math.min(local, p.dur), p.dur, p.easing, p.from || 'bottom', p.distance || 40);
    } },
    'blur-in': { dur: 0.6, apply: function (el, t, p) {
      var k = ease(p.easing, t / p.dur);
      var blur = p.blur != null ? p.blur : (p.flavor === 'capture' ? 18 : 14);
      setOpacity(el, k);
      el.style.filter = k >= 1 ? '' : 'blur(' + ((1 - k) * blur).toFixed(2) + 'px)';
    } },
    // HTML-only: translateY/skewX/clip-path have no SVG-attribute grammar.
    genie: { dur: 0.6, apply: function (el, t, p) {
      var k = ease('expo', t / p.dur), inv = 1 - k;
      var sx = 0.28 + 0.72 * k, sy = 0.06 + 0.94 * k;
      var skew = inv * (p.skew != null ? p.skew : 8), dy = inv * (p.rise != null ? p.rise : 90);
      setOpacity(el, Math.min(1, k * 1.6));
      compose(el, 'translateY(' + dy.toFixed(2) + 'px) scale(' + sx.toFixed(3) + ',' + sy.toFixed(3) + ') skewX(' + skew.toFixed(2) + 'deg)');
      var top = (inv * 46).toFixed(2);
      el.style.clipPath = k >= 1 ? '' : 'polygon(' + top + '% 0%, ' + (100 - top) + '% 0%, 100% 100%, 0% 100%)';
    } },
    'rotate-in': {
      dur: 0.7,
      setup: function (el) { el.style.transformStyle = 'preserve-3d'; el.style.perspective = '1200px'; },
      apply: function (el, t, p) {
        var k = ease(p.easing, Math.min(t / p.dur, 1));
        var axis = (p.axis || 'y').toLowerCase(), from = p.from != null ? p.from : 90;
        var fn = axis === 'x' ? 'rotateX' : axis === 'z' ? 'rotate' : 'rotateY';
        compose(el, fn + '(' + (from * (1 - k)).toFixed(3) + 'deg)');
        el.style.opacity = String(k);
      }
    },
    'iris-reveal': { dur: 0.8, apply: function (el, t, p) {
      var k = ease(p.easing, Math.min(t / p.dur, 1));
      el.style.clipPath = 'circle(' + (k * 110) + '% at ' + (p.cx || 50) + '% ' + (p.cy || 50) + '%)';
    } }
  };
});

/* ---- text + value ---- */
window.DDXCue.defineTypes(function (L) {
  'use strict';
  return {
    'count-up': {
      dur: 1.2, text: true, prime: false,   // not started = the authored text
      setup: function (el) { el.classList.add('anim-count'); },
      apply: function (el, t, p) {
        var k = L.ease(p.easing, t / p.dur);
        var s = L.fmt((p.from || 0) + ((p.to || 0) - (p.from || 0)) * k, p.format, p.flavor);
        var fmtPad = p.format && String(p.format).indexOf('pad:') === 0 ? Number(String(p.format).split(':')[1]) : 0;
        var padTo = p.pad != null ? Number(p.pad) : fmtPad;
        if (padTo > 0) s = s.padStart(padTo, '0');
        el.textContent = (p.prefix || '') + s + (p.suffix || '');
      }
    },
    'type-on': {
      dur: 1.5, text: true,
      setup: function (el) {
        if (el.dataset.typeInit === '1') return;
        el.dataset.typeInit = '1';
        el.dataset.typeText = el.textContent;
        el.textContent = '';
      },
      apply: function (el, t, p) {
        var full = el.dataset.typeText || '';
        var n = Math.max(0, Math.min(full.length, Math.floor(t * ((p.wpm || 600) * 5) / 60)));
        el.textContent = full.slice(0, n);
        if (p.caret === false || n >= full.length) return;
        var caret = document.createElement('span');
        caret.className = 'anim-caret';
        caret.textContent = p.cursor || '▍';
        caret.style.setProperty('--caret-opacity', Math.floor((t * 1000) / 250) % 2 ? '0' : '1');   // 2 Hz blink on the cue clock
        el.appendChild(caret);
      }
    },
    'terminal-window': {
      dur: 0.01,
      setup: function (el, p) {
        if (el.dataset.termInit === '1') return;
        el.dataset.termInit = '1';
        el.classList.add('anim-terminal');
        if (p.theme === 'light') el.classList.add('light');
        var bar = document.createElement('div');
        bar.className = 'term-bar';
        bar.innerHTML = '<div class="term-lights"><span></span><span></span><span></span></div><div class="term-title"></div><div></div>';
        bar.querySelector('.term-title').textContent = p.title || 'Terminal';
        var body = document.createElement('div');
        body.className = 'term-body';
        while (el.firstChild) body.appendChild(el.firstChild);
        el.appendChild(bar);
        el.appendChild(body);
      },
      apply: function () {}   // static chrome
    }
  };
});

/* ---- text-reveal (motion-bits): wraps TEXT NODES in place so inner
   elements and their ids survive (a nested highlight-sweep keeps its target). */
window.DDXCue.defineTypes(function (L) {
  'use strict';
  function wrapText(node, mode, counter) {
    var text = node.nodeValue;
    if (!text || !text.trim()) return;
    var frag = document.createDocumentFragment();
    (mode === 'char' ? Array.from(text) : text.split(/(\s+)/)).forEach(function (part) {
      if (part === '') return;
      if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
      var span = document.createElement('span');
      span.className = 'rb-word';
      span.textContent = part;
      span.dataset.rbIndex = String(counter.n++);
      frag.appendChild(span);
    });
    node.parentNode.replaceChild(frag, node);
  }
  function textNodes(el) {
    var out = [];
    (function walk(n) {
      for (var c = n.firstChild; c; c = c.nextSibling) {
        if (c.nodeType === 3) out.push(c);
        else if (c.nodeType === 1 && !c.classList.contains('rb-word')) walk(c);
      }
    })(el);
    return out;
  }
  return {
    'text-reveal': {
      dur: 0.6,
      setup: function (el, p) {
        if (el.dataset.rbInit === 'tr') return;
        el.dataset.rbInit = 'tr';
        el.setAttribute('aria-label', el.textContent);
        var counter = { n: 0 }, mode = p.mode === 'char' ? 'char' : 'word';
        textNodes(el).forEach(function (n) { wrapText(n, mode, counter); });
      },
      nodes: function (el) { return Array.from(el.querySelectorAll('.rb-word')); },
      apply: function (el, t, p) {
        var stagger = p.stagger != null ? p.stagger : 0.07, rise = p.rise != null ? p.rise : 26;
        el.querySelectorAll('.rb-word').forEach(function (w) {
          var local = Math.max(0, t - stagger * Number(w.dataset.rbIndex));
          var k = L.clamp01(p.overshoot === false ? L.ease(p.easing, local / Math.max(0.001, p.dur)) : L.spring(local * 3.2, 12, 120, 1));
          w.style.opacity = String(k);
          w.style.transform = 'translateY(' + ((1 - k) * rise).toFixed(2) + 'px)';
        });
      }
    }
  };
});

/* ---- odometer (motion-bits): rolling digit columns, transform-only writes ---- */
window.DDXCue.defineTypes(function (L) {
  'use strict';
  function column(ch) {
    var col = document.createElement('span'), strip = document.createElement('span');
    col.className = 'rb-odo-col';
    strip.className = 'rb-odo-strip';
    for (var d = 0; d <= 9; d++) { var cell = document.createElement('span'); cell.textContent = String(d); strip.appendChild(cell); }
    col.appendChild(strip);
    col.dataset.odoDigit = ch;
    return col;
  }
  return {
    odometer: {
      dur: 0.6,
      setup: function (el, p) {
        if (el.dataset.rbInit === 'odo') return;
        el.dataset.rbInit = 'odo';
        var final = String(p.to != null ? p.to : el.textContent.trim());
        el.textContent = '';
        el.classList.add('rb-odometer');
        Array.from(final).forEach(function (ch) {
          if (/\d/.test(ch)) { el.appendChild(column(ch)); return; }
          var sep = document.createElement('span');
          sep.className = 'rb-odo-static';
          sep.textContent = ch;
          el.appendChild(sep);
        });
      },
      nodes: function (el) { return Array.from(el.querySelectorAll('.rb-odo-strip')); },
      apply: function (el, t, p) {
        var k = L.clamp01(L.ease(p.easing, t / Math.max(0.001, p.dur)));
        el.querySelectorAll('.rb-odo-col').forEach(function (col) {
          var strip = col.querySelector('.rb-odo-strip');
          if (!strip) return;
          var target = Number(col.dataset.odoDigit);
          var start = p.fromDigit != null ? Number(p.fromDigit) : (target + 7) % 10;
          var travel = target > start ? target - start : target + 10 - start;
          var cellH = strip.firstElementChild ? strip.firstElementChild.offsetHeight : 1;
          strip.style.transform = 'translateY(' + (-((start + travel * k) % 10) * cellH).toFixed(2) + 'px)';
        });
      }
    }
  };
});
