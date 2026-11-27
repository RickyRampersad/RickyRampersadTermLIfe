#!/usr/bin/env python3
"""A year with your group: the employers' film, the launch cut (27 November 2026).

    python3 build-empfilm.py  ->  groupclientmanagement/a-year-with-us-film.html

Asked for as "the colors are hurting the eyes ... use international best practices ... a lot more motion and
graphics ... a digital form being filled out ... how is the routing process, how is the onboarding process for a new
applicant ... it goes directly to your agent and the support of the branch, our sales support ... a desk with a lot of
paper and missed follow-ups ... scale properly so on any device you can look at it".

So:
  - the homepage's own palette, sampled from Guardian Life of the Caribbean's stylesheet: a warm off-white ground,
    white cards, deep blue ink, the teal used sparingly. FLAT colour: a large gradient bands into stripes once a video
    is compressed, which is what read as "distorted" on a monitor. No dark title cards, no dotted texture.
  - one page, two frames: wide 1280x720 (captions in an ink strip under the picture) and upright 720x1280 (captions
    over an ink band at the foot). render.js draws each at 1.5x.
  - the onboarding is drawn and animated, not screenshotted: HR's form typing itself, the employee's phone filling in,
    the signature drawing, Guardian's own form lighting up section by section, the routing map, the follow-up line.
    Real screens (the redesigned group page on the invented branch, Guardian's real GIO001 and its real easiConnect
    sign-in page) appear where a real screen is the point.
  - routing goes to Guardian, the group's AGENT and the branch's sales support (the branch manager's word: never
    "your account manager").

Voice: Andrew Expressive on tts-run, key gcme2, 18 lines in gcme2-lines.json. Screens in tools/film/gcmshots-emp/.
Every name and figure on screen is invented.
"""
import base64, io, json, os, pathlib, re, sys

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent.parent
KEY = 'gcme2'
SHOTS = HERE / 'gcmshots-emp'
OUT = ROOT / 'groupclientmanagement' / 'a-year-with-us-film.html'
TIMING = HERE / (KEY + '-timing.json')
N_LINES = 18

T = json.loads(TIMING.read_text()) if TIMING.exists() else {}
DURS = [int(round(d * 1000)) for d in (T.get('durs') or [10.0] * N_LINES)]
WORDS = [l.get('words', []) for l in T.get('lines', [])]
if len(DURS) != N_LINES:
    sys.exit('TIMING: %d durations for a %d-line film' % (len(DURS), N_LINES))

def at(n, word, k=0, lead=0.0):
    """The second the k-th match of a spoken word begins in line n (+0.4 s, the lead the mixer gives the voice)."""
    try:
        ws = WORDS[n - 1]
    except Exception:
        return 1.0
    want = re.sub(r'[^a-z0-9]', '', word.lower())
    hits = [w for w in ws if re.sub(r'[^a-z0-9]', '', str(w[1]).lower()).startswith(want)]
    if len(hits) > k:
        return round(max(0.2, float(hits[k][0]) + 0.4 - lead), 2)
    if WORDS and T:
        sys.exit('TIMING: "%s" is not spoken in line %d' % (word, n))
    return 1.0

def b64(p, mime):
    return 'data:%s;base64,%s' % (mime, base64.b64encode(pathlib.Path(p).read_bytes()).decode())

_cache = {}
def img(name, cap=900):
    if name in _cache:
        return _cache[name]
    p = SHOTS / name
    if not p.exists():
        p = p.with_suffix('.jpg')
    if not p.exists():
        sys.exit('MISSING SCREEN: %s' % name)
    from PIL import Image
    im = Image.open(p).convert('RGB')
    if im.width > cap:
        im = im.resize((cap, round(im.height * cap / im.width)), Image.LANCZOS)
    b = io.BytesIO(); im.save(b, 'JPEG', quality=88, optimize=True)
    _cache[name] = 'data:image/jpeg;base64,' + base64.b64encode(b.getvalue()).decode()
    return _cache[name]

BOXES = json.loads((SHOTS / 'boxes.json').read_text())
def _size(name):
    b = BOXES.get(name)
    if b and b.get('w'):
        return b['w'], b['h']
    from PIL import Image
    p = SHOTS / name
    return Image.open(p if p.exists() else p.with_suffix('.jpg')).size

def _box(name, label):
    els = (BOXES.get(name) or {}).get('els') or {}
    if label not in els:
        sys.exit('NO BOX: "%s" on %s (have: %s)' % (label, name, ', '.join(sorted(els)) or 'none'))
    return els[label]

EXTRA = []
def cam(name, n, vw, vh, moves=(), marks=()):
    """A real screen inside its frame with a camera: at each (seconds, label, zoom) it eases to that element, and each
       (seconds, label) in marks outlines it. Pure CSS animation, so render.js sets it to the frame's own moment."""
    iw, ih = _size(name); s0 = vw / iw; dh = ih * s0
    D = DURS[n - 1] / 1000.0
    pct = lambda t: max(0.0, min(100.0, t / D * 100.0))
    def focus(label, z):
        x, y, w, h = _box(name, label)
        cx, cy = (x + w / 2) * s0, (y + h / 2) * s0
        return min(0.0, max(vw - vw * z, vw / 2 - cx * z)), min(0.0, max(vh - dh * z, vh / 2 - cy * z)), z
    anim = ''
    if moves:
        kf, st, last = ['0%{transform:translate(0,0) scale(1)}'], (0.0, 0.0, 1.0), 0.0
        for t, label, z in moves:
            new = (0.0, 0.0, 1.0) if label is None else focus(label, z)
            a, b = pct(max(last, t - 0.05)), pct(t + 0.8)
            kf.append('%.3f%%{transform:translate(%.1fpx,%.1fpx) scale(%.3f);animation-timing-function:cubic-bezier(.45,0,.2,1)}' % ((a,) + st))
            kf.append('%.3f%%{transform:translate(%.1fpx,%.1fpx) scale(%.3f)}' % ((b,) + new))
            st, last = new, t + 0.8
        kf.append('100%%{transform:translate(%.1fpx,%.1fpx) scale(%.3f)}' % st)
        nm = 'cam%d' % len(EXTRA)
        EXTRA.append('@keyframes %s{%s}' % (nm, ''.join(kf)))
        anim = 'animation:%s %dms linear both' % (nm, DURS[n - 1])
    inner = ''.join('<b class="mk2" style="left:%.1fpx;top:%.1fpx;width:%.1fpx;height:%.1fpx;--kd:%.2fs"></b>' % (
        _box(name, l)[0] * s0 - 4, _box(name, l)[1] * s0 - 4, _box(name, l)[2] * s0 + 8, _box(name, l)[3] * s0 + 8, t) for t, l in marks)
    return ('<div class="vp" style="width:%dpx;height:%dpx"><div class="zl" style="width:%dpx;%s"><img src="%s" alt="" style="width:%dpx">%s</div></div>'
            % (vw, vh, vw, anim, img(name), vw, inner))

TAG = '<span class="tag">Sample &middot; made-up names and figures</span>'
def phone(name, n, d=0.3, w=236, moves=(), marks=(), cls=''):
    iw, ih = _size(name)
    vh = min(round(w * ih / iw), round(w * 2.165))
    return '<div class="phone %s" style="--kd:%.2fs">%s%s</div>' % (cls, d, cam(name, n, w, vh, moves, marks), TAG)

def lap(name, n, d=0.3, w=560, h=340, moves=(), marks=(), tag=True):
    return ('<div class="lap" style="--kd:%.2fs"><div class="bar3"><i></i><i></i><i></i></div>%s%s</div>'
            % (d, cam(name, n, w, h, moves, marks), TAG if tag else ''))

ICON = {k: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">%s</svg>' % v for k, v in {
    'check': '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    'clock': '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    'alert': '<path d="M12 3l9.5 17h-19z"/><path d="M12 10v4M12 17.5v.5"/>',
    'cake': '<path d="M4 20h16v-7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2z"/><path d="M4 15c2 1.5 4 1.5 5.3 0 1.4 1.5 4 1.5 5.4 0 1.3 1.5 3.3 1.5 5.3 0M12 11V7"/>',
    'grad': '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c3 2 9 2 12 0v-5"/>',
    'sun': '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    'user': '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
    'users': '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c1-3.5 3.5-5.5 6.5-5.5s5.5 2 6.5 5.5"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.6c2 .8 3.3 2.6 3.8 5.4"/>',
    'doc': '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>',
    'list': '<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6h.01M4 12h.01M4 18h.01"/>',
    'mail': '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
    'lock': '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    'chat': '<path d="M4 5h16v11H9l-5 4z"/>',
    'star': '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
    'shield': '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
    'phone': '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>',
    'bell': '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
    'send': '<path d="M3 11l18-8-8 18-2-8z"/>',
    'pen': '<path d="M4 20l4-1 11-11-3-3L5 16z"/><path d="M14 6l3 3"/>',
    'cal': '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    'repeat': '<path d="M17 2l3 3-3 3"/><path d="M4 11V9a4 4 0 0 1 4-4h12"/><path d="M7 22l-3-3 3-3"/><path d="M20 13v2a4 4 0 0 1-4 4H4"/>',
    'cash': '<rect x="2" y="6" width="20" height="13" rx="2"/><circle cx="12" cy="12.5" r="2.5"/>',
    'arrow': '<path d="M5 12h14M13 6l6 6-6 6"/>',
}.items()}

MARK_SVG = ('<svg class="mark" viewBox="0 0 88 88" aria-hidden="true"><path class="mkf" d="M44 9L73 21.5V41C73 60.5 60.5 72 44 78.5C27.5 72 15 60.5 15 41V21.5Z"/>'
            '<path class="mkc1" d="M30 44L39.5 53.5L58 32.5"/><path class="mkc2" d="M30 44L39.5 53.5L58 32.5"/></svg>')
