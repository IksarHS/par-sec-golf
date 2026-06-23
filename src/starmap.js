// ── starmap.js — the STAR MAP screen (META): a SIMPLE TEXT map of the tour's planets ───────────────────
// A clean, legible text list (NOT a node-graph). Systems are headers; under each, one PLAIN-TEXT ROW per
// planet showing: name · (your score / BEST if played) · state (played ✓ / current "▶ you are here" /
// locked). Departure Mono on a deep-space background. Scrollable when long. Tap a PLAYED row → travel back
// to replay that planet (boots run.html?course=<id>), same as before. Reads real progress from RG_SCORES.
//
// This file OWNS the screen. It does not touch run.html or the base game. Headless API at the bottom:
//   __reset() __step() __frame() __setAuto(b) __reveal(n) __travel(i) __state()  (back-compat shims).

(function () {
'use strict';

var cv = document.getElementById('c'), ctx = cv.getContext('2d'), W = 960, H = 540;

// PORTRAIT FILL (peel-off, gated): the fixed 960x540 canvas letterboxed into a thin band in a tall phone
// frame (the in-game map iframe on a portrait viewport). When the viewport is PORTRAIT, keep W=960 (so the
// rows' horizontal layout — left names + right-aligned scores — is byte-identical, no text overlap) but grow
// H to the viewport's aspect so the map FILLS the tall frame: more rows on screen, no dead band. H is used
// only for sky/scroll/cull/scrollbar, all of which scale cleanly with a taller H. Landscape (vw >= vh) keeps
// H=540 exactly. The CSS (starmap.html, @media portrait) sizes the now-tall canvas to fill the width.
(function portraitFill() {
  if (typeof window === 'undefined' || !window.innerHeight || !window.innerWidth) return;
  if (window.innerHeight <= window.innerWidth) return;     // landscape / square → untouched (H stays 540)
  H = Math.round(W * (window.innerHeight / window.innerWidth));   // match the viewport aspect at W=960
  H = Math.max(540, Math.min(H, 2600));                    // sane bounds (never shorter than base; capped)
  cv.height = H;                                            // the canvas backing store grows to the new H
})();

// ── Pull the real tour from planet-gen.js ────────────────────────────────────────────────────────────
var ITIN = (typeof window.SOLAR_ITINERARY !== 'undefined') ? window.SOLAR_ITINERARY.slice() : [];
var COURSES = (window.WORLDS && WORLDS['run-world']) ? WORLDS['run-world'].courses : {};

// Group the flat itinerary into its SYSTEMS (same id lists as the old graph) so each becomes a section.
var TRAPPIST_IDS = ['trappist1h','trappist1g','geryn','trappist1f','fenra','trappist1e','elai','trappist1d','trappist1c','trappist1b','trappist1'];
var BARNARD_IDS  = ['barnard_e','barnard_d','veil','hollow','ember','tidewell','solace','barnard_b','barnard_star'];
var KEPLER_IDS   = ['kepler90b','kepler90c','kepler90i','kepler90d','kepler90e','kepler90f','kepler90g','kepler90h','kepler90'];
var PROXIMA_IDS  = ['proxima_d','proxima_b','wisp','proxima_c','cinder','proxima'];
var TAUCETI_IDS  = ['tauceti_g','tauceti_h','liss','tauceti_e','caldra','tauceti_f','vesh','tauceti'];
function systemOf(id) {
  if (TRAPPIST_IDS.indexOf(id) >= 0) return 1;
  if (BARNARD_IDS.indexOf(id) >= 0) return 2;
  if (KEPLER_IDS.indexOf(id) >= 0) return 3;
  if (PROXIMA_IDS.indexOf(id) >= 0) return 4;
  if (TAUCETI_IDS.indexOf(id) >= 0) return 5;
  return 0;
}
var SYSTEMS = [
  { key: 'SOL',         label: 'THE SOLAR SYSTEM', accent: '#7fb2e0' },
  { key: 'TRAPPIST-1',  label: 'TRAPPIST-1',       accent: '#e0834f' },
  { key: 'BARNARD',     label: 'BARNARD’S STAR',   accent: '#d94a1f' },
  { key: 'KEPLER-90',   label: 'KEPLER-90',        accent: '#9ad06a' },
  { key: 'PROXIMA',     label: 'PROXIMA CENTAURI', accent: '#e06a8a' },
  { key: 'TAU-CETI',    label: 'TAU CETI',         accent: '#5fd0c0' },
];
var NSYS = SYSTEMS.length;

function nameOf(id) { var c = COURSES[id]; var n = (c && c.name) ? c.name : id; return String(n).split(' · ')[0].split(' (')[0]; }

// ── Build the ordered ROW list (flat, in itinerary order, with system headers) ─────────────────────────
// ROWS = a render list: { kind:'header', sys } or { kind:'planet', id, name, idx, sysIdx }.
// PLANETS = just the planet rows (index-parallel to the old NODES order) for progress + travel.
var ROWS = [];
var PLANETS = [];     // { id, name, idx, sysIdx }
function buildList() {
  ROWS = []; PLANETS = [];
  var groups = []; for (var g = 0; g < NSYS; g++) groups.push([]);
  for (var i = 0; i < ITIN.length; i++) groups[systemOf(ITIN[i])].push(ITIN[i]);
  for (var s = 0; s < NSYS; s++) {
    if (groups[s].length === 0) continue;
    ROWS.push({ kind: 'header', sys: s });
    for (var k = 0; k < groups[s].length; k++) {
      var id = groups[s][k];
      var p = { kind: 'planet', id: id, name: nameOf(id), idx: PLANETS.length, sysIdx: s };
      PLANETS.push(p); ROWS.push(p);
    }
  }
}
buildList();

// ── Progress state (REAL from RG_SCORES; dev fallback otherwise) ───────────────────────────────────────
var TOTAL = PLANETS.length;
var REAL = !!(window.RG_SCORES && window.RG_SCORES.all);
var played = {};            // id -> { par, total, best, plays }
var frontierIdx = 0;        // planet index of the current "you are here" frontier
var unlocked = 1;           // dev-slider fallback count

function refreshProgress() {
  played = {};
  var furthest = -1;
  if (REAL) {
    var all = window.RG_SCORES.all();
    for (var i = 0; i < TOTAL; i++) {
      var id = PLANETS[i].id;
      if (all[id]) { played[id] = all[id]; furthest = i; }
    }
  }
  frontierIdx = Math.min(TOTAL - 1, furthest + 1);
  if (frontierIdx < 0) frontierIdx = 0;
}

function unlockedCount() { return REAL ? (frontierIdx + 1) : unlocked; }
function isUnlocked(i) { return i < unlockedCount(); }
function isCurrent(i) { return i === (unlockedCount() - 1); }
function isPlayed(i) { return REAL ? !!played[PLANETS[i].id] : (i < unlocked - 1); }
function isTravelable(i) { return isUnlocked(i); }   // reachable rows can be tapped to travel

// Dev fallback slider (standalone prototype only; inert when wired to real progress).
function setReveal(n) { unlocked = Math.max(1, Math.min(TOTAL, Math.round(n))); clampScroll(); }

// ── Layout (a scrolling text column) ───────────────────────────────────────────────────────────────────
var FONT = "'Departure Mono', monospace";
var PADX = 60;            // left margin for rows
var TOP = 88;            // first row y (below the title)
var BOTTOM = 28;            // bottom margin
var HEADER_H = 40;            // height of a system header block
var ROW_H = 30;            // height of a planet row
var scroll = 0;            // vertical scroll offset (px)

// Total content height + the screen-y of each row (relative to content top, before scroll).
function layout() {
  var y = TOP, idxMap = [];
  for (var i = 0; i < ROWS.length; i++) {
    idxMap.push(y);
    y += (ROWS[i].kind === 'header') ? HEADER_H : ROW_H;
  }
  return { yOf: idxMap, contentH: y + BOTTOM };
}
function maxScroll() { var h = layout().contentH; return Math.max(0, h - H); }
function clampScroll() { scroll = Math.max(0, Math.min(scroll, maxScroll())); }

// Auto-scroll so the current frontier row is comfortably in view (on open / progress change).
function scrollToCurrent() {
  var L = layout();
  var cur = unlockedCount() - 1;
  for (var i = 0; i < ROWS.length; i++) {
    if (ROWS[i].kind === 'planet' && ROWS[i].idx === cur) {
      var ry = L.yOf[i];
      scroll = Math.max(0, Math.min(ry - H * 0.42, maxScroll()));
      return;
    }
  }
  clampScroll();
}

// ── Stars background (deep space) ──────────────────────────────────────────────────────────────────────
var stars = [];
function makeStars() {
  stars = [];
  for (var i = 0; i < 120; i++) stars.push({
    x: Math.random() * W, y: Math.random() * H,
    a: 0.25 + Math.random() * 0.5, s: Math.random() < 0.85 ? 1 : 2,
    blue: Math.random() < 0.28, tw: Math.random() * 6.28
  });
}
makeStars();

// ── Interaction ─────────────────────────────────────────────────────────────────────────────────────
var mouse = { x: -1, y: -1, hover: -1 };
var traveling = null;   // { id, name, t }

function rectFromEvt(e) { var b = cv.getBoundingClientRect(); return { sx: (e.clientX - b.left) * (W / b.width), sy: (e.clientY - b.top) * (H / b.height) }; }

// Which PLANET index (or -1) is under a screen point — only TRAVELABLE rows are hit-testable.
function planetAt(sy) {
  var L = layout();
  for (var i = 0; i < ROWS.length; i++) {
    if (ROWS[i].kind !== 'planet') continue;
    var ry = L.yOf[i] - scroll;
    if (sy >= ry && sy < ry + ROW_H && ry > TOP - 30 && ry < H) {
      return isTravelable(ROWS[i].idx) ? ROWS[i].idx : -1;
    }
  }
  return -1;
}

cv.addEventListener('mousemove', function (e) {
  var p = rectFromEvt(e); mouse.x = p.sx; mouse.y = p.sy;
  mouse.hover = planetAt(p.sy);
  cv.style.cursor = mouse.hover >= 0 ? 'pointer' : 'default';
});
cv.addEventListener('click', function (e) {
  var p = rectFromEvt(e); var i = planetAt(p.sy);
  if (i >= 0) travelTo(i);
});
cv.addEventListener('wheel', function (e) {
  scroll += e.deltaY; clampScroll(); e.preventDefault();
}, { passive: false });

function travelTo(i) {
  var p = PLANETS[i]; if (!p) return;
  traveling = { id: p.id, name: p.name, t: 0, accent: SYSTEMS[p.sysIdx].accent };
  console.log('[starmap] TRAVEL → ' + p.name + '  (run.html?course=' + p.id + ')');
}

// ── Drawing ────────────────────────────────────────────────────────────────────────────────────────
function drawSky() {
  var g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#06070c'); g.addColorStop(0.6, '#0b1018'); g.addColorStop(1, '#10161f');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  for (var i = 0; i < stars.length; i++) {
    var st = stars[i];
    var tw = 0.7 + 0.3 * Math.sin(frame * 0.04 + st.tw);
    ctx.fillStyle = st.blue ? 'rgba(195,215,255,' + (st.a * tw).toFixed(3) + ')'
                            : 'rgba(255,255,255,' + (st.a * tw * 0.8).toFixed(3) + ')';
    ctx.fillRect(st.x, st.y, st.s, st.s);
  }
}

function drawTitle() {
  // fixed title bar (over the scrolling column)
  ctx.save();
  ctx.fillStyle = 'rgba(6,7,12,0.85)'; ctx.fillRect(0, 0, W, TOP - 18);
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = 'rgba(242,236,255,0.92)'; ctx.font = '20px ' + FONT;
  ctx.fillText('STAR MAP', PADX, 38);
  ctx.fillStyle = 'rgba(180,200,225,0.55)'; ctx.font = '11px ' + FONT;
  ctx.fillText(REAL ? 'TAP A PLAYED PLANET TO REPLAY  ·  SCROLL FOR MORE  ·  ESC TO RESUME'
                    : 'TAP A PLANET TO TRAVEL  ·  SCROLL FOR MORE', PADX, 58);
  // played count (right)
  ctx.textAlign = 'right'; ctx.fillStyle = 'rgba(180,200,225,0.7)'; ctx.font = '12px ' + FONT;
  if (REAL) {
    var np = 0; for (var pi = 0; pi < TOTAL; pi++) if (isPlayed(pi)) np++;
    ctx.fillText(np + ' / ' + TOTAL + ' PLAYED', W - PADX, 38);
  } else {
    ctx.fillText(unlocked + ' / ' + TOTAL + ' UNLOCKED', W - PADX, 38);
  }
  ctx.restore();
}

function drawRows() {
  var L = layout();
  ctx.save();
  ctx.textBaseline = 'middle';
  for (var i = 0; i < ROWS.length; i++) {
    var row = ROWS[i];
    var ry = L.yOf[i] - scroll;
    var rh = (row.kind === 'header') ? HEADER_H : ROW_H;
    if (ry + rh < TOP - 20 || ry > H) continue;     // cull off-screen

    if (row.kind === 'header') {
      var sys = SYSTEMS[row.sys];
      ctx.textAlign = 'left';
      ctx.fillStyle = sys.accent; ctx.font = '14px ' + FONT;
      ctx.fillText(sys.label.toUpperCase(), PADX, ry + HEADER_H * 0.62);
      // a faint rule under the header
      ctx.globalAlpha = 0.28; ctx.strokeStyle = sys.accent; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(PADX, ry + HEADER_H - 8.5); ctx.lineTo(W - PADX, ry + HEADER_H - 8.5); ctx.stroke();
      ctx.globalAlpha = 1;
      continue;
    }

    // ── a PLANET row ──
    var i2 = row.idx;
    var on = isUnlocked(i2), cur = isCurrent(i2), pl = isPlayed(i2);
    var hover = (mouse.hover === i2);
    var cy = ry + ROW_H / 2;

    // hover/current highlight band
    if (cur || hover) {
      ctx.fillStyle = cur ? 'rgba(255,224,154,0.10)' : 'rgba(190,224,255,0.08)';
      ctx.fillRect(PADX - 18, ry + 2, W - 2 * PADX + 36, ROW_H - 4);
    }

    // state glyph (left)
    ctx.textAlign = 'left'; ctx.font = '13px ' + FONT;
    var glyph, gcol;
    if (cur)       { glyph = '▶'; gcol = '#ffe09a'; }      // ▶ you are here
    else if (pl)   { glyph = '✓'; gcol = '#9ad6c0'; }      // ✓ played
    else if (on)   { glyph = '○'; gcol = '#bcd0e8'; }      // ○ reachable, unplayed
    else           { glyph = '✕'; gcol = 'rgba(150,165,185,0.45)'; }   // ✕ locked
    ctx.fillStyle = gcol; ctx.fillText(glyph, PADX - 18, cy);

    // name
    ctx.font = '14px ' + FONT;
    ctx.fillStyle = cur ? '#fff6df' : (on ? (hover ? '#cfeaff' : '#dce6f2') : 'rgba(132,146,166,0.5)');
    ctx.fillText(row.name.toUpperCase(), PADX + 6, cy);

    // right-aligned score / state text
    ctx.textAlign = 'right'; ctx.font = '12px ' + FONT;
    if (pl) {
      var rec = played[row.id] || {};
      var hasVS = (rec.total != null && rec.par != null);
      var d = hasVS ? (rec.total - rec.par) : 0;
      var vs = d === 0 ? 'E' : (d > 0 ? '+' + d : String(d));
      var vc = d < 0 ? 'rgba(122,209,122,0.95)' : (d === 0 ? 'rgba(205,214,245,0.9)' : 'rgba(230,184,74,0.95)');
      var bestStr = (rec.best != null ? rec.best : rec.total);
      // "YOUR <vs>   BEST <n>"
      ctx.fillStyle = 'rgba(150,165,190,0.55)';
      ctx.fillText('BEST ' + bestStr, W - PADX, cy);
      ctx.fillStyle = vc;
      ctx.fillText(vs, W - PADX - 92, cy);
      if (!cur) { ctx.fillStyle = 'rgba(154,214,192,0.7)'; ctx.fillText('↺ REPLAY', W - PADX - 150, cy); }
    } else if (cur) {
      ctx.fillStyle = 'rgba(255,224,154,0.9)';
      ctx.fillText('▶ YOU ARE HERE', W - PADX, cy);
    } else if (on) {
      var holes = (COURSES[row.id] && COURSES[row.id].holeCount) || 9;
      ctx.fillStyle = 'rgba(150,180,215,0.65)';
      ctx.fillText(holes + ' HOLES', W - PADX, cy);
    } else {
      ctx.fillStyle = 'rgba(130,145,165,0.4)';
      ctx.fillText('LOCKED', W - PADX, cy);
    }
  }
  ctx.restore();
}

// scroll indicator (a slim bar on the right when content overflows)
function drawScrollBar() {
  var mx = maxScroll(); if (mx <= 0) return;
  var contentH = layout().contentH;
  var trackY = TOP - 8, trackH = H - trackY - 8;
  var thumbH = Math.max(28, trackH * (H / contentH));
  var thumbY = trackY + (trackH - thumbH) * (scroll / mx);
  ctx.save();
  ctx.fillStyle = 'rgba(150,165,210,0.10)'; ctx.fillRect(W - 16, trackY, 4, trackH);
  ctx.fillStyle = 'rgba(180,200,235,0.4)'; ctx.fillRect(W - 16, thumbY, 4, thumbH);
  ctx.restore();
}

function drawTravel() {
  if (!traveling) return;
  var t = traveling.t;
  var a = Math.min(1, t * 1.6);
  ctx.save();
  ctx.fillStyle = 'rgba(6,7,12,' + (0.88 * a).toFixed(3) + ')'; ctx.fillRect(0, 0, W, H);
  // warp streaks from centre
  ctx.globalAlpha = a; ctx.translate(W / 2, H / 2);
  for (var i = 0; i < 60; i++) {
    var ang = (i / 60) * Math.PI * 2;
    var inner = 30 + (frame * 5 + i * 37) % 320;
    var len = 20 + 90 * t;
    var c1 = Math.cos(ang), s1 = Math.sin(ang);
    ctx.strokeStyle = (i % 3 === 0) ? hexA(traveling.accent, 0.85) : 'rgba(255,255,255,0.5)';
    ctx.lineWidth = (i % 3 === 0) ? 1.8 : 1;
    ctx.beginPath(); ctx.moveTo(c1 * inner, s1 * inner); ctx.lineTo(c1 * (inner + len), s1 * (inner + len)); ctx.stroke();
  }
  ctx.restore();
  if (t > 0.3) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, (t - 0.3) * 3.2);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = traveling.accent; ctx.shadowBlur = 16;
    ctx.fillStyle = '#fff6df'; ctx.font = '24px ' + FONT;
    ctx.fillText('BOOTING  ' + traveling.name.toUpperCase(), W / 2, H / 2 - 12);
    ctx.shadowBlur = 0;
    ctx.fillStyle = hexA(traveling.accent, 0.95); ctx.font = '12px ' + FONT;
    ctx.fillText('· ' + traveling.id + ' ·', W / 2, H / 2 + 16);
    ctx.restore();
  }
}

