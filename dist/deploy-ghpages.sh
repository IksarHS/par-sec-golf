#!/usr/bin/env bash
# ── deploy-ghpages.sh — publish ./dist to a gh-pages branch for GitHub Pages ─────────────────────
# Run from the REPO ROOT:  bash dist/deploy-ghpages.sh
#
# Creates/updates an orphan `gh-pages` branch whose ROOT is the contents of ./dist (so the site
# serves at https://<user>.github.io/<repo>/ with the relative paths the build assumes). Adds a
# .nojekyll so Pages serves the assets as-is. It COMMITS on gh-pages but does NOT push — it prints
# the exact push command for you to run. Your working branch is restored at the end.
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

if [ ! -f dist/index.html ]; then
  echo "error: dist/index.html not found. Run 'node tools/build.cjs' first." >&2
  exit 1
fi

CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
WORKTREE="$(mktemp -d)"
echo "[deploy] staging dist/ into a temporary gh-pages worktree: $WORKTREE"

# Use a detached worktree so we never disturb the current checkout.
git worktree add --detach "$WORKTREE" >/dev/null 2>&1

cleanup() { git worktree remove --force "$WORKTREE" >/dev/null 2>&1 || true; }
trap cleanup EXIT

pushd "$WORKTREE" >/dev/null
  # Orphan branch = no history from main; the tree is ONLY the published files.
  git checkout --orphan gh-pages >/dev/null 2>&1
  git rm -rf . >/dev/null 2>&1 || true
  cp -r "$ROOT/dist/." .
  touch .nojekyll            # tell Pages not to run Jekyll over the assets
  git add -A
  git commit -m "Deploy Par Sec to GitHub Pages ($(date -u +%Y-%m-%dT%H:%MZ))" >/dev/null
  echo "[deploy] committed dist/ to local gh-pages branch."
popd >/dev/null

# Bring the new gh-pages commit back into the main repo's branch ref.
git fetch "$WORKTREE" gh-pages:gh-pages -f >/dev/null 2>&1 || \
  git branch -f gh-pages "$(git --git-dir="$WORKTREE/.git" rev-parse HEAD 2>/dev/null || true)" >/dev/null 2>&1 || true

echo
echo "[deploy] gh-pages branch is ready locally. Now push it:"
echo
echo "    git push origin gh-pages --force"
echo
echo "[deploy] Then: GitHub → Settings → Pages → Deploy from a branch → gh-pages / (root)."
echo "[deploy] Site will publish at: https://<user>.github.io/<repo>/"
echo "[deploy] (current working branch '$CURRENT_BRANCH' is untouched.)"
