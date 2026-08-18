#!/usr/bin/env python3
"""Soundtrack for the Query Pal demo: Kokoro narration on the caption timeline,
under an original motivational score synthesized here (no licensing to clear).
Reads demo/timeline.json, writes demo/soundtrack.wav aligned to the raw video.
Needs: pip install kokoro torch(cpu) soundfile ; apt install espeak-ng"""
import json, math, pathlib, wave
import numpy as np
from kokoro import KPipeline

HERE = pathlib.Path(__file__).parent
DEMO = HERE / 'demo'
VOICE = 'af_heart'                                # Kokoro's best-graded narrator
SR = 44100
PIPE = KPipeline(lang_code='a', repo_id='hexgrad/Kokoro-82M')

marks = json.load(open(DEMO / 'timeline.json'))
T = {i: m['t'] / 1000.0 for i, m in enumerate(marks)}
END = T[len(marks) - 1] + 4.0                     # outro hold + context close

# ---------------- narration ----------------
LINES = {
  0:  "This is Query Pal — how the Rampersad Branch turns every request into a promise, kept.",
  1:  "One link, for everyone. Clients. Agents. Companies.",
  2:  "Clients choose what they need in plain language — no email addresses to know.",
  3:  "Every request already knows its department, and its deadline.",
  4:  "Guided forms gather the details, and a checklist shows exactly what to prepare.",
  5:  "Documents attach right on the form.",
  6:  "One tap — and it's routed. The department gets the email. Agent, manager and branch, all copied.",
  7:  "A reference. A deadline. A promise.",
  8:  "Anyone can track a request by its reference.",
  9:  "And when a department goes quiet, the autopilot doesn't. Follow-ups. Escalation. Until it's answered.",
  10: "Agents see their book. Managers see their whole team.",
  12: "Clients get their own portal — and the access code arrives by email, automatically.",
  13: "Companies see every employee case, with live service stats.",
  15: "Every case tells its story — and internal notes stay internal.",
  16: "Enrolling a new member? Right from the portal, documents and all.",
  17: "Logged. Assigned. Chased to completion.",
  18: "And the whole branch — on one wall.",
  19: "Signed in once, it runs on its own — refreshing every minute.",
  20: "Departments ranked. Agents celebrated.",
  21: "And clients — heard, in their own words.",
  22: "Logged. Routed. Chased. Resolved. Query Pal — service, delivered on time.",
}

def tts(text, out=None):
    x = np.concatenate([a.numpy() for _, _, a in PIPE(text, voice=VOICE)]).astype(np.float64)
    n = int(len(x) * SR / 24000)                  # 24000 -> 44100
    return np.interp(np.linspace(0, len(x) - 1, n), np.arange(len(x)), x)

total = int(END * SR)
voice = np.zeros(total)
segments = []                                     # (start_s, end_s) for ducking
cursor = 0.0
for i, m in enumerate(marks):
    if i not in LINES: continue
    clip = tts(LINES[i], DEMO / f'vo{i}.wav')
    peak = np.abs(clip).max() or 1.0
    clip = clip / peak * 0.85
    start = max(T[i] + 0.05, cursor + 0.30)       # never talk over yourself
    s0 = int(start * SR); s1 = min(s0 + len(clip), total)
    voice[s0:s1] += clip[:s1 - s0]
    segments.append((start, start + len(clip) / SR))
    cursor = start + len(clip) / SR
    print(f'  vo {i:2}  {start:6.1f}s  {len(clip)/SR:4.1f}s  {LINES[i][:52]}')

# ---------------- the score ----------------
# D major, I–V–vi–IV. Sections keyed to what is on screen.
BPM = 112; BEAT = 60 / BPM; BAR = 4 * BEAT
NOTE = lambda n: 440.0 * 2 ** ((n - 69) / 12)     # midi -> Hz
CHORDS = [                                        # (bass midi, chord midis)
    (38, [50, 54, 57, 62]),                       # D
    (45, [49, 52, 57, 61]),                       # A
    (47, [50, 54, 59, 62]),                       # Bm
    (43, [50, 55, 59, 62]),                       # G
]
t_all = np.arange(total) / SR

CARD, WIN, PORTAL, WALLSEEN, BOARDS, OUTRO = T[0], T[6], T[12], T[18], T[19], T[22]
def energy(ts):                                   # 0 pads · 1 groove · 2 drive · 3 finale
    if ts < CARD - 1.2:  return -1                # page still loading: silence
    if ts < T[1]:        return 0
    if ts < WIN:         return 1
    if ts < PORTAL:      return 2
    if ts < WALLSEEN:    return 1
    if ts < BOARDS:      return 2
    if ts < OUTRO:       return 3
    return 0

music = np.zeros(total)
start_s = max(0.0, CARD - 1.2)
n0 = int(start_s * SR)

# pads: two detuned saw-ish partial stacks per chord tone, slow attack
def pad_block(f, n):
    tt = np.arange(n) / SR
    out = np.zeros(n)
    for d in (0.9985, 1.0015):
        for h, g in ((1, 1.0), (2, 0.38), (3, 0.16), (4, 0.07)):
            out += g * np.sin(2 * np.pi * f * d * h * tt + (h * 1.3))
    return out / 3.2