PLEX = b64(HERE / 'fonts' / 'IBMPlexSans-latin.woff2', 'font/woff2')

def kin(text, d=0.0, hi=()):
    out = []
    for i, w in enumerate(text.split(' ')):
        c = ' hi' if re.sub(r'[^a-z]', '', w.lower()) in hi else ''
        out.append('<span class="kw%s" style="--kd:%.2fs">%s</span>' % (c, d + i * 0.07, w))
    return ' '.join(out)

def eb(text, d=0.1):
    return '<div class="eyebrow" style="--kd:%.2fs">%s</div>' % (d, text)

def row(icon, text, d, sub='', cls=''):
    return ('<div class="row %s" style="--kd:%.2fs"><b>%s</b><div><div class="rt">%s</div>%s</div></div>'
            % (cls, d, ICON[icon], text, ('<div class="rs">%s</div>' % sub) if sub else ''))

def typed(text, d, cps=16.0):
    """Text that types itself: one span per character, shown at its own moment."""
    return '<span class="ty">%s<i class="caret" style="--kd:%.2fs;--ke:%.2fs"></i></span>' % (
        ''.join('<span class="ch" style="--kd:%.2fs">%s</span>' % (d + i / cps, '&nbsp;' if c == ' ' else c) for i, c in enumerate(text)),
        d, d + len(text) / cps + .6)

def tick(d):
    return '<i class="tk" style="--kd:%.2fs">%s</i>' % (d, ICON['check'])

def S(n, body, cls=''):
    return ('<section class="sc %s" data-d="%d" style="--sd:%dms"><div class="in">%s</div></section>' % (cls, DURS[n - 1], DURS[n - 1], body))

def split(n, left, right, cls=''):
    return S(n, '<div class="split"><div class="L">%s</div><div class="R">%s</div></div>' % (left, right), cls)

