#!/usr/bin/env python3
"""Earthling and Angel 2026: the launch film page (angels/film.html), drawn for render.js.

  python3 build-angelsfilm.py <vox-dir>

<vox-dir> holds 01.mp3 .. 12.mp3 (Andrew Expressive, from the tts-run runner) and lines.json. Each scene lasts its
line plus LEAD before and AIR after. The page keeps render.js's contract: SC, go(n), paused, timer, .scene[data-d],
.act. Anything that must run continuously across the cuts (the snow, the fairy lights) carries the class "grain",
which render.js seeks to the film's own clock rather than the scene's. Every other motion lives inside its scene.
The captions are drawn on the page. No client and no figure from the sheet; the venue is to be advised.
"""
import json, subprocess, sys, html, pathlib, random

VOX = pathlib.Path(sys.argv[1])
ROOT = pathlib.Path(__file__).resolve().parents[2]
LEAD, AIR = 0.35, 0.95
LINES = json.load(open(VOX / 'lines.json'))
dur = lambda f: float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(f)]).decode())
D = [round((LEAD + dur(VOX / f'{i:02d}.mp3') + AIR) * 1000) for i in range(1, len(LINES) + 1)]
json.dump({'lead': LEAD, 'durs': D}, open(VOX / 'timing.json', 'w'))

NAVY, PINE, BERRY, SKY = '#0d3f5e', '#1f5f4a', '#a4243b', '#6fb3d2'
R = random.Random(11)   # seeded: render.js draws each frame on its own, so nothing here may be random per frame

def person(i, c):
    return f'<svg class="pp" style="--i:{i}" viewBox="0 0 24 28"><circle cx="12" cy="8" r="5.2" fill="{c}"/><path d="M2 27c0-6.5 4.5-10.5 10-10.5S22 20.5 22 27z" fill="{c}"/></svg>'

def kw(text, t0=.3, step=.09, cls=''):
    """A headline that lands a word at a time. <br> stays a break; *word* is the berry accent, _word_ the pine."""
    out, k = [], 0
    for line in text.split('|'):
        ws = []
        for w in line.split(' '):
            c = ''
            if w.startswith('*'): w, c = w.strip('*'), ' b'
            elif w.startswith('_'): w, c = w.strip('_'), ' g'
            ws.append(f'<span class="w{c}" style="--t:{t0 + k * step:.2f}s">{html.escape(w)}</span>'); k += 1
        out.append(' '.join(ws))
    return '<br>'.join(out)

def snow(n, dark):
    c = 'rgba(255,255,255,.85)' if dark else 'rgba(111,179,210,.55)'
    f = []
    for i in range(n):
        x, s, d, dl, dx = R.uniform(0, 100), R.uniform(3, 8), R.uniform(9, 17), R.uniform(0, 17), R.uniform(-40, 40)
        f.append(f'<i class="sn grain" style="left:{x:.1f}%;width:{s:.1f}px;height:{s:.1f}px;background:{c};--d:{d:.1f}s;--dl:-{dl:.1f}s;--dx:{dx:.0f}px"></i>')
    return '<div class="snow">' + ''.join(f) + '</div>'

def lights():
    cols = [BERRY, PINE, SKY, '#ffffff']
    path = 'M-20 18 Q 80 52 180 22 T 380 22 T 580 22 T 780 22 T 980 22 T 1180 22 T 1300 22'
    b = []
    for i in range(14):
        x = 40 + i * 90; y = 30 + (12 if i % 2 else 0)
        b.append(f'<circle class="bulb grain" cx="{x}" cy="{y}" r="7" fill="{cols[i % 4]}" style="--dl:-{(i * .37) % 2:.2f}s"/>')
    return f'<svg class="lights" viewBox="0 0 1280 70" preserveAspectRatio="none"><path d="{path}" stroke="#2b3b47" stroke-width="2" fill="none" opacity=".45"/>{"".join(b)}</svg>'

def burst(n, x, y, t, spread=260):
    cols = [BERRY, PINE, SKY, NAVY, '#ffffff']
    p = []
    for i in range(n):
        a, r = R.uniform(0, 6.283), R.uniform(spread * .4, spread)
        import math
        tx, ty, rot = r * math.cos(a), r * math.sin(a) - 60, R.uniform(-540, 540)
        w, h = R.choice([(8, 14), (10, 10), (6, 16)])
        p.append(f'<i class="cf" style="left:{x}%;top:{y}%;width:{w}px;height:{h}px;background:{cols[i % 5]};--tx:{tx:.0f}px;--ty:{ty:.0f}px;--r:{rot:.0f}deg;--t:{t + R.uniform(0, .15):.2f}s"></i>')
    return ''.join(p)


def blobs(dark):
    """Two soft colour fields drifting behind the scene, on the film's own clock."""
    c1, c2 = ('#a4243b55', '#1f5f4a66') if dark else ('#a4243b1f', '#6fb3d233')
    return (f'<i class="blob grain" style="left:-8%;top:-12%;background:radial-gradient({c1},transparent 65%);--d:19s"></i>'
            f'<i class="blob grain" style="right:-10%;bottom:-18%;background:radial-gradient({c2},transparent 65%);--d:23s;--dl:-7s"></i>')

