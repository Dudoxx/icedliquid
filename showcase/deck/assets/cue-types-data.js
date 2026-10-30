/**
 * @ddx       registry
 * @domain    misc
 * @topic     engine
 * @purpose   Path, pointer, chart and open-ended cue types for cue-runtime.js — travel, cursor-path, chart-bars, chart-line, ECharts chart, css-tween, fade and baked viseme.
 * @status    reusable
 */
/* Load after cue-runtime.js. Each defineTypes() group is one small factory. */

/* ---- paths + pointers ---- */
window.DDXCue.defineTypes(function (L) {
  'use strict';
  function resolvePoint(spec) {
    if (!spec) return null;
    if (typeof spec === 'object' && 'x' in spec) return spec;
    var node = document.querySelector(spec);
    if (!node) return null;
    var r = node.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }
  function bezier(a, b, arc, k) {   // quadratic, control point offset perpendicular by arc * dist
    var dx = b.x - a.x, dy = b.y - a.y;
    var cx = (a.x + b.x) / 2 - dy * arc, cy = (a.y + b.y) / 2 + dx * arc;
    return { x: (1 - k) * (1 - k) * a.x + 2 * (1 - k) * k * cx + k * k * b.x, y: (1 - k) * (1 - k) * a.y + 2 * (1 - k) * k * cy + k * k * b.y };
  }
  return {
    // Ride a sprite along an SVG path; fades at both ends so a loop never teleports.
    travel: { dur: 0.6, apply: function (el, t, p) {
      var scope = el.closest('.slide') || document;
      var path = p.path ? scope.querySelector(p.path) : null;
      if (!path || !path.getPointAtLength) return;
      if (el.__plen === undefined) { try { el.__plen = path.getTotalLength(); } catch (e) { el.__plen = 0; } }
      if (!el.__plen) { L.setOpacity(el, 0); return; }
      var raw = t / p.dur, k = L.ease(p.easing, p.loop !== false ? raw % 1 : Math.min(1, raw)), edge = 0.12;
      var pt = path.getPointAtLength(el.__plen * k);
      L.compose(el, 'translate(' + pt.x.toFixed(2) + ' ' + pt.y.toFixed(2) + ')');
      L.setOpacity(el, (k < edge ? k / edge : (k > 1 - edge ? (1 - k) / edge : 1)).toFixed(3));
    } },
    'cursor-path': {
      dur: 0.8,
      setup: function (el) {
        if (!el.classList.contains('anim-cursor') || el.querySelector('svg')) return;
        el.innerHTML = '<svg viewBox="0 0 32 32"><path d="M4 2 L4 24 L10 18 L14 28 L18 26 L14 16 L22 16 Z" '
          + 'fill="oklch(0.985 0.005 80)" stroke="oklch(0.22 0.02 260)" stroke-width="1.5" stroke-linejoin="round"/></svg>';
      },
      apply: function (el, t, p) {
        var k = L.ease(p.easing, Math.max(0, Math.min(t, p.dur)) / p.dur);
        var m = /translate\(([-\d.]+)px,\s*([-\d.]+)px\)/.exec(el.style.transform || '');
        var from = resolvePoint(p.from) || (m ? { x: +m[1], y: +m[2] } : { x: -100, y: -100 }), to = resolvePoint(p.to);
        if (!to) return;
        var pt = bezier(from, to, p.arc != null ? p.arc : 0.3, k);
        el.style.transform = 'translate(' + pt.x + 'px, ' + pt.y + 'px)';
        el.classList.toggle('clicking', !!p.click && t >= p.dur && t - p.dur <= 0.4);   // a pure window, not a latch
      }
    }
  };
});

