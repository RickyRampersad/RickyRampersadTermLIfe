#!/usr/bin/env python3
"""Assemble the board films: what management, Client Support and agents each see on the client transition board.

14 October 2026: "can the video be revised and add animation as well motion built in?" The outline given on
13 October for the manager to record became a narrated film instead, with the board's own screens drawn and
moving: a cursor that clicks where the voice says, fields that type, bars that fill, a flag that turns red and
clears. Same shell as the other films (donthaveanagent/client-film.html, cloned for its embedded faces and its
scene runner), the branch's theme as in build-orphanfilm.py.

Every motion is timed to the word that names it: board-timing.json carries each scene's length and each spoken
word's start (edge-tts's WordBoundary events), so a re-voiced line re-times its own scene.

Three films, one per login (14 October 2026: "there's three videos. There is what the agents see, there's what the staff
see, and there's what management sees"): boardmgr (the branch manager and the unit managers), boardstaff (Client
Support) and boardagent. Each has its own <key>-lines.json and <key>-timing.json; the scenes are drawn by the visuals
below, which the three share.

Every name and every number on screen is made up. The MP4 sits at a public URL.

  python3 build-boardfilm.py boardmgr|boardstaff|boardagent
"""
import json, pathlib, re, sys, math

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent.parent
SRC = ROOT / 'donthaveanagent' / 'client-film.html'
KEY = sys.argv[1] if len(sys.argv) > 1 else 'boardmgr'
PAGES = {'boardmgr': 'board-management.html', 'boardstaff': 'board-client-support.html', 'boardagent': 'board-agents.html'}
TITLES = {'boardmgr': 'The board, for management', 'boardstaff': 'The board, for Client Support', 'boardagent': 'The board, for agents'}
OUT = ROOT / 'orphan-transition' / PAGES[KEY]
TM = json.load(open(HERE / f'{KEY}-timing.json'))
SCRIPT = json.load(open(HERE / f'{KEY}-lines.json'))
LINES, ROLE = SCRIPT['scenes'], SCRIPT['role']
DUR = [int(round(d * 1000)) for d in TM['durs']]
WORDS = TM['words']
assert len(LINES) == len(DUR) == len(WORDS), 'script, timing and words disagree on the number of scenes'
OFF = 400   # the mixer starts each line 0.4 s into its scene

def norm(s): return re.sub(r'[^a-z0-9]', '', s.lower())

def w(i, word, nth=1, shift=0):
    """When the word is spoken in scene i, in ms from the start of the scene."""
    k = 0
    for t, x in WORDS[i]:
        if norm(x) == norm(word):
            k += 1
            if k == nth: return t + OFF + shift
    raise SystemExit(f'scene {i + 1}: no word {word!r} (#{nth})')

def wo(i, word, nth=1, shift=0):
    """w, or None when the line does not say the word."""
    try: return w(i, word, nth, shift)
    except SystemExit: return None

KF = []      # keyframes generated per scene (the cursor's path)

def ms(t): return f'{int(t)}ms'

def at(t, cls='at', extra='', tag='div', inner='', style=''):
    return f'<{tag} class="{cls}" style="--at:{ms(t)};{style}"{extra}>{inner}</{tag}>'

def cursor(name, D, moves, kind='arrow'):
    """moves: [(t_arrive, x, y)]; the first entry is where it appears. Each move takes 650 ms and ends at t_arrive."""
    fr = []
    (t0, x0, y0) = moves[0]
    fr.append((0, x0, y0, 0)); fr.append((max(1, t0 - 300), x0, y0, 0)); fr.append((t0, x0, y0, 1))
    px, py = x0, y0
    for (t, x, y) in moves[1:]:
        fr.append((max(fr[-1][0] + 1, t - 650), px, py, 1)); fr.append((t, x, y, 1)); px, py = x, y
    fr.append((D, px, py, 1))
    css = '@keyframes ' + name + '{' + ''.join(
        f'{min(100, 100 * t / D):.3f}%{{transform:translate({x}px,{y}px);opacity:{o};animation-timing-function:cubic-bezier(.45,0,.2,1)}}'
        for (t, x, y, o) in fr) + '}'
    KF.append(css)
    icon = CUR_SVG if kind == 'arrow' else ''
    return f'<div class="cur {kind}" style="animation:{name} {D}ms linear both">{icon}</div>'

def click(t, x, y):
    return f'<i class="rip" style="--at:{ms(t)};left:{x}px;top:{y}px"></i>'

def typed(t, text, per=55, cls='tyy'):
    n = max(1, len(text))
    return f'<span class="{cls}" style="--at:{ms(t)};--n:{n};--dur:{n * per}ms">{text}</span>'

SHIELD = ('<svg class="shield{cls}" viewBox="0 0 48 48" aria-hidden="true">'
          '<defs><linearGradient id="{gid}" x1="0" y1="0" x2="0" y2="1">'
          '<stop offset="0" stop-color="#efc24b"/><stop offset="1" stop-color="#c9942c"/>'
          '</linearGradient></defs>'
          '<path d="M24 5 L39 10 V24 C39 33 32 40 24 43 C16 40 9 33 9 24 V10 Z" fill="url(#{gid})"/>'
          '<path d="M16.5 24.5 L21.5 29.5 L32 18.5" fill="none" stroke="#fff" stroke-width="4" '
          'stroke-linecap="round" stroke-linejoin="round"/></svg>')
CUR_SVG = ('<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 2.5l14.5 9.6-6.3 1.4 3.6 6.6-2.7 1.4-3.6-6.6-4.6 4.3z" '
           'fill="#fff" stroke="#07131f" stroke-width="1.4" stroke-linejoin="round"/></svg>')

def br(t): return (t or '').replace(' / ', '<br>')

# ── the board, drawn ─────────────────────────────────────────────────────
MENUS = {'branch': [('urgent', 'Urgent', '12'), ('dash', 'Dashboard', ''), ('agents', 'Agents', ''), ('match', 'Match', ''),
                    ('assign', 'To assign', '57'), ('calls', 'Call list', '41'), ('hh', 'Households', '38')],
         'staff': [('mine', 'Your calls', '23'), ('work', 'Your work', ''), ('urgent', 'Urgent', '12'), ('assign', 'To assign', '57'),
                   ('agents', 'Agents', ''), ('calls', 'Call list', '41'), ('hh', 'Households', '38')],
         'unit': [('open', 'Open', '14'), ('work', 'Your work', ''), ('dash', 'Dashboard', ''), ('agents', 'Agents', ''),
                  ('urgent', 'Urgent', '2'), ('done', 'Done', ''), ('team', 'Your team', '')],
         'agent': [('open', 'To call', '6'), ('work', 'Your work', ''), ('done', 'Done', ''), ('all', 'All', '')]}
ME = {'branch': ('B', 'The branch', 'Branch manager'), 'staff': ('C', 'Client Support', 'Staff'), 'unit': ('U', 'Your unit', 'Unit manager'),
      'agent': ('A', 'Andrea Lewis', 'Agent')}

def app(i, main, on='urgent', switch=None, url='rickyrampersadbranch.com/orphanmanagement', menu=True, url_type=None, extra='', role=None):
    """A laptop screen with the board in it. switch=(t, key) moves the menu's selection at t."""
    role = role or ('branch' if ROLE == 'branch' else ROLE)
    items = ''
    for k, label, n in MENUS[role]:
        cls = 'mi'
        style = ''
        if k == on and not switch: cls += ' on'
        if switch and k == on: cls += ' on off-at'; style = f'--at:{ms(switch[0])}'
        if switch and k == switch[1]: cls += ' on-at'; style = f'--at:{ms(switch[0])}'
        items += f'<div class="{cls}" style="{style}"><span>{label}</span>{f"<b>{n}</b>" if n else ""}</div>'
    av, nm, rl = ME[role]
    side = (f'<div class="side"><div class="me"><i>{av}</i><div><b>{nm}</b><span>{rl}</span></div></div>'
            f'<div class="grp">{"Yours" if role in ("staff", "agent", "unit") else "Act on"}</div>{items}</div>') if menu else ''
    u = typed(url_type, url, 42, 'tyy furl') if url_type is not None else f'<span class="furl">{url}</span>'
    return (f'<div class="scr st d1"><div class="tb"><i></i><i></i><i></i><div class="ub">🔒 {u}</div></div>'
            f'<div class="ab">{SHIELD.format(cls=" sm", gid=f"sa{i}")}<div class="an"><b>Ricky Rampersad Branch</b>'
            f'<span>Client transition board</span></div><div class="abr"><span>Help</span><span>Refresh</span><span class="so">Sign out</span></div></div>'
            f'<div class="bd{"" if menu else " nomenu"}">{side}<div class="main">{main}</div></div>{extra}</div>')

def phone(i, body, title='Your list', who='Andrea', extra=''):
    return (f'<div class="phn st d1"><div class="ps"><div class="pab">{SHIELD.format(cls=" sm", gid=f"sp{i}")}<b>{title}</b>'
            f'<span>· {who}</span></div><div class="pbd">{body}</div>{extra}</div></div>')

def side(sc, cues):
    """The left column: the eyebrow, the headline, and lines that land on the words that name them."""
    out = f'<div class="sd"><div class="eyebrow st">{sc["eyebrow"]}</div><h2 class="st d2">{br(sc.get("headline", ""))}</h2>'
    if cues:
        out += '<div class="cues">' + ''.join(at(t, 'at l cue' + (' gold' if g else ''), inner=txt) for (t, txt, g) in cues) + '</div>'
    return out + '</div>'

def stage(left, right):
    return f'<div class="bstage">{left}<div class="rt">{right}</div></div>'

# ── the scenes ───────────────────────────────────────────────────────────
def s_title(i, sc, D):
    rnd = [((k * 73) % 97) / 97 for k in range(80)]
    pins = [(250, 150), (1000, 140), (300, 420), (960, 430)]
    dots = ''
    t = int(DUR[i] * 0.42)
    for k in range(28):
        x = int(40 + rnd[k] * 1140); y = int(30 + rnd[k + 28] * 480)
        if 380 < x < 860 and 120 < y < 420: x = x - 330 if x < 620 else x + 330
        px, py = min(pins, key=lambda p: (p[0] - x) ** 2 + (p[1] - y) ** 2)
        ang = k * 2.39996; r = 26 + (k % 3) * 12
        tx, ty = int(px + r * math.cos(ang) - x), int(py + r * math.sin(ang) - y)
        dots += f'<i class="hd" style="left:{x}px;top:{y}px;--dx:{tx}px;--dy:{ty}px;--at:{ms(t + k * 35)}"></i>'
    pin = ''.join(f'<b class="gpin" style="left:{x - 13}px;top:{y - 13}px;--at:{ms(t + 900)}"></b>' for (x, y) in pins)
    return (f'<div class="net">{dots}{pin}</div><div class="ttl">{SHIELD.format(cls="", gid=f"st{i}")}'
            f'<div class="eyebrow st d2">{sc["eyebrow"]}</div><h1 class="st d3">{br(sc["headline"])}</h1>'
            f'<div class="big-sub st d4">{sc["sub"]}</div></div>')

def s_flow(i, sc, D):
    a1, a2 = w(i, 'Each'), w(i, 'agent')
    letters = [('Wants an agent now', 'hot'), ('Keep looking after my policy', ''), ('Talk it through first', '')]
    lt = ''.join(at(700 + k * 450, 'at l env', inner=f'<span class="ic">✉</span><div><b>Answered the letter</b><i class="{c}">{x}</i></div>') for k, (x, c) in enumerate(letters))
    agents = ''.join(at(a2 + k * 220, 'at pop av', inner=f'<i>{x}</i><span>{n}</span>') for k, (x, n) in enumerate([('AL', 'Andrea'), ('MA', 'Marcus'), ('KJ', 'Kevon')]))
    chips = ''.join(at(w(i, x) - 150, 'at up fchip', inner=f'Every {x}') for x in ('name', 'call', 'note'))
    return (f'<div class="flowwrap"><div class="eyebrow st">{sc["eyebrow"]}</div><h2 class="st d2 c">{br(sc["headline"])}</h2>'
            f'<div class="flow"><div class="col">{lt}</div>'
            f'{at(a1 - 300, "at arrow", inner="<i></i>")}'
            f'<div class="col mid">{at(a1, "at pop mini", inner=SHIELD.format(cls="", gid=f"sf{i}") + "<b>One board</b>")}<div class="fchips">{chips}</div></div>'
            f'{at(a2 - 300, "at arrow", inner="<i></i>")}'
            f'<div class="col agents">{agents}</div></div></div>')

