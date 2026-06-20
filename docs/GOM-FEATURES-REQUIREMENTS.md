# GoM feature parity — incremental requirements

Goal: close the gap between our `gom` generator and the FULL range in `docs/gom-targets/` (not just the
angular slice). Build the four features ONE AT A TIME, each additive, each verified, **never regressing**
what already works.

## Invariant (must hold after EVERY phase)
- **R0 No regression:** `node tools/verify.cjs gom,gom-cobalt,gom-teal,gom-jade,gom-rose 5` stays 25/25
  complete. The existing planets (`p1..p24`) and lab still load. Everything runs INSIDE the real engine
  (real physics, one-hole camera, fill+pan) — no standalone, no reinventing.

## Phase S — Smooth terrain  (refs: holes 148, 575, itch_01)
- **RS1** A smooth, rounded generation style (soft curves, not facets) alongside the angular one.
- **RS2** GoM MIXES smooth + angular hole-to-hole → a `gom` course produces a mix (some smooth holes, some
  angular), difficulty still ramps.
- **RS3** Cup reachable (cup on the single smooth surface) — verify 25/25 still holds.
- Verify: screenshot a smooth hole next to hole 148/itch_01; harness stays green.

## Phase W — Water hazards  (refs: hole 148 pond, images.jpg/webp strips)
- **RW1** Deep basins/valleys can hold water (a flat coloured surface in the basin).
- **RW2** Ball into water = hazard → reshoot from last safe rest (engine's `_lastSafe`); never a soft-lock.
- **RW3** Water NEVER makes a hole unsinkable — generation validates a dry path to the cup (re-roll/adjust
  if water blocks it). Harness stays 25/25 (+ water holes included).
- Verify: screenshot a water hole; bot completes water holes; no soft-lock.

## Phase O — Obstacles  (refs: cacti in 575/351, grey-rock plates in 351)
- **RO1** Occasional **cacti** — discrete collidable objects on the terrain (the engine's objects system),
  the ball bounces off; sparse, not every hole.
- **RO2** Occasional **grey-rock** accents (a second material / small plates) for variety.
- **RO3** Obstacles never seal the cup off — completability preserved. Harness 25/25.
- Verify: screenshot cacti + grey rock; harness green.

## Phase C — True overhangs / caves  (refs: hole 134 overhang, 351 interlocking plates) — hardest, last
- **RC1** Occasional overhang/cave holes: terrain the ball passes UNDER, cup in a pocket beneath a lip
  (reuse `set-pieces.js` floating-mass collision; floor stays the heightfield so the cup is on the floor).
- **RC2** Reachable BY CONSTRUCTION + simulate-validated; the bot completes them.
- **RC3** Rare (a spice, like GoM) — gated to higher difficulty; never breaks the other phases.
- Verify: screenshot an overhang/cave hole vs 134; bot completes; harness 25/25.

## Order (bang-for-buck): S → W → O → C. Commit + verify after each.

---

## STATUS (2026-06-20)
- **Phase S (smooth)** ✅ — `gom_smooth` archetype; courses mix `gom` (angular) + `gom_smooth`. Verified.
- **Phase W (water)** ✅ — REDESIGNED twice on feedback. Water is its own system (`water.js`), NOT terrain:
  a flat pool baked per basin, rendered FLUSH to the actual terrain vertices (no stair-steps), with a
  **settle-on-reveal ripple** (decaying standing wave → flat, visual-only). Hazard = touch → reshoot from
  last safe; physics/harness use the flat baked level → deterministic. 25/25.
- **Phase O (cacti)** ✅ — sparse green collidable obstacles (objects system). Grey-rock accent (RO2)
  deferred (kept the clean single-colour GoM look). 25/25.
- **Phase C (caves)** ⛔ NOT DONE — floating-mass overhangs were tried and PULLED (hurt completability +
  weren't the cup-under-lip look). Needs the dedicated **polygon-slab** approach (see the plan file
  `~/.claude/plans/so-none-of-these-recursive-lemur.md`): a separate `?course` test bed, reuse set-pieces
  collision, simulate-validate, headless render. Do it as a focused build, NOT tacked onto other work.

## Dynamic water sim (research + prototype, 2026-06-20)
- `water-sim.html` (standalone) — compressible cellular-automata VOLUME (fills arbitrary crevices, settles
  flat, handles overhangs, leak-free) + per-column SPRING surface (slosh). Hold left-mouse to pour →
  fill → slosh → settle. This is the tool for water when terrain goes non-heightfield (carved caves).
- Game integration chosen: **settle-then-bake** + **smooth water over real terrain** (both implemented for
  the heightfield as the flush pool + reveal ripple; the full CA is reserved for non-heightfield terrain).

## Verified in real-browser play (not just headless): no console errors, bot completes, terrain + water
## render clean. Harness: `node tools/verify.cjs gom,gom-cobalt,gom-teal,gom-jade,gom-rose 5` = 25/25.
