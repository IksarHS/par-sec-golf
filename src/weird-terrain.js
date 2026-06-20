// ── weird-terrain.js — TRUE 2D polygon terrain (Golf-on-Mars look): big angular interlocking plates,
// sky carved between & under them = real overhangs + caves (ref score 351 / 134). NOT a heightfield.
// Pipeline: a 2D scalar field F (F>0 = solid) → marching squares → chain closed loops → Douglas-Peucker
// SIMPLIFY into a FEW long clean facets (so the ball rolls predictably, not on cell-scale jaggies) →
// those same simplified loops drive BOTH the render (cached even-odd fill) and the collision (swept
// ball-vs-facet). vertices[] holds the top surface for terrainYAt/tee/OOB. Continuous course-wide field;
// drama scales with weirdTier. Wired behind gen:'weird' (level-design + desert-golfing branches).

function _wh(xi, yi, s) { let h = (Math.imul(xi, 374761393) + Math.imul(yi, 668265263) + Math.imul(s, 2246822519)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
const _wsm = (t) => t * t * (3 - 2 * t), _wL = (a, b, t) => a + (b - a) * t;
function _wvn(x, y, s) { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = _wsm(xf), v = _wsm(yf); return _wL(_wL(_wh(xi, yi, s), _wh(xi + 1, yi, s), u), _wL(_wh(xi, yi + 1, s), _wh(xi + 1, yi + 1, s), u), v); }
function _wfbm(x, y, s, o) { let a = 0.5, f = 1, sum = 0, n = 0; for (let i = 0; i < o; i++) { sum += a * _wvn(x * f, y * f, s + i * 1013); n += a; a *= 0.5; f *= 2; } return sum / n; }

let WEIRD = null;
function _weirdInit() {
  const tier = (currentCourse && currentCourse.weirdTier) || 1, seed = (getSeed() | 0) >>> 0;
  // locked from the proto (CLO_e22); scale with tier
  const warp = [0, 195, 215, 245][tier], amp = [0, 155, 170, 190][tier], soft = [0, 2.75, 2.95, 3.15][tier];
  const wf = 1 / [0, 245, 232, 220][tier], hf = 1 / 270, bias = [0, 6, 0, -8][tier];
  const eps = [0, 20, 18, 16][tier], cell = 30, midY = H * 0.42;
  WEIRD = { tier, seed, warp, amp, soft, wf, hf, bias, eps, cell, midY, cups: [], baseSurf: (x) => midY + amp * (_wfbm(x * hf, 0.137, seed, 4) - 0.5) * 2 };
}
function _surfY(x) {
  let y = WEIRD.baseSurf(x);
  for (const c of WEIRD.cups) {
    const d = Math.abs(x - c.x);
    if (d < c.flat) { const t = d <= c.dead ? 1 : 1 - (d - c.dead) / (c.flat - c.dead); y = _wL(y, c.greenY, _wsm(Math.max(0, Math.min(1, t)))); }   // dead-flat green pad, then ease out
  }
  return y;
}
function _F(x, y) {
  let f = (y - _surfY(x)) / WEIRD.soft + WEIRD.warp * (_wfbm(x * WEIRD.wf, y * WEIRD.wf, WEIRD.seed + 777, 2) - 0.5) * 2 + WEIRD.bias;
  const floor = y - H * 0.85; if (floor > 0) f += floor * 1.8;     // seal the bottom → ball always lands on a floor (no OOB through chasms)
  return f;
}
// topmost LANDABLE ground at x — the first solid run ≥18px thick (skips thin overhang lips so the tee
// and terrainYAt match where the ball actually rests).
function _topSolid(x) { let run = -1; for (let y = H * 0.03; y < H * 1.08; y += 3) { if (_F(x, y) > 0) { if (run < 0) run = y; if (y - run >= 18) return run; } else run = -1; } return run >= 0 ? run : H * 1.04; }

// ── marching squares over [x0,x1]×[y0,y1] (outer ring forced SKY so masses close off-screen) → segments ──
function _segments(x0, y0, x1, y1, C) {
  const nx = Math.ceil((x1 - x0) / C), ny = Math.ceil((y1 - y0) / C), val = [];
  for (let i = 0; i <= nx; i++) { val[i] = []; for (let j = 0; j <= ny; j++) val[i][j] = (i === 0 || i === nx || j === 0 || j === ny) ? -100 : _F(x0 + i * C, y0 + j * C); }
  const ip = (xa, ya, va, xb, yb, vb) => ({ x: xa + (xb - xa) * (va / (va - vb)), y: ya + (yb - ya) * (va / (va - vb)) });
  const segs = [];
  for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
    const x = x0 + i * C, y = y0 + j * C, bl = val[i][j], br = val[i + 1][j], tr = val[i + 1][j + 1], tl = val[i][j + 1];
    const c = (bl > 0 ? 1 : 0) | (br > 0 ? 2 : 0) | (tr > 0 ? 4 : 0) | (tl > 0 ? 8 : 0); if (c === 0 || c === 15) continue;
    const eb = () => ip(x, y, bl, x + C, y, br), er = () => ip(x + C, y, br, x + C, y + C, tr), et = () => ip(x + C, y + C, tr, x, y + C, tl), el = () => ip(x, y + C, tl, x, y, bl);
    switch (c) {
      case 1: case 14: segs.push([el(), eb()]); break; case 2: case 13: segs.push([eb(), er()]); break;
      case 3: case 12: segs.push([el(), er()]); break; case 4: case 11: segs.push([er(), et()]); break;
      case 6: case 9: segs.push([eb(), et()]); break; case 7: case 8: segs.push([el(), et()]); break;
      case 5: segs.push([el(), et()]); segs.push([eb(), er()]); break;
      case 10: segs.push([eb(), el()]); segs.push([et(), er()]); break;
    }
  }
  return segs;
}
function _chain(segs) {
  const key = (p) => Math.round(p.x * 2) / 2 + ',' + Math.round(p.y * 2) / 2, adj = new Map();
  segs.forEach((s, i) => { for (const e of [0, 1]) { const k = key(s[e]); if (!adj.has(k)) adj.set(k, []); adj.get(k).push(i); } });
  const used = new Array(segs.length).fill(false), loops = [];
  for (let i = 0; i < segs.length; i++) {
    if (used[i]) continue; used[i] = true; const loop = [segs[i][0]]; let next = segs[i][1], g = 0;
    while (g++ < 100000) { loop.push(next); const k = key(next); const cs = adj.get(k) || []; let f = -1; for (const ci of cs) if (!used[ci]) { f = ci; break; } if (f < 0) break; used[f] = true; const sg = segs[f]; next = (key(sg[0]) === k) ? sg[1] : sg[0]; if (key(next) === key(loop[0])) break; }
    if (loop.length >= 3) loops.push(loop);
  }
  return loops;
}
function _perp(p, a, b) { const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1; return Math.abs((p.x - a.x) * dy - (p.y - a.y) * dx) / l; }
function _simplify(pts, eps) {
  if (pts.length < 4) return pts;
  const keep = new Array(pts.length).fill(false); keep[0] = keep[pts.length - 1] = true; const st = [[0, pts.length - 1]];
  while (st.length) { const [s, e] = st.pop(); let dm = 0, idx = -1; for (let i = s + 1; i < e; i++) { const d = _perp(pts[i], pts[s], pts[e]); if (d > dm) { dm = d; idx = i; } } if (dm > eps && idx > 0) { keep[idx] = true; st.push([s, idx], [idx, e]); } }
  return pts.filter((_, i) => keep[i]);
}
// edges with sky-facing normals (oriented via the field gradient — robust for both masses and caves)
function _loopEdges(loop) {
  const edges = [];
  for (let i = 0; i < loop.length; i++) {
    const a = loop[i], b = loop[(i + 1) % loop.length], ex = b.x - a.x, ey = b.y - a.y, len = Math.hypot(ex, ey); if (len < 0.01) continue;
    let nx = ey / len, ny = -ex / len;
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    const gx = _F(mx + 2.5, my) - _F(mx - 2.5, my), gy = _F(mx, my + 2.5) - _F(mx, my - 2.5);   // ∇F (into solid)
    if (nx * gx + ny * gy > 0) { nx = -nx; ny = -ny; }                                            // make normal point to SKY
    edges.push({ ax: a.x, ay: a.y, bx: b.x, by: b.y, nx, ny, len });
  }
  return edges;
}

function generateWeirdHole(holeIndex) {
  if (!WEIRD) _weirdInit();
  let teeX, teeY;
  if (holeIndex === 0) { teeX = 130; teeY = _topSolid(teeX); if (vertices.length === 0) vertices.push({ x: -200, y: teeY, mat: 'grass' }); }
  else { teeX = holes[holeIndex - 1].cupX; teeY = holes[holeIndex - 1].cupY; }

  const difficulty = getDifficulty(holeIndex);
  const effW = Math.max(960, W), maxDist = (typeof window !== 'undefined' && window.RG && window.RG._holeDistCap) ? window.RG._holeDistCap : (effW - 190);
  const dMin = currentCourse.holeDistMin != null ? currentCourse.holeDistMin : 480, dMax = currentCourse.holeDistMax != null ? currentCourse.holeDistMax : 800;
  const dist = Math.min(dMin + random() * (dMax - dMin) + difficulty * 60, maxDist);
  const cupX = teeX + dist, greenY = _topSolid(cupX);                     // landable ground (not a thin lip)
  WEIRD.cups.push({ x: cupX, greenY, flat: 115, dead: 52 });              // dead-flat green PAD around the cup

  // build the hole's polygon terrain (window wider than a screen so closures are off-screen)
  const x0 = teeX - 200, x1 = cupX + 280, y0 = -70, y1 = H + 100;
  const loops = _chain(_segments(x0, y0, x1, y1, WEIRD.cell)).map((l) => _simplify(l, WEIRD.eps)).filter((l) => l.length >= 3);
  // RENDER loops stay FLAT at the cup (clean green); the cup divot + fill + rise is drawn dynamically by
  // the engine (drawCupHoleDG/drawCupFill/drawFlag), exactly like the original. COLLISION uses a notched
  // copy so the ball physically drops into the hole.
  const colLoops = loops.map((l) => l.map((p) => ({ x: p.x, y: p.y })));
  _spliceCup(colLoops, cupX, greenY);

  // top-surface vertices[] (for terrainYAt / tee / OOB)
  vertices = vertices.filter(v => v.x <= teeX + 6);
  for (let x = teeX + 8; x <= cupX + 160; x += 7) vertices.push({ x, y: clampY(_topSolid(x)), mat: 'grass' });
  let mx = -Infinity; vertices = vertices.filter(v => { if (v.x >= mx - 0.5) { mx = v.x; return true; } return false; });

  const hw = CUP_WIDTH / 2;
  holes[holeIndex] = {
    cupX, cupY: greenY, cupLeftX: cupX - hw, cupLeftY: greenY, cupRightX: cupX + hw, cupRightY: greenY,
    cupBottomY: greenY + CUP_DEPTH, cupFilled: false, cupFillProgress: 0, flagHole: holeIndex + 1,
    flagVisible: true, flagOpacity: 1, teeX, teeY, archetype: 'weird-t' + WEIRD.tier, par: 3,
    _weird: true, _loops: loops, _edges: colLoops.map(_loopEdges), _x0: x0, _x1: x1, _cacheReady: false,
  };
}

// carve a flat green + cup notch into whichever loop's TOP edge spans cupX (so the ball can drop in)
function _spliceCup(loops, cupX, greenY) {
  const hw = CUP_WIDTH / 2;
  let best = null, bestI = -1, bestK = -1, bestDy = 1e9;
  for (let li = 0; li < loops.length; li++) { const lp = loops[li]; for (let k = 0; k < lp.length; k++) { const a = lp[k], b = lp[(k + 1) % lp.length]; if (Math.min(a.x, b.x) <= cupX && Math.max(a.x, b.x) >= cupX) { const ty = a.y + (b.y - a.y) * ((cupX - a.x) / ((b.x - a.x) || 1)); if (_F(cupX, ty + 8) > 0 && _F(cupX, ty - 8) <= 0) { const dy = Math.abs(ty - greenY); if (dy < bestDy) { bestDy = dy; best = lp; bestI = li; bestK = k; } } } } }
  if (!best) return;
  const notch = [{ x: cupX - hw, y: greenY }, { x: cupX - hw + 2, y: greenY + CUP_DEPTH }, { x: cupX + hw - 2, y: greenY + CUP_DEPTH }, { x: cupX + hw, y: greenY }];
  // insert in the edge direction (so winding is preserved)
  const a = best[bestK], b = best[(bestK + 1) % best.length];
  best.splice(bestK + 1, 0, ...(a.x < b.x ? notch : notch.slice().reverse()));
}

// ── SWEPT collision vs the simplified facets (predictable rolling; handles overhangs/caves) ──
function _pointSolid(edges, x, y) { let c = false; for (const arr of edges) for (const e of arr) { if ((e.ay > y) !== (e.by > y)) { const xi = e.ax + (e.bx - e.ax) * (y - e.ay) / (e.by - e.ay); if (x < xi) c = !c; } } return c; }
function _resolve(edges) {
  const BR = BALL_RADIUS, mat = MATERIALS.grass || MATERIALS[DEFAULT_MAT], rest = mat.restitution; let hit = false;
  for (let it = 0; it < 4; it++) {
    let bd = 1e9, bnx = 0, bny = 0;
    for (const arr of edges) for (const e of arr) {
      if (ball.x < Math.min(e.ax, e.bx) - BR || ball.x > Math.max(e.ax, e.bx) + BR) continue;
      const dx = e.bx - e.ax, dy = e.by - e.ay, ls = dx * dx + dy * dy; if (ls < 1e-4) continue;
      let t = ((ball.x - e.ax) * dx + (ball.y - e.ay) * dy) / ls; t = t < 0 ? 0 : t > 1 ? 1 : t;
      const qx = e.ax + t * dx, qy = e.ay + t * dy, ddx = ball.x - qx, ddy = ball.y - qy, d2 = ddx * ddx + ddy * ddy;
      if (d2 < BR * BR) { const d = Math.sqrt(d2) || 0.001; let nx = ddx / d, ny = ddy / d; if (nx * e.nx + ny * e.ny < 0) { nx = e.nx; ny = e.ny; } const pen = BR - d; if (pen < bd) { bd = pen; bnx = nx; bny = ny; } }
    }
    if (bd > 1e8) break;
    ball.x += bnx * (bd + 0.1); ball.y += bny * (bd + 0.1);
    const dot = ball.vx * bnx + ball.vy * bny;
    if (dot < 0) { const g = Math.abs(bny) > Math.abs(bnx); if (g && -dot < BOUNCE_THRESHOLD) { ball.vx -= dot * bnx; ball.vy -= dot * bny; } else { ball.vx -= (1 + rest) * dot * bnx; ball.vy -= (1 + rest) * dot * bny; } }
    ball.lastCollidedMat = 'grass'; if (bny < -0.25) ball.onGround = true; hit = true;
  }
  return hit;
}
function weirdCollide() {
  const h = holes[currentHole]; if (!h || !h._edges) return false;
  const BR = BALL_RADIUS, px = (ball._px != null) ? ball._px : ball.x, py = (ball._py != null) ? ball._py : ball.y;
  const dx = ball.x - px, dy = ball.y - py, dist = Math.hypot(dx, dy);
  if (dist > BR * 0.75 && !_pointSolid(h._edges, ball.x, ball.y)) {     // moved far + ended free → sweep the path
    const steps = Math.ceil(dist / (BR * 0.6));
    for (let s = 1; s <= steps; s++) { const t = s / steps, x = px + dx * t, y = py + dy * t; if (_pointSolid(h._edges, x, y)) { ball.x = x; ball.y = y; return _resolve(h._edges); } }
  }
  return _resolve(h._edges);
}

// ── render: cache the simplified loops to an offscreen canvas once per hole, blit each frame ──
function _weirdBuildCache(h) {
  const x0 = Math.floor(h._x0), x1 = Math.ceil(h._x1), wpx = Math.max(1, x1 - x0);
  const cv = (typeof document !== 'undefined') ? document.createElement('canvas') : null; if (!cv) return;
  cv.width = wpx; cv.height = H; const c2 = cv.getContext('2d');
  const sky = currentCourse.sky || '#9fb0a8', g = c2.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, _lighten(sky, 26)); g.addColorStop(1, sky); c2.fillStyle = g; c2.fillRect(0, 0, wpx, H);
  const mat = MATERIALS.grass || MATERIALS[DEFAULT_MAT];
  c2.fillStyle = mat.color; c2.beginPath();
  for (const lp of h._loops) { c2.moveTo(lp[0].x - x0, lp[0].y); for (let i = 1; i < lp.length; i++) c2.lineTo(lp[i].x - x0, lp[i].y); c2.closePath(); }
  c2.fill('evenodd');
  // a lighter lip along up-facing facet edges (the DG top-edge look)
  c2.strokeStyle = mat.colorLight || _lighten(mat.color, 24); c2.lineWidth = 3;
  for (const arr of (h._edges || [])) for (const e of arr) { if (e.ny < -0.45) { c2.beginPath(); c2.moveTo(e.ax - x0, e.ay + 1.5); c2.lineTo(e.bx - x0, e.by + 1.5); c2.stroke(); } }
  h._weirdCache = cv; h._weirdCacheX0 = x0; h._cacheReady = true;
}
function _lighten(hex, amt) { hex = hex.replace('#', ''); const r = Math.min(255, parseInt(hex.slice(0, 2), 16) + amt), g = Math.min(255, parseInt(hex.slice(2, 4), 16) + amt), b = Math.min(255, parseInt(hex.slice(4, 6), 16) + amt); return 'rgb(' + r + ',' + g + ',' + b + ')'; }
function weirdDraw() {
  const drawH = (h) => { if (!h || !h._weird) return; if (!h._cacheReady) _weirdBuildCache(h); if (h._weirdCache) ctx.drawImage(h._weirdCache, h._weirdCacheX0, 0); };
  if (state === STATE_TRANSITION && currentHole > 0) drawH(holes[currentHole - 1]);
  drawH(holes[currentHole]);
}
