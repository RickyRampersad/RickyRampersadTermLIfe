#!/usr/bin/env python3
"""Turn the voice runner's output into what the mixer reads.

The GitHub runner (the `tts-run` branch, `.github/workflows/tts.yml`) voices each line with edge-tts and
commits `tts/out/<key>/NN.mp3` and `NN.words.json` (each word's start and length in milliseconds, from the
WordBoundary events). mixany.py reads `vo<key>/NN.wav` for the voice and `NN.vtt` for the captions, and the
film's scenes are timed from the audio. This writes all three, and prints the durations to put in films.json.

    python3 importvox.py <tts/out/key dir> <vox dir> [air seconds, default 1.15] [--timing out.json]

The timing file carries, per line, its length and every word's start, so a builder can land a reveal on
the word that names it.
"""
import glob, json, os, subprocess, sys, wave

src, dst = sys.argv[1], sys.argv[2]
air = float(sys.argv[3]) if len(sys.argv) > 3 and not sys.argv[3].startswith('--') else 1.15
timing_out = sys.argv[sys.argv.index('--timing') + 1] if '--timing' in sys.argv else None
os.makedirs(dst, exist_ok=True)

def hms(ms):
    s = ms / 1000
    return f'{int(s // 3600):02d}:{int(s % 3600 // 60):02d}:{s % 60:06.3f}'

durs, timing = [], []
for mp3 in sorted(glob.glob(os.path.join(src, '[0-9][0-9].mp3'))):
    n = os.path.basename(mp3)[:2]
    wav = os.path.join(dst, n + '.wav')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', mp3, '-ar', '44100', '-ac', '2', wav], check=True)
    with wave.open(wav) as w:
        length = w.getnframes() / w.getframerate()
    words = json.load(open(mp3[:-4] + '.words.json'))
    # one caption cue per sentence-ish chunk: break on sentence ends, never longer than ~9 words
    cues, cur = [], []
    for i, (start, dur, text) in enumerate(words):
        cur.append((start, dur, text))
        last = i == len(words) - 1
        if last or text.rstrip().endswith(('.', '?', '!', ':')) or len(cur) >= 9:
            a = cur[0][0]; b = cur[-1][0] + cur[-1][1]
            cues.append((a, b, ' '.join(t for _, _, t in cur)))
            cur = []
    with open(os.path.join(dst, n + '.vtt'), 'w', encoding='utf-8') as f:
        f.write('WEBVTT\n\n')
        for a, b, t in cues:
            f.write(f'{hms(a)} --> {hms(b)}\n{t}\n\n')
    d = round(length + air, 1)
    durs.append(d)
    timing.append({'n': int(n), 'len': round(length, 3), 'd': d,
                   'words': [[round(s / 1000, 3), t] for s, _, t in words]})
    print(f'{n}: {length:5.2f}s voice → scene {d:5.1f}s · {len(words)} words')

print('durs:', json.dumps(durs), ' dur:', round(sum(durs), 1))
if timing_out:
    json.dump({'air': air, 'durs': durs, 'dur': round(sum(durs), 1), 'lines': timing}, open(timing_out, 'w'), indent=1)
    print('timing →', timing_out)
