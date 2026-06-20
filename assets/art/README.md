# assets/art — generated art drops here

Star-map (and other) art generated in Midjourney/Reve goes in this folder. The prompts + style guide
are in **`docs/art-direction/`**.

## How the star chart picks it up
On open, the chart fetches **`manifest.json`** here and loads whatever it lists:

```json
{
  "background": "assets/art/starmap-bg.png",
  "planets": {
    "earth": "assets/art/planet-earth.png",
    "moon":  "assets/art/planet-moon.png",
    "mars":  "assets/art/planet-mars.png",
    "proxima": "assets/art/planet-proxima.png",
    "m51":   "assets/art/planet-m51.png"
  }
}
```

- **`background`** — a full-bleed image drawn (subtly) behind the route. Optional.
- **`planets`** — keyed by node id; the image replaces that world's drawn dot. Add only the ones you
  have; the rest stay as drawn dots.

Node ids (for the `planets` keys): `earth moon mars io titan pluto · proxima barnard ross128 teegarden ·
trappist cancri hd189 · k218 kepler16 corot7 · kepler186 wasp76 kelt9 kepler452 · poltergeist
methuselah sweeps · m51`.

## Workflow
1. Generate art (see `docs/art-direction/STAR-MAP-PROMPTS.md`). Transparent-background PNGs are best
   for planet tokens; SVG is ideal if your tool can export it.
2. Save here with clear names (`planet-<id>.png`, `starmap-bg.png`).
3. Add them to `manifest.json` above — or just tell Claude what you saved and it'll wire them.
4. Reload `run.html?chart` — the art appears in place of the dots.
