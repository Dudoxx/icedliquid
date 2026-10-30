/* Language switch — owns #btn-lang / #lang-pop (moved out of nav.js).
   Rows = PIECE.langs (in-piece languages) ∪ keys of window.PIECE_SIBLINGS (one-language SIBLING SITES,
   written at build time), fixed order en · de · fr · es, each language in its own native name, aria-current
   on the live one. Esc closes and returns focus (controls.js KEYS), arrows move inside the group.
   - in-piece language: the v4 reload ?lang=xx&t=<MOTION.mapTime> (same chapter, beat and offset in that language).
   - sibling site: navigates to PIECE_SIBLINGS[l] = relative "../<site>/index.html" (file:// needs the explicit
     index.html) with ?ch=<chapter id>&b=<beat index>&f=<0..1 offset in the beat>&next=<following chapter ids>
     &play=<0|1>&cap=<0|1>&mus=<0|1>&snd=<0|1>. runtime.js lands by chapter ID, never by position (condor FR lacks
     'clarify'); a missing id lands on the first `next` id present (toast); controls.js restores the toggles and shows a
     "Continue" gate when the new document refuses autoplay (FM1).
   - window.PIECE_HUB (optional, relative) adds an "All manuals" link to the master menu foot.
   API: window.MOTION_LANG_SWITCH { available, langs, open(), close(noFocus) -> bool, toggle(), href(lang) }.
   Works from file:// and from serve.mjs; no fetch, no module. */
(function () {
  'use strict';
  var M = window.MOTION;
  if (!M) return;
  var UI = M.ui || window.MOTION_UI || {};
  function word(k, en) { var T = window.MOTION_UI || UI; return (T && T[k]) || en; }
  var ORDER = ['en', 'de', 'fr', 'es'];
  var NATIVE = { en: 'English', de: 'Deutsch', fr: 'Français', es: 'Español' };
  var SIB = window.PIECE_SIBLINGS || {};
  var inPiece = M.langs || [], names = M.langNames || {};
  var langs = ORDER.filter(function (l) { return inPiece.indexOf(l) >= 0 || (SIB[l] && l !== M.lang); });
  if (langs.indexOf(M.lang) < 0) langs.unshift(M.lang);
  var langBtn = document.getElementById('btn-lang'), pop = document.getElementById('lang-pop');
  var available = !!langBtn && langs.length > 1;

  function href(l) {
    var t = M.timeline.time(), at = M.locate ? M.locate(t) : null, q = new URLSearchParams();
    if (at) {
      q.set('ch', at.id); q.set('b', String(at.b)); q.set('f', at.f.toFixed(4));
      if (at.next.length) q.set('next', at.next.join(','));
    } else q.set('t', t.toFixed(2));
    var A = window.MOTION_AUDIO, cap = document.getElementById('caption');
    q.set('play', M.timeline.isActive() ? '1' : '0');
    q.set('cap', cap && cap.classList.contains('is-off') ? '0' : '1');
    q.set('mus', A && A.musicOn === false ? '0' : '1');
    q.set('snd', A && !A.enabled ? '0' : '1');
    return SIB[l] + '?' + q.toString();
  }
  function choose(l) {
    if (l === M.lang) { close(); return; }
    if (inPiece.indexOf(l) >= 0) {
      var q = new URLSearchParams(location.search);
      // v4: per-language timing — land on the same chapter + beat + offset (clamped) in the target language
      var t = M.timeline.time(), to = M.mapTime ? M.mapTime(t, l) : t;
      q.set('lang', l); q.set('t', to.toFixed(2));
      ['ch', 'b', 'f', 'next'].forEach(function (k) { q.delete(k); });
      location.search = q.toString();
      return;
    }
    if (SIB[l]) location.href = href(l);
  }

  if (available) {
    if (!pop) { // markup fallback: the popover sits right after the button
      pop = document.createElement('div'); pop.id = 'lang-pop'; pop.className = 'lang-pop'; pop.hidden = true;
      langBtn.parentNode.insertBefore(pop, langBtn.nextSibling);
    }
    pop.setAttribute('role', 'group'); pop.setAttribute('aria-label', word('language', 'Language'));
    langBtn.setAttribute('aria-haspopup', 'true'); langBtn.setAttribute('aria-expanded', 'false');
    langBtn.setAttribute('aria-controls', 'lang-pop');
    langBtn.setAttribute('aria-label', word('chooseLanguage', 'Choose language') + ': ' + (names[M.lang] || NATIVE[M.lang] || M.lang));
    langBtn.setAttribute('data-tip', word('chooseLanguage', 'Choose language') + ' (L)');
    langs.forEach(function (l) {
      var b = document.createElement('button');
      b.type = 'button'; b.lang = l; b.setAttribute('data-lang', l);
      if (SIB[l] && inPiece.indexOf(l) < 0) b.setAttribute('data-site', SIB[l]);
      b.textContent = names[l] || NATIVE[l] || l.toUpperCase();
      if (l === M.lang) b.setAttribute('aria-current', 'true');
      b.addEventListener('click', function () { choose(l); });
      pop.appendChild(b);
    });
    langBtn.addEventListener('click', function () { if (pop.hidden) open(); else close(); });
    pop.addEventListener('keydown', function (e) { // arrows move inside the group
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      var bs = Array.prototype.slice.call(pop.querySelectorAll('button')), k = bs.indexOf(document.activeElement);
      var d = (e.key === 'ArrowDown' || e.key === 'ArrowRight') ? 1 : -1;
      e.preventDefault(); e.stopPropagation();
      bs[(k + d + bs.length) % bs.length].focus();
    });
    document.addEventListener('pointerdown', function (e) {
      if (!pop.hidden && !pop.contains(e.target) && !langBtn.contains(e.target)) close(true);
    });
  } else if (langBtn) {
    langBtn.hidden = true; // one language and no sibling site: no switch
  }
  function open() {
    if (!available || !pop) return;
    if (M.viewer && M.viewer.mode() === 'dock') M.viewer.set('inline'); // the pop-up sits by the bar, not in the mini player
    pop.hidden = false; langBtn.setAttribute('aria-expanded', 'true');
    var f = pop.querySelector('[aria-current="true"]') || pop.querySelector('button'); if (f) f.focus();
  }
  function close(noFocus) {
    if (!pop || pop.hidden) return false;
    pop.hidden = true; langBtn.setAttribute('aria-expanded', 'false');
    if (!noFocus) langBtn.focus();
    return true;
  }

  // "All manuals" (relative PIECE_HUB, explicit index.html) at the end of the master menu foot
  var foot = document.querySelector('#menu .menu-foot');
  if (window.PIECE_HUB && foot) {
    var a = document.createElement('a');
    a.className = 'menu-row menu-act-row menu-hub'; a.href = window.PIECE_HUB;
    var i = document.createElement('span'); i.className = 'menu-ico';
    var ICONS = window.MOTION_ICONS || {}; if (ICONS['layout-dashboard']) i.innerHTML = ICONS['layout-dashboard'];
    var l = document.createElement('span'); l.className = 'menu-l'; l.textContent = word('allManuals', 'All manuals');
    a.appendChild(i); a.appendChild(l); foot.appendChild(a);
  }

  window.MOTION_LANG_SWITCH = {
    available: available, langs: langs, open: open, close: close, href: href,
    toggle: function () { if (pop && !pop.hidden) close(); else open(); }
  };
})();
