#!/usr/bin/env python3
"""Fold the sentence library into wall.html: audio between /*__WVO_START__*/
and /*__WVO_END__*/, and the spoken text between /*__WVT_START__*/ and
/*__WVT_END__*/ — one source of truth, so the on-screen subtitle is always
exactly the words Andrew says. Re-running replaces both blocks."""
import base64, json, pathlib, re, sys

here = pathlib.Path(__file__).parent
mp3s = sorted(here.glob('c_*.mp3'))
manifest = here / 'manifest.json'
if not mp3s or not manifest.exists():
    sys.exit('run ./build-sentences.py first')
texts = json.loads(manifest.read_text())

parts, raw = [], 0
for f in mp3s:
    b = f.read_bytes()
    raw += len(b)
    parts.append(f"  '{f.stem[2:]}': '{base64.b64encode(b).decode()}'")
audio_block = '\n' + ',\n'.join(parts) + '\n'
text_block = '\n' + ',\n'.join(
    f"  '{k}': {json.dumps(texts[k], ensure_ascii=False)}"
    for k in sorted(texts) if (here / f'c_{k}.mp3').exists()) + '\n'

A0, A1 = '/*__WVO_START__*/', '/*__WVO_END__*/'
T0, T1 = '/*__WVT_START__*/', '/*__WVT_END__*/'
for name in ('wall.html', 'qpwall.html'):
    page = here.parent.parent / name
    if not page.exists():
        continue
    html = page.read_text()
    if A0 not in html or T0 not in html:
        sys.exit(f'markers missing in {name}')
    html = re.sub(re.escape(A0) + r'.*?' + re.escape(A1), A0 + audio_block + A1, html, flags=re.S)
    html = re.sub(re.escape(T0) + r'.*?' + re.escape(T1), T0 + text_block + T1, html, flags=re.S)
    page.write_text(html)
    print(f'{len(mp3s)} sentences ({raw//1024} KB audio) embedded; {name} is {len(html)//1024} KB')
