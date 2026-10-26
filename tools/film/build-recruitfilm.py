#!/usr/bin/env python3
"""Draw the recruiting film's page from its lines and its voice timing.

    python3 build-recruitfilm.py [recruit-timing.json]

Writes ../../agentmgt/film.html: sixteen scenes, one per spoken line, in the recruiting page's own look
(onyx lifted off black, wine, Playfair and Inter, the wine shield). Every reveal that answers a word lands on
that word: the timing file (from importvox.py --timing) carries each word's start, and `{{AT:n:word}}` in the
template becomes that word's millisecond inside scene n, plus the 0.4 s the mixer leads the voice by.

The page keeps render.js's contract: `SC`, `go(n)`, `paused`, `timer`, `.act` on the live scene, `.out` on the
one zooming away (cleared at 720 ms), `.cnt` counters with data-to and data-at, `#ctrl` and `#poster` hidden
while rendering. The same page renders both cuts: 1280x720 for the pages, 1080x1920 (RENDER_W/RENDER_H) for
Reels and Stories, through the portrait rules at the foot of the stylesheet.
"""
import base64, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
OUT = os.path.join(ROOT, 'agentmgt', 'film.html')
LINES = json.load(open(os.path.join(HERE, 'recruit-lines.json')))
timing = None
tp = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, 'recruit-timing.json')
if os.path.exists(tp):
    timing = json.load(open(tp))
OFF = 400  # ms: mixany.py starts each line 0.4 s into its scene

# ── fonts, embedded so a render never depends on the network and frame one has the real face ──
FONTDIR = os.environ.get('RECRUIT_FONTS', os.path.join(HERE, 'fonts'))
def face(fam, fn, weight, style='normal'):
    p = os.path.join(FONTDIR, fn)
    if not os.path.exists(p):
        return f"/* {fn} missing: {fam} falls back */"
    b = base64.b64encode(open(p, 'rb').read()).decode()
    return (f"@font-face{{font-family:'{fam}';font-weight:{weight};font-style:{style};"
            f"src:url(data:font/woff2;base64,{b}) format('woff2')}}")
FONTS = '\n'.join([
    face('PlayfairF', 'PlayfairDisplay-var.woff2', '400 900'),
    face('PlayfairF', 'PlayfairDisplay-i700.woff2', '700', 'italic'),
    face('InterF', 'Inter-var.woff2', '100 900'),
])

QR = re.search(r'd="([^"]+)"', open(os.path.join(ROOT, 'agentmgt', 'qr.svg')).read()).group(1)

def dur(n):
    if timing: return int(round(timing['durs'][n - 1] * 1000))
    return int(round((len(LINES[n - 1].split()) / 2.6 + 1.6) * 1000))   # an estimate until the voice is in

def at(n, word, k=0):
    """ms inside scene n at which `word` (a prefix, case-blind) is spoken; the k-th match."""
    if not timing:
        words = LINES[n - 1].split(); est = dur(n) - 1600
        hits = [i for i, w in enumerate(words) if w.lower().strip('.,?:!').startswith(word.lower())]
        i = hits[k] if len(hits) > k else 0
        return OFF + int(est * i / max(1, len(words)))
    ws = timing['lines'][n - 1]['words']
    hits = [s for s, t in ws if t.lower().strip('.,?:!').startswith(word.lower())]
    if len(hits) <= k:
        sys.exit(f'scene {n}: no word starting "{word}" (#{k}) in: {LINES[n - 1]}')
    return OFF + int(hits[k] * 1000)

def words(text, t0=0, step=80, cls=''):
    """A headline split to words for the kinetic entrance; the sentence stays one accessible name."""
    out = []
    for i, w in enumerate(text.split(' ')):
        out.append(f'<span class="w{(" " + cls) if cls else ""}"><i style="--i:{i};--t0:{t0}ms">{w}</i></span>')
    return f'<span aria-label="{text}">' + ' '.join(out) + '</span>'

MARK = '''<svg viewBox="6 3 76 82" class="mk" aria-hidden="true"><use href="#shield"/></svg>'''

def scene(n, kind, body, extra=''):
    return f'<section class="scene {kind}" data-d="{dur(n)}" data-n="{n}" {extra}>\n{body}\n<div class="streak"></div>\n</section>'

S = []

# 1 · the hook
S.append(scene(1, 's-hook', f'''
<div class="full center">
  <p class="eye in" style="--t0:300ms">A question</p>
  <h1 class="h xl">{words("Good at what you do?", 500)}<br><em class="wine">{words("Stuck where you are?", at(1,"stuck") - 200)}</em></h1>
  <div class="ceil-line" style="--t0:{at(1,"stuck")}ms"></div>
</div>'''))

# 2 · talent and the room
S.append(scene(2, 's-room', f'''
<div class="split">
  <div class="col">
    <p class="eye in" style="--t0:200ms">The truth about this business</p>
    <h2 class="h l">{words("Talent gets you in the game.", 400)}</h2>
    <h2 class="h l wine2">{words("The room decides how far you go.", at(2,"room") - 300)}</h2>
  </div>
  <div class="col chart">
    <div class="bars">
      {''.join(f'<i style="--h:{h}%;--t0:{600 + i*110}ms"></i>' for i, h in enumerate([28,36,44,52,61,70,80,92]))}
      <div class="lid" style="--t0:{at(2,"decides") + 300}ms"></div>
      <div class="ceil" style="--t0:{at(2,"decides") + 300}ms"><span>the room</span></div>
    </div>
  </div>
</div>'''))

# 3 · the branch, with the stage
RING_IN = ''.join(f'<li style="--a:{a}deg;--i:{i}"><span class="spin"><b>{i+1}</b></span></li>' for i, a in enumerate([270,342,54,126,198]))
RING_OUT_ICONS = ['cap','star','medal','users','crown']
RING_OUT = ''.join(f'<li style="--a:{a}deg;--i:{i+5}"><span class="spin"><svg class="ic"><use href="#i-{RING_OUT_ICONS[i]}"/></svg></span></li>' for i, a in enumerate([306,18,90,162,234]))
S.append(scene(3, 's-branch', f'''
<div class="split">
  <div class="col">
    <p class="eye in" style="--t0:200ms">Chaguanas · Trinidad</p>
    <h2 class="h l">{words("The Ricky Rampersad Branch.", 400)}</h2>
    <p class="sub in" style="--t0:{at(3,"Guardian")}ms">Guardian Life of the Caribbean</p>
    <div class="figs">
      <div class="fig in" style="--t0:{at(3,"Twenty")}ms"><b class="cnt" data-to="23" data-suf="×" data-at="{at(3,"Twenty")}">23×</b><span>MDRT branch</span></div>
      <div class="fig in" style="--t0:{at(3,"Thirty")}ms"><b class="cnt" data-to="32" data-at="{at(3,"Thirty")}">32</b><span>years in Trinidad</span></div>
    </div>
  </div>
  <div class="col">
    <div class="stage">
      <div class="halo"></div>
      <svg class="orbit" viewBox="0 0 400 400" aria-hidden="true"><circle class="o-ring" cx="200" cy="200" r="92"/><circle class="o-ring o-dash" cx="200" cy="200" r="130"/><circle class="o-ring" cx="200" cy="200" r="162"/><circle class="o-arc" cx="200" cy="200" r="90"/><circle class="o-arc o-arc2" cx="200" cy="200" r="158"/></svg>
      <span class="ping"></span><span class="ping p2"></span><span class="ping p3"></span>
      <div class="mark">{MARK}</div>
      <ul class="ring ring-in">{RING_IN}</ul>
      <ul class="ring ring-out">{RING_OUT}</ul>
    </div>
  </div>
</div>'''))

