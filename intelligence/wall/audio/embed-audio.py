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
    "Forty one policies crossed the forty five day line today.",
    "They carry thirty seven thousand dollars in premium.",
    "Thirty four of them were on a standing instruction that failed.",
    "That is a bank to ring. Not a client who refused.",
    "Thirty one have been in force between two and ten years.",
    "These are not bad sales. They are long standing clients who stopped.",
    "On Friday the eleventh, three hundred and forty five more cross.",
    "One billing cohort. Everything paid to the twenty eighth of July.",
    "Eight times a normal day.",
    "Work it before Friday.",
]

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
    parts.append(f'  {{t:"{esc}",\n   a:"data:audio/mpeg;base64,{b64}"}}')

block = 'var NARRATION = [\n' + ',\n'.join(parts) + '\n];'

pat = re.compile(r'^var NARRATION = \[.*?\];', re.S | re.M)
if not pat.search(html):
    sys.exit('No "var NARRATION = [...]" in index.html — nothing was changed.')
html = pat.sub(lambda _: block, html, count=1)
wall.write_text(html, encoding='utf-8')

print(f'Embedded {len(mp3s)} lines, {total/1024:.0f}KB of audio '
      f'({total*4/3/1024:.0f}KB as base64).')
print(f'{wall.name} is now {len(html)/1024:.0f}KB. The Narrate button will enable itself.')
