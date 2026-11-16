#!/usr/bin/env python3
"""The two group client management films, re-cut 16 November 2026.

    python3 build-gcmfilm.py client      ->  groupclientmanagement/new-way-film.html
    python3 build-gcmfilm.py staff       ->  groupclientmanagement/staff-new-way-film.html

The first cut (26 October 2026) was built in a session scratchpad that has since been deleted, so these pages are
a fresh build of the same two films, brought up to date and kept in the repository this time:

  - the group's film (gcmc2) now says the plans are Guardian Life group life, health and pension; tells the group
    about the people coming up (65, coming of age, retiring); asks them to rate the person who looks after their
    account on every bill; and never says "Rampersad" aloud, which this voice mispronounces;
  - the staff film (gcms2) adds the Monday 11:00 team note, the upload that brings the month's billing record in
    Salesforce into line and opens the termination, tier change and adjustment tasks itself, the bill e-mail that
    rates the account manager, and putting a group on hold.

Voice: Andrew Expressive (en-US-AndrewMultilingualNeural, +0%) on the tts-run runner, the whole film in one job.
Music: the branch theme (rr-branch-theme.mp3), as before.

The screens are the REAL pages (client.html, index.html, billing.html, training.html), shot against a fully mocked
backend with an invented branch: no client, person or figure on them is real, and every screen carries a
"Sample group · made-up figures" tag. They live in tools/film/gcmshots/.

One page draws both frames. Wide (1920x1080) lays out a 1280x720 design at zoom 1.5 with the captions in a strip;
upright (1080x1920, the group film's phone cut) lays out 720x1280 at zoom 1.5 with the captions over the picture.

Re-cut: edit the lines in gcm-lines.json, voice them on tts-run, then
    python3 importvox.py <tts/out/gcmc2> vogcmc2 1.15 --timing gcmc2-timing.json --lines <the film's lines>
    python3 build-gcmfilm.py client
    python3 usetrack.py ../../rr-branch-theme.mp3 gcmc2 ; python3 sfx.py ... ; RENDER_W=1920 RENDER_H=1080 node render.js ...
"""
import base64, io, json, os, pathlib, re, sys

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent.parent
FILM = sys.argv[1] if len(sys.argv) > 1 else 'client'
KEY = {'client': 'gcmc3', 'staff': 'gcms3'}[FILM]
SHOTS = pathlib.Path(os.environ.get('GCM_SHOTS', HERE / 'gcmshots'))
OUT = ROOT / 'groupclientmanagement' / ({'client': 'new-way-film.html', 'staff': 'staff-new-way-film.html'}[FILM])
TIMING = HERE / (KEY + '-timing.json')

def b64(p, mime):
    return 'data:%s;base64,%s' % (mime, base64.b64encode(pathlib.Path(p).read_bytes()).decode())

_cache = {}
def img(name):
    """A screen, as a JPEG data URI no wider than it is ever drawn (a 1688px phone shot is shown 300px wide at
       1.5x zoom), so the page stays small enough to render quickly."""
    if name in _cache:
        return _cache[name]
    p = SHOTS / name
    if not p.exists():
        sys.exit('MISSING SCREEN: %s (looked in %s)' % (name, SHOTS))
    from PIL import Image
    im = Image.open(p).convert('RGB')
    cap = 1500 if name.startswith('s') else 900
    if im.width > cap:
        im = im.resize((cap, round(im.height * cap / im.width)), Image.LANCZOS)
    b = io.BytesIO(); im.save(b, 'JPEG', quality=86, optimize=True)
    _cache[name] = 'data:image/jpeg;base64,' + base64.b64encode(b.getvalue()).decode()
    return _cache[name]

MARK = b64(ROOT / 'groupclientmanagement' / 'gcm-mark.png', 'image/png')
PLEX = b64(HERE / 'fonts' / 'IBMPlexSans-latin.woff2', 'font/woff2')

T = json.loads(TIMING.read_text()) if TIMING.exists() else {}
N_LINES = {'client': 11, 'staff': 19}[FILM]
#  importvox writes SECONDS; data-d is MILLISECONDS.
DURS = [int(round(d * 1000)) for d in (T.get('durs') or [6.0] * N_LINES)]
WORDS = [l.get('words', []) for l in T.get('lines', [])]
if len(DURS) != N_LINES:
    sys.exit('TIMING: %d durations for a %d-line film' % (len(DURS), N_LINES))

def at(n, word, k=0, lead=0.0):
    """The second the k-th match of a spoken word begins in line n, so a reveal lands on the word that names it.
       0.4s is the lead the mixer gives the voice."""
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

TAG = '<span class="tag">Sample group &middot; made-up figures</span>'

#  Where the key buttons and panels sit on each screen, in that PNG's own pixels, written by the shooters.
BOXES = {}
for _b in ('boxes.json', 'boxes-client.json', 'boxes-staff.json'):
    if (SHOTS / _b).exists():
        BOXES.update(json.loads((SHOTS / _b).read_text()))
EXTRA = []                         # one @keyframes per camera, appended to the stylesheet

def _size(name):
    b = BOXES.get(name)
    if b and b.get('w'):
        return b['w'], b['h']
    from PIL import Image
    return Image.open(SHOTS / name).size

def _box(name, label):
    els = (BOXES.get(name) or {}).get('els') or {}
    if label not in els:
        sys.exit('NO BOX: "%s" on %s (have: %s)' % (label, name, ', '.join(sorted(els)) or 'none'))
    return els[label]

def cam(name, n, vw, vh, moves=(), taps=(), marks=()):
    """The screen inside its frame, with a camera: at each (seconds, label, zoom) it eases to that element, and at
       each (seconds, label) a tap ring lands on it, and each (seconds, label) in marks outlines it. The frame is vw x vh
       CSS px; the image is drawn vw wide. Everything is a CSS animation inside the scene, so render.js sets it to the
       frame's own moment and the zoom cannot drift from the voice."""
    iw, ih = _size(name); s0 = vw / iw; dh = ih * s0
    D = DURS[n - 1] / 1000.0
    pct = lambda t: max(0.0, min(100.0, t / D * 100.0))
    def focus(label, z):
        x, y, w, h = _box(name, label)
        cx, cy = (x + w / 2) * s0, (y + h / 2) * s0
        tx = min(0.0, max(vw - vw * z, vw / 2 - cx * z))
        ty = min(0.0, max(vh - dh * z, vh / 2 - cy * z))
        return tx, ty, z
    inner = ''
    if moves:
        kf, st, last = [], (0.0, 0.0, 1.0), 0.0
        kf.append('0%%{transform:translate(0,0) scale(1)}')
        for t, label, z in moves:
            new = (0.0, 0.0, 1.0) if label is None else focus(label, z)
            a, b = pct(max(last, t - 0.05)), pct(t + 0.75)
            kf.append('%.3f%%{transform:translate(%.1fpx,%.1fpx) scale(%.3f);animation-timing-function:cubic-bezier(.45,0,.2,1)}' % ((a,) + st))
            kf.append('%.3f%%{transform:translate(%.1fpx,%.1fpx) scale(%.3f)}' % ((b,) + new))
            st, last = new, t + 0.75
        kf.append('100%%{transform:translate(%.1fpx,%.1fpx) scale(%.3f)}' % st)
        nm = 'cam%d' % len(EXTRA)
        EXTRA.append('@keyframes %s{%s}' % (nm, ''.join(kf)))
        anim = 'animation:%s %dms linear both' % (nm, DURS[n - 1])
    else:
        anim = ''
    for t, label in taps:
        x, y, w, h = _box(name, label)
        inner += '<i class="tap" style="left:%.1fpx;top:%.1fpx;--kd:%.2fs"></i>' % ((x + w / 2) * s0, (y + h / 2) * s0, t)
    for t, label in marks:
        x, y, w, h = _box(name, label)
        inner += '<b class="mark" style="left:%.1fpx;top:%.1fpx;width:%.1fpx;height:%.1fpx;--kd:%.2fs"></b>' % (
            x * s0 - 4, y * s0 - 4, w * s0 + 8, h * s0 + 8, t)
    return ('<div class="vp" style="width:%dpx;height:%dpx"><div class="zl" style="width:%dpx;%s">'
            '<img src="%s" alt="" style="width:%dpx">%s</div></div>' % (vw, vh, vw, anim, img(name), vw, inner))

