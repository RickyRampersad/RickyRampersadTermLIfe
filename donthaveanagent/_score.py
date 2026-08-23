#!/usr/bin/env python3
"""A written score rather than a drum loop.

Felt piano, warm strings, sub, and a plate reverb — no noise hats, which is
what made the old bed hiss. Slow (76bpm), major-seventh voicings, and an
arrangement that opens sparse, lifts once, and resolves.
"""
import numpy as np, wave, sys

SR = 44100
BPM = 76
BEAT = 60 / BPM
BAR = BEAT * 4

# ── notes ────────────────────────────────────────────────────────────────
def hz(n):                      # midi -> Hz
    return 440.0 * 2 ** ((n - 69) / 12)

def adsr(n, a, d, s, r, sus):
    """attack, decay, sustain-level, release; sus = seconds held."""
    e = np.zeros(n)
    ai, di, si = int(a*SR), int(d*SR), int(sus*SR)
    ri = int(r*SR)
    i = 0
    if ai: e[:ai] = np.linspace(0, 1, ai); i = ai
    if di and i+di <= n: e[i:i+di] = np.linspace(1, s, di); i += di
    hold = max(0, min(n, si) - i)
    if hold: e[i:i+hold] = s; i += hold
    if i < n:
        k = min(ri, n-i)
        e[i:i+k] = np.linspace(s, 0, k)
    return e

def piano(f, dur, vel=1.0):
    """Struck string: harmonics that decay faster the higher they sit, plus a
       touch of inharmonicity so it reads as a real instrument, not an organ."""
    n = int(dur*SR); t = np.arange(n)/SR
    out = np.zeros(n)
    for k in range(1, 13):
        B = 0.0004                                   # string stiffness
        fk = f*k*np.sqrt(1 + B*k*k)
        if fk > 16000: break
        amp = vel * (0.72 ** (k-1)) / k**0.4
        decay = 2.6 / (1 + 0.55*k)                   # highs die first
        out += amp*np.sin(2*np.pi*fk*t + (k%3))*np.exp(-t/decay)
    hammer = np.exp(-t/0.006)*np.sin(2*np.pi*f*3.1*t)*0.10*vel
    env = np.minimum(t/0.004, 1)
    return (out + hammer)*env*0.30

def strings(f, dur, vel=1.0):
    """Three slightly detuned saws, low-passed, with a slow swell."""
    n = int(dur*SR); t = np.arange(n)/SR
    out = np.zeros(n)
    for det in (-0.13, 0.0, 0.15):
        ph = 2*np.pi*(f*(1+det/100))*t
        saw = 2*(ph/(2*np.pi) % 1) - 1               # naive saw
        out += saw
    out /= 3
    # one-pole low pass that opens as the note blooms
    cut = 700 + 900*np.minimum(t/1.6, 1)
    a = np.exp(-2*np.pi*cut/SR); y = np.zeros(n); prev = 0.0
    for i in range(n):
        prev = (1-a[i])*out[i] + a[i]*prev; y[i] = prev
    vib = 1 + 0.0016*np.sin(2*np.pi*4.6*t)
    return y*adsr(n, 1.1, 0.7, 0.72, 1.6, max(0.1, dur-2.9))*vel*0.045*vib

def sub(f, dur, vel=1.0):
    n = int(dur*SR); t = np.arange(n)/SR
    s = np.sin(2*np.pi*f*t) + 0.18*np.sin(4*np.pi*f*t)
    return s*adsr(n, 0.05, 0.5, 0.55, 0.9, max(0.1, dur-1.4))*vel*0.16

def bell(f, dur, vel=1.0):
    n = int(dur*SR); t = np.arange(n)/SR
    o = (np.sin(2*np.pi*f*t) + 0.5*np.sin(2*np.pi*f*2.76*t) +
         0.25*np.sin(2*np.pi*f*5.4*t))
    return o*np.exp(-t/1.5)*np.minimum(t/0.003,1)*vel*0.05

# ── plate reverb: allpass diffusers into damped comb filters ──────────────
def reverb(x, mix=0.30, decay=2.6):
    def allpass(sig, delay, g):
        d = int(delay*SR); out = np.zeros_like(sig); buf = np.zeros(d)
        idx = 0
        for i in range(len(sig)):
            b = buf[idx]; v = sig[i] + (-g)*b
            out[i] = b + g*v; buf[idx] = v
            idx = (idx+1) % d
        return out
    def comb(sig, delay, damp):
        d = int(delay*SR); out = np.zeros_like(sig); buf = np.zeros(d)
        g = 10 ** (-3*delay/decay); idx = 0; store = 0.0
        for i in range(len(sig)):
            b = buf[idx]; out[i] = b
            store = b*(1-damp) + store*damp
            buf[idx] = sig[i] + store*g
            idx = (idx+1) % d
        return out
    w = x.copy()
    for dl, g in ((0.0047, 0.7), (0.0363, 0.7), (0.0127, 0.7)):
        w = allpass(w, dl, g)
    tail = np.zeros_like(w)
    for dl in (0.0297, 0.0371, 0.0411, 0.0437):
        tail += comb(w, dl, 0.35)
    tail /= 4
    return x*(1-mix) + tail*mix