def sparkles(n, dark):
    col = '#ffffff' if dark else '#a4243b'
    out = []
    for i in range(n):
        x, y, s, dl = R.uniform(4, 96), R.uniform(10, 74), R.uniform(10, 22), R.uniform(0, 3)
        out.append(f'<svg class="spk grain" viewBox="0 0 20 20" style="left:{x:.1f}%;top:{y:.1f}%;width:{s:.0f}px;--dl:-{dl:.2f}s"><path d="M10 0C11 7 13 9 20 10C13 11 11 13 10 20C9 13 7 11 0 10C7 9 9 7 10 0Z" fill="{col}"/></svg>')
    return ''.join(out)

def dots(k, n):
    return '<div class="dots">' + ''.join(f'<i class="{"on" if j == k else ("done" if j < k else "")}"></i>' for j in range(n)) + '</div>'

WIPE = '<div class="wipe"><i></i><i></i><i></i></div>'
STAR = '<svg viewBox="0 0 100 100" class="star"><path class="sp" d="M50 4l13 33 36 2-28 23 9 35-30-19-30 19 9-35L1 39l36-2z"/></svg>'
PIN = '<svg viewBox="0 0 24 24" class="ic"><path d="M12 22s7-7.2 7-12a7 7 0 1 0-14 0c0 4.8 7 12 7 12z" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="10" r="2.6" fill="currentColor"/></svg>'

S = []
# 1 · title
orn = ''.join(f'<div class="orn" style="left:{x}%;--l:{l}px;--t:{t}s;--c:{c}"><i></i><b></b></div>'
              for x, l, t, c in [(12, 120, .9, BERRY), (24, 70, 1.15, PINE), (76, 90, 1.05, SKY), (88, 140, .8, BERRY)])
