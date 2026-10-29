#!/usr/bin/env python3
"""Turn the voice runner's output into what the mixer reads.

The GitHub runner (the `tts-run` branch, `.github/workflows/tts.yml`) voices each line with edge-tts and
commits `tts/out/<key>/NN.mp3` and `NN.words.json` (each word's start and length in milliseconds, from the
WordBoundary events). mixany.py reads `vo<key>/NN.wav` for the voice and `NN.vtt` for the captions, and the
film's scenes are timed from the audio. This writes all three, and prints the durations to put in films.json.

    python3 importvox.py <tts/out/key dir> <vox dir> [air seconds, default 1.15] [--timing out.json]
                         [--lines <film>-lines.json]

edge-tts's WordBoundary events carry the bare word and no punctuation, so a cue built from them
alone reads as a run-on: 'Twenty-three agents and managers Five more behind them'. Worse, the
sentence-end test below can then never fire, so cues only ever break at the nine-word ceiling.
--lines hands over the spoken line as it was written, and the punctuation is walked back on.

The timing file carries, per line, its length and every word's start, so a builder can land a reveal on
the word that names it.
"""
import glob, json, os, re, subprocess, sys, wave

src, dst = sys.argv[1], sys.argv[2]
air = float(sys.argv[3]) if len(sys.argv) > 3 and not sys.argv[3].startswith('--') else 1.15
timing_out = sys.argv[sys.argv.index('--timing') + 1] if '--timing' in sys.argv else None
lines_in = sys.argv[sys.argv.index('--lines') + 1] if '--lines' in sys.argv else None
SAID, EXTRA = [], []
if lines_in:
    _L = json.load(open(lines_in))['scenes']
    SAID = [x.get('say', '') for x in _L]
    EXTRA = [float(x.get('extra', 0) or 0) for x in _L]
os.makedirs(dst, exist_ok=True)

def hms(ms):
    s = ms / 1000
    return f'{int(s // 3600):02d}:{int(s % 3600 // 60):02d}:{s % 60:06.3f}'


def repunct(bare, said):
    """Put the spoken line's own punctuation back on the boundary words.

       edge-tts reports one WordBoundary per word with the punctuation stripped,
       so the cue text has to be read back off the line as it was written. Each
       boundary word is found in the remaining line, ignoring case and anything
       that is not a letter or a digit, and whatever trailing punctuation sits
       against it comes with it. A word that cannot be placed is kept bare, so a
       line the voice split or merged degrades to what it did before rather than
       losing a word."""
    if not said:
        return bare
    out, cur = [], 0
    low = said.lower()
    for w in bare:
        key = re.sub(r'[^0-9a-z]', '', w.lower())
        if not key:
            out.append(w)
            continue
        i, j, n = cur, 0, len(low)
        while i < n and j < len(key):
            if low[i].isalnum():
                if low[i] == key[j]:
                    j += 1
                else:
                    j = 0
                    i = i - j
            i += 1
        if j < len(key):
            out.append(w)
            continue
        start = i - 1
        # a hyphen or an apostrophe joins a word: 'Twenty-three' must not
        # come back as 'three'.
        while start > cur and (low[start - 1].isalnum() or low[start - 1] in "-'\u2019"):
            start -= 1
        end = i
        while end < n and low[end] in '.,;:!?\u2019\'")\u2014':
            end += 1
        out.append(said[start:end])
        cur = end
    return out

durs, timing = [], []
for mp3 in sorted(glob.glob(os.path.join(src, '[0-9][0-9].mp3'))):
    n = os.path.basename(mp3)[:2]
    wav = os.path.join(dst, n + '.wav')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', mp3, '-ar', '44100', '-ac', '2', wav], check=True)
    with wave.open(wav) as w:
        length = w.getnframes() / w.getframerate()
    words = json.load(open(mp3[:-4] + '.words.json'))
    idx = int(n) - 1
    if SAID and idx < len(SAID):
        shown = repunct([t for _, _, t in words], SAID[idx])
        words = [(s0, d0, shown[k]) for k, (s0, d0, _) in enumerate(words)]
    # One cue per sentence. A sentence longer than the ceiling is split into
    # near-equal halves rather than chopped at the ceiling, because chopping
    # leaves an orphan — 'belong to you, not to' / 'me.' — which on a burned-in
    # caption strip reads as a mistake.
    MAXW = 11
    sents, cur = [], []
    for i, (start, dur, text) in enumerate(words):
        cur.append((start, dur, text))
        if i == len(words) - 1 or text.rstrip().endswith(('.', '?', '!', ':')):
            sents.append(cur)
            cur = []
    if cur:
        sents.append(cur)
    cues = []
    for sent in sents:
        parts = max(1, -(-len(sent) // MAXW))
        size = -(-len(sent) // parts)
        for k in range(0, len(sent), size):
            chunk = sent[k:k + size]
            a = chunk[0][0]; b = chunk[-1][0] + chunk[-1][1]
            cues.append((a, b, ' '.join(t for _, _, t in chunk)))
    with open(os.path.join(dst, n + '.vtt'), 'w', encoding='utf-8') as f:
        f.write('WEBVTT\n\n')
        # the voice is told to say the address letter by letter; the caption reads it as written
        cues = [(a, b, re.sub(r'[Aa]gent M\s*G\s*T dot com', 'agentmgt.com', t)) for a, b, t in cues]
        for a, b, t in cues:
            f.write(f'{hms(a)} --> {hms(b)}\n{t}\n\n')
    d = round(length + air + (EXTRA[idx] if EXTRA and idx < len(EXTRA) else 0), 1)
    durs.append(d)
    timing.append({'n': int(n), 'len': round(length, 3), 'd': d,
                   'words': [[round(s / 1000, 3), t] for s, _, t in words]})
    print(f'{n}: {length:5.2f}s voice → scene {d:5.1f}s · {len(words)} words')

print('durs:', json.dumps(durs), ' dur:', round(sum(durs), 1))
if timing_out:
    json.dump({'air': air, 'durs': durs, 'dur': round(sum(durs), 1), 'lines': timing}, open(timing_out, 'w'), indent=1)
    print('timing →', timing_out)
