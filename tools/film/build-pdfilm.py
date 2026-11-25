#!/usr/bin/env python3
"""Premium due WhatsApp launch films (portrait 1080x1920): PDKEY=pdstaff (staff briefing) or pdfb (Facebook cut).

    PDKEY=pdstaff python3.13 build-pdfilm.py <out.html>

Made 25 November 2026 from build-h868cfilm.py's page, scenes and CSS. Nothing on screen is a real client: the client, the
last four digits, the dates, the reference and every figure are made up and marked sample. Narration: Andrew Expressive on the
tts-run runner (lines in pdstaff-lines.json and pdfb-lines.json); captions are burned over the frame by the mixer.
"""
import base64, json, os, random, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
KEY = os.environ.get('PDKEY', 'pdstaff')
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, KEY + 'film.html')
LINES = [x['say'] for x in json.load(open(os.path.join(HERE, KEY + '-lines.json')))['scenes']]
TIMF = os.path.join(HERE, KEY + '-timing.json')
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
    'chat': '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12h5"/>',
    'bot': '<rect x="5" y="8" width="14" height="11" rx="3"/><path d="M12 4v4M9 13h.01M15 13h.01M9 16.5h6"/>',
    'mail': '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
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


ICON.update({
    'shield': '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M8.5 12l2.5 2.5L16 9.5"/>',
    'pen': '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
    'card': '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18M7 15h4"/>',
    'tag': '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.3"/>',
    'clip': '<rect x="6" y="4" width="12" height="17" rx="2"/><path d="M9 4h6v3H9zM9 12h6M9 16h4"/>',
})


ICON.update({
    'clock9': '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
    'list': '<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>',
    'board': '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 16v-4M12 16V8M17 16v-6"/>',
    'heart': '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
    'phone': '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>',
})


def qrsvg(url, delay):
    import qrcode
    q = qrcode.QRCode(border=0, error_correction=qrcode.constants.ERROR_CORRECT_M)
    q.add_data(url)
    q.make(fit=True)
    M = q.get_matrix()
    d = ''.join(f'M{x},{y}h1v1h-1z' for y, row in enumerate(M) for x, v in enumerate(row) if v)
    return (f'<svg class="qr" style="animation-delay:{delay}ms" viewBox="-2 -2 {len(M) + 4} {len(M) + 4}"><rect x="-2" y="-2" '
            f'width="{len(M) + 4}" height="{len(M) + 4}" fill="#fff"/><path d="{d}" fill="#0d1f33"/></svg>')


def btns(labels, t0, step=170):
    return ''.join(f'<li class="btn" style="animation-delay:{t0 + step * i}ms">{t}</li>' for i, t in enumerate(labels))


def clientmsg(t, extra=''):
    """The 45 to 49 day message as the client sees it (made-up client, last four digits and date)."""
    return (f'<div class="b in menu" style="animation-delay:{t}ms">Hi Anika 👋 This is <strong>Ricky Rampersad Branch</strong>, messaging you on '
            f'WhatsApp for the first time. 😊<br><br>Our records show the premium on policy <strong>5017</strong> was due on <strong>15 Oct</strong>. '
            f'We are here to help. 💙<br><br>Which suits you?{extra}</div>')


random.seed(2511)
scenes = []

