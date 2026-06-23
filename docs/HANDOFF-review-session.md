# HANDOFF — Par Sec live-review session (resume here)

Single source of truth to resume the playtest/review loop after a context clear. Written 2026-06-23.

## What this is
"Par Sec" = flat-faceted Desert-Golfing-in-space golf game. Repo: `/mnt/c/dev/indie/active/faceted-golf`
(= `C:\dev\indie\active\faceted-golf`). Branch **`dream-build-session`** (this IS GitHub `main`). Local
`master` is the OLD pre-session state — stay on `dream-build-session`.

## URLs
- **LIVE public game (shareable):** https://iksarhs.github.io/par-sec-golf/ — repo `IksarHS/par-sec-golf`
  (a NEW public repo; August's old PRIVATE `par-sec` was deliberately left untouched). `?portrait` = mobile;
  `/?course=<id>` deep-links a body (caldra=ziggurat, vesh=cave, tauceti_g=composed). PWA installable.
- **LOCAL dev server (this PC/LAN):** http://172.19.97.28:8236/run.html — raw source, instant reload.
  Use **http://localhost:8236/...** for the WebGPU prototypes (WebGPU needs a secure context = localhost/https).
- **Master (old) build, if needed:** http://172.19.97.28:8237/run.html (separate worktree at `/mnt/c/dev/par-sec-master`).

## The CURRENT workflow (what we're doing)
August is **reviewing #1 (the main landscape game) on the LOCAL build** (run.html), giving feedback as he
plays. For each item: **dispatch ONE focused subagent to fix it** (edit source, test, no commit/deploy),
keep yourself AVAILABLE for the next note. Hard-refresh local shows fixes instantly. **Batch deploys to the
public link** when a batch is good — don't churn the live URL every 30s. He likes specific feedback enabled
by the DEBUG OVERLAY (below).

## DEBUG OVERLAY (for the review)
`src/roguelike/debug-hud.js` (+ a `<script>` tag in run.html). Toggle with **backtick `` ` ``** or load
`run.html?debug`. OFF by default, gated, DOM overlay. Shows: PLANET·HOLE/PAR/STROKES·STATE·BALL x,y·SPEED·
SURFACE(material)·DIST→CUP·ZOOM·W·FPS. **LOCAL-ONLY** — NOT in build.cjs SCRIPTS (public stays clean). Add
it to build.cjs only if August wants `?debug` on the public/phone build.

## Deploy flow (public game)  — esbuild is installed locally (node_modules, gitignored)
```
cd /mnt/c/dev/indie/active/faceted-golf
node tools/build.cjs                      # builds dist/ (game ONLY; build.cjs "section 6" is intentionally empty)
# pre-push safety: dist has index.html+parsec.min.js, NO dist/prototypes, and your fix is in the bundle
git add <specific files> dist/ ; git commit -m "..."
git push origin dream-build-session:main
git push origin "$(git subtree split --prefix=dist HEAD):refs/heads/gh-pages" --force   # subtree FORCE-push (plain `git subtree push` corrupted gh-pages once)
# wait ~1-3min, then verify: curl the live bundle for a LITERAL token (var names get minified), browse-check
```
**POLICY:** public build = polished GAME ONLY. NEVER publish experiments/prototypes unless August opts in.

## What's LIVE now (deployed, HEAD 6e79156)
Dream hole-gen + Tau Ceti system; meta layer (scorecard/text-map/save-login); mobile tuning (static portrait
camera, screen-edge bounce, lower mobile power, more Earth-grass roll, gentler early planets); **PC-portrait
phone-box** (resizeDisplay constrains to 9:19.5 in portrait so desktop shows what a phone sees).

## Just-finished (both DONE + committed as of handoff — HEAD `fad302b`)
1. **Portrait dead-sky framing fix** — DONE + **DEPLOYED LIVE** (commit `34d358a`). Fit-to-content portrait
   camera: per-hole zoom + vertical pan so the hole fills the frame (ball lower-third, cup visible, ~30-40%
   sky vs the old ~75%). Gated; landscape byte-identical; verify 72/72; critic "ship it". Live now.
2. **Ball-agent secret-talk + LLM fix** (`prototypes/ball-agent.html`, LOCAL-only, commit `fad302b`):
   removed `response_format:json_object` (fixes WebLLM `CompileJSONSchema BindingError`); removed the intro
   bubble + hid the TALK button & text input (talking is a SECRET now); **push-to-talk = hold `T`**; backtick
   = debug menu (load the model there). Verified headless. Tree is CLEAN at handoff.

## Local prototypes (LOCAL-only, NOT public)
golfball-llm.html (model picker `?model=`, Hermes-3 default), ball-agent.html (talking ball on a real
2-planet×3-hole loop, backtick debug, hold-key talk), golforbit-planet.html, softbody-planet.html,
ssg-camera.html (Stickman campaign), aesthetics.html, physlab.html, striking.html. Research:
`docs/RESEARCH-local-conversational-llms.md`, design: `docs/DESIGN-hole-generation.md`, `DREAM-BUILD-PLAN.md`,
`PERF-AUDIT.md`, `STICKMAN-LEVELS-PLAN.md`.

## Known/pending (not urgent)
- Edge-bounce has NO visual cue (looks invisible) — add a faint wall line + impact pop if August wants.
- TestFlight/iOS app = DEFERRED: Capacitor + Codemagic cloud-mac CI + his $99 Apple acct (he'll say when).
- Cloud saves = optional Vercel `api/save.js` (needs his 1-time Vercel login; localStorage works now).

## Gotchas (cost real time this session)
- `history` collides with unforgeable `window.history` → use `convo`. WebLLM `json_object` mode crashes
  (CompileJSONSchema) → prompt for JSON + parse manually. WebGPU needs localhost/https (secure context).
- `resizeDisplay` (art.js) fills the WINDOW + is bound to the resize event → portrait must constrain inside it.
- Grep the MINIFIED bundle for LITERALS (strings/numbers like `19.5`), not local var names (esbuild renames).
- Deliver GIFs to August as MP4 + contact-sheet via SendUserFile proactive (he can't view GIFs in chat).
</content>
