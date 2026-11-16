#!/usr/bin/env python3
"""A Christmas music bed for the branch films, synthesised here: Jingle Bells (J. Pierpont, 1857, public domain),
arranged for celesta, soft pad, pizzicato bass and sleigh bells. No recording, so nothing to licence.
  python3 xmas-bed.py <out.wav> [seconds]"""
import sys, numpy as np, wave
SR = 44100; BPM = 108; B = 60 / BPM
out = sys.argv[1]; SECS = float(sys.argv[2]) if len(sys.argv) > 2 else 130
N = {'D4':62,'E4':64,'F#4':66,'G4':67,'A4':69,'B4':71,'C5':72,'D5':74,'E5':76,'G5':79}
hz = lambda m: 440 * 2 ** ((m - 69) / 12)
CH = {'G':[55,59,62,67],'C':[48,55,60,64],'D':[50,57,62,66],'A':[45,57,61,64],'Em':[52,55,59,64]}
CHORUS = [('B4',1),('B4',1),('B4',2),('B4',1),('B4',1),('B4',2),('B4',1),('D5',1),('G4',1.5),('A4',.5),('B4',4),
          ('C5',1),('C5',1),('C5',1.5),('C5',.5),('C5',1),('B4',1),('B4',1),('B4',.5),('B4',.5),('B4',1),('A4',1),('A4',1),('B4',1),('A4',2),('D5',2),
          ('B4',1),('B4',1),('B4',2),('B4',1),('B4',1),('B4',2),('B4',1),('D5',1),('G4',1.5),('A4',.5),('B4',4),
          ('C5',1),('C5',1),('C5',1.5),('C5',.5),('C5',1),('B4',1),('B4',1),('B4',.5),('B4',.5),('D5',1),('D5',1),('C5',1),('A4',1),('G4',4)]
VERSE = [('D4',1),('B4',1),('A4',1),('G4',1),('D4',3),('D4',.5),('D4',.5),('D4',1),('B4',1),('A4',1),('G4',1),('E4',4),
         ('E4',1),('C5',1),('B4',1),('A4',1),('F#4',4),('D5',1),('D5',1),('C5',1),('A4',1),('B4',4),
         ('D4',1),('B4',1),('A4',1),('G4',1),('D4',4),('D4',1),('B4',1),('A4',1),('G4',1),('E4',3),('E4',1),
         ('E4',1),('C5',1),('B4',1),('A4',1),('D5',1),('D5',1),('D5',1),('D5',1),('E5',1),('D5',1),('C5',1),('A4',1),('G4',2),('D5',2)]
CHC = list('GGGG') + ['C','G','A','D'] + list('GGGG') + ['C','G','D','G']
VEC = ['G','G','G','C','C','D','D','G','G','G','G','C','C','D','D','D']
song = [('intro', None, ['G','C','D','G'])] + [('v', VERSE, VEC), ('c', CHORUS, CHC)] * 3
L = int(SECS * SR) + SR * 4; mel = np.zeros(L); pad = np.zeros(L); bass = np.zeros(L); bell = np.zeros(L)
rng = np.random.default_rng(7)
def tone(f, d, partials, dec):
    t = np.arange(int(d * SR)) / SR
    return sum(a * np.sin(2 * np.pi * f * k * t) * np.exp(-t * dec * (1 + k * .6)) for k, a in partials)
def add(buf, at, x):
    i = int(at * SR)
    if i >= L: return
    j = min(L, i + len(x)); buf[i:j] += x[:j - i]
cel = [(1, 1), (2, .35), (3, .12), (4.2, .06)]
noise = rng.standard_normal(int(.25 * SR))
from numpy.fft import rfft, irfft
spec = rfft(noise); fr = np.fft.rfftfreq(len(noise), 1 / SR); spec[(fr < 6000) | (fr > 13000)] = 0
jingle = irfft(spec, len(noise)); jingle /= np.abs(jingle).max()
t0 = 0
for kind, line, chords in song:
    for bi, c in enumerate(chords):
        at = t0 + bi * 4 * B
        for m in CH[c]:
            t = np.arange(int(4 * B * SR)) / SR; env = np.minimum(1, t / .6) * np.minimum(1, (4 * B - t) / .5)
            f = hz(m); add(pad, at, env * (np.sin(2*np.pi*f*t) + .3*np.sin(2*np.pi*f*2.003*t) + .15*np.sin(2*np.pi*f*3*t)) * .25)
        for k, off in enumerate([0, 2]):
            root = CH[c][0] - (12 if CH[c][0] > 52 else 0)
            add(bass, at + off * B, tone(hz(root if k == 0 else root + 7), 1.6 * B, [(1, 1), (2, .25)], 3))
        for e in range(8):
            g = .9 if e % 2 == 0 else .5
            add(bell, at + e * B / 2, jingle * np.exp(-np.arange(len(jingle)) / SR * 22) * g)
    if line:
        at = t0
        for n, d in line:
            f = hz(N[n]); add(mel, at, tone(f, max(d * B, .9) + .6, cel, 2.2)); add(mel, at, .18 * tone(f * 2, .7, cel, 5)); at += d * B
    t0 += len(chords) * 4 * B
mix = mel * .55 + pad * .18 + bass * .32 + bell * .07
mix = mix[:int(SECS * SR)]
# soft room: two short echoes
for dl, g in ((.083, .22), (.157, .14)):
    d = int(dl * SR); mix[d:] += g * mix[:-d]
mix /= np.abs(mix).max() / .8
fade = int(2.5 * SR); mix[-fade:] *= np.linspace(1, 0, fade); mix[:int(.4*SR)] *= np.linspace(0, 1, int(.4*SR))
pcm = (np.stack([mix, np.roll(mix, 220)], 1) * 32767).astype('<i2')
w = wave.open(out, 'wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes()); w.close()
print('wrote', out, round(len(mix) / SR, 1), 's')
