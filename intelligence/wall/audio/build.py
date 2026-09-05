#!/usr/bin/env python3
"""Assemble a branch film into one self-contained file.

  ./build.py <film-dir> <shots-dir>

  ./build.py film  ../../scratch/shots     # the 95s explainer
  ./build.py sneak ../../scratch/shots     # the 40s sneak peek

Each film directory holds its own config.py, head.html, scenes.html, player.js
and line01..N.mp3. Everything else — measuring, laying out cues, folding the
assets in — is here, once, because two films that drift apart in how they are
built drift apart in how they look.

A FILM HAS TO STAY ONE FILE. It plays in an iframe on the branch screen and the
hosted copy will not fetch a sibling, so a linked MP3 or PNG is missing in
exactly the two places that matter. Everything is folded in as a data URI.

TIMINGS COME FROM THE RENDERED AUDIO, NEVER FROM ESTIMATES. Each line is
measured by counting MPEG frames, cues are laid out from those measurements with
a fixed beat between lines, and scene boundaries sit just before their first line
so the picture is already there when the voice arrives.
"""
import base64, importlib.util, pathlib, sys


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
    """A wall screenshot as a JPEG data URI, at the size it is actually shown.

    Straight PNG took the explainer to 9.5 MB. Quality-82 at full 1920 took it
    to 2.6 MB, which sounds fine until you watch it load: a single inline script
    carrying that much base64 took THIRTEEN SECONDS to parse in an iframe, and
    for all of it the visitor sat looking at a blank frame having just pressed
    play. A film nobody has the patience to reach is not a film.

    No still is ever displayed above 1600px — the framed ones are 1500 wide and
    the full-bleed ones sit on a stage that is itself scaled down on every
    screen smaller than 1920. So they are stored at the size they are used."""
    from io import BytesIO
    try:
        from PIL import Image
    except ImportError:
        return b64(path, 'image/png')
    im = Image.open(path).convert('RGB')
    if im.width > 1600:
        im = im.resize((1600, round(im.height * 1600 / im.width)), Image.LANCZOS)
    buf = BytesIO()
    im.save(buf, 'JPEG', quality=74, optimize=True, progressive=True)
    return 'data:image/jpeg;base64,' + base64.b64encode(buf.getvalue()).decode()


def main():
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    here = pathlib.Path(__file__).parent
    film = (here / sys.argv[1]).resolve()
    shots = pathlib.Path(sys.argv[2]).resolve()
    if not film.is_dir():
        sys.exit('no such film directory: %s' % film)

    spec = importlib.util.spec_from_file_location('filmcfg', film / 'config.py')
    cfg = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(cfg)

    # ── measure, then lay out ────────────────────────────────────────────
    durs, cues, at = [], [], cfg.LEAD
    for i in range(1, len(cfg.LINES) + 1):
        f = film / ('line%02d.mp3' % i)
        if not f.exists():
            sys.exit('missing %s — run ./render.py in %s first' % (f.name, film.name))
        d = mp3_seconds(f)
        durs.append(d); cues.append(round(at, 2)); at += d + cfg.GAP

    DUR = round(cfg.CHORD * cfg.NCHORDS, 2)
    end = cues[-1] + durs[-1]
    if end > DUR - 0.8:
        sys.exit('narration runs to %.2fs but the bed is %.2fs — trim a line or '
                 'add a chord' % (end, DUR))

    bounds = []
    for idx, (sid, lns) in enumerate(cfg.SCENE_LINES):
        bounds.append((sid, 0.0 if idx == 0 else round(cues[lns[0] - 1] - 0.30, 2)))
    SCENES = [(sid, start, bounds[i + 1][1] if i + 1 < len(bounds) else 99.0)
              for i, (sid, start) in enumerate(bounds)]

    VO = '\n'.join("  '%02d': '%s'," % (i + 1, b64(film / ('line%02d.mp3' % (i + 1)), 'audio/mpeg'))
                   for i in range(len(cfg.LINES)))
    IMGS = '\n'.join("  %s: '%s'," % (k, shot_uri(shots / v))
                     for k, v in cfg.SHOT_FILES.items() if (shots / v).exists())
    mark = shots / getattr(cfg, 'MARK', 'mark.png')
    if mark.exists():
        IMGS += "\n  mark: '%s'," % b64(mark, 'image/png')   # the shield keeps its alpha

    script = ((film / 'player.js').read_text(encoding='utf-8')
        .replace('/*__CUES__*/', ',\n  '.join(
            "{at:%5.2f,key:'%02d'}" % (c, i + 1) for i, c in enumerate(cues)))
        .replace('/*__SCENES__*/', ',\n  '.join("['%s',%6.2f,%6.2f]" % s for s in SCENES))
        .replace('/*__DUR__*/', '%.2f' % DUR)
        .replace('/*__CHORD__*/', '%.2f' % cfg.CHORD))

    out = (here / '..' / cfg.OUT).resolve()
    out.write_text((film / 'head.html').read_text(encoding='utf-8')
                   + (film / 'scenes.html').read_text(encoding='utf-8')
                   + '\n<script>\nconst VO_DATA = {\n' + VO
                   + '\n};\nconst IMGS = {\n' + IMGS + '\n};\n' + script
                   + '\n</script>\n</body>\n</html>\n', encoding='utf-8')

    print('spoken %.2fs · film %.2fs · %d lines · %d scenes · gap %.2fs'
          % (sum(durs), DUR, len(cfg.LINES), len(SCENES), cfg.GAP))
    print('wrote %s  (%.1f MB)' % (out, out.stat().st_size / 1e6))
    for sid, a, b in SCENES:
        print('  %-4s %6.2f → %6.2f' % (sid, a, b))


if __name__ == '__main__':
    main()
