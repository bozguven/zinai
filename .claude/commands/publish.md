---
description: Mark items approved by Ali and Ruşan and build their upload packs (Meta Business Suite for Instagram + Facebook, Buffer for TikTok + YouTube Shorts, phone for sticker stories)
argument-hint: "<campaign ids Ali and Ruşan approved, e.g. P01 S03 R01>"
---

Approved by Ali and Ruşan, as relayed by me in this conversation: $ARGUMENTS

1. If ids are listed above, run `node tools/campaign.mjs approve <ids>`. Never approve ids I didn't list. Items still containing `[À CONFIRMER]` are not approved: tell me what is missing.
2. Then, per mode:
   - `auto`, Instagram + Facebook: published by ZinAI itself at the item's time, through Meta's API (`.github/workflows/publish.yml`, every 10 min). Run `bash tools/publish/upload-media.sh` (uploads the approved items' videos to the GitHub release `media`), commit and push `campaign.json`, then show `node tools/publish/meta.mjs plan`. Anything shown with ✗ says what still blocks it (`blocked_by`, missing file, `[À CONFIRMER]`).
   - `auto`, TikTok + YouTube Shorts: `node tools/campaign.mjs pack <ids>` and give me the day's checklist for Buffer.
   - `manual` (sticker stories): they can't go through the API. Put them in the day's `/today` list; if Google Calendar is connected, offer to add a reminder at the story's time with the PNG name and sticker.
   - `website`: hand to `/site <id>`.
   - `meta-ads`: hand to `/ads create <id>` (paused, and only if the budget is confirmed).
   - `shotgun`: they stay on the `/today` checklist for whoever has the Smartboard.
3. Finish with a table: id, mode, where it goes (Business Suite / Buffer / phone / Shotgun / site / ads), Paris time, pack folder, and anything skipped with the reason.

Never type a password or ask for one; I log in to Meta and Buffer myself.
