# HANDOFF — Windows + real-browser DEBUG LOOP (your first task)

You are a fresh Claude Code session running **natively on Windows** with the **Claude-in-Chrome**
integration (`/chrome`) — so you drive a **REAL, visible Chrome** with real GPU + real rendering. That is
the entire point of this task: you can **see** things a headless browser cannot.

**Read for orientation first:** `docs/HANDOFF-chrome-session.md` (repo path, dev server, current game
state) and `docs/HANDOFF-review-session.md` (URLs, deploy flow, gotchas). Repo is `C:\dev\indie\active\faceted-golf`.

---

## YOUR TASK: run the debug-driven bug-hunting LOOP on the PC (landscape) game

This is a specific working style we want you to execute and iterate on. Do it **autonomously** — don't ask
permission for each step; run the loop and report findings as you go.

### The loop (this is the whole methodology — internalize it)
1. **Run the game and WATCH real gameplay.** Open the landscape game, turn on the debug overlay, and drive
   it — use the autoplay bot (`RG.bot.start(...)`) and/or play manually. **Actually look at frames**
   (screenshots), don't only read numbers. You have a real browser now — use your eyes.
2. **Watch the debug for anything abnormal** — the readout has a `● OK / ⚠ PROBLEM` banner, plain-English
   game states, material names, and live detectors (material leaks, camera/zoom pops, a per-transition
   camera-path recorder, a persistent problem log).
3. **Investigate the ROOT CAUSE before fixing.** Iron rule: no fix without a root cause.
4. **If the existing debug can't tell you what's wrong → WRITE BETTER DEBUG.** Add instrumentation: a new
   detector, a per-frame trace, a histogram, a "record the last N frames around event X" buffer — whatever
   reveals the issue. Reload, watch again. **This is the heart of the loop:**
   `debug → watch → not enough info? → write better debug → watch → root-cause → fix → verify → repeat`.
5. **Fix the bug, then VERIFY your own fix with evidence** — re-run, confirm the anomaly/detector is now
   clean. Do not trust; verify (e.g. "before: detector fired 2×; after: 0×").
6. **Repeat.** Keep hunting. Improve the debug as you go so the next bug is easier to catch.

### What to hunt (lean into your new superpower)
Prioritize **render / visual glitches that a headless browser literally could not see** — real GPU and
real frame rendering are exactly what you add. Strong starting focus: **camera + transitions.**

> Known open lead: on the game, transitions between holes have shown "glitches / different screens flashing
> for a split second." We already fixed a one-frame **zoom-pop**, and the **numeric camera path is provably
> smooth** (0 jumps/reversals/spikes — verified headless). So the remaining glitch is in **rendered content**
> or is **device/real-render specific** — i.e. invisible to numbers, visible to *you*. Watch transitions at
> **speed 1** (every frame drawn, like real play), capture frames around the cut, find the bad frame, then
> root-cause it. The headless tooling has a camera-path recorder you can extend.

After that, keep going on whatever the debug surfaces (terrain, ball, HUD, perf, errors…).

---

## Tools you already have (build on these — don't rebuild)
- **Game URLs:** landscape/PC = `http://localhost:8236/run.html` (start the dev server from WSL if it's
  down — `localhost` forwards to Windows). Mobile = add `?portrait`; roguelike = `?portrait&rogue`.
- **Debug overlay:** backtick `` ` `` opens the unified **debug menu** — toggle *Stats HUD*, *Camera / hole
  debug*, *Vertex numbers*, *Perf HUD* independently (all draggable/resizable). `?dbg` also works.
- **The Camera/hole readout** (the rich one) has: the OK/PROBLEM banner, plain states (AIM/FLIGHT/IN-CUP/
  TRANSITION/…), material names, a **material-leak** watch, a **camera/zoom-pop** detector, a
  **per-transition camera-path recorder**, and a **persistent problem log**. Inspect via in-page JS:
  `window.__dbgProblems` (all problem/warn events this session), `window.__camTraces` (per-transition
  paths + smoothness stats), `window.__camRoll` (continuous last-~240-frame camera log).
- **Autoplay:** `RG.bot.start({runs:N, speed:S})`, `RG.bot.stats()` (reports stuck holes), `RG.bot.stop()`.
  Use **speed 1** when you need to *see* per-frame rendering; higher speeds skip drawn frames.
- **Debug-tooling files (dev-only, excluded from the public build):** `src/cam-debug.js` (extend this for
  new instrumentation), `src/debug-menu.js`, `src/roguelike/debug-hud.js`, `src/roguelike/perf-hud.js`.

## Real-browser working tips (from testing this toolset)
- You **can eval arbitrary in-page JS** and read JSON-serializable return values — wrap everything in
  `JSON.stringify(...)`. That's how you read `RG`, `__rogue`, `__dbgProblems`, `__camTraces`, drive the bot.
- You **can't cleanly sleep between tool calls.** For timed observation, **push the loop into the page**:
  one `evaluate_script` with `setTimeout` that collects N samples into an array and returns it once. (That
  was the proven pattern.)
- For a real **mid-action screenshot**, run autoplay at **speed 1–2** so the moment lasts long enough to
  capture (at 8× the run finishes before a screenshot round-trips).

## Rules
- Autonomous. No fix without a root cause. Verify every fix yourself with before/after evidence.
- When the debug is inadequate, improving it **is** the work — then continue the loop.
- **Local only — do NOT deploy.** August reviews on the local build; deploying is a separate explicit step.
- All the debug tooling stays out of the public build (`tools/build.cjs` allow-list) — keep it that way.
</content>
