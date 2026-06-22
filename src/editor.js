// src/editor.js — HOLE EDITOR v1. Gated on ?edit in the URL (fully inert otherwise). Runs INSIDE the engine
// (run.html), so terrain/water/objects render with the REAL game art and "Play this hole" IS the real engine.
// v1 scope: drag / add / delete terrain vertices · cup auto-on-flat · JSON export · play-test. (v2: floating
// objects, water, zone-painting, round-trip load.) The editor owns a SPARSE control-vertex set — the engine's
// straight-segment textured terrain renders it directly (faceted courses skip densification).
(function () {
  if (!/[?&]edit\b/.test(location.search)) return;
  var ED = { on: false, mode: 'edit', tool: 'drag', drag: null, lastExport: null, holeIdx: 0, snap: null };
  window.ED = ED;

  function ds() { return canvas.width / W; }
  function camX() { return (typeof camera !== 'undefined') ? camera.x : 0; }
  function camY() { return (typeof camera !== 'undefined') ? (camera.y || 0) : 0; }
  function w2sx(x) { return (x - camX()) * ds(); }
  function w2sy(y) { return (y - camY()) * ds(); }
  function s2w(cx, cy) { return { x: cx / ds() + camX(), y: cy / ds() + camY() }; }
  function evCanvas(e) { var r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) * (canvas.width / r.width), y: (e.clientY - r.top) * (canvas.height / r.height) }; }
  function H_() { return (typeof H !== 'undefined') ? H : 540; }
  function defMat() { return (typeof currentCourse !== 'undefined' && currentCourse && currentCourse.defaultMaterial) || 'grass'; }

  function editVerts() { var a = []; for (var i = 0; i < vertices.length; i++) { var v = vertices[i]; if (v && !v._cup) a.push(v); } return a; }
  function sortV() { vertices.sort(function (a, b) { return a.x - b.x; }); }

  // (re)build the physical cup at cupX, updating holes[holeIdx] IN PLACE (placeCup PUSHES a hole; we can't).
  // Mirrors placeCup: flat rim sampled from the current terrain + a vertical-walled notch, tagged _cup.
  function setCup(cupX) {
    var h = holes[ED.holeIdx]; if (!h) return;
    var halfW = (typeof CUP_WIDTH !== 'undefined' ? CUP_WIDTH : 30) / 2, depth = (typeof CUP_DEPTH !== 'undefined' ? CUP_DEPTH : 28);
    var leftX = cupX - halfW, rightX = cupX + halfW, flatMargin = 20;
    vertices = vertices.filter(function (v) { return !v._cup; });                       // drop the old notch first
    var rimY = (terrainYAt(leftX) + terrainYAt(rightX)) / 2;                             // flat rim from current terrain
    var bottomY = rimY + depth, wallInset = 3;
    vertices = vertices.filter(function (v) { return v.x < leftX - flatMargin || v.x > rightX + flatMargin; });
    [[leftX - flatMargin, rimY], [leftX, rimY], [leftX + wallInset, bottomY], [rightX - wallInset, bottomY], [rightX, rimY], [rightX + flatMargin, rimY]]
      .forEach(function (p) { vertices.push({ x: p[0], y: p[1], _cup: 1 }); });
    sortV();
    h.cupX = cupX; h.cupY = rimY; h.cupLeftX = leftX; h.cupLeftY = rimY; h.cupRightX = rightX; h.cupRightY = rimY;
    h.cupBottomY = bottomY; h.cupWallInset = wallInset; h.cupFilled = false; h.cupFillProgress = 0; h.flagVisible = true; h.flagOpacity = 1;
  }

  function parkBall() {
    var h = holes[ED.holeIdx]; if (!h || typeof ball === 'undefined') return;
    ball.x = h.teeX; ball.y = terrainYAt(h.teeX) - 8; ball.vx = 0; ball.vy = 0; ball.atRest = true; ball.onGround = true; ball.flightFrames = 0;
    if (typeof state !== 'undefined' && typeof STATE_AIM !== 'undefined') state = STATE_AIM;
  }

  function baseline() {
    var h = holes[ED.holeIdx]; if (!h) return;
    var teeX = 140, cupX = 820, teeY = Math.round(H_() * 0.62), m = defMat();
    vertices = [
      { x: 40, y: teeY, mat: m }, { x: teeX, y: teeY, mat: m },
      { x: 300, y: teeY - 24, mat: m }, { x: 470, y: teeY + 14, mat: m },
      { x: 640, y: teeY - 30, mat: m }, { x: cupX - 70, y: teeY, mat: m },
      { x: cupX + 90, y: teeY, mat: m }, { x: 980, y: teeY, mat: m }
    ];
    h.teeX = teeX; h.teeY = teeY; h.archetype = 'editor';
    setCup(cupX);
    if (typeof setHoleCamera === 'function') setHoleCamera(h);
    parkBall();
  }

  // ── overlay (drawn in canvas pixels, identity transform) ──
  function ring(ctx, x, y, r, col, fill) { ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fillStyle = fill || 'rgba(0,0,0,0.4)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = col; ctx.stroke(); }
  function drawOverlay(ctx) {
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    var h = holes[ED.holeIdx];
    if (h) {
      var tx = w2sx(h.teeX), ty = w2sy(terrainYAt(h.teeX)); ring(ctx, tx, ty, 7, '#8de08d'); ctx.fillStyle = '#8de08d'; ctx.font = '11px monospace'; ctx.fillText('TEE', tx - 9, ty - 12);
      var cx = w2sx(h.cupX), cy = w2sy(h.cupY); ring(ctx, cx, cy, 7, '#ffd24a');
    }
    var ev = editVerts();
    for (var i = 0; i < ev.length; i++) { var v = ev[i]; ring(ctx, w2sx(v.x), w2sy(v.y), 5, ED.drag === v ? '#ffffff' : '#7fd0ff'); }
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(8, canvas.height - 26, 372, 20);
    ctx.fillStyle = '#cfe'; ctx.font = '12px monospace'; ctx.fillText('EDIT · tool=' + ED.tool + ' · verts=' + ev.length + ' · drag·add·del·cup', 14, canvas.height - 11);
    ctx.restore();
  }
  function patchDraw() { var o = window.draw; if (!o || o.__edpatched) return; window.draw = function () { o.apply(this, arguments); try { if (ED.on && ED.mode === 'edit') drawOverlay(ctx); } catch (e) {} }; window.draw.__edpatched = 1; }

  function hitVert(cw, cyp) { var ev = editVerts(), best = null, bd = 14 * 14; for (var i = 0; i < ev.length; i++) { var v = ev[i], dx = w2sx(v.x) - cw, dy = w2sy(v.y) - cyp, d = dx * dx + dy * dy; if (d < bd) { bd = d; best = v; } } return best; }

  function onDown(e) {
    if (!ED.on || ED.mode !== 'edit') return;                         // play mode → the game gets the mouse
    var c = evCanvas(e), w = s2w(c.x, c.y);
    if (ED.tool === 'drag') { var v = hitVert(c.x, c.y); if (v) ED.drag = v; }
    else if (ED.tool === 'add') { var nv = { x: Math.round(w.x), y: Math.round(w.y), mat: defMat() }; vertices.push(nv); sortV(); ED.drag = nv; ED.tool = 'drag'; syncTool(); }
    else if (ED.tool === 'del') { var dv = hitVert(c.x, c.y); if (dv) { var ix = vertices.indexOf(dv); if (ix >= 0) vertices.splice(ix, 1); } }
    else if (ED.tool === 'cup') { setCup(Math.round(w.x)); }
    e.stopPropagation(); e.preventDefault();
  }
  function onMove(e) {
    if (!ED.on || ED.mode !== 'edit' || !ED.drag) return;
    var c = evCanvas(e), w = s2w(c.x, c.y);
    ED.drag.x = Math.round(w.x); ED.drag.y = Math.max(20, Math.min(H_() - 20, Math.round(w.y))); sortV();
    e.stopPropagation();
  }
  function onUp(e) { if (ED.drag && ED.mode === 'edit') { ED.drag = null; e.stopPropagation(); } else { ED.drag = null; } }

  function doExport() {
    var h = holes[ED.holeIdx];
    var verts = editVerts().map(function (v) { return { x: Math.round(v.x), y: Math.round(v.y), mat: v.mat || null }; });
    var data = { course: (typeof RG !== 'undefined' && RG.course) || 'earth', tee: { x: Math.round(h.teeX), y: Math.round(terrainYAt(h.teeX)) }, cup: { x: Math.round(h.cupX), y: Math.round(h.cupY) }, verts: verts, floaters: [], water: [] };
    ED.lastExport = data; var s = JSON.stringify(data, null, 2);
    try { console.log('[editor] export:\n' + s); } catch (e) {}
    var ta = document.getElementById('ed-export'); if (ta) { ta.value = s; ta.style.display = 'block'; }
    return data;
  }

  function snapshot() { ED.snap = { verts: vertices.map(function (v) { return Object.assign({}, v); }), hole: Object.assign({}, holes[ED.holeIdx]) }; }
  function restore() { if (!ED.snap) return; if (typeof currentHole !== 'undefined') currentHole = ED.holeIdx; vertices = ED.snap.verts.map(function (v) { return Object.assign({}, v); }); var h = holes[ED.holeIdx], s = ED.snap.hole; for (var k in s) h[k] = s[k]; sortV(); }

  function setMode(m) {
    if (m === 'play') { snapshot(); window.aiEnabled = false; if (typeof currentHole !== 'undefined') currentHole = ED.holeIdx; parkBall(); }
    else { restore(); window.aiEnabled = false; parkBall(); }
    ED.mode = m; syncTool();
  }

  var TOOLS = ['drag', 'add', 'del', 'cup'];
  function syncTool() {
    for (var i = 0; i < TOOLS.length; i++) { var b = document.getElementById('ed-t-' + TOOLS[i]); if (b) b.style.background = (ED.tool === TOOLS[i] && ED.mode === 'edit') ? '#2a7d4f' : '#22344a'; }
    var pb = document.getElementById('ed-play'); if (pb) pb.textContent = (ED.mode === 'edit') ? '▶ Play this hole' : '✎ Back to edit';
  }
  function buildToolbar() {
    var bar = document.createElement('div'); bar.id = 'ed-bar';
    bar.style.cssText = 'position:fixed;top:8px;left:50%;transform:translateX(-50%);z-index:9999;display:flex;gap:6px;align-items:center;font:12px monospace;background:rgba(10,12,18,0.86);padding:6px 8px;border-radius:8px;';
    function btn(id, label, fn) { var b = document.createElement('button'); b.id = id; b.textContent = label; b.style.cssText = 'font:12px monospace;color:#cfe;background:#22344a;border:1px solid #3a536e;border-radius:5px;padding:4px 9px;cursor:pointer;'; b.onclick = fn; bar.appendChild(b); return b; }
    TOOLS.forEach(function (t) { btn('ed-t-' + t, t, function () { ED.tool = t; if (ED.mode !== 'edit') setMode('edit'); syncTool(); }); });
    var sep = document.createElement('span'); sep.style.cssText = 'width:1px;height:18px;background:#3a536e;margin:0 3px;'; bar.appendChild(sep);
    btn('ed-reset', '⟲ baseline', function () { setMode('edit'); baseline(); syncTool(); });
    btn('ed-export', '⤓ Export', doExport);
    btn('ed-play', '▶ Play this hole', function () { setMode(ED.mode === 'edit' ? 'play' : 'edit'); });
    document.body.appendChild(bar);
    var ta = document.createElement('textarea'); ta.id = 'ed-export'; ta.readOnly = true; ta.style.cssText = 'position:fixed;bottom:8px;right:8px;width:340px;height:176px;z-index:9999;display:none;font:10px monospace;background:rgba(10,12,18,0.92);color:#aded9d;border:1px solid #3a536e;border-radius:6px;padding:4px;'; document.body.appendChild(ta);
  }

  function init() {
    if (!(window.RG && RG.active && typeof vertices !== 'undefined' && typeof holes !== 'undefined' && holes.length && typeof canvas !== 'undefined' && typeof draw !== 'undefined')) { return setTimeout(init, 120); }
    ED.on = true; ED.holeIdx = (typeof currentHole !== 'undefined') ? currentHole : 0;
    window.aiEnabled = false;
    baseline(); buildToolbar(); patchDraw();
    // exposed API (programmatic build + v2 round-trip LOAD of an exported design)
    ED.setCup = setCup; ED.parkBall = parkBall; ED.baseline = baseline;
    ED.load = function (d) {
      if (!d || !d.verts) return;
      var m = defMat();
      vertices = d.verts.map(function (v) { return { x: Math.round(v.x), y: Math.round(v.y), mat: v.mat || m }; });
      var h = holes[ED.holeIdx];
      if (d.tee) { h.teeX = d.tee.x; h.teeY = (d.tee.y != null ? d.tee.y : terrainYAt(d.tee.x)); }
      setCup((d.cup && d.cup.x) || (vertices[vertices.length - 1].x - 60));
      if (typeof setHoleCamera === 'function') setHoleCamera(h);
      parkBall();
    };
    window.addEventListener('mousedown', onDown, true);
    window.addEventListener('mousemove', onMove, true);
    window.addEventListener('mouseup', onUp, true);
    window.addEventListener('keydown', function (e) { if (ED.mode !== 'edit') return; if (e.key === 'Delete' || e.key === 'Backspace') { /* del under cursor handled by del tool */ } });
    syncTool();
    try { console.log('[editor] ready — ?edit active'); } catch (e) {}
  }
  setTimeout(init, 500);
})();
