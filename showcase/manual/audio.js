/* In-browser sound design (WebAudio + one <audio> per bed / voice line). v2b: sound is ON from the start.
   Browsers block audio before a user gesture, so controls.js asks MOTION_AUDIO.probe() first: allowed -> it
   plays with sound at once; blocked -> it shows a "Play with sound" button and calls MOTION_AUDIO.unlock() from
   that gesture. A play() rejected mid-piece (NotAllowedError) calls the onBlocked() listeners. Timeline cues
   call MOTION_AUDIO.cue(name); cues are suppressed while scrubbing/seeking (GSAP suppresses callbacks on seek).
   LOUDNESS: narration clips and music beds are both normalised to -16 LUFS (make-narration / make-music), so
   the mix is decided HERE: music <= 0.35 of the voice level, 0.3 between lines, 0.12 under a line. */
(function () {
  'use strict';
  var ctx = null;
  var enabled = true;      // master switch: music, voice and SFX (the Sound button)
  var musicEnabled = true; // music beds only (M / the Music button); the voice and captions never follow it
  var AC = window.AudioContext || window.webkitAudioContext;
  try { if (AC) ctx = new AC(); } catch (e) { ctx = null; } // created suspended until a gesture (or allowed autoplay)
  // A 1-sample silent WAV: probes the autoplay policy and primes elements inside a gesture. No network.
  var SILENT = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
  // iOS Safari ignores HTMLMediaElement.volume (always 1): route elements through a GainNode there, or the
  // music would play at full level. Elsewhere plain .volume is used (a GainNode on a file:// element is silent).
  var volumeFixed = (function () { try { var a = new Audio(); a.volume = 0.5; return a.volume !== 0.5; } catch (e) { return false; } })();
  function attach(el) {
    if (!(volumeFixed && ctx && ctx.createMediaElementSource)) return;
    try { var g = ctx.createGain(); ctx.createMediaElementSource(el).connect(g); g.connect(ctx.destination); el._g = g; } catch (e) { /* keep .volume */ }
  }
  function setVol(el, v) { v = Math.max(0, Math.min(1, v)); if (el._g) el._g.gain.value = v; else el.volume = v; }
  var blocked = false, blockedCbs = [];
  function noteBlocked() { if (blocked) return; blocked = true; blockedCbs.slice().forEach(function (cb) { try { cb(); } catch (e) { /* listener */ } }); }
  function tryPlay(el) {
    el._prime = false; // a real play request cancels a pending prime-then-pause
    var pr = el.play();
    if (pr && pr.catch) pr.catch(function (e) { if (e && e.name === 'NotAllowedError') noteBlocked(); });
  }

  function env(gain, t0, attack, release, peak) {
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(peak, t0 + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + release);
  }
  function tone(freq, dur, peak, type) {
    var t0 = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'sine'; o.frequency.setValueAtTime(freq, t0);
    env(g, t0, 0.01, dur, peak); o.connect(g).connect(ctx.destination);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }
  function whoosh() {
    var t0 = ctx.currentTime, len = Math.floor(ctx.sampleRate * 0.5);
    var buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    var src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = buf; f.type = 'bandpass'; f.Q.value = 1.2;
    f.frequency.setValueAtTime(300, t0); f.frequency.exponentialRampToValueAtTime(3200, t0 + 0.4);
    env(g, t0, 0.12, 0.35, 0.18); src.connect(f).connect(g).connect(ctx.destination);
    src.start(t0); src.stop(t0 + 0.55);
  }
  var SFX = {
    whoosh: whoosh,
    tick: function () { tone(1400, 0.06, 0.12, 'square'); },
    impact: function () { tone(70, 0.35, 0.5, 'sine'); },
    chime: function () { tone(880, 0.9, 0.12); setTimeout(function () { if (enabled && ctx && ctx.state === 'running') tone(1320, 0.9, 0.08); }, 90); }
  };

  // Music, declared by audio/bed.js:
  //   window.MUSIC_BED  = 'audio/bed.mp3' | { src, loop } | null      one bed for the whole piece
  //   window.MUSIC_BEDS = [{ src, from, to, loop? }, …]                 several beds (long pieces)
  // scaffold writes null; make-music.mjs (or you, for a supplied track) fills it. null -> SFX only,
  // and no request is made (an undeclared bed would 404 on every page load).
  // A bed plays inside [from, to) of the timeline; position inside the file = t - from, or modulo the
  // file length when loop is true (a 20 min piece never falls silent after a 3 min bed). Adjacent
  // beds CROSSFADE over XF s at their seam. It follows the timeline: controls.js calls sync(t, playing)
  // on every update, play, pause and seek.
  // Mix (both stems sit at -16 LUFS): music 0.3 (about -10.5 dB) between lines, 0.12 (about -18 dB) under a line.
  // window.MUSIC_VOL / window.MUSIC_DUCK override, but never above MUSIC_CAP = 0.35 of the voice level (voice = 1).
  var XF = 1.6, MUSIC_CAP = 0.35;
  var MUSIC_VOL = Math.max(0, Math.min(MUSIC_CAP, Number(window.MUSIC_VOL != null ? window.MUSIC_VOL : 0.3)));
  var DUCK_VOL = Math.max(0, Math.min(MUSIC_VOL, Number(window.MUSIC_DUCK != null ? window.MUSIC_DUCK : 0.12)));
  // v4: a multi-language piece also declares window.MUSIC_BEDS_BY_LANG = { en: [...], de: [...] } (make-music
  // --fit-only --lang re-cuts the same music to each language's chapter seams); PIECE_LANG (lang.js) picks.
  // Missing or not a list for this language -> MUSIC_BEDS, the default-language list (single-language pieces).
  var BEDS_BY = window.MUSIC_BEDS_BY_LANG, BEDS_LANG = BEDS_BY && window.PIECE_LANG ? BEDS_BY[window.PIECE_LANG] : null;
  var bedList = Array.isArray(BEDS_LANG) ? BEDS_LANG
    : Array.isArray(window.MUSIC_BEDS) ? window.MUSIC_BEDS
    : window.MUSIC_BED ? [typeof window.MUSIC_BED === 'string' ? { src: window.MUSIC_BED } : window.MUSIC_BED] : [];
  var beds = bedList.map(function (b) {
    var el = new Audio(b.src), o = { el: el, from: Number(b.from) || 0, to: b.to != null ? Number(b.to) : Infinity, loop: !!b.loop, ok: true };
    el.preload = 'auto'; attach(el); setVol(el, 0); el.addEventListener('error', function () { o.ok = false; });
    return o;
  });
  var music = beds.length ? beds[0].el : null; // exposed for review probes
  var force = false; // set when the tab comes back: re-seek every clip once, whatever the drift
  var bedForce = false; // set when music turns back on: re-seek the beds only (a voice re-seek would be audible)
  var lastT = 0, lastPlaying = false; // the last sync() call, so setMusic(true) rejoins in place
  document.addEventListener('visibilitychange', function () { if (!document.hidden) force = true; });
  function smooth(x) { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); }
  function bedGain(b, t) {
    if (t < b.from - XF / 2 || t >= b.to + XF / 2) return 0;
    var inK = b.from <= 0 ? 1 : smooth((t - (b.from - XF / 2)) / XF), outK = b.to === Infinity ? 1 : smooth(((b.to + XF / 2) - t) / XF);
    return Math.min(inK, outK);
  }
  function sync(t, playing, duck) {
    var vol = MUSIC_VOL - (MUSIC_VOL - DUCK_VOL) * duck;
    beds.forEach(function (b) {
      if (!b.ok) return;
      var g = bedGain(b, t), el = b.el;
      if (g <= 0) { if (!el.paused) el.pause(); return; }
      setVol(el, musicEnabled ? vol * g : 0);
      var len = el.duration, local = Math.max(0, t - b.from);
      if (b.loop && len > 1) local = local % len;
      // Seeking needs HTTP byte ranges (serve.mjs has them); without them currentTime snaps to 0.
      var canSeek = el.seekable && el.seekable.length > 0 && el.seekable.end(0) > 1;
      // same anti-chop guard as the voice path: while playing, no re-seek during an in-flight seek, 1 s drift, 1.5 s spacing
      var bnow = Date.now(), bdrift = Math.abs(el.currentTime - local);
      var bSeek = force || bedForce || (playing ? (!el.seeking && bdrift > 1.0 && bnow - (el._seekAt || 0) > 1500) : bdrift > 0.3);
      if (canSeek && bSeek) { try { el.currentTime = len ? Math.min(local, len - 0.05) : local; el._seekAt = bnow; } catch (e) { /* not ready */ } }
      if (enabled && playing && musicEnabled) tryPlay(el); else el.pause();
    });
    bedForce = false;
  }
  function setMusic(on) {
    musicEnabled = !!on;
    if (!musicEnabled) beds.forEach(function (b) { setVol(b.el, 0); b.el.pause(); });
    else { bedForce = true; sync(lastT, lastPlaying, duckAmount(lastT)); } // rejoin at the timeline position
    try { document.dispatchEvent(new CustomEvent('motion:music', { detail: { on: musicEnabled } })); } catch (e) { /* old browser: the UI re-reads musicOn */ }
    return musicEnabled;
  }

  // Narration (audio/voice/lines.js from scripts/make-narration.mjs): one <audio> per line, created
  // LAZILY — the current line plus the next 3 are loaded, never all 100+ at page load. Music ducks
  // under the voice. Captions always show, split into cues of at most ~2 rows (CAP_CHARS) timed by
  // their share of the line's characters.
  // Piece mode loads one lines.<lang>.js per language (window.VOICE_BY_LANG) and plays the one
  // lang.js picked from ?lang=; a hand-built site has one lines.js (window.VOICE_LINES).
  var BY = window.VOICE_BY_LANG, LANG = window.PIECE_LANG;
  var LINES = (BY && LANG && BY[LANG]) || window.VOICE_LINES || [];
  // A small POOL of <audio> elements (6) is re-pointed at the lines that are near: the current one plus the next 3.
  // Reusing elements (not new Audio() per line) is what keeps them unlocked on iOS after the first gesture.
  var voices = new Array(LINES.length); // voices[i] = the element currently bound to line i (sparse)
  var pool = [], cur = -1;
  if (LINES.length) for (var pi = 0; pi < 6; pi++) { var pe = new Audio(); pe.preload = 'auto'; pe.src = SILENT; attach(pe); pool.push({ el: pe, line: -1 }); }
  function voice(i) {
    if (voices[i]) return voices[i];
    var lo = cur >= 0 ? cur : i, hi = i + 3, victim = null, best = -Infinity;
    pool.forEach(function (p) {
      var score = p.line < 0 ? 1e9 : (p.line >= lo && p.line <= hi ? Math.abs(p.line - i) - 1000 : Math.abs(p.line - i));
      if (score > best) { best = score; victim = p; }
    });
    if (victim.line >= 0) voices[victim.line] = undefined;
    victim.el.pause(); victim.line = i; victim.el.src = LINES[i].src; voices[i] = victim.el;
    return victim.el;
  }
  function prefetch(i) { if (!pool.length) return; for (var j = Math.max(0, i); j < Math.min(LINES.length, i + 4); j++) voice(j); }
  prefetch(0);
  var capEl = document.getElementById('caption');
  var CAP_CHARS = 96;
  // v4.1 (R1 M3): a run of words longer than one cue is cut into N cues of EVEN length (N = ceil(len / CAP_CHARS)),
  // each cut at the word nearest its target that ends a clause (",") if one sits within 30 % of a cue, else the
  // nearest word. Greedy packing left a one-word row ("…, über") and cut phrases mid-way in German.
  function splitEven(toks) { // toks = word strings -> [[index, …], …]
    var lens = toks.map(function (w) { return w.length + 1; }), tot = lens.reduce(function (a, b) { return a + b; }, 0);
    var n = Math.ceil(tot / CAP_CHARS);
    if (n <= 1) return [toks.map(function (_, k) { return k; })];
    var cuts = [], acc = 0, ends = []; // ends[k] = chars up to and including word k
    lens.forEach(function (l) { acc += l; ends.push(acc); });
    for (var c = 1; c < n; c++) {
      var target = tot * c / n, win = 0.3 * tot / n, best = -1, bestD = Infinity, lo = cuts.length ? cuts[cuts.length - 1] + 1 : 0;
      for (var k = lo; k < toks.length - 1; k++) {
        var d = Math.abs(ends[k] - target), clause = /[,\u2013\u2014]$/.test(toks[k]) && d <= win;
        var score = clause ? d - win : d;
        if (score < bestD) { bestD = score; best = k; }
      }
      if (best >= 0) cuts.push(best);
    }
    var out = [], start = 0;
    cuts.concat([toks.length - 1]).forEach(function (e) { var g = []; for (var k = start; k <= e; k++) g.push(k); if (g.length) out.push(g); start = e + 1; });
    return out;
  }
  function hasWords(l) { return !!(l && Array.isArray(l.words) && l.words.length); }
  // FALLBACK (no `words`): sentence-then-clause split, greedy-packed to CAP_CHARS; each cue keeps its share of the
  // time by characters (from = 0..1 of the line).
  function charCues(l) {
    var parts = String(l.caption || l.text || '').match(/[^.!?;:]+[.!?;:]*\s*|.+$/g) || [''], out = [], buf = '';
    parts.forEach(function (p) {
      if (buf && (buf + p).length > CAP_CHARS) { out.push(buf.trim()); buf = ''; }
      if (p.length > CAP_CHARS) { var tk = p.trim().split(/\s+/); splitEven(tk).forEach(function (g) { out.push(g.map(function (k) { return tk[k]; }).join(' ')); }); }
      else buf += p;
    });
    if (buf.trim()) out.push(buf.trim());
    var total = out.reduce(function (n, x) { return n + x.length; }, 0) || 1, acc = 0;
    return out.map(function (x) { var c = { text: x, from: acc / total }; acc += x.length; return c; });
  }
  // v3 WORD captions: a line with `words` [{ w, s, e }] (seconds in the clip; make-narration --words or
  // align-words.mjs) packs whole words the same way (sentence ends first, then CAP_CHARS); a cue starts at its
  // first word (from = seconds) and lists its word indexes (idx). Joined words = the line text.
  function wordCues(l) {
    var W = l.words, groups = [], g = [], out = [], cur = [], len = 0;
    W.forEach(function (w, k) { g.push(k); if (/[.!?;:]["')\]]*$/.test(w.w)) { groups.push(g); g = []; } });
    if (g.length) groups.push(g);
    function flush() { if (cur.length) out.push({ idx: cur, from: W[cur[0]].s }); cur = []; len = 0; }
    groups.forEach(function (grp) {
      var gl = grp.reduce(function (n, k) { return n + W[k].w.length + 1; }, 0);
      if (cur.length && len + gl > CAP_CHARS) flush();
      if (gl <= CAP_CHARS) { grp.forEach(function (k) { cur.push(k); len += W[k].w.length + 1; }); return; }
      splitEven(grp.map(function (k) { return W[k].w; })).forEach(function (sub) { cur = sub.map(function (x) { return grp[x]; }); flush(); });
    });
    flush();
    out.forEach(function (c) { c.text = c.idx.map(function (k) { return W[k].w; }).join(' '); });
    return out;
  }
  var cues = LINES.map(function (l) { return hasWords(l) ? wordCues(l) : charCues(l); });
  function cueAt(i, t) {
    var list = cues[i], c = list[0], j, k = t - LINES[i].at;
    if (!hasWords(LINES[i])) k = k / (LINES[i].seconds || 1);
    for (j = 0; j < list.length; j++) if (k >= list[j].from) c = list[j];
    return c || null;
  }
  // The word being spoken: s <= t < the next word's s (held through short pauses); none before the first word,
  // none 0.15 s after the last one ends.
  function wordIndex(i, t) {
    var W = LINES[i].words, k = t - LINES[i].at, n = W.length;
    if (k < W[0].s || k >= Math.max(W[n - 1].e, W[n - 1].s) + 0.15) return -1;
    for (var j = n - 1; j >= 0; j--) if (k >= W[j].s) return j;
    return -1;
  }
  function lineAt(t) { for (var i = 0; i < LINES.length; i++) if (t >= LINES[i].at && t < LINES[i].at + LINES[i].seconds) return i; return -1; }
  // Smooth ducking, a pure function of t (so a seek lands on the right level, no jumps):
  // music eases down DUCK_IN s before a line, holds under it, eases back up over DUCK_OUT s after.
  var DUCK_IN = 0.5, DUCK_OUT = 0.8, VOICE_FADE_IN = 0.06, VOICE_FADE_OUT = 0.15;
  function duckAmount(t) {
    var d = 0;
    for (var i = 0; i < LINES.length; i++) {
      var a = LINES[i].at, e = a + LINES[i].seconds;
      if (t < a - DUCK_IN || t > e + DUCK_OUT) continue;
      var k = t < a ? smooth(1 - (a - t) / DUCK_IN) : t <= e ? 1 : smooth(1 - (t - e) / DUCK_OUT);
      if (k > d) d = k;
    }
    return d;
  }
  function voiceGain(i, t) {
    var a = LINES[i].at, e = a + LINES[i].seconds;
    return Math.max(0, Math.min(1, (t - a) / VOICE_FADE_IN, (e - t) / VOICE_FADE_OUT));
  }
  // Paints #caption for timeline time t — a pure function of t (seek twice = same DOM). Word cues are one
  // <span class="cap-w"> per word, rebuilt only when the cue changes; the spoken word gets `on` (styles.css).
  var capKey = '';
  function paintCaption(t) {
    if (!capEl) return;
    var i = lineAt(t), c = i >= 0 ? cueAt(i, t) : null, txt = c ? c.text : '';
    if (c && c.idx) {
      var key = i + ':' + c.from;
      if (capKey !== key) {
        capKey = key; capEl.textContent = '';
        c.idx.forEach(function (k, n) {
          if (n) capEl.appendChild(document.createTextNode(' '));
          var sp = document.createElement('span'); sp.className = 'cap-w'; sp.setAttribute('data-w', String(k)); sp.textContent = LINES[i].words[k].w;
          capEl.appendChild(sp);
        });
      }
      var on = wordIndex(i, t), spans = capEl.children;
      for (var j = 0; j < spans.length; j++) { var hit = Number(spans[j].getAttribute('data-w')) === on; if (spans[j].classList.contains('on') !== hit) spans[j].classList.toggle('on', hit); }
    } else if (capKey || capEl.textContent !== txt) { capKey = ''; capEl.textContent = txt; }
    capEl.classList.toggle('on', i >= 0 && txt !== ''); // no empty pill between two caption cues
    if (i >= 0 && LINES[i].voice) capEl.setAttribute('data-voice', LINES[i].voice); else capEl.removeAttribute('data-voice');
  }
  // { line, id, index, w, s, e } of the word spoken at timeline time t (s/e on the timeline), or null.
  function wordAt(t) {
    var i = lineAt(t);
    if (i < 0 || !hasWords(LINES[i])) return null;
    var k = wordIndex(i, t); if (k < 0) return null;
    var w = LINES[i].words[k], a = LINES[i].at;
    return { line: i, id: LINES[i].id, index: k, w: w.w, s: a + w.s, e: a + w.e };
  }
  function syncVoice(t, playing) {
    var i = lineAt(t);
    paintCaption(t);
    if (i !== cur && cur >= 0 && voices[cur]) voices[cur].pause();
    if (i !== cur) prefetch(i >= 0 ? i : (function () { for (var j = 0; j < LINES.length; j++) if (LINES[j].at > t) return j; return LINES.length; })());
    cur = i;
    if (i < 0) { force = false; return; }
    var el = voice(i), want = t - LINES[i].at;
    setVol(el, voiceGain(i, t));
    // A seek stalls the clip ~0.3 s; re-seeking on a 0.3 s drift while playing fed that stall back into a
    // seek every frame-third (audible chop). While playing: skip while a seek is in flight, tolerate 1 s drift,
    // and wait 1.5 s between corrective seeks. Paused/scrubbing keeps the tight 0.3 s snap.
    // (fix from dudoxx-transformers-gpt, 2026-10-27)
    var now = Date.now(), drift = Math.abs(el.currentTime - want);
    var needSeek = force || (playing ? (!el.seeking && drift > 1.0 && now - (el._seekAt || 0) > 1500) : drift > 0.3);
    if (el.seekable && el.seekable.length && needSeek) { try { el.currentTime = want; el._seekAt = now; } catch (e) { /* not ready */ } }
    force = false;
    if (enabled && playing) tryPlay(el); else el.pause();
  }

  // Inside a user gesture: resume the AudioContext and "prime" every element (play at volume 0, pause at once) so
  // later programmatic play() calls are allowed on browsers that unlock per element (iOS Safari).
  function prime() {
    var els = beds.map(function (b) { return b.el; }).concat(pool.map(function (p) { return p.el; }));
    els.forEach(function (el) {
      if (!el.paused || el._primed) return;
      el._primed = true; el._prime = true; setVol(el, 0);
      var pr = el.play();
      if (pr && pr.then) pr.then(function () { if (el._prime) el.pause(); el._prime = false; }, function () { el._prime = false; el._primed = false; });
    });
  }
  function ctxRunning() { return !ctx || ctx.state === 'running'; }

  window.MOTION_AUDIO = {
    get enabled() { return enabled; },
    enable: function () {
      if (ctx && ctx.state === 'suspended') { var r = ctx.resume(); if (r && r.catch) r.catch(function () {}); }
      enabled = true; return true;
    },
    // Resolves true when playback WITH sound is allowed right now (an element plays and the context runs), false when
    // the browser blocked autoplay (NotAllowedError, or the AudioContext stays suspended). No gesture needed.
    probe: function () {
      return new Promise(function (resolve) {
        var done = false;
        function fin(v) { if (!done) { done = true; resolve(v); } }
        setTimeout(function () { fin(false); }, 800);
        var a; try { a = new Audio(SILENT); } catch (e) { fin(ctxRunning()); return; }
        var pr = a.play();
        if (!pr || !pr.then) { fin(ctxRunning()); return; }
        pr.then(function () {
          if (ctxRunning()) return fin(true);
          var r = ctx.resume();
          if (r && r.then) r.then(function () { fin(ctx.state === 'running'); }, function () { fin(false); }); else fin(false);
        }, function () { fin(false); });
      });
    },
    // Call from a gesture handler (pointerdown/up, touchend, click, keydown). Idempotent and cheap.
    unlock: function () {
      if (ctx && ctx.state !== 'running') { try { var r = ctx.resume(); if (r && r.catch) r.catch(function () {}); } catch (e) { /* not allowed yet */ } }
      prime(); blocked = false;
      return ctxRunning();
    },
    get unlocked() { return ctxRunning() && !blocked; },
    onBlocked: function (cb) { blockedCbs.push(cb); },
    musicVolume: { between: MUSIC_VOL, duck: DUCK_VOL, cap: MUSIC_CAP },
    disable: function () { enabled = false; beds.forEach(function (b) { b.el.pause(); }); voices.forEach(function (v) { if (v) v.pause(); }); },
    cue: function (name) { if (enabled && ctx && ctx.state === 'running' && SFX[name]) SFX[name](); },
    sync: function (t, playing) { lastT = t; lastPlaying = playing; sync(t, playing, duckAmount(t)); syncVoice(t, playing); },
    // Music beds only, independent of `enabled`: the voice keeps playing and the captions keep their timing.
    // Fires a `motion:music` CustomEvent on document ({ detail: { on } }) so the UI can follow.
    setMusic: setMusic,
    toggleMusic: function () { return setMusic(!musicEnabled); },
    get musicOn() { return musicEnabled; },
    music: music, beds: beds, // exposed for review probes (paused, currentTime)
    voices: voices, lines: LINES,
    // v3 word captions: caption(t) paints #caption only (no audio side effect); wordAt(t) -> the spoken word
    caption: paintCaption, wordAt: wordAt, cues: cues
  };
})();
