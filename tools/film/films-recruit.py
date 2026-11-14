#!/usr/bin/env python3
"""Write the recruiting film's entries into films.json from the timing files: `recruit` (1280x720) and `recruitv`
(1080x1920) for the full film, and `trailer` / `trailerv` for the 90-second cut. Same voice, captions burned over the
picture in all four, since most of this audience watches muted. Run after importvox.py, before sfx.py and usetrack.py."""
import json, os
f = json.load(open('films.json'))
SHAPES = {'l': ('', 1280, 720, 30, 52, ''), 'v': ('v', 1080, 1920, 46, 30, '-story'), 'q': ('q', 1080, 1080, 40, 34, '-square')}
def entries(key, tfile, vox, out, hitlist, dark, shapes=('l', 'v'), ticks=()):
    """ticks: (scene, count, gap) → the clock's ticks from that scene's first second (sfx.py adds 0.75 s)."""
    t = json.load(open(tfile)); starts = [sum(t['durs'][:i]) for i in range(len(t['durs']))]
    def at(n, word, k=0):
        hits = [s for s, w in t['lines'][n - 1]['words'] if w.lower().strip('.,?:!').startswith(word.lower())]
        if len(hits) > k: return round(starts[n - 1] + 0.4 + hits[k], 2)
        raise SystemExit(f'{key}: no "{word}" in line {n}')
    hits = [at(*h) for h in hitlist]
    tk = [[round(starts[n - 1] - 0.3, 2), c, g] for n, c, g in ticks]
    base = dict(durs=t['durs'], dur=t['dur'], vox=vox, start=18, musicgain=0.5, duck=0.5, dark=dark, ticks=tk, hits=hits, capmode='over')
    for sh in shapes:
        sfx, w, h, cs, cw, tail = SHAPES[sh]; k = key + sfx
        f[k] = dict(base, cap=f'cap-{k}', out=f'../../agentmgt/{out}{tail}.mp4', mix=f'{k}-mix.wav', music=f'bed-{k}.wav',
                    sfx=f'sfx-{k}.wav', ass=f'captions-{k}.ass', w=w, h=h, capsize=cs, capwrap=cw)
    print(f'films.json: {key} {t["dur"]} s · hits {hits}')
entries('recruit', 'recruit-timing.json', 'vorecruit', 'recruit',
        [(2, 'seven'), (2, 'Thirty'), (5, 'call'), (7, 'evidence'), (12, 'board'), (16, 'dollars'), (19, 'twenty'),
         (11, 'hundred'), (11, 'pays'), (17, 'forty'), (17, 'eighty'), (17, 'forty', 1), (17, 'applications'), (17, 'Bigger'), (17, 'Insurance'),
         (24, 'written'), (26, 'ten'), (26, 'Happy'), (14, 'GO', 1), (31, 'open'), (31, 'Twenty')], [3, 33], ticks=((22, 6, 0.5),))
if os.path.exists('recruit-trailer-timing.json'):
    entries('trailer', 'recruit-trailer-timing.json', 'votrailer', 'trailer',
            [(2, 'income'), (3, 'zero'), (4, 'coach'), (5, 'Seven'), (5, 'Thirty'), (5, 'Seven', 1), (6, 'open'), (6, 'Twenty')], [8], ticks=((4, 5, 0.5),))
# The 40-second feed cuts: square for the LinkedIn and Facebook feed, tall for Reels and Stories; no landscape.
# A cue word that is not in the line exits before films.json is written, so a stale entry is never left
# behind — which is what caught the old (2, 'here') and (4, 'third') on the 12 Nov re-cut. The two ads used
# to share one cue list, which forced every punch word to appear in BOTH lines for that scene; after the
# re-cut on the cliff research they have no word in common at scene 4 ("Thirty-nine things" against "This
# branch keeps thirty-one"), so each variant now names its own beats: A punches on the cliff, on its own
# figure landing beside the industry's, and on the thirty-nine; B on the second year, on the leads arriving,
# and on the same comparison. Both close on the seats.
# C is the branch's own first post and runs seven scenes, so its punches are spread over the whole
# argument rather than the feed cut's four: the career named, the work named, the gates, and the two
# figures landing beside each other in scene 6.
AD_HITS = {'A': [(2, 'cliff'), (3, 'thirty'), (4, 'Thirty-nine'), (5, 'Seven')],
           'B': [(2, 'second'), (3, 'leads'), (4, 'thirty'), (5, 'Seven')],
           # (6,'thirty-nine') went with the 39-things claim on 14 November 2026 — the journey scene shows six
           # of them now. Its punch moves to (3,'journey'), the line the scene is built to land on.
           'C': [(2, 'insurance'), (3, 'conversation'), (4, 'stops'), (6, 'contracted'), (7, 'thirty-one'), (8, 'Seven')]}
for v in 'ABC':
    if os.path.exists(f'recruit-ad{v}-timing.json'):
        entries(f'ad{v}', f'recruit-ad{v}-timing.json', f'voad{v}', f'ad-{v.lower()}',
                AD_HITS[v], [], shapes=('q', 'v'))
json.dump(f, open('films.json', 'w'), indent=1)
