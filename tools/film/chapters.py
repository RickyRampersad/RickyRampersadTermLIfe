#!/usr/bin/env python3
"""Write each film's scene positions and names onto every <video> that plays it.

player.js draws a dot per scene on its rail and shows the scene's name; this
is where those come from, so nothing is typed by hand and a re-timed film
updates every page in one run:

    python3 chapters.py

  · scene lengths: films.json → data-scenes="5.8,12.6,…"
  · scene names: the eyebrow of every <section class="scene"> in the film's
    own page (its heading when a scene has no eyebrow) → data-chapters="a|b|…"
"""
import json, pathlib, re, html as H

HERE = pathlib.Path(__file__).resolve().parent
SITE = HERE.parent.parent / 'donthaveanagent'
films = json.load(open(HERE / 'films.json'))

# which page each MP4 was rendered from
PAGE = {'client': 'client-film.html', 'process': 'process-film.html', 'agentside': 'agent-side-film.html',
        'agent': 'agent-film.html', 'work': 'how-we-work-film.html', 'wall': 'wall-film.html',
        'reel': 'ad-reel.html', 'feed': 'ad-reel.html'}

def names_of(page):
    s = (SITE / page).read_text(encoding='utf-8')
    out = []
    for sec in re.findall(r'<section class="scene[^"]*"[^>]*>(.*?)</section>', s, re.S):
        m = re.search(r'class="eyebrow[^"]*"[^>]*>(.*?)</div>', sec, re.S)
        t = m.group(1) if m else (re.search(r'<h[12][^>]*>(.*?)</h[12]>', sec, re.S) or [None, ''])[1]
        t = re.sub(r'<i>\s*</i>', '', t)
        t = re.sub(r'<[^>]+>', ' ', t); t = H.unescape(re.sub(r'\s+', ' ', t)).strip().rstrip('.')
        if not t:   # a scene with neither — take its first words
            plain = H.unescape(re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', sec))).strip()
            t = plain[:44].rstrip('.')
        out.append(t[:44])
    return out

meta = {}
for key, cfg in films.items():
    page = PAGE.get(key)
    if not page: continue
    names = names_of(page)
    durs = [round(d, 2) for d in cfg['durs']]
    # the last scene in the page is the finale; it holds for the rest of the film
    names = names[:len(durs)]
    meta[cfg['out']] = (','.join(f'{d:g}' for d in durs), '|'.join(names))

changed = 0
for page in SITE.glob('*.html'):
    s = page.read_text(encoding='utf-8'); o = s
    def fix(m):
        tag = m.group(0)
        src = re.search(r'<source[^>]+src="([^"]+\.mp4)"', tag)
        if not src or src.group(1) not in meta: return tag
        sc, ch = meta[src.group(1)]
        head = re.sub(r'\s+data-(scenes|chapters)="[^"]*"', '', m.group(1))
        return f'<video{head} data-scenes="{sc}" data-chapters="{H.escape(ch, quote=True)}">{m.group(2)}</video>'
    s = re.sub(r'<video([^>]*)>(.*?)</video>', fix, s, flags=re.S)
    if s != o:
        page.write_text(s, encoding='utf-8'); changed += 1
        print(f'{page.name}: {len(re.findall("data-scenes=", s))} video(s) marked')
print(f'{changed} page(s) updated · films known: {", ".join(sorted(meta))}')
