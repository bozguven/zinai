---
description: Schedule the approved posts in Postiz
argument-hint: "[post ids to approve now, e.g. 03 05]"
---

$ARGUMENTS

If I listed post ids above, those are approved by me now: set them to `status: approved`.
Then use the publisher subagent to schedule every `status: approved` post at its calendar date and time (default 18:30 Paris for feed posts, 12:00 for stories). Show me what was scheduled and what was skipped, and why.
