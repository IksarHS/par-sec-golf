// ── terrain.js — "crafted holes" terrain treatments (peel-off-able, OPT-IN) ──
// The base courses are deliberately gentle (the low-floor ethos). This adds opt-in
// treatments that recombine shapes the engine ALREADY ships (no new core archetypes) into
// a simple→crafted ladder, so a designer can FEEL which (if any) fits the calm, lonely-cozy
// vibe. Autonomy can prove a treatment is *completable* (the bot clears it), never *good* —
// that taste call is the whole point of keeping these opt-in and default-off.
//
//   gentle    (DEFAULT)  the literal shipped build — NO change, determinism byte-untouched.
//   links                soft curves only (slope/hill/downhill/uphill/rolling/valley), a bit
//                        bigger — a flowing dune-field; banks a putt off a slope, never a wall.
//   signature            a MOSTLY-gentle nine that deterministically promotes ONE or TWO slots
//                        to a single crafted hole (mesa/shelf/valley/stepped) — depth as
//                        PUNCTUATION in the calm (a hole you talk about), not a harder course.
//                        The promoted slots are chosen by RG._faultHash(seed), NEVER the terrain
//                        PRNG, so the crafted hole is fair-in-hindsight and deterministic.
//   dramatic             bold-but-readable: one confident landform per hole (mesa to clear,
//                        ridge to crest, a step down). The Vault-coded NOTCH shapes (cliff_shelf,
//                        shelf_drop_shelf) are deliberately excluded — those bury the cup in a
//                        slot-pit (arcade, not crafted) and belong only to the secret Vault.
//
// Toggle: ?terrain=links|signature|dramatic , RG_TERRAIN.set(name) , or ?dev Shift+G
// (cycles + regenerates the run so you see it immediately).
//
// Peel-off: delete this file + its <script> tag + the one RG_TERRAIN.apply line in
// run.js startRun -> the gentle courses are exactly as before.
(function () {
  // Soft, smooth-curve vocabulary — no angular/stepped shapes, never a wall.
  const SOFT = ['gentle_slope', 'gentle_hill', 'downhill', 'uphill', 'rolling_hills', 'valley'];
  // The gentle baseline a course already ships with (used as the calm floor for 'signature').
  const GENTLE = ['gentle_slope', 'gentle_hill', 'downhill', 'uphill', 'rolling_hills', 'valley', 'shelf'];
  // Moderate "crafted" accents for the promoted hole. These are the SELF-SHAPING archetypes:
  // mesa builds its own flat-top plateau and shelf builds its own raised step regardless of the
  // cup's elevation, so a signature hole reads as genuinely crafted even on this course's gentle
  // (near-flat) cup placement. Archetypes that only terrace the tee→cup line (stepped_descent,
  // valley, cliff_drop) collapse to a flat run when the cup sits level with the tee — excluded
  // here so a signature hole is never a no-op. Still no Vault notch shapes (cliff_shelf, etc.).
  const CRAFTED = ['mesa', 'shelf'];
  // Bold landforms — a single confident climb/drop per hole. Still no Vault notch shapes.
  const BOLD = ['shelf', 'mesa', 'cliff_drop', 'stepped_descent', 'dramatic_ridge'];

  const TREATMENTS = {
    gentle: null,   // no-op: the course keeps its own gentle archetypes + difficulty
    links: {
      archetypes: SOFT.slice(),
      difficultyRange: [0.2, 0.45],
    },
    // 'signature' is per-hole: a gentle baseline with a few deterministically-promoted holes.
    // Implemented via getters on the course (see apply) — not a flat archetype swap.
    signature: {
      perHole: true,
      base: { archetypes: GENTLE.slice(), difficultyRange: [0.05, 0.4] },
      crafted: { archetypes: CRAFTED.slice(), difficultyRange: [0.5, 0.62] },
    },
    dramatic: {
      archetypes: BOLD.slice(),
      difficultyRange: [0.35, 0.6],
    },
  };
  const SURFACE = { 'earth-course': 1, 'run-course': 1, 'moon': 1 };   // never the Vault/undercroft (own shapes)
  let name = 'gentle';

  function read() {
    if (window.RG_TERRAIN_TREATMENT && TREATMENTS[window.RG_TERRAIN_TREATMENT] !== undefined) return window.RG_TERRAIN_TREATMENT;
    const m = /[?&]terrain=(\w+)/.exec((typeof location !== 'undefined' && location.search) || '');
    if (m && TREATMENTS[m[1]] !== undefined) return m[1];
    return name;
  }

  // Which 1-2 of the run's holes get promoted to a crafted "signature" hole, chosen purely
  // from the run seed via RG._faultHash (NEVER the terrain PRNG — that would shift terrain).
  // Holes 0-1 are always left gentle (the calm intro), matching how conditions punctuate.
  function signatureSlots(seed, holeCount) {
    const fh = (window.RG && RG._faultHash) ? RG._faultHash : function (x) { return (x * 2654435761) >>> 0; };
    const n = holeCount || 9;
    const lo = 2;                       // first eligible slot (keep the opening calm)
    const span = Math.max(1, n - lo);
    const h = fh(seed >>> 0);
    // Two crafted holes per nine: a "first half" pick and a "second half" pick, never adjacent,
    // never the same slot. For very short courses this naturally collapses to one.
    const a = lo + (h % span);
    let b = lo + ((fh((h ^ 0x9e3779b9) >>> 0)) % span);
    if (b === a || Math.abs(b - a) === 1) b = lo + ((a - lo + 3) % span);   // de-cluster
    const set = {};
    set[a] = 1;
    if (b !== a) set[b] = 1;
    return set;
  }

  window.RG_TERRAIN = {
    treatments: Object.keys(TREATMENTS),
    get treatment() { return read(); },
    set(n) { if (TREATMENTS[n] !== undefined) { name = n; window.RG_TERRAIN_TREATMENT = n; } return read(); },
    cycle() { const k = Object.keys(TREATMENTS); return this.set(k[(k.indexOf(read()) + 1) % k.length]); },
    // Exposed for verification: the crafted slots for a seed (so a test can target one).
    _signatureSlots: signatureSlots,

    // run.js startRun calls this AFTER modifiers, BEFORE generation. Mutates the course in place.
    // No-op for the default 'gentle' and for non-surface courses, so determinism is untouched there.
    apply(course, courseId) {
      const t = TREATMENTS[read()];
      if (!t || !course || !SURFACE[courseId]) return;

      if (!t.perHole) {
        // Flat swap: every hole draws from one set/range (links, dramatic).
        course.archetypes = t.archetypes.slice();
        course.difficultyRange = t.difficultyRange.slice();
        return;
      }

      // Per-hole ('signature'): install getters so the engine, when it generates hole i,
      // sees the gentle baseline on most slots and the crafted set on the chosen slot(s).
      // The engine generates holes in order via ensureHolesAhead, pushing to `holes` only
      // AFTER reading archetypes/difficultyRange — so `holes.length` IS the index being
      // generated. Pure function of the slot + the seed-derived slot set; no PRNG touched.
      const seed = (window.RG && RG.seed != null) ? RG.seed : 0;
      const holeCount = course.holeCount || 9;
      const slots = signatureSlots(seed, holeCount);
      const genIdx = function () {
        return (typeof holes !== 'undefined' && holes) ? holes.length : 0;
      };
      const isSig = function () { return !!slots[genIdx()]; };
      const cfg = function () { return isSig() ? t.crafted : t.base; };
      // The course's own gentle cup placement (near-flat / soft downhill). On a crafted slot we
      // give a committed downhill drop so the shelf/mesa lands as a real step you read and aim
      // over — never a wall. Uses the terrain PRNG legitimately (this is generation, and only on
      // the opt-in, non-default treatment; the *which-hole* choice stays PRNG-free via faultHash).
      const baseCup = course.cupElevation;
      const craftedCup = function (teeY, difficulty) {
        const drop = (typeof randRange === 'function') ? randRange(70, 130) : 100;
        return (typeof clampY === 'function') ? clampY(teeY + drop) : (teeY + drop);
      };
      try {
        Object.defineProperty(course, 'archetypes', { configurable: true, get: function () { return cfg().archetypes; } });
        Object.defineProperty(course, 'difficultyRange', { configurable: true, get: function () { return cfg().difficultyRange; } });
        if (typeof baseCup === 'function') {
          Object.defineProperty(course, 'cupElevation', {
            configurable: true,
            get: function () { return isSig() ? craftedCup : baseCup; },
          });
        }
      } catch (e) {
        // Fallback (non-configurable property): degrade gracefully to the crafted whole-nine.
        course.archetypes = t.crafted.archetypes.slice();
        course.difficultyRange = t.crafted.difficultyRange.slice();
      }
    },
  };

  if (typeof location !== 'undefined' && /[?&]dev\b/.test(location.search)) {
    window.addEventListener('keydown', function (e) {
      if ((e.key === 'G' || e.key === 'g') && e.shiftKey) {
        const n = RG_TERRAIN.cycle();
        if (window.RG && RG.beginNewRun) RG.beginNewRun();   // regenerate so the new treatment shows now
        let el = document.getElementById('rg-terrain-toast');
        if (!el) { el = document.createElement('div'); el.id = 'rg-terrain-toast'; el.style.cssText = 'position:fixed;left:12px;bottom:130px;z-index:9989;font:11px monospace;color:#cdd6f5;background:rgba(14,11,18,0.7);border:1px solid rgba(205,214,245,0.2);border-radius:7px;padding:5px 9px;'; document.body.appendChild(el); }
        el.textContent = '⛰ terrain: ' + n; el.style.display = 'block';
      }
    });
  }
})();
