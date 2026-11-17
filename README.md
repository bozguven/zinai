# ZinAI

Marketing agent for live music and culture projects, built on Claude Code.
First client: Bosphore sur Seine (27 November 2026, Paris).

## What's here

- `CLAUDE.md` — how ZinAI works and the rules it never breaks (a person approves everything).
- `clients/bosphore-sur-seine/brief.md` — facts, audience, voice, visual identity.
- `clients/bosphore-sur-seine/campaign.json` — every scheduled item to 28 November (38): posts, Reels, sticker stories, Shotgun actions, website updates, ads.
- `clients/bosphore-sur-seine/ads/meta.json` — three Meta campaigns, created paused.
- `tools/campaign.mjs` — `today`, `list`, `pending`, `board` (builds the campaign board page).
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
| `/today` | Today's checklist: phone stories with their sticker, Shotgun steps, what's scheduled |
| `/campaign` | Shows the campaign, renders missing visuals, rebuilds the board page |
| `/week-plan` | Plans the next 7 days, drafts the posts, renders the visuals, asks what to approve |
| `/post <topic>` | Drafts one post (FR + TR captions and visual) |
| `/clips <video> [01:12-01:52]` | Cuts a vertical clip with subtitles and drafts its captions |
| `/approval` | Prepares the WhatsApp pack (Turkish message + images) for Ali and Ruşan |
| `/publish P01 S03` | Marks P01 and S03 approved by Ali and Ruşan; schedules auto posts in Postiz, the rest goes to `/today`, `/site` or `/ads` |
| `/site W02` | Updates the website banner and ticket stage, checks SEO, proposes the commit |
| `/ads A01` | Ad setup sheet; `/ads create A01` makes it paused (budget confirmed only) |
| `/clips <video>` | Shortlists moments, cuts a 9:16 Reel with hook, subtitles and end card (tools/video) |
| `/report` or `/report weekly` | Morning brief or weekly report |

Nothing is published without Ali and Ruşan's approval.

## Connect Instagram (once)

1. Create a Postiz account at postiz.com and connect the event's Instagram account (and TikTok when it exists) under Add channel.
2. In this folder, start `claude`, run `/mcp`, choose **postiz** and sign in in the browser. The connector is declared in `.mcp.json`; no API key is stored here.
3. Ask: "list my Postiz channels". You should see Instagram.

To change a visual's text, edit `visuals.json` and run `node render.mjs bosphore-sur-seine <visual-id>`.
