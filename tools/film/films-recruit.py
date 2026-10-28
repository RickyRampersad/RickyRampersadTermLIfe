#!/usr/bin/env python3
"""Write the recruiting film's entries into films.json from the timing files: `recruit` (1280x720) and `recruitv`
(1080x1920) for the full film, and `trailer` / `trailerv` for the 90-second cut. Same voice, captions burned over the
picture in all four, since most of this audience watches muted. Run after importvox.py, before sfx.py and usetrack.py."""
import json, os
f = json.load(open('films.json'))
SHAPES = {'l': ('', 1280, 720, 30, 52, ''), 'v': ('v', 1080, 1920, 46, 30, '-story'), 'q': ('q', 1080, 1080, 40, 34, '-square')}
def entries(key, tfile, vox, out, hitlist, dark, shapes=('l', 'v')):
    t = json.load(open(tfile)); starts = [sum(t['durs'][:i]) for i in range(len(t['durs']))]
    def at(n, word, k=0):
        hits = [s for s, w in t['lines'][n - 1]['words'] if w.lower().strip('.,?:!').startswith(word.lower())]
        if len(hits) > k: return round(starts[n - 1] + 0.4 + hits[k], 2)
        raise SystemExit(f'{key}: no "{word}" in line {n}')
    hits = [at(*h) for h in hitlist]
    base = dict(durs=t['durs'], dur=t['dur'], vox=vox, start=18, musicgain=0.5, duck=0.5, dark=dark, ticks=[], hits=hits, capmode='over')
    for sh in shapes:
        sfx, w, h, cs, cw, tail = SHAPES[sh]; k = key + sfx
        f[k] = dict(base, cap=f'cap-{k}', out=f'../../agentmgt/{out}{tail}.mp4', mix=f'{k}-mix.wav', music=f'bed-{k}.wav',
                    sfx=f'sfx-{k}.wav', ass=f'captions-{k}.ass', w=w, h=h, capsize=cs, capwrap=cw)
    print(f'films.json: {key} {t["dur"]} s · hits {hits}')
entries('recruit', 'recruit-timing.json', 'vorecruit', 'recruit',
        [(2, 'Five'), (2, 'Thirty'), (5, 'call'), (7, 'evidence'), (12, 'board'), (16, 'dollars'), (18, 'pace'),
         (11, 'hundred'), (11, 'pays'), (23, 'written'), (25, 'ten'), (14, 'GO', 1), (30, 'open'), (30, 'Twenty')], [3, 32])
if os.path.exists('recruit-trailer-timing.json'):
    entries('trailer', 'recruit-trailer-timing.json', 'votrailer', 'trailer',
            [(2, 'income'), (3, 'zero'), (4, 'coach'), (5, 'Five'), (5, 'Thirty'), (5, 'Five', 1), (6, 'open'), (6, 'Twenty')], [8])
# the 35-second feed cuts: square for the LinkedIn and Facebook feed, tall for Reels and Stories; no landscape
for v in 'AB':
    if os.path.exists(f'recruit-ad{v}-timing.json'):
        entries(f'ad{v}', f'recruit-ad{v}-timing.json', f'voad{v}', f'ad-{v.lower()}',
                [(2, 'Not'), (4, 'Five'), (4, 'Thirty'), (5, 'One'), (5, 'Twenty')], [], shapes=('q', 'v'))
json.dump(f, open('films.json', 'w'), indent=1)