S.append(('navy', f'''{orn}<div class="rays"></div>
<div class="c"><div class="eb up lt" style="--t:.2s">Ricky Rampersad Branch · Christmas 2026</div>
<h1>{kw("It's that time|of year again.", .45, .11)}</h1>{STAR}
<div class="tag up lt" style="--t:2.2s">The whole branch, together</div></div>'''))
# 2 · save the date, venue to be advised
S.append(('light', f'''<div class="c"><div class="eb up" style="--t:.1s">Save the date</div>
<div class="cal pop" style="--t:.35s"><div class="ring2"><i></i><i></i></div><div class="dw">FRIDAY</div><div class="flipn"><div class="old">10</div><div class="dn">11</div></div><div class="dm">DECEMBER 2026</div></div>
<h2>{kw("Christmas Luncheon", 1.3, .12)}</h2><div class="pill up" style="--t:1.8s">with the Earthling and Angel gift exchange</div>
<div class="venue up" style="--t:2.6s">{PIN}<span>Venue: <b>to be advised</b></span></div></div>{burst(22, 50, 30, 1.0, 300)}'''))
# 3 · the circle
ring = ''.join(f'<div class="rn" style="--a:{i*45}deg">{person(i, [NAVY, PINE, BERRY][i % 3])}</div>' for i in range(8))
gifts = ''.join(f'<div class="orb" style="--o:{i * 120}deg"><span></span></div>' for i in range(3))
S.append(('light', f'''<div class="split"><div><div class="eb up" style="--t:.1s">How it works</div>
<h2>{kw("Everyone is someone's *Angel,*|and someone's _Earthling._", .3, .1)}</h2>
<p class="up" style="--t:1.6s">One circle. You give to one person, and someone else gives to you.</p></div>
<div class="ring"><div class="orbit"></div><div class="arrow"></div>{gifts}{ring}<div class="hub pop" style="--t:1.5s">🎁</div></div></div>'''))
# 4 · sign in
S.append(('light', f'''<div class="split"><div><div class="eb up" style="--t:.1s">Step 1 · Join</div>
<h2>{kw("Sign in with your|agent number.", .3, .1)}</h2><p class="up" style="--t:1.2s">Staff: just type your name.</p>
<div class="url up" style="--t:1.6s">rickyrampersadbranch.com/angels</div></div>
<div class="phone fl"><div class="scr"><div class="pbar">Earthling and Angel 2026</div><div class="plab">Agent number or name</div>
<div class="pin"><span class="typ">10024</span><span class="caret"></span></div><div class="pbtn press">Sign in<i class="rip"></i></div>
<div class="pok"><span class="tick">✓</span> Welcome, you're in.</div><div class="psk"><i></i><i></i><i></i></div></div></div>{burst(18, 74, 62, 3.1, 180)}</div>'''))
# 5 · wish list
fields = [('Wish 1', 'A good book', .6), ('Wish 2', 'Scented candles', 1.3), ('Wish 3', 'Coffee beans', 2.0), ('Please avoid', 'Nuts', 2.7)]
form = ''.join(f'<div class="fl2">{a}</div><div class="fi w" style="--t:{t}s">{b}<span class="ok" style="--t:{t + .45}s">✓</span></div>' for a, b, t in fields)
S.append(('light', f'''<div class="split"><div><div class="eb up" style="--t:.1s">Step 2 · Your wish list</div>
<h2>{kw("Three gifts you'd love,|and anything to avoid.", .3, .09)}</h2><p class="up" style="--t:1.3s">Only your Angel sees it.</p></div>
<div class="form fl">{form}<div class="fbtn pop" style="--t:3.4s">Join the exchange</div></div></div>'''))
# 6 · timeline
S.append(('light', f'''<div class="c"><div class="eb up" style="--t:.1s">Friday 20 November</div><h2>{kw("Sign up closes. The draw is done.", .3, .08)}</h2>
<div class="tl"><div class="tlbar"><i></i></div><div class="rider"></div>
<div class="tp" style="left:0%;--t:.6s"><b>Now</b><span>Join and list your wishes</span></div>
<div class="tp" style="left:50%;--t:1.6s"><b>12:00 noon</b><span>Sign up closes</span></div>
<div class="tp hot" style="left:100%;--t:2.8s"><b>2:00 pm</b><span>The draw</span></div></div>
<div class="clock pop" style="--t:.5s"><i class="hh"></i><i class="mh2"></i></div></div>'''))
# 7 · the envelope
S.append(('navy', f'''<div class="split"><div><div class="eb up lt" style="--t:.1s">Step 3 · The draw</div>
<h2 class="lt">{kw("You're told, privately,|who your Earthling is.", .3, .09)}</h2><p class="up lt" style="--t:1.5s">With their wish list. Keep it secret.</p></div>
<div class="env"><div class="eback"></div><div class="mail"><div class="mh">Your Earthling for 2026 (keep it secret)</div><div class="mb"><div class="ms">Your Earthling is</div>
<div class="mn"><span class="blur">Your Colleague</span><span class="lock">🔒</span></div><div class="ml">1. A good book<br>2. Scented candles<br>3. Coffee beans</div></div></div>
<div class="efront"></div><div class="flap"></div><div class="seal">✦</div></div></div>'''))
# 8 · anonymous notes
S.append(('light', f'''<div class="split"><div><div class="eb up" style="--t:.1s">Step 4 · Be an Angel</div>
<h2>{kw("Send anonymous notes|until the luncheon.", .3, .09)}</h2><p class="up" style="--t:1.4s">They'll never guess it's you.</p></div>
<div class="notes"><svg class="plane" viewBox="0 0 24 24"><path d="M2 12 22 3l-6 18-4-7-10-2z" fill="{SKY}"/></svg>
<div class="bub" style="--t:.8s"><small>From your Angel</small>Have a great week. Your Angel is watching!</div>
<div class="bub" style="--t:2.0s"><small>From your Angel</small>Hint: I know you love coffee.</div>
<div class="bub" style="--t:3.2s"><small>From your Angel</small>Only a few days to go!</div></div></div>'''))
# 9 · the gift
S.append(('light', f'''<div class="split"><div><div class="eb up" style="--t:.1s">Step 5 · The gift</div>
<h2>{kw("Up to *TT$300.*|Wrapped and labelled.", .3, .1)}</h2><p class="up" style="--t:1.4s">With your Earthling's name on it.</p></div>
<div class="gift"><div class="glow"></div><div class="box"><div class="rib"></div></div><div class="lid"><div class="bow"><i></i><i></i></div></div>
<div class="tagg">To: my Earthling</div><div class="price pop" style="--t:2.4s"><span class="cnt" data-to="300" data-pre="TT$" data-at="2400">TT$300</span></div>{burst(26, 50, 30, 2.0, 230)}</div></div>'''))
# 10 · the reveal
S.append(('navy', f'''<div class="spot"></div><div class="c"><div class="eb up lt" style="--t:.1s">Friday 11 December · the luncheon</div>
<h2 class="lt">{kw("Gifts exchanged.|Every Angel revealed.", .3, .1)}</h2>
<div class="flip"><div class="fc"><div class="ff">?</div><div class="fb">Your Angel</div></div></div></div>{burst(40, 50, 62, 2.9, 420)}'''))
# 11 · everyone
grid = ''.join(person(i, [NAVY, PINE, BERRY][i % 3]) for i in range(26))
S.append(('light', f'''<div class="c"><div class="eb up" style="--t:.1s">Everyone is invited</div>
<h2>{kw("Every member of staff.|Every active agent.", .3, .1)}</h2><div class="grid">{grid}</div>
<div class="url big pop" style="--t:2.6s"><span>rickyrampersadbranch.com/angels</span></div></div>'''))
# 12 · close
S.append(('navy', f'''<div class="rays"></div><div class="c"><div class="mk pop" style="--t:.2s"><img src="../site-mark.svg" alt=""></div>
<div class="merry up lt" style="--t:.6s">Merry Christmas</div>
<h1>{kw("See you at the luncheon.", .9, .1)}</h1>
<div class="eb up lt" style="--t:1.8s">Join by 12 noon, Friday 20 November · Venue to be advised</div>
<div class="sign up lt" style="--t:2.2s">Ricky Rampersad Branch · Guardian Life of the Caribbean</div></div>{burst(30, 50, 22, .5, 380)}'''))

