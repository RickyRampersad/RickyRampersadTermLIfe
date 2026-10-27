#!/usr/bin/env python3
"""Write the recruiting film's entries into films.json from the timing files: `recruit` (1280x720) and `recruitv`
(1080x1920) for the full film, and `trailer` / `trailerv` for the 90-second cut. Same voice, captions burned over the
picture in all four, since most of this audience watches muted. Run after importvox.py, before sfx.py and usetrack.py."""
import json, os
f = json.load(open('films.json'))
def entries(key, tfile, vox, out, hitlist, dark):
    t = json.load(open(tfile)); starts = [sum(t['durs'][:i]) for i in range(len(t['durs']))]
    def at(n, word, k=0):
        hits = [s for s, w in t['lines'][n - 1]['words'] if w.lower().strip('.,?:!').startswith(word.lower())]
        if len(hits) > k: return round(starts[n - 1] + 0.4 + hits[k], 2)
        raise SystemExit(f'{key}: no "{word}" in line {n}')
    hits = [at(*h) for h in hitlist]
    base = dict(durs=t['durs'], dur=t['dur'], vox=vox, start=18, musicgain=0.5, duck=0.5, dark=dark, ticks=[], hits=hits, capmode='over')
    f[key] = dict(base, cap=f'cap-{key}', out=f'../../agentmgt/{out}.mp4', mix=f'{key}-mix.wav', music=f'bed-{key}.wav',
                  sfx=f'sfx-{key}.wav', ass=f'captions-{key}.ass', w=1280, h=720, capsize=30, capwrap=52)
    f[key + 'v'] = dict(base, cap=f'cap-{key}v', out=f'../../agentmgt/{out}-story.mp4', mix=f'{key}v-mix.wav', music=f'bed-{key}v.wav',
                        sfx=f'sfx-{key}v.wav', ass=f'captions-{key}v.ass', w=1080, h=1920, capsize=46, capwrap=30)
    print(f'films.json: {key} {t["dur"]} s · hits {hits}')
entries('recruit', 'recruit-timing.json', 'vorecruit', 'recruit',
        [(2, 'Five'), (2, 'Thirty'), (5, 'call'), (7, 'evidence'), (12, 'board'), (16, 'dollars'), (18, 'pace'),
         (11, 'hundred'), (11, 'pays'), (23, 'written'), (25, 'ten'), (14, 'GO', 1), (30, 'open'), (30, 'Twenty')], [3, 32])
if os.path.exists('recruit-trailer-timing.json'):
    entries('trailer', 'recruit-trailer-timing.json', 'votrailer', 'trailer',
            [(2, 'income'), (3, 'zero'), (4, 'coach'), (5, 'Five'), (5, 'Thirty'), (5, 'Five', 1), (6, 'open'), (6, 'Twenty')], [8])
json.dump(f, open('films.json', 'w'), indent=1)
