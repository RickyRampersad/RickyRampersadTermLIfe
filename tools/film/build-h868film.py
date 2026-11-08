#!/usr/bin/env python3
"""Draw the HELP 868 launch film's page (1080x1920, for the branch's WhatsApp group) from its lines and voice timing.

    python3 build-h868film.py <out.html>

Asked for on 4 November 2026 ("a launch video for our site to shout out what's app agents ... like a video like
this", a promo with big moving headlines and chat bubbles popping in). Ten scenes, one per line of
h868-lines.json, timed from the audio (h868-timing.json: each clip's length and every word's start), so every
reveal lands on the word that names it. The page keeps render.js's contract: SC, go(n), paused, timer, .act on the
live scene, .out on the one handing over, .cnt counters, the drifting background as .grain.

Nothing on screen is a real client: the names, the policy line and the reference are made up. Never put a real
client name, number or reference in an MP4 at a public URL. The reference shown is a made-up pattern.
Captions are burned over the frame by the mixer (capmode over), so the scenes keep the bottom fifth clear.
"""
import base64, json, os, random, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, 'h868film.html')
LINES = json.load(open(os.path.join(HERE, 'h868-lines.json')))
TIMF = os.path.join(HERE, 'h868-timing.json')
if os.path.exists(TIMF):
    TIM = [{'clip': int(x['len'] * 1000), 'words': [[int(w[0] * 1000), w[1]] for w in x['words']]} for x in json.load(open(TIMF))['lines']]
else:   # a layout preview only: words spread evenly, 0.34 s apart
    TIM = []
    for t in LINES:
        ws = t.split()
        TIM.append({'clip': int(len(ws) * 340 + 400), 'words': [[i * 340, w] for i, w in enumerate(ws)]})
OFF, AIR = 400, 1150
D = [OFF + t['clip'] + AIR for t in TIM]
D[0] += 500
D[-1] += 3000


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
MARK = b64(os.path.join(ROOT, 'help868', 'mark.svg'), 'image/svg+xml')

WA = ('<svg viewBox="0 0 24 24" class="wa"><path d="M12 2.5a9.5 9.5 0 0 0-8.2 14.3L2.5 21.5l4.8-1.25A9.5 9.5 0 1 0 12 2.5z"/>'
      '<g transform="translate(6.3 6.3) scale(.5)"><path stroke-width="3.4" fill="#fff" d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></g></svg>')

ICON = {
    'ok': '<path d="M5 12.5l4.2 4.2L19 7"/>',
    'x': '<path d="M7 7l10 10M17 7L7 17"/>',
    'user': '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
    'desk': '<path d="M3 10h18M5 10v9M19 10v9M8 6h8l2 4H6z"/>',
    'doc': '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h3"/>',
    'share': '<circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8.2 10.8l7.6-3.6M8.2 13.2l7.6 3.6"/>',
    'clock': '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    'lock': '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
}


def ico(k):
    return f'<svg viewBox="0 0 24 24" class="ic">{ICON[k]}</svg>'


def words(text, base, step=80, cls='w'):
    return ' '.join(f'<span class="{cls}" style="animation-delay:{base + i * step}ms">{w}</span>' for i, w in enumerate(text.split(' ')))


def head(kicker, title, base=250):
    return f'<p class="kick" style="animation-delay:{base}ms">{kicker}</p><h1>{words(title, base + 120)}</h1>'


def bub(who, text, t, cls=''):
    return f'<div class="b {who} {cls}" style="animation-delay:{t}ms">{text}</div>'


def chatwin(inner, title='HELP 868', sub='Ricky Rampersad Branch'):
    return (f'<div class="phone fl"><div class="topbar">{WA}<span><b>{title}</b><small>{sub}</small></span></div>'
            f'<div class="chat">{inner}</div></div>')


random.seed(868)
scenes = []

# 1 ─ meet HELP 868
n = 0
scenes.append(f"""
<div class="center">
  <div class="logo" style="animation-delay:150ms"><span class="ring"></span><span class="ring r2"></span>{WA}</div>
  <p class="kick" style="animation-delay:{at(n, 'smarter') - 300}ms">Now smarter · on WhatsApp</p>
  <h1 class="huge">{words('Meet HELP 868', 300, 160)}</h1>
  <p class="lede" style="animation-delay:{at(n, 'your')}ms">Your branch, on WhatsApp.</p>
  <div class="pill live" style="animation-delay:{at(n, 'any')}ms"><i></i>Here any hour of the day</div>
</div>""")

