#!/usr/bin/env python3
"""Draw the motor quote launch film's page from its lines and its voice timing.

    MQ_SHOTS=<dir of screenshots> python3 build-mqfilm.py <out.html>

The film for agents (29 October 2026: "a great video to launch this to test with the agent as we have moved from
Jotform and a new platform"): thirteen scenes, one per line of mqlaunch-lines.json, voiced as Andrew Expressive and
timed from the audio (mqlaunch-timing.json: each clip's length and each word's start). Every reveal that answers a
word lands on that word: at(n, word) is that word's millisecond inside scene n, plus the 0.4 s the voice is led by.

The phone screens are the real motor quote page on a made-up client and a made-up agent, captured by driving the
page against a fake backend (the page test's own mocks). Nothing on screen is a real client.

The page keeps render.js's contract: SC, go(n), paused, timer, .act on the live scene, .out on the one handing
over (cleared at 720 ms), .cnt counters with data-to and data-at, the drifting background as .grain.
"""
import base64, json, os, random, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, 'mqfilm.html')
SHOTS = os.environ.get('MQ_SHOTS', 'shots')
LINES = json.load(open(os.path.join(HERE, 'mqlaunch-lines.json')))
TIM = json.load(open(os.path.join(HERE, 'mqlaunch-timing.json')))
OFF, AIR = 400, 1150
D = [OFF + t['clip'] + AIR for t in TIM]
D[0] += 500
D[-1] += 3200
SCALE = 300 / 390            # the phone's screen is 300 px wide; the page was captured 390 px wide


def at(n, word, k=1, plus=0):
    """The millisecond inside scene n at which the k-th word starting with `word` is spoken."""
    want = word.lower()
    seen = 0
    for ms, t in TIM[n]['words']:
        w = ''.join(ch for ch in t.lower() if ch.isalnum() or ch in "'-")
        if w.startswith(want):
            seen += 1
            if seen == k:
                return OFF + ms + plus
    raise SystemExit(f'scene {n + 1}: no word "{word}" ({k})')


def b64(path, mime):
    return f'data:{mime};base64,' + base64.b64encode(open(path, 'rb').read()).decode()


FONT = b64(os.path.join(HERE, 'fonts', 'Inter-var.woff2'), 'font/woff2')
MARK = b64(os.path.join(ROOT, 'orphan-transition', 'board-mark.png'), 'image/png')


def shot(name):
    return os.path.join(SHOTS, name)


def words(text, base, step=70, cls='w'):
    out = []
    for i, w in enumerate(text.split(' ')):
        out.append(f'<span class="{cls}" style="animation-delay:{base + i * step}ms">{w}</span>')
    return ' '.join(out)


def head(n, kicker, title, base=250):
    return (f'<p class="kick" style="animation-delay:{base}ms">{kicker}</p>'
            f'<h1>{words(title, base + 120)}</h1>')


def caption(n):
    txt = LINES[n].split(' ')
    ws = TIM[n]['words']
    out, j = [], 0
    for tok in txt:
        bare = ''.join(ch for ch in tok.lower() if ch.isalnum())
        ms = None
        for k in range(j, len(ws)):
            wb = ''.join(ch for ch in ws[k][1].lower() if ch.isalnum())
            if wb and (bare.startswith(wb[:4]) or wb.startswith(bare[:4])):
                ms, j = ws[k][0], k + 1
                break
        if ms is None:
            ms = ws[min(j, len(ws) - 1)][0]
        out.append(f'<span class="cw" style="animation-delay:{OFF + ms}ms">{tok}</span>')
    return '<div class="cap">' + ' '.join(out) + '</div>'


PAN = [0]


def phone(layers, extra=''):
    """layers: [{src, t (ms the layer appears), pans: [(t, y_css)]}]"""
    html, css = [], []
    for i, L in enumerate(layers):
        PAN[0] += 1
        kf = f'pan{PAN[0]}'
        pans = L.get('pans') or [(0, 0)]
        dur = L['dur']
        steps, y = [], pans[0][1]
        steps.append((0, y))
        for t, ny in pans[1:]:
            steps.append((t, y))
            steps.append((min(t + 900, dur), ny))
            y = ny
        steps.append((dur, y))
        frames = ''.join(f'{min(100, t / dur * 100):.3f}%{{transform:translateY({-yy * SCALE:.1f}px);animation-timing-function:cubic-bezier(.65,0,.35,1)}}' for t, yy in steps)
        css.append(f'@keyframes {kf}{{{frames}}}')
        fade = '' if i == 0 else f'animation:lay .55s ease {L["t"]}ms both;'
        html.append(f'<div class="lay" style="{fade}"><img src="{L["src"]}" style="animation:{kf} {dur}ms linear both"></div>')
    return ('<div class="phone fl"><div class="scr">' + ''.join(html) + extra + '</div></div>', '\n'.join(css))


def tap(x, y, t):
    return f'<i class="tap" style="left:{x * SCALE:.0f}px;top:{y * SCALE:.0f}px;animation-delay:{t}ms"></i>'


def hl(x, y, w, h, t, until=None):
    return (f'<i class="hl" style="left:{x * SCALE:.0f}px;top:{y * SCALE:.0f}px;width:{w * SCALE:.0f}px;height:{h * SCALE:.0f}px;'
            f'animation-delay:{t}ms"></i>')


def tick(text, t, icon='ok', sub=''):
    ic = {'ok': '<path d="M5 12.5l4.2 4.2L19 7"/>', 'x': '<path d="M7 7l10 10M17 7L7 17"/>'}[icon]
    return (f'<div class="row {icon}" style="animation-delay:{t}ms"><span class="ri"><svg viewBox="0 0 24 24">{ic}</svg></span>'
            f'<span><b>{text}</b>{f"<small>{sub}</small>" if sub else ""}</span></div>')


