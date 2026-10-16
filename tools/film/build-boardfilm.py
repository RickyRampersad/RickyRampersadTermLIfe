#!/usr/bin/env python3
"""Assemble the board films: what management, Client Support and agents each see on the client transition board.

14 October 2026: "can the video be revised and add animation as well motion built in?" The outline given on
13 October for the manager to record became a narrated film instead, with the board's own screens drawn and
moving. The same day, after the first cut: "can i have more graphics and motion and the colors scheme changed".
The manager chose the corporate look already used for group client management: a blue band (#13408F into
#1D5BC4), white panels on a grey ground (#E9EEF5), IBM Plex Sans, and the branch's own gold shield. Then, on
15 October 2026 ("can i have a differnt colors and more motion and a bigger impact"; shown four looks on the
same frames, "i like the purple", "the yellow logo needs to change"; then, the same hour, "no leave dark blue
instead and have the logo as well blue"): midnight blue. Near-black navy (#070F26) with the corporate blues
(#13408F, #1D5BC4, #2A6DE0) and electric cyan (#00E5FF); the board's white windows float on it with a blue rim and
a passing glare; the side column reads in white. The mark is board-mark.png, the branch's own shield and check,
white on a blue tile (board-mark.js draws it from favicon.svg's shape), embedded in the films and used nowhere
else. Cyan is kept for progress, red only for "nothing logged", and every status is a word as well as a colour.

What moves:
  · scenes zoom through: the new scene opens a little larger, bright and soft, and sharpens as it settles, while
    the one it replaces pulls away and dims behind it, and a streak of light crosses the cut;
  · headlines land a word at a time, each from large and soft to sharp, and the key words are underlined as they land;
  · the laptop and the phone float and turn in 3D, a glare passes over the glass, and the camera pushes in on what
    the voice names;
  · a spotlight dims everything but the part being described;
  · a cursor (or a finger on the phone) travels to each button and presses it;
  · numbers count up with a punch in the sound (films.json `hits`, which this builder writes), bars and rings fill,
    an aurora drifts behind every scene, and the chapter scenes carry rings and motes on blue.

The cursor, the clicks, the spotlights and the camera find their targets on the page when the scene opens
(the JavaScript at the end), so a change of font or layout never leaves them pointing at the wrong place.

Every motion is timed to the word that names it: <key>-timing.json carries each scene's length and each spoken
word's start (edge-tts's WordBoundary events), so a re-voiced line re-times its own scene.

Three films, one per login (14 October 2026: "there's three videos. There is what the agents see, there's what the staff
see, and there's what management sees"): boardmgr (the branch manager and the unit managers), boardstaff (Client
Support) and boardagent. Each has its own <key>-lines.json and <key>-timing.json; the scenes are drawn by the visuals
below, which the three share.

Every name and every number on screen is made up. The MP4 sits at a public URL.

A fourth, boardflow (16 October 2026), is the workflow for everyone, start to finish: the letter, the call, the household
named, families the records missed, the service record, the log and the Salesforce task, the TT$200, the outcomes and the
test. Its scenes may show another sign-in's board (`role` on the scene).

  python3 build-boardfilm.py boardmgr|boardstaff|boardagent|boardflow
"""
import base64, html as H, json, pathlib, re, sys

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent.parent
SRC = ROOT / 'donthaveanagent' / 'client-film.html'
KEY = sys.argv[1] if len(sys.argv) > 1 else 'boardmgr'
PAGES = {'boardmgr': 'board-management.html', 'boardstaff': 'board-client-support.html', 'boardagent': 'board-agents.html',
         'boardflow': 'board-workflow.html'}
TITLES = {'boardmgr': 'The board, for management', 'boardstaff': 'The board, for Client Support', 'boardagent': 'The board, for agents',
          'boardflow': 'The client transition, start to finish'}
OUT = ROOT / 'orphan-transition' / PAGES[KEY]
TM = json.load(open(HERE / f'{KEY}-timing.json'))
SCRIPT = json.load(open(HERE / f'{KEY}-lines.json'))
LINES, ROLE = SCRIPT['scenes'], SCRIPT['role']
DUR = [int(round(d * 1000)) for d in TM['durs']]
WORDS = TM['words']
assert len(LINES) == len(DUR) == len(WORDS), 'script, timing and words disagree on the number of scenes'
OFF = 400   # the mixer starts each line 0.4 s into its scene
PLEX = base64.b64encode((HERE / 'fonts' / 'IBMPlexSans-latin.woff2').read_bytes()).decode()   # SIL Open Font License, beside it
LOGO = base64.b64encode((HERE / 'board-mark.png').read_bytes()).decode()                      # the shield and check, white on blue (board-mark.js)

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

def ms(t): return f'{int(t)}ms'
def esc(o): return H.escape(json.dumps(o), quote=True)

def at(t, cls='at', extra='', tag='div', inner='', style=''):
    return f'<{tag} class="{cls}" style="--at:{ms(t)};{style}"{extra}>{inner}</{tag}>'

# ── what the page script positions when the scene opens ────────────────
def cursor(moves, kind='arrow'):
    """moves: [(t, selector)] or [(t, x, y)]; the first entry is where it appears. Each move takes 650 ms and ends at t."""
    path = [[int(m[0]), m[1]] if len(m) == 2 else [int(m[0]), m[1], m[2]] for m in moves]
    return f'<div class="cur {kind}" data-path="{esc(path)}">{CUR_SVG if kind == "arrow" else ""}</div>'

def click(t, sel):
    return f'<i class="rip" data-ctr="{sel}" style="--at:{ms(t)}"></i>'

def spot(t, to, sel, pad=6):
    """Dims all but the target from t to `to`."""
    return f'<i class="spot" data-box="{sel}" data-pad="{pad}" style="--at:{ms(t)};--to:{ms(to)}"></i>'

def glow(t, sel, pad=4):
    return f'<i class="glw" data-box="{sel}" data-pad="{pad}" style="--at:{ms(t)}"></i>'

def colhl(t, col, within):
    return f'<i class="colhl" data-col="{col}" data-in="{within}" style="--at:{ms(t)}"></i>'

def cnt(t, n, suf='', pre=''):
    """A number that counts up from nothing when it appears."""
    return f'<b class="cnt" data-to="{n}" data-suf="{suf}" data-pre="{pre}" data-at="{int(t)}">{pre}{n}{suf}</b>'

def typed(t, text, per=55, cls='tyy'):
    n = max(1, len(text))
    return f'<span class="{cls}" style="--at:{ms(t)};--n:{n};--dur:{n * per}ms">{text}</span>'

CUR_SVG = ('<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 2.5l14.5 9.6-6.3 1.4 3.6 6.6-2.7 1.4-3.6-6.6-4.6 4.3z" '
           'fill="#fff" stroke="#0E1B2E" stroke-width="1.4" stroke-linejoin="round"/></svg>')

IC = {
    'mail': '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 7l8.5 6 8.5-6"/>',
    'phone': '<path d="M5 4h3.5l1.8 4.6-2.3 1.4a11 11 0 0 0 6 6l1.4-2.3L20 15.5V19a2 2 0 0 1-2 2C9.7 21 3 14.3 3 6a2 2 0 0 1 2-2z"/>',
    'list': '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>',
    'sync': '<path d="M20 11a8 8 0 0 0-14.3-4.6M4 13a8 8 0 0 0 14.3 4.6"/><path d="M5 3v4h4M19 21v-4h-4"/>',
    'check': '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    'x': '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
    'clock': '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 2"/>',
    'user': '<circle cx="12" cy="8" r="4"/><path d="M4.5 21a7.5 7.5 0 0 1 15 0"/>',
    'users': '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17" cy="9" r="2.6"/><path d="M16.5 14.2A5 5 0 0 1 22 19"/>',
    'home': '<path d="M3.5 11L12 4l8.5 7"/><path d="M5.5 9.5V20h13V9.5"/><path d="M10 20v-5h4v5"/>',
    'pin': '<path d="M12 21s-6.5-5.8-6.5-11a6.5 6.5 0 0 1 13 0c0 5.2-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.4"/>',
    'msg': '<path d="M4 5h16v11h-9l-5 4v-4H4z"/><path d="M8 9.5h8M8 12.5h5"/>',
    'flag': '<path d="M5.5 21V4"/><path d="M5.5 4.5h11l-2 4 2 4h-11"/>',
    'lock': '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    'chart': '<path d="M4 20h16"/><path d="M7 16v-5M12 16V6M17 16v-8"/>',
    'bolt': '<path d="M13 2.5L5 13.5h6l-1 8 8-11h-6z"/>',
    'eye': '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
    'cal': '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    'arrow': '<path d="M5 12h14M13 6l6 6-6 6"/>',
    'file': '<path d="M6.5 3h7.5l4.5 4.5V21h-12z"/><path d="M14 3v4.5h4.5"/>',
    'swap': '<path d="M4 8h13l-3-3M20 16H7l3 3"/>',
    'target': '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/>',
}
def ico(n, cls=''): return f'<svg class="ico {cls}" viewBox="0 0 24 24" aria-hidden="true">{IC[n]}</svg>'

AVC = ['#1D5BC4', '#0E7490', '#13408F', '#2563EB', '#0891B2', '#334E7E']
def avatar(name, cls=''):
    parts = [p for p in re.split(r'[\s.]+', name) if p and p[0].isalpha()]
    ini = (parts[0][0] + (parts[-1][0] if len(parts) > 1 else '')).upper()
    return f'<span class="av {cls}" style="background:{AVC[sum(map(ord, name)) % len(AVC)]}">{ini}</span>'

def br(t): return (t or '').replace(' / ', '<br>')

def words(h):
    """The headline a word at a time: each word its own span, so it can rise on its own beat."""
    out, k = [], 0
    for tok in re.findall(r'<br>|</?em>|\s+|[^\s<]+', br(h)):
        if tok in ('<br>', '<em>', '</em>'): out.append(tok)
        elif tok.isspace(): out.append(' ')
        else: out.append(f'<span class="wd" style="--i:{k}">{tok}</span>'); k += 1
    return ''.join(out), k

def hx(tag, html, d0=380, cls=''):
    h, n = words(html)
    return f'<{tag} class="hx {cls}" style="--d0:{d0}ms;--emat:{d0 + n * 75 + 250}ms">{h}</{tag}>'

def mark(cls=''): return f'<i class="mk {cls}"></i>'

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

def app(i, main, on='urgent', switch=None, url='rickyrampersadbranch.com/orphanmanagement', menu=True, url_type=None, extra='', role=None, cam=None):
    """A browser window with the board in it. switch=(t, key) moves the menu's selection at t; cam=[(t, selector|None, scale)]."""
    role = role or ROLE
    items = ''
    for k, label, n in MENUS[role]:
        cls, style = 'mi', ''
        if k == on and not switch: cls += ' on'
        if switch and k == on: cls += ' on off-at'; style = f'--at:{ms(switch[0])}'
        if switch and k == switch[1]: cls += ' on-at'; style = f'--at:{ms(switch[0])}'
        items += f'<div class="{cls}" data-k="{k}" style="{style}"><span>{label}</span>{f"<b>{n}</b>" if n else ""}</div>'
    av, nm, rl = ME[role]
    side_ = (f'<div class="side"><div class="me"><i>{av}</i><div><b>{nm}</b><span>{rl}</span></div></div>'
             f'<div class="grp">{"Yours" if role in ("staff", "agent", "unit") else "Act on"}</div>{items}</div>') if menu else ''
    u = typed(url_type, url, 42) if url_type is not None else url
    camattr = f' data-cam="{esc([[int(t), s, k] for (t, s, k) in cam])}"' if cam else ''
    return (f'<div class="scr at" style="--at:60ms"><div class="tbar"><span class="lights"><i></i><i></i><i></i></span>'
            f'<div class="ubar">{ico("lock")}<span>{u}</span></div></div>'
            f'<div class="vp"><div class="cam"{camattr}><div class="ab">{mark()}<div class="an"><b>Ricky Rampersad Branch</b>'
            f'<span>Client transition board</span></div><div class="abr"><span>Help</span><span>Refresh</span><span class="so">Sign out</span></div></div>'
            f'<div class="bd{"" if menu else " nomenu"}">{side_}<div class="main">{main}</div></div>{extra}</div></div></div>')

def phone(i, body, title='Your list', who='Andrea', extra=''):
    return (f'<div class="phn at" style="--at:60ms"><div class="ps"><div class="pab">{mark()}<b>{title}</b>'
            f'<span>· {who}</span></div><div class="pbd">{body}</div>{extra}</div></div>')

def side(i, sc, cues):
    """The left column: the chapter, the eyebrow, the headline, and lines that land on the words that name them."""
    out = (f'<div class="sd"><div class="chap"><b>{i + 1:02d}</b><span>of {len(LINES):02d}</span></div>'
           f'<div class="eb">{sc["eyebrow"]}</div>{hx("h2", sc.get("headline", ""), 420, "hl")}')
    if cues:
        items = ''
        for (t, txt, g) in cues:
            m = re.match(r'(\d+) · (.*)', txt)
            num, txt = (m.group(1), m.group(2)) if m else (None, txt)
            items += at(t, 'at l cue' + (' key' if g else ''), inner=f'<span class="cn">{num or ico("check", "tik")}</span><span>{txt}</span>')
        out += f'<div class="cues">{items}</div>'
    return out + '</div>'

def stage(left, right): return f'<div class="bstage">{left}<div class="rt"><div class="flt">{right}</div></div></div>'

def tile(t, n, label, kind='', icon='chart', count=None):
    num = cnt(t + 100, count[0], count[1]) if count else f'<b>{n}</b>'
    return at(t, f'at pop tile {kind}', inner=f'<span class="tic">{ico(icon)}</span>{num}<span class="tlb">{label}</span>')

# ── the scenes ───────────────────────────────────────────────────────────
def s_title(i, sc, D):
    rnd = [((k * 73) % 97) / 97 for k in range(80)]
    pins = [(250, 150), (1000, 140), (300, 420), (960, 430)]
    t = int(DUR[i] * 0.42)
    dots = ''
    for k in range(28):
        x = int(40 + rnd[k] * 1140); y = int(30 + rnd[k + 28] * 480)
        if 380 < x < 860 and 100 < y < 440: x = x - 360 if x < 620 else x + 360
        px, py = min(pins, key=lambda p: (p[0] - x) ** 2 + (p[1] - y) ** 2)
        import math
        ang = k * 2.39996; r = 26 + (k % 3) * 12
        tx, ty = int(px + r * math.cos(ang) - x), int(py + r * math.sin(ang) - y)
        dots += f'<i class="hd" style="left:{x}px;top:{y}px;--dx:{tx}px;--dy:{ty}px;--at:{ms(t + k * 35)}"></i>'
    pin = ''.join(f'<b class="gpin" style="left:{x - 15}px;top:{y - 15}px;--at:{ms(t + 900)}">{ico("users")}</b>' for (x, y) in pins)
    return (f'<div class="net">{dots}{pin}</div><div class="ttl"><div class="lockup"><i class="halo"></i><i class="halo h2"></i>{mark("big")}</div>'
            f'{at(250, "at up ebw", inner=sc["eyebrow"])}{hx("h1", sc["headline"], 520)}'
            f'{at(1500, "at up tsub", inner=sc["sub"])}</div>')

def s_flow(i, sc, D):
    a1, a2 = w(i, 'Each'), w(i, 'agent')
    letters = [('Wants an agent now', 'amb'), ('Keep looking after my policy', 'blu'), ('Talk it through first', 'blu')]
    lt = ''.join(at(700 + k * 420, 'at l env', inner=f'<span class="eic">{ico("mail")}</span><div><b>Answered the letter</b><span class="lbl {c}">{x}</span></div>')
                 for k, (x, c) in enumerate(letters))
    agents = ''.join(at(a2 + k * 220, 'at pop agl', inner=f'{avatar(n, "lg")}<span>{n}</span>') for k, n in enumerate(['Andrea Lewis', 'Marcus Ali', 'Kevon James']))
    chips = ''.join(at(w(i, x) - 150, 'at up fchip', inner=f'{ico(ic)}Every {x}') for x, ic in (('name', 'user'), ('call', 'phone'), ('note', 'msg')))
    arw = lambda t: f'<div class="arw" style="--at:{ms(t)}"><i class="ln"></i><i class="pkt"></i><i class="pkt q2"></i><i class="pkt q3"></i></div>'
    mid = at(a1, 'at pop midc', inner=f'{mark()}<b>One board</b><span>every client, every agent</span>')
    return (f'<div class="flowwrap">{at(150, "at up ebw", inner=sc["eyebrow"])}{hx("h2", sc["headline"], 350, "c")}'
            f'<div class="flw"><div class="fcol">{lt}</div>{arw(a1 - 300)}<div class="fcol mid">{mid}<div class="fchips">{chips}</div></div>'
            f'{arw(a2 - 300)}<div class="fcol agents">{agents}</div></div></div>')

def rowlist(rows, t0, gap=180, keys=False):
    out = ''
    for k, (n, why, hot) in enumerate(rows):
        reason = f'<span class="lbl amb">{why}</span>' if hot else f'<span class="rs">{why}</span>'
        dk = f' data-k="r{k}"' if keys else ''
        out += at(t0 + k * gap, 'at l rw', extra=dk, inner=f'{avatar(n)}<div class="rn"><b>{n}</b>{reason}</div>'
                  f'<span class="tel">{ico("phone")}Call</span><span class="lb">Log call</span>')
    return out

def s_signin(i, sc, D):
    tF1, tF2, tBtn = w(i, 'number'), w(i, 'password'), w(i, 'password', shift=1100)
    tOut = w(i, 'Sign', 2)
    gate = (f'<div class="gate until" style="--at:0ms;--to:{ms(tBtn + 350)}"><div class="gc"><div class="gch"><span class="gl">{ico("lock")}</span>'
            f'<b>Sign in to the board</b></div>'
            f'<label>Agent number or your name</label><div class="fld f1">{typed(tF1 - 200, "A10024", 90)}</div>'
            f'<label>Password</label><div class="fld f2">{typed(tF2 - 100, "••••••••", 70)}</div>'
            f'<div class="bbtn prs gob" style="--at:{ms(tBtn)}">Open the board {ico("arrow", "ii")}</div>'
            f'<p>This device keeps you signed in until you press Sign out.</p></div></div>')
    rows = rowlist([('Ravi Persad', 'Call-back: a licensed agent', 1), ('Keisha Thomas', 'Wants an agent now', 1), ('Joel Baptiste', 'Former agent in touch', 1),
                    ('Nadia Khan', 'Asked for a call', 0), ('Sean Daniel', 'Keep looking after my policy', 0)], tBtn + 500)
    first = {'branch': 'Urgent <small>12</small>', 'staff': 'Your calls <small>23</small>', 'agent': 'To call <small>6</small>'}[ROLE]
    main = f'{gate}<div class="after" style="--at:{ms(tBtn + 400)}"><h3>{first}</h3>{rows}</div>'
    extra = (cursor([(tF1 - 900, 560, 330), (tF1 - 250, '.f1'), (tF2 - 150, '.f2'), (tBtn - 40, '.gob'), (tOut - 50, '.so')])
             + click(tF1 - 250, '.f1') + click(tF2 - 150, '.f2') + click(tBtn, '.gob') + glow(tOut, '.so'))
    cam = [(tF1 - 400, '.gc', 1.22), (tBtn + 450, None, 1), (tOut - 200, '.so', 1.3)]
    cues = [(w(i, 'Open'), 'rickyrampersadbranch.com/orphanmanagement', False), (w(i, 'Sign'), 'Your agent number or first name, and your password', False),
            (w(i, 'device'), 'Signed in on this device until you press Sign out', True)]
    return stage(side(i, sc, cues), app(i, main, menu=False, url_type=500, extra=extra, cam=cam))

def s_urgent(i, sc, D):
    t1, t2 = w(i, 'First'), w(i, 'Then')
    g1 = at(t1 - 100, 'at l gh', inner=f'<b>{ico("flag", "ii")} Call-back asked: a licensed agent</b><span>Client Support spoke to them. Name an agent.</span>')
    r1 = rowlist([('Ravi Persad', 'Call-back: a licensed agent', 1), ('Lena Singh', 'Call-back: wants to review cover', 1)], t1 + 150)
    g2 = at(t2 - 100, 'at l gh', inner=f'<b>{ico("bolt", "ii")} Told us something pressing</b><span>An agent now, a former agent in touch, a payment to trace.</span>')
    r2 = rowlist([('Keisha Thomas', 'Wants an agent now', 1), ('Joel Baptiste', 'The former agent has been in touch', 1), ('Maya Ramdial', 'Paid, and it is not showing', 1)], w(i, 'agent', 1) + 100)
    main = f'<h3>Urgent <small>12</small></h3><div data-k="g1">{g1}{r1}</div><div data-k="g2">{g2}{r2}</div>'
    extra = spot(t1 + 300, t2 - 200, '[data-k=g1]') + spot(t2 + 200, D - 500, '[data-k=g2]')
    cam = [(t1, '[data-k=g1]', 1.12), (t2, '[data-k=g2]', 1.12)]
    cues = [(t1, '1 · The call-backs Client Support asked for', False), (t2, '2 · An agent now, or a former agent in touch', False)]
    return stage(side(i, sc, cues), app(i, main, on='urgent', extra=extra, cam=cam))

