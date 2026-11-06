#!/usr/bin/env python3
"""Mix the OFT launch film: Andrew on each scene, the branch's track looped under him and lowered while he speaks.

    python3 mix-oftfilm.py <rendered.mp4> <track> <out.mp4>

The voice is polished (low cut, a touch of warmth and presence, gentle compression) so it reads less
synthetic; the 19-second track is looped with 1.5 s crossfades to the film's length; loudness -14 LUFS.
"""
import json, os, subprocess, sys
HERE = os.path.dirname(os.path.abspath(__file__))
video, track, out = sys.argv[1:4]
T = json.load(open(os.path.join(HERE, 'oftlaunch-timing.json')))
D = [400 + t['clip'] + 1150 for t in T]; D[0] += 500; D[-1] += 3200
start = [sum(D[:i]) for i in range(len(D))]; total = sum(D) / 1000
dur = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', track], capture_output=True, text=True).stdout)
ins, flt = [], []
for i in range(len(D)):
    ins += ['-i', os.path.join(HERE, 'vooftlaunch', f'{i + 1:02d}.wav')]
    flt.append(f'[{i}:a]aresample=48000,aformat=channel_layouts=stereo,adelay={start[i] + 400}|{start[i] + 400}[v{i}]')
k = len(D)
flt.append(''.join(f'[v{i}]' for i in range(k)) + f'amix=inputs={k}:normalize=0,'
           'highpass=f=85,equalizer=f=180:t=q:w=1:g=1.5,equalizer=f=3200:t=q:w=1.2:g=2,equalizer=f=7500:t=q:w=1:g=-1.5,'
           f'acompressor=threshold=0.12:ratio=2.5:attack=8:release=120:makeup=1.3,apad=whole_dur={total}[voice]')
X = 1.5; n = int(total // (dur - X)) + 2
flt.append(f'[{k}:a]aresample=48000,aformat=channel_layouts=stereo[m0]')
for j in range(1, n):
    flt.append(f'[{k + j}:a]aresample=48000,aformat=channel_layouts=stereo[t{j}]')
    flt.append(f'[m{j - 1}][t{j}]acrossfade=d={X}:c1=tri:c2=tri[m{j}]')
flt.append(f'[m{n - 1}]atrim=0:{total},afade=t=in:d=1.2,afade=t=out:st={total - 3.5}:d=3.5,volume=0.32[bed]')
flt.append('[voice]asplit=2[vk][vm]')
flt.append('[bed][vk]sidechaincompress=threshold=0.03:ratio=6:attack=40:release=500[duck]')
flt.append('[duck][vm]amix=inputs=2:normalize=0,loudnorm=I=-14:TP=-1.5:LRA=11[out]')
wav = out + '.wav'
subprocess.run(['ffmpeg', '-y', '-v', 'error'] + ins + ['-i', track] * n + ['-filter_complex', ';'.join(flt), '-map', '[out]', '-ar', '48000', wav], check=True)
subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', video, '-i', wav, '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-crf', '21',
                '-preset', 'medium', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', out], check=True)
os.remove(wav)
print('wrote', out, round(total, 1), 's')
