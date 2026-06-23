// ── dreamboard-render.cjs — headless montage of the DREAM pipeline output ────────────────────────────
// Renders the composed concepts + every cave concept + every floating body as faceted holes (with overhang
// slabs drawn) into a contact sheet, so we can SEE the Tau Ceti mechanisms. Uses the real holegen modules.
//   node tools/dreamboard-render.cjs [out.png] [which: concepts|caves|floats|all]
const fs = require('fs'), zlib = require('zlib');
const SPINE = require('../src/holegen/spine.js'), OPS = require('../src/holegen/operators.js'), SKIN = require('../src/holegen/skin.js');
const CAVES = require('../src/holegen/caves.js'), FLOAT = require('../src/holegen/setpieces-dream.js');
// shim engine globals the float module's clampY-free code expects (pure modules don't need them, but FLOAT/CAVES use clamp internally)
function mulberry(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const HW = 1000, HH = 200, GAP = 6, FACET = 22, bounds = { top: 24, bot: 188 };
const L = (a, b, t) => a + (b - a) * t;

function composedHole(concept, diff, seed) {
  const rng = mulberry(seed), tee = { x: 40, y: 90 + (rng() - 0.5) * 30 }, dist = HW - 120;
  const sp = SPINE.makeSpine(concept, { tee, dist, diff, rng, bounds });
  const ops = []; const span = dist;
  const n = 1 + Math.round(diff * 3 + rng());
  for (let i = 0; i < n; i++) { const px = tee.x + span * (0.2 + rng() * 0.55); ops.push(OPS.mound(px, 16 + diff * 28, 50 + rng() * 40)); if (rng() < 0.5) ops.push(OPS.bunker(px + 60, 14 + diff * 18, 40)); }
  const baseFn = (x) => sp.sample(Math.max(tee.x, Math.min(sp.greenX, x)));
  const composed = OPS.compose(baseFn, ops);
  const xs = [], ys = []; for (let x = 0; x <= HW; x += FACET) { xs.push(x); ys.push(composed(Math.max(tee.x, Math.min(sp.greenX, x)))); }
  const sk = SKIN.applySkin({ xs, ys }, { fbmAmp: 3 + diff * 3, fbmFreq: 0.02, seed, terrace: { on: diff > 0.28, step: 14 + diff * 22 }, thermal: { maxGrade: 1.12, iters: 32 }, protect: [{ x: tee.x, r: 26 }, { x: sp.greenX, r: 44 }], bounds });
  return { xs: sk.xs, ys: sk.ys, cupX: sp.greenX, teeX: tee.x, overhangs: [], label: concept };
}
function caveHole(name, diff, seed) {
  const r = CAVES.genCave(name, { sx: 40, sy: 95, dist: HW - 120, diff, rng: mulberry(seed), bounds, ballR: 5 });
  const xs = [], ys = []; const surf = (x) => { let lo = 0; for (let i = 0; i < r.floor.length - 1; i++) if (r.floor[i].x <= x) lo = i; const a = r.floor[lo], b = r.floor[Math.min(lo + 1, r.floor.length - 1)]; const t = (x - a.x) / (b.x - a.x || 1); return L(a.y, b.y, Math.max(0, Math.min(1, t))); };
  for (let x = 0; x <= HW; x += 6) { xs.push(x); ys.push(surf(x)); }
  return { xs, ys, step: 6, cupX: r.cupX, teeX: 60, overhangs: r.overhangs, label: name };
}
function floatHole(name, diff, seed) {
  const r = FLOAT.genFloater(name, { sx: 40, sy: 110, dist: HW - 120, diff, rng: mulberry(seed), bounds, ballR: 5 });
  const xs = [], ys = []; const surf = (x) => { let lo = 0; for (let i = 0; i < r.floor.length - 1; i++) if (r.floor[i].x <= x) lo = i; const a = r.floor[lo], b = r.floor[Math.min(lo + 1, r.floor.length - 1)]; const t = (x - a.x) / (b.x - a.x || 1); return L(a.y, b.y, Math.max(0, Math.min(1, t))); };
  for (let x = 0; x <= HW; x += 6) { xs.push(x); ys.push(surf(x)); }
  return { xs, ys, step: 6, cupX: r.cupX, teeX: 60, overhangs: r.overhangs, label: name };
}

const SKY = [22, 28, 40], TERR = [70, 150, 120], ROCK = [120, 96, 150], FLAG = [232, 195, 60], BALL = [240, 240, 240];
function setpx(px, W, x, y, c) { if (x < 0 || y < 0 || x >= W) return; const o = (y * W + x) * 3; if (o < 0 || o + 2 >= px.length) return; px[o] = c[0]; px[o + 1] = c[1]; px[o + 2] = c[2]; }
function fillPoly(px, W, oy, poly, c) { let minY = 1e9, maxY = -1e9; for (const p of poly) { minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); } for (let y = Math.max(0, minY | 0); y <= Math.min(HH - 1, maxY | 0); y++) { const xsl = []; for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length]; if ((a.y <= y && b.y > y) || (b.y <= y && a.y > y)) { xsl.push(a.x + (y - a.y) / (b.y - a.y) * (b.x - a.x)); } } xsl.sort((u, v) => u - v); for (let k = 0; k + 1 < xsl.length; k += 2) for (let x = xsl[k] | 0; x <= xsl[k + 1] | 0; x++) setpx(px, W, x, oy + y, c); } }
function renderHole(px, W, oy, hole) {
  const step = hole.step || FACET; const surfAt = (x) => { let i = Math.max(0, Math.min(hole.xs.length - 2, Math.floor(x / step))); const t = (x - hole.xs[i]) / (hole.xs[i + 1] - hole.xs[i] || 1); return L(hole.ys[i], hole.ys[i + 1], t); };
  for (let x = 0; x < W; x++) { const sy = surfAt(x); for (let y = 0; y < HH; y++) setpx(px, W, x, oy + y, y >= sy ? TERR : SKY); }
  for (const poly of hole.overhangs || []) fillPoly(px, W, oy, poly, ROCK);
  // cup notch (drawn after slabs so it reads)
  const cupX = hole.cupX | 0, cupY = surfAt(cupX) | 0, CW = 16, CD = 18;
  for (let x = cupX - CW / 2; x < cupX + CW / 2; x++) for (let y = cupY; y < cupY + CD; y++) setpx(px, W, x | 0, oy + y, SKY);
  for (let y = cupY - 30; y < cupY; y++) setpx(px, W, cupX, oy + y, [200, 200, 210]);
  for (let fy = cupY - 30; fy < cupY - 20; fy++) for (let fx = cupX; fx < cupX + 14; fx++) setpx(px, W, fx, oy + fy, FLAG);
  const tx = hole.teeX | 0, ty = (surfAt(hole.teeX) - 5) | 0;
  for (let by = -4; by <= 4; by++) for (let bx = -4; bx <= 4; bx++) if (bx * bx + by * by <= 16) setpx(px, W, tx + bx, oy + ty + by, BALL);
}