ICON = {
    'renew': '<path d="M20 11a8 8 0 0 0-14.5-4.5L4 8M4 4v4h4M4 13a8 8 0 0 0 14.5 4.5L20 16M20 20v-4h-4"/>',
    'quote': '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h3"/>',
    'take': '<path d="M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4"/>',
    'user': '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
    'star': '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
    'task': '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 12l3 3 5-6"/>',
    'mail': '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
    'desk': '<path d="M3 10h18M5 10v9M19 10v9M8 6h8l2 4H6z"/>',
    'lock': '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    'key': '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3"/>',
    'shield': '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M8.5 12.5l2.5 2.5 4.5-5"/>',
    'cloud': '<path d="M7 18h10a4 4 0 0 0 .5-8A6 6 0 0 0 6 9.5 4.3 4.3 0 0 0 7 18z"/>',
}


def ico(k):
    return f'<svg viewBox="0 0 24 24">{ICON[k]}</svg>'


random.seed(29)
scenes, styles = [], []

# 1 ─ a new home
n = 0
ph, c = phone([{'src': shot('01-signin.png'), 't': 0, 'dur': D[n]}])
styles.append(c)
scenes.append(f'''
<div class="left">
  {head(n, 'New · for agents and clients', 'Motor quotes have a new home.')}
  <div class="strike" style="animation-delay:{at(n, 'no')}ms"><span>JotForm</span><i style="animation-delay:{at(n, 'jotform', plus=250)}ms"></i></div>
  <div class="url big" style="animation-delay:{at(n, 'branch')}ms"><span class="dot"></span>rickyrampersadbranch.com/<b>motor-quote</b></div>
  <p class="lede" style="animation-delay:{at(n, 'built')}ms">Built by the branch, for you and your clients.</p>
</div>
{ph}''')

# 2 ─ the old way
n = 1
rows = ''.join(f'<i style="animation-delay:{120 + i * 40}ms;width:{random.randint(45, 92)}%"></i>' for i in range(16))
scenes.append(f'''
<div class="left">
  {head(n, 'The old way', 'One long form, and then silence.')}
  <div class="stats">
    <div class="stat" style="animation-delay:{at(n, 'forty')}ms"><b class="cnt" data-to="41" data-at="{at(n, 'forty')}">41</b><span>questions on the old form</span></div>
    <div class="stat red" style="animation-delay:{at(n, 'twice')}ms"><b class="cnt" data-to="2" data-at="{at(n, 'twice')}">2</b><span>times it was ever filled in</span></div>
  </div>
  <div class="rows">
    {tick('No reference', at(n, 'reference'), 'x')}
    {tick('No record', at(n, 'record'), 'x')}
    {tick('Nobody followed up', at(n, 'nobody'), 'x')}
  </div>
</div>
<div class="oldform fl"><p>The old form</p><div class="ofs">{rows}{rows}</div><span class="stampx" style="animation-delay:{at(n, 'twice', plus=200)}ms">2 replies, ever</span></div>''')

# 3 ─ sign in with a code
n = 2
ph, c = phone([{'src': shot('01-signin.png'), 't': 0, 'dur': D[n]},
               {'src': shot('02-code.png'), 't': at(n, 'code', plus=-300), 'dur': D[n]}],
              tap(195, 560, at(n, 'send', plus=-200)))
styles.append(c)
digits = ''.join(f'<span style="animation-delay:{at(n, "six") + i * 160}ms">{d}</span>' for i, d in enumerate('211110'))
scenes.append(f'''
<div class="left">
  {head(n, 'Step 1 · Sign in', 'An e-mail and a code. That is all.')}
  <div class="codebox">{digits}</div>
  <p class="under" style="animation-delay:{at(n, 'six', plus=900)}ms">Six digits, sent to their inbox. Good for fifteen minutes.</p>
  <div class="rows">{tick('No password to forget', at(n, 'password'), 'ok')}</div>
</div>
{ph}''')

# 4 ─ the record fills itself in
n = 3
ph, c = phone([{'src': shot('03-home-full.png'), 't': 0, 'dur': D[n],
                'pans': [(0, 0), (at(n, 'record', plus=-200), 390), (at(n, 'vehicle', plus=-300), 1420), (at(n, 'premium', plus=-200), 1700)]}])
styles.append(c)
scenes.append(f'''
<div class="left">
  {head(n, 'Step 2 · Already with Guardian?', 'Their record fills itself in.')}
  <div class="rows">
    {tick('Their details', at(n, 'details'), 'ok', 'Name, mobile, date of birth, occupation')}
    {tick("Their driver's permit", at(n, 'permit'), 'ok', 'Number and expiry, and they can update it')}
    {tick('Every vehicle we insure', at(n, 'vehicle'), 'ok', 'Cover, sum insured, renewal date')}
    {tick('The premium, year by year', at(n, 'premium'), 'ok', 'As a chart, with the change on last year')}
  </div>
</div>
{ph}''')

# 5 ─ three clear choices
n = 4
ph, c = phone([{'src': shot('03-home-full.png'), 't': 0, 'dur': D[n], 'pans': [(0, 600)]}],
              hl(12, 892 - 600, 366, 104, at(n, 'renew')) + hl(12, 1004 - 600, 366, 104, at(n, 'quote')) + hl(12, 1116 - 600, 366, 120, at(n, 'accept')))
