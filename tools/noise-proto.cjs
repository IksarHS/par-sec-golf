// ── noise-proto.cjs — explore a GoM-style ARCHETYPE-FREE generator ───────────────────────────────────
// Hypothesis: Golf-on-Mars terrain is just one continuous noise function, sampled into straight facets,
// with flats/cliffs/plateaus emerging from TERRACING (height quantization) — no named archetypes. One
// "roughness" knob = complexity. This renders a stack of holes across the roughness range so we can SEE
// whether that reads as GoM before wiring anything into the engine.   Run: node tools/noise-proto.cjs

const fs = require('fs'), zlib = require('zlib');

// ── value noise + fbm (1D over x) ──
function hash2(xi, yi, s) { let h = (Math.imul(xi, 374761393) + Math.imul(yi, 668265263) + Math.imul(s, 2246822519)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
const sm = (t) => t * t * (3 - 2 * t), L = (a, b, t) => a + (b - a) * t;
function vn(x, s) { const xi = Math.floor(x), xf = x - xi; return L(hash2(xi, 0, s), hash2(xi + 1, 0, s), sm(xf)); }
function fbm(x, s, oct) { let a = 0.5, f = 1, sum = 0, n = 0; for (let i = 0; i < oct; i++) { sum += a * vn(x * f, s + i * 1013); n += a; a *= 0.5; f *= 2; } return sum / n; }

// ── THE generator: surface height at world x, from roughness r (0..1) + seed ──
// r drives amplitude, feature density (freq+octaves), and how hard it terraces. That's the whole knob.
function surface(x, r, s) {
  const baseY = 90;                               // sits in the upper-middle of a 200px hole
  const amp = 22 + r * 70;                        // vertical drama
  const freq = (0.9 + r * 1.7) / 600;             // feature density
  const oct = 2 + Math.floor(r * 3);              // detail
  let y = baseY + (fbm(x * freq, s, oct) - 0.5) * 2 * amp;
  // TERRACE: quantize to steps → flats + sharp cliffs/plateaus. Kicks in past low roughness, coarser as r↑.
  if (r > 0.22) { const step = 14 + r * 42; y = Math.round(y / step) * step; }
  return Math.max(12, Math.min(188, y));
}

// ── render one hole into a pixel buffer (faceted: sample at FACET px, straight segments between) ──
const SKY = [26, 34, 48], TERR = [98, 168, 75], FLAG = [232, 195, 60], BALL = [240, 240, 240];
const FACET = 26;            // sample spacing → facet size (bigger = chunkier/more GoM)
function renderHole(px, W, H, ox, oy, r, s) {
  // sample vertices
  const xs = [], ys = [];
  for (let x = 0; x <= W; x += FACET) { xs.push(x); ys.push(surface(x + s * 13, r, s)); }
  xs.push(W); ys.push(surface(W + s * 13, r, s));
  const surfAt = (x) => { let i = Math.min(xs.length - 2, Math.floor(x / FACET)); const t = (x - xs[i]) / (xs[i + 1] - xs[i] || 1); return L(ys[i], ys[i + 1], t); };
  // cup: a notch carved into the surface at ~72% across (sky-coloured = a hole in the ground)
  const cupX = Math.round(W * 0.72), cupY = Math.round(surfAt(cupX)), CW = 18, CD = 22;
  // paint (local x,y within this HH-tall hole row)
  for (let x = 0; x < W; x++) {
    const sy = surfAt(x);
    const inCup = Math.abs(x - cupX) < CW / 2;
    for (let y = 0; y < HH; y++) {
      let c = SKY;
      if (inCup) { c = (y >= cupY + CD) ? TERR : SKY; }   // rectangular notch carved into the surface
      else if (y >= sy) c = TERR;
      const o = ((oy + y) * W + (ox + x)) * 3; if (o < 0 || o + 2 >= px.length) continue;
      px[o] = c[0]; px[o + 1] = c[1]; px[o + 2] = c[2];
    }
  }
  // flag pole + flag
  for (let y = cupY - 34; y < cupY; y++) { const o = ((oy + y) * W + (ox + cupX)) * 3; if (o >= 0 && o + 2 < px.length) { px[o] = 200; px[o + 1] = 200; px[o + 2] = 210; } }
  for (let fy = cupY - 34; fy < cupY - 22; fy++) for (let fx = cupX; fx < cupX + 16; fx++) { const o = ((oy + fy) * W + (ox + fx)) * 3; if (o >= 0 && o + 2 < px.length) { px[o] = FLAG[0]; px[o + 1] = FLAG[1]; px[o + 2] = FLAG[2]; } }
  // ball at the left (tee)
  const tx = 30, ty = Math.round(surfAt(30)) - 5;
  for (let by = -4; by <= 4; by++) for (let bx = -4; bx <= 4; bx++) { if (bx * bx + by * by > 16) continue; const o = ((oy + ty + by) * W + (ox + tx + bx)) * 3; if (o >= 0 && o + 2 < px.length) { px[o] = BALL[0]; px[o + 1] = BALL[1]; px[o + 2] = BALL[2]; } }
}

// ── stack 6 holes across the roughness range ──
const HW = 1000, HH = 200, ROWS = 6, GAP = 6;
const W = HW, H = ROWS * HH + (ROWS - 1) * GAP;
const px = Buffer.alloc(W * H * 3);
const roughs = [0.08, 0.28, 0.45, 0.62, 0.8, 0.95];
for (let r = 0; r < ROWS; r++) renderHole(px, W, H, 0, r * (HH + GAP), roughs[r], 1000 + r * 31);

// ── PNG out ──
function crc32(b) { let c = ~0; for (let i = 0; i < b.length; i++) { c ^= b[i]; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1)); } return ~c >>> 0; }
function ch(t, d) { const l = Buffer.alloc(4); l.writeUInt32BE(d.length, 0); const ty = Buffer.from(t); const cr = Buffer.alloc(4); cr.writeUInt32BE(crc32(Buffer.concat([ty, d])), 0); return Buffer.concat([l, ty, d, cr]); }
const raw = Buffer.alloc(H * (W * 3 + 1));
for (let y = 0; y < H; y++) { raw[y * (W * 3 + 1)] = 0; px.copy(raw, y * (W * 3 + 1) + 1, y * W * 3, (y + 1) * W * 3); }
const ih = Buffer.alloc(13); ih.writeUInt32BE(W, 0); ih.writeUInt32BE(H, 4); ih[8] = 8; ih[9] = 2;
const out = process.argv[2] || '/tmp/noise_proto.png';
fs.writeFileSync(out, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), ch('IHDR', ih), ch('IDAT', zlib.deflateSync(raw, { level: 9 })), ch('IEND', Buffer.alloc(0))]));
console.log('wrote ' + out + '  (roughness rows: ' + roughs.join(', ') + ')');