def phone(name, cls='', d=0.0, n=0, moves=(), taps=(), marks=(), w=268):
    iw, ih = _size(name)
    vh = min(round(w * ih / iw), round(w * 2.165))
    return '<div class="phone %s" style="--kd:%.2fs">%s%s</div>' % (cls, d, cam(name, n, w, vh, moves, taps, marks), TAG)

def card(name, cls='', d=0.0, n=0, moves=(), taps=(), marks=(), w=540, maxh=470):
    iw, ih = _size(name)
    return '<div class="cardshot %s" style="--kd:%.2fs">%s%s</div>' % (cls, d, cam(name, n, w, min(maxh, round(w * ih / iw)), moves, taps, marks), TAG)

def lap(name, cls='', d=0.0, n=0, moves=(), taps=(), marks=(), w=558, h=330):
    """A staff screen in a laptop window; a tall capture is panned by the camera, never squeezed."""
    return ('<div class="lap %s" style="--kd:%.2fs"><div class="bar3"><i></i><i></i><i></i></div>%s%s</div>'
            % (cls, d, cam(name, n, w, h, moves, taps, marks), TAG))

def kin(text, d=0.0, hi=()):
    out = []
    for i, w in enumerate(text.split(' ')):
        c = ' hi' if re.sub(r'[^a-z]', '', w.lower()) in hi else ''
        out.append('<span class="kw%s" style="--kd:%.2fs">%s</span>' % (c, d + i * 0.06, w))
    return ' '.join(out)

def row(icon, text, d, sub='', cls=''):
    return ('<div class="row %s" style="--kd:%.2fs"><b>%s</b><div><div class="rt">%s</div>%s</div></div>'
            % (cls, d, ICON[icon], text, ('<div class="rs">%s</div>' % sub) if sub else ''))

def chip(text, d, cls=''):
    return '<span class="chip %s" style="--kd:%.2fs">%s</span>' % (cls, d, text)

def eb(text, d=0.15):
    return '<div class="eyebrow" style="--kd:%.2fs">%s</div>' % (d, text)

ICON = {k: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">%s</svg>' % v for k, v in {
    'check': '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    'clock': '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    'alert': '<path d="M12 3l9.5 17h-19z"/><path d="M12 10v4M12 17.5v.5"/>',
    'cake': '<path d="M4 20h16v-7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2z"/><path d="M4 15c2 1.5 4 1.5 5.3 0 1.4 1.5 4 1.5 5.4 0 1.3 1.5 3.3 1.5 5.3 0M12 11V7M12 4.5v.01"/>',
    'grad': '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c3 2 9 2 12 0v-5"/>',
    'sun': '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    'user': '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
    'users': '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c1-3.5 3.5-5.5 6.5-5.5s5.5 2 6.5 5.5"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.6c2 .8 3.3 2.6 3.8 5.4"/>',
    'doc': '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>',
    'cash': '<rect x="2" y="6" width="20" height="13" rx="2"/><circle cx="12" cy="12.5" r="2.5"/>',
    'list': '<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6h.01M4 12h.01M4 18h.01"/>',
    'mail': '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
    'lock': '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    'pause': '<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>',
    'chat': '<path d="M4 5h16v11H9l-5 4z"/>',
    'star': '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
    'shield': '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
    'phone': '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>',
    'tick2': '<rect x="3" y="3" width="18" height="18" rx="4"/><path d="M7.5 12.5l3 3 6-7"/>',
}.items()}

def stars(d, n=5, gap=0.14):
    return '<div class="stars">%s</div>' % ''.join(
        '<i style="--kd:%.2fs">%s</i>' % (d + i * gap, ICON['star']) for i in range(n))

def S(n, body, cls=''):
    """A scene: a slow push-in on everything, two soft shapes drifting behind, and a streak of light across the cut."""
    return ('<section class="sc %s" data-d="%d" style="--sd:%dms"><i class="orb o1"></i><i class="orb o2"></i>'
            '<div class="cam"><div class="in">%s</div></div><i class="streak"></i></section>' % (cls, DURS[n - 1], DURS[n - 1], body))

def split(n, left, right, cls=''):
    return S(n, '<div class="split"><div class="L">%s</div><div class="R">%s</div></div>' % (left, right), cls)

def mailcard(frm, subj, body, d, cls=''):
    return ('<div class="mail %s" style="--kd:%.2fs"><div class="mh"><img src="%s" alt=""><div><b>%s</b>'
            '<span>%s</span></div></div><div class="mb">%s</div>%s</div>' % (cls, d, MARK, frm, subj, body, TAG))

