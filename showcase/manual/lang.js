/* Resolves the piece language BEFORE audio.js and the narration files load:
   ?lang=xx (if xx is in PIECE.langs) → else PIECE.defaultLang. Sets window.PIECE_LANG. */
(function () {
  'use strict';
  var P = window.PIECE || {};
  var langs = P.langs || ['en'];
  var want = (new URLSearchParams(location.search).get('lang') || '').toLowerCase();
  window.PIECE_LANG = langs.indexOf(want) >= 0 ? want : (P.defaultLang || langs[0]);
})();