# ------------------------------------------------------------------------------------------------------------ scenes
def scenes():
    sc = []
    # 1 the title
    sc.append(S(1,
        '<div class="mid">' + MARK_SVG +
        eb('Ricky Rampersad Branch &middot; Guardian Life of the Caribbean', .9) +
        '<h1>%s</h1>' % kin('Your group, the digital way.', 1.2, hi=('digital',)) +
        '<div class="plans">' + ''.join('<span class="pl" style="--kd:%.2fs">%s</span>' % (at(1, w), t)
                                        for w, t in (('Life', 'Group Life'), ('Health', 'Group Health'), ('Pension', 'Pension'))) + '</div>'
        '<div class="floaters">' + ''.join('<i class="f%d" style="--kd:%.2fs">%s</i>' % (k, 1.6 + k * .18, ICON[n])
                                           for k, n in enumerate(('doc', 'users', 'shield', 'cal', 'mail', 'check'))) + '</div></div>', 'title'))
    # 2 the usual way: a desk of paper and missed follow-ups
    sheets = ''.join('<i class="sh" style="--kd:%.2fs;--r:%ddeg;--y:%dpx"></i>' % (.3 + i * .32, (i * 37) % 9 - 4, -i * 7) for i in range(9))
    sheets2 = ''.join('<i class="sh" style="--kd:%.2fs;--r:%ddeg;--y:%dpx"></i>' % (.9 + i * .38, (i * 53) % 11 - 5, -i * 7) for i in range(7))
    notes = ''.join('<div class="note n%d" style="--kd:%.2fs">%s</div>' % (i, d, t) for i, (d, t) in enumerate((
        (at(2, 'phone'), 'Call HR back?'), (at(2, 'stand'), 'Where is the form?'), (at(2, 'promises'), 'Follow up!!'))))
    cal = ''.join('<i class="%s" style="--kd:%.2fs"></i>' % ('x' if k in (3, 7, 11, 12) else '', at(2, 'promises') + .25 * (k % 5)) for k in range(15))
    sc.append(split(2,
        eb('The usual way') +
        '<h2>%s</h2>' % kin('Paper, piles and missed follow-ups.', .25) +
        row('doc', 'Forms on paper', at(2, 'Forms'), 'printed, signed, scanned, re-typed', 'bad') +
        row('phone', 'Phone calls to find out where things stand', at(2, 'phone'), '', 'bad') +
        row('alert', 'Calls back that slip through the cracks', at(2, 'promises'), '', 'bad'),
        '<div class="desk"><div class="surf"></div>'
        '<div class="stack a">%s</div><div class="stack b">%s</div>'
        '<div class="ring" style="--kd:%.2fs">%s</div>'
        '<div class="inbox"><b>%s</b><span class="badge"><span class="cnt" data-to="47" data-at="%d">47</span></span></div>'
        '<div class="cal"><div class="ch2">%s November</div><div class="grid">%s</div></div>%s</div>'
        % (sheets, sheets2, at(2, 'phone'), ICON['phone'], ICON['mail'], at(2, 'piles') * 1000, ICON['cal'], cal, notes),
        'old'))
    # 3 we built one digital system
    sc.append(split(3,
        eb('Our branch, our way') +
        '<h2>%s</h2>' % kin('One digital system, built around employers.', .3, hi=('one', 'digital')) +
        row('list', 'Everything for your group, in one place', at(3, 'system'), 'as it happens', 'ok') +
        row('users', 'Real people behind every step', at(3, 'real'), 'your agent and our sales support', 'ok'),
        '<div class="flyaway">' + ''.join('<i style="--kd:%.2fs;--x:%dpx;--y:%dpx;--r:%ddeg"></i>' % (.1 + i * .08, (i - 3) * 70, -120 - (i % 3) * 40, (i * 29) % 40 - 20) for i in range(7)) + '</div>' +
        lap('l01-home.png', 3, at(3, 'built', lead=.6), moves=((at(3, 'employers'), 'needs', 1.25),)),
        'wide'))
    # 4 HR's form types itself
    f0 = at(4, 'Type')
    sc.append(split(4,
        eb('Someone joins &middot; step 1') +
        '<h2>%s</h2>' % kin('It starts with you.', at(4, 'starts', lead=.3)) +
        row('user', 'Their name and e-mail', at(4, 'name'), '') +
        row('check', 'Tick the cover they&rsquo;re joining', at(4, 'tick'), '', 'ok') +
        row('send', 'Press send', at(4, 'press'), '', 'ok') +
        '<div class="pill" style="--kd:%.2fs">%s about a minute</div>' % (at(4, 'minute'), ICON['clock']),
        '<div class="form">'
        '<div class="fh"><b>Enrol a new member</b><span>Send them their own link</span></div>'
        '<div class="fr"><label>First name</label><div class="fv">%s</div></div>'
        '<div class="fr"><label>Surname</label><div class="fv">%s</div></div>'
        '<div class="fr"><label>Their e-mail</label><div class="fv">%s</div></div>'
        '<div class="fr two"><label>Cover</label><div class="cks"><span class="ck">%s<i>Group Health</i></span><span class="ck">%s<i>Group Life</i></span></div></div>'
        '<div class="fr"><label>Cover starts</label><div class="fv">%s</div></div>'
        '<div class="btn" style="--kd:%.2fs">%s Send them their own link<i class="rip"></i></div>'
        '<div class="toast" style="--kd:%.2fs">%s Marcus&rsquo;s own link is on its way</div>'
        '</div>' % (typed('Marcus', f0), typed('Sample', f0 + .55), typed('marcus@home.example', f0 + 1.1, 22),
                    tick(at(4, 'tick')), tick(at(4, 'tick') + .35), typed('1 December 2026', at(4, 'tick') + .8, 20),
                    at(4, 'press'), ICON['send'], at(4, 'press') + .8, ICON['check']),
        'wide'))
    # 5 the employee's phone fills in
    p1, p2, p3 = at(5, 'link'), at(5, 'details'), at(5, 'health')
    steps5 = ''.join('<span class="%s" style="--kd:%.2fs"><i>%d</i>%s</span>' % (c, d, i + 1, t) for i, (t, c, d) in enumerate((
        ('Details', 'on', p2), ('Family', 'on', at(5, 'dependants')), ('Health', 'on', p3), ('Sign', '', 0))))
    sc.append(split(5,
        eb('Someone joins &middot; step 2') +
        '<h2>%s</h2>' % kin('Their own link, on their own phone.', .3, hi=('own',)) +
        row('mail', 'A link of their own, by e-mail', p1) +
        row('users', 'Details, dependants and beneficiaries', p2) +
        row('lock', 'Health questions, in private', p3, 'their answers go only to Guardian', 'ok'),
        '<div class="ph2"><div class="notch"></div>'
        '<div class="scr s1" style="--k1:%.2fs"><div class="ib">Inbox</div><div class="mailc"><b>RRB Support Team</b><span>Harbour Point Logistics Ltd: complete your enrolment</span>'
        '<p>Hi Marcus, your employer has asked us to enrol you. It takes a few minutes on your phone.</p><div class="mbtn">Complete my part<i class="rip"></i></div></div></div>'
        '<div class="scr s2" style="--k1:%.2fs;--k2:%.2fs"><div class="stp">%s</div>'
        '<div class="fr"><label>Date of birth</label><div class="fv">%s</div></div>'
        '<div class="fr"><label>Address</label><div class="fv">%s</div></div>'
        '<div class="sub2">Dependants</div><div class="chip2" style="--kd:%.2fs">Aaliyah &middot; daughter</div>'
        '<div class="sub2">Beneficiary</div><div class="chip2" style="--kd:%.2fs">Sandra &middot; spouse &middot; 100%%</div></div>'
        '<div class="scr s3" style="--k1:%.2fs"><div class="lockb">%s Private: these answers go only to Guardian Life</div>'
        '<div class="q">Any medical condition in the last five years?<div class="yn"><span>Yes</span><span class="no" style="--kd:%.2fs">No</span></div></div>'
        '<div class="q">Under a doctor&rsquo;s care right now?<div class="yn"><span>Yes</span><span class="no" style="--kd:%.2fs">No</span></div></div></div>'
        '%s</div>' % (p1, p2, p3, steps5, typed('22 August 1994', p2 + .4, 18), typed('8 Sample Gardens, Arima', p2 + 1.3, 22),
                      at(5, 'dependants') + .2, at(5, 'beneficiaries') + .2, p3, ICON['lock'], p3 + 1.0, p3 + 1.6, TAG),
        'phone2'))
    # 6 they sign; reminders every working day
    sg = at(6, 'sign')
    days = ''.join('<div class="dy" style="--kd:%.2fs"><b>%s</b>%s<span>Reminder</span></div>' % (at(6, 'reminder') + i * .3, dn, ICON['bell'])
                   for i, dn in enumerate(('Mon', 'Tue', 'Wed', 'Thu', 'Fri')))
    sc.append(split(6,
        eb('Someone joins &middot; step 3') +
        '<h2>%s</h2>' % kin('Signed on the screen.', .3, hi=('signed',)) +
        row('pen', 'They sign with a finger', sg, 'and their part is done', 'ok') +
        '<div class="week"><div class="wl" style="--kd:%.2fs">Not finished yet? A friendly reminder every working day.</div>%s</div>' % (at(6, 'finished'), days),
        '<div class="ph2"><div class="notch"></div><div class="scr sig"><div class="sh2">Sign here</div>'
        '<svg class="sgn" viewBox="0 0 300 120"><path style="--kd:%.2fs" d="M14 82 C 30 30, 46 30, 52 70 S 70 108, 84 64 S 104 20, 116 66 C 124 96, 134 96, 146 60 C 154 40, 166 42, 170 70 C 176 92, 190 90, 204 62 C 214 44, 226 48, 236 70 C 244 86, 262 84, 288 54"/></svg>'
        '<div class="mbtn" style="--kd:%.2fs">Submit my part<i class="rip"></i></div></div>'
        '<div class="scr done" style="--k1:%.2fs"><div class="bigok">%s</div><b>Your part is done</b><span>Pat at Harbour Point Logistics will check it and send it to Guardian Life.</span></div>%s</div>'
        % (sg, sg + 1.6, at(6, 'done'), ICON['check'], TAG),
        'phone2'))
    # 7 Guardian's own form fills itself
    gf = at(7, 'Guardian')
    chips7 = ''.join('<span class="fly" style="--kd:%.2fs">%s</span>' % (d, t) for d, t in (
        (gf, 'Name &middot; date of birth &middot; address'), (gf + .7, 'Dependants'), (gf + 1.4, 'Beneficiaries'), (gf + 2.1, 'Cover')))
    sc.append(split(7,
        eb('Guardian&rsquo;s own form') +
        '<h2>%s</h2>' % kin('Filled in for you.', at(7, 'fills', lead=.3), hi=('filled',)) +
        '<div class="flies">%s</div>' % chips7 +
        row('check', 'Nothing typed twice', at(7, 'twice'), '', 'ok') +
        row('check', 'Nothing left out', at(7, 'left'), '', 'ok'),
        '<div class="paper"><div class="scan" style="--kd:%.2fs"></div>%s<div class="stamp" style="--kd:%.2fs">Filled in from<br>Marcus&rsquo;s phone</div></div>'
        % (gf, cam('s08-gio.png', 7, 430, 470, moves=((gf + .2, 'secA', 1.25), (gf + 1.6, 'deps', 1.2), (gf + 3.0, 'bens', 1.2), (at(7, 'twice'), None, 1.0)),
                   marks=((gf + .6, 'secA'), (gf + 1.9, 'deps'), (gf + 3.3, 'bens'))), at(7, 'left')),
        'wide'))
    # 8 approve, and the routing map (drawn twice: across for a screen, down for a phone; CSS shows the one that fits)
    ap = at(8, 'approve')
    r0, rg, ra, rs = at(8, 'routed'), at(8, 'Guardian'), at(8, 'agent'), at(8, 'sales')
    def route(cls, box, src_in, outs):
        w, h = box
        svg = '<svg class="lines" viewBox="0 0 %d %d" preserveAspectRatio="none">' % (w, h)
        svg += '<path class="ln" style="--kd:.6s" d="%s"/>' % src_in
        svg += ''.join('<path class="ln" style="--kd:%.2fs" d="%s"/>' % (r0 + k * .15, d) for k, d in enumerate(outs))
        svg += '</svg>' + ''.join('<i class="pk" style="--kd:%.2fs;offset-path:path(\'%s\')"></i>' % (t, d) for t, d in zip((rg, ra, rs), outs))
        return ('<div class="route %s" style="width:%dpx;height:%dpx">%s'
                '<div class="nd src" style="--kd:.4s"><b>%s</b><span>Marcus&rsquo;s part, done</span></div>'
                '<div class="nd you" style="--kd:%.2fs"><b>%s</b><span>You check and approve</span><i class="okb" style="--kd:%.2fs">%s Approved</i></div>'
                '<div class="nd t1" style="--kd:%.2fs"><b>%s</b><span>Guardian Life</span><em>enrolment form and health declaration</em></div>'
                '<div class="nd t2" style="--kd:%.2fs"><b>%s</b><span>Your agent</span><em>knows at once</em></div>'
                '<div class="nd t3" style="--kd:%.2fs"><b>%s</b><span>Our sales support team</span><em>takes it from there</em></div></div>'
                % (cls, w, h, svg, ICON['user'], ap - .4, ICON['check'], ap + .3, ICON['check'],
                   rg + .3, ICON['shield'], ra + .3, ICON['user'], rs + .3, ICON['users']))
    sc.append(S(8,
        '<div class="hd">' + eb('You approve. We route it.') +
        '<h2>%s</h2></div>' % kin('One press, routed three ways at once.', .3, hi=('three',)) +
        route('across', (1000, 380), 'M210 190 L380 190',
              ('M560 190 C 640 190, 660 60, 760 60', 'M560 190 L760 190', 'M560 190 C 640 190, 660 320, 760 320')) +
        route('down', (640, 600), 'M320 104 L320 168',
              ('M320 318 C 320 380, 106 380, 106 440', 'M320 318 L320 440', 'M320 318 C 320 380, 534 380, 534 440')),
        'routes'))
    # 9 the follow-up line (across for a screen, down for a phone: the same markup, laid out by CSS)
    f9 = at(9, 'followed')
    stops = (('Day 0', 'Sent to Guardian', .5, 'go'), ('Day 3', 'Followed up', f9 + .5, ''), ('Day 6', 'Followed up', f9 + 1.2, ''),
             ('Done', 'Confirmed by Guardian', at(9, 'done'), 'end'))
    sc.append(S(9,
        '<div class="hd">' + eb('Nobody waits and wonders') +
        '<h2>%s</h2></div>' % kin('Followed up every three working days.', .3, hi=('three',)) +
        '<div class="tline"><div class="rail"><i class="fill" style="--kd:%.2fs;--kt:%.2fs"></i></div>' % (.6, max(2.0, at(9, 'done') - .6)) +
        ''.join('<div class="stop %s" style="--kd:%.2fs;--i:%d"><b>%s</b><strong>%s</strong><span>%s</span></div>'
                % (c, d, i, ICON['check'] if c == 'end' else (ICON['send'] if c == 'go' else ICON['bell']), t, s)
                for i, (t, s, d, c) in enumerate(stops)) + '</div>'
        '<div class="see" style="--kd:%.2fs">%s You can see where it stands, any time, on your own page.</div>' % (at(9, 'see'), ICON['list']),
        'tl'))
    # 10 the Monday report
    m0 = at(10, 'Monday')
    sc.append(split(10,
        eb('Every week') +
        '<div class="clock" style="--kd:%.2fs">Monday<span>10:30 &middot; one short report</span></div>' % m0 +
        row('check', 'What we finished', at(10, 'finished'), '', 'ok') +
        row('clock', 'What&rsquo;s pending, and who has it', at(10, 'pending')) +
        row('alert', 'What we need from you', at(10, 'need'), '', 'warn') +
        '<div class="stars">%s</div>' % ''.join('<i style="--kd:%.2fs">%s</i>' % (at(10, 'star') + i * .15, ICON['star']) for i in range(5)),
        '<div class="mail"><div class="mh"><b>Your weekly service report</b><span>Harbour Point Logistics Ltd &middot; Monday 7 December</span></div><div class="mb">'
        '<div class="cnts"><div><b class="cnt" data-to="6" data-at="%d">6</b><span>finished</span></div><div><b class="cnt" data-to="4" data-at="%d">4</b><span>pending</span></div>'
        '<div class="w"><b class="cnt" data-to="2" data-at="%d">2</b><span>need you</span></div></div>'
        '<div class="nm"><div class="nmh">New members</div><div class="nr" style="--kd:%.2fs"><b>Marcus Sample</b><span class="g">Sent to Guardian &middot; with your agent</span></div>'
        '<div class="nr" style="--kd:%.2fs"><b>Chris Sample</b><span class="a">Waiting on Chris &middot; reminded</span></div></div>'
        '<div class="mbtn2">Answer and rate us</div></div>%s</div>'
        % (at(10, 'finished') * 1000, at(10, 'pending') * 1000, at(10, 'need') * 1000, at(10, 'pending') + .3, at(10, 'pending') + .7, TAG),
        'wide'))
    # 11 the bills
    b0 = at(11, 'check')
    lines11 = (('Employee only', '9', '5,904.00'), ('Employee + one', '3', '4,323.00'), ('Employee + family', '2', '3,610.00'),
               ('Group Life', '14', '1,267.50'), ('Pension, from salary', '9', '6,842.50'), ('Adjustment', '1', '&minus;225.00'))
    sc.append(split(11,
        eb('Every month') +
        '<div class="days2"><div style="--kd:%.2fs"><b>25<sup>th</sup></b><span>Your bills come to us first. We check every line against our records.</span></div>'
        '<div style="--kd:%.2fs"><b>26<sup>th</sup></b><span>You get one clear statement of what&rsquo;s due.</span></div></div>' % (at(11, 'bills'), at(11, 'statement')),
        '<div class="bill"><div class="bh"><b>December 2026</b><span>Checked against our records</span></div>' +
        ''.join('<div class="bl" style="--kd:%.2fs"><span>%s</span><span class="n">%s</span><span class="m">%s</span>%s</div>' % (b0 + i * .35, a, c, m, tick(b0 + .2 + i * .35))
                for i, (a, c, m) in enumerate(lines11)) +
        '<div class="btot" style="--kd:%.2fs"><span>Total due</span><b>TT$<span class="cnt" data-to="21722" data-at="%d" data-sep>21,722</span>.00</b></div>%s</div>'
        % (at(11, 'statement'), at(11, 'statement') * 1000, TAG),
        'wide'))
    # 12 looking ahead
    sc.append(split(12,
        eb('Looking ahead for your people') +
        '<h2>%s</h2>' % kin('No surprises.', .3, hi=('surprises.',)) +
        row('cake', 'Turning sixty-five', at(12, 'sixty'), 'the group cover ends: we help them convert') +
        row('grad', 'A child coming of age', at(12, 'child'), 'and leaving the family plan') +
        row('sun', 'Retiring on your company pension', at(12, 'retires'), 'a projection, five years ahead'),
        phone('e05b-coming-rows.png', 12, .3, moves=((at(12, 'sixty'), 'c65', 1.15), (at(12, 'child'), 'dep', 1.15), (at(12, 'retires'), 'ret', 1.1)),
              marks=((at(12, 'sixty') + .5, 'c65'), (at(12, 'child') + .5, 'dep'), (at(12, 'retires') + .5, 'ret'))),
        ''))
    # 13 someone leaves
    sc.append(split(13,
        eb('Someone leaves') +
        row('users', 'Search their name', at(13, 'search'), 'everyone on your plan, from our records') +
        row('doc', 'Guardian&rsquo;s change form fills itself in', at(13, 'fills'), '', 'ok') +
        row('repeat', 'Routed and followed up the same way', at(13, 'routed'), 'to Guardian, your agent and our sales support', 'ok'),
        '<div class="duo">%s%s</div>' % (phone('c10-form-search.png', 13, .2, w=206, cls='back'),
                                         phone('c10b-form-pdf.png', 13, at(13, 'form', lead=.5), w=236, moves=((at(13, 'fills'), 'pdf-page1', 1.15),), cls='front')),
        'duo2'))
    # 14 easiConnect
    sc.append(split(14,
        eb('For your employees') +
        '<h2>%s</h2>' % kin('Guardian&rsquo;s own health portal.', at(14, 'portal', lead=.3)) +
        '<div class="tiles">' + ''.join('<div class="tl3" style="--kd:%.2fs"><b>%s</b><span>%s</span></div>' % (at(14, w), ICON[i], t)
                                         for w, i, t in (('claims', 'list', 'Their claims'), ('cover', 'shield', 'Their cover'), ('request', 'mail', 'A request to Guardian'))) + '</div>'
        '<div class="url" style="--kd:%.2fs">easiconnect.myguardiangroup.com</div>' % at(14, 'sign'),
        '<div class="easi">%s<div class="cap" style="--kd:%.2fs">Guardian&rsquo;s easiConnect sign-in page</div></div>' % (lap('x01-easi-signin.png', 14, .3, w=500, h=310, tag=False), at(14, 'Easy')),
        'wide'))
    # 15 renewal
    steps15 = (('We start early', 'well before the renewal date', at(15, 'early')), ('Your updated staff list', 'so the terms fit today&rsquo;s people', at(15, 'staff')),
               ('Guardian&rsquo;s renewal terms', 'in good time, in plain words', at(15, 'terms')), ('Anyone leaving the plan', 'helped to a plan of their own', at(15, 'leaving')))
    sc.append(S(15,
        '<div class="hd">' + eb('At renewal') + '<h2>%s</h2></div>' % kin('We start early.', .3, hi=('early.',)) +
        '<div class="four"><i class="bar4" style="--kd:%.2fs;--kt:%.2fs"></i>' % (at(15, 'early'), max(2.0, at(15, 'leaving') - at(15, 'early'))) +
        ''.join('<div class="pt" style="--kd:%.2fs"><i>%d</i><b>%s</b><span>%s</span></div>' % (d, k + 1, t, u) for k, (t, u, d) in enumerate(steps15)) + '</div>',
        'ren'))
    # 16 how we work: every request a task
    w0 = at(16, 'request')
    cards = (('Enrol Marcus Sample', 'Sasha', '1 Dec', 'c1'), ('Change form · Kevin', 'Elizabeth', '3 Dec', 'c2'),
             ('Renewal terms', 'Azariah', '15 Jan', 'c3'), ('Bill query · December', 'Sasha', '28 Nov', 'c4'))
    sc.append(S(16,
        '<div class="hd">' + eb('Behind it all') + '<h2>%s</h2></div>' % kin('Every request is a task with a name and a date.', .3, hi=('name', 'date.')) +
        '<div class="kan"><div class="col"><b>New</b></div><div class="col"><b>In progress</b></div><div class="col"><b>Done</b></div>' +
        ''.join('<div class="kc %s" style="--kd:%.2fs"><strong>%s</strong><span><i>%s</i>%s &middot; due %s</span></div>' % (c, w0 + i * .25, t, nm[0], nm, dt)
                for i, (t, nm, dt, c) in enumerate(cards)) +
        '<div class="mv" style="--kd:%.2fs">%s Our branch sees what&rsquo;s moving, and what isn&rsquo;t</div></div>' % (at(16, 'moving'), ICON['list']),
        'kanban'))
    # 17 HELP 868 on WhatsApp
    c0 = at(17, 'message')
    sc.append(split(17,
        eb('Rather send a message?') +
        '<div class="h868" style="--kd:%.2fs"><b>%s</b><div>HELP 868<span>on WhatsApp &middot; +1 868 435 7868</span></div></div>' % (at(17, 'Help'), ICON['chat']) +
        row('check', 'Connected to our system', at(17, 'connected'), 'your message reaches the right person', 'ok'),
        '<div class="ph2 wa"><div class="notch"></div><div class="wah"><i></i><b>HELP 868</b><span>Ricky Rampersad Branch</span></div><div class="chat">'
        '<div class="bb me" style="--kd:%.2fs">Has Marcus&rsquo;s enrolment gone to Guardian?</div>'
        '<div class="dots" style="--kd:%.2fs;--ke:%.2fs"><i></i><i></i><i></i></div>'
        '<div class="bb them" style="--kd:%.2fs">Yes, it went today. Your agent and our sales support team have it, and we&rsquo;ll follow it up on Thursday.</div>'
        '<div class="bb me" style="--kd:%.2fs">Perfect, thank you!</div></div>%s</div>'
        % (c0, c0 + .9, at(17, 'connected'), at(17, 'connected'), at(17, 'right'), TAG),
        'phone2'))
    # 18 the close
    sc.append(S(18,
        '<div class="mid">' + MARK_SVG +
        '<h1 class="h1s">%s</h1>' % kin('This is what employers have always wanted.', .3, hi=('always',)) +
        '<div class="three">' + ''.join('<span style="--kd:%.2fs">%s %s</span>' % (at(18, w), ICON['check'], t)
                                        for w, t in (('Less', 'Less paper'), ('chasing', 'No chasing'), ('knows', 'A branch that knows your people'))) + '</div>'
        '<div class="punch" style="--kd:%.2fs">We make it happen.</div>'
        '<div class="cta" style="--kd:%.2fs"><span>%s HELP 868 on WhatsApp</span><span>rickyrampersadbranch.com</span></div></div>'
        % (at(18, 'make'), at(18, 'make') + .6, ICON['chat']), 'close'))
    return sc

