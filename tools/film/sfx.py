#!/usr/bin/env python3
"""No bed. Sound design instead — the thing real productions synthesise anyway.

  · a sub impact under each statement scene
  · a filtered air sweep across each cut
  · a soft tick as items reveal
  · barely-there room tone so the track is never clinically dead
"""
import numpy as np, wave, sys, json

SR = 44100
rng = np.random.default_rng(11)

def lp(x, cut):
    a = np.exp(-2*np.pi*cut/SR); y = np.empty_like(x); p = 0.0
    for i in range(len(x)): p = (1-a)*x[i] + a*p; y[i] = p
    return y

def hp(x, cut):
    a = np.exp(-2*np.pi*cut/SR); y = np.empty_like(x); p = 0.0; px = 0.0
    for i in range(len(x)): p = a*(p + x[i] - px); px = x[i]; y[i] = p
    return y

def impact(dur=1.9, f0=95, f1=33):
    """Sub drop — the weight under a statement."""
    n = int(dur*SR); t = np.arange(n)/SR
    f = f1 + (f0-f1)*np.exp(-t/0.28)
    body = np.sin(2*np.pi*np.cumsum(f)/SR)*np.exp(-t/0.62)
    click = lp(rng.standard_normal(n), 2200)*np.exp(-t/0.045)*0.32
    tail  = lp(rng.standard_normal(n), 380)*np.exp(-t/0.9)*0.09
    return (body*0.9 + click + tail)*np.minimum(t/0.004, 1)

def sweep(dur=0.85, up=True):
    """Air across a cut. Band-passed noise moving through the spectrum."""
    n = int(dur*SR); t = np.arange(n)/SR
    k = t/dur
    nz = rng.standard_normal(n)
    lo = lp(nz, 900)
    hi = hp(lp(nz, 6500), 1800)
    blend = k if up else (1-k)
    env = np.sin(np.pi*k)**1.6
    return (lo*(1-blend) + hi*blend)*env

def tick(dur=0.14):
    n = int(dur*SR); t = np.arange(n)/SR
    return hp(lp(rng.standard_normal(n), 7000), 2600)*np.exp(-t/0.02)

def tone(n):
    """Room tone: a whisper of filtered noise so silence has texture."""
    return lp(rng.standard_normal(n), 480)*0.0016

def build(dur, starts, dark_idx, tick_scenes, out):
    n = int(dur*SR)
    L = tone(n); R = tone(n)
    def put(sig, at, g, pan=0.0):
        s = int(at*SR)
        if s < 0:                       # a cue that starts before frame one
            sig = sig[-s:]; s = 0
        e = min(n, s+len(sig))
        if s >= n or e <= s or len(sig) == 0: return
        L[s:e] += sig[:e-s]*g*(1-pan*0.35); R[s:e] += sig[:e-s]*g*(1+pan*0.35)
    for i, st in enumerate(starts):
        if st <= 0.05: continue
        put(sweep(0.85, up=(i % 2 == 0)), st-0.42, 0.085, (-1)**i * 0.4)
    for i in dark_idx:
        if i < len(starts): put(impact(), starts[i]-0.05, 0.30)
    for st, count, gap in tick_scenes:
        for k in range(count):
            put(tick(), st + 0.75 + k*gap, 0.055, (k%2)*0.5-0.25)
    pk = max(np.abs(L).max(), np.abs(R).max(), 1e-9)
    if pk > 0.85: L, R = L/pk*0.85, R/pk*0.85
    st = np.empty(n*2); st[0::2], st[1::2] = L, R
    with wave.open(out,'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((np.clip(st,-1,1)*32767).astype('<i2').tobytes())
    rms = np.sqrt(((L+R)/2 ** 2).mean()) if False else np.sqrt((((L+R)/2)**2).mean())
    print(f'{out} · {dur:.0f}s · {len(starts)-1} sweeps · {len(dark_idx)} impacts · '
          f'RMS {20*np.log10(max(rms,1e-9)):.1f} dB · peak {20*np.log10(max(np.abs(L).max(),1e-9)):.1f} dB')

if __name__ == '__main__':
    cfg = json.loads(sys.argv[1]); out = sys.argv[2]
    durs = cfg['durs']
    starts = [sum(durs[:i]) for i in range(len(durs)+1)]
    build(cfg['dur'], starts, cfg.get('dark', []), cfg.get('ticks', []), out)
