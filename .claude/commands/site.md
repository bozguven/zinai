---
description: Update the website from a campaign item (banner, ticket stage, sold-out tiers) and keep SEO right
argument-hint: "<item id, e.g. W02> | stage <stage> | soldout <premiere|rive|derniere>"
---

Use the web-updater subagent. Request: $ARGUMENTS

The website repo is `../bosphore-sur-seine` (next to this folder). The agent edits `src/data/live.json`, runs `npm run build` and `node scripts/check-seo.mjs`, commits on a branch `site/<id>` and shows me the diff. It merges to `main` (= live on Vercel) only when I say "go live".

`soldout <tier>` also marks the tier sold out in the JSON-LD offers and tells me which campaign trigger item is now due (e.g. P09 for Early Birds).