STC = ['#07606f', '#1d8fa6', '#62bfd2', '#a9dbe6', '#e3eaef']
STAGES = ['Completed', 'Met', 'Spoken to', 'Tried', 'Nothing yet']

def s_agents(i, sc, D):
    tSw = 900
    tHH, tAns, tFar = w(i, 'households'), w(i, 'answered'), w(i, 'far')
    tiles = [(tHH, '148', 'Households with no agent', '', 'home', (148, '')), (tAns, '38', 'Answered, still no agent', 'amb', 'clock', (38, '')),
             (tAns + 300, '12', 'Urgent households', 'amb', 'bolt', (12, '')), (tFar - 300, '9 of 19', 'Agents with clients', '', 'users', None),
             (tFar, '41%', 'Spoken to by their agent', '', 'phone', (41, '%')), (tFar + 300, '7', 'Nothing logged', 'red', 'flag', (7, ''))]
    tl = ''.join(tile(*x) for x in tiles)
    bar = ''.join(f'<i class="gr" style="--at:{ms(tHH + 200 + k * 140)};--w:{p}%;background:{c}"></i>' for k, (c, p) in enumerate(zip(STC, [14, 12, 15, 9, 50])))
    legend = ''.join(f'<span class="lg"><i style="background:{c}"></i>{x}</span>' for c, x in zip(STC, STAGES))
    donut = (f'<div class="donut"><svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="50" class="dk0"/>'
             f'<circle cx="60" cy="60" r="50" class="dk1" style="--at:{ms(tSw + 350)};--off:{314 * 0.36:.1f}"/></svg>{cnt(tSw + 350, 64, "%")}</div>')
    main = (f'<div class="after" style="--at:{ms(tSw + 200)}"><h3>Agents</h3><div class="heroa">{donut}<div class="htx"><b>Households with an agent</b>'
            f'<span>of the <b>412</b> households of the books: <b>251</b> in full, <b>13</b> in part.</span></div></div>'
            f'<div class="stk">{bar}</div><div class="lgd">{legend}</div><div class="tiles">{tl}</div></div>')
    extra = cursor([(300, 420, 260), (tSw, '[data-k=agents]')]) + click(tSw, '[data-k=agents]')
    cam = [(tHH, '.heroa', 1.15), (tAns, '.tiles', 1.2)]
    cues = [(tHH, 'Households with an agent', False), (tAns, 'Answered, and still waiting', False), (tFar, 'How far each agent has got', True)]
    return stage(side(i, sc, cues), app(i, main, on='urgent', switch=(tSw, 'agents'), extra=extra, cam=cam))

AG = [('Andrea Lewis', 6, 9, [3, 2, 3, 1, 0], '13 Oct', 0), ('Marcus Ali', 5, 7, [1, 2, 2, 0, 2], '12 Oct', 0),
      ('Kevon James', 4, 6, [0, 1, 1, 1, 3], '9 Oct', 3), ('Lisa Chan', 3, 4, [2, 1, 1, 0, 0], '13 Oct', 0), ('Dion Bristol', 3, 3, [0, 0, 1, 0, 2], '8 Oct', 0)]
CONV = [(14, 56, 3), (9, 44, 4), (2, 17, 9), (8, 75, 2), (3, 33, 6)]   # conversations, converted %, days waited (average)

def agrow(k, a, t0, times, cls=''):
    name, hh, n, g, last, q = a
    segs = ''.join(f'<i class="gr" style="--at:{ms(times[s])};--w:{100 * g[s] / n:.1f}%;background:{STC[s]}"></i>' for s in range(5) if g[s])
    sp = g[0] + g[1] + g[2]
    return at(t0 + k * 170, f'at l tr {cls}', inner=f'<span class="nm">{avatar(name, "sm")}{name}</span><span>{hh}</span><span>{n}</span><span class="pb">{segs}</span>'
                                                    f'<span>{round(100 * sp / n)}%</span><span class="nl">{g[4]}</span><span>{last}</span>')

def s_table(i, sc, D):
    tCv, tCo, tDw, tRed = w(i, 'Conversations'), w(i, 'Converted'), w(i, 'days'), w(i, 'red')
    times = [tCo, tCo, tCv, tCv, 500]
    head = ('<div class="th c8"><span>Agent</span><span>Clients</span><span>Progress</span><span data-k="hcv">Conversations</span><span data-k="hco">Converted</span>'
            '<span data-k="hdw">Days waited</span><span>Nothing logged</span><span>Last activity</span></div>')
    rows = ''
    for k, a in enumerate(AG):
        name, hh, n, g, last, q = a
        cv, co, dw = CONV[k]
        segs = ''.join(f'<i class="gr" style="--at:{ms(times[s])};--w:{100 * g[s] / n:.1f}%;background:{STC[s]}"></i>' for s in range(5) if g[s])
        red = f' red-at" data-k="redk" style="--at:{ms(tRed)}' if q else ''
        rows += at(500 + k * 170, 'at l tr c8', inner=f'<span class="nm">{avatar(name, "sm")}{name}</span><span>{n}</span><span class="pb">{segs}</span>'
                   f'{at(tCv + 100 + k * 90, "at pop num", tag="span", inner=str(cv))}{at(tCo + 100 + k * 90, "at pop num", tag="span", inner=f"{co}%")}'
                   f'{at(tDw + 100 + k * 90, "at pop num" + (" warn" if dw > 7 else ""), tag="span", inner=f"{dw} days")}'
                   f'<span class="nl{red}">{g[4]}{" · past 2 days" if q else ""}</span><span>{last}</span>')
    main = f'<h3>The agents <small>conversations and conversion</small></h3><div class="tbl" data-k="tbl">{head}{rows}</div>'
    extra = colhl(tCv, '[data-k=hcv]', '[data-k=tbl]') + colhl(tCo, '[data-k=hco]', '[data-k=tbl]') + colhl(tDw, '[data-k=hdw]', '[data-k=tbl]')
    cam = [(tCv - 150, '[data-k=hco]', 1.14), (tRed - 100, '[data-k=redk]', 1.35)]
    cues = [(tCv, 'Conversations', False), (tCo, 'Converted: met or completed', False), (tDw, 'Days their clients have waited', False), (tRed, 'Nothing logged after two days: red', True)]
    return stage(side(i, sc, cues), app(i, main, on='agents', extra=extra, cam=cam))

def s_batches(i, sc, D):
    tU, tF, tA = w(i, 'Urgent'), w(i, 'families'), w(i, 'asked')
    chips = [('Urgent', '12', tU, tF), ('Finish the family', '4', tF, tA), ('Asked us', '57', tA, D + 999), ('Answered or reached', '31', None, None),
             ('Not answered yet', '268', None, None), ('Letter held', '22', None, None)]
    ch = ''.join((f'<span class="chp hl" style="--at:{ms(a)};--to:{ms(b)}">' if a else '<span class="chp">') + f'{x} <b>{n}</b></span>' for (x, n, a, b) in chips)
    def cards(t1, t2, hs):
        return (f'<div class="crds until" style="--at:{ms(t1)};--to:{ms(t2)}">' +
                ''.join(at(t1 + k * 140, 'at l hc', inner=f'<span class="hci">{ico("users")}</span><div class="hct"><b>{h}</b><span class="lbl amb">{s}</span>'
                           f'<span class="dots">' + ''.join(f'<i class="{"on" if d else ""}"></i>' for d in m) + f'</span></div>'
                           f'<span class="sg"><small>Suggested</small><b>{avatar(a, "sm")}{a}</b></span>')
                        for k, (h, s, a, m) in enumerate(hs)) + '</div>')
    c1 = cards(tU, tF, [('Persad household · 2 people', 'Call-back: a licensed agent', 'Marcus Ali', [1, 0]), ('Thomas household · 1 person', 'Wants an agent now', 'Kevon James', [1]),
                        ('Ramlal household · 3 people', 'Former agent in touch', 'Andrea Lewis', [1, 0, 0])])
    c2 = cards(tF, tA, [('Mohan household · 3 people', '1 named, 2 to name', 'Andrea Lewis', [1, 0, 0]), ('Baptiste household · 2 people', '1 named, 1 to name', 'Lisa Chan', [1, 0])])
    c3 = cards(tA, D + 999, [('Singh household · 2 people', 'Keep looking after my policy', 'Dion Bristol', [1, 0]), ('Charles household · 1 person', 'Talk it through first', 'Marcus Ali', [1]),
                             ('Ali household · 4 people', 'Asked for a call', 'Kevon James', [1, 1, 0, 0])])
    main = f'<h3>Households to name <small>in batches</small></h3><div class="chps">{ch}</div><div class="cardsw">{c1}{c2}{c3}</div>'
    cam = [(tU, '.cardsw', 1.12)]
    cues = [(tU, '1 · Urgent', False), (tF, '2 · Families half named', False), (tA, '3 · Everyone who asked us', False)]
    return stage(side(i, sc, cues), app(i, main, on='agents', cam=cam))

def hcard(tP, staff=False):
    mem = [('Anita Mohan', 'Answered: wants an agent now', 'grn'), ('Ravi Mohan', 'Reached by phone' if staff else 'Written to, no answer', 'blu'),
           ('Priya Mohan', '16 · on the call list' if staff else '16 · letter held', 'gry')]
    ms_ = ''.join(f'<div class="hm">{avatar(n, "sm")}<b>{n}</b><span class="lbl {c}">{s}</span>{at(tP + 250 + k * 160, "at pop tagp", tag="span", inner=ico("check", "ii") + " Andrea Lewis")}</div>'
                  for k, (n, s, c) in enumerate(mem))
    return (f'<div class="hcard"><div class="hh"><span class="hci">{ico("home")}</span><div><b>Mohan household</b><span>3 people · Chaguanas{" · on your board" if staff else ""}</span></div></div>{ms_}'
            f'<div class="sgl"><span class="sl">Suggested</span>{avatar("Andrea Lewis", "sm")}<b>Andrea Lewis</b><i>the family&rsquo;s agent: the 24 Sep plan</i>'
            f'<span class="ab1 prs" style="--at:{ms(tP)}"><span class="sa until" style="--at:0ms;--to:{ms(tP + 120)}">Assign the 3 to Andrea</span>'
            f'<span class="sb at" style="--at:{ms(tP + 120)}">{ico("check", "ii")} Named</span></span></div></div>')

def s_assign(i, sc, D):
    tP, tB = w(i, 'names'), wo(i, 'batch')
    if tB is None: return s_assign_one(i, sc, D, tP)
    batch = (f'<div class="btt"><div class="btr">{avatar("Marcus Ali")}<b>Marcus Ali</b><span>9 households</span><span>11 clients</span>'
             f'<span class="ab2 prs" style="--at:{ms(tB + 250)}">Assign these 9 to Marcus</span></div></div>')
    toast1 = f'<div class="toast until" style="--at:{ms(tP + 350)};--to:{ms(tB + 300)}">{ico("check", "ii")} Named: Andrea 3 · brief e-mailed</div>'
    toast2 = f'<div class="toast at" style="--at:{ms(tB + 450)}">{ico("check", "ii")} Named: Marcus 9 · brief e-mailed</div>'
    main = f'<h3>Households to name <small>Urgent</small></h3>{hcard(tP)}<h4>This batch by suggested agent</h4>{batch}'
    extra = cursor([(1200, 620, 380), (tP - 30, '.ab1'), (tB + 220, '.ab2')]) + click(tP, '.ab1') + click(tB + 250, '.ab2') + toast1 + toast2
    cam = [(tP - 700, '.hcard', 1.16), (tB - 300, None, 1)]
    cues = [(w(i, 'suggested'), 'One suggested agent a household', False), (tP, 'One press names the household', True), (tB, 'Or a whole batch at once', False)]
    return stage(side(i, sc, cues), app(i, main, on='agents', extra=extra, cam=cam))

def s_assign_one(i, sc, D, tP):
    """Naming one household, as Client Support do it on their own board: the brief goes, there is no batch."""
    tBr = w(i, 'brief')
    toast = f'<div class="toast at" style="--at:{ms(tBr - 200)}">{ico("check", "ii")} Named: Andrea 3 · brief e-mailed to Andrea</div>'
    mail = at(tBr, 'at pop mailfly', inner=f'{ico("mail", "ii")} Brief to Andrea Lewis')
    main = f'<h3>Households to name <small>On your board</small></h3>{hcard(tP, True)}{mail}'
    extra = cursor([(900, 620, 380), (tP - 30, '.ab1')]) + click(tP, '.ab1') + toast
    cam = [(tP - 700, '.hcard', 1.16), (tBr - 400, None, 1)]
    cues = [(w(i, 'suggested'), 'One suggested agent a household', False), (tP, 'One press names the household', True), (tBr, 'The agent gets a brief by e-mail', False)]
    return stage(side(i, sc, cues), app(i, main, on='agents', extra=extra, cam=cam))

def rows_at(i, sc, defaults):
    """Each row's moment: the word it names (its "at"), else the defaults in order."""
    return [w(i, r['at']) if r.get('at') else w(i, d) for r, d in zip(sc['rows'], defaults + [None] * len(sc['rows']))]

def keeps(rows, ts, ics, off=None):
    rw = ''
    for k, (t, r, ic) in enumerate(zip(ts, rows, ics)):
        o = off and r.get('off')
        rw += at(t, 'at l keep' + (' off' if o else ''), inner=f'<span class="kic{" spin" if ic == "sync" else ""}">{ico(ic)}</span><div><b>{r["b"]}</b><span class="ks">{r["i"]}</span></div>'
                 + (f'<s class="strk" style="--at:{ms(t + 500)}"></s>' if o else ''))
    return f'<div class="keeps"><i class="vline" style="--at:{ms(ts[0])};--to:{ms(ts[-1] + 400)}"></i>{rw}</div>'

def s_named(i, sc, D):
    ts = rows_at(i, sc, ['brief', 'list', 'Salesforce'])
    return (f'<div class="center">{at(150, "at up ebw", inner=sc["eyebrow"])}{hx("h2", sc.get("headline", "What happens <em>next</em>"), 350, "c")}'
            f'{keeps(sc["rows"], ts, ["mail", "list", "sync"])}</div>')

def s_counts(i, sc, D):
    ts = rows_at(i, sc, ['log', 'comment', 'Campaign', 'Chatter'])
    ics = ['x' if r.get('off') else 'check' for r in sc['rows']]
    return (f'<div class="center">{at(150, "at up ebw", inner=sc["eyebrow"])}{hx("h2", sc.get("headline", "Three ways it <em>counts</em>"), 350, "c")}'
            f'{keeps(sc["rows"], ts, ics, off=True)}</div>')

def s_list(i, sc, D):
    tB, tNo, tDay = w(i, 'board'), w(i, 'naming'), w(i, 'every', 2)
    rows = [('Keisha Thomas', 'Named 14 Oct · on the board', 'Wants an agent now'), ('Lena Singh', 'Named 13 Oct · in Salesforce', 'Call-back: a licensed agent'),
            ('Omar Hosein', 'Named 13 Oct · in Salesforce', 'Keep looking after my policy'), ('Gail Walker', 'Named 12 Oct · on the board', 'Talk it through first'),
            ('Ian Francis', 'Named 9 Oct · in Salesforce', 'Asked for a call')]
    prw = lambda n, x, s: f'{avatar(n, "sm")}<div><b>{n}</b><i>{x}</i><em>{s}</em></div>'
    body = (f'<div class="ptabs"><span class="on">To call <b>6</b></span><span>Your work</span><span>Done</span></div>'
            + at(tDay, 'at pop prw new', inner=prw('Ravi Persad', 'Named today · in Salesforce', 'Call-back: a licensed agent'))
            + ''.join(at(500 + k * 260, 'at l prw', inner=prw(n, x, s)) for k, (n, x, s) in enumerate(rows)))
    cues = [(600, 'Every client named to you', False), (tB, 'From the board or from Salesforce', False), (tNo, 'A Salesforce naming sends no e-mail', False),
            (tDay, 'Check your list every day', True)]
    return stage(side(i, sc, cues), phone(i, body))

def s_client(i, sc, D):
    tN, tL, tF, tT, tC = w(i, 'numbers'), w(i, 'live'), w(i, 'family'), w(i, 'told'), w(i, 'calling')
    blocks = [(tN, 'Reach them', 'phone', '<span class="big">868 555 0142</span><span>868 555 0190 · home</span><span>prefers a call · best in the evening</span>'),
              (tL, 'Lives at', 'pin', '<span class="big">Chaguanas</span><span>Lot 12, Example Street</span>'),
              (tF, 'Household', 'users', '<span class="big">Thomas household · 3 people</span><span>1 answered · 1 under 18</span>'),
              (tT, 'What they told us', 'msg', '<span class="big">“I want an agent now.”</span><span>Answered 26 Sep</span>'),
              (tC, 'Why we call', 'flag', '<span class="big">Named to you 14 Oct</span><span>Call-back asked by Client Support</span>')]
    body = (f'<div class="prw open">{avatar("Keisha Thomas", "sm")}<div><b>Keisha Thomas</b><i>Named 14 Oct · on the board</i><em>Wants an agent now</em></div></div>' +
            ''.join(at(t, 'at up blk', inner=f'<span class="bki">{ico(ic)}</span><div><h5>{h}</h5>{x}</div>') for (t, h, ic, x) in blocks))
    extra = cursor([(150, 150, 300), (450, '.prw.open')], kind='touch') + click(450, '.prw.open')
    cues = [(tN, 'Their numbers', False), (tL, 'Where they live', False), (tF, 'Their family', False), (tT, 'What they told us', False), (tC, 'Why we are calling', True)]
    return stage(side(i, sc, cues), phone(i, body, title='Keisha Thomas', who='client', extra=extra))

def s_logcall(i, sc, D):
    tLog = w(i, 'Log'); tC, tM, tN, tD, tCl = w(i, 'called'), w(i, 'met'), w(i, 'no', 1), w(i, 'declined'), w(i, 'closed')
    tW, tS = w(i, 'Write'), w(i, 'save')
    outs = [('Called', tC), ('Met', tM), ('No answer', tN), ('Declined', tD), ('Closed', tCl)]
    seq = [tC, tM, tN, tD, tCl, tCl + 650]
    ch = ''.join(f'<span class="oc lit{" sel" if k == 0 else ""}" style="--at:{ms(t)};--to:{ms(seq[k + 1])}">{x}</span>' for k, (x, t) in enumerate(outs))
    sheet = (f'<div class="sheet" style="--at:{ms(tLog + 150)}"><b>What happened?</b><div class="ocs">{ch}</div>'
             f'<label>A line for the file</label><div class="fld">{typed(tW, "Spoke to her. Visit booked for Friday.", 38)}</div>'
             f'<div class="bbtn prs" style="--at:{ms(tS)}">Save</div></div>')
    body = (f'<div class="prw open">{avatar("Keisha Thomas", "sm")}<div><b>Keisha Thomas</b><i>Named 14 Oct · on the board</i><em>Wants an agent now</em></div>'
            f'<span class="lbtn prs" style="--at:{ms(tLog)}">Log call</span></div>'
            f'<div class="blk"><span class="bki">{ico("phone")}</span><div><h5>Reach them</h5><span class="big">868 555 0142</span></div></div>'
            f'<div class="blk"><span class="bki">{ico("flag")}</span><div><h5>Why we call</h5><span class="big">Named to you 14 Oct</span></div></div>')
    toast = f'<div class="toast tph at" style="--at:{ms(tS + 300)}">{ico("check", "ii")} Saved: Called</div>'
    extra = (sheet + toast + cursor([(300, 160, 300), (tLog - 30, '.lbtn'), (tC + 100, '.oc.sel'), (tW - 200, '.sheet .fld'), (tS - 30, '.sheet .bbtn')], kind='touch')
             + click(tLog, '.lbtn') + click(tC + 100, '.oc.sel') + click(tS, '.sheet .bbtn'))
    cues = [(tLog, 'Press Log call', False), (tC, 'Called · Met · No answer · Declined · Closed', False), (tW, 'One line for the file, then Save', True)]
    return stage(side(i, sc, cues), phone(i, body, title='Keisha Thomas', who='client', extra=extra))

