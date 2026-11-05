#!/usr/bin/env python3
"""Draw the OFT kit launch film's page from its lines and its voice timing.

    python3 build-oftfilm.py <out.html>

5 November 2026: "do also a launch video to send with this message, apply graphics and motion". Eight scenes,
one per line of oftlaunch-lines.json, voiced as Andrew Expressive and timed from the audio (oftlaunch-timing.json).
Every screen is drawn, not captured: a made-up client, a made-up policy and a sample collation branch, so
nothing on screen is a real client. Built on build-mqfilm.py's shell and look (render.js's contract).
"""
import base64, json, os, random, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, 'oftfilm.html')
LINES = json.load(open(os.path.join(HERE, 'oftlaunch-lines.json')))
TIM = json.load(open(os.path.join(HERE, 'oftlaunch-timing.json')))
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
# The film's own mark (5 November 2026: "have the logo also reflect the scaled colors"): favicon.svg's shield and
# check, no tile, in the film's cyan and blue. Nothing is redrawn; it is the board mark's own shape recoloured.
MARK = b64(os.path.join(HERE, 'oft-mark.svg'), 'image/svg+xml')


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
    txt = LINES[n].replace('R R B, O F T', 'RRB-OFT').replace('O F T', 'OFT').split(' ')
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
    'search': '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
    'cloud': '<path d="M7 18h10a4 4 0 0 0 .5-8A6 6 0 0 0 6 9.5 4.3 4.3 0 0 0 7 18z"/>',
}


def ico(k):
    return f'<svg viewBox="0 0 24 24">{ICON[k]}</svg>'



def screen(body, cls=''):
    return f'<div class="phone fl"><div class="scr lbs {cls}">{body}</div></div>'

KIT = 'RRB-OFT-26-11-05-001'
random.seed(1105)
scenes, styles = [], []

# 1 ─ a first for the branch
n = 0
scenes.append(f"""
<div class="first">
  <div class="cmark sm"><span class="ring" style="animation-delay:200ms"></span><span class="ring" style="animation-delay:1000ms"></span><img src="{MARK}" alt=""></div>
  <p class="kick c" style="animation-delay:{at(n, 'first')}ms">A first for the branch</p>
  <h1 class="mega">{words('Every OFT kit, tracked.', at(n, 'log'), 110)}</h1>
  <div class="lab big" style="animation-delay:{at(n, 'tracking')}ms"><small>Tracking number</small><b>{''.join(f'<i style="animation-delay:{at(n, "tracking") + 55 * k}ms">{c}</i>' for k, c in enumerate(KIT))}</b></div>
  <div class="routeline"><span class="rp" style="animation-delay:{at(n, 'moment')}ms">Logged</span><svg class="route" viewBox="0 0 300 40"><path style="animation-delay:{at(n, 'moment', plus=300)}ms" d="M6 20 H294"/><circle cx="294" cy="20" r="7" style="animation-delay:{at(n, 'collation')}ms"/></svg><span class="rp c" style="animation-delay:{at(n, 'collation')}ms">Collation branch</span></div>
</div>""")

# 2 ─ collect, open, choose OFT Kit
n = 1
docs = ['Signed Script', 'Change of Beneficiary', 'OFT Kit', 'Proof of ID', 'Bank Statement', 'ACH Form']
dl = ''.join(f'<div class="dli{" on" if d == "OFT Kit" else ""}" style="animation-delay:{at(n, "open") + 80 * k}ms">{d}</div>' for k, d in enumerate(docs))
scenes.append(f"""
<div class="left">
  {head(n, 'How it works · the agent', 'Collect it. Log it.')}
  <div class="steps">
    <div class="st" style="animation-delay:{at(n, 'collect')}ms"><b>1</b><span>Collect the <u>sample</u> from your client</span></div>
    <div class="st" style="animation-delay:{at(n, 'open')}ms"><b>2</b><span>Open the <u>Log Book</u></span></div>
    <div class="st" style="animation-delay:{at(n, 'choose')}ms"><b>3</b><span>Choose <u>OFT Kit</u></span></div>
  </div>
</div>
{screen(f'<div class="sh">Log Book <small>Log documents</small></div><div class="sl">What are you handing in?</div><div class="dl">{dl}</div>' + tap(195, 352, at(n, 'kit')))}""")

