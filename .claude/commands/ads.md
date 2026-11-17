---
description: Meta ads: setup sheets, create paused campaigns after approval, 2-day check
argument-hint: "<A01|A02|A03> | create <id> | check"
---

Use the ads-manager subagent. Request: $ARGUMENTS

- `<id>`: write the setup sheet `out/bosphore-sur-seine/ads-<id>.md` from `ads/meta.json` (FR + TR copy, audience, UTM link, creative paths, click-by-click Ads Manager steps).
- `create <id>`: only if I say in this conversation that Ali and Ruşan approved it AND the budget is confirmed in the brief. Create it **paused** through the Meta Ads connector if one is connected; otherwise give me the setup sheet to click through. Never launch, never change a budget.
- `check`: read the results I paste (or the connector's numbers) and say which ads to keep and which to pause (above 2× the average cost per result after 2 days). I do the pausing.