def s_signin(i, sc, D):
    tF1, tF2, tBtn = w(i, 'number'), w(i, 'password'), w(i, 'password', shift=1100)
    tOut = w(i, 'Sign', 2)
    gate = (f'<div class="gate until" style="--at:0ms;--to:{ms(tBtn + 350)}"><div class="gc"><b>Sign in to the board</b>'
            f'<label>Agent number or your name</label><div class="fld f1">{typed(tF1 - 200, "A10024", 90)}</div>'
            f'<label>Password</label><div class="fld f2">{typed(tF2 - 100, "••••••••", 70)}</div>'
            f'<div class="bbtn prs" style="--at:{ms(tBtn)}">Open the board</div>'
            f'<p>This device keeps you signed in until you press Sign out.</p></div></div>')
    rows = rowlist([('Ravi P.', 'Call-back: a licensed agent', 'hot'), ('Keisha T.', 'Wants an agent now', 'hot'), ('Joel B.', 'Former agent in touch', 'hot'),
                    ('Nadia K.', 'Asked for a call', ''), ('Sean D.', 'Keep looking after my policy', '')], tBtn + 500)
    first = {'branch': 'Urgent <small>12</small>', 'staff': 'Your calls <small>23</small>', 'agent': 'To call <small>6</small>'}[ROLE]
    main = f'{gate}<div class="after" style="--at:{ms(tBtn + 400)}"><h3>{first}</h3>{rows}</div>'
    cur = cursor(f'k{i}', D, [(tF1 - 900, 560, 420), (tF1 - 250, 470, 205), (tF2 - 150, 470, 266), (tBtn - 40, 470, 318), (tOut - 50, 790, 52)])
    extra = cur + click(tF1 - 250, 470, 205) + click(tF2 - 150, 470, 266) + click(tBtn, 470, 318) + f'<i class="glow" style="--at:{ms(tOut)};left:752px;top:38px"></i>'
    cues = [(w(i, 'Open'), 'rickyrampersadbranch.com/orphanmanagement', False), (w(i, 'Sign'), 'Your agent number or first name, and your password', False),
            (w(i, 'device'), 'Signed in on this device until you press Sign out', True)]
    return stage(side(sc, cues), app(i, main, menu=False, url_type=500, extra=extra))

def rowlist(rows, t0, gap=180, cls='rw'):
    out = ''
    for k, (n, why, hot) in enumerate(rows):
        out += at(t0 + k * gap, f'at l {cls}', inner=f'<span class="cb"></span><div class="rn"><b>{n}</b><i class="{"hot" if hot else ""}">{why}</i></div>'
                                                        f'<span class="tel">☎</span><span class="lb">Log call</span>')
    return out

def s_urgent(i, sc, D):
    t1, t2 = w(i, 'First'), w(i, 'Then')
    g1 = at(t1 - 100, 'at l gh', inner='<b>Call-back asked: a licensed agent</b><i>Client Support spoke to them. Name an agent.</i>')
    r1 = rowlist([('Ravi P.', 'Call-back: a licensed agent · asked by Client Support', 'hot'), ('Lena S.', 'Call-back: a licensed agent · wants to review cover', 'hot')], t1 + 150)
    g2 = at(t2 - 100, 'at l gh', inner='<b>Told us something pressing</b><i>An agent now, a former agent in touch, a payment to trace.</i>')
    r2 = rowlist([('Keisha T.', 'Wants an agent now', 'hot'), ('Joel B.', 'The former agent has been in touch', 'hot'), ('Maya R.', 'Paid, and it is not showing', 'hot')], w(i, 'agent', 1) + 100)
    main = f'<h3>Urgent <small>12</small></h3>{g1}{r1}{g2}{r2}'
    cues = [(t1, '1 · The call-backs Client Support asked for', False), (t2, '2 · An agent now, or a former agent in touch', False)]
    return stage(side(sc, cues), app(i, main, on='urgent'))

def s_agents(i, sc, D):
    tSw = 900
    tHH, tAns, tFar = w(i, 'households'), w(i, 'answered'), w(i, 'far')
    tiles = [(tHH, '148', 'Households with no agent', ''), (tAns, '38', 'Answered, still no agent', 'crit'), (tAns + 300, '12', 'Urgent households', 'crit'),
             (tFar - 300, '9 of 19', 'Agents with clients', ''), (tFar, '41%', 'Spoken to by their agent', ''), (tFar + 300, '7', 'Nothing logged', 'crit')]
    tl = ''.join(at(t, f'at pop tile {c}', inner=f'<b>{n}</b><span>{l}</span>') for (t, n, l, c) in tiles)
    seg = [('#07606f', 14), ('#1d8fa6', 12), ('#62bfd2', 15), ('#a9dbe6', 9), ('#e3eaef', 50)]
    bar = ''.join(f'<i class="gr" style="--at:{ms(tHH + 200 + k * 140)};--w:{p}%;background:{c}"></i>' for k, (c, p) in enumerate(seg))
    main = (f'<div class="after" style="--at:{ms(tSw + 200)}"><h3>Agents</h3><div class="hero"><b data-count="64" data-suffix="%">64%</b>'
            f'<span>of the <b>412</b> households of the books have an agent: <b>251</b> in full, <b>13</b> in part.</span></div>'
            f'<div class="stk">{bar}</div><div class="tiles">{tl}</div></div>')
    extra = cursor(f'k{i}', D, [(300, 400, 300), (tSw, 70, 177)]) + click(tSw, 70, 177)
    cues = [(tHH, 'Households with an agent', False), (tAns, 'Answered, and still waiting', False), (tFar, 'How far each agent has got', True)]
    return stage(side(sc, cues), app(i, main, on='urgent', switch=(tSw, 'agents'), extra=extra))

AG = [('Andrea Lewis', 6, 9, [3, 2, 3, 1, 0], '13 Oct', 0), ('Marcus Ali', 5, 7, [1, 2, 2, 0, 2], '12 Oct', 0),
      ('Kevon James', 4, 6, [0, 1, 1, 1, 3], '9 Oct', 3), ('Lisa Chan', 3, 4, [2, 1, 1, 0, 0], '13 Oct', 0), ('Dion Bristol', 3, 3, [0, 0, 1, 0, 2], '8 Oct', 0)]
STC = ['#07606f', '#1d8fa6', '#62bfd2', '#a9dbe6', '#e3eaef']

def agrow(k, a, t0, times, red_at=None, cls=''):
    name, hh, n, g, last, q = a
    segs = ''
    for s in range(5):
        if g[s]: segs += f'<i class="gr" style="--at:{ms(times[s])};--w:{100 * g[s] / n:.1f}%;background:{STC[s]}"></i>'
    nothing = g[4]
    red = f' red-at" style="--at:{ms(red_at)}' if (red_at and q) else ''
    sp = g[0] + g[1] + g[2]
    return at(t0 + k * 170, f'at l tr {cls}', inner=f'<span class="nm">{name}</span><span>{hh}</span><span>{n}</span><span class="pb">{segs}</span>'
                                                    f'<span>{round(100 * sp / n)}%</span><span class="nl{red}">{nothing}{" · " + str(q) + " past 2 days" if q and red_at else ""}</span><span>{last}</span>')

CONV = [(14, 56, 3), (9, 44, 4), (2, 17, 9), (8, 75, 2), (3, 33, 6)]   # conversations, converted %, days waited (average)

def s_table(i, sc, D):
    tCv, tCo, tDw, tRed = w(i, 'Conversations'), w(i, 'Converted'), w(i, 'days'), w(i, 'red')
    times = [tCo, tCo, tCv, tCv, 500]
    head = ('<div class="th c8"><span>Agent</span><span>Clients</span><span>Progress</span><span class="hc1">Conversations</span><span class="hc2">Converted</span>'
            '<span class="hc3">Days waited</span><span>Nothing logged</span><span>Last activity</span></div>')
    rows = ''
    for k, a in enumerate(AG):
        name, hh, n, g, last, q = a
        cv, co, dw = CONV[k]
        segs = ''.join(f'<i class="gr" style="--at:{ms(times[s])};--w:{100 * g[s] / n:.1f}%;background:{STC[s]}"></i>' for s in range(5) if g[s])
        red = f' red-at" style="--at:{ms(tRed)}' if q else ''
        rows += at(500 + k * 170, 'at l tr c8', inner=f'<span class="nm">{name}</span><span>{n}</span><span class="pb">{segs}</span>'
                   f'{at(tCv + 100 + k * 90, "at pop", tag="span", inner=str(cv))}{at(tCo + 100 + k * 90, "at pop", tag="span", inner=str(co) + "%")}'
                   f'{at(tDw + 100 + k * 90, "at pop" + (" warn" if dw > 7 else ""), tag="span", inner=str(dw) + " days")}'
                   f'<span class="nl{red}">{g[4]}{" · past 2 days" if q else ""}</span><span>{last}</span>')
    hl = ''.join(f'<i class="colhl" style="--at:{ms(t)};left:{x}%;width:{wd}%"></i>' for (t, x, wd) in [(tCv, 37.5, 13), (tCo, 50.5, 11), (tDw, 61.5, 12)])
    main = f'<h3>The agents</h3><div class="tbl rel">{hl}{head}{rows}</div>'
    cues = [(tCv, 'Conversations', False), (tCo, 'Converted: met or completed', False), (tDw, 'Days their clients have waited', False), (tRed, 'Nothing logged after two days: red', True)]
    return stage(side(sc, cues), app(i, main, on='agents'))

def s_batches(i, sc, D):
    tU, tF, tA = w(i, 'Urgent'), w(i, 'families'), w(i, 'asked')
    chips = [('Urgent', '12', tU, tF), ('Finish the family', '4', tF, tA), ('Asked us', '57', tA, D + 999), ('Answered or reached', '31', None, None),
             ('Not answered yet', '268', None, None), ('Letter held', '22', None, None)]
    ch = ''.join((f'<span class="chp hl" style="--at:{ms(a)};--to:{ms(b)}">' if a else '<span class="chp">') + f'{x} <b>{n}</b></span>' for (x, n, a, b) in chips)
    def cards(t1, t2, hs):
        return (f'<div class="cards until" style="--at:{ms(t1)};--to:{ms(t2)}">' +
                ''.join(f'<div class="hc"><b>{h}</b><i>{s}</i><span class="sg">Suggested <b>{a}</b></span></div>' for (h, s, a) in hs) + '</div>')
    c1 = cards(tU, tF, [('Persad household · 2 people', 'Call-back: a licensed agent', 'Marcus Ali'), ('Thomas household · 1 person', 'Wants an agent now', 'Kevon James'),
                        ('Ramlal household · 3 people', 'Former agent in touch', 'Andrea Lewis')])
    c2 = cards(tF, tA, [('Mohan household · 3 people', '1 named, 2 to name', 'Andrea Lewis'), ('Baptiste household · 2 people', '1 named, 1 to name', 'Lisa Chan')])
    c3 = cards(tA, D + 999, [('Singh household · 2 people', 'Keep looking after my policy', 'Dion Bristol'), ('Charles household · 1 person', 'Talk it through first', 'Marcus Ali'),
                             ('Ali household · 4 people', 'Asked for a call', 'Kevon James')])
    main = f'<h3>Households to name</h3><div class="chps">{ch}</div><div class="cardsw">{c1}{c2}{c3}</div>'
    cues = [(tU, '1 · Urgent', False), (tF, '2 · Families half named', False), (tA, '3 · Everyone who asked us', False)]
    return stage(side(sc, cues), app(i, main, on='agents'))