if KEY == 'pdstaff':
    # 1 ─ the move to WhatsApp
    n = 0
    scenes.append(f"""
<div class="center">
  <div class="logo" style="animation-delay:150ms"><span class="ring"></span><span class="ring r2"></span>{WA}</div>
  <p class="kick" style="animation-delay:{at(n, 'moving') - 200}ms">Premium due · staff briefing</p>
  <h1>{words('Premium reminders, on WhatsApp.', 300, 130)}</h1>
  <div class="pill live" style="animation-delay:{at(n, 'branch') - 100}ms"><i></i>From the branch's own number</div>
</div>""")

    # 2 ─ nine o'clock report
    n = 1
    rows = [('Client A', '…5017', '47 days', 0), ('Client B', '…2612', '52 days', 1), ('Client C', '…8841', '78 days', 2), ('Client D', '…3306', '46 days', 3)]
    rr = ''.join(f'<div class="irow" style="animation-delay:{at(n, "report") + 150 + 300 * i}ms"><span class="av">{c[-1]}</span>'
                 f'<span><b>{c}</b><small>Policy {p}</small></span><em>{d}</em></div>' for i, (c, p, d, _x) in enumerate(rows))
    scenes.append(f"""
<div class="center">
  {head('Every morning', 'At nine, the report lands.')}
  <div class="inbox"><div class="ihead"><b>Premium due report</b><span class="dot"></span></div>{rr}</div>
  <div class="pill live" style="animation-delay:{at(n, 'first')}ms"><i></i>The first thing you open</div>
  <p class="under" style="animation-delay:{at(n, 'first') + 400}ms">Sample clients and figures</p>
</div>""")

    # 3 ─ the check
    n = 2
    CK = [('Right band, worked out today', at(n, 'filter')), ('Premium Paying and overdue', at(n, 'filter') + 350),
          ('No payment found', at(n, 'check', 2)), ('Mobile checked, consent on file', at(n, 'check', 2) + 400),
          ('No hold, not messaged already', at(n, 'every') + 200), ('Agent active, or has left us', at(n, 'active'))]
    ck = ''.join(f'<div class="tg ok" style="animation-delay:{t}ms">{ico("ok")}<span>{a}</span></div>' for a, t in CK)
    scenes.append(f"""
<div class="center">
  {head('Then comes your check', 'Tick every box.')}
  <div class="rows">{ck}</div>
</div>""")

    # 4 ─ five bands
    n = 3
    BD = [('45 to 49 days', 'A friendly hello', at(n, 'five')), ('50 to 74 days', 'We checked, all looks clear', at(n, 'five') + 400),
          ('75 to 89 days', 'Cover is at risk, we can help', at(n, 'five') + 800),
          ('Under 2 years, no value', 'It may lapse, here to help', at(n, 'five') + 1200), ('Lapsed today', 'Options may be available', at(n, 'lapses'))]
    bd = ''.join(f'<div class="svc wide" style="animation-delay:{t}ms;justify-content:flex-start"><span class="si">{i + 1}</span>'
                 f'<span class="st"><b>{a}</b><small>{b}</small></span></div>' for i, (a, b, t) in enumerate(BD))
    scenes.append(f"""
<div class="center">
  {head('Five bands', 'Each has its own message.')}
  <div class="svcgrid" style="grid-template-columns:1fr">{bd}</div>
</div>""")

    # 5 ─ what the client sees
    n = 4
    chat = clientmsg(at(n, 'warm'), f'<ul>{btns(["✅ Already paid", "💳 Help me pay", "📞 Call me"], at(n, "three"))}</ul>')
    scenes.append(f"""
<div class="center" style="justify-content:flex-start;padding-top:6px">
  <p class="kick" style="animation-delay:150ms">Sample client · what they see</p>
  <h1 style="font-size:84px">{words('Warm. Clear. Easy.', 260, 150)}</h1>
  <div class="dz">{chatwin(chat, 'Ricky Rampersad Branch', 'Business account')}</div>
</div>""")

    # 6 ─ the tap becomes a ticket
    n = 5
    scenes.append(f"""
<div class="center" style="justify-content:flex-start;padding-top:6px">
  <p class="kick" style="animation-delay:150ms">When they tap</p>
  <h1 style="font-size:84px">{words('A ticket. An owner.', 260, 150)}</h1>
  <div class="dz">{chatwin(bub('out', '📞 Call me', at(n, 'tap')), 'Ricky Rampersad Branch', 'Business account')}</div>
  <div class="ticket" style="animation-delay:{at(n, 'ticket')}ms"><small>Ticket logged · sample</small><span class="ref">RRB/2026/nnn</span>
    <div class="trow"><span>{ico('user')}Owner</span><em>The staff owner of the agent</em></div>
    <div class="trow" style="margin-top:14px"><span>{ico('clock')}Target</span><em>1 working day</em></div></div>
</div>""")

    # 7 ─ the four o'clock board
    n = 6
    TL = [('Sent', '12', at(n, 'went')), ('Tapped', '5', at(n, 'tapped')), ('Open', '3', at(n, 'open')), ('Past time', '0', at(n, 'past'))]
    tl = ''.join(f'<div class="rem" style="animation-delay:{t}ms;width:230px"><b>{v}</b><small>{a}</small></div>' for a, v, t in TL)
    scenes.append(f"""
<div class="center">
  {head("At four o'clock", 'Kamla reviews the board.')}
  <div class="remrow" style="gap:18px">{tl}</div>
  <p class="under" style="animation-delay:{at(n, 'past')}ms">Sample figures</p>
</div>""")

    # 8 ─ your name is on every tick
    n = 7
    scenes.append(f"""
<div class="center">
  {head('Your name is on it', 'Verified, or not sent.')}
  <div class="rows">
    <div class="tg ok" style="animation-delay:{at(n, 'verified')}ms">{ico('ok')}<span>Verified by you: sent</span></div>
    <div class="tg bad" style="animation-delay:{at(n, 'go') - 200}ms">{ico('lock')}<span>Not verified: not sent</span></div>
  </div>
</div>""")

    # 9 ─ the goal
    n = 8
    scenes.append(f"""
<div class="center close">
  <div class="logo sm" style="animation-delay:150ms"><span class="ring"></span><span class="ring r2"></span>{ico('heart').replace('class="ic"', 'class="ic" style="width:96px;height:96px;stroke:#fff"')}</div>
  <h1>{words('Their branch is looking out for them.', 300, 140)}</h1>
  <p class="lede" style="animation-delay:{at(n, 'looking')}ms">Building a relationship, one message at a time.</p>
</div>""")

    BRANDSUB = 'Premium due · staff briefing'
    TITLE = 'Premium due on WhatsApp: staff briefing'