const which = process.argv[3] || 'all';
let rows = [];
const concepts = SPINE.CONCEPT_NAMES;
if (which === 'all' || which === 'concepts') concepts.forEach((c, i) => rows.push(composedHole(c, 0.35 + i * 0.08, 7000 + i * 131)));
if (which === 'all' || which === 'caves') CAVES.NAMES.forEach((c, i) => rows.push(caveHole(c, 0.5, 8000 + i * 97)));
if (which === 'all' || which === 'floats') FLOAT.NAMES.forEach((c, i) => rows.push(floatHole(c, 0.5, 9000 + i * 53)));

const W = HW, H = rows.length * (HH + GAP) - GAP;
const px = Buffer.alloc(W * H * 3);
rows.forEach((h, r) => renderHole(px, W, r * (HH + GAP), h));
function crc32(b) { let c = ~0; for (let i = 0; i < b.length; i++) { c ^= b[i]; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1)); } return ~c >>> 0; }
function ch(t, d) { const l = Buffer.alloc(4); l.writeUInt32BE(d.length, 0); const ty = Buffer.from(t); const cr = Buffer.alloc(4); cr.writeUInt32BE(crc32(Buffer.concat([ty, d])), 0); return Buffer.concat([l, ty, d, cr]); }
const raw = Buffer.alloc(H * (W * 3 + 1));
for (let y = 0; y < H; y++) { raw[y * (W * 3 + 1)] = 0; px.copy(raw, y * (W * 3 + 1) + 1, y * W * 3, (y + 1) * W * 3); }
const ih = Buffer.alloc(13); ih.writeUInt32BE(W, 0); ih.writeUInt32BE(H, 4); ih[8] = 8; ih[9] = 2;
const out = process.argv[2] || '/mnt/c/dev/editor-shots/dreamboard-render.png';
fs.writeFileSync(out, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), ch('IHDR', ih), ch('IDAT', zlib.deflateSync(raw, { level: 9 })), ch('IEND', Buffer.alloc(0))]));
console.log('wrote ' + out + ' (' + rows.length + ' rows: ' + rows.map(r => r.label).join(', ') + ')');