def s_assign(i, sc, D):
    tP, tB = w(i, 'names'), wo(i, 'batch')
    if tB is None: return s_assign_one(i, sc, D, tP)
    mem = [('Anita M.', 'Answered: wants an agent now', 'ok'), ('Ravi M.', 'Written to, no answer', ''), ('Priya M.', '16 · letter held', 'mut')]
    ms_ = ''.join(f'<div class="hm"><b>{n}</b><span class="{c}">{s}</span>{at(tP + 250 + k * 160, "at pop tag", tag="span", inner="Agent Andrea Lewis")}</div>' for k, (n, s, c) in enumerate(mem))
    card = (f'<div class="hcard"><div class="hh"><b>Mohan household</b><i>3 people · Chaguanas</i></div>{ms_}'
            f'<div class="sgl"><span class="sl">Suggested</span><b>Andrea Lewis</b><i>the family&rsquo;s agent: the 24 Sep plan</i>'
            f'<span class="ab1 prs" style="--at:{ms(tP)}"><span class="a until" style="--at:0ms;--to:{ms(tP + 120)}">Assign the 3 to Andrea</span>'
            f'<span class="b at" style="--at:{ms(tP + 120)}">✓ Named</span></span></div></div>')
    batch = (f'<div class="btt"><div class="btr"><b>Marcus Ali</b><span>9 households</span><span>11 clients</span>'
             f'<span class="ab2 prs" style="--at:{ms(tB + 250)}">Assign these 9 to Marcus</span></div></div>')
    toast1 = f'<div class="toast until" style="--at:{ms(tP + 350)};--to:{ms(tB + 300)}">Named: Andrea 3 · brief e-mailed</div>'
    toast2 = f'<div class="toast at" style="--at:{ms(tB + 450)}">Named: Marcus 9 · brief e-mailed</div>'
    main = f'<h3>Households to name <small>Urgent</small></h3>{card}<h4>This batch by suggested agent</h4>{batch}'
    extra = (cursor(f'k{i}', D, [(1200, 620, 420), (tP - 30, 700, 296), (tB + 220, 700, 425)]) + click(tP, 700, 296) + click(tB + 250, 700, 425) + toast1 + toast2)
    cues = [(w(i, 'suggested'), 'One suggested agent a household', False), (tP, 'One press names the household', True), (tB, 'Or a whole batch at once', False)]
    return stage(side(sc, cues), app(i, main, on='agents', extra=extra))

def s_assign_one(i, sc, D, tP):
    """Naming one household, as Client Support do it on their own board: the brief goes, there is no batch."""
    mem = [('Anita M.', 'Answered: wants an agent now', 'ok'), ('Ravi M.', 'Reached by phone', ''), ('Priya M.', '16 · on the call list', 'mut')]
    ms_ = ''.join(f'<div class="hm"><b>{n}</b><span class="{c}">{s}</span>{at(tP + 250 + k * 160, "at pop tag", tag="span", inner="Agent Andrea Lewis")}</div>' for k, (n, s, c) in enumerate(mem))
    card = (f'<div class="hcard"><div class="hh"><b>Mohan household</b><i>3 people · Chaguanas · on your board</i></div>{ms_}'
            f'<div class="sgl"><span class="sl">Suggested</span><b>Andrea Lewis</b><i>the family&rsquo;s agent: the 24 Sep plan</i>'
            f'<span class="ab1 prs" style="--at:{ms(tP)}"><span class="a until" style="--at:0ms;--to:{ms(tP + 120)}">Assign the 3 to Andrea</span>'
            f'<span class="b at" style="--at:{ms(tP + 120)}">✓ Named</span></span></div></div>')
    tBr = w(i, 'brief')
    toast = f'<div class="toast at" style="--at:{ms(tBr - 200)}">Named: Andrea 3 · brief e-mailed to Andrea</div>'
    mail = at(tBr, 'at pop mailfly', inner='✉ Brief to Andrea Lewis')
    main = f'<h3>Households to name <small>On your board</small></h3>{card}{mail}'
    extra = cursor(f'k{i}', D, [(900, 620, 420), (tP - 30, 700, 296)]) + click(tP, 700, 296) + toast
    cues = [(w(i, 'suggested'), 'One suggested agent a household', False), (tP, 'One press names the household', True), (tBr, 'The agent gets a brief by e-mail', False)]
    return stage(side(sc, cues), app(i, main, on='agents', extra=extra))

def rows_at(i, sc, defaults):
    """Each row's moment: the word it names (its "at"), else the defaults in order."""
    return [w(i, r['at']) if r.get('at') else w(i, d) for r, d in zip(sc['rows'], defaults + [None] * len(sc['rows']))]

def s_named(i, sc, D):
    rows = sc['rows']
    ts = rows_at(i, sc, ['brief', 'list', 'Salesforce'])
    ics = ['✉', '☰', '⟳']
    rw = ''.join(at(t, 'at l keep', inner=f'<span class="tkk">{ic}</span><div><b>{r["b"]}</b><i>{r["i"]}</i></div>' +
                    ('<span class="clock"><i></i></span>' if k == 2 else ''))
                 for k, (t, r, ic) in enumerate(zip(ts, rows, ics)))
    return (f'<div class="center"><div class="eyebrow st">{sc["eyebrow"]}</div><h2 class="st d2 c">{br(sc.get("headline", "What happens <em>next</em>"))}</h2>'
            f'<div class="keeps">{rw}</div></div>')

def s_list(i, sc, D):
    tB, tNo, tDay = w(i, 'board'), w(i, 'naming'), w(i, 'every', 2)
    rows = [('Keisha T.', 'Named 14 Oct · on the board', 'Wants an agent now'), ('Lena S.', 'Named 13 Oct · in Salesforce', 'Call-back: a licensed agent'),
            ('Omar H.', 'Named 13 Oct · in Salesforce', 'Keep looking after my policy'), ('Gail W.', 'Named 12 Oct · on the board', 'Talk it through first'),
            ('Ian F.', 'Named 9 Oct · in Salesforce', 'Asked for a call')]
    body = (f'<div class="ptabs"><span class="on">To call <b>6</b></span><span>Your work</span><span>Done</span></div>'
            + at(tDay, 'at pop prw new', inner='<b>Ravi P.</b><i>Named today · in Salesforce</i><em>Call-back: a licensed agent</em>')
            + ''.join(at(500 + k * 260, 'at l prw', inner=f'<b>{n}</b><i>{x}</i><em>{s}</em>') for k, (n, x, s) in enumerate(rows)))
    cues = [(600, 'Every client named to you', False), (tB, 'From the board or from Salesforce', False), (tNo, 'A Salesforce naming sends no e-mail', False),
            (tDay, 'Check your list every day', True)]
    return stage(side(sc, cues), phone(i, body))

def s_client(i, sc, D):
    tN, tL, tF, tT, tC = w(i, 'numbers'), w(i, 'live'), w(i, 'family'), w(i, 'told'), w(i, 'calling')
    blocks = [(tN, 'Reach them', '<span class="big">☎ 868 555 0142</span><span>☎ 868 555 0190 · home</span><span>prefers a call · best in the evening</span>'),
              (tL, 'Lives at', '<span class="big">Chaguanas</span><span>Lot 12, Example Street</span>'),
              (tF, 'Household', '<span class="big">Thomas household · 3 people</span><span>1 answered · 1 under 18</span>'),
              (tT, 'What they told us', '<span class="big">“I want an agent now.”</span><span>Answered 26 Sep</span>'),
              (tC, 'Why we call', '<span class="big">Named to you 14 Oct</span><span>Call-back asked by Client Support</span>')]
    body = (f'<div class="prw open"><b>Keisha T.</b><i>Named 14 Oct · on the board</i><em>Wants an agent now</em></div>' +
            ''.join(at(t, 'at up blk', inner=f'<h5>{h}</h5>{x}') for (t, h, x) in blocks))
    extra = cursor(f'k{i}', D, [(150, 150, 300), (450, 150, 95)], kind='touch') + click(450, 150, 95)
    cues = [(tN, 'Their numbers', False), (tL, 'Where they live', False), (tF, 'Their family', False), (tT, 'What they told us', False), (tC, 'Why we are calling', True)]
    return stage(side(sc, cues), phone(i, body, title='Keisha T.', who='client', extra=extra))

def s_logcall(i, sc, D):
    tLog = w(i, 'Log'); tC, tM, tN, tD, tCl = w(i, 'called'), w(i, 'met'), w(i, 'no', 1), w(i, 'declined'), w(i, 'closed')
    tW, tS = w(i, 'Write'), w(i, 'save')
    outs = [('Called', tC), ('Met', tM), ('No answer', tN), ('Declined', tD), ('Closed', tCl)]
    seq = [tC, tM, tN, tD, tCl, tCl + 650]
    ch = ''
    for k, (x, t) in enumerate(outs):
        if k == 0:
            ch += f'<span class="oc lit" style="--at:{ms(t)};--to:{ms(seq[k + 1])}">{x}</span>'.replace('class="oc lit"', 'class="oc lit sel"').replace('";>', '">')
        else:
            ch += f'<span class="oc lit" style="--at:{ms(t)};--to:{ms(seq[k + 1])}">{x}</span>'
    sheet = (f'<div class="sheet" style="--at:{ms(tLog + 150)}"><b>What happened?</b><div class="ocs">{ch}</div>'
             f'<label>A line for the file</label><div class="fld">{typed(tW, "Spoke to her. Visit booked for Friday.", 38)}</div>'
             f'<div class="bbtn prs" style="--at:{ms(tS)}">Save</div></div>')
    body = (f'<div class="prw open"><b>Keisha T.</b><i>Named 14 Oct · on the board</i><em>Wants an agent now</em>'
            f'<span class="lbtn prs" style="--at:{ms(tLog)}">Log call</span></div>'
            f'<div class="blk"><h5>Reach them</h5><span class="big">☎ 868 555 0142</span></div>'
            f'<div class="blk"><h5>Why we call</h5><span class="big">Named to you 14 Oct</span></div>')
    toast = f'<div class="toast tph at" style="--at:{ms(tS + 300)}">Saved: Called</div>'
    extra = (sheet + toast + cursor(f'k{i}', D, [(300, 160, 300), (tLog - 30, 205, 132), (tC + 100, 52, 300), (tW - 200, 120, 382), (tS - 30, 120, 432)], kind='touch')
             + click(tLog, 205, 132) + click(tC + 100, 52, 300) + click(tS, 120, 432))
    cues = [(tLog, 'Press Log call', False), (tC, 'Called · Met · No answer · Declined · Closed', False), (tW, 'One line for the file, then Save', True)]
    return stage(side(sc, cues), phone(i, body, title='Keisha T.', who='client', extra=extra))

def s_comment(i, sc, D):
    tO, tW, tP, tSt = w(i, 'open'), w(i, 'Write'), w(i, 'post'), w(i, 'stays')
    hist = [('25 Sep', 'Our letter went to her'), ('26 Sep', 'She answered: wants an agent now'), ('14 Oct', 'Named to Andrea Lewis'), ('14 Oct', 'Called: visit booked for Friday')]
    hl = ''.join(at(tO + 300 + k * 200, 'at l hii', inner=f'<i>{d}</i><span>{x}</span>') for k, (d, x) in enumerate(hist))
    main = (f'<h3>Keisha T. <small>History · tasks · comments</small></h3><div class="det until" style="--at:0ms;--to:{ms(tO + 200)}"><div class="dl">History · tasks · comments</div></div>'
            f'<div class="dw after" style="--at:{ms(tO + 200)}"><div class="dc"><h5>History</h5>{hl}</div>'
            f'<div class="dc"><h5>Comments</h5>'
            f'<div class="cbox"><div class="fld">{typed(tW, "Visited on Friday. Wants cover for her daughter.", 32)}</div><span class="bbtn prs" style="--at:{ms(tP)}">Post</span></div>'
            + at(tP + 250, 'at pop cm', inner='<b>Andrea Lewis · just now</b><span>Visited on Friday. Wants cover for her daughter.</span>')
            + at(tSt, 'at pop onfile', inner='✓ On the client&rsquo;s file') + '</div></div>')
    extra = (cursor(f'k{i}', D, [(300, 500, 400), (tO - 30, 120, 132), (tW - 150, 560, 214), (tP - 30, 790, 214)]) + click(tO, 120, 132) + click(tW - 150, 560, 214) + click(tP, 790, 214))
    cues = [(tO, 'History · tasks · comments', False), (tW, 'Write it, and post it', False), (tSt, 'It stays on the client&rsquo;s file', True)]
    return stage(side(sc, cues), app(i, main, on='agents', menu=False, extra=extra))

