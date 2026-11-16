#!/usr/bin/env python3
"""Earthling and Angel 2026: the launch film page (angels/film.html), drawn for render.js.

  python3 build-angelsfilm.py <vox-dir>

<vox-dir> holds 01.mp3 .. 12.mp3 (Andrew Expressive, from the tts-run runner, key "angels"). Each scene lasts its line
plus LEAD before and AIR after. The page keeps render.js's contract: SC, go(n), paused, timer, .scene[data-d], .act.
The captions are drawn on the page, so the mix needs no subtitle filter. No client and no figure from the sheet.
"""
import json, subprocess, sys, html, pathlib

VOX = pathlib.Path(sys.argv[1])
ROOT = pathlib.Path(__file__).resolve().parents[2]
LEAD, AIR = 0.35, 0.95
LINES = json.load(open(VOX / 'lines.json'))
dur = lambda f: float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(f)]).decode())
D = [round((LEAD + dur(VOX / f'{i:02d}.mp3') + AIR) * 1000) for i in range(1, len(LINES) + 1)]
json.dump({'lead': LEAD, 'durs': D}, open(VOX / 'timing.json', 'w'))

def person(i, c):
    return f'<svg class="pp" style="--i:{i}" viewBox="0 0 24 28"><circle cx="12" cy="8" r="5.2" fill="{c}"/><path d="M2 27c0-6.5 4.5-10.5 10-10.5S22 20.5 22 27z" fill="{c}"/></svg>'

STAR = '<svg viewBox="0 0 100 100" class="{cls}"><path d="M50 4l13 33 36 2-28 23 9 35-30-19-30 19 9-35L1 39l36-2z" fill="{f}"/></svg>'

