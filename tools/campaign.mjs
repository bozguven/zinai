#!/usr/bin/env node
// ZinAI campaign tool. campaign.json is the source of truth for everything scheduled.
//
//   node tools/campaign.mjs today [YYYY-MM-DD]        what happens that day, by mode
//   node tools/campaign.mjs list [from] [to]          one line per item
//   node tools/campaign.mjs pending                   drafts waiting for approval
//   node tools/campaign.mjs approve <ids...>          ONLY from /publish, after the user relays Ali + Ruşan's yes
//   node tools/campaign.mjs status <status> <ids...>  scheduled | done | created-paused | retired ...
//   node tools/campaign.mjs board                     builds out/<client>/board/index.html (+ img/)
//
// Client: env ZINAI_CLIENT, default bosphore-sur-seine.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLIENT = process.env.ZINAI_CLIENT || 'bosphore-sur-seine';
const FILE = path.join(ROOT, 'clients', CLIENT, 'campaign.json');
const OUT = path.join(ROOT, 'out', CLIENT);

const load = () => JSON.parse(fs.readFileSync(FILE, 'utf8'));
const save = (c) => { c.updated = today(); fs.writeFileSync(FILE, JSON.stringify(c, null, 2) + '\n'); };
function today() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(new Date());
}

const MODE = {
  auto: 'Auto (Postiz schedules it)',
  manual: 'Manual (post from the phone: sticker)',
  shotgun: 'Shotgun Smartboard (by hand)',
  website: 'Website (web-updater, then Vercel)',
  'meta-ads': 'Meta ads (created paused, a person launches)',
};
const byTime = (a, b) => (a.date + a.time).localeCompare(b.date + b.time);

const [cmd = 'today', ...args] = process.argv.slice(2);
const c = load();

if (cmd === 'today') {
  const d = args[0] || today();
  const items = c.items.filter((i) => i.date === d).sort(byTime);
  console.log(`\n${d} · ${items.length} item(s)\n`);
  for (const m of Object.keys(MODE)) {
    const list = items.filter((i) => i.mode === m);
    if (!list.length) continue;
    console.log(`## ${MODE[m]}`);
    for (const i of list) {
      console.log(`- ${i.time} ${i.id} [${i.status}] ${i.title}`);
      if (i.sticker_spec) console.log(`    sticker: ${JSON.stringify(i.sticker_spec)}`);
      for (const step of i.checklist || []) console.log(`    [ ] ${step}`);
      for (const n of i.needs || []) console.log(`    needs: ${n}`);
      if (m === 'auto' && i.status !== 'scheduled') console.log(`    ! not scheduled yet (status ${i.status})`);
    }
    console.log('');
  }
  const trig = c.items.filter((i) => i.date === 'trigger' && i.status !== 'done');
  if (trig.length) console.log('On trigger: ' + trig.map((i) => `${i.id} (${i.trigger})`).join(', '));
} else if (cmd === 'list') {
  const [from = '0000', to = '9999'] = args;
  for (const i of [...c.items].sort(byTime)) {
    if (i.date !== 'trigger' && (i.date < from || i.date > to)) continue;
    console.log([i.id.padEnd(5), i.date, i.time, i.mode.padEnd(8), i.status.padEnd(14), i.title].join('  '));
  }
} else if (cmd === 'pending') {
  for (const i of c.items.filter((i) => i.status === 'draft').sort(byTime)) {
    const blocked = JSON.stringify(i).includes('À CONFIRMER') ? '  (has [À CONFIRMER])' : '';
    console.log(`${i.id.padEnd(5)} ${i.date} ${i.time}  ${i.title}${blocked}`);
  }
} else if (cmd === 'approve' || cmd === 'status') {
  const status = cmd === 'approve' ? 'approved' : args.shift();
  const ids = args.map((s) => s.toUpperCase());
  if (!status || !ids.length) { console.error('usage: approve <ids...> | status <status> <ids...>'); process.exit(1); }
  for (const id of ids) {
    const i = c.items.find((x) => x.id === id);
    if (!i) { console.error(`unknown id ${id}`); continue; }
    if (cmd === 'approve') i.approval = { ali: today(), rusan: today() };
    i.status = status;
    console.log(`${id} -> ${status}`);
  }
  save(c);
} else if (cmd === 'board') {
  buildBoard();
} else {
  console.error('commands: today | list | pending | approve | status | board');
  process.exit(1);
}