def s_counts(i, sc, D):
    rows = sc['rows']
    ts = rows_at(i, sc, ['log', 'comment', 'Campaign', 'Chatter'])
    rw = ''.join(at(t, 'at l keep' + (' off' if r.get('off') else ''), inner=f'<span class="tkk">{"✕" if r.get("off") else "✓"}</span><div><b>{r["b"]}</b><i>{r["i"]}</i></div>'
                    + (f'<s class="strk" style="--at:{ms(t + 500)}"></s>' if r.get('off') else ''))
                 for (t, r) in zip(ts, rows))
    return (f'<div class="center"><div class="eyebrow st">{sc["eyebrow"]}</div><h2 class="st d2 c">{br(sc.get("headline", "Three ways it <em>counts</em>"))}</h2>'
            f'<div class="keeps">{rw}</div></div>')

def s_sees(i, sc, D):
    tLog, tMv, tCl = w(i, 'log'), w(i, 'moves'), w(i, 'clears')
    head = '<div class="th"><span>Agent</span><span>Households</span><span>Clients</span><span>Progress</span><span>Spoken to</span><span>Nothing logged</span><span>Last activity</span></div>'
    row = (f'<div class="tr big"><span class="nm">Kevon James</span><span>4</span><span>6</span><span class="pb">'
           f'<i class="gr" style="--at:{ms(tMv)};--w:16.7%;background:{STC[0]}"></i><i class="gr" style="--at:{ms(tMv + 150)};--w:16.7%;background:{STC[1]}"></i>'
           f'<i class="gr" style="--at:{ms(tMv + 300)};--w:33.3%;background:{STC[2]}"></i></span>'
           f'<span class="sw2"><span class="a until" style="--at:0ms;--to:{ms(tMv + 200)}">17%</span><span class="b at" style="--at:{ms(tMv + 200)}">67%</span></span>'
           f'<span class="nl red0 clr" style="--at:{ms(tCl)}"><span class="a until" style="--at:0ms;--to:{ms(tCl)}">3 · past 2 days</span><span class="b at" style="--at:{ms(tCl)}">2</span></span>'
           f'<span class="sw2"><span class="a until" style="--at:0ms;--to:{ms(tLog + 300)}">9 Oct</span><span class="b at" style="--at:{ms(tLog + 300)}">today</span></span></div>')
    others = ''.join(agrow(k, a, 300, [300] * 5, cls='dim') for k, a in enumerate([AG[0], AG[1], AG[3]]))
    main = f'<h3>The agents</h3><div class="tbl">{head}{row}{others}</div>'
    cues = [(tLog, 'You log the call', False), (tMv, 'The bar moves', False), (tCl, 'The red flag clears', True)]
    return stage(side(sc, cues), app(i, main, on='agents', role='branch'))

def s_close(i, sc, D):
    three = sc['words3']
    ws = [(w(i, x.split()[0]), x, k == 2) for k, x in enumerate(three)]
    ln = ''.join(at(t, 'at up cl' + (' gold' if g else ''), inner=x) for (t, x, g) in ws)
    return (f'<div class="center" id="finale"><div class="eyebrow st" style="margin-bottom:14px">{sc["eyebrow"]}</div>'
            f'{SHIELD.format(cls="", gid=f"sc{i}")}<div class="cls">{ln}</div>'
            f'{at(ws[-1][0] + 600, "at up furl", inner=sc["url"])}</div>')


def s_since(i, sc, D):
    """Since the naming: every named client by how long ago, conversations and conversion."""
    tN, tF, tM = w(i, 'named'), w(i, 'first'), w(i, 'meeting')
    tiles = [(500, '58%', 'Had a conversation', ''), (700, '21%', 'Converted: met or completed', 'cv'), (900, '64', 'Conversations logged', ''),
             (1100, '2 days', 'To first contact', ''), (1300, '6 days', 'To a meeting', 'mt')]
    tl = ''.join(at(t, f'at pop tile {c}', inner=f'<b>{n}</b><span>{l}</span>') for (t, n, l, c) in tiles)
    bands = [('0 to 2 days ago', [0, 1, 4, 2, 5], 12, 'Had a conversation 58%'), ('3 to 7 days ago', [1, 2, 4, 1, 3], 11, ''),
             ('8 to 14 days ago', [2, 2, 3, 1, 2], 10, ''), ('15 days or more ago', [2, 1, 2, 0, 4], 9, '')]
    rows = ''
    for k, (lab, g, n, _) in enumerate(bands):
        segs = ''.join(f'<i class="gr" style="--at:{ms(tN + 200 + k * 160)};--w:{100 * g[s] / n:.1f}%;background:{STC[s]}"></i>' for s in range(5) if g[s])
        hl = f' hlrow" style="--at:{ms(tF)}' if k == 0 else ''
        rows += at(tN + k * 160, 'at l tr c5', inner=f'<span class="nm{hl}">{lab}</span><span>{n}</span><span class="pb">{segs}</span><span class="{"bad" if k >= 1 and g[4] else ""}">{g[4]}</span><span>{round(100 * (g[0] + g[1]) / n)}%</span>')
    head = '<div class="th c5"><span>Named</span><span>Clients</span><span>Progress</span><span>Nothing logged</span><span>Converted</span></div>'
    main = (f'<h3>Since the naming</h3><div class="tiles t5">{tl}</div><div class="tbl" style="margin-top:12px">{head}{rows}</div>'
            f'<i class="glowbox" style="--at:{ms(tM)};left:206px;top:58px;width:118px;height:58px"></i>')
    cues = [(tN, 'Every client, by how long ago they were named', False), (tF, 'A conversation in the first two days', True), (tM, 'A meeting soon after', False)]
    return stage(side(sc, cues), app(i, main, on='agents'))

def s_reassign(i, sc, D):
    """Reassign one client: the list opens, an agent is chosen, the history grows by one line."""
    tR = w(i, 'Reassign'); tH = w(i, 'history')
    tA = wo(i, 'agent') or wo(i, 'name') or tH
    tD, tWho = w(i, 'date'), w(i, 'who')
    by = 'the branch' if ROLE == 'branch' else 'Client Support'
    pick = 'style="--at:' + ms(tR + 650) + '"'
    opts = ''.join(('<div class="op pick" ' + pick + '>' if x == 'Andrea Lewis' else '<div class="op">') + x + '</div>'
                   for x in ('Andrea Lewis', 'Dion Bristol', 'Lisa Chan', 'Marcus Ali'))
    sel = (f'<div class="rsel prs" style="--at:{ms(tR)}">Reassign to&hellip; ▾</div>'
           f'<div class="dropl until" style="--at:{ms(tR + 80)};--to:{ms(tR + 900)}">{opts}</div>')
    line = (f'<div class="mrow"><div><b>Joel B.</b><small>letter F2 · 52 · Arima</small></div>'
            f'<div class="mw"><span class="ok">Answered: the former agent has been in touch</span>'
            f'<span>Agent <b class="sw2"><span class="a until" style="--at:0ms;--to:{ms(tR + 950)}">Kevon James</span><span class="b at" style="--at:{ms(tR + 950)}">Andrea Lewis</span></b> '
            f'<span class="agst named">nothing logged</span> <span class="mut">12 days since the naming</span></span>'
            f'<span class="hist">History: <b class="hseg" style="--at:{ms(tA)}">Kevon James</b> <i class="hseg d" style="--at:{ms(tD)}">2 Oct</i> <span class="mut">(in Salesforce)</span>'
            + at(tR + 1000, 'at l', tag='span', inner=' &rarr; <b>Andrea Lewis</b> <i class="hseg d" style="--at:' + ms(tD) + '">today</i> <span class="mut">(on the board, <span class="hseg w" style="--at:' + ms(tWho) + '">by ' + by + '</span>)</span>') + '</span>'
            f'{sel}</div></div>')
    toast = f'<div class="toast at" style="--at:{ms(tR + 1000)}">Named: Andrea 1 · the history keeps Kevon James</div>'
    main = f'<h3>Kevon James <small>4 households · 6 clients</small></h3>{line}'
    extra = cursor(f'k{i}', D, [(300, 500, 420), (tR - 30, 640, 222), (tR + 620, 640, 262)]) + click(tR, 640, 222) + click(tR + 650, 640, 262) + toast
    cues = [(tR, 'Choose Reassign', False), (tH, 'The history keeps every agent', False), (tD, 'The date', False), (tWho, 'And who made the change', True)]
    return stage(side(sc, cues), app(i, main, on='agents', extra=extra))

def s_unit(i, sc, D):
    """A unit manager's own view: the team's agents, their clients and conversations, how long each has waited."""
    tT, tC, tCv, tW = w(i, 'team'), w(i, 'clients'), w(i, 'conversations'), w(i, 'waited')
    head = '<div class="th c6"><span>Agent</span><span>Clients</span><span>Progress</span><span>Conversations</span><span>Days waited</span><span>Nothing logged</span></div>'
    team = [('Kevon James', 6, [0, 1, 1, 1, 3], 2, 9, 3), ('Lisa Chan', 4, [2, 1, 1, 0, 0], 8, 2, 0), ('Dion Bristol', 3, [0, 0, 1, 0, 2], 3, 6, 2)]
    rows = ''
    for k, (nm_, n, g, cv, dw, q) in enumerate(team):
        segs = ''.join(f'<i class="gr" style="--at:{ms(tC + 100 + k * 120)};--w:{100 * g[s] / n:.1f}%;background:{STC[s]}"></i>' for s in range(5) if g[s])
        rows += at(tT + k * 170, 'at l tr c6', inner=f'<span class="nm">{nm_}</span><span>{n}</span><span class="pb">{segs}</span>'
                   f'{at(tCv + k * 90, "at pop", tag="span", inner=str(cv))}{at(tW + k * 90, "at pop" + (" warn" if dw > 7 else ""), tag="span", inner=str(dw) + " days")}<span class="{"bad" if q else ""}">{g[4]}</span>')
    main = (f'<h3>Agents <small>your unit</small></h3><div class="hero"><b>13</b><span>clients named to your unit, in <b>10</b> households. Their agents have spoken to <b>46%</b> of them.</span></div>'
            f'<div class="tbl" style="margin-top:12px">{head}{rows}</div><p class="note at" style="--at:{ms(tT + 600)}">Nothing to name here: the branch and Client Support name the agents.</p>')
    cues = [(tT, 'Their own team', False), (tCv, 'Clients and conversations', False), (tW, 'How long each client has waited', True)]
    return stage(side(sc, cues), app(i, main, on='agents', role='unit'))

def s_yourcalls(i, sc, D):
    """Client Support's own list, in order: why to call, the number to tap."""
    tO, tWhy, tNum = w(i, 'order'), w(i, 'why'), w(i, 'number')
    calls = [('1', 'Keisha T.', 'Wrote that no one called', '868 555 0142'), ('2', 'Omar H.', 'Letter bounced: take a working e-mail', '868 555 0177'),
             ('3', 'Gail W.', 'Call-back promised for Wednesday', '868 555 0110'), ('4', 'Ian F.', 'No answer on Monday: try again', '868 555 0163'),
             ('5', 'Lena S.', 'Answered: talk it through first', '868 555 0121')]
    rows = ''.join(at(500 + k * 170, 'at l rw yc', inner=f'<span class="ord">#{n}</span><div class="rn"><b>{c}</b><i class="why" style="--at:{ms(tWhy + k * 120)}">{why}</i></div>'
                      f'<span class="tel big" style="--at:{ms(tNum + k * 120)}">☎ {num}</span><span class="lb">Log call</span>') for k, (n, c, why, num) in enumerate(calls))
    main = f'<h3>Your calls <small>23 · in your order</small></h3>{rows}'
    cues = [(tO, 'Your own list, in order', False), (tWhy, 'Why to call', False), (tNum, 'The number to tap', True)]
    return stage(side(sc, cues), app(i, main, on='mine'))

