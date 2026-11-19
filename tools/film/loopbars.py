#!/usr/bin/env python3
"""Stretch a short music track to a film's length by repeating whole phrases on the beat, so the track's own
opening starts the film and its own ending closes it.

    python3 loopbars.py <in> <out.wav> <film seconds> --grid <bpm> <first downbeat s> --loop <from bar> <to bar>

The track is cut into bars from the downbeat. Bars [0, to) play first, then [from, to) repeats as often as the film
needs, then [to, end) plays the ending. The start is trimmed by whole bars so the ending lands on the film's last
seconds rather than being cut off. Every splice is at the same place in the bar on both sides and gets a 25 ms
equal-power crossfade, so it is not heard. usetrack.py's own looping crossfades anywhere and would loop a fade-out.

16 November 2026: the corporate tech track the branch manager sent for the group films, 60.6 s at 125.28 bpm,
first downbeat 0.104 s, four-bar phrases, the ending from bar 28:
    python3 loopbars.py corporate-tech.m4a gcm-track-client.wav 112 --grid 125.28 0.104 --loop 8 24
"""
import subprocess, sys, wave
import numpy as np

SR = 44100
args = sys.argv[1:]
src, out, secs = args[0], args[1], float(args[2])
bpm, down = float(args[args.index('--grid') + 1]), float(args[args.index('--grid') + 2])
lo, hi = int(args[args.index('--loop') + 1]), int(args[args.index('--loop') + 2])

raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', src, '-ar', str(SR), '-ac', '2', '-f', 'f32le', '-'],
                     capture_output=True, check=True).stdout
x = np.frombuffer(raw, np.float32).reshape(-1, 2).T.astype(np.float64)
bar = 4 * 60.0 / bpm
B = lambda k: int(round((down + k * bar) * SR))           # sample index of bar k's downbeat
A, Z = B(lo), B(hi)
intro, loop, tail = x[:, :Z], x[:, A:Z], x[:, Z:]
XF = int(0.025 * SR)

def join(a, b):
    """b follows a at a downbeat: the last XF samples of a overlap the first XF of b, equal power."""
    t = np.linspace(0, np.pi / 2, XF)
    mid = a[:, -XF:] * np.cos(t) + b[:, :XF] * np.sin(t)
    return np.concatenate([a[:, :-XF], mid, b[:, XF:]], axis=1)

need = int(secs * SR)
k = 0
while intro.shape[1] + k * loop.shape[1] + tail.shape[1] - k * XF - XF < need:
    k += 1
y = intro
for _ in range(k):
    y = join(y, loop)
y = join(y, tail)
# trim the start by whole bars (never past the first repeat), so the ending lands at the film's end
extra = y.shape[1] - need
drop = 0
while drop + 1 <= hi and B(drop + 1) - B(0) <= extra:
    drop += 1
cut = B(drop) if drop else 0
y = y[:, cut:]
fade = int(0.04 * SR)
y[:, :fade] *= np.linspace(0, 1, fade)
st = np.empty(y.shape[1] * 2); st[0::2], st[1::2] = y[0], y[1]
with wave.open(out, 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((np.clip(st, -1, 1) * 32767).astype('<i2').tobytes())
print('%s: %.1fs for a %.1fs film · %d repeats of bars %d-%d (%.1fs) · starts at bar %d · %.1fs of the ending past the film'
      % (out, y.shape[1] / SR, secs, k, lo, hi, loop.shape[1] / SR, drop, (y.shape[1] - need) / SR))
