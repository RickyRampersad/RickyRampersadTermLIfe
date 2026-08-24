#!/usr/bin/env python3
"""Mix vop/NN.wav (Andrew) over the bed, build captions from edge-tts's own
   timings, and encode with the caption strip at -14 LUFS.

   The capture's timeline is measured, not assumed: Playwright writes the webm
   with a nominal frame rate it never achieves, so we detect the film's own
   scene transitions in the raw capture and fit video_t = LEAD + STRETCH*film_t,
   then undo both in the filter chain."""
import wave, glob, os, re, subprocess, sys, json
import numpy as np, imageio_ffmpeg, shutil
# The bundled static build has no libass, so the caption burn silently has no
# filter to call. Prefer a system ffmpeg that reports the subtitles filter.
def _ff():
    for c in (shutil.which('ffmpeg'), '/usr/bin/ffmpeg', imageio_ffmpeg.get_ffmpeg_exe()):
        if not c: continue
        try:
            out = subprocess.run([c,'-hide_banner','-filters'],capture_output=True,text=True).stdout
        except OSError:
            continue
        if re.search(r'(^| )subtitles +V', out, re.M): return c
    raise SystemExit('no ffmpeg with libass — cannot burn captions')
FF = _ff()
import json as _j
CFG   = _j.loads(sys.argv[1])
OUT   = sys.argv[2]
SR    = 44100
DUR   = CFG['dur']
DURS  = CFG['durs']
STARTS = [sum(DURS[:i]) for i in range(len(DURS)+1)]
OFF = 0.4
CAP, VOX, MUSIC = CFG['cap'], CFG['vox'], CFG['music']
ASS = CFG['ass']

def rd(p):
    with wave.open(p) as w:
        a = np.frombuffer(w.readframes(w.getnframes()), dtype='<i2').astype(np.float64)/32768
        ch, sr = w.getnchannels(), w.getframerate()
    a = a.reshape(-1,2).T if ch == 2 else np.stack([a,a])
    if sr != SR:
        t0 = np.arange(a.shape[1])/sr; t1 = np.arange(int(a.shape[1]*SR/sr))/SR
        a = np.stack([np.interp(t1,t0,a[0]), np.interp(t1,t0,a[1])])
    return a

# ── audio ──
n = int(SR*DUR)
music = rd(MUSIC); music = np.pad(music,((0,0),(0,max(0,n-music.shape[1]))))[:, :n]
vox = np.zeros((2,n)); gate = np.zeros(n)
for i, st in enumerate(STARTS, 1):
    p = f'{VOX}/{i:02d}.wav'
    if not os.path.exists(p): continue
    v = rd(p); v = v/max(np.abs(v).max(),1e-9)*0.86
    s = int((st+OFF)*SR); e = min(n, s+v.shape[1])
    if s >= n: break
    seg = v[:, :e-s].copy(); f = int(0.03*SR)
    if seg.shape[1] > 2*f:
        seg[:,:f] *= np.linspace(0,1,f); seg[:,-f:] *= np.linspace(1,0,f)
    vox[:, s:e] += seg; gate[s:e] = 1.0
cur, envd = 0.0, np.zeros(n)
a_c, r_c = 1/int(0.25*SR), 1/int(0.60*SR)
for i in range(n):
    t = gate[i]; cur += (t-cur)*(a_c if t > cur else r_c); envd[i] = cur
MG   = CFG.get('musicgain', 0.42)     # the bed is felt, not heard
DUCK = CFG.get('duck', 0.88)          # and it all but disappears under a line
mix = music*MG*(1-DUCK*envd) + vox
_sp = np.sqrt((music[:, gate>0.5]*MG*(1-DUCK)).mean()**2 + 1e-18)
_gp = np.sqrt((music[:, gate<0.5]*MG).mean()**2 + 1e-18) if (gate<0.5).any() else 1e-9
print(f'music bed: {20*np.log10(max(np.abs(music*MG).max(),1e-9)):.1f} dB peak, '
      f'ducked {20*np.log10(1-DUCK):.1f} dB under speech')
