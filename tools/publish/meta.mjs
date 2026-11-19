#!/usr/bin/env node
// ZinAI → Meta publisher. Publishes APPROVED campaign items to Instagram and the Facebook Page
// through Meta's official Graph API, at their date/time (Europe/Paris). Runs from GitHub Actions
// (.github/workflows/publish.yml), so it works without the Mac.
//
//   node tools/publish/meta.mjs plan            what is queued, when, and what blocks it
//   node tools/publish/meta.mjs media           video/image files the queued items need (one per line)
//   node tools/publish/meta.mjs check           checks the token: Page name, Instagram account
//   node tools/publish/meta.mjs run             publishes what is due (dry run unless PUBLISH_ENABLED=true)
//   node tools/publish/meta.mjs run --now <id>  publishes one approved item now (still needs PUBLISH_ENABLED=true)
//
// Env (set in GitHub → Settings → Secrets and variables → Actions; never in this repo):
//   META_PAGE_TOKEN   secret: long-lived Page access token for the Birkleyn Sound Page
//   META_PAGE_ID      variable (optional: found from the token if missing)
//   META_IG_USER_ID   variable (optional: found from the Page if missing)
//   PUBLISH_ENABLED   variable: "true" to really publish; anything else = dry run
//   META_FACEBOOK     variable: "true" to also post to the Facebook Page (needs pages_manage_posts)
//
// What it will never publish: an item that is not status "approved", one with [À CONFIRMER]
// in its text, one with anything left in "blocked_by", a "manual" sticker story, or anything
// more than 12 h late. It writes what it did back into campaign.json ("published", ids, errors).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CLIENT = process.env.ZINAI_CLIENT || 'bosphore-sur-seine';
const FILE = path.join(ROOT, 'clients', CLIENT, 'campaign.json');
const OUT = path.join(ROOT, 'out', CLIENT);
const V = 'v25.0';
const G = `https://graph.facebook.com/${V}`;
const LATE_MS = 12 * 3600e3;
const MAX_TRIES = 3;
const RAW = process.env.MEDIA_RAW_BASE || 'https://raw.githubusercontent.com/bozguven/zinai/publish-media';

const TOKEN = process.env.META_PAGE_TOKEN || '';
const LIVE = process.env.PUBLISH_ENABLED === 'true';
// Facebook Page posting needs pages_manage_posts, which our Meta app doesn't offer: off unless META_FACEBOOK=true
const FB = process.env.META_FACEBOOK === 'true';
const load = () => JSON.parse(fs.readFileSync(FILE, 'utf8'));
const save = (c) => fs.writeFileSync(FILE, JSON.stringify(c, null, 2) + '\n');
const log = (...a) => console.log(...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- time (Europe/Paris) ----------
function parisToDate(date, time) {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = (time || '12:00').split(':').map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Paris', hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    .formatToParts(new Date(guess)).reduce((o, x) => ((o[x.type] = x.value), o), {});
  const asParis = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute);
  return new Date(guess - (asParis - guess));
}

// ---------- what each item publishes ----------
const vid = (ref) => (ref || '').replace(/^video:/, '');
function targets(i) {
  const t = [];
  const ch = (i.channel || '').toLowerCase();
  if (i.format === 'reel') {
    const reel = vid(i.variants?.instagram_reel || (i.visuals || []).find((v) => v.startsWith('video:reel')));
    if (reel && ch.includes('instagram')) t.push({ net: 'instagram', kind: 'reel', file: `video/${reel}.mp4` });
    if (FB && ch.includes('facebook')) {
      const fb = vid(i.variants?.facebook_feed) || reel;
      if (fb) t.push({ net: 'facebook', kind: fb.startsWith('feed') ? 'video' : 'reel', file: `video/${fb}.mp4` });
    }
  } else if (i.format === 'post') {
    const img = (i.visuals || []).find((x) => !x.startsWith('video:'));
    if (img && ch.includes('instagram')) t.push({ net: 'instagram', kind: 'post', file: `${img}.jpg` });
  } else if (i.format === 'story') {
    const v = (i.visuals || []).find((x) => x.startsWith('video:'));
    const img = (i.visuals || []).find((x) => !x.startsWith('video:'));
    const file = v ? `video/${vid(v)}.mp4` : img ? `${img}.jpg` : null;
    if (file && ch.includes('instagram')) t.push({ net: 'instagram', kind: 'story', file });
    if (FB && file && ch.includes('facebook')) t.push({ net: 'facebook', kind: 'story', file });
  }
  return t;
}
function caption(i) {
  const parts = [i.caption_fr, i.caption_tr].filter(Boolean);
  let s = parts.join('\n\n· · ·\n\n');
  if (i.hashtags) s += `\n\n${i.hashtags}`;
  return s.trim();
}
function blockers(i) {
  const b = [];
  if (i.status !== 'approved') b.push(`status ${i.status}`);
  if (i.mode !== 'auto') b.push(`mode ${i.mode} (not for the API)`);
  if (/À CONFIRMER/i.test(JSON.stringify([i.caption_fr, i.caption_tr, i.title_text, i.hashtags]))) b.push('[À CONFIRMER] in the text');
  for (const x of i.blocked_by || []) b.push(`blocked: ${x}`);
  if (!targets(i).length) b.push('no Instagram/Facebook target or no media');
  for (const t of targets(i)) if (!fs.existsSync(path.join(OUT, t.file))) b.push(`missing file ${t.file}`);
  return [...new Set(b)];
}
const done = (i, t) => i.published?.[`${t.net}_${t.kind}`];

