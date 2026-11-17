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
| `/approval` | Prepares the WhatsApp pack (Turkish message + images) for Ali and Ruşan |
| `/publish 03 05` | Marks 03 and 05 as approved by Ali and Ruşan and schedules them on Instagram through Postiz |
| `/report` or `/report weekly` | Morning brief or weekly report |

Nothing is published without Ali and Ruşan's approval.

## Connect Instagram (once)

1. Create a Postiz account at postiz.com and connect the event's Instagram account (and TikTok when it exists) under Add channel.
2. In this folder, start `claude`, run `/mcp`, choose **postiz** and sign in in the browser. The connector is declared in `.mcp.json`; no API key is stored here.
3. Ask: "list my Postiz channels". You should see Instagram.

To change a visual's text, edit `visuals.json` and run `node render.mjs bosphore-sur-seine <visual-id>`.
