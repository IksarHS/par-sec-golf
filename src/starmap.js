// ── starmap.js — the STAR MAP screen (META): a node-graph to travel between the tour's planets ───────
// A spiderweb of NODE BOXES (planet swatch + name + par/score placeholder) connected by branching lines,
// spreading outward across the 3 systems of the real tour (Sol → TRAPPIST-1 → Barnard's Star). It pulls
// the ordered itinerary + each body's palette from planet-gen.js (window.SOLAR_ITINERARY + the registered
// course configs), so the map always reflects the real courses. ONE node starts unlocked (Earth); as the
// unlock count rises, neighbour nodes reveal and branch out, and the last body of a system opens the NEXT
// system one "layer" further out. Click an unlocked node → travel (boots run.html?course=<id>).
//
// This file OWNS the screen. It does not touch run.html or the base game. Headless API at the bottom:
//   __reset() __step() __frame() __setAuto(b) __reveal(n)  (for screenshotting the reveal/branching).

(function () {
'use strict';

var cv = document.getElementById('c'), ctx = cv.getContext('2d'), W = 960, H = 540;

// ── Pull the real tour from planet-gen.js ────────────────────────────────────────────────────────────
// SOLAR_ITINERARY is the ordered body list across all 3 systems; the course configs carry name+sky+land.
var ITIN = (typeof window.SOLAR_ITINERARY !== 'undefined') ? window.SOLAR_ITINERARY.slice() : [];
var COURSES = (window.WORLDS && WORLDS['run-world']) ? WORLDS['run-world'].courses : {};
var MATS = window.MATERIALS || {};

// Group the flat itinerary into its 6 SYSTEMS by id → each becomes a "layer" spreading rightward.
// Sol bodies have plain ids; the rest are tagged by their explicit id lists (in itinerary order).
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
// Per-system identity: a label, an accent (the gateway/star tint) and a sky band tone for the layer.
var SYSTEMS = [
  { key: 'SOL',         label: 'THE SOLAR SYSTEM', accent: '#7fb2e0', star: '#ffd27a' },
  { key: 'TRAPPIST-1',  label: 'TRAPPIST-1',       accent: '#e0834f', star: '#ff7a3a' },
  { key: 'BARNARD',     label: "BARNARD’S STAR",   accent: '#d94a1f', star: '#ff5a30' },
  { key: 'KEPLER-90',   label: 'KEPLER-90',        accent: '#9ad06a', star: '#ffe27a' },
  { key: 'PROXIMA',     label: 'PROXIMA CENTAURI', accent: '#e06a8a', star: '#ff5a4a' },
  { key: 'TAU-CETI',    label: 'TAU CETI',         accent: '#5fd0c0', star: '#ffd060' },
];
var NSYS = SYSTEMS.length;

// Resolve a body's land swatch colour (its terrain material colour) for the node icon.
function landColor(id) {
  var c = COURSES[id];
  if (c && c.defaultMaterial && MATS[c.defaultMaterial] && MATS[c.defaultMaterial].color) return MATS[c.defaultMaterial].color;
  return '#8a8f94';
}
function skyColor(id) { var c = COURSES[id]; return (c && c.sky) ? c.sky : '#1a2230'; }
function nameOf(id)   { var c = COURSES[id]; return (c && c.name) ? c.name : id; }

// ── Build the NODES with a flowing, branching layout (a spiderweb, not a straight line) ───────────────
// Each system occupies a horizontal band of the (large, pannable) world. Within a band the bodies snake
// along a gentle spine with seeded vertical jitter + the occasional SIDE BRANCH so lines fork outward.
// Layout is deterministic (seeded) so screenshots are stable.
function seed(n) { var s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); }

var NODES = [];   // { id, name, sysIdx, x, y, r, parent, gateway, isStar }
var EDGES = [];   // { a, b, branch }  indices into NODES

function buildGraph() {
  NODES = []; EDGES = [];
  var startX = 220;
  var midY = 300;
  var idxOf = {};            // id -> node index

  // group ids by system, preserving itinerary order
  var groups = []; for (var gi0 = 0; gi0 < NSYS; gi0++) groups.push([]);
  for (var i = 0; i < ITIN.length; i++) groups[systemOf(ITIN[i])].push(ITIN[i]);

  // Uniform per-body step (≥ widest label) so name + par/score never collide; bands are laid END-TO-END
  // with a warp GAP between them (next band starts past the previous band's real extent), so systems never
  // overlap and the warp-gate line always reads left→right into the next layer.
  var STEP = 168;            // horizontal spacing between consecutive bodies
  var sysGapX = 300;         // warp gap between a system's last body and the next system's first
  var ox = startX;
  for (var s = 0; s < NSYS; s++) {
    var ids = groups[s];
    var n = ids.length;
    if (n === 0) continue;                              // a system with no registered bodies (e.g. Tau Ceti peeled off) → skip
    var sysStartIdx = NODES.length;
    for (var k = 0; k < n; k++) {
      var id = ids[k];
      // spine: a gentle sine wave down the band, plus seeded jitter → organic, web-like
      var t = k / Math.max(1, n - 1);
      var spineY = midY + Math.sin(t * Math.PI * 2.1 + s * 1.3) * 78 + (seed(s * 50 + k) - 0.5) * 44;
      var x = ox + k * STEP + (seed(s * 90 + k * 7) - 0.5) * 14;
      var isStar = (k === n - 1);                       // each system ends on its STAR (the finale)
      var gateway = isStar && s < NSYS - 1;             // the star is also the warp gate to the next system
      NODES.push({ id: id, name: nameOf(id), sysIdx: s, x: x, y: spineY,
                   r: isStar ? 30 : 23, isStar: isStar, gateway: gateway, parent: -1,
                   ord: NODES.length });
      idxOf[id] = NODES.length - 1;
      // main spine edge to the previous body in this system
      if (k > 0) EDGES.push({ a: NODES.length - 2, b: NODES.length - 1, branch: false });
    }
    // SIDE BRANCHES → a real WEB: at a few mid bodies, push the next body OFF the spine (a kink) AND add a
    // second child (a cross-link to the body after) so the parent visibly FANS into two limbs in-frame.
    for (var b = 2; b < n - 2; b += 3) {
      var src = sysStartIdx + b, kid1 = sysStartIdx + b + 1, kid2 = sysStartIdx + b + 2;
      if (kid2 < NODES.length) {
        var dir = (seed(s * 11 + b) < 0.5 ? -1 : 1);
        NODES[kid1].y += dir * (62 + seed(b) * 34);                 // kink the immediate next body off the spine
        NODES[kid1].x -= 12 + seed(b * 3) * 14;                     // pull it back so the fork opens visibly
        EDGES.push({ a: src, b: kid2, branch: true });              // the SECOND limb (parent → body-after) = a real fork
      }
    }
    // advance to the next band: past THIS band's real max-x + the warp gap
    var maxX = 0; for (var mi = sysStartIdx; mi < NODES.length; mi++) maxX = Math.max(maxX, NODES[mi].x);
    ox = maxX + sysGapX;
  }
  // wire the warp gates now that all nodes exist. A star is a gateway to the NEXT NON-EMPTY system
  // (so a peeled-off / empty system doesn't break the chain). Re-mark gateway by whether a target exists.
  for (var gi = 0; gi < NODES.length; gi++) {
    if (!NODES[gi].isStar) continue;
    var ns = NODES[gi].sysIdx + 1, target = -1;
    for (var nj = 0; nj < NODES.length; nj++) { if (NODES[nj].sysIdx >= ns) { target = nj; break; } }
    if (target >= 0) { NODES[gi].gateway = true; EDGES.push({ a: gi, b: target, branch: false, warp: true }); }
    else { NODES[gi].gateway = false; }
  }
  // parent = the first node that has an edge INTO this one (used for reveal ordering / line draw)
  for (var e = 0; e < EDGES.length; e++) {
    var d = EDGES[e].b; if (NODES[d].parent < 0) NODES[d].parent = EDGES[e].a;
  }
}
buildGraph();

// ── Progress state (REAL when available; dev slider otherwise) ──────────────────────────────────────
// The map reflects ACTUAL progress from RG_SCORES (profile.js): which bodies have a recorded score
// (PLAYED), which one is the current frontier (the next unplayed body after the furthest played one),
// and the per-planet score shown on each played node. When RG_SCORES is absent (the bare prototype),
// it falls back to the old keyboard reveal-slider so starmap.html still demos standalone.
var TOTAL = NODES.length;
var revealAnim = [];              // per-node 0..1 pop timer
var unlocked = 1;                 // dev-slider count (fallback only)

var REAL = !!(window.RG_SCORES && window.RG_SCORES.all);   // are we wired to real progress?
var played = {};                  // id -> { par, total, best, plays } (real scores)
var frontierIdx = 0;              // node index of the current "you are here" frontier

// Recompute played-set + frontier from RG_SCORES. The frontier = the body AFTER the furthest played
// one (the next to play); if nothing is played, Earth (index 0). Everything up to+including the
// frontier is "unlocked" (reachable); a PLAYED node is replayable; the rest is locked.
function refreshProgress() {
  played = {};
  var furthest = -1;
  if (REAL) {
    var all = window.RG_SCORES.all();
    for (var i = 0; i < TOTAL; i++) {
      var id = NODES[i].id;
      if (all[id]) { played[id] = all[id]; furthest = i; }
    }
  }
  frontierIdx = Math.min(TOTAL - 1, furthest + 1);   // next unplayed body (or Earth at start)
  if (frontierIdx < 0) frontierIdx = 0;
  // animate pop on every reachable node the first time we see it
  for (var j = 0; j < TOTAL; j++) {
    if (j <= frontierIdx && (revealAnim[j] == null || revealAnim[j] === 0)) revealAnim[j] = 0.001;
  }
}
for (var ri = 0; ri < TOTAL; ri++) revealAnim.push(0);

// "unlocked" (reachable + lit) = up to the frontier (real) or the slider count (fallback).
function unlockedCount() { return REAL ? (frontierIdx + 1) : unlocked; }
function isUnlocked(i) { return i < unlockedCount(); }
function isCurrent(i) { return i === (unlockedCount() - 1); }
function isPlayed(i) { return REAL ? !!played[NODES[i].id] : (i < unlocked - 1); }
// A node is CLICKABLE to travel if it's reachable (played → replay; frontier → play next).
function isTravelable(i) { return isUnlocked(i); }

// Dev fallback slider (standalone prototype only; inert when wired to real progress).
function setReveal(n) {
  n = Math.max(1, Math.min(TOTAL, Math.round(n)));
  for (var i = 0; i < TOTAL; i++) { if (i < n && revealAnim[i] === 0) revealAnim[i] = 0.001; }
  unlocked = n;
  centerOnCurrent(true);
}

// ── Camera (the world is wider than the canvas; we pan to keep the action framed) ────────────────────
var cam = { x: 0, tx: 0 };
function worldRightOf(i) { return NODES[i] ? NODES[i].x : 0; }
function centerOnCurrent(animate) {
  var cur = NODES[unlockedCount() - 1]; if (!cur) return;
  // Park the current node ~62% across, so the trailing revealed path has room on the LEFT and its
  // labels don't clip against the canvas edge (the pan-clamp the critic flagged).
  cam.tx = Math.max(0, Math.min(cur.x - W * 0.62, worldWidth() - W));
  if (!animate) cam.x = cam.tx;
}
function worldWidth() {
  var mx = 0; for (var i = 0; i < TOTAL; i++) mx = Math.max(mx, NODES[i].x);
  return mx + 260;
}

// ── Stars background (deep-space sky + parallax dots) ───────────────────────────────────────────────
var stars = [];
function makeStars() {
  stars = [];
  var dens = Math.round((worldWidth() + W) / 14);     // ~one star per 14px of world → fills the empty top
  for (var i = 0; i < dens; i++) stars.push({
    x: Math.random() * (worldWidth() + W), y: Math.random() * H,
    a: 0.3 + Math.random() * 0.55, s: Math.random() < 0.8 ? 1 : 2,
    blue: Math.random() < 0.28, tw: Math.random() * 6.28
  });
}
makeStars();

// ── Interaction ─────────────────────────────────────────────────────────────────────────────────────
var mouse = { x: -1, y: -1, hover: -1 };
var traveling = null;   // { id, name, t }  travel transition overlay

function screenToWorld(sx, sy) { return { x: sx + cam.x, y: sy }; }
function nodeAt(sx, sy) {
  var w = screenToWorld(sx, sy);
  for (var i = TOTAL - 1; i >= 0; i--) {
    var nd = NODES[i]; var dx = w.x - nd.x, dy = w.y - nd.y;
    if (Math.abs(dx) < nd.r + 12 && Math.abs(dy) < nd.r + 10) return i;
  }
  return -1;
}

function rectFromEvt(e) { var b = cv.getBoundingClientRect(); return { sx: (e.clientX - b.left) * (W / b.width), sy: (e.clientY - b.top) * (H / b.height) }; }

cv.addEventListener('mousemove', function (e) {
  var p = rectFromEvt(e); mouse.x = p.sx; mouse.y = p.sy;
  var i = nodeAt(p.sx, p.sy);
  mouse.hover = (i >= 0 && isTravelable(i)) ? i : -1;
  cv.style.cursor = mouse.hover >= 0 ? 'pointer' : 'default';
});
cv.addEventListener('click', function (e) {
  var p = rectFromEvt(e); var i = nodeAt(p.sx, p.sy);
  if (i >= 0 && isTravelable(i)) travelTo(i);
});

function travelTo(i) {
  var nd = NODES[i];
  traveling = { id: nd.id, name: nd.name, t: 0,
                accent: SYSTEMS[nd.sysIdx].accent, star: SYSTEMS[nd.sysIdx].star,
                cx: nd.x - cam.x, cy: nd.y };
  console.log('[starmap] TRAVEL → ' + nd.name + '  (run.html?course=' + nd.id + ')');
}

// ── Drawing ────────────────────────────────────────────────────────────────────────────────────────
var FONT = "'Departure Mono', monospace";

function drawSky() {
  var g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#06070c'); g.addColorStop(0.5, '#0e1622'); g.addColorStop(1, '#1b2c3e');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // parallax stars (slower than camera) — denser + brighter so the upper field reads as deep space
  for (var i = 0; i < stars.length; i++) {
    var st = stars[i];
    var sx = st.x - cam.x * 0.4; if (sx < -4 || sx > W + 4) continue;
    var tw = 0.7 + 0.3 * Math.sin(frame * 0.04 + st.tw);
    ctx.fillStyle = st.blue ? 'rgba(195,215,255,' + (st.a * tw).toFixed(3) + ')'
                            : 'rgba(255,255,255,' + (st.a * tw * 0.8).toFixed(3) + ')';
    ctx.fillRect(sx, st.y, st.s, st.s);
  }
}

// One soft system-band label at the top (subtle, sets the layer apart). Show ONLY the DOMINANT band —
// the revealed system that fills the most screen width — so two band labels never overprint at a boundary.
function drawSystemLabels() {
  var best = -1, bestVis = 0;
  for (var s = 0; s < 3; s++) {
    var any = false; for (var j = 0; j < TOTAL; j++) if (NODES[j].sysIdx === s && isUnlocked(j)) { any = true; break; }
    if (!any) continue;
    var minX = Infinity, maxX = -Infinity;
    for (var m = 0; m < TOTAL; m++) if (NODES[m].sysIdx === s) { minX = Math.min(minX, NODES[m].x); maxX = Math.max(maxX, NODES[m].x); }
    var lo = minX - cam.x, hi = maxX - cam.x;
    var vis = Math.min(hi, W) - Math.max(lo, 0);          // visible width of this band
    if (vis > bestVis) { bestVis = vis; best = s; }
  }
  if (best < 0) return;
  ctx.save();
  ctx.globalAlpha = 0.6;
  ctx.fillStyle = SYSTEMS[best].accent;
  ctx.font = "13px " + FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  var cx = W / 2 + 36;                                     // fixed slot, centred-right of the HUD title
  ctx.fillText(SYSTEMS[best].label, cx, 28);
  ctx.globalAlpha = 0.32; ctx.strokeStyle = SYSTEMS[best].accent; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(cx - 86, 36); ctx.lineTo(cx + 86, 36); ctx.stroke();
  ctx.restore();
}

// Connector docking: meet the box at its PERIMETER (toward the other node) rather than the centre, so
// lines read as engineered joints, not arrows stabbing into boxes. Returns the perimeter point.
function dockPoint(nd, towardX, towardY) {
  var bw = nd.r + 8, bh = nd.r + 8;                 // half-extents of the box (+ a touch)
  var dx = towardX - nd.x, dy = towardY - nd.y;
  if (dx === 0 && dy === 0) return { x: nd.x, y: nd.y };
  var sx = Math.abs(dx) > 1e-6 ? bw / Math.abs(dx) : Infinity;
  var sy = Math.abs(dy) > 1e-6 ? bh / Math.abs(dy) : Infinity;
  var t = Math.min(sx, sy);
  return { x: nd.x + dx * t, y: nd.y + dy * t };
}

function drawEdges() {
  for (var e = 0; e < EDGES.length; e++) {
    var ed = EDGES[e], a = NODES[ed.a], b = NODES[ed.b];
    // dock at each box's perimeter, pointed at the other box's centre
    var pa = dockPoint(a, b.x, b.y), pb = dockPoint(b, a.x, a.y);
    var ax = pa.x - cam.x, ay = pa.y, bxw = pb.x - cam.x, byw = pb.y;
    if (Math.max(ax, bxw) < -40 || Math.min(ax, bxw) > W + 40) continue;
    // an edge is "live" (lit) only when BOTH endpoints are unlocked; else faint
    var live = isUnlocked(ed.a) && isUnlocked(ed.b);
    // reveal-along-the-line: when the destination just unlocked, draw the line growing in
    var prog = isUnlocked(ed.b) ? Math.min(1, revealAnim[ed.b] * 1.6) : (isUnlocked(ed.a) ? 0.55 : 0);
    if (prog <= 0 && !live) { if (!isUnlocked(ed.a)) continue; prog = 0.55; }   // ghost stub toward a locked neighbour
    var ex = ax + (bxw - ax) * prog, ey = ay + (byw - ay) * prog;
    ctx.save();
    ctx.lineCap = 'round';
    if (ed.warp) {
      // warp gate: a dashed, bright accent line into the next system (the storytelling beat)
      ctx.setLineDash([8, 7]); ctx.lineDashOffset = -frame * 0.8;
      ctx.strokeStyle = live ? 'rgba(232,222,255,0.85)' : 'rgba(160,170,210,0.3)';
      ctx.lineWidth = 2.5;
      if (live) { ctx.shadowColor = 'rgba(200,190,255,0.6)'; ctx.shadowBlur = 6; }
    } else if (ed.branch) {
      ctx.strokeStyle = live ? 'rgba(150,205,240,0.7)' : 'rgba(120,140,170,0.26)';
      ctx.lineWidth = 2;
    } else {
      // the spine: the visual backbone — make it the strongest line
      ctx.strokeStyle = live ? 'rgba(180,215,245,0.92)' : 'rgba(125,148,180,0.3)';
      ctx.lineWidth = 2.5;
      if (live) { ctx.shadowColor = 'rgba(120,170,220,0.45)'; ctx.shadowBlur = 5; }
    }
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ex, ey); ctx.stroke();
    // a small joint dot where a LIVE line docks into a node (reads as an engineered graph)
    if (live && !ed.warp) {
      ctx.shadowBlur = 0;
      ctx.fillStyle = ed.branch ? 'rgba(150,205,240,0.8)' : 'rgba(190,220,250,0.95)';
      ctx.beginPath(); ctx.arc(ax, ay, 2.2, 0, 6.2832); ctx.fill();
      ctx.beginPath(); ctx.arc(bxw, byw, 2.2, 0, 6.2832); ctx.fill();
    }
    ctx.restore();
  }
}

