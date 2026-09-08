#!/usr/bin/env python3
"""Fold the narration into the wall pages as data URIs.

    ./embed-audio.py            # all five
    ./embed-audio.py licence    # one

Each page has to stay a single file: it is shown in an iframe on the branch
screen, and a linked <audio src="line01.mp3"> is silent in exactly the place
that matters. Run ./build-voice.py first. Re-running is safe — it replaces
whatever sits between the markers."""
import base64, pathlib, re, sys
from lines import WALLS, mp3_seconds

here = pathlib.Path(__file__).parent
want = sys.argv[1:] or list(WALLS)

for wall in want:
    if wall not in WALLS:
        sys.exit('No such wall: ' + wall)
    page = here.parent / (wall + '.html')
    html = page.read_text(encoding='utf-8')
    mp3s = sorted((here / 'narration' / wall).glob('line*.mp3'))
    lines = WALLS[wall]
    if not mp3s:
        sys.exit('No narration/%s/line*.mp3 — run ./build-voice.py %s first.' % (wall, wall))
    if len(mp3s) != len(lines):
        sys.exit('%s: %d MP3s against %d lines — render again before embedding.' % (wall, len(mp3s), len(lines)))

    parts, total, secs = [], 0, 0.0
    for f, text in zip(mp3s, lines):
        raw = f.read_bytes(); total += len(raw); s = mp3_seconds(f); secs += s
        b64 = base64.b64encode(raw).decode('ascii')
        esc = text.replace('\\', '\\\\').replace('"', '\\"')
        parts.append('  {t:"%s", s:%s,\n   a:"data:audio/mpeg;base64,%s"}' % (esc, s, b64))
    block = 'var NARRATION = [\n' + ',\n'.join(parts) + '\n];'

    pat = re.compile(r'^var NARRATION = \[.*?\];', re.S | re.M)
    if not pat.search(html):
        sys.exit('No "var NARRATION = [...]" in %s — nothing was changed.' % page.name)
    html = pat.sub(lambda _: block, html, count=1)
    page.write_text(html, encoding='utf-8')
    print('%-16s %2d lines  %5.1fs  %4.0fKB of audio -> %s is %dKB'
          % (wall + '.html', len(mp3s), secs, total / 1024, page.name, len(html) / 1024))