# 3 ─ client and policy, one kit per line
n = 2
scenes.append(f"""
<div class="left">
  {head(n, 'Step 4 · From Salesforce', 'Your client and the policy.')}
  <div class="rows">
    {tick('Your client, from Salesforce', at(n, 'client'), 'ok', 'Picked, never typed')}
    {tick('The policy it is for', at(n, 'policy'), 'ok')}
    {tick('One kit per line', at(n, 'one'), 'ok', 'Two kits? Two lines, two numbers')}
  </div>
</div>
{screen(f"""<div class="sh">Log Book <small>Log documents</small></div>
<div class="cc" style="animation-delay:{at(n, 'client')}ms"><span class="av">JS</span><div><b>Jordan Sample</b><small>Sample client · made up</small></div></div>
<div class="it" style="animation-delay:{at(n, 'policy')}ms"><b>OFT Kit</b><small>Policy</small><div class="sel">1000 123 456 · LIFE</div>
<div class="sg" style="animation-delay:{at(n, 'one')}ms">✓ One kit per line. Its tracking number is made when you log it.</div></div>""")}""")

# 4 ─ the number
n = 3
parts = [('RRB', 'Our branch', at(n, 'r')), ('OFT', 'The kit', at(n, 'o')), ('26-11-05', "Today's date", at(n, 'date')), ('001', "The kit's own number", at(n, 'number'))]
pp = '<span class="dash">-</span>'.join(f'<span class="part" style="animation-delay:{t}ms"><b>{a}</b><small>{b}</small></span>' for a, b, t in parts)
scenes.append(f"""
<div class="numwrap">
  {head(n, 'Press log', 'Your tracking number appears.')}
  <div class="num">{pp}</div>
  <div class="badge" style="animation-delay:{at(n, 'write')}ms">{ico('take')} Write it on the kit</div>
  <p class="under" style="animation-delay:{at(n, 'write', plus=400)}ms">Never repeated. It is also in the e-mail you get.</p>
</div>""")

# 5 ─ hand it in, signed for on the phone
n = 4
scenes.append(f"""
<div class="left narrow">
  {head(n, 'Hand it in', 'Signed for. You are told.')}
</div>
<div class="flow">
  <div class="dest d1" style="animation-delay:{at(n, 'hand')}ms"><span class="pi">{ico('user')}</span><b>You</b><small>Hand the kit to sales support</small></div>
  <svg class="lines" viewBox="0 0 300 420"><path class="ln" style="animation-delay:{at(n, 'sales')}ms" d="M0 60 C120 60 160 210 300 210"/><path class="ln" style="animation-delay:{at(n, 'e-mail')}ms" d="M300 230 C160 230 120 360 0 360"/></svg>
  <div class="dest d2 r" style="animation-delay:{at(n, 'sign')}ms"><span class="pi">{ico('key')}</span><b>Sales support</b><small>Signs for it on their phone</small>
    <svg class="sig2" viewBox="0 0 220 50"><path style="animation-delay:{at(n, 'phone')}ms" d="M6 36 C24 6 34 46 50 24 S74 6 84 30 S108 46 118 22 S142 8 152 34 S180 42 214 14"/></svg></div>
  <div class="dest d3" style="animation-delay:{at(n, 'e-mail')}ms"><span class="pi">{ico('mail')}</span><b>An e-mail to you</b><small>The moment they sign</small></div>
</div>""")

# 6 ─ the transmittal and the collation branch
n = 5
kits = ''.join(f'<tr style="animation-delay:{at(n, "every") + 160 * k}ms"><td>{k + 1}</td><td><code>RRB-OFT-26-11-05-00{k + 1}</code></td><td>{c}</td><td>{p}</td></tr>'
               for k, (c, p) in enumerate([('Jordan Sample', '1000 123 456'), ('Alex Example', '1000 654 321'), ('Sam Madeup', '1000 222 333')]))