# ------------------------------------------------------------------------------------------------ the group's film
def client():
    sc = []
    # 1 ---------------------------------------------------------------------------------------------- the title
    sc.append(S(1,
        '<div class="mid">'
        '<img class="mk" src="%s" alt="">'
        '%s<h1>%s</h1>'
        '<div class="sub" style="--kd:%.2fs">Group Life &middot; Group Health &middot; Group Pension</div>'
        '</div>' % (MARK, eb('Ricky Rampersad Branch &middot; Guardian Life of the Caribbean', .4),
                    kin('A new way of looking after your group', .7, hi=('group',)), at(1, 'group')),
        'blue title'))
    # 2 ---------------------------------------------------------------------------------------- what it covers
    sc.append(split(2,
        eb('Your group plans, with Guardian Life') +
        '<div class="plans">' +
        ''.join('<div class="plan" style="--kd:%.2fs"><b>%s</b><span>%s</span></div>' % (at(2, w), t, s)
                for w, t, s in (('life', 'Group Life', 'cover for your people'),
                                ('health', 'Group Health', 'their medical plan'),
                                ('pension', 'Group Pension', 'saving for retirement'))) +
        '</div>' +
        '<div class="pair">' + chip('All in one place', at(2, 'place')) + chip('Always up to date', at(2, 'date')) + '</div>'
        '<div class="strike" style="--kd:%.2fs">No more <s style="--kd:%.2fs">chasing us</s> for answers.</div>'
        % (at(2, 'No'), at(2, 'chasing')),
        phone('c02-items.png', d=.3)))
    # 3 ------------------------------------------------------------------------------------- the Monday report
    sc.append(split(3,
        eb('Every Monday') +
        '<div class="clock" style="--kd:%.2fs">10:00<span>one short report, by e-mail</span></div>' % at(3, 'ten') +
        row('check', 'What we finished', at(3, 'finished'), '', 'ok') +
        row('clock', 'What&rsquo;s still open', at(3, 'open'), 'with who has it, and how long') +
        row('alert', 'What we need from you', at(3, 'need'), 'answered on your page, by Friday', 'warn'),
        mailcard('Your weekly service report', 'Harbour Point Logistics Ltd &middot; Monday 16 November',
                 '<p>Good morning, Pat. Here is where everything we are doing for your group stands.</p>'
                 '<div class="cnts"><div><b class="cnt" data-to="6" data-at="%d">6</b><span>finished</span></div>'
                 '<div><b class="cnt" data-to="4" data-at="%d">4</b><span>still open</span></div>'
                 '<div class="w"><b class="cnt" data-to="2" data-at="%d">2</b><span>need you</span></div></div>'
                 '<div class="btnish sm">Open your service page</div>'
                 % (at(3, 'finished') * 1000, at(3, 'open') * 1000, at(3, 'need') * 1000), .5)))
    # 4 ------------------------------------------------------------------------------------- your own page, three tabs
    sc.append(split(4,
        eb('Your own secure page') +
        '<h2>%s</h2>' % kin('Everything, in three tabs.', at(4, 'Tap')) +
        '<div class="tabs3">' +
        chip('Your service items', at(4, 'service'), 'tab') + chip('Your billing', at(4, 'billing'), 'tab') +
        chip('Your people', at(4, 'people'), 'tab') + '</div>'
        '<div class="note" style="--kd:%.2fs">Sign in with your list bill and the code in our letter.</div>' % at(4, 'secure'),
        '<div class="duo">%s%s</div>' % (phone('c01-signin.png', 'back', .2, n=4, w=236), phone('c02-items.png', 'front', at(4, 'service'))),
        'wide2'))
    # 5 --------------------------------------------------------------------------------------------- billing
    sc.append(split(5,
        eb('Your billing &middot; every month') +
        '<div class="big" style="--kd:%.2fs">26<sup>th</sup></div>' % at(5, 'twenty') +
        row('check', 'Checked against our records', at(5, 'checked'), '', 'ok') +
        row('doc', 'One clear statement of what&rsquo;s due', at(5, 'statement'), 'and any earlier bill still unpaid'),
        phone('c06-billing.png', d=.3)))
    # 6 ---------------------------------------------------------------------------------------------- people
    sc.append(split(6,
        eb('Your people') +
        '<div class="tiles">'
        '<div class="tl" style="--kd:%.2fs"><b>%s</b><span>Who&rsquo;s on your plans</span></div>'
        '<div class="tl" style="--kd:%.2fs"><b>%s</b><span>Who came off this year</span></div>'
        '<div class="tl w" style="--kd:%.2fs"><b>%s</b><span>Every application still pending</span></div></div>'
        '<div class="note" style="--kd:%.2fs">%s and with who has it on our team.</div>'
        % (at(6, 'plans'), ICON['users'], at(6, 'came'), ICON['user'], at(6, 'pending'), ICON['clock'],
           at(6, 'team'), ICON['shield'].replace('<svg', '<svg class="ni"')),
        phone('c08-people.png', d=.3)))
    # 7 ------------------------------------------------------------------------------------------- coming up
    sc.append(split(7,
        eb('Coming up for your people') +
        '<h2>%s</h2>' % kin('We tell you ahead of time.', .3, hi=('ahead',)) +
        row('cake', 'Turning sixty-five', at(7, 'sixty'), 'the group cover ends: we help them convert') +
        row('grad', 'A dependent comes of age', at(7, 'dependent'), 'and moves off the family plan') +
        row('sun', 'Close to retiring', at(7, 'retiring'), 'on your company pension'),
        card('c04-coming-up-card.png', d=.4), 'wide'))
    # 8 -------------------------------------------------------------------------------------- joining or leaving
    sc.append(split(8,
        eb('Someone joining or leaving?') +
        '<h2>%s</h2>' % kin('Tell us right there.', at(8, 'Tell')) +
        row('doc', 'The form fills itself in', at(8, 'fills'), 'Guardian&rsquo;s own form, from our records', 'ok') +
        row('check', 'We follow it through to the end', at(8, 'end'), 'and you see where it stands', 'ok'),
        '<div class="duo">%s%s</div>' % (phone('c09-person-msg.png', 'back', .2, n=8, w=236), phone('c10-form.png', 'front', at(8, 'form'))),
        'wide2'))
    # 9 ---------------------------------------------------------------------------------------------- the stars
    sc.append(split(9,
        eb('Rate us') + stars(at(9, 'five')) +
        '<div class="note big2" style="--kd:%.2fs">Every week, on your service page.</div>' % at(9, 'week') +
        '<div class="callout" style="--kd:%.2fs">And on every bill, rate <b>the person who looks after your account</b>.</div>' % at(9, 'bill'),
        card('c07-billing-rate-card.png', d=at(9, 'bill', lead=.3)), 'wide'))
    # 10 --------------------------------------------------------------------------------------- the named team
    nodes = (('Your account manager', 'looks after your group', 'a', at(10, 'named')),
             ('Branch Manager&rsquo;s Assistant', 'oversees every task', 'b', at(10, 'named') + .25),
             ('Branch Manager', 'owns the standard', 'c', at(10, 'named') + .5),
             ('Every step, recorded', 'who &middot; when &middot; why', 'd', at(10, 'recorded')))
    sc.append(S(10,
        '<div class="mid">' + eb('Behind it all', .15) +
        '<h2>%s</h2>' % kin('A real person reads every answer.', .3, hi=('person',)) +
        '<div class="net"><svg class="lines" viewBox="0 0 900 260"><path d="M450 130 L170 50"/><path d="M450 130 L730 50"/>'
        '<path d="M450 130 L170 210"/><path d="M450 130 L730 210"/></svg>'
        '<img class="hub" src="%s" alt="">' % MARK +
        ''.join('<div class="node %s" style="--kd:%.2fs"><b>%s</b><span>%s</span></div>' % (c, d, t, s) for t, s, c, d in nodes) +
        '</div><div class="punch" style="--kd:%.2fs">Nothing slips through.</div></div>' % at(10, 'Nothing'),
        'team'))
    # 11 ---------------------------------------------------------------------------------------------- the close
    sc.append(S(11,
        '<div class="mid">'
        '<img class="mk sm" src="%s" alt="">'
        '<h1>%s</h1>'
        '<div class="call" style="--kd:%.2fs">%s<b>(868) 226-6461</b></div>'
        '<div class="url" style="--kd:%.2fs">rickyrampersadbranch.com</div>'
        '<div class="sub" style="--kd:%.2fs">Let&rsquo;s look after your people, together.</div>'
        '</div>' % (MARK, kin('Want this for your company?', .3, hi=('your', 'company?')), at(11, 'Call', lead=.2),
                    ICON['phone'], at(11, 'number'), at(11, 'together')),
        'blue close'))
    return sc

