#!/usr/bin/env python3
"""Voice a film from its script file, and time the scenes from the audio.

    python3 voice-lines.py orphan-lines.json <voxdir> [--changed-only]
                           [--timing orphan-timing.json] [--films films.json --key orphan]

Reads every scene's `line` out of the script, renders it on the film's voice
(edge-tts, en-US-AndrewNeural at -12% unless the file says otherwise), writes
NN.mp3 + NN.vtt + NN.wav (44.1 kHz mono — the mixer reads the WAV), measures
each line, and writes the timing: line length plus the scene's air (1.15 s
unless the scene sets `air`) plus any `extra` the scene asks for.

--changed-only skips a scene whose existing NN.vtt already carries the same
words, so its recording is reused and only the changed lines are re-voiced.

The vox directory lives outside the repository. Network goes through the
agent proxy: HTTPS_PROXY must be set and SSL_CERT_FILE must point at the
proxy's CA bundle. Never disable verification.
"""
import argparse, json, os, pathlib, re, subprocess, sys

ap = argparse.ArgumentParser()
ap.add_argument('lines'); ap.add_argument('vox')
ap.add_argument('--changed-only', action='store_true')
ap.add_argument('--timing'); ap.add_argument('--films'); ap.add_argument('--key')
a = ap.parse_args()

D = json.load(open(a.lines))
VOICE, RATE = D.get('voice', 'en-US-AndrewNeural'), D.get('rate', '-12%')
assert 'Multilingual' not in VOICE, 'never the Multilingual variant'
vox = pathlib.Path(a.vox); vox.mkdir(parents=True, exist_ok=True)
env = dict(os.environ)
env.setdefault('SSL_CERT_FILE', '/root/.ccr/ca-bundle.crt')
proxy = env.get('HTTPS_PROXY') or env.get('https_proxy')


def norm(t):
    return re.sub(r'\s+', ' ', re.sub(r'[^a-z0-9 ]+', ' ', t.lower())).strip()


def vtt_text(p):
    if not p.exists():
        return ''
    out = []
    for ln in p.read_text(encoding='utf-8').splitlines():
        ln = ln.strip()
        if not ln or ln == 'WEBVTT' or ln.isdigit() or '-->' in ln:
            continue
        out.append(ln)
    return ' '.join(out)


def seconds(p):
    r = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration',
                        '-of', 'default=nw=1:nk=1', str(p)], capture_output=True, text=True)
    return float(r.stdout.strip())


durs, voiced, kept = [], 0, 0
for i, sc in enumerate(D['scenes'], 1):
    nn = f'{i:02d}'
    mp3, vtt, wav = vox / f'{nn}.mp3', vox / f'{nn}.vtt', vox / f'{nn}.wav'
    same = a.changed_only and wav.exists() and norm(vtt_text(vtt)) == norm(sc['line'])
    if not same:
        cmd = ['edge-tts', '--voice', VOICE, f'--rate={RATE}', '--text', sc['line'],
               '--write-media', str(mp3), '--write-subtitles', str(vtt)]
        if proxy:
            cmd[1:1] = ['--proxy', proxy]
        subprocess.run(cmd, check=True, env=env)
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(mp3), '-ar', '44100', '-ac', '1', str(wav)], check=True)
        voiced += 1
    else:
        kept += 1
    length = seconds(wav)
    d = round(length + float(sc.get('air', 1.15)) + float(sc.get('extra', 0)), 1)
    durs.append(d)
    print(f'{nn}  {"voiced" if not same else "kept  "}  {length:5.2f}s + air → {d:5.1f}s   {sc["line"][:70]}')

total = round(sum(durs), 1)
print(f'\n{voiced} voiced, {kept} kept · {len(durs)} scenes · {total} s')
if a.timing:
    json.dump({'durs': durs, 'dur': total}, open(a.timing, 'w'), indent=1)
    print('wrote', a.timing)
if a.films and a.key:
    F = json.load(open(a.films)); F[a.key]['durs'] = durs; F[a.key]['dur'] = total
    json.dump(F, open(a.films, 'w'), indent=1)
    print('updated', a.films, a.key)