# 2 ─ one tap
n = 1
scenes.append(f"""
<div class="center">
  {head('For your clients', 'One tap and the chat opens.')}
  <div class="site fl">
    <div class="sbar"><i></i><i></i><i></i><span>rickyrampersadbranch.com</span></div>
    <div class="sbody"><b>Protecting your family</b><i></i><i class="s"></i><i></i><i class="s"></i></div>
    <div class="fab" style="animation-delay:{at(n, 'green') - 200}ms">{WA}<u class="tapx" style="animation-delay:{at(n, 'tap', plus=100)}ms"></u></div>
  </div>
  <div class="rows">
    <div class="tg" style="animation-delay:{at(n, 'app')}ms">{ico('x')}<span>No app to download</span></div>
    <div class="tg" style="animation-delay:{at(n, 'forms')}ms">{ico('x')}<span>No forms to fill</span></div>
  </div>
</div>""")

# 3 ─ the welcome and the tap menu
n = 2
menu = ''.join(f'<li class="btn" style="animation-delay:{at(n, w) + 100}ms">{t}</li>' for w, t in
    [('question', 'A question about my policy'), ('claim', 'Make or check a claim'), ('update', 'Update my details'),
     ('payment', 'Pay or check a premium'), ('quote', 'Get a quote')])
scenes.append(f"""
<div class="center">
  {head('The welcome', 'We say hello. They tap.')}
  {chatwin(bub('in', '<b>Hello and welcome to Ricky Rampersad Branch!</b> What can we help you with today?', at(n, 'say')) +
           f'<div class="b in menu" style="animation-delay:{at(n, 'menu') + 200}ms"><ul>{menu}</ul></div>')}
</div>""")

# 4 ─ every question is a tap
n = 3
scenes.append(f"""
<div class="center">
  {head('The easy part', 'Every question is a tap.')}
  {chatwin(bub('in', '<b>Is it urgent?</b>', 120) +
           f'<div class="b in menu" style="animation-delay:{at(n, 'urgent') + 150}ms"><ul><li class="btn" style="animation-delay:{at(n, 'urgent') + 250}ms">Yes, it is urgent</li><li class="btn" style="animation-delay:{at(n, 'urgent') + 400}ms">No, it can wait</li></ul></div>' +
           bub('out', 'No, it can wait', at(n, 'one'), 'tapd') +
           bub('in', '<b>Thanks! What is your name?</b>', at(n, 'nobody')))}
  <div class="rows">
    <div class="tg" style="animation-delay:{at(n, 'nobody')}ms">{ico('x')}<span>Nobody types a number</span></div>
    <div class="tg" style="animation-delay:{at(n, 'nothing')}ms">{ico('x')}<span>Nothing asked twice</span></div>
  </div>
</div>""")

# 5 ─ privacy
n = 4
scenes.append(f"""
<div class="center">
  {head('Safe by design', 'Only what we need.')}
  <div class="two">
    <div class="col yes">
      <p class="cl" style="animation-delay:{at(n, 'only') - 250}ms">We ask for</p>
      <div class="tg ok" style="animation-delay:{at(n, 'name')}ms">{ico('user')}<span>Their name</span></div>
      <div class="tg ok" style="animation-delay:{at(n, 'policy')}ms">{ico('doc')}<span>Policy number, if they have one</span></div>
    </div>
    <div class="col no">
      <p class="cl" style="animation-delay:{at(n, 'never') - 250}ms">We never ask for</p>
      <div class="tg bad" style="animation-delay:{at(n, 'bank')}ms">{ico('lock')}<span>Bank or card details</span></div>
      <div class="tg bad" style="animation-delay:{at(n, 'i', 2)}ms">{ico('lock')}<span>ID numbers</span></div>
    </div>
  </div>
</div>""")

# 6 ─ lands on Query Pal
n = 5
scenes.append(f"""
<div class="center">
  {head('Logged, not lost', 'It lands on Query Pal.')}
  <div class="ticket fl" style="animation-delay:{at(n, 'query', 1)}ms">
    <small>Ticket reference</small>
    <b class="ref">RRB / 2026 / <span class="cnt" data-to="418" data-at="{at(n, 'reference')}">418</span></b>
    <div class="trow"><span>{ico('doc')}Request logged</span><em>just now</em></div>
  </div>
  <svg class="arrow" viewBox="0 0 40 120"><path d="M20 4v100M8 92l12 14 12-14" style="animation-delay:{at(n, 'and')}ms"/></svg>
  <div class="dept" style="animation-delay:{at(n, 'right')}ms">{ico('desk')}<span><b>The right department</b><small>Routed automatically</small></span></div>
</div>""")

