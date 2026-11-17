#!/usr/bin/env python3
"""A parang bed for the branch's Christmas films, synthesised here, so nothing to licence.

  python3 parang-bed.py <out.wav> [seconds]

An original tune in D, in the parang lilt (6/8, dotted crotchet = 104): cuatro strumming, mandolin melody with
tremolo on the long notes, a box-bass thump, chac-chac (maracas) on every quaver and a toc on the beat. The strings
are Karplus-Strong plucks, worked at four times the sample rate so they stay in tune, then brought down.
"""
import sys, numpy as np, wave
from scipy.signal import lfilter, resample_poly, fftconvolve

SR = 44100; OS = 4; out = sys.argv[1]; SECS = float(sys.argv[2]) if len(sys.argv) > 2 else 120
Q = 60 / (104 * 3)            # one quaver
BAR = 6 * Q
rng = np.random.default_rng(3)
L = int((SECS + 4) * SR)
cuatro, mando, bass, perc, guit = (np.zeros(L) for _ in range(5))
hz = lambda m: 440 * 2 ** ((m - 69) / 12)

def pluck(f, dur, bright=.6, decay=.996):
    """One Karplus-Strong string: a burst of filtered noise in a tuned, damped delay line."""
    sr = SR * OS; N = int(round(sr / f)); n = int(dur * sr)
    x = np.zeros(n); burst = rng.uniform(-1, 1, N)
    burst = lfilter([bright], [1, -(1 - bright)], burst)     # softer pick = darker burst
    x[:N] = burst
    a = np.zeros(N + 2); a[0] = 1; a[N] = a[N + 1] = -decay / 2
    y = lfilter([1], a, x)
    y = resample_poly(y, 1, OS)
    env = np.ones(len(y)); r = min(len(y), int(.03 * SR)); env[-r:] = np.linspace(1, 0, r)
    return y * env

def add(buf, t, x, g=1.0):
    i = int(t * SR)
    if i >= L: return
    j = min(L, i + len(x)); buf[i:j] += g * x[:j - i]

# cuatro voicings (re-entrant a-d-f#-b register), and chord roots for the bass
VO = {'D': [57, 62, 66, 69], 'G': [59, 62, 67, 71], 'A': [57, 61, 64, 69], 'A7': [57, 61, 64, 67],
      'Bm': [59, 62, 66, 71], 'Em': [59, 64, 67, 71], 'E7': [56, 62, 64, 68]}
ROOT = {'D': 38, 'G': 43, 'A': 45, 'A7': 45, 'Bm': 47, 'Em': 40, 'E7': 40}

def strum(t, ch, down=True, g=1.0):
    notes = VO[ch] if down else VO[ch][::-1]
    for k, m in enumerate(notes):
        add(cuatro, t + k * .011, pluck(hz(m), .9, .55 if down else .4, .993), g * (1 if down else .6))

def chac(t, g):
    n = int(.09 * SR); s = rng.standard_normal(n)
    s = lfilter([1, -1], [1, -.2], s)                         # thin it out: a seed rattle, not a hiss
    env = np.exp(-np.arange(n) / SR * 48) * np.minimum(1, np.arange(n) / (.006 * SR))
    add(perc, t, s * env, g)

def toc(t, g=1.0):
    n = int(.12 * SR); tt = np.arange(n) / SR
    add(perc, t, np.sin(2 * np.pi * 1850 * tt) * np.exp(-tt * 70) * 2.2 * g)

def box(t, m, g=1.0):
    n = int(.5 * SR); tt = np.arange(n) / SR
    f = hz(m) * (1 + .12 * np.exp(-tt * 40))
    add(bass, t, np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 7) * g)

# the tune: (midi, quavers). Original, in the parang manner: a call that rises, an answer that falls home.
A_ = [(74,2),(73,1),(71,2),(69,1), (71,3),(69,3), (66,2),(67,1),(69,2),(71,1), (69,6),
      (67,2),(69,1),(71,2),(73,1), (74,3),(73,3), (71,2),(69,1),(67,2),(64,1), (66,6)]