assert len(S) == len(LINES), (len(S), len(LINES))

CSS = r'''
*{box-sizing:border-box;margin:0}html,body{width:1280px;height:720px;overflow:hidden;background:#faf9f2;font-family:Inter,'Segoe UI',Arial,sans-serif}
.scene{position:absolute;inset:0;opacity:0;visibility:hidden;overflow:hidden}
.scene.act{opacity:1;visibility:visible;animation:sin .7s ease both}@keyframes sin{from{opacity:0}}
.kb{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:74px 80px 150px;animation:kb var(--dur) linear both}
@keyframes kb{from{transform:scale(1.045)}to{transform:scale(1)}}
.navy{background:radial-gradient(120% 90% at 30% 20%,#1a5a82,#0d3f5e 55%,#0a3350)}.light{background:radial-gradient(120% 100% at 80% 0%,#fff,#faf9f2 60%,#f0ece0)}
.c{text-align:center;display:flex;flex-direction:column;align-items:center;gap:16px;position:relative;z-index:2}
.split{display:grid;grid-template-columns:1.05fr .95fr;gap:60px;align-items:center;width:100%;position:relative;z-index:2}
.eb{font-size:16px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:#a4243b}.eb.lt{color:#f3c6cf}
h1{font:800 76px/1.04 'Inter Tight',Inter,Arial;color:#fff;letter-spacing:-.03em}h2{font:800 50px/1.12 'Inter Tight',Inter,Arial;color:#0d3f5e;letter-spacing:-.02em}
h2.lt{color:#fff}p{font-size:24px;color:#2b3b47;margin-top:14px}p.lt{color:#d6e4ee}.b{color:#a4243b}.g{color:#1f5f4a}
.navy h2 .b{color:#ff8fa3}
.w{display:inline-block;opacity:0;animation:wd .6s cubic-bezier(.2,1.3,.4,1) var(--t) both}@keyframes wd{from{opacity:0;transform:translateY(34px) rotate(4deg) scale(.9)}to{opacity:1;transform:none}}
.up{opacity:0;animation:up .7s cubic-bezier(.2,.8,.2,1) var(--t,0s) both}@keyframes up{from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:none}}
.pop{opacity:0;animation:pop .7s cubic-bezier(.2,1.4,.4,1) var(--t,0s) both}@keyframes pop{from{opacity:0;transform:scale(.5)}to{opacity:1;transform:none}}
.fl{animation:flt 4s ease-in-out infinite}@keyframes flt{50%{transform:translateY(-12px) rotate(-.6deg)}}
/* snow and lights: on the film's own clock */
.snow{position:absolute;inset:0;pointer-events:none;z-index:1}
.sn{position:absolute;top:-10px;border-radius:50%;animation:fall var(--d) linear var(--dl) infinite}
@keyframes fall{from{transform:translate(0,-20px)}to{transform:translate(var(--dx),760px)}}
.lights{position:absolute;left:0;top:0;width:100%;height:70px;z-index:3}
.bulb{animation:tw2 2s ease-in-out var(--dl) infinite}@keyframes tw2{50%{opacity:.35}}
/* the cut: three ribbons sweep across as a scene opens */
.wipe{position:absolute;inset:0;z-index:8;pointer-events:none}
.wipe i{position:absolute;top:-20%;bottom:-20%;width:34%;transform:translateX(-140%) skewX(-18deg);animation:wp .95s cubic-bezier(.7,0,.3,1) both}
.wipe i:nth-child(1){background:#a4243b}.wipe i:nth-child(2){background:#1f5f4a;animation-delay:.07s}.wipe i:nth-child(3){background:#fff;animation-delay:.14s;opacity:.9}
@keyframes wp{from{transform:translateX(-140%) skewX(-18deg)}to{transform:translateX(420%) skewX(-18deg)}}
/* confetti */
.cf{position:absolute;z-index:6;opacity:0;border-radius:2px;animation:cf 2.4s cubic-bezier(.15,.7,.3,1) var(--t) both}
@keyframes cf{0%{opacity:1;transform:translate(0,0) rotate(0)}70%{opacity:1}100%{opacity:0;transform:translate(var(--tx),calc(var(--ty) + 260px)) rotate(var(--r))}}
/* 1 */
.star{width:170px;height:170px;filter:drop-shadow(0 10px 34px rgba(255,143,163,.6))}
.sp{fill:#a4243b;stroke:#ff8fa3;stroke-width:2;stroke-dasharray:420;stroke-dashoffset:420;fill-opacity:0;animation:drw 1.4s ease 1.1s both,glw 2.4s ease-in-out 2.5s infinite}
@keyframes drw{60%{stroke-dashoffset:0;fill-opacity:0}to{stroke-dashoffset:0;fill-opacity:1}}@keyframes glw{50%{filter:brightness(1.35)}}
.star{animation:spn 14s linear infinite}@keyframes spn{to{transform:rotate(360deg)}}
.rays{position:absolute;left:50%;top:48%;width:1400px;height:1400px;margin:-700px;background:repeating-conic-gradient(rgba(255,255,255,.07) 0 6deg,transparent 6deg 18deg);animation:spn 40s linear infinite;z-index:0}
.orn{position:absolute;top:0;z-index:2;transform-origin:50% 0;animation:swg 3.4s ease-in-out var(--t) infinite,drop 1s cubic-bezier(.3,1.5,.5,1) var(--t) both}
.orn i{display:block;width:2px;height:var(--l);background:rgba(255,255,255,.5);margin:0 auto}
.orn b{display:block;width:46px;height:46px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff9,var(--c) 45%);box-shadow:0 0 20px var(--c)}
@keyframes swg{50%{transform:rotate(7deg)}0%,100%{transform:rotate(-7deg)}}@keyframes drop{from{translate:0 -260px}to{translate:0 0}}
.tag{font-size:20px;color:#d6e4ee;font-weight:600}
/* 2 */
.cal{background:#fff;border:2px solid #0d3f5e;border-radius:22px;width:210px;margin-top:14px;box-shadow:0 22px 46px rgba(13,63,94,.2);position:relative}
.ring2{position:absolute;top:-14px;left:0;right:0;display:flex;justify-content:space-around}.ring2 i{width:14px;height:28px;border-radius:7px;background:#0d3f5e}
.dw{background:#a4243b;color:#fff;font:800 22px Inter;letter-spacing:.2em;padding:12px;border-radius:20px 20px 0 0}
.flipn{position:relative;height:96px;perspective:600px}.flipn>div{position:absolute;inset:0;font:800 88px/96px 'Inter Tight',Inter;color:#0d3f5e;backface-visibility:hidden}
.old{transform-origin:50% 0;animation:pg .8s ease-in 1s both}@keyframes pg{to{transform:rotateX(-100deg);opacity:0}}
.dn{opacity:0;animation:fo .4s ease 1.5s both}@keyframes fo{to{opacity:1}}
.dm{font:700 16px Inter;color:#5b6670;letter-spacing:.12em;padding:4px 0 16px}
.pill{background:#1f5f4a;color:#fff;font-weight:700;font-size:20px;padding:10px 22px;border-radius:40px}
.venue{display:flex;align-items:center;gap:10px;border:2px dashed #a4243b;color:#0d3f5e;font-size:22px;padding:10px 22px;border-radius:14px;background:#fff}
.venue b{color:#a4243b}.ic{width:26px;height:26px;color:#a4243b;animation:bob 1.2s ease-in-out infinite}@keyframes bob{50%{transform:translateY(-5px)}}
/* 3 */
.ring{position:relative;width:400px;height:400px;justify-self:center}
.orbit{position:absolute;inset:40px;border:3px dashed #c9d6cf;border-radius:50%;animation:spn 20s linear infinite}
.arrow{position:absolute;inset:40px;border-radius:50%;border:5px solid transparent;border-top-color:#a4243b;border-right-color:#a4243b55;animation:spn 3s linear infinite}
.rn{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%) rotate(var(--a)) translateY(-160px) rotate(calc(-1*var(--a)))}
.pp{width:46px;height:54px;display:block}.rn .pp{opacity:0;animation:pop .6s cubic-bezier(.2,1.4,.4,1) calc(.3s + var(--i)*.15s) both}
.orb{position:absolute;inset:0;transform:rotate(var(--o));animation:orbit 6s linear infinite}
@keyframes orbit{from{rotate:0deg}to{rotate:360deg}}
.orb span{position:absolute;left:50%;top:40px;width:20px;height:20px;margin:-10px;border-radius:5px;background:#1f5f4a;box-shadow:inset 0 -3px 0 #174a3a,0 0 0 3px #a4243b33}
.hub{position:absolute;left:50%;top:50%;width:96px;height:96px;margin:-48px;border-radius:50%;background:#fff;box-shadow:0 12px 30px rgba(13,63,94,.18);display:flex;align-items:center;justify-content:center;font-size:46px}
/* 4 */
.phone{justify-self:center;width:300px;height:470px;border-radius:40px;background:#0d3f5e;padding:14px;box-shadow:0 30px 60px rgba(13,63,94,.3)}
.scr{background:#faf9f2;height:100%;border-radius:28px;padding:24px 20px;display:flex;flex-direction:column;gap:12px}
.pbar{font:800 18px Inter;color:#0d3f5e;border-bottom:3px solid #a4243b;padding-bottom:10px}.plab{font:600 14px Inter;color:#0d3f5e;margin-top:10px}
.pin{border:2px solid #7d8890;border-radius:10px;padding:12px;font:600 22px Inter;color:#2b3b47;display:flex;align-items:center}
.typ{display:inline-block;overflow:hidden;white-space:nowrap;width:0;animation:typ 1.2s steps(5) 1s both}@keyframes typ{to{width:3.2em}}
.caret{width:2px;height:24px;background:#0d3f5e;margin-left:2px;animation:bl 1s steps(1) infinite}@keyframes bl{50%{opacity:0}}
.pbtn{position:relative;overflow:hidden;background:#1f5f4a;color:#fff;font:700 18px Inter;text-align:center;padding:13px;border-radius:10px;animation:press .4s ease 2.6s both}@keyframes press{50%{transform:scale(.94)}}
.rip{position:absolute;left:50%;top:50%;width:20px;height:20px;margin:-10px;border-radius:50%;background:#fff6;opacity:0;animation:rp .7s ease 2.65s both}@keyframes rp{0%{opacity:1;transform:scale(0)}to{opacity:0;transform:scale(16)}}
.pok{opacity:0;color:#1f5f4a;font:700 17px Inter;text-align:center;animation:up .5s ease 3.1s both}.tick{display:inline-block;background:#1f5f4a;color:#fff;border-radius:50%;width:22px;height:22px;line-height:22px}
.psk{display:flex;flex-direction:column;gap:9px;margin-top:10px;opacity:0;animation:fo .5s ease 3.5s both}.psk i{height:12px;border-radius:6px;background:#e4e0d4}.psk i:nth-child(2){width:70%}.psk i:nth-child(3){width:85%}
/* 5 */
.form{background:#fff;border:1px solid #e4e0d4;border-radius:18px;padding:22px 26px;box-shadow:0 20px 40px rgba(13,63,94,.12);display:flex;flex-direction:column;gap:6px}
.fl2{font:600 14px Inter;color:#0d3f5e;margin-top:6px}.fi{position:relative;border:2px solid #c9ccc8;border-radius:10px;padding:10px 12px;font:500 19px Inter;color:#2b3b47;min-height:46px}
.fi.w2,.fi.w{opacity:0;animation:fill .6s ease var(--t) both}@keyframes fill{from{opacity:0;transform:translateX(30px)}to{opacity:1;border-color:#1f5f4a}}
.ok{position:absolute;right:10px;top:9px;width:26px;height:26px;border-radius:50%;background:#1f5f4a;color:#fff;font-size:15px;display:flex;align-items:center;justify-content:center;opacity:0;animation:pop .5s cubic-bezier(.2,1.6,.4,1) var(--t) both}
.fbtn{background:#1f5f4a;color:#fff;text-align:center;font:700 18px Inter;padding:12px;border-radius:10px;margin-top:12px}
/* 6 */
.tl{position:relative;width:900px;height:150px;margin-top:40px}.tlbar{position:absolute;left:0;right:0;top:20px;height:6px;background:#e4e0d4;border-radius:3px;overflow:hidden}
.tlbar i{display:block;height:100%;background:linear-gradient(90deg,#1f5f4a,#a4243b);transform-origin:left;animation:grow 2.8s ease .6s both}@keyframes grow{from{transform:scaleX(0)}}
.rider{position:absolute;top:13px;left:0;width:20px;height:20px;margin-left:-10px;border-radius:50%;background:#fff;border:4px solid #a4243b;box-shadow:0 0 0 8px #a4243b22;animation:ride 2.8s ease .6s both;z-index:3}@keyframes ride{from{left:0}to{left:100%}}
.tp{position:absolute;top:0;margin-left:-120px;text-align:center;opacity:0;animation:fo .6s ease var(--t) both;width:240px}
.tp::before{content:'';display:block;width:30px;height:30px;margin:8px auto 14px;border-radius:50%;background:#fff;border:6px solid #1f5f4a}
.tp.hot::before{border-color:#a4243b;background:#a4243b;box-shadow:0 0 0 10px rgba(164,36,59,.15)}
.tp b{display:block;font:800 26px 'Inter Tight',Inter;color:#0d3f5e}.tp span{font-size:18px;color:#5b6670}
.clock{position:absolute;right:-30px;top:-70px;width:90px;height:90px;border-radius:50%;border:6px solid #0d3f5e;background:#fff}
.clock i{position:absolute;left:50%;bottom:50%;width:5px;margin-left:-2.5px;background:#0d3f5e;border-radius:3px;transform-origin:50% 100%}
.hh{height:24px;animation:spn 8s linear infinite}.mh2{height:34px;background:#a4243b!important;animation:spn 1.2s linear infinite}
/* 7 */
.env{position:relative;width:460px;height:400px;justify-self:center}
.eback{position:absolute;left:0;right:0;bottom:0;height:200px;background:#e9e2d0;border-radius:10px}
.efront{position:absolute;left:0;right:0;bottom:0;height:200px;background:linear-gradient(160deg,#f7f2e6,#efe7d3);clip-path:polygon(0 0,50% 55%,100% 0,100% 100%,0 100%);border-radius:10px;z-index:3}
.flap{position:absolute;left:0;right:0;bottom:200px;height:130px;background:#e2d9c3;clip-path:polygon(0 100%,50% 0,100% 100%);transform-origin:50% 100%;animation:flp2 .7s ease .5s both;z-index:4}
@keyframes flp2{to{transform:rotateX(180deg);z-index:0}}
.seal{position:absolute;left:50%;bottom:150px;width:56px;height:56px;margin-left:-28px;border-radius:50%;background:#a4243b;color:#fff;font-size:26px;display:flex;align-items:center;justify-content:center;z-index:5;animation:sealo .4s ease .35s both}@keyframes sealo{to{opacity:0;transform:scale(1.6)}}
.mail{position:absolute;left:30px;right:30px;bottom:20px;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 20px 40px rgba(0,0,0,.25);z-index:2;animation:rise 1s cubic-bezier(.2,.9,.3,1) 1.1s both}
@keyframes rise{from{transform:translateY(80px)}to{transform:translateY(-150px)}}
.mh{background:#0d3f5e;color:#fff;font:700 15px Inter;padding:14px 18px;border-bottom:4px solid #a4243b}.mb{padding:18px}
.ms{color:#5b6670;font-size:15px}.mn{font:800 30px 'Inter Tight',Inter;color:#0d3f5e;margin:6px 0 12px;display:flex;gap:10px;align-items:center}
.blur{filter:blur(9px)}.lock{font-size:24px}.ml{background:#f4f8f6;border-left:4px solid #1f5f4a;padding:10px 14px;font-size:17px;line-height:1.6;color:#2b3b47}
/* 8 */
.notes{position:relative;display:flex;flex-direction:column;gap:18px;justify-self:center;width:440px}
.bub{background:#fff;border-left:5px solid #a4243b;border-radius:4px 18px 18px 18px;padding:14px 18px;font-size:21px;color:#2b3b47;box-shadow:0 14px 30px rgba(13,63,94,.12);opacity:0;animation:bubin .6s cubic-bezier(.2,1.3,.4,1) var(--t) both}
@keyframes bubin{from{opacity:0;transform:translateX(60px) scale(.85)}to{opacity:1;transform:none}}
.bub small{display:block;font:700 13px Inter;letter-spacing:.1em;text-transform:uppercase;color:#a4243b;margin-bottom:4px}
.plane{position:absolute;width:44px;height:44px;left:-120px;top:-40px;animation:fly 4.2s ease-in-out .3s both}
@keyframes fly{0%{transform:translate(-200px,220px) rotate(-20deg);opacity:0}15%{opacity:1}50%{transform:translate(200px,-30px) rotate(10deg)}100%{transform:translate(720px,40px) rotate(20deg);opacity:0}}
/* 9 */
.gift{position:relative;width:320px;height:320px;justify-self:center}
.glow{position:absolute;left:50%;top:55%;width:420px;height:420px;margin:-210px;border-radius:50%;background:radial-gradient(#ffffff,#ffffff00 60%);opacity:0;animation:fo .6s ease 2s both}
.box{position:absolute;left:35px;right:35px;bottom:0;height:190px;background:#1f5f4a;border-radius:10px;animation:shk .5s ease 1s 2 both}
@keyframes shk{25%{transform:rotate(-4deg)}75%{transform:rotate(4deg)}}
.rib{position:absolute;left:50%;top:0;bottom:0;width:34px;margin-left:-17px;background:#a4243b}
.lid{position:absolute;left:18px;right:18px;top:90px;height:56px;background:#174a3a;border-radius:10px;z-index:2;animation:lid 1.1s cubic-bezier(.3,1.3,.5,1) 2s both}
.lid::after{content:'';position:absolute;left:50%;top:0;bottom:0;width:34px;margin-left:-17px;background:#a4243b}
@keyframes lid{0%{transform:none}40%{transform:translateY(-120px) rotate(-18deg)}100%{transform:translateY(-90px) translateX(-40px) rotate(-14deg)}}
.bow{position:absolute;left:50%;top:-30px;margin-left:-40px;width:80px;height:34px;z-index:3}.bow i{position:absolute;top:0;width:40px;height:32px;border:9px solid #a4243b;border-radius:50% 50% 50% 50%}.bow i:last-child{right:0}
.tagg{position:absolute;right:-70px;top:150px;background:#fff;border:2px solid #0d3f5e;border-radius:8px;padding:8px 14px;font:700 17px Inter;color:#0d3f5e;transform:rotate(8deg);z-index:3;animation:sw 2.6s ease-in-out infinite}@keyframes sw{50%{transform:rotate(-2deg)}}
.price{position:absolute;z-index:4;left:-60px;top:20px;background:#a4243b;color:#fff;font:800 28px 'Inter Tight',Inter;border-radius:50%;width:140px;height:140px;display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 10px #a4243b22}
/* 10 */
.spot{position:absolute;left:50%;top:58%;width:900px;height:900px;margin:-450px;background:radial-gradient(#ffffff2e,transparent 55%);animation:fo 1s ease 1.6s both;opacity:0}
.flip{perspective:900px;margin-top:18px}.fc{width:320px;height:180px;position:relative;transform-style:preserve-3d;animation:flp 1s cubic-bezier(.5,0,.3,1.3) 2.2s both}
@keyframes flp{to{transform:rotateY(180deg)}}
.ff,.fb{position:absolute;inset:0;border-radius:18px;display:flex;align-items:center;justify-content:center;backface-visibility:hidden;font:800 40px 'Inter Tight',Inter}
.ff{background:#fff;color:#0d3f5e;font-size:90px}.fb{background:#a4243b;color:#fff;transform:rotateY(180deg);box-shadow:0 0 60px #ff8fa388}
/* 11 */
.grid{display:grid;grid-template-columns:repeat(13,46px);gap:14px 18px;margin-top:10px}.grid .pp{opacity:0;animation:pop .5s cubic-bezier(.2,1.4,.4,1) calc(.5s + var(--i)*.06s) both,hop 1.6s ease-in-out calc(2.4s + var(--i)*.05s) infinite}
@keyframes hop{0%,60%,100%{translate:0 0}30%{translate:0 -10px}}
.url{font:700 22px Inter;color:#1f5f4a;margin-top:18px}.url.big{position:relative;overflow:hidden;background:#0d3f5e;color:#fff;padding:14px 26px;border-radius:12px;font-size:26px}
.url.big::after{content:'';position:absolute;top:0;bottom:0;width:60px;background:linear-gradient(90deg,transparent,#ffffff66,transparent);transform:skewX(-20deg);animation:shine 2.2s ease 3.2s infinite;left:-80px}
@keyframes shine{60%,100%{left:110%}}
/* 12 */
.mk{width:130px;height:130px;background:#fff;border-radius:26px;padding:16px;box-shadow:0 0 0 0 #ffffff55;animation:pop .7s cubic-bezier(.2,1.4,.4,1) .2s both,pulse 2s ease 1s infinite}.mk img{width:100%;height:100%}
@keyframes pulse{70%{box-shadow:0 0 0 26px #ffffff00}}
.merry{font:italic 600 34px Georgia,serif;color:#ff8fa3}.sign{color:#b9cadd;font-size:18px}
#cap{position:absolute;left:0;right:0;bottom:0;min-height:110px;padding-top:48px!important;background:linear-gradient(transparent,rgba(13,63,94,.92) 35%);display:flex;align-items:flex-end;justify-content:center;padding:0 120px 26px;z-index:9}
#cap span{color:#fff;font:600 25px/1.3 Inter;text-align:center;text-shadow:0 2px 6px rgba(0,0,0,.4)}
.blob{position:absolute;width:620px;height:620px;border-radius:50%;z-index:0;animation:drift var(--d) ease-in-out var(--dl,0s) infinite alternate}
@keyframes drift{0%{transform:translate(0,0) scale(1)}50%{transform:translate(160px,90px) scale(1.18)}100%{transform:translate(-60px,160px) scale(.92)}}
.spk{position:absolute;z-index:1;opacity:0;animation:twk 3s ease-in-out var(--dl) infinite}
@keyframes twk{0%,100%{opacity:0;transform:scale(.3) rotate(0)}50%{opacity:.9;transform:scale(1) rotate(90deg)}}
.dots{position:absolute;right:34px;top:86px;z-index:7;display:flex;gap:7px}.dots i{width:9px;height:9px;border-radius:50%;background:#7d889055}
.dots i.done{background:#1f5f4a}.dots i.on{background:#a4243b;width:26px;border-radius:5px;animation:dpulse 1.2s ease-in-out infinite}
@keyframes dpulse{50%{box-shadow:0 0 0 5px #a4243b33}}
.navy .dots i{background:#ffffff40}.navy .dots i.done{background:#9fd3b8}
h1 .w,h2 .w{animation:wd .6s cubic-bezier(.2,1.3,.4,1) var(--t) both,wglow 2.6s ease-in-out calc(var(--t) + 1.2s) 2}
@keyframes wglow{50%{text-shadow:0 0 18px #ff8fa399}}
#bars{position:absolute;left:0;right:0;bottom:0;height:4px;z-index:10;background:#ffffff22}#bars i{display:block;height:100%;background:#a4243b;width:0}
'''

