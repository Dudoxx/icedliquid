/**
 * @ddx       helper
 * @domain    misc
 * @topic     engine
 * @purpose   The one sanctioned way a slide uses GSAP: a paused timeline built once and registered on the DDXCue clock.
 * @status    reusable
 */
// kit/gsap-scene.js — plain browser script, after engine/cue-runtime.js and vendor/gsap/gsap.min.js.
//   DDXKit.scene('hero', function (tl) { tl.from('.title', { y: 40, opacity: 0, duration: 0.6 }, 0.2); });
// The runtime seeks the timeline with totalTime(t); GSAP's ticker never drives it.
// repeat:-1 throws (an endless timeline has no end state to seek to).
// prefers-reduced-motion (HTML mode): the timeline jumps to its end and stays there.
(function () {
  'use strict';
  var K = window.DDXKit = window.DDXKit || {};
  K.scene = function (id, buildFn) {
    if (!window.DDXCue || !window.gsap) throw new Error('gsap-scene "' + id + '": load engine/cue-runtime.js and vendor/gsap/gsap.min.js first');
    // Seek-pure rendering (task 025): no translate3d promotion (a composited layer
    // keeps the raster scale of whichever frame promoted it, so reverse capture
    // differed mid-tween), and no ticker — it re-armed rAF every frame (capture
    // drain cap) and nothing here needs it: totalTime(t) renders synchronously.
    window.gsap.config({ force3D: false });
    window.gsap.ticker.lagSmoothing(0);
    var tl = window.gsap.timeline({ paused: true, id: id });
    buildFn(tl);
    var endless = tl.repeat() === -1 || tl.getChildren(true, true, true).some(function (c) { return c.repeat() === -1; });
    if (endless) throw new Error('gsap-scene "' + id + '": repeat:-1 is forbidden — use a finite timeline');
    if (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) { tl.progress(1); return tl; }
    window.DDXCue.registerTimeline(tl);
    // Seeking re-wakes the ticker (GSAP _wake); stages run after timelines in each
    // DDXCue.seek, so this one puts it back to sleep on every frame.
    window.DDXCue.registerStage({ id: 'gsap-ticker-sleep:' + id, renderAt: function () { window.gsap.ticker.sleep(); } });
    window.gsap.ticker.sleep();
    return tl;
  };
})();
