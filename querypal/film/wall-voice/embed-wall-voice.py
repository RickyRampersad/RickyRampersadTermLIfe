#!/usr/bin/env python3
"""Fold Andrew's voice bank into wall.html as data URIs, between
/*__WVO_START__*/ and /*__WVO_END__*/. Re-running replaces the block.

The bank is fragments plus every number to a hundred, so the wall can splice
live branch figures into spoken sentences. Files are c_<key>.mp3; the key is
what the player asks for (see lines() in wall.html).
"""
import base64, pathlib, re, sys

here = pathlib.Path(__file__).parent
mp3s = sorted(here.glob('c_*.mp3'))
if not mp3s:
    sys.exit('run ./build-wall-voice.sh first')

parts, raw = [], 0
for f in mp3s:
    b = f.read_bytes()
    raw += len(b)
    parts.append(f"  '{f.stem[2:]}': '{base64.b64encode(b).decode()}'")
block = '\n' + ',\n'.join(parts) + '\n'

start, end = '/*__WVO_START__*/', '/*__WVO_END__*/'
for name in ('wall.html', 'qpwall.html'):
    page = here.parent.parent / name
    if not page.exists():
        continue
    html = page.read_text()
    if start not in html:
        sys.exit(f'markers missing in {name}')
    html = re.sub(re.escape(start) + r'.*?' + re.escape(end), start + block + end, html, flags=re.S)
    page.write_text(html)
    print(f'{len(mp3s)} clips ({raw//1024} KB of audio) embedded; {name} is now {len(html)//1024} KB')
