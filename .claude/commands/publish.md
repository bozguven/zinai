---
description: Schedule items that Ali and Ruşan approved (Postiz for auto posts; reminders for phone stories; hand-off for site and ads)
argument-hint: "<campaign ids Ali and Ruşan approved, e.g. P01 S03 R01>"
---

Approved by Ali and Ruşan, as relayed by me in this conversation: $ARGUMENTS

1. If ids are listed above, run `node tools/campaign.mjs approve <ids>`. Never approve ids I didn't list. Items still containing `[À CONFIRMER]` are not approved: tell me what is missing.
2. Then, per mode:
   - `auto`: use the publisher subagent to schedule every `approved` auto item through the Postiz connector, then `node tools/campaign.mjs status scheduled <ids>`.
   - `manual` (sticker stories): they can't go through the API. Put them in the day's `/today` list; if Google Calendar is connected, offer to add a reminder at the story's time with the PNG name and sticker.
   - `website`: hand to `/site <id>`.
   - `meta-ads`: hand to `/ads create <id>` (paused, and only if the budget is confirmed).
   - `shotgun`: they stay on the `/today` checklist for whoever has the Smartboard.
3. Finish with a table: id, mode, channel, Paris time, result (Postiz id / reminder / handed off), and anything skipped with the reason.

If the Postiz connector is not connected, schedule nothing and tell me to run `/mcp` and sign in to Postiz.
