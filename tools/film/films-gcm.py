#!/usr/bin/env python3
"""Write the group films' entries into films.json from their timing files (16 November 2026 re-cut).

  gcmc2   the group's film, wide 1920x1080, captions in a strip under the picture
  gcmc2v  the group's film, upright 1080x1920 for Reels, Status and Stories, captions over the picture
  gcms2   the staff film, wide 1920x1080

The page is designed at 1280x720 (720x1280 upright) and laid out at zoom 1.5, so render.js is run with RENDER_W and
RENDER_H at the full size. Music: the branch theme from its first second, as the first cut had it. Run after
importvox.py, before sfx.py and usetrack.py."""
import json
f = json.load(open('films.json'))
WIDE = dict(w=1920, h=1080, pic=924, capmode='strip', capsize=44, capwrap=62, capbg='0F2A5E')
TALL = dict(w=1080, h=1920, capmode='over', capsize=50, capwrap=30)

def entries(key, tfile, out, hitlist, shapes):
    t = json.load(open(tfile)); starts = [sum(t['durs'][:i]) for i in range(len(t['durs']))]
    def at(n, word, k=0):
        hits = [s for s, w in t['lines'][n - 1]['words'] if w.lower().strip('.,?:!;').startswith(word.lower())]
        if len(hits) > k: return round(starts[n - 1] + 0.4 + hits[k], 2)
        raise SystemExit(f'{key}: no "{word}" in line {n}')
    hits = [at(*h) for h in hitlist]
    base = dict(durs=t['durs'], dur=t['dur'], vox='vo' + key, start=0, musicgain=0.45, duck=0.35, dark=[], ticks=[], hits=hits)
    for sfx, shape in shapes:
        k = key + sfx
        f[k] = dict(base, **shape, cap=f'cap-{k}', out=f'../../groupclientmanagement/{out[sfx]}', mix=f'{k}-mix.wav',
                    music=f'bed-{k}.wav', sfx=f'sfx-{k}.wav', ass=f'captions-{k}.ass')
    print(f'films.json: {key} {t["dur"]} s · hits {hits}')

entries('gcmc3', 'gcmc3-timing.json', {'': 'new-way.mp4', 'v': 'new-way-phone.mp4'},
        [(3, 'ten'), (5, 'twenty'), (9, 'five'), (10, 'Nothing')], (('', WIDE), ('v', TALL)))
entries('gcms3', 'gcms3-timing.json', {'': 'staff-new-way.mp4'},
        [(4, 'ten'), (7, 'twenty'), (8, 'twenty'), (18, 'test')], (('', WIDE),))
entries('gcmw', 'gcmw-timing.json', {'': 'what-you-see.mp4'},          # what the group sees when it signs in (17 Nov 2026)
        [(2, 'ten'), (8, 'five'), (12, 'fills'), (14, 'keep')], (('', WIDE),))
entries('pens2', 'pens2-timing.json', {'': 'company-pension.mp4'},       # company pensions, without the paperwork (17 Nov 2026)
        [(4, 'send'), (9, 'sixty'), (10, 'exactly'), (12, 'stamp'), (14, 'journey')], (('', WIDE),))
entries('henr1', 'henr1-timing.json', {'': 'health-enrolment.mp4'},      # joining the group health plan (17 Nov 2026)
        [(2, 'link'), (6, 'tick'), (8, 'exactly'), (10, 'reference'), (12, 'journey')], (('', WIDE),))
entries('term1', 'term1-timing.json', {'': 'terminations.mp4'},          # when someone leaves the plan (17 Nov 2026)
        [(2, 'code'), (5, 'Pick'), (7, 'exactly'), (8, 'send'), (11, 'missed')], (('', WIDE),))
entries('gcme1', 'gcme1-timing.json', {'': 'a-year-with-us.mp4'},      # a year with your group, for employers (27 Nov 2026), in the teal
        [(6, 'Monday'), (9, 'statement'), (14, 'never'), (16, 'happen')], (('', dict(WIDE, capbg='0A3350')),))
json.dump(f, open('films.json', 'w'), indent=1)
