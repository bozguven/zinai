#!/usr/bin/env python3
"""Shortlist the liveliest moments of a long video (a 6-minute session, a rehearsal) for a person to pick.

  python3 tools/video/highlights.py --in session.mp4 [--length 20] [--top 4]

Scores every window of --length seconds on loudness, rhythmic activity (onsets) and how much the
sound changes (a voice coming in, the saz taking off). Writes <video>.highlights.json and a contact
sheet PNG with a frame from each candidate, so Bertuğ, Ali or Ruşan can choose in a few seconds.
It only suggests: the choice of the moment stays human.
"""
import argparse, json, os, subprocess, tempfile
import numpy as np


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--in', dest='src', required=True)
    ap.add_argument('--length', type=float, default=20)
    ap.add_argument('--top', type=int, default=4)
    ap.add_argument('--skip-intro', type=float, default=5)
    a = ap.parse_args()
    import librosa
    with tempfile.TemporaryDirectory() as d:
        wav = os.path.join(d, 'a.wav')
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', a.src, '-ac', '1', '-ar', '22050', wav], check=True)
        y, sr = librosa.load(wav, sr=22050)
    hop = 512
    fps = sr / hop
    rms = librosa.feature.rms(y=y, hop_length=hop)[0]
    onset = librosa.onset.onset_strength(y=y, sr=sr, hop_length=hop)
    flux = np.abs(np.diff(librosa.feature.spectral_centroid(y=y, sr=sr, hop_length=hop)[0], prepend=0))
    z = lambda x: (x - x.mean()) / (x.std() + 1e-9)
    score = z(rms) * 0.45 + z(onset) * 0.35 + z(np.minimum(flux, np.percentile(flux, 95))) * 0.2
    win = int(a.length * fps)
    csum = np.cumsum(np.concatenate([[0], score]))
    avg = (csum[win:] - csum[:-win]) / win
    avg[: int(a.skip_intro * fps)] = -np.inf
    picks = []
    for i in np.argsort(avg)[::-1]:
        if not np.isfinite(avg[i]):
            break
        s = i / fps
        # snap the start onto the nearest strong onset so the clip begins on a hit
        lo, hi = max(0, i - int(fps)), i + int(fps)
        s = round((lo + int(np.argmax(onset[lo:hi]))) / fps, 2)
        if all(abs(s - p['start']) >= a.length for p in picks):
            picks.append({'start': s, 'end': round(s + a.length, 2), 'score': round(float(avg[i]), 3)})
        if len(picks) == a.top:
            break
    picks.sort(key=lambda p: p['start'])
    base = os.path.splitext(a.src)[0]
    json.dump(picks, open(base + '.highlights.json', 'w'), indent=2)
    sel = '+'.join(f"between(t\\,{p['start'] + a.length / 2:.2f}\\,{p['start'] + a.length / 2 + 0.05:.2f})" for p in picks)
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', a.src, '-vf',
                    f"select='{sel}',scale=480:-2,tile={len(picks)}x1", '-frames:v', '1', '-vsync', 'vfr', base + '.highlights.png'])
    for k, p in enumerate(picks, 1):
        m = lambda t: f'{int(t // 60)}:{t % 60:04.1f}'
        print(f"{k}. {m(p['start'])} → {m(p['end'])}  (score {p['score']})")
    print('contact sheet:', base + '.highlights.png')


if __name__ == '__main__':
    main()
