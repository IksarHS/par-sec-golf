// ── The Manual (Tunic-style runic codex) ──────────────────
// A collectible reference: each secret you've EVER found becomes a page — drawn as an
// untranslatable rune. Press M to open it. The names stay in the rune-script until you find
// the DECODER (the Leviathan — "the eye that reads"); after that, every page reads plainly and
// you can retro-see what you've got and how many remain. Player-facing (NOT ?dev-gated), but
// hidden until your first discovery, so it never spoils that secrets exist.
//
// Loads after wrap.js. Peel it off and nothing else changes.
(function () {
  // Page display strings by flag (name + post-decode hint). The page ORDER and MEMBERSHIP come
  // from the canonical RG_SECRET_FLAGS (secrets.js), so a new secret is added in ONE place; this
  // map only supplies the words. `flag` = the rg-knows-* set when found; keys also seed each rune.
  var META = {
    fault: { name: 'THE FAULT', hint: 'the ground is not always solid' },
    patient: { name: 'THE PATIENT REST', hint: 'stillness is a stroke' },
    sun: { name: 'THE SUN', hint: 'the sky is a switch' },
    leviathan: { name: 'THE WATCHER', hint: 'it was never just golf' },
  };
  var PAGES = (window.RG_SECRET_FLAGS || Object.keys(META)).map(function (f) {
    var m = META[f] || { name: f.toUpperCase(), hint: '' };
    return { flag: f, name: m.name, hint: m.hint };
  });
  var DECODER = 'leviathan'; // finding this lets you READ the codex
  function knows(f) { try { return localStorage.getItem('rg-knows-' + f) === '1'; } catch (e) { return false; } }

  // A deterministic rune for a key: nodes on a 3x4 lattice, a few edges + a circle, hashed.
  function hash(str) { var h = 0x811c9dc5 >>> 0; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function drawRune(ctx, key, S, lit) {
    var h = hash(key), col = lit ? '#c98bff' : 'rgba(178,77,255,0.5)';
    ctx.clearRect(0, 0, S, S);
    ctx.save(); ctx.translate(S * 0.5, S * 0.5);
    var nx = [-1, 0, 1], ny = [-1.1, -0.37, 0.37, 1.1], R = S * 0.30;
    function P(i) { return { x: nx[i % 3] * R, y: ny[(i / 3 | 0) % 4] * R }; }
    ctx.strokeStyle = col; ctx.lineWidth = Math.max(2, S * 0.045); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    var n = 4 + (h % 4), prev = h % 12;          // a connected stroke through 4-7 lattice nodes
    var a = P(prev); ctx.moveTo(a.x, a.y);
    for (var k = 0; k < n; k++) { h = Math.imul(h ^ (h >>> 13), 0x2c1b3c6d); var idx = h % 12; var p = P(idx); ctx.lineTo(p.x, p.y); }
    ctx.stroke();
    if ((h & 1)) { ctx.beginPath(); ctx.arc(0, ny[h % 4] * R * 0.5, S * 0.10, 0, Math.PI * 2); ctx.stroke(); }  // the rune's "eye"
    ctx.restore();
  }

  var openEl = null;
  function close() { if (openEl) { openEl.remove(); openEl = null; } }
  function open() {
    if (openEl) { close(); return; }
    var found = PAGES.filter(function (p) { return knows(p.flag); });
    if (!found.length) return;                    // never opens before the first discovery
    var decoded = knows(DECODER);
    var el = document.createElement('div'); openEl = el; el.id = 'rg-manual';
    el.style.cssText = 'position:fixed;inset:0;z-index:9994;background:rgba(8,6,12,0.96);display:flex;'
      + 'flex-direction:column;align-items:center;justify-content:center;font-family:"Departure Mono",monospace;color:#f2ecff;';
    var title = document.createElement('div');
    title.style.cssText = 'font-size:24px;letter-spacing:4px;color:#c98bff;margin-bottom:4px;';
    title.textContent = decoded ? 'THE CODEX' : '◇◈◇ ◆◇◈';
    el.appendChild(title);
    var sub = document.createElement('div');
    sub.style.cssText = 'font-size:12px;color:rgba(242,236,255,0.5);margin-bottom:22px;';
    sub.textContent = found.length + ' / ' + PAGES.length + ' pages' + (decoded ? '' : '  ·  unreadable — something must teach you to read it');
    el.appendChild(sub);
    var grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,90px);gap:14px 18px;max-width:560px;justify-content:center;';
    found.forEach(function (p) {
      var cell = document.createElement('div'); cell.style.cssText = 'width:90px;text-align:center;';
      var cv = document.createElement('canvas'); cv.width = 80; cv.height = 80;
      cv.style.cssText = 'width:62px;height:62px;background:rgba(178,77,255,0.06);border:1px solid rgba(178,77,255,0.25);border-radius:9px;';
      drawRune(cv.getContext('2d'), p.flag, 80, true);
      cell.appendChild(cv);
      var lbl = document.createElement('div');
      lbl.style.cssText = 'font-size:10px;margin-top:5px;color:rgba(242,236,255,0.75);line-height:1.3;';
      lbl.textContent = decoded ? p.name : '·····';
      cell.appendChild(lbl);
      if (decoded) { var ht = document.createElement('div'); ht.style.cssText = 'font-size:9px;color:rgba(201,139,255,0.6);margin-top:1px;'; ht.textContent = p.hint; cell.appendChild(ht); }
      grid.appendChild(cell);
    });
    el.appendChild(grid);
    var foot = document.createElement('div');
    foot.style.cssText = 'margin-top:24px;font-size:11px;color:rgba(242,236,255,0.35);';
    foot.textContent = 'press M or tap to close';
    el.appendChild(foot);
    el.addEventListener('click', close);
    document.body.appendChild(el);
  }

  window.addEventListener('keydown', function (e) {
    if (/INPUT|TEXTAREA/.test((e.target && e.target.tagName) || '')) return;
    if (e.key === 'm' || e.key === 'M') { open(); e.preventDefault(); }
    else if (e.key === 'Escape') close();
  });
  if (window.RG) RG.openManual = open;            // also openable from code / a future in-world page
})();
