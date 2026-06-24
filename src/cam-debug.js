// ── DEBUG TOOLKIT (?dbg) ──────────────────────────────────────────────────────────────────────────
// Peel-off-able. Enable with &dbg in the URL. Press G to cycle: 1 stats · 2 stats + numbered terrain · 0 off.
// Reads engine globals only (never mutates game state). What it gives us:
//   • HOLE TYPE (archetype) + complexity + overhang flag, and hole N/total — so we always know what we're on.
//   • FPS + a FRAME-DROP counter (worst frame ms) — to chase the "choppy on camera move" lag.
//   • A transition EVENT LOG: state changes, hole changes, terrain REGEN, and a REAL terrain recolour (found by
//     tracking a FIXED world point — the cup area — so a camera pan past different terrain is NOT misflagged).
//   • Numbered TERRAIN VERTICES drawn on the canvas (mode 2) so a piece can be named — "vertex 7 went green→red".
// Registers two INDEPENDENT options with the unified menu: `camStats` (the stats box) and `vertexNums`
// (the on-canvas numbered vertices), plus actions `dropInCup` (N) and `nextSystem` (M).
(function () {
  if (typeof location === 'undefined') return;

  // Decoupled from the old G-cycled MODE: two independent flags, either on without the other.
  var statsOn = false;               // camStats — the diagnostic box (archetype, FPS, frame-drops, event log)
  var vertsOn = false;               // vertexNums — numbered terrain vertices painted on the canvas
  var el = null, body = null;
  var frame = 0, evLog = [], pState = null, pHole = -1, pVlen = -1, pCol = null;
  var _vid = 0, vidCol = {}, _vidCourse = null;   // persistent per-vertex ids + last-seen terrain colour (recolour watch)
  var lastT = (typeof performance !== 'undefined' && performance.now) ? performance.now() : 0;
  var fps = 0, dropCount = 0, worstDt = 0, dtAvg = 16.7;

  function box() {
    if (el) return el;
    el = document.createElement('div');
    el.id = 'cam-dbg';
    // pointer-events:auto on the OUTER box ONLY so the drag-handle strip + resize corner work; the readout
    // body is pointer-events:none so it never swallows a golf shot, and the box defaults to a corner.
    el.style.cssText = 'position:fixed;top:8px;right:8px;z-index:99999;'
      + 'font:12px/1.45 "Departure Mono",monospace;background:rgba(0,0,0,0.82);color:#3f6;'
      + 'padding:0 0 6px;border:1px solid #3f6;border-radius:6px;white-space:pre;'
      + 'pointer-events:auto;text-shadow:none;letter-spacing:0;max-width:48vw;';
    var handle = document.createElement('div');
    handle.className = 'dbg-drag-handle';
    handle.textContent = 'CAMERA / HOLE';
    handle.style.cssText = 'pointer-events:auto;font-size:9px;letter-spacing:1px;color:#9f9;'
      + 'background:rgba(51,255,102,0.12);padding:2px 11px;border-radius:5px 5px 0 0;'
      + 'border-bottom:1px solid rgba(51,255,102,0.3);user-select:none;';
    body = document.createElement('div');
    body.style.cssText = 'pointer-events:none;padding:8px 11px 0;white-space:pre;';
    el.appendChild(handle); el.appendChild(body);
    document.body.appendChild(el);
    if (window.DBG && window.DBG.makeMovable) {
      window.DBG.makeMovable(el, { handle: handle, resizable: true, storageKey: 'dbg-cam-pos' });
    }
    if (window.DBG && window.DBG.attachCopyButton) {
      window.DBG.attachCopyButton(handle, function () { return body ? body.textContent : ''; });
    }
    return el;
  }
  function R(v) { return (typeof v === 'number' && isFinite(v)) ? Math.round(v) : '?'; }
  function cs(c) { return c ? (c[0] + ',' + c[1] + ',' + c[2]) : '?'; }

  // ── plain-language helpers (so the readout reads like English, not raw numbers) ──
  // Game states → name + a one-line description of what the game is doing.
  // Full game-state table (from shared.js): name + what the game is doing.
  var STATE_INFO = { 0: ['AIM', 'waiting for / aiming a shot'], 1: ['FLIGHT', 'ball is moving'],
    2: ['IN-CUP', 'ball sank — settling in the hole'], 3: ['TRANSITION', 'travelling to the next hole'],
    4: ['OUT-OF-BOUNDS', 'ball left the course — respawning'], 5: ['COMPLETE', 'course finished — end screen'] };
  function stName(s) { return (STATE_INFO[s] && STATE_INFO[s][0]) || ('state ' + s); }
  function stDesc(s) { return (STATE_INFO[s] && STATE_INFO[s][1]) || ('unknown state ' + s); }
  // Name a rendered RGB by nearest-matching the engine's LIVE material colours (MATERIALS[k].color is
  // recoloured per-planet, so this is accurate on every body — not a hardcoded guess). Falls back to a
  // small static set if MATERIALS isn't reachable.
  var MAT_FALLBACK = { stone: [139, 142, 148], rock: [109, 100, 120], ice: [131, 204, 230], grass: [98, 168, 78],
    sand: [207, 138, 74], mud: [92, 71, 51], water: [47, 111, 176] };
  var BAND_MATS = { rock: 1, ice: 1, mud: 1 };   // materials that conditions legitimately paint as a band
  function hexRgb(h) { if (typeof h !== 'string') return null; var m = /^#?([0-9a-f]{6})$/i.exec(h.trim());
    if (!m) return null; var n = parseInt(m[1], 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function matName(rgb) {
    if (!rgb) return '?';
    var table = MAT_FALLBACK, live = {};
    try { if (typeof MATERIALS !== 'undefined' && MATERIALS) {
      for (var mk in MATERIALS) { if (!MATERIALS.hasOwnProperty(mk)) continue; var rc = hexRgb(MATERIALS[mk] && MATERIALS[mk].color); if (rc) live[mk] = rc; }
      if (Object.keys(live).length) table = live;
    } } catch (e) {}
    var best = '?', bd = 1e9;
    for (var k in table) { if (!table.hasOwnProperty(k)) continue; var c = table[k];
      var d = Math.abs(rgb[0] - c[0]) + Math.abs(rgb[1] - c[1]) + Math.abs(rgb[2] - c[2]);
      if (d < bd) { bd = d; best = k; } }
    return bd <= 70 ? best : 'terrain';   // within tolerance → name it; else generic
  }
  var lastProblem = null;   // { f, txt } of the most recent PROBLEM-severity event (drives the STATUS banner)
  var problemLog = [];      // PERSISTENT list of all problem/warn events this session (for polling, never scrolls away)
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
  // push(text, level): level ∈ 'info' (normal, calm) | 'warn' (notable) | 'problem' (a real bug — drives
  // the ⚠ STATUS banner). A leading glyph makes severity scannable at a glance.
  function push(ev, level) {
    level = level || 'info';
    var glyph = level === 'problem' ? '⚠ ' : level === 'warn' ? '! ' : '· ';
    var line = 'f' + frame + ' ' + glyph + ev;
    evLog.push(line); if (evLog.length > 8) evLog.shift();
    if (level === 'problem' || level === 'warn') {
      // PERSISTENT accumulator: problems/warns are NEVER lost to the 8-line scroll, so a slow poll
      // (or fast-forward autoplay) can always see every issue since the run started. Exposed for tooling.
      problemLog.push({ f: frame, level: level, txt: ev });
      if (problemLog.length > 60) problemLog.shift();
      try { window.__dbgProblems = problemLog; } catch (e) {}
    }
    if (level === 'problem') lastProblem = { f: frame, txt: ev };
    try { console.log('[dbg] ' + line); } catch (e) {}
  }

  // ── material histogram + off-palette LEAK scan (data-based — works for off-screen vertices too) ─────
  // The leak class: a "place" condition paints mat='rock' on fairway vertices and a later array reindex
  // strands them, leaking the off-palette material onto a hole that has NO active band. We detect it by
  // scanning vertices[i].mat against the course palette (currentCourse.defaultMaterial + .materials) and
  // EXEMPTING the currently-active painted band (RG._paintedBand, by vertex-object identity) plus the
  // always-legitimate hazards water/anomaly. Anything left over that's off-palette is a leak.
  function matCounts() {
    if (typeof vertices === 'undefined' || !vertices || !vertices.length) return null;
    var counts = {}, order = [];
    for (var i = 0; i < vertices.length; i++) {
      var v = vertices[i]; if (!v) continue;
      var m = (v.mat == null) ? '(none)' : v.mat;
      if (counts[m] == null) { counts[m] = 0; order.push(m); }
      counts[m]++;
    }
    return { counts: counts, order: order };
  }
  function matsLine() {
    var c = matCounts(); if (!c) return 'MATS: (no verts)';
    var parts = [];
    for (var i = 0; i < c.order.length; i++) parts.push(c.order[i] + ':' + c.counts[c.order[i]]);
    return 'MATS: ' + parts.join(' ');
  }
  // Returns { count, mat, examples } of off-palette/off-default vertices NOT in the active band, or null.
  // Treats water/anomaly as legitimate hazards. Uses the live currentCourse palette.
  function scanLeak() {
    if (typeof vertices === 'undefined' || !vertices || !vertices.length) return null;
    if (typeof currentCourse === 'undefined' || !currentCourse) return null;
    var def = currentCourse.defaultMaterial;
    if (!def) return null;
    var ok = {}; ok[def] = 1;
    var pal = currentCourse.materials || [];
    for (var p = 0; p < pal.length; p++) ok[pal[p]] = 1;
    // Build an identity set of the active painted band's vertices (handle {v,...} or {k,...} shapes).
    var band = (window.RG && RG._paintedBand) ? RG._paintedBand : null;
    var bandSet = (band && typeof Set !== 'undefined') ? new Set() : null;
    if (band && bandSet) for (var bi = 0; bi < band.length; bi++) {
      var e = band[bi];
      if (e && e.v) bandSet.add(e.v);
      else if (e && e.k != null && vertices[e.k]) bandSet.add(vertices[e.k]);
    }
    var byMat = {}, total = 0, ex = '';
    for (var i = 0; i < vertices.length; i++) {
      var v = vertices[i]; if (!v) continue;
      var m = v.mat;
      if (m == null) continue;                         // missing mat is handled by _clampTerrainMats, not a leak
      if (m === 'water' || m === 'anomaly') continue;  // legitimate hazards — never flag
      if (ok[m]) continue;                             // on-palette
      if (bandSet && bandSet.has(v)) continue;         // part of THIS hole's active band — intentional
      byMat[m] = (byMat[m] || 0) + 1; total++;
      if (!ex) ex = 'x=' + Math.round(v.x);
    }
    if (!total) return null;
    // Pick the dominant leaked mat for the headline.
    var topMat = '?', topN = 0;
    for (var mm in byMat) if (byMat.hasOwnProperty(mm) && byMat[mm] > topN) { topN = byMat[mm]; topMat = mm; }
    return { count: total, mat: topMat, byMat: byMat, example: ex };
  }
  // Plain-text one-liner for the report (DBG.setLeakSummary).
  function leakSummary() {
    var s = scanLeak();
    if (!s) return 'LEAK: none';
    var parts = [];
    for (var k in s.byMat) if (s.byMat.hasOwnProperty(k)) parts.push(k + ':' + s.byMat[k]);
    return 'LEAK: ' + s.count + ' off-palette verts (' + parts.join(' ') + ') ' + s.example;
  }
  var pLeakHole = -2, pLeakSig = '';   // de-dupe the MAT-LEAK event so it fires once per (hole, signature)
  var pFrameHole = -2;                  // de-dupe the portrait cup-framing warning (once per hole)
  var framingOffFrames = 0;             // consecutive AIM frames with the cup off the phone frame (skip transients)
  var pCamX = null, pCamY = null, pZoom = null, camPops = 0;   // CAMERA-POP watch: catch 1-frame teleports during a transition
  // ── CAMERA TRACE: record the FULL per-frame path through each transition (+ a few settle frames) so we can
  // SEE whether it's smooth, not just threshold-flag it. Exposed at window.__camTraces for inspection. ──
  var camTrace = null, camTraces = [], camPostFrames = 0;
  var camRoll = [];   // CONTINUOUS rolling log of the last ~240 frames of camera state (ALL phases incl. planet travel)
  function finalizeCamTrace(tr) {
    if (!tr || tr.length < 2) return;
    var maxDX = 0, maxDY = 0, maxDZ = 0, xRev = 0, zRev = 0, lastXs = 0, lastZs = 0, spikes = 0;
    for (var i = 1; i < tr.length; i++) {
      var dx = tr[i].x - tr[i - 1].x, dy = tr[i].y - tr[i - 1].y, dz = tr[i].z - tr[i - 1].z;
      if (Math.abs(dx) > Math.abs(maxDX)) maxDX = dx;
      if (Math.abs(dy) > Math.abs(maxDY)) maxDY = dy;
      if (Math.abs(dz) > Math.abs(maxDZ)) maxDZ = dz;
      var xs = dx > 0.5 ? 1 : dx < -0.5 ? -1 : 0; if (xs) { if (lastXs && xs !== lastXs) xRev++; lastXs = xs; }
      var zs = dz > 0.005 ? 1 : dz < -0.005 ? -1 : 0; if (zs) { if (lastZs && zs !== lastZs) zRev++; lastZs = zs; }
    }
    // a "spike" = a single-frame move > 4× the median |dx| (a jitter/jerk that breaks smoothness)
    var ds = []; for (var j = 1; j < tr.length; j++) ds.push(Math.abs(tr[j].x - tr[j - 1].x));
    ds.sort(function (a, b) { return a - b; }); var med = ds[Math.floor(ds.length / 2)] || 0;
    if (med > 0) for (var k = 1; k < tr.length; k++) if (Math.abs(tr[k].x - tr[k - 1].x) > med * 4 + 2) spikes++;
    tr.stats = { frames: tr.length, maxDX: Math.round(maxDX * 10) / 10, maxDY: Math.round(maxDY * 10) / 10,
      maxDZ: Math.round(maxDZ * 1000) / 1000, xReversals: xRev, zReversals: zRev, xSpikes: spikes, medianDX: Math.round(med * 10) / 10 };
    camTraces.push(tr); if (camTraces.length > 8) camTraces.shift();
    try { window.__camTraces = camTraces; } catch (e) {}
    // surface a problem if the path is clearly NOT smooth (a jerk spike, or zoom oscillation)
    if (spikes > 0 || zRev > 1 || xRev > 2) {
      push('JERKY TRANSITION — camera path not smooth (' + spikes + ' x-spikes, ' + xRev + ' x-reversals, ' + zRev + ' zoom-reversals)', 'problem');
    }
  }

  // Number every visible terrain vertex on the canvas (drawn AFTER the game frame) so a piece can be named.
  function drawLabels() {
    if (!vertsOn || typeof ctx === 'undefined' || typeof vertices === 'undefined'
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
  // N / M kept as direct keybinds for convenience (the menu also exposes them as action buttons).
  document.addEventListener('keydown', function (e) {
    var t = e.target; if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
    var k = e.key;
    if (k === 'n' || k === 'N') dropInCup();
    else if (k === 'm' || k === 'M') nextSystem();
  });

  function tick() {
    frame++;
    var now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : lastT + 16.7;
    var dt = now - lastT; lastT = now;
    if (dt > 0 && dt < 1000) {
      dtAvg = dtAvg * 0.9 + dt * 0.1; fps = Math.round(1000 / dtAvg);
      try { window.__dbgFps = fps; } catch (e) {}   // shared with DBG.buildReport's FPS line
      // Lag is only meaningful at 1× real-time play. During autoplay the engine runs aiSpeed steps per
      // frame AND the bot simulates candidate shots, so frame time is inflated and NOT representative —
      // skip lag measurement entirely while autoplaying (avoids "OK + 109 lag spikes" nonsense).
      var _autoplaying = (typeof aiEnabled !== 'undefined' && aiEnabled);
      if (!_autoplaying && frame > 40 && dt > 33) { dropCount++; if (dt > worstDt) worstDt = dt;
        if (statsOn && dt > 60) push('lag spike — frame took ' + Math.round(dt) + 'ms, target ~17ms', 'warn'); }
    }
    try {
      wrapDraw();   // always installed; drawLabels() no-ops unless vertexNums is on
      // Keep persistent vertex ids alive whenever EITHER overlay is on (vertexNums needs stable labels even
      // without the stats box). Cheap: just stamps an id on new vertices.
      if ((vertsOn || statsOn) && typeof vertices !== 'undefined') {
        for (var ni = 0; ni < vertices.length; ni++) { var nv = vertices[ni]; if (nv && nv._dbgId == null) nv._dbgId = ++_vid; }
      }
      if (!statsOn) { requestAnimationFrame(tick); return; }
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
        // ── MOBILE/PORTRAIT framing: in the narrow phone frame, the WHOLE hole should fit. Track whether the
        // CUP is on-screen — the #1 mobile risk is a hole too big to see where you're aiming. ──
        var portraitMode = !!(window.RG && RG._portraitCapture);
        var cupSx = ok ? (h.cupX - camera.x) : NaN, cupSy = ok ? (h.cupY - camY) : NaN;
        var cupOn = ok && cupSx > 0 && cupSx < W && cupSy > -20 && cupSy < H + 20;
        var ovh = h._overhangs ? ' +ovh' : '';

        // ── change / transition events ──
        if (pState !== null && st !== pState) push(stName(pState) + ' → ' + stName(st), 'info');
        if (pHole !== -1 && ci !== pHole) push('▶ now on hole ' + (ci + 1) + ' "' + (h.archetype || '?') + '"', 'info');
        if (pVlen !== -1 && vlen !== pVlen) push('terrain rebuilt for the new hole (' + pVlen + '→' + vlen + ' points)', 'info');

        // ── CAMERA-POP WATCH: a hole transition should PAN smoothly. A single-frame teleport of the camera
        // (or world scale) is the "a different screen flashed for a frame" bug. Planet travel legitimately
        // relocates the camera far (descending / course-complete), so exclude that. ──
        var zoomNow = (window.RG && typeof RG._zoom === 'number') ? RG._zoom : 1;
        var traveling = !!(window.RG && (RG.descending || RG._traveling)) || st === 5 || (typeof courseComplete !== 'undefined' && courseComplete);
        if (pCamX !== null && frame > 60 && !traveling) {
          var dCamX = Math.abs(camera.x - pCamX), dCamY = Math.abs(camY - pCamY);
          if (dCamX > W * 3 || dCamY > H * 2) {
            camPops++;
            push('CAMERA POP — view jumped ' + R(Math.max(dCamX, dCamY)) + 'px in one frame during ' + stName(st) + ' (hole ' + (ci + 1) + ') — flash/wrong-screen bug', 'problem');
          } else if (pZoom && Math.abs(zoomNow - pZoom) > 0.4) {
            camPops++;
            push('ZOOM POP — world scale snapped ' + pZoom.toFixed(2) + '→' + zoomNow.toFixed(2) + ' in one frame (' + stName(st) + ')', 'problem');
          }
        }
        pCamX = camera.x; pCamY = camY; pZoom = zoomNow;

        // CONTINUOUS rolling log — every frame, all phases (so we can inspect ANY boundary incl. planet travel)
        camRoll.push({ f: frame, x: Math.round(camera.x * 10) / 10, y: Math.round(camY * 10) / 10, z: Math.round(zoomNow * 1000) / 1000,
          bsx: Math.round(ball.x - camera.x), bsy: Math.round(ball.y - camY), v: vlen, st: st,
          desc: !!(window.RG && RG.descending), course: (window.RG ? RG.course : '?'), hole: ci + 1 });
        if (camRoll.length > 240) camRoll.shift();
        try { window.__camRoll = camRoll; } catch (e) {}

        // record the full camera path through a transition (+ ~10 settle frames after it ends)
        var inTrans = (st === 3);
        if (inTrans && !camTrace) camTrace = [];
        if (camTrace) {
          camTrace.push({ f: frame, x: Math.round(camera.x * 10) / 10, y: Math.round(camY * 10) / 10,
            z: Math.round(zoomNow * 1000) / 1000, bx: Math.round(ball.x), by: Math.round(ball.y), st: st, v: vlen,
            ballScrX: Math.round(ball.x - camera.x), ballScrY: Math.round(ball.y - camY) });
          if (inTrans) { camPostFrames = 0; }
          else { camPostFrames++; if (camPostFrames > 10) { finalizeCamTrace(camTrace); camTrace = null; camPostFrames = 0; } }
          if (camTrace && camTrace.length > 200) { finalizeCamTrace(camTrace); camTrace = null; }   // safety cap
        }
        pState = st; pHole = ci; pVlen = vlen; pCol = col;

        // PERSISTENT vertex ids + per-vertex RECOLOUR WATCH (your idea): a vertex's terrain colour should never
        // change while it exists — if vtx #N goes blue→green, flag it with its STABLE id (precise pop catcher).
        // Sampled a bit INTO the terrain (solid strata, not the surface highlight); throttled to keep it cheap.
        if (typeof vertices !== 'undefined') {
          for (var ai = 0; ai < vertices.length; ai++) { var av = vertices[ai]; if (av && av._dbgId == null) av._dbgId = ++_vid; }
          var _cc = (window.RG && RG.course) || '';
          if (_cc !== _vidCourse) { vidCol = {}; _vidCourse = _cc; }   // new course = new terrain → reset colour memory (no false pop)
          if (frame % 12 === 0 && frame > 50) {                        // skip startup churn (default course → real course swap)
            var chg = 0, exFrom = null, exTo = null;
            for (var qi = 0; qi < vertices.length; qi++) {
              var qv = vertices[qi]; if (!qv || qv._dbgId == null) continue;
              var qx = qv.x - camera.x, qy = (qv.y + 22) - camY;
              if (qx < 6 || qx > W - 6 || qy < 6 || qy > H - 6) continue;
              var qc = sampleAt(qx, qy); if (!qc) continue;
              var qp = vidCol[qv._dbgId];
              if (qp && (Math.abs(qc[0] - qp[0]) + Math.abs(qc[1] - qp[1]) + Math.abs(qc[2] - qp[2])) > 60) { chg++; if (!exFrom) { exFrom = qp; exTo = qc; } }
              vidCol[qv._dbgId] = qc;
            }
            // A real strata pop can be as small as ONE solid-terrain vertex flipping colour — the old chg>=4
            // gate under-reported (the leak class is often 1-2 verts). We sample a bit INTO the terrain (qy +22)
            // and gate each sampled vtx on a >60 channel-sum delta, which already filters sky-edge/grain noise,
            // so flagging >=1 is safe: a lone solid-terrain vertex flipping >60 is a real recolour, not grain.
            if (chg >= 1) {
              var fN = matName(exFrom), tN = matName(exTo);
              // band paint/cleanup = a band material toggling against the course default → totally normal.
              var benign = (BAND_MATS[fN] && !BAND_MATS[tN]) || (BAND_MATS[tN] && !BAND_MATS[fN]);
              push(chg + ' terrain point' + (chg > 1 ? 's' : '') + ' recoloured ' + fN + '→' + tN
                + (benign ? ' (band paint/cleanup — normal)' : ''), 'info');
            }
          }

          // ── MATERIAL-LEAK WATCH (data-based, off-screen-safe) ──────────────────────────────────────
          // Independent of pixel sampling: scan vertices[i].mat for off-palette materials that aren't part
          // of THIS hole's active painted band. Fires once per (hole, signature) so it doesn't spam. This is
          // the detector for the rock/ice/mud leak even when it's a single off-screen vertex.
          if (frame % 12 === 0 && frame > 50) {
            var leak = scanLeak();
            var sig = leak ? (leak.count + ':' + leak.mat) : '';
            if (leak && (ci !== pLeakHole || sig !== pLeakSig)) {
              var bandActive = !!(window.RG && RG._paintedBand && RG._paintedBand.length);
              var lp = [];
              for (var lk in leak.byMat) if (leak.byMat.hasOwnProperty(lk)) lp.push("'" + lk + "' ×" + leak.byMat[lk]);
              // No active band but off-palette material present = a real LEAK (material stuck from a prior hole).
              // Band active = likely just this hole's own band vertices → informational, not a bug.
              if (bandActive) {
                push("off-palette terrain (" + lp.join(' ') + ") while a band is active — probably this hole's band", 'info');
              } else {
                push("LEAK: " + leak.count + " terrain point" + (leak.count > 1 ? 's' : '') + " stuck as " + lp.join(' ')
                  + " on hole " + (ci + 1) + " with NO active band — this is a BUG", 'problem');
              }
            }
            pLeakHole = ci; pLeakSig = sig;
          }

          // ── PORTRAIT cup-framing watch: snackable holes are meant to fit one phone screen. If we're settled
          // and AIMING but the cup STAYS off the narrow frame (not just a 1-frame transition transient), the
          // hole doesn't fit → a real mobile framing bug. Require the camera to have settled (~10 frames). ──
          var settledAiming = portraitMode && st === 0 && ball.atRest && !(window.RG && RG.descending);
          if (settledAiming && ok && !cupOn) {
            framingOffFrames++;
            if (framingOffFrames >= 10 && ci !== pFrameHole && frame > 50) {
              push('cup STAYS off the phone frame while aiming — hole ' + (ci + 1) + ' (' + (h.archetype || '?') + ') too big for portrait', 'warn');
              pFrameHole = ci;
            }
          } else { framingOffFrames = 0; if (cupOn) pFrameHole = -2; }
        }

        // ── STATUS banner: one glance = is anything actually wrong? ──
        var errN = (window.DBG && DBG.errors) ? DBG.errors().length : 0;
        var leakNow = scanLeak();
        var bandActiveNow = !!(window.RG && RG._paintedBand && RG._paintedBand.length);
        var problem = null;
        if (errN > 0) problem = errN + ' JS error' + (errN > 1 ? 's' : '') + ' — see ERRORS in the menu';
        else if (leakNow && !bandActiveNow) problem = leakNow.count + " terrain point" + (leakNow.count > 1 ? 's' : '') + " stuck as '" + leakNow.mat + "' (no band) — terrain leak";
        else if (lastProblem && (frame - lastProblem.f) < 300) problem = lastProblem.txt + '  (' + Math.round((frame - lastProblem.f) / 60) + 's ago)';
        var statusLine = problem ? ('⚠️  PROBLEM: ' + problem) : '●  OK — nothing abnormal';

        var courseName = course ? (course[0].toUpperCase() + course.slice(1)) : '?';
        var distCup = (ok && h.cupX != null) ? Math.round(Math.abs(ball.x - h.cupX)) : '?';
        var matsStr = matsLine().replace(/^MATS:\s*/, '');

        var autop = (typeof aiEnabled !== 'undefined' && aiEnabled) ? ('  ·  AUTOPLAY ' + (typeof aiSpeed === 'number' ? aiSpeed : 1) + '×') : '';
        var modeTag = portraitMode ? '  ·  📱 PORTRAIT' : '';
        var live =
          courseName + '  ·  hole ' + (ci + 1) + '/' + tot + '  ·  "' + (h.archetype || '?') + '"' + (ovh ? ' +overhang' : '') + modeTag + autop + '\n' +
          statusLine + '\n' +
          'STATE: ' + stName(st) + ' — ' + stDesc(st) + '\n' +
          'ball: ' + (ballOn ? 'on screen' : 'OFF-SCREEN') + ', ' + distCup + 'px from cup  ·  FPS ' + fps + (dropCount ? ('  ·  ' + dropCount + ' lag spike' + (dropCount > 1 ? 's' : '')) : '') + '\n' +
          'framing: cup ' + (ok ? (cupOn ? 'visible' : 'OFF-SCREEN') : '?') + ' · hole ' + (terrInView ? 'in frame' : 'partly off') + (portraitMode ? ' (phone fit)' : '') + '\n' +
          'MATERIALS: ' + matsStr + (leakNow ? ('   ⚠ ' + leakNow.count + ' off-palette ' + leakNow.mat) : '') + '\n' +
          'tech: ' + vlen + ' terrain pts · camX ' + R(camera.x) + (camY ? (' · camY ' + R(camY) + (portraitMode ? '' : '!')) : '') + ' · cup-area ' + matName(col) + (vertsOn ? ' · [vertex #s on]' : '') + '\n' +
          '` menu · A autoplay · N drop-in · M next system';
        box(); body.textContent = live + (evLog.length ? ('\n─ recent events (newest at bottom) ─\n' + evLog.join('\n')) : '');
      }
    } catch (e) { if (body) body.textContent = 'dbg err: ' + (e && e.message); }
    requestAnimationFrame(tick);
  }

  // apply() for the stats box: show/hide; the tick() loop does no readout work while statsOn is false.
  function applyStats(on) {
    statsOn = !!on;
    if (statsOn) { box(); el.style.display = 'block'; }
    else if (el) el.style.display = 'none';
  }
  // apply() for vertex numbers: just flips the flag — drawLabels() (always installed via wrapDraw) paints
  // them on the next frame and no-ops when off.
  function applyVerts(on) { vertsOn = !!on; }

  // Register two INDEPENDENT overlay options + two action buttons with the unified menu.
  if (window.DBG && window.DBG.register) {
    window.DBG.register('camStats', { label: 'Camera / hole debug', group: 'overlays', apply: applyStats });
    window.DBG.register('vertexNums', { label: 'Vertex numbers', group: 'overlays', apply: applyVerts });
    window.DBG.registerAction('dropInCup', { label: 'Drop in cup (N)', run: dropInCup });
    window.DBG.registerAction('nextSystem', { label: 'Next system (M)', run: nextSystem });
    // Hand the menu's "Copy debug report" our event log + off-palette leak summary.
    if (window.DBG.setEvLog) window.DBG.setEvLog(function () { return evLog.slice(); });
    if (window.DBG.setLeakSummary) window.DBG.setLeakSummary(leakSummary);
  }

  requestAnimationFrame(tick);
})();