# 4 · the statement
S.append(scene(4, 's-state dark', f'''
<div class="full center">
  <h1 class="h xxl">{words("We do things differently.", 350, 140)}</h1>
  <div class="rule" style="--t0:{at(4,"differently")}ms"></div>
</div>'''))

# 5 · mentorship, written in
S.append(scene(5, 's-mentor', f'''
<div class="split">
  <div class="col">
    <p class="eye in" style="--t0:200ms">Mentorship</p>
    <h2 class="h l">{words("Mentorship isn’t luck here.", 400)}</h2>
    <p class="sub in" style="--t0:{at(5,"written")}ms">It’s written into their appointments.</p>
  </div>
  <div class="col">
    <div class="doc in" style="--t0:{at(5,"Executive") - 300}ms">
      <p class="doc-h">Letter of appointment</p>
      <p class="doc-t">Executive Agent · Senior Sales Consultant</p>
      <i></i><i class="short"></i><i></i>
      <p class="clause" style="--t0:{at(5,"required")}ms">Required: to mentor the advisors beside you.</p>
      <i class="short"></i><i></i>
      <span class="stamp" style="--t0:{at(5,"written")}ms">Written in</span>
    </div>
  </div>
</div>'''))

# 6 · a Branch Manager in your corner
S.append(scene(6, 's-corner', f'''
<div class="split">
  <div class="col">
    <p class="eye in" style="--t0:200ms">In your corner</p>
    <h2 class="h l">{words("Interviewed by the Branch Manager personally.", 400)}</h2>
    <h2 class="h l wine2">{words("Coached by him after.", at(6,"coaches") - 200)}</h2>
  </div>
  <div class="col">
    <div class="corner">
      <span class="brk tl"></span><span class="brk br"></span>
      <div class="chips3">
        <div class="chip in" style="--t0:{at(6,"book")}ms"><svg class="ic"><use href="#i-book"/></svg><b>Your book</b></div>
        <div class="chip in" style="--t0:{at(6,"cases")}ms"><svg class="ic"><use href="#i-doc"/></svg><b>Your cases</b></div>
        <div class="chip in" style="--t0:{at(6,"next")}ms"><svg class="ic"><use href="#i-up"/></svg><b>Your next move</b></div>
      </div>
    </div>
  </div>
</div>'''))

# 7 · recognition on stage
S.append(scene(7, 's-stage', f'''
<div class="split">
  <div class="col">
    <p class="eye in" style="--t0:200ms">Recognition</p>
    <h2 class="h l">{words("Your name, said out loud.", at(7,"announced") - 300)}</h2>
    <div class="bubble in" style="--t0:400ms;--t1:{at(7,"announced") - 100}ms"><span>congrats bro!!</span><span>seen · 2:41 pm · no reply</span></div>
    <div class="dates">
      <div class="date in" style="--t0:{at(7,"Blastoff")}ms"><b>Blastoff</b><span>January</span></div>
      <div class="date in" style="--t0:{at(7,"Mid")}ms"><b>Mid-Year</b><span>July</span></div>
    </div>
  </div>
  <div class="col">
    <div class="podium">
      <div class="light" style="--t0:{at(7,"announced") - 400}ms"></div>
      <div class="plate in" style="--t0:{at(7,"stage")}ms"><small>MDRT qualifier</small><b>Your name</b></div>
      <div class="floor"></div>
      {''.join(f'<span class="conf" style="--x:{8 + (i*37)%86}%;--t0:{at(7,"Your") + (i*53)%700}ms;--c:{["#E85F6A","#fff","#F5CBD0","#D33F49"][i%4]}"></span>' for i in range(22))}
    </div>
  </div>
</div>'''))

# 8 · the career path, professional
S.append(scene(8, 's-path', f'''
<div class="split">
  <div class="col">
    <p class="eye in" style="--t0:200ms">The career path · professional</p>
    <h2 class="h l">{words("The path is written down.", 400)}</h2>
    <p class="sub in" style="--t0:{at(8,"Executive")}ms">Every rung has written criteria, and people in this branch standing on it.</p>
  </div>
  <div class="col">
    <ol class="ladder">
      <li class="in" style="--t0:{at(8,"written") + 200}ms"><b>Career Sales Representative</b><span>Full training, induction, boot camp</span></li>
      <li class="in" style="--t0:{at(8,"Executive")}ms"><b>Executive Agent</b><span class="pills"><i style="--t0:{at(8,"five")}ms">Overrides up to <em class="cnt" data-to="5" data-suf="%" data-at="{at(8,"five")}">5%</em></i><i style="--t0:{at(8,"private")}ms">Private office</i><i style="--t0:{at(8,"sales")}ms">Sales support</i></span></li>
      <li class="in top" style="--t0:{at(8,"Senior")}ms"><b>Senior Sales Consultant</b><span class="pills"><i style="--t0:{at(8,"ten")}ms">Overrides up to <em class="cnt" data-to="10" data-suf="%" data-at="{at(8,"ten")}">10%</em></i><i style="--t0:{at(8,"ten") + 500}ms">Reserved parking</i></span></li>
      <span class="rail" style="--t0:{at(8,"written")}ms"></span>
    </ol>
  </div>
</div>'''))

# 9 · the career path, leadership
S.append(scene(9, 's-lead', f'''
<div class="split">
  <div class="col">
    <p class="eye in" style="--t0:200ms">The career path · leadership</p>
    <h2 class="h l">{words("Or lead.", 400)}</h2>
    <p class="sub in" style="--t0:{at(9,"running")}ms">The road this Branch Manager walked.</p>
  </div>
  <div class="col">
    <ol class="ladder">
      <li class="in" style="--t0:{at(9,"Emerging")}ms"><b>Emerging Leaders Program</b><span>By Branch Manager recommendation</span></li>
      <li class="in" style="--t0:{at(9,"Unit")}ms"><b>Unit Manager</b><span>Recruit, build and run your own unit</span></li>
      <li class="in top" style="--t0:{at(9,"running")}ms"><b>Branch Manager</b><span>A branch of your own</span></li>
      <span class="rail" style="--t0:{at(9,"Emerging") - 200}ms"></span>
    </ol>
  </div>
</div>'''))