def s_staffcall(i, sc, D):
    """After a try: the outcome, a line for the file, and the call-back that goes to the top of Urgent."""
    tLog, tH, tL, tF, tTop = w(i, 'Log'), w(i, 'happened'), w(i, 'line'), w(i, 'flag'), w(i, 'top')
    lit = 'style="--at:' + ms(tH + 300) + ';--to:' + ms(D + 999) + '"'
    outs = ''.join(('<span class="oc lit sel" ' + lit + '>' if x == 'Called' else '<span class="oc">') + x + '</span>'
                   for x in ('Called', 'Met', 'No answer', 'Declined', 'Closed'))
    backs = (f'<div class="bks"><span class="bkx">No call-back</span><span class="bkx hot lit sel" style="--at:{ms(tF + 200)};--to:{ms(D + 999)}">A licensed agent should call</span>'
             f'<span class="bkx">The branch should call</span></div>')
    panel = (f'<div class="drawer" style="--at:{ms(tLog + 100)}"><b>Keisha T. · what happened?</b><div class="ocs">{outs}</div>'
             f'<label>A line for the file</label><div class="fld">{typed(tL, "Wants an agent to review her cover.", 34)}</div>'
             f'<label>Call-back</label>{backs}<div class="bbtn prs" style="--at:{ms(tF + 1300)}">Save</div></div>')
    fly = f'<div class="fly" style="--at:{ms(tTop - 300)}">Keisha T. · call-back: a licensed agent</div>'
    body = rowlist([('Keisha T.', 'Wrote that no one called', 'hot'), ('Omar H.', 'Letter bounced: take a working e-mail', ''), ('Gail W.', 'Call-back promised for Wednesday', '')], 300)
    main = f'<h3>Your calls <small>23</small></h3>{body}'
    extra = (panel + fly + f'<i class="badgeup" style="--at:{ms(tTop + 200)}">13</i>' +
             cursor(f'k{i}', D, [(200, 600, 420), (tLog - 30, 742, 142), (tH + 280, 495, 205), (tF + 170, 610, 380), (tF + 1270, 482, 436)]) +
             click(tLog, 742, 142) + click(tH + 300, 495, 205) + click(tF + 200, 610, 380) + click(tF + 1300, 482, 436))
    cues = [(tLog, 'Press Log call', False), (tH, 'What happened, and one line', False), (tF, 'A licensed agent? Flag the call-back', True), (tTop, 'Top of the branch manager&rsquo;s Urgent list', False)]
    return stage(side(sc, cues), app(i, main, on='mine', extra=extra))

def s_yourwork(i, sc, D):
    """Your work: today and this week, and every note, newest first."""
    tT, tW, tN, tB = w(i, 'today'), w(i, 'week'), w(i, 'notes'), w(i, 'branch')
    tally = lambda t, lab, a: at(t, 'at l wt', inner=f'<b>{lab}</b>' + ''.join(f'<span><em>{n}</em> {x}</span>' for n, x in a))
    items = [('14 Oct · Called', 'Keisha T.', 'Wants to review her cover. Needs a licensed agent.'), ('14 Oct · No answer', 'Ian F.', 'Rang twice, voicemail.'),
             ('14 Oct · Named Andrea Lewis', 'Mohan household', 'The family&rsquo;s agent.'), ('13 Oct · Called', 'Omar H.', 'Took a working e-mail, spelled back.')]
    lst = ''.join(at(tN + k * 160, 'at l wl', inner=f'<i>{d}</i> · <b>{c}</b>: {n}') for k, (d, c, n) in enumerate(items))
    main = (f'<h3>Your work</h3>{tally(tT, "Today", [("9", "clients"), ("4", "reached"), ("3", "no answer"), ("2", "call-backs flagged"), ("1", "agent named")])}'
            f'{tally(tW, "Last 7 days", [("41", "clients"), ("19", "reached"), ("14", "no answer"), ("6", "call-backs flagged"), ("5", "agents named")])}'
            f'<h4>What you logged, newest first</h4>{lst}<p class="note at" style="--at:{ms(tB)}">The branch sees the same under Team.</p>')
    cues = [(tT, 'Today', False), (tW, 'This week', False), (tN, 'Your notes, newest first', False), (tB, 'The branch sees the same', True)]
    return stage(side(sc, cues), app(i, main, on='work'))

def s_clock(i, sc, D):
    """The clock starts at the naming: days waited, conversations, a meeting."""
    tD, tCv, tF, tM = w(i, 'days'), w(i, 'conversations'), w(i, 'first'), w(i, 'meeting')
    ring = (f'<div class="rng"><svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="52" class="rt0"/>'
            f'<circle cx="60" cy="60" r="52" class="rt1" style="--at:{ms(tD)}"/></svg>'
            f'<div class="rn2"><b data-count="2">2</b><span>days since<br>the naming</span></div></div>')
    stats = (at(tCv, 'at pop stat', inner='<b>1</b><span>conversation</span><i>Called 13 Oct</i>') +
             at(tM, 'at pop stat gold', inner='<b>6</b><span>days to a meeting</span><i>Met 18 Oct</i>'))
    return (f'<div class="center"><div class="eyebrow st">{sc["eyebrow"]}</div><h2 class="st d2 c">{br(sc["headline"])}</h2>'
            f'<div class="clockrow">{ring}<div class="stats">{stats}</div></div>'
            f'{at(tF, "at up aim", inner="The aim: a conversation in the first two days, a meeting soon after.")}</div>')

R = {'since': s_since, 'reassign': s_reassign, 'unit': s_unit, 'yourcalls': s_yourcalls, 'staffcall': s_staffcall, 'rules': s_counts,
     'yourwork': s_yourwork, 'clock': s_clock, 'title': s_title, 'flow': s_flow, 'signin': s_signin, 'urgent': s_urgent, 'agents': s_agents, 'table': s_table, 'batches': s_batches,
     'assign': s_assign, 'named': s_named, 'list': s_list, 'client': s_client, 'logcall': s_logcall, 'comment': s_comment, 'counts': s_counts,
     'sees': s_sees, 'close': s_close}
WARM = {'title', 'named', 'counts', 'rules', 'clock', 'close'}

html = []
for i, sc in enumerate(LINES):
    v = sc['visual']; D = DUR[i]
    body = R[v](i, sc, D)
    html.append(f'<!-- {i + 1} · {v} -->\n<section class="scene of bf{" warm" if v in WARM else ""}" data-d="{D}" style="--D:{D}ms">'
                f'<div class="orb"></div><div class="inner">{body}</div></section>')
SCENES = '\n'.join(html)