pk = np.abs(mix).max()
if pk > 0.94: mix = mix/pk*0.94
fo = int(2.0*SR); mix[:,-fo:] *= np.linspace(1,0,fo)
stq = np.empty(n*2); stq[0::2], stq[1::2] = mix[0], mix[1]
with wave.open(CFG['mix'],'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((np.clip(stq,-1,1)*32767).astype('<i2').tobytes())

# ── measure the capture's own timeline ──
webm = glob.glob(CAP+'/*.webm')[0]
r = subprocess.run([FF,'-hide_banner','-i',webm,'-vf',
    'fps=10,crop=1280:540:0:60,scale=160:68','-f','rawvideo','-pix_fmt','gray','-'],capture_output=True)
fr = np.frombuffer(r.stdout,dtype=np.uint8).reshape(-1,68,160).astype(float)
d = np.abs(np.diff(fr,axis=0)).mean(axis=(1,2))
det=[]
for i in np.argsort(d)[::-1]:
    t=i/10
    if d[i]<2.0: break
    if all(abs(t-c)>3.0 for c in det): det.append(t)
det = sorted(c for c in det if c > 0.5)
sched = STARTS[1:]
# Two adjacent scenes that look alike can fall under the detection threshold,
# so a detected list is not guaranteed to line up index-for-index with the
# schedule. Fit by consensus instead: every pair of correspondences proposes a
# (LEAD, STRETCH), and the proposal that explains the most transitions wins.
best = None
for i in range(len(det)):
    for j in range(len(sched)):
        for k in range(i+1, len(det)):
            for l in range(j+1, len(sched)):
                if sched[l] == sched[j]: continue
                stretch = (det[k]-det[i]) / (sched[l]-sched[j])
                if not (1.05 <= stretch <= 1.25): continue      # what this recorder does
                lead = det[i] - stretch*sched[j]
                if not (0.5 <= lead <= 4.5): continue
                pairs = [(s_, min(det, key=lambda t: abs(t-(stretch*s_+lead))))
                         for s_ in sched]
                pairs = [p for p in pairs if abs(p[1]-(stretch*p[0]+lead)) < 0.30]
                if len(pairs) < 2: continue
                err = max(abs(p[1]-(stretch*p[0]+lead)) for p in pairs)
                key = (len(pairs), -err)
                if best is None or key > best[0]: best = (key, pairs, stretch, lead)
if best is None:
    raise SystemExit('could not match the capture to the schedule')
pairs = best[1]
# refit on the inliers, twice, so one stray pairing cannot tilt the slope
for _ in range(2):
    A = np.vstack([np.array([p[0] for p in pairs]), np.ones(len(pairs))]).T
    STRETCH, LEAD = np.linalg.lstsq(A, np.array([p[1] for p in pairs]), rcond=None)[0]
    pairs = [(s_, min(det, key=lambda t: abs(t-(STRETCH*s_+LEAD)))) for s_ in sched]
    pairs = [p for p in pairs if abs(p[1]-(STRETCH*p[0]+LEAD)) < 0.30]
res = max(abs(p[1]-(STRETCH*p[0]+LEAD)) for p in pairs)
print(f'capture timeline: video_t = {LEAD:.3f} + {STRETCH:.4f} * film_t '
      f'({len(pairs)} of {len(sched)} transitions matched, residual {res:.2f}s)')
if len(pairs) < len(sched) - 2:
    raise SystemExit(f'only {len(pairs)} of {len(sched)} transitions matched — not encoding')
# Elements that drop in shift each scene's biggest pixel change by a variable
# amount, so scatter rises even when the fit is sound. What matters is that the
# slope is in family and every transition was found; allow more scatter then.
tol = 0.38 if len(pairs) == len(sched) and 1.10 <= STRETCH <= 1.17 else 0.25
if res > tol:
    raise SystemExit(f'timeline fit is unreliable (residual {res:.2f}s > {tol}) — not encoding')

# ── captions ──
def hms(x):
    h=int(x//3600); mi=int(x%3600//60); s=x-h*3600-mi*60
    return f'{h}:{mi:02d}:{s:05.2f}'
cues=[]
for i, st in enumerate(STARTS, 1):
    vp=f'{VOX}/{i:02d}.vtt'
    if not os.path.exists(vp): continue
    for mm in re.finditer(r'(\d\d):(\d\d):(\d\d)[.,](\d+)\s*-->\s*(\d\d):(\d\d):(\d\d)[.,](\d+)\s*\n(.+)',
                          open(vp,encoding='utf-8').read()):
        g=mm.groups()
        a=int(g[0])*3600+int(g[1])*60+int(g[2])+int(g[3])/1000
        b=int(g[4])*3600+int(g[5])*60+int(g[6])+int(g[7])/1000
        cues.append([st+OFF+a, st+OFF+b, g[8].strip()])
esc = lambda t: t.replace('\\','/').replace('{','(').replace('}',')')
def wrap(t, w=58):
    if len(t) <= w: return t
    ws=t.split(); half=len(t)/2; best=None; run=0
    for k,word in enumerate(ws):
        run += len(word)+1
        if best is None or abs(run-half)<best[0]: best=(abs(run-half),k)
    k=best[1]+1
    return ' '.join(ws[:k]) + '\\N' + ' '.join(ws[k:])
lines=[]
for i,(a,b,t) in enumerate(cues):
    nxt = cues[i+1][0] if i+1 < len(cues) else DUR
    lines.append([a, min(b+0.35, nxt-0.02, DUR), wrap(esc(t))])
ass=['[Script Info]','ScriptType: v4.00+','PlayResX: 1280','PlayResY: 720','WrapStyle: 2',
 'ScaledBorderAndShadow: yes','','[V4+ Styles]',
 'Format: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding',
 'Style: Cap,DejaVu Sans,30,&H00ECDFD2,&H00ECDFD2,&H00000000,&H00000000,-1,0,0,0,100,100,0.4,0,1,0,0,2,60,60,26,1',
 '','[Events]',
 'Format: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text']
for a,b,t in lines:
    if b>a: ass.append(f'Dialogue: 0,{hms(a)},{hms(b)},Cap,,0,0,0,,{t}')
open(ASS,'w',encoding='utf-8').write('\n'.join(ass)+'\n')
print(f'captions: {len(lines)} cues, 0 overlaps by construction, last ends {lines[-1][1]:.1f}s')

# ── encode ──
VF = (f'trim=start={LEAD},setpts=(PTS-STARTPTS)/{STRETCH},'
      'scale=1280:720:force_original_aspect_ratio=decrease,'
      'crop=1280:616:0:0,pad=1280:720:0:0:color=0x1B2A44,'
      # the page's film grain is temporal noise the encoder would otherwise
      # pay full price for; this removes the flicker and leaves type sharp
      'hqdn3d=1.2:1.2:6:6,'
      'subtitles=' + ASS + ':fontsdir=/usr/share/fonts')
p1 = subprocess.run([FF,'-hide_banner','-i',CFG['mix'],'-af',
   'loudnorm=I=-14:TP=-2.0:LRA=11:print_format=json','-f','null','-'],capture_output=True,text=True)
j = json.loads(p1.stderr[p1.stderr.rindex('{'):p1.stderr.rindex('}')+1])
af = (f"loudnorm=I=-14:TP=-2.0:LRA=11:measured_I={j['input_i']}:measured_TP={j['input_tp']}"
      f":measured_LRA={j['input_lra']}:measured_thresh={j['input_thresh']}"
      f":offset={j['target_offset']}:linear=true")
r = subprocess.run([FF,'-y','-i',webm,'-i',CFG['mix'],'-map','0:v','-map','1:a',
  '-c:v','libx264','-preset','slow','-crf','22','-pix_fmt','yuv420p','-r','30','-vf',VF,'-af',af,
  '-c:a','aac','-b:a','160k','-ar','44100','-ac','2','-shortest','-movflags','+faststart', OUT],
  capture_output=True,text=True)
if r.returncode: raise SystemExit(r.stderr[-1500:])
print(f'wrote {OUT} · {os.path.getsize(OUT)/1e6:.1f} MB · speech covers {100*gate.mean():.0f}% of runtime')
