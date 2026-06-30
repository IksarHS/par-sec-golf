# Par Sec — Performance Audit (load-time + frame-rate)

**Scope:** read-only audit of the live build at `devbuild.html`. Measured on the dev server
(`http://172.19.97.28:8236/devbuild.html`) with an isolated headless Chromium (gstack/browse).
No source was edited. Date: 2026-06-22.

> **Headline:** Par Sec is already **render-cheap** — the live build ships the *flat-vector*
> renderer (the expensive textured-terrain path is force-disabled by `run.js`), draw cost is
> ~0.1–0.4 ms/frame, heap is ~9.5 MB, and FPS is a clean locked 60. The real wins are on the
> **LOAD** side (64 unbundled/uncompressed scripts + 2.6 MB of likely-unused sprite PNGs) and one
> **runtime stall**: the bot-solver hole verification that blocks the main thread ~168 ms at the
> start of every run.

---

## 1. Measured baseline

### Load (dev server, localhost-fast network; cold navigation)
| Metric | Value |
|---|---|
| Wall-clock `goto` → loaded | ~685 ms (first server spin-up); steady-state `load` event **251 ms** |
| domContentLoaded / domInteractive / load | **251 ms** (all equal — fully synchronous boot) |
| Total resources | **65** |
| Total bytes (uncompressed) | **3.79 MB** |
| Script requests | **55 files / 1.17 MB** (in HTML: **64 `<script src>` tags**, all render-blocking) |
| Image requests | **9 files / 2.60 MB** (68% of all bytes) |
| Font | 1 woff2, **22.8 KB**, preloaded — handled well |
| Compression | **none** (server sends identity; `level-design.js` = 248 KB raw, ~40 KB gzipped) |
| Cache policy | `Cache-Control: no-store` (dev-only; **must not** ship to prod) |
| Console errors | none |
| JS heap after boot | **9.5 MB** used |

> Caveat: these byte/RTT costs are hidden on localhost. On a real network the 64 serial script
> requests + 1.17 MB uncompressed JS + 2.6 MB images are the actual load wall.

### Frame rate / runtime cost
Canvas backing store at test = 1280×720, `devicePixelRatio` 1. Headless caps rAF at 60 Hz.

| Scenario | draw() cost | Frame interval | Notes |
|---|---|---|---|
| At rest (hole 1, Earth) | **0.10 ms** avg, p95 0.2 ms | 16.67 ms, p95 16.7, 0 long frames | Locked 60 fps |
| During ball flight | **0.14 ms** avg, p95 0.2, max 0.3 | 60 fps | No jank |
| Textured-terrain path *(if it were on)* | 0.38 ms avg, max 1.4 ms | — | **Disabled in live build** |
| Full hole gen (terrain only, all 9) | **~0.6 ms** total | — | Trivial |
| **Full `RG.startRun` (gen + verify, all 9)** | **~168 ms median** (165–179) | **blocks main thread** | The stall |

**The 168 ms is ~99% bot-solver verification, not terrain.** Disabling `RG.bot` during
`startRun` drops it from 168 ms → **0.6 ms**. Each hole runs `_validateHole`
(`src/level-design.js:5586`): up to 20 bot shots × a 20-step search grid, each
`simulateShot` running physics to rest. 9 holes × that search = the stall.

---

## 2. Prioritized optimizations

Ordered by impact ÷ effort. Effort S/M/L. "Impact" tagged LOAD or FPS/STALL.