// ── helpers ──────────────────────────────────────────────────────────────────────────────────────
function hexA(hex, al) {
  var h = hex.replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  var r = parseInt(h.substr(0, 2), 16), g = parseInt(h.substr(2, 2), 16), b = parseInt(h.substr(4, 2), 16);
  return 'rgba(' + r + ',' + g + ',' + b + ',' + al + ')';
}

// ── Frame / loop ────────────────────────────────────────────────────────────────────────────────────
var frame = 0;
var auto = true;

function update() {
  frame++;
  if (traveling) {
    traveling.t += 0.018;
    if (traveling.t >= 1.15) {
      // navigate the TOP window (in-game overlay iframe) so the whole game reboots into that course.
      // Build the URL from the GAME PAGE's OWN location (the top window), swapping only the query — so it
      // works on the dev server (run.html) AND the production build (index.html, served at the dir root).
      // Hardcoding 'run.html' 404'd on GitHub Pages, which has no run.html file.
      var base;
      try { var _tl = (window.top && window.top !== window.self) ? window.top.location : location; base = _tl.href.split('#')[0].split('?')[0]; }
      catch (e) { base = 'index.html'; }
      var url = base + '?course=' + traveling.id;
      if (window.__STARMAP_NO_NAV) { console.log('[starmap] (nav suppressed) ' + url); traveling = null; }
      else {
        try {
          if (window.top && window.top !== window.self) window.top.location.href = url;
          else location.href = url;
        } catch (e) { location.href = url; }
      }
    }
  }
}

