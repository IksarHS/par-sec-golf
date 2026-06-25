# Debug-loop session — findings & fixes (real-browser, landscape PC build)

Ran the debug-driven bug-hunting loop on the landscape game in real Chrome. Summary of what was wrong,
what got fixed, and how each was verified. **All fixes are ON by default in the local build**; the public
bundle (`tools/build.cjs`) is unaffected except for the `run.js` band change (see "Deploy note").

## The bugs (root-caused, not guessed)

1. **Terrain "repaints randomly" on hole transitions.**
   Root cause: the refined per-hole *place* conditions (`slick→ice`, `hotrock→rock`, `sticky→mud`) paint a
   material band onto the live fairway at hole-entry (`_paintBand`) and un-paint it on exit
   (`_restorePaintedBand`). The un-paint fires during the transition while the just-played hole is still
   on-screen, so you watch mud/ice revert to grass. Intermittent because only ~1–2 holes/course roll a
   condition. **Not** a cross-planet leak.

2. **"Trappist / Barnard materials recolouring on Luna."**
   Root cause: a *debug artifact*, not a real bug. cam-debug's recolour watch named colours by nearest
   pixel-colour match against a palette holding **every** planet's materials, so grey Luna stone/rock got
   mislabelled with Trappist/Barnard material names. The actual `.mat` was always legit. Verified: 0
   off-palette vertices across Earth/Luna/Trappist/Barnard.

3. **Vertex count drifts down mid-course; "vertex #61 deletes and remakes itself."**
   Root cause: `flattenCup()` (core `level-design.js`) heals a sunk cup by **deleting ~6 notch vertices and
   splicing in 2 flat ones** (net −4/hole), which **reindexes** the array. Index-based references then point
   at neighbours (the documented band-leak / strata-pop class), and the on-canvas vertex numbers renumber
   mid-run. Proven: `flattenCup` net −4 each sink, cup on-screen (screen-x ~120) when it fires.

4. **Debug loses data / 8-line scroll.** cam-debug keeps only 8 event lines, so `info`-level recolours
   scroll away before you can read them.

## The fixes

- **Bands baked at generation** (`src/roguelike/run.js`, ON by default, `?nobake` to disable).
  `RG._bakeBands()` paints every hole's band onto its own vertices once at course start (off-screen, during
  planet travel), and the runtime paint/restore is skipped. Terrain materials are now static during play →
  zero recolours. Physics unchanged (the band material encodes slick/dead/bounce; refined band conditions
  have no separate `apply`). `RG._audit` suspends baking (`_bakeSuspended`) so the determinism hash is
  byte-identical — **verified: audit hashes identical with and without baking.**

- **In-place cup heal** (`src/flatten-stable.js`, ON by default, `?novstable` to disable).
  Overrides `flattenCup` to **raise the existing cup-zone vertices onto the flat rim line** instead of
  delete+splice. Same visual heal, but vertex count and identity are **frozen for the whole run** (no
  reindex, no renumber). Proven: net 0 every sink, vlen constant across a course.

- **Data-based recolour debug.**
  - `src/recolor-watch.js` (new, `?dbg`): persistent log (`window.__recolors`, `recolorReport()`) of REAL
    `.mat` changes by vertex identity, with on/off-screen flag and an off-palette LEAK detector that reports
    the TRUE material name. Up to 4000 events, nothing scrolls away.
  - `src/cam-debug.js` recolour watch converted from pixel-colour-guessing to `.mat`-by-identity, so the
    on-screen line only reports real repaints (no more "ice→teal", "stone→trappist_glacier_ice").

## Verified clean

- **0 recolours, 0 leaks** across Earth, Luna, Trappist, Barnard (data-based, speed-1 real gameplay).
- **Planet-travel terrain swap is hidden by the deep-space void** (frame-by-frame capture: the vertex array
  swaps while the screen shows only stars; luna terrain rises in already-correct).
- **Within a course, vertex array is frozen** (no on-screen pop). The only swaps are at the planet boundary,
  hidden by the void.
- **Ball screen-x is consistent** (~110–131) at every normal hole start; only the first hole right after a
  crane landing differs slightly (pre-existing landing framing), and the ship-apron past hole 9 is not a hole.
- **Determinism preserved** — `RG._audit` byte-identical with/without baking.
- **No regression** — full seed-1000 run clears all holes incl. the ice holes; `stuck: null`; 0 JS errors.

## Mobile (portrait) build — same test, also clean

Ran the identical data-based test on the mobile build (`?portrait`, 320×540 phone box, 5-hole courses) at
speed 1. The fixes are orientation-agnostic (default-on regardless of build):

- **0 recolours, 0 leaks, 0 JS errors** across Earth → Kepler-90b → Proxima-d.
- **0 mid-course terrain pops** (vertex array frozen within a course, like PC).
- **Planet-travel swap hidden by the void** — verified by frame capture (the swap lands on the
  "COURSE COMPLETE" recap / planet approach card over stars; no terrain rendered at the swap).
- Ball screen-x *does* vary per hole in portrait (38–219), but that's **by design** — portrait uses
  fit-to-content framing (per-hole zoom/pan so each hole fills the phone), so the ball's screen position
  legitimately changes. Not a bug (unlike landscape, where it should be constant and is).

## Build labeling (Par Sec vs Par Sec Mobile)

The two builds are now clearly distinguished:

| | Landscape (PC) | Mobile (portrait) |
|---|---|---|
| URL | `run.html` | `run.html?portrait` |
| Tab title | **Par Sec** | **Par Sec Mobile** (set in `portrait.js`) |
| Debug mode tag | **🖥 PAR SEC (PC)** | **📱 PAR SEC MOBILE** (cam-debug) |
| Holes / course | 9 | 5 |

## Files touched (all peel-off / debug; core engine untouched)

- `src/roguelike/run.js` — bake-at-gen (`_bakeBands`, `_BAKE`, `_bakeSuspended`, `_applyHoleCondition` /
  `_restorePaintedBand` guards, `_audit` suspend).
- `src/flatten-stable.js` (new) — in-place cup heal override.
- `src/recolor-watch.js` (new) — persistent data-based recolour + leak log.
- `src/cam-debug.js` — recolour watch made data-based; mode tag now "🖥 PAR SEC (PC)" / "📱 PAR SEC MOBILE".
- `src/roguelike/portrait.js` — sets the mobile tab title to "Par Sec Mobile".
- `run.html` — two `<script>` tags in the local-only debug block (not in `build.cjs`).

## Deploy note (when promoting to public)

`run.js`'s bake change rides in the bundle, so it ships when deployed (desired — it's the fix). The cup-heal
override (`flatten-stable.js`) and `recolor-watch.js` are **local-only** (not in `build.cjs`); to ship the
cup fix publicly, fold the in-place heal into core `flattenCup`. Escape flags `?nobake` / `?novstable`
restore the old behaviour for A/B.
