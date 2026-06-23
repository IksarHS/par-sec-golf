# Dream Build Plan — execute the dream hole-gen + a new system (2026-06-22)

August greenlit building the full dream. This is the execution spec. Read alongside
`docs/DESIGN-hole-generation.md` (the why), `prototypes/mockups/specs-dream.js` (the 36 dream holes),
and `editor-shots/dreamboard-*.png` (the look). **Additive + gated — base game + existing 5 systems stay
byte-identical; everything new lives in NEW modules behind a flag.** Keep `node tools/verify.cjs` green.

## Goal
Implement ALL the dream-world stuff (composed-signal generator + real caves + quality-diversity selection
+ floating set-pieces), then build **a NEW system of planets/moons whose holes come ONLY from this new
generator** (not the old 183-archetype deck), then **playtest + validate completion AND fun.**

## Architecture — new modules under `src/holegen/` (additive)
Build as small modules with these interfaces so the pipeline stays coherent:

- `holegen/spine.js` — `makeSpine(concept, difficulty, rng) -> [{x,y}...]`
  Hole *concepts* (not silhouettes): `descent`, `carry_then_climb`, `plateau_hop`, `gather_bowl`,
  `tucked_pin`, `ridge_run`, `valley_cross`. Emits 3–5 monotone-x control points tee→landing→hazard→green
  via a monotone Hermite spline (never overshoots backward). Difficulty scales drop, carry width, green size.
- `holegen/operators.js` — composable feature kernels + `compose(baseFn, ops) -> heightFn`
  `plateau` (opposed smoothsteps), `cliffStep` (smoothstep), `mound`/`bunker` (±gaussian), `dunePatch`
  (windowed fbm). Blend with smin/smax (k-blend) so features melt in. **Operator count/scale = the real
  complexity knob.**
- `holegen/skin.js` — `applySkin(heights, params)`: small global fbm + optional terracing
  (`round(e·N)/N` + smoothstep lip) for our faceted look + a **thermal angle-of-repose pass** that
  guarantees every slope is ball-traversable (kills low-g roll-off-forever).
- `holegen/caves.js` — `genCaves(spec) -> [overhangPolys]`: a local SDF / metaball field →
  coarse marching-squares → convex-decomposed polygons, emitted as the engine's set-piece convex slabs
  (`src/set-pieces.js` swept circle-vs-poly). True tunnels/overhangs/arches the heightfield can't do.
  Stays flat-faceted (coarse contour). Cup may sit under a lip / in a cavern.
- `holegen/setpieces-dream.js` — **FLOATING / non-terrain objects** (August's ask): designed standalone
  bodies — a **floating ziggurat**, floating isles (tethered/landable tops), a great stone arch, a spire/
  monolith pin, a keyhole massif, mushroom hoodoos, a "leviathan" landmark. Each is a convex-decomposed
  polygon body (atlas-blocks circle-vs-AABB and/or set-pieces) with landable tops + the cup placeable on
  it. These are the rare **signature/landmark** holes (the idiosyncrasy library), injected sparingly.
- `holegen/score.js` — `score(hole, botResult) -> {playable, interest}`: the QUALITY objective.
  playable = bot sinks ≤20 (hard gate). interest = shot-count in band (2–5) + requires-a-carry + ≥2 viable
  lines + elevation variety − anti-frustration penalties (no inescapable pits, no near-miss roll-off).
- `holegen/dreamgen.js` — orchestrator: pick concept → spine → operators → skin → (optional caves /
  floating set-piece) → sample to heightfield + overhang/body lists. Exposes a `generateDreamHole(course,
  holeIndex, rng)` that fits the engine's hole shape.

## Quality-Diversity selection (the keystone — turns "fine" → "great")
Wrap generation in **generate-K-keep-best** (K≈8–12): generate candidates, run the existing autoplay bot
(hard gate), `score()` survivors, keep the best. Optional MAP-Elites: bin by (elevation-change ×
hazard-count) and keep best-per-bin so a planet's holes are *different kinds of great*, not 9 of one.
Reuse the real bot (don't reimplement physics). This is what playtest "fun" is measured against.

## The 36 dream holes → 3 mechanisms (build coverage for all)
- **Generator-native** (spine+operators+skin): Dune Sea, Mesa Stair, Split Canyon, Punchbowl Crater,
  Cliff Edge, Rough-to-Ruin, Sand Bunkers, Ice Slide, Twin Waters, Long Climb, Pin-in-the-Bowl, Deep Well,
  Sticky Green. → concept+operator presets.
- **Cave layer** (caves.js): Cup-under-Lip, Tunnel Putt, Stone Arch, Drop Cavern, Cantilever, Slot Canyon,
  Pocket-behind-Wall, Double Decker, The Maw, The Keyhole, Mushroom Rocks.
- **Floating/landmark set-pieces** (setpieces-dream.js, rare-injected): Leviathan, Floating Isles, The
  Spiral, Twin Horns, Pin on a Spire, The Tower, Needle Row, Island Green, Drop Shot, The Great Arch,
  + the **floating ziggurat** (new). 
Translate `specs-dream.js` silhouettes into the matching mechanism's parameters.

## The NEW system (built ONLY from the dream pipeline)
Add ONE new real star system after Proxima (a real system NOT already used — Sol/TRAPPIST-1/Barnard/
Kepler-90/Proxima are taken; e.g. **Gliese 667C**, **55 Cancri**, **Tau Ceti**, **Upsilon Andromedae**).
~6–8 colorful invented bodies (jade/teal/violet/amber/coral/ice — no brown). Each body's course uses
`gen:'composed'` + a curated set of dream concepts/operators + (on cavernous bodies) the cave layer +
(1–2 signature bodies) floating set-pieces incl. the ziggurat. **No old archetypes.** Gate it so peeling
the system + holegen modules restores the byte-identical 5-system tour.

## Playtest + validate (acceptance)
- **Completability:** `node tools/verify.cjs` on the new system → 100%. Add the new system to the harness.
- **Fun/variety:** report the interestingness distribution (shot-count spread, % with carries/decisions,
  elevation variety); FAIL if holes cluster at 1–2 shots or feel samey — regenerate/tune.
- **Visual:** render every body's holes in `?showcase` (or the new system in-engine), montage, and run a
  critic pass: is it varied + beautiful + on-art? Iterate until yes.
- Deliverables → `editor-shots/` (montages + a playtest report) + push MP4/contact-sheet to phone.

## Out of scope here (separate track)
Super Stickman designed levels (own agent). P7/P8 still parked.
</content>