# 7 ─ receipt card + email
n = 6
scenes.append(f"""
<div class="center">
  {head('Right in their hand', 'A receipt card, and an email.')}
  {chatwin(bub('in', "✅ <b>Request logged</b><br>🎫 Reference: <b>RRB/2026/418</b><br>📌 Request: Claim<br>⏱ Target: 2 working days<br>🔄 <i>Logged ▸ With our team ▸ Resolved</i>", at(n, 'receipt')))}
  <div class="tg ok mailtag" style="animation-delay:{at(n, 'email')}ms">{ico('doc')}<span>Same confirmation, by email</span></div>
</div>""")

# 8 ─ team sees it + pal
n = 7
scenes.append(f"""
<div class="center">
  {head('Behind the scenes', 'Our team has the whole story.')}
  <div class="inbox fl">
    <div class="ihead"><b>Client Support</b><span class="dot"></span></div>
    <div class="irow" style="animation-delay:{at(n, 'support')}ms"><span class="av">C</span><div><b>New client chat</b><small>Claim · routine</small></div><em>now</em></div>
    <div class="note" style="animation-delay:{at(n, 'details')}ms"><small>Filled in for us</small>Reference · request · policy · email · opened date.</div>
    <div class="take" style="animation-delay:{at(n, 'pal')}ms">{ico('ok')}Query Pal + a pal to work with</div>
  </div>
</div>""")

# 9 ─ close and rate
n = 8
stars = ''.join(f'<span class="star" style="animation-delay:{at(n, "star") + 120 * i}ms">★</span>' for i in range(5))
scenes.append(f"""
<div class="center">
  {head('Closed properly', 'Resolved. Then rated.')}
  {chatwin(bub('in', "✅ <b>Resolved</b><br>Reference RRB/2026/418<br>Here is what we did for you.", at(n, 'summary')) +
           f'<div class="b in" style="animation-delay:{at(n, 'star') - 200}ms"><b>How did we do?</b><div class="stars">{stars}</div></div>')}
  <div class="tg ok mailtag" style="animation-delay:{at(n, 'low')}ms">{ico('ok')}<span>Low rating? We call back</span></div>
</div>""")

# 10 ─ reminders
n = 9
dots = ''.join(f'<div class="rem" style="animation-delay:{at(n, "every") + 450 * i}ms"><b>{i * 3 + 3}</b><small>working days</small><span>Update sent</span></div>' for i in range(3))
scenes.append(f"""
<div class="center">
  {head('We stay on it', 'Never quiet.')}
  <div class="remrow">{dots}</div>
  <p class="under" style="animation-delay:{at(n, 'done')}ms">A friendly update, until it's done.</p>
</div>""")

# 11 ─ for agents + first client
n = 10
scenes.append(f"""
<div class="center">
  {head('For agents', 'Share the link.')}
  <div class="share fl">
    <div class="url" style="animation-delay:{at(n, 'link')}ms"><span class="dot"></span>rickyrampersadbranch.com/<b>help868</b></div>
    <div class="srow" style="animation-delay:{at(n, 'first')}ms">{ico('user')}<span><b>First client welcomed</b><small>Our first client is on board</small></span></div>
    <div class="srow" style="animation-delay:{at(n, 'insights')}ms">{ico('share')}<span><b>Insights coming soon</b><small>Right here on the wall</small></span></div>
  </div>
</div>""")

# 12 ─ close
n = 11
import qrcode
q = qrcode.QRCode(border=0, error_correction=qrcode.constants.ERROR_CORRECT_M)
q.add_data('https://rickyrampersadbranch.com/help868/')
q.make(fit=True)
M = q.get_matrix()
qr = ''.join(f'M{x},{y}h1v1h-1z' for y, row in enumerate(M) for x, v in enumerate(row) if v)
conf = ''.join(
    f'<i class="cf" style="--x:{random.randint(-480, 480)}px;--y:{random.randint(-380, 160)}px;--r:{random.randint(-540, 540)}deg;'
    f'background:{random.choice(["#25D366", "#00CFEA", "#fff", "#7FE3B0", "#8FB8FF"])};animation-delay:{at(n, 'always') + random.randint(0, 260)}ms"></i>'
    for _ in range(60))
