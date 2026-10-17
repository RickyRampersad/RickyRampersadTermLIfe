#!/usr/bin/env python3
"""Voice one day film, and write its captions so they read.

    python3 voice-day.py daystaff|dayagent|dayunit|daybm

Writes vo<key>/NN.wav, NN.vtt and <key>-timing.json: each scene's length and
every spoken word's start, from edge-tts's WordBoundary events, which is what
places every motion in the film.

TWO THINGS THIS FILE EXISTS TO GET RIGHT, both of which went wrong first time:

  boundary='WordBoundary'.  edge-tts 7.x defaults to SentenceBoundary and
  yields NO word events at all. The first voicing of all four films produced
  timing files with empty word lists, and every cue in the build would have
  thrown. There is no warning; the files just come back empty.

  The captions come from the SCRIPT, not from the word events.  A
  WordBoundary carries the word and nothing else: no comma, no full stop.
  Captioning from them gave "twice KPI one is in Reporting is late The
  afternoon has not started" — every sentence run into the next, on films
  most people watch with the sound off. The words are therefore taken from
  the line as written and the times from the events; they are the same list
  in the same order, and this refuses to write a caption if they ever
  stop being.
"""

import asyncio, json, os, pathlib, subprocess, sys, certifi

CA = '/root/.ccr/ca-bundle.crt'
if os.path.exists(CA):
    certifi.where = lambda: CA
    os.environ['SSL_CERT_FILE'] = CA
import edge_tts

HERE = pathlib.Path(__file__).resolve().parent
KEY = sys.argv[1]
FILM = HERE
VOX = FILM / ('vo' + KEY)
VOX.mkdir(exist_ok=True)
SCRIPT = json.load(open(FILM / f'{KEY}-lines.json'))
AIR = 1.15          # a beat of silence after every line
RATE = SCRIPT.get('rate', '-12%')
VOICE = SCRIPT.get('voice', 'en-US-AndrewNeural')

async def one(n, text):
    mp3 = VOX / f'{n:02d}.mp3'
    c = edge_tts.Communicate(text, VOICE, rate=RATE, boundary='WordBoundary')
    words = []
    with open(mp3, 'wb') as f:
        async for ch in c.stream():
            if ch['type'] == 'audio':
                f.write(ch['data'])
            elif ch['type'] == 'WordBoundary':
                words.append([int(ch['offset'] / 10000), ch['text']])
    wav = VOX / f'{n:02d}.wav'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(mp3), '-ar', '48000',
                    '-ac', '1', str(wav)], check=True)
    dur = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration',
                                '-of', 'csv=p=0', str(wav)], capture_output=True,
                               text=True).stdout.strip())
    captions(VOX / f'{n:02d}.vtt', text, words, dur, n)
    return dur, words


def ts(s):
    h = int(s // 3600); m = int(s % 3600 // 60); sec = s % 60
    return f'{h:02d}:{m:02d}:{sec:06.3f}'


MAXC = 64          # two comfortable lines in the caption band


def captions(path, line, times, dur, n):
    """One cue a sentence, in the words as written. See the header."""
    import re
    toks = [t for t in re.split(r'\s+', line) if t]
    if len(toks) != len(times):
        raise SystemExit(f'scene {n}: {len(toks)} words in the line, '
                         f'{len(times)} spoken. The caption cannot be trusted.')
    cues, cur, start = [], [], None
    for k, (tok, (ms, _)) in enumerate(zip(toks, times)):
        if start is None: start = ms / 1000
        cur.append(tok)
        nxt = times[k + 1][0] / 1000 if k + 1 < len(times) else dur
        txt = ' '.join(cur)
        if tok.endswith(('.', '?', '!', ':')) or len(txt) >= MAXC or \
           (tok.endswith(',') and len(txt) >= MAXC - 18):
            cues.append((start, nxt, txt)); cur, start = [], None
    if cur:
        cues.append((start, dur, ' '.join(cur)))
    with open(path, 'w') as f:
        f.write('WEBVTT\n\n')
        for (a, b, txt) in cues:
            f.write(f'{ts(a)} --> {ts(b)}\n{txt}\n\n')

async def main():
    durs, allw = [], []
    for n, sc in enumerate(SCRIPT['scenes'], 1):
        d, wds = await one(n, sc['line'])
        extra = sc.get('extra', 0)
        durs.append(round(d + AIR + extra, 3))
        allw.append(wds)
        print(f'  {n:02d} {durs[-1]:6.2f}s  {len(wds):3d} words  {sc["visual"]}')
    out = {'durs': durs, 'dur': round(sum(durs), 3), 'words': allw,
           'note': 'Scene lengths and every spoken word, from edge-tts. Re-voice and the scenes re-time themselves.'}
    json.dump(out, open(FILM / f'{KEY}-timing.json', 'w'), indent=1)
    print(f'{KEY}: {out["dur"]:.1f}s over {len(durs)} scenes')

asyncio.run(main())