CSS = """
@font-face{font-family:Plex;src:url(__PLEX__) format('woff2');font-weight:100 700;font-display:block}
:root{--ground:#faf9f2;--card:#fff;--ink:#0d3f5e;--body:#2b3b47;--muted:#5b6670;--act:#00728d;--soft:#e6f2f4;--line:#e4e0d4;
  --ok:#1e7a4c;--okbg:#e6f3ec;--bad:#b4372b;--badbg:#fbecea;--amb:#9a5b00;--ambbg:#fdf1dc;--sh:32deg 20% 42%}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1280px;height:720px;overflow:hidden;background:#0d3f5e}
body{font-family:Plex,system-ui,sans-serif;color:var(--body);-webkit-font-smoothing:antialiased}
#stage{position:relative;width:1280px;height:616px;overflow:hidden;background:var(--ground)}
#strip{position:absolute;left:0;top:616px;width:1280px;height:104px;background:#0d3f5e}
.sc{position:absolute;inset:0;opacity:0;visibility:hidden}
.sc.act{opacity:1;visibility:visible;animation:zin .7s cubic-bezier(.2,.7,.2,1) both}
.sc.out{opacity:1;visibility:visible;animation:zout .7s cubic-bezier(.4,0,.8,.3) both}
@keyframes zin{from{transform:translateY(24px);opacity:0}to{transform:none;opacity:1}}
@keyframes zout{from{opacity:1}to{transform:translateY(-18px);opacity:0}}
.in{position:absolute;inset:0;padding:44px 64px;display:flex;align-items:center}
.mid{width:100%;text-align:center;position:relative}
.split{width:100%;display:flex;align-items:center;gap:54px}
.split .L{flex:1;min-width:0}
.split .R{position:relative;flex:0 0 470px;display:flex;justify-content:center}
.sc.wide .R{flex:0 0 560px}
h1{font-size:56px;font-weight:600;line-height:1.1;letter-spacing:-1px;color:var(--ink)}
h2{font-size:38px;font-weight:600;line-height:1.15;letter-spacing:-.5px;color:var(--ink);margin-bottom:16px}
.kw{display:inline-block;animation:wpop .6s cubic-bezier(.2,.9,.3,1) both;animation-delay:var(--kd)}
.kw.hi{color:var(--act)}
@keyframes wpop{0%{opacity:0;transform:translateY(22px) scale(.7)}65%{opacity:1;transform:translateY(-3px) scale(1.04)}100%{opacity:1;transform:none}}
@keyframes up{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
@keyframes pop{0%{opacity:0;transform:scale(.6)}70%{opacity:1;transform:scale(1.06)}100%{opacity:1;transform:none}}
@keyframes fade{from{opacity:0}to{opacity:1}}
.eyebrow{font-size:14px;font-weight:600;letter-spacing:2.4px;text-transform:uppercase;color:var(--act);margin-bottom:12px;animation:up .5s both;animation-delay:var(--kd)}
.row{display:flex;gap:14px;align-items:center;padding:12px 16px;margin-top:10px;border-radius:14px;background:var(--card);
  box-shadow:0 8px 22px hsl(var(--sh)/.10);border:1px solid var(--line);animation:up .5s both;animation-delay:var(--kd)}
.row b{width:40px;height:40px;border-radius:11px;display:grid;place-items:center;flex:0 0 40px;background:var(--soft);color:var(--act)}
.row b svg{width:22px;height:22px}
.row.ok b{background:var(--okbg);color:var(--ok)}.row.warn b{background:var(--ambbg);color:var(--amb)}.row.bad b{background:var(--badbg);color:var(--bad)}
.rt{font-size:20px;font-weight:600;color:var(--ink);line-height:1.25}.rs{font-size:15px;color:var(--muted);margin-top:2px}
.tag{position:absolute;right:8px;bottom:8px;font-size:9px;font-weight:600;color:#fff;background:rgba(13,63,94,.82);padding:3px 8px;border-radius:99px;z-index:5}
.pill{display:inline-flex;align-items:center;gap:8px;margin-top:16px;padding:8px 16px;border-radius:99px;background:var(--ink);color:#fff;font-size:17px;font-weight:600;animation:pop .5s both;animation-delay:var(--kd)}
.pill svg{width:18px;height:18px}

/* the title */
.mark{width:120px;height:120px;display:block;margin:0 auto 22px}
.mark .mkf{fill:var(--act);stroke:var(--ink);stroke-width:1.5;opacity:0;animation:fade .6s .1s both}
.mark .mkc1{stroke:#0a3350;stroke-width:6.5;fill:none;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:50;stroke-dashoffset:50;animation:draw .7s .5s both}
.mark .mkc2{stroke:#fff;stroke-width:2.8;fill:none;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:50;stroke-dashoffset:50;animation:draw .7s .5s both}
@keyframes draw{to{stroke-dashoffset:0}}
.title h1{font-size:64px}
.plans{display:flex;gap:12px;justify-content:center;margin-top:26px}
.pl{padding:10px 20px;border-radius:99px;background:var(--card);border:1px solid var(--line);font-size:20px;font-weight:600;color:var(--ink);
  box-shadow:0 8px 20px hsl(var(--sh)/.10);animation:pop .5s both;animation-delay:var(--kd)}
.floaters i{position:absolute;width:78px;height:78px;border-radius:20px;background:var(--card);border:1px solid var(--line);color:var(--act);
  display:grid;place-items:center;box-shadow:0 12px 26px hsl(var(--sh)/.14);animation:pop .6s both,flt 7s ease-in-out infinite alternate;
  animation-delay:var(--kd),calc(var(--kd) + .6s)}
.floaters i svg{width:34px;height:34px}
.floaters .f0{left:90px;top:-10px}.floaters .f1{left:0;top:180px}.floaters .f4{left:120px;top:340px;width:60px;height:60px}
.floaters .f2{right:90px;top:0}.floaters .f3{right:0;top:190px}.floaters .f5{right:120px;top:350px;width:60px;height:60px;color:var(--ok)}
.floaters .f4 svg,.floaters .f5 svg{width:26px;height:26px}
.mid > *:not(.floaters){position:relative;z-index:1}
@keyframes flt{from{transform:translateY(0) rotate(-2deg)}to{transform:translateY(-18px) rotate(2deg)}}

/* the old desk */
.desk{position:relative;width:470px;height:440px}
.surf{position:absolute;left:0;right:0;bottom:30px;height:150px;border-radius:18px;background:#efe6d3;border:1px solid #e0d4bb}
.stack{position:absolute;bottom:120px;width:150px;height:200px}.stack.a{left:30px}.stack.b{left:200px;bottom:110px}
.sh{position:absolute;left:0;bottom:0;width:140px;height:100px;border-radius:4px;background:#fff;border:1px solid #d9d2c2;
  box-shadow:0 2px 0 #ece6d8;transform:translateY(var(--y)) rotate(var(--r));animation:drop .45s cubic-bezier(.3,1.4,.5,1) both;animation-delay:var(--kd)}
.sh:after{content:'';position:absolute;left:14px;right:14px;top:16px;height:44px;background:repeating-linear-gradient(#e7e2d7 0 2px,transparent 2px 10px)}
@keyframes drop{from{opacity:0;transform:translateY(calc(var(--y) - 80px)) rotate(var(--r))}to{opacity:1;transform:translateY(var(--y)) rotate(var(--r))}}
.ring{position:absolute;right:28px;top:20px;width:64px;height:64px;border-radius:50%;background:var(--badbg);color:var(--bad);display:grid;place-items:center;
  animation:pop .4s both,shake .5s ease-in-out infinite;animation-delay:var(--kd),calc(var(--kd) + .4s)}
.ring svg{width:30px;height:30px}
@keyframes shake{0%,100%{transform:rotate(0)}25%{transform:rotate(-14deg)}75%{transform:rotate(14deg)}}
.inbox{position:absolute;right:120px;top:26px;width:64px;height:52px;border-radius:12px;background:var(--card);border:1px solid var(--line);color:var(--ink);display:grid;place-items:center}
.inbox svg{width:30px;height:30px}.badge{position:absolute;right:-14px;top:-12px;min-width:34px;height:26px;padding:0 8px;border-radius:13px;background:var(--bad);color:#fff;font-size:15px;font-weight:700;display:grid;place-items:center}
.cal{position:absolute;right:10px;bottom:96px;width:170px;padding:10px;border-radius:12px;background:var(--card);border:1px solid var(--line);box-shadow:0 8px 18px hsl(var(--sh)/.12)}
.cal .ch2{display:flex;gap:6px;align-items:center;font-size:13px;font-weight:600;color:var(--ink);margin-bottom:6px}.cal .ch2 svg{width:16px;height:16px}
.cal .grid{display:grid;grid-template-columns:repeat(5,1fr);gap:4px}.cal .grid i{height:18px;border-radius:4px;background:#f1eee6;position:relative}
.cal .grid i.x:after{content:'\\2715';position:absolute;inset:0;display:grid;place-items:center;color:var(--bad);font-style:normal;font-weight:700;font-size:13px;
  background:var(--badbg);border-radius:4px;animation:pop .3s both;animation-delay:var(--kd)}
.note{position:absolute;width:132px;padding:12px;font-size:15px;font-weight:600;color:#5a4300;background:#ffe9a8;box-shadow:0 8px 16px hsl(var(--sh)/.18);
  animation:stick .45s cubic-bezier(.3,1.5,.5,1) both;animation-delay:var(--kd)}
.note.n0{left:10px;top:40px;transform:rotate(-6deg)}.note.n1{left:160px;top:10px;transform:rotate(4deg)}.note.n2{left:300px;top:150px;transform:rotate(-3deg)}
@keyframes stick{from{opacity:0;scale:1.4}to{opacity:1;scale:1}}

/* fly away, then the system */
.flyaway{position:absolute;left:50%;top:50%}
.flyaway i{position:absolute;width:90px;height:64px;border-radius:4px;background:#fff;border:1px solid #d9d2c2;animation:fly .9s ease-in both;animation-delay:var(--kd)}
@keyframes fly{from{opacity:1;transform:translate(-45px,-32px)}to{opacity:0;transform:translate(var(--x),var(--y)) rotate(var(--r)) scale(.6)}}
.lap{position:relative;display:inline-block;border-radius:12px;overflow:hidden;background:#fff;border:1px solid #d6dbe0;
  box-shadow:0 26px 54px hsl(var(--sh)/.22);animation:rise .8s cubic-bezier(.2,.8,.25,1) both;animation-delay:var(--kd)}
.lap .bar3{height:22px;background:#eef0f2;display:flex;gap:6px;align-items:center;padding:0 10px}.lap .bar3 i{width:9px;height:9px;border-radius:50%;background:#c6ccd3}
@keyframes rise{from{opacity:0;transform:translateY(40px)}to{opacity:1;transform:none}}
.vp{position:relative;overflow:hidden}.zl{position:relative;transform-origin:0 0}.zl img{display:block}
.mk2{position:absolute;border:3px solid var(--act);border-radius:10px;opacity:0;animation:mk2 .5s both;animation-delay:var(--kd);box-shadow:0 0 0 6px rgba(0,114,141,.15)}
@keyframes mk2{from{opacity:0;transform:scale(1.08)}to{opacity:1;transform:none}}

/* HR's form */
.form{position:relative;width:520px;padding:22px 24px;border-radius:18px;background:var(--card);border:1px solid var(--line);box-shadow:0 24px 50px hsl(var(--sh)/.18);
  animation:rise .7s both;animation-delay:.2s}
.fh{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:12px}.fh b{font-size:20px;color:var(--ink)}.fh span{font-size:14px;font-weight:600;color:var(--act)}
.fr{margin-top:10px}.fr label{display:block;font-size:13px;font-weight:600;color:var(--muted);margin-bottom:4px}
.fv{height:40px;border:1.5px solid #c9d0d6;border-radius:9px;padding:0 12px;display:flex;align-items:center;font-size:18px;color:var(--ink);background:#fff}
.ty{display:inline-flex;align-items:center}.ch{opacity:0;animation:chs .01s steps(1) both;animation-delay:var(--kd)}
@keyframes chs{to{opacity:1}}
.caret{display:inline-block;width:2px;height:20px;background:var(--act);margin-left:1px;opacity:0;animation:car .9s steps(2) infinite,caro .01s both;animation-delay:var(--kd),var(--ke)}
@keyframes car{0%{opacity:1}50%{opacity:0}}@keyframes caro{to{visibility:hidden}}
.cks{display:flex;gap:18px}.ck{display:flex;gap:8px;align-items:center;font-size:17px;color:var(--ink)}.ck i{font-style:normal}
.tk{display:inline-grid;place-items:center;width:24px;height:24px;border-radius:6px;border:2px solid #c9d0d6;position:relative;color:#fff}
.tk svg{width:16px;height:16px;opacity:0;animation:fade .2s both;animation-delay:var(--kd)}
.tk:before{content:'';position:absolute;inset:-2px;border-radius:6px;background:var(--act);opacity:0;animation:pop .3s both;animation-delay:var(--kd)}
.tk svg{position:relative}
.btn{position:relative;overflow:hidden;margin-top:16px;display:flex;gap:10px;justify-content:center;align-items:center;height:50px;border-radius:12px;background:var(--act);
  color:#fff;font-size:18px;font-weight:600;animation:press .35s both;animation-delay:var(--kd)}.btn svg{width:20px;height:20px}
@keyframes press{0%{transform:none}40%{transform:scale(.95)}100%{transform:none}}
.rip{position:absolute;left:50%;top:50%;width:20px;height:20px;margin:-10px;border-radius:50%;background:rgba(255,255,255,.55);opacity:0;animation:rip .7s ease-out both;animation-delay:inherit}
.btn .rip,.mbtn .rip{animation-delay:var(--kd)}
@keyframes rip{0%{opacity:1;transform:scale(1)}100%{opacity:0;transform:scale(28)}}
.toast{position:absolute;left:24px;right:24px;bottom:-24px;display:flex;gap:10px;align-items:center;padding:14px 16px;border-radius:12px;background:var(--okbg);
  color:var(--ok);font-size:17px;font-weight:600;border:1px solid #bfe0cc;animation:up .5s both;animation-delay:var(--kd)}.toast svg{width:20px;height:20px}

/* the employee's phone, drawn */
.ph2{position:relative;width:280px;height:540px;border-radius:38px;background:#fff;border:9px solid #1f2d38;box-shadow:0 30px 60px hsl(var(--sh)/.25);overflow:hidden;
  animation:rise .7s both,bob 5s ease-in-out .7s infinite alternate}
@keyframes bob{from{translate:0 0}to{translate:0 -8px}}
.notch{position:absolute;left:50%;top:8px;width:84px;height:20px;margin-left:-42px;border-radius:12px;background:#1f2d38;z-index:3}
.scr{position:absolute;inset:0;padding:40px 16px 16px;background:#fff}
.scr.s1{animation:sout .5s both;animation-delay:calc(var(--k1) + 2.6s)}
.scr.s2{opacity:0;animation:sin .5s both,sout .5s forwards;animation-delay:var(--k1),var(--k2)}
.scr.s3{opacity:0;animation:sin .5s both;animation-delay:var(--k1)}
@keyframes sin{from{opacity:0;transform:translateX(60px)}to{opacity:1;transform:none}}
@keyframes sout{from{opacity:1;transform:none}to{opacity:0;transform:translateX(-60px)}}
.ib{font-size:14px;font-weight:600;color:var(--muted);margin-bottom:10px}
.mailc{padding:14px;border-radius:14px;border:1px solid var(--line);animation:up .5s both;animation-delay:var(--k1)}
.mailc b{display:block;font-size:14px;color:var(--ink)}.mailc span{display:block;font-size:13px;font-weight:600;color:var(--act);margin:4px 0 8px}
.mailc p{font-size:13px;line-height:1.4;color:var(--body)}
.mbtn{position:relative;overflow:hidden;margin-top:12px;height:42px;border-radius:10px;background:var(--act);color:#fff;font-size:15px;font-weight:600;display:grid;place-items:center;
  animation:press .35s both;animation-delay:calc(var(--k1) + 1.6s)}.mailc .mbtn .rip{animation-delay:calc(var(--k1) + 1.6s)}
.stp{display:flex;gap:4px;margin-bottom:10px}.stp span{flex:1;font-size:10px;font-weight:600;color:var(--muted);text-align:center}
.stp i{display:block;margin:0 auto 3px;width:22px;height:22px;border-radius:50%;background:#e5e9ec;color:var(--muted);font-style:normal;line-height:22px;font-size:11px}
.stp span.on i{animation:ston .3s both;animation-delay:var(--kd)}@keyframes ston{to{background:var(--act);color:#fff}}
.scr .fr label{font-size:11px}.scr .fv{height:34px;font-size:14px}.scr .caret{height:16px}
.sub2{margin-top:10px;font-size:11px;font-weight:600;color:var(--muted)}
.chip2{margin-top:4px;padding:8px 10px;border-radius:9px;background:var(--soft);color:var(--ink);font-size:13px;font-weight:600;animation:pop .4s both;animation-delay:var(--kd)}
.lockb{display:flex;gap:8px;align-items:center;padding:10px;border-radius:10px;background:var(--okbg);color:var(--ok);font-size:12px;font-weight:600}.lockb svg{width:18px;height:18px;flex:none}
.q{margin-top:14px;font-size:13px;font-weight:600;color:var(--ink)}.yn{display:flex;gap:8px;margin-top:6px}
.yn span{flex:1;height:34px;border-radius:9px;border:1.5px solid #c9d0d6;display:grid;place-items:center;font-size:14px;color:var(--muted)}
.yn span.no{animation:chooseno .3s both;animation-delay:var(--kd)}@keyframes chooseno{to{background:var(--act);border-color:var(--act);color:#fff}}
.scr.sig .sh2{font-size:14px;font-weight:600;color:var(--ink);margin-bottom:8px}
.sgn{width:100%;height:150px;border:1.5px dashed #c9d0d6;border-radius:12px;background:#fbfcfc}
.sgn path{fill:none;stroke:#0d3f5e;stroke-width:3;stroke-linecap:round;stroke-dasharray:900;stroke-dashoffset:900;animation:draw 1.5s ease-in-out both;animation-delay:var(--kd)}
.scr.sig .mbtn{animation-delay:var(--kd)}
.scr.done{opacity:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:10px;animation:sin .5s both;animation-delay:var(--k1)}
.bigok{width:90px;height:90px;border-radius:50%;background:var(--ok);color:#fff;display:grid;place-items:center;animation:pop .5s both;animation-delay:inherit}
.bigok svg{width:52px;height:52px}.scr.done b{font-size:19px;color:var(--ink)}.scr.done span{font-size:13px;color:var(--muted);line-height:1.4}
.week{margin-top:18px}.wl{font-size:18px;color:var(--ink);font-weight:600;margin-bottom:10px;animation:up .5s both;animation-delay:var(--kd)}
.dy{display:inline-flex;flex-direction:column;align-items:center;gap:4px;width:74px;padding:10px 0;margin-right:8px;border-radius:12px;background:var(--card);border:1px solid var(--line);
  color:var(--act);animation:pop .4s both;animation-delay:var(--kd)}.dy b{font-size:14px;color:var(--ink)}.dy svg{width:22px;height:22px}.dy span{font-size:11px;color:var(--muted)}

/* Guardian's form */
.paper{position:relative;padding:10px;border-radius:12px;background:#fff;border:1px solid var(--line);box-shadow:0 24px 50px hsl(var(--sh)/.2);animation:rise .7s both;animation-delay:.2s}
.scan{position:absolute;left:10px;right:10px;top:10px;height:4px;background:var(--act);box-shadow:0 0 18px 4px rgba(0,114,141,.35);z-index:4;opacity:0;
  animation:scan 3.4s ease-in-out both;animation-delay:var(--kd)}
@keyframes scan{0%{opacity:1;transform:translateY(0)}90%{opacity:1;transform:translateY(460px)}100%{opacity:0;transform:translateY(470px)}}
.stamp{position:absolute;right:-18px;bottom:30px;padding:10px 14px;border:3px solid var(--ok);border-radius:10px;color:var(--ok);background:rgba(255,255,255,.94);
  font-size:15px;font-weight:700;text-align:center;transform:rotate(-8deg);z-index:5;animation:stampin .4s cubic-bezier(.3,1.6,.5,1) both;animation-delay:var(--kd)}
@keyframes stampin{from{opacity:0;transform:rotate(-8deg) scale(2)}to{opacity:1;transform:rotate(-8deg) scale(1)}}
.flies{display:flex;flex-wrap:wrap;gap:8px;margin:4px 0 6px}
.fly{padding:8px 14px;border-radius:99px;background:var(--soft);color:var(--ink);font-size:15px;font-weight:600;animation:flyr .7s cubic-bezier(.2,.8,.3,1) both;animation-delay:var(--kd)}
@keyframes flyr{from{opacity:0;transform:translateX(-40px)}to{opacity:1;transform:none}}

/* routing */
.sc.routes .in,.sc.tl .in,.sc.ren .in,.sc.kanban .in{flex-direction:column;align-items:stretch;justify-content:center}
.hd{text-align:center}
.route{position:relative;margin:10px auto 0}.route.down{display:none}
.lines{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
.ln{fill:none;stroke:var(--act);stroke-width:3;stroke-dasharray:420;stroke-dashoffset:420;animation:draw .8s ease-out both;animation-delay:var(--kd)}
.pk{position:absolute;left:0;top:0;width:14px;height:14px;margin:-7px;border-radius:50%;background:var(--act);box-shadow:0 0 0 5px rgba(0,114,141,.18);opacity:0;
  offset-rotate:0deg;animation:pk 1.4s ease-in-out both;animation-delay:var(--kd)}
@keyframes pk{0%{opacity:1;offset-distance:0%}95%{opacity:1;offset-distance:100%}100%{opacity:0;offset-distance:100%}}
.nd{position:absolute;width:210px;padding:14px 16px;border-radius:16px;background:var(--card);border:1px solid var(--line);box-shadow:0 14px 30px hsl(var(--sh)/.14);
  animation:pop .5s both;animation-delay:var(--kd)}
.nd b{display:grid;place-items:center;width:40px;height:40px;border-radius:11px;background:var(--soft);color:var(--act);margin-bottom:8px}.nd b svg{width:22px;height:22px}
.nd span{display:block;font-size:18px;font-weight:600;color:var(--ink)}.nd em{display:block;font-style:normal;font-size:13px;color:var(--muted);margin-top:3px}
.route.across .nd.src{left:0;top:132px}.route.across .nd.you{left:380px;top:120px;width:180px}.nd.you{border:2px solid var(--act)}
.route.across .nd.t1{left:760px;top:0}.route.across .nd.t2{left:760px;top:140px}.route.across .nd.t3{left:760px;top:270px}
.route.down .nd{width:200px}.route.down .nd.src{left:200px;top:0;width:240px}.route.down .nd.you{left:210px;top:168px;width:220px}
.route.down .nd.t1{left:6px;top:440px}.route.down .nd.t2{left:220px;top:440px}.route.down .nd.t3{left:434px;top:440px}
.nd.t1 b,.nd.t2 b,.nd.t3 b{background:var(--okbg);color:var(--ok)}
.okb{display:inline-flex;gap:6px;align-items:center;margin-top:8px;padding:5px 10px;border-radius:99px;background:var(--okbg);color:var(--ok);font-style:normal;font-size:13px;font-weight:700;
  animation:pop .4s both;animation-delay:var(--kd)}.okb svg{width:14px;height:14px}

/* the follow-up line */
.tline{position:relative;height:200px;margin:30px 10px 0}
.rail{position:absolute;left:43px;width:84%;top:40px;height:6px;border-radius:3px;background:#e2e6e9}
.fill{position:absolute;left:0;top:0;bottom:0;width:100%;border-radius:3px;background:var(--act);transform:scaleX(0);transform-origin:left;
  animation:grow var(--kt) linear both;animation-delay:var(--kd)}@keyframes grow{to{transform:scaleX(1)}}@keyframes growy{to{transform:scaleY(1)}}
.stop{position:absolute;top:0;left:calc(var(--i) * 28%);width:210px;animation:pop .45s both;animation-delay:var(--kd)}
.stop b{display:grid;place-items:center;width:86px;height:86px;border-radius:50%;background:var(--card);border:3px solid var(--act);color:var(--act);margin-bottom:10px}
.stop b svg{width:36px;height:36px}.stop.end b{background:var(--ok);border-color:var(--ok);color:#fff}
.stop strong{display:block;font-size:22px;color:var(--ink)}.stop span{display:block;font-size:15px;color:var(--muted)}
.see{display:flex;gap:10px;align-items:center;justify-content:center;margin-top:8px;font-size:20px;font-weight:600;color:var(--ink);animation:up .5s both;animation-delay:var(--kd)}
.see svg{width:22px;height:22px;color:var(--act)}

/* the report */
.clock{font-size:64px;font-weight:600;color:var(--ink);line-height:1;letter-spacing:-1px;margin-bottom:8px;animation:up .5s both;animation-delay:var(--kd)}
.clock span{display:block;font-size:19px;font-weight:500;color:var(--muted);letter-spacing:0;margin-top:8px}
.stars{display:flex;gap:6px;margin-top:14px}.stars i{color:#c98a00;animation:pop .35s both;animation-delay:var(--kd)}
.stars svg{width:32px;height:32px;fill:#f2b928;stroke:#c98a00}
.mail{position:relative;width:520px;border-radius:16px;overflow:hidden;background:var(--card);border:1px solid var(--line);box-shadow:0 24px 50px hsl(var(--sh)/.18);animation:rise .7s both;animation-delay:.3s}
.mh{padding:16px 20px;background:var(--ink);color:#fff}.mh b{display:block;font-size:19px}.mh span{font-size:13px;color:#cfe3ea}
.mb{padding:18px 20px}.cnts{display:flex;gap:12px}.cnts div{flex:1;padding:12px;border-radius:12px;background:var(--soft);text-align:center}
.cnts b{display:block;font-size:34px;color:var(--ink)}.cnts span{font-size:13px;color:var(--muted)}.cnts .w{background:var(--ambbg)}.cnts .w b{color:var(--amb)}
.nm{margin-top:14px}.nmh{font-size:12px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:var(--muted);margin-bottom:6px}
.nr{display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-top:1px solid var(--line);animation:up .4s both;animation-delay:var(--kd)}
.nr b{font-size:15px;color:var(--ink)}.nr span{font-size:12px;font-weight:600;padding:4px 10px;border-radius:99px}
.nr .g{background:var(--okbg);color:var(--ok)}.nr .a{background:var(--ambbg);color:var(--amb)}
.mbtn2{margin-top:12px;height:42px;border-radius:10px;background:var(--act);color:#fff;font-size:15px;font-weight:600;display:grid;place-items:center}

/* the bill */
.days2{display:grid;gap:14px}
.days2 div{display:flex;gap:18px;align-items:center;padding:16px 18px;border-radius:16px;background:var(--card);border:1px solid var(--line);box-shadow:0 10px 24px hsl(var(--sh)/.10);
  animation:up .5s both;animation-delay:var(--kd)}
.days2 b{font-size:52px;font-weight:600;color:var(--ink);line-height:1;min-width:108px;letter-spacing:-2px}.days2 sup{font-size:20px;letter-spacing:0}
.days2 span{font-size:19px;line-height:1.35;color:var(--body)}
.bill{position:relative;width:520px;padding:18px 20px 22px;border-radius:16px;background:var(--card);border:1px solid var(--line);box-shadow:0 24px 50px hsl(var(--sh)/.18);animation:rise .7s both;animation-delay:.2s}
.bh{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px}.bh b{font-size:20px;color:var(--ink)}.bh span{font-size:13px;font-weight:600;color:var(--ok)}
.bl{display:grid;grid-template-columns:1fr 40px 110px 28px;gap:8px;align-items:center;padding:9px 0;border-top:1px solid var(--line);font-size:16px;color:var(--body);animation:fade .3s both;animation-delay:var(--kd)}
.bl .n{text-align:right;color:var(--muted)}.bl .m{text-align:right;font-variant-numeric:tabular-nums;color:var(--ink);font-weight:600}
.bl .tk{border-color:transparent}.bl .tk:before{background:var(--ok)}
.btot{display:flex;justify-content:space-between;align-items:center;margin-top:10px;padding:12px 14px;border-radius:12px;background:var(--ink);color:#fff;font-size:17px;animation:pop .5s both;animation-delay:var(--kd)}
.btot b{font-size:24px;font-variant-numeric:tabular-nums}

/* real phones */
.phone{position:relative;display:inline-block;border-radius:30px;overflow:hidden;border:8px solid #1f2d38;background:#fff;box-shadow:0 28px 56px hsl(var(--sh)/.25);
  animation:rise .8s both,bob 6s ease-in-out .8s infinite alternate;animation-delay:var(--kd),calc(var(--kd) + .8s)}
.phone .vp{border-radius:22px}
.duo{position:relative;width:470px;height:520px}.duo .phone{position:absolute}.duo .back{left:0;top:0;opacity:.92}.duo .front{right:0;bottom:0}

/* easiConnect */
.tiles{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:6px}
.tl3{padding:16px 14px;border-radius:14px;background:var(--card);border:1px solid var(--line);box-shadow:0 10px 22px hsl(var(--sh)/.10);animation:pop .45s both;animation-delay:var(--kd)}
.tl3 b{display:grid;place-items:center;width:40px;height:40px;border-radius:11px;background:var(--soft);color:var(--act);margin-bottom:10px}.tl3 b svg{width:22px;height:22px}
.tl3 span{font-size:17px;font-weight:600;color:var(--ink)}
.url{margin-top:14px;font-size:17px;color:var(--muted);animation:up .5s both;animation-delay:var(--kd)}
.easi{display:flex;flex-direction:column;align-items:center;gap:10px}.easi .cap{font-size:14px;color:var(--muted);animation:up .5s both;animation-delay:var(--kd)}

/* renewal */
.four{position:relative;display:grid;grid-template-columns:repeat(4,1fr);gap:18px;margin-top:30px}
.bar4{position:absolute;left:4%;right:4%;top:44px;height:4px;border-radius:2px;background:var(--act);transform:scaleX(0);transform-origin:left;animation:grow var(--kt) linear both;animation-delay:var(--kd)}
.pt{position:relative;padding:20px 18px;border-radius:18px;background:var(--card);border:1px solid var(--line);box-shadow:0 14px 30px hsl(var(--sh)/.12);animation:pop .5s both;animation-delay:var(--kd)}
.pt i{display:grid;place-items:center;width:44px;height:44px;border-radius:50%;background:var(--act);color:#fff;font-style:normal;font-weight:700;font-size:19px;margin-bottom:12px}
.pt b{display:block;font-size:20px;color:var(--ink);line-height:1.25}.pt span{display:block;font-size:15px;color:var(--muted);margin-top:6px}

/* how we work */
.kan{position:relative;display:grid;grid-template-columns:repeat(3,1fr);gap:16px;height:320px;margin:24px 40px 0}
.col{border-radius:16px;background:#f1efe7;border:1px solid var(--line);padding:12px 14px}.col b{font-size:15px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--muted)}
.kc{position:absolute;width:calc((100% - 32px) / 3 - 28px);padding:12px 14px;border-radius:12px;background:var(--card);border:1px solid var(--line);box-shadow:0 8px 18px hsl(var(--sh)/.14);
  animation:fade .4s both;animation-delay:var(--kd)}
.kc strong{display:block;font-size:16px;color:var(--ink)}.kc span{display:flex;gap:8px;align-items:center;margin-top:6px;font-size:13px;color:var(--muted)}
.kc span i{display:grid;place-items:center;width:24px;height:24px;border-radius:50%;background:var(--act);color:#fff;font-style:normal;font-size:12px;font-weight:700}
.kc.c1{left:14px;top:48px;animation:fade .4s both,mv1 6s cubic-bezier(.5,0,.3,1) both;animation-delay:var(--kd),calc(var(--kd) + .8s)}
.kc.c2{left:14px;top:130px;animation:fade .4s both,mv2 6s cubic-bezier(.5,0,.3,1) both;animation-delay:var(--kd),calc(var(--kd) + .8s)}
.kc.c3{left:14px;top:212px}
.kc.c4{left:calc(33.33% + 9px);top:48px;animation:fade .4s both,mv3 6s cubic-bezier(.5,0,.3,1) both;animation-delay:var(--kd),calc(var(--kd) + .8s)}
@keyframes mv1{0%,10%{transform:none}35%,60%{transform:translateX(calc(100% + 44px)) translateY(var(--dy,82px))}85%,100%{transform:translateX(calc(200% + 88px)) translateY(var(--dy,82px))}}
@keyframes mv2{0%,20%{transform:none}50%,100%{transform:translateX(calc(100% + 44px)) translateY(var(--dy,82px))}}
@keyframes mv3{0%,5%{transform:none}30%,100%{transform:translateX(calc(100% + 44px))}}
.mv{position:absolute;left:0;right:0;bottom:-58px;display:flex;gap:10px;align-items:center;justify-content:center;font-size:19px;font-weight:600;color:var(--ink);animation:up .5s both;animation-delay:var(--kd)}
.mv svg{width:22px;height:22px;color:var(--act)}

/* WhatsApp */
.h868{display:flex;gap:16px;align-items:center;margin:4px 0 18px;animation:pop .6s both;animation-delay:var(--kd)}
.h868 b{display:grid;place-items:center;width:72px;height:72px;border-radius:20px;background:#1e8e5a;color:#fff}.h868 b svg{width:36px;height:36px}
.h868 div{font-size:50px;font-weight:600;color:var(--ink);line-height:1;letter-spacing:-1px}.h868 span{display:block;font-size:18px;font-weight:500;color:var(--muted);letter-spacing:0;margin-top:8px}
.ph2.wa{background:#efeae2}
.wah{display:flex;gap:10px;align-items:center;padding:34px 14px 10px;background:#0b6b52;color:#fff}.wah i{width:30px;height:30px;border-radius:50%;background:#e6f2f4}
.wah b{font-size:15px}.wah span{display:block;font-size:11px;opacity:.8;margin-left:auto}
.chat{padding:12px 10px;display:flex;flex-direction:column;gap:8px}
.bb{max-width:82%;padding:9px 12px;border-radius:12px;font-size:14px;line-height:1.35;color:#1f2d38;box-shadow:0 1px 1px rgba(13,63,94,.12);animation:up .4s both;animation-delay:var(--kd)}
.bb.me{align-self:flex-end;background:#d9fdd3}.bb.them{align-self:flex-start;background:#fff}
.dots{align-self:flex-start;display:flex;gap:4px;padding:10px 12px;border-radius:12px;background:#fff;opacity:0;animation:dsh .01s both,dhide .01s both;animation-delay:var(--kd),var(--ke)}
.dots i{width:7px;height:7px;border-radius:50%;background:#9aa6ae;animation:dot 1s ease-in-out infinite}.dots i:nth-child(2){animation-delay:.15s}.dots i:nth-child(3){animation-delay:.3s}
@keyframes dsh{to{opacity:1}}@keyframes dhide{to{display:none}}@keyframes dot{0%,100%{transform:none}50%{transform:translateY(-4px)}}

/* the close */
.close .mark{width:96px;height:96px;margin-bottom:16px}
.h1s{font-size:48px}
.three{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-top:22px}
.three span{display:inline-flex;gap:8px;align-items:center;padding:10px 18px;border-radius:99px;background:var(--card);border:1px solid var(--line);font-size:19px;font-weight:600;color:var(--ink);
  box-shadow:0 8px 20px hsl(var(--sh)/.10);animation:pop .45s both;animation-delay:var(--kd)}.three svg{width:18px;height:18px;color:var(--ok)}
.punch{margin-top:24px;font-size:40px;font-weight:600;color:var(--act);animation:pop .55s both;animation-delay:var(--kd)}
.cta{display:flex;gap:16px;justify-content:center;margin-top:18px;animation:up .5s both;animation-delay:var(--kd)}
.cta span{display:inline-flex;gap:8px;align-items:center;padding:10px 18px;border-radius:12px;background:var(--ink);color:#fff;font-size:18px;font-weight:600}.cta svg{width:18px;height:18px}

/* ===================== the upright frame (720x1280: the picture 960 high, captions over the ink band below) */
body.port,body.port html{width:720px;height:1280px}
body.port #stage{width:720px;height:960px}
body.port #strip{top:960px;width:720px;height:320px}
body.port .in{padding:70px 36px 30px;align-items:center}
body.port .split{flex-direction:column;gap:28px;align-items:stretch}
body.port .split .R,body.port .sc.wide .R{flex:none;justify-content:center}
body.port h1{font-size:48px}body.port .title h1{font-size:54px}body.port h2{font-size:34px}
body.port .rt{font-size:18px}body.port .row{padding:10px 14px;margin-top:8px}
body.port .desk{zoom:1.1;margin:0 auto}
body.port .lap{zoom:1.1}
body.port .form{zoom:1}body.port .mail,body.port .bill{zoom:1.08}
body.port .ph2{zoom:.9}body.port .phone{zoom:1}body.port .duo{zoom:1.12;margin:0 auto}
body.port .route.across{display:none}body.port .route.down{display:block;margin-top:34px}
body.port .tline{height:560px;margin:34px 0 0 60px}
body.port .rail{left:41px;top:43px;width:6px;height:450px}
body.port .fill{transform:scaleY(0);transform-origin:top;animation-name:growy}
body.port .stop{left:0;top:calc(var(--i) * 150px);width:520px;display:grid;grid-template-columns:86px 1fr;column-gap:22px;align-items:center}
body.port .stop b{grid-row:1/3;margin:0}body.port .stop strong{align-self:end}body.port .stop span{align-self:start;font-size:17px}
body.port .sc.tl .see{margin-top:0}
body.port .four{grid-template-columns:repeat(2,1fr);margin-top:24px}
body.port .sc.ren .bar4{display:none}
body.port .kan{width:660px;height:460px;margin:30px auto 0;--dy:120px}
body.port .kc.c1,body.port .kc.c4{top:52px}body.port .kc.c2{top:172px}body.port .kc.c3{top:292px}
body.port .kc strong{font-size:15px}body.port .kc span{font-size:12px}
body.port .kan .mv{bottom:-60px}
body.port .paper{zoom:1.05}
body.port .days2 b{font-size:44px}
body.port .tiles{grid-template-columns:repeat(3,1fr)}
body.port .h1s{font-size:42px}body.port .three span{font-size:17px}
body.port .floaters{display:none}
body.port .clock{font-size:52px}
body.port .h868 div{font-size:44px}
"""