scenes.append(f"""
<div class="left narrow">
  {head(n, 'Sales support', 'One transmittal. The right branch.')}
  <div class="pick" style="animation-delay:{at(n, 'chooses')}ms"><small>Collation branch</small><b>Sample Branch</b><span>this quarter ▾</span></div>
</div>
<div class="tpaper fl2" style="animation-delay:{at(n, 'transmittal')}ms">
  <div class="th"><img src="{MARK}" alt=""><div><b>TRANSMITTAL</b><small>From: Ricky Rampersad Branch</small></div><span>No. <b>TR-261105-01</b></span></div>
  <div class="tm"><span>Department</span><b>OFT KITS (COLLATION BRANCH)</b><span>Attention</span><b class="hlb" style="animation-delay:{at(n, 'collation')}ms">Collation branch: Sample Branch</b></div>
  <table><thead><tr><th>#</th><th>Tracking #</th><th>Client</th><th>Policy</th></tr></thead><tbody>{kits}</tbody></table>
  <span class="stamp" style="animation-delay:{at(n, 'page')}ms">Ready to print</span>
</div>""")

# 7 ─ find a kit
n = 6
q = 'RRB-OFT-26-11-05-002'
typed = ''.join(f'<i style="animation-delay:{at(n, "search") + 55 * k}ms">{c}</i>' for k, c in enumerate(q))
trail = [('Logged', 'Thu 5 Nov · 9:14 am', 'By the agent', 'see', 0), ('Received', 'Thu 5 Nov · 9:40 am', 'Signed for by sales support', 'exactly', 0), ('Sent', 'Thu 5 Nov · 11:55 am', 'TR-261105-01 · Sample Branch', 'where', 0)]
tr = ''.join(f'<div class="ts" style="animation-delay:{at(n, w, plus=pl) + 250 * k}ms"><span class="td"></span><b>{a}</b><small>{b}</small><em>{c}</em></div>' for k, (a, b, c, w, pl) in enumerate(trail))
scenes.append(f"""
<div class="left">
  {head(n, 'Find a kit', 'Where is it now?')}
  <div class="srch"><span class="mg">{ico('search')}</span><span class="tq">{typed}</span><span class="caret"></span></div>
  <p class="under" style="animation-delay:{at(n, 'policy')}ms">Or search the policy, or your client's name.</p>
</div>
<div class="trail">{tr}</div>""")

# 8 ─ close
n = 7
import qrcode
qq = qrcode.QRCode(border=0, error_correction=qrcode.constants.ERROR_CORRECT_M)
qq.add_data('https://rickyrampersadbranch.com/logbook')
qq.make(fit=True)
M = qq.get_matrix()
qr = ''.join(f'M{x},{y}h1v1h-1z' for y, row in enumerate(M) for x, v in enumerate(row) if v)
conf = ''.join(
    f'<i class="cf" style="--x:{random.randint(-620, 620)}px;--y:{random.randint(-420, 260)}px;--r:{random.randint(-540, 540)}deg;'
    f'background:{random.choice(["#4C94E6", "#00E5FF", "#7FB2FF", "#2A6DE0", "#F2B33D", "#FFFFFF"])};animation-delay:{at(n, "first") + random.randint(0, 260)}ms"></i>'
    for _ in range(70))
scenes.append(f"""
<div class="close">
  <div class="cmark"><span class="ring" style="animation-delay:200ms"></span><span class="ring" style="animation-delay:900ms"></span><img src="{MARK}" alt=""></div>
  <p class="kick c" style="animation-delay:300ms">A first for our branch</p>
  <h1 class="mega">{words('Every OFT kit, logged.', at(n, 'today'), 110)}</h1>
  <div class="cta">
    <div class="url big" style="animation-delay:{at(n, 'ricky')}ms"><span class="dot"></span>rickyrampersadbranch.com/<b>logbook</b></div>
    <svg class="qr" style="animation-delay:{at(n, 'slash')}ms" viewBox="-2 -2 {len(M) + 4} {len(M) + 4}"><rect x="-2" y="-2" width="{len(M) + 4}" height="{len(M) + 4}" fill="#fff"/><path d="{qr}" fill="#13284A"/></svg>
  </div>
  <div class="conf">{conf}</div>
</div>""")

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

