# Faceted Golf — Earth

A standalone 2D side-view golf game (Desert-Golfing lineage) with a **new faceted hole-generation
engine** under the hood. Same feel as the base `desert-golf-roguelike` game — ball physics, the cup
**sink + ball-rise**, and the **camera pan to the next hole** — but every hole is generated as a
**faceted heightfield**: few long FLAT facets (where the ball can actually stop) + straight angular
slopes + occasional gentle curvature. Flat and angular, the Golf-on-Mars way, not uniformly curvy.

Built from research into how Golf on Mars generates terrain (it carves/facets a field, it doesn't
assemble parts — see `desert-golf-roguelike` Planet Foundry research). This project reuses the base
game's proven sink/transition mechanics and swaps the generator.

## Run

```
python serve.py      # → http://localhost:8230/
```
or open `index.html` directly. Add `?seed=123` to pin a specific course.

## Play

Drag back from the ball and release to shoot (angle + power), like Desert Golfing. Sink all 9 holes of
**Earth · Front Nine**. Click the completion screen to replay a fresh course.

## Layout

| File | Role |
|---|---|
| `js/shared.js` | constants, globals, materials, heightfield helpers (ported from the base engine) |
| `js/faceted.js` | **the new generator** — continuous faceted heightfield + cup placement |
| `js/engine.js` | physics, segment collision, state machine, cup-sink + hole transition (ported) |
| `js/render.js` | terrain / cup / fill animation / flag / ball / aim / HUD |
| `js/main.js` | boots the Earth course + the rAF loop |

The faceted look was prototyped in `desert-golf-roguelike/tools/facet-proto.cjs`.
