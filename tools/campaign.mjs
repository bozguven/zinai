#!/usr/bin/env node
// ZinAI campaign tool. campaign.json is the source of truth for everything scheduled.
//
//   node tools/campaign.mjs today [YYYY-MM-DD]        what happens that day, by mode
//   node tools/campaign.mjs list [from] [to]          one line per item
//   node tools/campaign.mjs pending                   drafts waiting for approval
//   node tools/campaign.mjs approve <ids...>          ONLY from /publish, after the user relays Ali + Ruşan's yes
//   node tools/campaign.mjs status <status> <ids...>  scheduled | done | created-paused | retired ...
//   node tools/campaign.mjs board                     builds out/<client>/board/index.html (+ img/)
//   node tools/campaign.mjs pack <ids...>             upload packs for Meta Business Suite / Buffer / phone (approved items)
//
// Client: env ZINAI_CLIENT, default bosphore-sur-seine.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

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
  auto: 'Auto (Meta Business Suite + Buffer)',
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
} else if (cmd === 'pack') {
  buildPacks(args.map((x) => x.toUpperCase()));
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

  const now = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date()).replace(' ', 'T');
  const todayP = now.slice(0, 10);
  const cat = (i) => (i.collab_todo && i.collab_todo.length && !i.collab_done) ? 'todo' : (i.status === 'published' || (i.published && Object.keys(i.published).length)) ? 'pub'
    : (['approved', 'publishing', 'scheduled'].includes(i.status) && i.mode === 'auto') ? 'prog'
    : ((['shotgun', 'website'].includes(i.mode) || (i.mode === 'manual' && i.status === 'approved') || (i.mode === 'meta-ads' && i.status === 'draft')) && !['done', 'retired', 'missed', 'failed'].includes(i.status) && (i.date === 'trigger' || i.date >= todayP)) ? 'todo'
    : 'arch';
  const live = [...c.items].filter((x) => x.status !== 'retired').sort(byTime);
  const group = (arr) => { const d = {}; for (const i of arr) (d[i.date] ||= []).push(i); return d; };
  const prog = live.filter((i) => ['prog', 'pub'].includes(cat(i)));
  const upcoming = prog.filter((i) => cat(i) === 'prog' || i.date >= todayP), past = prog.filter((i) => cat(i) === 'pub' && i.date < todayP);
  const todo = live.filter((i) => cat(i) === 'todo'), arch = live.filter((i) => cat(i) === 'arch');
  const next = live.find((i) => cat(i) === 'prog' && (i.date + 'T' + (i.time || '00:00')) >= now);
  const daysHtml = (arr, open = true) => { const g = group(arr); return Object.keys(g).sort((a, b) => (a === 'trigger') - (b === 'trigger') || a.localeCompare(b))
    .map((d) => `<section class="day"><h2>${fmtDay(d)}${d === todayP ? ' · aujourd’hui' : ''}</h2><div class="grid">${g[d].map(card).join('\n')}</div></section>`).join('\n'); };

  const card = (i) => {
    const imgs = (i.visuals || []).map((v) => {
      if (v.startsWith('video:')) {
        const id = v.slice(6), src = path.join(OUT, 'video', id + '.mp4');
        if (!fs.existsSync(src)) return `<div class="ph">🎬 vidéo à monter<br>(${esc(id)})</div>`;
        fs.mkdirSync(path.join(dir, 'video'), { recursive: true });
        const dst = path.join(dir, 'video', id + '.mp4');
        const stale = (f) => !fs.existsSync(f) || fs.statSync(f).mtimeMs < fs.statSync(src).mtimeMs;
        if (stale(dst)) {                               // board copy: 720p H.264, moov atom first (plays on phones)
          if (fs.statSync(src).size > 6e6)
            execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', src, '-vf', 'scale=720:-2', '-c:v', 'libx264', '-preset', 'veryfast',
              '-crf', '27', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', dst]);
          else execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', src, '-c', 'copy', '-movflags', '+faststart', dst]);
        }
        const poster = path.join(dir, 'img', 'poster-' + id + '.jpg');   // still image for the grid
        if (stale(poster)) execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', '1', '-i', src, '-frames:v', '1', '-vf', 'scale=360:-2', '-q:v', '4', poster]);
        return `<button class="media vid" data-src="video/${esc(id)}.mp4" data-kind="video" aria-label="Lire la vidéo ${esc(id)}"><img src="img/poster-${esc(id)}.jpg" alt="" loading="lazy"><span class="play" aria-hidden="true">▶</span></button>`;
      }
      const src = path.join(OUT, v + '.png');
      if (!fs.existsSync(src)) return `<div class="ph">${esc(v)}</div>`;
      fs.copyFileSync(src, path.join(dir, 'img', v + '.png'));
      return `<button class="media" data-src="img/${esc(v)}.png" data-kind="img" aria-label="Agrandir ${esc(v)}"><img src="img/${esc(v)}.png" alt="${esc(v)}" loading="lazy"></button>`;
    }).join('');
    const blocks = [];
    if (i.caption_fr) blocks.push(`<details><summary>Texte du post</summary><p>${mark(i.caption_fr)}</p></details>`);
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
    const k = cat(i), kind = { reel: 'Reel', story: 'Story', post: 'Post', carousel: 'Carrousel' }[i.format] || label[i.mode] || i.format;
    const chip = { pub: 'Publié ✓', prog: 'Programmé · ZinAI', todo: 'À faire', arch: 'Brouillon' }[k];
    return `<article class="card m-${i.mode} k-${k}" data-mode="${i.mode}" data-status="${i.status}">
  <header><span class="time">${esc(i.time || '')}</span><span class="kind">${esc(kind)}</span><span class="chip c-${k}">${chip}</span></header>
  <h3>${mark((i.caption_fr || '').split(/(?<=[.!?…])\s|\n/)[0] || i.title)}</h3>${i.caption_fr ? `<p class="idl">${mark(i.title)}</p>` : ''}
  ${imgs ? `<div class="imgs">${imgs}</div>` : ''}
  ${blocks.join('\n  ')}
  ${i.collab_todo && i.collab_todo.length && !i.collab_done ? `<p class="next">À faire après publication : inviter en collaboration ${i.collab_todo.map((h) => '@' + esc(h)).join(', ')} (Reel → ⋯ → Modifier → Identifier des personnes → Inviter un collaborateur).</p>` : ''}
  <p class="idl">${esc(i.id)}${k === 'todo' ? ' · ' + esc(label[i.mode] || '') : ''}</p>
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
.imgs{display:flex;gap:6px;overflow-x:auto}.media{all:unset;position:relative;cursor:zoom-in;flex:none;border-radius:6px;display:block}.media:focus-visible{outline:3px solid var(--blue);outline-offset:2px}
.media .play{position:absolute;inset:auto auto 8px 8px;width:34px;height:34px;border-radius:50%;background:rgba(79,98,174,.92);color:#fff;display:grid;place-items:center;font-size:14px;padding-left:2px;box-sizing:border-box}
.imgs video{height:190px;border-radius:6px;border:1px solid #e5e6ee;background:#fff;display:block}.imgs img{display:block;height:190px;border-radius:6px;border:1px solid #e5e6ee}
.ph{height:120px;min-width:90px;display:grid;place-items:center;font-size:12px;text-align:center;padding:6px;background:var(--soft);border-radius:6px;color:var(--grey)}
details{background:var(--soft);border-radius:6px;padding:4px 9px}summary{cursor:pointer;font-weight:700;font-size:12px;color:var(--blue)}details p{margin:4px 0}
.tags{margin:0;font-size:12.5px;color:var(--grey)}.sticker{margin:0;font-size:13.5px;background:#faf6d8;border-radius:6px;padding:4px 9px}
ul{margin:0;padding-left:18px;font-size:13.5px}.needs li{color:#a33a26}mark{background:var(--yellow);padding:0 3px;border-radius:3px}
.card footer{margin-top:auto;display:flex;gap:10px;font-size:13px;color:var(--grey);padding-top:4px}
.st{font-weight:700;color:var(--ink)}.st-approved,.st-scheduled,.st-done{color:#2f7d4a}
.legend{display:flex;flex-wrap:wrap;gap:14px;font-size:13px;color:var(--grey);margin-top:8px}
.hide{display:none!important}
.lb{position:fixed;inset:0;z-index:50;background:rgba(20,22,30,.97);display:none;align-items:center;justify-content:center;padding:56px 56px 20px}
.lb.open{display:flex}.vbox{position:relative;display:flex;align-items:center;justify-content:center;max-width:100%;max-height:100%}.vmsg{position:absolute;color:#fff;font-size:15px;text-shadow:0 1px 4px #000;pointer-events:none;margin:0}.imgs .vid img{height:190px}.lb img,.lb video{max-width:100%;max-height:100%;border-radius:8px;background:#000;box-shadow:0 10px 40px rgba(0,0,0,.4)}
.lb button{position:absolute;border:0;background:rgba(255,255,255,.14);color:#fff;font:600 22px system-ui;width:46px;height:46px;border-radius:50%;cursor:pointer}
.lb button:hover{background:rgba(255,255,255,.28)}.lb .x{top:10px;right:12px}.lb .prev{left:10px;top:50%;transform:translateY(-50%)}.lb .next{right:10px;top:50%;transform:translateY(-50%)}
.lb .cap{position:absolute;top:18px;left:18px;color:#fff;font:600 15px system-ui;opacity:.85}
@media (max-width:600px){.lb{padding:52px 6px 10px}.lb .prev,.lb .next{top:auto;bottom:14px;transform:none}}
.stats{display:flex;gap:8px;flex-wrap:wrap;margin:2px 0 8px}.stats span,.chip{font-size:13px;font-weight:700;border-radius:99px;padding:2px 10px}.c-pub{background:#dff1e5;color:#2f7d4a}.c-prog{background:#e4e8f7;color:var(--blue)}.c-todo{background:#faf0c8;color:#7a5a00}.c-arch{background:#eee;color:#777}.next{margin:0 0 10px;font-size:15px}.kind{font-weight:700}.chip{margin-left:auto}.idl{margin:0;font-size:11.5px;color:var(--grey)}.k-pub{opacity:.75}.pastd{margin-top:26px;background:none}.pastd>summary{font-size:15px}\n.decide{margin:22px 0 6px;background:#faf6d8;border-radius:12px;padding:14px 18px}.decide h2{font:700 17px Unbounded,system-ui,sans-serif;color:var(--blue);margin:0 0 8px}.decide ol{margin:0;padding-left:22px;font-size:15px}.decide li{margin:3px 0}.decide ul.done{margin:0 0 14px;padding-left:22px;list-style:'✓  '}.decide h2+ul,.decide h2+ol{margin-top:0}
</style></head><body>
<div class="top"><h1>Bosphore sur Seine · Campagne</h1>
<p class="sub">ZinAI publie tout seul sur Instagram à l’heure indiquée. Pour changer ou arrêter un post, dites-le à Bertuğ avant l’heure. Mis à jour le ${esc(new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeStyle: 'short', timeZone: 'Europe/Paris' }).format(new Date()))}.</p>
<div class="stats"><span class="c-pub">${prog.filter((i) => cat(i) === 'pub').length} publiés</span><span class="c-prog">${prog.filter((i) => cat(i) === 'prog').length} programmés</span><span class="c-todo">${todo.length} à faire par une personne</span></div>
${next ? `<p class="next">Prochain post : <b>${fmtDay(next.date)} à ${esc(next.time)}</b> · ${esc(({ reel: 'Reel', story: 'Story', post: 'Post' })[next.format] || next.format)} · ${mark(next.title)}</p>` : ''}
<div class="filters tabs" role="tablist">
<button role="tab" aria-pressed="true" data-t="prog">Programme</button>
<button role="tab" aria-pressed="false" data-t="todo">À faire (${todo.length})</button>
<button role="tab" aria-pressed="false" data-t="arch">Brouillons et anciens (${arch.length})</button>
</div></div>
<main>
<div class="tab" data-t="prog">
${daysHtml(upcoming)}
${past.length ? `<details class="pastd"><summary>Déjà publié avant aujourd’hui (${past.length})</summary>${daysHtml(past)}</details>` : ''}
</div>
<div class="tab hide" data-t="todo">
<p class="sub">Ce que ZinAI ne peut pas faire seul : Shotgun et réglages faits à la main. Les publicités sont suivies à part (plan dans ZinAI, lancées par Ruşan).</p>
${daysHtml(todo)}
${c.decisions ? `<section class="decide"><h2>${esc(c.decisions.title_open || 'Encore ouvert')}</h2><ol>${c.decisions.items.map((x) => `<li>${mark(x)}</li>`).join('')}</ol></section>` : ''}
</div>
<div class="tab hide" data-t="arch">
<p class="sub">Idées et versions plus anciennes qui ne seront pas publiées telles quelles.</p>
${daysHtml(arch)}
</div>
</main>
<div class="lb" role="dialog" aria-modal="true" aria-label="Aperçu"><span class="cap"></span><button class="x" aria-label="Fermer">✕</button><button class="prev" aria-label="Précédent">‹</button><button class="next" aria-label="Suivant">›</button><div class="stage" style="display:contents"></div></div>
<script>
const lb=document.querySelector('.lb'),stage=lb.querySelector('.stage'),cap=lb.querySelector('.cap');let list=[],at=0,opener=null;
let blobUrl=null;
function show(){const m=list[at];stage.innerHTML='';if(blobUrl){URL.revokeObjectURL(blobUrl);blobUrl=null;}
 if(m.dataset.kind==='video'){
  const box=document.createElement('div');box.className='vbox';
  const msg=document.createElement('p');msg.className='vmsg';msg.textContent='Chargement de la vidéo…';
  const el=document.createElement('video');el.controls=true;el.playsInline=true;el.setAttribute('playsinline','');el.loop=true;el.preload='auto';
  box.append(el,msg);stage.appendChild(box);const want=at;
  // load the whole file, then play it from memory: works on phones and in-app browsers that refuse streamed video
  fetch(m.dataset.src).then(r=>{if(!r.ok)throw new Error(r.status);return r.blob();}).then(b=>{
   if(want!==at)return;blobUrl=URL.createObjectURL(new Blob([b],{type:'video/mp4'}));el.src=blobUrl;msg.textContent='';
   const p=el.play();if(p&&p.catch)p.catch(()=>{msg.textContent='Touchez ▶ pour lancer la vidéo';});
  }).catch(()=>{el.src=m.dataset.src;msg.textContent='';});
 }else{const el=document.createElement('img');el.src=m.dataset.src;el.alt=m.getAttribute('aria-label')||'';stage.appendChild(el);}
 cap.textContent=(m.closest('.card').querySelector('.idl')||{textContent:''}).textContent+(list.length>1?'  ·  '+(at+1)+'/'+list.length:'');
 lb.querySelector('.prev').style.display=lb.querySelector('.next').style.display=list.length>1?'':'none';}
function openLb(m){opener=m;list=[...m.closest('.imgs').querySelectorAll('.media')];at=list.indexOf(m);show();lb.classList.add('open');document.body.style.overflow='hidden';lb.querySelector('.x').focus();}
function closeLb(){lb.classList.remove('open');stage.innerHTML='';if(blobUrl){URL.revokeObjectURL(blobUrl);blobUrl=null;}document.body.style.overflow='';opener&&opener.focus();}
document.addEventListener('click',e=>{const m=e.target.closest('.media');if(m){e.preventDefault();openLb(m);}});
lb.querySelector('.x').onclick=closeLb;lb.onclick=e=>{if(e.target===lb)closeLb();};
lb.querySelector('.prev').onclick=()=>{at=(at-1+list.length)%list.length;show();};lb.querySelector('.next').onclick=()=>{at=(at+1)%list.length;show();};
document.addEventListener('keydown',e=>{if(!lb.classList.contains('open'))return;if(e.key==='Escape')closeLb();if(e.key==='ArrowLeft')lb.querySelector('.prev').click();if(e.key==='ArrowRight')lb.querySelector('.next').click();});
let x0=null;lb.addEventListener('touchstart',e=>{x0=e.touches[0].clientX},{passive:true});lb.addEventListener('touchend',e=>{if(x0===null)return;const dx=e.changedTouches[0].clientX-x0;if(Math.abs(dx)>50&&list.length>1)lb.querySelector(dx<0?'.next':'.prev').click();x0=null;});
const bs=[...document.querySelectorAll('.filters button')];
bs.forEach(b=>b.onclick=()=>{bs.forEach(x=>x.setAttribute('aria-pressed',x===b));const t=b.dataset.t;
document.querySelectorAll('.tab').forEach(s=>s.classList.toggle('hide',s.dataset.t!==t));window.scrollTo(0,0);});
</script></body></html>`;
  fs.writeFileSync(path.join(dir, 'index.html'), html);
  console.log(`board: ${path.relative(ROOT, dir)}/index.html (${c.items.length} items)`);
}