CSS = r"""
/* ══ the board film · branch theme (build-boardfilm.py) ══════════════════ */
.of{--navy:#07131f;--gold:#efc24b;--gold2:#c9942c;--teal:#00CFEA;--teal2:#0aa8bf;--ink:#e9f2fb;--dim:#8fa8c0;
    --line:rgba(239,194,75,.22);--tline:rgba(0,207,234,.3)}
.scene.of{background:radial-gradient(1000px 560px at 88% -16%,rgba(0,207,234,.13),transparent 60%),
  radial-gradient(1100px 620px at 10% -14%,rgba(239,194,75,.12),transparent 62%),linear-gradient(168deg,#0a2330 0%,#07131f 58%,#040d16 100%)}
.scene.of.warm{background:radial-gradient(1100px 640px at 50% -10%,rgba(239,194,75,.20),transparent 64%),linear-gradient(168deg,#132534 0%,#07131f 62%,#040d16 100%)}
.scene.of .inner{color:var(--ink)}
.scene.of h1,.scene.of h2{color:#fff;text-shadow:0 2px 34px rgba(0,0,0,.4)}
.scene.of h1 em,.scene.of h2 em{color:var(--gold);font-style:normal}
.scene.of .eyebrow{color:var(--teal)} .scene.of.warm .eyebrow{color:var(--gold)}
.scene.of .big-sub{color:var(--dim)}
.shield{width:78px;height:78px;display:block;margin:0 auto 18px} .shield.sm{width:26px;height:26px;margin:0;flex:none}
.scene.on .shield:not(.sm){animation:beatpop .6s ease}
#chrome .who{color:#e9f2fb} #chrome .who i{color:#8fa8c0}
#bars i{background:rgba(0,207,234,.16)} #bars i::after{background:linear-gradient(90deg,var(--teal2),var(--teal))} #bars i.done::after{background:rgba(0,207,234,.45)}

/* the frame: designed at 1280 by 720, the picture in the top 616 (the captions take the strip below) */
.scene.bf{padding:62px 28px 112px}
.scene.bf .inner{max-width:none;width:1224px;text-align:left;zoom:var(--k,1)}
.bf .orb{position:absolute;width:620px;height:620px;border-radius:50%;left:-160px;top:-200px;pointer-events:none;
  background:radial-gradient(circle,rgba(0,207,234,.10),transparent 65%);animation:bfOrb 14s ease-in-out infinite alternate}
.bf.warm .orb{background:radial-gradient(circle,rgba(239,194,75,.12),transparent 65%)}
@keyframes bfOrb{to{transform:translate(760px,260px) scale(1.25)}}
.bf .bstage{display:grid;grid-template-columns:318px 862px;gap:34px;align-items:center;height:540px;width:1224px}
.bf .rt{display:flex;justify-content:center;align-items:center}
.bf .sd .eyebrow{text-align:left;margin-bottom:12px}
.bf h2{font:900 39px/1.08 var(--head);letter-spacing:-.025em;margin:0}
.bf h2.c{text-align:center}
.bf .cues{margin-top:22px;display:grid;gap:9px}
.bf .cue{overflow-wrap:anywhere;font:600 15.5px/1.35 var(--body);color:#cfe0ee;padding:9px 13px;border-left:3px solid var(--tline);background:rgba(255,255,255,.03);border-radius:0 9px 9px 0}
.bf .cue.gold{border-left-color:var(--gold);color:#fff;background:rgba(239,194,75,.08)}

/* things that arrive on a word */
.bf .at{opacity:0}
.scene.on.bf .at{animation:bfIn .55s cubic-bezier(.2,.9,.3,1) var(--at) both}
.scene.on.bf .at.l{animation-name:bfInL} .scene.on.bf .at.pop{animation-name:bfPop} .scene.on.bf .at.up{animation-name:bfInU}
@keyframes bfIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
@keyframes bfInL{from{opacity:0;transform:translateX(-16px)}to{opacity:1;transform:none}}
@keyframes bfInU{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}
@keyframes bfPop{0%{opacity:0;transform:scale(.7)}70%{opacity:1;transform:scale(1.06)}100%{opacity:1;transform:none}}
.scene.on.bf .until{animation:bfIn .5s var(--at) both,bfOut .35s var(--to) forwards}
@keyframes bfOut{to{opacity:0;transform:scale(.98);visibility:hidden}}
.bf .after{opacity:0} .scene.on.bf .after{animation:bfIn .55s var(--at) both}
.scene.on.bf .prs{animation:bfPress .32s var(--at) both}
@keyframes bfPress{40%{transform:scale(.92);filter:brightness(1.25)}100%{transform:none}}
.bf .rip{position:absolute;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;border:3px solid var(--teal);opacity:0;pointer-events:none;z-index:9}
.scene.on.bf .rip{animation:bfRip .6s var(--at) ease-out}
@keyframes bfRip{0%{opacity:.95;transform:scale(.3)}100%{opacity:0;transform:scale(1.5)}}
.bf .cur{position:absolute;left:0;top:0;width:26px;height:26px;z-index:10;pointer-events:none;opacity:0;filter:drop-shadow(0 3px 6px rgba(0,0,0,.45))}
.bf .cur svg{width:26px;height:26px;display:block}
.bf .cur.touch{width:30px;height:30px;margin:-15px 0 0 -15px;border-radius:50%;background:rgba(255,255,255,.55);border:2px solid #fff;box-shadow:0 0 0 6px rgba(0,207,234,.25)}
.bf .tyy{display:inline-block;white-space:nowrap;clip-path:inset(0 100% 0 0)}
.scene.on.bf .tyy{animation:bfType var(--dur) steps(var(--n)) var(--at) forwards}
@keyframes bfType{to{clip-path:inset(0 0 0 0)}}
.scene.on.bf .gr{animation:bfGrow .9s cubic-bezier(.3,.8,.3,1) var(--at) both}
@keyframes bfGrow{from{width:0}to{width:var(--w)}}
.scene.on.bf .scr,.scene.on.bf .phn{animation:bfKen var(--D) linear both}
@keyframes bfKen{from{transform:scale(.985)}to{transform:scale(1.02)}}

/* the laptop */
.bf .scr{position:relative;width:862px;height:520px;border-radius:14px;background:#f3f5f8;overflow:hidden;color:#0f1c2b;
  box-shadow:0 34px 90px rgba(0,0,0,.5),0 0 0 1px rgba(255,255,255,.1);font-family:var(--body)}
.bf .tb{height:32px;background:#18242f;display:flex;align-items:center;gap:7px;padding:0 12px}
.bf .tb>i{width:10px;height:10px;border-radius:50%;background:#3a4b5c}
.bf .ub{margin-left:14px;flex:1;background:#0d1720;color:#a9bccd;border-radius:7px;font:500 12.5px var(--body);padding:5px 12px;white-space:nowrap;overflow:hidden}
.bf .ab{height:46px;background:#07131f;display:flex;align-items:center;gap:10px;padding:0 16px;border-bottom:2px solid;border-image:linear-gradient(90deg,var(--gold),var(--teal)) 1}
.bf .an b{display:block;color:#fff;font:800 13.5px var(--head)} .bf .an span{display:block;color:var(--teal);font:500 11px var(--body)}
.bf .abr{margin-left:auto;display:flex;gap:7px} .bf .abr span{color:#e8eef5;border:1px solid rgba(255,255,255,.25);border-radius:7px;padding:4px 10px;font:700 11.5px var(--body)}
.bf .bd{display:grid;grid-template-columns:172px 1fr;height:calc(100% - 78px)} .bf .bd.nomenu{grid-template-columns:1fr}
.bf .side{background:#fff;border-right:1px solid #e1e6ed;padding:12px 10px}
.bf .me{display:flex;gap:8px;align-items:center;padding-bottom:10px;border-bottom:1px solid #e1e6ed;margin-bottom:8px}
.bf .me>i{width:28px;height:28px;border-radius:50%;background:#07131f;color:var(--gold);display:grid;place-items:center;font:800 12px var(--head);font-style:normal}
.bf .me b{display:block;font:700 12px var(--head);color:#0f1c2b} .bf .me span{display:block;font-size:10.5px;color:#5f6f82}
.bf .grp{font:700 9.5px var(--body);letter-spacing:.12em;text-transform:uppercase;color:#94a3b8;margin:6px 6px}
.bf .mi{display:flex;justify-content:space-between;align-items:center;padding:7px 9px;border-radius:8px;font:700 12.5px var(--body);color:#334155;margin:2px 0}
.bf .mi b{background:#e8edf2;border-radius:999px;padding:0 7px;font-size:11px;color:#0f1c2b}
.bf .mi.on{background:#07131f;color:#fff} .bf .mi.on b{background:var(--gold);color:#07131f}
.scene.on.bf .mi.off-at{animation:bfOff .3s var(--at) forwards} .bf .mi.on-at{background:transparent;color:#334155}
.scene.on.bf .mi.on-at{animation:bfOn .3s var(--at) forwards}
@keyframes bfOff{to{background:transparent;color:#334155}} @keyframes bfOn{to{background:#07131f;color:#fff}}
.bf .main{padding:14px 18px;overflow:hidden;position:relative}
.bf .main h3{font:800 18px var(--head);margin:0 0 10px;color:#0f1c2b} .bf .main h3 small{font:600 12.5px var(--body);color:#5f6f82;margin-left:6px}
.bf .main h4{font:700 13px var(--head);margin:12px 0 6px;color:#0f1c2b}
.bf .gh{margin:8px 0 4px} .bf .gh b{font:800 13px var(--head);color:#b42318} .bf .gh i{display:block;font-style:normal;font-size:11.5px;color:#5f6f82}
.bf .rw{display:flex;align-items:center;gap:10px;background:#fff;border:1px solid #e1e6ed;border-radius:10px;padding:8px 11px;margin:5px 0;box-shadow:0 1px 2px rgba(15,28,43,.05)}
.bf .rw .cb{width:14px;height:14px;border:1.5px solid #cdd6e0;border-radius:4px;flex:none}
.bf .rw .rn{flex:1;min-width:0} .bf .rw b{font:700 13.5px var(--head);color:#0f1c2b} .bf .rw i{display:block;font-style:normal;font-size:11.5px;color:#334155}
.bf .rw i.hot{color:#b42318;font-weight:700}
.bf .rw .tel{color:#07606f;font-weight:800;font-size:12px;border:1px solid #cdd6e0;border-radius:7px;padding:3px 8px}
.bf .rw .lb{background:#07131f;color:#fff;font:700 11.5px var(--body);border-radius:7px;padding:4px 9px}

/* sign in */
.bf .gate{display:grid;place-items:center;height:100%}
.bf .gc{width:380px;background:#fff;border:1px solid #e1e6ed;border-radius:14px;padding:20px 22px;box-shadow:0 10px 30px rgba(15,28,43,.08)}
.bf .gc>b{font:800 17px var(--head);display:block;margin-bottom:10px}
.bf label{display:block;font:600 11.5px var(--body);color:#5f6f82;margin:9px 0 4px}
.bf .fld{border:1.5px solid #cdd6e0;border-radius:9px;padding:8px 11px;min-height:36px;font:600 14px var(--body);color:#0f1c2b;background:#fff}
.bf .bbtn{display:inline-block;margin-top:12px;background:#07131f;color:#fff;font:800 13px var(--head);border-radius:9px;padding:9px 16px}
.bf .gc p{font-size:11px;color:#5f6f82;margin:10px 0 0}
.bf .glow{position:absolute;width:80px;height:30px;border-radius:9px;border:2px solid var(--gold);opacity:0;z-index:9}
.scene.on.bf .glow{animation:bfGlow 1.6s var(--at) ease-in-out}
@keyframes bfGlow{0%,100%{opacity:0}20%,80%{opacity:1;box-shadow:0 0 18px rgba(239,194,75,.7)}}
.bf .main>.after{position:absolute;inset:14px 18px}

/* the Agents tab */
.bf .hero{display:flex;gap:14px;align-items:baseline} .bf .hero>b{font:900 50px/1 var(--head);color:#0f1c2b;letter-spacing:-1px}
.bf .hero span{font-size:13.5px;color:#334155;max-width:420px;line-height:1.4}
.bf .stk{display:flex;gap:2px;height:12px;background:#e3eaef;border-radius:6px;overflow:hidden;margin:12px 0}
.bf .stk i,.bf .pb i{display:block;height:100%;width:0}
.bf .tiles{display:grid;grid-template-columns:repeat(3,1fr);gap:9px}
.bf .tile{background:#f8fafc;border:1px solid #e1e6ed;border-radius:10px;padding:9px 11px}
.bf .tile b{display:block;font:800 22px var(--head);color:#0f1c2b} .bf .tile span{font-size:12px;color:#334155}
.bf .tile.crit{background:#fdf0ef;border-color:#f3c7c2} .bf .tile.crit b{color:#b42318}
.bf .leg{display:flex;gap:12px;margin:0 0 8px} .bf .lg{font:600 12px var(--body);color:#334155;display:flex;gap:5px;align-items:center}
.bf .lg i{width:11px;height:11px;border-radius:3px;display:inline-block}
.bf .tbl{background:#fff;border:1px solid #e1e6ed;border-radius:10px;padding:4px 12px}
.bf .th,.bf .tr{display:grid;grid-template-columns:1.5fr .8fr .6fr 1.3fr .8fr 1.1fr .9fr;gap:8px;align-items:center;padding:9px 0;border-bottom:1px solid #edf1f5;font-size:13px}
.bf .th{font:600 11px var(--body);color:#5f6f82} .bf .tr .nm{font:700 13.5px var(--head);color:#0f1c2b}
.bf .pb{display:flex;gap:1px;height:10px;background:#e3eaef;border-radius:5px;overflow:hidden;width:110px}
.bf .tr .nl{font-weight:700;color:#334155;border-radius:6px;padding:2px 6px;justify-self:start}
.scene.on.bf .red-at{animation:bfRed .8s var(--at) forwards}
@keyframes bfRed{0%{background:transparent}40%{background:#b42318;color:#fff;transform:scale(1.12)}100%{background:#fdf0ef;color:#b42318;transform:none}}
.bf .tr.big{background:#f7fbfd;border-left:3px solid var(--teal);padding-left:8px;font-size:14px}
.bf .tr.dim{opacity:.55}
.bf .sw2,.bf .nl{position:relative;display:inline-grid}
.bf .sw2>span,.bf .nl>span{grid-area:1/1}
.bf .red0{background:#fdf0ef;color:#b42318}
.scene.on.bf .clr{animation:bfClear .6s var(--at) forwards}
@keyframes bfClear{to{background:#e6f6f9;color:#07606f}}

/* households */
.bf .chps{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px}
.bf .chp{border:1px solid #e1e6ed;background:#fff;border-radius:999px;padding:5px 11px;font:700 12px var(--body);color:#334155}
.bf .chp b{color:#0f1c2b}
.scene.on.bf .chp.hl{animation:bfChip .35s var(--at) forwards,bfUnchip .35s var(--to) forwards}
@keyframes bfChip{to{background:#07131f;color:#fff;border-color:#07131f}} @keyframes bfUnchip{to{background:#fff;color:#334155;border-color:#e1e6ed}}
.bf .cardsw{position:relative;height:330px} .bf .cards{position:absolute;inset:0;display:grid;gap:8px;align-content:start}
.bf .hc{background:#fff;border:1px solid #e1e6ed;border-left:4px solid var(--teal);border-radius:10px;padding:10px 13px;display:grid;grid-template-columns:1fr auto;gap:2px 10px}
.bf .hc b{font:800 14px var(--head)} .bf .hc i{grid-column:1;font-style:normal;font-size:12px;color:#b42318;font-weight:600}
.bf .hc .sg{grid-row:1/3;grid-column:2;align-self:center;font-size:11.5px;color:#5f6f82} .bf .hc .sg b{display:block;font-size:13px;color:#0f1c2b}
.bf .hcard{background:#fff;border:1px solid #e1e6ed;border-left:4px solid var(--teal);border-radius:12px;padding:12px 15px}
.bf .hh b{font:800 16px var(--head)} .bf .hh i{display:block;font-style:normal;font-size:12px;color:#5f6f82;margin-bottom:4px}
.bf .hm{display:grid;grid-template-columns:120px 1fr auto;gap:10px;align-items:center;padding:6px 0;border-top:1px solid #edf1f5;font-size:13px}
.bf .hm b{font:700 13.5px var(--head)} .bf .hm .ok{color:#067647;font-weight:700} .bf .hm .mut{color:#5f6f82}
.bf .tag{background:#e6f6f9;color:#07606f;border-radius:6px;padding:2px 8px;font:700 11.5px var(--body)}
.bf .sgl{display:flex;align-items:center;gap:9px;margin-top:10px;font-size:13px;flex-wrap:wrap}
.bf .sl{font:700 10.5px var(--body);letter-spacing:.08em;text-transform:uppercase;color:#5f6f82} .bf .sgl i{font-style:normal;color:#5f6f82;font-size:12px}
.bf .ab1,.bf .ab2{display:inline-grid;background:#067647;color:#fff;font:800 12.5px var(--body);border-radius:8px;padding:7px 12px;margin-left:auto}
.bf .ab1>span{grid-area:1/1}
.bf .btt{background:#fff;border:1px solid #e1e6ed;border-radius:10px;padding:4px 12px}
.bf .btr{display:flex;align-items:center;gap:16px;padding:8px 0;font-size:13px} .bf .btr b{font:700 13.5px var(--head);min-width:120px}
.bf .toast{position:absolute;left:50%;bottom:18px;transform:translateX(-50%);background:#07131f;color:#fff;font:700 13px var(--body);padding:10px 16px;border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,.3);z-index:8;white-space:nowrap}
.scene.on.bf .toast.at{animation-name:bfToast} .scene.on.bf .toast.until{animation:bfToast .5s var(--at) both,bfOut .35s var(--to) forwards}
@keyframes bfToast{from{opacity:0;transform:translate(-50%,16px)}to{opacity:1;transform:translate(-50%,0)}}

/* flow */
.bf .flowwrap,.bf .center{display:flex;flex-direction:column;align-items:center;justify-content:center;height:540px;width:1224px}
.bf .flowwrap .eyebrow,.bf .center .eyebrow{text-align:center}
.bf .flow{display:grid;grid-template-columns:330px 120px 300px 120px 250px;align-items:center;margin-top:34px}
.bf .env{display:flex;gap:12px;align-items:center;background:rgba(255,255,255,.05);border:1px solid var(--line);border-radius:12px;padding:11px 14px;margin:7px 0}
.bf .env .ic{font-size:24px;color:var(--gold)} .bf .env b{display:block;font:700 14px var(--head);color:#fff} .bf .env i{font-style:normal;font-size:13px;color:var(--dim)} .bf .env i.hot{color:#ffb4ab}
.bf .arrow{height:3px;position:relative;margin:0 14px} .bf .arrow i{position:absolute;inset:0;background:linear-gradient(90deg,var(--gold),var(--teal));transform-origin:left;transform:scaleX(0)}
.scene.on.bf .arrow i{animation:bfDraw .6s var(--at) forwards} .bf .arrow::after{content:'';position:absolute;right:-2px;top:-5px;border:6px solid transparent;border-left:9px solid var(--teal)}
@keyframes bfDraw{to{transform:scaleX(1)}}
.bf .mid{text-align:center} .bf .mini{display:inline-flex;flex-direction:column;align-items:center;background:rgba(0,207,234,.08);border:1px solid var(--tline);border-radius:16px;padding:18px 26px}
.bf .mini .shield{margin:0 0 8px;width:58px;height:58px} .bf .mini b{font:800 17px var(--head);color:#fff}
.bf .fchips{display:flex;gap:7px;justify-content:center;margin-top:14px} .bf .fchip{font:700 12.5px var(--body);color:#07131f;background:var(--gold);border-radius:999px;padding:5px 11px}
.bf .agents{display:grid;gap:10px} .bf .av{display:flex;align-items:center;gap:10px}
.bf .av i{width:42px;height:42px;border-radius:50%;background:#07131f;border:2px solid var(--gold);color:var(--gold);display:grid;place-items:center;font:800 14px var(--head);font-style:normal}
.bf .av span{font:700 15px var(--head);color:#fff}

/* rows that build (what happens next, what counts) */
.bf .keeps{display:grid;gap:12px;width:720px;margin-top:26px}
.bf .keep{display:flex;align-items:center;gap:16px;background:rgba(255,255,255,.045);border:1px solid var(--line);border-radius:14px;padding:15px 20px;position:relative}
.bf .keep .tkk{width:38px;height:38px;flex:none;border-radius:50%;display:grid;place-items:center;background:linear-gradient(180deg,var(--gold),var(--gold2));color:#07131f;font:900 18px var(--head)}
.bf .keep b{font:700 19px/1.25 var(--head);color:#fff} .bf .keep i{display:block;font-style:normal;font:400 14px var(--body);color:var(--dim);margin-top:3px}
.bf .keep.off{border-color:rgba(255,255,255,.1);background:rgba(255,255,255,.02)} .bf .keep.off .tkk{background:rgba(255,255,255,.08);color:#ff9d93}
.bf .keep.off b{color:#9fb4c8}
.bf .strk{position:absolute;left:74px;right:24px;top:38%;height:2px;background:#ff9d93;transform:scaleX(0);transform-origin:left}
.scene.on.bf .strk{animation:bfDraw .5s var(--at) forwards}
.bf .clock{margin-left:auto;width:36px;height:36px;border-radius:50%;border:2px solid var(--teal);position:relative;flex:none}
.bf .clock i{position:absolute;left:50%;top:50%;width:2px;height:13px;margin-left:-1px;background:var(--teal);transform-origin:50% 0;transform:rotate(180deg)}
.scene.on.bf .clock i{animation:bfHand 2.4s linear infinite}
@keyframes bfHand{to{transform:rotate(540deg)}}

/* the phone */
.bf .phn{width:290px;height:532px;border-radius:38px;background:#0b141e;padding:11px;box-shadow:0 34px 90px rgba(0,0,0,.5),0 0 0 1px rgba(255,255,255,.12);position:relative}
.bf .ps{position:relative;height:100%;border-radius:29px;background:#f3f5f8;overflow:hidden;color:#0f1c2b;font-family:var(--body)}
.bf .pab{height:50px;background:#07131f;display:flex;align-items:center;gap:8px;padding:0 14px;border-bottom:2px solid;border-image:linear-gradient(90deg,var(--gold),var(--teal)) 1}
.bf .pab b{color:#fff;font:800 14px var(--head)} .bf .pab span{color:var(--teal);font:600 12px var(--body)}
.bf .pbd{padding:10px}
.bf .ptabs{display:flex;gap:5px;margin-bottom:8px} .bf .ptabs span{border:1px solid #e1e6ed;background:#fff;border-radius:999px;padding:4px 9px;font:700 11px var(--body);color:#334155}
.bf .ptabs .on{background:#07131f;color:#fff} .bf .ptabs b{color:var(--gold)}
.bf .prw{background:#fff;border:1px solid #e1e6ed;border-radius:11px;padding:8px 10px;margin:6px 0;position:relative}
.bf .prw b{font:800 13.5px var(--head);display:block} .bf .prw i{font-style:normal;font-size:11px;color:#5f6f82;display:block}
.bf .prw em{font-style:normal;font-size:11.5px;color:#b42318;font-weight:700}
.bf .prw.new{border-color:var(--gold);box-shadow:0 0 0 3px rgba(239,194,75,.35)}
.bf .prw.open{border-left:4px solid var(--teal)}
.bf .lbtn{position:absolute;right:9px;top:12px;background:#07131f;color:#fff;font:700 11px var(--body);border-radius:7px;padding:5px 9px}
.bf .blk{background:#fff;border:1px solid #e1e6ed;border-radius:10px;padding:7px 10px;margin:6px 0}
.bf .blk h5{margin:0 0 2px;font:700 9.5px var(--body);letter-spacing:.1em;text-transform:uppercase;color:#5f6f82}
.bf .blk span{display:block;font-size:11.5px;color:#334155} .bf .blk .big{font:700 13.5px var(--head);color:#0f1c2b}
.bf .sheet{position:absolute;left:0;right:0;bottom:0;background:#fff;border-radius:20px 20px 0 0;box-shadow:0 -12px 30px rgba(15,28,43,.18);padding:14px 14px 16px;transform:translateY(105%);z-index:6}
.scene.on.bf .sheet{animation:bfSheet .5s cubic-bezier(.2,.9,.3,1) var(--at) forwards}
@keyframes bfSheet{to{transform:none}}
.bf .sheet>b{font:800 15px var(--head)} .bf .ocs{display:flex;flex-wrap:wrap;gap:5px;margin-top:8px}
.bf .oc{border:1.5px solid #cdd6e0;border-radius:999px;padding:4px 10px;font:700 12px var(--body);color:#334155}
.scene.on.bf .oc.lit{animation:bfLit .25s var(--at) forwards,bfUnlit .25s var(--to) forwards}
.scene.on.bf .oc.lit.sel{animation:bfLit .25s var(--at) forwards,bfUnlit .25s var(--to) forwards,bfLit .25s var(--to) forwards}
@keyframes bfLit{to{background:#07131f;color:#fff;border-color:#07131f}} @keyframes bfUnlit{to{background:#fff;color:#334155;border-color:#cdd6e0}}
.bf .sheet .fld{font-size:12px} .bf .toast.tph{bottom:24px}

/* comments */
.bf .det{display:inline-block;margin-top:4px} .bf .dl{color:#07606f;font:700 13px var(--body);border:1px solid #cdd6e0;border-radius:8px;padding:6px 10px;display:inline-block}
.bf .dw{display:grid;grid-template-columns:1fr 1.15fr;gap:14px;position:absolute;top:52px;left:18px;right:18px}
.bf .dc{background:#fff;border:1px solid #e1e6ed;border-radius:10px;padding:10px 12px;min-height:330px}
.bf .dc h5{margin:0 0 6px;font:700 10px var(--body);letter-spacing:.1em;text-transform:uppercase;color:#5f6f82}
.bf .hii{display:grid;grid-template-columns:52px 1fr;gap:6px;padding:7px 0;border-top:1px solid #edf1f5;font-size:12.5px}
.bf .hii i{font-style:normal;color:#5f6f82;font-weight:700}
.bf .cbox{display:flex;gap:8px;align-items:center} .bf .cbox .fld{flex:1;font-size:12px;overflow:hidden} .bf .cbox .bbtn{margin:0}
.bf .cm{margin-top:10px;background:#f7fbfd;border-left:3px solid var(--teal);border-radius:0 8px 8px 0;padding:8px 10px}
.bf .cm b{display:block;font:700 11.5px var(--body);color:#07606f} .bf .cm span{font-size:12.5px}
.bf .onfile{display:inline-block;margin-top:10px;background:#e6f6f9;color:#07606f;font:800 12px var(--body);border-radius:999px;padding:4px 11px}

/* the title and the close */
.bf .net{position:absolute;inset:-62px -28px;pointer-events:none}
.bf .hd{position:absolute;width:9px;height:9px;border-radius:50%;background:var(--teal);opacity:0;box-shadow:0 0 10px rgba(0,207,234,.6)}
.scene.on.bf .hd{animation:bfDot .4s .2s forwards,bfGather 1.4s cubic-bezier(.5,0,.2,1) var(--at) forwards}
@keyframes bfDot{to{opacity:.75}} @keyframes bfGather{to{opacity:.95;transform:translate(var(--dx),var(--dy))}}
.bf .gpin{position:absolute;width:26px;height:26px;border-radius:50%;background:radial-gradient(circle,var(--gold) 0 45%,rgba(239,194,75,.25) 46%);opacity:0}
.scene.on.bf .gpin{animation:bfPop .6s var(--at) forwards,bfPulse 1.6s calc(var(--at) + .6s) ease-in-out infinite}
@keyframes bfPulse{50%{box-shadow:0 0 0 12px rgba(239,194,75,0),0 0 22px rgba(239,194,75,.5)}}
.bf .ttl{position:relative;text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:center;height:540px;width:1224px}
.bf .ttl h1{font:900 64px/1.05 var(--head);letter-spacing:-.03em;margin:0} .bf .ttl .big-sub{font-size:19px;max-width:620px}
.bf .ttl .shield{width:92px;height:92px}
.bf .cls{display:grid;gap:6px;text-align:center} .bf .cl{font:900 46px/1.1 var(--head);color:#fff;letter-spacing:-.03em} .bf .cl.gold{color:var(--gold)}
.bf .furl{margin-top:22px;font:700 16px var(--head);color:var(--teal);border:1px solid var(--tline);border-radius:10px;padding:10px 18px}
.bf .center .shield{width:70px;height:70px}

/* the three films' own scenes (14 October 2026) */
.bf .th.c8,.bf .tr.c8{grid-template-columns:1.35fr .5fr 1.1fr .9fr .75fr .85fr 1fr .8fr}
.bf .th.c5,.bf .tr.c5{grid-template-columns:1.4fr .6fr 1.4fr .9fr .8fr}
.bf .th.c6,.bf .tr.c6{grid-template-columns:1.3fr .6fr 1.3fr .9fr .9fr .9fr}
.bf .tbl.rel{position:relative}
.bf .colhl{position:absolute;top:2px;bottom:2px;border-radius:8px;background:rgba(0,207,234,.12);border:1.5px solid rgba(0,207,234,.5);opacity:0}
.scene.on.bf .colhl{animation:bfIn .4s var(--at) both,bfOut .4s calc(var(--at) + 1.6s) forwards}
.bf .warn{color:#b42318;font-weight:800}
.bf .tr .bad,.bf .bad{color:#b42318;font-weight:800}
.bf .tiles.t5{grid-template-columns:repeat(5,1fr)} .bf .tiles.t5 .tile b{font-size:19px}
.scene.on.bf .tile.mt{animation:bfPop .5s var(--at) both}
.bf .hlrow{border-radius:6px;padding:2px 6px;margin-left:-6px}
.scene.on.bf .hlrow{animation:bfHl .5s var(--at) forwards}
@keyframes bfHl{to{background:rgba(239,194,75,.28);box-shadow:0 0 0 2px rgba(239,194,75,.6)}}
.bf .glowbox{position:absolute;border-radius:10px;border:2px solid var(--gold);opacity:0;z-index:5;pointer-events:none}
.scene.on.bf .glowbox{animation:bfGlow 2.2s var(--at) ease-in-out}
.bf .mrow{display:grid;grid-template-columns:150px 1fr;gap:12px;background:#fff;border:1px solid #e1e6ed;border-radius:12px;padding:14px 16px;position:relative}
.bf .mrow b{font:800 15px var(--head)} .bf .mrow small{display:block;color:#5f6f82;font-size:12px}
.bf .mw{display:grid;gap:6px;font-size:13.5px;color:#334155} .bf .mw .ok{color:#067647;font-weight:700} .bf .mw .mut,.bf .hist .mut{color:#5f6f82}
.bf .mw b.sw2{display:inline-grid;font:800 13.5px var(--head)} .bf .mw .agst{font-size:10.5px;padding:1px 6px;border-radius:5px;background:#eef1f4;color:#5f6f82;text-transform:uppercase;font-weight:700}
.bf .hist{background:#f7fbfd;border-left:3px solid var(--teal);border-radius:0 8px 8px 0;padding:7px 10px;font-size:13px}
.scene.on.bf .hseg{animation:bfHseg 1.4s var(--at) ease-in-out}
@keyframes bfHseg{25%,70%{background:rgba(239,194,75,.45);border-radius:4px;box-shadow:0 0 0 3px rgba(239,194,75,.45)}}
.bf .hseg.d,.bf .hseg{font-style:normal}
.bf .rsel{justify-self:start;border:1.5px solid #cdd6e0;border-radius:8px;padding:5px 10px;font:700 12.5px var(--body);background:#fff;margin-top:4px}
.bf .dropl{position:absolute;left:166px;top:150px;width:220px;background:#fff;border:1px solid #cdd6e0;border-radius:10px;box-shadow:0 14px 30px rgba(15,28,43,.18);padding:4px;z-index:7}
.bf .op{padding:7px 10px;border-radius:7px;font:600 13px var(--body)}
.scene.on.bf .op.pick{animation:bfLit .2s var(--at) forwards}
.bf .note{font-size:12.5px;color:#5f6f82;margin:10px 0 0}
.bf .mailfly{display:inline-block;margin-top:12px;background:#e6f6f9;color:#07606f;font:800 13px var(--body);border-radius:999px;padding:6px 13px}
.bf .yc .ord{font:900 15px var(--head);color:#c9942c;width:30px}
.bf .yc .why{font-style:normal;font-size:12px;color:#334155;display:block}
.scene.on.bf .yc .why{animation:bfWhy .8s var(--at) both}
@keyframes bfWhy{40%{color:#b42318;background:rgba(239,194,75,.3)}100%{color:#b42318;font-weight:700}}
.bf .yc .tel.big{font-size:12.5px;padding:4px 9px}
.scene.on.bf .yc .tel.big{animation:bfTel .9s var(--at) both}
@keyframes bfTel{40%{background:#07606f;color:#fff;transform:scale(1.08)}100%{background:#e6f6f9}}
.bf .drawer{position:absolute;top:78px;right:0;bottom:0;width:330px;background:#fff;border-left:1px solid #e1e6ed;box-shadow:-14px 0 30px rgba(15,28,43,.14);padding:16px;transform:translateX(105%);z-index:6}
.scene.on.bf .drawer{animation:bfSheet .5s cubic-bezier(.2,.9,.3,1) var(--at) forwards}
.bf .drawer>b{font:800 15px var(--head)}
.bf .bks{display:grid;gap:5px} .bf .bkx{border:1.5px solid #cdd6e0;border-radius:8px;padding:5px 9px;font:700 12px var(--body);color:#334155}
.scene.on.bf .bkx.lit{animation:bfLitHot .25s var(--at) forwards}
@keyframes bfLitHot{to{background:#b42318;color:#fff;border-color:#b42318}}
.bf .fly{position:absolute;left:540px;top:400px;background:#b42318;color:#fff;font:700 12px var(--body);border-radius:8px;padding:6px 10px;opacity:0;z-index:9}
.scene.on.bf .fly{animation:bfFly 1.1s cubic-bezier(.5,0,.3,1) var(--at) forwards}
@keyframes bfFly{0%{opacity:1;transform:none}85%{opacity:1;transform:translate(-470px,-160px) scale(.55)}100%{opacity:0;transform:translate(-478px,-162px) scale(.4)}}
.bf .badgeup{position:absolute;left:146px;top:236px;background:#b42318;color:#fff;font:800 11px var(--body);border-radius:999px;padding:1px 7px;opacity:0;z-index:9;font-style:normal}
.scene.on.bf .badgeup{animation:bfPop .5s var(--at) forwards}
.bf .wt{display:flex;flex-wrap:wrap;gap:6px 14px;align-items:baseline;background:#fff;border:1px solid #e1e6ed;border-radius:10px;padding:9px 12px;margin:6px 0;font-size:12.5px;color:#334155}
.bf .wt b{font:800 13px var(--head);min-width:80px} .bf .wt em{font:800 16px var(--head);color:#0f1c2b;font-style:normal}
.bf .wl{font-size:12.5px;color:#334155;padding:6px 0;border-top:1px solid #edf1f5} .bf .wl i{font-style:normal;color:#5f6f82;font-weight:700}
.bf .clockrow{display:flex;gap:46px;align-items:center;margin-top:26px}
.bf .rng{position:relative;width:210px;height:210px}
.bf .rng svg{width:210px;height:210px;transform:rotate(-90deg)}
.bf .rt0{fill:none;stroke:rgba(255,255,255,.1);stroke-width:10}
.bf .rt1{fill:none;stroke:url(#none);stroke:var(--teal);stroke-width:10;stroke-linecap:round;stroke-dasharray:327;stroke-dashoffset:327}
.scene.on.bf .rt1{animation:bfRing 1.6s cubic-bezier(.3,.8,.3,1) var(--at) forwards}
@keyframes bfRing{to{stroke-dashoffset:110}}
.bf .rn2{position:absolute;inset:0;display:grid;place-items:center;align-content:center;text-align:center}
.bf .rn2 b{font:900 64px/1 var(--head);color:#fff} .bf .rn2 span{font:600 14px var(--body);color:var(--dim)}
.bf .stats{display:grid;gap:14px}
.bf .stat{background:rgba(255,255,255,.05);border:1px solid var(--tline);border-radius:14px;padding:14px 20px;min-width:300px}
.bf .stat b{font:900 40px/1 var(--head);color:#fff;display:block} .bf .stat span{font:700 16px var(--head);color:#cfe0ee} .bf .stat i{display:block;font-style:normal;color:var(--dim);font-size:13px;margin-top:3px}
.bf .stat.gold{border-color:var(--line)} .bf .stat.gold b{color:var(--gold)}
.bf .aim{margin-top:24px;font:700 18px var(--head);color:#fff;background:rgba(239,194,75,.1);border:1px solid var(--line);border-radius:12px;padding:12px 20px}
@media (prefers-reduced-motion:reduce){.scene.on.bf *{animation-duration:.01ms!important;animation-iteration-count:1!important}}
"""