function buildBoard() {
  const dir = path.join(OUT, 'board');
  fs.mkdirSync(path.join(dir, 'img'), { recursive: true });
  const esc = (s = '') => String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  const mark = (s) => esc(s).replace(/\[?À CONFIRMER\]?/g, '<mark>À CONFIRMER</mark>').replace(/\n/g, '<br>');
  const fmtDay = (d) => d === 'trigger' ? 'Dès que ça arrive' :
    new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(d + 'T12:00:00Z'));
  const label = { auto: 'Auto', manual: 'Manuel · téléphone', shotgun: 'Shotgun', website: 'Site web', 'meta-ads': 'Pub Meta' };

  const days = {};
  for (const i of [...c.items].sort(byTime)) (days[i.date] ||= []).push(i);
  const order = Object.keys(days).sort((a, b) => (a === 'trigger') - (b === 'trigger') || a.localeCompare(b));

  const card = (i) => {
    const imgs = (i.visuals || []).map((v) => {
      if (v.startsWith('video:')) {
        const id = v.slice(6), src = path.join(OUT, 'video', id + '.mp4');
        if (!fs.existsSync(src)) return `<div class="ph">🎬 vidéo à monter<br>(${esc(id)})</div>`;
        fs.mkdirSync(path.join(dir, 'video'), { recursive: true });
        fs.copyFileSync(src, path.join(dir, 'video', id + '.mp4'));
        return `<video src="video/${esc(id)}.mp4" muted loop autoplay playsinline preload="metadata"></video>`;
      }
      const src = path.join(OUT, v + '.png');
      if (!fs.existsSync(src)) return `<div class="ph">${esc(v)}</div>`;
      fs.copyFileSync(src, path.join(dir, 'img', v + '.png'));
      return `<img src="img/${esc(v)}.png" alt="${esc(v)}" loading="lazy">`;
    }).join('');
    const blocks = [];
    if (i.caption_fr) blocks.push(`<details open><summary>FR</summary><p>${mark(i.caption_fr)}</p></details>`);
    if (i.caption_tr) blocks.push(`<details><summary>TR</summary><p>${mark(i.caption_tr)}</p></details>`);
    if (i.hashtags) blocks.push(`<p class="tags">${esc(i.hashtags)}</p>`);
    if (i.text_fr) blocks.push(`<details open><summary>Texte</summary><p>${mark(i.text_fr)}</p></details>`);
    if (i.subject_fr) blocks.push(`<details open><summary>Email</summary><p><b>${mark(i.subject_fr)}</b><br>${mark(i.body_fr || '')}</p></details>`);
    if (i.sticker_spec) {
      const s = i.sticker_spec;
      const rest = Object.entries(s).filter(([k]) => k !== 'type')
        .map(([k, v]) => esc(Array.isArray(v) ? v.join(' / ') : v)).join(' · ');
      blocks.push(`<p class="sticker">Sticker <b>${esc(s.type)}</b>${rest ? ' · ' + rest : ''}</p>`);
    }
    if (i.site?.banner) blocks.push(`<p class="sticker">Bandeau : ${esc(i.site.banner.fr)}</p>`);
    if (i.checklist) blocks.push(`<ul class="check">${i.checklist.map((x) => `<li>${mark(x)}</li>`).join('')}</ul>`);
    if (i.collaborators) blocks.push(`<p class="tags">Collab : ${mark(i.collaborators.join(', '))}</p>`);
    if (i.needs?.length) blocks.push(`<ul class="needs">${i.needs.map((x) => `<li>${mark(x)}</li>`).join('')}</ul>`);
    if (i.preview_note) blocks.push(`<p class="tags">${mark(i.preview_note)}</p>`);
    if (i.shots) blocks.push(`<details><summary>Plans à filmer</summary><ul class="check">${i.shots.map((x) => `<li>${mark(x)}</li>`).join('')}</ul></details>`);
    if (i.trigger) blocks.push(`<p class="tags">Déclencheur : ${esc(i.trigger)}</p>`);
    const ap = i.approval || {};
    return `<article class="card m-${i.mode}" data-mode="${i.mode}" data-video="${i.format === 'reel' || (i.visuals || []).some((v) => v.startsWith('video:')) ? 1 : 0}" data-status="${i.status}">
  <header><span class="id">${esc(i.id)}</span><span class="time">${esc(i.time)}</span><span class="badge">${label[i.mode] || i.mode}</span></header>
  <p class="meta">${esc(i.channel)} · ${esc(i.format)}</p>
  <h3>${mark(i.title)}</h3>
  ${imgs ? `<div class="imgs">${imgs}</div>` : ''}
  ${blocks.join('\n  ')}
  <footer><span class="st st-${i.status}">${esc(i.status)}</span><span>Ali ${ap.ali ? '✓' : '·'}</span><span>Ruşan ${ap.rusan ? '✓' : '·'}</span></footer>
</article>`;
  };

  const counts = Object.fromEntries(Object.keys(label).map((m) => [m, c.items.filter((i) => i.mode === m).length]));
  const html = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Bosphore sur Seine · Campagne</title>