# ── the piece ────────────────────────────────────────────────────────────
# Fmaj7 – Am7 – Gsus2 – Cmaj7 : warm, unresolved, never triumphant
PROG = [
    dict(root=41, pad=[53,57,60,64], arp=[65,69,72,76]),   # Fmaj7
    dict(root=45, pad=[57,60,64,67], arp=[69,72,76,79]),   # Am7
    dict(root=43, pad=[55,59,62,67], arp=[67,71,74,79]),   # Gsus2/9
    dict(root=48, pad=[52,55,59,64], arp=[64,67,71,76]),   # Cmaj7
]

def render(total):
    n = int(total*SR)
    L = np.zeros(n); R = np.zeros(n)
    def place(buf, sig, at, gain=1.0, pan=0.0):
        s = int(at*SR); e = min(n, s+len(sig))
        if s >= n or e <= s: return
        buf[s:e] += sig[:e-s]*gain
    bars = int(total/BAR)+2
    for b in range(bars):
        t0 = b*BAR
        if t0 >= total: break
        ch = PROG[b % 4]
        # arrangement: pad from the top, piano after two bars, sub after four,
        # a bell at each lift, and everything thins out at the end
        into = t0/total
        pad_g  = 0.85 if into > 0.02 else 0.5
        pno_g  = 0.0 if b < 1 else (1.0 if into < 0.86 else 0.55)
        sub_g  = 0.0 if b < 2 else (1.0 if into < 0.90 else 0.4)
        for m in ch['pad'][1:]:
            v = strings(hz(m), BAR+1.6)
            pan = ((m % 12)/12 - 0.5)*0.5
            place(L, v, t0, pad_g*(1-pan*0.5)); place(R, v, t0, pad_g*(1+pan*0.5))
        if sub_g:
            v = sub(hz(ch['root']), BAR+0.4, 0.9)
            place(L, v, t0, sub_g); place(R, v, t0, sub_g)
        if pno_g:
            # a rolling figure, not a chord stab
            fig = [0, 2, 1, 3, 2, 1]
            for k, step in enumerate(fig):
                at = t0 + k*(BAR/6)
                if at >= total: break
                m = ch['arp'][step]
                vel = 0.95 if k in (0, 3) else 0.62
                v = piano(hz(m), 2.4, vel)
                pan = (k/len(fig) - 0.5)*0.6
                place(L, v, at, pno_g*(1-pan*0.45)); place(R, v, at, pno_g*(1+pan*0.45))
        if b % 8 == 4:
            v = bell(hz(ch['arp'][0]+12), 3.0)
            place(L, v, t0, 0.8); place(R, v, t0+0.02, 0.8)
    return L, R

def master(L, R, total):
    n = len(L)
    L = reverb(L, mix=0.32); R = reverb(R, mix=0.32)
    # gentle high roll-off so the bed never fights the voice's sibilance
    def lp(x, cut=7000):
        a = np.exp(-2*np.pi*cut/SR); y = np.zeros_like(x); p = 0.0
        for i in range(len(x)):
            p = (1-a)*x[i] + a*p; y[i] = p
        return y
    def hp(x, cut=95):
        a = np.exp(-2*np.pi*cut/SR); y = np.zeros_like(x); p = 0.0; prevx = 0.0
        for i in range(len(x)):
            p = a*(p + x[i] - prevx); prevx = x[i]; y[i] = p
        return y
    L, R = hp(lp(L)), hp(lp(R))
    L = np.tanh(L*0.85)/0.85; R = np.tanh(R*0.85)/0.85       # a whisker of warmth, not compression
    t = np.arange(n)/SR
    fade = np.minimum(t/3.0, 1)*np.clip((total-t)/4.0, 0, 1)
    L *= fade; R *= fade
    def shift(x, k):
        out = np.zeros_like(x)
        if k > 0 and k < len(x): out[k:] = x[:len(x)-k]
        return out
    d = int(0.011*SR)
    R = 0.86*R + 0.14*shift(R, d)
    L = 0.86*L + 0.14*shift(L, d//2)
    pk = max(np.abs(L).max(), np.abs(R).max(), 1e-9)
    L, R = L/pk*0.5, R/pk*0.5
    return L, R

if __name__ == '__main__':
    total = float(sys.argv[1]); out = sys.argv[2]
    L, R = render(total)
    L, R = master(L, R, total)
    st = np.empty(len(L)*2); st[0::2], st[1::2] = L, R
    with wave.open(out, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((np.clip(st, -1, 1)*32767).astype('<i2').tobytes())
    m = (L+R)/2
    S = np.abs(np.fft.rfft(m[:SR*20]*np.hanning(min(len(m), SR*20))))
    f = np.fft.rfftfreq(min(len(m), SR*20), 1/SR)
    rms = np.sqrt((m**2).mean())
    print(f'{out} · {total:.0f}s · RMS {20*np.log10(rms):.1f} dB · '
          f'crest {np.abs(m).max()/rms:.1f} · centroid {(S*f).sum()/S.sum():.0f} Hz · '
          f'HF>4k {S[f>4000].sum()/S.sum():.3f}')