def s_comment(i, sc, D):
    tO, tW, tP, tSt = w(i, 'open'), w(i, 'Write'), w(i, 'post'), w(i, 'stays')
    hist = [('25 Sep', 'Our letter went to her', 'mail'), ('26 Sep', 'She answered: wants an agent now', 'msg'), ('14 Oct', 'Named to Andrea Lewis', 'user'),
            ('14 Oct', 'Called: visit booked for Friday', 'phone')]
    hl = ''.join(at(tO + 300 + k * 200, 'at l hii', inner=f'<span class="hdot">{ico(ic)}</span><i>{d}</i><span>{x}</span>') for k, (d, x, ic) in enumerate(hist))
    main = (f'<h3>Keisha Thomas <small>History · tasks · comments</small></h3><div class="det until" style="--at:0ms;--to:{ms(tO + 200)}">'
            f'<div class="dl">{ico("file", "ii")} History · tasks · comments</div></div>'
            f'<div class="dw after" style="--at:{ms(tO + 200)}"><div class="dc"><h5>History</h5>{hl}</div>'
            f'<div class="dc" data-k="cmc"><h5>Comments</h5>'
            f'<div class="cbox"><div class="fld">{typed(tW, "Visited on Friday. Wants cover for her daughter.", 32)}</div><span class="bbtn prs" style="--at:{ms(tP)}">Post</span></div>'
            + at(tP + 250, 'at pop cmt', inner=f'{avatar("Andrea Lewis", "sm")}<div><b>Andrea Lewis · just now</b><span>Visited on Friday. Wants cover for her daughter.</span></div>')
            + at(tSt, 'at pop onfile', inner=f'{ico("check", "ii")} On the client&rsquo;s file') + '</div></div>')
    extra = (cursor([(300, 500, 360), (tO - 30, '.dl'), (tW - 150, '.cbox .fld'), (tP - 30, '.cbox .bbtn')]) + click(tO, '.dl') + click(tW - 150, '.cbox .fld') + click(tP, '.cbox .bbtn'))
    cam = [(tW - 400, '[data-k=cmc]', 1.12)]
    cues = [(tO, 'History · tasks · comments', False), (tW, 'Write it, and post it', False), (tSt, 'It stays on the client&rsquo;s file', True)]
    return stage(side(i, sc, cues), app(i, main, on='agents', menu=False, extra=extra, cam=cam))

def s_sees(i, sc, D):
    tLog, tMv, tCl = w(i, 'log'), w(i, 'moves'), w(i, 'clears')
    head = '<div class="th"><span>Agent</span><span>Households</span><span>Clients</span><span>Progress</span><span>Spoken to</span><span>Nothing logged</span><span>Last activity</span></div>'
    row = (f'<div class="tr big" data-k="kev"><span class="nm">{avatar("Kevon James", "sm")}Kevon James</span><span>4</span><span>6</span><span class="pb">'
           f'<i class="gr" style="--at:{ms(tMv)};--w:16.7%;background:{STC[0]}"></i><i class="gr" style="--at:{ms(tMv + 150)};--w:16.7%;background:{STC[1]}"></i>'
           f'<i class="gr" style="--at:{ms(tMv + 300)};--w:33.3%;background:{STC[2]}"></i></span>'
           f'<span class="sw2"><span class="sa until" style="--at:0ms;--to:{ms(tMv + 200)}">17%</span><span class="sb at" style="--at:{ms(tMv + 200)}">67%</span></span>'
           f'<span class="nl red0 clr" style="--at:{ms(tCl)}"><span class="sa until" style="--at:0ms;--to:{ms(tCl)}">3 · past 2 days</span><span class="sb at" style="--at:{ms(tCl)}">2</span></span>'
           f'<span class="sw2"><span class="sa until" style="--at:0ms;--to:{ms(tLog + 300)}">9 Oct</span><span class="sb at" style="--at:{ms(tLog + 300)}">today</span></span></div>')
    others = ''.join(agrow(k, a, 300, [300] * 5, cls='dim') for k, a in enumerate([AG[0], AG[1], AG[3]]))
    main = f'<h3>The agents</h3><div class="tbl">{head}{row}{others}</div>'
    cam = [(tLog - 300, '[data-k=kev]', 1.3)]
    cues = [(tLog, 'You log the call', False), (tMv, 'The bar moves', False), (tCl, 'The red flag clears', True)]
    return stage(side(i, sc, cues), app(i, main, on='agents', role='branch', cam=cam))

def s_close(i, sc, D):
    three = sc['words3']
    ws = [(w(i, x.split()[0]), x, k == 2) for k, x in enumerate(three)]
    ln = ''.join(at(t, 'at up cl' + (' last' if g else ''), inner=x) for (t, x, g) in ws)
    return (f'<div class="center" id="finale"><div class="lockup sm"><i class="halo"></i><i class="halo h2"></i>{mark("big")}</div>'
            f'{at(150, "at up ebw", inner=sc["eyebrow"])}<div class="cls">{ln}</div>'
            f'{at(ws[-1][0] + 600, "at up furl", inner=ico("arrow", "ii") + " " + sc["url"])}</div>')

def s_since(i, sc, D):
    """Since the naming: every named client by how long ago, conversations and conversion."""
    tN, tF, tM = w(i, 'named'), w(i, 'first'), w(i, 'meeting')
    tiles = [(500, '58%', 'Had a conversation', '', 'phone', (58, '%')), (700, '21%', 'Converted: met or completed', 'cv', 'target', (21, '%')),
             (900, '64', 'Conversations logged', '', 'msg', (64, '')), (1100, '2 days', 'To first contact', '', 'clock', (2, ' days')),
             (1300, '6 days', 'To a meeting', 'mtg', 'cal', (6, ' days'))]
    tl = ''.join(tile(*x).replace('class="at pop tile mtg"', 'class="at pop tile mtg" data-k="tmt"') for x in tiles)
    bands = [('0 to 2 days ago', [0, 1, 4, 2, 5], 12), ('3 to 7 days ago', [1, 2, 4, 1, 3], 11), ('8 to 14 days ago', [2, 2, 3, 1, 2], 10), ('15 days or more ago', [2, 1, 2, 0, 4], 9)]
    rows = ''
    for k, (lab, g, n) in enumerate(bands):
        segs = ''.join(f'<i class="gr" style="--at:{ms(tN + 200 + k * 160)};--w:{100 * g[s] / n:.1f}%;background:{STC[s]}"></i>' for s in range(5) if g[s])
        hl = f' hlrow" style="--at:{ms(tF)}' if k == 0 else ''
        rows += at(tN + k * 160, 'at l tr c5', inner=f'<span class="nm{hl}">{lab}</span><span>{n}</span><span class="pb">{segs}</span><span class="{"bad" if k >= 1 and g[4] else ""}">{g[4]}</span><span>{round(100 * (g[0] + g[1]) / n)}%</span>')
    head = '<div class="th c5"><span>Named</span><span>Clients</span><span>Progress</span><span>Nothing logged</span><span>Converted</span></div>'
    main = f'<h3>Since the naming</h3><div class="tiles t5">{tl}</div><div class="tbl" style="margin-top:12px">{head}{rows}</div>'
    extra = glow(tM, '[data-k=tmt]', 3)
    cam = [(tF - 100, '.hlrow', 1.25), (tM - 100, '[data-k=tmt]', 1.3)]
    cues = [(tN, 'Every client, by how long ago they were named', False), (tF, 'A conversation in the first two days', True), (tM, 'A meeting soon after', False)]
    return stage(side(i, sc, cues), app(i, main, on='agents', extra=extra, cam=cam))

def s_reassign(i, sc, D):
    """Reassign one client: the list opens, an agent is chosen, the history grows by one line."""
    tR = w(i, 'Reassign'); tH = w(i, 'history')
    tA = wo(i, 'agent') or wo(i, 'name') or tH
    tD, tWho = w(i, 'date'), w(i, 'who')
    by = 'the branch' if ROLE == 'branch' else 'Client Support'
    opts = ''.join((f'<div class="op pick" style="--at:{ms(tR + 650)}">' if x == 'Andrea Lewis' else '<div class="op">') + avatar(x, 'sm') + x + '</div>'
                   for x in ('Andrea Lewis', 'Dion Bristol', 'Lisa Chan', 'Marcus Ali'))
    sel = f'<div class="rsel prs" style="--at:{ms(tR)}">{ico("swap", "ii")} Reassign to&hellip; ▾</div>'
    drop = f'<div class="dropl until" data-below=".rsel" style="--at:{ms(tR + 80)};--to:{ms(tR + 900)}">{opts}</div>'
    line = (f'<div class="mrow"><div>{avatar("Joel Baptiste")}<b>Joel Baptiste</b><small>letter F2 · 52 · Arima</small></div>'
            f'<div class="mw"><span class="lbl grn">Answered: the former agent has been in touch</span>'
            f'<span>Agent <b class="sw2"><span class="sa until" style="--at:0ms;--to:{ms(tR + 950)}">Kevon James</span><span class="sb at" style="--at:{ms(tR + 950)}">Andrea Lewis</span></b> '
            f'<span class="agst">nothing logged</span> <span class="mut">12 days since the naming</span></span>'
            f'<span class="hist">{ico("clock", "ii")} History: <b class="hseg" style="--at:{ms(tA)}">Kevon James</b> <i class="hseg d" style="--at:{ms(tD)}">2 Oct</i> <span class="mut">(in Salesforce)</span>'
            + at(tR + 1000, 'at l', tag='span', inner=' &rarr; <b>Andrea Lewis</b> <i class="hseg d" style="--at:' + ms(tD) + '">today</i> <span class="mut">(on the board, <span class="hseg w" style="--at:' + ms(tWho) + '">by ' + by + '</span>)</span>') + '</span>'
            f'{sel}</div></div>')
    toast = f'<div class="toast at" style="--at:{ms(tR + 1000)}">{ico("check", "ii")} Named: Andrea 1 · the history keeps Kevon James</div>'
    main = f'<h3>Kevon James <small>4 households · 6 clients</small></h3>{line}'
    extra = drop + cursor([(300, 500, 380), (tR - 30, '.rsel'), (tR + 620, '.op.pick')]) + click(tR, '.rsel') + click(tR + 650, '.op.pick') + toast
    cam = [(tH - 300, '.hist', 1.25)]
    cues = [(tR, 'Choose Reassign', False), (tH, 'The history keeps every agent', False), (tD, 'The date', False), (tWho, 'And who made the change', True)]
    return stage(side(i, sc, cues), app(i, main, on='agents', extra=extra, cam=cam))

def s_unit(i, sc, D):
    """A unit manager's own view: the team's agents, their clients and conversations, how long each has waited."""
    tT, tC, tCv, tW = w(i, 'team'), w(i, 'clients'), w(i, 'conversations'), w(i, 'waited')
    head = '<div class="th c6"><span>Agent</span><span>Clients</span><span>Progress</span><span>Conversations</span><span>Days waited</span><span>Nothing logged</span></div>'
    team = [('Kevon James', 6, [0, 1, 1, 1, 3], 2, 9, 3), ('Lisa Chan', 4, [2, 1, 1, 0, 0], 8, 2, 0), ('Dion Bristol', 3, [0, 0, 1, 0, 2], 3, 6, 2)]
    rows = ''
    for k, (nm_, n, g, cv, dw, q) in enumerate(team):
        segs = ''.join(f'<i class="gr" style="--at:{ms(tC + 100 + k * 120)};--w:{100 * g[s] / n:.1f}%;background:{STC[s]}"></i>' for s in range(5) if g[s])
        rows += at(tT + k * 170, 'at l tr c6', inner=f'<span class="nm">{avatar(nm_, "sm")}{nm_}</span><span>{n}</span><span class="pb">{segs}</span>'
                   f'{at(tCv + k * 90, "at pop num", tag="span", inner=str(cv))}{at(tW + k * 90, "at pop num" + (" warn" if dw > 7 else ""), tag="span", inner=str(dw) + " days")}<span class="{"bad" if q else ""}">{g[4]}</span>')
    main = (f'<h3>Agents <small>your unit</small></h3><div class="heroa"><div class="donut"><svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="50" class="dk0"/>'
            f'<circle cx="60" cy="60" r="50" class="dk1" style="--at:{ms(tT)};--off:{314 * 0.54:.1f}"/></svg>{cnt(tT, 46, "%")}</div>'
            f'<div class="htx"><b>Spoken to by their agent</b><span><b>13</b> clients named to your unit, in <b>10</b> households.</span></div></div>'
            f'<div class="tbl" style="margin-top:12px">{head}{rows}</div><p class="fnote at" style="--at:{ms(tT + 600)}">Nothing to name here: the branch and Client Support name the agents.</p>')
    cam = [(tCv - 200, '.tbl', 1.14)]
    cues = [(tT, 'Their own team', False), (tCv, 'Clients and conversations', False), (tW, 'How long each client has waited', True)]
    return stage(side(i, sc, cues), app(i, main, on='agents', role='unit', cam=cam))

def s_yourcalls(i, sc, D):
    """Client Support's own list, in order: why to call, the number to tap."""
    tO, tWhy, tNum = w(i, 'order'), w(i, 'why'), w(i, 'number')
    calls = [('1', 'Keisha Thomas', 'Wrote that no one called', '868 555 0142'), ('2', 'Omar Hosein', 'Letter bounced: take a working e-mail', '868 555 0177'),
             ('3', 'Gail Walker', 'Call-back promised for Wednesday', '868 555 0110'), ('4', 'Ian Francis', 'No answer on Monday: try again', '868 555 0163'),
             ('5', 'Lena Singh', 'Answered: talk it through first', '868 555 0121')]
    rows = ''.join(at(500 + k * 170, 'at l rw yc', extra=f' data-k="r{k}"', inner=f'<span class="ord">{n}</span>{avatar(c, "sm")}<div class="rn"><b>{c}</b><span class="why" style="--at:{ms(tWhy + k * 120)}">{why}</span></div>'
                      f'<span class="tel big" data-k="t{k}" style="--at:{ms(tNum + k * 120)}">{ico("phone")}{num}</span><span class="lb">Log call</span>') for k, (n, c, why, num) in enumerate(calls))
    main = f'<h3>Your calls <small>23 · in your order</small></h3><div class="rws">{rows}</div>'
    cam = [(tWhy - 200, '[data-k=r1]', 1.18), (tNum - 100, '[data-k=t0]', 1.35)]
    cues = [(tO, 'Your own list, in order', False), (tWhy, 'Why to call', False), (tNum, 'The number to tap', True)]
    return stage(side(i, sc, cues), app(i, main, on='mine', cam=cam))

def s_staffcall(i, sc, D):
    """After a try: the outcome, a line for the file, and the call-back that goes to the top of Urgent."""
    tLog, tH, tL, tF, tTop = w(i, 'Log'), w(i, 'happened'), w(i, 'line'), w(i, 'flag'), w(i, 'top')
    lit = f'style="--at:{ms(tH + 300)};--to:{ms(D + 999)}"'
    outs = ''.join((f'<span class="oc lit sel" {lit}>' if x == 'Called' else '<span class="oc">') + x + '</span>' for x in ('Called', 'Met', 'No answer', 'Declined', 'Closed'))
    backs = (f'<div class="bks"><span class="bkx">No call-back</span><span class="bkx flg lit sel" style="--at:{ms(tF + 200)};--to:{ms(D + 999)}">{ico("flag", "ii")} A licensed agent should call</span>'
             f'<span class="bkx">The branch should call</span></div>')
    panel = (f'<div class="drawer" style="--at:{ms(tLog + 100)}"><b>Keisha Thomas · what happened?</b><div class="ocs">{outs}</div>'
             f'<label>A line for the file</label><div class="fld">{typed(tL, "Wants an agent to review her cover.", 34)}</div>'
             f'<label>Call-back</label>{backs}<div class="bbtn prs" style="--at:{ms(tF + 1300)}">Save</div></div>')
    fly = f'<div class="flyer" data-from=".bkx.flg" data-to="[data-k=urgent] b" style="--at:{ms(tTop - 300)}">{ico("flag", "ii")} Keisha Thomas · call-back</div>'
    body = rowlist([('Keisha Thomas', 'Wrote that no one called', 1), ('Omar Hosein', 'Letter bounced: take a working e-mail', 0), ('Gail Walker', 'Call-back promised for Wednesday', 0)], 300, keys=True)
    main = f'<h3>Your calls <small>23</small></h3>{body}'
    extra = (panel + fly + f'<i class="badgeup" data-ctr="[data-k=urgent] b" style="--at:{ms(tTop + 200)}">13</i>' +
             cursor([(200, 600, 380), (tLog - 30, '[data-k=r0] .lb'), (tH + 280, '.drawer .oc.sel'), (tF + 170, '.bkx.flg'), (tF + 1270, '.drawer .bbtn')]) +
             click(tLog, '[data-k=r0] .lb') + click(tH + 300, '.drawer .oc.sel') + click(tF + 200, '.bkx.flg') + click(tF + 1300, '.drawer .bbtn'))
    cues = [(tLog, 'Press Log call', False), (tH, 'What happened, and one line', False), (tF, 'A licensed agent? Flag the call-back', True), (tTop, 'Top of the branch manager&rsquo;s Urgent list', False)]
    return stage(side(i, sc, cues), app(i, main, on='mine', extra=extra))

def s_yourwork(i, sc, D):
    """Your work: today and this week, and every note, newest first."""
    tT, tW, tN, tB = w(i, 'today'), w(i, 'week'), w(i, 'notes'), w(i, 'branch')
    def tally(t, lab, a):
        return at(t, 'at l wt', inner=f'<b>{lab}</b>' + ''.join(f'<span>{cnt(t + 150 + k * 80, n)} {x}</span>' for k, (n, x) in enumerate(a)))
    items = [('14 Oct · Called', 'Keisha Thomas', 'Wants to review her cover. Needs a licensed agent.', 'phone'), ('14 Oct · No answer', 'Ian Francis', 'Rang twice, voicemail.', 'clock'),
             ('14 Oct · Named Andrea Lewis', 'Mohan household', 'The family&rsquo;s agent.', 'user'), ('13 Oct · Called', 'Omar Hosein', 'Took a working e-mail, spelled back.', 'phone')]
    lst = ''.join(at(tN + k * 160, 'at l wl', inner=f'<span class="hdot">{ico(ic)}</span><div><i>{d}</i> · <b>{c}</b>: {n}</div>') for k, (d, c, n, ic) in enumerate(items))
    main = (f'<h3>Your work</h3>{tally(tT, "Today", [(9, "clients"), (4, "reached"), (3, "no answer"), (2, "call-backs flagged"), (1, "agent named")])}'
            f'{tally(tW, "Last 7 days", [(41, "clients"), (19, "reached"), (14, "no answer"), (6, "call-backs flagged"), (5, "agents named")])}'
            f'<h4>What you logged, newest first</h4><div data-k="wlist">{lst}</div><p class="fnote at" style="--at:{ms(tB)}">{ico("eye", "ii")} The branch sees the same under Team.</p>')
    cam = [(tN - 200, '[data-k=wlist]', 1.18)]
    cues = [(tT, 'Today', False), (tW, 'This week', False), (tN, 'Your notes, newest first', False), (tB, 'The branch sees the same', True)]
    return stage(side(i, sc, cues), app(i, main, on='work', cam=cam))

def sfwin(main, extra='', cam=None):
    """A Salesforce task in a browser window: the record, its Chatter, nothing branded."""
    camattr = f' data-cam="{esc([[int(t), s, k] for (t, s, k) in cam])}"' if cam else ''
    return (f'<div class="scr at" style="--at:60ms"><div class="tbar"><span class="lights"><i></i><i></i><i></i></span>'
            f'<div class="ubar">{ico("lock")}<span>Salesforce &rsaquo; Tasks &rsaquo; Keisha Thomas</span></div></div>'
            f'<div class="vp"><div class="cam"{camattr}>{main}{extra}</div></div></div>')

