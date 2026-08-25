#!/usr/bin/env python3
"""Fold the Andrew board titles into wall.html as data URIs, between
/*__WVO_START__*/ and /*__WVO_END__*/. Re-running replaces the block."""
import base64, pathlib, re, sys
here = pathlib.Path(__file__).parent
wall = here.parent.parent / 'wall.html'
html = wall.read_text()
mp3s = sorted(here.glob('w*.mp3'))
if not mp3s: sys.exit('run ./build-wall-voice.sh first')
parts = []
for f in mp3s:
    parts.append(f"  '{f.stem[1:]}': '{base64.b64encode(f.read_bytes()).decode()}'")
block = '\n' + ',\n'.join(parts) + '\n'
start, end = '/*__WVO_START__*/', '/*__WVO_END__*/'
if start not in html: sys.exit('markers missing in wall.html')
html = re.sub(re.escape(start) + r'.*?' + re.escape(end), start + block + end, html, flags=re.S)
wall.write_text(html)
print(f'{len(mp3s)} Andrew clips embedded; wall.html is now {len(html)//1024} KB')
