---
description: Show the campaign (campaign.json), render missing visuals and rebuild the board page
argument-hint: "[from YYYY-MM-DD] [to YYYY-MM-DD] or 'board'"
---

campaign.json (`clients/bosphore-sur-seine/campaign.json`) is the source of truth for everything scheduled: posts, Reels, stories, stickers, Shotgun actions, website updates and ads. Modes: `auto` (Postiz), `manual` (phone, stickers), `shotgun` (Smartboard by hand), `website` (web-updater), `meta-ads` (ads-manager, paused).

1. `node tools/campaign.mjs list $ARGUMENTS` and summarise by day.
2. Find visuals referenced by items that are missing from `out/bosphore-sur-seine/` and render them: `node render.mjs bosphore-sur-seine <ids>`. Items that need a video (clips) or something from the team: list them under "Waiting for".
3. List every `[À CONFIRMER]` still in the items, with the item id.
4. Rebuild the board: `node tools/campaign.mjs board` → `out/bosphore-sur-seine/board/index.html`. If the claude-artifacts tools are available, republish it to the campaign board artifact (slug in `clients/bosphore-sur-seine/links.json`) with its `img/` files.

To add or change items, edit campaign.json directly (keep the same fields; new items get `status: draft` and empty approval). Captions: French first, then Turkish; never invent facts.