// flat-faceted node box: a swatch icon + name + a par/score placeholder line.
function drawNode(i) {
  var nd = NODES[i];
  var x = nd.x - cam.x, y = nd.y;
  if (x < -120 || x > W + 120) return;
  var on = isUnlocked(i);
  var cur = isCurrent(i);
  var pop = on ? easeOut(Math.min(1, revealAnim[i])) : 0;
  var land = landColor(nd.id);
  var sky = skyColor(nd.id);

  ctx.save();
  ctx.translate(x, y);
  var sc = 0.82 + 0.18 * pop;          // pop-in scale on reveal
  ctx.scale(sc, sc);

  // box geometry (flat-faceted: base fill + darker bottom face band + lighter top lip)
  var bw = nd.r * 2 + 12, bh = nd.r * 2 + 12;
  var bx = -bw / 2, by = -bh / 2;
  var hover = (mouse.hover === i);

  // glow ring for current / hover
  if (cur || hover) {
    ctx.save();
    ctx.shadowColor = cur ? '#ffe6a0' : '#bfe0ff';
    ctx.shadowBlur = cur ? 22 : 14;
    ctx.fillStyle = 'rgba(0,0,0,0)';
    ctx.fillRect(bx, by, bw, bh);
    ctx.restore();
  }

  // base box
  if (on) {
    ctx.fillStyle = shade(sky, 1.18);                  // lit panel = the body's sky, brightened
  } else {
    ctx.fillStyle = '#141a24';                         // locked = dim slate
  }
  ctx.fillRect(bx, by, bw, bh);
  // darker bottom face band (depth)
  ctx.fillStyle = on ? shade(sky, 0.72) : '#0e131b';
  ctx.fillRect(bx, by + bh - 6, bw, 6);
  // lighter top lip
  ctx.fillStyle = on ? shade(sky, 1.55) : '#222b38';
  ctx.fillRect(bx, by, bw, 3);

  // border
  ctx.lineWidth = cur ? 2.5 : 1.5;
  ctx.strokeStyle = cur ? '#ffe09a' : (on ? (hover ? '#cfeaff' : shade(sky, 1.9)) : '#2a3340');
  ctx.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);

  // ── the planet SWATCH icon (a flat-faceted little disc: base + shade crescent + lip) ──
  var ir = nd.r - 5;
  ctx.save();
  if (!on) ctx.globalAlpha = 0.4;
  // base disc
  ctx.fillStyle = on ? land : shade(land, 0.55);
  ctx.beginPath(); ctx.arc(0, -2, ir, 0, 6.2832); ctx.fill();
  // shade crescent bottom-right (faceted depth)
  ctx.fillStyle = shade(land, on ? 0.72 : 0.5);
  ctx.beginPath(); ctx.arc(ir * 0.32, -2 + ir * 0.32, ir, 0, 6.2832); ctx.clip ? 0 : 0;
  ctx.restore();
  // redraw crescent properly (clip to the disc)
  ctx.save();
  if (!on) ctx.globalAlpha = 0.4;
  ctx.beginPath(); ctx.arc(0, -2, ir, 0, 6.2832); ctx.clip();
  ctx.fillStyle = shade(land, on ? 0.72 : 0.55);
  ctx.beginPath(); ctx.arc(ir * 0.55, -2 + ir * 0.55, ir, 0, 6.2832); ctx.fill();
  // top lip highlight
  ctx.fillStyle = shade(land, on ? 1.4 : 1.0);
  ctx.fillRect(-ir, -2 - ir, ir * 2, 2.2);
  ctx.restore();

  // star bodies get a soft corona
  if (nd.isStar && on) {
    ctx.save();
    ctx.globalAlpha = 0.5 + 0.18 * Math.sin(frame * 0.05);
    ctx.shadowColor = SYSTEMS[nd.sysIdx].star; ctx.shadowBlur = 26;
    ctx.strokeStyle = SYSTEMS[nd.sysIdx].star; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, -2, ir + 3, 0, 6.2832); ctx.stroke();
    ctx.restore();
  }

  // PLAYED (not the current frontier): a small replay ring in the corner → "click to replay"
  if (on && isPlayed(i) && !cur) {
    ctx.save();
    ctx.globalAlpha = (mouse.hover === i) ? 0.95 : 0.5;
    ctx.strokeStyle = '#9ad6c0'; ctx.lineWidth = 1.4;
    var rcx = bw / 2 - 7, rcy = -bh / 2 + 7;
    ctx.beginPath(); ctx.arc(rcx, rcy, 4, 0.5, 5.2); ctx.stroke();
    // arrowhead
    ctx.beginPath(); ctx.moveTo(rcx + 3.4, rcy - 3.4); ctx.lineTo(rcx + 5.2, rcy - 1.2); ctx.lineTo(rcx + 1.8, rcy - 1.6); ctx.closePath();
    ctx.fillStyle = '#9ad6c0'; ctx.fill();
    ctx.restore();
  }

  // LOCKED: padlock glyph centered
  if (!on) {
    ctx.fillStyle = 'rgba(150,165,185,0.6)';
    ctx.fillRect(-5, -4, 10, 8);                 // body
    ctx.strokeStyle = 'rgba(150,165,185,0.6)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, -5, 4, Math.PI, 0); ctx.stroke();   // shackle
    ctx.fillStyle = '#10141c'; ctx.fillRect(-1, -2, 2, 4);          // keyhole
  }

  ctx.restore(); // unscale

  // ── label + score (drawn unscaled, under the box) ──
  // don't render a label that would be half-clipped by the canvas edge (the critic's clipping bug)
  if (x < 70 || x > W - 70) return;
  ctx.save();
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  var labelY = y + bh * 0.5 * sc + 6;
  if (on) {
    ctx.fillStyle = cur ? '#fff6df' : '#dce6f2';
    ctx.font = "11px " + FONT;
    // strip the parenthetical / dotted suffix so the node name stays short ("Tau Ceti g")
    var shortName = String(nd.name).split(' · ')[0].split(' (')[0];
    ctx.fillText(shortName.toUpperCase(), x, labelY);
    // ── REAL per-planet score line ──
    ctx.font = "9px " + FONT;
    var rec = isPlayed(i) ? played[nd.id] : null;
    if (rec) {
      // PLAYED: show total-vs-par (coloured) + best. e.g. "+2 · BEST 25"
      var d = (rec.total != null && rec.par != null) ? (rec.total - rec.par) : 0;
      var vs = d === 0 ? 'E' : (d > 0 ? '+' + d : String(d));
      var vc = d < 0 ? 'rgba(122,209,122,0.95)' : (d === 0 ? 'rgba(205,214,245,0.9)' : 'rgba(230,184,74,0.95)');
      ctx.fillStyle = vc;
      ctx.fillText(vs + '  ·  BEST ' + (rec.best != null ? rec.best : rec.total), x, labelY + 13);
    } else if (cur) {
      ctx.fillStyle = 'rgba(255,224,154,0.9)';
      ctx.fillText('▶ YOU ARE HERE', x, labelY + 13);
    } else {
      ctx.fillStyle = 'rgba(150,180,215,0.7)';
      var holes = (COURSES[nd.id] && COURSES[nd.id].holeCount) || 9;
      ctx.fillText(holes + ' HOLES', x, labelY + 13);
    }
  } else {
    ctx.fillStyle = 'rgba(130,145,165,0.45)';
    ctx.font = "10px " + FONT;
    ctx.fillText('LOCKED', x, labelY);
  }
  ctx.restore();
}