function buildPacks(ids) {
  const items = (ids.length ? c.items.filter((i) => ids.includes(i.id)) : c.items.filter((i) => i.status === 'approved'))
    .filter((i) => i.status !== 'retired').sort(byTime);
  if (!items.length) { console.error('nothing to pack (give ids, or approve items first)'); process.exit(1); }
  const where = (i) => i.mode === 'manual' ? 'Instagram app on the phone (sticker by hand)'
    : i.mode === 'auto' ? (i.format === 'reel' ? 'Meta Business Suite (Instagram Reel + Facebook) · Buffer (TikTok + YouTube Shorts, 30 min later)'
      : 'Meta Business Suite (Instagram + Facebook)')
    : i.mode === 'shotgun' ? 'Shotgun Smartboard (by hand)' : i.mode === 'website' ? '/site ' + i.id : i.mode === 'meta-ads' ? '/ads ' + i.id : i.mode;
  const days = {};
  for (const i of items) {
    const dir = path.join(OUT, 'packs', i.date, i.id);
    fs.mkdirSync(dir, { recursive: true });
    const files = [];
    (i.visuals || []).forEach((v, k) => {
      let src, name;
      if (v.startsWith('video:')) {
        const id = v.slice(6); src = path.join(OUT, 'video', id + '.mp4');
        name = id.startsWith('feed-') ? 'facebook-4x5.mp4' : id.startsWith('story-') || i.format === 'story' ? 'story.mp4' : 'instagram-reel.mp4';
      } else { src = path.join(OUT, v + '.png'); name = (i.format === 'story' ? 'story' : 'post') + (k ? '-' + (k + 1) : '') + '.png'; }
      if (fs.existsSync(src)) { fs.copyFileSync(src, path.join(dir, name)); files.push(name); } else files.push(name + ' (MISSING: ' + v + ')');
    });
    const cap = [i.caption_fr || i.text_fr || '', i.hashtags ? '\n' + i.hashtags : ''].filter(Boolean).join('\n').trim();
    if (cap) fs.writeFileSync(path.join(dir, 'caption.txt'), cap + '\n');
    const s = i.sticker_spec;
    const readme = [`# ${i.id} · ${i.date} ${i.time} (Paris)`, '', i.title, '', `**Where:** ${where(i)}`, `**Status:** ${i.status}`, '',
      '**Files:** ' + (files.join(', ') || 'none'), cap ? '**Caption:** caption.txt' : '',
      i.collaborators ? '**Collaborators:** ' + i.collaborators.join(', ') : '',
      s ? '**Sticker:** ' + Object.entries(s).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(' / ') : v}`).join(' · ') : '',
      i.checklist ? '**Steps:**\n' + i.checklist.map((x) => '- [ ] ' + x).join('\n') : '',
      i.needs?.length ? '**Still needed:**\n' + i.needs.map((x) => '- ' + x).join('\n') : ''].filter((x) => x !== '').join('\n\n');
    fs.writeFileSync(path.join(dir, 'README.md'), readme + '\n');
    (days[i.date] ||= []).push(`- [ ] ${i.time} · **${i.id}** · ${where(i)} · \`${i.id}/\``);
  }
  for (const [d, lines] of Object.entries(days)) {
    const f = path.join(OUT, 'packs', d, 'index.md');
    fs.writeFileSync(f, `# ${d} · what to post\n\n${lines.join('\n')}\n`);
    console.log(path.relative(ROOT, f));
  }
}