else:   # pdfb: the Facebook cut
    # 1 ─ hello
    n = 0
    scenes.append(f"""
<div class="center">
  <div class="logo" style="animation-delay:150ms"><span class="ring"></span><span class="ring r2"></span>{WA}</div>
  <h1 class="huge">{words('Hello!', 300, 160)}</h1>
  <p class="lede" style="animation-delay:{at(n, 'from') - 100}ms">From <b>Ricky Rampersad Branch</b></p>
  <div class="pill live" style="animation-delay:{at(n, 'whatsapp') - 150}ms"><i></i>We're now on WhatsApp</div>
</div>""")

    # 2 ─ a friendly note
    n = 1
    scenes.append(f"""
<div class="center" style="justify-content:flex-start;padding-top:6px">
  <p class="kick" style="animation-delay:150ms">A friendly note</p>
  <h1 style="font-size:84px">{words('So nothing slips by.', 260, 150)}</h1>
  <div class="dz">{chatwin(clientmsg(at(n, 'short')), 'Ricky Rampersad Branch', 'Business account')}</div>
  <p class="under" style="animation-delay:{at(n, 'friendly')}ms">Sample message</p>
</div>""")

    # 3 ─ the buttons
    n = 2
    scenes.append(f"""
<div class="center">
  {head('Easy buttons', 'Tap to tell us.')}
  <div class="rows">
    <div class="tg ok" style="animation-delay:{at(n, 'paid')}ms">{ico('ok')}<span>I've already paid</span></div>
    <div class="tg ok" style="animation-delay:{at(n, 'help')}ms">{ico('chat')}<span>Help me pay</span></div>
    <div class="tg ok" style="animation-delay:{at(n, 'call')}ms">{ico('phone')}<span>Call me</span></div>
  </div>
</div>""")

    # 4 ─ stop any time
    n = 3
    scenes.append(f"""
<div class="center" style="justify-content:flex-start;padding-top:6px">
  <p class="kick" style="animation-delay:150ms">Your choice</p>
  <h1 style="font-size:84px">{words('Reply STOP any time.', 260, 150)}</h1>
  <div class="dz">{chatwin(bub('out', 'STOP', at(n, 'stop')), 'Ricky Rampersad Branch', 'Business account')}</div>
  <div class="tg ok" style="margin-top:26px;animation-delay:{at(n, 'stop', 2)}ms">{ico('ok')}<span>And we'll stop</span></div>
</div>""")

    # 5 ─ message us
    n = 4
    conf = ''.join(
        f'<i class="cf" style="--x:{random.randint(-480, 480)}px;--y:{random.randint(-380, 160)}px;--r:{random.randint(-540, 540)}deg;'
        f'background:{random.choice(["#25D366", "#00CFEA", "#fff", "#7FE3B0", "#8FB8FF"])};animation-delay:{at(n, "message") + random.randint(0, 260)}ms"></i>'
        for _ in range(50))
    scenes.append(f'''
<div class="center close">
  <div class="logo sm" style="animation-delay:150ms"><span class="ring"></span><span class="ring r2"></span>{WA}</div>
  <h1 class="huge" style="font-size:120px">{words('Say hello.', at(n, 'message') - 200, 170)}</h1>
  <div class="cta">
    <div class="url" style="animation-delay:{at(n, 'help') - 100}ms"><span class="dot"></span>WhatsApp <b>1 868 435 7868</b></div>
    {qrsvg('https://rickyrampersadbranch.com/help868/', at(n, 'whatsapp'))}
  </div>
  <div class="conf">{conf}</div>
</div>''')

    BRANDSUB = 'On WhatsApp'
    TITLE = 'Ricky Rampersad Branch is now on WhatsApp'


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

