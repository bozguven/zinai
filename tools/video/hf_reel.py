#!/usr/bin/env python3
"""Build a HyperFrames Reel in the E10 house style from a short recipe, then (optionally) render it.

  python3 tools/video/hf_reel.py videos/recipes/e13.json [--render]

Recipe (JSON):
{
  "id": "e13",
  "media_dir": "/path/to/clips",            # folder holding the source clips (not in git)
  "audio": {"src": "p8.mp4", "start": 21.1, "seconds": 16},
  "shots": [["p8.mp4", 6.0, 4], ["p9.mp4", 13.0, 2], ...],   # [clip, start second in clip, length in beats]
  "end_beats": 9,                            # last N beats: dark end card over the last shot
  "texts": [{"text": "Jusqu’à 4h.", "from": 0, "to": 8, "style": "hook"}, ...],  # beats; styles: hook | line | tag
  "end_line": "Jusqu’à 4h, sur la Seine",
  "credit": "Images : Horde × Baajar, Cabaret Sauvage, 2025",
  "blackout_beats": [17, 19]                 # optional: beats that cut to black for a moment (mystery)
}
Style: real night footage cut on the beat, white Unbounded type with a beat "hit", brand line on top,
credit always on screen, end card = line + date/place + yellow ticket pill. Text stays in the 168–1330 px band.
"""
import json, os, subprocess, sys, shutil, html

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
HF = ['node', os.path.join(ROOT, '.claude/skills/hyperframes/scripts/plugin-cli.mjs')]
FONTS = os.path.join(ROOT, 'videos/e10/assets/fonts')


def sh(cmd, **kw):
    return subprocess.run(cmd, check=True, **kw)


def beats_of(project, wav):
    out = subprocess.run(HF + ['beats', wav, '--json'], cwd=project, capture_output=True, text=True).stdout
    d = json.loads(out[out.index('{'):])
    bpm, bt = d.get('bpm'), d.get('beatTimes') or []
    if not bpm:  # HyperFrames found no steady beat: fall back to librosa, then to a house default
        try:
            import librosa
            y, sr = librosa.load(wav, sr=22050, mono=True)
            t, frames = librosa.beat.beat_track(y=y, sr=sr)
            bpm = float(t[0] if hasattr(t, '__len__') else t) or None
            bt = list(librosa.frames_to_time(frames, sr=sr))
        except Exception:
            bpm = None
        bpm = bpm or 122.0
    return bpm, bt


