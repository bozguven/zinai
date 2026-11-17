#!/usr/bin/env python3
"""Cut a moment from a long video into a 9:16 Reel: reframe, hook text, subtitles, end card.

  python3 tools/video/clip.py --in session.mp4 --start 72 --end 110 --out out/<client>/clips/r01.mp4
        [--hook out/<client>/hook-r01.png] [--end-card out/<client>/tickets-open-story-fr.png]
        [--subs fr|tr] [--frame blur|crop] [--focus 0.5]

- --frame blur (default): the 16:9 video sits full-width in the middle, over a blurred, zoomed copy.
  --frame crop: centre crop (use --focus 0..1 to move the crop left/right onto the musician).
- --hook: a transparent PNG (visuals.json, "transparent": true) shown for the first 3 seconds.
- --end-card: a full story PNG shown for the last 2.5 seconds while the music keeps playing.
- --subs: speech only (Ruşan talking, interviews). Transcribed with faster-whisper (MIT), burned in
  with the brand font. Check the .srt before posting: names and Kurdish/Turkish words get misheard.
A person chooses --start/--end (use highlights.py to shortlist moments); never guess a song's best part.
"""
import argparse, os, subprocess, tempfile

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
FONTS = os.path.join(ROOT, 'assets', 'fonts')


def srt_time(t):
    h, r = divmod(t, 3600); m, s = divmod(r, 60)
    return f'{int(h):02}:{int(m):02}:{int(s):02},{int(round((s % 1) * 1000)):03}'


def transcribe(src, start, end, lang, path):
    from faster_whisper import WhisperModel
    with tempfile.TemporaryDirectory() as d:
        wav = os.path.join(d, 'a.wav')
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-ss', str(start), '-to', str(end), '-i', src,
                        '-ac', '1', '-ar', '16000', wav], check=True)
        model = WhisperModel('small', device='cpu', compute_type='int8')
        segs, _ = model.transcribe(wav, language=lang, vad_filter=True, word_timestamps=True)
        lines, i = [], 1
        for s in segs:                       # short lines: max ~5 words, readable on a phone
            words = list(s.words or [])
            for k in range(0, len(words), 5):
                chunk = words[k:k + 5]
                text = ''.join(w.word for w in chunk).strip()
                if text:
                    lines.append(f'{i}\n{srt_time(chunk[0].start)} --> {srt_time(chunk[-1].end)}\n{text}\n')
                    i += 1
    with open(path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines))
    return path


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--in', dest='src', required=True)
    ap.add_argument('--start', type=float, required=True)
    ap.add_argument('--end', type=float, required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument('--hook')
    ap.add_argument('--end-card')
    ap.add_argument('--subs', choices=['fr', 'tr', 'en'])
    ap.add_argument('--frame', choices=['blur', 'crop'], default='blur')
    ap.add_argument('--focus', type=float, default=0.5)
    a = ap.parse_args()
    dur = a.end - a.start
    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)

    inputs = ['-ss', str(a.start), '-t', str(dur), '-i', a.src]
    if a.frame == 'blur':
        g = ('[0:v]split[a][b];[a]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,'
             'gblur=sigma=40,eq=brightness=0.06:saturation=0.7[bg];'
             '[b]scale=1080:-2[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2[v0]')
    else:
        g = (f'[0:v]scale=-2:1920,crop=1080:1920:(iw-1080)*{a.focus}:0[v0]')
    last, n = 'v0', 1
    if a.subs:
        srt = os.path.splitext(a.out)[0] + f'.{a.subs}.srt'
        transcribe(a.src, a.start, a.end, a.subs, srt)
        style = ('FontName=Fira Sans Condensed,Bold=1,FontSize=13,PrimaryColour=&H00FFFFFF,'
                 'OutlineColour=&H00AE624F,BorderStyle=3,Outline=6,Shadow=0,Alignment=2,MarginV=70')
        g += f";[{last}]subtitles='{srt}':fontsdir='{FONTS}':force_style='{style}'[vs]"
        last = 'vs'
        print('subtitles:', srt)
    if a.hook:
        inputs += ['-i', a.hook]
        g += (f";[{last}]drawbox=x=0:y=0:w=1080:h=660:color=white@0.9:t=fill:enable='lt(t,3)',"
              f"drawbox=x=0:y=1620:w=1080:h=300:color=white@0.9:t=fill:enable='lt(t,3)'[vb];"
              f"[{n}:v]scale=1080:1920,format=rgba[h];[vb][h]overlay=0:0:enable='lt(t,3)'[vh]")
        last, n = 'vh', n + 1
    if a.end_card:
        inputs += ['-loop', '1', '-t', str(dur), '-i', a.end_card]
        st = max(dur - 2.5, 0)
        g += (f";[{n}:v]scale=1080:1920,format=rgba,fade=t=in:st={st}:d=0.25:alpha=1[e];"
              f"[{last}][e]overlay=0:0:enable='gte(t,{st})'[ve]")
        last, n = 've', n + 1
    cmd = ['ffmpeg', '-y', '-loglevel', 'error', *inputs, '-filter_complex', g, '-map', f'[{last}]', '-map', '0:a?',
           '-af', f'afade=t=in:d=0.2,afade=t=out:st={max(dur - 0.6, 0)}:d=0.6',
           '-r', '30', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p',
           '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', '-t', str(dur), a.out]
    subprocess.run(cmd, check=True)
    print('clip:', a.out)


if __name__ == '__main__':
    main()
