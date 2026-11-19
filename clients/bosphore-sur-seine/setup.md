# Setup checklist — Bosphore sur Seine

What has to be connected or confirmed before ZinAI can publish. Update the boxes as things get done.

## Accounts and access

- [x] **Meta Business Suite:** Bertuğ has access to Birkleyn Sound (Facebook Page 113 followers + Instagram 2.8K, linked). 18 Nov.
- [ ] **Buffer (free):** account + TikTok and YouTube channels. Which accounts: Birkleyn Sound's, or Ruşan's? [À CONFIRMER]
- [ ] **Shotgun Smartboard:** Eliyo or Ruşan logs in for SG00 (new description) and SG01 (Meta Pixel).
- [ ] **Meta Pixel:** create it in Business Suite → All tools → Events Manager, paste its ID in Shotgun (SG01).
- [ ] **Ads:** Ads Manager is reachable from Business Suite. Create A01–A03 **paused** from `ads/meta.json` (budget 150 € confirmed); a person launches them.
- [x] **ZinAI publisher built** (18 Nov): `tools/publish/meta.mjs` + `.github/workflows/publish.yml`, runs on GitHub every 10 min (dry run tested).
- [ ] **Meta developer app + Page token** (Bertuğ): developers.facebook.com → app with Instagram + Pages permissions → long-lived Page token → GitHub repo → Settings → Secrets and variables → Actions → secret `META_PAGE_TOKEN`.
- [x] **Meta app** `ZinAI Publisher` (18 Nov): Instagram use case with Facebook login. `pages_manage_posts` isn't offered, so the publisher posts to **Instagram only** (`META_FACEBOOK` off). Facebook: Instagram's auto-share to Facebook (Accounts Center) or Business Suite.
- [ ] **Test:** Actions → publish → Run workflow → command `check` (shows the Page and @account).
- [ ] **Switch on:** repo variable `PUBLISH_ENABLED` = `true`.
- [ ] **Approval by id** from Ali and Ruşan (E10, E13, E15, E14, CD19–CD27), then `/publish <ids>` uploads their videos and the publisher posts them on time.
- [ ] **Horde × Baajar OK** → clears `blocked_by` on those items.
- [ ] **ZinAI ↔ Buffer (optional, free):** Buffer's free plan includes one API key; with it ZinAI can queue TikTok and YouTube Shorts. The key stays in Buffer / the Mac keychain, never in this repo.

## Waiting on Ali and Ruşan

- [ ] **Approval codes** for the first batch (suggested: CD18, E10, CD19, CD20, E13, P08).
- [ ] **Horde × Baajar's OK** to reuse the Cabaret Sauvage footage (all house-style videos, credited on screen).
- [ ] **Instagram handles** for collaborations: Ruşan (seen as `rusanfiliztek`?), Sian (`sian_officiel`?), Eliyo, Péniche Le Marcounet. [À CONFIRMER]
- [ ] **Saxophone** confirmed? (SX01, programme)
- [ ] **Rehearsal date**, to film the orchestra and the saxophone with the DJ.

## Board (the approval page)

- Link: see `links.json` → `board_artifact`.
- Videos show as stills; a tap loads the whole video, then plays it (works on phones and in WhatsApp's browser). 18 Nov.

- [x] **Publisher trigger** (19 Nov): cron-job.org job `cron-zinai` calls the publish workflow every 5 min (GitHub's own schedule only ran a few times a day). Its GitHub token (Actions: read and write, zinai only) expires **19 Dec 2026**.
