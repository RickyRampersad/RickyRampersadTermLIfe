#!/usr/bin/env python3
"""Build the audio track for the MP4 cut of the story film.

The film plays its score live in Web Audio, and a screen recorder captures no
audio at all — so for a downloadable MP4 the same music is synthesised here in
numpy, to the same house theme (D major, 108 BPM, D–A–Bm–G), and Andrew's
narration is laid on the times decoded from the film's own sync patch.

  node record-mp4.mjs        # writes mp4/story-video.webm with the sync patch
  python3 build-mp4-audio.py # writes mp4/story-audio.wav
"""
import pathlib, subprocess, wave
import numpy as np

HERE = pathlib.Path(__file__).parent
MP4 = HERE / 'mp4'
VOICE = HERE / 'voice'
SRC = MP4 / 'story-video.webm'
SR = 44100
BPM = 108
BEAT = 60 / BPM
CHORD_LEN = BEAT * 8                      # two bars, as the film uses

# ── when does each line start? read the sync patch back out of the video ──
FPS = 20
dur = float(subprocess.run(['/usr/bin/ffprobe', '-v', 'error', '-show_entries',
                            'format=duration', '-of', 'csv=p=0', str(SRC)],
                           capture_output=True, text=True).stdout.strip())
raw = subprocess.run(['/usr/bin/ffmpeg', '-i', str(SRC), '-vf',
                      f'crop=14:14:0:0,fps={FPS}', '-f', 'rawvideo',
                      '-pix_fmt', 'rgb24', '-'], capture_output=True).stdout
frames = np.frombuffer(raw, dtype=np.uint8).reshape(-1, 14, 14, 3).astype(float)
mean = frames[:, 3:11, 3:11, :].mean(axis=(1, 2))

def cls(px):
    r, g, b = px
    if r > 150 and g < 110 and b < 110: return 0
    if g > 150 and r < 110 and b < 110: return 1
    if b > 150 and r < 110 and g < 110: return 2
    return -1

marks, last = [], -1
for i, m in enumerate(mean):
    k = cls(m)
    if k >= 0 and k != last:
        marks.append(i / FPS)
        last = k

mp3s = sorted(VOICE.glob('line*.mp3'))
print(f'{len(marks)} marks decoded, {len(mp3s)} narration files, video {dur:.1f}s')
if len(marks) < len(mp3s):
    print(f'  (only {len(marks)} marks — the tail will be spaced evenly)')

total = int((dur + 1.0) * SR)
voice = np.zeros(total)
segs = []
for i, f in enumerate(mp3s):
    wav = MP4 / (f.stem + '.wav')
    subprocess.run(['/usr/bin/ffmpeg', '-y', '-i', str(f), '-ar', str(SR), '-ac', '1',
                    str(wav)], capture_output=True)
    with wave.open(str(wav)) as w:
        x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float64) / 32768.0
    wav.unlink(missing_ok=True)
    x = x / (np.abs(x).max() or 1) * 0.95
    at = marks[i] if i < len(marks) else (marks[-1] + 4.5 * (i - len(marks) + 1))
    s0 = int((at + 0.05) * SR)
    s1 = min(s0 + len(x), total)
    if s0 >= total: break
    voice[s0:s1] += x[:s1 - s0]
    segs.append((at, at + len(x) / SR))

# ── the score: the branch theme, matching what the film plays live ───────
NOTE = lambda n: 440.0 * 2 ** ((n - 69) / 12)
PROG = [[146.83, 220.00, 293.66],   # D
        [110.00, 164.81, 220.00],   # A
        [123.47, 185.00, 246.94],   # Bm
        [98.00,  146.83, 196.00]]   # G
TUNE = [[(0, 0, 2), (2, 1.5, 2), (4, 3, 1)],
        [(2, 0, 2), (1, 2, 2)],
        [(4, 0, 1.5), (2, 1.5, 1.5), (0, 3, 1)],
        [(2, 0, 2), (4, 2, 2)]]
STAGE = [0.80, 1.05, 1.35, 1.60, 1.95]

music = np.zeros(total)
t_all = np.arange(total) / SR
start = max(0.0, marks[0] - 2.0) if marks else 0.0
end = dur

def level(ts):
    """the staged build: soft to open, loudest at the close"""
    if not marks: return STAGE[0]
    f = (ts - start) / max(1e-6, (end - start))
    if f < 0.14: return STAGE[0]
    if f < 0.30: return STAGE[1]
    if f < 0.52: return STAGE[2]
    if f < 0.78: return STAGE[3]
    return STAGE[4]

