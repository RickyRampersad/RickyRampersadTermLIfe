#!/usr/bin/env python3
"""Assemble the Branch Intelligence Wall launch film into one self-contained file.

  ./render.py        # narration -> line01..19.mp3
  ./build-film.py    # stills + narration -> ../../film.html

THE FILM HAS TO STAY ONE FILE. It plays in an iframe on the branch screen and
the hosted copy will not fetch a sibling, so a linked MP3 or PNG is missing in
exactly the two places that matter. Everything is folded in as a data URI.

TIMINGS COME FROM THE RENDERED AUDIO, NEVER FROM ESTIMATES. Each line's length
is measured by counting MPEG frames, cues are laid out from those measurements
with a fixed beat between lines, and the scene boundaries sit just before their
first line so the picture is already there when the voice arrives.
"""
import base64, pathlib, sys

HERE = pathlib.Path(__file__).parent
OUT  = HERE.parent.parent / 'film.html'
SHOTS = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else HERE

GAP  = 0.55          # silence after each line
LEAD = 1.10          # before the first word
CHORD = 8.7          # house spec — see CLAUDE.md, do not drift
NCHORDS = 11         # 11 x 8.7 = 95.7s, and 11 lands the progression home on D

LINES = [
    "Every Friday, somebody in this branch built the same reports by hand.",
    "Premium dues. Contracts. Licences.",
    "By Monday morning they were already out of date.",
    "Next week, that stops.",
    "We are launching the Branch Intelligence Wall.",
    "It begins where the money does. Premiums that stopped coming in.",
    "Forty five days. Past the grace period. Early enough that a phone call still works.",
    "At sixty, we write again, and the letter remembers what they told us the first time.",
    "At ninety, we stop asking them to rate us, and start offering ways to keep the cover.",
    "Then the contracts we are holding.",
    "Some are still in our cabinet, and no agent has collected them. That one is ours.",
    "Some an agent collected, and the client has still not signed for.",
    "Every one of them carries a name, and a number of days.",
    "The Act gives the company twenty business days to issue a policy.",
    "After that, the Act is silent. So the clock is ours. We set it, and we show it.",
    "And the licences. Life and general. Every renewal month on one screen.",
    "A licence that lapses is business nobody can write.",
    "Click any bar, and the whole wall holds to it.",
    "This is not a Friday report any more. It is live, and it does not wait.",
]

# scene id -> the 1-based line numbers it covers
SCENE_LINES = [
    ('s1',  [1, 2, 3]),   ('s2',  [4, 5]),      ('s3',  [6, 7]),
    ('s4',  [8]),         ('s5',  [9]),         ('s6',  [10, 11]),
    ('s7',  [12, 13]),    ('s8',  [14, 15]),    ('s9',  [16, 17]),
    ('s10', [18]),        ('s11', [19]),
]

SHOT_FILES = {'w45': 'f-w45.png', 'w60': 'f-w60.png', 'w90': 'f-w90.png',
              'poss': 'f-poss.png', 'dlv': 'f-dlv.png', 'lic': 'f-lic.png',
              'filt': 'f-possfilt.png'}
MARK = 'mark.png'          # the branch shield stays PNG — it needs its alpha


def mp3_seconds(path):
    """Duration by counting MPEG frames — no ffprobe, no dependency."""
    d = path.read_bytes(); i = 0; n = len(d); t = 0.0
    BR = {1: [0,32,40,48,56,64,80,96,112,128,160,192,224,256,320,0],
          0: [0,8,16,24,32,40,48,56,64,80,96,112,128,144,160,0]}
    SR = {3: [44100,48000,32000], 2: [22050,24000,16000], 0: [11025,12000,8000]}
    if d[:3] == b'ID3':
        i = 10 + ((d[6]&0x7f)<<21 | (d[7]&0x7f)<<14 | (d[8]&0x7f)<<7 | (d[9]&0x7f))
    while i + 4 <= n:
        if d[i] != 0xFF or (d[i+1] & 0xE0) != 0xE0: i += 1; continue
        ver = (d[i+1]>>3)&3; layer = (d[i+1]>>1)&3
        if layer != 1: i += 1; continue
        bi = (d[i+2]>>4)&0xF; si = (d[i+2]>>2)&3; pad = (d[i+2]>>1)&1
        if bi in (0,15) or si == 3: i += 1; continue
        mpeg1 = ver == 3
        br = BR[1 if mpeg1 else 0][bi]*1000; sr = SR.get(ver, SR[2])[si]
        if not br or not sr: i += 1; continue
        spf = 1152 if mpeg1 else 576
        flen = int(spf/8*br/sr) + pad
        if flen <= 0: i += 1; continue
        t += spf/sr; i += flen
    return round(t, 2)


