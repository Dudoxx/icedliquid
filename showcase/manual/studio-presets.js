/* Motion presets for the manual (generated). */
window.STUDIO_REG = {
  "version": 1,
  "source": "Dudoxx motion presets",
  "palette": {
    "out": "0.23,1,0.32,1",
    "expo": "expo.out",
    "quint": "power4.out",
    "move": "0.77,0,0.175,1",
    "enter-x": "0,0,0.3,1",
    "exit": "0.4,0.14,1,1",
    "spring": "back.out(1.4)",
    "cam": "power2.inOut",
    "soft": "power2.out",
    "linear": "none"
  },
  "choreography": {
    "followerDelayMs": [150, 250],
    "staggerMs": [40, 80],
    "leadsPerBeat": 1,
    "nextBeatAtLeadFraction": 0.7,
    "exitFraction": 0.6
  },
  "presets": {
    "rise": { "name": "rise", "kind": "entrance", "durS": 0.7, "ease": "expo", "plugins": [], "loopSafe": false, "mover": "lead", "reducedMotion": "opacity-150" },
    "rise-stagger": { "name": "rise-stagger", "kind": "entrance", "durS": 0.7, "ease": "expo", "stagger": 0.06, "plugins": [], "loopSafe": false, "mover": "follower", "reducedMotion": "opacity-150" },
    "line-mask": { "name": "line-mask", "kind": "entrance", "durS": 0.9, "ease": "expo", "stagger": 0.08, "plugins": ["SplitText"], "loopSafe": false, "mover": "lead", "reducedMotion": "opacity-150" },
    "word-mask": { "name": "word-mask", "kind": "entrance", "durS": 0.6, "ease": "out", "stagger": 0.04, "plugins": ["SplitText"], "loopSafe": false, "mover": "lead", "reducedMotion": "opacity-150" },
    "char-scramble": { "name": "char-scramble", "kind": "entrance", "durS": 0.8, "ease": "linear", "stagger": 0.015, "plugins": ["SplitText"], "loopSafe": false, "mover": "lead", "reducedMotion": "opacity-150" },
    "scale-in": { "name": "scale-in", "kind": "entrance", "durS": 0.6, "ease": "out", "plugins": [], "loopSafe": false, "mover": "follower", "reducedMotion": "opacity-150" },
    "blur-in": { "name": "blur-in", "kind": "entrance", "durS": 0.8, "ease": "out", "plugins": [], "loopSafe": false, "mover": "lead", "reducedMotion": "opacity-150" },
    "clip-wipe": { "name": "clip-wipe", "kind": "entrance", "durS": 0.9, "ease": "move", "plugins": [], "loopSafe": false, "mover": "lead", "reducedMotion": "opacity-150" },
    "draw": { "name": "draw", "kind": "entrance", "durS": 1.2, "ease": "cam", "plugins": ["DrawSVGPlugin"], "loopSafe": false, "mover": "lead", "reducedMotion": "opacity-150" },
    "morph": { "name": "morph", "kind": "emphasis", "durS": 0.9, "ease": "move", "plugins": ["MorphSVGPlugin"], "loopSafe": false, "mover": "lead", "reducedMotion": "opacity-150" },
    "flow": { "name": "flow", "kind": "ambient", "durS": 1.6, "ease": "linear", "plugins": ["MotionPathPlugin"], "loopSafe": true, "mover": "ambient", "reducedMotion": "end-state" },
    "count-up": { "name": "count-up", "kind": "data", "durS": 1.4, "ease": "expo", "plugins": [], "loopSafe": false, "mover": "lead", "reducedMotion": "end-state" },
    "bar-grow": { "name": "bar-grow", "kind": "data", "durS": 0.9, "ease": "expo", "stagger": 0.05, "plugins": [], "loopSafe": false, "mover": "follower", "reducedMotion": "opacity-150" },
    "line-chart": { "name": "line-chart", "kind": "data", "durS": 1.4, "ease": "soft", "plugins": ["DrawSVGPlugin"], "loopSafe": false, "mover": "lead", "reducedMotion": "opacity-150" },
    "highlight": { "name": "highlight", "kind": "emphasis", "durS": 0.5, "ease": "out", "plugins": [], "loopSafe": false, "mover": "follower", "reducedMotion": "end-state" },
    "magic-move": { "name": "magic-move", "kind": "emphasis", "durS": 0.9, "ease": "move", "plugins": ["Flip"], "loopSafe": false, "mover": "lead", "reducedMotion": "opacity-150" },
    "cam-push": { "name": "cam-push", "kind": "camera", "durS": 1.2, "ease": "cam", "plugins": [], "loopSafe": false, "mover": "lead", "reducedMotion": "opacity-150" },
    "cam-pan": { "name": "cam-pan", "kind": "camera", "durS": 1.4, "ease": "cam", "plugins": [], "loopSafe": false, "mover": "lead", "reducedMotion": "opacity-150" },
    "depth-parallax": { "name": "depth-parallax", "kind": "ambient", "durS": 8, "ease": "linear", "plugins": [], "loopSafe": true, "mover": "ambient", "reducedMotion": "end-state" },
    "ambient-drift": { "name": "ambient-drift", "kind": "ambient", "durS": 10, "ease": "linear", "plugins": [], "loopSafe": true, "mover": "ambient", "reducedMotion": "end-state" },
    "exit-fade": { "name": "exit-fade", "kind": "exit", "durS": 0.42, "ease": "exit", "pairs": "rise", "plugins": [], "loopSafe": false, "mover": "follower", "reducedMotion": "opacity-150" },
    "3d-reveal": { "name": "3d-reveal", "kind": "3d", "durS": 1.8, "ease": "expo", "plugins": [], "loopSafe": false, "mover": "lead", "reducedMotion": "opacity-150" }
  },
  "legacyMap": {
    "stagger-fade-slide": "rise-stagger",
    "draw-path": "draw",
    "count-up": "count-up",
    "chart-bars": "bar-grow",
    "chart-line": "line-chart",
    "ken-burns": "depth-parallax",
    "parallax-layer": "ambient-drift",
    "highlight-sweep": "highlight",
    "wipe-in": "clip-wipe",
    "viewport-zoom": "cam-push",
    "fade-up": "rise",
    "fade-out": "exit-fade"
  }
};