<style>
:root{--blue:#4F62AE;--ink:#3B3C3E;--yellow:#DECF58;--grey:#949599;--bg:#fff;--soft:#f3f4f8}
*{box-sizing:border-box}body{margin:0;font:15px/1.45 "Fira Sans Condensed","Arial Narrow",system-ui,sans-serif;color:var(--ink);background:var(--bg)}
.top{position:sticky;top:0;z-index:5;background:#fff;border-bottom:2px solid var(--blue);padding:14px 20px}
h1{margin:0;font:800 22px/1.1 Unbounded,system-ui,sans-serif;color:var(--blue);letter-spacing:-.01em}
.sub{margin:4px 0 10px;color:var(--grey)}
.filters{display:flex;flex-wrap:wrap;gap:6px}.filters button{font:inherit;border:1.5px solid var(--blue);background:#fff;color:var(--blue);border-radius:99px;padding:3px 12px;cursor:pointer}
.filters button[aria-pressed=true]{background:var(--blue);color:#fff}
main{padding:10px 20px 60px;max-width:1500px;margin:0 auto}
.day h2{font:700 17px Unbounded,system-ui,sans-serif;color:var(--blue);margin:26px 0 10px;text-transform:capitalize}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px}
.card{overflow-wrap:anywhere;border:1px solid #dfe1ea;border-left:5px solid var(--grey);border-radius:10px;padding:12px 14px;background:#fff;display:flex;flex-direction:column;gap:6px}
.m-auto{border-left-color:var(--blue)}.m-manual{border-left-color:var(--yellow)}.m-shotgun{border-left-color:var(--ink)}.m-website{border-left-color:#7d8bc6}.m-meta-ads{border-left-color:#c2412d}
.card header{display:flex;gap:8px;align-items:center}.id{font-weight:700;color:var(--blue)}.time{color:var(--grey)}
.badge{margin-left:auto;font-size:12px;background:var(--soft);border-radius:99px;padding:1px 9px}
.m-manual .badge{background:#f6f0c4}.m-meta-ads .badge{background:#f8ddd8}
.meta{margin:0;font-size:13px;color:var(--grey)}h3{margin:0;font-size:16px;line-height:1.25}
.imgs{display:flex;gap:6px;overflow-x:auto}.imgs video{height:190px;border-radius:6px;border:1px solid #e5e6ee;background:#fff}.imgs img{height:190px;border-radius:6px;border:1px solid #e5e6ee}
.ph{height:120px;min-width:90px;display:grid;place-items:center;font-size:12px;text-align:center;padding:6px;background:var(--soft);border-radius:6px;color:var(--grey)}
details{background:var(--soft);border-radius:6px;padding:4px 9px}summary{cursor:pointer;font-weight:700;font-size:12px;color:var(--blue)}details p{margin:4px 0}
.tags{margin:0;font-size:12.5px;color:var(--grey)}.sticker{margin:0;font-size:13.5px;background:#faf6d8;border-radius:6px;padding:4px 9px}
ul{margin:0;padding-left:18px;font-size:13.5px}.needs li{color:#a33a26}mark{background:var(--yellow);padding:0 3px;border-radius:3px}
.card footer{margin-top:auto;display:flex;gap:10px;font-size:13px;color:var(--grey);padding-top:4px}
.st{font-weight:700;color:var(--ink)}.st-approved,.st-scheduled,.st-done{color:#2f7d4a}
.legend{display:flex;flex-wrap:wrap;gap:14px;font-size:13px;color:var(--grey);margin-top:8px}
.hide{display:none!important}
.decide{margin:22px 0 6px;background:#faf6d8;border-radius:12px;padding:14px 18px}.decide h2{font:700 17px Unbounded,system-ui,sans-serif;color:var(--blue);margin:0 0 8px}.decide ol{margin:0;padding-left:22px;font-size:15px}.decide li{margin:3px 0}
</style></head><body>
<div class="top"><h1>Bosphore sur Seine · Campagne</h1>
<p class="sub">Tout ce qui est prévu jusqu'au 29 novembre. Rien ne part sans l'accord d'Ali et Ruşan. Mis à jour le ${esc(c.updated)}.</p>
<div class="filters" role="group" aria-label="Filtrer">
<button aria-pressed="true" data-f="all">Tout (${c.items.length})</button>
<button aria-pressed="false" data-f="video">Vidéo (${c.items.filter((i) => i.format === 'reel' || (i.visuals || []).some((v) => v.startsWith('video:'))).length})</button>
${Object.entries(label).map(([m, l]) => `<button aria-pressed="false" data-f="${m}">${l} (${counts[m]})</button>`).join('\n')}
</div></div>
<main>
${c.decisions ? `<section class="decide"><h2>${esc(c.decisions.title)}</h2><ol>${c.decisions.items.map((x) => `<li>${mark(x)}</li>`).join('')}</ol></section>` : ''}
${order.map((d) => `<section class="day"><h2>${fmtDay(d)}</h2><div class="grid">${days[d].map(card).join('\n')}</div></section>`).join('\n')}
<div class="legend"><span><b>Auto</b> : programmé par Postiz après accord.</span><span><b>Manuel</b> : story avec sticker (sondage, quiz, question, lien, compte à rebours), à poster depuis le téléphone.</span><span><b>Shotgun</b> : à faire dans le Smartboard.</span><span><b>Pub Meta</b> : créée en pause, lancée par une personne.</span></div>
</main>
<script>
const bs=[...document.querySelectorAll('.filters button')];
bs.forEach(b=>b.onclick=()=>{bs.forEach(x=>x.setAttribute('aria-pressed',x===b));const f=b.dataset.f;
document.querySelectorAll('.card').forEach(c=>c.classList.toggle('hide',f!=='all'&&(f==='video'?c.dataset.video!=='1':c.dataset.mode!==f)));
document.querySelectorAll('.day').forEach(s=>s.classList.toggle('hide',!s.querySelector('.card:not(.hide)')));});
</script></body></html>`;
  fs.writeFileSync(path.join(dir, 'index.html'), html);
  console.log(`board: ${path.relative(ROOT, dir)}/index.html (${c.items.length} items)`);
}
