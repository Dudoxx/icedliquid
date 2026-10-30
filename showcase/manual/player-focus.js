/* Auto-pause on a hidden or blurred view. Classic script.
   - PRIMARY: document 'visibilitychange' with document.hidden -> if playing, MOTION.pause() at once + autoPaused.
   - SECONDARY: window 'blur' -> wait 250 ms, then pause ONLY when document.hasFocus() is still false, no full-screen
     transition happened in the last 800 ms (stamped on every 'motion:mode' event — controls.js fires it at the full
     screen REQUEST, before the browser's blur — and on fullscreenchange / webkitfullscreenchange), and focus is not in
     an IFRAME. Inert when this page itself runs inside an iframe (hub preview, desktop wrapper): the parent taking focus
     is not the viewer leaving.
   - NEVER auto-resume: on return a chip "Paused — continue (Space)" sits over the stage; the chip, Space or Play
     resumes and clears autoPaused (MOTION.play is wrapped for that).
   - Pause goes through MOTION.pause() + MOTION.refresh() (controls.js render), so audio.js sync() stops the clips now.
   window.MOTION_FOCUS = { enabled(), setEnabled(bool), autoPaused, embedded } — default ON, persisted in
   localStorage['ddx-manuals.prefs'].autoPause inside try/catch (file:// storage may throw SecurityError). */
(function () {
  'use strict';
  var M = window.MOTION;
  if (!M) return;
  var tl = M.timeline, KEY = 'ddx-manuals.prefs', BLUR_MS = 250, FS_MS = 800;
  var embedded = false;
  try { embedded = window.self !== window.top; } catch (e) { embedded = true; } // cross-origin parent: embedded
  function prefs() { try { var p = JSON.parse(window.localStorage.getItem(KEY) || '{}'); return p && typeof p === 'object' ? p : {}; } catch (e) { return {}; } }
  function save(p) { try { window.localStorage.setItem(KEY, JSON.stringify(p)); } catch (e) { /* file:// may refuse storage */ } }
  var on = prefs().autoPause !== false;
  var autoPaused = false, fsAt = 0, blurTimer = 0, chip = null;

  function stamp() { fsAt = Date.now(); }
  document.addEventListener('motion:mode', stamp);
  document.addEventListener('fullscreenchange', stamp);
  document.addEventListener('webkitfullscreenchange', stamp);

  function word(k, en) { var T = window.MOTION_UI || {}; return T[k] || en; }
  function showChip() {
    if (!chip) {
      chip = document.createElement('button');
      chip.type = 'button'; chip.className = 'resume-chip'; chip.id = 'resume-chip';
      chip.addEventListener('click', function (e) { e.stopPropagation(); M.play(); if (M.refresh) M.refresh(); });
      (document.getElementById('stage') || document.body).appendChild(chip);
    }
    chip.textContent = word('resumeChip', 'Paused — continue (Space)');
    chip.hidden = false;
  }
  function hideChip() { if (chip) chip.hidden = true; }
  function autoPause() {
    if (!on || !tl.isActive()) return;
    M.pause(); autoPaused = true;
    if (M.refresh) M.refresh();
    showChip();
  }
  var play0 = M.play; // any resume (chip, Space, Play button, a chapter row) clears the auto-pause state
  M.play = function () { autoPaused = false; hideChip(); return play0.apply(M, arguments); };

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { clearTimeout(blurTimer); autoPause(); }
    else if (autoPaused) showChip();
  });
  window.addEventListener('blur', function () {
    if (embedded || !on) return;
    clearTimeout(blurTimer);
    blurTimer = setTimeout(function () {
      if (document.hidden) return; // visibilitychange owns it
      if (document.hasFocus && document.hasFocus()) return;
      if (Date.now() - fsAt < FS_MS) return; // WebKit drops focus while entering / leaving full screen
      var a = document.activeElement; if (a && a.tagName === 'IFRAME') return;
      autoPause();
    }, BLUR_MS);
  });
  window.addEventListener('focus', function () { clearTimeout(blurTimer); });

  window.MOTION_FOCUS = {
    enabled: function () { return on; },
    setEnabled: function (v) {
      on = !!v; var p = prefs(); p.autoPause = on; save(p);
      if (!on) { clearTimeout(blurTimer); autoPaused = false; hideChip(); }
      return on;
    },
    get autoPaused() { return autoPaused; },
    embedded: embedded
  };
})();
