#!/usr/bin/env python3
"""Recover each caption mark's TRUE on-screen time from the recorded video.

The recorder logs wall-clock mark times (timeline.json), but the screen
recorder's encoder falls behind on longer films, so what the viewer sees can
lag those times by several seconds. record-demo.mjs therefore paints a 10px
sync dot (red->green->blue, advancing on every mark) in the bottom-left
corner; this script reads the dot back out of the video and writes
demo/timeline-video.json — the times the soundtrack should actually use."""
import json, pathlib, subprocess
import numpy as np

HERE = pathlib.Path(__file__).parent
DEMO = HERE / 'demo'
import sys
WHICH = sys.argv[1] if len(sys.argv) > 1 else 'demo'      # 'demo' | 'story'
SRC = DEMO / ('querypal-%s.webm' % WHICH)
MARKS_IN = DEMO / ('timeline.json' if WHICH == 'demo' else 'story-timeline.json')
MARKS_OUT = DEMO / ('timeline-video.json' if WHICH == 'demo' else 'story-timeline-video.json')
FPS = 20

dur = float(subprocess.run(
    ['/usr/bin/ffprobe', '-v', 'error', '-show_entries', 'format=duration',
     '-of', 'csv=p=0', str(SRC)], capture_output=True, text=True).stdout.strip())

raw = subprocess.run(
    ['/usr/bin/ffmpeg', '-i', str(SRC), '-vf', f'crop=10:10:2:788,fps={FPS}',
     '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'],
    capture_output=True).stdout
frames = np.frombuffer(raw, dtype=np.uint8).reshape(-1, 10, 10, 3).astype(float)
mean = frames[:, 2:8, 2:8, :].mean(axis=(1, 2))          # center of the dot

def cls(px):                                             # dominant pure channel
    r, g, b = px
    if r > 150 and g < 110 and b < 110: return 0
    if g > 150 and r < 110 and b < 110: return 1
    if b > 150 and r < 110 and g < 110: return 2
    return -1                                            # no dot on screen

times, last = [], -1
for i, m in enumerate(mean):
    s = cls(m)
    if s >= 0 and s != last:
        times.append(round(i / FPS, 3))
        last = s

marks = json.load(open(MARKS_IN))
want = len(marks) - 1                                    # the 'end' mark has no dot
out = {'duration': round(dur, 3), 'marks': times}
json.dump(out, open(MARKS_OUT, 'w'), indent=1)
status = 'OK' if len(times) == want else f'MISMATCH (want {want})'
print(f'{len(times)} marks decoded from video, {status}; duration {dur:.1f}s')
for i, t in enumerate(times):
    wall = marks[i]['t'] / 1000
    print(f'  {i:2}  video {t:7.2f}s  wall {wall:7.2f}s  lag {t - wall:+5.2f}s  {marks[i]["text"][:44]}')
