---
description: Prepare the approval pack for Ali and Ruşan (WhatsApp message in Turkish + the images to forward)
argument-hint: "[campaign ids, default: every draft in the next 3 days]"
---

Items: ${ARGUMENTS:-every draft in campaign.json dated in the next 3 days, plus trigger items not yet approved}

Source: `clients/bosphore-sur-seine/campaign.json`. Use the item ids exactly as they are there (P01, S03, R01, A02…), so their answer maps straight onto `/publish`.

1. `node tools/campaign.mjs pending` to see the drafts. Render any missing visuals (`node render.mjs bosphore-sur-seine <visual ids>`).
2. Write `out/bosphore-sur-seine/approval-<today>.md`: for each item its id, date and time, mode (auto / phone story / Shotgun / website / ad), the file paths, the FR and TR text exactly as it will go out, and for stories the sticker.
3. Rebuild the board (`node tools/campaign.mjs board`) and, if the claude-artifacts tools are available, republish it (slug in `clients/bosphore-sur-seine/links.json`) so the link in the message shows the latest.
4. Give me one short WhatsApp message in Turkish for Ali and Ruşan: the board link, then each item on one line (id, day, one-line summary), ending with: "Onaylıyorsanız kodları yazmanız yeterli (ör. P01 S03), değişiklik varsa yazın." Flag anything with `[À CONFIRMER]` instead of hiding it.
5. List the image and video files to forward with the message, in order.

Nothing is approved until I come back with their answer and run `/publish <ids>`.
