---
description: Mark items approved by Ali and Ruşan and build their upload packs (Meta Business Suite for Instagram + Facebook, Buffer for TikTok + YouTube Shorts, phone for sticker stories)
argument-hint: "<campaign ids Ali and Ruşan approved, e.g. P01 S03 R01>"
---

Approved by Ali and Ruşan, as relayed by me in this conversation: $ARGUMENTS

1. If ids are listed above, run `node tools/campaign.mjs approve <ids>`. Never approve ids I didn't list. Items still containing `[À CONFIRMER]` are not approved: tell me what is missing.
2. Then, per mode:
   - `auto`: `node tools/campaign.mjs pack <ids>` and give me the day's checklist (`out/bosphore-sur-seine/packs/<date>/index.md`). I schedule them in Meta Business Suite and Buffer; or, if I ask, schedule them in my Chrome with the publisher's Business Suite steps, showing me each filled form before clicking Schedule. When I say they're scheduled: `node tools/campaign.mjs status scheduled <ids>`.
   - `manual` (sticker stories): they can't go through the API. Put them in the day's `/today` list; if Google Calendar is connected, offer to add a reminder at the story's time with the PNG name and sticker.
   - `website`: hand to `/site <id>`.
   - `meta-ads`: hand to `/ads create <id>` (paused, and only if the budget is confirmed).
   - `shotgun`: they stay on the `/today` checklist for whoever has the Smartboard.
3. Finish with a table: id, mode, where it goes (Business Suite / Buffer / phone / Shotgun / site / ads), Paris time, pack folder, and anything skipped with the reason.

Never type a password or ask for one; I log in to Meta and Buffer myself.
