# Mars-golf generator — success requirements

Success = a self-contained, playable course that feels like Golf on Mars. Built to these, verified against
each. (`marsgolf.html`)

## Gameplay loop (the GoM feel — non-negotiable)
- **R1 Shoot:** drag from the ball to aim + set power; release fires. Gravity, bounce, roll, friction, rest.
- **R2 Sink:** ball entering the cup at low speed is captured.
- **R3 Hole rises & fills:** on sink, the cup divot animates CLOSED (terrain fills back to flat over the
  ball) — the DG/GoM "fill-in". Must be visible and satisfying, not an instant snap.
- **R4 Camera pan to next:** after the fill, the camera pans smoothly to the next hole; the ball continues
  from where it sank (the sunk cup becomes the next tee). One continuous course, hole→pan→hole.
- **R5 Course complete:** sinking the last hole ends the course cleanly.

## Terrain (simple → complex, GoM-like) — TARGETS LOCKED to docs/gom-targets/ (user-chosen + mine)
The user's 5 chosen targets (hq720*, images.*, 1515449524691*) are ALL: angular/faceted, multi-level
(peaks/plateaus/valleys/steps), one monochrome biome colour each (blue/green/teal/pink), with GAPS and
WATER hazards in valleys — and NO fold-over overhangs. So:
- **R6 Complexity range:** one knob, gentle → dramatic across the course (match steam_01 → images.jpg/webp).
- **R7 Complex terrain = ANGULAR MULTI-LEVEL + GAPS + WATER HAZARDS** (single-valued heightfield — this is
  what the targets show; DG is heightmaps and GoM's added complexity here is still single-valued). True
  fold-over overhangs/caves are NOT in the targets → out of scope for v1.
- **R8 Aesthetic:** angular faceted solid terrain, ONE biome colour per hole/stretch (cycle blue/green/
  teal/pink), lighter matching sky, small sky-coloured cup notch, tiny flag with the hole number, water as
  a flat coloured strip in valleys. Minimal.

## Fairness / robustness
- **R9 Every cup reachable:** each hole is solvable — simple holes by construction (cup on a flat floor),
  cave/overhang holes by **simulate-and-validate at generation** (re-roll until a shot can get in & sink).
- **R10 No soft-locks:** ball off-screen / stuck → re-tee; never an unrecoverable state. No JS errors.

## Verification (how each is proven, not asked)
- R1/R2: drive a shot headless, confirm flight→rest and a sink.
- R3: screenshot mid-fill (divot partially closed).
- R4: screenshot mid-pan (camera between holes), confirm `cur` advanced + ball at prior cup.
- R6/R7: screenshot early (simple) vs late (overhang + cave) holes.
- R9: a headless solver plays all holes to completion; 0 unsolvable.
- R10: run many generated courses; 0 crashes, 0 stuck.
