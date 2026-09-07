#!/usr/bin/env python3
"""Re-narrate one film on the house voice and re-time its scenes to the new read.

    python3 revoice.py <key> <old-vox-dir> <new-vox-dir> <film.html> [--rate=-12%] [--dry]

  · the line for each scene is read back out of the old NN.vtt cues, so the
    words stay exactly what was approved — only the voice changes
  · every line is rendered with en-US-AndrewNeural (never the Multilingual
    variant — see CLAUDE.md), then converted to the 44.1 kHz mono WAV the
    mixer reads
  · each scene keeps the air it had (data-d minus the old line), floored at
    1.2 s, and data-d is rewritten in place, in scene order; the finale's
    99999 hold is left alone
  · films.json gets the new durs, a dur that keeps the same finale hold, and
    the tick cues re-anchored to the scene they belonged to

It does not record or mix — that is record.js and mixany.py, run alone on
the machine, once the page is re-timed.
"""
import json, math, os, pathlib, re, subprocess, sys

HERE = pathlib.Path(__file__).resolve().parent
VOICE = 'en-US-AndrewNeural'
FF = '/usr/bin/ffmpeg'

def vtt_text(p):
    """The sentence cues of an edge-tts VTT, joined back into the line."""
    txt = pathlib.Path(p).read_text(encoding='utf-8')
    parts = []
    for m in re.finditer(r'-->\s*\d\d:\d\d:\d\d[.,]\d+\s*\n((?:.+\n?)+?)(?:\n|$)', txt):
        parts.append(' '.join(l.strip() for l in m.group(1).splitlines() if l.strip()))
    return ' '.join(parts).strip()

def wav_dur(p):
    out = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration',
                          '-of', 'csv=p=0', str(p)], capture_output=True, text=True).stdout.strip()
    return float(out)

def synth(text, mp3, vtt, rate):
    for attempt in range(4):
        r = subprocess.run(['edge-tts', '--voice', VOICE, f'--rate={rate}', '--text', text,
                            '--write-media', str(mp3), '--write-subtitles', str(vtt)],
                           capture_output=True, text=True, timeout=120)
        if r.returncode == 0 and os.path.exists(mp3) and os.path.getsize(mp3) > 1000:
            return
    raise SystemExit(f'edge-tts failed for: {text[:60]}…\n{r.stderr[-400:]}')

def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    opts = dict(a[2:].split('=', 1) if '=' in a else (a[2:], True) for a in sys.argv[1:] if a.startswith('--'))
    key, old, new, html = args[0], pathlib.Path(args[1]), pathlib.Path(args[2]), pathlib.Path(args[3])
    rate = opts.get('rate', '-12%'); dry = bool(opts.get('dry'))
    films = json.load(open(HERE / 'films.json'))
    cfg = films[key]
    src = html.read_text(encoding='utf-8')

    dds = [int(x) for x in re.findall(r'data-d="(\d+)"', src)]
    scenes = [d for d in dds if d != 99999]
    n_lines = len(sorted(old.glob('*.vtt')))
    new.mkdir(exist_ok=True)

    old_durs, new_durs, texts = [], [], []
    for i in range(1, n_lines + 1):
        vtt = old / f'{i:02d}.vtt'
        text = vtt_text(vtt)
        if not text:
            raise SystemExit(f'no text recovered from {vtt}')
        texts.append(text)
        old_durs.append(wav_dur(old / f'{i:02d}.wav'))
        if dry:
            continue
        mp3, nvtt, wav = new / f'{i:02d}.mp3', new / f'{i:02d}.vtt', new / f'{i:02d}.wav'
        if not (wav.exists() and nvtt.exists()):
            synth(text, mp3, nvtt, rate)
            subprocess.run([FF, '-y', '-loglevel', 'error', '-i', str(mp3), '-ar', '44100', '-ac', '1',
                            '-c:a', 'pcm_s16le', str(wav)], check=True)
        new_durs.append(wav_dur(wav))
        print(f'{i:02d}  {old_durs[-1]:5.2f}s → {new_durs[-1]:5.2f}s  {text[:70]}')
    if dry:
        for i, t in enumerate(texts, 1): print(f'{i:02d} {old_durs[i-1]:5.2f}s  {t}')
        return

    # re-time: every scene keeps the air it had around the old line
    if len(scenes) > len(new_durs):
        raise SystemExit(f'{len(scenes)} timed scenes but only {len(new_durs)} lines')
    new_dd = []
    for i, d in enumerate(scenes):
        air = max(1.2, d / 1000 - old_durs[i])
        new_dd.append(int(math.ceil((new_durs[i] + air) * 10) * 100))     # ms, to a tenth
    # write them back in order, leaving 99999 alone
    it = iter(new_dd)
    def sub(m):
        return m.group(0) if m.group(1) == '99999' else f'data-d="{next(it)}"'
    out = re.sub(r'data-d="(\d+)"', sub, src)
    assert out != src or new_dd == scenes, 'nothing was rewritten'
    html.write_text(out, encoding='utf-8')

    old_sum = sum(cfg['durs']); new_durs_s = [d / 1000 for d in new_dd]
    # films.json may carry more entries than the page times: a trailing entry
    # is the finale's slot, and it moves with the line spoken over it
    for i in range(len(scenes), len(cfg['durs'])):
        air = max(1.2, cfg['durs'][i] - old_durs[i]) if i < len(old_durs) else cfg['durs'][i]
        new_durs_s.append(math.ceil((new_durs[i] + air) * 10) / 10 if i < len(new_durs) else cfg['durs'][i])
    hold = round(cfg['dur'] - old_sum, 2)                 # the finale's share, kept
    if len(new_durs) > len(cfg['durs']):                  # a line spoken over the hold
        k = len(cfg['durs']); hold = round(hold - old_durs[k] + new_durs[k], 2)
    old_starts = [sum(cfg['durs'][:i]) for i in range(len(cfg['durs']) + 1)]
    new_starts = [sum(new_durs_s[:i]) for i in range(len(new_durs_s) + 1)]
    ticks = []
    for t, count, gap in cfg.get('ticks', []):
        k = max(i for i, s in enumerate(old_starts) if s <= t + 1e-6)
        ticks.append([round(new_starts[k] + (t - old_starts[k]), 2), count, gap])
    cfg['durs'] = new_durs_s
    cfg['dur'] = round(sum(new_durs_s) + hold, 2)
    if ticks: cfg['ticks'] = ticks
    cfg['vox'] = new.name
    json.dump(films, open(HERE / 'films.json', 'w'), indent=1)
    print(f'\n{key}: {len(scenes)} scenes re-timed · {sum(cfg["durs"]):.1f}s + {hold:.1f}s hold = {cfg["dur"]:.1f}s '
          f'(was {old_sum + hold:.1f}s) · films.json updated · vox={new.name}')

if __name__ == '__main__':
    main()
