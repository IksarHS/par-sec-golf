// ── fxlab.js — PARTICLE LAB ──────────────────────────────────────────────────
// August's tuning tool for the LANDING-DEBRIS puff (src/roguelike/fx.js). It drives the
// REAL engine ball over a test slope so impacts fire continuously, and live-tunes
// RG_FX.params (scale / intensity / lift / lifetime / brightness) so the puff can be
// dialed until it READS CLEARLY — especially running INTO an upslope, where the shipped
// puff gets lost in the hill. Values are copy-pasteable from the readout straight into
// src/roguelike/fx.js `params`. Mirrors physlab.js's setup (same engine files, own loop).
(function () {
  'use strict';

  // RG_FX's contact-detection guards on window.RG (the roguelike layer) existing. The lab
  // has no roguelike, so stub a minimal RG → RG_FX.draw detects land/bounce + spawns.
  window.RG = window.RG || { active: true, _simulating: false };
  window.HOLE_OVERRIDES_ENABLED = false;

  // ── Test terrains (verts in world space; ball is hit RIGHT into the rising hill) ──
  const TEE_X = 90, GROUND_Y = 360;
  function buildFlat() {
    const v = [];
    for (let x = 20; x <= 760; x += 30) v.push({ x, y: GROUND_Y, mat: 'sand' });
    return { verts: v, teeX: TEE_X, teeY: GROUND_Y, cupX: 640, fireAngle: -18, firePower: 0.52 };
  }
  function buildUpslope() {
    const v = [];
    for (let x = 20; x <= 220; x += 30) v.push({ x, y: GROUND_Y, mat: 'grass' });   // flat tee
    for (let x = 250; x <= 760; x += 30) {                                          // rising slope
      const t = (x - 220) / (760 - 220);
      v.push({ x, y: GROUND_Y - t * 200, mat: 'grass' });
    }
    return { verts: v, teeX: TEE_X, teeY: GROUND_Y, cupX: 690, fireAngle: -34, firePower: 0.62 };
  }
  function buildSteep() {
    const v = [];
    for (let x = 20; x <= 200; x += 30) v.push({ x, y: GROUND_Y, mat: 'rock' });
    for (let x = 230; x <= 760; x += 24) {
      const t = (x - 200) / (760 - 200);
      v.push({ x, y: GROUND_Y - t * 330, mat: 'rock' });
    }
    return { verts: v, teeX: TEE_X, teeY: GROUND_Y, cupX: 710, fireAngle: -44, firePower: 0.72 };
  }
  const TERRAINS = [
    { id: 'upslope', label: 'UPSLOPE', build: buildUpslope },
    { id: 'steep',   label: 'STEEP',   build: buildSteep },
    { id: 'flat',    label: 'FLAT',    build: buildFlat },
  ];
  let terrainIdx = 0;
  let fireAngleDeg = -34, firePower01 = 0.62;

  // ── Cup carving (mirrors physlab / level-design.js placeCup, on OUR verts) ──
  let _matAtVerts = [];
  function matAt(x) { let m = 'sand'; for (const v of _matAtVerts) { if (v.x <= x) m = v.mat || 'sand'; else break; } return m; }
  function carveCup(cupX) {
    const halfW = CUP_WIDTH / 2, leftX = cupX - halfW, rightX = cupX + halfW;
    const rimY = (terrainYAt(leftX) + terrainYAt(rightX)) / 2;
    const flatMargin = 20, wallInset = 3, bottomY = rimY + CUP_DEPTH;
    vertices = vertices.filter(v => v.x < leftX - flatMargin || v.x > rightX + flatMargin);
    const cupVerts = [
      { x: leftX - flatMargin, y: rimY, mat: matAt(leftX) }, { x: leftX, y: rimY, mat: matAt(leftX) },
      { x: leftX + wallInset, y: bottomY, mat: matAt(leftX) }, { x: rightX - wallInset, y: bottomY, mat: matAt(rightX) },
      { x: rightX, y: rimY, mat: matAt(rightX) }, { x: rightX + flatMargin, y: rimY, mat: matAt(rightX) },
    ];
    let i = vertices.findIndex(v => v.x >= leftX - flatMargin); if (i === -1) i = vertices.length;
    vertices.splice(i, 0, ...cupVerts);
    holes.length = 0;
    holes.push({ cupX, cupY: rimY, cupLeftX: leftX, cupLeftY: rimY, cupRightX: rightX, cupRightY: rimY,
      cupBottomY: bottomY, cupWallInset: wallInset, cupFilled: false, cupFillProgress: 0,
      flagHole: 1, flagVisible: true, flagOpacity: 1, teeX: TEE_X, teeY: GROUND_Y });
  }

  function loadTerrain(idx) {
    terrainIdx = ((idx % TERRAINS.length) + TERRAINS.length) % TERRAINS.length;
    const def = TERRAINS[terrainIdx].build();
    fireAngleDeg = def.fireAngle; firePower01 = def.firePower;
    vertices = def.verts.map(v => ({ x: v.x, y: v.y, mat: v.mat || 'sand' }));
    _matAtVerts = vertices.map(v => ({ x: v.x, mat: v.mat }));
    holes.length = 0; objects.length = 0; currentHole = 0;
    carveCup(def.cupX);
    const h = holes[0]; h.teeX = def.teeX; h.teeY = def.teeY;
    reTee();
    try { showTitle = false; } catch (e) {}   // hide the engine's planet-name title over the lab HUD
    setHoleCamera(h);
    if (refreshTerrainBtns) refreshTerrainBtns();
  }

  function reTee() {
    const h = holes[0];
    if (h.cupFilled) { h.cupFilled = false; h.cupFillProgress = 0; }
    ball.x = h.teeX; ball.y = terrainYAt(h.teeX) - BALL_RADIUS;
    ball.vx = 0; ball.vy = 0; ball.atRest = true; ball.onGround = false;
    ball.spinRate = 0; ball.rotation = 0; ball.lastCollidedMat = null;
    if (typeof ball.slowFrames !== 'undefined') ball.slowFrames = 0;
    state = STATE_AIM; strokes = 0;
  }
  function fireShot() {
    reTee();
    const power = Math.min(firePower01 * MAX_POWER, MAX_POWER);
    const a = fireAngleDeg * Math.PI / 180;
    ball.vx = Math.cos(a) * power; ball.vy = Math.sin(a) * power;
    ball.atRest = false; ball.onGround = false;
    if (typeof ball.slowFrames !== 'undefined') ball.slowFrames = 0;
    if (typeof ball.flightFrames !== 'undefined') ball.flightFrames = 0;
    ball.spinRate = 0; state = STATE_FLIGHT;
  }

  // ── Particle knobs (RG_FX.params) ──
  const P = (window.RG_FX && RG_FX.params) || {};
  if (!P.mat) P.mat = { sand: 1, grass: 1, ice: 1, rock: 1, mud: 1, water: 1, dust: 1, regolith: 1 };
  const DEFAULTS = Object.assign({}, P); DEFAULTS.mat = Object.assign({}, P.mat);  // deep-copy mat so RESET restores it
  const MAT_LIST = ['sand', 'grass', 'ice', 'rock', 'mud'];
  const FX_KNOBS = [
    { k: 'count',     label: 'COUNT ×',      min: 0.2, max: 6,    step: 0.1 },
    { k: 'size',      label: 'SIZE ×',       min: 0.5, max: 6,    step: 0.1 },
    { k: 'speed',     label: 'SPEED ×',      min: 0.5, max: 4,    step: 0.1 },
    { k: 'spread',    label: 'SPREAD ×',     min: 0.3, max: 3,    step: 0.1 },
    { k: 'up',        label: 'UP-ANGLE',     min: 0.1, max: 0.5,  step: 0.01 },
    { k: 'grav',      label: 'GRAVITY ×',    min: 0.2, max: 2,    step: 0.05 },
    { k: 'fade',      label: 'LIFETIME ×',   min: 0.3, max: 5,    step: 0.1 },
    { k: 'minImpact', label: 'MIN IMPACT',   min: 0.2, max: 5,    step: 0.1 },
    { k: 'bright',    label: 'BRIGHTNESS +', min: 0,   max: 0.6,  step: 0.02 },
  ];

  // ── Panel ──
  const panel = document.createElement('div'); panel.id = 'fxlab-panel'; document.body.appendChild(panel);
  const style = document.createElement('style');
  style.textContent = `
    #fxlab-panel{position:fixed;top:0;right:0;height:100vh;width:300px;z-index:20;
      background:rgba(10,12,20,0.92);border-left:1px solid rgba(184,140,255,0.28);
      color:#e8e2ff;font:12px 'Departure Mono',monospace;overflow-y:auto;padding:12px 14px 28px;backdrop-filter:blur(3px);}
    #fxlab-panel h1{font-size:14px;letter-spacing:3px;color:#fff;margin:0 0 2px;font-weight:normal}
    #fxlab-panel .sub{font-size:10px;color:#8f86b8;margin-bottom:12px;letter-spacing:1px}
    #fxlab-panel .grp{font-size:10px;letter-spacing:2px;color:#b88cff;margin:14px 0 6px;border-bottom:1px solid rgba(184,140,255,0.18);padding-bottom:3px}
    #fxlab-panel .knob{margin:8px 0}
    #fxlab-panel .knob .row{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:2px}
    #fxlab-panel .knob .lbl{color:#c9c2e8;font-size:11px}
    #fxlab-panel .knob .val{color:#ffe08a;font-size:11px}
    #fxlab-panel input[type=range]{width:100%;height:14px;-webkit-appearance:none;appearance:none;background:transparent;cursor:pointer;margin:0}
    #fxlab-panel input[type=range]::-webkit-slider-runnable-track{height:3px;background:rgba(184,140,255,0.25);border-radius:2px}
    #fxlab-panel input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:13px;height:13px;margin-top:-5px;border-radius:50%;background:#e8c840;border:1px solid #0c0e14}
    #fxlab-panel input[type=range]::-moz-range-thumb{width:13px;height:13px;border-radius:50%;background:#e8c840;border:1px solid #0c0e14}
    #fxlab-panel .btnrow{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0}
    #fxlab-panel button{font:11px 'Departure Mono',monospace;background:rgba(184,140,255,0.12);color:#e8e2ff;border:1px solid rgba(184,140,255,0.32);border-radius:4px;padding:6px 10px;cursor:pointer}
    #fxlab-panel button:hover{background:rgba(184,140,255,0.24)}
    #fxlab-panel button.on{background:#e8c840;color:#221a06;border-color:#e8c840}
    #fxlab-panel textarea{width:100%;height:130px;margin-top:6px;background:#07080d;color:#9fe0b0;border:1px solid rgba(184,140,255,0.25);border-radius:4px;font:11px 'Departure Mono',monospace;padding:6px;resize:vertical;white-space:pre;overflow:auto}
    #fxlab-hint{position:fixed;left:14px;bottom:12px;z-index:20;font:11px 'Departure Mono',monospace;color:rgba(232,236,255,0.62);text-shadow:0 1px 4px #000;pointer-events:none}
  `;
  document.head.appendChild(style);
  const hint = document.createElement('div'); hint.id = 'fxlab-hint';
  hint.textContent = 'AUTO fires the ball into the hill on a loop · B = burst now · 1/2/3 terrain · H hide';
  document.body.appendChild(hint);

  const sliderEls = {}; let readoutEl = null; let refreshTerrainBtns = null; let autoBtnEl = null;
  let auto = true, autoTimer = 0;   // declared before buildPanel() (it reads `auto`)
  const fmt = (n) => (Math.abs(n) >= 1 ? n.toFixed(2) : n.toFixed(3));
  function knobRow(parent, label, get, set, min, max, step, id) {
    const wrap = document.createElement('div'); wrap.className = 'knob';
    const row = document.createElement('div'); row.className = 'row';
    const lbl = document.createElement('span'); lbl.className = 'lbl'; lbl.textContent = label;
    const val = document.createElement('span'); val.className = 'val'; row.appendChild(lbl); row.appendChild(val);
    const inp = document.createElement('input'); inp.type = 'range'; inp.min = min; inp.max = max; inp.step = step; inp.value = get();
    const refresh = () => { val.textContent = fmt(get()); };
    inp.addEventListener('input', () => { set(parseFloat(inp.value)); refresh(); writeReadout(); });
    wrap.appendChild(row); wrap.appendChild(inp); parent.appendChild(wrap);
    sliderEls[id] = { input: inp, refresh }; refresh();
  }

  function buildPanel() {
    panel.innerHTML = '';
    const h1 = document.createElement('h1'); h1.textContent = 'PARTICLE LAB'; panel.appendChild(h1);
    const sub = document.createElement('div'); sub.className = 'sub'; sub.textContent = 'PAR SEC · landing puff (fx.js)'; panel.appendChild(sub);

    const tRow = document.createElement('div'); tRow.className = 'btnrow';
    TERRAINS.forEach((t, i) => { const b = document.createElement('button'); b.textContent = t.label;
      b.className = (i === terrainIdx) ? 'on' : ''; b._i = i; b.onclick = () => { loadTerrain(i); }; tRow.appendChild(b); });
    panel.appendChild(tRow);
    refreshTerrainBtns = () => { Array.from(tRow.children).forEach(b => b.className = (b._i === terrainIdx) ? 'on' : ''); };

    const aRow = document.createElement('div'); aRow.className = 'btnrow';
    autoBtnEl = document.createElement('button'); autoBtnEl.textContent = '▶ AUTO-FIRE'; autoBtnEl.className = auto ? 'on' : '';
    autoBtnEl.onclick = () => { auto = !auto; autoBtnEl.className = auto ? 'on' : ''; if (auto) autoTimer = 0; };
    const burstBtn = document.createElement('button'); burstBtn.textContent = '💥 BURST (B)'; burstBtn.onclick = burstNow;
    const reBtn = document.createElement('button'); reBtn.textContent = 'RE-FIRE'; reBtn.onclick = fireShot;
    aRow.appendChild(autoBtnEl); aRow.appendChild(burstBtn); aRow.appendChild(reBtn); panel.appendChild(aRow);

    const rRow = document.createElement('div'); rRow.className = 'btnrow';
    const resetB = document.createElement('button'); resetB.textContent = 'RESET TO SHIPPED'; resetB.onclick = resetKnobs;
    rRow.appendChild(resetB); panel.appendChild(rRow);

    const gh = document.createElement('div'); gh.className = 'grp'; gh.textContent = 'PARTICLE KNOBS'; panel.appendChild(gh);
    FX_KNOBS.forEach(kn => knobRow(panel, kn.label, () => P[kn.k], (v) => { P[kn.k] = v; }, kn.min, kn.max, kn.step, kn.k));

    const ghm = document.createElement('div'); ghm.className = 'grp'; ghm.textContent = 'PER-MATERIAL DEBRIS ×'; panel.appendChild(ghm);
    MAT_LIST.forEach(m => knobRow(panel, m.toUpperCase(), () => P.mat[m], (v) => { P.mat[m] = v; }, 0, 4, 0.1, 'mat.' + m));

    const gh2 = document.createElement('div'); gh2.className = 'grp'; gh2.textContent = 'READOUT (copy → src/roguelike/fx.js params)'; panel.appendChild(gh2);
    readoutEl = document.createElement('textarea'); readoutEl.readOnly = true; panel.appendChild(readoutEl);
    writeReadout();
  }
  function writeReadout() {
    if (!readoutEl) return;
    const t = (n) => parseFloat(Number(n).toFixed(3));
    let s = 'const params = {\n';
    FX_KNOBS.forEach(kn => { s += '  ' + kn.k + ': ' + t(P[kn.k]) + ',\n'; });
    s += '  mat: { ' + Object.keys(P.mat).map(m => m + ': ' + t(P.mat[m])).join(', ') + ' },\n';
    s += '};';
    readoutEl.value = s;
  }
  function syncSliders() {
    for (const id in sliderEls) {
      const v = (id.indexOf('mat.') === 0) ? P.mat[id.slice(4)] : P[id];
      sliderEls[id].input.value = v; sliderEls[id].refresh();
    }
  }
  function resetKnobs() { Object.assign(P, DEFAULTS); P.mat = Object.assign({}, DEFAULTS.mat); syncSliders(); writeReadout(); }
  function burstNow() { if (window.RG_FX && RG_FX._burst) { if (ball) ball.vx = ball.vx || 4; RG_FX._burst(matAt(ball.x), 12); } }
  buildPanel();

  window.addEventListener('keydown', (e) => {
    const tag = e.target && e.target.tagName; if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    if (e.key === 'h' || e.key === 'H') { panel.style.display = (panel.style.display === 'none') ? '' : 'none'; }
    else if (e.key === 'b' || e.key === 'B') { burstNow(); }
    else if (e.key === ' ') { e.preventDefault(); fireShot(); }
    else if (e.key === '1') loadTerrain(0);
    else if (e.key === '2') loadTerrain(1);
    else if (e.key === '3') loadTerrain(2);
  });

  // ── Lab HUD ──
  function drawLabHUD() {
    ctx.save(); ctx.scale(displayScale, displayScale); ctx.textAlign = 'left';
    ctx.font = "13px 'Departure Mono', monospace"; ctx.fillStyle = 'rgba(242,236,255,0.85)';
    ctx.fillText('PARTICLE LAB · ' + TERRAINS[terrainIdx].label, 18, 26);
    ctx.font = "11px 'Departure Mono', monospace"; ctx.fillStyle = 'rgba(184,140,255,0.85)';
    ctx.fillText('live chunks: ' + (RG_FX._count ? RG_FX._count() : '?') + '   ' + (auto ? 'AUTO-FIRING' : 'paused'), 18, 44);
    ctx.restore();
  }

  // ── Loop (engine update + draw, then particles in the SAME world transform, then HUD) ──
  function frame() {
    if (auto) {
      update();
      if (ball.atRest) { autoTimer++; if (autoTimer > 36) { autoTimer = 0; fireShot(); } } else autoTimer = 0;
    }
    draw();
    // particles draw in WORLD space — same prelude art.js uses (scale → applyCameraTransform)
    if (window.RG_FX) { ctx.save(); ctx.scale(displayScale, displayScale); MODE.applyCameraTransform(ctx); RG_FX.draw(ctx); ctx.restore(); }
    drawLabHUD();
    requestAnimationFrame(frame);
  }

  // headless helpers
  window.__fx = { burst: burstNow, fire: fireShot, terrain: loadTerrain, params: P, setAuto: (v) => { auto = !!v; } };

  loadTerrain(0);
  frame();
})();
