// Prototype: 2D field -> ANGULAR marching-squares contour -> render, to match the reference (big
// interlocking red plates with sky carved between/under = overhangs + caves). Iterate the LOOK here
// before wiring into the game. Run: node tools/weird-proto.cjs <seed> <out.png> [soft warp wf hf amp cell]
const fs = require('fs'), zlib = require('zlib');
const W = 1059, H = 540;

function hash2(xi, yi, s) { let h = (Math.imul(xi, 374761393) + Math.imul(yi, 668265263) + Math.imul(s, 2246822519)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
const sm = (t) => t * t * (3 - 2 * t), L = (a, b, t) => a + (b - a) * t;
function vn2(x, y, s) { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = sm(xf), v = sm(yf); return L(L(hash2(xi, yi, s), hash2(xi + 1, yi, s), u), L(hash2(xi, yi + 1, s), hash2(xi + 1, yi + 1, s), u), v); }
function fbm2(x, y, s, o) { let a = 0.5, f = 1, sum = 0, n = 0; for (let i = 0; i < o; i++) { sum += a * vn2(x * f, y * f, s + i * 1013); n += a; a *= 0.5; f *= 2; } return sum / n; }
const fbm1 = (x, s, o) => fbm2(x, 0.137, s, o);

// args
const seed = parseInt(process.argv[2] || '1', 10), out = process.argv[3] || '/tmp/weird.png';
const soft = +(process.argv[4] || 2.6), warp = +(process.argv[5] || 165), wf = 1 / +(process.argv[6] || 150), hf = 1 / +(process.argv[7] || 200), amp = +(process.argv[8] || 120), C = +(process.argv[9] || 26);

const bias = +(process.argv[10] || 55);          // + = more solid mass (the reference is a big red mass)
const midY = H * 0.40;
const surfaceY = (x) => midY + amp * (fbm1(x * hf, seed, 4) - 0.5) * 2;
// soft<vertical-gradient lets the 2D warp fold the surface -> overhangs/caves; positive = solid (red)
const F = (x, y) => (y - surfaceY(x)) / soft + warp * (fbm2(x * wf, y * wf, seed + 777, 2) - 0.5) * 2 + bias;

// ── marching squares -> boundary segments (linear interp -> straight angular edges) ──
function segments() {
  const x0 = -60, y0 = -60, x1 = W + 60, y1 = H + 90;
  const nx = Math.ceil((x1 - x0) / C), ny = Math.ceil((y1 - y0) / C);
  // Force the outer ring to SKY so every solid region closes into a loop OFF-SCREEN (the mass touches
  // the frame; without this the contour is an open curve and even-odd fill leaves the mass empty).
  const val = []; for (let i = 0; i <= nx; i++) { val[i] = []; for (let j = 0; j <= ny; j++) val[i][j] = (i === 0 || i === nx || j === 0 || j === ny) ? -100 : F(x0 + i * C, y0 + j * C); }
  const ip = (xa, ya, va, xb, yb, vb) => { const t = va / (va - vb); return { x: xa + (xb - xa) * t, y: ya + (yb - ya) * t }; };
  const segs = [];
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
    const x = x0 + i * C, y = y0 + j * C, bl = val[i][j], br = val[i + 1][j], tr = val[i + 1][j + 1], tl = val[i][j + 1];
    const c = (bl > 0 ? 1 : 0) | (br > 0 ? 2 : 0) | (tr > 0 ? 4 : 0) | (tl > 0 ? 8 : 0);
    if (c === 0 || c === 15) continue;
    const eb = () => ip(x, y, bl, x + C, y, br), er = () => ip(x + C, y, br, x + C, y + C, tr), et = () => ip(x + C, y + C, tr, x, y + C, tl), el = () => ip(x, y + C, tl, x, y, bl);
    switch (c) {
      case 1: case 14: segs.push([el(), eb()]); break;
      case 2: case 13: segs.push([eb(), er()]); break;
      case 3: case 12: segs.push([el(), er()]); break;
      case 4: case 11: segs.push([er(), et()]); break;
      case 6: case 9: segs.push([eb(), et()]); break;
      case 7: case 8: segs.push([el(), et()]); break;
      case 5: segs.push([el(), et()]); segs.push([eb(), er()]); break;
      case 10: segs.push([eb(), el()]); segs.push([et(), er()]); break;
    }
  }
  return segs;
}

// ── render: scanline even-odd fill using the F field directly (per-pixel solid test gives crisp angular
//    edges because the field crossing is linear-ish at the coarse scale; we sample at the marching grid
//    so plates read faceted). Simpler + robust: fill per pixel by F>0, but quantize x,y to the grid so
//    edges are straight. ──
const px = Buffer.alloc(W * H * 3);
const sky = [158, 176, 168], skyTop = [191, 201, 191], solid = [0xc6, 0x46, 0x2e], lip = [0xd8, 0x6a, 0x4c];
function hex(c) { c = c.replace('#', ''); return [parseInt(c.slice(0, 2), 16), parseInt(c.slice(2, 4), 16), parseInt(c.slice(4, 6), 16)]; }
// sky gradient
for (let y = 0; y < H; y++) { const sc = [Math.round(L(skyTop[0], sky[0], y / H)), Math.round(L(skyTop[1], sky[1], y / H)), Math.round(L(skyTop[2], sky[2], y / H))]; for (let x = 0; x < W; x++) { const o = (y * W + x) * 3; px[o] = sc[0]; px[o + 1] = sc[1]; px[o + 2] = sc[2]; } }
// ── marching squares -> chain LOOPS -> Douglas-Peucker simplify -> few long clean facets ──
const EPS = +(process.argv[11] || 16);          // simplification tolerance: bigger = fewer angles
function chainLoops(segs) {
  const key = (p) => Math.round(p.x * 2) / 2 + ',' + Math.round(p.y * 2) / 2;
  const adj = new Map();
  segs.forEach((s, i) => { for (const e of [0, 1]) { const k = key(s[e]); if (!adj.has(k)) adj.set(k, []); adj.get(k).push(i); } });
  const used = new Array(segs.length).fill(false), loops = [];
  for (let i = 0; i < segs.length; i++) {
    if (used[i]) continue;
    used[i] = true; const loop = [segs[i][0]]; let next = segs[i][1], guard = 0;
    while (guard++ < 200000) {
      loop.push(next); const k = key(next); const cands = adj.get(k) || []; let f = -1;
      for (const ci of cands) if (!used[ci]) { f = ci; break; }
      if (f < 0) break; used[f] = true;
      const sg = segs[f]; next = (key(sg[0]) === k) ? sg[1] : sg[0];
      if (key(next) === key(loop[0])) break;
    }
    if (loop.length >= 3) loops.push(loop);
  }
  return loops;
}
function perp(p, a, b) { const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1; return Math.abs((p.x - a.x) * dy - (p.y - a.y) * dx) / l; }
function simplify(pts, eps) {
  if (pts.length < 4) return pts;
  const keep = new Array(pts.length).fill(false); keep[0] = keep[pts.length - 1] = true;
  const st = [[0, pts.length - 1]];
  while (st.length) { const [s, e] = st.pop(); let dm = 0, idx = -1; for (let i = s + 1; i < e; i++) { const d = perp(pts[i], pts[s], pts[e]); if (d > dm) { dm = d; idx = i; } } if (dm > eps && idx > 0) { keep[idx] = true; st.push([s, idx], [idx, e]); } }
  return pts.filter((_, i) => keep[i]);
}
const rawLoops = chainLoops(segments());
const loops = rawLoops.map((l) => simplify(l, EPS)).filter((l) => l.length >= 3);
let facetCount = 0; for (const l of loops) facetCount += l.length;
// even-odd scanline fill over ALL simplified loop edges (caves become holes correctly)
const allEdges = []; for (const l of loops) for (let i = 0; i < l.length; i++) allEdges.push([l[i], l[(i + 1) % l.length]]);
for (let y = 0; y < H; y++) {
  const yc = y + 0.5, xs = [];
  for (const e of allEdges) { const a = e[0], b = e[1]; if ((a.y <= yc && b.y > yc) || (b.y <= yc && a.y > yc)) xs.push(a.x + (b.x - a.x) * (yc - a.y) / (b.y - a.y)); }
  xs.sort((p, q) => p - q);
  for (let k = 0; k + 1 < xs.length; k += 2) { const xa = Math.max(0, Math.ceil(xs[k])), xb = Math.min(W - 1, Math.floor(xs[k + 1])); for (let x = xa; x <= xb; x++) { const o = (y * W + x) * 3; px[o] = solid[0]; px[o + 1] = solid[1]; px[o + 2] = solid[2]; } }
}

// PNG
function crc32(b) { let c = ~0; for (let i = 0; i < b.length; i++) { c ^= b[i]; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xEDB88320 & -(c & 1)); } return ~c >>> 0; }
function ch(t, d) { const l = Buffer.alloc(4); l.writeUInt32BE(d.length, 0); const ty = Buffer.from(t); const cr = Buffer.alloc(4); cr.writeUInt32BE(crc32(Buffer.concat([ty, d])), 0); return Buffer.concat([l, ty, d, cr]); }
const ih = Buffer.alloc(13); ih.writeUInt32BE(W, 0); ih.writeUInt32BE(H, 4); ih[8] = 8; ih[9] = 2;
const raw = Buffer.alloc(H * (W * 3 + 1)); for (let y = 0; y < H; y++) { raw[y * (W * 3 + 1)] = 0; px.copy(raw, y * (W * 3 + 1) + 1, y * W * 3, (y + 1) * W * 3); }
fs.writeFileSync(out, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), ch('IHDR', ih), ch('IDAT', zlib.deflateSync(raw, { level: 9 })), ch('IEND', Buffer.alloc(0))]));
// overhang metric
let over = 0; for (let x = 0; x < W; x += 3) { let runs = 0, prev = false; for (let y = 0; y < H; y += 2) { const s = F(x, y) > 0; if (s && !prev) runs++; prev = s; } if (runs > 1) over++; }
console.log(`wrote ${out} seed=${seed} loops=${loops.length} facets=${facetCount} overhangCols=${over}`);
