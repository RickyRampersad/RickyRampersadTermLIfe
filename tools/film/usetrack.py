#!/usr/bin/env python3
"""Drop in the real track. Give it any audio file and it rebuilds every film's
   bed from it: looped or trimmed to length, mid-range carved so the voice sits
   clear, held at -18 LUFS under narration, with the impacts layered on top.

   usage:  python3 usetrack.py "/path/to/RR Branch theme - 60s.mp3"
"""
import wave, json, subprocess, sys, os
import numpy as np, imageio_ffmpeg
FF = imageio_ffmpeg.get_ffmpeg_exe()
SR = 44100
src = sys.argv[1]
cfg = json.load(open('films.json'))

subprocess.run([FF,'-y','-i',src,'-ar',str(SR),'-ac','2','_track.wav'],capture_output=True)
with wave.open('_track.wav') as w:
    t = np.frombuffer(w.readframes(w.getnframes()),dtype='<i2').astype(float)/32768
t = t.reshape(-1,2).T
t_full = t
print(f'track: {t.shape[1]/SR:.1f}s')

def onepole(x, cut):
    a = np.exp(-2*np.pi*cut/SR); y=np.empty_like(x); p=0.0
    for i in range(len(x)): p=(1-a)*x[i]+a*p; y[i]=p
    return y

def rd(p):
    with wave.open(p) as w:
        a=np.frombuffer(w.readframes(w.getnframes()),dtype='<i2').astype(float)/32768
        ch=w.getnchannels()
    return a.reshape(-1,2).T if ch==2 else np.stack([a,a])

XF = int(1.2*SR)                                  # crossfade when looping
for k, c in cfg.items():
    n = int(c['dur']*SR)
    # Start where the film wants to start. The opening of a five-minute cue is
    # rarely its most lifting minute; 'start' names the second to begin at.
    off = int(c.get('start', 0) * SR)
    t = t_full[:, off:] if off < t_full.shape[1] - SR else t_full
    if t.shape[1] >= n:
        bed = t[:, :n].copy()
    else:                                          # loop with a crossfade
        bed = np.zeros((2,n)); pos = 0; body = t
        while pos < n:
            seg = body[:, :min(body.shape[1], n-pos)]
            if pos and seg.shape[1] > XF:
                f = np.linspace(0,1,XF)
                bed[:, pos:pos+XF] = bed[:, pos:pos+XF]*(1-f) + seg[:, :XF]*f
                bed[:, pos+XF:pos+seg.shape[1]] = seg[:, XF:]
            else:
                bed[:, pos:pos+seg.shape[1]] = seg
            pos += seg.shape[1] - (XF if seg.shape[1] > XF else 0)
    # carve the voice pocket, then set the level
    for ch in (0,1):
        band = onepole(bed[ch],3000) - onepole(bed[ch],800)
        bed[ch] = bed[ch] - band*0.42
    m = bed.mean(axis=0); rms = np.sqrt((m**2).mean())
    bed *= 10**((-18.0 - (20*np.log10(max(rms,1e-9))-0.7))/20)
    sfx = rd(c['sfx']); sfx = np.pad(sfx,((0,0),(0,max(0,n-sfx.shape[1]))))[:, :n]
    mix = bed + sfx*0.85
    pk = np.abs(mix).max()
    if pk > 0.86: mix = mix/pk*0.86
    out = f"bed-{k}.wav"
    st = np.empty(n*2); st[0::2], st[1::2] = mix[0], mix[1]
    with wave.open(out,'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((np.clip(st,-1,1)*32767).astype('<i2').tobytes())
    mm=(mix[0]+mix[1])/2
    print(f'  {out} · {c["dur"]:.0f}s · RMS {20*np.log10(np.sqrt((mm**2).mean())):.1f} dB')
print('\nnow re-encode:  for k in client process agentside agent; do ... mixany.py ... done')
