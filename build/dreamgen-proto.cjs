// ── dreamgen-proto.cjs — headless render of the composed-signal pipeline (spine+operators+skin) ───────
// Renders one row per CONCEPT (+ an operator-stacked variant) so we can SEE the silhouettes before wiring
// into the engine. Same PNG writer + faceted look as tools/noise-proto.cjs.  Run: node tools/dreamgen-proto.cjs
const fs = require('fs'), zlib = require('zlib');
const SPINE = require('../game/holegen/spine.js');
const OPS = require('../game/holegen/operators.js');
const SKIN = require('../game/holegen/skin.js');

// seeded rng (mulberry32)
function mulberry(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

const HW = 1000, HH = 200, GAP = 6, FACET = 22;
const bounds = { top: 24, bot: 188 };

// build a sampled heightfield for one concept at a given difficulty
function buildHole(concept, diff, seed, withOps) {
  const rng = mulberry(seed);
  const tee = { x: 40, y: 90 + (rng() - 0.5) * 30 }, dist = HW - 120;
  const sp = SPINE.makeSpine(concept, { tee, dist, diff, rng, bounds });
  // sample the spine
  const xs = [], ys0 = [];
  for (let x = 0; x <= HW; x += FACET) { xs.push(x); ys0.push(sp.sample(Math.max(tee.x, Math.min(sp.greenX, x)))); }
  // operators
  const ops = [];
  if (withOps) {
    const span = dist;
    ops.push(OPS.mound(tee.x + span * 0.4, 20 + diff * 30, 70));
    ops.push(OPS.bunker(sp.greenX - 90, 16 + diff * 20, 45));
    ops.push(OPS.plateau(tee.x + span * 0.55, tee.x + span * 0.7, 24 + diff * 20));
    ops.push(OPS.dunePatch(tee.x + span * 0.15, tee.x + span * 0.85, 6 + diff * 8, 0.02, seed, SKIN.fbm));
  }
  const baseFn = (x) => sp.sample(Math.max(tee.x, Math.min(sp.greenX, x)));
  const composed = OPS.compose(baseFn, ops);
  const ys = xs.map((x) => composed(x));
  // skin: fbm + terrace + thermal (protect cup + tee)
  const protect = [{ x: tee.x, r: 30 }, { x: sp.greenX, r: 40 }];
  const skinned = SKIN.applySkin({ xs, ys }, {
    fbmAmp: 4, fbmFreq: 0.02, seed,
    terrace: { on: diff > 0.3, step: 16 + diff * 22 },
    thermal: { maxGrade: 1.1, iters: 30 },
    protect, bounds,
  });
  return { xs: skinned.xs, ys: skinned.ys, cupX: sp.greenX, teeX: tee.x, feature: sp.feature };
}

const SKY = [22, 28, 40], TERR = [70, 150, 120], FLAG = [232, 195, 60], BALL = [240, 240, 240];
function renderHole(px, W, H, ox, oy, hole) {
  const { xs, ys, cupX, teeX } = hole;
  const surfAt = (x) => { let i = Math.max(0, Math.min(xs.length - 2, Math.floor(x / FACET))); const t = (x - xs[i]) / (xs[i + 1] - xs[i] || 1); return L(ys[i], ys[i + 1], t); };
  const cupY = Math.round(surfAt(cupX)), CW = 18, CD = 20;
  for (let x = 0; x < W; x++) {
    const sy = surfAt(x), inCup = Math.abs(x - cupX) < CW / 2;
    for (let y = 0; y < HH; y++) {
      let c = SKY;
      if (inCup) { c = (y >= cupY + CD) ? TERR : SKY; } else if (y >= sy) c = TERR;
      const o = ((oy + y) * W + (ox + x)) * 3; if (o < 0 || o + 2 >= px.length) continue;
      px[o] = c[0]; px[o + 1] = c[1]; px[o + 2] = c[2];
    }
  }
  for (let y = cupY - 34; y < cupY; y++) { const o = ((oy + y) * W + (ox + cupX)) * 3; if (o >= 0 && o + 2 < px.length) { px[o] = 200; px[o + 1] = 200; px[o + 2] = 210; } }
  for (let fy = cupY - 34; fy < cupY - 22; fy++) for (let fx = cupX; fx < cupX + 16; fx++) { const o = ((oy + fy) * W + (ox + fx)) * 3; if (o >= 0 && o + 2 < px.length) { px[o] = FLAG[0]; px[o + 1] = FLAG[1]; px[o + 2] = FLAG[2]; } }
  const tx = Math.round(teeX), ty = Math.round(surfAt(teeX)) - 5;
  for (let by = -4; by <= 4; by++) for (let bx = -4; bx <= 4; bx++) { if (bx * bx + by * by > 16) continue; const o = ((oy + ty + by) * W + (ox + tx + bx)) * 3; if (o >= 0 && o + 2 < px.length) { px[o] = BALL[0]; px[o + 1] = BALL[1]; px[o + 2] = BALL[2]; } }
}
const L = (a, b, t) => a + (b - a) * t;

const concepts = SPINE.CONCEPT_NAMES;
const ROWS = concepts.length;
const W = HW, H = ROWS * HH + (ROWS - 1) * GAP;
const px = Buffer.alloc(W * H * 3);
for (let r = 0; r < ROWS; r++) {
  const diff = 0.3 + (r / ROWS) * 0.6;
  const hole = buildHole(concepts[r], diff, 7000 + r * 131, true);
  renderHole(px, W, H, 0, r * (HH + GAP), hole);
}
function crc32(b) { let c = ~0; for (let i = 0; i < b.length; i++) { c ^= b[i]; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1)); } return ~c >>> 0; }
function ch(t, d) { const l = Buffer.alloc(4); l.writeUInt32BE(d.length, 0); const ty = Buffer.from(t); const cr = Buffer.alloc(4); cr.writeUInt32BE(crc32(Buffer.concat([ty, d])), 0); return Buffer.concat([l, ty, d, cr]); }
const raw = Buffer.alloc(H * (W * 3 + 1));
for (let y = 0; y < H; y++) { raw[y * (W * 3 + 1)] = 0; px.copy(raw, y * (W * 3 + 1) + 1, y * W * 3, (y + 1) * W * 3); }
const ih = Buffer.alloc(13); ih.writeUInt32BE(W, 0); ih.writeUInt32BE(H, 4); ih[8] = 8; ih[9] = 2;
const out = process.argv[2] || '/tmp/dreamgen-proto.png';
fs.writeFileSync(out, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), ch('IHDR', ih), ch('IDAT', zlib.deflateSync(raw, { level: 9 })), ch('IEND', Buffer.alloc(0))]));
console.log('wrote ' + out + '  rows: ' + concepts.join(', '));