s = SRC.read_text()
chrome_end = s.index('</div>', s.index('<div id="chrome">')) + len('</div>')
tap = s.index('<div class="tapzone" id="zL"')
out = s[:chrome_end] + '\n' + SCENES + '\n\n' + s[tap:]
last = out.rindex('</style>')
out = out[:last] + CSS + '\n' + '\n'.join(KF) + '\n' + out[last:]
out = re.sub(r'<title>.*?</title>', '<title>' + TITLES[KEY] + ' — Ricky Rampersad Branch</title>', out, count=1, flags=re.S)
out = re.sub(r'<svg class="mark" viewBox="0 0 88 88" aria-hidden="true">.*?</svg>',
             lambda m: SHIELD.format(cls=' sm', gid='shc').replace('class="shield sm"', 'class="mark shield sm"'), out, count=1, flags=re.S)
out = re.sub(r'<span class="who">.*?</span>', '<span class="who">Ricky Rampersad Branch<i>Client transition board</i></span>', out, count=1, flags=re.S)
out = re.sub(r'<span class="live">.*?</span>', '', out, count=1, flags=re.S)
out = re.sub(r'<svg class="biglogo" viewBox="0 0 88 88" aria-hidden="true">.*?</svg>',
             lambda m: SHIELD.format(cls='', gid='shb').replace('class="shield"', 'class="biglogo shield"'), out, count=1, flags=re.S)
