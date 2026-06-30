// ── In-game STAR MAP launcher (META) ─────────────────────────────────────────
// Makes the real progression star map reachable FROM the running game: press M (or click the
// small ✦ MAP chip, top-right) to open starmap.html as a full-screen overlay (an iframe, same
// origin → it reads the same RG_SCORES localStorage, so it shows your REAL per-planet scores +
// frontier). Click an already-played planet there → it navigates the top window to
// devbuild.html?course=<id>, which boots that body to REPLAY it. ESC (or the ✕) closes the map and
// returns to the run untouched.
//
// Additive + peel-off-able: one DOM chip + one key handler + one iframe overlay; touches nothing
// in the base loop. Peel this file + its <script> tag → the game is unchanged.
(function () {
  'use strict';
  if (typeof document === 'undefined') return;
  // Don't show in dev/sampler/editor contexts that own their own UI.
  if (/[?&](showcase|edit|galaxy|atlas|watersim|nomap)\b/.test(location.search)) return;

  var overlay = null;

  function open() {
    if (overlay) return;
    overlay = document.createElement('div');
    overlay.id = 'rg-starmap-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9000;background:#05060c;'
      + 'opacity:0;transition:opacity .2s;';
    var ifr = document.createElement('iframe');
    // ?nonav is NOT set → clicking a planet navigates the parent to devbuild.html?course=<id> (real replay).
    ifr.src = 'starmap.html';
    ifr.style.cssText = 'width:100%;height:100%;border:none;display:block;';
    overlay.appendChild(ifr);

    // close chip
    var close = document.createElement('div');
    close.textContent = '✕ CLOSE  (ESC)';
    close.style.cssText = 'position:absolute;top:14px;right:18px;z-index:2;cursor:pointer;'
      + "font:12px 'Departure Mono',monospace;color:rgba(220,230,245,0.8);"
      + 'background:rgba(10,14,24,0.7);border:1px solid rgba(150,165,210,0.3);padding:6px 10px;';
    close.addEventListener('click', closeMap);
    overlay.appendChild(close);

    document.body.appendChild(overlay);
    requestAnimationFrame(function () { overlay.style.opacity = '1'; });
  }

  function closeMap() {
    if (!overlay) return;
    var o = overlay; overlay = null;
    o.style.opacity = '0';
    setTimeout(function () { if (o.parentNode) o.parentNode.removeChild(o); }, 220);
  }

  // The MAP chip (top-right; mirrors the in-run HUD style). pointer-events on so it's clickable.
  function addChip() {
    var chip = document.createElement('div');
    chip.id = 'rg-map-chip';
    chip.textContent = '✦ MAP';
    chip.title = 'Star map (M) — replay any planet';
    chip.style.cssText = 'position:fixed;top:16px;right:22px;z-index:60;cursor:pointer;'
      + "font:13px 'Departure Mono',monospace;color:rgba(220,230,245,0.8);letter-spacing:2px;"
      + 'text-shadow:0 1px 4px rgba(0,0,0,0.5);user-select:none;';
    chip.addEventListener('mouseenter', function () { chip.style.color = '#fff6df'; });
    chip.addEventListener('mouseleave', function () { chip.style.color = 'rgba(220,230,245,0.8)'; });
    chip.addEventListener('click', open);
    document.body.appendChild(chip);
  }

  window.addEventListener('keydown', function (e) {
    if (e.key === 'm' || e.key === 'M') { if (overlay) closeMap(); else open(); }
    else if (e.key === 'Escape' && overlay) closeMap();
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', addChip);
  else addChip();

  window.RG_STARMAP = { open: open, close: closeMap };
})();