S = []
# 1 title
S.append(('navy', '''<div class="twk">''' + ''.join(f'<i style="left:{x}%;top:{y}%;--d:{d}s"></i>' for x, y, d in [(8,14,0),(22,70,.6),(40,10,1.1),(63,78,.3),(80,18,.9),(92,60,1.4),(14,44,1.8),(72,46,.5),(50,88,1.2)]) + '''</div>
<div class="c"><div class="eb up lt" style="--t:.2s">Ricky Rampersad Branch · Christmas 2026</div><h1 class="up" style="--t:.5s">It's that time<br>of year again.</h1>''' + STAR.format(cls='bigstar pop', f='#a4243b') + '</div>'))
# 2 date
S.append(('light', '''<div class="c"><div class="eb up" style="--t:.1s">Save the date</div>
<div class="date pop" style="--t:.35s"><div class="dw">FRIDAY</div><div class="dn">11</div><div class="dm">DECEMBER 2026</div></div>
<h2 class="up" style="--t:.9s">Christmas Luncheon</h2><div class="pill up" style="--t:1.3s">with the Earthling and Angel gift exchange</div></div>'''))
# 3 the circle
ring = ''.join(f'<div class="rn" style="--a:{i*45}deg">{person(i, ["#0d3f5e","#1f5f4a","#a4243b"][i%3])}</div>' for i in range(8))
S.append(('light', f'''<div class="split"><div><div class="eb up" style="--t:.1s">How it works</div><h2 class="up" style="--t:.3s">Everyone is someone's <span class="b">Angel</span>,<br>and someone's <span class="g">Earthling</span>.</h2>
<p class="up" style="--t:.8s">One circle. You give to one person, and someone else gives to you.</p></div>
<div class="ring"><div class="orbit"></div><div class="arrow"></div>{ring}</div></div>'''))
# 4 sign in
S.append(('light', '''<div class="split"><div><div class="eb up" style="--t:.1s">Step 1 · Join</div><h2 class="up" style="--t:.3s">Sign in with your<br>agent number.</h2><p class="up" style="--t:.7s">Staff: just type your name.</p><div class="url up" style="--t:1s">rickyrampersadbranch.com/angels</div></div>
<div class="phone"><div class="scr"><div class="pbar">Earthling and Angel 2026</div><div class="plab">Agent number or name</div><div class="pin"><span class="typ">10024</span><span class="caret"></span></div><div class="pbtn press">Sign in</div><div class="pok">Welcome, you're in.</div></div></div></div>'''))
# 5 wish list
S.append(('light', '''<div class="split"><div><div class="eb up" style="--t:.1s">Step 2 · Your wish list</div><h2 class="up" style="--t:.3s">Three gifts you'd love,<br>and anything to avoid.</h2><p class="up" style="--t:.7s">Only your Angel sees it.</p></div>
<div class="form"><div class="fl">Wish 1</div><div class="fi w" style="--t:.6s">A good book</div><div class="fl">Wish 2</div><div class="fi w" style="--t:1.3s">Scented candles</div><div class="fl">Wish 3</div><div class="fi w" style="--t:2s">Coffee beans</div><div class="fl">Please avoid</div><div class="fi w" style="--t:2.7s">Nuts</div><div class="fbtn pop" style="--t:3.4s">Join the exchange</div></div></div>'''))
# 6 timeline
S.append(('light', '''<div class="c"><div class="eb up" style="--t:.1s">Friday 20 November</div><h2 class="up" style="--t:.3s">Sign up closes. The draw is done.</h2>
<div class="tl"><div class="tlbar"><i></i></div><div class="tp" style="left:0%;--t:.6s"><b>Now</b><span>Join and list your wishes</span></div><div class="tp" style="left:50%;--t:1.4s"><b>12:00 noon</b><span>Sign up closes</span></div><div class="tp hot" style="left:100%;--t:2.6s"><b>2:00 pm</b><span>The draw</span></div></div></div>'''))
# 7 email
S.append(('navy', '''<div class="split"><div><div class="eb up lt" style="--t:.1s">Step 3 · The draw</div><h2 class="up lt" style="--t:.3s">You're told, privately,<br>who your Earthling is.</h2><p class="up lt" style="--t:.8s">With their wish list. Keep it secret.</p></div>
<div class="mail pop" style="--t:.5s"><div class="mh">Your Earthling for 2026 (keep it secret)</div><div class="mb"><div class="ms">Your Earthling is</div><div class="mn"><span class="blur">Your Colleague</span><span class="lock">🔒</span></div><div class="ml">1. A good book<br>2. Scented candles<br>3. Coffee beans</div></div></div></div>'''))
# 8 notes
S.append(('light', '''<div class="split"><div><div class="eb up" style="--t:.1s">Step 4 · Be an Angel</div><h2 class="up" style="--t:.3s">Send anonymous notes<br>until the luncheon.</h2><p class="up" style="--t:.8s">They'll never know it's you.</p></div>
<div class="notes"><div class="bub" style="--t:.6s"><small>From your Angel</small>Have a great week. Your Angel is watching!</div><div class="bub" style="--t:1.8s"><small>From your Angel</small>Hint: I know you love coffee.</div><div class="bub" style="--t:3s"><small>From your Angel</small>Only a few days to go!</div></div></div>'''))
# 9 gift
S.append(('light', '''<div class="split"><div><div class="eb up" style="--t:.1s">Step 5 · The gift</div><h2 class="up" style="--t:.3s">Up to <span class="b">TT$300</span>.<br>Wrapped and labelled.</h2><p class="up" style="--t:.8s">With your Earthling's name on it.</p></div>
<div class="gift pop" style="--t:.4s"><div class="lid"></div><div class="box"><div class="rib"></div></div><div class="tag up" style="--t:1.2s">To: my Earthling</div><div class="price pop" style="--t:1.6s">TT$300</div></div></div>'''))
# 10 reveal
S.append(('navy', '''<div class="twk">''' + ''.join(f'<i style="left:{x}%;top:{y}%;--d:{d}s"></i>' for x, y, d in [(10,20,0),(30,80,.5),(55,12,1),(85,30,.2),(90,80,1.3),(5,65,.8)]) + '''</div>
<div class="c"><div class="eb up lt" style="--t:.1s">Friday 11 December · the luncheon</div><h2 class="up lt" style="--t:.3s">Gifts exchanged.<br>Every Angel revealed.</h2>
<div class="flip"><div class="fc"><div class="ff">?</div><div class="fb">Your Angel</div></div></div></div>'''))
# 11 everyone
grid = ''.join(person(i, ['#0d3f5e', '#1f5f4a', '#a4243b'][i % 3]) for i in range(26))
S.append(('light', f'''<div class="c"><div class="eb up" style="--t:.1s">Everyone is invited</div><h2 class="up" style="--t:.3s">Every member of staff.<br>Every active agent.</h2><div class="grid">{grid}</div>
<div class="url big pop" style="--t:2.4s">rickyrampersadbranch.com/angels</div></div>'''))
# 12 close
S.append(('navy', '''<div class="c"><img class="mark pop" style="--t:.2s" src="../site-mark.svg" alt=""><h1 class="up lt" style="--t:.6s">See you at the luncheon.</h1><div class="eb up lt" style="--t:1.1s">Join by 12 noon, Friday 20 November</div><div class="sign up lt" style="--t:1.5s">Ricky Rampersad Branch · Guardian Life of the Caribbean</div></div>'''))

