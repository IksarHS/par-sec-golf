# HANDOFF — Windows-native Claude Code + Chrome session

For a Claude Code session running NATIVELY ON WINDOWS (desktop-app Code tab, or `claude --chrome` in a
Windows terminal) with the **Claude in Chrome** extension connected. Purpose: drive a REAL Chrome (real GPU
+ rendering) to debug things headless/WSL couldn't. Repo is on the C: drive so Windows + WSL share the files.

## Repo + run
- Repo: `C:\dev\indie\active\faceted-golf` (= `/mnt/c/dev/indie/active/faceted-golf` in WSL). Branch `dream-build-session` (= GitHub main, public repo IksarHS/par-sec-golf).
- Dev server (started from WSL): `http://localhost:8236/run.html` (WSL2 forwards localhost to Windows). LAN: `http://172.19.97.28:8236/`. If it's not up, run `python3 -m http.server 8236` (or the project's server) from the repo root in WSL.
- Connect Chrome: run `/chrome` in the session, then ask it to open a URL.

## What to debug with a REAL browser (the whole point)
1. **LLM golf ball (WebGPU) — untestable headless (no GPU adapter).** Open `http://localhost:8236/prototypes/ball-agent.html` (MUST be localhost for WebGPU secure context). Press backtick for the debug menu → LOAD LOCAL BRAIN (Hermes-3 3B default). Verify: WebGPU adapter found, model downloads + comes online, then talk (hold `T`, mic) or type via the debug type-box. The whole WebLLM path needs a real GPU.
2. **Camera transition "glitch" — real rendering only.** Open `http://localhost:8236/run.html?portrait&rogue` and play/watch hole→hole transitions. We FIXED a one-frame zoom-pop (verified 0 in headless), but August still sees glitches on the real device that headless can't reproduce — likely a render/content artifact or device-specific. The cam-debug tooling has a camera-pop + per-transition path recorder (enable via the debug menu / `?dbg`); use real-frame capture to find the bad frame.

## Current game state (so you're oriented)
- **Roguelike "Galaxy Run"** is LIVE behind `?portrait&rogue` (also the PWA install via manifest start_url). Core loop only: 3 lives, par-buffer economy (lose a life if your COURSE total goes over par at a hole's end; cushion resets EVEN each course), 5-hole courses → endless planet travel, money per course, PC-style text HUD, game-over → tap retry. First hole of each course is difficulty-capped easy (portrait only).
- **NOT built yet — Slice 2:** the shop between courses + special balls (sticky/wall/stop, then whackaball) + the bag (pick-per-shot). `bag:['normal']` placeholder exists in `src/roguelike/galaxy-run.js`.
- Dev-only debug tooling (NOT in public build): unified debug menu `src/debug-menu.js` (backtick), `src/cam-debug.js` (plain-English readout, leak + camera-pop detectors, transition path recorder), debug-hud, perf-hud. All draggable/resizable, excluded from `tools/build.cjs`.

## Deploy (public game, only when August asks)
`node tools/build.cjs` → `git push origin dream-build-session:main` → `git push origin "$(git subtree split --prefix=dist HEAD):refs/heads/gh-pages" --force`. Verify live bundle md5 matches `dist/parsec.min.js`. Public default (no `?rogue`) = the polished normal game; keep dev tooling out of the bundle.

## Read also
`docs/HANDOFF-review-session.md` (the original review-loop handoff: URLs, deploy flow, gotchas).
</content>
