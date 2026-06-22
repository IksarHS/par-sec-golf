// src/editor-trace.js — PASTE/DROP/UPLOAD a screenshot → auto-trace the terrain → load as an editable hole.
// Pure in-browser pipeline (mirrors tools/trace_hole.py): threshold warm terrain (fallback: differs-from-sky)
// → keep the largest blob → Moore boundary-trace its outline (captures bays/notches) → Douglas-Peucker simplify
// → flag→cup → ED.load. Gated on the editor (?edit); inert otherwise. Peelable.
(function () {
  if (!/[?&]edit\b/.test(location.search)) return;

  function traceImageToHole(img, tol) {
    tol = tol || 0.004;
    var TW = 520, TH = Math.max(1, Math.round(TW * img.height / img.width));
    var cv = document.createElement('canvas'); cv.width = TW; cv.height = TH;
    var cx = cv.getContext('2d'); cx.drawImage(img, 0, 0, TW, TH);
    var px = cx.getImageData(0, 0, TW, TH).data, N = TW * TH;
    var mask = new Uint8Array(N), warm = 0, fx = 0, fy = 0, fn = 0;
    var sr = 0, sg = 0, sb = 0, sc = 0;                                   // sky = top 5 rows average
    for (var y0 = 0; y0 < Math.min(5, TH); y0++) for (var x0 = 0; x0 < TW; x0++) { var k = (y0 * TW + x0) * 4; sr += px[k]; sg += px[k + 1]; sb += px[k + 2]; sc++; }
    sr /= sc || 1; sg /= sc || 1; sb /= sc || 1;
    for (var i = 0; i < N; i++) {
      var r = px[i * 4], g = px[i * 4 + 1], b = px[i * 4 + 2];
      if (r > g + 15 && r > b + 15) { mask[i] = 1; warm++; }              // warm/red = terrain
      if (r > 140 && g > 110 && b < g - 30) { fx += (i % TW); fy += (i / TW) | 0; fn++; }   // yellow flag
    }
    if (warm < 0.04 * N) for (var j = 0; j < N; j++) {                    // fallback: differs from sky
      mask[j] = (Math.abs(px[j * 4] - sr) + Math.abs(px[j * 4 + 1] - sg) + Math.abs(px[j * 4 + 2] - sb) > 60) ? 1 : 0;
    }
    keepLargest(mask, TW, TH);
    var contour = topEdgeTrace(mask, TW, TH);                           // the playable SURFACE (one height per x) — heightfield, not a polygon outline
    if (contour.length < 4) return null;
    var simp = douglasPeucker(contour, tol * pathLen(contour));
    var scx = 960 / TW, scy = 540 / TH;
    var verts = simp.map(function (p) { return { x: Math.round(p[0] * scx), y: Math.round(p[1] * scy) }; });
    var cupX = fn ? Math.round((fx / fn) * scx) : 600;
    var teeX = verts.length ? Math.max(60, Math.min(verts[0].x + 40, 200)) : 100;
    return { tee: { x: teeX }, cup: { x: cupX }, verts: verts };
  }

  // keep only the largest 4-connected blob of 1s (BFS flood fill)
  function keepLargest(mask, W, H) {
    var N = W * H, lab = new Int32Array(N), cur = 0, best = 0, bestSize = 0, stack = new Int32Array(N);
    for (var s = 0; s < N; s++) {
      if (mask[s] && !lab[s]) {
        cur++; var sp = 0, size = 0; stack[sp++] = s; lab[s] = cur;
        while (sp) {
          var p = stack[--sp]; size++; var x = p % W, y = (p / W) | 0;
          if (x > 0 && mask[p - 1] && !lab[p - 1]) { lab[p - 1] = cur; stack[sp++] = p - 1; }
          if (x < W - 1 && mask[p + 1] && !lab[p + 1]) { lab[p + 1] = cur; stack[sp++] = p + 1; }
          if (y > 0 && mask[p - W] && !lab[p - W]) { lab[p - W] = cur; stack[sp++] = p - W; }
          if (y < H - 1 && mask[p + W] && !lab[p + W]) { lab[p + W] = cur; stack[sp++] = p + W; }
        }
        if (size > bestSize) { bestSize = size; best = cur; }
      }
    }
    for (var i = 0; i < N; i++) mask[i] = (lab[i] === best) ? 1 : 0;
  }

  // top-edge SURFACE trace: the topmost terrain pixel per column → a heightfield (one height per x). Gives a
  // clean, PLAYABLE surface (the cup's sink physics needs this) instead of a folded polygon outline.
  function topEdgeTrace(mask, W, H) {
    var pts = [];
    for (var x = 0; x < W; x++) {
      for (var y = 0; y < H; y++) if (mask[y * W + x] === 1) { pts.push([x, y]); break; }
    }
    return pts;
  }

  function pathLen(c) { var L = 0; for (var i = 1; i < c.length; i++) L += Math.hypot(c[i][0] - c[i - 1][0], c[i][1] - c[i - 1][1]); return L; }
  function douglasPeucker(pts, eps) {
    if (pts.length < 3) return pts.slice();
    var dmax = 0, idx = 0, a = pts[0], b = pts[pts.length - 1];
    for (var i = 1; i < pts.length - 1; i++) { var d = segDist(pts[i], a, b); if (d > dmax) { dmax = d; idx = i; } }
    if (dmax > eps) { var l = douglasPeucker(pts.slice(0, idx + 1), eps), rg = douglasPeucker(pts.slice(idx), eps); return l.slice(0, l.length - 1).concat(rg); }
    return [a, b];
  }
  function segDist(p, a, b) { var dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy; if (l2 === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]); var t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)); return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy)); }

  // ── glue ──
  function handleImage(img) {
    try {
      var hole = traceImageToHole(img);
      if (hole && window.ED && ED.load) { ED.load(hole); flash('✓ Traced ' + hole.verts.length + ' vertices — drag to refine, set the cup, or Play this hole'); }
      else flash('Trace failed — try another image (terrain warm, sky cool)');
    } catch (e) { flash('Trace error: ' + (e && e.message)); }
  }
  function loadBlob(blob) { if (!blob) return; var u = URL.createObjectURL(blob); var im = new Image(); im.onload = function () { handleImage(im); URL.revokeObjectURL(u); }; im.onerror = function () { flash('Could not read that image'); }; im.src = u; }
  function flash(msg) {
    var d = document.getElementById('ed-flash');
    if (!d) { d = document.createElement('div'); d.id = 'ed-flash'; d.style.cssText = 'position:fixed;top:56px;left:50%;transform:translateX(-50%);z-index:99999;background:rgba(18,34,24,0.96);color:#bfe;font:13px monospace;padding:8px 14px;border-radius:6px;border:1px solid #5aa86e;pointer-events:none;'; document.body.appendChild(d); }
    d.textContent = msg; d.style.display = 'block'; clearTimeout(d._t); d._t = setTimeout(function () { d.style.display = 'none'; }, 4500);
  }

  function wire() {
    if (!(window.ED && ED.on && document.getElementById('ed-bar'))) return setTimeout(wire, 200);
    window.addEventListener('paste', function (e) {
      var items = (e.clipboardData || {}).items || [];
      for (var i = 0; i < items.length; i++) if (items[i].type && items[i].type.indexOf('image') === 0) { loadBlob(items[i].getAsFile()); e.preventDefault(); return; }
    });
    window.addEventListener('dragover', function (e) { e.preventDefault(); });
    window.addEventListener('drop', function (e) { e.preventDefault(); var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; if (f && f.type.indexOf('image') === 0) loadBlob(f); });
    var bar = document.getElementById('ed-bar');
    var inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'; inp.style.display = 'none';
    inp.onchange = function () { if (inp.files[0]) loadBlob(inp.files[0]); inp.value = ''; };
    var b = document.createElement('button'); b.textContent = '🖼 Trace image'; b.style.cssText = 'font:12px monospace;color:#cfe;background:#2a4d6e;border:1px solid #3a536e;border-radius:5px;padding:4px 9px;cursor:pointer;'; b.onclick = function () { inp.click(); };
    bar.appendChild(b); bar.appendChild(inp);
    flash('Paste a screenshot (Ctrl+V), drop an image, or click 🖼 Trace image');
  }
  setTimeout(wire, 700);
  window.ED_TRACE = { trace: traceImageToHole, handleImage: handleImage, loadBlob: loadBlob };
})();
