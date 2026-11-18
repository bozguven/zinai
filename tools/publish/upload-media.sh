#!/usr/bin/env bash
# Puts the videos of APPROVED items on the branch "publish-media", where the publish workflow
# picks them up. Only approved, unblocked items: this repo is public, so nothing unapproved goes up.
#   bash tools/publish/upload-media.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
ROOT=$(pwd)
OUT=$ROOT/out/${ZINAI_CLIENT:-bosphore-sur-seine}
BR=publish-media
WT=$(mktemp -d)
mapfile -t files < <(node tools/publish/meta.mjs media)
[ ${#files[@]} -eq 0 ] && { echo "Nothing approved to upload."; exit 0; }
if git ls-remote --exit-code --heads origin $BR >/dev/null 2>&1; then
  git fetch -q origin $BR && git worktree add -q -f "$WT" FETCH_HEAD
  (cd "$WT" && git checkout -q -B $BR)
else
  git worktree add -q -f --detach "$WT" && (cd "$WT" && git checkout -q --orphan $BR && git rm -rq . 2>/dev/null || true)
  printf 'Videos of APPROVED ZinAI campaign items, used by .github/workflows/publish.yml.\n' > "$WT/README.md"
fi
for f in "${files[@]}"; do
  [ -f "$OUT/$f" ] || { echo "missing locally: $f"; continue; }
  mkdir -p "$WT/$(dirname "$f")" && cp "$OUT/$f" "$WT/$f"
done
cd "$WT" && git add -A
if git diff --cached --quiet; then echo "Already up to date."; else
  git commit -qm "media for approved items: ${files[*]}" && git push -q origin HEAD:$BR && echo "Uploaded: ${files[*]}"
fi
cd "$ROOT" && git worktree remove -f "$WT"
