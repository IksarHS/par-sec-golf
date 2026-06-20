// ── seqtest.js — ?seq drives the REAL in-engine crane as the course→course transition (dev A/B) ──
// The old version drew a fake overlay scene on top of the frozen game and hard-swapped to the next
// course — which read as jump cuts to new screens. This now fires the ACTUAL crane (run.js
// _craneToCourse): one continuous move of the real camera + real ball + real world, landing in
// STATE_AIM on the real next tee. No overlay screens — nothing for the player to perceive as a cut.
//
// Sink ANY hole and the crane fires, ping-ponging Earth⇄Moon so you can feel it again and again.
// Press 1/2/3 to switch the crane FEEL live. Peel-off: delete this file + its <script> tag + the
// RG_SEQ.draw line in wrap.js drawHUD → gone (the crane itself stays; it's the real game's transition).
(function () {
  if (typeof location === 'undefined' || !/[?&]seq\b/.test(location.search)) return;
  try { localStorage.setItem('rg-knows-moon', '1'); } catch (e) {}

  // 1-5 switch the LANDING feel (all one continuous cinematic deceleration — no bounce, no stop-start).
  var VARS = [
    { land: 0, name: 'land · coast' },          // smooth back-loaded deceleration into the surface
    { land: 1, name: 'land · feather' },        // gentle, even, floaty set-down
    { land: 2, name: 'land · flare' },          // cruise then a strong late flare to a near-hover
    { land: 3, name: 'land · hover + dust' },   // slower, long near-hover + engine downwash dust
    { land: 4, name: 'land · drift + dust' },   // slowest, gentle VTOL descent + dust
  ];
  var vi = 0, lastState = -1;
  function R() { return window.RG; }
  function applyVariant() { if (R()) { if (R().setCraneVariant) R().setCraneVariant(6); R()._landStyle = VARS[vi].land; } }
  function fire() {
    if (!R() || !R().active || R().descending || !R()._seqTravel) return;
    applyVariant();
    R()._seqTravel();
  }

  // sink (STATE_PAUSE rising edge) → fire the real crane
  (function watch() {
    try {
      var st = (typeof state !== 'undefined') ? state : -1;
      var SP = (typeof STATE_PAUSE !== 'undefined') ? STATE_PAUSE : 2;
      if (st === SP && lastState !== SP) fire();
      lastState = st;
    } catch (e) {}
    requestAnimationFrame(watch);
  })();

  window.addEventListener('keydown', function (e) {
    if (e.key >= '1' && e.key <= '9') { var n = (+e.key) - 1; if (n < VARS.length) { vi = n; applyVariant(); } }
  });
  // TRAVEL tap: during the gated deep-space hold, any click/tap continues the journey
  function onTap(e) { if (R() && R()._descPhase === 'thold' && R()._travelTap) { R()._travelTap(); if (e && e.stopPropagation) { e.stopPropagation(); if (e.stopImmediatePropagation) e.stopImmediatePropagation(); } } }
  window.addEventListener('pointerdown', onTap, true);
  window.addEventListener('mousedown', onTap, true);

  window.RG_SEQ = {
    _fire: fire,
    _travel: function () { if (R() && R()._travelTap) R()._travelTap(); },
    setVariant: function (n) { if (n >= 0 && n < VARS.length) { vi = n; applyVariant(); } return VARS[vi].name; },
    _phase: function () { return R() ? ((R()._descPhase || 'none') + ':' + (R()._craneProg || 0).toFixed(2) + ' ' + R().course) : 'no-rg'; },
    draw: function (ctx) {
      if (!ctx) return;   // a tiny label so the tester knows which crane feel is active (sink to fire)
      var W_ = (typeof W !== 'undefined') ? W : ctx.canvas.width;
      ctx.save(); ctx.textAlign = 'center'; ctx.font = '12px "Departure Mono",monospace';
      var s = 'SEQ ' + (vi + 1) + '/' + VARS.length + ' · ' + VARS[vi].name + '   [1-' + VARS.length + '] · sink to travel';
      var tw = ctx.measureText(s).width + 18;
      ctx.globalAlpha = 0.72; ctx.fillStyle = 'rgba(12,10,18,0.85)';
      if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(W_ / 2 - tw / 2, 6, tw, 22, 7); ctx.fill(); }
      ctx.globalAlpha = 0.95; ctx.fillStyle = '#cdd6f5'; ctx.fillText(s, W_ / 2, 21);
      ctx.restore();
    },
  };
})();
