// ── Camera / hole-framing DEBUG overlay (?dbg) ───────────────────────────────────────────────
// Peel-off-able diagnostic for the hole-to-hole framing bug (e.g. Luna hole 2 renders below the
// screen in a real continuous run, though it's fine in a direct ?course=luna load). Reads engine
// globals ONLY — never mutates game state. Enable by adding &dbg to the URL. Top-right green box +
// a console line on each new hole (so there's a scrollback trail to copy).
(function () {
  if (typeof location === 'undefined' || !/[?&]dbg\b/i.test(location.search)) return;

  var el = null, lastHole = -1, lastCourse = '';
  function box() {
    if (el) return el;
    el = document.createElement('div');
    el.id = 'cam-dbg';
    el.style.cssText = 'position:fixed;top:8px;right:8px;z-index:99999;'
      + 'font:12px/1.45 "Departure Mono",monospace;background:rgba(0,0,0,0.82);color:#3f6;'
      + 'padding:8px 11px;border:1px solid #3f6;border-radius:6px;white-space:pre;'
      + 'pointer-events:none;text-shadow:none;letter-spacing:0;';
    document.body.appendChild(el);
    return el;
  }
  function R(v) { return (typeof v === 'number' && isFinite(v)) ? Math.round(v) : '?'; }

  function tick() {
    try {
      if (typeof camera !== 'undefined' && typeof ball !== 'undefined'
          && typeof holes !== 'undefined' && holes.length && typeof W !== 'undefined') {
        var ci = (typeof currentHole !== 'undefined') ? currentHole : 0;
        var h = holes[ci] || {};
        var camY = camera.y || 0;
        var sx = ball.x - camera.x, sy = ball.y - camY;
        var ballOn = sx > -50 && sx < W + 50 && sy > -50 && sy < H + 50;
        // Terrain vertical extent across the hole (sampled), in SCREEN space.
        var lo = 1e9, hi = -1e9, ok = (typeof terrainYAt === 'function' && h.teeX != null && h.cupX != null);
        if (ok) {
          var a = Math.min(h.teeX, h.cupX), b = Math.max(h.teeX, h.cupX);
          for (var i = 0; i <= 24; i++) { var ty = terrainYAt(a + (b - a) * i / 24); if (ty < lo) lo = ty; if (ty > hi) hi = ty; }
        }
        var topScr = ok ? lo - camY : NaN, botScr = ok ? hi - camY : NaN;
        var terrInView = ok && botScr > 0 && topScr < H;
        var course = window.RG ? RG.course : '?';

        box().textContent =
          'course ' + course + '   hole ' + (ci + 1) + '\n' +
          'state ' + (typeof state !== 'undefined' ? state : '?') + '   desc ' + (window.RG ? !!RG.descending : '?') + '\n' +
          'view   ' + R(W) + ' x ' + R(H) + '\n' +
          'cam    x=' + R(camera.x) + '  y=' + R(camY) + (camY ? '  <== NONZERO!' : '') + '\n' +
          'ball   x=' + R(ball.x) + '  y=' + R(ball.y) + (ball.atRest ? '  rest' : '  move') + '\n' +
          'ballScr ' + R(sx) + ' , ' + R(sy) + '   ' + (ballOn ? 'ON' : '*** OFF-SCREEN ***') + '\n' +
          'cupScr  ' + R((h.cupX != null ? h.cupX : NaN) - camera.x) + ' , ' + R((h.cupY != null ? h.cupY : NaN) - camY) + '\n' +
          'terrScrY ' + R(topScr) + ' .. ' + R(botScr) + '   ' + (terrInView ? 'in view' : '*** TERRAIN OFF-SCREEN ***') + '\n' +
          '_tCamY1 ' + (window.RG ? RG._tCamY1 : '?') + '   atlas ' + (!!window.RG_ATLAS);

        if (ci !== lastHole || course !== lastCourse) {
          lastHole = ci; lastCourse = course;
          console.log('[dbg] ' + course + ' hole ' + (ci + 1)
            + ' | cam.y=' + R(camY)
            + ' ballScr=' + R(sx) + ',' + R(sy) + '(' + (ballOn ? 'ON' : 'OFF') + ')'
            + ' terrScrY=' + R(topScr) + '..' + R(botScr) + '(' + (terrInView ? 'in' : 'OFF') + ')');
        }
      }
    } catch (e) { if (el) el.textContent = 'dbg err: ' + (e && e.message); }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();
