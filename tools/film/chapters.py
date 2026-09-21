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
ROOT = HERE.parent.parent
DHAA = ROOT / 'donthaveanagent'          # donthaveanagent.com
BRANCH = ROOT / 'orphan-video'           # rickyrampersadbranch.com/orphan-video
VID = ROOT / 'vid'                       # rickyrampersadbranch.com/vid — the film alone
TEAM = ROOT / 'orphan-transition'        # the branch's own pages that embed it
SITES = [DHAA, BRANCH, VID, TEAM]
films = json.load(open(HERE / 'films.json'))

# which page each MP4 was rendered from, and which site it belongs to
PAGE = {'client': (DHAA, 'client-film.html'), 'process': (DHAA, 'process-film.html'),
        'agentside': (DHAA, 'agent-side-film.html'), 'agent': (DHAA, 'agent-film.html'),
        'work': (DHAA, 'how-we-work-film.html'), 'wall': (DHAA, 'wall-film.html'),
        'reel': (DHAA, 'ad-reel.html'), 'feed': (DHAA, 'ad-reel.html'),
        'orphan': (BRANCH, 'film.html')}

def names_of(site, page):
    s = (site / page).read_text(encoding='utf-8')
    out = []
    for sec in re.findall(r'<section class="scene[^"]*"[^>]*>(.*?)</section>', s, re.S):
        # the eyebrow names the chapter; a quotation card names it by its source line
        m = re.search(r'class="(?:eyebrow|src)[^"]*"[^>]*>(.*?)</div>', sec, re.S)
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
    where = PAGE.get(key)
    if not where: continue
    names = names_of(*where)
    durs = [round(d, 2) for d in cfg['durs']]
    # the last scene in the page is the finale; it holds for the rest of the film
    names = names[:len(durs)]
    meta[cfg['out']] = (','.join(f'{d:g}' for d in durs), '|'.join(names))

changed = 0
for page in [q for site in SITES if site.is_dir() for q in site.glob('*.html')]:
    s = page.read_text(encoding='utf-8'); o = s
    def fix(m):
        tag = m.group(0)
        src = re.search(r'<source[^>]+src="([^"]+\.mp4)"', tag)
        # a page outside the film's own folder reaches it by a relative path;
        # the film is known by its file name
        name = src.group(1).rsplit('/', 1)[-1] if src else None
        if not name or name not in meta: return tag
        sc, ch = meta[name]
        head = re.sub(r'\s+data-(scenes|chapters)="[^"]*"', '', m.group(1))
        return f'<video{head} data-scenes="{sc}" data-chapters="{H.escape(ch, quote=True)}">{m.group(2)}</video>'
    s = re.sub(r'<video([^>]*)>(.*?)</video>', fix, s, flags=re.S)
    if s != o:
        page.write_text(s, encoding='utf-8'); changed += 1
        print(f'{page.name}: {len(re.findall("data-scenes=", s))} video(s) marked')
print(f'{changed} page(s) updated · films known: {", ".join(sorted(meta))}')
