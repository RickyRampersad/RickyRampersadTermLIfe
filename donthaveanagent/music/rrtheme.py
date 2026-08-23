#!/usr/bin/env python3
"""RR Branch theme.

  Warm, uplifting corporate underscore. D major, 108 BPM, D - A - Bm - G,
  one bar each. Soft analogue pads with a slow swell and overlapping tails,
  a gentle plucked arpeggio on top, light brushed hat keeping time. No drums
  beyond the hat, no bass drop, no build to a climax. Optimistic and steady
  rather than triumphant. Instrumental, loopable, mid-range left for speech.

  usage: rrtheme.py <seconds> <out.wav> [target_lufs] [--loop]
"""
import numpy as np, wave, sys

SR   = 44100
BPM  = 108
BEAT = 60.0/BPM
BAR  = BEAT*4                       # 2.2222s

def hz(m): return 440.0*2**((m-69)/12.0)

def onepole(x, cut):
    a = np.exp(-2*np.pi*cut/SR); y = np.empty_like(x); p = 0.0
    for i in range(len(x)): p = (1-a)*x[i] + a*p; y[i] = p
    return y

def swell_env(n, atk, sus, rel):
    """Slow squared swell in, long squared tail out — tails overlap the next chord."""
    e = np.zeros(n); ai = max(1,int(atk*SR)); si = int(sus*SR); ri = max(1,int(rel*SR))
    k = np.arange(min(ai,n))/ai; e[:len(k)] = k**2
    i = len(k); hold = max(0, min(n, i+si) - i); e[i:i+hold] = 1.0; i += hold
    if i < n:
        j = min(ri, n-i); e[i:i+j] = (1 - np.arange(j)/ri)**2
    return e

#  D        A          Bm         G   —  I  V  vi  IV
PROG = [dict(low=50, mid=[62,66,69]),
        dict(low=45, mid=[61,64,69]),
        dict(low=47, mid=[62,66,71]),
        dict(low=43, mid=[59,62,67])]
PENT = [74,76,78,81,83]             # D pentatonic, an octave above the pads

def pad(f, dur, gain):
    """Analogue-ish pad: slow swell, long tail, one-pole lowpass for warmth."""
    n = int(dur*SR); t = np.arange(n)/SR
    v  = np.sin(2*np.pi*f*t)
    v += 0.42*np.sin(2*np.pi*f*2*t) + 0.17*np.sin(2*np.pi*f*3*t)
    v += 0.30*np.sin(2*np.pi*f*1.004*t)              # slow chorus beat
    v  = onepole(v, 1500)
    return v*swell_env(n, 0.95, BAR*0.55, BAR*1.5)*gain

def pluck(f, dur=1.35, gain=0.075):
    """A plucked string, not a pad note: pick transient, harmonics that die fast."""
    n = int(dur*SR); t = np.arange(n)/SR
    out = np.zeros(n)
    for k in range(1, 9):
        fk = f*k
        if fk > 15000: break
        out += (0.78**(k-1))*np.sin(2*np.pi*fk*t)*np.exp(-t/(0.85/(1+0.6*k)))
    pick = np.random.default_rng(int(f)%9973).standard_normal(n)
    pick = (pick - onepole(pick, 2500))*np.exp(-t/0.008)*0.30
    return (out + pick)*np.minimum(t/0.0025, 1)*gain

def brush(rng, dur=0.17, gain=0.028):
    """Brushed hat — eased in, never a click."""
    n = int(dur*SR); t = np.arange(n)/SR
    nz = rng.standard_normal(n)
    hi = nz - onepole(nz, 5200)
    return hi*np.minimum(t/0.013, 1)*np.exp(-t/0.06)*gain