def s_sftask(i, sc, D):
    """The Salesforce task (15 October 2026): every step on its Chatter, a no answer is a try, close with a note, open until the
    agent is named, and the standard e-mail is never the close for a client who asked for something."""
    tCh, tTry, tNote, tNm, tStd = w(i, 'Chatter'), w(i, 'try'), w(i, 'note'), w(i, 'named'), w(i, 'standard')
    tDone = tNm + 1300
    post = lambda who, when, txt, cls='': f'<div class="sfp {cls}">{avatar(who, "sm")}<div><b>{who} <i>· {when}</i></b><span>{txt}</span></div></div>'
    head = (f'<div class="sfh"><span class="sfi">{ico("check")}</span><div class="sft"><small>Task</small>'
            f'<b>Orphan response: call me · Keisha Thomas</b></div>'
            f'<span class="sfst"><span class="sw2"><span class="sa until lbl amb" style="--at:0ms;--to:{ms(tDone)}">Open</span>'
            f'<span class="sb at lbl grn" style="--at:{ms(tDone)}">{ico("check", "ii")}Completed</span></span></span>'
            f'<span class="sfbtn prs" style="--at:{ms(tDone - 250)}">Mark complete<s class="sfno until" style="--at:{ms(tTry)};--to:{ms(tNote)}"></s></span></div>'
            f'<div class="sff"><span>{ico("user", "ii")}Assigned to <b>Client Support</b></span><span>{ico("cal", "ii")}Due <b>16 Oct</b></span>'
            f'<span>{ico("flag", "ii")}Asked for <b>an agent</b></span></div>')
    feed = (f'<div class="sfb"><h5>Chatter</h5>'
            + post('Branch Manager', '14 Oct', 'Call Keisha. She wants an agent to review her cover.', 'brm')
            + at(tCh, 'at l', inner=post('Client Support', '15 Oct, 10:12', 'Tried 868 555 0142. No answer. Trying again at 2 pm.')
                 + at(tTry, 'at pop sftag lbl amb', tag='span', inner='A try, not a close'))
            + at(tNote - 200, 'at l', extra=' data-k="sfnote"', inner=post('Client Support', '15 Oct, 2:05', typed(tNote, 'Spoke to Keisha. Agreed: a licensed agent calls her this week.', 30))
                 + at(tNote + 900, 'at pop sftag lbl grn', tag='span', inner='Who · what was agreed'))
            + at(tNm, 'at l', inner=post('Client Support', '15 Oct, 2:20', 'Named Andrea Lewis on the board. Told Keisha her agent&rsquo;s name.')
                 + at(tNm + 500, 'at pop sftag lbl blu', tag='span', inner='Agent named'))
            + '</div>')
    mail = at(tStd - 250, 'at pop sfml', inner=f'<span class="sfmi">{ico("mail")}</span><div><b>The standard e-mail</b>'
              f'<span>&ldquo;&hellip;you indicated that you currently have no questions or concerns&hellip;&rdquo;</span>'
              + at(tStd + 700, 'at pop lbl red', tag='span', inner='Not a close when the client asked for something') + '</div>'
              f'<s class="strk sfk" style="--at:{ms(tStd + 450)}"></s>')
    extra = (mail + spot(tCh - 100, tTry + 1600, '.sfb .at.l', 4) + spot(tNote - 150, tNm - 300, '[data-k=sfnote]', 4)
             + cursor([(300, 700, 420), (tDone - 280, '.sfbtn')]) + click(tDone - 250, '.sfbtn'))
    cues = [(tCh, 'Every step on the task&rsquo;s Chatter, the same day', False), (tTry, 'A no answer is a try, not a close', False),
            (tNote, 'Close with a note: who, and what was agreed', False), (tNm, 'Asked for an agent? Open until one is named', False),
            (tStd, 'The standard e-mail is not a close', True)]
    return stage(side(i, sc, cues), sfwin(head + feed, extra=extra))

def s_clock(i, sc, D):
    """The clock starts at the naming: days waited, conversations, a meeting."""
    tD, tCv, tF, tM = w(i, 'days'), w(i, 'conversations'), w(i, 'first'), w(i, 'meeting')
    ring = (f'<div class="rng"><svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="52" class="rt0"/>'
            f'<circle cx="60" cy="60" r="52" class="rt1" style="--at:{ms(tD)}"/></svg>'
            f'<div class="rn2">{cnt(tD, 2)}<span>days since<br>the naming</span></div></div>')
    stats = (at(tCv, 'at pop stt', inner=f'<span class="sic">{ico("phone")}</span><div><b>1</b><span>conversation</span><i>Called 13 Oct</i></div>') +
             at(tM, 'at pop stt key', inner=f'<span class="sic">{ico("cal")}</span><div><b>6</b><span>days to a meeting</span><i>Met 18 Oct</i></div>'))
    days = [('Named', 'user', tD), ('Day 1', '', tD + 150), ('Called', 'phone', tCv), ('Day 3', '', tCv + 150), ('Day 4', '', tCv + 300), ('Day 5', '', tCv + 450), ('Met', 'cal', tM)]
    track = '<div class="dtrk"><i class="dln" style="--at:' + ms(tD) + ';--to:' + ms(tM + 300) + '"></i>' + ''.join(
        at(t, 'at pop dnode' + (' hit' if ic else ''), inner=(ico(ic) if ic else '') + f'<span>{lab}</span>') for (lab, ic, t) in days) + '</div>'
    return (f'<div class="center">{at(150, "at up ebw", inner=sc["eyebrow"])}{hx("h2", sc["headline"], 350, "c")}'
            f'<div class="clockrow">{ring}<div class="sts">{stats}</div></div>{track}'
            f'{at(tF, "at up aim", inner=ico("target", "ii") + " The aim: a conversation in the first two days, a meeting soon after.")}</div>')

# ── the workflow film (16 October 2026): the letter, families the records missed, the service record, the claim, the outcomes, the test ──
def win(main, url, title='Client transition board', extra='', cam=None):
    """A browser window with the branch's band and a title of its own."""
    camattr = f' data-cam="{esc([[int(t), s, k] for (t, s, k) in cam])}"' if cam else ''
    return (f'<div class="scr at" style="--at:60ms"><div class="tbar"><span class="lights"><i></i><i></i><i></i></span>'
            f'<div class="ubar">{ico("lock")}<span>{url}</span></div></div>'
            f'<div class="vp"><div class="cam"{camattr}><div class="ab">{mark()}<div class="an"><b>Ricky Rampersad Branch</b><span>{title}</span></div></div>'
            f'<div class="main wmain">{main}</div>{extra}</div></div></div>')

def s_letter(i, sc, D):
    """The letter as the client reads it: the notice, the facts off their record, the one-tap answers, from support@."""
    tL, tN, tR, tT, tS = w(i, 'letter'), w(i, 'notice'), w(i, 'record'), w(i, 'tap'), w(i, 'support')
    head = (f'<div class="lmh"><span class="lmf">{ico("mail", "ii")} <b>Ricky Rampersad Branch</b> &lt;<span class="lms" data-k="from">support@rickyrampersadbranch.com</span>&gt;</span>'
            f'<span class="lmj">Important: your representative has resigned. Your policy has not changed.</span></div>')
    hero = '<div class="lhero"><b>Your policy, looked after</b><span>A note from your branch team</span></div>'
    note = at(tN - 200, 'at l lnot', extra=' data-k="not"', inner='<h5>Important notice</h5><span>Guardian Life of the Caribbean has accepted the resignation of your agent, '
              'effective 21 September 2026. They are no longer authorised to conduct any business on behalf of Guardian Life.</span>')
    facts = [('Paid to', '21 Sep 2026'), ('With us since', '2014'), ('Policies in force', '2'), ('Documents handled', '12')]
    fs = '<div class="lfac" data-k="fac">' + ''.join(at(tR + k * 160, 'at pop lf', inner=f'<small>{a}</small><b>{b}</b>') for k, (a, b) in enumerate(facts)) + '</div>'
    taps = [('Keep looking after my policy', 'key'), ('Call me', ''), ('I want an agent now', '')]
    tp = '<div class="ltap" data-k="taps">' + ''.join(at(tT + k * 180, f'at up lt {c}', inner=x) for k, (x, c) in enumerate(taps)) + '</div>'
    main = f'{head}<div class="lbody">{hero}<p class="ldear">Dear Keisha,</p>{note}{fs}{tp}</div>'
    toast = f'<div class="toast at" style="--at:{ms(tT + 1500)}">{ico("check", "ii")} Answer recorded · the branch reads it</div>'
    extra = (cursor([(tT - 200, 700, 430), (tT + 1050, '.lt.key')]) + click(tT + 1100, '.lt.key') + toast
             + spot(tN, tR - 200, '[data-k=not]', 6) + glow(tS + 100, '[data-k=from]', 4))
    cam = [(tN - 300, '[data-k=not]', 1.18), (tR - 200, '[data-k=fac]', 1.15), (tT - 100, '[data-k=taps]', 1.15), (tS - 300, '[data-k=from]', 1.3)]
    cues = [(tN, 'Guardian Life&rsquo;s notice', False), (tR, 'The facts off their own record', False), (tT, 'Answers with one tap', False),
            (tS, 'From the branch&rsquo;s support address', True)]
    return stage(side(i, sc, cues), win(main, 'Inbox &rsaquo; Ricky Rampersad Branch', 'Your letter', extra=extra, cam=cam))

def s_family(i, sc, D):
    """Possible family on our books: the two side by side, the family's cover and its gaps, one press to link them. No money: staff see it too."""
    tS, tH, tSd, tG, tP = w(i, 'surname'), w(i, 'house'), w(i, 'side'), w(i, 'gaps'), w(i, 'One', shift=250)
    def per(t, name, about, addr, live, cover, c):
        return at(t, 'at pop ffp', inner=f'<div class="ffn">{avatar(name, "sm")}<b>{name}</b></div><span class="ffa">{about}</span>'
                  f'<span class="ffad hseg" style="--at:{ms(tH)}">{addr}</span><span>{live}</span><span class="lbl {c}">{cover}</span>')
    p1 = per(tSd, 'Carla Joseph', '44 · woman · teacher', '12A Mango Road, Arima', 'In force: 2 policies', 'Life cover with us', 'grn')
    p2 = per(tSd + 250, 'Peter Joseph', '46 · man · electrician', '12A Mangoe Road, Arima', 'In force: 1 policy', 'No life cover with us', 'red')
    gaps = [('Peter, 46: no life cover with us', 'red'), ('Carla: life cover, and no critical illness cover', 'amb'), ('A premium due 47 days on one policy', 'amb')]
    gp = ''.join(at(tG + k * 220, 'at l ffg', inner=f'<i class="ffd {c}"></i>{x}') for k, (x, c) in enumerate(gaps))
    btn = (f'<div class="ffb"><span class="ab1 prs" style="--at:{ms(tP)}"><span class="sa until" style="--at:0ms;--to:{ms(tP + 120)}">One household</span>'
           f'<span class="sb at" style="--at:{ms(tP + 120)}">{ico("check", "ii")} Joseph household</span></span><span class="sfbtn">Not family</span></div>')
    box = (f'<div class="ffx" data-k="ffx"><div class="ffh">{at(tS - 300, "at l", tag="b", inner=ico("flag", "ii") + " Possible family on our books")}'
           f'{at(tS, "at l", tag="span", inner="The same surname · the same house, spelt two ways")}</div>'
           f'<div class="ffc">{p1}{p2}</div><div class="ffgs" data-k="gaps"><h5>The family&rsquo;s cover and its gaps</h5>{gp}</div>{btn}</div>')
    main = f'<h3>Carla Joseph <small>Details</small></h3>{box}'
    toast = f'<div class="toast at" style="--at:{ms(tP + 400)}">{ico("check", "ii")} Linked: one household · Joseph household</div>'
    extra = cursor([(tG + 500, 620, 420), (tP - 30, '.ab1')]) + click(tP, '.ab1') + toast + spot(tG, tP - 600, '[data-k=gaps]', 6)
    cam = [(tH - 200, '.ffc', 1.14), (tG - 200, '[data-k=gaps]', 1.2), (tP - 600, None, 1)]
    cues = [(tS, 'The same surname, the same house', False), (tSd, 'The two side by side', False), (tG, 'The family&rsquo;s cover and its gaps', False),
            (tP, 'One press: one household', True)]
    return stage(side(i, sc, cues), app(i, main, on='hh', extra=extra, cam=cam))

def s_record(i, sc, D):
    """The service record on the card: every Salesforce task the branch handled for the client, how fast, what kind."""
    tC, tH, tF, tK = w(i, 'card'), w(i, 'handled'), w(i, 'closed'), w(i, 'kind')
    tiles = [(tH, '23', 'Requests handled', '', 'list', (23, '')), (tH + 250, 'since 2019', 'Our first for them', '', 'cal', None),
             (tF, '1 day', 'Median to close', '', 'clock', (1, ' day')), (tF + 250, '87%', 'Closed by the due date', '', 'check', (87, '%'))]
    tl = ''.join(tile(*x) for x in tiles)
    kinds = [('Premiums and billing', 9), ('Servicing', 7), ('Claims and maturities', 4), ('Applications', 3)]
    kb = ''.join(at(tK + k * 160, 'at l kbr', inner=f'<span>{x}</span><span class="kbb"><i class="gr" style="--at:{ms(tK + 150 + k * 160)};--w:{100 * n / 9:.0f}%"></i></span><b>{n}</b>')
                 for k, (x, n) in enumerate(kinds))
    tw = at(tC, 'at up', inner='<div class="tiles t4">' + tl + '</div>')
    main = (f'<h3>Keisha Thomas <small>History · our service record</small></h3>{tw}'
            f'<h4>By kind of work</h4><div class="kbs" data-k="kinds">{kb}</div>'
            f'<p class="fnote at" style="--at:{ms(tK + 900)}">{ico("eye", "ii")} No money on it: Client Support see it too.</p>')
    extra = spot(tH, tK - 250, '.tiles', 6) + spot(tK, D - 300, '[data-k=kinds]', 6)
    cues = [(tH, 'Every request we handled', False), (tF, 'How fast we closed it', False), (tK, 'What kind of work it was', True)]
    return stage(side(i, sc, cues), app(i, main, on='urgent', menu=False, extra=extra))

def s_claim(i, sc, D):
    """The TT$200 by itself: the questionnaire, the claim to Retention, the 10:00 list, paid and the agent told."""
    tQ, tM, tR, tT, tD, tTo = w(i, 'questionnaire'), w(i, 'hundred'), w(i, 'Retention'), w(i, 'ten'), w(i, 'date'), w(i, 'told')
    steps = [(tQ, 'file', 'Questionnaire in', 'after the naming', ''), (tR, 'mail', 'Claim to Retention', 'the manager and the agent copied', ''),
             (tT, 'clock', '10:00, every working day', 'the unpaid claims go again', ''), (tTo, 'check', 'Paid', 'the agent is told', 'key')]
    row = ''
    for k, (t, ic, b, s, c) in enumerate(steps):
        if k: row += f'<div class="arw" style="--at:{ms(t - 450)}"><i class="ln"></i><i class="pkt"></i><i class="pkt q2"></i></div>'
        row += at(t, f'at pop cms {c}', inner=f'<span class="kic{" spin" if ic == "clock" else ""}">{ico(ic)}</span><b>{b}</b><small>{s}</small>')
    fld = at(tD - 150, 'at up cmd', inner=f'<small>Date Comm Paid</small><span class="fld">{typed(tD, "4 Nov 2026", 70)}</span>')
    return (f'<div class="center">{at(150, "at up ebw", inner=sc["eyebrow"])}{hx("h2", sc["headline"], 350, "c")}'
            f'{at(tM - 200, "at pop cma", inner=cnt(tM, 200, "", "TT$") + "<span>to the agent, for a review after the naming</span>")}'
            f'<div class="cmr">{row}</div>{fld}</div>')

def s_outcomes(i, sc, D):
    """The seven outcomes, each landing on the word that names it."""
    its = sc['items']; ts = [w(i, x['at']) for x in its]
    cards = ''.join(at(t, 'at pop occ' + (' key' if k == len(its) - 1 else ''), inner=f'<span class="ocn">{k + 1}</span><div><b>{x["b"]}</b><small>{x["i"]}</small></div>')
                    for k, (t, x) in enumerate(zip(ts, its)))
    return (f'<div class="center">{at(150, "at up ebw", inner=sc["eyebrow"])}{hx("h2", sc["headline"], 350, "c")}'
            f'<div class="ocg">{cards}</div></div>')

def s_test(i, sc, D):
    """The training page: sign in, read and tick each section, take the test, the result to you and the branch manager."""
    tTr, tSi, tRd, tTk, tTe, tRs = w(i, 'training'), w(i, 'Sign'), w(i, 'Read'), w(i, 'tick'), w(i, 'test'), w(i, 'result')
    tGo, tPk = tSi + 1500, tTe + 450                 # the answer, the submit and the result land in the second after "test"
    tSb = tPk + 700; tShow = tSb + 400
    gate = (f'<div class="gate until" style="--at:0ms;--to:{ms(tRd - 150)}"><div class="gc"><div class="gch"><span class="gl">{ico("lock")}</span><b>Sign in to take the test</b></div>'
            f'<label>Agent number or your name</label><div class="fld f1">{typed(tSi, "A10024", 90)}</div>'
            f'<label>Password</label><div class="fld f2">{typed(tSi + 650, "••••••••", 60)}</div>'
            f'<div class="bbtn prs gob" style="--at:{ms(tGo)}">Sign in {ico("arrow", "ii")}</div><p>The same number and password as the board.</p></div></div>')
    tabs = lambda on: '<div class="ttbs">' + ''.join(f'<span class="ttb{" on" if k == on else ""}">{x}</span>' for k, x in enumerate(('1 · Your workflow', '2 · The test', 'My results'))) + '</div>'
    secs = ['The flow, start to finish', 'The outcomes', 'Three rules on every call', 'The TT$200', 'Your day', 'On every client']
    man = ''.join(at(tRd + k * 140, 'at l tsec', inner=f'<b>{x}</b><span class="tck"><i class="tbx" style="--at:{ms(tTk + k * 230)}">{ico("check")}</i>'
                     f'I have read and understood this section</span>') for k, x in enumerate(secs))
    manual = f'<div class="until" style="--at:{ms(tRd - 150)};--to:{ms(tTe)}">{tabs(0)}<div class="tsecs">{man}</div></div>'
    opts = ''.join(f'<div class="topt{" pick" if k == 1 else ""}"{f" style=--at:{ms(tPk)}" if k == 1 else ""}><b>{x}</b><i class="skl" style="width:{wd}%"></i></div>'
                   for k, (x, wd) in enumerate([('A', 62), ('B', 74), ('C', 55), ('D', 68)]))
    qcard = (f'<div class="tq"><div class="tqh"><span class="qnn">1</span><span>4 marks</span><span class="lbl red">Critical: must be right to pass</span></div>'
             f'<i class="skl" style="width:88%"></i><i class="skl" style="width:64%"></i>{opts}</div>')
    test = f'<div class="until" style="--at:{ms(tTe)};--to:{ms(tShow)}">{tabs(1)}{qcard}<div class="bbtn prs tsub" style="--at:{ms(tSb)}">Submit</div></div>'
    res = (f'<div class="after" style="--at:{ms(tShow)}">{tabs(2)}<div class="tres">{cnt(tShow + 150, 88, "%")}<div><span class="lbl grn">Pass</span>'
           f'<span class="trs">Andrea Lewis · Agent · attempt 1</span><span class="trs">{ico("mail", "ii")} Sent to you, and to the branch manager</span></div></div></div>')
    main = f'{gate}{manual}{test}{res}'
    extra = (cursor([(tSi - 400, 560, 330), (tGo - 30, '.gob'), (tTk + 200, '.tbx'), (tPk - 30, '.topt.pick'), (tSb - 30, '.tsub')])
             + click(tGo, '.gob') + click(tPk, '.topt.pick') + click(tSb, '.tsub'))
    cam = [(tSi - 300, '.gc', 1.2), (tRd - 100, None, 1), (tShow + 200, '.tres', 1.15)]
    cues = [(tTr, 'The training page', False), (tRd, 'Read the workflow for your role', False), (tTe, 'Then the test', False),
            (tRs, 'Your result: to you and the branch manager', True)]
    return stage(side(i, sc, cues), win(main, f'rickyrampersadbranch.com/orphan-transition/training', 'Your workflow, and the test', extra=extra, cam=cam))

R = {'sftask': s_sftask, 'since': s_since, 'reassign': s_reassign, 'unit': s_unit, 'yourcalls': s_yourcalls, 'staffcall': s_staffcall, 'rules': s_counts,
     'yourwork': s_yourwork, 'clock': s_clock, 'title': s_title, 'flow': s_flow, 'signin': s_signin, 'urgent': s_urgent, 'agents': s_agents, 'table': s_table, 'batches': s_batches,
     'assign': s_assign, 'named': s_named, 'list': s_list, 'client': s_client, 'logcall': s_logcall, 'comment': s_comment, 'counts': s_counts,
     'sees': s_sees, 'close': s_close, 'letter': s_letter, 'family': s_family, 'record': s_record, 'claim': s_claim, 'outcomes': s_outcomes, 'test': s_test}
BLUE = {'title', 'flow', 'named', 'counts', 'rules', 'clock', 'close', 'claim', 'outcomes'}

def bgfx(i, blue):
    if blue:
        motes = ''.join(f'<i class="mote" style="left:{(k * 37 + 11) % 100}%;width:{3 + k % 4}px;height:{3 + k % 4}px;animation-duration:{8 + (k * 3) % 7}s;'
                        f'animation-delay:-{(k * 1.7) % 9:.1f}s"></i>' for k in range(24))
        return f'<div class="bgfx"><div class="rays"></div><div class="aur"></div><div class="rings"><i></i><i></i><i></i></div>{motes}</div>'
    return '<div class="bgfx"><div class="dotg"></div><div class="aur"></div><div class="blob"></div><div class="blob b2"></div><div class="orbit"></div><div class="topband"><i></i></div></div>'

