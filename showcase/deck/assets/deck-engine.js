/* ============================================================
   Deck ENGINE (inline-sections host) for file:// deck chrome.
   Brand-agnostic: this engine touches NO colors — the component sheet
   (deck.css) consumes var() only and defines none; brand values live in
   the consumer's brand token files loaded FIRST.
   Do NOT fork nav/keyboard/fit semantics in a consumer — edit HERE.
   ============================================================ */
/* ============================================================
   DDX Deck — shared ENGINE
   nav (kbd/click/touch/deep-link) · progress rail · overview (O)
   side carousel (C) · home/TOC (H) · artefact play()/stop() on activate
   direction-aware transitions · fonts.ready re-fit
   reduced-motion aware · zero per-deck edits (data-total/data-sec driven)

   Markup contract (see ../DOM-CONTRACT.md):
     #deck > #stage > .slide[data-sec="Section name"] (one per slide)
     each .slide has .frame (animated children) and optional .rail > i
     artefact slides carry: <div data-art="artefactName"> wired via window.REG
   Load AFTER tokens + deck.css; load artefacts.js AFTER this file.
   ============================================================ */
(function () {
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const stage = document.getElementById('stage');
  const slides = Array.from(document.querySelectorAll('.slide'));
  const total = slides.length;
  let i = 0;
  let activeArt = [];        // live artefact instances on the current slide

  // ----- responsive scale: fit the stage (#stage[data-format], default 1920×1080) into viewport -----
  // Stage size comes from deck.css --stage-w/--stage-h; the fallbacks are the 16x9 literals.
  let stageW = 1920, stageH = 1080;
  function readStageSize() {
    const cs = stage ? getComputedStyle(stage) : null;
    stageW = (cs && parseFloat(cs.getPropertyValue('--stage-w'))) || 1920;
    stageH = (cs && parseFloat(cs.getPropertyValue('--stage-h'))) || 1080;
  }
  function fit() {
    readStageSize();
    const s = Math.min(window.innerWidth / stageW, window.innerHeight / stageH);
    stage.style.transform = 'scale(' + s + ')';
  }
  window.addEventListener('resize', fit); fit();

  // ----- artefact engine: window.REG[name] = (rootEl) => ({ play(), stop() }) -----
  function stopArt() { activeArt.forEach(a => { try { a.stop && a.stop(); } catch (e) {} }); activeArt = []; }
  function startArt(slide) {
    stopArt();
    if (!window.REG) return;
    slide.querySelectorAll('[data-art]').forEach(el => {
      const factory = window.REG[el.dataset.art];
      if (typeof factory !== 'function') return;
      let inst; try { inst = factory(el); } catch (e) { return; }
      if (!inst) return;
      activeArt.push(inst);
      if (reduce) { try { inst.snap ? inst.snap() : (inst.play && inst.play()); inst.stop && inst.stop(); } catch (e) {} }
      else {
        // paint a valid initial frame synchronously (so the artefact is never blank,
        // even in a throttled/hidden tab), then run the live animation shortly after.
        try { inst.snap && inst.snap(); } catch (e) {}
        setTimeout(() => { try { inst.play && inst.play(); } catch (e) {} }, 220);
      }
    });
  }

  // ----- progress rail + counter -----
  const curEl = document.getElementById('cur'), totEl = document.getElementById('tot'), secEl = document.getElementById('secname');
  if (totEl) totEl.textContent = total;

  // ----- auto-fit: scale a slide's .frame content down if it overflows the stage height -----
  // The frame box is top:128 / bottom:92 (avail stageH-220 = 860px at 16x9) — or
  // stageH-80 (1000px at 16x9) for .frame.center. Bands derive from stageH so a
  // 9x16 stage does not over-shrink. Scale-to-fit keeps everything in-viewport.
  function fitFrame(sl) {
    const f = sl.querySelector('.frame');
    if (!f) return;
    // Reset BOTH transform and width before measuring. fitFrame is re-run
    // several times per activation (rAF + a 260ms settle); leaving the
    // previous run's inflated width in place makes each pass measure its
    // own output and the frame ratchets wider every time.
    f.style.transform = ''; f.style.transformOrigin = 'top left';
    f.style.width = '';
    const avail = f.classList.contains('center') ? stageH - 80 : (stageH - 128 - 92);
    const h = f.scrollHeight;
    if (h > avail + 4) {
      const s = Math.max(0.5, avail / h);
      f.style.transform = `scale(${s})`;
      // Keep horizontal fill after scaling so content doesn't shrink to a
      // column. `width: (100/s)%` is measured against the frame's PARENT,
      // which spans the full stage width — not against the frame's own inset
      // box. On an inset frame (left:128/right:128) that over-widens by
      // exactly the inset, and the extra width lands entirely on the right
      // edge because transform-origin is top-left: the rightmost column of
      // a grid then hangs off the slide. Measured 2026-08-29 on two dense
      // slides (frame 1664px wide reported as 1920 after fit).
      // Compensating for the inset keeps the post-scale box aligned to the
      // frame's own left/right edges.
      const parentW = f.parentElement ? f.parentElement.getBoundingClientRect().width : 0;
      const inset = parentW ? Math.max(0, parentW - f.offsetWidth) : 0;
      f.style.width = parentW
        ? ((parentW - inset) / s) + 'px'
        : (100 / s) + '%';
    } else {
      f.style.width = '';
    }
  }

  function show(n) {
    n = Math.max(0, Math.min(total - 1, n));
    // direction-aware entrance: forward enters from below,
    // backward from above — deck.css keys the initial transform off data-dir.
    if (stage) stage.dataset.dir = n >= i ? 'fwd' : 'back';
    slides[i].classList.remove('active');
    i = n;
    const sl = slides[i];
    sl.classList.add('active');
    // re-trigger child reveal animation (unless reduced motion)
    if (!reduce) sl.querySelectorAll('.frame > *').forEach(el => { el.style.animation = 'none'; el.offsetHeight; el.style.animation = ''; });
    startArt(sl);
    fitFrame(sl);
    // artefacts build async (snap on activate, svg sizing settles next frame) — re-fit shortly after
    requestAnimationFrame(() => fitFrame(sl));
    setTimeout(() => fitFrame(sl), 260);
    if (curEl) curEl.textContent = i + 1;
    if (secEl) secEl.textContent = sl.dataset.sec || '';
    const rail = sl.querySelector('.rail > i');
    if (rail) rail.style.setProperty('--p', (i / (total - 1) * 100).toFixed(1) + '%');
    const np = document.getElementById('navPrev'), nn = document.getElementById('navNext');
    if (np) np.style.visibility = i === 0 ? 'hidden' : 'visible';
    if (nn) nn.style.visibility = i === total - 1 ? 'hidden' : 'visible';
    syncCarousel();
    try { history.replaceState(null, '', '#' + (i + 1)); } catch (e) {}
  }
  // Edge continuation (2026-07-13): past the last slide / before the first,
  // chain into the consumer-injected window.DDX_TUTORIAL_NAV chapter links so
  // a reader can traverse a whole multi-chapter tutorial with →/space alone.
  // No island → clamp at the edges exactly as before (standalone decks).
  function next() {
    if (i >= total - 1) {
      var nv = window.DDX_TUTORIAL_NAV;
      if (nv && nv.next) { location.href = nv.next; return; }
      // Last slide of the LAST chapter: wrap to the tutorial contents page
      // (which renders the continue-state) instead of clamping silently —
      // the "stuck at the end of the tutorial" defect, 2026-07-13.
      if (nv && nv.home) { location.href = nv.home; return; }
    }
    show(i + 1);
  }
  function prev() {
    if (i <= 0) {
      var nv = window.DDX_TUTORIAL_NAV;
      if (nv && nv.prev) { location.href = nv.prev + '#end'; return; }
    }
    show(i - 1);
  }
  function replay() { startArt(slides[i]); if (!reduce) slides[i].querySelectorAll('.frame > *').forEach(el => { el.style.animation = 'none'; el.offsetHeight; el.style.animation = ''; }); }

  // ----- overview grid (grouped by data-sec) -----
  const ov = document.getElementById('overview');
  function buildOverview() {
    const body = document.getElementById('ovBody');
    if (!body || body.dataset.built) return; body.dataset.built = '1';
    body.innerHTML = sectionGroups().map(g => `
      <div class="ov-sec"><div class="ov-h">${esc(g.sec)}</div><div class="ov-grid">
        ${g.items.map(it => `<div class="ov-item" data-go="${it.idx}"><span class="ovn">${pad(it.idx + 1)}</span><span>${esc(it.title)}</span></div>`).join('')}
      </div></div>`).join('');
    body.querySelectorAll('.ov-item').forEach(el => el.addEventListener('click', () => { show(+el.dataset.go); ov.classList.remove('show'); }));
  }

  // ----- side carousel (thumbnail strip), grouped by data-sec -----
  const cz = document.getElementById('carousel');
  function buildCarousel() {
    if (!cz || cz.dataset.built) return; cz.dataset.built = '1';
    cz.innerHTML = sectionGroups().map(g => `
      <div class="cz-h">${esc(g.sec)}</div>
      ${g.items.map(it => `<div class="cz-item" data-go="${it.idx}"><span class="czn">${pad(it.idx + 1)}</span><span>${esc(it.title)}</span></div>`).join('')}`).join('');
    cz.querySelectorAll('.cz-item').forEach(el => el.addEventListener('click', () => { show(+el.dataset.go); }));
  }
  function syncCarousel() {
    if (!cz || !cz.dataset.built) return;
    cz.querySelectorAll('.cz-item').forEach(el => el.classList.toggle('active', +el.dataset.go === i));
    const a = cz.querySelector('.cz-item.active'); if (a && cz.classList.contains('show')) a.scrollIntoView({ block: 'nearest' });
  }
  function toggleCarousel() {
    if (!cz) return;
    buildCarousel();
    const open = cz.classList.toggle('show');
    document.body.classList.toggle('cz-open', open);
    if (open) syncCarousel();
  }

  // ----- shared helpers -----
  function sectionGroups() {
    const groups = []; let last = null;
    slides.forEach((s, idx) => {
      const sec = s.dataset.sec || 'Slides';
      if (!last || last.sec !== sec) { last = { sec, items: [] }; groups.push(last); }
      const t = (s.querySelector('h1, h2, h3') || {}).textContent || sec;
      last.items.push({ idx, title: t.trim().replace(/\s+/g, ' ').slice(0, 60) });
    });
    return groups;
  }
  function pad(n) { return String(n).padStart(2, '0'); }
  function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

  // ----- keyboard -----
  document.addEventListener('keydown', e => {
    if (ov && ov.classList.contains('show')) { if (e.key === 'Escape' || e.key.toLowerCase() === 'o') ov.classList.remove('show'); return; }
    const k = e.key.toLowerCase();
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ' || e.key === 'PageDown') { e.preventDefault(); next(); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp') { e.preventDefault(); prev(); }
    else if (e.key === 'Home') { e.preventDefault(); show(0); }
    else if (e.key === 'End') { e.preventDefault(); show(total - 1); }
    else if (k === 'o') { e.preventDefault(); buildOverview(); ov && ov.classList.add('show'); }
    else if (k === 'f') { e.preventDefault(); if (!document.fullscreenElement) { document.documentElement.requestFullscreen(); cz && cz.classList.remove('show'); document.body.classList.remove('cz-open'); } else document.exitFullscreen(); }
    else if (k === 'h') { e.preventDefault(); show(0); }
    else if (k === 'c') { e.preventDefault(); toggleCarousel(); }
    else if (k === 'r') { e.preventDefault(); replay(); }
    else if (e.key === 'Escape') { cz && cz.classList.remove('show'); document.body.classList.remove('cz-open'); }
  });

  // ----- click / touch nav -----
  const navPrev = document.getElementById('navPrev'), navNext = document.getElementById('navNext');
  if (navPrev) navPrev.addEventListener('click', e => { e.stopPropagation(); prev(); });
  if (navNext) navNext.addEventListener('click', e => { e.stopPropagation(); next(); });
  const homeBtn = document.getElementById('homeBtn'), czBtn = document.getElementById('czBtn');
  if (homeBtn) homeBtn.addEventListener('click', e => { e.stopPropagation(); show(0); });
  if (czBtn) czBtn.addEventListener('click', e => { e.stopPropagation(); toggleCarousel(); });

  const deck = document.getElementById('deck');
  if (deck) deck.addEventListener('click', e => {
    if (e.target.closest('.nav-arrow, a, button, .ov-item, .cz-item, #carousel, .hud-btn')) return;
    (e.clientX >= window.innerWidth / 2) ? next() : prev();
  });
  let tsx = 0; document.addEventListener('touchstart', e => tsx = e.changedTouches[0].clientX, { passive: true });
  document.addEventListener('touchend', e => { const dx = e.changedTouches[0].clientX - tsx; if (Math.abs(dx) > 50) (dx < 0 ? next() : prev()); }, { passive: true });

  // ----- deep-link via #n (plus '#end' — backward chapter-chaining lands on the last slide) -----
  if (location.hash === '#end') {
    show(total - 1);
  } else {
    const h = parseInt(location.hash.replace('#', ''), 10);
    show(Number.isFinite(h) && h >= 1 ? h - 1 : 0);
  }

  // ----- logo: only the kit's official <img data-kit="logo"> renders -----
  // The page carries the official logo file.
  // A broken file is reported loudly instead of leaving an empty box, and the
  // retired CSS stand-in (.lk-logo, text + dot) is reported, never styled.
  window.__kitErrors = window.__kitErrors || [];
  function kitError(msg) { window.__kitErrors.push(msg); console.error('[deck-engine] ' + msg); }
  document.querySelectorAll('img[data-kit="logo"]').forEach(img => {
    const bad = () => kitError('official logo failed to load: ' + img.getAttribute('src'));
    // an SVG without width/height can report naturalWidth 0 while loaded fine
    if (img.complete && img.naturalWidth === 0 && !/\.svg$/i.test(img.getAttribute('src') || '')) bad(); else img.addEventListener('error', bad, { once: true });
  });
  if (document.querySelector('.lk-logo')) kitError('.lk-logo is a CSS stand-in logo — emit the logo via kit/chrome.mjs');

  // artefacts.js is a separate deferred script that may load AFTER this one — if
  // window.REG wasn't ready when the first slide activated, re-start its artefacts
  // once everything has loaded (fixes the deep-link blank-artefact race).
  if (!window.REG) window.addEventListener('load', () => startArt(slides[i]), { once: true });

  // Webfont swap changes text metrics AFTER first fit — re-fit the current slide
  // once fonts settle (fit-guard re-runs on fonts.ready).
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => { fitFrame(slides[i]); });
  }

  // expose minimal API for decks that want programmatic control
  window.DECK = { show, next, prev, replay, toggleCarousel };
})();
