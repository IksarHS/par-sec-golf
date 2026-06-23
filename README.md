# Par Sec — production build (`dist/`)

Static, zero-dependency build of **Par Sec** for **GitHub Pages**. Everything here is served
as plain files; there is no server-side runtime in the game itself (cloud saves are optional —
see below). Rebuild with `node tools/build.cjs` from the repo root.

## What's in here
```
dist/
├── index.html              # game entry (was run.html); loads ONE bundle
├── parsec.min.js           # all 55 runtime scripts, concatenated in load order + minified (~455 KB)
├── starmap.html            # the in-game ✦ MAP overlay (opened as an iframe by the game)
├── assets/fonts/           # Departure Mono (woff2 + woff + license) — the only runtime asset
└── src/
    ├── planet-gen.js       # used by starmap.html (the map reads the real tour itinerary)
    ├── starmap.js, starmap-data.js
    └── roguelike/
        ├── profile.js      # used by starmap.html (real per-planet scores on the map)
        └── manual.js, progression.js   # only fetched under ?full / ?secrets (document.write'd)
```
There is **no sprite folder** — the flat-vector tour places no sprite objects, so the 2.6 MB of
desert-era PNGs (`lunar_lander.png` + the cactus/plant set) are intentionally dropped. The bundle
patches out `shared.js`'s eager sprite preload so nothing 404s.

## How the bundle is built (and why it's safe)
Par Sec is **vanilla JS that shares globals across ~64 separate `<script>` tags** (NOT ES modules).
The build (`tools/build.cjs`):
1. **Concatenates** the runtime scripts in the exact `run.html` load order into one file.
2. **Minifies with esbuild using NO `--format` flag**, so top-level `let`/`const`/`function`
   declarations stay at true global script scope — exactly like the original multiple `<script>`
   tags. (`--format=iife` would wrap everything in `(()=>{…})()` and break the implicit global
   sharing — that is the #1 risk and it is explicitly avoided.)
3. **Excludes dev-only, URL-gated tooling** (editor, hole-lab, perf-hud, cam-debug, showcase,
   seqtest, testjump, feel). **Keeps `playtest-bot.js`** — `RG.bot` is used at runtime by
   `level-design.js`'s `_validateHole` to guarantee every generated hole is sinkable. Dropping it
   would silently skip solvability validation, so it is non-negotiable in the ship build.

Result: **76 requests / 3.90 MB → 3 requests / ~489 KB** over the wire (before gzip; your host's
gzip/brotli takes the JS down another ~70%).

## Relative paths (GitHub Pages subpath)
Every path in `index.html` and `starmap.html` is **relative** (`parsec.min.js`, `assets/...`,
`starmap.html`, `src/...`). A GitHub Pages **project site** serves at
`https://<user>.github.io/<repo>/`, so relative paths are required — do not change them to
absolute (`/parsec.min.js` would 404 under the subpath).

---

## Deploy to GitHub Pages

### Option A — Pages from a branch folder (simplest, no extra tooling)
1. Commit `dist/` to the repo (or copy its contents to a `docs/` folder).
2. Repo → **Settings → Pages** → *Build and deployment* → **Deploy from a branch**.
3. Choose the branch and folder (**`/docs`** if you copied there, or root if you put the files at
   the repo root of a Pages branch).
4. Save. The site publishes at `https://<user>.github.io/<repo>/` in ~1 min.

### Option B — `gh-pages` branch (keeps `dist/` out of `main`)
Use the included `deploy-ghpages.sh` (from the repo root):
```bash
bash dist/deploy-ghpages.sh        # publishes ./dist to the gh-pages branch, then push
```
It force-creates an orphan `gh-pages` branch containing only the `dist/` contents and a
`.nojekyll` file (so Pages doesn't run Jekyll over the assets), commits, and tells you the push
command. Then set **Settings → Pages → Deploy from a branch → `gh-pages` / root**.

> No deploy is performed automatically — the script only prepares the branch and prints the
> `git push` you run yourself.

---

## Optional: cloud saves (one Vercel step)
The game is **fully playable with no backend** — saves go to `localStorage` (source of truth).
To add cross-device save sync:

1. Deploy `api/save.js` (from the repo root) to **Vercel** (`vercel` or push a Vercel-linked repo).
   It becomes the `/api/save` serverless function. Optionally add an **Upstash KV / Redis** store
   in the Vercel dashboard (Storage → connect); the function auto-detects `KV_REST_API_URL` +
   `KV_REST_API_TOKEN` and persists there. With no KV it falls back to file/memory.
2. Point the game at it: in `dist/index.html`, uncomment and set
   ```js
   window.RG_SYNC_URL = 'https://<your-app>.vercel.app/api/save';
   ```
   (or open the game once with `?sync=<that-url>` to persist it in localStorage).

That's it. With the URL set, the save blob is mirrored to the cloud on progress and pulled on
login; with it unset, the game is unchanged and offline-only. There is no email/password — the
username is a non-secret save key by design (see `src/roguelike/profile.js`).