def render(bars):
    total = bars*BAR
    tail  = BAR*2.5                                   # room for the last tails
    n = int((total+tail)*SR)
    L = np.zeros(n); R = np.zeros(n)
    rng = np.random.default_rng(21)
    def put(buf, sig, at, g=1.0):
        s = int(at*SR)
        if s < 0: sig = sig[-s:]; s = 0
        e = min(n, s+len(sig))
        if s < n and e > s: buf[s:e] += sig[:e-s]*g
    for b in range(bars):
        t0 = b*BAR; ch = PROG[b % 4]
        # steady throughout — no build, no climax
        put(L, pad(hz(ch['low']), BAR*2.6, 0.112), t0)
        put(R, pad(hz(ch['low']), BAR*2.6, 0.112), t0)
        for j, m in enumerate(ch['mid']):
            v = pad(hz(m), BAR*2.6, 0.060)
            pan = (j/(len(ch['mid'])-1) - 0.5)*0.55
            put(L, v, t0, 1-pan); put(R, v, t0, 1+pan)
        for k in range(4):                             # four plucks a bar
            m = PENT[(b*4+k) % len(PENT)]
            at = t0 + k*BEAT
            v = pluck(hz(m))
            pan = (k/3 - 0.5)*0.6
            put(L, v, at, 1-pan); put(R, v, at+0.003, 1+pan)
        for k in range(4):                             # hat on the offbeats
            v = brush(rng)
            put(L, v, t0+k*BEAT+BEAT/2, 0.92); put(R, v, t0+k*BEAT+BEAT/2+0.002, 1.0)
    return L, R, int(total*SR)

def fold_loop(L, R, body_n):
    """Wrap the overhanging tails back to the top so the loop joins itself."""
    over = len(L) - body_n
    if over > 0:
        m = min(over, body_n)
        L[:m] += L[body_n:body_n+m]; R[:m] += R[body_n:body_n+m]
    return L[:body_n], R[:body_n]

def master(L, R, lufs, loop):
    def middip(x, depth=0.55):
        return x - (onepole(x,3000) - onepole(x,800))*depth
    L, R = middip(L), middip(R)
    L, R = onepole(L, 9000), onepole(R, 9000)
    if not loop:                                        # gentle in/out for standalone
        n=len(L); t=np.arange(n)/SR; d=n/SR
        f = np.minimum(t/1.5,1)*np.clip((d-t)/3.0,0,1); L*=f; R*=f
    m=(L+R)/2; rms=np.sqrt((m**2).mean())
    g = 10**((lufs - (20*np.log10(max(rms,1e-9))-0.7))/20)
    L, R = L*g, R*g
    pk = max(np.abs(L).max(), np.abs(R).max(), 1e-9)
    if pk > 0.79: L, R = L/pk*0.79, R/pk*0.79
    return L, R

if __name__ == '__main__':
    secs = float(sys.argv[1]); out = sys.argv[2]
    lufs = float(sys.argv[3]) if len(sys.argv) > 3 and not sys.argv[3].startswith('--') else -18.0
    loop = '--loop' in sys.argv
    bars = max(4, int(round(secs/BAR)))
    L, R, body = render(bars)
    if loop: L, R = fold_loop(L, R, body)
    else:    L, R = L[:body], R[:body]
    L, R = master(L, R, lufs, loop)
    st = np.empty(len(L)*2); st[0::2], st[1::2] = L, R
    with wave.open(out,'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((np.clip(st,-1,1)*32767).astype('<i2').tobytes())
    m=(L+R)/2
    S=np.abs(np.fft.rfft(m[:SR*20]*np.hanning(min(len(m),SR*20)))); f=np.fft.rfftfreq(min(len(m),SR*20),1/SR)
    seam = ''
    if loop:
        h=m[:int(.2*SR)]; tl=m[-int(.2*SR):]
        seam = f' · loop seam {20*np.log10(max(abs(np.sqrt((tl**2).mean())-np.sqrt((h**2).mean())),1e-9)):.0f} dB'
    print(f'{out} · {bars} bars = {len(L)/SR:.1f}s · RMS {20*np.log10(np.sqrt((m**2).mean())):.1f} dB · '
          f'mid 800-3k {S[(f>800)&(f<3000)].sum()/S.sum():.3f}{seam}')
