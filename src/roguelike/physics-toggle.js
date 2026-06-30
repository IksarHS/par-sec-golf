// ── Physics profile toggle (playtest A/B) ──────────────────────────────────────
// Press F to A/B the SHIP physics (the current game feel) vs the REALISTIC profile (the physics-lab
// "realistic" preset) on the LIVE game. ?physics=realistic boots straight into realistic. The actual
// swap lives in run.js (RG.setPhysicsProfile) — it mutates the PRISTINE physics baseline so the profile
// holds across travel + hole transitions. A small badge shows the active profile: it stays up while in
// REALISTIC (so you never forget which you're testing) and flashes briefly when you switch back to SHIP.
// Peel this file + its <script> tag → gone (RG.setPhysicsProfile just never gets called).
(function () {
  if (typeof window === 'undefined') return;

  var _hideT = null;
  function badge(profile) {
    var el = document.getElementById('rg-phys');
    if (!el) {
      el = document.createElement('div'); el.id = 'rg-phys';
      el.style.cssText = 'position:fixed;left:12px;bottom:34px;z-index:9989;pointer-events:none;'
        + 'font:11px/1 "Departure Mono",monospace;color:rgba(242,236,255,0.72);'
        + 'background:rgba(14,11,18,0.7);border:1px solid rgba(160,200,140,0.4);'
        + 'border-radius:7px;padding:5px 9px;';
      document.body.appendChild(el);
    }
    el.textContent = 'PHYSICS: ' + profile + '  ·  F';
    el.style.display = 'block';
    clearTimeout(_hideT);
    if (profile !== 'realistic') _hideT = setTimeout(function () { el.style.display = 'none'; }, 1500);
  }

  function set(name) {
    if (!(window.RG && RG.setPhysicsProfile)) return null;
    var p = RG.setPhysicsProfile(name);
    badge(p);
    return p;
  }

  // ?physics=realistic — boot into the realistic profile (wait for RG to come up).
  if (/[?&]physics=realistic\b/.test(location.search)) {
    var n = 0;
    (function wait() {
      if (window.RG && RG.setPhysicsProfile) set('realistic');
      else if (n++ < 240) setTimeout(wait, 50);
    })();
  }

  // F toggles ship ⇄ realistic.
  window.addEventListener('keydown', function (e) {
    if (/INPUT|TEXTAREA/.test((e.target && e.target.tagName) || '')) return;
    if (e.key === 'f' || e.key === 'F') {
      var cur = (window.RG && RG.physicsProfile) ? RG.physicsProfile() : 'ship';
      set(cur === 'realistic' ? 'ship' : 'realistic');
    }
  });
})();
