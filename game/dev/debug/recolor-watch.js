// ── DEBUG: data-based recolour watch + persistent log (?dbg / ?recolor) ─────────────────────────────
// Peel-off-able, URL-gated, LOCAL-ONLY (not in tools/build.cjs SCRIPTS).
//
// WHY a second watcher: cam-debug's on-canvas recolour line names colours by NEAREST PIXEL-COLOUR match
// against the live MATERIALS palette — which holds EVERY planet's materials — so grey Luna stone gets
// mislabelled "trappist_charred_basalt → barnard_void_iron" even though the real vertex .mat is just
// 'stone'. And it keeps only 8 scrolling lines, so events are lost. This watcher instead reads the ACTUAL
// vertex .mat string, keyed by stable vertex identity, and keeps a long persistent log.
//
// Exposes:
//   window.__recolors        — full event log [{kind, frame, id, x, screenX, onScreen, from, to, hole, course, st, offPalette}]
//   window.recolorReport()   — { total, onScreen, offPalette, byKind:{...} } summary
// A RECOLOR event = a vertex's .mat actually changed while it kept its identity (a real repaint).
// A LEAK event    = a vertex carries a material that isn't in the current course's palette (a real cross-
//                   course / cross-hole leak), reported with the TRUE material name and position.
(function () {
  if (typeof location === 'undefined') return;
  var p = new URLSearchParams(location.search);
  if (!p.has('dbg') && !p.has('recolor')) return;
  function g(n) { try { return eval(n); } catch (e) { return undefined; } }

  var byId = {}, log = [], frame = 0, _n = 0, lastCourse = null, lastLeakSig = '';
  window.__recolors = log;
  window.recolorReport = function () {
    var byKind = {}, onS = 0, offP = 0;
    for (var i = 0; i < log.length; i++) {
      var e = log[i];
      if (e.kind !== 'RECOLOR') continue;
      if (e.onScreen) onS++;
      if (e.offPalette) offP++;
      var k = e.course + ': ' + e.from + ' → ' + e.to + (e.onScreen ? ' [ON-screen]' : ' [off]');
      byKind[k] = (byKind[k] || 0) + 1;
    }
    return { totalRecolors: log.filter(function (e) { return e.kind === 'RECOLOR'; }).length, onScreen: onS, offPalette: offP, byKind: byKind,
             leaks: log.filter(function (e) { return e.kind === 'LEAK'; }).length, courseChanges: log.filter(function (e) { return e.kind === 'COURSE'; }).length };
  };

  // The legitimate palette for the live course: its default + declared materials, plus the by-design band
  // materials (rock/ice/mud) and hazards (water/anomaly). Anything else on a vertex is a real leak.
  function paletteOK() {
    var cc = g('currentCourse'), ok = {};
    if (cc) { if (cc.defaultMaterial) ok[cc.defaultMaterial] = 1; (cc.materials || []).forEach(function (m) { ok[m] = 1; }); }
    ['water', 'anomaly', 'rock', 'ice', 'mud'].forEach(function (m) { ok[m] = 1; });
    return ok;
  }

  function push(e) { log.push(e); if (log.length > 4000) log.shift(); }

  function tick() {
    try {
      frame++;
      var vs = g('vertices'), cam = g('camera'), Wd = g('W') || 864;
      if (vs && vs.length && cam) {
        var course = window.RG ? RG.course : '?';
        var hole = (g('currentHole') || 0) + 1;
        var st = g('state');
        // Course change = a full, expected terrain rebuild. Note it, and reset identity memory so the
        // rebuild itself isn't logged as thousands of recolours. Leaks are still caught below.
        if (course !== lastCourse) {
          push({ kind: 'COURSE', frame: frame, from: lastCourse, to: course, vlen: vs.length });
          lastCourse = course; byId = {};
        }
        var ok = paletteOK();
        for (var i = 0; i < vs.length; i++) {
          var v = vs[i]; if (!v) continue;
          if (v._dbgId == null) v._dbgId = ++_n;
          var id = v._dbgId, m = (v.mat == null ? '(none)' : String(v.mat)), prev = byId[id];
          if (prev !== undefined && prev !== m) {
            var sx = Math.round(v.x - cam.x);
            push({ kind: 'RECOLOR', frame: frame, id: id, x: Math.round(v.x), screenX: sx, onScreen: (sx > -10 && sx < Wd + 10),
                   from: prev, to: m, hole: hole, course: course, st: st, offPalette: !ok[m] });
          }
          byId[id] = m;
        }
        // Off-palette LEAK scan (throttled): real cross-course/hole material stuck on the live terrain,
        // reported with the TRUE material name — independent of any recolour event.
        if (frame % 20 === 0) {
          var leak = {}, total = 0, exX = null;
          for (var j = 0; j < vs.length; j++) {
            var mm = vs[j] && vs[j].mat; if (!mm) continue;
            if (!ok[mm]) { leak[mm] = (leak[mm] || 0) + 1; total++; if (exX == null) exX = Math.round(vs[j].x); }
          }
          var sig = total + ':' + Object.keys(leak).sort().join(',');
          if (total && sig !== lastLeakSig) {
            push({ kind: 'LEAK', frame: frame, course: course, hole: hole, count: total, mats: leak, exampleX: exX });
          }
          lastLeakSig = sig;
        }
      }
    } catch (e) { window.__recolorErr = e && e.message; }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
  try { console.log('[recolor-watch] data-based recolour log active → window.__recolors / recolorReport()'); } catch (e) {}
})();
