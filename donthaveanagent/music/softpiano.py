#!/usr/bin/env python3
"""Soft piano — warm strings under it, and a line that climbs.

  Still no percussion of any kind and still sparse. What makes it lift rather
  than merely sit there:

    · open voicings with the ninth added, so chords sound hopeful rather than
      merely correct
    · a melody that ascends across the four-chord phrase and ends higher than
      it began — the shape the ear reads as encouragement
    · a bed of warm strings beneath the piano, the standard way to give a
      piano emotional lift without adding a drum
    · 76 BPM rather than 66: a little forward motion, still unhurried
"""
import numpy as np, wave, sys

SR   = 44100
BPM  = 76
BEAT = 60.0/BPM
BAR  = BEAT*4

def hz(m): return 440.0*2**((m-69)/12.0)

def onepole(x, cut):
    a=np.exp(-2*np.pi*cut/SR); y=np.empty_like(x); p=0.0
    for i in range(len(x)): p=(1-a)*x[i]+a*p; y[i]=p
    return y

def note(f, dur, vel=1.0, bright=3200):
    """Felt hammer, twelve partials, pedal down."""
    n=int(dur*SR); t=np.arange(n)/SR
    out=np.zeros(n); B=0.0004
    for k in range(1,13):
        fk=f*k*np.sqrt(1+B*k*k)
        if fk>13000: break
        out+=(0.70**(k-1))/k**0.45*np.sin(2*np.pi*fk*t+(k%3))*np.exp(-t/(3.4/(1+0.42*k)))
    ham=np.exp(-t/0.011)*np.sin(2*np.pi*f*2.6*t)*0.05*vel
    return (onepole(out,bright)+ham)*np.minimum(t/0.006,1)*vel*0.082

def strings(f, dur, gain):
    """Warm sustained bed — slow swell, long tail, well under the piano."""
    n=int(dur*SR); t=np.arange(n)/SR
    v=np.zeros(n)
    for det in (-0.10,0.0,0.12):
        ph=2*np.pi*(f*(1+det/100))*t
        v+=2*(ph/(2*np.pi)%1)-1
    v/=3
    v=onepole(v,900)
    atk=int(1.5*SR); rel=int(2.2*SR)
    e=np.ones(n)
    k=np.arange(min(atk,n))/max(atk,1); e[:len(k)]=k**2
    if n>rel: e[-rel:]*= (1-np.arange(rel)/rel)**2
    return v*e*gain*(1+0.0015*np.sin(2*np.pi*4.2*t))

#  Dadd9      Asus2/A     Bm11        Gadd9   — open voicings, the ninth added
PROG=[dict(bass=38, mid=[57,62,66,76]),
      dict(bass=33, mid=[57,61,64,71]),
      dict(bass=35, mid=[59,62,66,74]),
      dict(bass=31, mid=[55,59,62,69])]
#  a phrase that climbs across the loop and lands higher than it started
MEL=[[(0.0,78,0.50),(2.0,81,0.42)],
     [(0.0,81,0.50),(2.0,83,0.44)],
     [(0.0,83,0.52),(2.0,86,0.46)],
     [(0.0,86,0.54),(2.0,88,0.50),(3.0,90,0.40)]]

def render(secs):
    bars=max(8,int(round(secs/(BAR*2)))*2)
    total=bars*BAR
    n=int((total+BAR*3)*SR)
    L=np.zeros(n); R=np.zeros(n)
    def put(buf,sig,at,g=1.0):
        s=int(at*SR)
        if s<0: sig=sig[-s:]; s=0
        e=min(n,s+len(sig))
        if s<n and e>s: buf[s:e]+=sig[:e-s]*g
    for c in range(bars//2):
        t0=c*BAR*2; ch=PROG[c%4]
        put(L,note(hz(ch['bass']),BAR*3.4,0.92),t0,0.90)
        put(R,note(hz(ch['bass']),BAR*3.4,0.92),t0,0.90)
        for j,m in enumerate(ch['mid']):
            v=note(hz(m),BAR*3.2,0.66 if j<3 else 0.50)
            pan=(j/(len(ch['mid'])-1)-0.5)*0.5
            put(L,v,t0+j*0.05,1-pan); put(R,v,t0+j*0.05+0.004,1+pan)
        for beat,m,vel in MEL[c%4]:                 # the climbing line
            put(L,note(hz(m),BAR*2.4,vel,3800),t0+beat*BEAT,0.95)
            put(R,note(hz(m),BAR*2.4,vel,3800),t0+beat*BEAT+0.005,1.0)
        for m in (ch['bass']+12, ch['mid'][1]):     # strings hold underneath
            v=strings(hz(m),BAR*2.4,0.019)
            put(L,v,t0); put(R,v,t0+0.006)
    return L,R,int(total*SR)

def master(L,R,lufs,loop,total_s):
    def middip(x,d=0.52): return x-(onepole(x,3000)-onepole(x,800))*d
    L,R=middip(L),middip(R)
    L,R=onepole(L,7600),onepole(R,7600)
    if not loop:
        n=len(L); t=np.arange(n)/SR
        f=np.minimum(t/2.0,1)*np.clip((total_s-t)/3.5,0,1); L*=f; R*=f
    m=(L+R)/2; rms=np.sqrt((m**2).mean())
    L,R=L*10**((lufs-(20*np.log10(max(rms,1e-9))-0.7))/20), R*10**((lufs-(20*np.log10(max(rms,1e-9))-0.7))/20)
    pk=max(np.abs(L).max(),np.abs(R).max(),1e-9)
    if pk>0.78: L,R=L/pk*0.78,R/pk*0.78
    return L,R

if __name__=='__main__':
    secs=float(sys.argv[1]); out=sys.argv[2]
    lufs=float(sys.argv[3]) if len(sys.argv)>3 and not sys.argv[3].startswith('--') else -18.0
    loop='--loop' in sys.argv
    L,R,body=render(secs)
    if loop:
        over=len(L)-body
        if over>0:
            m=min(over,body); L[:m]+=L[body:body+m]; R[:m]+=R[body:body+m]
    L,R=L[:body],R[:body]
    L,R=master(L,R,lufs,loop,body/SR)
    st=np.empty(len(L)*2); st[0::2],st[1::2]=L,R
    with wave.open(out,'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((np.clip(st,-1,1)*32767).astype('<i2').tobytes())
    m=(L+R)/2
    S=np.abs(np.fft.rfft(m[:SR*20]*np.hanning(min(len(m),SR*20)))); f=np.fft.rfftfreq(min(len(m),SR*20),1/SR)
    print(f'{out} · {len(L)/SR:.1f}s · {BPM}bpm · RMS {20*np.log10(np.sqrt((m**2).mean())):.1f} dB · '
          f'centroid {(S*f).sum()/S.sum():.0f} Hz · mid 800-3k {S[(f>800)&(f<3000)].sum()/S.sum():.3f}')