html = []
for i, sc in enumerate(LINES):
    v = sc['visual']; D = DUR[i]; blue = v in BLUE
    ROLE = sc.get('role', SCRIPT['role'])            # a scene may show another sign-in's board (the workflow film shows Client Support's calls)
    body = R[v](i, sc, D)
    html.append(f'<!-- {i + 1} · {v} -->\n<section class="scene bf{" blue" if blue else ""}" data-d="{D}" style="--D:{D}ms">'
                f'<div class="wv">{bgfx(i, blue)}<div class="inner">{body}</div></div><i class="wband"></i></section>')
SCENES = '\n'.join(html)
# every number that counts up is a punch in the sound, and every chapter scene opens on a sub impact (sfx.py)
_starts = [sum(DUR[:k]) / 1000 for k in range(len(DUR))]
HITS = []
for k, sec in enumerate(html):
    for m in re.finditer(r'class="cnt"[^>]*data-at="(\d+)"', sec):
        t = round(_starts[k] + int(m.group(1)) / 1000 + 0.1, 2)
        if all(abs(t - h) > 0.3 for h in HITS): HITS.append(t)
_fj = HERE / 'films.json'; _F = json.load(open(_fj))
if KEY in _F:
    _F[KEY]['dark'] = [k for k, sc in enumerate(LINES) if sc['visual'] in BLUE and k > 0]
    _F[KEY]['hits'] = sorted(HITS)
    json.dump(_F, open(_fj, 'w'), indent=1)