# ---------------------------------------------------------------------------------------------- the staff film
def staff():
    sc = []
    sc.append(S(1,
        '<div class="mid"><img class="mk" src="%s" alt="">%s<h1>%s</h1>'
        '<div class="sub" style="--kd:%.2fs">How it works, and who does what</div></div>'
        % (MARK, eb('Group client management &middot; Guardian Life groups', .4),
           kin('The new way.', .8, hi=('new',)), at(1, 'how')),
        'blue title'))
    parts = (('Branch Manager', 'sets the standard and owns the result', at(2, 'Branch')),
             ('Kamla &middot; Branch Manager&rsquo;s Assistant', 'oversees the tasks', at(2, 'Kamla')),
             ('The support team', 'looks after their own groups', at(2, 'support')),
             ('The system', 'keeps time, and keeps the record', at(2, 'system')))
    sc.append(S(2,
        '<div class="mid">' + eb('Four parts', .2) +
        '<div class="four">' + ''.join('<div class="pt" style="--kd:%.2fs"><i>%d</i><b>%s</b><span>%s</span></div>'
                                       % (d, i + 1, t, s) for i, (t, s, d) in enumerate(parts)) + '</div></div>',
        'parts'))
    sc.append(split(3,
        eb('Signing in') + '<h2>%s</h2>' % kin('Your own number and password.', .3) +
        row('lock', 'Everything you do is recorded in your name', at(3, 'recorded'), '', 'ok'),
        '<div class="signin" style="--kd:.3s"><img src="%s" alt=""><div class="f"><label>Agent number</label><div class="i">A0&bull;&bull;&bull;&bull;</div></div>'
        '<div class="f"><label>Password</label><div class="i">&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;</div></div>'
        '<div class="btnish sm" style="--kd:%.2fs">Sign in</div></div>' % (MARK, at(3, 'password'))))
    week = (('Mon&ndash;Thu', 'Run the six checks', at(4, 'six')), ('Friday', 'Approve each group', at(4, 'Friday')),
            ('Monday 10:00', 'The letters go by themselves', at(4, 'letters')))
    sc.append(split(4,
        eb('Every week') + '<div class="rail3">' + ''.join(
            '<div class="tk" style="--kd:%.2fs"><b>%s</b><span>%s</span></div>' % (d, a, b) for a, b, d in week) + '</div>',
        lap('s03-group.png', d=.3), 'wide'))
    sc.append(split(5,
        eb('Monday 10:30') +
        row('star', 'Groups that haven&rsquo;t rated us get a reminder', at(5, 'reminder')) +
        row('alert', 'No letter for a ready group? You&rsquo;re asked why', at(5, 'why'), 'and a task opens in your name', 'warn') +
        row('check', 'Reply by noon, and close it with the reason', at(5, 'noon'), '', 'ok'),
        mailcard('Your group letters this week', 'One group had no letter: tell us why by 12 noon',
                 '<p>Dana, Coral Bay Foods Ltd was ready and had no letter on Monday.</p>'
                 '<p class="t">Salesforce task: <b>GROUP LETTER NOT SENT &middot; reason needed</b></p>', at(5, 'why'))))
    sc.append(split(6,
        eb('Monday 11:00') + '<h2>%s</h2>' % kin('One note to the whole team.', .3) +
        row('users', 'Every group still without its letter', at(6, 'group'), '') +
        row('user', 'And who&rsquo;s responsible for it', at(6, 'responsible'), '', 'warn'),
        mailcard('Group letters this week: 14 of 17 out', '3 not out &middot; who is responsible',
                 '<div class="lst"><div><b>Coral Bay Foods Ltd</b><span>not approved &middot; Dana</span></div>'
                 '<div><b>Northgate Engineering Ltd</b><span>held at the run &middot; Ravi</span></div>'
                 '<div><b>Sunrise Bakery Ltd</b><span>no contact in Salesforce &middot; Dana</span></div></div>', at(6, 'note'))))
    flow = (('upload', 'Upload'), ('check', 'Check'), ('answer', 'Answer'), ('reconcile', 'Reconcile'), ('approve', 'Approve'))
    sc.append(S(7,
        '<div class="mid">' + eb('Every month', .2) +
        '<h2>%s</h2>' % kin('The bills come in on the 25th.', .4, hi=('25th.',)) +
        '<div class="flow">' + ''.join('<div class="fs" style="--kd:%.2fs">%s</div>' % (at(7, w), t) for w, t in flow) + '</div>'
        '<div class="note" style="--kd:%.2fs">1:00 pm &middot; the Branch Manager gets the report</div></div>' % at(7, 'one'),
        'monthly'))
    sc.append(S(8,
        '<div class="mid">' + eb('The billing day', .2) +
        '<div class="big c" style="--kd:%.2fs">26<sup>th</sup> &middot; 10:00</div>' % at(8, 'twenty') +
        '<div class="note" style="--kd:%.2fs">Every approved bill goes by itself, with its statement.</div>' % at(8, 'approved') +
        '<div class="punch" style="--kd:%.2fs">That&rsquo;s the deadline.</div></div>' % at(8, 'deadline'),
        'deadline'))
    sc.append(split(9,
        eb('Billing &middot; eight steps') + '<h2>%s</h2>' % kin('Every check comes back as a finding.', at(9, 'Upload')) +
        '<div class="pair">' + chip('Fix', at(9, 'fix'), 'bad') + chip('Check', at(9, 'check', 1), 'warn') +
        chip('Note', at(9, 'note'), 'info') + chip('Okay', at(9, 'okay'), 'ok') + '</div>',
        lap('s05-steps.png', d=.3), 'wide'))
    sc.append(split(10,
        eb('The upload does the typing') +
        row('cash', 'The month&rsquo;s billing record, brought into line', at(10, 'record'), 'in Salesforce, field by field', 'ok') +
        row('user', 'A task for everyone who left or changed tier', at(10, 'left'), 'for the account owner') +
        row('doc', 'One to query the adjustments', at(10, 'adjustments'), 'with Head Office', 'warn'),
        lap('s06-found.png', d=.3, pos='0% 55%'), 'wide'))
    sc.append(split(11,
        eb('Answer, and update') + '<h2>%s</h2>' % kin('One tap. On Chatter, in your name.', at(11, 'Answer')) +
        row('chat', 'Last month&rsquo;s tasks, against this month&rsquo;s bill', at(11, 'update'), '', 'ok'),
        '<div class="duo l">%s%s</div>' % (lap('s07-questions.png', 'back', .2, w=468, h=270), lap('s08-tasks.png', 'front', at(11, 'update'), w=468, h=270)),
        'wide'))
    sc.append(split(12,
        eb('Joiners, leavers and the people') +
        row('doc', 'Guardian&rsquo;s own forms, filled from Salesforce', at(12, 'forms'), 'chased every three working days', 'ok') +
        row('cake', 'Who&rsquo;s turning sixty-five, or coming of age', at(12, 'sixty'), 'flagged at the people step'),
        '<div class="duo l">%s%s</div>' % (lap('s09-forms.png', 'back', .2, w=468, h=270), lap('s10-people.png', 'front', at(12, 'people', 1), w=468, h=270)),
        'wide'))
    sc.append(split(13,
        eb('The statement') + '<h2>%s</h2>' % kin('What&rsquo;s due, and what&rsquo;s still unpaid.', .3) +
        row('tick2', 'Tick reconciled only when you&rsquo;ve checked it yourself', at(13, 'reconciled'), '', 'ok') +
        row('check', 'Then approve it for the billing day', at(13, 'approve'), '', 'ok'),
        lap('s11-statement.png', d=.3), 'wide'))
    sc.append(split(14,
        eb('The bill&rsquo;s e-mail') + '<h2>%s</h2>' % kin('It greets the contact by name.', .3) +
        stars(at(14, 'rate'), gap=.1) +
        '<div class="callout" style="--kd:%.2fs">Those stars count on <b>your</b> record.</div>' % at(14, 'stars'),
        lap('s12-approve.png', d=.3, pos='0% 60%'), 'wide'))
    sc.append(split(15,
        eb('Missed the deadline?') + '<h2>%s</h2>' % kin('Give the real reason.', at(15, 'Give')) +
        '<div class="pair">' + chip('On the bill', at(15, 'bill')) + chip('On Chatter', at(15, 'Chatter')) +
        chip('To the Branch Manager', at(15, 'straight')) + '</div>',
        lap('s13-late.png', d=.3), 'wide'))
    sc.append(S(16,
        '<div class="mid">' + eb('Every press is recorded', .2) +
        '<div class="www">' + ''.join('<div style="--kd:%.2fs"><b>%s</b></div>' % (at(16, w), t)
                                      for w, t in (('who', 'Who'), ('when', 'When'), ('why', 'Why'))) + '</div>'
        '<div class="note" style="--kd:%.2fs">Head Office, the Branch Manager or the group can see exactly what happened.</div></div>'
        % at(16, 'Head'),
        'record'))
    sc.append(split(17,
        eb('Kamla, every day') +
        row('list', 'Checks the team dashboard and chases what&rsquo;s late', at(17, 'chases')) +
        row('users', 'Steps in when someone&rsquo;s away', at(17, 'away'), '', 'ok') +
        row('pause', 'One group, or every group, on hold', at(17, 'hold'), 'with the reason, and nobody&rsquo;s chased for it', 'warn'),
        '<div class="duo l">%s%s</div>' % (lap('s01-team.png', 'back', .2, w=468, h=270), lap('s02-hold.png', 'front', at(17, 'hold'), w=468, h=270)),
        'wide'))
    sc.append(S(18,
        '<div class="mid">' + eb('Until we go live', .2) +
        '<div class="stamp" style="--kd:%.2fs">TEST</div>' % at(18, 'test') +
        '<div class="note" style="--kd:%.2fs">Every bill comes to you marked test.</div>' % at(18, 'bill') +
        '<div class="punch" style="--kd:%.2fs">But Salesforce is real. Check before you press.</div></div>' % at(18, 'Salesforce'),
        'test'))
    sc.append(split(19,
        eb('The training programme') + '<h1>%s</h1>' % kin('This is our new way.', at(19, 'This'), hi=('new',)) +
        '<div class="pair">' + chip('Read the programme', at(19, 'Read')) + chip('Take the test', at(19, 'test')) + '</div>',
        lap('s14-training.png', d=.3), 'wide'))
    return sc

