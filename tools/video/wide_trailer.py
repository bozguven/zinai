#!/usr/bin/env python3
"""16:9 trailer (1920x1080) from vertical clips: three 9:16 panels side by side, cut on the bar,
text layers (transparent PNGs, one per section) on top. Used for the Shotgun video trailer.
  python3 tools/video/wide_trailer.py   (edit SEGMENTS / TEXTS below)"""
import subprocess, os
M = '/home/claude/media'; T = '/tmp/tr'
OUT = '/home/claude/zinai/out/bosphore-sur-seine/video/trailer-shotgun-16x9.mp4'
BAR = 1.935                      # 4 beats at 124 BPM (Plan 5 from 24.035 s, same sound as E10)
AUDIO = (f'{M}/p5.mp4', 24.035)
src = {'p2': f'{M}/p2.mp4', 'p3': f'{M}/p3.mp4', 'p5': f'{M}/p5.mp4', 'p8': f'{M}/p8.mp4', 'p9': f'{M}/p9.mp4',
       'v1': f'{M}/new18v/v1.mp4', 'v2': f'{M}/new18v/v2.mp4', 'v3': f'{M}/new18v/v3.mp4', 'v6': f'{M}/new18v/v6.mp4',
       's1': f'{M}/sax/s1.mp4', 'sax': f'{M}/sax/sax.mp4', 's2': f'{M}/sax/s2.mp4'}
SEGMENTS = [  # (left, centre, right), each (clip, start s); shots already used in the approved Reels
  [('p2', 30.0), ('p8', 25.0), ('p9', 36.0)], [('p9', 38.0), ('p2', 34.4), ('p8', 27.0)],
  [('p9', 13.0), ('p8', 6.0), ('p9', 6.5)],   [('p2', 35.0), ('p8', 38.0), ('p5', 8.0)],
  [('sax', 21.0), ('s1', 0.2), ('sax', 30.0)], [('sax', 38.0), ('s1', 2.0), ('s2', 2.0)],
  [('p3', 24.0), ('p9', 42.0), ('p3', 36.0)], [('p8', 24.0), ('p9', 30.0), ('p9', 24.0)],
  [('v2', 6.0), ('v1', 22.0), ('v6', 2.0)],   [('v1', 60.0), ('v3', 3.0), ('v2', 15.0)],
  [('p9', 20.0), ('p8', 41.0), ('p9', 26.0)], [('p9', 21.9), ('p8', 42.9), ('p9', 27.9)], [('p9', 23.8), ('p8', 44.0), ('p9', 29.8)],
]
TEXTS = [('t1', 0, 2), ('t2', 2, 4), ('t3', 4, 6), ('t4', 6, 8), ('t5', 8, 10), ('end', 10, 13)]  # in bars
def sh(c): subprocess.run(c, check=True)
os.makedirs(f'{T}/seg', exist_ok=True)
for n, seg in enumerate(SEGMENTS):
    ins, fl = [], []
    for k, (clip, st) in enumerate(seg):
        ins += ['-ss', str(st), '-t', str(BAR + 0.1), '-i', src[clip]]
        fl.append(f'[{k}:v]fps=25,scale=640:1138:force_original_aspect_ratio=increase,crop=640:1080,setsar=1[p{k}]')
    fl.append('[p0][p1][p2]hstack=3[v]')
    sh(['ffmpeg', '-loglevel', 'error', '-y', *ins, '-filter_complex', ';'.join(fl), '-map', '[v]', '-t', str(BAR),
        '-c:v', 'libx264', '-crf', '17', '-pix_fmt', 'yuv420p', '-an', f'{T}/seg/{n:02d}.mp4'])
open(f'{T}/seg/list.txt', 'w').write(''.join(f"file '{n:02d}.mp4'\n" for n in range(len(SEGMENTS))))
total = BAR * len(SEGMENTS)
ins = ['-f', 'concat', '-safe', '0', '-i', f'{T}/seg/list.txt', '-ss', str(AUDIO[1]), '-t', str(total), '-i', AUDIO[0]]
fl, last = [], '0:v'
for j, (k, a, b) in enumerate(TEXTS):
    ins += ['-loop', '1', '-t', str(total), '-i', f'{T}/{k}.png']
    fl.append(f'[{last}][{j+2}:v]overlay=0:0:enable=\'between(t,{a*BAR:.3f},{b*BAR - 0.001:.3f})\'[o{j}]'); last = f'o{j}'
fl.append(f'[1:a]afade=t=in:d=0.3,afade=t=out:st={total-1.5:.2f}:d=1.5[a]')
sh(['ffmpeg', '-loglevel', 'error', '-y', *ins, '-filter_complex', ';'.join(fl), '-map', f'[{last}]', '-map', '[a]',
    '-t', f'{total:.3f}', '-c:v', 'libx264', '-crf', '20', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-r', '25',
    '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', OUT])
print('trailer:', OUT, f'{total:.2f}s')