// you-are-here marker: a small drifting ship/chevron over the current node
function drawYouAreHere() {
  var i = unlockedCount() - 1; var nd = NODES[i]; if (!nd) return;
  var x = nd.x - cam.x, y = nd.y - nd.r - 22 + Math.sin(frame * 0.06) * 3;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#ffe09a';
  ctx.beginPath(); ctx.moveTo(0, 8); ctx.lineTo(-6, -4); ctx.lineTo(0, -1); ctx.lineTo(6, -4); ctx.closePath(); ctx.fill();
  ctx.restore();
}

function drawHUD() {
  ctx.save();
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillStyle = 'rgba(242,236,255,0.9)';
  ctx.font = "18px " + FONT;
  ctx.fillText('STAR MAP', 22, 18);
  ctx.fillStyle = 'rgba(180,200,225,0.55)';
  ctx.font = "11px " + FONT;
  ctx.fillText(REAL ? 'CLICK A PLAYED PLANET TO REPLAY · ESC TO RESUME' : 'CLICK A PLANET TO TRAVEL', 22, 42);
  // progress — count of PLAYED bodies when wired to real data
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(180,200,225,0.7)';
  ctx.font = "12px " + FONT;
  if (REAL) {
    var np = 0; for (var pi = 0; pi < TOTAL; pi++) if (isPlayed(pi)) np++;
    ctx.fillText(np + ' / ' + TOTAL + ' PLAYED', W - 22, 20);
  } else {
    ctx.fillText(unlocked + ' / ' + TOTAL + ' UNLOCKED', W - 22, 20);
  }
  // hint
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(150,165,190,0.4)';
  ctx.font = "10px " + FONT;
  ctx.fillText(REAL ? 'auto-pan follows your frontier' : '[→]/[←] reveal more  ·  drag-free auto-pan follows you', 22, H - 22);
  ctx.restore();
}

