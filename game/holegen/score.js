// ── holegen/score.js — the QUALITY objective (playability gate + interestingness) ────────────────────
// Validation is the biggest unused lever: the old gate only asks "can the bot sink it in ≤20?" so a trivial
// 1-putt and a brilliant 3-shot carry score identically. score() reuses the REAL autoplay bot (no physics
// reimplementation) to measure BOTH:
//   • playable  — the bot sinks within shotCap (hard gate, like _validateHole but it drives the cup home).
//   • interest  — shot-count in a target band (2–5) + requires-a-carry + ≥2 viable lines/a real decision
//                 + elevation variety − anti-frustration penalties (no inescapable pit / near-miss roll-off).
// Used by dreamgen's quality-diversity selector (generate-K-keep-best) to pick GREAT, not just "not broken".
//
// Runs INSIDE the engine context (needs RG.bot, holes, ball, terrainYAt). window.HG_SCORE. Headless-safe:
// returns a neutral pass if the bot layer is absent (so verify.cjs geometry runs aren't blocked).

(function () {
  'use strict';
  if (typeof window === 'undefined') { return; }

  // Drive the bot from the tee and PLAY the hole to a sink (or give up), recording the path. Mirrors
  // _validateHole's save/restore discipline so it never disturbs live state. Returns:
  //   { sunk, shots, path:[{x,y}], firstShotDrop, maxElev, minElev }
  function _playOut(i, shotCap) {
    var h = holes[i];
    var save = { x: ball.x, y: ball.y, vx: ball.vx, vy: ball.vy, r: ball.atRest, og: ball.onGround, st: state, ch: currentHole,
      cx: (typeof camera !== 'undefined' ? camera.x : 0), cy: (typeof camera !== 'undefined' ? camera.y : 0) };
    var sSteps = window.RG_BOT_STEPS; window.RG_BOT_STEPS = 14;
    // CRITICAL: suppress the engine's own generation re-entry while we drive the bot. simulateShot() runs
    // update(), which on a hole-advance calls ensureHolesAhead → _genValidatedHole → our QD wrapper →
    // score() … an infinite recursion. _inValidation (a level-design.js global) makes ensureHolesAhead a
    // no-op AND makes the QD wrapper call straight through, exactly like the engine's own _validateHole.
    var _savedIV = (typeof _inValidation !== 'undefined') ? _inValidation : false;
    try { _inValidation = true; } catch (e) {}
    var out = { sunk: false, shots: 0, path: [], maxElev: -1e9, minElev: 1e9 };
    try {
      currentHole = i;
      ball.x = h.teeX; ball.y = terrainYAt(h.teeX) - BALL_RADIUS; ball.vx = 0; ball.vy = 0; ball.atRest = true; ball.onGround = true; state = STATE_AIM;
      if (typeof setHoleCamera === 'function') setHoleCamera(h);
      out.path.push({ x: ball.x, y: ball.y });
      var prevD = Infinity, noProg = 0;
      for (var shot = 0; shot < shotCap; shot++) {
        var s = RG.bot.calculateShot(); if (!s) break;
        var r = RG.bot.simulateShot(s.vx, s.vy);
        out.shots++;
        out.path.push({ x: r.x, y: r.y });
        var ey = terrainYAt(r.x); if (ey > out.maxElev) out.maxElev = ey; if (ey < out.minElev) out.minElev = ey;
        if (r.scored) { out.sunk = true; break; }
        if (r.oob) { break; }
        if (!(r.distToCup < prevD - 5)) { if (++noProg >= 4) break; } else noProg = 0;
        prevD = r.distToCup; ball.x = r.x; ball.y = r.y; ball.vx = 0; ball.vy = 0; ball.atRest = true; ball.onGround = true; state = STATE_AIM;
      }
    } catch (e) { /* keep neutral */ }
    try { _inValidation = _savedIV; } catch (e) {}
    window.RG_BOT_STEPS = sSteps;
    ball.x = save.x; ball.y = save.y; ball.vx = save.vx; ball.vy = save.vy; ball.atRest = save.r; ball.onGround = save.og; state = save.st; currentHole = save.ch;
    if (typeof camera !== 'undefined') { camera.x = save.cx; camera.y = save.cy; }
    return out;
  }

  // Count how many DISTINCT first-shot families (angle bins) reach within `reachR` of the cup → "≥2 lines".
  // Cheap: one angle sweep at the tee, count loft bins whose best power lands near the cup.
  function _countLines(i, reachR) {
    var h = holes[i];
    var save = { x: ball.x, y: ball.y, vx: ball.vx, vy: ball.vy, r: ball.atRest, og: ball.onGround, st: state, ch: currentHole };
    var _savedIV = (typeof _inValidation !== 'undefined') ? _inValidation : false;
    try { _inValidation = true; } catch (e) {}
    var lines = 0;
    try {
      currentHole = i;
      var dir = (h.cupX - h.teeX) > 0 ? 1 : -1;
      var lofts = [0.18, 0.45, 0.75, 1.05, 1.3];
      reachR = reachR || 90;
      var MAXP = (typeof MAX_POWER !== 'undefined') ? MAX_POWER : 30;
      for (var li = 0; li < lofts.length; li++) {
        var best = Infinity;
        for (var pi = 0; pi < 14; pi++) {
          ball.x = h.teeX; ball.y = terrainYAt(h.teeX) - BALL_RADIUS; ball.vx = 0; ball.vy = 0; ball.atRest = true; ball.onGround = true; state = STATE_AIM;
          var loft = lofts[li], ang = dir > 0 ? -loft : (Math.PI + loft), pw = 2 + (MAXP - 2) * (pi / 13);
          var r = RG.bot.simulateShot(Math.cos(ang) * pw, Math.sin(ang) * pw);
          if (!r.oob && r.distToCup < best) best = r.distToCup;
        }
        if (best < reachR) lines++;
      }
    } catch (e) {}
    try { _inValidation = _savedIV; } catch (e) {}
    ball.x = save.x; ball.y = save.y; ball.vx = save.vx; ball.vy = save.vy; ball.atRest = save.r; ball.onGround = save.og; state = save.st; currentHole = save.ch;
    return lines;
  }

  // STRUCTURAL interest from the heightfield alone (NO bot). The autoplay bot plays OPTIMALLY (one-putts most
  // short holes, like the shipped planets), so bot-shot-count is a weak interest signal — and a full bot
  // playout per candidate makes QD pathologically slow. This reads the hole's STRUCTURE directly (ruggedness,
  // elevation traversed, a carry gap, overhangs) — the human-facing drama — in O(holewidth). Used by QD.
  function structuralInterest(i) {
    var h = holes[i]; if (!h || typeof terrainYAt !== 'function') return { interest: 0.5, rugged: 0, rise: 0, overh: 0 };
    var teeX = h.teeX, cupX = h.cupX, x0 = Math.min(teeX, cupX), x1 = Math.max(teeX, cupX);
    var prevSlope = 0, changes = 0, totalRise = 0, py = terrainYAt(x0);
    for (var sx = x0 + 24; sx <= x1; sx += 24) { var yy = terrainYAt(sx), sl = yy - py; if (Math.abs(sl) > 10) { var sg = sl > 0 ? 1 : -1; if (sg !== prevSlope && prevSlope !== 0) changes++; prevSlope = sg; totalRise += Math.abs(sl); } py = yy; }
    var sc = 0;
    sc += Math.min(0.9, changes * 0.18);                 // a varied, shaped silhouette
    sc += Math.min(0.7, totalRise / 320);                // elevation drama traversed
    var teeY = terrainYAt(teeX), cupY = terrainYAt(cupX), midLow = -1e9;
    for (var cx2 = x0 + (x1 - x0) * 0.2; cx2 < x0 + (x1 - x0) * 0.8; cx2 += 20) { var yv = terrainYAt(cx2); if (yv > midLow) midLow = yv; }
    if (midLow > Math.max(teeY, cupY) + 50) sc += 0.5;   // a real carry/valley to clear
    if (h._overhangs && h._overhangs.length) sc += 0.5;  // a cave/floating landmark
    return { interest: Math.max(0, Math.min(1, sc / 2.0)), rugged: changes, rise: Math.round(totalRise), overh: (h._overhangs ? h._overhangs.length : 0) };
  }

  // score(i, params) → { playable, interest, shots, sunk, lines, elevRange, detail }
  // params: { shotCap, band, wantCarry, reachR, cheap }. cheap:true → STRUCTURAL ONLY (no bot; fast QD path).
  // Full (cheap:false) drives the bot to confirm sinkability + measure shot-count (for the fun report).
  function score(i, params) {
    params = params || {};
    if (!holes[i] || typeof terrainYAt !== 'function') return { playable: true, interest: 0.5, shots: 0, sunk: true, lines: 1, elevRange: 0, detail: 'no-hole' };
    // CHEAP path: structural interest only, assume playable (the engine's _validateHole gates sinkability).
    if (params.cheap) { var st0 = structuralInterest(i); return { playable: true, interest: st0.interest, shots: 0, sunk: true, lines: 0, elevRange: 0, rugged: st0.rugged, rise: st0.rise, overh: st0.overh, detail: 'cheap' }; }
    if (!window.RG || !RG.bot || !RG.bot.calculateShot || !RG.bot.simulateShot || typeof ball === 'undefined') {
      var stN = structuralInterest(i); return { playable: true, interest: stN.interest, shots: 0, sunk: true, lines: 1, elevRange: 0, rugged: stN.rugged, rise: stN.rise, overh: stN.overh, detail: 'no-bot' };
    }
    var shotCap = params.shotCap || 20, band = params.band || [2, 5], reachR = params.reachR || 70;
    var play = _playOut(i, shotCap);
    var playable = play.sunk;
    if (!playable) return { playable: false, interest: 0, shots: play.shots, sunk: false, lines: 0, elevRange: 0, detail: 'unsunk' };

    var lines = _countLines(i, reachR);
    var h = holes[i];
    var elevRange = (play.maxElev > -1e8 && play.minElev < 1e8) ? (play.maxElev - play.minElev) : 0;

    // STRUCTURAL interest. NOTE: the autoplay bot plays OPTIMALLY (MAX_POWER=8) so it one-putts most short
    // holes — the shipped planets do too. So bot-shot-count is a weak signal; we measure the hole's STRUCTURE
    // (the human-facing drama): terrain ruggedness (significant slope changes between tee and cup), total
    // elevation traversed, a real carry gap, multiple viable lines, and any cave/floating overhangs. This is
    // what makes a hole read "designed + memorable" rather than a flat gimme, and gives QD a real gradient.
    var sc = 0;
    // 1) ruggedness — count meaningful direction changes in the heightfield tee→cup (a busy, shaped fairway)
    var teeX = h.teeX, cupX = h.cupX, x0 = Math.min(teeX, cupX), x1 = Math.max(teeX, cupX);
    var prevSlope = 0, changes = 0, totalRise = 0, py = terrainYAt(x0);
    for (var sx = x0 + 24; sx <= x1; sx += 24) { var yy = terrainYAt(sx), sl = yy - py; if (Math.abs(sl) > 10) { var sg = sl > 0 ? 1 : -1; if (sg !== prevSlope && prevSlope !== 0) changes++; prevSlope = sg; totalRise += Math.abs(sl); } py = yy; }
    sc += Math.min(0.9, changes * 0.18);               // a varied silhouette (the "designed" feel)
    // 2) elevation drama traversed
    sc += Math.min(0.7, totalRise / 320);
    // 3) ≥2 viable lines = a real decision/fork
    if (lines >= 2) sc += 0.4 + Math.min(0.4, (lines - 2) * 0.18);
    // 4) a genuine carry: the fairway dips well below BOTH the tee and cup somewhere mid-hole
    var teeY = terrainYAt(teeX), cupY = terrainYAt(cupX), midLow = -1e9;
    for (var cx2 = x0 + (x1 - x0) * 0.2; cx2 < x0 + (x1 - x0) * 0.8; cx2 += 20) { var yv = terrainYAt(cx2); if (yv > midLow) midLow = yv; }
    if (midLow > Math.max(teeY, cupY) + 50) sc += 0.5;  // a carry/valley the human must clear
    // 5) caves / floating overhangs present → a signature landmark hole
    if (h._overhangs && h._overhangs.length) sc += 0.5;
    // 6) a tiny bonus if the bot itself needed >1 shot (occasionally it does → genuinely demanding)
    if (play.shots >= 2) sc += 0.2;
    var interest = Math.max(0, Math.min(1, sc / 2.6));
    return { playable: true, interest: interest, shots: play.shots, sunk: true, lines: lines, elevRange: Math.round(elevRange), rugged: changes, rise: Math.round(totalRise), overh: (h._overhangs ? h._overhangs.length : 0), detail: 'ok' };
  }

  window.HG_SCORE = { score: score, structuralInterest: structuralInterest, _playOut: _playOut, _countLines: _countLines };
})();