/* ---- SVG/HTML data charts (no library) ---- */
window.DDXCue.defineTypes(function (L) {
  'use strict';
  function linePts(el) {
    return (el.getAttribute('points') || '').trim().split(/\s+/).map(function (pair) {
      var xy = pair.split(',').map(Number); return { x: xy[0], y: xy[1] };
    });
  }
  function marker(el) { return el.parentNode ? el.parentNode.querySelector('.anim-chart-marker') : null; }
  function pointAt(pts, target) {
    var walked = 0;
    for (var i = 1; i < pts.length; i++) {
      var dx = pts[i].x - pts[i - 1].x, dy = pts[i].y - pts[i - 1].y, seg = Math.hypot(dx, dy);
      if (walked + seg >= target) { var f = (target - walked) / Math.max(0.001, seg); return { x: pts[i - 1].x + dx * f, y: pts[i - 1].y + dy * f }; }
      walked += seg;
    }
    return pts[pts.length - 1];
  }
  return {
    'chart-bars': {
      dur: 1.2,
      setup: function (el) {
        if (el.dataset.barInit === '1') return;
        el.dataset.barInit = '1';
        var bars = Array.from(el.querySelectorAll('.bar'));
        var max = Math.max.apply(null, bars.map(function (b) { return Number(b.dataset.value || '0'); }).concat([1]));
        bars.forEach(function (b) {
          b.dataset.target = String((Number(b.dataset.value || '0') / max) * 100);
          b.style.transformOrigin = 'bottom center';
          b.style.transform = 'scaleY(0)';
        });
      },
      nodes: function (el) { return Array.from(el.querySelectorAll('.bar')); },
      apply: function (el, t, p) {
        var stagger = p.stagger != null ? p.stagger : 0.08;
        el.querySelectorAll('.bar').forEach(function (b, i) {
          var k = L.ease(p.easing, Math.max(0, Math.min((t - stagger * i) / p.dur, 1)));
          b.style.transform = 'scaleY(' + (k * Number(b.dataset.target || '0') / 100) + ')';
        });
      }
    },
    // <polyline> that draws, plus a sibling <circle class="anim-chart-marker"> riding it.
    'chart-line': {
      dur: 1.4,
      setup: function (el) {
        var pts = linePts(el), len = 0;
        for (var i = 1; i < pts.length; i++) len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
        el.__lineLen = len < 1 ? 1000 : len;
        el.style.fill = 'none';
        el.classList.add('anim-draw');
      },
      nodes: function (el) { var m = marker(el); return m ? [m] : []; },
      apply: function (el, t, p) {
        var k = L.ease(p.easing, Math.min(t / p.dur, 1)), len = el.__lineLen || 1000;
        el.style.strokeDasharray = String(len);
        el.style.strokeDashoffset = String(len * (1 - k));
        var m = marker(el), pts = linePts(el);
        if (!m || pts.length < 2) return;
        var pos = pointAt(pts, k * len);
        m.setAttribute('cx', String(pos.x));
        m.setAttribute('cy', String(pos.y));
        m.style.opacity = String(Math.min(k * 4, 1));
      }
    }
  };
});

/* ---- ECharts specs, part 1: shared palette + waterfall. Builders take
   (p, c, base, K): K(i) is the tween progress of datum i at the cue time. ---- */
window.DDXCue.defineTypes(function (L) {
  'use strict';
  function brandVar(name, fallback) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(name);
    return (v && v.trim()) || fallback;
  }
  L.chart = {
    brandVar: brandVar,
    scaleBy: function (v, k) { return k === 1 ? v : v * k; },
    palette: function () {
      return { accent: brandVar('--teal', '#14342B'), accent2: brandVar('--teal-2', '#2E6A55'), gold: brandVar('--gold', '#B08D57'),
        clay: brandVar('--clay', '#8C4A2F'), ink: brandVar('--ink', '#22201C'), muted: brandVar('--muted', '#6B655C'), rule: brandVar('--rule', '#DED8CC') };
    },
    specs: {}
  };
  var scaleBy = L.chart.scaleBy, fmt = L.fmtDeck;
  function support(p) {   // a waterfall floats each bar on an invisible support series
    var out = [], running = 0;
    p.data.forEach(function (d) {
      if (d.total) { out.push(0); running = d.value; }
      else if (d.value >= 0) { out.push(running); running += d.value; }
      else { running += d.value; out.push(running); }
    });
    return out;
  }
  L.chart.specs.waterfall = function (p, c, base, K) {
    var label = function (o) { var d = p.data[o.dataIndex]; return (d.total ? '' : d.value >= 0 ? '+' : '−') + fmt(Math.abs(d.value)) + (p.unit || ''); };
    return Object.assign({}, base, {
      grid: { top: 44, bottom: 60, left: 70, right: 30, containLabel: true },
      xAxis: { type: 'category', data: p.data.map(function (d) { return d.label; }),
        axisLabel: { fontSize: 16, fontWeight: 700, color: c.ink, interval: 0, lineHeight: 19 },
        axisLine: { lineStyle: { color: c.rule } }, axisTick: { show: false } },
      yAxis: { type: 'value', axisLabel: { fontSize: 15, color: c.muted, formatter: function (v) { return fmt(v); } },
        splitLine: { lineStyle: { color: c.rule } } },
      series: [
        { type: 'bar', stack: 'w', silent: true, itemStyle: { color: 'transparent' },
          data: support(p).map(function (v, j) { return scaleBy(v, K(j)); }) },
        { type: 'bar', stack: 'w', barWidth: '54%',
          data: p.data.map(function (d, j) {
            return { value: scaleBy(d.total ? d.value : Math.abs(d.value), K(j)),
              itemStyle: { color: d.total ? c.accent : (d.value >= 0 ? c.accent2 : c.clay), borderRadius: [6, 6, 0, 0] } };
          }),
          label: { show: true, position: 'top', fontSize: 17, fontWeight: 800, color: c.ink, formatter: label } }
      ]
    });
  };
  return {};
});

