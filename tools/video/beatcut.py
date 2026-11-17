#!/usr/bin/env python3
"""Montage cut on the beat: several short shots edited to a track, 9:16 (teasers, J-1 recap, after-movie).

  python3 tools/video/beatcut.py --music track.wav --music-start 30 --seconds 15 \
      --shot rehearsal.mp4:12 --shot session.mp4:95 --shot crowd.mov:4 \
      [--beats-per-shot 4] [--end-card out/<client>/tomorrow-story-fr.png] --out out/<client>/video/teaser.mp4

Each --shot is file:start (seconds). Shots are used in order and looped if there are fewer shots
than cuts. Cuts land exactly on the track's beats (librosa); the track is the only audio.
"""
import argparse, os, subprocess, tempfile


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--music', required=True)
    ap.add_argument('--music-start', type=float, default=0)
    ap.add_argument('--seconds', type=float, default=15)
    ap.add_argument('--shot', action='append', required=True)
    ap.add_argument('--beats-per-shot', type=int, default=4)
    ap.add_argument('--end-card')
    ap.add_argument('--out', required=True)
    a = ap.parse_args()
    import librosa, numpy as np
    y, sr = librosa.load(a.music, sr=22050, offset=a.music_start, duration=a.seconds)
    tempo, beats = librosa.beat.beat_track(y=y, sr=sr, units='time')
    cuts = [0.0] + [t for t in beats[a.beats_per_shot::a.beats_per_shot] if t < a.seconds - 0.5] + [a.seconds]
    print(f'tempo {float(np.atleast_1d(tempo)[0]):.0f} bpm, {len(cuts) - 1} shots')
    shots = [s.rsplit(':', 1) for s in a.shot]
    with tempfile.TemporaryDirectory() as d:
        parts = []
        for k in range(len(cuts) - 1):
            src, st = shots[k % len(shots)]
            st = float(st) + (k // len(shots)) * (cuts[k + 1] - cuts[k])     # reuse a shot further along
            p = os.path.join(d, f'{k:03}.mp4')
            subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-ss', str(st), '-t', f'{cuts[k + 1] - cuts[k]:.3f}', '-i', src,
                            '-vf', 'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30',
                            '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', p], check=True)
            parts.append(p)
        lst = os.path.join(d, 'list.txt')
        open(lst, 'w').write(''.join(f"file '{p}'\n" for p in parts))
        os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
        inputs = ['-f', 'concat', '-safe', '0', '-i', lst, '-ss', str(a.music_start), '-t', str(a.seconds), '-i', a.music]
        vf, vmap = None, '0:v'
        if a.end_card:
            inputs += ['-loop', '1', '-t', str(a.seconds), '-i', a.end_card]
            st = max(cuts[-2], a.seconds - 2.5)
            vf = f"[2:v]scale=1080:1920,format=rgba[e];[0:v][e]overlay=0:0:enable='gte(t,{st:.2f})'[v]"
            vmap = '[v]'
        cmd = ['ffmpeg', '-y', '-loglevel', 'error', *inputs]
        if vf:
            cmd += ['-filter_complex', vf]
        cmd += ['-map', vmap, '-map', '1:a', '-af', f'afade=t=out:st={a.seconds - 0.8}:d=0.8',
                '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p',
                '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', a.out]
        subprocess.run(cmd, check=True)
    print('montage:', a.out)


if __name__ == '__main__':
    main()