styles.append(c)
scenes.append(f'''
<div class="left">
  {head(n, 'Step 3 · Choose', 'Three clear choices.')}
  <div class="paths">
    <div class="path teal" style="animation-delay:{at(n, 'renew')}ms"><span class="pi">{ico('renew')}</span><b>Renew</b><small>A vehicle we already insure</small></div>
    <div class="path blue" style="animation-delay:{at(n, 'quote')}ms"><span class="pi">{ico('quote')}</span><b>New quote</b><small>A vehicle we don't insure yet</small></div>
    <div class="path vio" style="animation-delay:{at(n, 'accept')}ms"><span class="pi">{ico('take')}</span><b>Accept a quote</b><small>The quote we sent, signed online</small></div>
  </div>
  <p class="under" style="animation-delay:{at(n, 'sent', plus=300)}ms">Each with its own colour and its own steps, so nothing gets mixed up.</p>
</div>
{ph}''')

# 6 ─ snap the dealer's invoice
n = 5
ph, c = phone([{'src': shot('05-reading.png'), 't': 0, 'dur': D[n]},
               {'src': shot('06-read-full.png'), 't': at(n, 'make', plus=-500), 'dur': D[n], 'pans': [(0, 120), (at(n, 'year'), 560)]}])
styles.append(c)
chips = [('Make', 'MG', 'make'), ('Model', 'ZS HEV Lux', 'model'), ('Year', '2026', 'year'), ('Chassis', 'read off', 'chassis'), ('Price', 'TT$ 212,645', 'price')]
chip_html = ''.join(f'<div class="chip" style="animation-delay:{at(n, w)}ms"><small>{k}</small><b>{v}</b></div>' for k, v, w in chips)
scenes.append(f'''
<div class="left">
  {head(n, 'New quote · buying a car?', "Snap the dealer's invoice.")}
  <div class="inv">
    <div class="paper fl2"><b>Sample Motors Ltd</b><small>Quotation Q-1001</small><i></i><i></i><i class="s"></i><i></i><i class="s"></i><i></i>
      <span class="scan" style="animation-delay:{at(n, 'snap')}ms"></span></div>
    <div class="chips">{chip_html}</div>
  </div>
  <p class="under" style="animation-delay:{at(n, 'price', plus=500)}ms">Every field it filled is marked, so the client checks it.</p>
</div>
{ph}''')

# 7 ─ the agent places it
n = 6
ph, c = phone([{'src': shot('13-agent-home.png'), 't': 0, 'dur': D[n]},
               {'src': shot('14-agent-form-full.png'), 't': at(n, 'type', plus=-300), 'dur': D[n], 'pans': [(0, 120)]}])
styles.append(c)
scenes.append(f'''
<div class="left">
  {head(n, 'For you, the agent', 'Place the quote for your client.')}
  <div class="steps">
    <div class="st" style="animation-delay:{at(n, 'sign')}ms"><b>1</b><span>Sign in with <u>your work e-mail</u></span></div>
    <div class="st" style="animation-delay:{at(n, 'type')}ms"><b>2</b><span>Type in <u>your client's e-mail</u> and the vehicle</span></div>
    <div class="st" style="animation-delay:{at(n, 'producer')}ms"><b>3</b><span>You're the <u>producer</u> on it</span></div>
  </div>
  <div class="badge" style="animation-delay:{at(n, 'producer', plus=250)}ms">{ico('star')} Your quote, your name on it</div>
</div>
{ph}''')

# 8 ─ what happens when it's sent
n = 7
scenes.append(f'''
<div class="left narrow">
  {head(n, 'Then, by itself', 'Sent in one tap.')}
  <p class="lede" style="animation-delay:{at(n, 'form', plus=200)}ms">Guardian's own form, filled in. Every document attached.</p>
</div>
<div class="flow">
  <div class="form fl2" style="animation-delay:{at(n, 'guardian')}ms"><img src="{shot('req-1.png')}"><span class="stamp" style="animation-delay:{at(n, 'filled')}ms">Filled in for you</span></div>
  <svg class="lines" viewBox="0 0 300 420"><path class="ln" style="animation-delay:{at(n, 'desk')}ms" d="M0 120 C120 120 160 60 300 60"/>
    <path class="ln" style="animation-delay:{at(n, 'receipt')}ms" d="M0 210 C120 210 160 210 300 210"/>
    <path class="ln" style="animation-delay:{at(n, 'copied')}ms" d="M0 300 C120 300 160 360 300 360"/></svg>
  <div class="dest d1" style="animation-delay:{at(n, 'desk')}ms"><span class="pi">{ico('desk')}</span><b>Quotes desk</b><small>The form and every document</small></div>
  <div class="dest d2" style="animation-delay:{at(n, 'receipt')}ms"><span class="pi">{ico('mail')}</span><b>Your client</b><small>A receipt with a reference<br><code>MQ-261029-001</code></small></div>
  <div class="dest d3" style="animation-delay:{at(n, 'copied')}ms"><span class="pi">{ico('user')}</span><b>You</b><small>Copied on all of it</small></div>
</div>''')

# 9 ─ Salesforce, done for you
n = 8
scenes.append(f'''
<div class="left">
  {head(n, 'In Salesforce', 'Done for you.')}
  <div class="strike small" style="animation-delay:{at(n, 'nothing')}ms"><span>Keyed in twice</span><i style="animation-delay:{at(n, 'twice')}ms"></i></div>
</div>
<div class="sf">
  <div class="rec" style="animation-delay:{at(n, 'contact')}ms"><span class="pi">{ico('user')}</span><div><small>Contact</small><b>Dev Madeup</b><em>A new client, made for you</em></div><span class="okc">{ico('task')}</span></div>
  <div class="rec" style="animation-delay:{at(n, 'opportunity')}ms"><span class="pi">{ico('star')}</span><div><small>Opportunity</small><b>OPP Motor · Dev Madeup</b><em>Proposal / Price Quote · you, the producer</em></div><span class="okc">{ico('task')}</span></div>
  <div class="rec" style="animation-delay:{at(n, 'task')}ms"><span class="pi">{ico('task')}</span><div><small>Task</small><b>Follow up the motor quote</b><em>Due in two working days</em></div><span class="okc">{ico('task')}</span></div>
</div>''')