assert len(S) == len(LINES), (len(S), len(LINES))

CSS = r'''
*{box-sizing:border-box;margin:0}html,body{width:1280px;height:720px;overflow:hidden;background:#faf9f2;font-family:Inter,'Segoe UI',Arial,sans-serif}
.scene{position:absolute;inset:0;opacity:0;visibility:hidden;display:flex;align-items:center;justify-content:center;padding:60px 80px 130px}
.scene.act{opacity:1;visibility:visible;animation:sin .6s ease both}@keyframes sin{from{opacity:0;transform:scale(1.03)}}
.navy{background:radial-gradient(120% 90% at 30% 20%,#174f74,#0d3f5e 55%,#0b3550)}.light{background:radial-gradient(120% 100% at 80% 0%,#fff,#faf9f2 60%,#f2efe4)}
.c{text-align:center;display:flex;flex-direction:column;align-items:center;gap:16px}
.split{display:grid;grid-template-columns:1.05fr .95fr;gap:60px;align-items:center;width:100%}
.eb{font-size:16px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:#a4243b}.eb.lt{color:#f3c6cf}
h1{font:800 76px/1.02 'Inter Tight',Inter,Arial;color:#fff;letter-spacing:-.03em}h2{font:800 50px/1.1 'Inter Tight',Inter,Arial;color:#0d3f5e;letter-spacing:-.02em}
h2.lt{color:#fff}p{font-size:24px;color:#2b3b47;margin-top:14px}p.lt{color:#d6e4ee}.b{color:#a4243b}.g{color:#1f5f4a}
.up{opacity:0;animation:up .7s cubic-bezier(.2,.8,.2,1) var(--t,0s) both}@keyframes up{from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:none}}
.pop{opacity:0;animation:pop .7s cubic-bezier(.2,1.4,.4,1) var(--t,0s) both}@keyframes pop{from{opacity:0;transform:scale(.6)}to{opacity:1;transform:none}}
.bigstar{width:150px;height:150px;--t:1s;filter:drop-shadow(0 10px 30px rgba(164,36,59,.5))}
.twk i{position:absolute;width:6px;height:6px;border-radius:50%;background:#fff;opacity:.2;animation:tw 2.4s ease-in-out var(--d) infinite}@keyframes tw{50%{opacity:1;transform:scale(1.8)}}
.date{background:#fff;border:2px solid #0d3f5e;border-radius:22px;width:230px;overflow:hidden;box-shadow:0 20px 40px rgba(13,63,94,.18)}
.dw{background:#a4243b;color:#fff;font:800 22px Inter;letter-spacing:.2em;padding:10px}.dn{font:800 110px/1 'Inter Tight',Inter;color:#0d3f5e;padding:10px 0 0}.dm{font:700 16px Inter;color:#5b6670;letter-spacing:.12em;padding:4px 0 16px}
.pill{background:#1f5f4a;color:#fff;font-weight:700;font-size:20px;padding:10px 22px;border-radius:40px}
.ring{position:relative;width:380px;height:380px;justify-self:center}
.orbit{position:absolute;inset:40px;border:3px dashed #c9d6cf;border-radius:50%;animation:spin 20s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}
.arrow{position:absolute;inset:40px;border-radius:50%;border:5px solid transparent;border-top-color:#a4243b;animation:spin 3s linear infinite}
.rn{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%) rotate(var(--a)) translateY(-150px) rotate(calc(-1*var(--a)))}
.pp{width:46px;height:54px;display:block}.rn .pp{opacity:0;animation:pop .6s cubic-bezier(.2,1.4,.4,1) calc(.3s + var(--i)*.15s) both}
.phone{justify-self:center;width:300px;height:470px;border-radius:40px;background:#0d3f5e;padding:14px;box-shadow:0 30px 60px rgba(13,63,94,.3)}
.scr{background:#faf9f2;height:100%;border-radius:28px;padding:24px 20px;display:flex;flex-direction:column;gap:12px}
.pbar{font:800 18px Inter;color:#0d3f5e;border-bottom:3px solid #a4243b;padding-bottom:10px}.plab{font:600 14px Inter;color:#0d3f5e;margin-top:10px}
.pin{border:2px solid #7d8890;border-radius:10px;padding:12px;font:600 22px Inter;color:#2b3b47;display:flex;align-items:center}
.typ{display:inline-block;overflow:hidden;white-space:nowrap;width:0;animation:typ 1.2s steps(5) 1s both}@keyframes typ{to{width:3.2em}}
.caret{width:2px;height:24px;background:#0d3f5e;margin-left:2px;animation:bl 1s steps(1) infinite}@keyframes bl{50%{opacity:0}}
.pbtn{background:#1f5f4a;color:#fff;font:700 18px Inter;text-align:center;padding:13px;border-radius:10px;animation:press .4s ease 2.6s both}@keyframes press{50%{transform:scale(.94);background:#174a3a}}
.pok{opacity:0;color:#1f5f4a;font:700 17px Inter;text-align:center;animation:up .5s ease 3.1s both}
.form{background:#fff;border:1px solid #e4e0d4;border-radius:18px;padding:22px 26px;box-shadow:0 20px 40px rgba(13,63,94,.12);display:flex;flex-direction:column;gap:6px}
.fl{font:600 14px Inter;color:#0d3f5e;margin-top:6px}.fi{border:2px solid #c9ccc8;border-radius:10px;padding:10px 12px;font:500 19px Inter;color:#2b3b47;min-height:46px}
.fi.w{opacity:0;animation:fill .6s ease var(--t) both}@keyframes fill{from{opacity:0;border-color:#c9ccc8}to{opacity:1;border-color:#1f5f4a}}
.fbtn{background:#1f5f4a;color:#fff;text-align:center;font:700 18px Inter;padding:12px;border-radius:10px;margin-top:12px}
.tl{position:relative;width:900px;height:150px;margin-top:40px}.tlbar{position:absolute;left:0;right:0;top:20px;height:6px;background:#e4e0d4;border-radius:3px;overflow:hidden}
.tlbar i{display:block;height:100%;background:linear-gradient(90deg,#1f5f4a,#a4243b);transform-origin:left;animation:grow 2.6s ease .6s both}@keyframes grow{from{transform:scaleX(0)}}
.tp{position:absolute;top:0;margin-left:-120px;text-align:center;opacity:0;animation:fo .6s ease var(--t) both;width:240px}@keyframes fo{to{opacity:1}}
.tp::before{content:'';display:block;width:30px;height:30px;margin:8px auto 14px;border-radius:50%;background:#fff;border:6px solid #1f5f4a}
.tp.hot::before{border-color:#a4243b;background:#a4243b;box-shadow:0 0 0 10px rgba(164,36,59,.15)}
.tp b{display:block;font:800 26px 'Inter Tight',Inter;color:#0d3f5e}.tp span{font-size:18px;color:#5b6670}
.mail{background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 30px 60px rgba(0,0,0,.3);width:440px;justify-self:center}
.mh{background:#0d3f5e;color:#fff;font:700 16px Inter;padding:16px 20px;border-bottom:4px solid #a4243b}.mb{padding:22px}
.ms{color:#5b6670;font-size:16px}.mn{font:800 34px 'Inter Tight',Inter;color:#0d3f5e;margin:6px 0 14px;display:flex;gap:10px;align-items:center}
.blur{filter:blur(9px)}.lock{font-size:26px}.ml{background:#f4f8f6;border-left:4px solid #1f5f4a;padding:12px 16px;font-size:18px;line-height:1.6;color:#2b3b47}
.notes{display:flex;flex-direction:column;gap:18px;justify-self:center;width:440px}
.bub{background:#fff;border-left:5px solid #a4243b;border-radius:4px 18px 18px 18px;padding:14px 18px;font-size:21px;color:#2b3b47;box-shadow:0 14px 30px rgba(13,63,94,.12);opacity:0;animation:up .6s ease var(--t) both}
.bub small{display:block;font:700 13px Inter;letter-spacing:.1em;text-transform:uppercase;color:#a4243b;margin-bottom:4px}
.gift{position:relative;width:300px;height:300px;justify-self:center}
.box{position:absolute;left:30px;right:30px;bottom:0;height:190px;background:#1f5f4a;border-radius:10px}
.rib{position:absolute;left:50%;top:0;bottom:0;width:34px;margin-left:-17px;background:#a4243b}
.lid{position:absolute;left:14px;right:14px;top:70px;height:56px;background:#174a3a;border-radius:10px;z-index:2;animation:lid 1.2s ease 1.5s both}
.lid::after{content:'';position:absolute;left:50%;top:0;bottom:0;width:34px;margin-left:-17px;background:#a4243b}
@keyframes lid{40%{transform:translateY(-14px) rotate(-6deg)}to{transform:none}}
.tag{position:absolute;right:-60px;top:110px;background:#fff;border:2px solid #0d3f5e;border-radius:8px;padding:8px 14px;font:700 17px Inter;color:#0d3f5e;transform:rotate(8deg);z-index:3}
.price{position:absolute;z-index:4;left:-50px;top:10px;background:#a4243b;color:#fff;font:800 26px 'Inter Tight',Inter;padding:0;border-radius:50%;width:140px;height:140px;font-size:28px;display:flex;align-items:center;justify-content:center}
.flip{perspective:900px;margin-top:18px}.fc{width:300px;height:170px;position:relative;transform-style:preserve-3d;animation:flp 1s ease 2s both}
@keyframes flp{to{transform:rotateY(180deg)}}
.ff,.fb{position:absolute;inset:0;border-radius:18px;display:flex;align-items:center;justify-content:center;backface-visibility:hidden;font:800 40px 'Inter Tight',Inter}
.ff{background:#fff;color:#0d3f5e;font-size:90px}.fb{background:#a4243b;color:#fff;transform:rotateY(180deg)}
.grid{display:grid;grid-template-columns:repeat(13,46px);gap:14px 18px;margin-top:10px}.grid .pp{opacity:0;animation:pop .5s cubic-bezier(.2,1.4,.4,1) calc(.5s + var(--i)*.06s) both}
.url{font:700 22px Inter;color:#1f5f4a;margin-top:18px}.url.big{background:#0d3f5e;color:#fff;padding:14px 26px;border-radius:12px;font-size:26px}
.mark{width:120px;height:120px;background:#fff;border-radius:24px;padding:14px}.sign{color:#b9cadd;font-size:18px}
#cap{position:absolute;left:0;right:0;bottom:0;height:110px;background:linear-gradient(transparent,rgba(13,63,94,.92) 35%);display:flex;align-items:flex-end;justify-content:center;padding:0 120px 26px;z-index:9}
#cap span{color:#fff;font:600 25px/1.3 Inter;text-align:center;text-shadow:0 2px 6px rgba(0,0,0,.4)}
'''

sec = []
for i, ((cls, body), d) in enumerate(zip(S, D)):
    sec.append(f'<section class="scene {cls}" data-d="{d}" data-cap="{html.escape(LINES[i])}">{body}</section>')
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
