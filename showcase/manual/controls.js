/* Playback controls bound to window.MOTION: play/pause, replay, scrub, sound on/off, music on/off, captions,
   full screen, help. Keyboard: Space = play/pause · R = replay · Left/Right = -/+ 5 s (Shift: 0.5 s) ·
   Home/End · C = captions on/off · M = music on/off (voice keeps playing) · F = full screen · ? or H = help ·
   Esc = close help / pseudo full screen. (nav.js adds T = agenda, [ / ] = chapter.) Any key with Ctrl, Cmd or
   Alt held is ignored. A click or tap on empty stage area = play/pause (never on a control, dialog or the gate).
   v3 ids: #btn-music, #btn-cap, #btn-full, #btn-help (markup since v4), #help, #motion-live (created here).
   v4 bar: icon-only buttons. ICONS = window.MOTION_ICONS (icons.js, inline SVG). icon() paints the icon and sets
   aria-label + data-tip (the CSS tooltip) together, so a state change swaps icon, label, tip and aria-pressed in
   the same call (same frame). Toggles: aria-pressed true = ON. The label names the current state ("Music on").
   No text-label buttons are created here; the start gate "Play with sound" is the one worded button.
   Scrub resolution = 0.1 s whatever the length (a 25 min piece no longer jumps 1.5 s per step) and
   it snaps to a chapter start within 0.4 s. No speed control: narration clips play at 1x, a faster
   timeline would desync them.

   v2b player:
   - SOUND IS ON AT START. controls.js asks MOTION_AUDIO.probe() whether playback with sound is allowed. Yes ->
     the timeline and the audio start together. No (autoplay blocked) -> the timeline stays at its start and a
     large "Play with sound" button sits over the stage; one tap / click / Enter / Space unlocks the audio and
     plays both in sync. Reduced motion never autoplays: the same button is shown. A play() rejected later
     (iOS) shows the button again. Any first pointerdown / keydown / touchstart also unlocks the AudioContext.
   - RESPONSIVE. fit() sets --stage-w (the largest stage of the format's ratio that fits the width AND the height
     left under the real controls + chapter row) and --chrome-w (the controls row may be wider than a short-landscape
     stage). No horizontal page scroll at any width >= 320 px; the stage + controls + chips are packed together.
   - FULL SCREEN button (and F): the stage + controls container goes full screen; where the Fullscreen API is
     missing (iPhone Safari) a CSS class `is-pseudo-fullscreen` fills the viewport instead.
   Words: window.MOTION_UI (playWithSound, fullscreen, exitFullscreen, soundOn, soundOff ...), English fallback.

   Player:
   - VIEWER MODES: main.viewport is the .viewer, data-mode="inline | full | dock". MOTION.viewer = { mode(), set(m) };
     every change fires document 'motion:mode' { from, to } (a full-screen REQUEST fires it at once, so player-focus.js
     can stamp the transition before the browser's blur). full = Fullscreen API, else is-pseudo-fullscreen. dock = a mini
     player bottom-right (320-480 px): ONE CSS transform (translate + scale) on the viewer, fit() frozen, so the stage
     box, hotspot %, lockWidth and AUDIT() never change (FM3). The dock bar (#dock-bar: play, time, expand, close) is
     built here, outside the viewer, so it is not scaled. Esc / D / expand = back to inline.
   - KEYS: ONE table drives the key handler AND the help sheet (they cannot drift). nav.js / lang-switch.js only
     register MOTION.menu, MOTION.step, MOTION.skipIntro and window.MOTION_LANG_SWITCH; they bind no global keys.
   - CROSS-SITE LANDING (lang-switch.js): ?cap=0|1&mus=0|1&snd=0|1 restore the toggles before anything plays;
     ?play=1 retries playback and, if the new document refuses autoplay, shows the start gate worded "Continue" that
     resumes at the landed time; MOTION.landing.missing -> a toast (MOTION.toast). */