EXTRA = r"""
/* OFT film */
.kit{position:absolute;right:90px;top:120px;width:420px;opacity:0}
.act .kit{animation:pop .8s var(--e) both}
.kit .lid{height:34px;margin:0 18px;border-radius:12px 12px 0 0;background:linear-gradient(90deg,#2C5FA8,#4C94E6)}
.kit .box{position:relative;background:#fff;border:2px solid var(--line);border-radius:18px;padding:22px 24px 26px;box-shadow:0 26px 50px rgba(19,40,74,.18)}
.kl{display:inline-block;font-weight:900;letter-spacing:.2em;color:var(--b1);font-size:15px;background:var(--sky);padding:6px 12px;border-radius:8px}
.lab{margin-top:18px;border:2px dashed #E0962A;border-radius:14px;padding:12px 14px;background:#FFF8EA;opacity:0}
.act .lab{animation:pop .5s var(--e) both}
.lab small{display:block;font-size:12px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:var(--amb)}
.lab b{display:block;font:800 25px/1.25 'InterF',system-ui,sans-serif;color:var(--ink);letter-spacing:.02em;white-space:nowrap}
.lab b i{font-style:normal;opacity:0}
.act .lab b i{animation:typ .05s linear both}
@keyframes typ{to{opacity:1}}
.route{display:block;width:100%;height:40px;margin-top:18px;overflow:visible}
.route path{fill:none;stroke:var(--teal2);stroke-width:4;stroke-dasharray:300;stroke-dashoffset:300}
.act .route path{animation:sign 1s ease both}
.route circle{fill:var(--teal2);opacity:0}
.act .route circle{animation:pop .5s var(--e) both}
.dest2{display:block;text-align:right;font-weight:800;color:var(--teal);font-size:17px;opacity:0}
.act .dest2{animation:fadeUp .5s var(--e) both}
/* the phone screens, drawn */
.lbs{background:#0B1530;color:#E8EEF8;padding:44px 14px 0}
.sh{font-weight:800;font-size:18px;display:flex;justify-content:space-between;align-items:baseline;padding:0 4px 12px;border-bottom:1px solid rgba(255,255,255,.12)}
.sh small{font-size:11px;font-weight:700;color:#6FA8FF;letter-spacing:.06em;text-transform:uppercase}
.sl{font-size:13px;color:#9FB2CF;margin:14px 4px 8px}
.dl{display:grid;gap:8px}
.dli{padding:12px 14px;border-radius:12px;background:#14214A;border:1px solid rgba(111,168,255,.18);font-weight:600;font-size:15px;opacity:0}
.act .dli{animation:fadeUp .4s var(--e) both}
.dli.on{background:linear-gradient(90deg,#2A6DE0,#13408F);border-color:#6FA8FF;font-weight:800}
.cc{display:flex;gap:12px;align-items:center;margin:16px 2px;padding:12px;border-radius:14px;background:#14214A;opacity:0}
.act .cc,.act .it{animation:pop .6s var(--e) both}
.av{width:42px;height:42px;border-radius:50%;display:grid;place-items:center;background:#2A6DE0;font-weight:800}
.cc b{display:block}.cc small{color:#9FB2CF;font-size:12px}
.it{padding:14px;border-radius:14px;background:#14214A;border:1px solid #6FA8FF;opacity:0}
.it b{font-size:17px}.it small{display:block;margin-top:10px;font-size:12px;color:#9FB2CF}
.sel{margin-top:4px;padding:10px 12px;border-radius:10px;background:#0B1530;border:1px solid rgba(255,255,255,.18);font-size:14px}
.sg{margin-top:12px;font-size:13px;line-height:1.4;color:#7FF0DF;opacity:0}
.act .sg{animation:fadeUp .5s var(--e) both}
/* the number */
.numwrap{position:absolute;left:70px;right:70px;top:110px}
.num{display:flex;align-items:flex-start;gap:6px;margin:22px 0 26px}
.part{display:flex;flex-direction:column;align-items:center;opacity:0}
.act .part{animation:pop .6s var(--e) both}
.part b{font:800 64px/1 'InterF',system-ui,sans-serif;color:var(--b1);background:#fff;border:2px solid var(--line);border-radius:18px;padding:14px 18px;box-shadow:0 14px 30px rgba(19,40,74,.1)}
.part:last-child b{color:var(--teal);border-color:var(--teal2)}
.part small{margin-top:10px;font-size:16px;font-weight:700;color:var(--dim)}
.dash{font:800 54px/1 'InterF',system-ui,sans-serif;color:var(--dim);padding-top:22px}
/* hand in */
.dest.r{left:auto;right:0}
.flow .dest.d1{left:0;top:40px}.flow .dest.d2{top:180px;left:400px}.flow .dest.d3{left:0;top:330px}
.flow{left:540px;top:150px}
.flow .lines{left:285px;width:115px}
.sig2{display:block;grid-column:1/3;width:100%;height:46px;margin-top:6px;overflow:visible}
.sig2 path{fill:none;stroke:var(--b1);stroke-width:3.5;stroke-linecap:round;stroke-dasharray:700;stroke-dashoffset:700}
.act .sig2 path{animation:sign 1.4s ease-in-out both}
/* transmittal */
.pick{display:inline-grid;gap:2px;margin-top:6px;padding:14px 18px;border-radius:16px;background:#fff;border:2px solid var(--teal2);box-shadow:0 12px 26px rgba(19,40,74,.09);opacity:0}
.act .pick{animation:pop .6s var(--e) both}
.pick small{font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--teal)}
.pick b{font-size:26px}.pick span{font-size:15px;color:var(--dim)}
.tpaper{position:absolute;right:60px;top:90px;width:640px;background:#fff;border-radius:12px;border:1.5px solid var(--line);box-shadow:0 26px 50px rgba(19,40,74,.18);padding:22px 24px;opacity:0}
.act .tpaper{animation:pop .8s var(--e) both}
.th{display:flex;align-items:center;gap:12px;border-bottom:2px solid var(--ink);padding-bottom:12px}
.th img{width:40px;height:40px;border-radius:9px}
.th b{display:block;font-size:20px;letter-spacing:.06em}.th small{font-size:12px;color:var(--dim)}
.th>span{margin-left:auto;font-size:13px;color:var(--dim)}.th>span b{display:inline;font-size:16px;color:var(--ink)}
.tm{display:grid;grid-template-columns:110px 1fr;gap:6px 12px;margin:14px 0;font-size:14px}
.tm span{color:var(--dim);font-weight:700;text-transform:uppercase;font-size:11px;letter-spacing:.1em;padding-top:3px}
.hlb{background:transparent;border-radius:6px;padding:0 4px}
.act .hlb{animation:hlb .8s ease both}
@keyframes hlb{from{background:transparent}to{background:#FFF2CC}}
.tpaper table{width:100%;border-collapse:collapse;font-size:14px}
.tpaper th{text-align:left;font-size:11px;letter-spacing:.1em;color:var(--dim);border-bottom:1.5px solid var(--line);padding:6px}
.tpaper td{padding:9px 6px;border-bottom:1px solid #EEF2F8}
.tpaper tr{opacity:1}
.tpaper tbody tr{opacity:0}
.act .tpaper tbody tr{animation:fadeUp .45s var(--e) both}
.tpaper code{font:700 14px 'InterF',system-ui,sans-serif;color:var(--b1)}
.tpaper{padding-bottom:64px}
.tpaper .stamp{top:auto;bottom:16px;right:22px}
/* find a kit */
.srch{max-width:560px;display:flex;align-items:center;gap:12px;background:#fff;border:2px solid var(--b2);border-radius:16px;padding:14px 18px;box-shadow:0 12px 26px rgba(19,40,74,.1);font:700 24px 'InterF',system-ui,sans-serif;color:var(--ink)}
.mg{color:var(--b2)}.mg svg{width:26px;height:26px;fill:none;stroke:currentColor;stroke-width:2.4}
.tq i{font-style:normal;opacity:0}
.act .tq i{animation:typ .05s linear both}
.caret{width:3px;height:28px;background:var(--b2);animation:blink 1s steps(1) infinite}
@keyframes blink{50%{opacity:0}}
.trail{position:absolute;right:80px;top:150px;width:470px;display:grid;gap:18px;padding-left:28px;border-left:4px solid var(--line)}
.ts{position:relative;background:#fff;border:1.5px solid var(--line);border-radius:16px;padding:14px 18px;box-shadow:0 12px 26px rgba(19,40,74,.08);opacity:0}
.act .ts{animation:pop .6s var(--e) both}
.td{position:absolute;left:-42px;top:20px;width:24px;height:24px;border-radius:50%;background:var(--teal2);border:4px solid #F2F7FD}
.ts b{font-size:22px;display:block}.ts small{font-size:15px;color:var(--b1);font-weight:700}.ts em{display:block;font-style:normal;font-size:15px;color:var(--dim)}
"""