# 10 ─ the client accepts and signs
n = 9
ph, c = phone([{'src': shot('10c-kyp.png'), 't': 0, 'dur': D[n]},
               {'src': shot('11-sign.png'), 't': at(n, 'sign', plus=-200), 'dur': D[n]}])
styles.append(c)
scenes.append(f'''
<div class="left">
  {head(n, 'Accepting the quote', 'Signed on the phone.')}
  <div class="docs">
    <div class="doc d1" style="animation-delay:{at(n, 'proposal')}ms"><img src="{shot('prop-4.png')}"><small>Proposal form</small></div>
    <div class="doc d2" style="animation-delay:{at(n, 'know')}ms"><img src="{shot('kyp-1.png')}"><small>Know Your Policy</small></div>
    <svg class="sig" viewBox="0 0 260 70"><path style="animation-delay:{at(n, 'right')}ms" d="M8 50 C30 10 42 62 60 34 S88 8 100 40 S128 66 140 30 S170 12 182 44 S214 58 250 22"/></svg>
  </div>
  <p class="under" style="animation-delay:{at(n, 'phone')}ms">Guardian's own PDFs, filled in exactly. No printing, no scanning.</p>
</div>
{ph}''')

# 11 ─ renewals go to the renewal portal
n = 10
ph, c = phone([{'src': shot('03-home-full.png'), 't': 0, 'dur': D[n], 'pans': [(0, 1440), (at(n, 'straight', plus=-400), 1860)]}],
              tap(195, 2058 - 1860, at(n, 'portal')))
styles.append(c)
scenes.append(f'''
<div class="left">
  {head(n, 'Renewals', 'One place to renew.')}
  <div class="toportal">
    <div class="path teal" style="animation-delay:{at(n, 'renewals')}ms"><span class="pi">{ico('renew')}</span><b>Renew</b><small>From the motor quote</small></div>
    <span class="arrow" style="animation-delay:{at(n, 'straight')}ms"></span>
    <div class="path blue" style="animation-delay:{at(n, 'portal')}ms"><span class="pi">{ico('shield')}</span><b>Renewal portal</b><small>Every renewal, in one place</small></div>
  </div>
</div>
{ph}''')

# 12 ─ test mode
n = 11
ph, c = phone([{'src': shot('02-code.png'), 't': 0, 'dur': D[n]}])
styles.append(c)
scenes.append(f'''
<div class="left">
  {head(n, 'Try it now', "It's in test mode.")}
  <div class="testbar" style="animation-delay:{at(n, 'test')}ms">TEST MODE · nothing goes out for real</div>
  <div class="rows">
    {tick('Your code comes straight to you', at(n, 'code'), 'ok', 'Sign in with your work e-mail')}
    {tick("Nothing reaches Guardian's quotes desk", at(n, 'nothing'), 'ok')}
    {tick("Your client isn't e-mailed", at(n, 'client', 2), 'ok', 'You get every copy instead')}
  </div>
</div>
{ph}''')

# 13 ─ close
n = 12
import qrcode
q = qrcode.QRCode(border=0, error_correction=qrcode.constants.ERROR_CORRECT_M)
q.add_data('https://rickyrampersadbranch.com/motor-quote/')
q.make(fit=True)
M = q.get_matrix()
qr = ''.join(f'M{x},{y}h1v1h-1z' for y, row in enumerate(M) for x, v in enumerate(row) if v)
conf = ''.join(
    f'<i class="cf" style="--x:{random.randint(-620, 620)}px;--y:{random.randint(-420, 260)}px;--r:{random.randint(-540, 540)}deg;'
    f'background:{random.choice(["#3A7BD5", "#1FA8A0", "#6C4BC2", "#4C94E6", "#F2B33D"])};animation-delay:{at(n, "think") + random.randint(0, 260)}ms"></i>'
    for _ in range(70))
scenes.append(f'''
<div class="close">
  <div class="cmark"><span class="ring" style="animation-delay:200ms"></span><span class="ring" style="animation-delay:900ms"></span><img src="{MARK}" alt=""></div>
  <h1>{words('Try it this week with one client.', 300)}</h1>
  <p class="lede" style="animation-delay:{at(n, 'tell')}ms">Then tell us what you think.</p>
  <div class="cta">
    <div class="url big" style="animation-delay:{at(n, 'ricky')}ms"><span class="dot"></span>rickyrampersadbranch.com/<b>motor-quote</b></div>
    <svg class="qr" style="animation-delay:{at(n, 'motor')}ms" viewBox="-2 -2 {len(M) + 4} {len(M) + 4}"><rect x="-2" y="-2" width="{len(M) + 4}" height="{len(M) + 4}" fill="#fff"/><path d="{qr}" fill="#13284A"/></svg>
  </div>
  <div class="conf">{conf}</div>
</div>''')