sec = []
for i, ((cls, body), d) in enumerate(zip(S, D)):
    dark = cls == 'navy'
    sec.append(f'<section class="scene {cls}" data-d="{d}" data-cap="{html.escape(LINES[i])}" style="--dur:{d}ms">'
               f'{blobs(dark)}{sparkles(12 if dark else 9, dark)}{snow(30 if dark else 18, dark)}{lights()}<div class="kb">{body}</div>{dots(i, len(S)) if 0 < i < len(S) - 1 else ""}{WIPE if i else ""}</section>')
page = f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Earthling and Angel 2026 · launch film</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Inter+Tight:wght@700;800&display=swap" rel="stylesheet">
<style>{CSS}</style></head><body>{''.join(sec)}<div id="cap"><span></span></div>
<script>
var SC = Array.prototype.slice.call(document.querySelectorAll('.scene')), paused = false, timer = null, cur = -1;
function go(n) {{ SC.forEach(function (s, i) {{ s.classList.toggle('act', i === n); }}); cur = n;
  document.querySelector('#cap span').textContent = SC[n].dataset.cap;
  if (!paused) timer = setTimeout(function () {{ if (n + 1 < SC.length) go(n + 1); }}, +SC[n].dataset.d); }}
if (!window.__RENDER) go(0);
</script></body></html>'''
out = ROOT / 'angels' / 'film.html'
out.write_text(page)
print('wrote', out, 'scenes', len(D), 'total', round(sum(D) / 1000, 1), 's')
