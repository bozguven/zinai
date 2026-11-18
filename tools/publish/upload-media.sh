#!/usr/bin/env bash
# Puts the videos of APPROVED items on the branch "publish-media", where the publish workflow
# picks them up. Only approved, unblocked items: this repo is public, so nothing unapproved goes up.
#   bash tools/publish/upload-media.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
ROOT=$(pwd)
OUT=$ROOT/out/${ZINAI_CLIENT:-bosphore-sur-seine}
BR=publish-media
STAGE=$(mktemp -d)
mapfile -t files < <(node tools/publish/meta.mjs media)
[ ${#files[@]} -eq 0 ] && { echo "Nothing approved to upload."; exit 0; }
for f in "${files[@]}"; do  # Instagram takes JPEG only: make it from the PNG render
  case "$f" in *.jpg) [ -f "$OUT/$f" ] || [ ! -f "$OUT/${f%.jpg}.png" ] || ffmpeg -loglevel error -y -i "$OUT/${f%.jpg}.png" -q:v 2 "$OUT/$f";; esac
done
# Build the branch content in a separate index: only README + the approved media, nothing from main.
export GIT_INDEX_FILE=$STAGE/index
PARENT=""
if [ -z "${FRESH:-}" ] && git fetch -q origin $BR 2>/dev/null; then PARENT=$(git rev-parse FETCH_HEAD); git read-tree "$PARENT"; else git read-tree --empty; fi
printf 'Videos of APPROVED ZinAI campaign items, used by .github/workflows/publish.yml.\n' > "$STAGE/README.md"
git update-index --add --cacheinfo 100644,$(git hash-object -w "$STAGE/README.md"),README.md
for f in "${files[@]}"; do
  [ -f "$OUT/$f" ] || { echo "missing locally: $f"; continue; }
  git update-index --add --cacheinfo 100644,$(git hash-object -w "$OUT/$f"),"$f"
done
TREE=$(git write-tree)
if [ -n "$PARENT" ] && [ "$TREE" = "$(git rev-parse "$PARENT^{tree}")" ]; then echo "Already up to date."; rm -rf "$STAGE"; exit 0; fi
COMMIT=$(git commit-tree "$TREE" ${PARENT:+-p $PARENT} -m "media for approved items: ${files[*]}")
unset GIT_INDEX_FILE
git push -q ${FORCE:+-f} origin "$COMMIT:refs/heads/$BR" && echo "Uploaded: ${files[*]}"
rm -rf "$STAGE"