CSS = r"""
/* ══ the board films · midnight blue (build-boardfilm.py, 15 October 2026) ══════════════════ */
@font-face{font-family:'IBM Plex Sans';font-style:normal;font-weight:100 700;font-display:block;src:url(data:font/woff2;base64,__PLEX__) format('woff2')}
:root{--head:'IBM Plex Sans',system-ui,sans-serif;--body:'IBM Plex Sans',system-ui,sans-serif;
  --blue:#1D5BC4;--blue2:#13408F;--blue3:#2A6DE0;--sky:#E3ECFB;--ground:#070F26;--ink:#0E1B2E;--slate:#24324A;--mute:#5B6B82;--rule:#DCE3ED;
  --amb:#93370D;--ambbg:#FEF0C7;--red:#B42318;--redbg:#FDE8E7;--grn:#067647;--grnbg:#DCFAE6;--cyan:#00E5FF;--lav:#BFD3F7}
body{background:var(--ground)}
#o1,#o2,#o3{display:none}
.vig{box-shadow:inset 0 0 180px 20px rgba(0,0,0,.45)} .grain{opacity:.035}
.mk{display:block;width:28px;height:28px;flex:none;background:url(data:image/png;base64,__LOGO__) center/contain no-repeat}
#chrome .mark{width:30px;height:30px}
#chrome .who{color:#fff} #chrome .who i{color:#BFD3F7}
#bars i{background:rgba(255,255,255,.18)} #bars i::after{background:var(--cyan);box-shadow:0 0 10px rgba(0,229,255,.8)} #bars i.done::after{background:rgba(0,229,255,.6);box-shadow:none}
#poster{background:radial-gradient(900px 600px at 80% -10%,rgba(0,229,255,.22),transparent 60%),linear-gradient(158deg,#1D5BC4,#0D2F6E 45%,#070F26)} #poster h1{color:#fff} #poster h1 em{color:var(--cyan)}
#poster .eyebrow{color:var(--lav)} #poster .hint{color:var(--lav)} #poster .biglogo{width:96px;height:96px;margin:0 auto}
#playBtn{background:#fff;color:var(--blue2);box-shadow:0 18px 44px rgba(0,0,0,.5),0 0 40px rgba(47,111,232,.5)} #playBtn .tri{border-left-color:var(--blue2)}
.ico{width:1em;height:1em;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;display:block;flex:none}
.ico.ii{display:inline-block;vertical-align:-.16em;margin-right:4px}

/* the scene: no fade of its own. It zooms through: the new scene opens a little larger, bright and soft, and sharpens as
   it settles, while the scene it replaces pulls away and dims behind it (the page script marks it `out` for the hand-over);
   a streak of light crosses the cut */
.scene.bf{padding:0;background:none;transform:none;transition:opacity 0s .62s,visibility 0s .62s}
.scene.bf.on{transition:none;z-index:2}
.scene.bf.out{animation:bfZoomOut .62s cubic-bezier(.5,0,.8,.4) forwards;z-index:1}
@keyframes bfZoomOut{to{transform:scale(1.16);opacity:0;filter:blur(8px) brightness(.6)}}
.bf .wv{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:62px 28px 112px;overflow:hidden;background:var(--ground)}
.bf.blue .wv{background:radial-gradient(1100px 640px at 82% -12%,rgba(0,229,255,.22),transparent 60%),radial-gradient(700px 500px at 10% 110%,rgba(47,111,232,.38),transparent 60%),linear-gradient(158deg,#1D5BC4 0%,#0D2F6E 45%,#070F26 100%)}
.scene.act .wv{animation:bfZoomIn .72s cubic-bezier(.2,.9,.25,1) both}
@keyframes bfZoomIn{0%{transform:scale(1.12);opacity:0;filter:brightness(1.8) blur(7px)}55%{opacity:1;filter:brightness(1.08) blur(0)}100%{transform:none;opacity:1;filter:none}}
.bf .wband{position:absolute;top:-20%;bottom:-20%;left:-30%;width:26%;z-index:20;pointer-events:none;opacity:0;transform:skewX(-14deg);mix-blend-mode:screen;
  background:linear-gradient(90deg,rgba(255,255,255,0) 0,rgba(0,229,255,.55) 40%,rgba(255,255,255,.95) 50%,rgba(47,111,232,.6) 60%,rgba(255,255,255,0) 100%)}
.scene.act .wband{animation:bfStreak .72s cubic-bezier(.3,0,.2,1) both}
@keyframes bfStreak{0%{left:-30%;opacity:0}10%{opacity:1}90%{opacity:1}100%{left:110%;opacity:0}}
.scene.bf .inner{max-width:none;width:1224px;text-align:left;zoom:var(--k,1);position:relative}

/* what moves behind: an aurora that drifts, a grid, soft light, an orbit; on the chapter scenes, rings, rays and motes */
.bf .bgfx{position:absolute;inset:0;pointer-events:none;overflow:hidden}
.bf .topband{position:absolute;left:0;right:0;top:0;height:56px;background:linear-gradient(90deg,#0D2F6E,#13408F 62%,#1D5BC4);box-shadow:0 6px 30px rgba(47,111,232,.4);overflow:hidden}
.bf .aur{position:absolute;left:-10%;right:-10%;top:28%;height:62%;background:linear-gradient(100deg,rgba(47,111,232,0) 18%,rgba(47,111,232,.22) 42%,rgba(0,229,255,.16) 58%,rgba(47,111,232,0) 82%);filter:blur(42px);transform:rotate(-8deg)}
.scene.act .aur{animation:bfAur 14s ease-in-out infinite alternate} @keyframes bfAur{to{transform:rotate(-3deg) translateX(-140px) scaleY(1.15)}}
.bf .topband::after{content:'';position:absolute;inset:0;background:linear-gradient(105deg,transparent 40%,rgba(255,255,255,.2) 48%,transparent 56%);background-size:300% 100%}
.scene.act .topband::after{animation:bfSheen 7s linear infinite}
@keyframes bfSheen{from{background-position:100% 0}to{background-position:-100% 0}}
.bf .topband i{position:absolute;left:0;right:0;bottom:0;height:3px;background:linear-gradient(90deg,var(--cyan),rgba(0,229,255,0) 70%)}
.bf .dotg{position:absolute;inset:56px 0 0 0;background-image:radial-gradient(rgba(47,111,232,.3) 1.3px,transparent 1.5px);background-size:24px 24px}
.scene.act .dotg{animation:bfGrid 20s linear infinite} @keyframes bfGrid{to{background-position:48px 24px}}
.bf .blob{position:absolute;width:760px;height:760px;border-radius:50%;right:-180px;top:-120px;background:radial-gradient(circle,rgba(47,111,232,.34),rgba(47,111,232,0) 66%)}
.bf .blob.b2{left:-260px;top:auto;bottom:-360px;right:auto;width:640px;height:640px;background:radial-gradient(circle,rgba(0,229,255,.22),transparent 66%)}
.scene.act .blob{animation:bfBlob 16s ease-in-out infinite alternate} .scene.act .blob.b2{animation-duration:21s}
@keyframes bfBlob{to{transform:translate(-200px,110px) scale(1.15)}}
.bf .orbit{position:absolute;right:40px;bottom:90px;width:380px;height:380px;border-radius:50%;border:1.5px dashed rgba(47,111,232,.4)}
.bf .orbit::after{content:'';position:absolute;left:50%;top:-6px;width:12px;height:12px;border-radius:50%;background:var(--cyan);opacity:.9;box-shadow:0 0 14px var(--cyan)}
.scene.act .orbit{animation:bfSpin 50s linear infinite} @keyframes bfSpin{to{transform:rotate(360deg)}}
.bf .rays{position:absolute;inset:-20%;background:repeating-linear-gradient(115deg,rgba(255,255,255,.05) 0 60px,transparent 60px 170px)}
.scene.act .rays{animation:bfRays 24s linear infinite} @keyframes bfRays{to{transform:translateX(170px)}}
.bf .rings i{position:absolute;left:50%;top:46%;width:520px;height:520px;margin:-260px 0 0 -260px;border-radius:50%;border:1.5px solid rgba(0,229,255,.4);opacity:0;box-shadow:0 0 24px rgba(0,229,255,.25)}
.scene.act .rings i{animation:bfRing 7.5s linear infinite} .scene.act .rings i:nth-child(2){animation-delay:2.5s} .scene.act .rings i:nth-child(3){animation-delay:5s}
@keyframes bfRing{0%{transform:scale(.45);opacity:0}15%{opacity:1}100%{transform:scale(1.9);opacity:0}}
.bf .mote{position:absolute;bottom:-12px;border-radius:50%;background:rgba(255,255,255,.55);opacity:0}
.scene.act .mote{animation-name:bfMote;animation-timing-function:linear;animation-iteration-count:infinite}
@keyframes bfMote{0%{transform:translateY(0);opacity:0}15%{opacity:.85}100%{transform:translateY(-760px);opacity:0}}

/* things that arrive on a word */
.bf .at{opacity:0}
.scene.act .at{animation:bfIn .55s cubic-bezier(.2,.9,.3,1) var(--at) both}
.scene.act .at.l{animation-name:bfInL} .scene.act .at.pop{animation-name:bfPop} .scene.act .at.up{animation-name:bfInU}
@keyframes bfIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
@keyframes bfInL{from{opacity:0;transform:translateX(-18px)}to{opacity:1;transform:none}}
@keyframes bfInU{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}
@keyframes bfPop{0%{opacity:0;transform:scale(.7)}70%{opacity:1;transform:scale(1.06)}100%{opacity:1;transform:none}}
.bf .until{opacity:0}
.scene.act .until{animation:bfIn .5s var(--at) both,bfOut .35s var(--to) forwards}
@keyframes bfOut{to{opacity:0;transform:scale(.98);visibility:hidden}}
.bf .after{opacity:0} .scene.act .after{animation:bfIn .55s var(--at) both}
.scene.act .prs{animation:bfPress .32s var(--at) both}
@keyframes bfPress{40%{transform:scale(.92);filter:brightness(1.18)}100%{transform:none}}
.bf .tyy{display:inline-block;white-space:nowrap;clip-path:inset(0 100% 0 0)}
.scene.act .tyy{animation:bfType var(--dur) steps(var(--n)) var(--at) forwards}
@keyframes bfType{to{clip-path:inset(0 0 0 0)}}
.bf .gr{display:block;height:100%;width:0}
.scene.act .gr{animation:bfGrow .9s cubic-bezier(.3,.8,.3,1) var(--at) both}
@keyframes bfGrow{from{width:0}to{width:var(--w)}}
@keyframes bfDraw{to{transform:scaleX(1)}}

/* the page script positions these when the scene opens */
.bf .rip{position:absolute;width:46px;height:46px;margin:-23px 0 0 -23px;border-radius:50%;border:3px solid var(--blue3);opacity:0;pointer-events:none;z-index:11}
.scene.act .rip{animation:bfRip .65s var(--at) ease-out}
@keyframes bfRip{0%{opacity:.95;transform:scale(.3)}100%{opacity:0;transform:scale(1.6)}}
.bf .cur{position:absolute;left:0;top:0;width:26px;height:26px;z-index:12;pointer-events:none;opacity:0;filter:drop-shadow(0 3px 6px rgba(14,27,46,.4))}
.bf .cur svg{width:26px;height:26px;display:block}
.bf .cur.touch{width:32px;height:32px;margin:-16px 0 0 -16px;border-radius:50%;background:rgba(255,255,255,.6);border:2px solid #fff;box-shadow:0 0 0 7px rgba(47,111,232,.22),0 4px 12px rgba(14,27,46,.3)}
.bf .spot{position:absolute;border-radius:11px;opacity:0;z-index:7;pointer-events:none;box-shadow:0 0 0 2px rgba(47,111,232,.9),0 0 0 9999px rgba(14,27,46,.36),0 0 30px 6px rgba(47,111,232,.35)}
.scene.act .spot{animation:bfIn .45s var(--at) both,bfOut .45s var(--to) forwards}
.bf .glw{position:absolute;border-radius:9px;border:2px solid var(--blue3);opacity:0;z-index:9;pointer-events:none}
.scene.act .glw{animation:bfGlow 1.8s var(--at) ease-in-out}
@keyframes bfGlow{0%,100%{opacity:0}20%,80%{opacity:1;box-shadow:0 0 0 5px rgba(0,229,255,.18),0 0 22px rgba(0,229,255,.5)}}
.bf .colhl{position:absolute;border-radius:8px;background:rgba(47,111,232,.08);border:1.5px solid rgba(47,111,232,.45);opacity:0;z-index:2;pointer-events:none}
.scene.act .colhl{animation:bfIn .4s var(--at) both,bfOut .4s calc(var(--at) + 1.7s) forwards}

/* the left column */
.bf .bstage{display:grid;grid-template-columns:318px 862px;gap:34px;align-items:center;height:540px;width:1224px}
.bf .rt{display:flex;justify-content:center;align-items:center;perspective:1400px}
.scene.act .flt{animation:bfTilt var(--D) ease-in-out both}
@keyframes bfTilt{0%{transform:rotateY(-8deg) rotateX(3deg) translateY(8px)}50%{transform:rotateY(1deg) rotateX(-.5deg) translateY(-7px)}100%{transform:rotateY(6deg) rotateX(-2.5deg) translateY(4px)}}
.bf .sd{--ink:#fff;--slate:#DCE6F7;--mute:#9FB3D9}
.bf .chap{display:flex;align-items:baseline;gap:8px;margin-bottom:4px;opacity:0}
.bf .chap b{font:700 56px/1 var(--head);color:transparent;-webkit-text-stroke:1.6px rgba(143,180,255,.8);letter-spacing:-.02em}
.bf .chap span{font:600 12px var(--body);color:var(--mute);letter-spacing:.14em;text-transform:uppercase}
.scene.act .chap{animation:bfInL .6s .12s cubic-bezier(.2,.9,.3,1) both}
.bf .eb{display:flex;align-items:center;gap:10px;font:600 12.5px var(--body);letter-spacing:.16em;text-transform:uppercase;color:var(--blue);margin-bottom:12px;opacity:0}
.bf .eb::before{content:'';width:26px;height:3px;border-radius:2px;background:var(--blue);transform-origin:left;transform:scaleX(0)}
.scene.act .eb{animation:bfIn .5s .2s both} .scene.act .eb::before{animation:bfDraw .5s .35s forwards}
.bf .hx{margin:0}
.bf .hl{font:700 38px/1.1 var(--head);letter-spacing:-.02em;color:#fff;text-shadow:0 2px 28px rgba(47,111,232,.45)}
.bf .wd{display:inline-block;opacity:0}
.scene.act .wd{animation:bfWord .68s cubic-bezier(.2,1.02,.3,1) calc(var(--d0) + var(--i) * 75ms) both}
@keyframes bfWord{0%{opacity:0;transform:translateY(.5em) scale(1.32);filter:blur(5px)}60%{opacity:1;filter:blur(0)}100%{opacity:1;transform:none;filter:none}}
.bf .hx em{font-style:normal;color:#8FB4FF;background:linear-gradient(rgba(47,111,232,.45),rgba(47,111,232,.45)) no-repeat 0 92%/0% .3em}
.scene.act .hx em{animation:bfUnder .7s ease var(--emat) forwards}
@keyframes bfUnder{to{background-size:100% .3em}}
.bf.blue .hx em{color:#fff;background-image:linear-gradient(rgba(0,229,255,.7),rgba(0,229,255,.7))}
.bf .cues{margin-top:24px;display:grid;gap:9px}
.bf .cue{display:flex;gap:11px;align-items:center;background:#fff;border-radius:11px;padding:9px 13px 9px 9px;overflow-wrap:anywhere;
  box-shadow:0 1px 2px rgba(0,0,0,.3),0 10px 28px rgba(0,0,0,.45);font:600 15px/1.3 var(--body);color:#24324A;--ink:#0E1B2E;--slate:#24324A;--mute:#5B6B82}
.bf .cue .cn{flex:none;width:27px;height:27px;border-radius:50%;background:var(--sky);color:var(--blue);display:grid;place-items:center;font:700 13px var(--head)}
.bf .cue .cn .ico{width:15px;height:15px}
.bf .cue .tik path{stroke-dasharray:24;stroke-dashoffset:24}
.scene.act .cue .tik path{animation:bfTick .45s calc(var(--at) + .25s) forwards} @keyframes bfTick{to{stroke-dashoffset:0}}
.bf .cue.key{background:linear-gradient(135deg,#1D5BC4,#13408F);color:#fff;box-shadow:0 12px 32px rgba(47,111,232,.55),0 0 0 1px rgba(0,229,255,.55)}
.bf .cue.key .cn{background:#fff;color:var(--blue)}
.scene.act .cue.key .cn{animation:bfPing 1.6s calc(var(--at) + .4s) ease-out 2}
@keyframes bfPing{0%{box-shadow:0 0 0 0 rgba(255,255,255,.7)}100%{box-shadow:0 0 0 14px rgba(255,255,255,0)}}

/* the browser window, and the board in it */
.bf .scr{position:relative;width:862px;height:520px;border-radius:12px;background:#fff;overflow:hidden;color:var(--ink);font-family:var(--body);
  box-shadow:0 0 0 1px rgba(47,111,232,.6),0 30px 80px rgba(0,0,0,.6),0 0 60px rgba(47,111,232,.38)}
.bf .scr::after,.bf .phn::after{content:'';position:absolute;inset:0;z-index:30;pointer-events:none;border-radius:inherit;mix-blend-mode:screen;
  background:linear-gradient(115deg,transparent 38%,rgba(255,255,255,.22) 46%,rgba(0,229,255,.18) 50%,transparent 58%);background-size:260% 100%;background-position:120% 0}
.scene.act .scr::after,.scene.act .phn::after{animation:bfGlare 6s cubic-bezier(.4,0,.2,1) .25s infinite}
@keyframes bfGlare{0%{background-position:120% 0}30%{background-position:-60% 0}100%{background-position:-60% 0}}
.bf .tbar{height:32px;background:linear-gradient(180deg,#F3F6FA,#E6EBF2);border-bottom:1px solid #D7DFEA;display:flex;align-items:center;gap:12px;padding:0 12px}
.bf .lights{display:flex;gap:6px} .bf .lights i{width:10px;height:10px;border-radius:50%;background:#FF5F57} .bf .lights i:nth-child(2){background:#FEBC2E} .bf .lights i:nth-child(3){background:#28C840}
.bf .ubar{flex:1;display:flex;align-items:center;gap:7px;background:#fff;border:1px solid #D7DFEA;border-radius:7px;color:#334155;font:500 12.5px var(--body);padding:4px 10px;white-space:nowrap;overflow:hidden}
.bf .ubar .ico{width:12px;height:12px;color:var(--grn)}
.bf .vp{position:absolute;left:0;right:0;top:32px;bottom:0;overflow:hidden}
.bf .cam{position:absolute;inset:0;transform-origin:0 0;background:#F4F7FB}
.bf .ab{height:46px;background:linear-gradient(90deg,#0D2F6E,#13408F 70%,#1D5BC4);display:flex;align-items:center;gap:10px;padding:0 14px}
.bf .an b{display:block;color:#fff;font:700 13.5px var(--head)} .bf .an span{display:block;color:#BFD3F7;font:500 11px var(--body)}
.bf .abr{margin-left:auto;display:flex;gap:7px} .bf .abr span{color:#fff;border:1px solid rgba(255,255,255,.38);border-radius:7px;padding:4px 10px;font:600 11.5px var(--body)}
.bf .bd{display:grid;grid-template-columns:172px 1fr;height:calc(100% - 46px)} .bf .bd.nomenu{grid-template-columns:1fr}
.bf .side{background:#fff;border-right:1px solid #E1E7F0;padding:12px 10px}
.bf .me{display:flex;gap:8px;align-items:center;padding-bottom:10px;border-bottom:1px solid #E1E7F0;margin-bottom:8px}
.bf .me>i{width:28px;height:28px;border-radius:50%;background:var(--blue);color:#fff;display:grid;place-items:center;font:700 12px var(--head);font-style:normal}
.bf .me b{display:block;font:600 12px var(--head);color:var(--ink)} .bf .me span{display:block;font-size:10.5px;color:var(--mute)}
.bf .grp{font:600 9.5px var(--body);letter-spacing:.12em;text-transform:uppercase;color:#94a3b8;margin:6px 6px}
.bf .mi{display:flex;justify-content:space-between;align-items:center;padding:7px 9px;border-radius:8px;font:600 12.5px var(--body);color:#334155;margin:2px 0}
.bf .mi b{background:var(--sky);border-radius:999px;padding:0 7px;font-size:11px;color:var(--blue2)}
.bf .mi.on{background:var(--blue);color:#fff} .bf .mi.on b{background:#fff;color:var(--blue2)}
.scene.act .mi.off-at{animation:bfOff .3s var(--at) forwards} .bf .mi.on-at{background:transparent;color:#334155}
.scene.act .mi.on-at{animation:bfOn .3s var(--at) forwards}
@keyframes bfOff{to{background:transparent;color:#334155}} @keyframes bfOn{to{background:#1D5BC4;color:#fff}}
.bf .main{padding:14px 18px;overflow:hidden;position:relative}
.bf .main h3{font:700 18px var(--head);margin:0 0 10px;color:var(--ink)} .bf .main h3 small{font:500 12.5px var(--body);color:var(--mute);margin-left:6px}
.bf .main h4{font:600 13px var(--head);margin:12px 0 6px;color:var(--ink)}
.bf .main>.after{position:absolute;inset:14px 18px}
.bf .av{flex:none;width:30px;height:30px;border-radius:50%;display:inline-grid;place-items:center;color:#fff;font:700 11.5px var(--head);letter-spacing:.02em;box-shadow:0 0 0 2px #fff}
.bf .av.sm{width:22px;height:22px;font-size:9px;margin-right:7px;vertical-align:middle}
.bf .av.lg{width:46px;height:46px;font-size:16px;box-shadow:0 0 0 3px rgba(255,255,255,.85)}
.bf .lbl{display:inline-block;border-radius:6px;padding:1px 8px;font:600 11.5px var(--body);white-space:nowrap}
.bf .lbl.amb{background:var(--ambbg);color:var(--amb)} .bf .lbl.red{background:var(--redbg);color:var(--red)} .bf .lbl.grn{background:var(--grnbg);color:var(--grn)}
.bf .lbl.blu{background:var(--sky);color:var(--blue2)} .bf .lbl.gry{background:#EEF1F5;color:var(--mute)}
.bf .gh{margin:8px 0 4px} .bf .gh b{display:flex;align-items:center;font:700 13px var(--head);color:var(--amb)} .bf .gh span{display:block;font-size:11.5px;color:var(--mute)}
.bf .rw{display:flex;align-items:center;gap:10px;background:#fff;border:1px solid #E1E7F0;border-radius:10px;padding:7px 11px;margin:5px 0;box-shadow:0 1px 2px rgba(19,64,143,.05)}
.bf .rw .rn{flex:1;min-width:0} .bf .rw .rn b{display:block;font:600 13.5px var(--head);color:var(--ink)} .bf .rw .rs{display:block;font-size:11.5px;color:#475569}
.bf .tel{display:inline-flex;align-items:center;gap:5px;color:var(--blue);font:600 12px var(--body);border:1px solid #C9D8F3;border-radius:7px;padding:3px 8px;white-space:nowrap}
.bf .tel .ico{width:13px;height:13px}
.bf .lb{background:var(--blue);color:#fff;font:600 11.5px var(--body);border-radius:7px;padding:4px 9px;white-space:nowrap}

/* sign in */
.bf .gate{display:grid;place-items:center;height:100%}
.bf .gc{width:390px;background:#fff;border:1px solid #E1E7F0;border-radius:14px;padding:20px 22px;box-shadow:0 14px 34px rgba(19,64,143,.12)}
.bf .gch{display:flex;align-items:center;gap:10px;margin-bottom:6px} .bf .gch b{font:700 17px var(--head)}
.bf .gl{width:34px;height:34px;border-radius:10px;background:var(--sky);color:var(--blue);display:grid;place-items:center} .bf .gl .ico{width:18px;height:18px}
.bf label{display:block;font:500 11.5px var(--body);color:var(--mute);margin:9px 0 4px}
.bf .fld{border:1.5px solid #CBD5E1;border-radius:9px;padding:8px 11px;min-height:36px;font:500 14px var(--body);color:var(--ink);background:#fff}
.bf .bbtn{display:inline-flex;align-items:center;gap:6px;margin-top:12px;background:var(--blue);color:#fff;font:600 13px var(--head);border-radius:9px;padding:9px 16px}
.bf .gc p{font-size:11px;color:var(--mute);margin:10px 0 0}

/* the Agents tab */
.bf .heroa{display:flex;gap:16px;align-items:center}
.bf .donut{position:relative;width:96px;height:96px;flex:none}
.bf .donut svg{width:96px;height:96px;transform:rotate(-90deg)}
.bf .dk0{fill:none;stroke:var(--sky);stroke-width:12} .bf .dk1{fill:none;stroke:var(--blue);stroke-width:12;stroke-linecap:round;stroke-dasharray:314;stroke-dashoffset:314}
.scene.act .dk1{animation:bfDash 1.4s cubic-bezier(.3,.8,.3,1) var(--at) forwards} @keyframes bfDash{to{stroke-dashoffset:var(--off)}}
.bf .donut .cnt{position:absolute;inset:0;display:grid;place-items:center;font:700 23px var(--head);color:var(--ink)}
.bf .htx>b{display:block;font:700 17px var(--head);color:var(--ink);margin-bottom:2px} .bf .htx span{font-size:13px;color:#334155;line-height:1.4} .bf .htx span b{color:var(--ink)}
.bf .stk{display:flex;gap:2px;height:12px;background:#E3EAEF;border-radius:6px;overflow:hidden;margin:12px 0 6px}
.bf .lgd{display:flex;gap:12px;margin:0 0 10px;flex-wrap:wrap} .bf .lg{font:500 11.5px var(--body);color:#334155;display:flex;gap:5px;align-items:center}
.bf .lg i{width:10px;height:10px;border-radius:3px;display:inline-block}
.bf .tiles{display:grid;grid-template-columns:repeat(3,1fr);gap:9px}
.bf .tile{position:relative;background:#fff;border:1px solid #E1E7F0;border-radius:11px;padding:9px 11px;box-shadow:0 1px 2px rgba(19,64,143,.05)}
.bf .tile .tic{position:absolute;right:9px;top:9px;width:24px;height:24px;border-radius:7px;background:var(--sky);color:var(--blue);display:grid;place-items:center}
.bf .tile .tic .ico{width:14px;height:14px}
.bf .tile b{display:block;font:700 22px var(--head);color:var(--ink)} .bf .tile .tlb{font-size:12px;color:#334155}
.bf .tile.amb{background:#FFFBEB;border-color:#FDE7A9} .bf .tile.amb b{color:var(--amb)} .bf .tile.amb .tic{background:var(--ambbg);color:var(--amb)}
.bf .tile.red{background:#FEF3F2;border-color:#F3C7C2} .bf .tile.red b{color:var(--red)} .bf .tile.red .tic{background:var(--redbg);color:var(--red)}
.bf .tiles.t5{grid-template-columns:repeat(5,1fr)} .bf .tiles.t5 .tile b{font-size:19px}
.bf .tbl{position:relative;background:#fff;border:1px solid #E1E7F0;border-radius:10px;padding:4px 12px}
.bf .th,.bf .tr{display:grid;grid-template-columns:1.5fr .8fr .6fr 1.3fr .8fr 1.1fr .9fr;gap:8px;align-items:center;padding:9px 0;border-bottom:1px solid #EDF1F5;font-size:13px;position:relative;z-index:3}
.bf .th{font:500 11px var(--body);color:var(--mute)} .bf .tr .nm{font:600 13px var(--head);color:var(--ink);display:flex;align-items:center;white-space:nowrap}
.bf .pb{display:flex;gap:1px;height:10px;background:#E3EAEF;border-radius:5px;overflow:hidden;width:110px}
.bf .tr .nl{font-weight:600;color:#334155;border-radius:6px;padding:2px 6px;justify-self:start}
.scene.act .red-at{animation:bfRed .8s var(--at) forwards}
@keyframes bfRed{0%{background:transparent}40%{background:#B42318;color:#fff;transform:scale(1.12)}100%{background:#FDE8E7;color:#B42318;transform:none}}
.bf .tr.big{background:#F0F5FF;border-left:3px solid var(--blue);padding-left:8px;font-size:14px}
.bf .tr.dim{opacity:.55}
.bf .sw2,.bf .nl{position:relative;display:inline-grid}
.bf .sw2>span,.bf .nl>span{grid-area:1/1}
.bf .red0{background:var(--redbg);color:var(--red)}
.scene.act .clr{animation:bfClear .6s var(--at) forwards} @keyframes bfClear{to{background:#E6F6F9;color:#07606f}}
.bf .th.c8,.bf .tr.c8{grid-template-columns:1.45fr .5fr 1.1fr .9fr .75fr .85fr 1fr .8fr}
.bf .th.c5,.bf .tr.c5{grid-template-columns:1.4fr .6fr 1.4fr .9fr .8fr}
.bf .th.c6,.bf .tr.c6{grid-template-columns:1.4fr .6fr 1.3fr .9fr .9fr .9fr}
.bf .num{font-weight:600;color:var(--ink)} .bf .warn{color:var(--red);font-weight:700} .bf .bad{color:var(--red);font-weight:700}
.bf .hlrow{border-radius:6px;padding:2px 6px;margin-left:-6px}
.scene.act .hlrow{animation:bfHl .5s var(--at) forwards} @keyframes bfHl{to{background:rgba(47,111,232,.14);box-shadow:0 0 0 2px rgba(47,111,232,.5)}}

/* households */
.bf .chps{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px}
.bf .chp{border:1px solid #E1E7F0;background:#fff;border-radius:999px;padding:5px 11px;font:600 12px var(--body);color:#334155}
.bf .chp b{color:var(--ink)}
.scene.act .chp.hl{animation:bfChip .35s var(--at) forwards,bfUnchip .35s var(--to) forwards}
@keyframes bfChip{to{background:#1D5BC4;color:#fff;border-color:#1D5BC4}} @keyframes bfUnchip{to{background:#fff;color:#334155;border-color:#E1E7F0}}
.bf .cardsw{position:relative;height:330px} .bf .crds{position:absolute;inset:0;display:grid;gap:8px;align-content:start}
.bf .hc{display:flex;align-items:center;gap:12px;background:#fff;border:1px solid #E1E7F0;border-left:4px solid var(--blue);border-radius:10px;padding:10px 13px;box-shadow:0 1px 3px rgba(19,64,143,.06)}
.bf .hci{width:34px;height:34px;border-radius:10px;background:var(--sky);color:var(--blue);display:grid;place-items:center;flex:none} .bf .hci .ico{width:18px;height:18px}
.bf .hct{flex:1;min-width:0;display:grid;gap:3px;justify-items:start} .bf .hct b{font:700 14px var(--head)}
.bf .dots{display:flex;gap:4px} .bf .dots i{width:9px;height:9px;border-radius:50%;background:#D6DEE9} .bf .dots i.on{background:var(--grn)}
.bf .sg{text-align:right;font-size:11.5px;color:var(--mute)} .bf .sg small{display:block;font-size:10.5px;letter-spacing:.06em;text-transform:uppercase}
.bf .sg b{display:flex;align-items:center;font:600 13px var(--head);color:var(--ink)}
.bf .hcard{background:#fff;border:1px solid #E1E7F0;border-left:4px solid var(--blue);border-radius:12px;padding:12px 15px;box-shadow:0 4px 14px rgba(19,64,143,.07)}
.bf .hh{display:flex;gap:10px;align-items:center;margin-bottom:6px} .bf .hh b{display:block;font:700 16px var(--head)} .bf .hh span{display:block;font-size:12px;color:var(--mute)}
.bf .hm{display:grid;grid-template-columns:24px 110px 1fr auto;gap:8px;align-items:center;padding:6px 0;border-top:1px solid #EDF1F5;font-size:13px}
.bf .hm b{font:600 13px var(--head)}
.bf .tagp{display:inline-flex;align-items:center;background:var(--sky);color:var(--blue2);border-radius:6px;padding:2px 8px;font:600 11.5px var(--body)}
.bf .sgl{display:flex;align-items:center;gap:8px;margin-top:10px;font-size:13px;flex-wrap:wrap}
.bf .sl{font:600 10.5px var(--body);letter-spacing:.08em;text-transform:uppercase;color:var(--mute)} .bf .sgl i{font-style:normal;color:var(--mute);font-size:12px}
.bf .ab1,.bf .ab2{display:inline-grid;background:var(--blue);color:#fff;font:600 12.5px var(--body);border-radius:8px;padding:7px 12px;margin-left:auto;box-shadow:0 6px 16px rgba(47,111,232,.3)}
.bf .ab1>span{grid-area:1/1;display:flex;align-items:center}
.bf .btt{background:#fff;border:1px solid #E1E7F0;border-radius:10px;padding:4px 12px}
.bf .btr{display:flex;align-items:center;gap:14px;padding:8px 0;font-size:13px} .bf .btr b{font:600 13.5px var(--head);min-width:110px}
.bf .toast{position:absolute;left:50%;bottom:18px;transform:translateX(-50%);display:flex;align-items:center;background:#0E1B2E;color:#fff;font:600 13px var(--body);padding:10px 16px;border-radius:10px;box-shadow:0 10px 30px rgba(14,27,46,.3);z-index:9;white-space:nowrap}
.bf .toast .ico{color:#7EE2B8}
.scene.act .toast.at{animation-name:bfToast} .scene.act .toast.until{animation:bfToast .5s var(--at) both,bfOut .35s var(--to) forwards}
@keyframes bfToast{from{opacity:0;transform:translate(-50%,16px)}to{opacity:1;transform:translate(-50%,0)}}
.bf .mailfly{display:inline-flex;align-items:center;margin-top:12px;background:var(--sky);color:var(--blue2);font:600 13px var(--body);border-radius:999px;padding:6px 13px}

/* the chapter scenes, on blue */
.bf .flowwrap,.bf .center{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;height:540px;width:1224px}
.bf .ebw{font:600 12.5px var(--body);letter-spacing:.2em;text-transform:uppercase;color:var(--lav);margin-bottom:12px;text-align:center}
.bf.blue .hx{color:#fff;text-align:center}
.bf h2.hx.c{font:700 48px/1.08 var(--head);letter-spacing:-.025em;text-shadow:0 2px 30px rgba(0,229,255,.3)}
.bf .flw{display:grid;grid-template-columns:330px 120px 300px 120px 240px;align-items:center;margin-top:34px}
.bf .env{display:flex;gap:12px;align-items:center;background:#fff;border-radius:12px;padding:11px 14px;margin:7px 0;box-shadow:0 12px 30px rgba(0,0,0,.25)}
.bf .eic{width:36px;height:36px;border-radius:10px;background:var(--blue);color:#fff;display:grid;place-items:center;flex:none} .bf .eic .ico{width:19px;height:19px}
.bf .env b{display:block;font:600 14px var(--head);color:var(--ink);margin-bottom:3px}
.bf .arw{position:relative;height:3px;margin:0 12px} .bf .arw .ln{position:absolute;inset:0;background:rgba(255,255,255,.75);transform-origin:left;transform:scaleX(0)}
.scene.act .arw .ln{animation:bfDraw .6s var(--at) forwards}
.bf .arw::after{content:'';position:absolute;right:-3px;top:-6px;border:7px solid transparent;border-left:10px solid #fff;opacity:0}
.scene.act .arw::after{animation:bfIn .3s calc(var(--at) + .5s) forwards}
.bf .pkt{position:absolute;left:0;top:-4px;width:11px;height:11px;border-radius:50%;background:var(--cyan);box-shadow:0 0 12px rgba(0,229,255,.9);opacity:0}
.scene.act .pkt{animation:bfPkt 1.5s linear calc(var(--at) + .7s) infinite} .scene.act .pkt.q2{animation-delay:calc(var(--at) + 1.2s)} .scene.act .pkt.q3{animation-delay:calc(var(--at) + 1.7s)}
@keyframes bfPkt{0%{left:0;opacity:0}15%{opacity:1}85%{opacity:1}100%{left:calc(100% - 11px);opacity:0}}
.bf .mid{text-align:center}
.bf .midc{display:inline-flex;flex-direction:column;align-items:center;background:#fff;border-radius:18px;padding:20px 28px;box-shadow:0 18px 44px rgba(0,0,0,.32)}
.bf .midc .mk{width:60px;height:60px;margin-bottom:8px} .bf .midc b{font:700 18px var(--head);color:var(--ink)} .bf .midc span{font-size:12.5px;color:var(--mute)}
.bf .fchips{display:flex;gap:7px;justify-content:center;margin-top:14px;flex-wrap:wrap}
.bf .fchip{display:inline-flex;align-items:center;gap:6px;font:600 12.5px var(--body);color:var(--blue2);background:#fff;border-radius:999px;padding:5px 12px}
.bf .fchip .ico{width:14px;height:14px}
.bf .agents{display:grid;gap:12px} .bf .agl{display:flex;align-items:center;gap:10px} .bf .agl span{font:600 15px var(--head);color:#fff}
.bf .keeps{position:relative;display:grid;gap:12px;width:720px;margin-top:26px}
.bf .vline{position:absolute;left:39px;top:30px;bottom:30px;width:2px;background:rgba(255,255,255,.55);transform-origin:top;transform:scaleY(0)}
.scene.act .vline{animation:bfGrowY calc(var(--to) - var(--at)) linear var(--at) forwards} @keyframes bfGrowY{to{transform:scaleY(1)}}
.bf .keep{position:relative;display:flex;align-items:center;gap:16px;background:#fff;border-radius:14px;padding:15px 20px;box-shadow:0 14px 34px rgba(0,0,0,.25)}
.bf .kic{width:40px;height:40px;flex:none;border-radius:50%;display:grid;place-items:center;background:linear-gradient(135deg,#00E5FF,#13408F);color:#fff}
.bf .kic .ico{width:20px;height:20px}
.scene.act .kic.spin .ico{animation:bfSpin 2.4s linear infinite}
.bf .keep b{font:700 19px/1.25 var(--head);color:var(--ink)} .bf .keep .ks{display:block;font:400 14px var(--body);color:var(--mute);margin-top:3px}
.bf .keep.off{background:rgba(255,255,255,.14);box-shadow:none;border:1px solid rgba(255,255,255,.3)} .bf .keep.off .kic{background:rgba(255,255,255,.2)}
.bf .keep.off b{color:#fff} .bf .keep.off .ks{color:var(--lav)}
.bf .strk{position:absolute;left:76px;right:24px;top:38%;height:2px;background:#fff;transform:scaleX(0);transform-origin:left}
.scene.act .strk{animation:bfDraw .5s var(--at) forwards}

/* the phone */
.bf .phn{position:relative;width:290px;height:532px;border-radius:40px;background:linear-gradient(160deg,#1B2A4A,#0B1424);padding:10px;
  box-shadow:0 30px 80px rgba(0,0,0,.6),0 0 0 1px rgba(47,111,232,.6),0 0 50px rgba(47,111,232,.38),inset 0 0 0 1.5px rgba(255,255,255,.08)}
.bf .phn::before{content:'';position:absolute;left:50%;top:16px;width:84px;height:22px;margin-left:-42px;border-radius:12px;background:#0B1422;z-index:5}
.bf .ps{position:relative;height:100%;border-radius:31px;background:#F4F7FB;overflow:hidden;color:var(--ink);font-family:var(--body)}
.bf .pab{height:62px;padding:24px 14px 0;background:linear-gradient(90deg,#0D2F6E,#13408F);display:flex;align-items:center;gap:8px}
.bf .pab .mk{width:24px;height:24px} .bf .pab b{color:#fff;font:700 14px var(--head)} .bf .pab span{color:#BFD3F7;font:500 12px var(--body)}
.bf .pbd{padding:10px}
.bf .ptabs{display:flex;gap:5px;margin-bottom:8px} .bf .ptabs span{border:1px solid #E1E7F0;background:#fff;border-radius:999px;padding:4px 9px;font:600 11px var(--body);color:#334155}
.bf .ptabs .on{background:var(--blue);color:#fff;border-color:var(--blue)} .bf .ptabs b{color:#fff}
.bf .prw{position:relative;display:flex;gap:8px;align-items:flex-start;background:#fff;border:1px solid #E1E7F0;border-radius:11px;padding:8px 10px;margin:6px 0}
.bf .prw .av.sm{margin:2px 0 0} .bf .prw b{font:700 13px var(--head);display:block} .bf .prw i{font-style:normal;font-size:11px;color:var(--mute);display:block}
.bf .prw em{display:inline-block;margin-top:3px;font-style:normal;font-size:11px;font-weight:600;background:var(--ambbg);color:var(--amb);border-radius:5px;padding:0 6px}
.bf .prw.new{border-color:var(--blue);box-shadow:0 0 0 3px rgba(47,111,232,.25)}
.bf .prw.open{border-left:4px solid var(--blue)}
.bf .lbtn{position:absolute;right:9px;top:10px;background:var(--blue);color:#fff;font:600 11px var(--body);border-radius:7px;padding:5px 9px}
.bf .blk{display:flex;gap:9px;align-items:flex-start;background:#fff;border:1px solid #E1E7F0;border-radius:10px;padding:7px 10px;margin:6px 0}
.bf .bki{width:26px;height:26px;border-radius:8px;background:var(--sky);color:var(--blue);display:grid;place-items:center;flex:none} .bf .bki .ico{width:14px;height:14px}
.bf .blk h5{margin:0 0 2px;font:600 9.5px var(--body);letter-spacing:.1em;text-transform:uppercase;color:var(--mute)}
.bf .blk span{display:block;font-size:11.5px;color:#334155} .bf .blk .big{font:700 13px var(--head);color:var(--ink)}
.bf .sheet{position:absolute;left:0;right:0;bottom:0;background:#fff;border-radius:20px 20px 0 0;box-shadow:0 -12px 30px rgba(19,64,143,.2);padding:14px 14px 16px;transform:translateY(105%);z-index:6}
.scene.act .sheet{animation:bfSheet .5s cubic-bezier(.2,.9,.3,1) var(--at) forwards} @keyframes bfSheet{to{transform:none}}
.bf .sheet>b{font:700 15px var(--head)} .bf .ocs{display:flex;flex-wrap:wrap;gap:5px;margin-top:8px}
.bf .oc{border:1.5px solid #CBD5E1;border-radius:999px;padding:4px 10px;font:600 12px var(--body);color:#334155}
.scene.act .oc.lit{animation:bfLit .25s var(--at) forwards,bfUnlit .25s var(--to) forwards}
.scene.act .oc.lit.sel{animation:bfLit .25s var(--at) forwards,bfUnlit .25s var(--to) forwards,bfLit .25s var(--to) forwards}
@keyframes bfLit{to{background:#1D5BC4;color:#fff;border-color:#1D5BC4}} @keyframes bfUnlit{to{background:#fff;color:#334155;border-color:#CBD5E1}}
.bf .sheet .fld{font-size:12px} .bf .toast.tph{bottom:24px}

/* comments and history */
.bf .det{display:inline-block;margin-top:4px} .bf .dl{display:inline-flex;align-items:center;color:var(--blue);font:600 13px var(--body);border:1px solid #C9D8F3;border-radius:8px;padding:6px 10px}
.bf .dw{display:grid;grid-template-columns:1fr 1.15fr;gap:14px;position:absolute;top:52px;left:18px;right:18px}
.bf .dc{position:relative;background:#fff;border:1px solid #E1E7F0;border-radius:10px;padding:10px 12px;min-height:330px}
.bf .dc h5{margin:0 0 6px;font:600 10px var(--body);letter-spacing:.1em;text-transform:uppercase;color:var(--mute)}
.bf .hii{display:grid;grid-template-columns:24px 48px 1fr;gap:6px;align-items:center;padding:7px 0;border-top:1px solid #EDF1F5;font-size:12.5px}
.bf .hii i{font-style:normal;color:var(--mute);font-weight:600}
.bf .hdot{width:22px;height:22px;border-radius:50%;background:var(--sky);color:var(--blue);display:grid;place-items:center} .bf .hdot .ico{width:12px;height:12px}
.bf .cbox{display:flex;gap:8px;align-items:center} .bf .cbox .fld{flex:1;font-size:12px;overflow:hidden} .bf .cbox .bbtn{margin:0}
.bf .cmt{display:flex;gap:8px;margin-top:10px;background:#F0F5FF;border-left:3px solid var(--blue);border-radius:0 8px 8px 0;padding:8px 10px}
.bf .cmt b{display:block;font:600 11.5px var(--body);color:var(--blue2)} .bf .cmt span{font-size:12.5px}
/* the Salesforce task (Client Support, 15 October 2026) */
.bf .sfh{display:flex;align-items:center;gap:12px;padding:14px 18px;background:#fff;border-bottom:1px solid #E1E7F0}
.bf .sfi{width:34px;height:34px;border-radius:8px;background:#2E844A;color:#fff;display:grid;place-items:center;flex:none} .bf .sfi .ico{width:20px;height:20px}
.bf .sft small{display:block;font:600 10.5px var(--body);letter-spacing:.1em;text-transform:uppercase;color:var(--mute)}
.bf .sft b{display:block;font:700 15.5px var(--head);color:var(--ink)}
.bf .sfst{margin-left:auto} .bf .sfst .lbl{font-size:12px;padding:3px 10px}
.bf .sfbtn{position:relative;display:inline-flex;align-items:center;border:1.5px solid #CBD5E1;border-radius:8px;padding:6px 12px;font:600 12.5px var(--head);color:var(--blue2);background:#fff}
.bf .sfno{position:absolute;left:-4px;right:-4px;top:50%;height:2.5px;background:var(--red);transform:rotate(-8deg)}
.bf .sff{display:flex;gap:22px;padding:9px 18px;background:#F8FAFD;border-bottom:1px solid #E1E7F0;font-size:12.5px;color:var(--mute)}
.bf .sff b{color:var(--ink)}
.bf .sfb{padding:12px 18px}
.bf .sfb h5{margin:0 0 8px;font:600 10.5px var(--body);letter-spacing:.1em;text-transform:uppercase;color:var(--mute)}
.bf .sfp{display:flex;gap:8px;align-items:flex-start;background:#fff;border:1px solid #E1E7F0;border-radius:10px;padding:7px 12px;margin-top:6px}
.bf .sfp .av.sm{margin:2px 0 0}
.bf .sfp b{display:block;font:600 12px var(--head);color:var(--blue2)} .bf .sfp b i{font-style:normal;font-weight:500;color:var(--mute)}
.bf .sfp span{font-size:13.5px;color:var(--ink)} .bf .sfp.brm{background:#F0F5FF;border-color:#DCE6F7}
.bf .sfb>.at.l{position:relative}
.bf .sftag{position:absolute;right:10px;top:9px;font-size:11px}
.bf .sfml{position:absolute;right:18px;bottom:8px;width:440px;display:flex;gap:10px;align-items:flex-start;background:#fff;border:1.5px solid #F4C7C3;border-radius:12px;
  padding:11px 13px;box-shadow:0 18px 40px rgba(14,27,46,.22);z-index:8}
.bf .sfmi{width:30px;height:30px;border-radius:8px;background:var(--redbg);color:var(--red);display:grid;place-items:center;flex:none} .bf .sfmi .ico{width:16px;height:16px}
.bf .sfml b{display:block;font:700 13px var(--head);color:var(--ink)} .bf .sfml>div>span{display:block;font-size:12.5px;color:var(--mute);font-style:italic;margin:2px 0 6px}
.bf .sfml>div>.lbl{font-style:normal}
.bf .sfml .strk.sfk{left:52px;right:16px;top:44%;background:var(--red)}
.bf .onfile{display:inline-flex;align-items:center;margin-top:10px;background:var(--grnbg);color:var(--grn);font:600 12px var(--body);border-radius:999px;padding:4px 11px}

/* the title and the close */
.bf .net{position:absolute;inset:-62px -28px;pointer-events:none}
.bf .hd{position:absolute;width:9px;height:9px;border-radius:50%;background:#fff;opacity:0;box-shadow:0 0 10px rgba(255,255,255,.7)}
.scene.act .hd{animation:bfDot .4s .2s forwards,bfGather 1.4s cubic-bezier(.5,0,.2,1) var(--at) forwards}
@keyframes bfDot{to{opacity:.7}} @keyframes bfGather{to{opacity:.95;transform:translate(var(--dx),var(--dy))}}
.bf .gpin{position:absolute;width:30px;height:30px;border-radius:50%;background:#fff;color:var(--blue);display:grid;place-items:center;opacity:0}
.bf .gpin .ico{width:16px;height:16px}
.scene.act .gpin{animation:bfPop .6s var(--at) forwards,bfPulse 1.6s calc(var(--at) + .6s) ease-in-out infinite}
@keyframes bfPulse{50%{box-shadow:0 0 0 12px rgba(255,255,255,0),0 0 22px rgba(255,255,255,.5)}}
.bf .ttl{position:relative;text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:center;height:540px;width:1224px}
.bf .ttl h1.hx{font:700 74px/1.04 var(--head);letter-spacing:-.03em;margin:0;text-shadow:0 2px 36px rgba(0,229,255,.35)}
.bf .tsub{font:400 19px/1.5 var(--body);color:var(--lav);max-width:640px;margin-top:14px}
.bf .lockup{position:relative;width:104px;height:104px;margin:0 auto 20px;display:grid;place-items:center}
.bf .lockup .mk.big{width:92px;height:92px;position:relative;z-index:2;filter:drop-shadow(0 14px 30px rgba(0,0,0,.5)) drop-shadow(0 0 28px rgba(47,111,232,.75))}
.scene.act .lockup .mk.big{animation:bfPop .7s .1s both}
.bf .halo{position:absolute;inset:0;border-radius:50%;border:2px solid rgba(255,255,255,.6);opacity:0}
.scene.act .halo{animation:bfHalo 2.6s ease-out .4s infinite} .scene.act .halo.h2{animation-delay:1.7s}
@keyframes bfHalo{0%{transform:scale(.8);opacity:.9}100%{transform:scale(2.1);opacity:0}}
.bf .lockup.sm{width:84px;height:84px;margin-bottom:14px} .bf .lockup.sm .mk.big{width:74px;height:74px}
.bf .cls{display:grid;gap:8px;text-align:center;justify-items:center}
.bf .cl{font:700 54px/1.1 var(--head);color:#fff;letter-spacing:-.03em;text-shadow:0 2px 30px rgba(0,229,255,.3)}
.bf .cl.last{background:#fff;color:var(--blue2);border-radius:14px;padding:2px 22px;box-shadow:0 18px 44px rgba(0,0,0,.35)}
.bf .furl{display:inline-flex;align-items:center;gap:4px;margin-top:22px;font:600 16px var(--head);color:#fff;border:1px solid rgba(255,255,255,.45);border-radius:10px;padding:10px 18px}

/* reassign */
.bf .mrow{display:grid;grid-template-columns:160px 1fr;gap:12px;background:#fff;border:1px solid #E1E7F0;border-radius:12px;padding:14px 16px;position:relative;box-shadow:0 4px 14px rgba(19,64,143,.07)}
.bf .mrow>div:first-child .av{margin-bottom:6px} .bf .mrow>div:first-child b{display:block;font:700 15px var(--head)} .bf .mrow small{display:block;color:var(--mute);font-size:12px} .bf .hist b{font-weight:700;color:var(--ink)}
.bf .mw{display:grid;gap:7px;font-size:13.5px;color:#334155;justify-items:start} .bf .mut{color:var(--mute)}
.bf .mw b.sw2{display:inline-grid;font:700 13.5px var(--head)} .bf .agst{font-size:10.5px;padding:1px 6px;border-radius:5px;background:var(--redbg);color:var(--red);text-transform:uppercase;font-weight:600}
.bf .hist{background:#F0F5FF;border-left:3px solid var(--blue);border-radius:0 8px 8px 0;padding:7px 10px;font-size:13px}
.scene.act .hseg{animation:bfHseg 1.4s var(--at) ease-in-out} @keyframes bfHseg{25%,70%{background:rgba(47,111,232,.2);border-radius:4px;box-shadow:0 0 0 3px rgba(47,111,232,.2)}}
.bf .hseg.d,.bf .hseg{font-style:normal}
.bf .rsel{display:inline-flex;align-items:center;border:1.5px solid #CBD5E1;border-radius:8px;padding:5px 10px;font:600 12.5px var(--body);background:#fff;margin-top:2px}
.bf .dropl{position:absolute;width:220px;background:#fff;border:1px solid #CBD5E1;border-radius:10px;box-shadow:0 14px 30px rgba(19,64,143,.2);padding:4px;z-index:8}
.bf .op{display:flex;align-items:center;padding:7px 10px;border-radius:7px;font:500 13px var(--body)}
.scene.act .op.pick{animation:bfLit .2s var(--at) forwards}
.bf .fnote{display:flex;align-items:center;font-size:12.5px;color:var(--mute);margin:10px 0 0}

/* Client Support */
.bf .yc .ord{flex:none;width:24px;height:24px;border-radius:50%;background:var(--blue);color:#fff;display:grid;place-items:center;font:700 12px var(--head)}
.bf .yc .why{display:block;font-size:12px;color:#334155;border-radius:4px}
.scene.act .yc .why{animation:bfWhy .8s var(--at) both} @keyframes bfWhy{40%{background:var(--ambbg)}100%{color:var(--amb);font-weight:600}}
.scene.act .yc .tel.big{animation:bfTel .9s var(--at) both} @keyframes bfTel{40%{background:#1D5BC4;color:#fff;transform:scale(1.08)}100%{background:var(--sky)}}
.bf .drawer{position:absolute;top:46px;right:0;bottom:0;width:330px;background:#fff;border-left:1px solid #E1E7F0;box-shadow:-14px 0 30px rgba(19,64,143,.14);padding:16px;transform:translateX(105%);z-index:6}
.scene.act .drawer{animation:bfSheet .5s cubic-bezier(.2,.9,.3,1) var(--at) forwards}
.bf .drawer>b{font:700 15px var(--head)}
.bf .bks{display:grid;gap:5px} .bf .bkx{display:flex;align-items:center;border:1.5px solid #CBD5E1;border-radius:8px;padding:5px 9px;font:600 12px var(--body);color:#334155}
.scene.act .bkx.lit{animation:bfLitHot .25s var(--at) forwards} @keyframes bfLitHot{to{background:#B54708;color:#fff;border-color:#B54708}}
.bf .flyer{position:absolute;display:flex;align-items:center;background:#B54708;color:#fff;font:600 12px var(--body);border-radius:8px;padding:6px 10px;opacity:0;z-index:10;white-space:nowrap;transform:translate(-50%,-50%)}
.scene.act .flyer{animation:bfFly 1.1s cubic-bezier(.5,0,.3,1) var(--at) forwards}
@keyframes bfFly{0%{opacity:1;transform:translate(-50%,-50%)}85%{opacity:1;transform:translate(calc(var(--fx) - 50%),calc(var(--fy) - 50%)) scale(.55)}100%{opacity:0;transform:translate(calc(var(--fx) - 50%),calc(var(--fy) - 50%)) scale(.4)}}
.bf .badgeup{position:absolute;background:#B54708;color:#fff;font:700 11px var(--body);border-radius:999px;padding:1px 7px;opacity:0;z-index:10;font-style:normal;transform:translate(-50%,-50%)}
.scene.act .badgeup{animation:bfBadge .5s var(--at) forwards} @keyframes bfBadge{0%{opacity:0;transform:translate(-50%,-50%) scale(.5)}70%{opacity:1;transform:translate(-50%,-50%) scale(1.25)}100%{opacity:1;transform:translate(-50%,-50%)}}
.bf .wt{display:flex;flex-wrap:wrap;gap:6px 14px;align-items:baseline;background:#fff;border:1px solid #E1E7F0;border-radius:10px;padding:9px 12px;margin:6px 0;font-size:12.5px;color:#334155}
.bf .wt>b{font:700 13px var(--head);min-width:80px} .bf .wt .cnt{font:700 17px var(--head);color:var(--blue2)}
.bf .wl{display:flex;gap:8px;align-items:center;font-size:12.5px;color:#334155;padding:6px 0;border-top:1px solid #EDF1F5} .bf .wl i{font-style:normal;color:var(--mute);font-weight:600}

/* the clock */
.bf .clockrow{display:flex;gap:46px;align-items:center;margin-top:22px}
.bf .rng{position:relative;width:200px;height:200px}
.bf .rng svg{width:200px;height:200px;transform:rotate(-90deg)}
.bf .rt0{fill:none;stroke:rgba(255,255,255,.18);stroke-width:10}
.bf .rt1{fill:none;stroke:var(--cyan);stroke-width:10;stroke-linecap:round;stroke-dasharray:327;stroke-dashoffset:327}
.scene.act .rt1{animation:bfRingFill 1.6s cubic-bezier(.3,.8,.3,1) var(--at) forwards} @keyframes bfRingFill{to{stroke-dashoffset:110}}
.bf .rn2{position:absolute;inset:0;display:grid;place-items:center;align-content:center;text-align:center}
.bf .rn2 .cnt{font:700 64px/1 var(--head);color:#fff;text-shadow:0 0 26px rgba(0,229,255,.7)} .bf .rn2 span{font:500 14px var(--body);color:var(--lav)}
.bf .sts{display:grid;gap:14px}
.bf .stt{display:flex;gap:14px;align-items:center;background:#fff;border-radius:14px;padding:13px 20px;min-width:300px;box-shadow:0 14px 34px rgba(0,0,0,.25)}
.bf .sic{width:42px;height:42px;border-radius:12px;background:var(--sky);color:var(--blue);display:grid;place-items:center;flex:none} .bf .sic .ico{width:22px;height:22px}
.bf .stt b{font:700 36px/1 var(--head);color:var(--ink);display:block} .bf .stt span{font:600 15px var(--head);color:var(--slate)} .bf .stt i{display:block;font-style:normal;color:var(--mute);font-size:12.5px;margin-top:2px}
.bf .stt.key .sic{background:var(--blue);color:#fff}
.bf .dtrk{position:relative;display:flex;gap:0;justify-content:space-between;width:700px;margin-top:22px}
.bf .dln{position:absolute;left:14px;right:14px;top:13px;height:2px;background:rgba(255,255,255,.55);transform-origin:left;transform:scaleX(0)}
.scene.act .dln{animation:bfDraw calc(var(--to) - var(--at)) linear var(--at) forwards}
.bf .dnode{position:relative;display:flex;flex-direction:column;align-items:center;gap:6px;width:72px}
.bf .dnode::before{content:'';width:12px;height:12px;border-radius:50%;background:#fff;margin-top:8px;box-shadow:0 0 0 4px rgba(255,255,255,.2)}
.bf .dnode.hit::before{display:none} .bf .dnode .ico{width:28px;height:28px;padding:6px;border-radius:50%;background:#fff;color:var(--blue);box-sizing:border-box}
.bf .dnode span{font:600 12px var(--body);color:var(--lav)}
.bf .aim{display:inline-flex;align-items:center;margin-top:20px;font:600 17px var(--head);color:var(--blue2);background:#fff;border-radius:12px;padding:11px 20px;box-shadow:0 14px 34px rgba(0,0,0,.25)}
/* the workflow film (16 October 2026) */
.bf .wmain{height:calc(100% - 46px);position:relative}
.bf .wmain>.until{position:absolute;inset:14px 18px} .bf .wmain>.gate{height:auto}
.bf .lmh{padding:0 0 9px;border-bottom:1px solid #E1E7F0;display:grid;gap:3px}
.bf .lmf{display:flex;align-items:center;gap:4px;font-size:12px;color:var(--mute)} .bf .lmf b{color:var(--ink)}
.bf .lms{border-radius:5px;padding:0 3px} .bf .lmj{font:600 13.5px/1.3 var(--head);color:var(--ink)}
.bf .lbody{max-width:620px;margin:10px auto 0}
.bf .lhero{background:linear-gradient(90deg,#0D2F6E,#13408F);border-radius:10px;padding:10px 16px}
.bf .lhero b{display:block;color:#fff;font:700 17px var(--head)} .bf .lhero span{color:#BFD3F7;font-size:12px}
.bf .ldear{margin:10px 0 6px;font-size:13.5px;color:var(--ink)}
.bf .lnot{border-left:4px solid var(--cyan);background:#F0F7FF;border-radius:0 10px 10px 0;padding:8px 12px}
.bf .lnot h5{margin:0 0 3px;font:700 11px var(--body);letter-spacing:.1em;text-transform:uppercase;color:var(--blue2)}
.bf .lnot span{font-size:12.5px;line-height:1.4;color:#24324A}
.bf .lfac{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:10px 0}
.bf .lf{background:#fff;border:1px solid #E1E7F0;border-radius:9px;padding:6px 10px}
.bf .lf small{display:block;font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--mute)} .bf .lf b{font:700 14px var(--head);color:var(--ink)}
.bf .ltap{display:grid;grid-template-columns:1.35fr 1fr 1fr;gap:8px}
.bf .lt{border:1.5px solid #C9D8F3;background:#fff;border-radius:10px;padding:9px 10px;font:600 12.5px var(--head);color:var(--blue2);text-align:center}
.bf .lt.key{background:#13408F;border-color:#13408F;color:#fff}
.bf .ffx{background:#FFFBEB;border:1px solid #FDE7A9;border-radius:12px;padding:10px 14px}
.bf .ffh b{display:flex;align-items:center;gap:5px;font:700 14px var(--head);color:var(--amb)} .bf .ffh span{display:block;font-size:12px;color:#7A5B12;margin-top:2px}
.bf .ffc{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:10px 0}
.bf .ffp{display:grid;gap:3px;justify-items:start;background:#fff;border:1px solid #E1E7F0;border-radius:10px;padding:8px 11px;font-size:12.5px;color:#334155}
.bf .ffn{display:flex;align-items:center} .bf .ffn b{font:700 14px var(--head);color:var(--ink)} .bf .ffa{color:var(--mute)}
.bf .ffad{font-weight:600;color:var(--ink);padding:0 3px;margin-left:-3px}
.bf .ffgs{background:#fff;border:1px solid #E1E7F0;border-radius:10px;padding:8px 11px}
.bf .ffgs h5{margin:0 0 4px;font:600 10px var(--body);letter-spacing:.1em;text-transform:uppercase;color:var(--mute)}
.bf .ffg{display:flex;align-items:center;gap:9px;padding:4px 0;font-size:13px;color:var(--ink)}
.bf .ffd{flex:none;width:9px;height:9px;border-radius:50%} .bf .ffd.red{background:var(--red)} .bf .ffd.amb{background:var(--amb)}
.bf .ffb{display:flex;align-items:center;gap:8px;margin-top:10px} .bf .ffb .ab1{margin-left:0}
.bf .tiles.t4{grid-template-columns:repeat(4,1fr)}
.bf .kbs{display:grid;gap:8px;background:#fff;border:1px solid #E1E7F0;border-radius:10px;padding:10px 12px}
.bf .kbr{display:grid;grid-template-columns:180px 1fr 30px;gap:10px;align-items:center;font-size:13px;color:#334155}
.bf .kbr b{font:700 14px var(--head);color:var(--ink);text-align:right}
.bf .kbb{display:block;height:12px;background:#E3EAEF;border-radius:6px;overflow:hidden} .bf .kbb .gr{background:var(--blue)}
.bf .cma{display:flex;flex-direction:column;align-items:center;margin-top:16px}
.bf .cma .cnt{font:700 66px/1 var(--head);color:#fff;text-shadow:0 0 30px rgba(0,229,255,.7)} .bf .cma span{font:500 14px var(--body);color:var(--lav);margin-top:4px}
.bf .cmr{display:grid;grid-template-columns:230px 56px 230px 56px 230px 56px 230px;align-items:center;margin-top:20px}
.bf .cms{display:grid;justify-items:center;gap:6px;text-align:center;background:#fff;border-radius:14px;padding:14px;box-shadow:0 14px 34px rgba(0,0,0,.25)}
.bf .cms b{font:700 16px/1.2 var(--head);color:var(--ink)} .bf .cms small{font-size:13px;color:var(--mute)}
.bf .cms.key{background:linear-gradient(135deg,#1D5BC4,#13408F);box-shadow:0 14px 34px rgba(0,0,0,.3),0 0 0 1px rgba(0,229,255,.55)}
.bf .cms.key b{color:#fff} .bf .cms.key small{color:#BFD3F7} .bf .cms.key .kic{background:#fff;color:var(--blue)}
.bf .cmd{display:flex;align-items:center;gap:10px;margin-top:16px;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.3);border-radius:12px;padding:8px 14px}
.bf .cmd small{font:600 12px var(--body);letter-spacing:.1em;text-transform:uppercase;color:var(--lav)} .bf .cmd .fld{min-width:150px}
.bf .ocg{display:flex;flex-wrap:wrap;justify-content:center;gap:12px;width:1120px;margin-top:24px}
.bf .occ{width:262px;display:flex;gap:12px;align-items:center;background:#fff;border-radius:14px;padding:12px 14px;box-shadow:0 14px 34px rgba(0,0,0,.25)}
.bf .ocn{flex:none;width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,#00E5FF,#13408F);color:#fff;display:grid;place-items:center;font:700 15px var(--head)}
.bf .occ b{display:block;font:700 15.5px/1.2 var(--head);color:var(--ink)} .bf .occ small{display:block;font-size:12.5px;color:var(--mute);margin-top:2px}
.bf .occ.key{background:linear-gradient(135deg,#1D5BC4,#13408F);box-shadow:0 14px 34px rgba(0,0,0,.3),0 0 0 1px rgba(0,229,255,.55)}
.bf .occ.key b{color:#fff} .bf .occ.key small{color:#BFD3F7} .bf .occ.key .ocn{background:#fff;color:var(--blue)}
.bf .ttbs{display:flex;gap:6px;margin-bottom:12px}
.bf .ttb{border:1px solid #E1E7F0;background:#fff;border-radius:999px;padding:5px 12px;font:600 12px var(--body);color:#334155}
.bf .ttb.on{background:var(--blue);border-color:var(--blue);color:#fff}
.bf .tsecs{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.bf .tsec{display:grid;gap:6px;background:#fff;border:1px solid #E1E7F0;border-radius:10px;padding:9px 12px} .bf .tsec b{font:700 13.5px var(--head);color:var(--ink)}
.bf .tck{display:flex;align-items:center;gap:7px;font-size:11.5px;color:#334155}
.bf .tbx{flex:none;width:18px;height:18px;border:1.5px solid #CBD5E1;border-radius:5px;display:grid;place-items:center;color:transparent;background:#fff}
.bf .tbx .ico{width:12px;height:12px}
.scene.act .tbx{animation:bfTbx .3s var(--at) forwards} @keyframes bfTbx{to{background:#1D5BC4;border-color:#1D5BC4;color:#fff}}
.bf .tq{display:grid;gap:8px;background:#fff;border:1px solid #E1E7F0;border-radius:12px;padding:12px 14px}
.bf .tqh{display:flex;align-items:center;gap:10px;font-size:12px;color:var(--mute)}
.bf .qnn{width:26px;height:26px;border-radius:50%;background:var(--blue);color:#fff;display:grid;place-items:center;font:700 12px var(--head)}
.bf .skl{display:block;height:10px;border-radius:5px;background:#E3EAEF}
.bf .topt{display:flex;align-items:center;gap:10px;border:1.5px solid #CBD5E1;border-radius:9px;padding:8px 11px;background:#fff}
.bf .topt b{width:16px;font:700 13px var(--head);color:var(--blue2)} .bf .topt .skl{flex:none}
.scene.act .topt.pick{animation:bfLit .2s var(--at) forwards} .scene.act .topt.pick b{animation:bfWhite .2s var(--at) forwards}
@keyframes bfWhite{to{color:#fff}}
.bf .tres{display:inline-flex;align-items:center;gap:22px;background:#fff;border:1px solid #E1E7F0;border-left:4px solid var(--grn);border-radius:12px;padding:18px 22px;margin-top:6px}
.bf .tres .cnt{font:700 54px/1 var(--head);color:var(--ink)} .bf .tres .lbl{font-size:13px;padding:3px 12px}
.bf .trs{display:flex;align-items:center;gap:5px;font-size:13px;color:#334155;margin-top:6px}
@media (prefers-reduced-motion:reduce){.scene.act *{animation-duration:.01ms!important;animation-iteration-count:1!important}}
"""

