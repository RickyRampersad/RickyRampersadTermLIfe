#!/usr/bin/env python3
"""Chapter marks for /sneak/, read off the rendered audio.

Every timing in this repository comes from the audio that was actually
rendered, never from an estimate, so a rewritten line cannot silently push
the marks out of step with the film.

    ./chapters.py [gap-seconds]
"""
import json, pathlib, re, subprocess, sys

GAP = float(sys.argv[1]) if len(sys.argv) > 1 else 0.75
HERE = pathlib.Path(__file__).parent


def duration(f):
    out = subprocess.run(['ffmpeg', '-hide_banner', '-i', str(f)],
                         capture_output=True, text=True).stderr
    m = re.search(r'Duration: 00:00:([0-9.]+)', out)
    if not m:
        raise SystemExit(f'no duration for {f}')
    return float(m.group(1))


t, marks = 0.0, []
for L in json.loads((HERE / 'lines.json').read_text()):
    f = HERE / ('line%02d.mp3' % L['n'])
    if not f.exists():
        continue
    marks.append({'n': L['n'], 'start': round(t, 2),
                  'label': L['cap'].replace('\n', ' ')})
    t += duration(f) + GAP

(HERE / 'chapters.json').write_text(json.dumps(marks, indent=1, ensure_ascii=False))
print('  %d marks, %.2fs' % (len(marks), t))