function drawTravel() {
  if (!traveling) return;
  var t = traveling.t;
  var ox = traveling.cx, oy = traveling.cy;            // warp origin = the clicked node
  // 1) a deliberate radial wipe in the system accent, growing from the node to fill the screen
  var a = Math.min(1, t * 1.5);
  ctx.save();
  var maxR = Math.hypot(W, H);
  var rg = ctx.createRadialGradient(ox, oy, 0, ox, oy, maxR);
  rg.addColorStop(0, 'rgba(8,9,15,' + (0.9 * a).toFixed(3) + ')');
  rg.addColorStop(0.5, 'rgba(8,9,15,' + (0.82 * a).toFixed(3) + ')');
  rg.addColorStop(1, 'rgba(6,7,12,' + (0.7 * a).toFixed(3) + ')');
  ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
  ctx.restore();
  // 2) warp streaks radiating OUTWARD from the node (a forward-jump, not horizontal noise)
  ctx.save();
  ctx.globalAlpha = a;
  ctx.translate(ox, oy);
  for (var i = 0; i < 70; i++) {
    var ang = (i / 70) * Math.PI * 2 + seed(i) * 0.4;
    var inner = 30 + (frame * 5 + seed(i) * 200) % 360;
    var len = 20 + 80 * t + seed(i * 2) * 50 * t;
    var c1 = Math.cos(ang), s1 = Math.sin(ang);
    var bright = seed(i * 3) < 0.4;
    ctx.strokeStyle = bright ? hexA(traveling.star, 0.8) : 'rgba(255,255,255,0.55)';
    ctx.lineWidth = bright ? 1.8 : 1;
    ctx.beginPath(); ctx.moveTo(c1 * inner, s1 * inner); ctx.lineTo(c1 * (inner + len), s1 * (inner + len)); ctx.stroke();
  }
  ctx.restore();
  // 3) bright accent-tinted title card
  if (t > 0.32) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, (t - 0.32) * 3.2);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    // a soft accent glow behind the title
    ctx.shadowColor = traveling.star; ctx.shadowBlur = 18;
    ctx.fillStyle = '#fff6df'; ctx.font = "24px " + FONT;
    ctx.fillText('BOOTING  ' + traveling.name.toUpperCase(), W / 2, H / 2 - 14);
    ctx.shadowBlur = 0;
    ctx.fillStyle = hexA(traveling.accent, 0.95); ctx.font = "12px " + FONT;
    ctx.fillText('run.html?course=' + traveling.id, W / 2, H / 2 + 16);
    // a thin accent rule under it
    ctx.strokeStyle = hexA(traveling.accent, 0.6); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(W / 2 - 120, H / 2 + 34); ctx.lineTo(W / 2 + 120, H / 2 + 34); ctx.stroke();
    ctx.restore();
  }
}

