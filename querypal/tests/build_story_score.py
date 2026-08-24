#!/usr/bin/env python3
"""Soundtrack for the Query Pal story film — the brand piece, not the demo.

A warm male narration over a soft felt-piano score: 68 BPM, F major, no drums
until a single gentle swell at the turn. Everything is synthesized here, so
there is no licence to clear on a video that will sit on a public website.

Microsoft's 'Andrew' voice is not reachable from this environment (the network
proxy intercepts TLS and edge-tts pins its own chain), so narration uses the
warmest male voice Kokoro ships offline.

Reads demo/story-timeline-video.json (true on-screen times, see sync_timeline.py)
and writes demo/story-soundtrack.wav.
"""
import json, pathlib, wave
import numpy as np
from kokoro import KPipeline

HERE = pathlib.Path(__file__).parent
DEMO = HERE / 'demo'
VOICE = 'am_michael'          # warm American male; 'am_puck' is the brighter alternative
SR = 44100
PIPE = KPipeline(lang_code='a', repo_id='hexgrad/Kokoro-82M')

marks = json.load(open(DEMO / 'story-timeline.json'))
vt = json.load(open(DEMO / 'story-timeline-video.json'))
if len(vt['marks']) != len(marks) - 1:
    raise SystemExit('mark count mismatch — rerun: python3 sync_timeline.py story')
T = {i: t for i, t in enumerate(vt['marks'])}
END = T[len(marks) - 1] = vt['duration']

# ---------------- narration ----------------
# Written to be heard, not read: short clauses, one idea per breath.
LINES = {
  0:  "Every day, someone asks us for something.",
  1:  "A statement. A claim. A change of address.",
  2:  "Small things. But never small to the person asking.",
  3:  "For years, those requests lived in email.",
  4:  "And email forgets.",
  5:  "Any update? The honest answer, too often, was: let me check.",
  6:  "We got tired of saying, let me check.",
  7:  "So the branch built Query Pal. One place where a request cannot be forgotten.",
  8:  "One link. Every request logged the moment it is made.",
  9:  "It already knows the right department, and the day the answer is due.",
  10: "From that moment, it is a promise, with a date on it.",
  11: "And if the department goes quiet, we don't.",
  12: "A reminder goes out. Then a firmer one, on the same email thread.",
  13: "And then the branch manager, personally.",
  14: "All the while, the client is told exactly where things stand.",
  15: "And if a case has to pause, we say so. Nobody is left guessing.",
  16: "When it's done, we ask the client how we did.",
  17: "Every rating, in their own words.",
  18: "And we put the score on the wall, where anyone can see it.",
  19: "Nothing hidden. Nothing quietly missed.",
  20: "This is how we work.",
  21: "Not because a system is impressive,",
  22: "but because a promise should be kept.",
  23: "Query Pal. From the Rampersad Branch.",
}

def tts(text):
    x = np.concatenate([a.numpy() for _, _, a in PIPE(text, voice=VOICE, speed=0.90)]).astype(np.float64)
    n = int(len(x) * SR / 24000)
    return np.interp(np.linspace(0, len(x) - 1, n), np.arange(len(x)), x)

total = int(END * SR)
voice = np.zeros(total)
segments = []
cursor = 0.0
for i in range(len(marks)):
    if i not in LINES: continue
    clip = tts(LINES[i])
    clip = clip / (np.abs(clip).max() or 1) * 0.95
    start = max(T[i] + 0.35, cursor + 0.55)       # a story breathes: wider gaps than the demo
    s0 = int(start * SR); s1 = min(s0 + len(clip), total)
    if s0 >= total: break
    voice[s0:s1] += clip[:s1 - s0]
    segments.append((start, start + len(clip) / SR))
    cursor = start + len(clip) / SR
    print(f'  vo {i:2}  {start:6.1f}s  {len(clip)/SR:4.1f}s  {LINES[i][:52]}')

# ---------------- the score ----------------
# F major, 68 BPM, I–vi–IV–V. Warm and unhurried; it should never compete.
BPM = 68; BEAT = 60 / BPM; BAR = 4 * BEAT
NOTE = lambda n: 440.0 * 2 ** ((n - 69) / 12)
CHORDS = [
    (41, [53, 57, 60, 65]),        # F
    (38, [53, 57, 62, 65]),        # Dm
    (46, [53, 58, 62, 65]),        # Bb
    (48, [52, 55, 60, 64]),        # C
]

TURN  = T[6]                        # "we got tired of saying let me check"
BUILD = T[8]                        # the app appears
OPEN  = T[18]                       # the wall, measured in the open
CLOSE = T[20]                       # the closing cards

def energy(ts):                     # 0 sparse · 1 settled · 2 full · 3 resolve
    if ts < T[0] - 1.5: return -1
    if ts < TURN:  return 0
    if ts < BUILD: return 1
    if ts < OPEN:  return 1
    if ts < CLOSE: return 2
    return 3

music = np.zeros(total)
start_s = max(0.0, T[0] - 1.5)