CSS = """
@font-face{font-family:Plex;src:url(__PLEX__) format('woff2');font-weight:100 700;font-display:block}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1280px;height:720px;overflow:hidden;background:#0F2A5E}
body{font-family:Plex,system-ui,sans-serif;color:#142033;-webkit-font-smoothing:antialiased}
#stage{position:relative;width:1280px;height:616px;overflow:hidden;
  background:radial-gradient(900px 600px at 82% 12%,#DCE8FB 0%,#EEF3FA 50%,#E9EEF5 100%)}
.dots{position:absolute;inset:-60px;pointer-events:none;opacity:.55;
  background-image:radial-gradient(rgba(29,91,196,.16) 1.2px,transparent 1.3px);background-size:26px 26px;
  animation:drift 40s linear infinite}
@keyframes drift{from{transform:translate(0,0)}to{transform:translate(26px,52px)}}
.glow{position:absolute;width:760px;height:760px;border-radius:50%;pointer-events:none;
  background:radial-gradient(circle,rgba(42,111,216,.16),transparent 65%)}
.glow.g1{left:-260px;top:-300px}.glow.g2{right:-300px;bottom:-380px}
.sc{position:absolute;left:0;top:0;width:1280px;height:616px;opacity:0;visibility:hidden}
.sc.act{opacity:1;visibility:visible;animation:zin .72s cubic-bezier(.2,.7,.2,1) both}
.sc.out{opacity:1;visibility:visible;animation:zout .72s cubic-bezier(.4,0,.8,.3) both}
@keyframes zin{from{transform:translateX(60px) scale(1.02);opacity:0}to{transform:none;opacity:1}}
@keyframes zout{from{transform:none;opacity:1}to{transform:translateX(-60px) scale(.98);opacity:0}}
.sc.blue{background:radial-gradient(900px 600px at 80% 20%,#2A6FD8 0%,#1D5BC4 40%,#13408F 100%);color:#fff}
.sc.blue:before{content:'';position:absolute;inset:0;background-image:radial-gradient(rgba(255,255,255,.12) 1.2px,transparent 1.3px);
  background-size:26px 26px;animation:drift 40s linear infinite}
.in{position:absolute;left:0;top:0;width:1280px;height:616px;padding:46px 70px;display:flex;align-items:center}
.mid{width:100%;text-align:center;position:relative}
.split{width:100%;display:flex;align-items:center;gap:56px}
.split .L{flex:1;min-width:0}
.split .R{position:relative;flex:0 0 300px;display:flex;justify-content:center}
.sc.wide .R{flex:0 0 560px}
.sc.wide2 .R{flex:0 0 470px}

.mk{width:96px;height:96px;border-radius:22px;display:block;margin:0 auto 22px;box-shadow:0 16px 40px rgba(5,20,60,.35);
  animation:pop .7s cubic-bezier(.2,1.5,.4,1) both}
.mk.sm{width:72px;height:72px;border-radius:16px;margin-bottom:18px}
@keyframes pop{from{transform:scale(.4);opacity:0}to{transform:none;opacity:1}}
h1{font-size:54px;font-weight:600;line-height:1.12;letter-spacing:-.8px}
h2{font-size:38px;font-weight:600;line-height:1.16;letter-spacing:-.5px;margin-bottom:14px}
.kw{display:inline-block;animation:wpop .62s cubic-bezier(.2,.9,.3,1) both;animation-delay:var(--kd)}
@keyframes wpop{0%{opacity:0;transform:translateY(26px) scale(.55);filter:blur(5px)}
  60%{opacity:1;transform:translateY(-5px) scale(1.07);filter:none}100%{opacity:1;transform:none}}
.kw.hi{color:#1D5BC4}.blue .kw.hi{color:#FFD36B}
@keyframes wup{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}
.eyebrow{font-size:14px;font-weight:600;letter-spacing:2.6px;text-transform:uppercase;color:#1D5BC4;margin-bottom:14px;
  animation:wup .5s both;animation-delay:var(--kd,.1s)}
.blue .eyebrow{color:#BFD3F7}
.sub{font-size:23px;color:#DCE8FB;margin-top:20px;animation:wup .5s both;animation-delay:var(--kd)}
.note{font-size:20px;color:#4B586C;margin-top:18px;line-height:1.45;animation:wup .5s both;animation-delay:var(--kd)}
.note.big2{font-size:24px;color:#142033;font-weight:600}
.ni{width:22px;height:22px;vertical-align:-4px;margin-right:6px;color:#1D5BC4}

.phone{position:relative;display:inline-block;border-radius:30px;overflow:hidden;border:7px solid #142033;background:#fff;
  box-shadow:0 30px 60px rgba(15,42,94,.35);animation:ph .8s cubic-bezier(.2,.8,.25,1) both,bob 6s ease-in-out .8s infinite alternate;
  animation-delay:var(--kd),calc(var(--kd) + .8s)}
.phone .vp{border-radius:22px}
@keyframes ph{from{opacity:0;transform:translateY(40px)}to{opacity:1;transform:none}}
@keyframes bob{from{translate:0 0}to{translate:0 -10px}}
.tag{position:absolute;right:8px;bottom:8px;font-size:9px;font-weight:600;color:#fff;background:rgba(20,32,51,.78);
  padding:3px 8px;border-radius:99px;letter-spacing:.2px}
.duo{position:relative;width:470px;height:560px}
.duo .phone{position:absolute}
.duo .back{left:0;top:0;opacity:.9}
.duo .front{right:0;bottom:-6px}
.duo .back .vp{filter:saturate(.8)}
.duo.l{width:560px;height:440px}
.duo.l .lap{position:absolute}
.duo.l .back{left:0;top:0}
.duo.l .front{right:0;bottom:0}

.cardshot{position:relative;display:inline-block;border-radius:18px;overflow:hidden;border:1px solid #D5DEEA;background:#fff;
  box-shadow:0 26px 54px rgba(15,42,94,.22);animation:ph .8s cubic-bezier(.2,.8,.25,1) both;animation-delay:var(--kd)}


.lap{position:relative;display:inline-block;border-radius:12px;overflow:hidden;background:#fff;border:1px solid #C9D4E5;
  box-shadow:0 28px 60px rgba(15,42,94,.28);animation:ph .8s cubic-bezier(.2,.8,.25,1) both;animation-delay:var(--kd)}
.lap .bar3{height:22px;background:#E3E9F2;display:flex;gap:6px;align-items:center;padding:0 10px}
.lap .bar3 i{width:9px;height:9px;border-radius:50%;background:#B9C4D6}


.row{display:flex;align-items:center;gap:16px;margin:12px 0;padding:12px 16px;border-radius:14px;background:#fff;
  border:1px solid #DCE3EE;box-shadow:0 8px 20px rgba(15,42,94,.06);animation:wup .5s both;animation-delay:var(--kd)}
.row b{width:42px;height:42px;border-radius:11px;display:grid;place-items:center;flex:0 0 42px;background:#EBF2FD;color:#1D5BC4}
.row b svg{width:22px;height:22px}
.row .rt{font-size:21px;font-weight:600;color:#142033;line-height:1.25}
.row .rs{font-size:15px;color:#4B586C;margin-top:2px}
.row.ok b{background:#E5F5EC;color:#1B7A45}
.row.warn b{background:#FFF3DA;color:#9A6200}

.chip{display:inline-block;font-size:18px;font-weight:600;padding:10px 18px;border-radius:999px;background:#fff;color:#13408F;
  border:1.5px solid #B8CEF4;animation:wup .45s both;animation-delay:var(--kd)}
.chip.tab{background:#1D5BC4;border-color:#1D5BC4;color:#fff}
.chip.bad{background:#FDECEC;border-color:#F2B8B8;color:#A52626}
.chip.warn{background:#FFF3DA;border-color:#F0D08A;color:#8A5800}
.chip.info{background:#EBF2FD;color:#13408F}
.chip.ok{background:#E5F5EC;border-color:#A9D9BC;color:#1B7A45}
.pair,.tabs3{display:flex;flex-wrap:wrap;gap:12px;margin-top:20px}

.plans{display:flex;gap:14px;margin:8px 0 6px}
.plan{flex:1;padding:18px 16px;border-radius:16px;background:linear-gradient(160deg,#1D5BC4,#13408F);color:#fff;
  box-shadow:0 14px 30px rgba(19,64,143,.28);animation:pop .55s cubic-bezier(.2,1.4,.4,1) both;animation-delay:var(--kd)}
.plan b{display:block;font-size:22px;font-weight:600}
.plan span{display:block;font-size:14px;color:#DCE8FB;margin-top:4px}
.strike{font-size:30px;font-weight:600;margin-top:26px;animation:wup .5s both;animation-delay:var(--kd)}
.strike s{text-decoration:none;position:relative;color:#4B586C}
.strike s:after{content:'';position:absolute;left:-4px;right:-4px;top:52%;height:4px;border-radius:2px;background:#D64545;
  transform-origin:left;animation:sx .45s ease-out both;animation-delay:var(--kd)}
@keyframes sx{from{transform:scaleX(0)}to{transform:scaleX(1)}}

.clock{font-size:86px;font-weight:600;color:#13408F;letter-spacing:-2px;line-height:1;margin-bottom:12px;
  animation:pop .6s cubic-bezier(.2,1.4,.4,1) both;animation-delay:var(--kd)}
.clock span{display:block;font-size:19px;font-weight:500;letter-spacing:0;color:#4B586C;margin-top:8px}
.big{font-size:130px;font-weight:600;color:#13408F;line-height:1;letter-spacing:-4px;margin-bottom:10px;
  animation:pop .6s cubic-bezier(.2,1.4,.4,1) both;animation-delay:var(--kd)}
.big sup{font-size:46px;letter-spacing:0;vertical-align:58px}
.big.c{font-size:118px}

.mail{position:relative;width:440px;border-radius:16px;overflow:hidden;background:#fff;border:1px solid #D5DEEA;
  box-shadow:0 26px 54px rgba(15,42,94,.22);animation:ph .8s cubic-bezier(.2,.8,.25,1) both;animation-delay:var(--kd)}
.mail .mh{display:flex;gap:12px;align-items:center;padding:16px 18px;background:linear-gradient(120deg,#13408F,#1D5BC4 55%,#2A6FD8);color:#fff}
.mail .mh img{width:40px;height:40px;border-radius:10px}
.mail .mh b{display:block;font-size:17px}.mail .mh span{display:block;font-size:13px;color:#DCE8FB}
.mail .mb{padding:18px 20px 22px;font-size:16px;color:#2B374C;line-height:1.45}
.mail .mb p{margin-bottom:12px}.mail .mb p.t{font-size:14px;color:#4B586C}
.cnts{display:flex;gap:10px;margin:6px 0 16px}
.cnts div{flex:1;text-align:center;padding:12px 6px;border-radius:12px;background:#F3F6FB}
.cnts b{display:block;font-size:34px;color:#13408F}.cnts span{font-size:13px;color:#4B586C}
.cnts .w b{color:#9A6200}
.lst div{display:flex;justify-content:space-between;gap:10px;padding:10px 0;border-bottom:1px solid #E6EBF2;font-size:15px}
.lst span{color:#A52626;font-size:14px}
.btnish{display:inline-block;padding:14px 26px;border-radius:12px;background:#1D5BC4;color:#fff;font-size:18px;font-weight:600;
  animation:pop .5s cubic-bezier(.2,1.5,.4,1) both;animation-delay:var(--kd,.6s)}
.btnish.sm{font-size:15px;padding:11px 18px}

.tiles{display:flex;gap:12px;margin-top:6px}
.tl{flex:1;padding:16px;border-radius:16px;background:#fff;border:1px solid #DCE3EE;box-shadow:0 10px 24px rgba(15,42,94,.08);
  animation:pop .55s cubic-bezier(.2,1.4,.4,1) both;animation-delay:var(--kd)}
.tl b{display:grid;place-items:center;width:44px;height:44px;border-radius:12px;background:#EBF2FD;color:#1D5BC4;margin-bottom:10px}
.tl b svg{width:24px;height:24px}
.tl span{display:block;font-size:17px;font-weight:600;line-height:1.25}
.tl.w b{background:#FFF3DA;color:#9A6200}

.stars{display:flex;gap:10px;margin:6px 0 10px}
.stars i{width:52px;height:52px;color:#F2B01E;animation:st .5s cubic-bezier(.2,1.6,.4,1) both;animation-delay:var(--kd)}
.stars i svg{width:100%;height:100%;fill:#F5B82E}
@keyframes st{from{transform:scale(0) rotate(-40deg);opacity:0}to{transform:none;opacity:1}}
.callout{margin-top:18px;padding:18px 20px;border-radius:14px;background:#13408F;color:#fff;font-size:22px;line-height:1.35;
  animation:wup .5s both;animation-delay:var(--kd)}
.callout b{color:#FFD36B}

.net{position:relative;width:900px;height:260px;margin:18px auto 0}
.lines{position:absolute;inset:0;width:900px;height:260px}
.lines path{stroke:#9FBCEB;stroke-width:2.5;fill:none;stroke-dasharray:6 7;animation:dash 1.2s linear infinite}
@keyframes dash{to{stroke-dashoffset:-26}}
.hub{position:absolute;left:410px;top:90px;width:80px;height:80px;border-radius:20px;box-shadow:0 14px 30px rgba(19,64,143,.35);
  animation:pop .6s both}
.node{position:absolute;width:280px;padding:14px 18px;border-radius:14px;background:#fff;border:1px solid #CFDBEE;text-align:left;
  box-shadow:0 12px 26px rgba(15,42,94,.1);animation:pop .5s cubic-bezier(.2,1.4,.4,1) both;animation-delay:var(--kd)}
.node b{display:block;font-size:18px}.node span{display:block;font-size:14px;color:#4B586C;margin-top:2px}
.node.a{left:20px;top:10px}.node.b{right:20px;top:10px}.node.c{left:20px;bottom:10px}.node.d{right:20px;bottom:10px;background:#13408F;color:#fff}
.node.d span{color:#DCE8FB}
.punch{font-size:36px;font-weight:600;color:#13408F;margin-top:18px;animation:wup .5s both;animation-delay:var(--kd)}

.call{display:inline-flex;align-items:center;gap:12px;margin-top:22px;padding:16px 28px;border-radius:16px;background:#FFD36B;color:#13284D;
  animation:pop .5s cubic-bezier(.2,1.5,.4,1) both;animation-delay:var(--kd)}
.call svg{width:28px;height:28px}.call b{font-size:34px}
.url{font-size:24px;color:#fff;margin-top:16px;animation:wup .5s both;animation-delay:var(--kd)}

.four{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-top:18px;text-align:left}
.pt{padding:22px 18px;border-radius:18px;background:#fff;border:1px solid #DCE3EE;box-shadow:0 14px 30px rgba(15,42,94,.1);
  animation:pop .55s cubic-bezier(.2,1.4,.4,1) both;animation-delay:var(--kd)}
.pt i{display:grid;place-items:center;width:38px;height:38px;border-radius:50%;background:#1D5BC4;color:#fff;font-style:normal;font-weight:600;margin-bottom:14px}
.pt b{display:block;font-size:20px;line-height:1.25}.pt span{display:block;font-size:16px;color:#4B586C;margin-top:6px}
.signin{width:340px;padding:28px;border-radius:20px;background:#fff;border:1px solid #D5DEEA;box-shadow:0 26px 54px rgba(15,42,94,.2);
  animation:ph .8s both;animation-delay:var(--kd)}
.signin img{width:54px;height:54px;border-radius:14px;margin-bottom:16px}
.signin .f{margin-bottom:14px}.signin label{display:block;font-size:14px;color:#4B586C;margin-bottom:6px}
.signin .i{padding:12px 14px;border:1.5px solid #B8CEF4;border-radius:10px;font-size:18px;letter-spacing:2px}
.rail3{display:flex;flex-direction:column;gap:12px;margin-top:8px}
.tk{padding:16px 18px;border-left:5px solid #1D5BC4;border-radius:12px;background:#fff;box-shadow:0 8px 20px rgba(15,42,94,.06);
  animation:wup .5s both;animation-delay:var(--kd)}
.tk b{display:block;font-size:16px;color:#1D5BC4;letter-spacing:1px;text-transform:uppercase}
.tk span{display:block;font-size:22px;font-weight:600;margin-top:4px}
.flow{display:flex;justify-content:center;gap:12px;margin-top:26px}
.fs{padding:18px 24px;border-radius:14px;background:#1D5BC4;color:#fff;font-size:22px;font-weight:600;position:relative;
  animation:pop .5s cubic-bezier(.2,1.4,.4,1) both;animation-delay:var(--kd)}
.fs:not(:last-child):after{content:'';position:absolute;right:-12px;top:50%;width:12px;height:2px;background:#9FBCEB}
.www{display:flex;justify-content:center;gap:24px;margin-top:20px}
.www div{width:200px;padding:30px 0;border-radius:20px;background:#13408F;color:#fff;animation:pop .5s cubic-bezier(.2,1.4,.4,1) both;
  animation-delay:var(--kd)}
.www b{font-size:40px}
.stamp{display:inline-block;margin:10px 0 6px;padding:10px 40px;border:6px solid #D64545;color:#D64545;border-radius:14px;font-size:84px;
  font-weight:700;letter-spacing:8px;transform:rotate(-6deg);animation:stp .5s cubic-bezier(.2,1.6,.4,1) both;animation-delay:var(--kd)}
@keyframes stp{from{transform:rotate(-6deg) scale(2.2);opacity:0}to{transform:rotate(-6deg);opacity:1}}

#strip{position:absolute;left:0;top:616px;width:1280px;height:104px;background:#0F2A5E}
#prog{position:absolute;left:0;bottom:0;height:5px;width:100%;transform-origin:left center;
  background:linear-gradient(90deg,#2A6FD8,#5FA0FF 60%,#FFD36B);animation:prog var(--total) linear both;z-index:20}
@keyframes prog{from{transform:scaleX(0)}to{transform:scaleX(1)}}
.cam{position:absolute;inset:0;animation:push var(--sd) linear both}
@keyframes push{from{transform:scale(1)}to{transform:scale(1.045)}}
.streak{position:absolute;top:-20%;left:-30%;width:22%;height:140%;pointer-events:none;z-index:9;
  background:linear-gradient(90deg,transparent,rgba(255,255,255,.55),transparent);transform:skewX(-18deg);
  animation:streak .95s cubic-bezier(.3,.6,.3,1) both}
@keyframes streak{from{translate:0 0;opacity:1}to{translate:620% 0;opacity:0}}
.orb{position:absolute;border-radius:50%;pointer-events:none;
  background:radial-gradient(circle,rgba(42,111,216,.20),rgba(42,111,216,0) 68%)}
.orb.o1{width:520px;height:520px;left:-140px;top:-160px;animation:orb1 var(--sd) ease-in-out both}
.orb.o2{width:620px;height:620px;right:-220px;bottom:-280px;animation:orb2 var(--sd) ease-in-out both}
.blue .orb{background:radial-gradient(circle,rgba(255,255,255,.16),rgba(255,255,255,0) 68%)}
@keyframes orb1{from{transform:translate(0,0) scale(1)}to{transform:translate(140px,70px) scale(1.15)}}
@keyframes orb2{from{transform:translate(0,0) scale(1.1)}to{transform:translate(-120px,-60px) scale(.95)}}
.vp{position:relative;overflow:hidden}
.zl{position:relative;transform-origin:0 0}
.zl img{display:block}
.tap{position:absolute;width:26px;height:26px;margin:-13px 0 0 -13px;border-radius:50%;background:rgba(29,91,196,.9);
  box-shadow:0 0 0 3px #fff;opacity:0;animation:tap 1.1s ease-out both;animation-delay:var(--kd)}
.tap:after{content:'';position:absolute;inset:-4px;border-radius:50%;border:3px solid #1D5BC4;animation:tapr 1.1s ease-out both;
  animation-delay:var(--kd)}
@keyframes tap{0%{opacity:0;transform:scale(1.8)}15%{opacity:1;transform:scale(.8)}35%{transform:scale(1)}80%{opacity:1}100%{opacity:0}}
@keyframes tapr{0%{transform:scale(.6);opacity:0}20%{opacity:1}100%{transform:scale(3.2);opacity:0}}
.mark{position:absolute;border:3px solid #FFB020;border-radius:10px;box-shadow:0 0 0 6px rgba(255,176,32,.22);opacity:0;
  animation:mk .5s cubic-bezier(.2,1.5,.4,1) both;animation-delay:var(--kd)}
@keyframes mk{from{opacity:0;transform:scale(1.25)}to{opacity:1;transform:none}}
body.rolling #ctrl,body.rolling #poster{display:none!important}

/* the upright cut: 720x1280, captions over the picture, so the lower fifth stays clear */
body.port,body.port html{width:720px;height:1280px}
body.port #stage{width:720px;height:1280px}
body.port #strip{display:none}
body.port .sc,body.port .in{width:720px;height:1280px}
body.port .in{padding:110px 44px 300px;align-items:flex-start}
body.port .mid{margin-top:150px}
body.port .split{flex-direction:column;gap:26px;align-items:stretch}
body.port .split .R,body.port .sc.wide .R,body.port .sc.wide2 .R{flex:none}
body.port h1{font-size:50px}body.port h2{font-size:36px}
body.port .phone{zoom:1.12}
body.port .duo{width:520px;height:600px;margin:0 auto}
body.port .cardshot{zoom:1.03}
body.port .mail{width:560px}
body.port .net{transform:scale(.72);transform-origin:top center;width:900px;margin-left:-134px}
body.port .clock{font-size:76px}body.port .big{font-size:110px}
"""

