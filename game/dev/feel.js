// ── Game-Feel Sandbox (dev tool) ───────────────────────────
// Live-tune the FEEL of hitting the ball — gravity, power sensitivity, max power, bounce, roll —
// to try different vibes WITHOUT touching the core. Dormant unless ?dev. Crucially it is OFF by
// default (Stock = the real game, byte-for-byte): nothing is re-applied until you pick an
// experiment, so it can never quietly break the base game. While an experiment IS on, the values
// are re-applied every frame (the run controller resets GRAVITY/MATERIALS each hole, so we
// override after it). Hit Stock and the real physics returns instantly.
(function () {
  if (typeof location === 'undefined' || !/[?&]dev\b/.test(location.search)) return;
  if (typeof MATERIALS === 'undefined') return;

  // True physics defaults, snapshot once (these are pristine at load; RG only recolors materials).
  var BASE = {
    gravity: GRAVITY, power: POWER_SCALE, max: MAX_POWER,
    mats: {}
  };
  for (var k in MATERIALS) BASE.mats[k] = { r: MATERIALS[k].restitution, rf: MATERIALS[k].rollingFriction, sf: MATERIALS[k].surfaceFriction };

  // The live multipliers (1 = stock). carry>1 = the ball rolls further; bounce scales restitution.
  var M = { grav: 1, power: 1, max: 1, bounce: 1, carry: 1 };
  var on = false; // whether an experiment is active (re-applied each frame)

  function applyOnce() {
    GRAVITY = BASE.gravity * M.grav;
    POWER_SCALE = BASE.power * M.power;
    MAX_POWER = BASE.max * M.max;
    for (var k in BASE.mats) {
      if (!MATERIALS[k]) continue;
      var b = BASE.mats[k];
      MATERIALS[k].restitution = Math.max(0, Math.min(1.3, b.r * M.bounce));
      MATERIALS[k].rollingFriction = Math.max(0.5, Math.min(0.999, 1 - (1 - b.rf) / M.carry));
    }
  }
  function restoreStock() {
    GRAVITY = BASE.gravity; POWER_SCALE = BASE.power; MAX_POWER = BASE.max;
    for (var k in BASE.mats) { if (!MATERIALS[k]) continue; MATERIALS[k].restitution = BASE.mats[k].r; MATERIALS[k].rollingFriction = BASE.mats[k].rf; MATERIALS[k].surfaceFriction = BASE.mats[k].sf; }
  }
  // Re-apply each frame while on, so the run controller's per-hole reset can't wipe the experiment.
  (function loop() { if (on) applyOnce(); requestAnimationFrame(loop); })();

  var PRESETS = {
    Stock:   { grav: 1.0, power: 1.0, max: 1.0, bounce: 1.0, carry: 1.0 },
    Floaty:  { grav: 0.55, power: 1.05, max: 1.15, bounce: 1.15, carry: 1.25 },
    Punchy:  { grav: 1.1, power: 1.35, max: 1.25, bounce: 1.0, carry: 0.9 },
    Heavy:   { grav: 1.6, power: 1.1, max: 1.15, bounce: 0.6, carry: 0.85 },
    Slidey:  { grav: 1.0, power: 1.0, max: 1.0, bounce: 1.1, carry: 1.8 },
    Twitchy: { grav: 1.0, power: 1.7, max: 1.4, bounce: 1.05, carry: 1.0 },
  };

  var SLIDERS = [
    { key: 'grav', label: 'Gravity', min: 0.3, max: 2.5 },
    { key: 'power', label: 'Power sens.', min: 0.5, max: 2.0 },
    { key: 'max', label: 'Max power', min: 0.5, max: 2.0 },
    { key: 'bounce', label: 'Bounce', min: 0.3, max: 1.6 },
    { key: 'carry', label: 'Roll/carry', min: 0.4, max: 2.4 },
  ];

  function setPreset(name) {
    var p = PRESETS[name]; if (!p) return;
    M.grav = p.grav; M.power = p.power; M.max = p.max; M.bounce = p.bounce; M.carry = p.carry;
    var stock = (name === 'Stock');
    on = !stock;
    if (stock) restoreStock(); else applyOnce();
    syncUI();
  }

  // ── Panel ──
  var ui = {};
  function build() {
    if (document.getElementById('rg-feel')) return;
    var p = document.createElement('div'); p.id = 'rg-feel';
    p.style.cssText = 'position:fixed;right:10px;top:10px;z-index:9990;width:222px;font:11px/1.35 "Departure Mono",monospace;'
      + 'background:rgba(14,11,18,0.93);border:1px solid rgba(232,160,48,0.4);border-radius:10px;color:#f2ecff;padding:8px;'
      + 'box-shadow:0 6px 26px rgba(0,0,0,0.5);user-select:none;';
    var head = document.createElement('div');
    head.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;cursor:pointer;';
    head.innerHTML = '<b style="color:#f0c060;letter-spacing:1px;">🎚 GAME&nbsp;FEEL</b><span id="rg-feel-tog" style="opacity:0.6;">[–]</span>';
    p.appendChild(head);
    var body = document.createElement('div'); body.id = 'rg-feel-body';

    var presetWrap = document.createElement('div');
    presetWrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px;';
    Object.keys(PRESETS).forEach(function (name) {
      var b = document.createElement('button');
      b.textContent = name;
      var stock = name === 'Stock';
      b.style.cssText = 'flex:1 0 30%;padding:4px 2px;cursor:pointer;font:inherit;border-radius:6px;color:#f2ecff;'
        + 'background:rgba(' + (stock ? '120,200,120' : '232,160,48') + ',0.14);border:1px solid rgba(' + (stock ? '120,200,120' : '232,160,48') + ',0.4);';
      b.onclick = function () { setPreset(name); };
      presetWrap.appendChild(b);
    });
    body.appendChild(presetWrap);

    SLIDERS.forEach(function (sl) {
      var row = document.createElement('div'); row.style.cssText = 'margin:5px 0;';
      var lab = document.createElement('div'); lab.style.cssText = 'display:flex;justify-content:space-between;color:rgba(242,236,255,0.75);';
      lab.innerHTML = '<span>' + sl.label + '</span><span id="rg-feel-v-' + sl.key + '" style="color:#f0c060;">1.00×</span>';
      row.appendChild(lab);
      var inp = document.createElement('input'); inp.type = 'range';
      inp.min = sl.min; inp.max = sl.max; inp.step = 0.01; inp.value = M[sl.key];
      inp.style.cssText = 'width:100%;accent-color:#e8a030;cursor:pointer;';
      inp.oninput = function () { M[sl.key] = parseFloat(inp.value); on = true; applyOnce(); syncUI(); };
      ui[sl.key] = inp;
      row.appendChild(inp);
      body.appendChild(row);
    });

    var read = document.createElement('div'); read.id = 'rg-feel-read';
    read.style.cssText = 'margin-top:7px;padding-top:6px;border-top:1px solid rgba(255,255,255,0.08);color:rgba(242,236,255,0.55);font-size:10px;';
    body.appendChild(read);
    p.appendChild(body);
    document.body.appendChild(p);

    var collapsed = false;
    head.onclick = function () { collapsed = !collapsed; body.style.display = collapsed ? 'none' : 'block'; document.getElementById('rg-feel-tog').textContent = collapsed ? '[+]' : '[–]'; };
    syncUI();
  }
  function syncUI() {
    SLIDERS.forEach(function (sl) {
      if (ui[sl.key]) ui[sl.key].value = M[sl.key];
      var v = document.getElementById('rg-feel-v-' + sl.key); if (v) v.textContent = M[sl.key].toFixed(2) + '×';
    });
    var read = document.getElementById('rg-feel-read');
    if (read) read.textContent = (on ? '● EXPERIMENT' : '○ stock (real game)') + '  ·  G ' + (BASE.gravity * M.grav).toFixed(3) + '  pow ' + (BASE.power * M.power).toFixed(3) + '  max ' + (BASE.max * M.max).toFixed(1);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build); else build();
})();