# 10 · uncapped
S.append(scene(10, 's-income', f'''
<div class="split">
  <div class="col">
    <p class="eye in" style="--t0:200ms">The income</p>
    <h2 class="h xl">{words("Uncapped.", at(10,"Uncapped") - 200, 80)}</h2>
    <p class="sub in" style="--t0:{at(10,"scales")}ms">It scales with your activity and your skill.</p>
    <h2 class="h m wine2">{words("No salary band. No ceiling.", at(10,"No") - 100, 120)}</h2>
  </div>
  <div class="col">
    <svg class="graph" viewBox="0 0 400 300" aria-hidden="true">
      <defs><linearGradient id="gl" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#E85F6A" stop-opacity=".2"/><stop offset="1" stop-color="#E85F6A"/></linearGradient></defs>
      <g class="band" style="--t0:{at(10,"No")}ms"><rect x="20" y="150" width="360" height="60" rx="6"/><text x="36" y="186">salary band</text></g>
      <polyline class="line" style="--t0:{at(10,"scales") - 200}ms" points="20,270 70,250 120,238 170,215 220,196 260,160 300,120 340,70 380,10"/>
      <circle class="dot" style="--t0:{at(10,"ceiling")}ms" cx="380" cy="10" r="7"/>
    </svg>
  </div>
</div>'''))

# 11 · confidential
S.append(scene(11, 's-lock', f'''
<div class="full center">
  <div class="lock in" style="--t0:300ms"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path class="shackle" style="--t0:{at(11,"confidential")}ms" d="M8 11V7a4 4 0 0 1 8 0v4"/></svg></div>
  <h2 class="h l">{words("Already contracted somewhere else?", 500)}</h2>
  <h2 class="h l wine2">{words("Your conversation with us stays confidential.", at(11,"conversation") - 300)}</h2>
</div>'''))

# 12 · newcomers
S.append(scene(12, 's-new', f'''
<div class="split">
  <div class="col">
    <p class="eye in" style="--t0:200ms">Newcomers</p>
    <h2 class="h l">{words("New to insurance? That’s normal.", 400)}</h2>
    <p class="sub in" style="--t0:{at(12,"full")}ms">You get the full build.</p>
  </div>
  <div class="col">
    <ul class="checks">
      <li style="--t0:{at(12,"training")}ms"><i></i>Training</li>
      <li style="--t0:{at(12,"boot")}ms"><i></i>Boot camp</li>
      <li style="--t0:{at(12,"one")}ms"><i></i>One-on-one coaching</li>
      <li style="--t0:{at(12,"mentors")}ms"><i></i>Mentors required to develop you</li>
    </ul>
  </div>
</div>'''))

# 13 · we select
GATES = ['Apply & screen','Meet the Branch Manager','Discovery','Assessment','Selection']
S.append(scene(13, 's-gates', f'''
<div class="full">
  <p class="eye in" style="--t0:200ms">The selection</p>
  <h2 class="h l">{words("We don’t fill seats. We select.", 400)}</h2>
  <ol class="gates">
    {''.join(f'<li style="--t0:{at(13,"Five") + 350*i}ms"><b>{i+1}</b><span>{g}</span></li>' for i, g in enumerate(GATES))}
    <span class="gline" style="--t0:{at(13,"Five")}ms"></span>
  </ol>
  <p class="sub big in" style="--t0:{at(13,"Discovery")}ms">At your Discovery you sit with our qualifiers and ask them anything, <em>without the Branch Manager in the room.</em></p>
</div>'''))

# 14 · five seats
S.append(scene(14, 's-seats', f'''
<div class="full center">
  <p class="eye in" style="--t0:200ms">This intake</p>
  <h2 class="h xl">{words("Five seats.", 400, 120)}</h2>
  <ul class="seats">{''.join(f'<li class="{"you" if i == 2 else ""}" style="--t0:{600 + i*120}ms;--t1:{at(14,"seats") + 400}ms"><svg class="ic"><use href="#i-seat"/></svg></li>' for i in range(5))}</ul>
  <div class="figs row">
    <div class="fig in" style="--t0:{at(14,"Two")}ms"><b><em class="cnt" data-to="2" data-at="{at(14,"Two")}">2</em> min</b><span>to apply</span></div>
    <div class="fig in" style="--t0:{at(14,"Reviewed")}ms"><b><em class="cnt" data-to="48" data-at="{at(14,"Reviewed")}">48</em> h</b><span>to a review</span></div>
  </div>
</div>'''))

# 15 · the call
S.append(scene(15, 's-cta', f'''
<div class="split cta">
  <div class="col">
    <p class="eye in" style="--t0:200ms">Start here</p>
    <h2 class="h url">{words("agentmgt.com", 400, 60)}</h2>
    <div class="btns">
      <span class="btn b1 in" style="--t0:{at(15,"Take")}ms">Take the 60-second test</span>
      <span class="btn b2 in" style="--t0:{at(15,"start")}ms">Start the selection →</span>
    </div>
  </div>
  <div class="col">
    <div class="qr in" style="--t0:{at(15,"Go")}ms"><svg viewBox="0 0 41 41" aria-hidden="true"><path d="{QR}"/></svg><span>Scan to apply</span></div>
  </div>
</div>'''))

# 16 · the close
S.append(scene(16, 's-close dark', f'''
<div class="full center">
  <div class="mark big in" style="--t0:200ms">{MARK}</div>
  <h1 class="h xl">{words("The environment decides.", 500, 110)}<br><em class="wine">{words("We select the driven.", at(16,"We") - 200, 110)}</em></h1>
  <p class="foot in" style="--t0:{at(16,"driven")}ms">Ricky Rampersad Branch · Guardian Life of the Caribbean · Chaguanas · <b>agentmgt.com</b></p>
</div>'''))

HTML = r'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>The environment decides — the recruiting film, Ricky Rampersad Branch</title>
<meta name="robots" content="noindex">
<style>
{{FONTS}}
:root{
  --u:1vh; --bg:#14171E; --bg2:#1C2029; --bg3:#262B35; --ink:#F3F4F7; --mute:#C9CDD6; --mute2:#A5AAB6;
  --a:#D33F49; --aD:#B22F3A; --aL:#E85F6A; --aT:#F08A91;
  --display:'PlayfairF',Georgia,serif; --text:'InterF',system-ui,sans-serif;
  --ease:cubic-bezier(.2,.7,.2,1); --out:cubic-bezier(.16,1,.3,1);
}
*{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%;background:var(--bg);color:var(--ink);font-family:var(--text);overflow:hidden}
#film{position:relative;width:100vw;height:100vh;overflow:hidden;background:radial-gradient(120% 80% at 80% 10%,#303644,transparent 60%),linear-gradient(170deg,var(--bg2),var(--bg) 70%)}
#film::before{content:'';position:absolute;inset:0;background-image:radial-gradient(rgba(255,255,255,.07) 1px,transparent 1.5px);background-size:calc(var(--u)*3.6) calc(var(--u)*3.6);-webkit-mask-image:radial-gradient(70% 70% at 60% 40%,#000 30%,transparent 100%);mask-image:radial-gradient(70% 70% at 60% 40%,#000 30%,transparent 100%)}
.aura{position:absolute;width:70vmax;height:70vmax;border-radius:50%;pointer-events:none;filter:blur(calc(var(--u)*6));opacity:.55}
.aura.a1{left:-20vmax;top:-20vmax;background:radial-gradient(circle,rgba(211,63,73,.32),transparent 65%);animation:drift 22s ease-in-out infinite alternate}
.aura.a2{right:-25vmax;bottom:-30vmax;background:radial-gradient(circle,rgba(110,118,134,.35),transparent 65%);animation:drift 27s ease-in-out infinite alternate-reverse}
@keyframes drift{to{transform:translate(8vmax,6vmax) scale(1.12)}}
.grain{position:absolute;inset:-10%;pointer-events:none;opacity:.07;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)'/%3E%3C/svg%3E");animation:grain 1.4s steps(6) infinite}
@keyframes grain{to{transform:translate(-6%,4%)}}

