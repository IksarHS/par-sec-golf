# Par Sec golf — full repo audit (2026-06-30)

Whole-repo pass, 141 files (excl `.git/`, `node_modules/`). Two products: **(A) everything playable/testable** so we can pull each up, and **(B) flagged unused/dead** for 1-by-1 deletion review. Server: `python serve.py` → http://localhost:8231/.

Wiring fact: all `src/*.js` load via `<script src>` in global scope (no imports); "used" = its globals are referenced live AND it's in a non-commented script tag / `tools/build.cjs` ship-list.

---

## A. PLAYABLE / TESTABLE CATALOG

### Entry pages
| URL | What |
|---|---|
| `/` (index.html) | dev launcher menu → deep-links into devbuild.html modes + tools |
| `/devbuild.html` | the game (dev build, ~60 unbundled scripts). Default boot = Earth tour |
| `/starmap.html` | star-map screen, standalone (also the in-game ✦MAP overlay) |
| `/fxlab.html` | landing-debris particle FX tuner |
| `/physlab.html` | physics-feel tuner (gravity/restitution/materials) |
| `/experiments/striking.html` | 4 shot-control schemes side-by-side (keys 1–4) |
| `/experiments/ball-agent.html` | talking golf ball + in-browser local LLM (hold T); heavy |
| `/experiments/golforbit-planet.html` | round-planet radial-gravity golf (self-contained) |

### The course catalog — `devbuild.html?course=<id>`
**planet-gen.js (shipped tour content):**
- Base tour (default itinerary): `earth, luna, mars, phobos, jupiter, io, europa, ganymede, saturn, titan, enceladus, uranus, miranda, neptune, triton, pluto, charon`
- TRAPPIST-1: `trappist1, trappist1b..h, geryn, fenra, elai`
- Barnard's Star: `barnard_star, barnard_b, barnard_d, barnard_e, veil, hollow, ember, tidewell, solace`
- Kepler-90: `kepler90, kepler90b..i`
- Proxima Centauri: `proxima, proxima_b, proxima_c, proxima_d, wisp, cinder`
- **Tau Ceti (the DREAM/holegen pipeline — only way to see it live):** `tauceti, tauceti_e..h, liss, caldra, vesh`
- Complexity ramp: `p1` … `p24`
- GoM biomes: `gom, gom-cobalt, gom-teal, gom-jade, gom-rose`
- Flood-water: `sea, atoll, lakes, abyss`

**worlds/run.js:** `run-course` (Mars Front Nine), `earth-course, earth2, earth3, earth4`, `moon, moon2, moon3` (the only `gen:'field'` courses → only way to see moon-terrain.js)

**Atlas (src/atlas/, 46 courses) — `?course=<id>` or `?galaxy`/`?atlas` cycler:**
- galaxy.js data planets: `g-ferro, g-caucho, g-glacio, g-limus, g-patch, g-crags, g-cascade`
- homesystem.js (6 bodies ×3): `mercury-1..3, venus-1..3, io-1..3, europa-1..3, titan-1..3, jupiter-1..3`
- fields: `field-well, field-gusts` · fields2: `field-updraft, field-magnet, field-repulsar, field-wind, field-drift`
- creatures: `creature-fen, creature-bulb` · relics: `relic-cairn` · portals: `portal-warp`
- onlyup: `ascent-spire` · climb: `climb` · blocks: `blocks` · golf-orbit: `golf-orbit`
- objects: `plume-vents, bump-rings` · watersim: `watersim` (or `?watersim`) · particlefluid: `particlefluid`
- setpieces: `set-relay` · puzzle-mode: `puzzle` (`?level=N`)

