# Golf on Mars — visual/difficulty targets

Reference screenshots the mars-golf generator is built to match. Persisted here (not just in chat) so they
survive context loss. Paired with `../MARSGOLF-REQUIREMENTS.md`.

## How to add your own targets
Drop image files into this folder:
- Windows: `C:\dev\indie\active\faceted-golf\docs\gom-targets\`
- WSL: `/mnt/c/dev/indie/active/faceted-golf/docs/gom-targets/`

To tell me the *intent* of each, name them (or just say in chat which is which):
- `target-simple-*.png` — gentle early-hole look
- `target-mid-*.png` — medium (cliffs/plateaus/obstacles)
- `target-complex-*.png` — hard (gaps / multi-mass / overhangs / caves)
- `target-fill-*.png` or a short clip — the sink → hole-fills → camera-pan moment, if you have one

## What I read from the current refs (working targets)
- **Simple** → `steam_01.jpg`, `steam_06.jpg` — smooth ROUNDED hills, small sky-colored cup notch.
- **Medium** → `steam_03.jpg` (hole 181) — ANGULAR cliffs/plateaus, a cactus accent, cup on top.
- **Complex** → `steam_05.jpg` (hole 91) — several solid masses with SKY GAPS to cross + a grey-rock
  obstacle, cup on a far plateau.

Key observations (correcting earlier assumptions):
- GoM terrain is **both smooth-rounded AND angular** — not the pure-faceted look our archetype engine makes.
- "Complex" in these store shots = **multi-level masses + sky gaps + angular cliffs + obstacles** (grey
  rocks, cacti). I did NOT see a true fold-over **overhang** (terrain above the ball) in these — that's the
  open A/B question in the requirements (gap/multi-mass complexity vs. true overhangs/caves).
- Terrain is one solid color (red) with occasional **other-material obstacles** (grey rock); flags show the
  **hole number** (181, 91, 72…) — consistent with the fixed-seed, thousands-of-holes model.

## Full index (saved from the GoM store/press shots)
- `steam_01.jpg` … `steam_07.jpg` — gameplay screenshots (mixed difficulty)
- `itch_01..03.png`, `itch_cover.png` — itch.io shots + cover
- `yt_thumb*.jpg`, `tapsmart.png` — press/thumbnail
