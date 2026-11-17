---
description: Turn a video or a track into Reels and moving stories (shortlist moments, cut 9:16 with hook, subtitles, end card; beat-cut montages; rive loops)
argument-hint: "<video or audio path> [campaign id, e.g. R01] [start-end, e.g. 01:12-01:52]"
---

Input: $ARGUMENTS

Use the clipper subagent (tools in `tools/video/`).

1. If it's a long video and no moment is given: run `highlights.py`, show me the 3–4 moments with the contact sheet, and wait for my pick.
2. Cut the chosen moment with `clip.py` (hook for 3 s from `hook-<id>` in visuals.json, ticket end card). Spoken video: add `--subs fr` and show me the .srt first.
3. If it's an audio track: offer the "rive" Reel (`alive.py --audio`) and, if there are shots, a beat-cut montage.
4. Save to `out/bosphore-sur-seine/video/<name>.mp4`, set the matching campaign item's `visuals` to `video:<name>`, keep `status: draft`, rebuild the board (`node tools/campaign.mjs board`) and republish it if the artifact tools are available.
5. List the files and what still needs a person (moment choice, subtitle check).
