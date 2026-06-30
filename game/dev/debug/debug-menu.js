// ── debug-menu.js — UNIFIED DEBUG MENU (home base for ALL dev overlays) ──────────────────────────────
// Dev-only tooling for the LOCAL build (devbuild.html). It is EXCLUDED from the public bundle by build.cjs's
// allow-list (the SCRIPTS array), exactly like cam-debug / perf-hud / editor — never ships.
//
// One menu to rule the debug overlays: each overlay module (debug-hud, cam-debug, perf-hud) registers its
// toggleable option(s) here instead of self-gating on a URL param + its own hotkey. The owner can toggle
// ANY combination independently (1, 2, or all), and the enabled set persists across reloads via localStorage.
//
//   window.DBG.register(id, { label, group, apply(on) })   — a toggleable overlay option (group default 'overlays')
//   window.DBG.registerAction(id, { label, run })          — a one-shot action button
//   window.DBG.set(id,on) / toggle(id) / isOn(id)          — drive a registered option (calls apply + persists)
//   window.DBG.openMenu() / closeMenu() / toggleMenu()     — show/hide the menu panel
//
// Backtick ` toggles the menu (capture-phase, works even when an element is focused). Escape closes it.
// Backward-compat: ?debug pre-enables statsHud · ?dbg pre-enables camStats+vertexNums · ?perf pre-enables perfHud
// (URL params win over persisted state on that load).
// Peel-off: delete this file + its <script> tag and nothing else changes (overlays just go dormant).
(function () {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  var STORE_KEY = 'dbg-menu-state';

  // ── ERROR/WARNING CAPTURE (installed FIRST, before any other debug script loads) ───────────────────
  // A ring buffer of diagnostics so a thrown error is impossible to miss in the menu and is one-click
  // copyable. We call THROUGH to the originals (normal logging untouched) and guard against recursion /
  // double-install. Cap ~50. Exposed via DBG.errors()/DBG._errBuf.
  var ERR_CAP = 50;
  var errBuf = [];                  // [{ level, msg, time }]
  var inErrHook = false;            // re-entrancy guard (a console.error inside our hook must not recurse)
  function _errTime() { try { return new Date().toLocaleTimeString(); } catch (e) { return '?'; } }
  function pushErr(level, msg) {
    try {
      errBuf.push({ level: level, msg: String(msg), time: _errTime() });
      if (errBuf.length > ERR_CAP) errBuf.shift();
      renderErrors();   // keep the menu badge live even if it's open
    } catch (e) {}
  }
  function _argsToMsg(args) {
    var parts = [];
    for (var i = 0; i < args.length; i++) {
      var a = args[i];
      try {
        if (a instanceof Error) parts.push(a.message + (a.stack ? ('\n' + a.stack) : ''));
        else if (typeof a === 'object' && a !== null) parts.push(JSON.stringify(a));
        else parts.push(String(a));
      } catch (e) { parts.push(String(a)); }
    }
    return parts.join(' ');
  }
  if (!window.__dbgErrHooked) {
    window.__dbgErrHooked = true;
    var _ce = (window.console && console.error) ? console.error : null;
    var _cw = (window.console && console.warn) ? console.warn : null;
    if (_ce) console.error = function () {
      var r; try { r = _ce.apply(console, arguments); } catch (e) {}
      if (!inErrHook) { inErrHook = true; try { pushErr('error', _argsToMsg(arguments)); } catch (e2) {} inErrHook = false; }
      return r;
    };
    if (_cw) console.warn = function () {
      var r; try { r = _cw.apply(console, arguments); } catch (e) {}
      // Ignore the noisy "willReadFrequently" Canvas2D perf warning.
      var m = _argsToMsg(arguments);
      if (!inErrHook && !/willReadFrequently/i.test(m)) { inErrHook = true; try { pushErr('warn', m); } catch (e2) {} inErrHook = false; }
      return r;
    };
    window.addEventListener('error', function (e) {
      var where = (e && e.filename) ? (' (' + String(e.filename).split('/').pop() + ':' + e.lineno + ':' + e.colno + ')') : '';
      var msg = (e && e.message) ? e.message : (e && e.error ? String(e.error) : 'script error');
      pushErr('error', msg + where);
    });
    window.addEventListener('unhandledrejection', function (e) {
      var reason = e && e.reason;
      var msg = (reason && reason.message) ? reason.message : String(reason);
      pushErr('error', 'unhandled promise rejection: ' + msg);
    });
  }

  // ── clipboard helper — navigator.clipboard with an execCommand textarea fallback ───────────────────
  function copyText(text, btn) {
    var ok = function () { flashCopied(btn); };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(ok, function () { fallbackCopy(text, btn); });
        return;
      }
    } catch (e) {}
    fallbackCopy(text, btn);
  }
  function fallbackCopy(text, btn) {
    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;top:-1000px;left:-1000px;opacity:0;';
      (document.body || document.documentElement).appendChild(ta);
      ta.focus(); ta.select();
      var done = false;
      try { done = document.execCommand('copy'); } catch (e) {}
      ta.parentNode && ta.parentNode.removeChild(ta);
      if (done) flashCopied(btn);
    } catch (e) {}
  }
  function flashCopied(btn) {
    if (!btn) return;
    var prev = btn.textContent;
    btn.textContent = 'copied ✓';
    if (btn._dbgCopyT) clearTimeout(btn._dbgCopyT);
    btn._dbgCopyT = setTimeout(function () { btn.textContent = prev; }, 1100);
  }

  // ── attachCopyButton — a tiny "⧉ copy" affordance for any panel's title-strip handle ──────────────
  // getText() returns the string to copy (usually the panel's cleaned-up readout textContent). The button
  // is pointer-events:auto (like the handle) but does NOT make the readout body interactive. stopPropagation
  // on pointerdown so clicking copy never starts a drag of the panel.
  function attachCopyButton(handle, getText) {
    if (!handle || handle._dbgCopyBtn) return;
    var btn = document.createElement('span');
    btn._dbgCopyBtn = true;
    btn.textContent = '⧉ copy';
    btn.title = 'copy this panel’s text';
    btn.style.cssText = 'pointer-events:auto;cursor:pointer;float:right;margin-left:8px;'
      + 'font-size:9px;opacity:0.75;text-decoration:underline;';
    btn.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
    btn.addEventListener('click', function (e) {
      e.stopPropagation(); e.preventDefault();
      var t = ''; try { t = getText() || ''; } catch (e2) {}
      copyText(t, btn);
    });
    handle.appendChild(btn);
    return btn;
  }

  // ── persisted state ──────────────────────────────────────────────────────────────────────────────
  var state = {};   // id -> true (only enabled ids are stored)
  try {
    var raw = localStorage.getItem(STORE_KEY);
    if (raw) { var arr = JSON.parse(raw); if (arr && arr.length) for (var i = 0; i < arr.length; i++) state[arr[i]] = true; }
  } catch (e) {}

  // ── URL backward-compat (wins over persisted state on this load) ──────────────────────────────────
  var search = (typeof location !== 'undefined') ? location.search : '';
  var URL_PRE = {};
  if (/[?&]debug\b/.test(search)) URL_PRE.statsHud = true;
  if (/[?&]dbg\b/i.test(search)) { URL_PRE.camStats = true; URL_PRE.vertexNums = true; }
  if (/[?&]perf\b/.test(search)) URL_PRE.perfHud = true;
  for (var k in URL_PRE) if (URL_PRE.hasOwnProperty(k)) state[k] = true;

  function persist() {
    try {
      var ids = [];
      for (var id in state) if (state.hasOwnProperty(id) && state[id]) ids.push(id);
      localStorage.setItem(STORE_KEY, JSON.stringify(ids));
    } catch (e) {}
  }

  // ── registries (insertion-ordered) ────────────────────────────────────────────────────────────────
  var options = {};       // id -> { label, group, apply }
  var optionOrder = [];
  var actions = {};       // id -> { label, run }
  var actionOrder = [];

  var menuEl = null, listEl = null, actionsEl = null, errEl = null, menuOpen = false;
  var evLogGetter = null;   // cam-debug registers its event-log accessor here (DBG.setEvLog)

  // ── material histogram — counts vertices[i].mat across ALL vertices (works off-screen, data-based) ─
  function matHistogram() {
    if (typeof vertices === 'undefined' || !vertices || !vertices.length) return null;
    var counts = {}, order = [], none = 0;
    for (var i = 0; i < vertices.length; i++) {
      var v = vertices[i]; if (!v) continue;
      var m = v.mat;
      if (m == null) { none++; continue; }
      if (counts[m] == null) { counts[m] = 0; order.push(m); }
      counts[m]++;
    }
    return { counts: counts, order: order, none: none, total: vertices.length };
  }
  function matHistogramStr() {
    var h = matHistogram();
    if (!h) return 'MATS: (no vertices)';
    var parts = [];
    for (var i = 0; i < h.order.length; i++) parts.push(h.order[i] + ':' + h.counts[h.order[i]]);
    if (h.none) parts.push('(none):' + h.none);
    return 'MATS: ' + (parts.length ? parts.join(' ') : '(empty)');
  }

  // ── errors as plain text ──────────────────────────────────────────────────────────────────────────
  function errorsText() {
    if (!errBuf.length) return 'ERRORS: none';
    var out = ['ERRORS (' + errBuf.length + '):'];
    for (var i = 0; i < errBuf.length; i++) out.push('[' + errBuf[i].time + '] ' + errBuf[i].level.toUpperCase() + ': ' + errBuf[i].msg);
    return out.join('\n');
  }

  // Read a classic-script GLOBAL-LEXICAL binding (let/var at a <script> top level — NOT on window, and
  // NOT visible to this IIFE if a local of the same name shadows it, e.g. our own `var state`). An indirect
  // Function lookup resolves it in the true global scope. Returns fb on any miss.
  function glob(name, fb) {
    try { var v = (new Function('return typeof ' + name + '!=="undefined"?' + name + ':undefined;'))(); return (v === undefined) ? fb : v; }
    catch (e) { return fb; }
  }
  // Map the game's numeric `state` to a label, using the global STATE_* constants (also global-lexical).
  function gameStateLabel() {
    var s = glob('state', null);
    if (s == null || typeof s !== 'number') return (s == null ? '?' : String(s));
    var names = ['STATE_AIM', 'STATE_FLIGHT', 'STATE_PAUSE', 'STATE_TRANSITION', 'STATE_OOB', 'STATE_COMPLETE'];
    var labels = { STATE_AIM: 'AIM', STATE_FLIGHT: 'FLIGHT', STATE_PAUSE: 'IN-CUP', STATE_TRANSITION: 'TRANSITION', STATE_OOB: 'OOB', STATE_COMPLETE: 'COMPLETE' };
    for (var i = 0; i < names.length; i++) { var c = glob(names[i], null); if (c != null && c === s) return labels[names[i]] + '(' + s + ')'; }
    return String(s);
  }

  // ── Copy debug report — the single plain-text blob the owner pastes to the assistant ───────────────
  function safe(fn, fb) { try { var v = fn(); return (v == null) ? fb : v; } catch (e) { return fb; } }
  function buildReport() {
    var L = [];
    L.push('=== FACETED GOLF DEBUG REPORT (local build) ===');
    var RG = window.RG;
    var ci = safe(function () { return currentHole; }, null);
    var hc = safe(function () { return RG.holeCount; }, '?');
    var holesArr = safe(function () { return holes; }, null);
    var h = (holesArr && ci != null) ? holesArr[ci] : null;
    L.push('course ' + safe(function () { return RG.course; }, '?')
      + '   hole ' + (ci != null ? (ci + 1) : '?') + '/' + hc
      + '   archetype ' + safe(function () { return h.archetype; }, '?'));
    var par = safe(function () { return RG.holePars && RG.holePars[ci]; }, null);
    if (par == null) par = safe(function () { return RG.parForHole(ci); }, '?');
    L.push('par ' + par
      + '   strokes ' + glob('strokes', '?')
      + '   state ' + gameStateLabel());
    L.push('ball ' + safe(function () { return Math.round(ball.x); }, '?') + ',' + safe(function () { return Math.round(ball.y); }, '?')
      + '   speed ' + safe(function () { return Math.round(Math.hypot(ball.vx, ball.vy) * 10) / 10; }, '?')
      + '   zoom ' + safe(function () { return Math.round(RG._zoom * 100) / 100; }, '?')
      + '   FPS ' + safe(function () { return window.__dbgFps; }, '?'));
    // Active condition / painted band.
    var cond = safe(function () { return RG.holeConds[ci]; }, null);
    var pb = safe(function () { return RG._paintedBand; }, null);
    L.push('condition ' + (cond ? (cond.key || '?') : 'none')
      + '   paintedBand ' + (pb && pb.length ? (pb.length + ' verts') : 'none'));
    // Material histogram.
    L.push(matHistogramStr());
    // Off-palette (leak) summary, if cam-debug exposed its scanner.
    if (typeof DBGleakSummary === 'function') { var ls = DBGleakSummary(); if (ls) L.push(ls); }
    // Event log.
    var ev = evLogGetter ? safe(evLogGetter, null) : null;
    if (ev && ev.length) { L.push('─ events ─'); for (var e = 0; e < ev.length; e++) L.push(ev[e]); }
    // Errors.
    L.push('─ ' + errorsText());
    return L.join('\n');
  }
  // cam-debug installs DBGleakSummary on DBG; mirror it to a local for buildReport's typeof check.
  var DBGleakSummary = null;

  function register(id, def) {
    if (!id || !def || typeof def.apply !== 'function') return;
    var existed = options.hasOwnProperty(id);
    options[id] = { label: def.label || id, group: def.group || 'overlays', apply: def.apply };
    if (!existed) optionOrder.push(id);
    // Immediately apply the persisted/URL state for this id so the overlay comes up enabled if it should.
    var on = !!state[id];
    try { def.apply(on); } catch (e) {}
    if (menuEl) renderMenu();
    return on;
  }

  function registerAction(id, def) {
    if (!id || !def || typeof def.run !== 'function') return;
    if (!actions.hasOwnProperty(id)) actionOrder.push(id);
    actions[id] = { label: def.label || id, run: def.run };
    if (menuEl) renderMenu();
  }

  function set(id, on) {
    var opt = options[id]; if (!opt) return;
    on = !!on;
    state[id] = on;
    if (!on) delete state[id];
    try { opt.apply(on); } catch (e) {}
    persist();
    if (menuEl) renderMenu();
  }
  function toggle(id) { set(id, !state[id]); }
  function isOn(id) { return !!state[id]; }

  // ── menu DOM ──────────────────────────────────────────────────────────────────────────────────────
  function buildMenu() {
    if (menuEl) return;
    menuEl = document.createElement('div');
    menuEl.id = 'dbg-menu';
    menuEl.style.cssText = 'position:fixed;top:8px;right:8px;z-index:100000;'
      + 'font:12px/1.5 "Departure Mono",monospace;background:rgba(6,8,10,0.90);color:#3f6;'
      + 'padding:9px 11px 8px;border:1px solid #3f6;border-radius:8px;'
      + 'box-shadow:0 4px 18px rgba(0,0,0,0.6);min-width:188px;max-width:42vw;'
      + 'pointer-events:auto;display:none;user-select:none;';

    var title = document.createElement('div');
    title.style.cssText = 'font-weight:bold;letter-spacing:1.5px;color:#6fffa6;margin-bottom:6px;'
      + 'display:flex;justify-content:space-between;align-items:center;';
    var tl = document.createElement('span'); tl.textContent = 'DEBUG';
    var x = document.createElement('span'); x.textContent = '×';
    x.style.cssText = 'cursor:pointer;color:#9f9;padding:0 4px;';
    x.onclick = function () { closeMenu(); };
    // Don't let a click on × initiate a drag of the menu.
    x.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
    title.appendChild(tl); title.appendChild(x);
    menuEl.appendChild(title);

    listEl = document.createElement('div');
    menuEl.appendChild(listEl);

    actionsEl = document.createElement('div');
    actionsEl.style.cssText = 'margin-top:7px;';
    menuEl.appendChild(actionsEl);

    // ── ERRORS section — count badge (red when >0), latest message, copy-errors button ──
    errEl = document.createElement('div');
    errEl.style.cssText = 'margin-top:7px;border-top:1px solid rgba(51,255,102,0.18);padding-top:6px;';
    menuEl.appendChild(errEl);

    // ── Copy debug report button (the headline action) ──
    var reportBtn = document.createElement('button');
    reportBtn.textContent = '⧉ Copy debug report';
    reportBtn.style.cssText = 'display:block;width:100%;margin:7px 0 0;padding:5px 7px;cursor:pointer;'
      + 'font:11px "Departure Mono",monospace;background:rgba(51,255,102,0.16);color:#bffbd2;'
      + 'border:1px solid #3f6;border-radius:5px;text-align:center;font-weight:bold;';
    reportBtn.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
    reportBtn.onclick = function (e) {
      e.stopPropagation();
      var rep = '';
      try { rep = buildReport(); } catch (e2) { rep = 'report error: ' + (e2 && e2.message); }
      try { console.log(rep); } catch (e3) {}   // console fallback
      copyText(rep, reportBtn);
    };
    menuEl.appendChild(reportBtn);

    var hint = document.createElement('div');
    hint.style.cssText = 'margin-top:7px;color:#5a8f6e;font-size:10px;line-height:1.4;border-top:1px solid rgba(51,255,102,0.18);padding-top:5px;';
    hint.textContent = '` menu · Esc close · toggles persist';
    menuEl.appendChild(hint);

    (document.body || document.documentElement).appendChild(menuEl);
    // Draggable by its title row, resizable, position/size persisted.
    makeMovable(menuEl, { handle: title, resizable: true, storageKey: 'dbg-menu-pos' });
    title.title = 'drag to move · double-click to reset';
    renderMenu();
  }

  function renderMenu() {
    if (!listEl) return;
    // Overlay options as checkboxes.
    listEl.innerHTML = '';
    for (var i = 0; i < optionOrder.length; i++) {
      var id = optionOrder[i], opt = options[id];
      var row = document.createElement('label');
      row.style.cssText = 'display:flex;align-items:center;gap:7px;cursor:pointer;padding:2px 0;color:#cfe;';
      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = !!state[id];
      cb.style.cssText = 'cursor:pointer;accent-color:#3f6;margin:0;';
      (function (oid) { cb.onchange = function () { set(oid, this.checked); }; })(id);
      var lab = document.createElement('span');
      lab.textContent = opt.label;
      row.appendChild(cb); row.appendChild(lab);
      listEl.appendChild(row);
    }
    if (!optionOrder.length) {
      var none = document.createElement('div');
      none.style.cssText = 'color:#5a8f6e;font-size:10px;';
      none.textContent = '(no overlays registered)';
      listEl.appendChild(none);
    }
    // Action buttons.
    actionsEl.innerHTML = '';
    for (var a = 0; a < actionOrder.length; a++) {
      var aid = actionOrder[a], act = actions[aid];
      var btn = document.createElement('button');
      btn.textContent = act.label;
      btn.style.cssText = 'display:block;width:100%;margin:3px 0 0;padding:4px 7px;cursor:pointer;'
        + 'font:11px "Departure Mono",monospace;background:rgba(51,255,102,0.08);color:#9f9;'
        + 'border:1px solid #3f6;border-radius:5px;text-align:left;';
      (function (rfn) { btn.onclick = function () { try { rfn(); } catch (e) {} }; })(act.run);
      actionsEl.appendChild(btn);
    }
    renderErrors();
  }

  // Render the ERRORS section: a count badge (RED when >0), the most recent message, copy-errors button.
  function renderErrors() {
    if (!errEl) return;
    errEl.innerHTML = '';
    var n = errBuf.length;
    var head = document.createElement('div');
    head.style.cssText = 'display:flex;align-items:center;gap:7px;';
    var badge = document.createElement('span');
    badge.textContent = 'ERRORS ' + n;
    badge.style.cssText = 'font-weight:bold;letter-spacing:1px;padding:1px 6px;border-radius:4px;'
      + (n > 0 ? 'background:#c0202a;color:#fff;' : 'background:rgba(51,255,102,0.12);color:#6fffa6;');
    head.appendChild(badge);
    if (n > 0) {
      var copyErr = document.createElement('span');
      copyErr.textContent = '⧉ copy errors';
      copyErr.style.cssText = 'cursor:pointer;font-size:9px;text-decoration:underline;color:#ffb3b3;margin-left:auto;';
      copyErr.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
      copyErr.addEventListener('click', function (e) { e.stopPropagation(); copyText(errorsText(), copyErr); });
      head.appendChild(copyErr);
    }
    errEl.appendChild(head);
    if (n > 0) {
      var latest = errBuf[n - 1];
      var line = document.createElement('div');
      line.style.cssText = 'margin-top:3px;font-size:10px;color:#ffd0d0;white-space:pre-wrap;word-break:break-word;max-height:54px;overflow:auto;';
      line.textContent = latest.level.toUpperCase() + ': ' + latest.msg;
      errEl.appendChild(line);
    }
  }

  // ── makeMovable — shared drag+resize+persist utility for any debug panel ───────────────────────────
  // opts: { handle (Element|selector within el; defaults to el itself),
  //         resizable (bool — CSS resize:both + ResizeObserver persistence),
  //         storageKey (localStorage key for {left,top,width,height}) }
  // Drag: Pointer Events + pointer capture on the handle; switches el to left/top positioning (rect computed
  //   first so it doesn't jump), clamps so ≥30px stays reachable on each axis. Double-click handle = reset.
  // Persists on drag-end and on resize. Restores saved rect on creation (before showing).
  function _movLoad(key) {
    if (!key) return null;
    try { var r = localStorage.getItem(key); return r ? JSON.parse(r) : null; } catch (e) { return null; }
  }
  function _movSave(key, rect) {
    if (!key) return;
    try { localStorage.setItem(key, JSON.stringify(rect)); } catch (e) {}
  }
  function _movClear(key) {
    if (!key) return;
    try { localStorage.removeItem(key); } catch (e) {}
  }

  function makeMovable(el, opts) {
    if (!el || el._dbgMovable) return el;   // idempotent
    el._dbgMovable = true;
    opts = opts || {};
    var key = opts.storageKey || null;

    var handle = opts.handle || el;
    if (typeof handle === 'string') handle = el.querySelector(handle) || el;

    // Switch el to left/top positioning using its current on-screen rect (so it never jumps).
    function pinToRect(setSize) {
      var r = el.getBoundingClientRect();
      el.style.left = Math.round(r.left) + 'px';
      el.style.top = Math.round(r.top) + 'px';
      el.style.right = 'auto';
      el.style.bottom = 'auto';
      if (setSize) { el.style.width = Math.round(r.width) + 'px'; el.style.height = Math.round(r.height) + 'px'; }
    }

    function curRect() {
      var r = el.getBoundingClientRect();
      return { left: Math.round(r.left), top: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height) };
    }

    // Restore saved rect (apply before showing).
    var saved = _movLoad(key);
    if (saved && typeof saved.left === 'number') {
      el.style.left = saved.left + 'px';
      el.style.top = saved.top + 'px';
      el.style.right = 'auto';
      el.style.bottom = 'auto';
      if (saved.width) el.style.width = saved.width + 'px';
      if (saved.height) el.style.height = saved.height + 'px';
    }

    // Resize: CSS resize:both + ResizeObserver persistence.
    if (opts.resizable) {
      el.style.resize = 'both';
      el.style.overflow = 'auto';
      if (!el.style.minWidth) el.style.minWidth = '120px';
      if (!el.style.minHeight) el.style.minHeight = '40px';
      if (typeof ResizeObserver !== 'undefined') {
        var rzThrottle = null;
        var ro = new ResizeObserver(function () {
          if (rzThrottle) return;
          rzThrottle = setTimeout(function () { rzThrottle = null; _movSave(key, curRect()); }, 150);
        });
        try { ro.observe(el); } catch (e) {}
      }
    }

    // Drag via Pointer Events + pointer capture.
    var dragging = false, startX = 0, startY = 0, baseLeft = 0, baseTop = 0;
    handle.style.cursor = 'move';
    handle.style.touchAction = 'none';   // let pointermove fire without scroll on touch

    function onDown(e) {
      if (e.button != null && e.button !== 0) return;
      dragging = true;
      pinToRect(false);
      var r = el.getBoundingClientRect();
      baseLeft = r.left; baseTop = r.top;
      startX = e.clientX; startY = e.clientY;
      document.body.style.userSelect = 'none';
      try { handle.setPointerCapture(e.pointerId); } catch (e2) {}
      e.preventDefault();
    }
    function onMove(e) {
      if (!dragging) return;
      var nl = baseLeft + (e.clientX - startX);
      var nt = baseTop + (e.clientY - startY);
      var w = el.offsetWidth, h = el.offsetHeight;
      var vw = window.innerWidth, vh = window.innerHeight;
      // Clamp so ≥30px stays reachable on each axis.
      nl = Math.max(30 - w, Math.min(vw - 30, nl));
      nt = Math.max(0, Math.min(vh - 30, nt));
      el.style.left = Math.round(nl) + 'px';
      el.style.top = Math.round(nt) + 'px';
    }
    function onUp(e) {
      if (!dragging) return;
      dragging = false;
      document.body.style.userSelect = '';
      try { handle.releasePointerCapture(e.pointerId); } catch (e2) {}
      _movSave(key, curRect());
    }
    handle.addEventListener('pointerdown', onDown);
    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', onUp);
    handle.addEventListener('pointercancel', onUp);

    // Double-click handle = reset position/size to default.
    handle.addEventListener('dblclick', function (e) {
      _movClear(key);
      el.style.left = ''; el.style.top = ''; el.style.right = ''; el.style.bottom = '';
      el.style.width = ''; el.style.height = '';
      e.preventDefault(); e.stopPropagation();
    });

    return el;
  }

  function openMenu() { buildMenu(); menuOpen = true; menuEl.style.display = 'block'; renderMenu(); }
  function closeMenu() { if (menuEl) menuEl.style.display = 'none'; menuOpen = false; }
  function toggleMenu() { if (menuOpen) closeMenu(); else openMenu(); }

  // ── backtick = menu (capture phase so it fires even with a focused element); Esc closes ────────────
  window.addEventListener('keydown', function (e) {
    if (e.key === '`' || e.code === 'Backquote') { e.preventDefault(); e.stopPropagation(); toggleMenu(); }
    else if (e.key === 'Escape' && menuOpen) { closeMenu(); }
  }, true);

  window.DBG = {
    register: register,
    registerAction: registerAction,
    set: set,
    toggle: toggle,
    isOn: isOn,
    openMenu: openMenu,
    closeMenu: closeMenu,
    toggleMenu: toggleMenu,
    makeMovable: makeMovable,   // shared drag+resize+persist for any debug panel
    attachCopyButton: attachCopyButton,   // tiny "⧉ copy" affordance for a panel's title-strip handle
    copyText: copyText,         // clipboard write (navigator.clipboard + execCommand fallback)
    // ── diagnostics API ──
    errors: function () { return errBuf.slice(); },   // snapshot copy of the error/warn ring buffer
    errorsText: errorsText,     // the buffer as one plain-text blob (what "copy errors" copies)
    _errBuf: errBuf,            // live buffer (exposed for headless verification)
    pushErr: pushErr,           // manual push (rarely needed; the hooks do this)
    matHistogram: matHistogram, // { counts, order, none, total } over vertices[i].mat
    matHistogramStr: matHistogramStr,
    buildReport: buildReport,   // assemble the plain-text debug report (also what the menu button copies)
    setEvLog: function (fn) { evLogGetter = (typeof fn === 'function') ? fn : null; },   // cam-debug supplies its evLog getter
    setLeakSummary: function (fn) { DBGleakSummary = (typeof fn === 'function') ? fn : null; },  // cam-debug supplies an off-palette summary
    _state: state   // exposed for headless verification
  };
})();