(function () {
  'use strict';
  var M = window.MOTION;
  if (!M) return;
  var tl = M.timeline;
  var A = window.MOTION_AUDIO || null;
  var play = document.getElementById('btn-play');
  var replay = document.getElementById('btn-replay');
  var scrub = document.getElementById('scrub');
  var time = document.getElementById('time');
  var sound = document.getElementById('btn-sound');
  var view = document.querySelector('.viewport');
  var stage = document.getElementById('stage');
  var dragging = false;
  var wrap = scrub.closest ? scrub.closest('.scrubwrap') : null; // styles.css paints the played part from --p (0..1)
  var STEPS = Math.max(1000, Math.round(tl.duration() * 10));
  scrub.max = String(STEPS);
  var starts = (M.chapters || []).map(function (c) { return c.t; });
  function snap(t) { for (var i = 0; i < starts.length; i++) if (Math.abs(t - starts[i]) < 0.4) return starts[i] + 0.01; return t; }
  function mmss(t) { var s = Math.max(0, Math.floor(t)); return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }
  // "0:28 / 10:09" (tabular figures in styles.css); a piece under 1 min keeps tenths: "4.2 / 12.0 s"
  function clock(t) { var d = tl.duration(); return d >= 60 ? mmss(t) + ' / ' + mmss(d) : Math.max(0, t).toFixed(1) + ' / ' + d.toFixed(1) + ' s'; }
  // Button words: window.MOTION_UI (the piece runtime sets it per ?lang=), else English.
  var T = window.MOTION_UI || {};
  var EN = { play: 'Play', pause: 'Pause', replay: 'Replay', soundOn: 'Sound on', soundOff: 'Sound off', playWithSound: 'Play with sound', fullscreen: 'Full screen', exitFullscreen: 'Exit full screen',
    // v3 player: Music / Captions / Help buttons, the help dialog and the live region (runtime.js carries FR/DE/ES)
    music: 'Music', musicOn: 'Music on', musicOff: 'Music off', captions: 'Captions', captionsOn: 'Captions on', captionsOff: 'Captions off',
    help: 'Help', helpTitle: 'Keyboard shortcuts', helpClose: 'Close', playing: 'Playing', paused: 'Paused',
    keyPlay: 'Play or pause (or click the picture)', keyReplay: 'Replay from the start', keySeek: 'Back or forward 5 s (Shift: 0.5 s)',
    keyEnds: 'Go to the start or the end', keyMusic: 'Music on or off (the voice keeps playing)', keyCaptions: 'Captions on or off',
    keyFull: 'Full screen on or off', keyAgenda: 'Open or close the agenda', keyChapter: 'Previous or next chapter', keyHelp: 'Show or hide this help',
    agenda: 'Agenda', language: 'Language',
    // v5 (runtime.js carries FR/DE/ES rows)
    menu: 'Menu', miniPlayer: 'Mini player', undock: 'Back to the full player', closeMini: 'Close the mini player', skipIntro: 'Skip intro',
    autoPause: 'Pause when I leave the page', shortcuts: 'Keyboard shortcuts', close: 'Close', 'continue': 'Continue', resumeChip: 'Paused — continue (Space)',
    notInLanguage: 'This chapter is not in this language — you are at the next one.', allManuals: 'All manuals',
    keyDock: 'Mini player on or off', keyMenu: 'Open or close the menu', keyLanguage: 'Choose the language', keySkip: 'Skip the intro (during the intro)',
    keyEsc: 'Close a panel or leave the mini player' };
  Object.keys(EN).forEach(function (k) { if (T[k] == null) T[k] = EN[k]; });
  // ---- icons: one helper sets icon + aria-label + tooltip; a repeat call with the same state is a no-op -----
  var ICONS = window.MOTION_ICONS || {};
  // key = the shortcut shown in the tooltip only ("Music off (M)", same format as nav.js); aria-label stays the word.
  function icon(btn, name, label, key) {
    if (!btn) return;
    if (ICONS[name] && btn.getAttribute('data-icon') !== name) { btn.innerHTML = ICONS[name]; btn.setAttribute('data-icon', name); } // no icons.js: keep runtime.js's text
    if (label == null) return;
    var tip = key ? label + ' (' + key + ')' : label; // compare both: runtime.js may already have set the label alone
    if (btn.getAttribute('aria-label') !== label) btn.setAttribute('aria-label', label);
    if (btn.getAttribute('data-tip') !== tip) btn.setAttribute('data-tip', tip);
  }
  function pressed(btn, on) { if (btn) btn.setAttribute('aria-pressed', on ? 'true' : 'false'); }
  icon(replay, 'replay', T.replay, 'R');
  // nav.js binds menu + skip, lang-switch.js the language pop-up; controls.js only gives them their icon + words.
  icon(document.getElementById('btn-menu') || document.getElementById('btn-agenda'), 'menu', T.menu, 'T');
  icon(document.getElementById('btn-lang'), 'language', T.language, 'L');
  icon(document.getElementById('btn-skip'), 'skip', T.skipIntro, 'S');
  var seek0 = M.seek; // keep readout, scrub, Play label and music in sync after any seek
  M.seek = function (t) { var r = seek0(t); render(); return r; };

  function render() {
    if (!dragging) scrub.value = String(Math.round(tl.progress() * STEPS));
    if (wrap) wrap.style.setProperty('--p', (Number(scrub.value) / STEPS).toFixed(4));
    var txt = clock(tl.time());
    if (time.textContent !== txt) time.textContent = txt;
    var playing = tl.isActive();
    icon(play, playing ? 'pause' : 'play', playing ? T.pause : T.play, T.capSpace || 'Space');
    // #scrub aria-valuetext names the time and the chapter ("1:05 / 10:09 · 03 · Upload")
    var ch = M.chapterAt ? M.chapterAt(tl.time()) : null, vt = txt + (ch && ch.label ? ' · ' + ch.label : '');
    if (!scrub.hasAttribute('data-vt-owner') && scrub.getAttribute('aria-valuetext') !== vt) scrub.setAttribute('aria-valuetext', vt); // piece sites: nav.js writes it
    if (gate && playing) hideStart(); // the viewer pressed Play (or a chapter) instead of the start button
    if (A && A.sync) A.sync(tl.time(), playing); // music bed follows the timeline
    if (docked && dockPlay) { icon(dockPlay, playing ? 'pause' : 'play', playing ? T.pause : T.play, T.capSpace || 'Space'); if (dockTime.textContent !== txt) dockTime.textContent = txt; }
  }
  M.refresh = render; // v5: player-focus.js pauses from outside the bar — the icon and audio.js must follow at once
  // While PLAYING, GSAP skips nothing but calls no painter: presets that paint from t (packets,
  // counters, odometers, typing, the NN / TOTAL spine, the chapter bar) need MOTION.render every
  // frame, or they freeze until the next seek. Piece sites expose M.render; plain sites do not.
  function frame() { if (typeof M.render === 'function') M.render(tl.time()); render(); }
  tl.eventCallback('onUpdate', frame);
  tl.eventCallback('onComplete', frame);

  function toggle() { if (tl.isActive()) M.pause(); else M.play(); render(); }
  play.addEventListener('click', toggle);
  replay.addEventListener('click', function () { M.replay(); render(); });

  var scrubbedAt = 0; // a scrub drag that ends over the stage must not also toggle play
  scrub.addEventListener('input', function () {
    dragging = true; scrubbedAt = Date.now();
    M.seek(snap((Number(scrub.value) / STEPS) * tl.duration()));
    render();
  });
  scrub.addEventListener('change', function () { dragging = false; scrubbedAt = Date.now(); render(); });

  // ---- sound button: ON at load --------------------------------------------------------------
  function soundUi() {
    var on = !!(A && A.enabled);
    icon(sound, on ? 'soundOn' : 'soundOff', on ? T.soundOn : T.soundOff); pressed(sound, on);
  }
  sound.addEventListener('click', function () {
    if (!A) return;
    if (A.enabled) A.disable(); else { A.enable(); if (A.unlock) A.unlock(); } // this click IS a gesture
    soundUi();
    render();
  });
  soundUi();

  // ---- music button (M): the beds only; the voice and the captions keep going ---------------------
  // aria-pressed true = ON (Sound, Music, Captions). Icon, label and tip name the state ("Music off" = slashed note).
  var musicBtn = document.getElementById('btn-music');
  function musicUi() {
    if (!musicBtn) return;
    var on = A && A.musicOn != null ? !!A.musicOn : true;
    icon(musicBtn, on ? 'musicOn' : 'musicOff', on ? T.musicOn : T.musicOff, 'M'); pressed(musicBtn, on);
  }
  function toggleMusic() { if (A && A.toggleMusic) A.toggleMusic(); musicUi(); render(); }
  if (musicBtn) musicBtn.addEventListener('click', toggleMusic);
  document.addEventListener('motion:music', musicUi);
  musicUi();

  // ---- captions button (C) ----------------------------------------------------------------------
  var cap = document.getElementById('caption'), capBtn = document.getElementById('btn-cap');
  function capUi() {
    if (!capBtn) return;
    var on = !(cap && cap.classList.contains('is-off'));
    icon(capBtn, on ? 'captionsOn' : 'captionsOff', on ? T.captionsOn : T.captionsOff, 'C'); pressed(capBtn, on);
  }
  function captions() { if (cap) cap.classList.toggle('is-off'); capUi(); }
  if (capBtn) capBtn.addEventListener('click', captions);
  capUi();

  // ---- full screen: real API, else a CSS pseudo mode (iPhone Safari has no element fullscreen) ---
  // v4: #btn-full is markup (.ctl-toggles, last). No button is created here.
  var pseudo = false, fullBtn = document.getElementById('btn-full');
  function fsEl() { return document.fullscreenElement || document.webkitFullscreenElement || null; }
  function isFull() { return !!fsEl() || pseudo; }
  function fullUi() {
    if (!fullBtn) return;
    var on = isFull();
    icon(fullBtn, on ? 'exitFullscreen' : 'fullscreen', on ? T.exitFullscreen : T.fullscreen, 'F'); pressed(fullBtn, on);
  }
  function setPseudo(on) {
    pseudo = on;
    if (view) view.classList.toggle('is-pseudo-fullscreen', on);
    document.body.classList.toggle('has-pseudo-fullscreen', on);
    fullUi(); fit(); syncMode();
  }
  function enterFull() {
    if (docked) setDock(false);
    setMode('full'); // announce the request now: the browser blurs the window before fullscreenchange (FM2)
    var v = view || document.documentElement, rq = v.requestFullscreen || v.webkitRequestFullscreen;
    if (!rq) return setPseudo(true);
    try { var r = rq.call(v); if (r && r.catch) r.catch(function () { setPseudo(true); }); } catch (e) { setPseudo(true); }
  }
  function exitFull() {
    if (fsEl()) { var ex = document.exitFullscreen || document.webkitExitFullscreen; if (ex) { setMode(docked ? 'dock' : 'inline'); ex.call(document); } } // announce the exit request too (FM2)
    if (pseudo) setPseudo(false);
  }
  function fullscreen() { if (isFull()) exitFull(); else enterFull(); }
  if (fullBtn) fullBtn.addEventListener('click', fullscreen);
  document.addEventListener('fullscreenchange', function () { fullUi(); fit(); syncMode(); });
  document.addEventListener('webkitfullscreenchange', function () { fullUi(); fit(); syncMode(); });
  fullUi();

  // ---- v5 viewer modes: inline | full | dock -------------------------------------------------------
  var docked = false, dockBtn = document.getElementById('btn-dock'), dockBar = null, dockPlay = null, dockTime = null;
  var DOCK_GAP = 16, DOCK_BAR = 44; // styles.css .dock-bar uses the same 16 px inset and 44 px height
  function modeNow() { return isFull() ? 'full' : docked ? 'dock' : 'inline'; }
  function setMode(to) {
    if (!view) return;
    var from = view.getAttribute('data-mode') || 'inline';
    if (from === to) return;
    view.setAttribute('data-mode', to);
    var ev; try { ev = new CustomEvent('motion:mode', { detail: { from: from, to: to } }); } catch (e) { ev = document.createEvent('CustomEvent'); ev.initCustomEvent('motion:mode', false, false, { from: from, to: to }); }
    document.dispatchEvent(ev);
  }
  function syncMode() { setMode(modeNow()); }
  function dockUi() { if (dockBtn) { icon(dockBtn, 'dock', T.miniPlayer, 'D'); pressed(dockBtn, docked); } }
  function dockLayout() { // the mini size from the INLINE stage box (offsetWidth ignores the transform)
    if (!docked || !view || !stage) return;
    var sw = stage.offsetWidth, sh = stage.offsetHeight; if (!sw || !sh) return;
    var vw = document.documentElement.clientWidth, vh = window.innerHeight, room = Math.max(160, vw - 2 * DOCK_GAP);
    var w = Math.min(room, Math.max(320, Math.min(480, vw * 0.3))), k = w / sw;
    var x = vw - DOCK_GAP - w, y = Math.max(DOCK_GAP, vh - DOCK_GAP - DOCK_BAR - sh * k);
    view.style.transform = 'translate(' + x.toFixed(1) + 'px, ' + y.toFixed(1) + 'px) scale(' + k.toFixed(5) + ')';
    document.documentElement.style.setProperty('--dock-w', Math.floor(w) + 'px');
  }
  function buildDockBar() {
    dockBar = document.createElement('div');
    dockBar.className = 'dock-bar'; dockBar.id = 'dock-bar'; dockBar.hidden = true;
    dockBar.setAttribute('role', 'group'); dockBar.setAttribute('aria-label', T.miniPlayer);
    function b(id) { var x = document.createElement('button'); x.type = 'button'; x.className = 'ctl-btn'; x.id = id; dockBar.appendChild(x); return x; }
    dockPlay = b('btn-dock-play');
    dockTime = document.createElement('output'); dockTime.className = 'ctl-time dock-time'; dockBar.appendChild(dockTime);
    var up = b('btn-undock'), x = b('btn-dock-close');
    icon(up, 'undock', T.undock, 'D'); icon(x, 'close', T.closeMini, 'Esc');
    dockPlay.addEventListener('click', toggle);
    up.addEventListener('click', function () { setDock(false); });
    x.addEventListener('click', function () { M.pause(); setDock(false); });
    document.body.appendChild(dockBar);
  }
  function closePanels() {
    if (typeof closeHelp === 'function' && help) closeHelp();
    if (M.menu && M.menu.isOpen && M.menu.isOpen()) M.menu.close();
    if (window.MOTION_LANG_SWITCH && window.MOTION_LANG_SWITCH.close) window.MOTION_LANG_SWITCH.close(true);
  }
  function setDock(on) {
    if (!view || !stage || on === docked) return;
    if (on && isFull()) exitFull();
    closePanels();
    if (on && !dockBar) buildDockBar();
    docked = on;
    syncMode(); // data-mode="dock" first: the CSS pins the viewer at 0,0 before the transform is measured
    if (dockBar) dockBar.hidden = !on;
    if (on) dockLayout(); else { view.style.transform = ''; queueFit(); }
    dockUi(); render();
    if (!on && dockBtn) { try { dockBtn.focus({ preventScroll: true }); } catch (e) { dockBtn.focus(); } }
  }
  if (dockBtn) dockBtn.addEventListener('click', function () { setDock(!docked); });
  dockUi();
  M.viewer = {
    mode: modeNow,
    set: function (m) {
      if (m === 'dock') setDock(true);
      else if (m === 'full') { if (!isFull()) enterFull(); }
      else { if (docked) setDock(false); if (isFull()) exitFull(); }
      return modeNow();
    }
  };

  // ---- live region: "Paused" / "Playing" after a click or key toggle (the button label alone is silent) --
  var live = document.createElement('p');
  live.className = 'sr-only'; live.id = 'motion-live'; live.setAttribute('aria-live', 'polite');
  (view || document.body).appendChild(live);
  function announce() {
    var msg = tl.isActive() ? T.playing : T.paused;
    live.textContent = ''; // clear first, so the same word twice is announced twice
    setTimeout(function () { live.textContent = msg; }, 60);
  }

  // ---- help dialog (? / H / the Help button) ----------------------------------------------------
  // Inside .viewport (the full-screen element), fixed over the page. Opening pauses; closing resumes only when
  // it was playing, and gives focus back to the opener. Key glyphs: one place (KEYS), named caps localised by keyCap();
  // the descriptions come from MOTION_UI. Rows with `need` show only when nav.js built that feature.
  // v5: ONE table — k = e.key values (lower case), cap = the help-sheet glyphs, d = the MOTION_UI description,
  // need() = the row exists only when that feature was built (nav.js menu, lang-switch.js siblings, skip intro).
  function LS() { return window.MOTION_LANG_SWITCH || null; }
  var KEYS = [
    { k: [' ', 'k'], cap: 'Space K', d: 'keyPlay', run: function () { toggle(); announce(); } },
    { k: ['arrowleft', 'arrowright'], cap: '← →', d: 'keySeek', run: function (e) { var j = e.shiftKey ? 15 : 5; M.seek(tl.time() + (e.key === 'ArrowLeft' ? -j : j)); render(); } },
    { k: ['[', ']'], cap: '[ ]', d: 'keyChapter', need: function () { return !!M.step; }, run: function (e) { M.step(e.key === ']' ? 1 : -1); } },
    { k: ['home', 'end'], cap: 'Home End', d: 'keyEnds', run: function (e) { M.seek(e.key === 'Home' ? 0 : tl.duration()); render(); } },
    { k: ['r'], cap: 'R', d: 'keyReplay', run: function () { M.replay(); render(); } },
    { k: ['m'], cap: 'M', d: 'keyMusic', run: function () { toggleMusic(); } },
    { k: ['c'], cap: 'C', d: 'keyCaptions', run: function () { captions(); } },
    { k: ['f'], cap: 'F', d: 'keyFull', run: function () { fullscreen(); } },
    { k: ['d'], cap: 'D', d: 'keyDock', need: function () { return !!dockBtn; }, run: function () { setDock(!docked); } },
    { k: ['t'], cap: 'T', d: 'keyMenu', need: function () { return !!(M.menu && M.menu.available); }, run: function () { M.menu.toggle(); } },
    { k: ['l'], cap: 'L', d: 'keyLanguage', need: function () { return !!(LS() && LS().available); }, run: function () { LS().toggle(); } },
    { k: ['s'], cap: 'S', d: 'keySkip', need: function () { return !!M.skipIntro; }, run: function () { if (M.inIntro && M.inIntro()) M.skipIntro(); } },
    { k: ['?', 'h'], cap: '? H', d: 'keyHelp', run: function () { openHelp(); } },
    { k: ['escape'], cap: 'Esc', d: 'keyEsc', run: function () { escapeKey(); } }
  ];
  var KEY_MAP = {};
  KEYS.forEach(function (row) { row.k.forEach(function (k) { KEY_MAP[k] = row; }); });
  M.keys = KEYS; // read-only view of the key map
  function escapeKey() { // Esc stacking: help (handled above) > language pop-up > menu > mini player > pseudo full screen
    if (LS() && LS().close && LS().close()) return;
    if (M.menu && M.menu.isOpen && M.menu.isOpen()) { M.menu.close(); return; }
    if (docked) { setDock(false); return; }
    if (pseudo) setPseudo(false);
  }
  var help = document.createElement('div'), helpRows = [];
  help.id = 'help'; help.className = 'help-overlay'; help.hidden = true;
  help.setAttribute('role', 'dialog'); help.setAttribute('aria-modal', 'true'); help.setAttribute('aria-labelledby', 'help-title');
  var helpPanel = document.createElement('div'); helpPanel.className = 'help-panel';
  var helpTitle = document.createElement('h2'); helpTitle.id = 'help-title'; helpTitle.textContent = T.helpTitle;
  var helpList = document.createElement('ul'); helpList.className = 'help-keys';
  // v4.1 (R1 L2): named key caps come from MOTION_UI (capSpace / capHome / capEnd / capEsc, en/fr/de/es lockstep);
  // English stays the fallback. Symbol caps (M, ← →, [ ], ? H) are the same in every language.
  function keyCap(g) { var m = { Space: T.capSpace, Home: T.capHome, End: T.capEnd, Esc: T.capEsc }[g]; return m || g; }
  KEYS.forEach(function (k) {
    var li = document.createElement('li'), keys = document.createElement('span'), d = document.createElement('span');
    keys.className = 'help-k';
    k.cap.split(' ').forEach(function (g) { var kb = document.createElement('kbd'); kb.textContent = keyCap(g); keys.appendChild(kb); });
    d.textContent = T[k.d];
    li.setAttribute('data-key', k.k[0]);
    li.appendChild(keys); li.appendChild(d); helpList.appendChild(li);
    helpRows.push({ li: li, need: k.need || null });
  });
  var helpClose = document.createElement('button');
  helpClose.type = 'button'; helpClose.className = 'help-close'; helpClose.textContent = T.helpClose;
  helpPanel.appendChild(helpTitle); helpPanel.appendChild(helpList); helpPanel.appendChild(helpClose);
  help.appendChild(helpPanel);
  (view || document.body).appendChild(help);
  // v4: #btn-help is markup (.ctl-toggles). A page without it still gets ? / H.
  var helpBtn = document.getElementById('btn-help');
  if (helpBtn) { icon(helpBtn, 'help', T.help, '?'); helpBtn.setAttribute('aria-haspopup', 'dialog'); helpBtn.setAttribute('aria-expanded', 'false'); helpBtn.setAttribute('aria-controls', 'help'); }
  var helpWasPlaying = false, helpOpener = null;
  function helpOpen() { return !help.hidden; }
  function openHelp() {
    if (helpOpen()) return;
    helpOpener = document.activeElement;
    helpWasPlaying = tl.isActive();
    if (helpWasPlaying) M.pause();
    if (docked) setDock(false); // panels are fixed inside the viewer: never open one inside the scaled mini player
    helpRows.forEach(function (r) { r.li.hidden = !!(r.need && !r.need()); });
    help.hidden = false; if (helpBtn) helpBtn.setAttribute('aria-expanded', 'true');
    try { helpClose.focus({ preventScroll: true }); } catch (e) { helpClose.focus(); }
    render();
  }
  function closeHelp() {
    if (!helpOpen()) return;
    help.hidden = true; if (helpBtn) helpBtn.setAttribute('aria-expanded', 'false');
    // Back to the opener. Opened by a key from the page (opener = body): blur, so a later Space plays/pauses
    // instead of re-pressing the Help button.
    var back = helpOpener && helpOpener.focus && helpOpener !== document.body && document.contains(helpOpener) ? helpOpener : null;
    if (back) { try { back.focus({ preventScroll: true }); } catch (e) { back.focus(); } }
    else if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    helpOpener = null;
    if (helpWasPlaying) M.play();
    helpWasPlaying = false;
    render();
  }
  function toggleHelp() { if (helpOpen()) closeHelp(); else openHelp(); }
  M.help = { open: openHelp, close: closeHelp, isOpen: helpOpen };
  if (helpBtn) helpBtn.addEventListener('click', toggleHelp);
  helpClose.addEventListener('click', closeHelp);
  help.addEventListener('click', function (e) { if (e.target === help) closeHelp(); }); // the backdrop, not the panel
  function trapTab(e) {
    var f = Array.prototype.filter.call(help.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'),
      function (el) { return !el.disabled && el.offsetParent !== null; });
    if (!f.length) { e.preventDefault(); return; }
    var first = f[0], last = f[f.length - 1], a = document.activeElement;
    if (e.shiftKey && (a === first || !help.contains(a))) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && (a === last || !help.contains(a))) { e.preventDefault(); first.focus(); }
  }

  // ---- click / tap on the stage = play / pause ------------------------------------------------------
  // A touch tap arrives as a click (styles.css sets touch-action: manipulation, no double-tap zoom delay).
  // Ignored: the start gate (it handles its own click and is gone by the time this bubbles - closest() still
  // sees it on the detached target), any control or dialog, the end of a scrub drag, a text selection.
  var NOT_STAGE = 'button, a, input, select, textarea, label, [role="dialog"], [role="group"], .controls, .chips, .chapters, .lang-pop, .agenda-overlay, .menu-overlay, .start-gate, .resume-chip, .player-toast';
  if (stage) stage.addEventListener('click', function (e) {
    if (gate || helpOpen()) return;
    var tg = e.target;
    if (tg && tg.closest && tg.closest(NOT_STAGE)) return;
    if (Date.now() - scrubbedAt < 300) return;
    var sel = window.getSelection ? window.getSelection() : null;
    if (sel && sel.toString()) return;
    toggle(); announce();
  });

  // ---- responsive fit ------------------------------------------------------------------------
  // The largest stage of the format's aspect ratio that fits the width AND (height - the real chrome height).
  // The chrome (controls + chapter row) wraps with its own width, so this iterates; W only ever shrinks, so it ends.
  var fitting = false;
  function px(v) { return parseFloat(v) || 0; }
  function chromeHeight(gap) {
    var h = 0, n = 0;
    Array.prototype.forEach.call(view.children, function (c) {
      if (c === stage || c.hidden) return;
      var cs = getComputedStyle(c);
      if (cs.display === 'none' || cs.position === 'fixed' || cs.position === 'absolute') return;
      h += c.getBoundingClientRect().height; n++;
    });
    return h + n * gap; // each chrome row also adds one grid gap above it
  }
  function fit() {
    if (docked) { dockLayout(); return; } // v5: the stage box is frozen in dock mode (FM3)
    if (!view || !stage || fitting) return;
    fitting = true;
    try {
      var vcs = getComputedStyle(view), gap = px(vcs.rowGap);
      var padX = px(vcs.paddingLeft) + px(vcs.paddingRight), padY = px(vcs.paddingTop) + px(vcs.paddingBottom);
      var availW = document.documentElement.clientWidth - padX, availH = window.innerHeight - padY - 1;
      var ar = parseFloat(getComputedStyle(stage).getPropertyValue('--arn')) || 16 / 9;
      var W = availW, k, ch;
      function apply(w) {
        view.style.setProperty('--stage-w', Math.floor(w) + 'px');
        view.style.setProperty('--chrome-w', Math.floor(Math.min(availW, Math.max(w, 880))) + 'px');
      }
      for (k = 0; k < 6; k++) {
        apply(W); ch = chromeHeight(gap);
        var Wn = Math.min(W, (availH - ch) * ar);
        if (Math.abs(Wn - W) < 1) break;
        W = Wn;
      }
      W = Math.max(200, Math.min(W, availW));
      apply(W);
      var over = W / ar + chromeHeight(gap) - availH; // the last step was not measured: one correction
      if (over > 0.5 && W > 200) apply(Math.max(200, W - over * ar));
    } finally { fitting = false; }
  }
  var fitQueued = false;
  function queueFit() { if (fitQueued) return; fitQueued = true; requestAnimationFrame(function () { fitQueued = false; fit(); }); }
  window.addEventListener('resize', queueFit);
  window.addEventListener('orientationchange', queueFit);
  window.addEventListener('load', queueFit);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', queueFit);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(queueFit);
  if (window.ResizeObserver && view) {
    var ro = new ResizeObserver(queueFit);
    Array.prototype.forEach.call(view.children, function (c) { if (c !== stage) ro.observe(c); });
  }
  fit();

  // ---- start gate: "Play with sound" ----------------------------------------------------------
  var gate = null, resumeAt = null;
  // Poster: while the gate waits, show a meaningful frame (window.MOTION_POSTER s, default 4 s) instead of an empty
  // stage; the tap seeks back to where the viewer was and plays from there.
  var POSTER = Number(window.MOTION_POSTER != null ? window.MOTION_POSTER : 4);
  function showStart() {
    if (gate || !stage) return;
    M.pause();
    resumeAt = tl.time();
    if (resumeAt < 0.1 && POSTER > 0 && POSTER < tl.duration()) M.seek(POSTER);
    gate = document.createElement('div');
    gate.className = 'start-gate';
    var b = document.createElement('button');
    b.type = 'button'; b.id = 'btn-start'; b.textContent = M.landing ? T['continue'] : T.playWithSound; // v5: after a language switch
    if (M.landing) gate.classList.add('is-continue');
    gate.appendChild(b);
    gate.addEventListener('click', startNow); // the whole stage is a target, not only the button
    stage.appendChild(gate);
    try { b.focus({ preventScroll: true }); } catch (e) { b.focus(); }
    render();
  }
  function hideStart() { if (gate && gate.parentNode) gate.parentNode.removeChild(gate); gate = null; }
  function startNow() {
    if (A && A.unlock) A.unlock(); // inside the gesture: resume the AudioContext, prime the audio elements
    var at = resumeAt; hideStart(); resumeAt = null;
    if (at != null && Math.abs(tl.time() - at) > 0.05) M.seek(at);
    if (!tl.isActive()) M.play();
    render();
  }
  // Any first gesture unlocks the audio (iOS needs touchend / click, Chrome pointerdown / keydown).
  var GESTURES = ['pointerdown', 'pointerup', 'touchstart', 'touchend', 'click', 'keydown'];
  function onGesture() {
    if (!A || !A.unlock) return;
    A.unlock();
    if (A.unlocked) GESTURES.forEach(function (g) { document.removeEventListener(g, onGesture, true); });
  }
  GESTURES.forEach(function (g) { document.addEventListener(g, onGesture, { capture: true, passive: true }); });
  if (A && A.onBlocked) A.onBlocked(function () { if (tl.isActive()) showStart(); }); // iOS: a clip refused mid-piece

  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return; // Cmd+F, Ctrl+M, Alt+R ... belong to the browser and the OS
    var tg = e.target, tag = tg && tg.tagName, key = (e.key || '').toLowerCase();
    // Help open = modal: only Tab (trapped), Esc, ? and H act; nav.js (registered after this file) never sees the key.
    if (helpOpen()) {
      if (e.key === 'Tab') { trapTab(e); return; }
      if (tag === 'BUTTON' && (e.key === ' ' || e.key === 'Enter')) return; // the Close button handles itself
      e.stopImmediatePropagation();
      if (e.key === 'Escape' || e.key === '?' || key === 'h') { e.preventDefault(); closeHelp(); }
      return;
    }
    // text fields keep every key; the range input (#scrub) keeps its own arrows / Home / End / Page keys
    if (tag === 'TEXTAREA' || tag === 'SELECT' || (tg && tg.isContentEditable) || (tag === 'INPUT' && tg.type !== 'range')) return;
    if (tag === 'INPUT' && /^(arrow|home$|end$|page)/.test(key)) return;
    if (gate && (e.key === ' ' || e.key === 'Enter') && tag !== 'BUTTON') { e.preventDefault(); startNow(); return; }
    if (tag === 'BUTTON' && (e.key === ' ' || e.key === 'Enter')) return; // a focused button handles its own Space
    // master menu = modal too: only T and Esc act here (nav.js handles arrows, Home/End, Tab inside it)
    if (M.menu && M.menu.isOpen && M.menu.isOpen() && key !== 't' && key !== 'escape') return;
    var row = KEY_MAP[key];
    if (!row || (row.need && !row.need())) return;
    if (key !== 'escape') e.preventDefault();
    row.run(e);
  });

  // ---- v5 toast (MOTION.toast): one solid token line over the stage, 5 s ---------------------------------
  var toastEl = null, toastTimer = 0;
  function toast(msg) {
    if (!msg || !stage) return;
    if (!toastEl) { toastEl = document.createElement('p'); toastEl.className = 'player-toast'; toastEl.id = 'player-toast'; toastEl.setAttribute('role', 'status'); stage.appendChild(toastEl); }
    toastEl.textContent = msg; toastEl.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { toastEl.hidden = true; }, 5000);
  }
  M.toast = toast;

  // ---- v5 cross-site landing: restore the toggles BEFORE anything plays (lang-switch.js query) ----------------
  var Q = new URLSearchParams(location.search);
  if (Q.get('cap') === '0' && cap && !cap.classList.contains('is-off')) captions();
  if (Q.get('mus') === '0' && A && A.setMusic && A.musicOn) { A.setMusic(false); musicUi(); }
  if (Q.get('snd') === '0' && A && A.enabled) { A.disable(); soundUi(); }
  if (M.landing && M.landing.missing) toast(T.notInLanguage);

  render();
  // Startup. Reduced motion: never autoplay, the viewer starts it. Otherwise ask the browser whether playback WITH
  // sound is allowed: yes -> play at once; no -> hold at the start and show the "Play with sound" button.
  // v5: after a cross-site switch the new document has NO user activation — play only when the source was playing
  // (?play=1), and a refusal shows the "Continue" gate at the landed time (never the poster).
  if (M.landing && Q.get('play') !== '1') { /* hold, paused, on the landed frame */ }
  else if (M.reducedMotion || !A || !A.probe) { if (M.reducedMotion) showStart(); else M.play(); }
  else A.probe().then(function (ok) {
    if (ok || A.unlocked) { if (!tl.isActive() && !gate) M.play(); } else showStart();
  });
})();
