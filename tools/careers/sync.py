#!/usr/bin/env python3
"""Write careers/index.html from agentmgt/index.html.

rickyrampersadbranch.com/careers/ is the recruiting page served on the branch's own site (GitHub Pages), so the
Careers button on the homepage opens it the moment main is merged, with no Netlify step. agentmgt.com serves the
same page from the agentmgt/ folder. The page is written once, here; this script makes the /careers/ copy:

  - every local asset (the mark, the films, their posters, the QR, the player, the tab icon) is read from
    /agentmgt/, where GitHub Pages already serves it, so nothing is duplicated but the HTML;
  - the canonical address and the share card say rickyrampersadbranch.com/careers/;
  - the view beacon the page carries is kept.

Run it after any change to agentmgt/index.html:   python3 tools/careers/sync.py
"""
import os, re, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
src = os.path.join(ROOT, 'agentmgt', 'index.html'); out = os.path.join(ROOT, 'careers', 'index.html')
html = open(src, encoding='utf-8').read()
ASSETS = ['mark.svg', 'icon.svg', 'qr.svg', 'player.js', 'trailer.mp4', 'trailer.jpg', 'recruit.mp4', 'recruit.jpg',
          'recruit-story.mp4', 'recruit-story.jpg', 'trailer-story.mp4', 'trailer-story.jpg', 'og.jpg']
n = 0
for a in ASSETS:
    for pat, rep in ((f'src="{a}"', f'src="/agentmgt/{a}"'), (f'href="{a}"', f'href="/agentmgt/{a}"'), (f'poster="{a}"', f'poster="/agentmgt/{a}"'), (f'url({a})', f'url(/agentmgt/{a})')):
        c = html.count(pat); n += c; html = html.replace(pat, rep)
html = html.replace('<link rel="canonical" href="https://agentmgt.com/">', '<link rel="canonical" href="https://rickyrampersadbranch.com/careers/">')
html = html.replace('content="https://agentmgt.com/"', 'content="https://rickyrampersadbranch.com/careers/"')
html = html.replace('content="https://agentmgt.com/og.jpg"', 'content="https://rickyrampersadbranch.com/agentmgt/og.jpg"')
left = re.findall(r'(?:src|href|poster)="(?!https?:|/|#|mailto:|tel:|\'|data:)([^"]+)"', html) + re.findall(r'url\((?!["\'#/]|https?:|data:)([^)]+)\)', html)
if left: sys.exit(f'unrewritten relative reference(s): {sorted(set(left))}')
if 'rrb-views' not in html: sys.exit('the view beacon is missing from agentmgt/index.html')
head = ('<!-- Written by tools/careers/sync.py from agentmgt/index.html: edit that page and run the script, never this file. -->\n')
html = html.replace('<!DOCTYPE html>', '<!DOCTYPE html>\n' + head, 1) if '<!DOCTYPE html>' in html else head + html
open(out, 'w', encoding='utf-8').write(html)
print(f'careers/index.html: {len(html):,} bytes, {n} asset references now read from /agentmgt/')
