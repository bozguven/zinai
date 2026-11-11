---
description: Plan and draft the next 7 days of content for the active client
argument-hint: "[client, default bosphore-sur-seine]"
---

Client: ${ARGUMENTS:-bosphore-sur-seine}

1. Use the analyst subagent to write a short status from `reports/` (sales, survey, last report).
2. Use the strategist subagent to update `calendar.csv` for the next 7 days.
3. For each planned post without a file, use the copywriter subagent to draft it (status: draft).
4. Use the designer subagent to add and render the visuals those posts need.
5. Finish with a table: date, channel, post file, visual, status, and what's `[À CONFIRMER]`. Ask me which posts to approve.
