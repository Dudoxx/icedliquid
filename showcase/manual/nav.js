/* Chapter markers on the scrubber (from MOTION.chapters) and the v5 MASTER MENU (replaces the v4 agenda overlay).
   Markers (v4 shard-03 contract, unchanged): one button.scrub-mark[tabindex=-1] per chapter inside #ticks, at c.t/dur,
   aria-label 'NN · label', data-tip 'NN · label · m:ss', .is-current on the active chapter; #scrub gets aria-valuetext
   '<Chapter> NN · label · m:ss'. Markers stay OUT of the tab order (24+ tab stops would bury the toggles): keyboard
   users reach chapters with [ / ] and the menu.
   Master menu: #menu.menu-overlay[role=dialog][aria-modal] > .menu-panel, a left
   panel opened by #btn-menu or T. Head = piece title + close. Rows grouped by act when PIECE chapters carry `act`, else
   flat; each row button.menu-row[data-id] = NN · title · m:ss, the current one aria-current + a progress fill (--fill).
   Foot (.menu-foot): Skip intro (first chapter only) · Language (window.MOTION_LANG_SWITCH.open) · Auto-pause switch
   (window.MOTION_FOCUS) · Keyboard shortcuts (MOTION.help.open); lang-switch.js appends "All manuals" (PIECE_HUB).
   Opening pauses, closing resumes only when it was playing; a row seeks and plays. Inside: ↑ ↓ Home End move, Enter /
   click acts, Tab is trapped, Esc / T close (controls.js KEYS) and give focus back to #btn-menu.
   Global keys live in controls.js's ONE table; this file binds none and exposes MOTION.menu { available, open, close,
   toggle, isOpen }, MOTION.step(dir), MOTION.skipIntro(), MOTION.inIntro(). #btn-skip shows during the first chapter.
   Works from file:// and from serve.mjs. */