B_ = [(71,2),(71,1),(74,2),(71,1), (69,3),(67,3), (66,2),(67,1),(69,2),(66,1), (64,6),
      (67,2),(69,1),(71,2),(69,1), (67,2),(66,1),(64,2),(66,1), (64,3),(61,3), (62,6)]
CA = ['D', 'A', 'D', 'A', 'G', 'D', 'A7', 'D']
CB = ['G', 'D', 'A', 'A7', 'G', 'Em', 'A7', 'D']
form = [('intro', None, ['D', 'A7', 'D', 'A7'])]
while sum(len(c) for _, _, c in form) * BAR < SECS + 2:
    form += [('A', A_, CA), ('B', B_, CB)]

def mandolin(t0, tune, octave=0, g=1.0, harm=False):
    t = t0
    for m, q in tune:
        m += octave; d = q * Q
        if q >= 3:                                            # long note: tremolo, as a mandolin player would
            k = 0
            while k * Q / 2 < d - .02:
                add(mando, t + k * Q / 2, pluck(hz(m), .35, .7, .992), g * (.75 if k else 1)); k += 1
        else:
            add(mando, t, pluck(hz(m), d + .4, .75, .994), g)
            add(mando, t + .004, pluck(hz(m) * 1.002, d + .4, .75, .994), g * .5)   # the doubled course
        if harm:
            add(mando, t, pluck(hz(m - 4 if m % 12 in (2, 7, 9) else m - 3), d + .3, .6, .993), g * .45)
        t += d

t0 = 0; rep = 0
for name, tune, chords in form:
    for b, ch in enumerate(chords):
        t = t0 + b * BAR
        # cuatro: the parang strum, down . down-up . up-down-up across the bar
        for q, dn, g in [(0, 1, 1), (1, 0, .5), (2, 1, .8), (3, 1, .95), (4, 0, .55), (5, 1, .7)]:
            strum(t + q * Q, ch, bool(dn), g)
        box(t, ROOT[ch], 1.0); box(t + 3 * Q, ROOT[ch] + 7, .8)
        for q in range(6):
            chac(t + q * Q + (0 if q % 2 == 0 else .018), (1.0 if q in (0, 3) else .55))
        toc(t, .9); toc(t + 3 * Q, .6)
        for k, m in enumerate([ROOT[ch] + 12, ROOT[ch] + 19, ROOT[ch] + 24]):
            add(guit, t + k * .015, pluck(hz(m), 1.4, .35, .997), .5)
    if tune:
        mandolin(t0, tune, 12 if rep >= 2 else 0, 1.0, harm=rep % 2 == 1)
        rep += 1
    t0 += len(chords) * BAR

def norm(x): return x / (np.abs(x).max() + 1e-9)
mix = .62 * norm(cuatro) + .78 * norm(mando) + .55 * norm(bass) + .30 * norm(perc) + .22 * norm(guit)
mix = mix[:int(SECS * SR)]
ir_n = int(.9 * SR); ir = rng.standard_normal(ir_n) * np.exp(-np.arange(ir_n) / SR * 6.5); ir[0] = 0
wet = fftconvolve(mix, ir)[:len(mix)]; wet /= np.abs(wet).max() + 1e-9
mix = mix / np.abs(mix).max() + .12 * wet
mix = np.tanh(mix * 1.1)                                      # a gentle ceiling, never a hard clip
mix /= np.abs(mix).max() / .85
fi, fo = int(.3 * SR), int(3 * SR); mix[:fi] *= np.linspace(0, 1, fi); mix[-fo:] *= np.linspace(1, 0, fo)
left = mix + .08 * np.roll(norm(cuatro)[:len(mix)], 300) - .05 * norm(mando)[:len(mix)]
right = mix - .08 * np.roll(norm(cuatro)[:len(mix)], 300) + .05 * norm(mando)[:len(mix)]
st = np.stack([left, right], 1); st /= np.abs(st).max() / .85
w = wave.open(out, 'wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
w.writeframes((st * 32767).astype('<i2').tobytes()); w.close()
print('wrote', out, round(len(mix) / SR, 1), 's')