def b64(path, mime):
    return 'data:%s;base64,%s' % (mime, base64.b64encode(path.read_bytes()).decode())


def shot_uri(path):
    """A wall screenshot as a JPEG data URI.

    Straight PNG took this film to 9.5 MB — a file nobody waits for over branch
    wifi, for a difference invisible on a screen across a room. Quality 82 puts
    each still near 150 KB and the whole film back under three."""
    from io import BytesIO
    try:
        from PIL import Image
    except ImportError:
        return b64(path, 'image/png')
    im = Image.open(path).convert('RGB')
    buf = BytesIO()
    im.save(buf, 'JPEG', quality=82, optimize=True, progressive=True)
    return 'data:image/jpeg;base64,' + base64.b64encode(buf.getvalue()).decode()


# ── measure, then lay out ─────────────────────────────────────────────────
durs, cues, at = [], [], LEAD
for i in range(1, len(LINES) + 1):
    f = HERE / ('line%02d.mp3' % i)
    if not f.exists():
        sys.exit('missing %s — run ./render.py first' % f.name)
    d = mp3_seconds(f)
    durs.append(d); cues.append(round(at, 2)); at += d + GAP

DUR = round(CHORD * NCHORDS, 2)
end_of_speech = cues[-1] + durs[-1]
if end_of_speech > DUR - 1.0:
    sys.exit('narration runs to %.2fs but the bed is %.2fs — trim a line' % (end_of_speech, DUR))

bounds = []
for idx, (sid, lns) in enumerate(SCENE_LINES):
    start = 0.0 if idx == 0 else round(cues[lns[0] - 1] - 0.30, 2)
    bounds.append((sid, start))
SCENES = []
for idx, (sid, start) in enumerate(bounds):
    end = bounds[idx + 1][1] if idx + 1 < len(bounds) else 99.0
    SCENES.append((sid, start, end))

VO = '\n'.join("  '%02d': '%s'," % (i + 1, b64(HERE / ('line%02d.mp3' % (i + 1)), 'audio/mpeg'))
               for i in range(len(LINES)))
IMGS = '\n'.join("  %s: '%s'," % (k, shot_uri(SHOTS / v))
                 for k, v in SHOT_FILES.items() if (SHOTS / v).exists())
if (SHOTS / MARK).exists():
    IMGS += "\n  mark: '%s'," % b64(SHOTS / MARK, 'image/png')

body = (HERE / 'scenes.html').read_text(encoding='utf-8')
script = (HERE / 'player.js').read_text(encoding='utf-8')
head = (HERE / 'head.html').read_text(encoding='utf-8')

script = (script
    .replace('/*__CUES__*/', ',\n  '.join(
        "{at:%5.2f,key:'%02d'}" % (c, i + 1) for i, c in enumerate(cues)))
    .replace('/*__SCENES__*/', ',\n  '.join(
        "['%s',%6.2f,%6.2f]" % s for s in SCENES))
    .replace('/*__DUR__*/', '%.2f' % DUR)
    .replace('/*__CHORD__*/', '%.2f' % CHORD))

OUT.write_text(head + body + '\n<script>\nconst VO_DATA = {\n' + VO +
               '\n};\nconst IMGS = {\n' + IMGS + '\n};\n' + script +
               '\n</script>\n</body>\n</html>\n', encoding='utf-8')

print('spoken %.2fs · film %.2fs · %d lines · %d scenes' %
      (sum(durs), DUR, len(LINES), len(SCENES)))
print('wrote %s  (%.1f MB)' % (OUT, OUT.stat().st_size / 1e6))
for sid, a, b in SCENES:
    print('  %-4s %6.2f → %6.2f' % (sid, a, b))