// ── helpers ──────────────────────────────────────────────────────────────────────────────────────
function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
function hexA(hex, al) {
  var h = hex.replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  var r = parseInt(h.substr(0, 2), 16), g = parseInt(h.substr(2, 2), 16), b = parseInt(h.substr(4, 2), 16);
  return 'rgba(' + r + ',' + g + ',' + b + ',' + al + ')';
}
function shade(hex, mul) {
  // hex may be #rgb/#rrggbb; multiply each channel, clamp.
  var h = hex.replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  var r = parseInt(h.substr(0, 2), 16), g = parseInt(h.substr(2, 2), 16), b = parseInt(h.substr(4, 2), 16);
  r = Math.max(0, Math.min(255, Math.round(r * mul)));
  g = Math.max(0, Math.min(255, Math.round(g * mul)));
  b = Math.max(0, Math.min(255, Math.round(b * mul)));
  return 'rgb(' + r + ',' + g + ',' + b + ')';
}

// ── Frame / loop ────────────────────────────────────────────────────────────────────────────────────
var frame = 0;
var auto = true;

function update() {
  frame++;
  cam.x += (cam.tx - cam.x) * 0.12;                 // smooth pan
  for (var i = 0; i < TOTAL; i++) if (revealAnim[i] > 0 && revealAnim[i] < 1) revealAnim[i] = Math.min(1, revealAnim[i] + 0.06);
  if (traveling) { traveling.t += 0.018; if (traveling.t >= 1.15) {
    // real travel: boot the chosen body. When this map runs as the IN-GAME overlay (an iframe inside
    // run.html), navigate the TOP window so the whole game reboots into that course (replaying it) —
    // navigating just the iframe would orphan the overlay shell. Standalone → navigate normally.
    var url = 'run.html?course=' + traveling.id;
    if (window.__STARMAP_NO_NAV) { console.log('[starmap] (nav suppressed) ' + url); traveling = null; }
    else {
      try {
        if (window.top && window.top !== window.self) window.top.location.href = url;   // in-game overlay iframe → reboot the parent
        else location.href = url;                                                       // standalone page
      } catch (e) { location.href = url; }                                              // cross-origin guard (never here, same origin)
    }
  } }
}

