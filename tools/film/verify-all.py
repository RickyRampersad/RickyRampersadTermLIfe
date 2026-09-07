#!/usr/bin/env python3
"""One report across every film: length, loudness, picture-to-narration drift,
   silent scenes, and whether the grain is costing us bitrate."""
import subprocess, json, wave, sys, os
import numpy as np, imageio_ffmpeg
FF = imageio_ffmpeg.get_ffmpeg_exe()
import pathlib
D = str(pathlib.Path(__file__).resolve().parent.parent.parent / 'donthaveanagent') + '/'
cfg = json.load(open('films.json'))
print(f'{"film":24s} {"length":>8} {"LUFS":>7} {"TP":>6} {"MB":>6} {"drift":>7} {"silent":>7}')
for name, c in cfg.items():
    M = D + c['out']
    if not os.path.exists(M): print(f'{c["out"]:24s}  MISSING'); continue
    err = subprocess.run([FF,'-hide_banner','-i',M],capture_output=True,text=True).stderr
    dur = [l for l in err.splitlines() if 'Duration' in l][0].split(',')[0].split('Duration:')[1].strip()
    j = json.loads((lambda x: x[x.rindex('{'):x.rindex('}')+1])(subprocess.run(
        [FF,'-hide_banner','-i',M,'-af','loudnorm=I=-14:TP=-1.5:print_format=json','-f','null','-'],
        capture_output=True,text=True).stderr))
    r = subprocess.run([FF,'-hide_banner','-i',M,'-vf','fps=10,crop=1280:540:0:60,scale=160:68',
                        '-f','rawvideo','-pix_fmt','gray','-'],capture_output=True)
    f = np.frombuffer(r.stdout,dtype=np.uint8).reshape(-1,68,160).astype(float)
    d = np.abs(np.diff(f,axis=0)).mean(axis=(1,2))
    det=[]
    for i in np.argsort(d)[::-1]:
        t=i/10
        if d[i]<2.0: break
        if all(abs(t-c2)>3.0 for c2 in det): det.append(t)
    det=sorted(x for x in det if x>0.5)
    sched=[sum(c['durs'][:i]) for i in range(1,len(c['durs'])+1)]
    drifts=[min(abs(x-s) for x in det) for s in sched] if det else [99]
    drifts.sort()
    drift = drifts[len(drifts)//2]                      # median: immune to blind spots
    subprocess.run([FF,'-y','-i',M,'-ar','44100','-ac','2','_chk.wav'],capture_output=True)
    with wave.open('_chk.wav') as w:
        a=np.frombuffer(w.readframes(w.getnframes()),dtype='<i2').astype(float)/32768
    a=a.reshape(-1,2); SR=44100; st=0; silent=0
    for dd in c['durs']:
        seg=a[int(st*SR):int((st+dd)*SR)]
        if 20*np.log10(max(np.sqrt((seg**2).mean()),1e-9)) < -32: silent+=1
        st+=dd
    mb=os.path.getsize(M)/1e6
    print(f'{c["out"]:24s} {dur:>8} {j["input_i"]:>7} {j["input_tp"]:>6} {mb:6.1f} {drift:6.2f}s {silent:>7}')
