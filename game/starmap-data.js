// ── starmap-data.js — a tiny shim so the star map can pull the REAL tour from planet-gen.js ──────────
// planet-gen.js registers all courses into WORLDS['run-world'].courses and sets window.SOLAR_ITINERARY,
// but it bails early if WORLDS / MATERIALS aren't present. The full engine isn't needed for the map
// (no physics, no render), so we stub the two globals planet-gen touches, then load planet-gen.js. After
// it runs, window.STARMAP_TOUR holds the ordered, grouped itinerary the map draws from. ONE source of truth.
(function () {
  // Minimal MATERIALS: planet-gen reads .restitution/.rollingFriction/.surfaceFriction off a few base
  // keys to clone physics. We only need the keys it references to exist; values are irrelevant to the map.
  if (typeof window.MATERIALS === 'undefined') {
    const base = { restitution: 0.5, rollingFriction: 0.98, surfaceFriction: 0.05, color: '#888', colorLight: '#aaa' };
    window.MATERIALS = {};
    ['grass', 'sand', 'mud', 'ice', 'rock'].forEach(k => { window.MATERIALS[k] = Object.assign({}, base); });
  }
  // Minimal WORLDS so planet-gen's `WORLDS['run-world'].courses` target exists.
  if (typeof window.WORLDS === 'undefined') {
    window.WORLDS = { 'run-world': { courses: {} } };
  }
})();
