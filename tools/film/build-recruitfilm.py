#!/usr/bin/env python3
"""Draw the recruiting film's page from its lines and its voice timing.

    python3 build-recruitfilm.py [recruit-timing.json]

Writes ../../agentmgt/film.html: twenty-two scenes, one per spoken line, in the recruiting page's own look
(onyx lifted off black, wine, Playfair and Inter, the wine shield). The second cut (26 October 2026, the
evening) is built around the digital branch: the leads board and the Lead Desk, factfind360, the live wall,
the day the system sets, Branch Intelligence, the clients matched to you, the FY27 flight plan, and the people
who coach. Every reveal that answers a word lands on that word: the timing file (from importvox.py --timing)
carries each word's start, and `at(n, word)` becomes that word's millisecond inside scene n, plus the 0.4 s the
mixer leads the voice by.

The page keeps render.js's contract: `SC`, `go(n)`, `paused`, `timer`, `.act` on the live scene, `.out` on the
one zooming away (cleared at 720 ms), `.cnt` counters with data-to and data-at, `#ctrl` and `#poster` hidden
while rendering. The same page renders both cuts: 1280x720 for the pages, 1080x1920 (RENDER_W/RENDER_H) for
Reels and Stories, through the portrait rules at the foot of the stylesheet.

Every name and figure on a mock screen is made up, and the mocks say so.

The motion pass of 26 October 2026, late ("add more motion and graphics to pop"): a wine band on every cut, a slow
push-in on every scene for its whole length (--kb), the cards floating and catching a passing light (.fl), every
counter popping as it lands (--at, written by scene()), sheens on the bars, the lead's arc from the phone to the
board, the thinking dots, the CONFIRMED stamp, applause rings, the rocket's trail and the stars, the lock's ring,
the gates' rings, the door that opens in scene 20 (the seat count is gone: the door is open), the scan line over
the QR and the rings off the closing mark.
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
    hits = [s for s, t in ws if t.lower().strip('.,?:!"').startswith(word.lower())]
    if len(hits) <= k:
        sys.exit(f'scene {n}: no word starting "{word}" (#{k}) in: {LINES[n - 1]}')
    return OFF + int(hits[k] * 1000)

def words(text, t0=0, step=80, cls=''):
    """A headline split to words for the kinetic entrance; the sentence stays one accessible name."""
    out = []
    for i, w in enumerate(text.split(' ')):
        out.append(f'<span class="w{(" " + cls) if cls else ""}"><i style="--i:{i};--t0:{t0}ms">{w}</i></span>')
    return f'<span aria-label="{text}">' + ' '.join(out) + '</span>'

def typed(text, t0, per=38):
    """A line that types itself, character by character, from t0 (ms per character). Words stay whole, so the
    line wraps where a line should."""
    out, i = [], 0
    for w in text.split(' '):
        chars = ''.join(f'<i style="--t:{t0 + (i + j) * per}ms">{ch}</i>' for j, ch in enumerate(w))
        out.append(f'<span class="tw">{chars}</span>'); i += len(w) + 1
    return f'<span class="ty" aria-label="{text}">{" ".join(out)}</span>'

MARK = '''<svg viewBox="6 3 76 82" class="mk" aria-hidden="true"><use href="#shield"/></svg>'''
SAMPLE = '<span class="sample">sample figures</span>'

def scene(n, kind, body, extra=''):
    body = re.sub(r'(class="cnt"[^>]*?data-at="(\d+)")', r'\1 style="--at:\2ms"', body)   # the pop when a counter lands
    return f'<section class="scene {kind}" data-d="{dur(n)}" data-n="{n}" style="--kb:{dur(n)}ms" {extra}>\n{body}\n<div class="streak"></div>\n</section>'

S = []

# 1 · the hook
S.append(scene(1, 's-hook', f'''
<div class="full center">
  <span class="ghost" aria-hidden="true">?</span>
  <span class="spot" style="--t0:{at(1,"stuck")}ms"></span>
  <p class="eye in" style="--t0:300ms">A question</p>
  <h1 class="h xl">{words("Good at what you do?", 500)}<br><em class="wine">{words("Stuck where you are?", at(1,"stuck") - 200)}</em></h1>
  <div class="ceil-line" style="--t0:{at(1,"stuck")}ms"></div>
  <p class="sub2 in" style="--t0:{at(1,"Or")}ms">Or wanting a career with no ceiling, <em class="wine">and afraid of the first year?</em></p>
</div>'''))

# 2 · talent and the tools
S.append(scene(2, 's-room', f'''
<div class="split">
  <div class="col">
    <p class="eye in" style="--t0:200ms">The truth about this business</p>
    <h2 class="h l">{words("Talent gets you in the game.", 400)}</h2>
    <h2 class="h l wine2">{words("The tools decide how far you go.", at(2,"tools") - 300)}</h2>
  </div>
  <div class="col chart" style="position:relative">
    <div class="bars">
      {''.join(f'<i style="--h:{h}%;--t0:{600 + i*110}ms"></i>' for i, h in enumerate([28,36,44,52,61,70,80,92]))}
      <div class="lid" style="--t0:{at(2,"decide") + 300}ms"></div>
      <div class="ceil" style="--t0:{at(2,"decide") + 300}ms"><span>the old tools</span></div>
    </div>
    {''.join(f'<span class="spk" style="--x:{6 + (i*41)%88}%;--dx:{(i*17)%30 - 15};--t0:{at(2,"decide") + 500 + (i*37)%420}ms;--c:{["#E85F6A","#fff","#F5CBD0"][i%3]}"></span>' for i in range(16))}
  </div>
</div>'''))

# 3 · the branch, with the stage: the five gates inside, the five tools outside
RING_IN = ''.join(f'<li style="--a:{a}deg;--i:{i}"><span class="spin"><b>{i+1}</b></span></li>' for i, a in enumerate([270,342,54,126,198]))
RING_OUT_ICONS = ['spark','doc','chart','bolt','users']
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
    <div class="fy in" style="--t0:{at(3,"brand")}ms"><b>FY27</b><span>A new year, from 1 October</span></div>
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
  <span class="burst" style="--t0:{at(4,"differently")}ms"></span><span class="burst b2" style="--t0:{at(4,"Human")}ms"></span>
  <div class="rule" style="--t0:{at(4,"differently")}ms"></div>
  <h2 class="h m duo"><span class="dg">{words("Digital everywhere.", at(4,"Digital") - 150, 100)}</span> <span class="hu">{words("Human at the heart of it.", at(4,"Human") - 150, 100)}</span></h2>
</div>'''))

# 5 · leads: the link, the code, the board
PICKS = ['My family, if something happens to me', 'The house and the mortgage', 'Retiring properly', 'Check what I already have']
S.append(scene(5, 's-leads', f'''
<div class="split wide">
  <div class="col">
    <p class="eye in" style="--t0:200ms">Leads</p>
    <h2 class="h l">{words("Leads land on your board.", at(5,"Leads") - 200)}</h2>
    <p class="sub in" style="--t0:{at(5,"link")}ms">Your own link. Your own QR code. A prospect taps what is on their mind.</p>
    <div class="qr mini in" style="--t0:{at(5,"QR")}ms"><svg viewBox="0 0 41 41" aria-hidden="true"><path d="{QR}"/></svg><span>Your code</span></div>
  </div>
  <div class="col">
    <div class="lead-wrap">
      <svg class="arcpath" viewBox="0 0 400 240" preserveAspectRatio="none" aria-hidden="true"><path class="ap" style="--t0:{at(5,"lands") - 700}ms" d="M80 150 C 150 40, 230 40, 330 90"/><path class="ap comet" style="--t0:{at(5,"lands") - 700}ms" d="M80 150 C 150 40, 230 40, 330 90"/></svg>
      <div class="phone in fl" style="--t0:{at(5,"link")}ms">
        <div class="ph-top"><b>Hi Keisha</b><span>from your advisor</span></div>
        <p class="ph-q">What is on your mind?</p>
        <ul class="picks">
          {''.join(f'<li class="{"on" if i in (0,2) else ""}" style="--t0:{at(5,"taps") + i*260}ms"><i></i>{p}</li>' for i, p in enumerate(PICKS))}
        </ul>
        <div class="ph-btn tap" style="--t0:{at(5,"lead",1)}ms">Call me</div>
        {SAMPLE}
      </div>
      <div class="board in fl" style="--t0:{at(5,"board") - 500}ms">
        <div class="bd-h"><b>Your board</b><span class="live"><i></i>live</span></div>
        <div class="tiles4">
          <div><b class="cnt" data-to="14" data-at="{at(5,"board")}">14</b><span>sent</span></div>
          <div><b class="cnt" data-to="11" data-at="{at(5,"board") + 120}">11</b><span>opened</span></div>
          <div><b class="cnt" data-to="8" data-at="{at(5,"board") + 240}">8</b><span>watched</span></div>
          <div class="hot"><b class="cnt" data-to="5" data-at="{at(5,"board") + 360}">5</b><span>booked</span></div>
        </div>
        <div class="lead-card fly" style="--t0:{at(5,"lands")}ms"><b>Keisha</b><span>my family · retiring properly</span><em>this week, evenings</em></div>
        <div class="lead-row dim"><b>Andre</b><span>the house and the mortgage</span></div>
        <div class="lead-row dim"><b>Priya</b><span>check what I already have</span></div>
      </div>
    </div>
  </div>
</div>'''))

# 6 · the Lead Desk
S.append(scene(6, 's-desk', f'''
<div class="split">
  <div class="col">
    <p class="eye in" style="--t0:200ms">The Lead Desk</p>
    <h2 class="h l">{words("Your opening, written from their words.", at(6,"writes") - 300)}</h2>
    <div class="pill-row">
      <span class="npill in" style="--t0:{at(6,"Not")}ms"><s>A product pitch</s></span>
      <span class="ypill in" style="--t0:{at(6,"appointment")}ms">An appointment</span>
    </div>
    <div class="fwd in" style="--t0:{at(6,"forwarded")}ms"><svg class="ic"><use href="#i-fwd"/></svg><span>Forwarded to a friend?</span><b>Still yours.</b></div>
  </div>
  <div class="col">
    <div class="desk in fl" style="--t0:{at(6,"Lead")}ms">
      <p class="dk-h">Call script · Keisha</p>
      <p class="dk-l">{typed("Good evening, is that Keisha? You put your number in on our page and asked me to call.", at(6,"opening"), 26)}</p>
      <p class="dk-l hl">{typed("You told me what was on your mind was your family, if something happened to you, and retiring properly.", at(6,"from"), 26)}</p>
      <p class="dk-q">{typed("Who depends on your income right now, and for how long would they need it?", at(6,"told") + 900, 26)}</p>
      {SAMPLE}
    </div>
  </div>
</div>'''))

# 7 · factfind360: the arithmetic while you talk
S.append(scene(7, 's-ff', f'''
<div class="split">
  <div class="col">
    <p class="eye in" style="--t0:200ms">factfind360</p>
    <h2 class="h l">{words("The arithmetic, while you talk.", at(7,"arithmetic") - 500)}</h2>
    <ul class="steps3">
      <li class="in" style="--t0:{at(7,"signs")}ms"><i>1</i>Your manager signs it</li>
      <li class="in" style="--t0:{at(7,"confirms")}ms"><i>2</i>The client confirms it</li>
      <li class="in zero" style="--t0:{at(7,"not")}ms"><b>0</b><span>cases lapsed since launch</span></li>
    </ul>
  </div>
  <div class="col">
    <div class="calc in fl" style="--t0:{at(7,"table")}ms">
      <p class="dk-h">The need, in dollars</p>
      <div class="crow" style="--t0:{at(7,"arithmetic")}ms"><span>Income replacement</span><b>TT$<em class="cnt" data-to="1240" data-pre="" data-suf="k" data-at="{at(7,"arithmetic")}">1240k</em></b></div>
      <div class="crow" style="--t0:{at(7,"arithmetic") + 500}ms"><span>The mortgage</span><b>TT$<em class="cnt" data-to="620" data-suf="k" data-at="{at(7,"arithmetic") + 500}">620k</em></b></div>
      <div class="crow" style="--t0:{at(7,"arithmetic") + 1000}ms"><span>Education</span><b>TT$<em class="cnt" data-to="310" data-suf="k" data-at="{at(7,"arithmetic") + 1000}">310k</em></b></div>
      <div class="ctot" style="--t0:{at(7,"dollars")}ms"><span>Protection gap</span><b>TT$<em class="cnt" data-to="2170" data-suf="k" data-at="{at(7,"dollars")}">2170k</em></b></div>
      <div class="sig" style="--t0:{at(7,"signs")}ms"><svg viewBox="0 0 220 50" aria-hidden="true"><path d="M6 36c18-30 28-28 30-10s8 14 20-6 16-16 22 2 6 20 22 6 14-24 26-6 10 22 24 8 12-20 26-6 12 12 26 2" fill="none" stroke="#17191F" stroke-width="2.4" stroke-linecap="round"/></svg><span>Manager · signed</span></div>
      <div class="conf in" style="--t0:{at(7,"confirms")}ms"><i></i>Client confirmed from their inbox</div>
      <div class="stamp" style="--t0:{at(7,"confirms") + 350}ms">Confirmed</div>
      {SAMPLE}
    </div>
  </div>
</div>'''))

# 8 · dashboards everywhere: the live wall
WALL_BARS = [('You', 92, True), ('N.', 74, False), ('F.', 66, False), ('D.', 58, False), ('M.', 44, False)]
S.append(scene(8, 's-wall', f'''
<div class="split wide">
  <div class="col">
    <p class="eye in" style="--t0:200ms">Dashboards everywhere</p>
    <h2 class="h l">{words("The wall is live.", at(8,"live") - 500)}</h2>
    <p class="sub in" style="--t0:{at(8,"screen")}ms">On the screen in the branch, and on your phone.</p>
    <div class="nosheet in" style="--t0:{at(8,"Nothing")}ms"><svg class="ic"><use href="#i-grid"/></svg><s>the spreadsheet</s></div>
  </div>
  <div class="col">
    <div class="wall-wrap">
      <div class="wall in fl" style="--t0:{at(8,"wall") - 300}ms">
        <div class="bd-h"><b>Production</b><span class="live"><i></i>live</span></div>
        <div class="tiles3">
          <div style="--t0:{at(8,"week")}ms"><b class="cnt" data-to="4" data-at="{at(8,"week")}">4</b><span>apps this week</span></div>
          <div style="--t0:{at(8,"year")}ms"><b class="cnt" data-to="31" data-at="{at(8,"year")}">31</b><span>this year</span></div>
          <div class="hot" style="--t0:{at(8,"pace")}ms"><b class="cnt" data-to="108" data-suf="%" data-at="{at(8,"pace")}">108%</b><span>of pace</span></div>
        </div>
        <div class="wbars">
          {''.join(f'<div class="wb{" you" if y else ""}" style="--w:{w}%;--t0:{at(8,"live") + i*140}ms"><span>{n}</span><i></i></div>' for i, (n, w, y) in enumerate(WALL_BARS))}
        </div>
        {SAMPLE}
      </div>
      <div class="phone small in" style="--t0:{at(8,"phone")}ms">
        <div class="ph-top"><b>My workday</b><span>today</span></div>
        <div class="ring-p" style="--t0:{at(8,"phone") + 200}ms"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="42"/><circle class="arc" cx="50" cy="50" r="42"/></svg><b class="cnt" data-to="108" data-suf="%" data-at="{at(8,"phone") + 200}">108%</b></div>
        <p class="ph-s">ahead of the day</p>
      </div>
    </div>
  </div>
</div>'''))

# 9 · the system sets your day
S.append(scene(9, 's-day', f'''
<div class="split">
  <div class="col">
    <p class="eye in" style="--t0:200ms">Every morning</p>
    <h2 class="h l">{words("The system sets your day.", at(9,"sets") - 400)}</h2>
    <p class="sub in" style="--t0:{at(9,"Check")}ms">Check in, and the page shows what you have achieved, as you go.</p>
  </div>
  <div class="col">
    <div class="day in fl" style="--t0:{at(9,"system")}ms">
      <div class="prog"><i style="--t0:{at(9,"achieved")}ms"></i><b><em class="cnt" data-to="78" data-suf="%" data-at="{at(9,"achieved")}">78%</em> of the day</b></div>
      <div class="ck tap" style="--t0:{at(9,"Check")}ms"><span class="before">Check in</span><span class="after"><i></i>Checked in · 6:02</span></div>
      <ul class="dlist">
        <li style="--t0:{at(9,"projection")}ms;--t1:{at(9,"achieved") + 200}ms"><svg class="ic"><use href="#i-target"/></svg><b>Your projection</b><span>12 calls · 3 appointments</span></li>
        <li style="--t0:{at(9,"calls")}ms;--t1:{at(9,"achieved") + 500}ms"><svg class="ic"><use href="#i-phone"/></svg><b>Next calls</b><span>Keisha · Andre · Priya</span></li>
        <li style="--t0:{at(9,"pending")}ms;--t1:{at(9,"achieved") + 800}ms"><svg class="ic"><use href="#i-doc"/></svg><b>Pending cases</b><span>2 · with the history on them</span></li>
      </ul>
      {SAMPLE}
    </div>
  </div>
</div>'''))

# 10 · Branch Intelligence
S.append(scene(10, 's-ai', f'''
<div class="split">
  <div class="col">
    <p class="eye in" style="--t0:200ms">Branch Intelligence</p>
    <h2 class="h l">{words("One tap. The whole file, read.", at(10,"tap") - 300)}</h2>
    <div class="duo2">
      <span class="ypill big in" style="--t0:{at(10,"decide")}ms">You decide.</span>
      <span class="npill big in" style="--t0:{at(10,"prepares")}ms">It prepares.</span>
    </div>
  </div>
  <div class="col">
    <div class="file in fl" style="--t0:{at(10,"hard")}ms">
      <div class="bd-h"><b>Client file</b><span>4 policies · 6 notes · 2 e-mails</span></div>
      <div class="flines"><i></i><i class="short"></i><i></i><i class="short"></i><i></i></div>
      <div class="scan" style="--t0:{at(10,"reads")}ms"></div>
      <div class="think" style="--t0:{at(10,"reads") + 500}ms;--t1:{at(10,"stands")}ms"><i></i><i></i><i></i></div>
      <div class="ai" style="--t0:{at(10,"stands")}ms">
        <p><b>Where it stands</b>{typed("Premium 41 days due. Wrote in on Tuesday asking for a call.", at(10,"stands") + 200, 24)}</p>
        <p style="--t0:{at(10,"first")}ms"><b>Say first</b>{typed("Thank them for writing. Confirm what the policy pays before anything else.", at(10,"first") + 100, 24)}</p>
      </div>
      {SAMPLE}
    </div>
  </div>
</div>'''))

# 11 · the people coach
DAYS = ['Mon','Tue','Wed','Thu','Fri']
S.append(scene(11, 's-coach', f'''
<div class="split">
  <div class="col">
    <p class="eye in" style="--t0:200ms">The human part</p>
    <h2 class="h l">{words("The digital carries.", 400)}</h2>
    <h2 class="h l wine2">{words("The people coach.", at(11,"people") - 300)}</h2>
  </div>
  <div class="col">
    <div class="corner">
      <span class="brk tl"></span><span class="brk br"></span>
      <div class="chips3">
        <div class="chip in fl" style="--t0:{at(11,"interviews")}ms"><svg class="ic"><use href="#i-users"/></svg><b>Interviewed by the Branch Manager</b></div>
        <div class="chip in fl" style="--t0:{at(11,"coaches")}ms"><svg class="ic"><use href="#i-up"/></svg><b>Coached after</b></div>
        <div class="week in" style="--t0:{at(11,"week")}ms">
          {''.join(f'<span class="{"fri" if d == "Fri" else ""}" style="--t0:{at(11,"Friday") if d == "Fri" else 0}ms">{d}</span>' for d in DAYS)}
        </div>
        <div class="chip in fl" style="--t0:{at(11,"sits")}ms"><svg class="ic"><use href="#i-chat"/></svg><b>Your unit manager sits with you on it</b></div>
      </div>
    </div>
  </div>
</div>'''))

# 12 · clients matched to you
HH = [('The Ramlogan household', '3 policies · since 2014'), ('The Charles household', '2 policies · since 2019'), ('The Ali household', '4 policies · since 2008')]
S.append(scene(12, 's-match', f'''
<div class="split">
  <div class="col">
    <p class="eye in" style="--t0:200ms">Afraid you'd start from zero?</p>
    <h2 class="h l">{words("You won't.", at(12,"won") - 150, 160)}</h2>
    <p class="sub in" style="--t0:{at(12,"matched") - 300}ms">Clients whose agent has moved on are <b>matched to you</b>, household by household.</p>
    <div class="pill-row">
      <span class="ypill in" style="--t0:{at(12,"file")}ms">The file</span>
      <span class="ypill in" style="--t0:{at(12,"history")}ms">The history</span>
      <span class="ypill in" style="--t0:{at(12,"first")}ms">The first thing to say</span>
    </div>
  </div>
  <div class="col">
    <div class="list in fl" style="--t0:{at(12,"Clients")}ms">
      <div class="bd-h"><b>Your list</b><span>named to you</span></div>
      {''.join(f'<div class="hh" style="--t0:{at(12,"matched") + i*380}ms"><svg class="ic"><use href="#i-home"/></svg><b>{n}</b><span>{s}</span><em>named</em></div>' for i, (n, s) in enumerate(HH))}
      {SAMPLE}
    </div>
  </div>
</div>'''))

# 13 · recognition on stage
S.append(scene(13, 's-stage', f'''
<div class="split">
  <div class="col">
    <p class="eye in" style="--t0:200ms">Recognition</p>
    <h2 class="h l">{words("Your name, said out loud.", at(13,"announced") - 300)}</h2>
    <div class="bubble in" style="--t0:400ms;--t1:{at(13,"celebrated") - 100}ms"><span>congrats bro!!</span><span>seen · 2:41 pm · no reply</span></div>
    <div class="dates">
      <div class="date in" style="--t0:{at(13,"Wednesday")}ms"><b>Wednesday</b><span>every week</span></div>
      <div class="date in" style="--t0:{at(13,"Blastoff")}ms"><b>Blastoff</b><span>January</span></div>
      <div class="date in" style="--t0:{at(13,"Mid")}ms"><b>Mid-Year</b><span>July</span></div>
    </div>
  </div>
  <div class="col">
    <div class="podium">
      <div class="light" style="--t0:{at(13,"stage") - 400}ms"></div>
      <div class="plate in" style="--t0:{at(13,"stage")}ms"><small>MDRT qualifier</small><b>Your name</b></div>
      <div class="floor"></div>
      <span class="ring-a" style="--t0:{at(13,"name")}ms"></span><span class="ring-a" style="--t0:{at(13,"name") + 500}ms"></span><span class="ring-a" style="--t0:{at(13,"name") + 1000}ms"></span>
      {''.join(f'<span class="conf" style="--x:{8 + (i*37)%86}%;--t0:{at(13,"name") + (i*53)%700}ms;--c:{["#E85F6A","#fff","#F5CBD0","#D33F49"][i%4]}"></span>' for i in range(22))}
    </div>
  </div>
</div>'''))

# 14 · the path is your call
S.append(scene(14, 's-path', f'''
<div class="split wide">
  <div class="col">
    <p class="eye in" style="--t0:200ms">The career path</p>
    <h2 class="h l">{words("Where you go is your call.", 400)}</h2>
    <p class="sub in" style="--t0:{at(14,"rungs")}ms">The rungs are written down.</p>
    <div class="choose in" style="--t0:{at(14,"choose")}ms"><span class="knob"></span><b>You choose the ladder.</b></div>
  </div>
  <div class="col">
    <div class="ladders">
      <ol class="ladder">
        <p class="lad-h in" style="--t0:{at(14,"Build")}ms">Build a book</p>
        <li class="in" style="--t0:{at(14,"Build") + 200}ms"><b>Career Sales Representative</b><span>Training, induction, boot camp</span></li>
        <li class="in" style="--t0:{at(14,"Build") + 500}ms"><b>Executive Agent</b><span>Overrides, a private office</span></li>
        <li class="in top" style="--t0:{at(14,"Build") + 800}ms"><b>Senior Sales Consultant</b><span>The top of the professional road</span></li>
        <span class="rail" style="--t0:{at(14,"Build")}ms"></span>
      </ol>
      <ol class="ladder">
        <p class="lad-h in" style="--t0:{at(14,"lead")}ms">Or lead</p>
        <li class="in" style="--t0:{at(14,"Emerging")}ms"><b>Emerging Leaders Program</b><span>By Branch Manager recommendation</span></li>
        <li class="in" style="--t0:{at(14,"Unit")}ms"><b>Unit Manager</b><span>Recruit, build and run a unit</span></li>
        <li class="in top" style="--t0:{at(14,"branch")}ms"><b>Branch Manager</b><span>A branch of your own</span></li>
        <span class="rail" style="--t0:{at(14,"lead")}ms"></span>
      </ol>
    </div>
  </div>
</div>'''))

# 15 · uncapped
S.append(scene(15, 's-income', f'''
<div class="split">
  <div class="col">
    <p class="eye in" style="--t0:200ms">The income</p>
    <h2 class="h xl">{words("Uncapped.", at(15,"uncapped") - 200, 80)}</h2>
    <h2 class="h m wine2">{words("No salary band. No ceiling.", at(15,"No") - 100, 120)}</h2>
    <div class="pill-row">
      <span class="ypill in" style="--t0:{at(15,"not")}ms">Not your phone contacts</span>
      <span class="ypill in" style="--t0:{at(15,"leads")}ms">The leads come to you</span>
    </div>
    <p class="sub in" style="--t0:{at(15,"scales")}ms">It scales with your activity and your skill.</p>
  </div>
  <div class="col">
    <svg class="graph" viewBox="0 0 400 300" aria-hidden="true">
      <defs><linearGradient id="gl" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#E85F6A" stop-opacity=".2"/><stop offset="1" stop-color="#E85F6A"/></linearGradient><linearGradient id="ga" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E85F6A" stop-opacity=".45"/><stop offset="1" stop-color="#E85F6A" stop-opacity="0"/></linearGradient></defs>
      <g class="ggrid">{''.join(f'<line x1="20" x2="380" y1="{y}" y2="{y}"/>' for y in (60,130,200,270))}</g>
      <path class="area" style="--t0:{at(15,"scales") + 900}ms" d="M20,270 70,250 120,238 170,215 220,196 260,160 300,120 340,70 380,10 L380 300 L20 300Z"/>
      <g class="band" style="--t0:{at(15,"No")}ms"><rect x="20" y="150" width="360" height="60" rx="6"/><text x="36" y="186">salary band</text></g>
      <polyline class="line" style="--t0:{at(15,"scales") - 200}ms" points="20,270 70,250 120,238 170,215 220,196 260,160 300,120 340,70 380,10"/>
      <circle class="dot" style="--t0:{at(15,"ceiling")}ms" cx="380" cy="10" r="7"/>
    </svg>
  </div>
</div>'''))

# 16 · the FY27 flight plan
STAGES = ['Your why', 'Your budget', 'Your income', 'Your API', 'Your week', 'How you work', 'GO']
S.append(scene(16, 's-flight', f'''
<div class="split wide">
  <div class="col">
    <p class="eye in" style="--t0:200ms">FY27 Flight Plan</p>
    <h2 class="h l">{words("Your year has a flight plan.", at(16,"flight") - 400)}</h2>
    <div class="figs">
      <div class="fig in" style="--t0:{at(16,"Fifteen")}ms"><b><em class="cnt" data-to="15" data-at="{at(16,"Fifteen")}">15</em> min</b><span>to file it</span></div>
      <div class="fig in" style="--t0:{at(16,"costs")}ms"><b>7</b><span>stages, from your budget</span></div>
    </div>
  </div>
  <div class="col">
    <div class="flight in" style="--t0:{at(16,"flight") - 200}ms">
      <svg viewBox="0 0 400 240" aria-hidden="true">
        <path class="traj" style="--t0:{at(16,"Start")}ms" d="M20 210 C 120 210, 190 180, 240 120 S 340 30, 380 20"/>
        {''.join(f'<g class="st" style="--t0:{at(16,"Start") + i*320}ms"><circle cx="{x}" cy="{y}" r="9"/>{"" if i == 6 else f"<text x=\"{x}\" y=\"{y + (28 if i % 2 == 0 else -18)}\">{s}</text>"}</g>' for i, (s, (x, y)) in enumerate(zip(STAGES, [(20,210),(80,208),(140,200),(200,170),(250,110),(300,65),(380,20)])))}
        {''.join(f'<circle class="star" cx="{x}" cy="{y}" r="{r}" style="--dl:{(i*7)%23/10}s"/>' for i,(x,y,r) in enumerate([(300,180,2.2),(350,150,1.6),(120,60,1.8),(60,120,1.4),(250,40,2),(180,120,1.3),(370,110,1.5)]))}
        <circle class="rocket trail t2" style="--t0:{at(16,"Start") + 260}ms" r="3"/>
        <circle class="rocket trail t1" style="--t0:{at(16,"Start") + 130}ms" r="5"/>
        <circle class="rocket" style="--t0:{at(16,"Start")}ms" r="7"/>
      </svg>
      <div class="go" style="--t0:{at(16,"GO",1)}ms"><small>Your name</small><b>GO</b></div>
    </div>
  </div>
</div>'''))

# 17 · confidential
S.append(scene(17, 's-lock', f'''
<div class="full center">
  <div class="lock in" style="--t0:300ms;--t1:{at(17,"confidential")}ms"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path class="shackle" style="--t0:{at(17,"confidential")}ms" d="M8 11V7a4 4 0 0 1 8 0v4"/></svg></div>
  <h2 class="h l">{words("Already contracted somewhere else?", 500)}</h2>
  <h2 class="h l wine2">{words("Your conversation with us stays confidential.", at(17,"conversation") - 300)}</h2>
</div>'''))

# 18 · newcomers
S.append(scene(18, 's-new', f'''
<div class="split">
  <div class="col">
    <p class="eye in" style="--t0:200ms">Newcomers</p>
    <h2 class="h l">{words("New to insurance? That’s normal.", 400)}</h2>
    <p class="sub in" style="--t0:{at(18,"full")}ms">You get the full build.</p>
    <div class="buildbar" style="--t0:{at(18,"training")}ms;--t1:{at(18,"every") - at(18,"training") + 900}ms"><i></i></div>
  </div>
  <div class="col">
    <ul class="checks">
      <li style="--t0:{at(18,"training")}ms"><i></i>Training</li>
      <li style="--t0:{at(18,"boot")}ms"><i></i>Boot camp</li>
      <li style="--t0:{at(18,"one")}ms"><i></i>One-on-one coaching</li>
      <li style="--t0:{at(18,"every")}ms"><i></i>Every one of these tools, from day one</li>
    </ul>
  </div>
</div>'''))

# 19 · we select
GATES = ['Apply & screen','Meet the Branch Manager','Discovery','Assessment','Selection']
S.append(scene(19, 's-gates', f'''
<div class="full">
  <p class="eye in" style="--t0:200ms">The selection</p>
  <h2 class="h l">{words("We don’t fill seats. We select.", 400)}</h2>
  <ol class="gates">
    {''.join(f'<li style="--t0:{at(19,"Five") + 350*i}ms"><b>{i+1}</b><span>{g}</span></li>' for i, g in enumerate(GATES))}
    <span class="gline" style="--t0:{at(19,"Five")}ms"></span>
  </ol>
  <p class="sub big in" style="--t0:{at(19,"Discovery")}ms">At your Discovery you sit with our qualifiers and ask them anything, <em>without the Branch Manager in the room.</em></p>
</div>'''))

# 20 · the door is open
S.append(scene(20, 's-door', f'''
<div class="full center">
  <p class="eye in" style="--t0:200ms">One conversation</p>
  <h2 class="h xl">{words("The door is open.", 400, 120)}</h2>
  <div class="door-row">
    <div class="who in fl" style="--t0:{at(20,"Already")}ms"><b>Already contracted?</b><span>Nobody will know you asked.</span><i class="lock-s"><svg class="ic"><use href="#i-lock"/></svg> Confidential</i></div>
    <div class="door" style="--t0:{at(20,"open")}ms">
      <div class="d-glow"></div>
      <div class="d-frame"><div class="d-light"></div><div class="d-leaf l"></div><div class="d-leaf r"></div></div>
      {''.join(f'<span class="d-ray" style="--a:{a}deg"></span>' for a in (-28,-14,0,14,28))}
    </div>
    <div class="who in fl" style="--t0:{at(20,"New")}ms"><b>New to this?</b><span>You get the full build.</span><i class="lock-s"><svg class="ic"><use href="#i-spark"/></svg> Training · boot camp · coaching</i></div>
  </div>
  <div class="figs row">
    <div class="fig in" style="--t0:{at(20,"One")}ms"><b><em class="cnt" data-to="1" data-at="{at(20,"One")}">1</em></b><span>confidential conversation</span></div>
    <div class="fig in" style="--t0:{at(20,"Twenty")}ms"><b><em class="cnt" data-to="20" data-at="{at(20,"Twenty")}">20</em> min</b><span>this week</span></div>
  </div>
</div>'''))

# 21 · the call
S.append(scene(21, 's-cta', f'''
<div class="split cta">
  <div class="col">
    <p class="eye in" style="--t0:200ms">Start here</p>
    <h2 class="h url">{words("agentmgt.com", 400, 60)}</h2>
    <div class="btns">
      <span class="btn b1 in" style="--t0:{at(21,"Book")}ms">Book a confidential conversation →</span>
      <span class="btn b2 in" style="--t0:{at(21,"Take")}ms">Take the 60-second test first</span>
    </div>
  </div>
  <div class="col">
    <div class="qr in" style="--t0:{at(21,"Go")}ms"><svg viewBox="0 0 41 41" aria-hidden="true"><path d="{QR}"/></svg><i class="scanl"></i><span>Scan to book</span></div>
  </div>
</div>'''))

# 22 · the close
S.append(scene(22, 's-close dark', f'''
<div class="full center">
  <div class="mark big in" style="--t0:200ms"><span class="ping"></span><span class="ping p2"></span><span class="ping p3"></span>{MARK}</div>
  <h1 class="h xl">{words("The environment decides.", 500, 110)}<br><em class="wine">{words("We select the driven.", at(22,"We") - 200, 110)}</em></h1>
  <p class="foot in" style="--t0:{at(22,"driven")}ms">Ricky Rampersad Branch · Guardian Life of the Caribbean · Chaguanas · <b>agentmgt.com</b></p>
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
  --a:#D33F49; --aD:#B22F3A; --aL:#E85F6A; --aT:#F08A91; --ok:#3DBE7A;
  --display:'PlayfairF',Georgia,serif; --text:'InterF',system-ui,sans-serif;
  --ease:cubic-bezier(.2,.7,.2,1); --out:cubic-bezier(.16,1,.3,1); --pop:cubic-bezier(.2,1.3,.4,1);
}
*{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%;background:var(--bg);color:var(--ink);font-family:var(--text);overflow:hidden}
#film{position:relative;width:100vw;height:100vh;overflow:hidden;background:radial-gradient(120% 80% at 80% 10%,#303644,transparent 60%),linear-gradient(170deg,var(--bg2),var(--bg) 70%)}
#film::before{content:'';position:absolute;inset:0;background-image:radial-gradient(rgba(255,255,255,.07) 1px,transparent 1.5px);background-size:calc(var(--u)*3.6) calc(var(--u)*3.6);-webkit-mask-image:radial-gradient(70% 70% at 60% 40%,#000 30%,transparent 100%);mask-image:radial-gradient(70% 70% at 60% 40%,#000 30%,transparent 100%);animation:mesh 40s linear infinite}
@keyframes mesh{to{background-position:calc(var(--u)*3.6) calc(var(--u)*3.6)}}
.aura{position:absolute;width:70vmax;height:70vmax;border-radius:50%;pointer-events:none;filter:blur(calc(var(--u)*6));opacity:.55}
.aura.a1{left:-20vmax;top:-20vmax;background:radial-gradient(circle,rgba(211,63,73,.32),transparent 65%);animation:drift 22s ease-in-out infinite alternate}
.aura.a2{right:-25vmax;bottom:-30vmax;background:radial-gradient(circle,rgba(110,118,134,.35),transparent 65%);animation:drift 27s ease-in-out infinite alternate-reverse}
@keyframes drift{to{transform:translate(8vmax,6vmax) scale(1.12)}}
.grain{position:absolute;inset:-10%;pointer-events:none;opacity:.07;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)'/%3E%3C/svg%3E");animation:grain 1.4s steps(6) infinite}
@keyframes grain{to{transform:translate(-6%,4%)}}
.motes{position:absolute;inset:0;pointer-events:none;overflow:hidden}
.motes i{position:absolute;bottom:-4%;left:var(--x);width:calc(var(--u)*.7);height:calc(var(--u)*.7);border-radius:50%;background:rgba(232,95,106,.55);filter:blur(1px);animation:mote var(--d) linear infinite;animation-delay:var(--dl)}
@keyframes mote{to{transform:translateY(-115vh) translateX(calc(var(--u)*6));opacity:0}}

/* ── scenes ── */
.scene{position:absolute;inset:0;opacity:0;pointer-events:none;padding:calc(var(--u)*9) calc(var(--u)*10) calc(var(--u)*22);display:grid}
.scene.act{opacity:1;pointer-events:auto;animation:scene-in .9s var(--out) both;z-index:2}
@keyframes scene-in{from{opacity:0;transform:scale(1.05);filter:blur(10px)}to{opacity:1;transform:none;filter:blur(0)}}
.scene.out{opacity:1;z-index:1;animation:scene-out .72s var(--ease) both}
@keyframes scene-out{to{opacity:0;transform:scale(.94) translateY(-2%);filter:blur(8px)}}
.streak{position:absolute;inset:0;pointer-events:none;background:linear-gradient(105deg,transparent 36%,rgba(211,63,73,.45) 46%,rgba(255,255,255,.3) 50%,rgba(211,63,73,.45) 54%,transparent 64%);transform:translateX(-130%);z-index:4}
.scene.act .streak{animation:streak .85s var(--ease) both}
.scene.act>.full,.scene.act>.split{animation:kb var(--kb) linear both}
@keyframes kb{from{transform:scale(1)}to{transform:scale(1.035)}}
@keyframes streak{to{transform:translateX(120%)}}
.full{display:grid;align-content:center;gap:calc(var(--u)*2)}
.center{text-align:center;justify-items:center}
.split{display:grid;grid-template-columns:1.05fr .95fr;gap:calc(var(--u)*8);align-items:center}
.split.wide{grid-template-columns:.85fr 1.15fr}
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
.h.duo{margin-top:calc(var(--u)*2);font-weight:600}
.h.duo .dg{color:#fff}.h.duo .hu{color:var(--aL);font-style:italic}
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
.scene.act .in.fl{animation:up .8s var(--out) both,hover 7s ease-in-out infinite;animation-delay:var(--t0,0ms),calc(var(--t0,0ms) + .8s)}
@keyframes hover{0%,100%{transform:translateY(0) rotate(0)}50%{transform:translateY(calc(var(--u)*-1.1)) rotate(.35deg)}}
.fl{overflow:hidden}
.fl::after{content:'';position:absolute;inset:0;border-radius:inherit;pointer-events:none;z-index:3;background:linear-gradient(115deg,transparent 38%,rgba(255,255,255,.22) 50%,transparent 62%);transform:translateX(-130%)}
.scene.act .fl::after{animation:glare 5.5s ease-in-out infinite;animation-delay:calc(var(--t0,0ms) + 1.3s)}
@keyframes glare{0%{transform:translateX(-130%)}36%,100%{transform:translateX(130%)}}
.cnt{display:inline-block}
.scene.act .cnt{animation:land .55s var(--pop) both;animation-delay:calc(var(--at,0ms) + .95s)}
@keyframes land{0%{transform:scale(1)}40%{transform:scale(1.22);filter:brightness(1.35)}100%{transform:scale(1)}}
.sheen{position:relative;overflow:hidden}
.sheen::after{content:'';position:absolute;inset:0;background:linear-gradient(90deg,transparent 30%,rgba(255,255,255,.45) 50%,transparent 70%);transform:translateX(-120%)}
.scene.act .sheen::after{animation:glare 2.4s ease-in-out infinite;animation-delay:calc(var(--t0,0ms) + 1.2s)}
@keyframes up{from{opacity:0;transform:translateY(calc(var(--u)*3))}to{opacity:1;transform:none}}
.ty .tw{display:inline-block;white-space:nowrap}
.ty i{font-style:inherit;opacity:0}
.scene.act .ty i{animation:ch .05s linear both;animation-delay:var(--t)}
@keyframes ch{to{opacity:1}}
.sample{position:absolute;right:calc(var(--u)*1.6);bottom:calc(var(--u)*1.2);font:600 calc(var(--u)*1.5)/1 var(--text);letter-spacing:.12em;text-transform:uppercase;color:var(--mute2);opacity:.75}

/* ── shared pieces ── */
.mk{width:100%;height:auto;display:block;filter:drop-shadow(0 calc(var(--u)*2) calc(var(--u)*4) rgba(90,20,27,.5))}
.ic{width:1em;height:1em;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.figs{display:flex;gap:calc(var(--u)*6);margin-top:calc(var(--u)*1)}
.figs.row{justify-content:center;gap:calc(var(--u)*10)}
.fig b{display:block;font:800 calc(var(--u)*9)/1 var(--display);color:#fff;letter-spacing:-.03em;font-variant-numeric:tabular-nums}
.fig b em{font-style:normal;color:var(--aL)}
.fig span{display:block;margin-top:.4em;font-size:calc(var(--u)*2.4);color:var(--mute);letter-spacing:.04em}
.sub2{margin-top:calc(var(--u)*2.2);font-size:calc(var(--u)*3.2);line-height:1.35;color:var(--mute);max-width:46ch}
.sub2 em{color:var(--aT);font-style:normal;font-weight:600}
.door-row{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:calc(var(--u)*5);width:100%;max-width:calc(var(--u)*150);margin:0 auto}
.who{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14);border-radius:calc(var(--u)*2.4);padding:calc(var(--u)*2.8) calc(var(--u)*3.2);text-align:left}
.who b{display:block;font:800 calc(var(--u)*3.8)/1.1 var(--display);color:#fff;letter-spacing:-.01em}
.who span{display:block;margin-top:.45em;font-size:calc(var(--u)*2.7);line-height:1.35;color:var(--mute)}
.lock-s{display:inline-flex;align-items:center;gap:.5em;margin-top:calc(var(--u)*1.6);font:600 calc(var(--u)*2.1)/1 var(--text);color:var(--aT);font-style:normal;letter-spacing:.08em;text-transform:uppercase}
.lock-s .ic{width:calc(var(--u)*2.6);height:calc(var(--u)*2.6)}
.rule{width:calc(var(--u)*14);height:calc(var(--u)*.6);background:linear-gradient(90deg,var(--aL),var(--aD));transform:scaleX(0);transform-origin:50% 50%;margin-top:calc(var(--u)*2)}
.scene.act .rule{animation:rule .8s var(--out) both;animation-delay:var(--t0)}
@keyframes rule{to{transform:scaleX(1)}}
.ceil-line{position:absolute;left:10%;right:10%;top:62%;height:2px;background:linear-gradient(90deg,transparent,var(--aL),transparent);transform:scaleX(0)}
.scene.act .ceil-line{animation:rule 1.1s var(--out) both;animation-delay:var(--t0)}
.card{position:relative;background:var(--bg3);border:1px solid rgba(255,255,255,.14);border-radius:calc(var(--u)*2);box-shadow:0 calc(var(--u)*3) calc(var(--u)*8) rgba(4,6,10,.5)}
.bd-h{display:flex;justify-content:space-between;align-items:center;gap:1em;font:700 calc(var(--u)*2.6)/1 var(--display);color:#fff;padding-bottom:calc(var(--u)*1.6);border-bottom:1px solid rgba(255,255,255,.12);margin-bottom:calc(var(--u)*2)}
.bd-h span{font:600 calc(var(--u)*1.9)/1 var(--text);color:var(--mute2);letter-spacing:.06em}
.live{display:inline-flex;align-items:center;gap:.5em;text-transform:uppercase;color:var(--aT)!important;letter-spacing:.14em!important}
.live i{width:.6em;height:.6em;border-radius:50%;background:var(--aL);animation:dot 1.6s ease-out infinite}
.pill-row{display:flex;flex-wrap:wrap;gap:calc(var(--u)*1.4)}
.ypill,.npill{display:inline-flex;align-items:center;gap:.5em;font:600 calc(var(--u)*2.5)/1 var(--text);border-radius:99px;padding:.6em 1.1em;color:#fff}
.ypill{background:linear-gradient(135deg,var(--a),var(--aD));box-shadow:0 calc(var(--u)*1.4) calc(var(--u)*3.5) rgba(178,47,58,.4)}
.npill{background:var(--bg3);border:1px solid rgba(255,255,255,.2);color:var(--mute)}
.npill s{text-decoration-color:var(--aL);text-decoration-thickness:.12em}
.ypill.big,.npill.big{font-size:calc(var(--u)*3.4);padding:.7em 1.3em}
.duo2{display:flex;gap:calc(var(--u)*2);flex-wrap:wrap;margin-top:calc(var(--u)*1)}
.tap{position:relative}
.tap::after{content:'';position:absolute;left:50%;top:50%;width:calc(var(--u)*4);height:calc(var(--u)*4);margin:calc(var(--u)*-2) 0 0 calc(var(--u)*-2);border-radius:50%;border:calc(var(--u)*.35) solid #fff;opacity:0;pointer-events:none}
.scene.act .tap::after{animation:tapring .7s var(--out) both;animation-delay:var(--t0)}
@keyframes tapring{0%{opacity:.9;transform:scale(.4)}100%{opacity:0;transform:scale(2.6)}}

/* 1 · the hook */
.ghost{position:absolute;right:4%;top:-14%;font:900 calc(var(--u)*95)/1 var(--display);color:transparent;-webkit-text-stroke:2px rgba(232,95,106,.22);pointer-events:none;animation:ghost 12s ease-in-out infinite alternate}
@keyframes ghost{from{transform:rotate(-6deg) translateY(0)}to{transform:rotate(4deg) translateY(6%)}}
.spot{position:absolute;left:50%;top:50%;width:calc(var(--u)*120);height:calc(var(--u)*60);translate:-50% -50%;border-radius:50%;background:radial-gradient(closest-side,rgba(211,63,73,.22),transparent);opacity:0;pointer-events:none}
.scene.act .spot{animation:spot 1.6s var(--out) both;animation-delay:var(--t0)}
@keyframes spot{from{opacity:0;scale:.6}to{opacity:1;scale:1}}
.spk{position:absolute;left:var(--x);top:40%;width:calc(var(--u)*1.1);height:calc(var(--u)*1.1);border-radius:50%;background:var(--c);opacity:0;z-index:4;pointer-events:none}
.scene.act .spk{animation:spk 1.1s ease-out both;animation-delay:var(--t0)}
@keyframes spk{0%{opacity:0;transform:translate(0,0) scale(1)}12%{opacity:1}100%{opacity:0;transform:translate(calc(var(--dx) * var(--u)),calc(var(--u)*-26)) scale(.2)}}
.burst{position:absolute;left:50%;top:50%;width:calc(var(--u)*30);height:calc(var(--u)*30);margin:calc(var(--u)*-15) 0 0 calc(var(--u)*-15);border-radius:50%;border:calc(var(--u)*.5) solid var(--aL);opacity:0;pointer-events:none}
.burst.b2{border-color:#fff}
.scene.act .burst{animation:burst 1.3s var(--out) both;animation-delay:var(--t0)}
@keyframes burst{0%{opacity:.8;scale:.3}100%{opacity:0;scale:4.2}}

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
.fy{display:inline-flex;align-items:center;gap:calc(var(--u)*2);justify-self:start;background:var(--bg3);border:1px solid rgba(232,95,106,.5);border-radius:99px;padding:calc(var(--u)*1.2) calc(var(--u)*2.4) calc(var(--u)*1.2) calc(var(--u)*1.2)}
.fy b{font:800 calc(var(--u)*2.6)/1 var(--display);color:#fff;background:linear-gradient(135deg,var(--a),var(--aD));border-radius:99px;padding:.5em .8em}
.fy span{font:600 calc(var(--u)*2.2)/1 var(--text);color:var(--mute)}
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

/* 5 · the leads board */
.lead-wrap{display:grid;grid-template-columns:.8fr 1.2fr;gap:calc(var(--u)*3);align-items:center}
.phone{position:relative;background:#fff;color:#17191F;border-radius:calc(var(--u)*3.2);padding:calc(var(--u)*3) calc(var(--u)*2.4) calc(var(--u)*4);box-shadow:0 calc(var(--u)*4) calc(var(--u)*9) rgba(4,6,10,.6),inset 0 0 0 calc(var(--u)*.6) #2a2f3a;border:calc(var(--u)*.9) solid #2a2f3a}
.phone::before{content:'';position:absolute;left:50%;top:calc(var(--u)*1.1);width:28%;height:calc(var(--u)*.9);translate:-50% 0;border-radius:99px;background:#2a2f3a}
.ph-top{display:grid;gap:.2em;margin-top:calc(var(--u)*1.4)}
.ph-top b{font:700 calc(var(--u)*2.8)/1 var(--display)}
.ph-top span{font:500 calc(var(--u)*1.7)/1 var(--text);color:#69748A}
.ph-q{font:700 calc(var(--u)*2.3)/1.2 var(--text);margin:calc(var(--u)*2) 0 calc(var(--u)*1.2)}
.picks{list-style:none;display:grid;gap:calc(var(--u)*.9)}
.picks li{display:flex;align-items:center;gap:.6em;font:500 calc(var(--u)*1.75)/1.2 var(--text);border:1px solid #DFE4EC;border-radius:calc(var(--u)*1);padding:calc(var(--u)*.9) calc(var(--u)*1.1);background:#F4F6FA}
.picks i{flex:none;width:1.15em;height:1.15em;border-radius:50%;border:2px solid #C3CBDA;position:relative}
.picks li.on{opacity:1}
.scene.act .picks li.on{animation:pick .45s var(--pop) both;animation-delay:var(--t0)}
@keyframes pick{to{background:#FBE3E5;border-color:var(--a);color:#7f1f27}}
.scene.act .picks li.on i{animation:picki .3s var(--pop) both;animation-delay:calc(var(--t0) + .1s)}
@keyframes picki{to{background:var(--a);border-color:var(--a)}}
.ph-btn{margin-top:calc(var(--u)*1.6);background:linear-gradient(135deg,var(--a),var(--aD));color:#fff;font:700 calc(var(--u)*2.1)/1 var(--text);text-align:center;border-radius:99px;padding:calc(var(--u)*1.3)}
.scene.act .ph-btn{animation:press .35s var(--ease) both;animation-delay:var(--t0)}
@keyframes press{50%{transform:scale(.94);filter:brightness(.85)}}
.phone .sample{color:#98A2B3;bottom:calc(var(--u)*1.2)}
.board{position:relative;background:var(--bg3);border:1px solid rgba(255,255,255,.14);border-radius:calc(var(--u)*2);padding:calc(var(--u)*2.4);box-shadow:0 calc(var(--u)*3) calc(var(--u)*8) rgba(4,6,10,.5);overflow:hidden}
.tiles4{display:grid;grid-template-columns:repeat(4,1fr);gap:calc(var(--u)*1.2);margin-bottom:calc(var(--u)*2)}
.tiles4 div,.tiles3 div{background:rgba(255,255,255,.06);border-radius:calc(var(--u)*1.2);padding:calc(var(--u)*1.2);display:grid;gap:.2em;text-align:center}
.tiles4 b,.tiles3 b{font:800 calc(var(--u)*4.2)/1 var(--display);color:#fff;font-variant-numeric:tabular-nums}
.tiles4 span,.tiles3 span{font:600 calc(var(--u)*1.6)/1 var(--text);letter-spacing:.1em;text-transform:uppercase;color:var(--mute2)}
.tiles4 .hot,.tiles3 .hot{background:linear-gradient(145deg,var(--a),var(--aD))}
.tiles4 .hot span,.tiles3 .hot span{color:#fff;opacity:.9}
.lead-card{background:#fff;color:#17191F;border-radius:calc(var(--u)*1.4);padding:calc(var(--u)*1.4) calc(var(--u)*1.8);display:grid;grid-template-columns:auto 1fr auto;gap:.2em 1em;align-items:center;margin-bottom:calc(var(--u)*1.2);opacity:0}
.lead-card b{font:700 calc(var(--u)*2.4)/1 var(--display)}
.lead-card span{font:500 calc(var(--u)*1.9)/1.2 var(--text);color:#3F4A5C}
.lead-card em{font:600 calc(var(--u)*1.6)/1 var(--text);font-style:normal;color:#fff;background:var(--a);border-radius:99px;padding:.4em .7em}
.scene.act .fly{animation:fly .9s var(--out) both;animation-delay:var(--t0)}
@keyframes fly{from{opacity:0;transform:translate(calc(var(--u)*-30),calc(var(--u)*4)) scale(.6) rotate(-6deg)}70%{opacity:1}to{opacity:1;transform:none}}
.lead-row{display:flex;gap:1em;align-items:baseline;padding:calc(var(--u)*1) calc(var(--u)*1.4);border-top:1px solid rgba(255,255,255,.08)}
.lead-row b{font:700 calc(var(--u)*2.1)/1 var(--display);color:#fff}
.lead-row span{font:500 calc(var(--u)*1.8)/1.2 var(--text);color:var(--mute2)}
.lead-row.dim{opacity:.6}
.qr.mini{justify-self:start;padding:calc(var(--u)*1.6);gap:calc(var(--u)*.8)}
.qr.mini svg{width:calc(var(--u)*14);height:calc(var(--u)*14)}
.qr.mini span{font-size:calc(var(--u)*1.7)}

.arcpath{position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none;z-index:3}
.ap{fill:none;stroke:rgba(255,255,255,.35);stroke-width:3;stroke-dasharray:6 8;stroke-dashoffset:400;opacity:0}
.scene.act .ap{animation:apdraw 1.1s var(--ease) both;animation-delay:var(--t0)}
@keyframes apdraw{0%{opacity:0;stroke-dashoffset:400}15%{opacity:1}100%{opacity:1;stroke-dashoffset:0}}
.ap.comet{stroke:var(--aL);stroke-width:6;stroke-linecap:round;stroke-dasharray:40 400;stroke-dashoffset:440;filter:drop-shadow(0 0 8px var(--aL))}
.scene.act .ap.comet{animation:comet 1.1s var(--ease) both;animation-delay:calc(var(--t0) + .1s)}
@keyframes comet{0%{opacity:0;stroke-dashoffset:440}10%{opacity:1}90%{opacity:1}100%{opacity:0;stroke-dashoffset:-40}}

/* 6 · the Lead Desk */
.desk{position:relative;background:#fff;color:#17191F;border-radius:calc(var(--u)*1.8);padding:calc(var(--u)*3.4) calc(var(--u)*4) calc(var(--u)*4.6);box-shadow:0 calc(var(--u)*4) calc(var(--u)*8) rgba(4,6,10,.5);display:grid;gap:calc(var(--u)*2)}
.dk-h{font:600 calc(var(--u)*1.9)/1 var(--text);letter-spacing:.14em;text-transform:uppercase;color:var(--aD)}
.dk-l{font:500 calc(var(--u)*2.6)/1.4 var(--text);color:#17191F;min-height:2.8em}
.dk-l.hl{background:linear-gradient(90deg,#FBE3E5,#FBE3E5) no-repeat;background-size:100% 100%;padding:.3em .5em;border-radius:.3em}
.dk-q{font:700 calc(var(--u)*2.8)/1.35 var(--display);color:#7f1f27;min-height:2.6em}
.dk-q .ty::after{content:'';display:inline-block;width:.09em;height:.95em;margin-left:.12em;vertical-align:-.12em;background:var(--aD);animation:blink 1s steps(2) infinite}
@keyframes blink{50%{opacity:0}}
.desk .sample{color:#98A2B3}
.fwd{display:inline-flex;align-items:center;gap:.7em;justify-self:start;background:var(--bg3);border:1px solid rgba(255,255,255,.18);border-radius:calc(var(--u)*1.4);padding:calc(var(--u)*1.4) calc(var(--u)*2);font:500 calc(var(--u)*2.4)/1 var(--text);color:var(--mute)}
.fwd .ic{color:var(--aL);font-size:calc(var(--u)*3.2)}
.fwd b{color:#fff;font-weight:700}

/* 7 · factfind360 */
.steps3{list-style:none;display:grid;gap:calc(var(--u)*1.6);margin-top:calc(var(--u)*1)}
.steps3 li{display:flex;align-items:center;gap:calc(var(--u)*1.6);font:600 calc(var(--u)*3)/1.1 var(--text);color:#fff}
.steps3 i{flex:none;width:calc(var(--u)*4.4);height:calc(var(--u)*4.4);border-radius:50%;display:grid;place-items:center;background:linear-gradient(145deg,var(--a),var(--aD));font:700 calc(var(--u)*2.2)/1 var(--display);font-style:normal}
.steps3 .zero{gap:calc(var(--u)*2);margin-top:calc(var(--u)*1)}
.steps3 .zero b{font:800 calc(var(--u)*9)/1 var(--display);color:var(--aL);letter-spacing:-.03em}
.steps3 .zero span{font:600 calc(var(--u)*2.6)/1.2 var(--text);color:var(--mute);max-width:12ch}
.calc{position:relative;background:#fff;color:#17191F;border-radius:calc(var(--u)*1.8);padding:calc(var(--u)*3) calc(var(--u)*3.4) calc(var(--u)*4.4);box-shadow:0 calc(var(--u)*4) calc(var(--u)*8) rgba(4,6,10,.5);display:grid;gap:calc(var(--u)*1.2)}
.crow,.ctot{display:flex;justify-content:space-between;align-items:baseline;gap:1em;opacity:0;font:500 calc(var(--u)*2.5)/1.2 var(--text);color:#3F4A5C;padding:calc(var(--u)*.8) 0;border-bottom:1px dashed #DFE4EC}
.crow b,.ctot b{font:700 calc(var(--u)*2.8)/1 var(--display);color:#17191F;font-variant-numeric:tabular-nums}
.crow b em,.ctot b em{font-style:normal}
.ctot{border:0;margin-top:calc(var(--u)*.6);font-weight:700;color:#17191F;font-size:calc(var(--u)*2.9)}
.ctot b{font-size:calc(var(--u)*5.2);color:var(--aD)}
.scene.act .crow,.scene.act .ctot{animation:up .6s var(--out) both;animation-delay:var(--t0)}
.sig{display:flex;align-items:center;gap:1em;margin-top:calc(var(--u)*1)}
.sig svg{width:calc(var(--u)*24);height:auto;overflow:visible}
.sig path{stroke-dasharray:420;stroke-dashoffset:420}
.scene.act .sig path{animation:dash 1.3s var(--ease) both;animation-delay:var(--t0)}
.sig span{font:600 calc(var(--u)*1.8)/1 var(--text);letter-spacing:.1em;text-transform:uppercase;color:#69748A;opacity:0}
.scene.act .sig span{animation:up .5s var(--out) both;animation-delay:calc(var(--t0) + 1.1s)}
.conf{display:flex;align-items:center;gap:.6em;font:600 calc(var(--u)*2.2)/1 var(--text);color:#1E7A4F}
.conf i{width:1.3em;height:1.3em;border-radius:50%;background:var(--ok);position:relative;flex:none}
.conf i::after{content:'';position:absolute;left:32%;top:22%;width:22%;height:44%;border:solid #fff;border-width:0 .2em .2em 0;transform:rotate(45deg)}
.calc .sample{color:#98A2B3}
.stamp{position:absolute;right:6%;top:5%;font:900 calc(var(--u)*3.4)/1 var(--display);letter-spacing:.14em;text-transform:uppercase;color:#1E7A4F;border:calc(var(--u)*.5) solid #1E7A4F;border-radius:calc(var(--u)*1);padding:.25em .5em;opacity:0;transform:rotate(-12deg);mix-blend-mode:multiply;z-index:4}
.scene.act .stamp{animation:stamp .45s var(--pop) both;animation-delay:var(--t0)}
@keyframes stamp{0%{opacity:0;transform:rotate(-12deg) scale(2.4)}60%{opacity:.9}100%{opacity:.85;transform:rotate(-12deg) scale(1)}}

/* 8 · the wall */
.wall-wrap{position:relative;display:grid;grid-template-columns:1fr;align-items:center}
.wall{position:relative;background:var(--bg3);border:1px solid rgba(255,255,255,.14);border-radius:calc(var(--u)*2);padding:calc(var(--u)*2.4) calc(var(--u)*2.4) calc(var(--u)*4);box-shadow:0 calc(var(--u)*3) calc(var(--u)*8) rgba(4,6,10,.5);width:92%}
.tiles3{display:grid;grid-template-columns:repeat(3,1fr);gap:calc(var(--u)*1.2);margin-bottom:calc(var(--u)*2.2)}
.tiles3 div{opacity:0}
.scene.act .tiles3 div{animation:pop .6s var(--pop) both;animation-delay:var(--t0)}
.wbars{display:grid;gap:calc(var(--u)*1)}
.wb{display:grid;grid-template-columns:calc(var(--u)*7) 1fr;align-items:center;gap:calc(var(--u)*1.4);font:600 calc(var(--u)*2)/1 var(--text);color:var(--mute2)}
.wb i{display:block;height:calc(var(--u)*2.2);border-radius:99px;background:rgba(255,255,255,.18);width:var(--w);transform:scaleX(0);transform-origin:0 50%}
.wb.you{color:#fff}.wb.you i{background:linear-gradient(90deg,var(--aL),var(--aD));box-shadow:0 0 calc(var(--u)*2) rgba(232,95,106,.6);position:relative;overflow:hidden}
.wb.you i::after{content:'';position:absolute;inset:0;background:linear-gradient(90deg,transparent 30%,rgba(255,255,255,.5) 50%,transparent 70%);transform:translateX(-120%)}
.scene.act .wb.you i::after{animation:glare 2.4s ease-in-out infinite;animation-delay:calc(var(--t0) + 1.2s)}
.scene.act .tiles3 .hot,.scene.act .tiles4 .hot{animation:pop .6s var(--pop) both,hotglow 1.8s ease-in-out infinite;animation-delay:var(--t0,0ms),calc(var(--t0,0ms) + .6s)}
@keyframes hotglow{50%{box-shadow:0 0 calc(var(--u)*3) rgba(232,95,106,.75)}}
.scene.act .wb i{animation:growx 1.1s var(--out) both;animation-delay:var(--t0)}
@keyframes growx{to{transform:scaleX(1)}}
.phone.small{position:absolute;right:-2%;bottom:-6%;width:34%;padding:calc(var(--u)*2.6) calc(var(--u)*1.6) calc(var(--u)*2.4);text-align:center;transform:rotate(4deg)}
.ring-p{position:relative;width:60%;margin:calc(var(--u)*1.2) auto 0;display:grid;place-items:center}
.ring-p svg{width:100%;height:auto;transform:rotate(-90deg)}
.ring-p circle{fill:none;stroke:#EEF2F8;stroke-width:9}
.ring-p .arc{stroke:url(#rg);stroke:var(--a);stroke-linecap:round;stroke-dasharray:264;stroke-dashoffset:264}
.scene.act .ring-p .arc{animation:ringfill 1.4s var(--out) both;animation-delay:var(--t0)}
@keyframes ringfill{to{stroke-dashoffset:0}}
.ring-p b{position:absolute;font:800 calc(var(--u)*2.8)/1 var(--display);color:#17191F}
.ph-s{font:600 calc(var(--u)*1.6)/1 var(--text);color:#1E7A4F;margin-top:calc(var(--u)*1)}
.nosheet{display:inline-flex;align-items:center;gap:.6em;justify-self:start;font:600 calc(var(--u)*2.6)/1 var(--text);color:var(--mute2)}
.nosheet .ic{font-size:calc(var(--u)*3.4);color:var(--aL)}
.nosheet s{text-decoration-color:var(--aL);text-decoration-thickness:.12em}

/* 9 · the day */
.day{position:relative;background:#fff;color:#17191F;border-radius:calc(var(--u)*1.8);padding:calc(var(--u)*3) calc(var(--u)*3.2) calc(var(--u)*4.4);box-shadow:0 calc(var(--u)*4) calc(var(--u)*8) rgba(4,6,10,.5);display:grid;gap:calc(var(--u)*1.8)}
.prog{position:relative;height:calc(var(--u)*5.4);border-radius:99px;background:#EEF2F8;overflow:hidden;display:grid;align-items:center}
.prog i{position:absolute;left:0;top:0;bottom:0;width:78%;background:linear-gradient(90deg,var(--aL),var(--aD));transform:scaleX(0);transform-origin:0 50%;border-radius:99px}
.scene.act .prog i{animation:growx 1.3s var(--out) both;animation-delay:var(--t0)}
.prog i::after{content:'';position:absolute;inset:0;background:linear-gradient(90deg,transparent 30%,rgba(255,255,255,.5) 50%,transparent 70%);transform:translateX(-120%)}
.scene.act .prog i::after{animation:glare 2.2s ease-in-out infinite;animation-delay:calc(var(--t0) + 1.3s)}
.prog b{position:relative;z-index:1;padding-left:calc(var(--u)*2);font:600 calc(var(--u)*2.2)/1 var(--text);color:#17191F;mix-blend-mode:multiply}
.prog b em{font-style:normal;font-weight:800;font-variant-numeric:tabular-nums}
.ck{position:relative;border-radius:99px;padding:calc(var(--u)*1.5);text-align:center;font:700 calc(var(--u)*2.4)/1 var(--text);background:linear-gradient(135deg,var(--a),var(--aD));color:#fff;display:grid}
.ck span{grid-area:1/1;display:inline-flex;justify-content:center;align-items:center;gap:.5em}
.ck .after{opacity:0}
.ck .after i{width:1.1em;height:1.1em;border-radius:50%;background:#fff;position:relative}
.ck .after i::after{content:'';position:absolute;left:32%;top:20%;width:22%;height:46%;border:solid #1E7A4F;border-width:0 .2em .2em 0;transform:rotate(45deg)}
.scene.act .ck{animation:press .35s var(--ease) both,ckbg .4s var(--ease) forwards;animation-delay:var(--t0),calc(var(--t0) + .3s)}
@keyframes ckbg{to{background:#DDF4E7;color:#1E7A4F}}
.scene.act .ck .before{animation:fadeout .3s both;animation-delay:calc(var(--t0) + .3s)}
.scene.act .ck .after{animation:up .4s var(--out) both;animation-delay:calc(var(--t0) + .4s)}
@keyframes fadeout{to{opacity:0}}
.dlist{list-style:none;display:grid;gap:calc(var(--u)*1.1)}
.dlist li{display:grid;grid-template-columns:auto 1fr;gap:.1em 1em;align-items:center;background:#F4F6FA;border-radius:calc(var(--u)*1.2);padding:calc(var(--u)*1.2) calc(var(--u)*1.6);opacity:0;position:relative}
.dlist .ic{grid-row:span 2;font-size:calc(var(--u)*3.2);color:var(--aD)}
.dlist b{font:700 calc(var(--u)*2.2)/1.1 var(--text)}
.dlist span{font:500 calc(var(--u)*1.9)/1.2 var(--text);color:#3F4A5C}
.dlist li::after{content:'';position:absolute;right:calc(var(--u)*1.6);top:50%;width:calc(var(--u)*2.6);height:calc(var(--u)*2.6);margin-top:calc(var(--u)*-1.3);border-radius:50%;background:var(--ok);opacity:0;transform:scale(.4)}
.scene.act .dlist li{animation:up .6s var(--out) both;animation-delay:var(--t0)}
.scene.act .dlist li::after{animation:pop .4s var(--pop) both;animation-delay:var(--t1)}
.day .sample{color:#98A2B3}

/* 10 · Branch Intelligence */
.file{position:relative;background:var(--bg3);border:1px solid rgba(255,255,255,.14);border-radius:calc(var(--u)*2);padding:calc(var(--u)*2.4) calc(var(--u)*2.4) calc(var(--u)*4);box-shadow:0 calc(var(--u)*3) calc(var(--u)*8) rgba(4,6,10,.5);overflow:hidden;display:grid;gap:calc(var(--u)*1.4)}
.flines i{display:block;height:calc(var(--u)*1.2);border-radius:99px;background:rgba(255,255,255,.12);margin:calc(var(--u)*1.1) 0}
.flines i.short{width:58%}
.scan{position:absolute;left:0;right:0;top:0;height:14%;background:linear-gradient(180deg,transparent,rgba(232,95,106,.35),var(--aL) 70%,transparent);opacity:0}
.scene.act .scan{animation:scan 1.3s var(--ease) both;animation-delay:var(--t0)}
@keyframes scan{0%{opacity:0;transform:translateY(-100%)}10%{opacity:1}90%{opacity:1}100%{opacity:0;transform:translateY(760%)}}
.ai{background:#fff;color:#17191F;border-radius:calc(var(--u)*1.4);padding:calc(var(--u)*1.6) calc(var(--u)*2);display:grid;gap:calc(var(--u)*1.2);opacity:0;border-left:calc(var(--u)*.6) solid var(--a)}
.scene.act .ai{animation:up .7s var(--out) both,aiglow 2.2s ease-in-out infinite;animation-delay:var(--t0),calc(var(--t0) + .7s)}
@keyframes aiglow{50%{box-shadow:0 0 calc(var(--u)*2.6) rgba(232,95,106,.55)}}
.think{display:flex;gap:.5em;justify-content:center;opacity:0;height:calc(var(--u)*2)}
.scene.act .think{animation:fade .3s both,fadeout .3s both;animation-delay:var(--t0),var(--t1)}
.think i{width:calc(var(--u)*1.4);height:calc(var(--u)*1.4);border-radius:50%;background:var(--aL);animation:thinkdot .9s ease-in-out infinite}
.think i:nth-child(2){animation-delay:.15s}.think i:nth-child(3){animation-delay:.3s}
@keyframes thinkdot{50%{transform:translateY(-60%);opacity:.5}}
.ai p{font:500 calc(var(--u)*2.2)/1.35 var(--text);color:#17191F;display:grid;gap:.25em}
.ai b{font:600 calc(var(--u)*1.6)/1 var(--text);letter-spacing:.14em;text-transform:uppercase;color:var(--aD)}
.ai p+p{border-top:1px dashed #DFE4EC;padding-top:calc(var(--u)*1)}

/* 11 · the corner */
.corner{position:relative;padding:calc(var(--u)*6)}
.brk{position:absolute;width:calc(var(--u)*9);height:calc(var(--u)*9);border:calc(var(--u)*.5) solid var(--aL);opacity:0}
.brk.tl{left:0;top:0;border-right:0;border-bottom:0}.brk.br{right:0;bottom:0;border-left:0;border-top:0}
.scene.act .brk{animation:brk .7s var(--out) .3s both}
.scene.act .brk.br{animation-delay:.5s}
@keyframes brk{from{opacity:0;transform:scale(1.4)}to{opacity:1;transform:none}}
.chips3{display:grid;gap:calc(var(--u)*2)}
.chip{display:flex;align-items:center;gap:calc(var(--u)*2);background:var(--bg3);border:1px solid rgba(255,255,255,.14);border-radius:calc(var(--u)*1.6);padding:calc(var(--u)*2.2) calc(var(--u)*3);font:700 calc(var(--u)*3)/1.15 var(--display);color:#fff;box-shadow:0 calc(var(--u)*2) calc(var(--u)*5) rgba(4,6,10,.4)}
.chip .ic{font-size:calc(var(--u)*4);color:var(--aL);flex:none}
.week{display:grid;grid-template-columns:repeat(5,1fr);gap:calc(var(--u)*1)}
.week span{text-align:center;font:600 calc(var(--u)*2.2)/1 var(--text);letter-spacing:.1em;text-transform:uppercase;color:var(--mute2);background:rgba(255,255,255,.06);border-radius:calc(var(--u)*1);padding:calc(var(--u)*1.4) 0}
.scene.act .week .fri{animation:friday .5s var(--pop) both;animation-delay:var(--t0)}
@keyframes friday{to{background:linear-gradient(135deg,var(--a),var(--aD));color:#fff;transform:scale(1.12)}}

/* 12 · the list */
.list{position:relative;background:var(--bg3);border:1px solid rgba(255,255,255,.14);border-radius:calc(var(--u)*2);padding:calc(var(--u)*2.4) calc(var(--u)*2.4) calc(var(--u)*4);box-shadow:0 calc(var(--u)*3) calc(var(--u)*8) rgba(4,6,10,.5);display:grid;gap:calc(var(--u)*1.2);overflow:hidden}
.hh{display:grid;grid-template-columns:auto 1fr auto;gap:.15em 1.2em;align-items:center;background:#fff;color:#17191F;border-radius:calc(var(--u)*1.4);padding:calc(var(--u)*1.4) calc(var(--u)*1.8);opacity:0}
.hh .ic{grid-row:span 2;font-size:calc(var(--u)*3.6);color:var(--aD)}
.hh b{font:700 calc(var(--u)*2.4)/1.1 var(--display)}
.hh span{font:500 calc(var(--u)*1.8)/1.2 var(--text);color:#3F4A5C}
.hh em{grid-row:span 2;font:600 calc(var(--u)*1.6)/1 var(--text);font-style:normal;letter-spacing:.1em;text-transform:uppercase;color:#fff;background:var(--a);border-radius:99px;padding:.5em .8em}
.scene.act .hh{animation:slidein .8s var(--out) both;animation-delay:var(--t0)}
.scene.act .hh em{animation:pop .45s var(--pop) both;animation-delay:calc(var(--t0) + .7s)}
@keyframes slidein{from{opacity:0;transform:translateX(calc(var(--u)*30))}to{opacity:1;transform:none}}

/* 13 · the stage and the chat bubble */
.bubble{justify-self:start;font-weight:600;background:#2a3140;border-radius:calc(var(--u)*2) calc(var(--u)*2) calc(var(--u)*2) .3em;padding:calc(var(--u)*1.4) calc(var(--u)*2.2);font-size:calc(var(--u)*2.4);color:var(--mute);display:grid;gap:.2em;position:relative}
.bubble span:last-child{font-size:.8em;color:var(--mute2)}
.scene.act .bubble{animation:up .8s var(--out) both,bub-out .6s var(--ease) both;animation-delay:var(--t0),var(--t1)}
@keyframes bub-out{to{opacity:.18;filter:grayscale(1);transform:translateX(calc(var(--u)*-3))}}
.dates{display:flex;flex-wrap:wrap;gap:calc(var(--u)*1.6)}
.date{background:linear-gradient(145deg,var(--a),var(--aD));color:#fff;border-radius:calc(var(--u)*1.4);padding:calc(var(--u)*1.6) calc(var(--u)*2.4);display:grid;gap:.2em}
.date b{font:700 calc(var(--u)*2.9)/1 var(--display)}
.date span{font-size:calc(var(--u)*1.8);letter-spacing:.1em;text-transform:uppercase;opacity:.9}
.podium{position:relative;height:calc(var(--u)*48);display:grid;align-items:end;justify-items:center;overflow:hidden;border-radius:calc(var(--u)*2)}
.podium .floor{position:absolute;left:0;right:0;bottom:0;height:18%;background:linear-gradient(180deg,#303644,#1C2029);border-top:1px solid rgba(255,255,255,.12)}
.podium .light{position:absolute;top:-10%;left:50%;width:70%;height:120%;translate:-50% 0;background:conic-gradient(from 165deg at 50% 0%,transparent 0 0deg,rgba(255,255,255,.14) 12deg,rgba(255,255,255,.22) 15deg,rgba(255,255,255,.14) 18deg,transparent 30deg);opacity:0;transform-origin:50% 0}
.scene.act .light{animation:light 1.2s var(--out) both,sweep 6s ease-in-out infinite;animation-delay:var(--t0),calc(var(--t0) + 1.2s)}
@keyframes light{to{opacity:1}}
@keyframes sweep{0%,100%{rotate:-8deg}50%{rotate:8deg}}
.plate{position:relative;z-index:2;margin-bottom:22%;background:#fff;color:#17191F;border-radius:calc(var(--u)*1.2);padding:calc(var(--u)*2) calc(var(--u)*4);text-align:center;box-shadow:0 calc(var(--u)*3) calc(var(--u)*7) rgba(4,6,10,.6)}
.plate small{display:block;font:600 calc(var(--u)*1.8)/1 var(--text);letter-spacing:.16em;text-transform:uppercase;color:var(--aD);margin-bottom:.5em}
.plate b{font:800 calc(var(--u)*4.4)/1 var(--display)}
.conf{position:relative}
.podium .conf{position:absolute;top:-6%;left:var(--x);width:calc(var(--u)*1);height:calc(var(--u)*1.8);background:var(--c);opacity:0;border-radius:2px;display:block}
.scene.act .podium .conf{animation:conf 2.6s linear both;animation-delay:var(--t0)}
@keyframes conf{0%{opacity:0;transform:translateY(0) rotate(0)}10%{opacity:1}100%{opacity:0;transform:translateY(calc(var(--u)*48)) rotate(540deg)}}
.ring-a{position:absolute;left:50%;bottom:26%;width:calc(var(--u)*16);height:calc(var(--u)*16);margin-left:calc(var(--u)*-8);border-radius:50%;border:calc(var(--u)*.4) solid var(--aL);opacity:0;z-index:1}
.scene.act .ring-a{animation:burst 1.4s var(--out) both;animation-delay:var(--t0)}

/* 14 · the ladders */
.ladders{display:grid;grid-template-columns:1fr 1fr;gap:calc(var(--u)*4)}
.ladder{position:relative;list-style:none;display:flex;flex-direction:column-reverse;gap:calc(var(--u)*1.8);padding-left:calc(var(--u)*5)}
.lad-h{order:1;font:600 calc(var(--u)*2)/1 var(--text);letter-spacing:.14em;text-transform:uppercase;color:var(--aT);margin-bottom:calc(var(--u)*.6)}
.ladder .rail{position:absolute;left:calc(var(--u)*1.2);top:calc(var(--u)*5);bottom:calc(var(--u)*1.5);width:calc(var(--u)*.4);background:rgba(255,255,255,.18);transform:scaleY(0);transform-origin:50% 100%}
.scene.act .ladder .rail{animation:rail 1.6s var(--out) both,railflow 2.4s linear infinite;animation-delay:var(--t0),calc(var(--t0) + 1.6s);background:linear-gradient(180deg,rgba(255,255,255,.18) 0 40%,var(--aL) 50%,rgba(255,255,255,.18) 60% 100%);background-size:100% 300%}
@keyframes railflow{from{background-position:0 120%}to{background-position:0 -80%}}
@keyframes rail{to{transform:scaleY(1)}}
.ladder li{position:relative;background:var(--bg3);border:1px solid rgba(255,255,255,.14);border-radius:calc(var(--u)*1.4);padding:calc(var(--u)*1.6) calc(var(--u)*2);display:grid;gap:.4em}
.ladder li::before{content:'';position:absolute;left:calc(var(--u)*-4.6);top:calc(var(--u)*2);width:calc(var(--u)*1.6);height:calc(var(--u)*1.6);border-radius:50%;background:var(--bg);border:calc(var(--u)*.35) solid var(--aL)}
.ladder li.top::before{background:var(--aL);box-shadow:0 0 0 calc(var(--u)*.6) rgba(211,63,73,.3)}
.ladder li.top{border-color:rgba(232,95,106,.55)}
.ladder b{font:700 calc(var(--u)*2.6)/1.15 var(--display);color:#fff}
.ladder li>span{font-size:calc(var(--u)*1.9);color:var(--mute)}
.choose{display:inline-flex;align-items:center;gap:calc(var(--u)*1.6);justify-self:start}
.choose .knob{width:calc(var(--u)*7);height:calc(var(--u)*3.8);border-radius:99px;background:linear-gradient(135deg,var(--a),var(--aD));position:relative;flex:none}
.choose .knob::after{content:'';position:absolute;top:calc(var(--u)*.4);left:calc(var(--u)*.4);width:calc(var(--u)*3);height:calc(var(--u)*3);border-radius:50%;background:#fff;animation:knob 2.4s ease-in-out infinite}
@keyframes knob{0%,40%{transform:none}60%,100%{transform:translateX(calc(var(--u)*3.2))}}
.choose b{font:700 calc(var(--u)*3)/1.1 var(--display);color:#fff}

/* 15 · the graph */
.graph{width:100%;height:auto;overflow:visible}
.graph .line{fill:none;stroke:url(#gl);stroke-width:7;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:620;stroke-dashoffset:620;filter:drop-shadow(0 0 10px rgba(232,95,106,.6))}
.scene.act .graph .line{animation:dash 2.2s var(--ease) both;animation-delay:var(--t0)}
@keyframes dash{to{stroke-dashoffset:0}}
.graph .ggrid line{stroke:rgba(255,255,255,.1);stroke-dasharray:3 6}
.graph .area{opacity:0;fill:url(#ga)}
.scene.act .graph .area{animation:fade 1.2s var(--out) both;animation-delay:var(--t0)}
.graph .band rect{fill:rgba(255,255,255,.07);stroke:rgba(255,255,255,.35);stroke-dasharray:6 6}
.graph .band text{font:600 16px var(--text);letter-spacing:.12em;text-transform:uppercase;fill:var(--mute2)}
.scene.act .graph .band{animation:band .9s var(--ease) both;animation-delay:var(--t0)}
@keyframes band{to{opacity:0;transform:translateY(30px)}}
.graph .dot{fill:var(--aL);opacity:0}
.scene.act .graph .dot{animation:dotin .5s var(--out) both,pulse 1.6s ease-out infinite;animation-delay:var(--t0),calc(var(--t0) + .5s)}
@keyframes dotin{from{opacity:0;r:0}to{opacity:1}}
@keyframes pulse{to{filter:drop-shadow(0 0 18px rgba(232,95,106,1))}}

/* 16 · the flight plan */
.flight{position:relative;background:var(--bg3);border:1px solid rgba(255,255,255,.14);border-radius:calc(var(--u)*2);padding:calc(var(--u)*3);box-shadow:0 calc(var(--u)*3) calc(var(--u)*8) rgba(4,6,10,.5);overflow:visible}
.flight svg{width:100%;height:auto;overflow:visible}
.traj{fill:none;stroke:rgba(255,255,255,.35);stroke-width:2;stroke-dasharray:6 7;stroke-dashoffset:600}
.scene.act .traj{animation:trajd 2.6s var(--ease) both;animation-delay:var(--t0)}
@keyframes trajd{from{stroke-dashoffset:600}to{stroke-dashoffset:0}}
.st{opacity:0}
.st circle{fill:var(--bg);stroke:var(--aL);stroke-width:3}
.st text{font:600 12px var(--text);fill:var(--mute);text-anchor:middle;letter-spacing:.04em}
.scene.act .st{animation:pop .5s var(--pop) both;animation-delay:var(--t0)}
.rocket{fill:#fff;filter:drop-shadow(0 0 8px var(--aL));opacity:0;offset-path:path("M20 210 C 120 210, 190 180, 240 120 S 340 30, 380 20");offset-rotate:0deg}
.scene.act .rocket{animation:ride 2.6s var(--ease) both;animation-delay:var(--t0)}
@keyframes ride{0%{opacity:0;offset-distance:0%}8%{opacity:1}100%{opacity:1;offset-distance:100%}}
.rocket.trail{fill:var(--aL);filter:blur(1.5px)}
.rocket.t1{opacity:0}.rocket.t2{opacity:0}
.scene.act .rocket.t1{animation:ride 2.6s var(--ease) both;animation-delay:var(--t0);opacity:.6}
.scene.act .rocket.t2{animation:ride 2.6s var(--ease) both;animation-delay:var(--t0);opacity:.35}
.star{fill:#fff;opacity:.3;animation:twinkle 2.6s ease-in-out infinite;animation-delay:var(--dl)}
@keyframes twinkle{50%{opacity:1;r:3}}
.go{position:absolute;right:calc(var(--u)*2);top:calc(var(--u)*-6);text-align:center;opacity:0}
.go small{display:block;font:600 calc(var(--u)*1.8)/1 var(--text);letter-spacing:.16em;text-transform:uppercase;color:var(--mute)}
.go b{display:block;font:900 calc(var(--u)*11)/1 var(--display);color:#fff;letter-spacing:-.02em;background:linear-gradient(135deg,var(--a),var(--aD));border-radius:calc(var(--u)*2);padding:.1em .35em;box-shadow:0 0 calc(var(--u)*8) rgba(232,95,106,.6)}
.scene.act .go{animation:goin .6s var(--pop) both,goglow 1.6s ease-in-out infinite;animation-delay:var(--t0),calc(var(--t0) + .6s)}
@keyframes goin{from{opacity:0;transform:scale(2.2)}to{opacity:1;transform:none}}
@keyframes goglow{50%{filter:brightness(1.18)}}

/* 17 · the lock */
.lock{width:calc(var(--u)*16);height:calc(var(--u)*16);border-radius:50%;background:var(--bg3);border:1px solid rgba(255,255,255,.16);display:grid;place-items:center;box-shadow:0 calc(var(--u)*3) calc(var(--u)*7) rgba(4,6,10,.5)}
.lock svg{width:55%;height:55%;fill:none;stroke:var(--aL);stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;overflow:visible}
.lock .shackle{transform:translateY(-4px);transform-box:fill-box;transform-origin:50% 100%}
.scene.act .lock .shackle{animation:shackle .5s var(--pop) both;animation-delay:var(--t0)}
@keyframes shackle{to{transform:translateY(0)}}
.lock{position:relative}
.lock::after{content:'';position:absolute;inset:-4%;border-radius:50%;border:calc(var(--u)*.4) solid var(--aL);opacity:0}
.scene.act .lock::after{animation:burst 1.2s var(--out) both;animation-delay:var(--t1)}

/* 18 · the checks */
.checks{list-style:none;display:grid;gap:calc(var(--u)*1.8)}
.checks li{display:flex;align-items:center;gap:calc(var(--u)*2);font:600 calc(var(--u)*3.4)/1.1 var(--text);color:#fff;opacity:0}
.scene.act .checks li{animation:up .7s var(--out) both;animation-delay:var(--t0)}
.checks i{width:calc(var(--u)*5);height:calc(var(--u)*5);border-radius:50%;background:linear-gradient(145deg,var(--a),var(--aD));position:relative;flex:none}
.checks i::after{content:'';position:absolute;left:30%;top:24%;width:22%;height:42%;border:solid #fff;border-width:0 .28em .28em 0;transform:rotate(45deg) scale(0);transform-origin:50% 50%}
.scene.act .checks i::after{animation:pop .4s var(--pop) both;animation-delay:calc(var(--t0) + .35s)}
@keyframes pop{from{opacity:0;transform:scale(.6)}to{opacity:1;transform:none}}

.buildbar{position:relative;height:calc(var(--u)*1.6);border-radius:99px;background:rgba(255,255,255,.1);overflow:hidden;max-width:calc(var(--u)*50)}
.buildbar i{position:absolute;inset:0;background:linear-gradient(90deg,var(--aL),var(--aD));transform:scaleX(0);transform-origin:0 50%}
.scene.act .buildbar i{animation:growx var(--t1) linear both;animation-delay:var(--t0)}

/* 19 · the gates */
.gates{position:relative;list-style:none;display:grid;grid-template-columns:repeat(5,1fr);gap:calc(var(--u)*2);margin:calc(var(--u)*2) 0}
.gates li{text-align:center;display:grid;justify-items:center;gap:calc(var(--u)*1.4);opacity:0;position:relative;z-index:1}
.scene.act .gates li{animation:up .7s var(--out) both;animation-delay:var(--t0)}
.gates b{width:calc(var(--u)*9);height:calc(var(--u)*9);border-radius:50%;display:grid;place-items:center;background:linear-gradient(145deg,var(--a),var(--aD));color:#fff;font:700 calc(var(--u)*4)/1 var(--display);box-shadow:0 calc(var(--u)*2) calc(var(--u)*5) rgba(178,47,58,.45)}
.gates span{font:600 calc(var(--u)*2.3)/1.2 var(--text);color:var(--mute)}
.gates b{position:relative}
.gates b::after{content:'';position:absolute;inset:-6%;border-radius:50%;border:calc(var(--u)*.4) solid #fff;opacity:0}
.scene.act .gates b::after{animation:burst 1s var(--out) both;animation-delay:calc(var(--t0) + .35s)}
.gline{position:absolute;left:10%;right:10%;top:calc(var(--u)*4.5);height:calc(var(--u)*.35);background:linear-gradient(90deg,rgba(255,255,255,.12) 0 38%,var(--a) 47%,var(--a) 53%,rgba(255,255,255,.12) 62% 100%);background-size:280% 100%;transform:scaleX(0);transform-origin:0 50%}
.scene.act .gline{animation:rule 1.7s var(--out) both,flow 3s linear infinite;animation-delay:var(--t0),0s}
@keyframes flow{from{background-position:120% 0}to{background-position:-80% 0}}

/* 20 · the door */
.door{position:relative;width:calc(var(--u)*26);aspect-ratio:.78;margin:calc(var(--u)*1) auto;perspective:calc(var(--u)*70);display:grid}
.d-frame{position:absolute;inset:0;border:calc(var(--u)*.9) solid rgba(255,255,255,.3);border-bottom:0;border-radius:calc(var(--u)*13) calc(var(--u)*13) 0 0;overflow:hidden;transform-style:preserve-3d;background:var(--bg2)}
.d-light{position:absolute;inset:0;background:radial-gradient(80% 60% at 50% 60%,#fff,#F5CBD0 35%,var(--aL) 70%,var(--aD));opacity:0}
.scene.act .d-light{animation:fade .9s var(--out) both;animation-delay:calc(var(--t0) + .2s)}
.d-leaf{position:absolute;top:0;bottom:0;width:50%;background:linear-gradient(180deg,#303644,var(--bg3));border:1px solid rgba(255,255,255,.14);backface-visibility:visible}
.d-leaf.l{left:0;transform-origin:0 50%;border-radius:calc(var(--u)*13) 0 0 0}
.d-leaf.r{right:0;transform-origin:100% 50%;border-radius:0 calc(var(--u)*13) 0 0}
.d-leaf::after{content:'';position:absolute;top:50%;width:calc(var(--u)*1.2);height:calc(var(--u)*1.2);border-radius:50%;background:var(--aL)}
.d-leaf.l::after{right:12%}.d-leaf.r::after{left:12%}
.scene.act .d-leaf.l{animation:leafl 1.3s var(--out) both;animation-delay:var(--t0)}
.scene.act .d-leaf.r{animation:leafr 1.3s var(--out) both;animation-delay:var(--t0)}
@keyframes leafl{to{transform:rotateY(-96deg)}}
@keyframes leafr{to{transform:rotateY(96deg)}}
.d-glow{position:absolute;inset:-45% -60%;border-radius:50%;background:radial-gradient(closest-side,rgba(232,95,106,.6),rgba(211,63,73,.2) 50%,transparent);opacity:0;pointer-events:none}
.scene.act .d-glow{animation:fade 1.4s var(--out) both,halo 4s ease-in-out infinite;animation-delay:calc(var(--t0) + .3s),calc(var(--t0) + 1.7s)}
.d-ray{position:absolute;left:50%;bottom:0;width:calc(var(--u)*2.2);height:140%;margin-left:calc(var(--u)*-1.1);transform-origin:50% 100%;transform:rotate(var(--a)) scaleY(0);background:linear-gradient(180deg,transparent,rgba(255,255,255,.45));opacity:0;pointer-events:none;z-index:-1}
.scene.act .d-ray{animation:ray 1.2s var(--out) both;animation-delay:calc(var(--t0) + .5s)}
@keyframes ray{to{opacity:1;transform:rotate(var(--a)) scaleY(1)}}

/* 21 · the call */
.cta{grid-template-columns:1.3fr .7fr}
.btns{display:flex;flex-wrap:wrap;gap:calc(var(--u)*1.8)}
.btn{display:inline-flex;align-items:center;min-height:calc(var(--u)*7);padding:0 calc(var(--u)*3.6);border-radius:99px;font:600 calc(var(--u)*2.8)/1 var(--text);white-space:nowrap}
.b1{background:linear-gradient(135deg,var(--a),var(--aD));color:#fff;box-shadow:0 calc(var(--u)*1.6) calc(var(--u)*4) rgba(178,47,58,.4)}
.b2{border:1.5px solid rgba(255,255,255,.4);color:#fff}
.qr{justify-self:center;background:#fff;border-radius:calc(var(--u)*2);padding:calc(var(--u)*2.4);display:grid;gap:calc(var(--u)*1.2);justify-items:center;box-shadow:0 calc(var(--u)*4) calc(var(--u)*9) rgba(4,6,10,.6)}
.qr svg{width:calc(var(--u)*30);height:calc(var(--u)*30);fill:#17191F;display:block}
.qr span{font:600 calc(var(--u)*2.2)/1 var(--text);color:#17191F;letter-spacing:.08em;text-transform:uppercase}
.qr{position:relative;overflow:hidden}
.scanl{position:absolute;left:8%;right:8%;top:8%;height:calc(var(--u)*.6);background:var(--aL);box-shadow:0 0 calc(var(--u)*2) var(--aL);opacity:0}
.scene.act .scanl{animation:scanl 2.2s ease-in-out infinite;animation-delay:calc(var(--t0) + .8s)}
@keyframes scanl{0%{opacity:0;transform:translateY(0)}10%{opacity:.9}90%{opacity:.9}100%{opacity:0;transform:translateY(calc(var(--u)*30))}}
.b1{position:relative;overflow:hidden}
.b1::after{content:'';position:absolute;inset:0;background:linear-gradient(110deg,transparent 35%,rgba(255,255,255,.4) 50%,transparent 65%);transform:translateX(-130%)}
.scene.act .b1::after{animation:glare 2.6s ease-in-out infinite;animation-delay:calc(var(--t0) + 1s)}

/* 22 · the close */
.mark.big{width:calc(var(--u)*22);position:relative}
.mark.big .mk{position:relative;z-index:1}
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
  .split,.split.wide{grid-template-columns:1fr;grid-template-rows:auto auto;gap:calc(var(--u)*6);align-content:center}
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
  .door{width:calc(var(--u)*34);grid-column:1/-1;order:-1}
  .door-row{grid-template-columns:1fr 1fr;gap:calc(var(--u)*3)}
  .who b{font-size:calc(var(--u)*3.2)}
  .sub2{font-size:calc(var(--u)*2.9)}
  .ghost{font-size:calc(var(--u)*70);top:-4%}
  .cta{grid-template-columns:1fr}
  .qr svg{width:calc(var(--u)*36);height:calc(var(--u)*36)}
  .mark.big{width:calc(var(--u)*28)}
  .figs{flex-wrap:wrap;gap:calc(var(--u)*4)}
  .lead-wrap{grid-template-columns:.9fr 1.1fr;gap:calc(var(--u)*2.4)}
  .phone.small{width:36%;bottom:-8%}
  .wall{width:86%}
  .ladders{gap:calc(var(--u)*3)}
  .go{top:calc(var(--u)*-8)}
  .steps3 .zero b{font-size:calc(var(--u)*11)}
  .qr.mini{display:none}
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
    <symbol id="i-lock" viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></symbol>
    <symbol id="i-spark" viewBox="0 0 24 24"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/></symbol>
    <symbol id="i-doc" viewBox="0 0 24 24"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/></symbol>
    <symbol id="i-chart" viewBox="0 0 24 24"><path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/></symbol>
    <symbol id="i-bolt" viewBox="0 0 24 24"><path d="M13 2 4 14h7l-1 8 9-12h-7z"/></symbol>
    <symbol id="i-users" viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.5"/><path d="M3 20a6 6 0 0 1 12 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M21 20a6 6 0 0 0-4.5-5.8"/></symbol>
    <symbol id="i-up" viewBox="0 0 24 24"><path d="M12 19V5m-6 6 6-6 6 6"/></symbol>
    <symbol id="i-chat" viewBox="0 0 24 24"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 21l1.9-5.4A8 8 0 1 1 21 12z"/></symbol>
    <symbol id="i-home" viewBox="0 0 24 24"><path d="M3 11 12 3l9 8"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/></symbol>
    <symbol id="i-phone" viewBox="0 0 24 24"><path d="M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2z"/></symbol>
    <symbol id="i-target" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/></symbol>
    <symbol id="i-grid" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/></symbol>
    <symbol id="i-fwd" viewBox="0 0 24 24"><path d="M14 5l7 7-7 7"/><path d="M21 12H9a6 6 0 0 0-6 6v1"/></symbol>
      </defs>
</svg>
<div id="film">
  <div class="aura a1"></div><div class="aura a2"></div>
  <div class="motes">{{MOTES}}</div>
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

MOTES = ''.join(f'<i style="--x:{(i*37+11)%97}%;--d:{14 + (i*7)%9}s;--dl:{-(i*1.9)%14:.1f}s"></i>' for i in range(18))
page = (HTML.replace('{{FONTS}}', FONTS).replace('{{SCENES}}', '\n'.join(S))
        .replace('{{BARS}}', '<i></i>' * len(S)).replace('{{MOTES}}', MOTES))
assert len(S) == len(LINES) == 22, (len(S), len(LINES))
open(OUT, 'w', encoding='utf-8').write(page)
print(f'wrote {os.path.relpath(OUT, ROOT)}: {len(S)} scenes, {sum(dur(i) for i in range(1, len(S) + 1)) / 1000:.1f}s'
      + ('' if timing else ' (estimated: no timing file yet)'))
