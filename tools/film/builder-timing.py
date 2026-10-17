#!/usr/bin/env python3
"""Write the measured scene times onto meetings/builder-film.html.

    python3 builder-timing.py

The builder film's page is built by hand, not generated, so nothing else
writes its data-d. voice-lines.py measures each line and puts the durations
in films.json under `builder`; this puts the same numbers on the page, in
scene order, so the picture and the voice agree. The finale keeps its 99999
hold — the recording stops before it matters, and its films.json entry is
the time it is actually on screen.
"""
import io, json, re, sys, pathlib

HERE = pathlib.Path(__file__).resolve().parent
PAGE = HERE.parent.parent / 'meetings' / 'builder-film.html'
durs = json.load(open(HERE / 'films.json'))['builder']['durs']

s = io.open(PAGE, encoding='utf-8').read()
found = re.findall(r'data-d="(\d+)"', s)
if len(found) != len(durs):
    sys.exit('page has %d scenes, films.json has %d durations' % (len(found), len(durs)))

i = [0]
def one(m):
    n = i[0]; i[0] += 1
    # the finale holds until the recording stops
    return m.group(0) if m.group(1) == '99999' else 'data-d="%d"' % round(durs[n] * 1000)

s2 = re.sub(r'data-d="(\d+)"', one, s)
io.open(PAGE, 'w', encoding='utf-8').write(s2)

now = re.findall(r'data-d="(\d+)"', s2)
for n, (d, was) in enumerate(zip(now, found), 1):
    flag = '' if d == was else '  <-'
    print('%02d  %6.1fs  (was %5.1fs)%s' % (n, int(d) / 1000, int(was) / 1000, flag))
print('\n%s  %s s of picture' % (PAGE.name, round(sum(durs), 1)))