THEME = r"""
/* the midnight look (5 November 2026: "more refined … scaled … another first … the fonts refine for a better and powerful impact") */
:root{--ink:#F4F7FF;--body:#C8D5EC;--dim:#93A7C9;--line:rgba(127,178,255,.22);--sky:rgba(127,178,255,.14);--b1:#8DBBFF;--b2:#5AA2FF;--b3:#7FB2FF;
  --teal:#3FE0D0;--teal2:#2BC6B8;--ok:#3FE0A4;--bad:#FF7A66;--card:rgba(20,38,80,.74);--cy:#00E5FF}
html,body{background:#081431;font-feature-settings:"ss01","cv11";font-variant-numeric:tabular-nums}
#bg .b1{background:radial-gradient(closest-side,rgba(42,109,224,.55),transparent)}
#bg .b2{background:radial-gradient(closest-side,rgba(0,229,255,.22),transparent)}
#bg .b3{background:radial-gradient(closest-side,rgba(108,75,194,.28),transparent)}
#bg .dots{background-image:radial-gradient(rgba(127,178,255,.16) 1.2px,transparent 1.3px);opacity:.55}
#bg::after{content:"";position:absolute;inset:0;background:radial-gradient(ellipse at 50% 120%,rgba(8,20,49,0) 40%,rgba(4,10,26,.65));pointer-events:none}
.brand{color:#fff}.brand small{color:var(--cy)}
.scene.act{animation:sIn .75s var(--e) both,push var(--pd,9s) linear both}
@keyframes push{from{scale:1}to{scale:1.035}}
h1{font-size:62px;font-weight:850;letter-spacing:-.038em;line-height:1.02;color:#fff;text-wrap:balance}
h1.mega{font-size:86px;letter-spacing:-.045em;color:#fff;text-shadow:0 0 42px rgba(90,162,255,.45)}
h1.mega .w:last-child{color:var(--cy)}
.kick{color:var(--cy);font-size:15px;letter-spacing:.22em}
.kick:before{background:linear-gradient(90deg,var(--cy),var(--b2))}
.kick.c{justify-content:center}
.lede{color:var(--body)}.under{color:var(--dim)}
.row,.stat,.st,.path,.dest,.rec,.chip,.pick,.ts,.strike,.codebox span{background:var(--card);border-color:var(--line);box-shadow:0 18px 40px rgba(2,8,24,.45),inset 0 1px 0 rgba(255,255,255,.06);backdrop-filter:none}
.row b,.st,.dest b,.ts b,.pick b{color:#fff}
.st u{color:var(--cy)}
.st b{background:linear-gradient(135deg,#2A6DE0,#00B4D8)}
.ri{background:rgba(63,224,164,.16)}
.dest .pi,.rec .pi{background:rgba(90,162,255,.16);color:var(--b1)}
.ts small{color:var(--cy)}
.td{border-color:#081431;background:var(--cy);box-shadow:0 0 0 6px rgba(0,229,255,.15)}
.trail{border-left-color:rgba(127,178,255,.25)}
.ln{stroke:var(--cy)}
.badge{background:linear-gradient(90deg,#FFC94D,#F2A93B);color:#2A1A00}
.url{background:linear-gradient(90deg,#2A6DE0,#00A8D6);box-shadow:0 18px 40px rgba(0,168,214,.35)}
.srch{background:var(--card);border-color:var(--cy);color:#fff;box-shadow:0 0 0 6px rgba(0,229,255,.08),0 18px 40px rgba(2,8,24,.45)}
.mg{color:var(--cy)}.caret{background:var(--cy)}
.pick{border-color:var(--cy)}.pick small{color:var(--cy)}
.phone{background:linear-gradient(160deg,#3B78E0,#13408F);box-shadow:0 40px 80px rgba(2,8,24,.6),0 0 0 1px rgba(127,178,255,.3),inset 0 0 0 2px rgba(255,255,255,.18)}
.tpaper{box-shadow:0 40px 80px rgba(2,8,24,.6)}
.tpaper,.tpaper td,.tpaper th{color:#13284A}
.tpaper .th small,.tpaper .tm span,.tpaper th{color:#5D6F86}
.tpaper code{color:#2C5FA8}
.tpaper .th>span b,.tpaper .tm b,.tpaper .th b{color:#13284A}
/* the number */
.part b{white-space:nowrap;background:var(--card);border:1.5px solid var(--line);color:#fff;font-size:72px;font-weight:850;letter-spacing:-.02em;padding:16px 24px;border-radius:22px;box-shadow:0 22px 50px rgba(2,8,24,.5)}
.part:last-child b{color:var(--cy);border-color:rgba(0,229,255,.55);box-shadow:0 0 40px rgba(0,229,255,.25),0 22px 50px rgba(2,8,24,.5)}
.part small{color:var(--body);font-size:17px}
.dash{color:var(--dim);font-size:56px;padding-top:26px}
.lab b{font-weight:850;letter-spacing:-.005em}
/* the opening and the close */
.first{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding-bottom:110px}
.first h1.mega{margin:4px 0 26px}
.cmark.sm{width:84px;height:84px;margin-bottom:22px}.cmark.sm img{width:84px;height:84px;border-radius:20px}
.ring{border-color:var(--cy)}
.lab.big{margin-top:0;padding:16px 26px;background:rgba(255,201,77,.08);border-color:#FFC94D}
.lab.big small{color:#FFC94D}
.lab.big b{font-size:40px;color:#fff}
.routeline{display:flex;align-items:center;gap:14px;margin-top:22px;width:640px}
.routeline .route{flex:1;margin:0}
.rp{font-weight:800;font-size:18px;color:var(--body);opacity:0}.rp.c{color:var(--cy)}
.act .rp{animation:fadeUp .5s var(--e) both}
.route path{stroke:var(--cy)}.route circle{fill:var(--cy)}
.close h1.mega{font-size:72px;margin:6px 0 10px}
.kit .box{background:#fff}
.cap{background:rgba(8,20,49,.72);border-color:rgba(127,178,255,.2);color:rgba(244,247,255,.32);font-size:21px;backdrop-filter:none}
@keyframes lit{to{color:#fff}}
.first .cap,.close .cap{}
.brand img{border-radius:0;filter:drop-shadow(0 0 10px rgba(0,229,255,.45))}
.cmark img{border-radius:0;box-shadow:none;filter:drop-shadow(0 0 26px rgba(0,229,255,.55)) drop-shadow(0 14px 30px rgba(2,8,24,.6))}
.cmark.sm img{width:96px;height:96px}.cmark.sm{width:96px;height:96px}
.ring{border-radius:50%}
.th img{border-radius:0}
"""

wide_scenes = {0, 3, 4, 5, 6, 7}
secs = []
for i, s in enumerate(scenes):
    cls = 'scene wide' if i in wide_scenes else 'scene'
    secs.append(f'<section class="{cls}" data-d="{D[i]}" style="--pd:{D[i]}ms">{s}{caption(i)}</section>')

HTML = f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>OFT kits, in the Log Book</title>
<meta name="viewport" content="width=1280">
<style>{CSS}
{EXTRA}
{THEME}
{chr(10).join(styles)}</style></head>
<body>
<div id="bg"><i class="b1 grain"></i><i class="b2 grain"></i><i class="b3 grain"></i><div class="dots"></div></div>
<div class="brand"><img src="{MARK}" alt=""><span>Ricky Rampersad Branch<small>Log Book · OFT kits</small></span></div>
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
