---
description: Schedule posts that Ali and Ruşan approved, on Instagram (and other channels) through Postiz
argument-hint: "<post ids Ali and Ruşan approved, e.g. 01 03>"
---

Approved by Ali and Ruşan, as relayed by me: $ARGUMENTS

If ids are listed above, set exactly those posts to `status: approved`. Then use the publisher subagent to schedule every `status: approved` post through the Postiz connector, following its Instagram procedure. Finish with a table: post, channel, type (post, Reel, story), Paris time, Postiz id, and anything skipped with the reason.

If the Postiz connector is not connected, stop and tell me to run `/mcp` and sign in to Postiz.