/* ── scenes ── */
.scene{position:absolute;inset:0;opacity:0;pointer-events:none;padding:calc(var(--u)*9) calc(var(--u)*10) calc(var(--u)*22);display:grid}
.scene.act{opacity:1;pointer-events:auto;animation:scene-in .9s var(--out) both;z-index:2}
@keyframes scene-in{from{opacity:0;transform:scale(1.05);filter:blur(10px)}to{opacity:1;transform:none;filter:blur(0)}}
.scene.out{opacity:1;z-index:1;animation:scene-out .72s var(--ease) both}
@keyframes scene-out{to{opacity:0;transform:scale(.94) translateY(-2%);filter:blur(8px)}}
.streak{position:absolute;inset:0;pointer-events:none;background:linear-gradient(105deg,transparent 40%,rgba(255,255,255,.14) 50%,transparent 60%);transform:translateX(-120%);}
.scene.act .streak{animation:streak .9s var(--ease) both}
@keyframes streak{to{transform:translateX(120%)}}
.full{display:grid;align-content:center;gap:calc(var(--u)*2)}
.center{text-align:center;justify-items:center}
.split{display:grid;grid-template-columns:1.05fr .95fr;gap:calc(var(--u)*8);align-items:center}
.col{min-width:0;display:grid;gap:calc(var(--u)*2.2);align-content:center}

