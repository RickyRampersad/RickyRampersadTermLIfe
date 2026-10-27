#!/usr/bin/env python3
"""Write the recruiting film's two entries into films.json from recruit-timing.json: `recruit` (1280x720, for the
pages) and `recruitv` (1080x1920, for Reels and Stories). Same voice, same scenes, same timing; captions burned over
the picture in both, since most of this audience watches muted. Run after importvox.py, before sfx.py and usetrack.py."""
import json
t = json.load(open('recruit-timing.json')); f = json.load(open('films.json'))
starts = [sum(t['durs'][:i]) for i in range(len(t['durs']))]
def at(n, word, k=0):  # the second a counter lands, for the punch under it; the k-th match
    hits = [s for s, w in t['lines'][n - 1]['words'] if w.lower().strip('.,?:!').startswith(word.lower())]
    if len(hits) > k: return round(starts[n - 1] + 0.4 + hits[k], 2)
    raise SystemExit(f'no "{word}" in line {n}')
hits = [at(3, 'Twenty'), at(3, 'Thirty'), at(5, 'board'), at(7, 'dollars'), at(8, 'pace'), at(10, 'balance'), at(16, 'hundred'), at(16, 'pays'), at(20, 'GO', 1), at(24, 'open'), at(24, 'Twenty')]
base = dict(durs=t['durs'], dur=t['dur'], vox='vorecruit', start=18, musicgain=0.5, duck=0.5,
            dark=[3, 25], ticks=[], hits=hits, capmode='over')
f['recruit'] = dict(base, cap='cap-recruit', out='../../agentmgt/recruit.mp4', mix='recruit-mix.wav', music='bed-recruit.wav',
                    sfx='sfx-recruit.wav', ass='captions-recruit.ass', w=1280, h=720, capsize=30, capwrap=52)
f['recruitv'] = dict(base, cap='cap-recruitv', out='../../agentmgt/recruit-story.mp4', mix='recruitv-mix.wav', music='bed-recruitv.wav',
                     sfx='sfx-recruitv.wav', ass='captions-recruitv.ass', w=1080, h=1920, capsize=46, capwrap=30)
json.dump(f, open('films.json', 'w'), indent=1)
print('films.json: recruit', t['dur'], 's · hits', hits)