def add(buf, at, x, gain):
    i0 = int(at * SR)
    if i0 >= len(buf): return
    n = min(len(x), len(buf) - i0)
    buf[i0:i0 + n] += gain * x[:n]

def saw_pad(f, secs, detune):
    n = int(secs * SR); tt = np.arange(n) / SR
    o = np.zeros(n)
    for h, g in ((1, 1.0), (2, .5), (3, .33), (4, .25), (5, .2)):
        o += g * np.sin(2 * np.pi * f * detune * h * tt + h * 0.7)
    env = np.minimum(1, np.arange(n) / (SR * secs * .42)) * np.minimum(1, (n - np.arange(n)) / (SR * secs * .5))
    return o / 3.0 * env

def bell(f, secs, ):
    n = int(secs * SR); tt = np.arange(n) / SR
    return (np.sin(2 * np.pi * f * tt) + .22 * np.sin(2 * np.pi * f * 2.01 * tt)) * np.exp(-tt * 2.4)

pos, ci = start, 0
lifted_at = start + (end - start) * 0.30      # the turn, where the film lifts
while pos < end:
    ch = PROG[ci % 4]
    lv = level(pos)
    L = CHORD_LEN * 1.9
    for k, f in enumerate(ch):
        add(music, pos, saw_pad(f, L, 0.9985), 0.115 * lv / (k + 1))
        add(music, pos, saw_pad(f, L, 1.0015), 0.115 * lv / (k + 1))
        add(music, pos, saw_pad(f * 2, L, 1.0), 0.055 * lv / (k + 1))
    tt = np.arange(int(L * SR)) / SR
    add(music, pos, np.sin(2 * np.pi * (ch[0] / 2) * tt) * np.exp(-tt / (L * .8)), 0.20 * lv)
    if pos >= lifted_at:                       # the melody enters at the turn
        for deg, at, ln in TUNE[ci % 4]:
            f = ch[deg % len(ch)] * (4 if deg >= 3 else 2)
            add(music, pos + at * BEAT, bell(f, ln * BEAT * .95), 0.085 * lv)
        for e in range(16):                    # eighth-note arpeggio
            seq = [0, 1, 2, 1, 0, 2, 1, 2][e % 8]
            f = ch[seq] * 4
            n = int(.42 * SR); ttn = np.arange(n) / SR
            add(music, pos + e * BEAT / 2,
                np.sin(2 * np.pi * f * ttn) * np.exp(-ttn * 7), (0.075 if e % 4 == 0 else 0.045) * lv)
        for bt in range(8):                    # kick and shaker
            t0 = pos + bt * BEAT
            n = int(.22 * SR); ttn = np.arange(n) / SR
            fq = 112 * np.exp(-ttn * 26) + 44
            add(music, t0, np.sin(2 * np.pi * np.cumsum(fq) / SR) * np.exp(-ttn * 20), 0.42 * lv)
            n2 = int(.05 * SR)
            sh = np.random.default_rng(int(t0 * 97)).standard_normal(n2) * np.exp(-np.arange(n2) / SR * 90)
            add(music, t0 + BEAT / 2, sh, 0.075 * lv)
    pos += CHORD_LEN; ci += 1

# ── mix: the bed steps back under the voice, and stops at the end ────────
duck = np.ones(total)
for a, b in segs:
    i0, i1 = max(0, int((a - .2) * SR)), min(total, int((b + .28) * SR))
    r = int(.22 * SR)
    duck[i0:i1] = 0.42
    if i0 > 0: duck[max(0, i0 - r):i0] = np.linspace(1, .42, min(r, i0))
    if i1 < total: duck[i1:min(total, i1 + r)] = np.linspace(.42, 1, min(r, total - i1))

tail = int(6.0 * SR)
music[-tail:] *= np.linspace(1, 0, tail)          # ring out, then silence
fade = int(2.5 * SR); i0 = int(start * SR)
music[i0:i0 + fade] *= np.linspace(0, 1, fade)

mix = np.tanh(music * 0.55) * duck * 0.9 + voice
mix = np.tanh(mix * 1.15)
mix = mix / (np.abs(mix).max() or 1) * 0.95
st = np.zeros((total, 2)); st[:, 0] = mix; st[:, 1] = mix
w = int(.012 * SR)
st[w:, 0] += .06 * music[:-w]; st[:-w, 1] += .06 * music[w:]
st = np.clip(st, -1, 1)

out = MP4 / 'story-audio.wav'
with wave.open(str(out), 'wb') as f:
    f.setnchannels(2); f.setsampwidth(2); f.setframerate(SR)
    f.writeframes((st * 32767).astype(np.int16).tobytes())
print(f'wrote {out}  {total/SR:.1f}s  ({len(segs)} lines placed)')
