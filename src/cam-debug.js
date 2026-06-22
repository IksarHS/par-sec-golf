// ── DEBUG TOOLKIT (?dbg) ──────────────────────────────────────────────────────────────────────────
// Peel-off-able. Enable with &dbg in the URL. Press G to cycle: 1 stats · 2 stats + numbered terrain · 0 off.
// Reads engine globals only (never mutates game state). What it gives us:
//   • HOLE TYPE (archetype) + complexity + overhang flag, and hole N/total — so we always know what we're on.
//   • FPS + a FRAME-DROP counter (worst frame ms) — to chase the "choppy on camera move" lag.
//   • A transition EVENT LOG: state changes, hole changes, terrain REGEN, and a REAL terrain recolour (found by
//     tracking a FIXED world point — the cup area — so a camera pan past different terrain is NOT misflagged).
//   • Numbered TERRAIN VERTICES drawn on the canvas (mode 2) so a piece can be named — "vertex 7 went green→red".
(function () {
  if (typeof location === 'undefined' || !/[?&]dbg\b/i.test(location.search)) return;

  var MODE = 1;                      // 0 off · 1 stats · 2 stats + numbered terrain
  var el = null;
  var frame = 0, evLog = [], pState = null, pHole = -1, pVlen = -1, pCol = null;
  var _vid = 0, vidCol = {}, _vidCourse = null;   // persistent per-vertex ids + last-seen terrain colour (recolour watch)
  var lastT = (typeof performance !== 'undefined' && performance.now) ? performance.now() : 0;
  var fps = 0, dropCount = 0, worstDt = 0, dtAvg = 16.7;

  function box() {
    if (el) return el;
    el = document.createElement('div');
    el.id = 'cam-dbg';
    el.style.cssText = 'position:fixed;top:8px;right:8px;z-index:99999;'
      + 'font:12px/1.45 "Departure Mono",monospace;background:rgba(0,0,0,0.82);color:#3f6;'
      + 'padding:8px 11px;border:1px solid #3f6;border-radius:6px;white-space:pre;'
      + 'pointer-events:none;text-shadow:none;letter-spacing:0;max-width:48vw;';
    document.body.appendChild(el);
    return el;
  }
  function R(v) { return (typeof v === 'number' && isFinite(v)) ? Math.round(v) : '?'; }
  function cs(c) { return c ? (c[0] + ',' + c[1] + ',' + c[2]) : '?'; }
  // Sample the rendered colour at a SCREEN point (null if off-screen). Tracking a fixed WORLD point's colour
  // across frames tells a REAL recolour apart from the camera panning different terrain past a screen point.
  function sampleAt(sx, sy) {
    try {
      if (typeof ctx === 'undefined' || typeof canvas === 'undefined' || typeof W === 'undefined') return null;
      if (sx < 4 || sx > W - 4 || sy < 4 || sy > H - 4) return null;
      var ds = (canvas.width / W) || 1;
      var d = ctx.getImageData(Math.round(sx * ds), Math.round(sy * ds), 1, 1).data;
      return [d[0], d[1], d[2]];
    } catch (e) { return null; }
  }
  function push(ev) { evLog.push('f' + frame + ' ' + ev); if (evLog.length > 8) evLog.shift(); try { console.log('[dbg] f' + frame + ' ' + ev); } catch (e) {} }

  // Number every visible terrain vertex on the canvas (drawn AFTER the game frame) so a piece can be named.
  function drawLabels() {
    if (MODE < 2 || typeof ctx === 'undefined' || typeof vertices === 'undefined'
        || typeof camera === 'undefined' || typeof W === 'undefined') return;
    var ds = (canvas.width / W) || 1, camX = camera.x, camY = camera.y || 0;
    ctx.save(); ctx.scale(ds, ds); ctx.font = '10px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    for (var i = 0; i < vertices.length; i++) {
      var v = vertices[i]; if (!v) continue;
      var sx = v.x - camX, sy = v.y - camY;
      if (sx < -4 || sx > W + 4 || sy < -22 || sy > H + 4) continue;
      ctx.fillStyle = '#ff3'; ctx.beginPath(); ctx.arc(sx, sy, 2.2, 0, 6.2832); ctx.fill();
      var lbl = String(v._dbgId != null ? v._dbgId : i);   // PERSISTENT id (survives transitions), not the array index
      ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(sx - 4 - lbl.length * 3.5, sy - 17, 8 + lbl.length * 7, 12);
      ctx.fillStyle = '#9f9'; ctx.fillText(lbl, sx, sy - 7);
    }
    ctx.restore();
  }
  function wrapDraw() {   // wrap global draw() once so labels paint on top of the rendered frame
    if (window.__dbgDrawWrapped || typeof window.draw !== 'function') return;
    var _od = window.draw;
    window.draw = function () { var r = _od.apply(this, arguments); try { drawLabels(); } catch (e) {} return r; };
    window.__dbgDrawWrapped = true;
  }

  // ── testing keybinds ──
  // N: drop the ball just above the cup and let it fall in — a NATURAL sink, so the real transition (and, on
  //    the last hole, the real planet travel) plays exactly as in normal play. Fast way to reach a transition.
  function dropInCup() {
    try {
      if (typeof holes === 'undefined' || typeof currentHole === 'undefined' || typeof ball === 'undefined') return;
      var h = holes[currentHole]; if (!h || h.cupX == null) return;
      ball.x = h.cupX; ball.y = h.cupY - 38; ball.vx = 0; ball.vy = 0.6; ball.atRest = false; ball.onGround = false;
      if (typeof state !== 'undefined' && typeof STATE_FLIGHT !== 'undefined') state = STATE_FLIGHT;
      console.log('[dbg] drop-in over cup of hole ' + (currentHole + 1) + ' → natural sink + transition');
    } catch (e) {}
  }
  // M: jump straight to the first body of the NEXT star system (Sol → TRAPPIST-1 → Barnard's Star → wrap).
  function nextSystem() {
    try {
      var it = window.SOLAR_ITINERARY; if (!it || !window.RG || !RG.startRun) return;
      var starts = ['earth', 'trappist1h', 'barnard_e'];
      var ci = it.indexOf(RG.course), target = starts[0];
      for (var s = 0; s < starts.length; s++) { var si = it.indexOf(starts[s]); if (si > ci) { target = starts[s]; break; } }
      RG.startRun({ course: target, seed: RG.rollSeed() });
      console.log('[dbg] jump → next system: ' + target);
    } catch (e) {}
  }
  document.addEventListener('keydown', function (e) {
    var t = e.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
    var k = e.key;
    if (k === 'g' || k === 'G') { MODE = (MODE + 1) % 3; if (el) el.style.display = (MODE === 0) ? 'none' : 'block'; }
    else if (k === 'n' || k === 'N') dropInCup();
    else if (k === 'm' || k === 'M') nextSystem();
  });

  function tick() {
    frame++;
    var now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : lastT + 16.7;
    var dt = now - lastT; lastT = now;
    if (dt > 0 && dt < 1000) {
      dtAvg = dtAvg * 0.9 + dt * 0.1; fps = Math.round(1000 / dtAvg);
      if (frame > 40 && dt > 33) { dropCount++; if (dt > worstDt) worstDt = dt; if (MODE && dt > 50) push('FRAME DROP ' + Math.round(dt) + 'ms'); }
    }
    try {
      wrapDraw();
      if (MODE === 0) { requestAnimationFrame(tick); return; }
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
        var tot = (window.RG && RG.holeCount) || holes.length || 9;
        var col = (ok && h.cupX != null && h.cupY != null) ? sampleAt(h.cupX - camera.x, (h.cupY + 30) - camY) : null;
        var diff = (h.difficulty != null) ? (Math.round(h.difficulty * 100) / 100) : '?';
        var ovh = h._overhangs ? ' +ovh' : '';

        // ── change / transition events ──
        if (pState !== null && st !== pState) push('state ' + pState + '→' + st + '  (hole ' + (ci + 1) + ')');
        if (pHole !== -1 && ci !== pHole) push('HOLE ' + (pHole + 1) + '→' + (ci + 1) + '  [' + (h.archetype || '?') + ']');
        if (pVlen !== -1 && vlen !== pVlen) push('terrain REGEN  verts ' + pVlen + '→' + vlen);
        pState = st; pHole = ci; pVlen = vlen; pCol = col;

        // PERSISTENT vertex ids + per-vertex RECOLOUR WATCH (your idea): a vertex's terrain colour should never
        // change while it exists — if vtx #N goes blue→green, flag it with its STABLE id (precise pop catcher).
        // Sampled a bit INTO the terrain (solid strata, not the surface highlight); throttled to keep it cheap.
        if (typeof vertices !== 'undefined') {
          for (var ai = 0; ai < vertices.length; ai++) { var av = vertices[ai]; if (av && av._dbgId == null) av._dbgId = ++_vid; }
          var _cc = (window.RG && RG.course) || '';
          if (_cc !== _vidCourse) { vidCol = {}; _vidCourse = _cc; }   // new course = new terrain → reset colour memory (no false pop)
          if (frame % 12 === 0 && frame > 50) {                        // skip startup churn (default course → real course swap)
            for (var qi = 0; qi < vertices.length; qi++) {
              var qv = vertices[qi]; if (!qv || qv._dbgId == null) continue;
              var qx = qv.x - camera.x, qy = (qv.y + 22) - camY;
              if (qx < 6 || qx > W - 6 || qy < 6 || qy > H - 6) continue;
              var qc = sampleAt(qx, qy); if (!qc) continue;
              var qp = vidCol[qv._dbgId];
              if (qp && (Math.abs(qc[0] - qp[0]) + Math.abs(qc[1] - qp[1]) + Math.abs(qc[2] - qp[2])) > 50)
                push('vtx #' + qv._dbgId + ' RECOLOUR ' + cs(qp) + '→' + cs(qc) + ' *** POP');
              vidCol[qv._dbgId] = qc;
            }
          }
        }

        var live =
          'course ' + course + '   hole ' + (ci + 1) + '/' + tot + '   FPS ' + fps + (dropCount ? ('  drops ' + dropCount + '/worst ' + R(worstDt) + 'ms') : '') + '\n' +
          'TYPE  ' + (h.archetype || '?') + '   cplx ' + diff + ovh + '\n' +
          'state ' + (st == null ? '?' : st) + '   desc ' + (window.RG ? !!RG.descending : '?') + '   verts ' + vlen + '\n' +
          'cam x=' + R(camera.x) + ' y=' + R(camY) + (camY ? ' <==NONZERO' : '') + '   ballScr ' + R(sx) + ',' + R(sy) + ' ' + (ballOn ? 'ON' : '*OFF*') + '\n' +
          'terrScrY ' + R(topScr) + '..' + R(botScr) + ' ' + (terrInView ? 'in' : '*OFF*') + '   cupCol ' + cs(col) + '\n' +
          '_tCamY1 ' + (window.RG ? RG._tCamY1 : '?') + '   atlas ' + (!!window.RG_ATLAS) + (MODE === 2 ? '   [vertex #s ON]' : '') + '\n' +
          'G cycle dbg · N drop-in (natural next hole) · M next system';
        box().textContent = live + (evLog.length ? ('\n─ events ─\n' + evLog.join('\n')) : '');
      }
    } catch (e) { if (el) el.textContent = 'dbg err: ' + (e && e.message); }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();