/* ---- ECharts specs, part 2: bar, donut, gauge ---- */
window.DDXCue.defineTypes(function (L) {
  'use strict';
  var scaleBy = L.chart.scaleBy, fmt = L.fmtDeck;
  L.chart.specs.bar = function (p, c, base, K) {
    var color = function (d) { return d.color === 'clay' ? c.clay : d.color === 'gold' ? c.gold : d.color === 'accent2' ? c.accent2 : c.accent; };
    return Object.assign({}, base, {
      grid: { top: 20, bottom: 12, left: p.labelWidth || 240, right: 100, containLabel: false },
      xAxis: { type: 'value', show: false, max: p.max },
      yAxis: { type: 'category', data: p.data.map(function (d) { return d.label; }), inverse: true,
        axisLabel: { fontSize: 18, fontWeight: 700, color: c.ink, margin: 24 }, axisLine: { show: false }, axisTick: { show: false } },
      series: [{ type: 'bar', barCategoryGap: '45%',
        data: p.data.map(function (d, i) { return { value: scaleBy(d.value, K(i)), itemStyle: { color: color(d), borderRadius: [0, 8, 8, 0] } }; }),
        label: { show: true, position: 'right', fontSize: 19, fontWeight: 800, color: c.ink,
          formatter: function (o) { return fmt(o.value, p.format) + (p.unit || ''); } } }]
    });
  };
  L.chart.specs.donut = function (p, c, base, K) {
    var cols = [c.accent, c.gold, c.clay, c.accent2], k = K(0), total = 0;
    var data = p.data.map(function (d, i) { total += d.value; return { name: d.label, value: scaleBy(d.value, k), itemStyle: { color: cols[i % cols.length] } }; });
    // Mid-tween an invisible filler holds the unswept arc, so the ring grows clockwise.
    if (k < 1) data.push({ name: '', value: total * (1 - k), itemStyle: { color: 'transparent' }, label: { show: false }, labelLine: { show: false }, emphasis: { disabled: true } });
    return Object.assign({}, base, { series: [{ type: 'pie', radius: ['54%', '78%'], avoidLabelOverlap: true,
      label: { position: 'outer', fontSize: 16, fontWeight: 700, color: c.ink,
        formatter: function (o) { var d = p.data[o.dataIndex]; return o.name + '\n' + fmt(d ? d.value : o.value) + (p.unit || ''); } },
      labelLine: { lineStyle: { color: c.rule } }, data: data }] });
  };
  L.chart.specs.gauge = function (p, c, base, K) {
    return Object.assign({}, base, { series: [{ type: 'gauge', startAngle: 200, endAngle: -20, min: 0, max: p.max || 100,
      progress: { show: true, width: 22, roundCap: true, itemStyle: { color: c.accent } },
      axisLine: { lineStyle: { width: 22, color: [[1, c.rule]] } }, pointer: { show: false }, axisTick: { show: false },
      splitLine: { show: false }, axisLabel: { show: false }, anchor: { show: false }, title: { show: false },
      detail: { fontSize: 52, fontWeight: 800, color: c.ink, offsetCenter: [0, '6%'], formatter: function (v) { return fmt(v, p.format) + (p.unit || '%'); } },
      data: [{ value: scaleBy(p.value, K(0)) }] }] });
  };
  return {};
});

