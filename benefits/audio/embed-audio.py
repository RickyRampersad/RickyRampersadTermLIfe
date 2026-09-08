#!/usr/bin/env python3
"""Fold the narration MP3s into launch-eb.html as data URIs.

The film has to stay a single file: the wall plays it in an iframe and the
hosted copy runs under a policy that will not fetch a sibling asset, so an
<audio src="line01.mp3"> would be silent in exactly the two places it matters.

Run ./build-voice.sh first, then this. Re-running is safe — it replaces
whatever is between the markers.
"""
import base64, pathlib, re, sys

here = pathlib.Path(__file__).parent
film = here.parent / 'launch-eb.html'
html = film.read_text(encoding='utf-8')

mp3s = sorted(here.glob('line*.mp3'))
if not mp3s:
    sys.exit('No line*.mp3 here — run ./build-voice.sh first.')

parts, total = [], 0
for f in mp3s:
    raw = f.read_bytes(); total += len(raw)
    b64 = base64.b64encode(raw).decode('ascii')
    parts.append(f"  '{f.stem[4:]}': '{b64}'")   # quoted — 01 unquoted becomes 1
block = '\n' + ',\n'.join(parts) + '\n'

start, end = '/*__VO_START__*/', '/*__VO_END__*/'
if start not in html or end not in html:
    sys.exit('Markers missing in launch-eb.html — nothing was changed.')
html = re.sub(re.escape(start) + r'.*?' + re.escape(end),
              start + block + end, html, flags=re.S)
film.write_text(html, encoding='utf-8')

print(f'{len(mp3s)} lines embedded, {total/1024:.0f} KB of audio '
      f'({len(block)/1024:.0f} KB as base64)')
print(f'launch-eb.html is now {len(html)/1024:.0f} KB')