scenes.append(f'''
<div class="center close">
  <div class="logo sm" style="animation-delay:150ms"><span class="ring"></span><span class="ring r2"></span>{WA}</div>
  <h1 class="huge">{words('Always on. Always us.', at(n, 'always') - 200, 170)}</h1>
  <p class="lede" style="animation-delay:{at(n, 'tap')}ms">Tap the green button and say hello.</p>
  <div class="cta">
    <div class="url" style="animation-delay:{at(n, 'website')}ms"><span class="dot"></span>rickyrampersadbranch.com/<b>help868</b></div>
    <svg class="qr" style="animation-delay:{at(n, 'say')}ms" viewBox="-2 -2 {len(M) + 4} {len(M) + 4}"><rect x="-2" y="-2" width="{len(M) + 4}" height="{len(M) + 4}" fill="#fff"/><path d="{qr}" fill="#0d1f33"/></svg>
  </div>
  <div class="conf">{conf}</div>
</div>''')

CSS = r'''
@font-face{font-family:'InterF';font-weight:100 900;src:url(__FONT__) format('woff2')}
:root{--navy:#0d1f33;--navy2:#14314f;--card:#1b4268;--card2:#22527f;--ink:#fff;--mut:#b9cadd;--g:#25D366;--g2:#128c7e;--t:#00CFEA;--e:cubic-bezier(.2,.8,.2,1)}
*{box-sizing:border-box;margin:0}
html,body{width:1080px;height:1920px;overflow:hidden;background:var(--navy);font-family:InterF,system-ui,sans-serif;color:var(--ink)}
body{position:relative}
#bg{position:absolute;inset:0;overflow:hidden;background:linear-gradient(180deg,#0d1f33,#14314f 60%,#0d1f33)}
#bg i{position:absolute;border-radius:50%}
#bg .b1{width:1100px;height:1100px;left:-420px;top:-300px;background:radial-gradient(closest-side,rgba(37,211,102,.30),transparent);animation:drift 24s ease-in-out infinite alternate}
#bg .b2{width:1000px;height:1000px;right:-420px;top:700px;background:radial-gradient(closest-side,rgba(0,207,234,.22),transparent);animation:drift 29s ease-in-out infinite alternate-reverse}
#bg .b3{width:800px;height:800px;left:-200px;bottom:-300px;background:radial-gradient(closest-side,rgba(138,98,196,.22),transparent);animation:drift 21s ease-in-out infinite alternate}
@keyframes drift{from{transform:translate(0,0)}to{transform:translate(90px,70px)}}
.scene{position:absolute;inset:0;visibility:hidden}
.scene.act{visibility:visible;animation:sIn .7s var(--e) both}
.scene.out{animation:sOut .72s ease both;z-index:0}
.scene.act:not(.out){z-index:2}
@keyframes sIn{from{opacity:0;transform:scale(1.06)}to{opacity:1;transform:none}}
@keyframes sOut{from{opacity:1;transform:none}to{opacity:0;transform:scale(.94)}}
.brand{position:absolute;left:60px;top:54px;display:flex;align-items:center;gap:16px;z-index:8;font-weight:700;font-size:30px}
.brand img{width:62px;height:62px;border-radius:16px}
.brand small{display:block;font-size:22px;color:var(--mut);font-weight:600}
.center{position:absolute;left:60px;right:60px;top:170px;bottom:380px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}
.kick,.lede,.under,.pill,.tg,.rows,.url,.dept,.ticket,.arrow,.cta,.logo,.li{opacity:0}
.act .kick,.act .lede,.act .under,.act .pill,.act .tg,.act .url,.act .dept,.act .ticket,.act .logo{animation:rise .6s var(--e) both}
.act .arrow{animation:fadeo .4s ease both}
@keyframes rise{from{opacity:0;transform:translateY(40px) scale(.96)}to{opacity:1;transform:none}}
@keyframes fadeo{to{opacity:1}}
.kick{font-size:30px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:var(--g);margin-bottom:22px}
h1{font-size:92px;line-height:1.04;font-weight:900;letter-spacing:-.02em;max-width:940px}
h1.huge{font-size:150px;line-height:1}
.w{display:inline-block;opacity:0}
.act .w{animation:wIn .6s var(--e) both}
@keyframes wIn{from{opacity:0;transform:translateY(60px) scale(.9);filter:blur(10px)}to{opacity:1;transform:none;filter:none}}
.lede{font-size:50px;font-weight:600;color:var(--mut);margin-top:26px}
.under{font-size:40px;font-weight:600;color:var(--mut);margin-top:34px}
.pill{display:inline-flex;align-items:center;gap:16px;margin-top:40px;padding:18px 32px;border-radius:999px;background:rgba(37,211,102,.16);border:2px solid var(--g);font-size:36px;font-weight:700}
.pill i{width:16px;height:16px;border-radius:50%;background:var(--g)}
.act .pill i{animation:beat 1.4s ease-in-out infinite}
@keyframes beat{50%{transform:scale(1.7);opacity:.5}}
/* logo */
.logo{position:relative;width:240px;height:240px;border-radius:60px;background:linear-gradient(135deg,#2fe27b,#128c7e);display:grid;place-items:center;margin-bottom:40px;box-shadow:0 24px 60px rgba(4,14,26,.5)}
.logo.sm{width:170px;height:170px;border-radius:44px}
.logo .wa{width:66%;height:66%;fill:none;stroke:#fff;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
.ring{position:absolute;inset:0;border-radius:60px;border:4px solid var(--g);opacity:0}
.act .ring{animation:ringo 2.6s ease-out infinite}.act .ring.r2{animation-delay:1.1s}
@keyframes ringo{0%{opacity:.8;transform:scale(1)}100%{opacity:0;transform:scale(1.9)}}
/* phone + chat */
.phone{width:820px;margin-top:40px;border-radius:56px;background:#0b1a2b;border:6px solid #2d5b8a;overflow:hidden;box-shadow:0 40px 90px rgba(4,14,26,.55)}
.topbar{display:flex;align-items:center;gap:20px;padding:26px 30px;background:#128c7e}
.topbar .wa{width:64px;height:64px;fill:none;stroke:#fff;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
.topbar b{display:block;font-size:34px}.topbar small{font-size:24px;opacity:.85}
.chat{padding:30px 28px 34px;display:flex;flex-direction:column;gap:20px;background:#0f2438;text-align:left;min-height:430px}
.b{max-width:84%;padding:22px 28px;border-radius:30px;font-size:34px;line-height:1.35;opacity:0}
.b.in{align-self:flex-start;background:#fff;color:#0d1f33;border-top-left-radius:8px}
.b.out{align-self:flex-end;background:#d9fdd3;color:#0d1f33;border-top-right-radius:8px}
.b.big{font-size:52px;font-weight:800;padding:14px 40px}
.act .b{animation:pop .55s var(--e) both}
@keyframes pop{from{opacity:0;transform:translateY(40px) scale(.8)}to{opacity:1;transform:none}}
.b.menu{padding:18px 28px}.menu ol{list-style:none;padding:0;display:grid;gap:12px;font-size:32px}
.menu li{display:flex;gap:16px;align-items:center;opacity:0}
.act .menu li{animation:rise .5s var(--e) both}
.menu li b{width:44px;height:44px;border-radius:50%;background:#128c7e;color:#fff;display:grid;place-items:center;font-size:26px;flex:none}
.fl{animation:flo 5s ease-in-out infinite alternate}
@keyframes flo{from{transform:translateY(0)}to{transform:translateY(-12px)}}
/* rows */
.rows{display:grid;gap:16px;margin-top:40px;opacity:1}
.tg{display:flex;align-items:center;gap:20px;padding:18px 30px;border-radius:22px;background:var(--card);border:2px solid var(--card2);font-size:38px;font-weight:700;text-align:left}
.ic{width:46px;height:46px;flex:none;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.tg .ic{color:#ff9a8f}
.tg.ok .ic{color:var(--g)}.tg.bad .ic{color:#ffb4a8}
/* two columns */
.two{display:grid;gap:30px;margin-top:50px;width:100%}
.col{display:grid;gap:16px;justify-items:stretch}
.col p{font-size:30px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:var(--mut);text-align:left;margin-bottom:4px}
.cl{opacity:0}.act .cl{animation:rise .5s var(--e) both}
.col.yes p{color:var(--g)}.col.no p{color:#ffb4a8}
.tg.bad{border-color:#8f4a4a;background:#3a2a3a;text-decoration:line-through;text-decoration-color:#ff9a8f;text-decoration-thickness:3px}
/* site mock */
.site{position:relative;width:620px;height:640px;border-radius:44px;background:#faf9f2;border:6px solid #2d5b8a;margin-top:50px;overflow:hidden;box-shadow:0 40px 90px rgba(4,14,26,.55)}
.sbar{display:flex;align-items:center;gap:10px;padding:18px 22px;background:#e8e4d6;font-size:22px;color:#33465F}
.sbar i{width:14px;height:14px;border-radius:50%;background:#c9c4b0}.sbar span{margin-left:12px}
.sbody{padding:36px 34px;text-align:left}.sbody b{display:block;font-size:44px;color:#0d3f5e;line-height:1.1;margin-bottom:26px}
.sbody i{display:block;height:20px;border-radius:10px;background:#dcd8c8;margin:18px 0}.sbody i.s{width:62%}
.fab{position:absolute;right:30px;bottom:30px;width:130px;height:130px;border-radius:50%;background:#128c7e;display:grid;place-items:center;box-shadow:0 14px 34px rgba(18,140,126,.5);opacity:0}
.act .fab{animation:fabin .7s var(--e) both}
@keyframes fabin{from{opacity:0;transform:scale(0)}60%{transform:scale(1.18)}to{opacity:1;transform:scale(1)}}
.fab .wa{width:76px;height:76px;fill:none;stroke:#fff;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
.tapx{position:absolute;inset:-10px;border-radius:50%;border:6px solid #25D366;opacity:0}
.act .tapx{animation:tapo 1s ease-out both}
@keyframes tapo{0%{opacity:1;transform:scale(.8)}100%{opacity:0;transform:scale(2.1)}}
/* ticket */
.ticket{margin-top:50px;width:760px;padding:40px 44px;border-radius:40px;background:#fff;color:#0d1f33;text-align:left;box-shadow:0 36px 80px rgba(4,14,26,.5)}
.ticket small{font-size:26px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#128c7e}
.ref{display:block;font-size:76px;font-weight:900;margin:12px 0 22px;letter-spacing:-.01em}
.trow{display:flex;justify-content:space-between;align-items:center;font-size:32px;font-weight:700}
.trow span{display:flex;align-items:center;gap:14px}.trow .ic{width:38px;height:38px;color:#128c7e}.trow em{font-style:normal;color:#5b6670;font-weight:600}
.arrow{width:70px;height:150px;margin:20px 0 6px;stroke:var(--g);fill:none;stroke-width:6;stroke-linecap:round;stroke-linejoin:round}
.arrow path{stroke-dasharray:240;stroke-dashoffset:240}
.act .arrow path{animation:dash 1s ease both}
@keyframes dash{to{stroke-dashoffset:0}}
.dept{display:flex;align-items:center;gap:26px;padding:28px 40px;border-radius:30px;background:var(--card);border:3px solid var(--g);font-size:40px;text-align:left}
.dept small{display:block;font-size:28px;color:var(--mut);font-weight:600;margin-top:4px}.dept .ic{width:64px;height:64px;color:var(--g)}
/* inbox */
.inbox{margin-top:50px;width:820px;border-radius:44px;background:#fff;color:#0d1f33;padding:34px 36px;text-align:left;box-shadow:0 40px 90px rgba(4,14,26,.55);display:grid;gap:24px}
.ihead{display:flex;justify-content:space-between;align-items:center;font-size:36px}
.ihead .dot{width:22px;height:22px;border-radius:50%;background:var(--g)}
.irow{display:grid;grid-template-columns:84px 1fr auto;gap:22px;align-items:center;padding:20px 22px;border-radius:26px;background:#eef6f2;border:3px solid #cfe9dc;opacity:0}
.act .irow{animation:pop .6s var(--e) both}
.av{width:84px;height:84px;border-radius:50%;background:#128c7e;color:#fff;display:grid;place-items:center;font-size:40px;font-weight:800}
.irow b{font-size:34px;display:block}.irow small{font-size:28px;color:#5b6670;font-weight:600}.irow em{font-style:normal;color:#128c7e;font-weight:800;font-size:28px}
.note{padding:24px 28px;border-radius:24px;background:#fff6d6;border:3px solid #f0d77a;font-size:32px;line-height:1.35;opacity:0}
.act .note{animation:pop .6s var(--e) both}.note small{display:block;font-size:24px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#8a6d00;margin-bottom:6px}
.take{display:flex;align-items:center;gap:16px;font-size:34px;font-weight:800;color:#12643d;opacity:0}
.act .take{animation:rise .6s var(--e) both}.take .ic{width:48px;height:48px;color:#12643d}
/* share */
.share{margin-top:50px;width:860px;display:grid;gap:26px}
.srow{display:flex;align-items:center;gap:26px;padding:28px 34px;border-radius:30px;background:var(--card);border:3px solid var(--card2);text-align:left;font-size:40px;opacity:0}
.act .srow{animation:rise .6s var(--e) both}
.srow small{display:block;font-size:28px;color:var(--mut);font-weight:600;margin-top:4px}.srow .ic{width:64px;height:64px;color:var(--g)}
.url{display:inline-flex;align-items:center;gap:16px;padding:24px 38px;border-radius:999px;background:#fff;color:#0d1f33;font-size:38px;font-weight:700;box-shadow:0 20px 44px rgba(4,14,26,.4)}
.url b{color:#128c7e}.url .dot{width:18px;height:18px;border-radius:50%;background:var(--g)}
.share .url{align-self:center}
/* close */
.cta{display:flex;flex-direction:column;align-items:center;gap:34px;margin-top:40px;opacity:1}
.qr{width:240px;height:240px;border-radius:24px;opacity:0;box-shadow:0 20px 44px rgba(4,14,26,.4)}
.act .qr{animation:pop .7s var(--e) both}
.conf{position:absolute;left:50%;top:36%}
.cf{position:absolute;width:16px;height:26px;border-radius:4px;opacity:0}
.act .cf{animation:conf 2.8s cubic-bezier(.15,.7,.3,1) both}
@keyframes conf{0%{opacity:1;transform:translate(0,0) rotate(0)}80%{opacity:1}100%{opacity:0;transform:translate(var(--x),calc(var(--y) + 420px)) rotate(var(--r))}}
.btn{list-style:none;padding:16px 22px;border-radius:999px;background:#e7f6ef;border:3px solid #25D366;color:#0d3f5e;font-weight:700;text-align:center;font-size:32px}
.menu ul{list-style:none;padding:0;display:grid;gap:12px}
.menu li.btn{opacity:0}.act .menu li.btn{animation:rise .5s var(--e) both}
.b.tapd{font-weight:700}
.mailtag{margin-top:30px}
.stars{display:flex;gap:10px;margin-top:10px;font-size:64px;color:#d9d9d9}
.act .star{animation:starpop .5s var(--e) both;display:inline-block}
@keyframes starpop{from{transform:scale(0) rotate(-40deg);color:#d9d9d9}60%{transform:scale(1.3)}to{transform:scale(1);color:#f5b301}}
.star{color:#d9d9d9}
.remrow{display:flex;gap:26px;margin-top:50px}
.rem{width:290px;padding:34px 20px;border-radius:34px;background:var(--card);border:3px solid var(--g);opacity:0}
.act .rem{animation:pop .6s var(--e) both}
.rem b{display:block;font-size:110px;line-height:1;font-weight:900}.rem small{display:block;font-size:28px;color:var(--mut);font-weight:700;margin-bottom:14px}.rem span{font-size:30px;font-weight:800;color:var(--g)}
#ctrl{position:fixed;left:12px;bottom:12px;z-index:9;font:13px system-ui;display:flex;gap:6px}
'''.replace('__FONT__', FONT)

secs = ''.join(f'<section class="scene" data-d="{D[i]}">{s}</section>' for i, s in enumerate(scenes))

HTML = f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Meet HELP 868</title>
<meta name="viewport" content="width=1080">
<style>{CSS}</style></head>
<body>
<div id="bg"><i class="b1 grain"></i><i class="b2 grain"></i><i class="b3 grain"></i></div>
<div class="brand"><img src="{MARK}" alt=""><span>Ricky Rampersad Branch<small>HELP 868 on WhatsApp</small></span></div>
{secs}
<div id="ctrl"><button onclick="go(Math.max(0,cur-1))">Back</button><button onclick="paused=!paused;if(!paused)go(cur)">Play / pause</button><button onclick="go(Math.min(SC.length-1,cur+1))">Next</button></div>
<script>
var SC = Array.prototype.slice.call(document.querySelectorAll('.scene')), cur = 0, paused = false, timer = 0;
function go(n) {{
  SC.forEach(function (s) {{ s.classList.remove('act', 'out'); }});
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