CSS = r'''
@font-face{font-family:'InterF';font-weight:100 900;src:url(__FONT__) format('woff2')}
:root{--ink:#13284A;--body:#33465F;--dim:#5D6F86;--b1:#2C5FA8;--b2:#3A7BD5;--b3:#4C94E6;--sky:#EAF3FD;--line:#D6E4F5;
  --teal:#13877F;--teal2:#1FA8A0;--vio:#6C4BC2;--amb:#8A5A00;--ambbg:#FFF2CC;--ok:#11875D;--bad:#C2412F;--e:cubic-bezier(.2,.8,.2,1)}
*{box-sizing:border-box}
html,body{margin:0;width:1280px;height:720px;overflow:hidden;background:#F2F7FD;color:var(--ink);font-family:'InterF',system-ui,sans-serif;-webkit-font-smoothing:antialiased}
#bg{position:absolute;inset:0;overflow:hidden}
#bg i{position:absolute;border-radius:50%;filter:blur(2px)}
#bg .b1{width:900px;height:900px;left:-300px;top:-420px;background:radial-gradient(closest-side,rgba(76,148,230,.30),transparent);animation:drift 26s ease-in-out infinite alternate}
#bg .b2{width:800px;height:800px;right:-260px;bottom:-460px;background:radial-gradient(closest-side,rgba(31,168,160,.20),transparent);animation:drift 31s ease-in-out infinite alternate-reverse}
#bg .b3{width:520px;height:520px;left:520px;top:300px;background:radial-gradient(closest-side,rgba(108,75,194,.10),transparent);animation:drift 22s ease-in-out infinite alternate}
#bg .dots{position:absolute;inset:0;background-image:radial-gradient(rgba(44,95,168,.13) 1.2px,transparent 1.3px);background-size:26px 26px;
  -webkit-mask-image:linear-gradient(90deg,transparent,#000 30%,#000 70%,transparent);mask-image:linear-gradient(90deg,transparent,#000 30%,#000 70%,transparent);opacity:.7}
@keyframes drift{to{transform:translate(120px,70px) scale(1.12)}}
.brand{position:absolute;left:70px;top:30px;display:flex;align-items:center;gap:12px;z-index:5;font-weight:700;font-size:15px;color:var(--ink)}
.brand img{width:34px;height:34px;border-radius:9px}
.brand small{display:block;font-weight:600;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--b2)}
.scene{position:absolute;inset:0;visibility:hidden}
.scene.act{visibility:visible;animation:sIn .75s var(--e) both}
.scene.out{animation:sOut .72s ease both;z-index:0}
.scene.act:not(.out){z-index:2}
@keyframes sIn{from{opacity:0;transform:scale(1.035);filter:blur(5px)}to{opacity:1;transform:none;filter:none}}
@keyframes sOut{to{opacity:0;transform:scale(.965) translateY(-12px);filter:blur(4px)}}
.left{position:absolute;left:70px;top:104px;width:680px}
.left.narrow{width:420px}
.kick{margin:0 0 14px;font-size:14px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:var(--b2);display:flex;align-items:center;gap:10px}
.kick:before{content:"";width:34px;height:4px;border-radius:4px;background:linear-gradient(90deg,var(--b2),var(--teal2));transform-origin:0 50%}
.act .kick{animation:fadeUp .5s var(--e) both}
.act .kick:before{animation:barIn .7s var(--e) both;animation-delay:inherit}
@keyframes barIn{from{transform:scaleX(0)}}
h1{margin:0 0 22px;font-size:52px;line-height:1.06;font-weight:800;letter-spacing:-.025em;color:var(--ink)}
.w{display:inline-block}
.act .w{animation:wd .65s var(--e) both}
@keyframes wd{from{opacity:0;transform:translateY(.45em) rotate(2deg)}}
@keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
@keyframes pop{0%{opacity:0;transform:translateY(16px) scale(.94)}60%{opacity:1;transform:translateY(-2px) scale(1.02)}100%{opacity:1;transform:none}}
.lede{font-size:22px;line-height:1.4;color:var(--body);margin:18px 0 0;font-weight:500}
.under{font-size:18px;line-height:1.45;color:var(--dim);margin:16px 0 0}
.act .lede,.act .under{animation:fadeUp .6s var(--e) both}
.lede,.under,.row,.stat,.chip,.path,.st,.badge,.dest,.rec,.doc,.testbar,.url,.strike,.stampx,.codebox span,.form,.cta .qr{opacity:0}
.act .row,.act .stat,.act .chip,.act .path,.act .st,.act .badge,.act .dest,.act .rec,.act .doc,.act .testbar,.act .url,.act .strike{animation:pop .7s var(--e) both}
/* rows of ticks */
.rows{display:grid;gap:12px;margin-top:6px}
.row{display:flex;gap:14px;align-items:center;background:#fff;border:1.5px solid var(--line);border-radius:16px;padding:13px 18px;box-shadow:0 10px 24px rgba(19,40,74,.07)}
.row b{font-size:21px;font-weight:700;display:block}
.row small{display:block;font-size:15px;color:var(--dim);margin-top:2px}
.ri{width:36px;height:36px;border-radius:50%;display:grid;place-items:center;flex:none;background:#E3F5EE;color:var(--ok)}
.row.x .ri{background:#FBE6E2;color:var(--bad)}
.row.x b{color:var(--body)}
.ri svg,.pi svg,.badge svg,.okc svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round}
.act .ri svg path{stroke-dasharray:30;animation:draw .5s ease both;animation-delay:inherit}
@keyframes draw{from{stroke-dashoffset:30}}
/* strike and url */
.strike{display:inline-flex;position:relative;font-size:30px;font-weight:800;color:var(--dim);padding:6px 16px;border-radius:12px;background:#fff;border:1.5px solid var(--line);margin:6px 0 0}
.strike.small{font-size:24px;margin-top:4px}
.strike i{position:absolute;left:8px;right:8px;top:50%;height:4px;border-radius:4px;background:var(--bad);transform-origin:0 50%;transform:scaleX(0)}
.act .strike i{animation:strikeIn .45s ease-out forwards}
@keyframes strikeIn{to{transform:scaleX(1) rotate(-4deg)}}
.url{display:inline-flex;align-items:center;gap:12px;margin-top:22px;padding:14px 22px;border-radius:999px;background:linear-gradient(90deg,var(--b1),var(--b2));color:#fff;font-size:22px;font-weight:600;box-shadow:0 14px 30px rgba(44,95,168,.28)}
.url b{font-weight:800}
.url .dot{width:12px;height:12px;border-radius:50%;background:#7FF0DF;box-shadow:0 0 0 0 rgba(127,240,223,.7);animation:ping 1.8s ease-out infinite}
@keyframes ping{to{box-shadow:0 0 0 16px rgba(127,240,223,0)}}
.url.big{font-size:24px}
/* the phone */
.phone{position:absolute;right:70px;top:28px;width:316px;height:664px;border-radius:48px;padding:8px;background:linear-gradient(160deg,#2C5FA8,#1C3E73);box-shadow:0 30px 60px rgba(19,40,74,.30),inset 0 0 0 2px rgba(255,255,255,.18)}
.scr{position:relative;width:300px;height:648px;border-radius:40px;overflow:hidden;background:#fff}
.lay{position:absolute;inset:0;background:#fff}
.lay img{width:300px;display:block}
@keyframes lay{from{opacity:0;transform:scale(1.03)}to{opacity:1;transform:none}}
.fl{animation:float 7s ease-in-out infinite alternate}
.fl2{animation:float 6s ease-in-out infinite alternate-reverse}
@keyframes float{from{translate:0 -5px}to{translate:0 7px}}
.tap{position:absolute;width:56px;height:56px;margin:-28px 0 0 -28px;border-radius:50%;border:3px solid rgba(58,123,213,.9);background:rgba(58,123,213,.18);opacity:0;z-index:4}
.act .tap{animation:tap 1.2s ease-out both}
@keyframes tap{0%{opacity:0;transform:scale(.4)}15%{opacity:1;transform:scale(.8)}100%{opacity:0;transform:scale(1.8)}}
.hl{position:absolute;border-radius:16px;border:3px solid #F2B33D;box-shadow:0 0 0 999px rgba(19,40,74,0);opacity:0;z-index:3}
.act .hl{animation:hl 2.4s ease both}
@keyframes hl{0%{opacity:0;transform:scale(1.08)}15%{opacity:1;transform:none}80%{opacity:1}100%{opacity:.0}}
/* scene 2: old form */
.stats{display:flex;gap:16px;margin-bottom:18px}
.stat{flex:1;background:#fff;border:1.5px solid var(--line);border-radius:20px;padding:16px 22px;box-shadow:0 10px 24px rgba(19,40,74,.07)}
.stat b{display:block;font-size:64px;line-height:1;font-weight:800;letter-spacing:-.03em;color:var(--b1)}
.stat.red b{color:var(--bad)}
.stat span{font-size:17px;color:var(--dim);font-weight:600}
.oldform{position:absolute;right:90px;top:60px;width:300px;height:600px;border-radius:18px;background:#F7F8FA;border:1.5px solid #DDE1E6;overflow:hidden;filter:grayscale(1);box-shadow:0 20px 40px rgba(19,40,74,.12)}
.oldform p{margin:0;padding:14px 18px;font-weight:800;color:#8A939E;background:#fff;border-bottom:1.5px solid #E4E7EB;position:relative;z-index:2}
.ofs{padding:16px 18px;display:grid;gap:14px}
.act .ofs{animation:scrollOld 8s linear both}
@keyframes scrollOld{to{transform:translateY(-560px)}}
.ofs i{display:block;height:34px;border-radius:8px;background:#E6E9ED;border:1px solid #DCE0E5}
.stampx{position:absolute;left:50%;top:48%;transform:translate(-50%,-50%) rotate(-12deg);font-size:30px;font-weight:900;color:var(--bad);border:4px solid var(--bad);border-radius:12px;padding:8px 16px;background:rgba(255,255,255,.85);white-space:nowrap;z-index:3;filter:none}
.act .stampx{animation:stamp .5s cubic-bezier(.3,1.6,.5,1) both}
@keyframes stamp{from{opacity:0;transform:translate(-50%,-50%) rotate(-12deg) scale(2.2)}to{opacity:1;transform:translate(-50%,-50%) rotate(-12deg) scale(1)}}
/* scene 3: code */
.codebox{display:flex;gap:12px;margin:4px 0 6px}
.codebox span{width:70px;height:86px;border-radius:16px;background:#fff;border:2px solid var(--line);display:grid;place-items:center;font-size:46px;font-weight:800;color:var(--b1);box-shadow:0 8px 20px rgba(19,40,74,.07)}
.act .codebox span{animation:pop .45s var(--e) both}
/* scene 5 and 11: paths */
.paths{display:grid;gap:12px}
.path{display:grid;grid-template-columns:56px 1fr;grid-template-rows:auto auto;column-gap:16px;align-items:center;background:#fff;border-radius:18px;padding:14px 18px;border:1.5px solid var(--line);border-left:6px solid var(--c);box-shadow:0 10px 24px rgba(19,40,74,.07)}
.path.teal{--c:var(--teal2);--bg:#E2F6F3;--fg:var(--teal)}.path.blue{--c:var(--b2);--bg:var(--sky);--fg:var(--b1)}.path.vio{--c:var(--vio);--bg:#EFEAFB;--fg:var(--vio)}
.path .pi{grid-row:1/3;width:56px;height:56px;border-radius:16px;background:var(--bg);color:var(--fg);display:grid;place-items:center}
.path .pi svg{width:28px;height:28px}
.path b{font-size:23px;font-weight:800}
.path small{font-size:16px;color:var(--dim)}
.toportal{display:grid;gap:4px;justify-items:start}
.toportal .path{width:440px}
.arrow{display:block;width:4px;height:44px;margin-left:44px;border-radius:4px;background:linear-gradient(var(--teal2),var(--b2));transform-origin:50% 0;transform:scaleY(0)}
.act .arrow{animation:arr .5s ease both}
@keyframes arr{to{transform:scaleY(1)}}
/* scene 6: invoice */
.inv{display:flex;gap:22px;align-items:flex-start}
.paper{position:relative;width:210px;height:270px;background:#fff;border-radius:10px;border:1.5px solid var(--line);padding:18px 16px;box-shadow:0 16px 30px rgba(19,40,74,.12);overflow:hidden;flex:none}
.paper b{display:block;font-size:15px}.paper small{display:block;font-size:12px;color:var(--dim);margin-bottom:14px}
.paper i{display:block;height:9px;border-radius:5px;background:#E6EDF6;margin:12px 0}.paper i.s{width:60%}
.scan{position:absolute;left:0;right:0;top:-30px;height:30px;background:linear-gradient(transparent,rgba(31,168,160,.55));border-bottom:3px solid var(--teal2);opacity:0}
.act .scan{animation:scan 1.8s ease-in-out both}
@keyframes scan{0%{opacity:1;top:-30px}100%{opacity:1;top:270px}}
.chips{display:grid;gap:9px;flex:1}
.chip{display:flex;justify-content:space-between;align-items:center;background:#fff;border:1.5px solid var(--line);border-radius:12px;padding:9px 14px;box-shadow:0 8px 18px rgba(19,40,74,.06)}
.chip small{font-size:14px;color:var(--dim);font-weight:700;text-transform:uppercase;letter-spacing:.06em}
.chip b{font-size:19px;color:var(--teal)}
/* scene 7: agent */
.steps{display:grid;gap:12px}
.st{display:flex;align-items:center;gap:16px;background:#fff;border:1.5px solid var(--line);border-radius:16px;padding:14px 18px;font-size:21px;box-shadow:0 10px 24px rgba(19,40,74,.07)}
.st b{width:40px;height:40px;border-radius:50%;display:grid;place-items:center;background:linear-gradient(135deg,var(--b2),var(--b1));color:#fff;font-size:19px;flex:none}
.st u{text-decoration:none;font-weight:800;color:var(--b1)}
.badge{display:inline-flex;align-items:center;gap:10px;margin-top:20px;padding:12px 20px;border-radius:999px;background:linear-gradient(90deg,#F2B33D,#E0962A);color:#3A2500;font-weight:800;font-size:19px;box-shadow:0 12px 26px rgba(224,150,42,.3)}
/* scene 8: flow */
.flow{position:absolute;left:470px;top:110px;width:760px;height:520px}
.form{position:absolute;left:0;top:0;width:290px;border-radius:10px;overflow:hidden;box-shadow:0 22px 44px rgba(19,40,74,.2);border:1.5px solid var(--line);background:#fff}
.act .form{animation:pop .8s var(--e) both}
.form img{width:100%;display:block}
.stamp{position:absolute;right:14px;top:150px;transform:rotate(-8deg);font-size:20px;font-weight:900;color:var(--ok);border:3px solid var(--ok);border-radius:10px;padding:6px 12px;background:rgba(255,255,255,.92);opacity:0}
.act .stamp{animation:stampG .5s cubic-bezier(.3,1.6,.5,1) both}
@keyframes stampG{from{opacity:0;transform:rotate(-8deg) scale(2)}to{opacity:1;transform:rotate(-8deg) scale(1)}}
.lines{position:absolute;left:300px;top:40px;width:170px;height:420px;overflow:visible}
.ln{fill:none;stroke:var(--b3);stroke-width:3;stroke-dasharray:6 8;opacity:0}
.act .ln{animation:lnIn 1s ease both}
@keyframes lnIn{from{opacity:0;stroke-dashoffset:120}to{opacity:1;stroke-dashoffset:0}}
.dest{position:absolute;left:475px;width:285px;display:grid;grid-template-columns:52px 1fr;column-gap:14px;align-items:center;background:#fff;border:1.5px solid var(--line);border-radius:18px;padding:14px 16px;box-shadow:0 12px 26px rgba(19,40,74,.09)}
.dest.d1{top:40px}.dest.d2{top:190px}.dest.d3{top:345px}
.dest .pi{grid-row:1/3;width:52px;height:52px;border-radius:14px;background:var(--sky);color:var(--b1);display:grid;place-items:center}
.dest b{font-size:20px}.dest small{font-size:15px;color:var(--dim);line-height:1.35}
.dest code{font-family:inherit;font-weight:800;color:var(--b1);font-size:15px}
/* scene 9: Salesforce */
.sf{position:absolute;right:70px;top:120px;width:560px;display:grid;gap:16px}
.rec{display:grid;grid-template-columns:56px 1fr 40px;gap:16px;align-items:center;background:#fff;border:1.5px solid var(--line);border-radius:20px;padding:18px 20px;box-shadow:0 14px 30px rgba(19,40,74,.09)}
.rec .pi{width:56px;height:56px;border-radius:16px;background:linear-gradient(135deg,#E8F1FD,#D7E7FB);color:var(--b1);display:grid;place-items:center}
.rec small{font-size:13px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--b2)}
.rec b{display:block;font-size:22px;margin:2px 0}.rec em{font-style:normal;font-size:15px;color:var(--dim)}
.okc{width:40px;height:40px;border-radius:50%;background:#E3F5EE;color:var(--ok);display:grid;place-items:center}
/* scene 10: documents */
.docs{position:relative;height:320px}
.doc{position:absolute;top:0;width:220px;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 18px 36px rgba(19,40,74,.18);border:1.5px solid var(--line)}
.doc img{width:100%;display:block;height:250px;object-fit:cover;object-position:top}
.doc small{display:block;padding:8px 12px;font-weight:800;font-size:15px;color:var(--b1)}
.doc.d1{left:0;transform:rotate(-4deg)}.doc.d2{left:200px;top:24px;transform:rotate(3deg)}
.act .doc.d1{animation:popR .8s var(--e) both}.act .doc.d2{animation:popR2 .8s var(--e) both}
@keyframes popR{from{opacity:0;transform:translateY(30px) rotate(-12deg)}to{opacity:1;transform:rotate(-4deg)}}
@keyframes popR2{from{opacity:0;transform:translateY(30px) rotate(10deg)}to{opacity:1;transform:rotate(3deg)}}
.sig{position:absolute;left:300px;top:250px;width:260px;height:70px;overflow:visible}
.sig path{fill:none;stroke:var(--b1);stroke-width:4;stroke-linecap:round;stroke-dasharray:900;stroke-dashoffset:900}
.act .sig path{animation:sign 1.6s ease-in-out both}
@keyframes sign{to{stroke-dashoffset:0}}
/* scene 12: test */
.testbar{display:inline-block;margin:0 0 16px;padding:10px 18px;border-radius:12px;background:var(--ambbg);border:1.5px solid #EFC24B;color:var(--amb);font-weight:800;font-size:18px;letter-spacing:.04em}
/* scene 13: close */
.close{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding-bottom:70px}
.close h1{font-size:56px;margin:18px 0 6px}
.close .lede{margin:0 0 6px}
.cmark{position:relative;width:110px;height:110px;display:grid;place-items:center}
.cmark img{width:110px;height:110px;border-radius:26px;box-shadow:0 18px 40px rgba(44,95,168,.35);position:relative;z-index:2}
.act .cmark img{animation:pop .8s var(--e) both}
.ring{position:absolute;inset:0;border-radius:30px;border:3px solid var(--b3);opacity:0}
.act .ring{animation:ringOut 2.4s ease-out both}
@keyframes ringOut{0%{opacity:.8;transform:scale(1)}100%{opacity:0;transform:scale(2.4)}}
.cta{display:flex;align-items:center;gap:24px;margin-top:6px}
.cta .url{margin-top:0}
.qr{width:120px;height:120px;border-radius:12px;box-shadow:0 12px 26px rgba(19,40,74,.15);background:#fff}
.act .qr{animation:pop .7s var(--e) both}
.conf{position:absolute;left:50%;top:44%}
.cf{position:absolute;width:10px;height:16px;border-radius:3px;opacity:0}
.act .cf{animation:conf 2.6s cubic-bezier(.15,.7,.3,1) both}
@keyframes conf{0%{opacity:1;transform:translate(0,0) rotate(0)}80%{opacity:1}100%{opacity:0;transform:translate(var(--x),calc(var(--y) + 220px)) rotate(var(--r))}}
/* captions */
.cap{position:absolute;left:70px;bottom:26px;width:720px;font-size:20px;line-height:1.38;font-weight:600;color:rgba(19,40,74,.32);background:rgba(255,255,255,.78);border:1px solid rgba(214,228,245,.9);border-radius:14px;padding:10px 16px;z-index:6}
.scene.wide .cap{width:1140px}
.cw{transition:none}
.act .cw{animation:lit .25s ease both}
@keyframes lit{to{color:var(--ink)}}
.close .cap{left:50%;transform:translateX(-50%);width:900px;text-align:center}
#ctrl{position:fixed;left:12px;bottom:12px;z-index:9;font:13px system-ui;display:flex;gap:6px}
#ctrl button{padding:6px 10px}
'''.replace('__FONT__', FONT)

