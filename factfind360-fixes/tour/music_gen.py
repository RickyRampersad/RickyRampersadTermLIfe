# A composed background bed, not a drone: D major, I-V-vi-IV, warm pads with
# a slow-attack envelope, a plucked arpeggio on top, and a soft brushed hat.
# Rendered offline so the video needs no licensed asset.
import numpy as np, wave, sys

SR = 44100
DUR = float(sys.argv[1]) if len(sys.argv) > 1 else 112.0
BPM = 108.0
beat = 60.0 / BPM
bar = beat * 4

def note(f): return f
D3, Fs3, A3, D4 = 146.83, 185.00, 220.00, 293.66
A2, E3, Cs4 = 110.00, 164.81, 277.18
B2, B3, Fs4 = 123.47, 246.94, 369.99
G2, G3, B4c = 98.00, 196.00, 246.94
# chords: D, A, Bm, G — voiced low+mid
CHORDS = [
    [D3, A3, D4, Fs3],
    [A2, E3, A3, Cs4],
    [B2, Fs3, B3, D4],
    [G2, D3, G3, B3],
]
# arp notes per chord (pentatonic-ish, one octave up)
ARPS = [
    [D4, 369.99, 440.00, 587.33],
    [440.00, 329.63, 554.37, 659.25],
    [493.88, 587.33, 369.99, 440.00],
    [392.00, 493.88, 587.33, 440.00],
]

N = int(SR * DUR)
t_all = np.arange(N) / SR
mix = np.zeros(N)

def env_pad(n, a, r):
    e = np.ones(n)
    ai, ri = int(a * SR), int(r * SR)
    # the final pad of a track can be shorter than attack+release
    ai = max(1, min(ai, n)); ri = max(1, min(ri, n - 1))
    e[:ai] = np.linspace(0, 1, ai) ** 2
    e[-ri:] *= np.linspace(1, 0, ri) ** 1.5
    return e

def onepole_lp(x, cutoff):
    # simple one-pole lowpass, warm and cheap
    dt = 1.0 / SR
    rc = 1.0 / (2 * np.pi * cutoff)
    alpha = dt / (rc + dt)
    y = np.empty_like(x)
    acc = 0.0
    for i in range(len(x)):
        acc += alpha * (x[i] - acc)
        y[i] = acc
    return y

# --- pads: one bar per chord, overlapping tails ---
pad_len = int(bar * SR * 1.15)
pos = 0.0
ci = 0
while pos < DUR:
    n0 = int(pos * SR)
    n1 = min(N, n0 + pad_len)
    seg = n1 - n0
    if seg <= 0: break
    t = np.arange(seg) / SR
    w = np.zeros(seg)
    for f in CHORDS[ci % 4]:
        # two detuned saw-ish partial stacks for warmth
        for det in (0.9985, 1.0015):
            ff = f * det
            w += 0.20 * np.sin(2 * np.pi * ff * t)
            w += 0.08 * np.sin(2 * np.pi * 2 * ff * t)
            w += 0.03 * np.sin(2 * np.pi * 3 * ff * t)
    w *= env_pad(seg, 0.55, 1.2) / len(CHORDS[ci % 4])
    mix[n0:n1] += w * 0.55
    pos += bar
    ci += 1

# --- plucked arpeggio: eighth notes, exponential decay ---
eighth = beat / 2
pos = 0.0
k = 0
while pos < DUR:
    ci2 = int(pos // bar) % 4
    f = ARPS[ci2][k % 4]
    n0 = int(pos * SR)
    seg = min(int(eighth * SR * 2.2), N - n0)
    if seg <= 0: break
    t = np.arange(seg) / SR
    d = np.exp(-t * 6.5)
    tone = (np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * 2 * f * t)) * d
    # skip some hits for musical breathing (pattern of rests)
    if k % 8 not in (6,):
        mix[n0:n0 + seg] += tone * 0.20
    pos += eighth
    k += 1

# --- soft hat: filtered noise ticks on offbeats ---
rng = np.random.default_rng(7)
pos = beat / 2
while pos < DUR:
    n0 = int(pos * SR)
    seg = min(int(0.05 * SR), N - n0)
    if seg <= 0: break
    t = np.arange(seg) / SR
    nz = rng.standard_normal(seg) * np.exp(-t * 80)
    mix[n0:n0 + seg] += nz * 0.055
    pos += beat

# --- bass pulse on the beat: gives it drive ---
ROOTS = [73.42, 55.00, 61.74, 49.00]   # D2 A1 B1 G1
pos = 0.0
while pos < DUR:
    ci3 = int(pos // bar) % 4
    n0 = int(pos * SR)
    seg = min(int(beat * SR * 0.9), N - n0)
    if seg <= 0: break
    t = np.arange(seg) / SR
    e = np.exp(-t * 7.0)
    f = ROOTS[ci3]
    mix[n0:n0 + seg] += (np.sin(2 * np.pi * f * t) + 0.3 * np.sin(2 * np.pi * 2 * f * t)) * e * 0.30
    pos += beat

# gentle master: lowpass the pads' harshness, normalise, fade edges
mix = onepole_lp(mix, 3400)
mix /= max(1e-9, np.max(np.abs(mix))) / 0.85
fi, fo = int(2.0 * SR), int(4.0 * SR)
mix[:fi] *= np.linspace(0, 1, fi)
mix[-fo:] *= np.linspace(1, 0, fo) ** 1.4

stereo = np.stack([mix, np.roll(mix, int(0.011 * SR))], axis=1)  # tiny haas width
pcm = (np.clip(stereo, -1, 1) * 32767).astype(np.int16)
with wave.open(sys.argv[2] if len(sys.argv) > 2 else 'vid/music.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print('music rendered:', DUR, 's')