// ---------- Graph API ----------
async function api(method, url, params = {}, headers = {}, body) {
  const u = new URL(url.startsWith('http') ? url : `${G}/${url}`);
  const h = { Authorization: `OAuth ${TOKEN}`, ...headers };
  let b = body;
  if (method === 'GET') for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  else if (!b && Object.keys(params).length) { b = JSON.stringify(params); h['Content-Type'] = 'application/json'; }
  const r = await fetch(u, { method, headers: h, body: b });
  const txt = await r.text();
  let j; try { j = JSON.parse(txt); } catch { j = { raw: txt }; }
  if (!r.ok || j.error) throw new Error(`${method} ${u.pathname}: ${j.error?.message || txt.slice(0, 300)}`);
  return j;
}
const bytes = (f) => fs.readFileSync(path.join(OUT, f));
let IDS;
async function ids() {
  if (IDS) return IDS;
  let page = process.env.META_PAGE_ID, ig = process.env.META_IG_USER_ID, name, username;
  const me = await api('GET', page || 'me', { fields: 'id,name,instagram_business_account{id,username}' });
  page = me.id; name = me.name;
  ig = ig || me.instagram_business_account?.id; username = me.instagram_business_account?.username;
  if (!ig) throw new Error('No Instagram business account linked to this Page (or the token lacks instagram_basic).');
  return (IDS = { page, ig, name, username });
}

async function igWait(container) {
  for (let k = 0; k < 60; k++) {
    const s = await api('GET', container, { fields: 'status_code,status' });
    if (s.status_code === 'FINISHED') return;
    if (s.status_code === 'ERROR' || s.status_code === 'EXPIRED') throw new Error(`Instagram processing ${s.status_code}: ${s.status || ''}`);
    await sleep(10e3);
  }
  throw new Error('Instagram processing timed out');
}
async function publishInstagram(i, t) {
  const { ig } = await ids();
  const isVideo = t.file.endsWith('.mp4');
  let container;
  if (isVideo) {
    const params = { media_type: t.kind === 'reel' ? 'REELS' : 'STORIES', upload_type: 'resumable' };
    if (t.kind === 'reel') { params.caption = caption(i); params.share_to_feed = true;
      const collab = (i.collaborators || []).filter((x) => /^@?[\w.]+$/.test(x)).map((x) => x.replace('@', ''));
      if (collab.length) params.collaborators = collab; }
    container = await api('POST', `${ig}/media`, params).then((r) => r.id).catch(async (e) => {
      if (!params.collaborators || !/not visible|collaborat/i.test(e.message)) throw e;
      log(`collaborators refused (${e.message}); posting without them`);
      delete params.collaborators;
      return (await api('POST', `${ig}/media`, params)).id;
    });
    const data = bytes(t.file);
    await api('POST', `https://rupload.facebook.com/ig-api-upload/${V}/${container}`, {},
      { offset: '0', file_size: String(data.length), 'Content-Type': 'application/octet-stream' }, data);
  } else {
    // images: Instagram fetches them itself (JPEG only), from the public publish-media branch
    const params = { image_url: `${RAW}/${t.file}` };
    if (t.kind === 'story') params.media_type = 'STORIES';
    else params.caption = caption(i);
    container = (await api('POST', `${ig}/media`, params)).id;
  }
  await igWait(container);
  const pub = await api('POST', `${ig}/media_publish`, { creation_id: container });
  return pub.id;
}
async function rupload(url, data) {
  return api('POST', url, {}, { offset: '0', file_size: String(data.length), 'Content-Type': 'application/octet-stream' }, data);
}
async function publishFacebook(i, t) {
  const { page } = await ids();
  const data = bytes(t.file);
  if (t.kind === 'story') {
    const s = await api('POST', `${page}/video_stories`, { upload_phase: 'start' });
    await rupload(s.upload_url, data);
    const f = await api('POST', `${page}/video_stories`, { upload_phase: 'finish', video_id: s.video_id });
    return f.post_id || s.video_id;
  }
  if (t.kind === 'reel') {
    const s = await api('POST', `${page}/video_reels`, { upload_phase: 'start' });
    await rupload(s.upload_url, data);
    await api('POST', `${page}/video_reels`, { upload_phase: 'finish', video_id: s.video_id, video_state: 'PUBLISHED', description: caption(i) });
    return s.video_id;
  }
  // 4:5 feed video: simple multipart upload to the Page
  const fd = new FormData();
  fd.set('description', caption(i));
  fd.set('source', new Blob([data], { type: 'video/mp4' }), path.basename(t.file));
  const r = await api('POST', `https://graph-video.facebook.com/${V}/${page}/videos`, {}, {}, fd);
  return r.id;
}