/* ---- chart: ECharts from data on the cue. Always painted from the clock
   with animation:false, so a seek is a pure function of t. Self-resetting:
   disposed before its start. ---- */
window.DDXCue.defineTypes(function (L) {
  'use strict';
  var BAR_LAG = 0.22;   // s between bars, the old ECharts animationDelay
  function option(p, K) {
    var spec = L.chart.specs[p.spec];
    return spec(p, L.chart.palette(), { backgroundColor: 'transparent', animation: false, tooltip: { show: false },
      textStyle: { fontFamily: L.chart.brandVar('--font-body', 'Inter, system-ui, sans-serif') } }, K);
  }
  function dispose(el) { if (el.__chart) { el.__chart.dispose(); el.__chart = null; el.__chartT = undefined; } }
  return {
    chart: {
      dur: 1.8, selfReset: true,
      apply: function (el, t, p) {
        if (t <= 0.001) { dispose(el); return; }
        if (typeof echarts === 'undefined') { L.report('missing-lib', 'chart cue on ' + p.__target + ' needs echarts loaded'); return; }
        if (!L.chart.specs[p.spec]) { L.report('bad-params', 'chart cue on ' + p.__target + ' has unknown spec "' + p.spec + '"'); return; }
        var n = p.data ? p.data.length : 1;
        var tc = Math.min(t, p.dur + (p.spec === 'bar' ? BAR_LAG * Math.max(0, n - 1) : 0));
        if (el.__chart && el.__chartT === tc) return;
        var K = function (i) {   // cubicOut per datum, bar i lagged i x BAR_LAG
          var x = L.clamp01((tc - (p.spec === 'bar' ? i * BAR_LAG : 0)) / p.dur);
          return x >= 1 ? 1 : 1 - Math.pow(1 - x, 3);
        };
        if (!el.__chart) el.__chart = echarts.init(el, null, { renderer: 'svg' });
        el.__chart.setOption(option(p, K), true);
        el.__chartT = tc;
      }
    }
  };
});

/* ---- open-ended: css-tween, fade, viseme ---- */
window.DDXCue.defineTypes(function (L) {
  'use strict';
  var NUM_UNIT = /^(-?[\d.]+)([a-z%]*)$/i;
  function tween(a, b, k) {   // numbers (with or without a unit) interpolate; others switch at the midpoint
    if (a == null) return String(b);
    if (b == null) return String(a);
    var ma = NUM_UNIT.exec(String(a)), mb = NUM_UNIT.exec(String(b));
    if (ma && mb && (ma[2] === mb[2] || !ma[2] || !mb[2])) return (parseFloat(ma[1]) + (parseFloat(mb[1]) - parseFloat(ma[1])) * k) + (mb[2] || ma[2] || '');
    return String(k < 0.5 ? a : b);
  }
  return {
    'css-tween': {
      dur: 0.5,
      setup: function (el, p) { var from = (p.css && p.css.from) || {}; for (var k in from) el.style.setProperty(k, String(from[k])); },
      apply: function (el, t, p) {
        var from = (p.css && p.css.from) || {}, to = (p.css && p.css.to) || {};
        var k = L.ease(p.easing, Math.min(t / p.dur, 1)), keys = Object.keys(from).concat(Object.keys(to));
        keys.forEach(function (prop) { el.style.setProperty(prop, tween(from[prop], to[prop], k)); });
      }
    },
    // The data-fade-in / data-fade-out scanner as a cue (startMs 0, params in slide ms).
    fade: { dur: 0.4, prime: false, apply: function (el, t, p) { L.applyFade(el, t * 1000, p); } },
    // A baked phoneme occurrence (task 007 writes startMs from audio/<id>.visemes.json).
    // Drives params.effect (default pulse) as a 0 -> dur -> 0 triangle, then rests. No event bus.
    viseme: { dur: 0.5, prime: false, apply: function (el, t, p, i) {
      var fx = window.DDXCue.primitives[p.effect || 'pulse'];
      if (!fx || p.effect === 'viseme') return;
      var d = p.dur, local = t >= d ? 0 : (t <= d / 2 ? t * 2 : (d - t) * 2);
      fx.apply(el, Math.max(0, Math.min(local, d)), p, i);
    } }
  };
});