def build(recipe_path, render=False):
    r = json.load(open(recipe_path))
    rid = r['id']
    fmt = r.get('format', 'reel')
    W, H = (1080, 1350) if fmt == 'feed' else (1080, 1920)
    L = ({'brand': 80, 'hook': 330, 'line': 360, 'tag': 250, 'mega': 300, 'endline': 260, 'info': 640, 'cta': 820, 'credit': 1280}
         if fmt == 'feed' else
         {'brand': 250, 'hook': 560, 'line': 600, 'tag': 470, 'mega': 520, 'endline': 470, 'info': 840, 'cta': 1020, 'credit': 1270})
    cta_text = r.get('cta', 'Lien juste en dessous ↓' if fmt == 'story' else 'Billets : lien en bio')
    proj = os.path.join(ROOT, 'videos', rid)
    media = os.path.join(proj, 'assets/media')
    os.makedirs(media, exist_ok=True)
    os.makedirs(os.path.join(proj, 'assets/fonts'), exist_ok=True)
    for f in os.listdir(FONTS):
        shutil.copy(os.path.join(FONTS, f), os.path.join(proj, 'assets/fonts', f))
    for f in ('package.json', 'hyperframes.json', 'CLAUDE.md', 'AGENTS.md'):
        src = os.path.join(ROOT, 'videos/e10', f)
        if os.path.exists(src): shutil.copy(src, os.path.join(proj, f))
    json.dump({"id": rid, "name": rid}, open(os.path.join(proj, 'meta.json'), 'w'))
    src_dir = r['media_dir']

    # sound: extract, find the first beat, re-extract so beat 0 is at t=0
    a = r['audio']; secs = a['seconds']
    tmp = os.path.join(media, '_probe.wav')
    sh(['ffmpeg', '-loglevel', 'error', '-y', '-ss', str(a['start']), '-t', str(secs + 2), '-i', os.path.join(src_dir, a['src']), '-vn', '-ac', '2', '-ar', '48000', tmp])
    bpm, bt = beats_of(proj, tmp)
    first = bt[0] if bt else 0.0
    sh(['ffmpeg', '-loglevel', 'error', '-y', '-ss', str(a['start'] + first), '-t', str(secs), '-i', os.path.join(src_dir, a['src']), '-vn', '-ac', '2', '-ar', '48000', os.path.join(media, 'track.wav')])
    os.remove(tmp)
    B = 60.0 / bpm
    total_beats = int(secs / B)
    dur = round(total_beats * B, 3)

    # footage proxies (1080x1920, 30 fps, silent), one per source clip
    for clip in sorted({s[0] for s in r['shots']}):
        out = os.path.join(media, clip)
        shared = [os.path.join(ROOT, 'videos', d, 'assets/media', clip) for d in os.listdir(os.path.join(ROOT, 'videos'))]
        shared = [x for x in shared if os.path.exists(x) and os.path.abspath(x) != os.path.abspath(out)]
        if not os.path.exists(out) and shared:
            os.link(shared[0], out) if os.stat(shared[0]).st_dev == os.stat(media).st_dev else shutil.copy(shared[0], out)
        if not os.path.exists(out):
            sh(['ffmpeg', '-loglevel', 'error', '-y', '-i', os.path.join(src_dir, clip), '-an', '-vf', 'scale=1080:1920,fps=30',
                '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '19', '-pix_fmt', 'yuv420p', out])

    # shots on the beat grid; the last shot is stretched to the end
    shots, t = [], 0
    for k, (clip, ms, nb) in enumerate(r['shots']):
        if t >= total_beats: break
        nb = total_beats - t if k == len(r['shots']) - 1 else min(nb, total_beats - t)
        shots.append((f's{k+1}', clip, ms, t, nb)); t += nb
    end_from = total_beats - r.get('end_beats', 8)

    E = html.escape
    vids = '\n'.join(
        f'      <video id="{i}" class="shot clip" src="assets/media/{c}" data-start="{round(b*B,3)}" data-duration="{round(n*B,3)}" '
        f'data-media-start="{ms}" data-track-index="0" muted playsinline></video>' for i, c, ms, b, n in shots)
    texts = []
    for k, tx in enumerate(r['texts']):
        a_, b_ = tx['from'], min(tx['to'], end_from)
        if b_ <= a_: continue
        texts.append((f't{k+1}', tx, round(a_*B, 3), round((b_-a_)*B, 3)))
    def tstyle(tx):
        if tx.get('style') == 'mega' and len(tx['text']) > 4: return ' style="font-size:200px"'
        if tx.get('style') == 'hook' and len(tx['text']) > 12: return f' style="font-size:{max(84, int(1500 / len(tx["text"])))}px"'  # long hooks stay inside the frame
        return ''
    tdivs = '\n'.join(f'      <div id="{i}" class="t {tx.get("style","line")} clip"{tstyle(tx)} data-start="{s}" data-duration="{d}" data-track-index="4">{E(tx["text"])}</div>' for i, tx, s, d in texts)
    es = round(end_from*B, 3); ed = round(dur - es, 3)
    info_s = round(es + 2*B, 3); cta_s = info_s if fmt == 'story' else round(es + 4*B, 3)  # stories don't loop: show the CTA early

    js_push = ',\n'.join(f'["#{i}",{round(b*B,3)},{round(n*B,3)},{1.0 + 0.06*(k%3)},{1.08 - 0.03*(k%2)}]' for k, (i, c, ms, b, n) in enumerate(shots))
    cuts = [round(b*B, 3) for (_, _, _, b, _) in shots[1:] if b < end_from]
    js_text = '\n'.join(
        (f'      tl.fromTo("#{i}", {{ scale: 1.14 }}, {{ scale: 1, duration: 0.6, ease: "power3.out" }}, {s});' if tx.get('style') in ('hook', 'mega') else
         f'      tl.fromTo("#{i}", {{ opacity: 0, y: 40 }}, {{ opacity: 1, y: 0, duration: 0.25, ease: "power3.out" }}, {s});')
        for i, tx, s, d in texts)
    blk = [round(b*B, 3) for b in r.get('blackout_beats', [])]

    doc = f'''<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width={W}, height={H}" />
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js"></script>
    <style>
      @font-face {{ font-family: "Unbounded"; font-weight: 900; src: url("assets/fonts/unbounded-latin-900-normal.woff2") format("woff2"); }}
      @font-face {{ font-family: "Fira Sans Condensed"; font-weight: 500; src: url("assets/fonts/fira-sans-condensed-latin-500-normal.woff2") format("woff2"); }}
      @font-face {{ font-family: "Fira Sans Condensed"; font-weight: 700; src: url("assets/fonts/fira-sans-condensed-latin-700-normal.woff2") format("woff2"); }}
      :root {{ --ink: #f6f2e6; --window: #decf58; }}
      * {{ margin: 0; padding: 0; box-sizing: border-box; }}
      html, body {{ width: {W}px; height: {H}px; overflow: hidden; background: #000; }}
      #root {{ position: relative; width: 100%; height: 100%; overflow: hidden; font-family: "Fira Sans Condensed", sans-serif; color: var(--ink); }}
      .shot {{ position: absolute; inset: 0; width: {W}px; height: {H}px; object-fit: cover; z-index: 1; }}
      .full {{ position: absolute; inset: 0; }}
      #shade {{ z-index: 2; background: linear-gradient(180deg, #000a 0%, #0004 24%, transparent 40%, transparent 72%, #000a 100%); }}
      #black {{ z-index: 3; background: #000; }}
      #endshade {{ z-index: 3; background: linear-gradient(180deg, #0d1330cc 0%, #0d1330aa 55%, #0d1330ee 100%); }}
      .t {{ position: absolute; left: 0; width: 1080px; text-align: center; z-index: 10; text-wrap: balance; text-shadow: 0 4px 30px #0009; }}
      #brand {{ top: {L['brand']}px; font: 700 30px/1 "Fira Sans Condensed"; letter-spacing: 0.32em; opacity: 0.9; }}
      .hook {{ top: {L['hook']}px; padding: 0 70px; font: 900 170px/0.98 "Unbounded"; letter-spacing: -0.04em; }}
      .line {{ top: {L['line']}px; padding: 0 120px; font: 900 90px/1.03 "Unbounded"; letter-spacing: -0.03em; }}
      .mega {{ top: {L['mega']}px; font: 900 300px/0.95 "Unbounded"; letter-spacing: -0.05em; }}
      .sub {{ top: {L['mega'] + 340}px; padding: 0 120px; font: 900 76px/1.05 "Unbounded"; letter-spacing: -0.03em; }}
      .tag {{ top: {L['tag']}px; font: 700 40px/1 "Fira Sans Condensed"; letter-spacing: 0.24em; color: var(--window); }}
      #endline {{ top: {L['endline']}px; padding: 0 130px; font: 900 88px/1.04 "Unbounded"; letter-spacing: -0.03em; }}
      #info {{ top: {L['info']}px; font: 700 44px/1.35 "Fira Sans Condensed"; }}
      #cta {{ top: {L['cta']}px; }}
      #cta span {{ display: inline-block; padding: 18px 40px; border-radius: 999px; background: var(--window); color: #141a3a; font: 700 44px/1 "Fira Sans Condensed"; text-shadow: none; }}
      #credit {{ top: {L['credit'] if fmt != 'feed' else H - 60}px; font: 500 26px/1 "Fira Sans Condensed"; opacity: 0.75; }}
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="{dur}" data-width="{W}" data-height="{H}" data-fps="30">
{vids}
      <div id="shade" class="full clip" data-start="0" data-duration="{dur}" data-track-index="1"></div>
      <div id="black" class="full clip" data-start="0" data-duration="{dur}" data-track-index="2"></div>
      <div id="endshade" class="full clip" data-start="{es}" data-duration="{ed}" data-track-index="2"></div>
      <div id="brand" class="t clip" data-start="0" data-duration="{dur}" data-track-index="3">BOSPHORE SUR SEINE</div>
{tdivs}
      <div id="endline" class="t clip" data-start="{es}" data-duration="{ed}" data-track-index="4">{E(r["end_line"])}</div>
      <div id="info" class="t clip" data-start="{info_s}" data-duration="{round(dur-info_s,3)}" data-track-index="5">Vendredi 27.11 · 20h30 → 4h<br />Péniche Le Marcounet · Pont Marie</div>
      <div id="cta" class="t clip" data-start="{cta_s}" data-duration="{round(dur-cta_s,3)}" data-track-index="6"><span>{E(cta_text)}</span></div>
      <div id="credit" class="t clip" data-start="0" data-duration="{dur}" data-track-index="7">{E(r.get("credit",""))}</div>
      <audio id="music" src="assets/media/track.wav" data-start="0" data-duration="{dur}" data-volume="1" data-fade-in="0.05" data-fade-out="1.2" data-track-index="8"></audio>
    </div>
    <script>
      window.__timelines = window.__timelines || {{}};
      const tl = gsap.timeline({{ paused: true }});
      const B = {round(B,4)};
      [{js_push}].forEach(([id,a,d,f,t]) => tl.fromTo(id, {{ scale: f }}, {{ scale: t, duration: d, ease: "none" }}, a));
      tl.set("#black", {{ opacity: 0 }}, 0);
      {json.dumps(blk)}.forEach((t) => {{ tl.set("#black", {{ opacity: 1 }}, t); tl.set("#black", {{ opacity: 0 }}, t + B * 0.5); }});
      {json.dumps(cuts)}.forEach((t) => {{
        tl.set("#shade", {{ opacity: 0.35 }}, t);
        tl.to("#shade", {{ opacity: 1, duration: B * 0.8, ease: "power2.out" }}, t + 0.01);
      }});
{js_text}
      tl.fromTo("#endshade", {{ opacity: 0 }}, {{ opacity: 1, duration: 0.3 }}, {es});
      tl.fromTo("#endline", {{ opacity: 0, y: 40 }}, {{ opacity: 1, y: 0, duration: 0.35, ease: "power3.out" }}, {round(es+0.04,3)});
      tl.fromTo("#info", {{ opacity: 0, y: 24 }}, {{ opacity: 1, y: 0, duration: 0.3, ease: "power3.out" }}, {info_s});
      tl.fromTo("#cta", {{ opacity: 0, scale: 0.9 }}, {{ opacity: 1, scale: 1, duration: 0.3, ease: "back.out(2)" }}, {cta_s});
      window.__timelines["main"] = tl;
    </script>
  </body>
</html>
'''
    open(os.path.join(proj, 'index.html'), 'w').write(doc)
    open(os.path.join(media, 'README.md'), 'w').write(
        f"Media are not in git. Rebuild with: python3 tools/video/hf_reel.py {os.path.relpath(recipe_path, ROOT)} (needs the source clips in media_dir).\n")
    print(f'{rid}: {bpm} BPM, {total_beats} beats, {dur}s, {len(shots)} shots')
    if render:
        out = os.path.join(ROOT, 'out/bosphore-sur-seine/video', f"{r.get('out_prefix', 'reel')}-{rid}.mp4")
        sh(HF + ['render', '--quality', 'looks', '-o', out], cwd=proj)
        print('rendered', out)


if __name__ == '__main__':
    build(sys.argv[1], '--render' in sys.argv)
