/* Piece runtime — builds every scene from window.PIECE (piece.js, the generated
   scene data). No hand-written scenes: each chapter names a preset
   (presets/<name>.js registers window.PRESETS[name]) and the preset builds its own DOM and adds
   its tweens to the ONE master timeline. Same contract as the hand-built template:
   window.MOTION { timeline, seek, play, pause, replay, render, chapters }.
   Language: ?lang=en|fr|de|es (lang.js resolves it into window.PIECE_LANG); every copy field may
   be a plain string or { en, fr, de, es }.
   Long form: a chapter may hold BEATS (beats: [{ preset, duration, params, fx, camera }]) — several
   presets in sequence under one background, label and strap — so a 60–120 s chapter keeps moving. ?t=<seconds> lands on that time (the language switch
   keeps the viewer's place: MOTION.mapTime moves it to the same chapter, beat and offset in the
   target language). v4: a chapter / beat duration may be { en, de, … } — each language has its own
   timeline (resolved with L(), like copy); PIECE.total may be a lang map too. */
(function () {
  'use strict';
  var gsap = window.gsap;
  var PIECE = window.PIECE;
  var PRESETS = window.PRESETS || {};
  var BRAND = window.BRAND || {};
  var MT = BRAND.motion || {};
  var LANG = window.PIECE_LANG;
  var reduce = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var audio = window.MOTION_AUDIO || { cue: function () {} };
  var root = document.getElementById('scenes');
  if (!PIECE || !root) throw new Error('runtime: window.PIECE or #scenes missing — rebuild with build-piece.mjs');

  gsap.registerPlugin.apply(gsap, [window.CustomEase].filter(Boolean));

  // Fallback = brand token curves (enter decelerate · exit accelerate · standard · emphasis), used
  // ONLY when a brand ships no motion tokens. Never a GSAP built-in named ease — the
  // contract bans literal eases, and overshoot curves have no place on a brand surface.
  var FALLBACK_EASE = { enter: 'cubic-bezier(0,0,0.2,1)', exit: 'cubic-bezier(0.4,0,1,1)', standard: 'cubic-bezier(0.2,0,0,1)', spring: 'cubic-bezier(0.16,1,0.3,1)' };
  function ease(name, fallback) {
    var v = (MT.easing && MT.easing[name]) || FALLBACK_EASE[name];
    var m = v && /cubic-bezier\(([^)]+)\)/.exec(v);
    if (m && window.CustomEase) return window.CustomEase.create('brand-' + name, m[1].replace(/\s+/g, ''));
    return fallback;
  }
  function seconds(v, fallbackMs) {
    var m = v && /([\d.]+)\s*(ms|s)/.exec(v);
    if (!m) return fallbackMs / 1000;
    return m[2] === 's' ? parseFloat(m[1]) : parseFloat(m[1]) / 1000;
  }
  var E = {
    enter: ease('enter', 'none'), exit: ease('exit', 'none'),
    standard: ease('standard', 'none'), spring: ease('spring', 'none')
  };
  var U = seconds(MT.duration && MT.duration.page, 480); // brand beat unit; presets scale micro-timing by it

  // ---- localisation ----------------------------------------------------------------------
  var LANGS = PIECE.langs || ['en'];
  function isLangMap(v) {
    if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
    var k = Object.keys(v);
    return k.length > 0 && k.every(function (x) { return LANGS.indexOf(x) >= 0; });
  }
  function L(v) {
    if (isLangMap(v)) return v[LANG] != null ? v[LANG] : v[PIECE.defaultLang];
    if (Array.isArray(v)) return v.map(L);
    if (v && typeof v === 'object') { var o = {}; for (var k in v) o[k] = L(v[k]); return o; }
    return v;
  }
  document.documentElement.lang = LANG;
  if (PIECE.title) document.title = L(PIECE.title);
  // Player chrome words per language; controls.js reads window.MOTION_UI.
  // v4: every key in all four rows (locale lockstep); agenda / chapter / langName / chooseLanguage added.
  // v4.1: rv* = field-review / doc-stage state words (preset defaults; params.words still wins) ·
  // cap* = keyboard key caps in the help dialog (controls.js).
  var UI_ROWS = {
    en: { agenda: 'Agenda', chapter: 'Chapter', langName: 'English', chooseLanguage: 'Choose language', play: 'Play', pause: 'Pause', replay: 'Replay', soundOn: 'Sound on', soundOff: 'Sound off', sound: 'Sound', playWithSound: 'Play with sound', fullscreen: 'Full screen', exitFullscreen: 'Exit full screen', scrub: 'Scrub timeline', chapters: 'Chapters', language: 'Language', playback: 'Playback',
          music: 'Music', musicOn: 'Music on', musicOff: 'Music off', captions: 'Captions', captionsOn: 'Captions on', captionsOff: 'Captions off', help: 'Help', helpTitle: 'Keyboard keys', helpClose: 'Close', keyPlay: 'Play or pause', keyReplay: 'Replay', keySeek: 'Back or forward', keyMusic: 'Music on or off', keyCaptions: 'Captions on or off', keyFull: 'Full screen', keyAgenda: 'Open or close the agenda', keyChapter: 'Previous or next chapter', keyHelp: 'Show this help', playing: 'Playing', paused: 'Paused', keyEnds: 'Go to the start or the end', rvOk: 'read', rvAbstain: 'unreadable', rvCorrected: 'corrected', rvWrong: 'wrong value', rvConf: 'confidence', capSpace: 'Space', capHome: 'Home', capEnd: 'End', capEsc: 'Esc' },
    fr: { agenda: 'Sommaire', chapter: 'Chapitre', langName: 'Français', chooseLanguage: 'Choisir la langue', play: 'Lecture', pause: 'Pause', replay: 'Rejouer', soundOn: 'Son activé', soundOff: 'Son coupé', sound: 'Son', playWithSound: 'Lancer avec le son', fullscreen: 'Plein écran', exitFullscreen: 'Quitter le plein écran', scrub: 'Parcourir la timeline', chapters: 'Chapitres', language: 'Langue', playback: 'Lecture',
          music: 'Musique', musicOn: 'Musique activée', musicOff: 'Musique coupée', captions: 'Sous-titres', captionsOn: 'Sous-titres activés', captionsOff: 'Sous-titres masqués', help: 'Aide', helpTitle: 'Raccourcis clavier', helpClose: 'Fermer', keyPlay: 'Lecture ou pause', keyReplay: 'Rejouer', keySeek: 'Reculer ou avancer', keyMusic: 'Activer ou couper la musique', keyCaptions: 'Afficher ou masquer les sous-titres', keyFull: 'Plein écran', keyAgenda: 'Ouvrir ou fermer le sommaire', keyChapter: 'Chapitre précédent ou suivant', keyHelp: 'Afficher cette aide', playing: 'Lecture en cours', paused: 'En pause', keyEnds: 'Aller au début ou à la fin', rvOk: 'lu', rvAbstain: 'illisible', rvCorrected: 'corrigé', rvWrong: 'valeur erronée', rvConf: 'confiance', capSpace: 'Espace', capHome: 'Début', capEnd: 'Fin', capEsc: 'Échap' },
    de: { agenda: 'Agenda', chapter: 'Kapitel', langName: 'Deutsch', chooseLanguage: 'Sprache wählen', play: 'Abspielen', pause: 'Pause', replay: 'Neu starten', soundOn: 'Ton an', soundOff: 'Ton aus', sound: 'Ton', playWithSound: 'Mit Ton abspielen', fullscreen: 'Vollbild', exitFullscreen: 'Vollbild beenden', scrub: 'Zeitleiste durchsuchen', chapters: 'Kapitel', language: 'Sprache', playback: 'Wiedergabe',
          music: 'Musik', musicOn: 'Musik an', musicOff: 'Musik aus', captions: 'Untertitel', captionsOn: 'Untertitel an', captionsOff: 'Untertitel aus', help: 'Hilfe', helpTitle: 'Tastenkürzel', helpClose: 'Schließen', keyPlay: 'Abspielen oder Pause', keyReplay: 'Neu starten', keySeek: 'Zurück oder vor', keyMusic: 'Musik an oder aus', keyCaptions: 'Untertitel an oder aus', keyFull: 'Vollbild', keyAgenda: 'Agenda öffnen oder schließen', keyChapter: 'Vorheriges oder nächstes Kapitel', keyHelp: 'Diese Hilfe zeigen', playing: 'Läuft', paused: 'Pausiert', keyEnds: 'Zum Anfang oder Ende', rvOk: 'gelesen', rvAbstain: 'unlesbar', rvCorrected: 'korrigiert', rvWrong: 'falscher Wert', rvConf: 'Konfidenz', capSpace: 'Leertaste', capHome: 'Pos1', capEnd: 'Ende', capEsc: 'Esc' },
    es: { agenda: 'Índice', chapter: 'Capítulo', langName: 'Español', chooseLanguage: 'Elegir idioma', play: 'Reproducir', pause: 'Pausa', replay: 'Repetir', soundOn: 'Sonido activado', soundOff: 'Sonido desactivado', sound: 'Sonido', playWithSound: 'Reproducir con sonido', fullscreen: 'Pantalla completa', exitFullscreen: 'Salir de pantalla completa', scrub: 'Recorrer la línea de tiempo', chapters: 'Capítulos', language: 'Idioma', playback: 'Reproducción',
          music: 'Música', musicOn: 'Música activada', musicOff: 'Música desactivada', captions: 'Subtítulos', captionsOn: 'Subtítulos activados', captionsOff: 'Subtítulos ocultos', help: 'Ayuda', helpTitle: 'Atajos de teclado', helpClose: 'Cerrar', keyPlay: 'Reproducir o pausar', keyReplay: 'Repetir', keySeek: 'Retroceder o avanzar', keyMusic: 'Activar o desactivar música', keyCaptions: 'Mostrar u ocultar subtítulos', keyFull: 'Pantalla completa', keyAgenda: 'Abrir o cerrar el índice', keyChapter: 'Capítulo anterior o siguiente', keyHelp: 'Mostrar esta ayuda', playing: 'Reproduciendo', paused: 'En pausa', keyEnds: 'Ir al inicio o al final', rvOk: 'leído', rvAbstain: 'ilegible', rvCorrected: 'corregido', rvWrong: 'valor erróneo', rvConf: 'confianza', capSpace: 'Espacio', capHome: 'Inicio', capEnd: 'Fin', capEsc: 'Esc' }
  };
  // Player words: master menu, mini player, skip intro, auto-pause, Continue gate, toast;
  // keySeek now says Shift = 15 s. Same keys in all four rows (locale lockstep); controls.js holds the EN fallback.
  var V5_UI = {
    en: { menu: 'Menu', miniPlayer: 'Mini player', undock: 'Back to the full player', closeMini: 'Close the mini player', skipIntro: 'Skip intro', autoPause: 'Pause when I leave the page', shortcuts: 'Keyboard shortcuts', close: 'Close', 'continue': 'Continue', resumeChip: 'Paused — continue (Space)', notInLanguage: 'This chapter is not in this language — you are at the next one.', allManuals: 'All manuals', keySeek: 'Back or forward 5 s (Shift: 15 s)', keyDock: 'Mini player on or off', keyMenu: 'Open or close the menu', keyLanguage: 'Choose the language', keySkip: 'Skip the intro (during the intro)', keyEsc: 'Close a panel or leave the mini player' },
    fr: { menu: 'Menu', miniPlayer: 'Mini-lecteur', undock: 'Revenir au lecteur complet', closeMini: 'Fermer le mini-lecteur', skipIntro: 'Passer l’intro', autoPause: 'Mettre en pause quand je quitte la page', shortcuts: 'Raccourcis clavier', close: 'Fermer', 'continue': 'Continuer', resumeChip: 'En pause — continuer (Espace)', notInLanguage: 'Ce chapitre n’existe pas dans cette langue — vous êtes au suivant.', allManuals: 'Tous les manuels', keySeek: 'Reculer ou avancer de 5 s (Maj : 15 s)', keyDock: 'Mini-lecteur activé ou désactivé', keyMenu: 'Ouvrir ou fermer le menu', keyLanguage: 'Choisir la langue', keySkip: 'Passer l’intro (pendant l’intro)', keyEsc: 'Fermer un panneau ou quitter le mini-lecteur' },
    de: { menu: 'Menü', miniPlayer: 'Mini-Player', undock: 'Zurück zum großen Player', closeMini: 'Mini-Player schließen', skipIntro: 'Intro überspringen', autoPause: 'Pausieren, wenn ich die Seite verlasse', shortcuts: 'Tastenkürzel', close: 'Schließen', 'continue': 'Weiter', resumeChip: 'Pausiert — weiter (Leertaste)', notInLanguage: 'Dieses Kapitel gibt es in dieser Sprache nicht — Sie sind beim nächsten.', allManuals: 'Alle Handbücher', keySeek: '5 s zurück oder vor (Umschalt: 15 s)', keyDock: 'Mini-Player an oder aus', keyMenu: 'Menü öffnen oder schließen', keyLanguage: 'Sprache wählen', keySkip: 'Intro überspringen (während des Intros)', keyEsc: 'Ein Fenster schließen oder den Mini-Player verlassen' },
    es: { menu: 'Menú', miniPlayer: 'Minirreproductor', undock: 'Volver al reproductor completo', closeMini: 'Cerrar el minirreproductor', skipIntro: 'Saltar la intro', autoPause: 'Pausar cuando salgo de la página', shortcuts: 'Atajos de teclado', close: 'Cerrar', 'continue': 'Continuar', resumeChip: 'En pausa — continuar (Espacio)', notInLanguage: 'Este capítulo no existe en este idioma — está en el siguiente.', allManuals: 'Todos los manuales', keySeek: 'Atrás o adelante 5 s (Mayús: 15 s)', keyDock: 'Minirreproductor sí o no', keyMenu: 'Abrir o cerrar el menú', keyLanguage: 'Elegir el idioma', keySkip: 'Saltar la intro (durante la intro)', keyEsc: 'Cerrar un panel o salir del minirreproductor' }
  };
  Object.keys(V5_UI).forEach(function (l) { if (UI_ROWS[l]) Object.keys(V5_UI[l]).forEach(function (k) { UI_ROWS[l][k] = V5_UI[l][k]; }); });
  var UI = UI_ROWS[LANG] || null;
  // Native language names for the language popover (each language names itself).
  var LANG_NAMES = {};
  LANGS.forEach(function (l) { LANG_NAMES[l] = (UI_ROWS[l] && UI_ROWS[l].langName) || l.toUpperCase(); });
  if (UI) {
    window.MOTION_UI = UI;
    // Icon-safe: a button that holds an icon (element children) keeps it and gets only aria-label + data-tip.
    var setUi = function (id, text, label) {
      var n = document.getElementById(id); if (!n) return;
      if (text && !n.children.length) n.textContent = text;
      if (label) { n.setAttribute('aria-label', label); if (n.tagName === 'BUTTON') n.setAttribute('data-tip', label); }
    };
    setUi('btn-play', UI.play, UI.play); setUi('btn-replay', UI.replay, UI.replay);
    setUi('btn-sound', UI.soundOn, UI.sound); setUi('scrub', null, UI.scrub);
    setUi('chapters', null, UI.chapters); setUi('langs', null, UI.language); setUi('lang-pop', null, UI.language);
    // v3/v4 player buttons (agenda + language: nav.js adds the key hint to the tip)
    setUi('btn-music', UI.music, UI.music); setUi('btn-cap', UI.captions, UI.captions); setUi('btn-help', UI.help, UI.helpTitle);
    setUi('btn-agenda', UI.agenda, UI.agenda); setUi('btn-lang', UI.language, UI.chooseLanguage);
    setUi('btn-menu', null, UI.menu); setUi('btn-dock', null, UI.miniPlayer); setUi('btn-skip', null, UI.skipIntro); // v5
    var ctl = document.querySelector('.controls'); if (ctl) ctl.setAttribute('aria-label', UI.playback);
  }
  var stageEl = document.getElementById('stage');
  if (stageEl && PIECE.title) stageEl.setAttribute('aria-label', L(PIECE.title));
  // Brand corner (owner rule 2026-10-18): the official logo MARK (bird icon), never the text-only
  // typography file — top-left on every scene. Hidden on chapters that already show the big logo
  // (logo-sting, endcard). Static chrome, not animated; opt out with piece.brandCorner: false.
  var cornerSrc = (PIECE.marks || {}).mark || BRAND.logo, corner = null, cornerOff = {};
  if (stageEl && cornerSrc && PIECE.brandCorner !== false) {
    corner = document.createElement('img');
    corner.className = 'brand-corner'; corner.src = cornerSrc; corner.alt = ''; corner.setAttribute('aria-hidden', 'true');
    stageEl.appendChild(corner); stageEl.classList.add('has-corner');
    PIECE.chapters.forEach(function (c) {
      var units = c.beats || [c];
      if (units.some(function (u) { return u.preset === 'logo-sting' || u.preset === 'endcard'; })) cornerOff[c.id] = true;
    });
  }

  // ---- shared helpers handed to presets ---------------------------------------------------
  function h(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  // Counters must not move the text around them (digit widths differ; tabular-nums needs a tnum
  // table). Box = widest sample string, in em, re-measured once fonts are ready.
  var locks = [];
  function lockWidth(node, samples, align) {
    if (!node) return;
    locks.push([node, samples, align]);
    node.style.display = 'inline-block'; node.style.textAlign = align || 'right';
    node.style.fontVariantNumeric = 'tabular-nums'; node.style.whiteSpace = 'nowrap';
    var keep = node.textContent, max = 0, fs = parseFloat(getComputedStyle(node).fontSize) || 16;
    node.style.minWidth = '0';
    samples.forEach(function (s) { node.textContent = s; max = Math.max(max, node.getBoundingClientRect().width); });
    node.textContent = keep;
    if (max > 0) node.style.minWidth = (max / fs + 0.02).toFixed(3) + 'em';
  }
  function relock() { var l = locks; locks = []; l.forEach(function (a) { lockWidth(a[0], a[1], a[2]); }); }
  // Every sample a number formatter can show between 0 and `to` — widest digit run wins.
  function numberSamples(fmt, to) {
    var out = [fmt(to)], n = String(Math.floor(Math.abs(to))).length;
    for (var d = 0; d <= 9; d++) out.push(fmt(Number(String(d).repeat(n)) + (to % 1 ? 0.9 : 0)));
    return out;
  }
  function formatter(p) {
    var dec = p.decimals || 0, pre = p.prefix || '', suf = p.suffix || '';
    var loc = { en: 'en-US', fr: 'fr-FR', de: 'de-DE', es: 'es-ES' }[LANG] || 'en-US';
    return function (v) { return pre + Number(v).toLocaleString(loc, { minimumFractionDigits: dec, maximumFractionDigits: dec }) + suf; };
  }
  // Left text column used by most presets: kicker · title · accent rail · body.
  function textCol(el, p) {
    var col = h('div', 'col-text');
    // v6 (owner 2026-10-29): p.icon = a Lucide name from window.MOTION_ICONS -> a tinted tile above the kicker
    var ICONS = window.MOTION_ICONS || {};
    if (p.icon && ICONS[p.icon]) { var ico = h('i', 'col-ico'); ico.innerHTML = ICONS[p.icon]; col.appendChild(ico); }
    if (p.kicker) col.appendChild(h('p', 'kicker', p.kicker));
    if (p.title) { col.appendChild(h('h2', 'title', p.title)); col.appendChild(h('span', 'accent-rail')); }
    if (p.body) col.appendChild(h('p', 'body', p.body));
    el.appendChild(col);
    return col;
  }
  // Head beat: eyebrow wipes in, the title (the ONE
  // lead) reveals by line, the accent rail grows when the lead is 70 % done (a MOTION effect,
  // Rule 7), the body follows 200 ms later.
  var S = window.STUDIO, FX = window.FX;
  function headIn(tl, col, at) {
    var q = function (s) { return col.querySelector(s); };
    var lead = at + S.ENTER.headStart, next = lead + Math.min(S.durOf('line-mask'), 0.55) * S.choreography.nextBeatAtLeadFraction; // v2: the capped mask (studio.js MASK_MAX) sets the cadence, so content starts <= 0.55 s into the beat
    S.preset('clip-wipe', tl, q('.kicker'), at + 0.05);
    S.preset('line-mask', tl, q('.title'), lead);
    S.preset('bar-grow', tl, q('.accent-rail'), next, { axis: 'x' });
    // v2 (D-004): the body rises WITH the accent rail (the title's follow beat), not 0.2 s later - one
    // shared rise, so the column does not jump after the title has landed.
    S.preset('rise', tl, q('.body'), next);
    return next;
  }

  // ---- build -------------------------------------------------------------------------------
  var tl = gsap.timeline({ paused: true, defaults: { ease: E.enter, duration: U * 1.6 } });
  // Transition tempo (seconds). Every swap ENDS at the boundary; only timing inside it changes.
  // window.MOTION_TEMPO = { ... } (set before runtime.js loads) overrides any field.
  //   beatExit / beatExitLead  beat cut-rise: outgoing fade length / starts this long before the swap
  //   cutExit / cutExitLead    chapter cut-rise: same, at a chapter boundary
  //   wipeCover / wipeUncover  chapter wipe: cover, swap under cover, uncover (total = both)
  //   crossFade                continuity cross-fade (beats and chapters)
  var TEMPO = { beatExit: 0.2, beatExitLead: 0.25, cutExit: 0.2, cutExitLead: 0.3, wipeCover: 0.28, wipeUncover: 0.28, crossFade: 0.4 };
  (function (o) {
    if (!o || typeof o !== 'object') return;
    for (var k in TEMPO) { var v = Number(o[k]); if (o[k] != null && isFinite(v) && v >= 0) TEMPO[k] = v; }
  })(window.MOTION_TEMPO);
  var CH = [], renders = [], t0 = 0, scenes = [], N = PIECE.chapters.length, spine = document.getElementById('spine');
  var wipe = document.getElementById('wipe');
  if (wipe) tl.set(wipe, { clipPath: 'inset(0% 100% 0% 0%)', autoAlpha: 1 }, 0);
  // The chapter list (labels + start times) exists BEFORE any preset builds: the agenda preset and
  // the agenda overlay (nav.js) read it.
  var acc = 0;
  var TOC = PIECE.chapters.map(function (c, k) {
    var d = L(c.duration);
    var o = { id: c.id, label: L(c.label) || c.id, t: acc, dur: d, n: k + 1, dark: !!c.dark };
    acc += d; return o;
  });
  var laterBeats = [];
  // v6 (owner 2026-10-29: "illustrations in empty areas, framed in rounded or cropped containers"). Any preset with a
  // text column takes p.art = { src, alt?, shape?: 'round' | 'arch' | 'circle', size? (cqw width, default 24), at? (s into
  // the unit, default 1.1) }: a framed photo appended to the column under the copy. It reveals with a clip wipe and the
  // photo pushes in slowly (both timeline tweens: seek-pure). The p.icon tile (textCol) pops in with it. No column = no art.
  function art(ctx, host) {
    var col = host.querySelector('.col-text'); if (!col) return;
    var ico = col.querySelector('.col-ico');
    if (ico) {
      if (S.reduced) tl.set(ico, { opacity: 1 }, ctx.at);
      else tl.fromTo(ico, { opacity: 0, scale: 0.4, rotate: -30 }, { opacity: 1, scale: 1, rotate: 0, duration: 0.55, ease: 'back.out(2.2)', immediateRender: true }, ctx.at + 0.05);
    }
    var a = ctx.p.art; if (!a || !a.src) return;
    var shape = ({ round: 1, arch: 1, circle: 1 })[a.shape] ? a.shape : 'round';
    var fig = h('figure', 'art art--' + shape); fig.setAttribute('data-hit', 'art');
    if (a.size) fig.style.width = Number(a.size).toFixed(1) + 'cqw';
    var img = FX.image(a.src, 'art-img', a.alt || ''); fig.appendChild(img); col.appendChild(fig);
    // Fit: on the first painted frame, measure the frame from LAYOUT offsets (immune to the reveal / camera transforms)
    // and, if it would cross the caption safe line (83 % of the stage, as card-grid), shorten it into a cropped band
    // (object-fit: cover keeps the faces). Cached: same t, same frame. A band under 5 % of the stage is hidden.
    var fitted = false;
    renders.push({ at: ctx.at, end: ctx.at + ctx.dur, fn: function () {
      if (fitted) return;
      var stage = document.getElementById('stage'); if (!stage || !fig.offsetHeight) return;
      fitted = true;
      var y = 0; for (var n = fig; n && n !== stage; n = n.offsetParent) y += n.offsetTop;
      var over = y + fig.offsetHeight - stage.clientHeight * 0.83;
      if (over <= 0) return;
      var hgt = fig.offsetHeight - over;
      if (hgt < stage.clientHeight * 0.05) { fig.style.display = 'none'; return; }
      fig.style.aspectRatio = 'auto'; fig.style.height = Math.floor(hgt) + 'px';
    } });
    var t = ctx.at + (typeof a.at === 'number' ? a.at : 1.1);
    if (S.reduced) { tl.set(fig, { opacity: 1, clipPath: 'inset(0% 0% 0% 0% round 0)' }, ctx.at); return; }
    tl.fromTo(fig, { opacity: 0, y: '1.2cqw', clipPath: 'inset(0% 0% 100% 0%)' }, { opacity: 1, y: 0, clipPath: 'inset(0% 0% 0% 0%)', duration: 0.9, ease: 'expo.out', immediateRender: true }, t);
    tl.fromTo(img, { scale: 1.12 }, { scale: 1.02, duration: Math.max(1, ctx.dur - (t - ctx.at)), ease: 'none', immediateRender: true }, t);
  }
  // One unit = one preset run on one host element for [at, at + dur]: a whole chapter, or one beat.
  function buildUnit(host, u, at, dur, k, chapterId) {
    var make = PRESETS[u.preset];
    if (!make) throw new Error('runtime: preset "' + u.preset + '" not loaded (chapter ' + chapterId + ')');
    var ctx = {
      el: host, p: L(u.params || {}), at: at, dur: dur, index: k + 1, tl: tl, E: E, U: U, audio: audio, lang: LANG,
      brand: BRAND, marks: PIECE.marks || {}, S: S, FX: FX, headIn: headIn, fx: L(u.fx || {}), chapters: TOC, chapter: chapterId,
      h: h, textCol: textCol, lockWidth: lockWidth, numberSamples: numberSamples, formatter: formatter,
      ui: UI_ROWS[LANG] || UI_ROWS.en
    };
    var r = make(ctx) || {};
    art(ctx, host);
    if (r.away) AWAY.push(r.away); // v5.3: the preset scrolls its content up — the chapter strap leaves for that window
    if (r.render) renders.push({ at: at, end: at + dur, fn: r.render });
    // v5.3: an opt-in piece skin (piece.skin -> presets/skin-<name>.js) decorates the containers the preset just built
    if (window.SKIN && window.SKIN.decorate) window.SKIN.decorate(ctx, host, r);
    // Stage camera on the preset's visual rig (text stays outside it). Default = the preset's own
    // pick, else breathe — the ambient floor: no scene fully still for more than 3 s. An explicit
    // focus / crop list owns the rig instead (zoom into an area, hold, zoom out).
    var fx = ctx.fx, rig = r.focusRig || r.rig || host; // focusRig = content inside a clipping frame (screen, photo, page)
    if (fx.crop && fx.crop.length) FX.focus(ctx, rig, fx.crop, { cap: 6, glow: false });
    else if (fx.focus && fx.focus.length) FX.focus(ctx, rig, fx.focus);
    else if (r.rig) S.camera(tl, r.rig, u.camera || r.camera || 'breathe', at, dur);
    FX.highlight(ctx, fx.highlight);
    [FX.spotlight(ctx, fx.spotlight), FX.cursor(ctx, fx.cursor)].forEach(function (paint) {
      if (paint) renders.push({ at: at, end: at + dur, fn: paint });
    });
  }
  var AWAY = [];
  PIECE.chapters.forEach(function (c, k) {
    AWAY = [];
    var el = h('section', 'scene ' + (c.beats ? 'has-beats' : 'preset-' + c.preset)); el.id = 's-' + c.id;
    if (c.dark) el.classList.add('on-dark');
    root.appendChild(el);
    var at = t0, dur = L(c.duration);
    CH.push(TOC[k]);
    tl.addLabel(c.id, at);
    transition(k ? scenes[k - 1] : null, el, at, c.transition);
    if (c.background) background(el, L(c.background), at, dur);
    if (c.beats) {
      var bt = at, prev = null;
      c.beats.forEach(function (b, j) {
        var bel = h('div', 'scene scene-beat preset-' + b.preset); bel.id = 's-' + c.id + '-' + (j + 1);
        if (b.dark) bel.classList.add('on-dark');
        el.appendChild(bel);
        if (!prev) tl.set(bel, { autoAlpha: 1 }, 0);
        else { beatSwap(prev, bel, bt, b.transition); laterBeats.push(bel); }
        tl.addLabel(c.id + '-' + (j + 1), bt);
        var bd = L(b.duration);
        buildUnit(bel, b, bt, bd, k, c.id);
        prev = bel; bt += bd;
      });
    } else buildUnit(el, c, at, dur, k, c.id);
    if (c.strap) {
      var sbox = strap(el, c.strap, k, at, dur);
      // a scrolling beat (card-grid overflow) moves its content under the strap: the strap lifts out for the scroll and
      // returns when the beat ends — timeline tweens, so any seek lands on the right state
      var cornerEl = document.querySelector('.brand-corner');
      if (cornerEl) AWAY.forEach(function (w) { // the player's corner mark sits over the scrolled content too
        tl.fromTo(cornerEl, { autoAlpha: 1 }, { autoAlpha: 0, duration: Math.max(0.2, w.to - w.from), ease: 'power2.in', immediateRender: false }, w.from);
        tl.to(cornerEl, { autoAlpha: 1, duration: 0.35, ease: 'power2.out' }, w.end);
      });
      if (sbox) AWAY.forEach(function (w) {
        tl.fromTo(sbox, { autoAlpha: 1, y: 0 }, { autoAlpha: 0, y: -24, duration: Math.max(0.2, w.to - w.from), ease: 'power2.in', immediateRender: false }, w.from);
        tl.to(sbox, { autoAlpha: 1, y: 0, duration: 0.35, ease: 'power2.out' }, w.end);
      });
    }
    scenes.push(el);
    t0 += dur;
  });
  tl.to({}, { duration: 0.001 }, t0 - 0.001); // timeline length = sum of chapter durations, exactly
  tl.set(scenes.slice(1), { autoAlpha: 0, zIndex: 1 }, 0); // every later scene starts hidden (seek-back safe)
  if (laterBeats.length) tl.set(laterBeats, { autoAlpha: 0 }, 0); // later beats too

  // Beat swap inside a chapter: cut-rise (default — the outgoing beat exit-fades TEMPO.beatExit
  // (0.2 s) from at − beatExitLead (0.25 s), a 0.05 s gap, then the incoming beat's own entrances
  // run) or continuity (TEMPO.crossFade, 0.4 s cross-fade above the outgoing beat).
  function beatSwap(prev, el, at, kind) {
    if (kind === 'continuity') {
      var xf = TEMPO.crossFade;
      tl.set(el, { zIndex: 2 }, at - xf)
        .fromTo(el, { autoAlpha: 0 }, { autoAlpha: 1, duration: xf, ease: S.ease('soft'), immediateRender: false }, at - xf)
        .set(prev, { autoAlpha: 0 }, at).set(el, { zIndex: 1 }, at);
    } else {
      tl.fromTo(prev, { autoAlpha: 1 }, { autoAlpha: 0, duration: TEMPO.beatExit, ease: S.ease('exit'), immediateRender: false }, at - TEMPO.beatExitLead)
        .set(el, { autoAlpha: 1 }, at);
    }
  }

  // Chapter strap (the lower-third role, placed TOP-left so it never collides with the caption box):
  // "NN / TOT" + a rail that GROWS + the chapter title wiping in, then it STAYS until the chapter ends (exits only with strap.dur). strap: true uses the
  // chapter label; { title?, at? (s, default 0.5), dur? (s on screen; omitted = whole chapter) } overrides.
  function strap(el, st, k, at, dur) {
    var o = st === true ? {} : L(st);
    var box = h('div', 'strap'); box.setAttribute('aria-hidden', 'true');
    // v5.3: numeral + total as two spans (a skin can size the chapter number up and mute the total)
    var num = h('span', 'strap-num'); num.appendChild(h('b', null, ('0' + (k + 1)).slice(-2))); num.appendChild(h('span', null, '/ ' + ('0' + N).slice(-2)));
    var rail = h('i', 'strap-rail');
    var ttl = h('span', 'strap-title', o.title || TOC[k].label.replace(/^\d+\s*·\s*/, ''));
    box.appendChild(num); box.appendChild(rail); box.appendChild(ttl); el.appendChild(box);
    var a = at + (o.at != null ? Number(o.at) : 0.5), d = o.dur != null ? Number(o.dur) : 3.6;
    S.preset('rise', tl, num, a);
    S.preset('bar-grow', tl, rail, a + 0.1, { axis: 'x' });
    S.preset('clip-wipe', tl, ttl, a + 0.25);
    // v2 (D-002): the strap stays for the whole chapter (it leaves with the scene); an explicit
    // strap.dur still exits it, because that is what the author asked for.
    if (o.dur != null && a + d < at + dur - 0.8) S.preset('exit-fade', tl, box, a + d);
    return box;
  }

  // Background image under any preset: depth parallax (slow drift, scale 1.08) or a zoom
  // (Ken Burns 1 → 1.08, zoom-out with zoom:"out"), plus a token veil so text keeps its contrast.
  // { src, alt?, motion: parallax | zoom | zoom-out | still (default parallax), overlay?, veil: 0..0.9 (default 0.55), position }
  function background(el, b, at, dur) {
    var wrap = h('div', 'scene-bg'), img = FX.image(b.src, 'scene-bg__img', b.alt || '');
    if (b.position) img.style.objectPosition = b.position;
    wrap.appendChild(img);
    // overlay = the image preset's list (veil · scrim-* · duotone · grain · vignette · tint); default veil
    FX.treat(wrap, img, b.overlay || 'veil', { veil: b.veil, side: b.side || 'left' });
    el.appendChild(wrap); el.classList.add('has-bg');
    if (S.reduced || b.motion === 'still') return;
    if (b.motion === 'zoom') tl.fromTo(img, { scale: 1 }, { scale: 1.08, duration: dur, ease: 'none', immediateRender: false }, at);
    else if (b.motion === 'zoom-out') tl.fromTo(img, { scale: 1.08 }, { scale: 1, duration: dur, ease: 'none', immediateRender: false }, at);
    else tl.fromTo(img, { scale: 1.08, xPercent: -1.5, yPercent: 0.5 }, { scale: 1.08, xPercent: 1.5, yPercent: -0.5, duration: dur, ease: 'none', immediateRender: false }, at);
  }

  // Transitions, each ENDING at the incoming chapter start
  // and stacking the incoming scene above the outgoing one for its window.
  //   cut-rise   (default) outgoing exit-fades TEMPO.cutExit (0.2 s) from at − cutExitLead (0.3 s),
  //              0.1 s gap, the incoming entrances rise
  //   chapter    brand-primary clip-path wipe: covers TEMPO.wipeCover (0.28 s), scenes swap under
  //              cover, uncovers TEMPO.wipeUncover (0.28 s) — 0.56 s total, whoosh on the cover start
  //   continuity incoming cross-fades in over TEMPO.crossFade (0.4 s) above the outgoing scene
  function transition(prev, el, at, kind) {
    if (!prev) { tl.set(el, { autoAlpha: 1 }, at); return; }
    kind = kind || 'cut-rise';
    if (kind === 'chapter' && wipe) {
      var a = Math.max(0, at - TEMPO.wipeCover - TEMPO.wipeUncover), mid = at - TEMPO.wipeUncover, e = S.ease('move');
      tl.fromTo(wipe, { clipPath: 'inset(0% 100% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: TEMPO.wipeCover, ease: e, immediateRender: false }, a)
        .set(prev, { autoAlpha: 0 }, mid).set(el, { autoAlpha: 1, zIndex: 2 }, mid)
        .fromTo(wipe, { clipPath: 'inset(0% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 100%)', duration: TEMPO.wipeUncover, ease: e, immediateRender: false }, mid)
        .set(wipe, { clipPath: 'inset(0% 100% 0% 0%)' }, at)
        .call(audio.cue, ['whoosh'], a);
    } else if (kind === 'continuity') {
      var xf = TEMPO.crossFade;
      tl.set(el, { zIndex: 2 }, at - xf)
        .fromTo(el, { autoAlpha: 0 }, { autoAlpha: 1, duration: xf, ease: S.ease('soft'), immediateRender: false }, at - xf)
        .set(prev, { autoAlpha: 0 }, at).set(el, { zIndex: 1 }, at);
    } else {
      tl.fromTo(prev, { autoAlpha: 1 }, { autoAlpha: 0, duration: TEMPO.cutExit, ease: S.ease('exit'), immediateRender: false }, at - TEMPO.cutExitLead)
        .set(el, { autoAlpha: 1 }, at);
    }
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { relock(); render(tl.time()); });
  // v4.1 (R1 M4): a lock measured at one stage width is wrong at another (390 -> 1440 left a blank,
  // overflowing odometer). Re-measure on every stage resize, then repaint.
  if (window.ResizeObserver && root) { var rsz = 0, lastW = 0; new ResizeObserver(function (en) { var w = Math.round(en[0].contentRect.width); if (!w || w === lastW) return; lastW = w; cancelAnimationFrame(rsz); rsz = requestAnimationFrame(function () { relock(); render(tl.time()); }); }).observe(root); }

  var stage = document.getElementById('stage');
  function current(t) { var c = CH[0]; for (var j = 0; j < CH.length; j++) if (t >= CH[j].t - 0.001) c = CH[j]; return c; }
  function render(t) {
    // A preset paints only inside its own chapter (plus 1 s each side for its exit/entry).
    for (var i = 0; i < renders.length; i++) {
      var R = renders[i], local = t - R.at;
      if (t >= R.at - 1 && t <= R.end + 1) R.fn(Math.max(0, local), t);
      else if (R.fn.idle) R.fn.idle();
    }
    if (S.hlSync) S.hlSync(t); // marker bands: measure the highlights that are due (after the painters, so a wiped layer is re-attached)
    var c = current(t);
    if (stage) stage.classList.toggle('on-dark', c.dark);
    if (corner) corner.classList.toggle('is-off', !!cornerOff[c.id]);
    // Visible spine (slide-design-rules Rule 9): NN / TOTAL · chapter
    if (spine) { var sp = ('0' + c.n).slice(-2) + ' / ' + ('0' + N).slice(-2) + ' · ' + c.label.replace(/^\d+\s*·\s*/, ''); if (spine.textContent !== sp) spine.textContent = sp; }
    if (window.MOTION && window.MOTION.onChapter) window.MOTION.onChapter(c.id);
  }

  // Reduced motion: land on the END STATE of the first chapter (same destination, no journey) — not
  // on the end card. The viewer moves on with the agenda, chapter keys or the scrub bar.
  // Language switch (nav.js): the same chapter + beat in the target language, at the same offset
  // clamped inside the target beat (DE beats may be longer or shorter than EN ones).
  function durIn(v, l) { return isLangMap(v) ? (v[l] != null ? v[l] : v[PIECE.defaultLang]) : v; }
  function spans(l) { // [{ start, dur }] per unit (beat, or a chapter without beats) in language l, in timeline order
    var out = [], t = 0;
    PIECE.chapters.forEach(function (c) {
      if (c.beats) c.beats.forEach(function (b) { var d = durIn(b.duration, l); out.push({ start: t, dur: d }); t += d; });
      else { var d = durIn(c.duration, l); out.push({ start: t, dur: d }); t += d; }
    });
    return out;
  }
  function mapTime(t, toLang) {
    if (!toLang || toLang === LANG) return t;
    var a = spans(LANG), b = spans(toLang), i = 0;
    for (var j = 0; j < a.length; j++) if (t >= a[j].start - 0.001) i = j;
    if (!b[i]) return t;
    var off = Math.max(0, t - a[i].start);
    return b[i].start + Math.min(off, Math.max(0, b[i].dur - 0.05));
  }

  // v5 cross-site landing (lang-switch.js): ?ch=<id>&b=<beat>&f=<0..1>&next=<ids> — by chapter ID, never by position
  // (condor FR has 34 chapters, EN 35: 'clarify' is missing). IDX = per chapter its units [start, dur] in THIS language
  // (a chapter without beats is one unit) — the same layout the timeline was built with.
  var IDX = TOC.map(function (c, k) {
    var src = PIECE.chapters[k], t = c.t;
    return { id: c.id, t: c.t, beats: (src.beats || [src]).map(function (u) { var d = L(u.duration), r = [t, d]; t += d; return r; }) };
  });
  function locate(t) { // -> { id, b, f, next } for time t (the switch's source side)
    var k = 0, j = 0, q;
    for (q = 0; q < IDX.length; q++) if (t >= IDX[q].t - 0.001) k = q;
    var c = IDX[k];
    for (q = 0; q < c.beats.length; q++) if (t >= c.beats[q][0] - 0.001) j = q;
    var u = c.beats[j], f = u[1] > 0 ? Math.max(0, Math.min(1, (t - u[0]) / u[1])) : 0;
    return { id: c.id, b: j, f: f, next: IDX.slice(k + 1).map(function (x) { return x.id; }) };
  }
  function find(id) { for (var q = 0; q < IDX.length; q++) if (IDX[q].id === id) return q; return -1; }
  function land(id, b, f, next) { // -> { id, b, t, missing, from } (the target side)
    var k = find(id);
    if (k < 0) { // the chapter is not in this language: the first FOLLOWING source chapter present here, else the last
      for (var n = 0; n < (next || []).length && k < 0; n++) k = find(next[n]);
      if (k < 0) k = IDX.length - 1;
      return { id: IDX[k].id, b: 0, t: IDX[k].t + 0.01, missing: true, from: id };
    }
    var c = IDX[k], j = Math.max(0, Math.min(c.beats.length - 1, Math.floor(Number(b)) || 0)), u = c.beats[j];
    var ff = isFinite(Number(f)) ? Math.max(0, Math.min(1, Number(f))) : 0;
    return { id: c.id, b: j, t: u[0] + Math.min(ff * u[1], Math.max(0, u[1] - 0.05)), missing: false, from: id };
  }

  if (reduce) tl.seek(Math.max(0, (CH[1] ? CH[1].t : tl.duration()) - 0.05), true).pause();

  window.MOTION = {
    timeline: tl, duration: tl.duration(), reducedMotion: reduce, tempo: TEMPO, labels: tl.labels, chapters: CH, toc: TOC, ui: UI,
    chapterAt: function (t) { return current(t); },
    lang: LANG, langs: LANGS, langNames: LANG_NAMES, render: render, mapTime: mapTime,
    index: IDX, locate: locate, land: land, landing: null, // v5 cross-site switch
    seek: function (t) { tl.pause(); tl.seek(Math.max(0, Math.min(t, tl.duration())), true); render(tl.time()); return tl.time(); },
    play: function () { if (tl.progress() >= 1) tl.restart(); else tl.play(); },
    pause: function () { tl.pause(); },
    replay: function () { tl.restart(); }
  };
  var Q = new URLSearchParams(location.search), qch = Q.get('ch');
  if (qch) { // v5: a sibling-site switch wins over ?t
    var ld = land(qch, Q.get('b'), Q.get('f'), (Q.get('next') || '').split(',').filter(Boolean));
    tl.seek(Math.min(ld.t, tl.duration()), true).pause();
    window.MOTION.landing = ld;
  } else {
    var start = Number(Q.get('t'));
    if (start > 0) { tl.seek(Math.min(start, tl.duration()), true); }
  }
  render(tl.time());
})();