wide_scenes = {1, 7, 8, 12}
secs = []
for i, s in enumerate(scenes):
    cls = 'scene wide' if i in wide_scenes else 'scene'
    secs.append(f'<section class="{cls}" data-d="{D[i]}">{s}{caption(i)}</section>')

HTML = f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Motor quotes have a new home</title>
<meta name="viewport" content="width=1280">
<style>{CSS}
{chr(10).join(styles)}</style></head>
<body>
<div id="bg"><i class="b1 grain"></i><i class="b2 grain"></i><i class="b3 grain"></i><div class="dots"></div></div>
<div class="brand"><img src="{MARK}" alt=""><span>Ricky Rampersad Branch<small>Motor quotes</small></span></div>
{chr(10).join(secs)}
<div id="ctrl"><button onclick="go(Math.max(0,cur-1))">Back</button><button onclick="paused=!paused;if(!paused)go(cur)">Play / pause</button><button onclick="go(Math.min(SC.length-1,cur+1))">Next</button></div>
<script>
var SC = Array.prototype.slice.call(document.querySelectorAll('.scene')), cur = 0, paused = false, timer = 0;
function go(n) {{
  SC.forEach(function (s, i) {{ s.classList.remove('act', 'out'); }});
  if (n > 0 && !window.__RENDER) {{ var p = SC[n - 1]; p.classList.add('act', 'out'); setTimeout(function () {{ p.classList.remove('act', 'out'); }}, 720); }}
  else if (n > 0) {{ SC[n - 1].classList.add('act', 'out'); }}
  void SC[n].offsetWidth; SC[n].classList.add('act'); cur = n;
  clearTimeout(timer);
  if (!paused && !window.__RENDER && n + 1 < SC.length) timer = setTimeout(function () {{ go(n + 1); }}, +SC[n].dataset.d);
}}
go(0);
</script>
</body></html>'''

open(OUT, 'w').write(HTML)
print('wrote', OUT, '·', len(scenes), 'scenes ·', round(sum(D) / 1000, 1), 's')