function draw() {
  drawSky();
  drawRows();
  drawTitle();
  drawScrollBar();
  drawTravel();
}

function loop() { if (auto) { update(); draw(); } requestAnimationFrame(loop); }

function reset() {
  buildList();
  TOTAL = PLANETS.length;
  unlocked = 1; scroll = 0; traveling = null; frame = 0;
  refreshProgress();
  makeStars();
  scrollToCurrent();
  draw();
}

// keyboard: scroll the list (arrows / page) — and dev reveal in fallback mode.
window.addEventListener('keydown', function (e) {
  if (e.key === 'ArrowDown') { scroll += ROW_H; clampScroll(); }
  else if (e.key === 'ArrowUp') { scroll -= ROW_H; clampScroll(); }
  else if (e.key === 'PageDown') { scroll += H * 0.8; clampScroll(); }
  else if (e.key === 'PageUp') { scroll -= H * 0.8; clampScroll(); }
  else if ((e.key === 'r' || e.key === 'R')) reset();
});

// boot
reset();
requestAnimationFrame(loop);

// ── Headless API (back-compat shims for the screenshot harness) ────────────────────────────────────────
window.__reset = reset;
window.__step = function () { update(); draw(); };
window.__frame = function () { draw(); };
window.__setAuto = function (b) { auto = !!b; };
window.__reveal = function (n) { setReveal(n); draw(); };
window.__travel = function (i) { travelTo(typeof i === 'number' ? i : (unlockedCount() - 1)); };
window.__state = function () {
  var cur = PLANETS[unlockedCount() - 1];
  return { unlocked: unlockedCount(), total: TOTAL, current: cur && cur.id, traveling: traveling };
};
window.__STARMAP_NO_NAV = /[?&]nonav\b/.test(location.search);

})();