### Dev/lab tools & params (devbuild.html unless noted)
`?showcase` generator browser · `?edit` hole editor (+screenshot trace) · `?dev` cheats+feel panels · `?debug` engine read-out · `?perf`/Shift+D frame-time · `?dbg` cam/recolor diagnostics · backtick ` ` ` debug menu · `?portrait` mobile mode · `?physics=realistic`/F physics A/B · `?seq` transition A/B · `?goto=<pt>` deep-links · `?fx`/`?gfx` post-process labs · `?terrain=` / `?juice=` / `?travel=` / `?event=` / `?recap=` knobs · M = star map

### Headless tools (CLI)
`node tools/build.cjs` (→dist) · `node tools/verify.cjs all 5` (completability) · `node tools/dream-funreport.cjs` · `dreamgen-proto.cjs` · `dreamboard-render.cjs` · `noise-proto.cjs` · `python tools/trace_hole.py <img>`

---

## B. FLAGGED — unused / dead / stale (for 1-by-1 review)

### B1. Whole files — DEAD / ORPHAN (high confidence)
| File | Evidence |
|---|---|
| `src/weird-terrain.js` | Defines `gen:'weird'` terrain; **no course config anywhere sets `gen:'weird'`** — only 3 inert guard branches consume it. Never reached in play or via any `?course=`. **Still ships in build.cjs = dead weight.** |
| `src/roguelike/login-ui.js` | `<script>` commented out (devbuild.html:113), absent from build.cjs; `RG_LOGIN` never created live. (Intentionally parked — "re-enable by uncommenting" — your call.) |

### B2. ✅ DONE — Dead code WITHIN live files removed (roguelike-strip residue)
All excised + verified (node --check green, game boots/plays/travels/recaps clean). −162 lines across 11 files:
- `run.js` — `v.mat==='anomaly'` guards (×3) + the dead `anomalyX`/`faultHole` scan; `RG_secret('ship')` apron blocks; `rgSecretPointer` router (`RG_runSecretHook`); `inFault`/`inVault` guards. **Kept** `_faultHash` (live, repurposed).
- `wrap.js` — `RG_secret('ship')` branch; 4× `RG_ECON.drawTakeLine` no-ops; `RG.failed` "RUN FAILED" recap; `showVault` param.
- `economy.js` — `settleRun()` inVault/inFault guard + rewrote stale money/shop header.
- `travel.js` — variant-2 `RG_SHIP` ship-crossing path.
- `playtest-bot.js` — `RG_SHIP…launchToMoon` branch (**kept** the live solver).
- `testjump.js` — `completeShip()` + `?goto=ship/launch/finale/courseend` cases (kept earth/mars/moon/holeN/last/cup/cond/recap).
- `event.js` — `grantCredit()` no-op + `scoutFact()` `_faultTile` path.
- `ambient.js`, `juice.js`, `event.js`, `wrap.js` — the remaining same-pattern `inFault`/`inVault` guards.
- Stale comments fixed: `save.js`, `terrain.js`, `run.js:1016/1029`.

### B3. ✅ DONE — Stale docs deleted
- `docs/MARSGOLF-REQUIREMENTS.md`, `docs/DESIGN-hole-generation.md`, `docs/DREAM-BUILD-PLAN.md` — all describe work since built; obsolete handoff specs. **Deleted.**
- `docs/PERF-AUDIT.md` — **KEPT** (still-useful perf reference; cites old port `:8236` + some done recs, but FPS/render observations stand).

### ⏸️ HELD — your call (not deleted)
- `src/roguelike/login-ui.js` — complete working login overlay, deliberately parked ("re-enable by uncommenting"). Dormant-by-intent, not rotted. Say the word to delete.
- `RG.failed` flag + `!RG.failed` guards — always-false legacy scaffolding `run.js` documents keeping; removing the flag entirely is a broader change than the recap branch. Left intact.

### B4. Content reachable only via dev shortcuts (medium — "in repo, not in the game") — NOT deleted (real content)
- `src/moon-terrain.js` — real + bundled, but only via `?course=moon/2/3`; the tour's Moon body is `luna` (faceted). Never seen in normal play.
- holegen `caves.js` concepts `cantilever`, `mushroom_rocks` — showcase-only (no Tau Ceti hole uses them)
- holegen `setpieces-dream.js` bodies `twin_horns, orbital_ring, broken_bridge, moon_shards, derelict_hull, balanced_hoodoo` — showcase-only (not on the Tau Ceti tour)

### B5. Dev-only / experiment-only — NOT shipped, but you use them for testing (decide per your workflow; NOT recommended for deletion)
- `src/showcase.js` (?showcase), `src/lab.js` (?course=lab), `src/striking-variants.js` (experiments/striking.html)
- `src/fxlab.js`+fxlab.html, `src/physlab.js`+physlab.html
- `src/cam-debug.js`, `src/debug-menu.js`, `src/editor.js`, `src/editor-trace.js`, `src/flatten-stable.js`, `src/recolor-watch.js`
- roguelike dev-only: `lab.js, feel.js, debug-hud.js, perf-hud.js, physics-toggle.js, seqtest.js, testjump.js, fx-lab.js, gfx-lab.js`

### B6. Cosmetic / low
- `dist/index.html` + `build.cjs` reference a non-existent `dist/README.md` (dangling pointer in generated output)
- `dist/` is ~49 min older than `devbuild.html` — a rebuild is due (not broken)

### Clean — no action
All 16 atlas files (active, ship), all holegen modules (Tau Ceti pipeline), all CORE engine + roguelike runtime (16 ship), all fonts/icons (referenced), all tools (each has a workflow), `starmap-data.js` (shim, keep), experiments (standalone references, keep).