JS = r"""
<script>
/* ══ the board films: what the page sets up when a scene opens (build-boardfilm.py) ══
   The cursor, the clicks, the spotlights and the camera find their targets on the page itself, so a change of font
   or layout never leaves them pointing at the wrong place. A scene keeps running for a moment after it hands over,
   so the scene it replaces zooms away whole behind the new one. */
(function(){
  function frameOf(el){ return el.closest('.cam,.ps'); }
  function offs(el, fr){ var x = 0, y = 0, e = el;
    while (e && e !== fr){ x += e.offsetLeft; y += e.offsetTop; var p = e.offsetParent; if (p && p !== fr){ x += p.clientLeft || 0; y += p.clientTop || 0; } e = p; }
    return e === fr ? {x: x, y: y} : null; }
  function boxOf(sel, fr){ var t = fr.querySelector(sel); if (!t) return null; var o = offs(t, fr); if (!o) return null; return {x: o.x, y: o.y, w: t.offsetWidth, h: t.offsetHeight}; }
  function ctr(sel, fr){ var b = boxOf(sel, fr); return b ? [b.x + b.w / 2, b.y + b.h / 2] : null; }
  var EASE = 'cubic-bezier(.45,0,.2,1)';
  function place(sc){
    sc.querySelectorAll('[data-ctr]').forEach(function(el){ var fr = frameOf(el), c = fr && ctr(el.dataset.ctr, fr); if (c){ el.style.left = c[0] + 'px'; el.style.top = c[1] + 'px'; } });
    sc.querySelectorAll('[data-box]').forEach(function(el){ var fr = frameOf(el), b = fr && boxOf(el.dataset.box, fr), p = +(el.dataset.pad || 0);
      if (b){ el.style.left = (b.x - p) + 'px'; el.style.top = (b.y - p) + 'px'; el.style.width = (b.w + 2 * p) + 'px'; el.style.height = (b.h + 2 * p) + 'px'; } });
    sc.querySelectorAll('[data-col]').forEach(function(el){ var fr = frameOf(el), c = fr && boxOf(el.dataset.col, fr), b = fr && boxOf(el.dataset['in'], fr);
      if (c && b){ el.style.left = (c.x - 4) + 'px'; el.style.width = (c.w + 8) + 'px'; el.style.top = (b.y + 2) + 'px'; el.style.height = (b.h - 4) + 'px'; } });
    sc.querySelectorAll('[data-below]').forEach(function(el){ var fr = frameOf(el), b = fr && boxOf(el.dataset.below, fr); if (b){ el.style.left = b.x + 'px'; el.style.top = (b.y + b.h + 4) + 'px'; } });
    sc.querySelectorAll('[data-from]').forEach(function(el){ var fr = frameOf(el), a = fr && ctr(el.dataset.from, fr), b = fr && ctr(el.dataset.to, fr);
      if (a && b){ el.style.left = a[0] + 'px'; el.style.top = a[1] + 'px'; el.style.setProperty('--fx', (b[0] - a[0]) + 'px'); el.style.setProperty('--fy', (b[1] - a[1]) + 'px'); } });
  }
  function cursors(sc, D){
    sc.querySelectorAll('.cur[data-path]').forEach(function(cu){
      var fr = frameOf(cu);
      var pts = JSON.parse(cu.dataset.path).map(function(m){ var p = typeof m[1] === 'string' ? ctr(m[1], fr) : [m[1], m[2]]; return [m[0], p || [0, 0]]; });
      var kf = [];
      function k(t, p, o){ kf.push({offset: Math.min(1, Math.max(0, t / D)), transform: 'translate(' + p[0].toFixed(1) + 'px,' + p[1].toFixed(1) + 'px)', opacity: o, easing: EASE}); }
      var t0 = pts[0][0], prev = pts[0][1], last = t0;
      k(0, prev, 0); k(Math.max(1, t0 - 300), prev, 0); k(t0, prev, 1);
      for (var j = 1; j < pts.length; j++){ var t = Math.max(last + 2, pts[j][0]); k(Math.max(last + 1, t - 650), prev, 1); k(t, pts[j][1], 1); prev = pts[j][1]; last = t; }
      if (cu.classList.contains('touch')) { k(Math.min(D, last + 450), prev, 1); k(Math.min(D, last + 750), prev, 0); k(D, prev, 0); } else k(D, prev, 1);
      for (var q = 1; q < kf.length; q++) if (kf[q].offset < kf[q - 1].offset) kf[q].offset = kf[q - 1].offset;
      cu.getAnimations().forEach(function(a){ a.cancel(); });
      cu.animate(kf, {duration: D, fill: 'both'});
    });
  }
  function camera(sc, D){
    sc.querySelectorAll('.cam[data-cam]').forEach(function(cam){
      var W = cam.offsetWidth, Hh = cam.offsetHeight, id = 'translate(0px,0px) scale(1)', kf = [{offset: 0, transform: id}], last = id, lastOff = 0;
      JSON.parse(cam.dataset.cam).forEach(function(m){
        var t = m[0], s = m[2], tr = id;
        if (m[1]){ var b = boxOf(m[1], cam); if (b){ var cx = b.x + b.w / 2, cy = b.y + b.h / 2;
          var tx = Math.min(0, Math.max(W - s * W, W / 2 - s * cx)), ty = Math.min(0, Math.max(Hh - s * Hh, Hh / 2 - s * cy));
          tr = 'translate(' + tx.toFixed(1) + 'px,' + ty.toFixed(1) + 'px) scale(' + s + ')'; } }
        var a = Math.max(lastOff, (t - 400) / D), z = Math.min(1, Math.max(a + 0.001, (t + 600) / D));
        kf.push({offset: a, transform: last, easing: 'cubic-bezier(.6,0,.25,1)'}); kf.push({offset: z, transform: tr}); last = tr; lastOff = z;
      });
      if (lastOff < 1) kf.push({offset: 1, transform: last});
      cam.getAnimations().forEach(function(a){ a.cancel(); });
      cam.animate(kf, {duration: D, fill: 'both'});
    });
  }
  function counters(sc){
    if (window.__RENDER) return;                       /* render.js sets the numbers itself, frame by frame */
    sc.querySelectorAll('.cnt').forEach(function(el){
      var to = parseFloat(el.dataset.to), suf = el.dataset.suf || '', pre = el.dataset.pre || '', at = +(el.dataset.at || 0);
      el.textContent = pre + '0' + suf;
      clearTimeout(el._t); el._t = setTimeout(function(){ var t0 = null;
        (function f(ts){ if (t0 === null) t0 = ts; var k = Math.min(1, (ts - t0) / 1000), e = 1 - Math.pow(1 - k, 3);
          el.textContent = pre + Math.round(to * e) + suf; if (k < 1) requestAnimationFrame(f); })(performance.now()); }, at);
    });
  }
  var timers = new Map();
  function start(sc){
    if (!sc || !sc.classList.contains('bf')) return;
    clearTimeout(timers.get(sc)); sc.classList.remove('act'); sc.classList.remove('out'); void sc.offsetWidth; sc.classList.add('act');
    var D = +sc.dataset.d; place(sc); cursors(sc, D); camera(sc, D); counters(sc);
  }
  function stop(sc){ if (!sc) return; sc.classList.add('out');          /* it zooms away behind the new scene; render.js clears it at 720 ms */
    if (window.__RENDER) return; clearTimeout(timers.get(sc)); timers.set(sc, setTimeout(function(){ sc.classList.remove('act'); sc.classList.remove('out'); }, 720)); }
  var _go = go;
  go = function(n){ var prev = cur >= 0 ? SC[cur] : null; _go(n); var now = SC[cur]; if (prev && prev !== now) stop(prev); start(now); };
})();
</script>
"""