FAVICON = ("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 48'%3E%3Crect width='48' height='48' rx='11' fill='%2307131f'/%3E"
           "%3Cpath d='M24 8 L37 12 V24 C37 31 31 37 24 39 C17 37 11 31 11 24 V12 Z' fill='%23efc24b'/%3E%3Cpath d='M17.5 24.5 L22 29 L31 19' fill='none' "
           "stroke='%2307131f' stroke-width='3.6' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")
out = re.sub(r'(<link rel="icon" href=")[^"]*(")', lambda m: m.group(1) + FAVICON + m.group(2), out, count=1)
out = re.sub(r'const cols = \[[^\]]*\]', 'const cols = ["#00CFEA", "#efc24b", "#0aa8bf", "#8fa8c0", "#ffffff"]', out, count=1)
out = re.sub(r'<h1>The launch of<br>donthaveanagent<em>\.com</em></h1>', '<h1>' + TITLES[KEY].replace(', ', ',<br><em>') + '</em></h1>', out, count=1)
out = re.sub(r'<div class="eyebrow" style="margin-top:16px">[^<]*</div>', '<div class="eyebrow" style="margin-top:16px">A Ricky Rampersad Branch film</div>', out, count=1)
out = re.sub(r'<button id="playBtn"><span class="tri"></span>[^<]*</button>', '<button id="playBtn"><span class="tri"></span>Watch — ' + ('under two minutes' if sum(DUR) < 120000 else 'two and a half minutes') + '</button>', out, count=1)
out = re.sub(r'🔊 \d+ seconds, with music — tap to begin\.', 'How the branch names agents, and how agents report back.', out, count=1)
MSG = ('const MSG = "' + TITLES[KEY] + ': a short film on the client transition board.\\n\\n" +\n'
       '  "▶ https://rickyrampersadbranch.com/orphan-transition/board-films.html";')
out = re.sub(r'const MSG = ".*?";', lambda m: MSG, out, count=1, flags=re.S)
out = out.replace('document.getElementById("waBtn").href =', 'if (document.getElementById("waBtn")) document.getElementById("waBtn").href =')
# the narration and the bed are in the MP4; the page itself plays no music of its own
out = out.replace('  startMusic();\n  go(0);', '  go(0);')
# designed at 1280 by 720: any other window scales the frame to fit
out = out.replace('</script>\n</body>', '(function(){function k(){document.documentElement.style.setProperty("--k",Math.min(innerWidth/1280,innerHeight/720));}k();addEventListener("resize",k);})();\n</script>\n</body>', 1)
assert 'startMusic();\n  go(0);' not in out
OUT.write_text(out)
print('wrote', OUT, len(out), 'bytes ·', len(DUR), 'scenes ·', round(sum(DUR) / 1000, 1), 's')