function draw() {
  drawSky();
  drawSystemLabels();
  drawEdges();
  for (var i = 0; i < TOTAL; i++) drawNode(i);
  drawYouAreHere();
  drawHUD();
  drawTravel();
}

function loop() { if (auto) { update(); draw(); } requestAnimationFrame(loop); }

function reset() {
  buildGraph();
  unlocked = 1; TOTAL = NODES.length;
  revealAnim = []; for (var i = 0; i < TOTAL; i++) revealAnim.push(0);
  traveling = null; frame = 0;
  refreshProgress();
  // reveal the reachable frontier immediately (no pop) on a cold open so the map reads "settled"
  for (var j = 0; j < TOTAL; j++) revealAnim[j] = (j <= (REAL ? frontierIdx : unlocked - 1)) ? 1 : 0;
  makeStars();
  centerOnCurrent(false);
  draw();
}

// keyboard: reveal more / fewer
window.addEventListener('keydown', function (e) {
  if (e.key === 'ArrowRight') setReveal(unlocked + 1);
  else if (e.key === 'ArrowLeft') setReveal(unlocked - 1);
  else if (e.key === 'r' || e.key === 'R') reset();
});

// boot
reset();
requestAnimationFrame(loop);

// ── Headless API (for screenshotting the reveal/branching + travel) ──────────────────────────────────
window.__reset = reset;
window.__step = function () { update(); draw(); };
window.__frame = function () { draw(); };
window.__setAuto = function (b) { auto = !!b; };
window.__reveal = function (n) { setReveal(n); draw(); };
window.__travel = function (i) { travelTo(typeof i === 'number' ? i : unlocked - 1); };
window.__state = function () { return { unlocked: unlocked, total: TOTAL, current: NODES[unlocked - 1] && NODES[unlocked - 1].id, traveling: traveling }; };
// let screenshot harness suppress the page navigation on travel
window.__STARMAP_NO_NAV = /[?&]nonav\b/.test(location.search);

})();
