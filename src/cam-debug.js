// ── Camera / hole-framing DEBUG overlay (?dbg) ───────────────────────────────────────────────
// Peel-off-able diagnostic for the hole-to-hole framing bug (e.g. Luna hole 2 renders below the
// screen in a real continuous run, though it's fine in a direct ?course=luna load). Reads engine
// globals ONLY — never mutates game state. Enable by adding &dbg to the URL. Top-right green box +
// a console line on each new hole (so there's a scrollback trail to copy).
(function () {
  if (typeof location === 'undefined' || !/[?&]dbg\b/i.test(location.search)) return;

  var el = null;
  // Transition-event log — records WHAT happens across a sink → hole-to-hole move (state changes, hole
  // changes, terrain REGEN, and any sudden recolour of the terrain fill), each stamped with a frame number,
  // so the whole "stuff that happens on transition" is visible + a recolour POP is flagged the instant it lands.
  var frame = 0, evLog = [], pState = null, pHole = -1, pVlen = -1, pCol = null;
  function box() {
    if (el) return el;
    el = document.createElement('div');
    el.id = 'cam-dbg';
    el.style.cssText = 'position:fixed;top:8px;right:8px;z-index:99999;'
      + 'font:12px/1.45 "Departure Mono",monospace;background:rgba(0,0,0,0.82);color:#3f6;'
      + 'padding:8px 11px;border:1px solid #3f6;border-radius:6px;white-space:pre;'
      + 'pointer-events:none;text-shadow:none;letter-spacing:0;max-width:46vw;';
    document.body.appendChild(el);
    return el;
  }
  function R(v) { return (typeof v === 'number' && isFinite(v)) ? Math.round(v) : '?'; }
  function cs(c) { return c ? (c[0] + ',' + c[1] + ',' + c[2]) : '?'; }
  // Sample the rendered terrain-fill colour at bottom-centre (deep fill) — a recolour there = the strata pop.
  function sampleCol() {
    try {
      if (typeof ctx === 'undefined' || typeof canvas === 'undefined' || typeof W === 'undefined') return null;
      var ds = (canvas.width / W) || 1;
      var d = ctx.getImageData(Math.round(W * 0.5 * ds), Math.round((H - 24) * ds), 1, 1).data;
      return [d[0], d[1], d[2]];
    } catch (e) { return null; }
  }
  function push(ev) { evLog.push('f' + frame + ' ' + ev); if (evLog.length > 7) evLog.shift(); try { console.log('[dbg] f' + frame + ' ' + ev); } catch (e) {} }

  function tick() {
    frame++;
    try {
      if (typeof camera !== 'undefined' && typeof ball !== 'undefined'
          && typeof holes !== 'undefined' && holes.length && typeof W !== 'undefined') {
        var ci = (typeof currentHole !== 'undefined') ? currentHole : 0;
        var h = holes[ci] || {};
        var camY = camera.y || 0;
        var sx = ball.x - camera.x, sy = ball.y - camY;
        var ballOn = sx > -50 && sx < W + 50 && sy > -50 && sy < H + 50;
        var lo = 1e9, hi = -1e9, ok = (typeof terrainYAt === 'function' && h.teeX != null && h.cupX != null);
        if (ok) { var a = Math.min(h.teeX, h.cupX), b = Math.max(h.teeX, h.cupX);
          for (var i = 0; i <= 24; i++) { var ty = terrainYAt(a + (b - a) * i / 24); if (ty < lo) lo = ty; if (ty > hi) hi = ty; } }
        var topScr = ok ? lo - camY : NaN, botScr = ok ? hi - camY : NaN;
        var terrInView = ok && botScr > 0 && topScr < H;
        var course = window.RG ? RG.course : '?';
        var st = (typeof state !== 'undefined') ? state : null;
        var vlen = (typeof vertices !== 'undefined') ? vertices.length : -1;
        var col = sampleCol();

        // ── transition-event detection (this is the "showcase everything that happens" part) ──
        if (pState !== null && st !== pState) push('state ' + pState + '→' + st + '  (hole ' + (ci + 1) + ')');
        if (pHole !== -1 && ci !== pHole) push('HOLE ' + (pHole + 1) + '→' + (ci + 1) + '  cam.x=' + R(camera.x));
        if (pVlen !== -1 && vlen !== pVlen) push('terrain REGEN  verts ' + pVlen + '→' + vlen);
        if (pCol && col && (Math.abs(col[0] - pCol[0]) + Math.abs(col[1] - pCol[1]) + Math.abs(col[2] - pCol[2])) > 60)
          push('TERRAIN RECOLOUR ' + cs(pCol) + '→' + cs(col) + ' *** POP');
        pState = st; pHole = ci; pVlen = vlen; pCol = col;

        var live =
          'course ' + course + '   hole ' + (ci + 1) + '\n' +
          'state ' + (st == null ? '?' : st) + '   desc ' + (window.RG ? !!RG.descending : '?') + '\n' +
          'cam x=' + R(camera.x) + ' y=' + R(camY) + (camY ? ' <== NONZERO!' : '') + '\n' +
          'ballScr ' + R(sx) + ',' + R(sy) + ' ' + (ballOn ? 'ON' : '*OFF*') + '   verts ' + vlen + '\n' +
          'terrScrY ' + R(topScr) + '..' + R(botScr) + ' ' + (terrInView ? 'in' : '*OFF*') + '   fillCol ' + cs(col) + '\n' +
          '_tCamY1 ' + (window.RG ? RG._tCamY1 : '?') + '   atlas ' + (!!window.RG_ATLAS);
        box().textContent = live + (evLog.length ? ('\n─ events ─\n' + evLog.join('\n')) : '');
      }
    } catch (e) { if (el) el.textContent = 'dbg err: ' + (e && e.message); }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();