def main():
    sc = client() if FILM == 'client' else staff()
    if len(sc) != N_LINES:
        sys.exit('SCENES: %d scenes for %d lines' % (len(sc), N_LINES))
    title = {'client': 'Our new way of looking after your group', 'staff': 'Group client management, the new way'}[FILM]
    page = ('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex">'
            '<title>%s</title><style>' % title + CSS.replace('__PLEX__', PLEX) + '</style></head><body>'
            '<div id="stage" style="--total:%dms"><div class="dots grain"></div><div class="glow g1"></div><div class="glow g2"></div><i id="prog" class="grain"></i>' % sum(DURS)
            + '\n'.join(sc) + '</div><div id="strip"></div><style>' + ''.join(EXTRA) + '</style>'
            '<script>'
            # one design, two frames: a wide 1280x720 layout or an upright 720x1280 one, scaled to the window
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
    #  render.js puts .act / .out on the live and outgoing section and reads .cnt for counters: a rule whose subject is
    #  one of those lands on the scene itself (the meeting film once clipped 420px off every frame that way).
    RESERVED = {'act', 'out', 'cnt', 'sc', 'in', 'rolling', 'grain'}
    for m in re.finditer(r'([^{}]+)\{', CSS):
        for sel in m.group(1).split(','):
            subject = re.split(r'[\s>+~]+', sel.strip())[-1]
            if subject.startswith('@') or subject in ('from', 'to') or re.fullmatch(r'[\d.]+%?', subject):
                continue
            for cls in re.findall(r'\.([a-zA-Z][\w-]*)', subject):
                if cls in RESERVED and subject not in ('.sc', '.sc.act', '.sc.out', '.in', '.grain', '.glow.g1', '.glow.g2', '.glow') \
                        and not subject.startswith('.sc.') and not subject.startswith('.glow'):
                    sys.exit('RESERVED CLASS: "%s" styles .%s, which render.js owns' % (sel.strip(), cls))
    print('  no rule touches render.js\'s reserved classes')

if __name__ == '__main__':
    main()
