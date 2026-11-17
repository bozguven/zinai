---
description: Prepare the approval pack for Ali and Ruşan (WhatsApp message in Turkish + the images to forward)
argument-hint: "[post ids, default: every draft in the next 3 days]"
---

Posts: ${ARGUMENTS:-every draft dated in the next 3 days}

1. Render any missing visuals for those posts (`node render.mjs bosphore-sur-seine <ids>`).
2. Write `out/bosphore-sur-seine/approval-<today>.md` containing, for each post: its id, date and time, channel, the PNG or MP4 path, and the French and Turkish captions exactly as they will be published.
3. Then give me one short WhatsApp message in Turkish for Ali and Ruşan, listing the posts by number with date and a one-line summary, ending with: "Onaylıyorsanız numaraları yazmanız yeterli (ör. 01 03), değişiklik varsa yazın." Do not include anything marked [À CONFIRMER] without flagging it.
4. List the image and video files I should forward with the message, in order.

Nothing is approved until I come back with their answer and run `/publish <ids>`.