# ── the shell: the other films' runner, chrome and clock ─────────────────
s = SRC.read_text()
s = re.sub(r"@font-face\{font-family:'(?:DM Sans|Montserrat)'[^}]*\}\n?", '', s)        # the shell's own faces: the board films set in Plex
chrome_end = s.index('</div>', s.index('<div id="chrome">')) + len('</div>')
tap = s.index('<div class="tapzone" id="zL"')
out = s[:chrome_end] + '\n' + SCENES + '\n\n' + s[tap:]
last = out.rindex('</style>')
out = out[:last] + CSS.replace('__PLEX__', PLEX).replace('__LOGO__', LOGO) + '\n' + out[last:]
out = re.sub(r'<title>.*?</title>', '<title>' + TITLES[KEY] + ' — Ricky Rampersad Branch</title>', out, count=1, flags=re.S)
out = re.sub(r'<svg class="mark" viewBox="0 0 88 88" aria-hidden="true">.*?</svg>', lambda m: '<i class="mark mk"></i>', out, count=1, flags=re.S)
out = re.sub(r'<span class="who">.*?</span>', '<span class="who">Ricky Rampersad Branch<i>Client transition board</i></span>', out, count=1, flags=re.S)
out = re.sub(r'<span class="live">.*?</span>', '', out, count=1, flags=re.S)
out = re.sub(r'<svg class="biglogo" viewBox="0 0 88 88" aria-hidden="true">.*?</svg>', lambda m: '<i class="biglogo mk"></i>', out, count=1, flags=re.S)
FAVICON = 'data:image/svg+xml,' + (ROOT / 'favicon.svg').read_text().replace('#', '%23').replace('<', '%3C').replace('>', '%3E').replace('"', "'").replace('\n', '')
out = re.sub(r'(<link rel="icon" href=")[^"]*(")', lambda m: m.group(1) + FAVICON + m.group(2), out, count=1)
out = re.sub(r'const cols = \[[^\]]*\]', 'const cols = ["#ffffff", "#00E5FF", "#1D5BC4", "#BFD3F7", "#7FA6EE"]', out, count=1)
out = re.sub(r'<h1>The launch of<br>donthaveanagent<em>\.com</em></h1>', '<h1>' + TITLES[KEY].replace(', ', ',<br><em>') + '</em></h1>', out, count=1)
out = re.sub(r'<div class="eyebrow" style="margin-top:16px">[^<]*</div>', '<div class="eyebrow" style="margin-top:16px">A Ricky Rampersad Branch film</div>', out, count=1)
out = re.sub(r'<button id="playBtn"><span class="tri"></span>[^<]*</button>', '<button id="playBtn"><span class="tri"></span>Watch — ' + ('under two minutes' if sum(DUR) < 120000 else 'two and a half minutes' if sum(DUR) < 160000 else f'{round(sum(DUR) / 60000)} minutes') + '</button>', out, count=1)
out = re.sub(r'🔊 \d+ seconds, with music — tap to begin\.', ('One client, start to finish: what happens, who does it, and what counts.' if KEY == 'boardflow' else 'How the branch names agents, and how agents report back.'), out, count=1)
MSG = ('const MSG = "' + TITLES[KEY] + ': a short film on the client transition board.\\n\\n" +\n'
       '  "▶ https://rickyrampersadbranch.com/orphan-transition/board-films.html";')
out = re.sub(r'const MSG = ".*?";', lambda m: MSG, out, count=1, flags=re.S)
out = out.replace('document.getElementById("waBtn").href =', 'if (document.getElementById("waBtn")) document.getElementById("waBtn").href =')
# the narration and the bed are in the MP4; the page itself plays no music of its own
out = out.replace('  startMusic();\n  go(0);', '  go(0);')
# designed at 1280 by 720: any other window scales the frame to fit
out = out.replace('</script>\n</body>', '(function(){function k(){document.documentElement.style.setProperty("--k",Math.min(innerWidth/1280,innerHeight/720));}k();addEventListener("resize",k);})();\n</script>\n' + JS + '</body>', 1)
assert 'startMusic();\n  go(0);' not in out and 'go = function(n){ var prev' in out

# the shell styles some short class names of its own: a scene must never borrow one by accident (the first cut drew a toast as a second phone)
shell = set(re.findall(r'\.([a-zA-Z_][\w-]*)', re.sub(r'url\(data:[^)]*\)', '', ''.join(re.findall(r'<style>(.*?)</style>', SRC.read_text(), re.S)))))
used = {c for attr in re.findall(r'class="([^"]+)"', SCENES) for c in attr.split()}
clash = (used & shell) - {'scene', 'on', 'inner', 'mark', 'who', 'biglogo'}
assert not clash, f'scene classes the shell already styles: {sorted(clash)}'
OUT.write_text(out)
print('wrote', OUT, len(out), 'bytes ·', len(DUR), 'scenes ·', round(sum(DUR) / 1000, 1), 's')
