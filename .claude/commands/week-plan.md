---
description: Plan and draft the next 7 days of content for the active client
argument-hint: "[client, default bosphore-sur-seine]"
---

Client: ${ARGUMENTS:-bosphore-sur-seine}

1. Use the analyst subagent to write a short status from `reports/` (sales, survey, last report).
2. Use the strategist subagent to update `campaign.json` for the next 7 days (posts, sticker stories, Shotgun actions, site and ad items; each with a mode).
3. For each item without captions, use the copywriter subagent to write `caption_fr` and `caption_tr` (status: draft).
4. Use the designer subagent to add and render the visuals those posts need.
5. Rebuild the board (`node tools/campaign.mjs board`) and finish with a table: id, date, mode, visual, status, and what's `[À CONFIRMER]`. Then offer `/approval`.