/* integration flow (scene 7) */
.flow{position:relative;width:860px;height:900px;margin-top:56px}
.fline{position:absolute;left:59px;top:62px;width:6px;height:760px;border-radius:3px;background:linear-gradient(#25D366,#00CFEA);opacity:.4}
.fd{position:absolute;left:-9px;top:-10px;width:24px;height:24px;border-radius:50%;background:#25D366;box-shadow:0 0 26px 8px rgba(37,211,102,.7);opacity:0}
.act .fd{animation:fdrop 2.6s linear infinite both}
@keyframes fdrop{0%{transform:translateY(0);opacity:0}8%{opacity:1}92%{opacity:1}100%{transform:translateY(780px);opacity:0}}
.fn{position:absolute;left:0;display:flex;align-items:center;gap:30px;text-align:left;opacity:.22}
.act .fn{animation:fnlit .7s var(--e) both}
@keyframes fnlit{from{opacity:.22;transform:translateX(-30px)}to{opacity:1;transform:none}}
.fi{width:124px;height:124px;border-radius:36px;display:grid;place-items:center;background:#1b4268;border:4px solid #3d6a99;color:#fff;flex:none}
.act .fi{animation:filit .7s var(--e) both}
@keyframes filit{from{background:#1b4268;border-color:#3d6a99;color:#fff;transform:scale(.9)}60%{transform:scale(1.12)}to{background:#25D366;border-color:#25D366;color:#0d1f33;box-shadow:0 0 44px rgba(37,211,102,.6);transform:scale(1)}}
.fi .ic{width:64px;height:64px}
.ft b{display:block;font-size:50px;line-height:1.1}.ft small{display:block;font-size:30px;color:var(--mut);font-weight:600;margin-top:6px}
/* watch it happen (scene 8) */
.dz{zoom:.78;display:flex;flex-direction:column;align-items:center;margin-top:10px}
.dz .phone{margin-top:20px}
.qpc{margin-top:28px;width:820px;border-radius:36px;background:#fff;color:#0d1f33;overflow:hidden;box-shadow:0 36px 80px rgba(4,14,26,.5);opacity:0;text-align:left}
.act .qpc{animation:qin .7s var(--e) both}
@keyframes qin{from{opacity:0;transform:translateY(140px) scale(.94)}to{opacity:1;transform:none}}
.qph{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:20px 30px;background:#0d1f33;color:#fff;font-size:30px}
.qph span{font-size:24px;color:#b9cadd;font-weight:600}
.qph em{font-style:normal;font-size:22px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;background:#25D366;color:#0d1f33;padding:4px 14px;border-radius:999px}
.qrow{display:flex;justify-content:space-between;padding:13px 30px;border-top:2px solid #e6eef0;font-size:31px}
.qrow span{color:#5b6670;font-weight:600}.qrow b{opacity:0;font-weight:800}
.act .qrow b{animation:rise .5s var(--e) both}
.qrow b.st{color:#12643d}
/* more motion on the existing scenes */
@keyframes pop{from{opacity:0;transform:translateY(40px) scale(.8)}60%{opacity:1;transform:translateY(-8px) scale(1.06)}to{opacity:1;transform:none}}
@keyframes glowp{0%,100%{box-shadow:0 30px 70px rgba(4,14,26,.5),0 0 0 0 rgba(37,211,102,0)}50%{box-shadow:0 30px 70px rgba(4,14,26,.5),0 0 64px 10px rgba(37,211,102,.5)}}
.act .ticket{animation:rise .6s var(--e) both,glowp 2.4s ease-in-out infinite}
.act .dept{animation:rise .6s var(--e) both,glowp 2.4s ease-in-out infinite}
.act .url{animation:rise .6s var(--e) both,glowp 2.8s ease-in-out infinite}
.act .rem{animation:pop .6s var(--e) both,glowp 2.6s ease-in-out infinite}
.act .irow{animation:pop .6s var(--e) both,glowp 2.6s ease-in-out infinite}

/* from email to one tap (scene 2) */
.evo{position:relative;width:960px;height:1040px;margin-top:30px}
.old{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;gap:24px;padding-top:40px}
.act .old{animation:oldout .7s ease both}
@keyframes oldout{from{opacity:1;transform:none}to{opacity:0;transform:translateX(-140px) scale(.92)}}
.mrow{position:relative;width:860px;display:flex;align-items:center;gap:26px;padding:28px 34px;border-radius:28px;background:#fff;color:#0d1f33;text-align:left;opacity:0}
.act .mrow{animation:pop .6s var(--e) both}
.mrow .ic{width:62px;height:62px;color:#5b6670}
.mrow b{display:block;font-size:36px}.mrow small{display:block;font-size:28px;color:#5b6670;font-weight:600;margin-top:4px}
.lost{position:absolute;right:50px;top:346px;font-size:76px;font-weight:900;letter-spacing:.1em;color:#ff6b5e;border:10px solid #ff6b5e;padding:6px 34px;border-radius:18px;background:rgba(13,31,51,.78);transform:rotate(-10deg);opacity:0}
.act .lost{animation:stamp .5s var(--e) both}
@keyframes stamp{from{opacity:0;transform:rotate(-10deg) scale(2.6)}to{opacity:1;transform:rotate(-10deg) scale(1)}}
.newp{position:absolute;inset:0;opacity:0}
.act .newp{animation:rise .7s var(--e) both}
.site.ev{position:absolute;left:170px;top:10px;margin:0}
.chatpop{position:absolute;left:90px;top:540px;width:780px;margin-top:0;opacity:0}
.act .chatpop{animation:openup .7s var(--e) both}
@keyframes openup{from{opacity:0;transform:translateY(140px) scale(.7)}to{opacity:1;transform:none}}
.chatpop .chat{min-height:0}
.b.rcpt{background:#fff;border:3px solid #25D366}
/* client film: service cards and example chips */
.svcgrid{display:grid;grid-template-columns:1fr 1fr;gap:22px;width:960px;margin-top:44px}
.svc{display:flex;align-items:center;gap:22px;padding:26px 28px;border-radius:30px;background:var(--card);border:3px solid var(--card2);text-align:left;opacity:0}
.svc.wide{grid-column:1 / 3;justify-content:center;border-color:var(--g)}
.act .svc{animation:pop .6s var(--e) both}
.si{width:84px;height:84px;border-radius:24px;display:grid;place-items:center;background:var(--g);color:#0d1f33;flex:none}
.si .ic{width:48px;height:48px}
.st b{display:block;font-size:38px;line-height:1.1}.st small{display:block;font-size:27px;color:var(--mut);font-weight:600;margin-top:6px}
.chips{display:flex;flex-wrap:wrap;gap:16px;justify-content:center;width:960px;margin-top:44px}
.chip{padding:18px 30px;border-radius:999px;background:var(--card);border:3px solid var(--card2);font-size:37px;font-weight:700;opacity:0}
.act .chip{animation:pop .55s var(--e) both}
.dz .menu b{display:block;margin-bottom:12px}
#ctrl{position:fixed;left:12px;bottom:12px;z-index:9;font:13px system-ui;display:flex;gap:6px}
'''.replace('__FONT__', FONT)

secs = ''.join(f'<section class="scene" data-d="{D[i]}">{s}</section>' for i, s in enumerate(scenes))

HTML = f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>{TITLE}</title>
<meta name="viewport" content="width=1080">
<style>{CSS}</style></head>
<body>
<div id="bg"><i class="b1 grain"></i><i class="b2 grain"></i><i class="b3 grain"></i></div>
<div class="brand"><img src="{MARK}" alt=""><span>Ricky Rampersad Branch<small>{BRANDSUB}</small></span></div>
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