pos = start_s
ci = 0
while pos < END:
    n = int(min(BAR * 2, END - pos) * SR)         # two bars per chord
    if n <= 0: break
    bass_m, tones = CHORDS[ci % 4]
    i0 = int(pos * SR)
    seg = np.zeros(n)
    for m in tones:
        seg += pad_block(NOTE(m), n)
    env = np.minimum(1, np.arange(n) / (SR * 1.2)) * np.minimum(1, (n - np.arange(n)) / (SR * 0.35))
    music[i0:i0 + n] += 0.16 * seg * env
    # bass: root, gentle pulse on beats 1 and 3
    tt = np.arange(n) / SR
    bass = np.sin(2 * np.pi * NOTE(bass_m) * tt) + 0.35 * np.sin(2 * np.pi * NOTE(bass_m) * 2 * tt)
    pulse = 0.55 + 0.45 * np.cos(2 * np.pi * (tt % (2 * BEAT)) / (2 * BEAT) * np.pi / 2)
    e_here = energy(pos)
    if e_here >= 1:
        music[i0:i0 + n] += 0.20 * bass * pulse * env
    pos += n / SR; ci += 1

# plucked arpeggio: decaying tones on eighth notes, chord tones climbing
step = BEAT / 2
k = 0
ts = start_s
while ts < END - 0.2:
    e = energy(ts)
    if e >= 1:
        _, tones = CHORDS[int((ts - start_s) // (BAR * 2)) % 4]
        f = NOTE(tones[k % len(tones)] + (12 if (e >= 2 and k % 8 >= 4) else 0))
        dur = 0.42; n = int(dur * SR); i0 = int(ts * SR)
        tt = np.arange(n) / SR
        tone = (np.sin(2 * np.pi * f * tt) + 0.4 * np.sin(2 * np.pi * 2 * f * tt)
                + 0.15 * np.sin(2 * np.pi * 3 * f * tt)) * np.exp(-tt * 7.5)
        g = 0.11 if e == 1 else (0.15 if e == 2 else 0.18)
        music[i0:i0 + n] += g * tone[:min(n, total - i0)]
    k += 1; ts += step

# kick + hats + sidechain pump in the driving sections
duck_kick = np.ones(total)
ts = start_s
while ts < END - 0.2:
    e = energy(ts)
    beat_pos = ((ts - start_s) % BEAT)
    if e >= 2 and beat_pos < step / 2:             # four on the floor
        n = int(0.11 * SR); i0 = int(ts * SR)
        tt = np.arange(n) / SR
        f = 110 * np.exp(-tt * 26) + 44
        music[i0:i0 + n] += 0.52 * np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 22)
        d = int(0.30 * SR)
        duck_kick[i0:i0 + d] *= np.minimum(1, 0.55 + 0.45 * np.arange(d) / d)
    if e >= 2 and abs(beat_pos - BEAT / 2) < step / 4:   # offbeat hat
        n = int(0.030 * SR); i0 = int(ts * SR)
        music[i0:i0 + n] += 0.05 * np.random.default_rng(int(ts * 1000)).standard_normal(n) * np.exp(-np.arange(n) / SR * 160)
    ts += step / 2
music *= duck_kick

# riser into the finale, and the closing chord
r0, r1 = int((BOARDS - 3.5) * SR), int(BOARDS * SR)
if r1 > r0:
    n = r1 - r0; tt = np.arange(n) / n
    music[r0:r1] += 0.10 * np.random.default_rng(7).standard_normal(n) * tt ** 2
    music[r0:r1] += 0.06 * np.sin(2 * np.pi * (200 + 500 * tt ** 2) * np.arange(n) / SR)
f0 = int(OUTRO * SR)
n = total - f0
tt = np.arange(n) / SR
final = np.zeros(n)
for m in [50, 54, 57, 62, 64, 74]:                # D add9, high sparkle
    final += pad_block(NOTE(m), n)[:n]
music[f0:] += 0.20 * final * np.exp(-tt / 3.2)
music[-int(2.5 * SR):] *= np.linspace(1, 0, int(2.5 * SR))   # tail fade
music[n0:n0 + int(1.5 * SR)] *= np.linspace(0, 1, int(1.5 * SR))  # fade in

# ---------------- mix ----------------
duck = np.ones(total)
for a, b in segments:                             # music steps back when the voice speaks
    i0, i1 = int((a - 0.12) * SR), int((b + 0.15) * SR)
    r = int(0.12 * SR)
    i0 = max(0, i0); i1 = min(total, i1)
    duck[i0:i1] = 0.33
    duck[max(0, i0 - r):i0] = np.linspace(1, 0.33, min(r, i0))
    duck[i1:min(total, i1 + r)] = np.linspace(0.33, 1, min(r, total - i1))

music = np.tanh(music * 1.15) * duck
mix = music * 0.9 + voice
mix = np.tanh(mix * 1.05)
mix = mix / (np.abs(mix).max() or 1) * 0.89

stereo = np.zeros((total, 2))
stereo[:, 0] = mix; stereo[:, 1] = mix
# a whisper of width on the music bed only
w = int(0.011 * SR)
stereo[w:, 0] += 0.06 * music[:-w]; stereo[:-w, 1] += 0.06 * music[w:]
stereo = np.clip(stereo, -1, 1)

out = DEMO / 'soundtrack.wav'
with wave.open(str(out), 'wb') as f:
    f.setnchannels(2); f.setsampwidth(2); f.setframerate(SR)
    f.writeframes((stereo * 32767).astype(np.int16).tobytes())
print(f'\nwrote {out}  {END:.1f}s  ({len(segments)} narration lines)')