// ---------- commands ----------
const [cmd = 'plan', ...args] = process.argv.slice(2);
const c = load();
const now = new Date();
const queue = c.items.filter((i) => ['approved', 'publishing'].includes(i.status) || (i.status === 'draft' && i.mode === 'auto'))
  .map((i) => ({ i, due: /^\d{4}-/.test(i.date) ? parisToDate(i.date, i.time) : null }))
  .filter((x) => x.due).sort((a, b) => a.due - b.due);

if (cmd === 'plan') {
  log(`Publisher ${LIVE ? 'LIVE' : 'DRY RUN (PUBLISH_ENABLED is not "true")'} · now ${now.toISOString()}`);
  for (const { i, due } of queue) {
    const b = blockers(i);
    const when = due.toLocaleString('fr-FR', { timeZone: 'Europe/Paris', dateStyle: 'short', timeStyle: 'short' });
    const tg = targets(i).map((t) => `${t.net}:${t.kind}${done(i, t) ? '✓' : ''}`).join(' ');
    log(`${b.length ? '✗' : '✓'} ${i.id.padEnd(5)} ${when}  ${tg}${b.length ? '  ← ' + b.join('; ') : ''}`);
  }
} else if (cmd === 'media') {
  const files = new Set();
  // only items that could really go out: the repo is public, so blocked media is never uploaded
  for (const { i } of queue) if (!blockers(i).filter((b) => !b.startsWith('missing file')).length) for (const t of targets(i)) files.add(t.file);
  log([...files].join('\n'));
} else if (cmd === 'check') {
  if (!TOKEN) { log('META_PAGE_TOKEN is not set.'); process.exit(1); }
  const x = await ids();
  const lim = await api('GET', `${x.ig}/content_publishing_limit`, { fields: 'quota_usage,config' }).catch((e) => ({ error: e.message }));
  log(`OK · Page "${x.name}" (${x.page}) · Instagram @${x.username} (${x.ig}) · publishing limit: ${JSON.stringify(lim.data?.[0] || lim)}`);
  log(`Mode: ${LIVE ? 'LIVE' : 'dry run'}`);
} else if (cmd === 'run') {
  const only = args[0] === '--now' ? args[1] : null;
  if (LIVE && !TOKEN) { log('PUBLISH_ENABLED is true but META_PAGE_TOKEN is missing.'); process.exit(1); }
  let changed = false, failures = 0;
  for (const { i, due } of queue) {
    if (only ? i.id !== only : (due > now)) continue;
    if (i.status === 'draft') continue;
    const b = blockers(i).filter((x) => !x.startsWith('status publishing'));
    if (b.length) { log(`skip ${i.id}: ${b.join('; ')}`); continue; }
    if (!only && now - due > LATE_MS) {
      if (LIVE && i.status !== 'missed') { i.status = 'missed'; i.notes = `${i.notes || ''} [publisher: more than 12 h late, not posted]`.trim(); changed = true; }
      log(`missed ${i.id} (due ${due.toISOString()})`); continue;
    }
    for (const t of targets(i)) {
      if (done(i, t)) continue;
      const key = `${t.net}_${t.kind}`;
      if (!LIVE) { log(`[dry run] would publish ${i.id} → ${key} (${t.file})`); continue; }
      i.status = 'publishing'; i.attempts = i.attempts || {};
      i.attempts[key] = (i.attempts[key] || 0) + 1;
      try {
        const id = t.net === 'instagram' ? await publishInstagram(i, t) : await publishFacebook(i, t);
        i.published = { ...(i.published || {}), [key]: { id, at: new Date().toISOString() } };
        log(`published ${i.id} → ${key} (${id})`);
      } catch (e) {
        failures++;
        i.publish_errors = [...(i.publish_errors || []), { key, at: new Date().toISOString(), error: e.message }].slice(-5);
        log(`ERROR ${i.id} → ${key}: ${e.message}`);
        if (i.attempts[key] >= MAX_TRIES) i.status = 'failed';
      }
      changed = true; save(c); // record after every target, so a crash never double-posts
    }
    if (LIVE && targets(i).every((t) => done(i, t))) { i.status = 'published'; changed = true; }
  }
  if (changed) save(c);
  if (failures) process.exitCode = 1;
} else if (cmd === 'delete') {
  // delete Instagram media by id (only ids passed explicitly, e.g. a duplicate post)
  if (!LIVE) { log('[dry run] would delete', args.join(' ')); process.exit(0); }
  for (const id of args) {
    try { const r = await api('DELETE', id); log(`deleted ${id}: ${JSON.stringify(r)}`); }
    catch (e) { log(`ERROR delete ${id}: ${e.message}`); process.exitCode = 1; }
  }
} else {
  log('Commands: plan | media | check | run [--now <id>] | delete <media ids>');
}
