---
description: What happens today (or on a date): auto posts, phone stories with stickers, Shotgun tasks, website and ads
argument-hint: "[YYYY-MM-DD, default today]"
---

Run `node tools/campaign.mjs today $ARGUMENTS` and turn it into a short checklist for me, in this order:

1. **Phone stories (manual)**: for each, the PNG to post (`out/bosphore-sur-seine/<visual>.png`), the exact sticker to add (type, question, options, link, countdown end) and the time. These can't be published by the Instagram API, so I post them from the Birkleyn Sound account on the phone.
2. **Shotgun Smartboard**: the steps to do by hand, word for word.
3. **Auto posts**: confirm each is `scheduled` (in Meta Business Suite / Buffer). If one is still `draft`, say it needs approval; if `approved` but not scheduled, offer to build its pack (`node tools/campaign.mjs pack <id>`).
4. **Website**: any `website` item today → offer `/site <id>`.
5. **Ads**: any `meta-ads` item → offer `/ads <id>`; remind me ads start paused.
6. **Triggers**: check `reports/sales.csv`. If a tier looks sold out, say which trigger item (e.g. P09) is now due.

Keep it short; I read it on my phone.
