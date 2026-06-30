# experiments/ — reference only, NOT the game

Standalone prototypes and design tools kept **purely for reference / future exploration**.
**None of these are part of the shipped game** (that's `devbuild.html` / `dist/`). They're not in the
public build and nothing in the game loads them. Open them directly via the dev server, e.g.
`http://localhost:8231/experiments/striking.html`.

If you're looking for the actual game, it's `devbuild.html`. If something in here proves worth shipping,
promote it into `src/` deliberately — don't wire the game to anything in this folder.

## Contents
- **striking.html** — control-scheme comparison: feel 4 shot mechanics side by side
  (Timing Meter · Drag+Arc · Two-Stage · Pull+Tension; keys 1–4). For deciding "which striking
  control is THE one?" (SHIP-VISION Q8). Pairs with `src/striking-variants.js`.
- **ball-agent.html** — "talking ball": the golf ball has a face and you can converse with it via a
  local in-browser LLM (hold `T`). Explored as a hidden "secret talking ball" feature. Loads a local
  AI model, so it's heavy. (Its 4 script refs to stripped game files — secrets/ship/shop/onboard —
  were removed so it loads clean.)
- **RESEARCH-local-conversational-llms.md** — research notes (local/on-device LLMs for the "talking golf
  ball" caddie). Background for `ball-agent.html`.
- **golforbit-planet.html** — ROUND-PLANET golf: golf *around* a whole faceted globe (8 pins/zones,
  radial gravity, the ball arcs over the curve to the next pin). The right *concept* for a planet mode.
  Canvas was fixed to fill the window (was a tiny 960×540). **TODO / known-wrong:** the shot is a soft
  little lob — it should be a Golf-Orbit-style SMASH that rips most of the way around the planet. Revisit
  with the better reference (there may be a stronger version of this idea elsewhere in the repo).
