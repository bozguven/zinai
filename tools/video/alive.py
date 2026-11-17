#!/usr/bin/env python3
"""Animated 9:16 loop from the flyer: the barge's windows light up with the music.

  python3 tools/video/alive.py --overlay out/<client>/<overlay>.png --out out/<client>/video/x.mp4
        [--audio track.wav --start 42.0] [--seconds 12] [--mode build|pulse] [--bpm 96]

- With --audio: each window follows one frequency band of the track (low notes on the left,
  high on the right), so the river "plays" the song. The audio is muxed in.
- Without audio: a silent loop at --bpm. `build` lights the windows one by one until the whole
  rive is lit (good for countdowns); `pulse` keeps them breathing on the beat. Silent loops are
  meant to get a sound on the phone (Instagram music) or the real track later.

The overlay is a transparent 1080x1920 PNG rendered from visuals.json with "transparent": true
and art "none" (text only). The artwork sits under it, bottom third.
"""
import argparse, os, subprocess, sys
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
W, H, FPS = 1080, 1920, 30
YELLOW = np.array([0xDE, 0xCF, 0x58], np.float32) / 255


def load_layer(name, width):
    im = Image.open(os.path.join(ROOT, 'assets', name)).convert('RGBA')
    h = round(im.height * width / im.width)
    return np.asarray(im.resize((width, h), Image.LANCZOS), np.float32) / 255


def band_envelopes(audio, start, seconds, bands):
    import librosa
    y, sr = librosa.load(audio, sr=22050, mono=True, offset=start, duration=seconds)
    hop = sr // FPS
    mel = librosa.feature.melspectrogram(y=y, sr=sr, n_mels=bands, hop_length=hop, fmin=60, fmax=8000)
    db = librosa.power_to_db(mel, ref=np.max)
    lo, hi = np.percentile(db, 30, axis=1, keepdims=True), np.percentile(db, 98, axis=1, keepdims=True)
    env = np.clip((db - lo) / np.maximum(hi - lo, 1e-6), 0, 1)
    onset = librosa.onset.onset_strength(y=y, sr=sr, hop_length=hop)
    onset = np.clip(onset / max(np.percentile(onset, 98), 1e-6), 0, 1)
    out = np.zeros_like(env)          # fast attack, slow release: windows flash then fade
    for t in range(env.shape[1]):
        prev = out[:, t - 1] if t else env[:, 0]
        tgt = np.clip(env[:, t] * 0.8 + onset[min(t, len(onset) - 1)] * 0.35, 0, 1)
        out[:, t] = np.where(tgt > prev, tgt, prev * 0.88 + tgt * 0.12)
    n = int(seconds * FPS)
    return np.pad(out, ((0, 0), (0, max(0, n - out.shape[1]))), mode='edge')[:, :n]


def synthetic(n_windows, seconds, bpm, mode, rng):
    n = int(seconds * FPS)
    t = np.arange(n) / FPS
    beat = (t * bpm / 60) % 1
    kick = np.exp(-beat * 5)                                    # 1 at each beat, decays
    phase = rng.random(n_windows)
    lvl = np.zeros((n_windows, n), np.float32)
    if mode == 'build':
        order = rng.permutation(n_windows)
        on_at = np.empty(n_windows); on_at[order] = np.linspace(0.3, seconds * 0.8, n_windows)
        on_at = np.round(on_at * bpm / 60) * 60 / bpm            # switch on exactly on beats
        for i in range(n_windows):
            lit = t >= on_at[i]
            flash = np.exp(-np.clip(t - on_at[i], 0, None) * 6) * lit
            lvl[i] = 0.12 + lit * (0.7 + 0.15 * kick) + flash * 0.3
    else:
        for i in range(n_windows):
            group = (np.floor(t * bpm / 60) + int(phase[i] * 4)) % 4 == 0
            lvl[i] = 0.35 + 0.65 * kick * group + 0.1 * np.sin(2 * np.pi * (t / 3 + phase[i]))
    return np.clip(lvl, 0, 1)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--overlay', required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument('--audio')
    ap.add_argument('--start', type=float, default=0)
    ap.add_argument('--seconds', type=float, default=12)
    ap.add_argument('--mode', choices=['build', 'pulse'], default='build')
    ap.add_argument('--bpm', type=float, default=96)
    ap.add_argument('--art-y', type=int, default=1060, help='top of the artwork in the frame')
    ap.add_argument('--seed', type=int, default=27)
    a = ap.parse_args()

    base = load_layer('rive-base.webp', W)
    win = load_layer('rive-fenetres.webp', W)
    ah = base.shape[0]
    labels, n = ndimage.label(win[..., 3] > 0.35)
    xs = ndimage.center_of_mass(np.ones_like(labels), labels, range(1, n + 1))
    print(f'{n} windows found', file=sys.stderr)

    rng = np.random.default_rng(a.seed)
    if a.audio:
        bands = 16
        env = band_envelopes(a.audio, a.start, a.seconds, bands)
        cols = np.array([x for _, x in xs]) / W
        idx = np.clip((cols * bands).astype(int), 0, bands - 1)
        jitter = rng.uniform(0.85, 1.1, n)[:, None]
        lvl = np.clip(0.1 + env[idx] * jitter, 0, 1)
    else:
        lvl = synthetic(n, a.seconds, a.bpm, a.mode, rng)

    overlay = np.asarray(Image.open(a.overlay).convert('RGBA').resize((W, H)), np.float32) / 255
    bg = np.ones((H, W, 3), np.float32)
    y0 = a.art_y
    bg[y0:y0 + ah] = bg[y0:y0 + ah] * (1 - base[..., 3:]) + base[..., :3] * base[..., 3:]
    win_a = win[..., 3]

    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    cmd = ['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}',
           '-r', str(FPS), '-i', '-']
    if a.audio:
        cmd += ['-ss', str(a.start), '-t', str(a.seconds), '-i', a.audio,
                '-af', f'afade=t=in:d=0.3,afade=t=out:st={a.seconds - 0.8}:d=0.8', '-c:a', 'aac', '-b:a', '192k', '-shortest']
    cmd += ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', a.out]
    ff = subprocess.Popen(cmd, stdin=subprocess.PIPE)

    for f in range(lvl.shape[1]):
        per = np.concatenate([[0], lvl[:, f]])[labels]              # brightness of each pixel's window
        alpha = win_a * per
        glow = np.asarray(Image.fromarray((alpha * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(9)), np.float32) / 255
        a_all = np.clip(alpha + glow * 0.45, 0, 1)[..., None]
        frame = bg.copy()
        frame[y0:y0 + ah] = frame[y0:y0 + ah] * (1 - a_all) + YELLOW * a_all
        oa = overlay[..., 3:]
        frame = frame * (1 - oa) + overlay[..., :3] * oa
        ff.stdin.write((frame * 255 + 0.5).astype(np.uint8).tobytes())
    ff.stdin.close()
    sys.exit(ff.wait())


if __name__ == '__main__':
    main()