def felt_piano(f, n, gain):
    """A struck note with a soft hammer and a long, warm decay."""
    tt = np.arange(n) / SR
    body = (np.sin(2 * np.pi * f * tt) * np.exp(-tt * 1.15)
            + 0.42 * np.sin(2 * np.pi * 2 * f * tt) * np.exp(-tt * 2.1)
            + 0.16 * np.sin(2 * np.pi * 3 * f * tt) * np.exp(-tt * 3.4)
            + 0.07 * np.sin(2 * np.pi * 4.02 * f * tt) * np.exp(-tt * 4.8))
    hammer = np.exp(-tt * 130) * np.sin(2 * np.pi * f * 5.1 * tt) * 0.05
    attack = np.minimum(1, np.arange(n) / (SR * 0.008))     # felt: no hard edge
    return gain * (body + hammer) * attack

def pad(f, n, gain):
    tt = np.arange(n) / SR
    out = np.zeros(n)
    for d in (0.9988, 1.0012):
        out += (np.sin(2 * np.pi * f * d * tt)
                + 0.30 * np.sin(2 * np.pi * f * d * 2 * tt)
                + 0.10 * np.sin(2 * np.pi * f * d * 3 * tt))
    env = np.minimum(1, np.arange(n) / (SR * 1.8)) * np.minimum(1, (n - np.arange(n)) / (SR * 1.2))
    return gain * out * env

# strings/pad bed, two bars per chord
pos, ci = start_s, 0
while pos < END:
    n = int(min(BAR * 2, END - pos) * SR)
    if n <= 0: break
    e = energy(pos)
    if e >= 0:
        bass_m, tones = CHORDS[ci % 4]
        i0 = int(pos * SR)
        g = [0.055, 0.075, 0.095, 0.085][min(e, 3)]
        seg = np.zeros(n)
        for m in tones: seg += pad(NOTE(m), n, g)
        if e >= 1: seg += pad(NOTE(bass_m), n, g * 0.55)     # low warmth once settled
        music[i0:i0 + n] += seg / 4.0
    pos += n / SR; ci += 1

# piano: a simple rising figure, one note every half-beat, sparse at the open
step = BEAT
k, ts = 0, start_s
while ts < END - 0.5:
    e = energy(ts)
    if e >= 0:
        _, tones = CHORDS[int((ts - start_s) // (BAR * 2)) % 4]
        pattern = [0, 2, 1, 3] if e >= 1 else [0, 2]
        idx = pattern[k % len(pattern)]
        oct_up = 12 if (e >= 2 and k % 8 >= 4) else 0
        f = NOTE(tones[idx % len(tones)] + oct_up)
        dur = 2.2; n = int(dur * SR); i0 = int(ts * SR)
        n = min(n, total - i0)
        if n > 0:
            g = [0.17, 0.20, 0.23, 0.22][min(e, 3)]
            music[i0:i0 + n] += felt_piano(f, n, g)
    k += 1
    ts += step * (2 if energy(ts) <= 0 else 1)               # sparser before the turn

# a single warm swell at the turn — the only "moment" in the whole score
sw0 = int(max(0, TURN - 2.6) * SR); sw1 = int(min(END, TURN + 0.4) * SR)
if sw1 > sw0:
    n = sw1 - sw0; tt = np.arange(n) / n
    rng = np.random.default_rng(11)
    swell = rng.standard_normal(n) * (tt ** 3) * 0.05
    swell += 0.05 * np.sin(2 * np.pi * NOTE(41) * np.arange(n) / SR) * (tt ** 2)
    music[sw0:sw1] += swell

# the last chord, left to ring
f0 = int(min(END - 0.1, T[23]) * SR)
n = total - f0
if n > 0:
    tt = np.arange(n) / SR
    final = np.zeros(n)
    for m in [53, 57, 60, 65, 72]:                            # F major add9, open voicing
        final += felt_piano(NOTE(m), n, 0.16)
    for m in [41, 53, 57, 60]:
        final += pad(NOTE(m), n, 0.05) / 4
    music[f0:] += final * np.exp(-tt / 6.0)
music[-int(3.0 * SR):] *= np.linspace(1, 0, int(3.0 * SR))
fade_in = int(2.2 * SR); n0 = int(start_s * SR)
music[n0:n0 + fade_in] *= np.linspace(0, 1, fade_in)

# ---------------- mix ----------------
# The score sits well under the voice — this film is carried by what is said.
duck = np.ones(total)
for a, b in segments:
    i0, i1 = max(0, int((a - 0.25) * SR)), min(total, int((b + 0.30) * SR))
    r = int(0.25 * SR)
    duck[i0:i1] = 0.42
    if i0 > 0: duck[max(0, i0 - r):i0] = np.linspace(1, 0.42, min(r, i0))
    if i1 < total: duck[i1:min(total, i1 + r)] = np.linspace(0.42, 1, min(r, total - i1))

music = np.tanh(music * 1.1) * duck
mix = music * 0.88 + voice * 1.0
mix = np.tanh(mix * 1.18)
mix = mix / (np.abs(mix).max() or 1) * 0.95

stereo = np.zeros((total, 2))
stereo[:, 0] = mix; stereo[:, 1] = mix
w = int(0.014 * SR)                                          # a little air on the bed only
stereo[w:, 0] += 0.07 * music[:-w]; stereo[:-w, 1] += 0.07 * music[w:]
stereo = np.clip(stereo, -1, 1)

out = DEMO / 'story-soundtrack.wav'
with wave.open(str(out), 'wb') as f:
    f.setnchannels(2); f.setsampwidth(2); f.setframerate(SR)
    f.writeframes((stereo * 32767).astype(np.int16).tobytes())
print(f'\nwrote {out}  {END:.1f}s  ({len(segments)} narration lines, voice {VOICE})')