/* ── type ── */
.eye{font:600 calc(var(--u)*2.2)/1 var(--text);letter-spacing:.16em;text-transform:uppercase;color:var(--aT);display:inline-flex;align-items:center;gap:.6em}
.eye::before{content:'';width:.5em;height:.5em;border-radius:50%;background:var(--a);box-shadow:0 0 0 0 rgba(211,63,73,.5);animation:dot 2.2s ease-out infinite}
@keyframes dot{70%{box-shadow:0 0 0 .7em rgba(211,63,73,0)}100%{box-shadow:0 0 0 0 rgba(211,63,73,0)}}
.h{font-family:var(--display);font-weight:800;line-height:1.04;letter-spacing:-.02em;color:#fff;text-wrap:balance}
.h.xxl{font-size:calc(var(--u)*13)}
.h.xl{font-size:calc(var(--u)*10.5)}
.h.l{font-size:calc(var(--u)*7)}
.h.m{font-size:calc(var(--u)*5.2)}
.h.url{font-size:calc(var(--u)*10);letter-spacing:-.03em;color:#fff;font-weight:700}
.h em,.wine{font-style:italic;font-weight:700;color:var(--aL)}
.h.wine2{color:var(--aL);font-weight:700}
.sub{font-size:calc(var(--u)*3.1);line-height:1.4;color:var(--mute);max-width:34ch}
.sub.big{font-size:calc(var(--u)*3.3);max-width:60ch;color:var(--ink)}
.sub em{color:var(--aT);font-style:normal;font-weight:600}
.foot{font-size:calc(var(--u)*2.4);color:var(--mute2);letter-spacing:.02em}
.foot b{color:#fff;font-weight:600}
.w{display:inline-block;overflow:hidden;vertical-align:bottom;padding:0 .04em .12em;margin:0 -.04em -.12em}
.w i{display:inline-block;font-style:inherit;opacity:0}
.scene.act .w i{animation:word .8s var(--out) both;animation-delay:calc(var(--t0) + var(--i) * 85ms)}
@keyframes word{from{opacity:0;transform:translateY(110%) rotate(3deg) scale(1.08)}60%{opacity:1}to{opacity:1;transform:none}}
.in{opacity:0}
.scene.act .in{animation:up .8s var(--out) both;animation-delay:var(--t0,0ms)}
@keyframes up{from{opacity:0;transform:translateY(calc(var(--u)*3))}to{opacity:1;transform:none}}

/* ── shared pieces ── */
.mk{width:100%;height:auto;display:block;filter:drop-shadow(0 calc(var(--u)*2) calc(var(--u)*4) rgba(90,20,27,.5))}
.ic{width:1em;height:1em;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.figs{display:flex;gap:calc(var(--u)*6);margin-top:calc(var(--u)*1)}
.figs.row{justify-content:center;gap:calc(var(--u)*10)}
.fig b{display:block;font:800 calc(var(--u)*9)/1 var(--display);color:#fff;letter-spacing:-.03em;font-variant-numeric:tabular-nums}
.fig b em{font-style:normal;color:var(--aL)}
.fig span{display:block;margin-top:.4em;font-size:calc(var(--u)*2.4);color:var(--mute);letter-spacing:.04em}
.rule{width:calc(var(--u)*14);height:calc(var(--u)*.6);background:linear-gradient(90deg,var(--aL),var(--aD));transform:scaleX(0);transform-origin:50% 50%;margin-top:calc(var(--u)*2)}
.scene.act .rule{animation:rule .8s var(--out) both;animation-delay:var(--t0)}
@keyframes rule{to{transform:scaleX(1)}}
.ceil-line{position:absolute;left:10%;right:10%;top:62%;height:2px;background:linear-gradient(90deg,transparent,var(--aL),transparent);transform:scaleX(0)}
.scene.act .ceil-line{animation:rule 1.1s var(--out) both;animation-delay:var(--t0)}

/* 2 · the chart */
.chart{align-items:end}
.bars{position:relative;height:calc(var(--u)*46);display:flex;align-items:flex-end;gap:calc(var(--u)*1.6);padding:calc(var(--u)*4) calc(var(--u)*1) 0;overflow:hidden;border-radius:calc(var(--u)*1)}
.bars i{flex:1;height:var(--h);border-radius:calc(var(--u)*.8) calc(var(--u)*.8) 0 0;background:linear-gradient(180deg,var(--aL),var(--aD) 70%,#7f1f27);transform:scaleY(0);transform-origin:50% 100%}
.scene.act .bars i{animation:grow 1.1s var(--out) both;animation-delay:var(--t0)}
@keyframes grow{to{transform:scaleY(1)}}
.lid{position:absolute;left:-4%;right:-4%;top:-4%;height:46%;background:linear-gradient(180deg,var(--bg) 70%,rgba(20,23,30,.0));z-index:2}
.scene.act .lid{animation:lid 1.3s var(--ease) both;animation-delay:var(--t0)}
@keyframes lid{70%{opacity:1}to{transform:translateY(-130%);opacity:0}}
.ceil{position:absolute;left:2%;right:2%;top:42%;height:0;border-top:calc(var(--u)*.4) dashed var(--aT);z-index:3}
.ceil span{position:absolute;right:0;top:calc(var(--u)*-3.6);font:600 calc(var(--u)*2)/1 var(--text);letter-spacing:.14em;text-transform:uppercase;color:var(--aT)}
.scene.act .ceil{animation:ceil 1.3s var(--ease) both;animation-delay:var(--t0)}
@keyframes ceil{to{transform:translateY(calc(var(--u)*-60));opacity:0}}

/* 3 · the stage */
.stage{position:relative;width:min(100%,calc(var(--u)*66));aspect-ratio:1;margin:0 auto;display:grid;place-items:center;container-type:size}
.halo,.orbit,.mark{grid-area:1/1}
.halo{place-self:stretch;margin:-6%;border-radius:50%;background:radial-gradient(circle closest-side,rgba(211,63,73,.32),rgba(211,63,73,.1) 46%,transparent 70%);animation:halo 6s ease-in-out infinite}
@keyframes halo{50%{opacity:1;transform:scale(1.07)}}
.stage .orbit{width:100%;height:auto;aspect-ratio:1;overflow:visible;animation:spin 90s linear infinite}
.o-ring{fill:none;stroke:rgba(255,255,255,.3);stroke-width:1.1}
.o-dash{stroke-dasharray:2 9;stroke:rgba(255,255,255,.5)}
.o-arc{fill:none;stroke:var(--aL);stroke-width:2.4;stroke-linecap:round;stroke-dasharray:130 435;stroke-opacity:.7;transform-box:view-box;transform-origin:50% 50%;animation:spin 13s linear infinite}
.o-arc2{stroke-dasharray:115 878;stroke-opacity:.4;stroke-width:1.8;animation:spin 21s linear infinite reverse}
@keyframes spin{to{rotate:360deg}}
.ping{position:absolute;inset:0;margin:auto;width:25%;height:25%;border-radius:50%;border:1px solid var(--aL);opacity:0;animation:ping 5.4s ease-out infinite}
.ping.p2{animation-delay:1.8s}.ping.p3{animation-delay:3.6s}
@keyframes ping{0%{scale:.62;opacity:0}12%{opacity:.5}100%{scale:2.9;opacity:0}}
.stage .mark{width:28%;z-index:1;animation:float 7.5s ease-in-out infinite}
@keyframes float{0%,100%{transform:translateY(-2%) rotate(-.7deg)}50%{transform:translateY(3%) rotate(.7deg)}}
.scene.act .shield-b{transform-box:fill-box;transform-origin:50% 50%;animation:shield-in .9s var(--out) .4s backwards}
@keyframes shield-in{from{opacity:0;scale:.8}}
.scene.act .tick-u,.scene.act .tick-o{stroke-dasharray:48;stroke-dashoffset:48;animation:draw .7s var(--ease) 1s forwards}
.scene.act .tick-o{animation-delay:1.08s}
@keyframes draw{to{stroke-dashoffset:0}}
.ring{position:absolute;inset:0;list-style:none;--chip:9.4cqw}
.ring-in{--r:23cqw;--dur:52s}.ring-out{--r:40.5cqw;--dur:76s}
.ring{animation:spin var(--dur) linear infinite}.ring-out{animation-direction:reverse}
.ring li{position:absolute;top:50%;left:50%;width:var(--chip);height:var(--chip);margin:calc(var(--chip)/-2) 0 0 calc(var(--chip)/-2);transform:rotate(var(--a)) translate(var(--r)) rotate(calc(var(--a) * -1));opacity:0}
.scene.act .ring li{animation:fade .7s var(--out) both;animation-delay:calc(.5s + var(--i) * 90ms)}
@keyframes fade{to{opacity:1}}
.spin{display:grid;place-items:center;width:100%;height:100%;border-radius:50%;background:var(--bg3);border:1px solid rgba(255,255,255,.2);box-shadow:0 10px 24px rgba(10,12,18,.5);color:#fff;font:700 3.6cqw/1 var(--display);animation:unspin var(--dur) linear infinite}
.ring-out .spin{animation-direction:reverse}
@keyframes unspin{to{rotate:-360deg}}
.ring-in .spin{background:linear-gradient(145deg,var(--a),var(--aD));border-color:rgba(255,255,255,.3)}
.spin .ic{width:46%;height:46%}

/* 5 · the letter of appointment */
.doc{position:relative;background:#fff;color:#17191F;border-radius:calc(var(--u)*1.6);padding:calc(var(--u)*4) calc(var(--u)*4.5);box-shadow:0 calc(var(--u)*4) calc(var(--u)*8) rgba(4,6,10,.5);transform:rotate(-1.5deg)}
.doc-h{font:600 calc(var(--u)*1.9)/1 var(--text);letter-spacing:.14em;text-transform:uppercase;color:var(--aD)}
.doc-t{font:700 calc(var(--u)*3.4)/1.15 var(--display);margin:calc(var(--u)*1.2) 0 calc(var(--u)*2.4)}
.doc i{display:block;height:calc(var(--u)*1.1);border-radius:99px;background:#E3E5EA;margin:calc(var(--u)*1.4) 0}
.doc i.short{width:62%}
.clause{font:600 calc(var(--u)*3)/1.3 var(--text);color:#17191F;padding:calc(var(--u)*1.2) calc(var(--u)*1.6);border-radius:calc(var(--u)*.8);background:linear-gradient(90deg,#FBE3E5,#FBE3E5) no-repeat;background-size:0 100%;margin:calc(var(--u)*1.6) 0}
.scene.act .clause{animation:hl .7s var(--ease) both;animation-delay:var(--t0)}
@keyframes hl{to{background-size:100% 100%}}
.stamp{position:absolute;right:calc(var(--u)*3);bottom:calc(var(--u)*3);font:800 calc(var(--u)*3.2)/1 var(--display);letter-spacing:.08em;text-transform:uppercase;color:var(--aD);border:calc(var(--u)*.45) solid var(--aD);border-radius:calc(var(--u)*1);padding:.25em .5em;transform:rotate(-12deg) scale(2.4);opacity:0}
.scene.act .stamp{animation:stamp .45s cubic-bezier(.2,1.4,.4,1) both;animation-delay:var(--t0)}
@keyframes stamp{to{transform:rotate(-12deg) scale(1);opacity:1}}

/* 6 · the corner */
.corner{position:relative;padding:calc(var(--u)*6)}
.brk{position:absolute;width:calc(var(--u)*9);height:calc(var(--u)*9);border:calc(var(--u)*.5) solid var(--aL);opacity:0}
.brk.tl{left:0;top:0;border-right:0;border-bottom:0}.brk.br{right:0;bottom:0;border-left:0;border-top:0}
.scene.act .brk{animation:brk .7s var(--out) .3s both}
.scene.act .brk.br{animation-delay:.5s}
@keyframes brk{from{opacity:0;transform:scale(1.4)}to{opacity:1;transform:none}}
.chips3{display:grid;gap:calc(var(--u)*2)}
.chip{display:flex;align-items:center;gap:calc(var(--u)*2);background:var(--bg3);border:1px solid rgba(255,255,255,.14);border-radius:calc(var(--u)*1.6);padding:calc(var(--u)*2.2) calc(var(--u)*3);font:700 calc(var(--u)*3.4)/1 var(--display);color:#fff;box-shadow:0 calc(var(--u)*2) calc(var(--u)*5) rgba(4,6,10,.4)}
.chip .ic{font-size:calc(var(--u)*4);color:var(--aL);flex:none}

/* 7 · the stage and the chat bubble */
.bubble{justify-self:start;font-weight:600;background:#2a3140;border-radius:calc(var(--u)*2) calc(var(--u)*2) calc(var(--u)*2) .3em;padding:calc(var(--u)*1.4) calc(var(--u)*2.2);font-size:calc(var(--u)*2.4);color:var(--mute);display:grid;gap:.2em;position:relative}
.bubble span:last-child{font-size:.8em;color:var(--mute2)}
.scene.act .bubble{animation:up .8s var(--out) both,bub-out .6s var(--ease) both;animation-delay:var(--t0),var(--t1)}
@keyframes bub-out{to{opacity:.18;filter:grayscale(1);transform:translateX(calc(var(--u)*-3))}}
.dates{display:flex;gap:calc(var(--u)*2)}
.date{background:linear-gradient(145deg,var(--a),var(--aD));color:#fff;border-radius:calc(var(--u)*1.4);padding:calc(var(--u)*1.6) calc(var(--u)*2.6);display:grid;gap:.2em}
.date b{font:700 calc(var(--u)*3.2)/1 var(--display)}
.date span{font-size:calc(var(--u)*2);letter-spacing:.1em;text-transform:uppercase;opacity:.9}
.podium{position:relative;height:calc(var(--u)*48);display:grid;align-items:end;justify-items:center;overflow:hidden;border-radius:calc(var(--u)*2)}
.podium .floor{position:absolute;left:0;right:0;bottom:0;height:18%;background:linear-gradient(180deg,#303644,#1C2029);border-top:1px solid rgba(255,255,255,.12)}
.podium .light{position:absolute;top:-10%;left:50%;width:70%;height:120%;translate:-50% 0;background:conic-gradient(from 165deg at 50% 0%,transparent 0 0deg,rgba(255,255,255,.14) 12deg,rgba(255,255,255,.22) 15deg,rgba(255,255,255,.14) 18deg,transparent 30deg);opacity:0;transform-origin:50% 0}
.scene.act .light{animation:light 1.2s var(--out) both,sweep 6s ease-in-out infinite;animation-delay:var(--t0),calc(var(--t0) + 1.2s)}
@keyframes light{to{opacity:1}}
@keyframes sweep{0%,100%{rotate:-8deg}50%{rotate:8deg}}
.plate{position:relative;z-index:2;margin-bottom:22%;background:#fff;color:#17191F;border-radius:calc(var(--u)*1.2);padding:calc(var(--u)*2) calc(var(--u)*4);text-align:center;box-shadow:0 calc(var(--u)*3) calc(var(--u)*7) rgba(4,6,10,.6)}
.plate small{display:block;font:600 calc(var(--u)*1.8)/1 var(--text);letter-spacing:.16em;text-transform:uppercase;color:var(--aD);margin-bottom:.5em}
.plate b{font:800 calc(var(--u)*4.4)/1 var(--display)}
.conf{position:absolute;top:-6%;left:var(--x);width:calc(var(--u)*1);height:calc(var(--u)*1.8);background:var(--c);opacity:0;border-radius:2px}
.scene.act .conf{animation:conf 2.6s linear both;animation-delay:var(--t0)}
@keyframes conf{0%{opacity:0;transform:translateY(0) rotate(0)}10%{opacity:1}100%{opacity:0;transform:translateY(calc(var(--u)*48)) rotate(540deg)}}

/* 8 · 9 · the ladders */
.ladder{position:relative;list-style:none;display:grid;gap:calc(var(--u)*2.4);padding-left:calc(var(--u)*6)}
.ladder .rail{position:absolute;left:calc(var(--u)*1.2);top:calc(var(--u)*1.5);bottom:calc(var(--u)*1.5);width:calc(var(--u)*.4);background:var(--line,rgba(255,255,255,.18));transform:scaleY(0);transform-origin:50% 100%}
.scene.act .ladder .rail{animation:rail 1.6s var(--out) both;animation-delay:var(--t0)}
@keyframes rail{to{transform:scaleY(1)}}
.ladder li{position:relative;background:var(--bg3);border:1px solid rgba(255,255,255,.14);border-radius:calc(var(--u)*1.4);padding:calc(var(--u)*2) calc(var(--u)*2.6);display:grid;gap:.5em}
.ladder li::before{content:'';position:absolute;left:calc(var(--u)*-5.6);top:calc(var(--u)*2.4);width:calc(var(--u)*1.6);height:calc(var(--u)*1.6);border-radius:50%;background:var(--bg);border:calc(var(--u)*.35) solid var(--aL)}
.ladder li.top::before{background:var(--aL);box-shadow:0 0 0 calc(var(--u)*.6) rgba(211,63,73,.3)}
.ladder li.top{border-color:rgba(232,95,106,.55)}
.ladder b{font:700 calc(var(--u)*3.3)/1.1 var(--display);color:#fff}
.ladder li>span{font-size:calc(var(--u)*2.3);color:var(--mute)}
.pills{display:flex;flex-wrap:wrap;gap:.5em}
.pills i{font:600 calc(var(--u)*2.1)/1 var(--text);font-style:normal;color:#fff;background:linear-gradient(145deg,var(--a),var(--aD));border-radius:99px;padding:.45em .8em;opacity:0}
.pills i em{font-style:normal;font-weight:800}
.scene.act .pills i{animation:pop .5s cubic-bezier(.2,1.3,.4,1) both;animation-delay:var(--t0)}
@keyframes pop{from{opacity:0;transform:scale(.6)}to{opacity:1;transform:none}}
.ladder{display:flex;flex-direction:column-reverse}

/* 10 · the graph */
.graph{width:100%;height:auto;overflow:visible}
.graph .line{fill:none;stroke:url(#gl);stroke-width:7;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:620;stroke-dashoffset:620;filter:drop-shadow(0 0 10px rgba(232,95,106,.6))}
.scene.act .graph .line{animation:dash 2.2s var(--ease) both;animation-delay:var(--t0)}
@keyframes dash{to{stroke-dashoffset:0}}
.graph .band rect{fill:rgba(255,255,255,.07);stroke:rgba(255,255,255,.35);stroke-dasharray:6 6}
.graph .band text{font:600 16px var(--text);letter-spacing:.12em;text-transform:uppercase;fill:var(--mute2)}
.scene.act .graph .band{animation:band .9s var(--ease) both;animation-delay:var(--t0)}
@keyframes band{to{opacity:0;transform:translateY(30px)}}
.graph .dot{fill:var(--aL);opacity:0}
.scene.act .graph .dot{animation:dotin .5s var(--out) both,pulse 1.6s ease-out infinite;animation-delay:var(--t0),calc(var(--t0) + .5s)}
@keyframes dotin{from{opacity:0;r:0}to{opacity:1}}
@keyframes pulse{to{filter:drop-shadow(0 0 18px rgba(232,95,106,1))}}

/* 11 · the lock */
.lock{width:calc(var(--u)*16);height:calc(var(--u)*16);border-radius:50%;background:var(--bg3);border:1px solid rgba(255,255,255,.16);display:grid;place-items:center;box-shadow:0 calc(var(--u)*3) calc(var(--u)*7) rgba(4,6,10,.5)}
.lock svg{width:55%;height:55%;fill:none;stroke:var(--aL);stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;overflow:visible}
.lock .shackle{transform:translateY(-4px);transform-box:fill-box;transform-origin:50% 100%}
.scene.act .lock .shackle{animation:shackle .5s cubic-bezier(.2,1.3,.4,1) both;animation-delay:var(--t0)}
@keyframes shackle{to{transform:translateY(0)}}

/* 12 · the checks */
.checks{list-style:none;display:grid;gap:calc(var(--u)*1.8)}
.checks li{display:flex;align-items:center;gap:calc(var(--u)*2);font:600 calc(var(--u)*3.4)/1.1 var(--text);color:#fff;opacity:0}
.scene.act .checks li{animation:up .7s var(--out) both;animation-delay:var(--t0)}
.checks i{width:calc(var(--u)*5);height:calc(var(--u)*5);border-radius:50%;background:linear-gradient(145deg,var(--a),var(--aD));position:relative;flex:none}
.checks i::after{content:'';position:absolute;left:30%;top:24%;width:22%;height:42%;border:solid #fff;border-width:0 .28em .28em 0;transform:rotate(45deg) scale(0);transform-origin:50% 50%}
.scene.act .checks i::after{animation:pop .4s cubic-bezier(.2,1.4,.4,1) both;animation-delay:calc(var(--t0) + .35s)}

/* 13 · the gates */
.gates{position:relative;list-style:none;display:grid;grid-template-columns:repeat(5,1fr);gap:calc(var(--u)*2);margin:calc(var(--u)*2) 0}
.gates li{text-align:center;display:grid;justify-items:center;gap:calc(var(--u)*1.4);opacity:0;position:relative;z-index:1}
.scene.act .gates li{animation:up .7s var(--out) both;animation-delay:var(--t0)}
.gates b{width:calc(var(--u)*9);height:calc(var(--u)*9);border-radius:50%;display:grid;place-items:center;background:linear-gradient(145deg,var(--a),var(--aD));color:#fff;font:700 calc(var(--u)*4)/1 var(--display);box-shadow:0 calc(var(--u)*2) calc(var(--u)*5) rgba(178,47,58,.45)}
.gates span{font:600 calc(var(--u)*2.3)/1.2 var(--text);color:var(--mute)}
.gline{position:absolute;left:10%;right:10%;top:calc(var(--u)*4.5);height:calc(var(--u)*.35);background:linear-gradient(90deg,rgba(255,255,255,.12) 0 38%,var(--a) 47%,var(--a) 53%,rgba(255,255,255,.12) 62% 100%);background-size:280% 100%;transform:scaleX(0);transform-origin:0 50%}
.scene.act .gline{animation:rule 1.7s var(--out) both,flow 3s linear infinite;animation-delay:var(--t0),0s}
@keyframes flow{from{background-position:120% 0}to{background-position:-80% 0}}

/* 14 · the seats */
.seats{list-style:none;display:flex;gap:calc(var(--u)*2.2);justify-content:center;margin:calc(var(--u)*1) 0}
.seats li{width:calc(var(--u)*11);height:calc(var(--u)*11);border-radius:calc(var(--u)*2.4);background:var(--bg3);border:1px solid rgba(255,255,255,.14);display:grid;place-items:center;color:var(--mute2);font-size:calc(var(--u)*5);opacity:0}
.scene.act .seats li{animation:pop .6s cubic-bezier(.2,1.3,.4,1) both;animation-delay:var(--t0)}
.scene.act .seats li.you{animation:pop .6s cubic-bezier(.2,1.3,.4,1) both,you .6s var(--out) forwards,seat 2.2s ease-out infinite;animation-delay:var(--t0),var(--t1),calc(var(--t1) + .6s)}
@keyframes you{to{background:linear-gradient(145deg,var(--aL),var(--aD));color:#fff;border-color:rgba(255,255,255,.35);transform:scale(1.12)}}
@keyframes seat{0%{box-shadow:0 0 0 0 rgba(232,95,106,.55)}70%{box-shadow:0 0 0 calc(var(--u)*2.4) rgba(232,95,106,0)}100%{box-shadow:0 0 0 0 rgba(232,95,106,0)}}

/* 15 · the call */
.cta{grid-template-columns:1.3fr .7fr}
.btns{display:flex;flex-wrap:wrap;gap:calc(var(--u)*1.8)}
.btn{display:inline-flex;align-items:center;min-height:calc(var(--u)*7);padding:0 calc(var(--u)*3.6);border-radius:99px;font:600 calc(var(--u)*2.8)/1 var(--text);white-space:nowrap}
.b1{background:linear-gradient(135deg,var(--a),var(--aD));color:#fff;box-shadow:0 calc(var(--u)*1.6) calc(var(--u)*4) rgba(178,47,58,.4)}
.b2{border:1.5px solid rgba(255,255,255,.4);color:#fff}
.qr{justify-self:center;background:#fff;border-radius:calc(var(--u)*2);padding:calc(var(--u)*2.4);display:grid;gap:calc(var(--u)*1.2);justify-items:center;box-shadow:0 calc(var(--u)*4) calc(var(--u)*9) rgba(4,6,10,.6)}
.qr svg{width:calc(var(--u)*30);height:calc(var(--u)*30);fill:#17191F;display:block}
.qr span{font:600 calc(var(--u)*2.2)/1 var(--text);color:#17191F;letter-spacing:.08em;text-transform:uppercase}

/* 16 · the close */
.mark.big{width:calc(var(--u)*22)}
.s-close h1{margin-top:calc(var(--u)*1)}

/* ── the player, for a person watching the page; hidden while rendering ── */
#poster{position:absolute;inset:0;z-index:20;display:grid;place-items:center;background:rgba(20,23,30,.72);backdrop-filter:blur(8px);cursor:pointer}
#poster button{font:600 calc(var(--u)*3)/1 var(--text);color:#fff;background:linear-gradient(135deg,var(--a),var(--aD));border:0;border-radius:99px;padding:1em 2em;cursor:pointer}
body.rolling #poster{display:none}
#ctrl{position:absolute;left:0;right:0;bottom:0;z-index:21;display:flex;gap:calc(var(--u)*1);padding:calc(var(--u)*1.6) calc(var(--u)*2);align-items:center;background:linear-gradient(180deg,transparent,rgba(20,23,30,.6))}
#ctrl button{font:600 calc(var(--u)*2)/1 var(--text);color:#fff;background:rgba(255,255,255,.14);border:0;border-radius:99px;padding:.6em 1em;cursor:pointer}
#bars{display:flex;gap:4px;flex:1}
#bars i{flex:1;height:3px;border-radius:99px;background:rgba(255,255,255,.18);position:relative;overflow:hidden}
#bars i::after{content:'';position:absolute;inset:0;background:var(--aL);transform:scaleX(0);transform-origin:left}
#bars i.done::after{transform:scaleX(1)}
#bars i.run::after{animation:barfill linear forwards;animation-duration:var(--d)}
@keyframes barfill{to{transform:scaleX(1)}}
body.paused #bars i.run::after{animation-play-state:paused}

/* ── the portrait cut: 1080x1920 for Reels and Stories ── */
@media (orientation:portrait){
  :root{--u:1vw}
  .scene{padding:calc(var(--u)*14) calc(var(--u)*7) calc(var(--u)*36)}
  .split{grid-template-columns:1fr;grid-template-rows:auto auto;gap:calc(var(--u)*6);align-content:center}
  .split .col:first-child{order:0}.split .col:last-child{order:1}
  .h.xxl{font-size:calc(var(--u)*15)}.h.xl{font-size:calc(var(--u)*12.5)}.h.l{font-size:calc(var(--u)*8.6)}.h.m{font-size:calc(var(--u)*6)}.h.url{font-size:calc(var(--u)*12)}
  .sub{font-size:calc(var(--u)*3.6)}.sub.big{font-size:calc(var(--u)*3.6)}
  .eye{font-size:calc(var(--u)*2.5)}
  .bars{height:calc(var(--u)*50)}
  .stage{width:min(100%,calc(var(--u)*70))}
  .podium{height:calc(var(--u)*50)}
  .gates{grid-template-columns:repeat(5,1fr);gap:calc(var(--u)*1)}
  .gates span{font-size:calc(var(--u)*2)}
  .gates b{width:calc(var(--u)*11);height:calc(var(--u)*11);font-size:calc(var(--u)*4.6)}
  .gline{top:calc(var(--u)*5.5)}
  .seats li{width:calc(var(--u)*13);height:calc(var(--u)*13)}
  .cta{grid-template-columns:1fr}
  .qr svg{width:calc(var(--u)*36);height:calc(var(--u)*36)}
  .mark.big{width:calc(var(--u)*28)}
  .figs{flex-wrap:wrap;gap:calc(var(--u)*4)}
}
</style>
</head>
<body>
<svg width="0" height="0" style="position:absolute" aria-hidden="true">
  <defs>
    <symbol id="shield" viewBox="6 3 76 82">
      <linearGradient id="mG" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#ec6b74"/><stop offset="52%" stop-color="#d33f49"/><stop offset="100%" stop-color="#7f1f27"/></linearGradient>
      <path class="shield-b" d="M44 9L73 21.5V41C73 60.5 60.5 72 44 78.5C27.5 72 15 60.5 15 41V21.5Z" fill="url(#mG)"/>
      <path class="tick-u" d="M30 44L39.5 53.5L58 32.5" stroke="#5a141b" stroke-width="6.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      <path class="tick-o" d="M30 44L39.5 53.5L58 32.5" stroke="#fff" stroke-width="2.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    </symbol>
    <symbol id="i-cap" viewBox="0 0 24 24"><path d="m2 9 10-5 10 5-10 5z"/><path d="M6 11.5V16c0 1.7 2.7 3 6 3s6-1.3 6-3v-4.5M22 9v6"/></symbol>
    <symbol id="i-star" viewBox="0 0 24 24"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9z"/></symbol>
    <symbol id="i-medal" viewBox="0 0 24 24"><circle cx="12" cy="15" r="5"/><path d="M8.5 10.5 6 3h4l2 5 2-5h4l-2.5 7.5M12 13v4"/></symbol>
    <symbol id="i-users" viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.5"/><path d="M3 20a6 6 0 0 1 12 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M21 20a6 6 0 0 0-4.5-5.8"/></symbol>
    <symbol id="i-crown" viewBox="0 0 24 24"><path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z"/></symbol>
    <symbol id="i-book" viewBox="0 0 24 24"><path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v17H6.5a2.5 2.5 0 0 0 0 5H20"/><path d="M4 4.5v17"/></symbol>
    <symbol id="i-doc" viewBox="0 0 24 24"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/></symbol>
    <symbol id="i-up" viewBox="0 0 24 24"><path d="M12 19V5m-6 6 6-6 6 6"/></symbol>
    <symbol id="i-seat" viewBox="0 0 24 24"><path d="M6 11V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v6"/><path d="M4 11h16v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM7 17v4M17 17v4"/></symbol>
  </defs>
</svg>
<div id="film">
  <div class="aura a1"></div><div class="aura a2"></div>
{{SCENES}}
  <div class="grain"></div>
  <div id="poster"><button type="button">▶ Play the film (silent preview)</button></div>
  <div id="ctrl"><button id="pauseBtn" type="button">⏸</button><div id="bars">{{BARS}}</div></div>
</div>
<script>
const SC = Array.from(document.querySelectorAll('.scene'));
const BARS = Array.from(document.querySelectorAll('#bars i'));
let cur = -1, paused = false, timer = null;
const outTimers = new Map();
function stop(sc){ if(!sc) return; sc.classList.add('out');
  if(window.__RENDER) return; clearTimeout(outTimers.get(sc)); outTimers.set(sc, setTimeout(()=>{ sc.classList.remove('act'); sc.classList.remove('out'); }, 720)); }
function go(n){
  if(n<0) n=0; if(n>=SC.length) n=SC.length-1;
  clearTimeout(timer);
  const prev = cur>-1 ? SC[cur] : null;
  cur = n;
  SC.forEach((s,i)=>{ if(i!==cur && s!==prev){ s.classList.remove('act'); s.classList.remove('out'); } });
  const sc = SC[cur]; sc.classList.remove('out'); sc.classList.add('act');
  if(prev && prev!==sc) stop(prev);
  BARS.forEach((b,i)=>{ b.className = i<cur ? 'done' : ''; b.style.setProperty('--d', SC[i].dataset.d+'ms'); });
  if(BARS[cur]){ void BARS[cur].offsetWidth; BARS[cur].className='run'; }
  if(!window.__RENDER) counters(sc);
  const d = +sc.dataset.d;
  if(cur < SC.length-1 && !paused) timer = setTimeout(()=>go(cur+1), d);
}
function counters(sc){
  sc.querySelectorAll('.cnt').forEach(el=>{
    const at=+(el.dataset.at||0), to=+el.dataset.to, suf=el.dataset.suf||'', pre=el.dataset.pre||'';
    el.textContent = pre+'0'+suf; let t0=null;
    setTimeout(()=>{ (function f(ts){ if(!t0)t0=ts; const k=Math.min(1,(ts-t0)/1000); el.textContent=pre+Math.round(to*(1-Math.pow(1-k,3)))+suf; if(k<1&&sc.classList.contains('act')) requestAnimationFrame(f); })(performance.now()); }, at);
  });
}
function pauseToggle(force){ paused = force!==undefined?force:!paused; document.body.classList.toggle('paused',paused); document.getElementById('pauseBtn').textContent = paused?'▶':'⏸'; clearTimeout(timer); if(!paused && cur<SC.length-1) go(cur); }
document.getElementById('pauseBtn').addEventListener('click',()=>pauseToggle());
document.getElementById('poster').addEventListener('click',()=>{ document.body.classList.add('rolling'); go(0); });
document.addEventListener('keydown',e=>{ if(e.key==='ArrowRight') go(cur+1); if(e.key==='ArrowLeft') go(cur-1); if(e.key===' '){ e.preventDefault(); pauseToggle(); } });
</script>
</body>
</html>
'''

page = HTML.replace('{{FONTS}}', FONTS).replace('{{SCENES}}', '\n'.join(S)).replace('{{BARS}}', '<i></i>' * len(S))
assert len(S) == len(LINES) == 16, (len(S), len(LINES))
open(OUT, 'w', encoding='utf-8').write(page)
print(f'wrote {os.path.relpath(OUT, ROOT)}: {len(S)} scenes, {sum(dur(i) for i in range(1, 17)) / 1000:.1f}s'
      + ('' if timing else ' (estimated: no timing file yet)'))