| # | Issue | Fix | Impact | Effort | Risk |
|---|---|---|---|---|---|
| 1 | **2.6 MB sprite PNGs eagerly preloaded at boot** (`shared.js:58` loops `new Image()` over all 9). `lunar_lander.png` alone is 1.57 MB / **1635×1414 px**. These are desert-golfing-era assets; the flat-vector Earth/Moon tour renders no sprites (screenshot = pure polygons). | Lazy-load sprites on first use, or gate the preload behind the modes that actually place them. At minimum, **don't preload in the run build.** | **LOAD: −2.6 MB (≈68% of bytes), −9 requests** | **S** | Low — verify no default hole places a sprite (objects[] empty on Earth/Moon) |
| 2 | **No HTTP compression** — 1.17 MB JS ships uncompressed | Serve gzip/brotli in production (static host / CDN does this automatically; or add to the Python dev server). | **LOAD: ~1.17 MB → ~250 KB JS over the wire** | **S** | None |
| 3 | **Bot-verify stall ~168 ms blocking** at every `startRun` (boot + every new run) | (a) Generate+verify hole 0 synchronously, verify holes 1–8 lazily / off the critical path (idle callback or just-in-time as the player approaches). (b) Or reduce the verify grid (20-step) / shot cap for the up-front pass. (c) Or cache verified seeds. | **STALL: −150 ms+ off boot & transitions** (the "hole-transition flicker") | **M** | Med — must keep deterministic seeding + solvability guarantee intact |
| 4 | **64 render-blocking `<script>` tags, unminified** (1.17 MB raw) | Bundle + minify into 1–2 files for the production build (keep the unbundled tree for dev; the "peel-off-able" architecture is a dev convenience, not a ship requirement). esbuild can do this in <1 s. | **LOAD: 64 RTTs → 1–2; ~1.17 MB → ~400 KB minified (~120 KB gzipped)** | **M** | Low — pure build step, behavior-identical |
| 5 | **`Cache-Control: no-store`** on everything | Production host must send real cache headers (long-cache hashed assets). Dev `no-store` is correct and should stay in dev only. | **LOAD: repeat visits ~instant** | **S** | None (deploy-config only) |
| 6 | **No DPR cap / no resize debounce** (`art.js:2`). On a 4K/Retina display the backing canvas is `vw·dpr × vh·dpr` (4–9× pixels); `resize` re-runs uncapped on every event. | Cap `dpr` at ~2; debounce `resizeDisplay`. Fill-rate is cheap today so impact is modest, but it protects high-DPI laptops/4K. | **FPS on hi-DPI: prevents fill-rate cliff** | **S** | Low |
| 7 | **`perf-hud.js` runs a `requestAnimationFrame` tick every frame in the public build** (its `tick()` always reschedules; measurement work is gated by `on`, but the rAF + `performance.now()` still fire). Several other dev overlays (`cam-debug`, `feel`, `seqtest`) also ship and self-gate. | In the production bundle, drop the dev-only files (perf-hud, cam-debug, editor, editor-trace, feel, playtest-bot, seqtest, testjump, showcase, lab, all `atlas-*` not in the default tour). Tie to #4. | **LOAD: ~−400 KB JS; FPS: a few idle rAF callbacks removed** | **S–M** | Low — already URL-gated, just exclude from ship build |
| 8 | ~~**Strata/crust/dune textured path** — per-segment `createLinearGradient` + 2 full-canvas `soft-light` passes every frame.~~ **RESOLVED 2026-06-30: the entire `drawTexturedTerrain`/`TERRAIN_TEXTURE_ON` feature was deleted** (dormant in the shipped game). The flat faceted renderer is the only terrain path now. | — | — | done |

---

## 3. Quick wins (safe, do first)

These are low-risk and don't touch the deterministic sim or the peel-off dev architecture:

1. **#1 — Stop preloading the 2.6 MB sprite PNGs in the run build** (or lazy-load). Single
   biggest byte win, ~68% of total payload, almost certainly dead weight for the flat-vector tour.
2. **#2 — Turn on gzip/brotli** in production (free ~75% off the 1.17 MB JS).
3. **#5 — Real cache headers in prod** (`no-store` is dev-only).
4. **#6 — Cap `devicePixelRatio` at 2 + debounce resize** (cheap insurance for 4K/Retina).
5. **Re-export `lunar_lander.png`** down from 1635×1414 (it renders at ~95 px tall) — if it's kept
   at all, it should be a fraction of 1.57 MB.

Together #1+#2+#5 take the over-the-wire payload from ~3.8 MB to roughly **~0.5–0.7 MB** with no
gameplay change.

## 4. Bigger bets (need a decision)

1. **#3 — Defer/restructure the bot-verify stall (~168 ms).** This is the only real runtime hitch
   and the likely cause of the known hole-transition flicker. The fix touches the
   solvability-guarantee + deterministic seeding, so it needs care: verify hole 0 up front, then
   verify the rest lazily or move it off the main thread. High payoff (smooth boot + transitions),
   medium effort, medium risk.
2. **#4 + #7 — Introduce a production build step (bundle + minify + tree-shake dev tooling).** The
   current 64-tag "peel-off-able" layout is a great dev workflow but a poor ship artifact. An
   esbuild step that emits one minified `parsec.min.js` for prod (and keeps the raw tree for dev)
   turns 64 blocking requests + 1.17 MB into 1 request + ~120 KB gzipped. The decision is whether to
   adopt any build tooling at all (the project is currently zero-build vanilla JS).

---

## 5. What is already good (don't "fix")

- Flat-vector renderer is genuinely cheap: ~0.1–0.4 ms/frame, no per-frame GC churn worth chasing,
  9.5 MB heap, locked 60 fps at rest and in flight.
- The expensive textured-terrain path is correctly force-disabled for the shipped look.
- Font loading is handled well: woff2 preloaded, splash text held until `document.fonts.load`
  resolves (no FOUT/swap reflow), with a 600 ms fallback so boot never blocks on it.
- Fixed-timestep accumulator decouples sim from refresh (no fast-forward on 144 Hz, no motion
  pause on a dropped frame) — keep it.
- Terrain draw already does a binary-search visible-window cull (`_bsearchVertex`) and material-run
  batching — it's not redrawing off-screen geometry.

---

### Measurement method (for reproduction)
- Headless Chromium via `~/.claude/skills/gstack/browse/dist/browse` with an isolated daemon
  (`BROWSE_STATE_FILE=/tmp/perfaudit/state.json`).
- Load: `perf`, `network`, and `performance.getEntriesByType('resource'|'navigation')`.
- FPS: rAF interval sampler over 2 s windows (avg/p50/p95/max + long-frame count).
- Draw cost: wrapped `window.draw` with `performance.now()` deltas, 1.5–2 s windows.
- Stall: timed `RG.startRun` (5 runs) with bot enabled vs. `RG.bot=null` to isolate the verify cost.
- Headless rAF caps at 60 Hz, so "60 fps" = "comfortably under a 16.7 ms budget," not a hardware ceiling.
