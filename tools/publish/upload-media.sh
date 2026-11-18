#!/usr/bin/env bash
# Uploads the videos of APPROVED items to the GitHub release "media", where the publish workflow
# picks them up. Only approved items: this repo is public, so nothing unapproved goes up.
#   bash tools/publish/upload-media.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
REPO=bozguven/zinai
OUT=out/${ZINAI_CLIENT:-bosphore-sur-seine}
gh release view media -R "$REPO" >/dev/null 2>&1 || \
  gh release create media -R "$REPO" --title "ZinAI media (approved items only)" \
    --notes "Videos of approved campaign items, used by the publish workflow. Not a software release." --latest=false
files=()
while read -r f; do [ -n "$f" ] && [ -f "$OUT/$f" ] && files+=("$OUT/$f"); done < <(node tools/publish/meta.mjs media)
[ ${#files[@]} -eq 0 ] && { echo "Nothing approved to upload."; exit 0; }
gh release upload media -R "$REPO" --clobber "${files[@]}"
echo "Uploaded ${#files[@]} file(s):"; printf '  %s\n' "${files[@]}"