def main():
    sc = scenes()
    if len(sc) != N_LINES:
        sys.exit('SCENES: %d scenes for %d lines' % (len(sc), N_LINES))
    page = ('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex">'
            '<title>Your group, the digital way</title><style>' + CSS.replace('__PLEX__', PLEX) + ''.join(EXTRA) + '</style></head><body>'
            '<div id="stage">' + '\n'.join(sc) + '</div><div id="strip"></div>'
            '<script>'
            '(function(){var p=innerHeight>innerWidth;document.body.classList.toggle("port",p);'
            'document.documentElement.style.zoom=p?innerWidth/720:innerWidth/1280;})();'
            'var SC=[].slice.call(document.querySelectorAll(".sc"));'
            'var paused=false,timer=null,cur=-1;'
            'function go(n){'
            ' if(cur>=0&&SC[cur]){SC[cur].classList.remove("act");SC[cur].classList.add("out");}'
            ' var p=cur;cur=n;SC[n].classList.remove("out");SC[n].offsetWidth;SC[n].classList.add("act");'
            ' if(p>=0&&SC[p])setTimeout(function(){SC[p].classList.remove("out");},720);'
            ' if(!paused&&!window.__RENDER){timer=setTimeout(function(){go((n+1)%SC.length);},+SC[n].dataset.d);}'
            '}go(0);'
            '</script></body></html>')
    OUT.write_text(page)
    print('wrote %s  (%d scenes, %.1fs, %d KB)' % (OUT, len(DURS), sum(DURS) / 1000.0, len(page) // 1024))
    RESERVED = {'act', 'out', 'cnt', 'sc', 'in', 'rolling', 'grain'}
    for m in re.finditer(r'([^{}]+)\{', CSS):
        for sel in m.group(1).split(','):
            subject = re.split(r'[\s>+~]+', sel.strip())[-1]
            if subject.startswith('@') or subject in ('from', 'to') or re.fullmatch(r'[\d.,%]+', subject):
                continue
            for cls in re.findall(r'\.([a-zA-Z][\w-]*)', subject):
                if cls in RESERVED and not subject.startswith('.sc') and subject not in ('.in',):
                    sys.exit('RESERVED CLASS: "%s" styles .%s, which render.js owns' % (sel.strip(), cls))
    print('  no rule touches render.js\'s reserved classes')

if __name__ == '__main__':
    main()