(function () {
  'use strict';
  var M = window.MOTION;
  if (!M) return;
  var ticks = document.getElementById('ticks');
  var scrub = document.getElementById('scrub');
  if (scrub) scrub.setAttribute('data-vt-owner', 'nav'); // nav.js owns aria-valuetext; controls.js stands down
  var viewer = document.getElementById('viewer') || document.querySelector('.viewport');
  var dur = M.timeline.duration();
  var UI = M.ui || window.MOTION_UI || {};
  var CH = M.chapters || [];
  var PC = (window.PIECE && window.PIECE.chapters) || [];
  var ICONS = window.MOTION_ICONS || {};
  var marks = {};
  function word(k, en) { var T = window.MOTION_UI || UI; return (T && T[k]) || en; }
  function pad(n) { return ('0' + n).slice(-2); }
  function clock(t) { var s = Math.max(0, Math.round(t)); return Math.floor(s / 60) + ':' + pad(s % 60); }
  function bare(c) { return c.label.replace(/^\d+\s*·\s*/, ''); }
  function name(c) { return pad(c.n) + ' · ' + bare(c); }
  function go(c) { M.seek(c.t + 0.01); M.play(); }
  function el(tag, cls) { var n = document.createElement(tag); if (cls) n.className = cls; return n; }
  function focus(n) { if (!n) return; try { n.focus({ preventScroll: true }); } catch (e) { n.focus(); } }

  // ---- chapter markers on the scrubber ---------------------------------------------------------
  if (ticks && dur > 0) {
    CH.forEach(function (c) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'scrub-mark'; b.tabIndex = -1;
      b.setAttribute('data-id', c.id);
      b.setAttribute('aria-label', name(c));
      b.setAttribute('data-tip', name(c) + ' · ' + clock(c.t));
      b.style.left = (c.t / dur * 100).toFixed(2) + '%';
      b.addEventListener('click', function () { go(c); });
      ticks.appendChild(b); marks[c.id] = b;
    });
  }

  // ---- chapter steps + skip intro (keys in controls.js) ----------------------------------------
  function current() { return M.chapterAt ? M.chapterAt(M.timeline.time()) : CH[0]; }
  function step(dir) {
    var t = M.timeline.time(), cur = current(), k = CH.indexOf(cur);
    // "previous" from the middle of a chapter goes to its start first (media-player convention)
    if (dir < 0 && t - cur.t > 1.5) return go(cur);
    var c = CH[Math.max(0, Math.min(CH.length - 1, k + dir))]; if (c) go(c);
  }
  function inIntro() { return CH.length > 1 && current() === CH[0]; }
  function skipIntro() { if (CH.length > 1) go(CH[1]); }
  if (CH.length > 1) { M.step = step; M.skipIntro = skipIntro; M.inIntro = inIntro; }
  var skipBtn = document.getElementById('btn-skip');
  if (skipBtn) {
    if (CH.length > 1) skipBtn.addEventListener('click', skipIntro);
    skipBtn.hidden = true; // shown by onChapter while the first chapter plays
  }

  // ---- master menu -----------------------------------------------------------------------------
  var menuBtn = document.getElementById('btn-menu') || document.getElementById('btn-agenda');
  var menu = null, panel = null, list = null, rows = {}, foot = null, wasPlaying = false;
  var skipRow = null, langRow = null, autoRow = null, keysRow = null;
  function actOf(k) {
    var a = PC[k] && PC[k].act; if (!a) return null;
    return typeof a === 'string' ? a : (a[M.lang] || a[Object.keys(a)[0]] || null);
  }
  function footRow(iconName, text) {
    var b = el('button', 'menu-row menu-act-row'); b.type = 'button';
    var i = el('span', 'menu-ico'); if (ICONS[iconName]) i.innerHTML = ICONS[iconName];
    var l = el('span', 'menu-l'); l.textContent = text;
    b.appendChild(i); b.appendChild(l); foot.appendChild(b); return b;
  }
  if (viewer && CH.length > 1) {
    menu = el('div', 'menu-overlay'); menu.id = 'menu'; menu.hidden = true;
    menu.setAttribute('role', 'dialog'); menu.setAttribute('aria-modal', 'true'); menu.setAttribute('aria-labelledby', 'menu-title');
    panel = el('div', 'menu-panel');
    var head = el('div', 'menu-head'), title = el('h2', 'menu-title'), x = el('button', 'ctl-btn menu-x');
    title.id = 'menu-title';
    var st = document.getElementById('stage');
    title.textContent = (st && st.getAttribute('aria-label')) || document.title || word('menu', 'Menu');
    x.type = 'button'; x.setAttribute('aria-label', word('close', 'Close')); if (ICONS.close) x.innerHTML = ICONS.close;
    x.addEventListener('click', function () { close(); });
    head.appendChild(title); head.appendChild(x);
    list = el('div', 'menu-list'); list.setAttribute('role', 'list');
    var lastAct = null;
    CH.forEach(function (c, k) {
      var a = actOf(k);
      if (a && a !== lastAct) { var g = el('p', 'menu-act'); g.textContent = a; list.appendChild(g); lastAct = a; }
      var b = el('button', 'menu-row'); b.type = 'button'; b.setAttribute('data-id', c.id); b.setAttribute('role', 'listitem');
      var n = el('span', 'menu-n'), l = el('span', 'menu-l'), t = el('span', 'menu-t'), f = el('span', 'menu-fill');
      n.textContent = pad(c.n); l.textContent = bare(c); t.textContent = clock(c.t); f.setAttribute('aria-hidden', 'true');
      b.appendChild(n); b.appendChild(l); b.appendChild(t); b.appendChild(f);
      b.addEventListener('click', function () { close(true); go(c); });
      list.appendChild(b); rows[c.id] = b;
    });
    foot = el('div', 'menu-foot');
    skipRow = footRow('skip', word('skipIntro', 'Skip intro'));
    skipRow.addEventListener('click', function () { close(true); skipIntro(); });
    langRow = footRow('language', word('language', 'Language'));
    langRow.addEventListener('click', function () { close(); if (window.MOTION_LANG_SWITCH) window.MOTION_LANG_SWITCH.open(); });
    autoRow = footRow('pause', word('autoPause', 'Pause when I leave the page'));
    autoRow.setAttribute('role', 'switch');
    autoRow.addEventListener('click', function () {
      var F = window.MOTION_FOCUS; if (!F) return;
      F.setEnabled(!F.enabled()); paintFoot();
    });
    keysRow = footRow('help', word('shortcuts', 'Keyboard shortcuts'));
    keysRow.addEventListener('click', function () { close(); if (M.help) M.help.open(); });
    panel.appendChild(head); panel.appendChild(list); panel.appendChild(foot);
    menu.appendChild(panel);
    viewer.appendChild(menu);
    menu.addEventListener('click', function (e) { if (e.target === menu) close(); }); // the scrim, not the panel
    menu.addEventListener('keydown', function (e) {
      if (e.key === 'Tab') { trap(e); return; }
      if (!/^(ArrowDown|ArrowUp|Home|End)$/.test(e.key)) return;
      var bs = Array.prototype.filter.call(panel.querySelectorAll('.menu-row'), function (b) { return !b.hidden && b.offsetParent !== null; });
      if (!bs.length) return;
      var k = bs.indexOf(document.activeElement);
      var to = e.key === 'Home' ? 0 : e.key === 'End' ? bs.length - 1 : (k + (e.key === 'ArrowDown' ? 1 : -1) + bs.length) % bs.length;
      e.preventDefault(); e.stopPropagation();
      focus(bs[to]);
    });
    if (menuBtn) {
      menuBtn.setAttribute('aria-haspopup', 'dialog'); menuBtn.setAttribute('aria-expanded', 'false'); menuBtn.setAttribute('aria-controls', 'menu');
      menuBtn.addEventListener('click', function () { if (menu.hidden) open(); else close(); });
    }
  } else if (menuBtn) {
    menuBtn.hidden = true; // one chapter: nothing to list
  }
  function trap(e) {
    var f = Array.prototype.filter.call(panel.querySelectorAll('button, [href]'), function (n) { return !n.disabled && !n.hidden && n.offsetParent !== null; });
    if (!f.length) { e.preventDefault(); return; }
    var first = f[0], last = f[f.length - 1], a = document.activeElement;
    if (e.shiftKey && (a === first || !panel.contains(a))) { e.preventDefault(); focus(last); }
    else if (!e.shiftKey && (a === last || !panel.contains(a))) { e.preventDefault(); focus(first); }
  }
  function paintFoot() {
    if (!foot) return;
    skipRow.hidden = !inIntro();
    langRow.hidden = !(window.MOTION_LANG_SWITCH && window.MOTION_LANG_SWITCH.available);
    var F = window.MOTION_FOCUS;
    autoRow.hidden = !F;
    if (F) autoRow.setAttribute('aria-checked', F.enabled() ? 'true' : 'false');
    keysRow.hidden = !M.help;
  }
  function paintRows() {
    var t = M.timeline.time(), cur = current();
    CH.forEach(function (c) {
      var b = rows[c.id]; if (!b) return;
      if (cur && c.id === cur.id) {
        b.setAttribute('aria-current', 'true');
        b.style.setProperty('--fill', Math.max(0, Math.min(1, (t - c.t) / (c.dur || 1))).toFixed(3));
      } else { b.removeAttribute('aria-current'); b.style.removeProperty('--fill'); }
    });
  }
  function isOpen() { return !!menu && !menu.hidden; }
  function open() {
    if (!menu || isOpen()) return;
    if (M.viewer && M.viewer.mode() === 'dock') M.viewer.set('inline'); // panels never open inside the scaled mini player
    wasPlaying = M.timeline.isActive(); M.pause(); if (M.refresh) M.refresh();
    paintRows(); paintFoot();
    menu.hidden = false; if (menuBtn) menuBtn.setAttribute('aria-expanded', 'true');
    var f = menu.querySelector('.menu-row[aria-current="true"]') || menu.querySelector('.menu-row');
    focus(f);
    if (f && f.scrollIntoView) f.scrollIntoView({ block: 'nearest' });
  }
  function close(seeking) {
    if (!isOpen()) return;
    menu.hidden = true; if (menuBtn) { menuBtn.setAttribute('aria-expanded', 'false'); focus(menuBtn); }
    if (wasPlaying && !seeking) M.play();
    wasPlaying = false;
    if (M.refresh) M.refresh();
  }
  M.menu = { available: !!menu, open: open, close: close, toggle: function () { if (isOpen()) close(); else open(); }, isOpen: isOpen, el: menu };

  // ---- current chapter: marker state + scrubber value text (called by runtime render, every frame) --
  var last = null, lastText = '';
  M.onChapter = function (id) {
    if (id !== last) {
      if (last && marks[last]) marks[last].classList.remove('is-current');
      if (marks[id]) marks[id].classList.add('is-current');
      if (skipBtn && CH.length > 1) skipBtn.hidden = id !== CH[0].id;
      last = id;
    }
    if (!scrub) return;
    var c = null; for (var i = 0; i < CH.length; i++) if (CH[i].id === id) { c = CH[i]; break; }
    var vt = (c ? (UI.chapter || 'Chapter') + ' ' + name(c) + ' · ' : '') + clock(M.timeline.time());
    if (vt !== lastText) { scrub.setAttribute('aria-valuetext', vt); lastText = vt; }
  };
  M.render(M.timeline.time());
})();
