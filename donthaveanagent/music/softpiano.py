#!/usr/bin/env python3
"""Soft piano. Nothing else.

  No hat, no percussion of any kind — a tick every half-beat for two minutes
  is what makes an underscore grating. No constant arpeggio either; notes are
  sparse and slow. Pedal is down throughout, so chords bleed into each other.

  D major, held to the same chord loop as everything else so the films stay
  consistent: D - A - Bm - G, but two bars each rather than one, at a slower
  pulse. Optimistic, steady, and quiet enough to disappear under a voice.
"""
import numpy as np, wave, sys

SR   = 44100
BPM  = 66                            # slow — a chord breathes for two bars
BEAT = 60.0/BPM
BAR  = BEAT*4

def hz(m): return 440.0*2**((m-69)/12.0)

def onepole(x, cut):
    a=np.exp(-2*np.pi*cut/SR); y=np.empty_like(x); p=0.0
    for i in range(len(x)): p=(1-a)*x[i]+a*p; y[i]=p
    return y

def note(f, dur, vel=1.0):
    """A struck string with the pedal down: soft hammer, long tail,
       higher partials dying first, a little inharmonicity for realism."""
    n=int(dur*SR); t=np.arange(n)/SR
    out=np.zeros(n)
    B=0.0004                                        # string stiffness
    for k in range(1,13):
        fk=f*k*np.sqrt(1+B*k*k)
        if fk>13000: break
        amp=(0.70**(k-1))/k**0.45
        dec=3.4/(1+0.42*k)                          # pedal: long fundamental
        out+=amp*np.sin(2*np.pi*fk*t+(k%3))*np.exp(-t/dec)
    # felt hammer, not a hard strike
    ham=np.exp(-t/0.011)*np.sin(2*np.pi*f*2.6*t)*0.055*vel
    body=onepole(out,3200)                          # soft, warm, no glassy top
    return (body+ham)*np.minimum(t/0.006,1)*vel*0.085

#  D          A          Bm         G     — two bars each
PROG=[dict(bass=38, mid=[57,62,66]),
      dict(bass=33, mid=[57,61,64]),
      dict(bass=35, mid=[59,62,66]),
      dict(bass=31, mid=[55,59,62])]
# a sparse melody, not a running arpeggio: which beat, which chord tone
MEL=[(0.0,2),(2.0,1),(5.0,2)]

def render(secs):
    bars=max(4,int(round(secs/(BAR*2)))*2)
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
        put(L,note(hz(ch['bass']),BAR*3.4,0.95),t0,0.92)
        put(R,note(hz(ch['bass']),BAR*3.4,0.95),t0,0.92)
        for j,m in enumerate(ch['mid']):            # the chord, gently rolled
            v=note(hz(m),BAR*3.2,0.72)
            pan=(j/(len(ch['mid'])-1)-0.5)*0.5
            put(L,v,t0+j*0.055,(1-pan)); put(R,v,t0+j*0.055+0.004,(1+pan))
        for beat,idx in MEL:                        # three notes across two bars
            m=ch['mid'][idx]+12
            put(L,note(hz(m),BAR*2.4,0.46),t0+beat*BEAT,0.95)
            put(R,note(hz(m),BAR*2.4,0.46),t0+beat*BEAT+0.005,1.0)
    return L,R,int(total*SR)

def master(L,R,lufs,loop,total_s):
    def middip(x,d=0.40): return x-(onepole(x,3000)-onepole(x,800))*d
    L,R=middip(L),middip(R)
    L,R=onepole(L,7000),onepole(R,7000)             # soft, never brittle
    if not loop:
        n=len(L); t=np.arange(n)/SR
        f=np.minimum(t/2.0,1)*np.clip((total_s-t)/3.5,0,1); L*=f; R*=f
    m=(L+R)/2; rms=np.sqrt((m**2).mean())
    g=10**((lufs-(20*np.log10(max(rms,1e-9))-0.7))/20)
    L,R=L*g,R*g
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
    else:
        L,R=L[:body],R[:body]
    L,R=master(L,R,lufs,loop,body/SR)
    st=np.empty(len(L)*2); st[0::2],st[1::2]=L,R
    with wave.open(out,'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((np.clip(st,-1,1)*32767).astype('<i2').tobytes())
    m=(L+R)/2
    S=np.abs(np.fft.rfft(m[:SR*20]*np.hanning(min(len(m),SR*20)))); f=np.fft.rfftfreq(min(len(m),SR*20),1/SR)
    # how many note events per minute — density is what makes music tiring
    env=np.abs(m); w2=int(0.03*SR)
    sm=np.convolve(env,np.ones(w2)/w2,mode='same')
    on=((sm[1:-1]>sm[:-2])&(sm[1:-1]>=sm[2:])&(sm[1:-1]>sm.mean()*1.8)).sum()
    print(f'{out} · {len(L)/SR:.1f}s · RMS {20*np.log10(np.sqrt((m**2).mean())):.1f} dB · '
          f'centroid {(S*f).sum()/S.sum():.0f} Hz · mid 800-3k {S[(f>800)&(f<3000)].sum()/S.sum():.3f} · '
          f'~{on/(len(m)/SR)*60:.0f} events/min')
