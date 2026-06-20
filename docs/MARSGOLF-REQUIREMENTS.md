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

## Terrain (simple → complex, GoM-like)
- **R6 Complexity range:** a single knob drives gentle holes → dramatic holes across the course.
- **R7 Real complex terrain:** the complex end has genuine **overhangs and cave-like structures** — terrain
  the ball passes UNDER / INTO, i.e. multi-valued (a heightfield alone fails this). Not every hole — a mix.
- **R8 GoM aesthetic:** faceted/angular solid earth, clean sky-colored cup divot, minimal.

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
