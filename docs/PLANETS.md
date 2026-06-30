# Planet generator — 24 varied, completable planets from one tunable generator

## What this is
One hole generator, driven by a per-planet **settings object**, producing **24 distinct planets** that run
**simple → complex** (Golf-on-Mars-style). Every planet is verified **completable** by the autoplay bot.
This is the standalone tool the conversation set out to find; it is NOT wired into the main game yet (by
request) — it lives in this project and registers courses `p1` … `p24`.

Play any planet: `?course=p1` … `?course=p24` (served locally, e.g. `python build/serve.py` → 8231).

## The one knob: `complexity` (0..1)
`src/planet-gen.js` defines 24 planets along a smooth complexity ramp (0.05 → 0.97). The complexity dial:
- **selects archetype tiers** (cumulative): gentle (flats/slopes) → angular (V-notches/shelves/cliffs) →
  dramatic (mesas/ridges/stepped) → big (canyons/twin-peaks/deep-plunges) → top tier (compound/dramatic);
- **scales difficulty** (drama within each archetype, via `difficultyRange`);
- **gates the weird set-pieces** (floating masses) — frequency/size rise with complexity.
Identity (terrain **material/colour** + **sky**) is cycled INDEPENDENTLY of complexity so neighbouring
planets look distinct (not "all simple planets are green"). 17 terrain colours (6 base + 14 custom) × 24
skies.

## How it's built (and why it's reliable)
- **Base = the engine's NATIVE faceted heightfield** (`gen:'faceted'`, micro-noise off for crisp angular
  edges). This reuses the engine's native cup/tee/fill/collision — all clean and free. This is ~the GoM
  "80%" (faceted flats/ramps/V-notches/plateaus/carries) and is what makes every planet reliably
  completable. We deliberately abandoned the field→marching-squares→simplify pipeline (it caused
  lacerations / cup-clipping / unreachable cups — see RESEARCH-BRIEF.md / GOM-HOLE-TAXONOMY.md).
- **Weird 20% = explicit floating MASSES** (`src/set-pieces.js`): on complex planets we find the deepest
  chasm in a hole (via `terrainYAt`) and float an angular 5-point terrain chunk near its rim with
  clearance below — a GoM-style floating-mass overhang the ball passes under/around. Directly authored
  polygons (no field, no marching squares → no lacerations), swept circle-vs-segment collision.
  **Reachable by construction**: the cup stays on the heightfield floor; the mass floats high over a
  mid-hole chasm and never blocks the cup approach.
- **Completability**: verified by a HEADLESS DETERMINISTIC harness (`tools/verify.cjs`) that loads the real
  engine into Node and plays every planet with the real autoplay bot. The gnarly cup-trapping archetypes
  (fortress / narrow_gap / canyon_cup / deep_pocket) are IN the top tier — the harness proves they're
  completable (my earlier flaky browser sweeps wrongly blamed them). Evidence: **320 planet-runs, 0 fails**
  (24×5 + p17-24×10 + p19-24×20). Reproduce: `node tools/verify.cjs all 5`.

## Files
- `src/planet-gen.js` — the 24 planets + the complexity→archetype/difficulty mapping + custom colours.
- `src/set-pieces.js` — floating-mass overhang generation + swept collision + render.
- `src/level-design.js` — `gen:'faceted'` skips micro-noise; hooks `generateOverhangs` after each hole;
  (a bot-based `_validateHole`/`_genValidatedHole` scaffold exists but is unhooked — see Improvements).
- `devbuild.html` — loads the above; generic `?course=<id>` dev shortcut.
- `tools/verify.cjs` — **headless deterministic completability harness**. Loads the REAL engine in Node
  (vm context + minimal browser stubs), plays every planet with the real autoplay bot. No browser, no
  flakiness, reproducible (seed → identical terrain). Verified faithful: p12 seed 777 geometry is
  bit-for-bit identical to the browser, and both complete it. `node tools/verify.cjs all 5` |
  `… p24 5` | `… p12 geom 777`.

## Improvements toward the goal (next steps)
1. **TRUE caves/overhangs (toward the 134/351 references)** via the research's **floor + folded-back
   ceiling polygon** representation — terrain that folds over itself with the cup *inside* a pocket. The
   floating masses approximate the "floating-mass" GoM holes; this would add the carved-cave ones.
2. **Reachability validation — SOLVED via the headless harness** (`tools/verify.cjs`), not inline. The
   inline bot-sim validator was abandoned (coupled to live state: camera-relative OOB, state-dependence,
   nested-`update()` corruption — it became a no-op). The harness replaces it: deterministic, faithful,
   reproducible verification of ANY generation change before it ships. It already let us safely put the
   gnarly cup-trapping archetypes back (verified 320/320). NEXT: wire the harness into CI / a pre-ship
   check, and optionally add inline re-rolling that calls the SAME headless play logic (no live-state
   coupling) so generation can self-heal unsinkable holes at runtime.
3. **Richer set-pieces**: multiple interlocking masses, arches/bridges spanning a chasm, a cup placed
   inside a cave — to approach the layered 351 silhouette.
4. **Discrete accent objects** (rock spikes, cacti, water) — GoM's real accents (terrain-colour bands read
   as either invisible or busy; objects are the right vehicle). The `ACCENT` map is in place for later.
5. **Designed cup "situations"** (catch-basin gift, protected/bank-shot, precision-landing) as explicit
   placement modes — the taxonomy says cup placement drives much of GoM's variety.
6. **More planets** — trivial (the generator is fully parameterised; bump `N` + extend the colour/sky/name
   arrays). 24 already samples colour×complexity well; 36+ is a 2-minute change if wanted.
7. **Wire into the main game** when approved — the planets are already valid courses; integration is just
   exposing them in the travel/selection flow.
