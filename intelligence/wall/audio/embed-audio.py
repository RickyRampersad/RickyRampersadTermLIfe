#!/usr/bin/env python3
"""Fold the narration MP3s into the wall as data URIs.

The wall has to stay a single file for the same reason the films do: it is
shown in an iframe on the branch screen, and a linked <audio src="line01.mp3">
is silent in exactly the place that matters.

Run ./build-voice.sh first, then this. Re-running is safe — it replaces
whatever sits between the markers.
"""
import base64, pathlib, re, sys

here = pathlib.Path(__file__).parent
wall = here.parent / 'index.html'
html = wall.read_text(encoding='utf-8')

# The spoken text, in order, so the wall can caption a line if it ever wants to
# and so a reader of the file can see what the voice says without playing it.
LINES = [
    "This is the forty five day line.",
    "Past the grace period. Still early enough that a phone call works.",
    "The number on the left is today's.",
    "Most of them were on a standing instruction that failed.",
    "A bank order. A salary deduction. Something that should have collected itself.",
    "That is a bank to ring. Not a client who refused.",
    "And most have been in force for years, not months.",
    "These are not bad sales. They are long standing clients who stopped.",
    "The gold bar is a whole billing cohort crossing on one day.",
    "Work it before it lands.",
]

def mp3_seconds(path):
    """Duration by counting MPEG frames — no ffprobe, no dependency.

    The bed under the narration is told how long to last so it lands on its
    home chord instead of being cut off, and it can only know that if these
    durations travel with the audio. Guessing an average is what makes a bed
    stop three seconds after the voice does."""
    d = path.read_bytes(); i = 0; n = len(d); t = 0.0
    BR = {1: [0,32,40,48,56,64,80,96,112,128,160,192,224,256,320,0],
          0: [0,8,16,24,32,40,48,56,64,80,96,112,128,144,160,0]}
    SR = {3: [44100,48000,32000], 2: [22050,24000,16000], 0: [11025,12000,8000]}
    if d[:3] == b'ID3':
        i = 10 + ((d[6]&0x7f)<<21 | (d[7]&0x7f)<<14 | (d[8]&0x7f)<<7 | (d[9]&0x7f))
    while i + 4 <= n:
        if d[i] != 0xFF or (d[i+1] & 0xE0) != 0xE0: i += 1; continue
        ver = (d[i+1]>>3)&3; layer = (d[i+1]>>1)&3
        if layer != 1: i += 1; continue                       # Layer III only
        bi = (d[i+2]>>4)&0xF; si = (d[i+2]>>2)&3; pad = (d[i+2]>>1)&1
        if bi in (0,15) or si == 3: i += 1; continue
        mpeg1 = ver == 3
        br = BR[1 if mpeg1 else 0][bi]*1000; sr = SR.get(ver, SR[2])[si]
        if not br or not sr: i += 1; continue
        spf = 1152 if mpeg1 else 576
        flen = int(spf/8*br/sr) + pad
        if flen <= 0: i += 1; continue
        t += spf/sr; i += flen
    return round(t, 2)

mp3s = sorted(here.glob('line*.mp3'))
if not mp3s:
    sys.exit('No line*.mp3 here — run ./build-voice.sh first.')
if len(mp3s) != len(LINES):
    sys.exit(f'{len(mp3s)} MP3s against {len(LINES)} lines — regenerate before embedding.')

parts, total = [], 0
for f, text in zip(mp3s, LINES):
    raw = f.read_bytes(); total += len(raw)
    b64 = base64.b64encode(raw).decode('ascii')
    esc = text.replace('\\', '\\\\').replace('"', '\\"')
    parts.append(f'  {{t:"{esc}", s:{mp3_seconds(f)},\n   a:"data:audio/mpeg;base64,{b64}"}}')

block = 'var NARRATION = [\n' + ',\n'.join(parts) + '\n];'

pat = re.compile(r'^var NARRATION = \[.*?\];', re.S | re.M)
if not pat.search(html):
    sys.exit('No "var NARRATION = [...]" in index.html — nothing was changed.')
html = pat.sub(lambda _: block, html, count=1)
wall.write_text(html, encoding='utf-8')

print(f'Embedded {len(mp3s)} lines, {sum(mp3_seconds(f) for f in mp3s):.1f}s, {total/1024:.0f}KB of audio '
      f'({total*4/3/1024:.0f}KB as base64).')
print(f'{wall.name} is now {len(html)/1024:.0f}KB. The Narrate button will enable itself.')
