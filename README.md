# ZinAI

Marketing agent for live music and culture projects, built on Claude Code.
First client: Bosphore sur Seine (27 November 2026, Paris).

## What's here

- `CLAUDE.md` — how ZinAI works and the rules it never breaks (a person approves everything).
- `clients/bosphore-sur-seine/brief.md` — facts, audience, voice, visual identity.
- `clients/bosphore-sur-seine/calendar.csv` — the campaign from 4 to 28 November.
- `clients/bosphore-sur-seine/posts/` — 12 post drafts with captions in French and Turkish.
- `clients/bosphore-sur-seine/visuals.json` + `templates/card.html` — Instagram posts and stories.
- `.claude/skills/` — 53 marketing skills from coreyhaines31/marketingskills (MIT).

## Use it

```bash
npm install            # installs Playwright for rendering
npx playwright install chromium
node render.mjs        # renders every visual to out/bosphore-sur-seine/
claude                 # open ZinAI in Claude Code
```

## Commands (inside Claude Code)

| Command | What it does |
| --- | --- |
| `/week-plan` | Plans the next 7 days, drafts the posts, renders the visuals, asks what to approve |
| `/post <topic>` | Drafts one post (FR + TR captions and visual) |
| `/clips <video> [01:12-01:52]` | Cuts a vertical clip with subtitles and drafts its captions |
| `/publish 03 05` | Approves posts 03 and 05 and schedules every approved post in Postiz |
| `/report` or `/report weekly` | Morning brief or weekly report |

Nothing is published without your approval. Postiz must be connected for `/publish` to work.

To change a visual's text, edit `visuals.json` and run `node render.mjs bosphore-sur-seine <visual-id>`.
