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
KEY = {'client': 'gcmc3', 'staff': 'gcms3', 'walk': 'gcmw', 'pension': 'pens2', 'henr': 'henr1', 'term': 'term1', 'employers': 'gcme1'}[FILM]
SHOTS = pathlib.Path(os.environ.get('GCM_SHOTS', HERE / {'walk': 'gcmshots-walk', 'pension': 'pensionshots', 'henr': 'henrshots', 'term': 'termshots', 'employers': 'gcmshots-emp'}.get(FILM, 'gcmshots')))
OUT = ROOT / 'groupclientmanagement' / ({'client': 'new-way-film.html', 'staff': 'staff-new-way-film.html', 'walk': 'what-you-see-film.html',
                                        'pension': 'company-pension-film.html', 'henr': 'health-enrolment-film.html',
                                        'term': 'terminations-film.html', 'employers': 'a-year-with-us-film.html'}[FILM])
TIMING = HERE / (KEY + '-timing.json')

def b64(p, mime):
    return 'data:%s;base64,%s' % (mime, base64.b64encode(pathlib.Path(p).read_bytes()).decode())

def _path(name):
    """A screen by its shooter's PNG name; the repository keeps it as a JPEG of the same name."""
    for p in (SHOTS / name, (SHOTS / name).with_suffix('.jpg')):
        if p.exists():
            return p
    sys.exit('MISSING SCREEN: %s (looked in %s)' % (name, SHOTS))

_cache = {}
def img(name):
    """A screen, as a JPEG data URI no wider than it is ever drawn (a 1688px phone shot is shown 300px wide at
       1.5x zoom), so the page stays small enough to render quickly."""
    if name in _cache:
        return _cache[name]
    p = _path(name)
    from PIL import Image
    im = Image.open(p).convert('RGB')
    cap = 1500 if name.startswith('s') else 900
    if im.width > cap:
        im = im.resize((cap, round(im.height * cap / im.width)), Image.LANCZOS)
    b = io.BytesIO(); im.save(b, 'JPEG', quality=86, optimize=True)
    _cache[name] = 'data:image/jpeg;base64,' + base64.b64encode(b.getvalue()).decode()
    return _cache[name]

MARK = b64(ROOT / 'groupclientmanagement' / ('gcm-mark-teal.png' if FILM == 'employers' else 'gcm-mark.png'), 'image/png')
PLEX = b64(HERE / 'fonts' / 'IBMPlexSans-latin.woff2', 'font/woff2')

T = json.loads(TIMING.read_text()) if TIMING.exists() else {}
N_LINES = {'client': 11, 'staff': 19, 'walk': 15, 'pension': 14, 'henr': 12, 'term': 11, 'employers': 15}[FILM]
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

TAG = '<span class="tag">Sample %s &middot; made-up figures</span>' % ({'pension': 'company', 'henr': 'employee', 'term': 'group'}.get(FILM, 'group'))

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
    return Image.open(_path(name)).size

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

def phone(name, cls='', d=0.0, n=0, moves=(), taps=(), marks=(), w=232):
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
        phone('c02-items.png', d=.3, n=2, moves=((at(2, 'place'), 'hero', 1.22), (at(2, 'chasing'), 'pending', 1.2))),
        'ph'))
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
        '<div class="duo">%s%s</div>' % (
            phone('c01-signin.png', 'back', .2, n=4, w=200, taps=((at(4, 'secure'), 'signin'),)),
            phone('c02-items.png', 'front', at(4, 'service', lead=.4), n=4,
                  moves=((at(4, 'service', lead=.3), 'tab-billing', 1.35),),
                  taps=((at(4, 'service'), 'tab-items'), (at(4, 'billing'), 'tab-billing'), (at(4, 'people'), 'tab-people')))),
        'wide2'))
    # 5 --------------------------------------------------------------------------------------------- billing
    sc.append(split(5,
        eb('Your billing &middot; every month') +
        '<div class="big" style="--kd:%.2fs">26<sup>th</sup></div>' % at(5, 'twenty') +
        row('check', 'Checked against our records', at(5, 'checked'), '', 'ok') +
        row('doc', 'One clear statement of what&rsquo;s due', at(5, 'statement'), 'and any earlier bill still unpaid'),
        phone('c06-billing.png', d=.3, n=5, moves=((at(5, 'checked'), 'total', 1.3), (at(5, 'statement'), 'grand', 1.3)),
              marks=((at(5, 'statement') + .4, 'grand'),)),
        'ph'))
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
        phone('c08-people.png', d=.3, n=6, taps=((at(6, 'plans'), 'dropdown'),),
              moves=((at(6, 'pending'), 'first-card', 1.15), (at(6, 'team', lead=.3), 'who-has-it', 1.35)),
              marks=((at(6, 'team'), 'who-has-it'),)),
        'ph'))
    # 7 ------------------------------------------------------------------------------------------- coming up
    sc.append(split(7,
        eb('Coming up for your people') +
        '<h2>%s</h2>' % kin('We tell you ahead of time.', .3, hi=('ahead',)) +
        row('cake', 'Turning sixty-five', at(7, 'sixty'), 'the group cover ends: we help them convert') +
        row('grad', 'A dependent comes of age', at(7, 'dependent'), 'and moves off the family plan') +
        row('sun', 'Close to retiring', at(7, 'retiring'), 'on your company pension'),
        card('c04-coming-up-card.png', d=.4, n=7,
             moves=((at(7, 'sixty'), 'row-65', 1.15), (at(7, 'dependent'), 'row-dependent', 1.15), (at(7, 'retiring'), 'row-retire', 1.15)),
             marks=((at(7, 'sixty') + .5, 'row-65'), (at(7, 'dependent') + .5, 'row-dependent'), (at(7, 'retiring') + .5, 'row-retire'))),
        'wide'))
    # 8 -------------------------------------------------------------------------------------- joining or leaving
    sc.append(split(8,
        eb('Someone joining or leaving?') +
        '<h2>%s</h2>' % kin('Tell us right there.', at(8, 'Tell')) +
        row('doc', 'The form fills itself in', at(8, 'fills'), 'Guardian&rsquo;s own form, from our records', 'ok') +
        row('check', 'We follow it through to the end', at(8, 'end'), 'and you see where it stands', 'ok'),
        '<div class="duo">%s%s</div>' % (
            phone('c09-person-msg.png', 'back', .2, n=8, w=200, taps=((at(8, 'there'), 'send'),)),
            phone('c10b-form-pdf.png', 'front', at(8, 'form', lead=.5), n=8, moves=((at(8, 'fills'), 'pdf-page1', 1.15),))),
        'wide2'))
    # 9 ---------------------------------------------------------------------------------------------- the stars
    sc.append(split(9,
        eb('Rate us') + stars(at(9, 'five')) +
        '<div class="note big2" style="--kd:%.2fs">Every week, on your service page.</div>' % at(9, 'week') +
        '<div class="callout" style="--kd:%.2fs">And on every bill, rate <b>the person who looks after your account</b>.</div>' % at(9, 'bill'),
        '<div class="duo">%s%s</div>' % (
            phone('c05-rate.png', 'back', .2, n=9, w=200, taps=((at(9, 'five'), 'star5'),)),
            phone('c07-billing-rate.png', 'front', at(9, 'bill', lead=.3), n=9,
                  moves=((at(9, 'person'), 'manager-name', 1.3),), taps=((at(9, 'account'), 'star5'),))),
        'wide2'))
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

# ---------------------------------------------------------------------------------- what the group sees (17 Nov 2026)
def walk():
    """Asked for as "what does the client see I need a video": the group's own service page, screen by screen, in the
       order the person who looks after the plans meets it. Fifteen lines; every screen is client.html on the made-up
       group in tools/film/gcmshots-walk (shot by the scratchpad's shoot.js against a mocked backend)."""
    sc = []
    # 1 the title
    sc.append(S(1,
        '<div class="mid"><img class="mk" src="%s" alt="">%s<h1>%s</h1>'
        '<div class="sub" style="--kd:%.2fs">Group Life &middot; Group Health &middot; Pension</div></div>'
        % (MARK, eb('Your group&rsquo;s service page', .4), kin('What you see when you sign in', .7, hi=('see',)), at(1, 'first')),
        'blue title'))
    # 2 the Monday report, and its button
    sc.append(split(2,
        eb('Every Monday') +
        '<div class="clock" style="--kd:%.2fs">10:00<span>our report, in your inbox</span></div>' % at(2, 'ten') +
        row('mail', 'One short report on everything we&rsquo;re doing', at(2, 'report'), '', 'ok') +
        row('check', 'One button opens your page', at(2, 'button'), 'no new password to remember', 'ok'),
        mailcard('Your weekly service report', 'Harbour Point Logistics Ltd &middot; Monday 16 November',
                 '<p>Good morning, Pat. Here is where everything we are doing for your group stands.</p>'
                 '<div class="cnts"><div><b>6</b><span>finished</span></div><div><b>4</b><span>still open</span></div>'
                 '<div class="w"><b>2</b><span>need you</span></div></div>'
                 '<div class="btnish sm" style="--kd:%.2fs">Open your service page</div>' % at(2, 'button'), .5)))
    # 3 signing in
    sc.append(split(3,
        eb('Signing in') +
        row('doc', 'Your list bill number', at(3, 'list'), 'printed on every bill') +
        row('lock', 'Your access code', at(3, 'access'), 'in our e-mail') +
        '<div class="punch" style="--kd:%.2fs">That&rsquo;s all it takes.</div>' % at(3, 'all'),
        phone('c01-signin.png', d=.3, n=3, taps=((at(3, 'list') + .2, 'listbill'), (at(3, 'access') + .2, 'code'), (at(3, 'all'), 'signin'))),
        'ph'))
    # 4 the top: who looks after you, three tabs
    sc.append(split(4,
        eb('At the top') +
        row('user', 'Who looks after your account', at(4, 'looks'), 'by name') +
        '<div class="tabs3">' + chip('Your service items', at(4, 'service'), 'tab') + chip('Your billing', at(4, 'billing'), 'tab') +
        chip('Your people', at(4, 'people'), 'tab') + '</div>',
        phone('c02-items.png', d=.3, n=4, moves=((at(4, 'looks'), 'hero', 1.25), (at(4, 'three'), 'tab-billing', 1.4)),
              taps=((at(4, 'service'), 'tab-items'), (at(4, 'billing'), 'tab-billing'), (at(4, 'people'), 'tab-people'))),
        'ph'))
    # 5 pending applications and increases
    sc.append(split(5,
        eb('First, what&rsquo;s pending') +
        row('clock', 'Applications and increases still pending', at(5, 'applications'), 'for Group Life, Group Health and Pension') +
        row('alert', 'How long each has been waiting', at(5, 'waiting'), 'past our target, in red', 'warn') +
        row('users', 'Who on our team has it', at(5, 'team'), 'and who they are waiting on'),
        phone('c02-items.png', d=.3, n=5, moves=((at(5, 'applications'), 'pending', 1.3),), marks=((at(5, 'waiting'), 'pending'),)),
        'ph'))
    # 6 an open item: its history, and your answer
    sc.append(split(6,
        eb('Your open items') +
        row('list', 'Read each item&rsquo;s history', at(6, 'history'), 'what was done, by whom, and when') +
        '<div class="tabs3">' + chip('Correct', at(6, 'correct'), 'ok') + chip('Needs a change', at(6, 'change'), 'tab') +
        chip('Not ours', at(6, 'yours'), 'tab') + '</div>',
        '<div class="duo">%s%s</div>' % (
            phone('c03b-item-top.png', 'back', .2, n=6, w=200, marks=((at(6, 'history'), 'history'),)),
            phone('c03-item-open.png', 'front', at(6, 'correct', lead=.6), n=6, moves=((at(6, 'correct', lead=.3), 'ans-change', 1.3),),
                  taps=((at(6, 'correct'), 'ans-correct'), (at(6, 'change'), 'ans-change'), (at(6, 'yours'), 'ans-notours')))),
        'wide2'))
    # 7 coming up for your people
    sc.append(split(7,
        eb('Coming up for your people') +
        row('cake', 'Turning sixty-five', at(7, 'sixty'), 'the group cover ends: we help them convert') +
        row('grad', 'Dependents coming of age', at(7, 'dependents'), 'and moving off the family plan') +
        row('sun', 'Close to retiring', at(7, 'retiring'), 'on your company pension') +
        '<div class="note" style="--kd:%.2fs">No surprises.</div>' % at(7, 'surprise'),
        phone('c04-coming-up.png', d=.3, n=7, moves=((at(7, 'sixty'), 'row-65', 1.2), (at(7, 'dependents'), 'row-dependent', 1.2), (at(7, 'retiring'), 'row-retire', 1.2)),
              marks=((at(7, 'sixty') + .5, 'row-65'), (at(7, 'dependents') + .5, 'row-dependent'), (at(7, 'retiring') + .5, 'row-retire'))),
        'ph'))
    # 8 the week's stars
    sc.append(split(8,
        eb('Rate the week') + stars(at(8, 'five')) +
        '<div class="note big2" style="--kd:%.2fs">Add a word if you&rsquo;d like.</div>' % at(8, 'word'),
        phone('c05-rate.png', d=.3, n=8, taps=((at(8, 'five'), 'star5'),), marks=((at(8, 'word'), 'comment'),)),
        'ph'))
    # 9 your billing: the statement
    sc.append(split(9,
        eb('Your billing') +
        row('doc', 'This month&rsquo;s bills', at(9, 'month'), 'Group Health, Group Life, and your payroll plans') +
        row('alert', 'Anything still unpaid', at(9, 'unpaid'), 'from earlier months', 'warn') +
        row('cash', 'The total to bring you up to date', at(9, 'total'), '', 'ok'),
        phone('c06-billing.png', d=.3, n=9, moves=((at(9, 'month'), 'total', 1.3), (at(9, 'unpaid'), 'open-earlier', 1.3), (at(9, 'total'), 'grand', 1.3)),
              marks=((at(9, 'total') + .4, 'grand'),)),
        'ph'))
    # 10 each plan's line, and rating the person who looks after you
    sc.append(split(10,
        eb('Each plan, month by month') +
        row('list', 'Every month&rsquo;s bill and every payment', at(10, 'payment'), '') +
        '<div class="callout" style="--kd:%.2fs">On every bill, rate <b>the person who looks after your account</b>.</div>' % at(10, 'rate'),
        '<div class="duo">%s%s</div>' % (
            phone('c06b-billing-lines.png', 'back', .2, n=10, w=200, taps=((at(10, 'plan'), 'btab-life'),), marks=((at(10, 'payment'), 'history'),)),
            phone('c07-billing-rate.png', 'front', at(10, 'bill', 1, lead=.4), n=10, moves=((at(10, 'person'), 'manager-name', 1.3),), taps=((at(10, 'account'), 'star5'),))),
        'wide2'))
    # 11 your people
    sc.append(split(11,
        eb('Your people') +
        '<div class="tiles">'
        '<div class="tl" style="--kd:%.2fs"><b>%s</b><span>Everyone on your plans</span></div>'
        '<div class="tl" style="--kd:%.2fs"><b>%s</b><span>Who came off this year</span></div>'
        '<div class="tl w" style="--kd:%.2fs"><b>%s</b><span>Who&rsquo;s still pending</span></div></div>'
        '<div class="note" style="--kd:%.2fs">Send us a note about anyone: it goes straight to the person handling it.</div>'
        % (at(11, 'everyone'), ICON['users'], at(11, 'came'), ICON['user'], at(11, 'pending'), ICON['clock'], at(11, 'note')),
        '<div class="duo">%s%s</div>' % (
            phone('c08-people.png', 'back', .2, n=11, w=200, taps=((at(11, 'everyone'), 'dropdown'),)),
            phone('c09-person-msg.png', 'front', at(11, 'note', lead=.4), n=11, moves=((at(11, 'note'), 'message', 1.2),), taps=((at(11, 'straight'), 'send'),))),
        'wide2'))
    # 12 group life and health: Guardian's own forms
    sc.append(split(12,
        eb('Group Life and Group Health') +
        '<h2>%s</h2>' % kin('Joining or leaving?', at(12, 'joining')) +
        row('users', 'Search their name', at(12, 'Search'), 'everyone on your plan, from our records') +
        row('doc', 'Guardian&rsquo;s own form fills itself in', at(12, 'fills'), 'to enrol, terminate or change a member', 'ok'),
        '<div class="duo">%s%s</div>' % (
            phone('c10-form-search.png', 'back', .2, n=12, w=200, taps=((at(12, 'Search') + .3, 'result1'),)),
            phone('c10b-form-pdf.png', 'front', at(12, 'form', lead=.5), n=12, moves=((at(12, 'fills'), 'pdf-page1', 1.15),))),
        'wide2'))
    # 13 a pension or life plan from salary: someone joining
    sc.append(split(13,
        eb('A pension or life insurance from salary') +
        row('user', 'Tell us who&rsquo;s joining', at(13, 'joining'), 'and the first salary deduction') +
        row('phone', 'We call them', at(13, 'call'), 'within two working days', 'ok') +
        row('doc', 'And prepare their projection', at(13, 'projection'), 'from their salary', 'ok'),
        '<div class="duo">%s%s</div>' % (
            phone('c13-pay-join.png', 'back', .2, n=13, w=200, taps=((at(13, 'pension'), 'pay-pill'),), marks=((at(13, 'joining'), 'join'),)),
            phone('c13b-pay-join-2.png', 'front', at(13, 'joining', lead=.3), n=13, marks=((at(13, 'joining') + .6, 'plans'), (at(13, 'salary', 1), 'start')),
                  taps=((at(13, 'call'), 'send'),))),
        'wide2'))
    # 14 someone leaving
    sc.append(split(14,
        eb('When someone leaves') +
        '<h2>%s</h2>' % kin('Their policy is still theirs.', at(14, 'policy'), hi=('theirs.',)) +
        row('cash', 'Tell us the last salary deduction', at(14, 'deduction'), 'we take it off your list bill after that') +
        row('shield', 'We help them keep it going', at(14, 'keep'), 'another way to pay, set up with them', 'ok'),
        '<div class="duo">%s%s</div>' % (
            phone('c14-pay-leave.png', 'back', .2, n=14, w=200, marks=((at(14, 'leaves'), 'result1'),)),
            phone('c14b-pay-leave-2.png', 'front', at(14, 'Tell', lead=.4), n=14, marks=((at(14, 'deduction'), 'last'),), taps=((at(14, 'keep'), 'send'),))),
        'wide2'))
    # 15 a real person
    sc.append(split(15,
        '<img class="mk sm" src="%s" alt="" style="margin:0 0 14px">' % MARK +
        '<h2>%s</h2>' % kin('A real person reads every answer.', .3, hi=('person',)) +
        '<div class="note" style="--kd:%.2fs">And you&rsquo;ll see where it stands the next time you sign in.</div>' % at(15, 'see'),
        phone('c11-thanks.png', d=.3, n=15, marks=((at(15, 'answer'), 'heading'),)),
        'ph'))
    return sc

# ------------------------------------------------------------------------------------------- the pension film
def pdfpage(name, d, w, vh, label='', n=0, moves=(), marks=(), cls=''):
    """One page of the filled package, as the PDF prints it, with a light running down it as it 'fills'."""
    return ('<div class="pdfc %s" style="--kd:%.2fs;width:%dpx">%s<i class="sweep" style="--kd:%.2fs"></i>%s</div>'
            % (cls, d, w, cam(name, n, w, vh, moves, (), marks), d + .25,
               ('<span class="pl" style="--kd:%.2fs">%s</span>' % (d + .4, label)) if label else ''))

def paper(i, d, ko):
    rot = (-14, 9, -5, 13, -9, 4)[i % 6]; x = (-60, 40, -20, 60, -40, 10)[i % 6]; y = (-30, -10, 20, 0, 40, 10)[i % 6]
    return ('<div class="paper" style="--r:%ddeg;--x:%dpx;--y:%dpx;--kd:%.2fs;--ko:%.2fs;--fx:%dpx;--fy:%dpx">'
            '<i></i><i></i><i></i><i></i><i></i><i></i></div>' % (rot, x, y, d, ko, (-1) ** i * (380 + 40 * i), -260 + 90 * i))

def pension():
    """Asked for on 17 November 2026: "a small effective video to show how we as a branch manage the pension plans for
       companies ... the link that goes out ... the company fills out their part, routed to the employee ... any issue they
       can query right inside the digital form ... when the employee completes it automatically calculates everything",
       then, mid-build, "also show the calculations on the form ... especially section 134 ... show the pdf". Every screen is
       pensionplanstt.netlify.app on a made-up company (Harbour Point Logistics Ltd) and employee (Marcus Alleyne), shot by
       the scratchpad's pensionfilm/shoot.js with the register and the AI mocked; the PDFs are the site's own package."""
    sc = []
    away = at(1, 'away')
    # 1 the pile of forms, gone
    sc.append(split(1,
        eb('Company pensions &middot; Section 134', .3) +
        '<h1>%s</h1>' % kin('Company pensions, without the paperwork.', .6, hi=('without',)) +
        '<div class="tabs3">' + ''.join(chip('%s<i class="xs" style="--kd:%.2fs"></i>' % (t, away + i * .15), at(1, w), 'bad x')
                                        for i, (t, w) in enumerate((('Piles of forms', 'piles'), ('A calculator', 'calculator'), ('Weeks of chasing', 'weeks')))) + '</div>',
        '<div class="pile">%s<div class="onelink" style="--kd:%.2fs"><img src="%s" alt=""><b>One link</b><span>for the whole team</span></div></div>'
        % (''.join(paper(i, .2 + i * .12, away + i * .05) for i in range(6)), away + .35, MARK), 'wide'))
    # 2 the systems behind it, and AI
    sc.append(split(2,
        eb('How we&rsquo;ve always worked') +
        row('doc', 'Every client&rsquo;s record, in order', at(2, 'records'), 'in strong systems like Salesforce') +
        row('star', 'Artificial intelligence', at(2, 'artificial'), 'helping us get better every week', 'ok') +
        '<div class="note" style="--kd:%.2fs">So the paperwork is ours, not yours.</div>' % at(2, 'week'),
        '<div class="crm" style="--kd:.3s"><div class="ch"><b>Client record</b><span>Harbour Point Logistics Ltd</span></div>'
        '<div class="cr" style="--kd:%.2fs"><span>Company pension</span><b>3 employees</b></div>'
        '<div class="cr" style="--kd:%.2fs"><span>Enrolment</span><b>Marcus Alleyne &middot; in progress</b></div>'
        '<div class="cr" style="--kd:%.2fs"><span>Next step</span><b>Forms checked by the branch</b></div>'
        '<div class="cr" style="--kd:%.2fs"><span>Every step</span><b>on the record</b></div>'
        '<div class="ai" style="--kd:%.2fs"><i></i>RIA, our AI assistant, on every form</div>%s</div>'
        % (at(2, 'records') + .2, at(2, 'records') + .5, at(2, 'Salesforce'), at(2, 'Salesforce') + .3, at(2, 'artificial') + .4, TAG), 'wide'))
    # 3 the employer signs in
    sc.append(split(3,
        eb('It starts with the employer') +
        row('lock', 'Sign in with your company code', at(3, 'code'), 'no password to remember') +
        row('users', 'Everyone on your plan', at(3, 'everyone'), '') +
        row('check', 'And where each one stands', at(3, 'stands'), '', 'ok'),
        '<div class="duo l">%s%s</div>' % (
            lap('s01-door.png', 'back', .2, n=3, w=520, h=300, taps=((at(3, 'Sign') - .2, 'employer'),)),
            lap('s02-schedule.png', 'front', at(3, 'code', lead=.3), n=3, w=520, h=300,
                moves=((at(3, 'everyone'), 'table', 1.0),), marks=((at(3, 'stands'), 'table'),))),
        'wide3'))
    # 4 the company's part
    sc.append(split(4,
        eb('The company&rsquo;s part') +
        '<div class="tabs3">' + chip('The plan', at(4, 'plan'), 'tab') + chip('The premium', at(4, 'premium'), 'tab') +
        chip('Their salary', at(4, 'salary'), 'tab') + '</div>' +
        '<div class="punch" style="--kd:%.2fs">Press send.</div>' % at(4, 'send') +
        '<div class="note" style="--kd:%.2fs">We write to your employee straight away.</div>' % at(4, 'write'),
        lap('s03-enrol.png', d=.3, n=4, w=558, h=330,
            moves=((at(4, 'plan'), 'plan', 1.35), (at(4, 'premium'), 'premium', 1.4), (at(4, 'salary'), 'salary', 1.4), (at(4, 'send') - .3, 'submit', 1.3)),
            taps=((at(4, 'send'), 'submit'),)),
        'wide'))
    # 5 the link, and the chase
    sc.append(split(5,
        eb('Straight to your employee') +
        row('mail', 'Their own link, by e-mail', at(5, 'link'), 'with their access code') +
        row('clock', 'Reminded every morning at 9', at(5, 'morning'), 'until their part is in', 'warn') +
        row('check', 'You&rsquo;re copied on every message', at(5, 'copied'), '', 'ok'),
        '<div class="duo m">%s%s</div>' % (
            card('s05-waiting.png', 'back', at(5, 'morning', lead=.6), n=5, w=400, maxh=430, moves=((at(5, 'morning'), 'card', 1.0),), marks=((at(5, 'morning') + .5, 'chase'),)),
            mailcard('Your company pension: your part', 'To Marcus Alleyne &middot; copy to HR and the branch',
                     '<p>Hi Marcus. Harbour Point Logistics Ltd has set up a company pension for you, and has done its part.</p>'
                     '<p>There&rsquo;s one part only you can give: about ten minutes, on your phone.</p>'
                     '<p class="t">Your access code <b>EM&#8209;MRA&#8209;2208</b></p>'
                     '<div class="btnish sm" style="--kd:%.2fs">Open my part</div>' % (at(5, 'link') + .3), .3, 'front')),
        'wide3'))
    # 6 the employee's part, on a phone
    sc.append(split(6,
        eb('Their part &middot; about ten minutes') +
        row('users', 'Who the money goes to', at(6, 'money'), 'and each person&rsquo;s share') +
        row('cash', 'Anything of their own', at(6, 'own'), 'from salary, and it lowers their tax') +
        row('doc', 'Photos of three documents', at(6, 'photos'), 'ID, a utility bill and a pay slip', 'ok'),
        '<div class="duo">%s%s</div>' % (
            phone('p06-ee-record.png', 'back', .2, n=6, w=200, marks=((at(6, 'only'), 'waiting'),)),
            phone('p07-ee-part.png', 'front', at(6, 'phone', lead=.3), n=6,
                  moves=((at(6, 'money'), 'bens', 1.0), (at(6, 'own'), 'own', 1.0), (at(6, 'photos'), 'files', 1.0), (at(6, 'minutes') - .2, 'send', 1.0)),
                  taps=((at(6, 'minutes'), 'send'),))),
        'wide2'))
    # 7 questions, inside the form and on WhatsApp
    sc.append(split(7,
        eb('A question? Answered') +
        row('chat', 'RIA, right inside the form', at(7, 'RIA'), 'our assistant, at any hour') +
        row('phone', 'Or WhatsApp &middot; HELP 868', at(7, 'WhatsApp'), 'every question logged and answered', 'ok'),
        '<div class="duo">%s%s</div>' % (
            phone('p08-ria.png', 'back', .2, n=7, w=200, marks=((at(7, 'RIA') + .3, 'msgs'),)),
            '<div class="phone front wa" style="--kd:%.2fs"><div class="wah"><b>HELP 868</b><span>WhatsApp &middot; Ricky Rampersad Branch</span></div>'
            '<div class="wab"><p class="me" style="--kd:%.2fs">Hi, my company is setting up a pension for me. Can I change who I name later?</p>'
            '<p class="it" style="--kd:%.2fs">Thanks, Marcus. Your question is logged and our team will answer it today.</p>'
            '<p class="ref" style="--kd:%.2fs">Logged &middot; sample reference</p></div>%s</div>'
            % (at(7, 'WhatsApp', lead=.4), at(7, 'WhatsApp') + .2, at(7, 'logged'), at(7, 'logged') + .5, TAG)),
        'wide2'))
    # 8 Section 134: solved, not guessed
    sc.append(split(8,
        eb('Section 134 &middot; the calculation') +
        '<h2>%s</h2>' % kin('Solved, not guessed.', at(8, 'solved', lead=.5), hi=('solved,',)) +
        '<div class="loop" style="--kd:%.2fs"><svg viewBox="0 0 420 210"><path d="M70 150 C 120 20, 300 20, 350 150"/>'
        '<path d="M350 170 C 300 205, 120 205, 70 170"/></svg>'
        '<div class="ln a" style="--kd:%.2fs"><b>Company contribution</b></div>'
        '<div class="ln b" style="--kd:%.2fs"><b>Raises the income</b></div>'
        '<div class="ln c" style="--kd:%.2fs"><b>That sets the ceiling</b></div></div>'
        % (at(8, 'contribution'), at(8, 'contribution'), at(8, 'income'), at(8, 'ceiling')),
        card('s12b-built.png', d=.3, n=8, w=560, maxh=470,
             moves=((at(8, 'calculation'), 'built', 1.0), (at(8, 'ceiling'), 'which', 1.0)),
             marks=((at(8, 'income') + .2, 'chargeable'), (at(8, 'solved'), 'third'))),
        'wide'))
    # 9 the figure, and every line of the working
    sc.append(split(9,
        eb('For this employee') +
        '<div class="big c"><b class="cnt" data-to="62660" data-sep data-pre="$" data-at="%d">$62,660</b></div>' % (at(9, 'sixty') * 1000) +
        '<div class="note big2" style="--kd:%.2fs">the most the company may put in, a year</div>' % at(9, 'year') +
        '<div class="tabs3">' + chip('Line 10 &middot; No', at(9, 'working'), 'ok') + chip('Line 12 &middot; No', at(9, 'working') + .25, 'ok') +
        chip('Within both limits', at(9, 'shown'), 'info') + '</div>',
        '<div class="duo m">%s%s</div>' % (
            card('s12a-max.png', 'back', .2, n=9, w=430, maxh=300, marks=((at(9, 'sixty') + .4, 'max'),)),
            pdfpage('pkg03.png', at(9, 'working', lead=.6), 330, 430, 'Every line of the working', n=9, cls='front',
                    moves=((at(9, 'working'), 'income', 1.0), (at(9, 'shown'), 'limits', 1.0)), marks=((at(9, 'shown') + .3, 'limits'),))),
        'wide3'))
    # 10 every form fills itself
    f = [('pkg02.png', 'Inland', 'Inland Revenue approval', 'limits'), ('pkg04.png', 'One', 'Declaration 1', 'who'),
         ('pkg09.png', 'Two', 'Declaration 2', 'who'), ('pkg14.png', 'deduction', 'Salary deduction', 'who')]
    sc.append(S(10,
        '<div style="width:100%">' + eb('Guardian&rsquo;s own forms') +
        '<h2>%s</h2>' % kin('Every form fills itself.', .4, hi=('itself.',)) +
        '<div class="pages4">' + ''.join(pdfpage(nm, at(10, w), 236, 300, lab, n=10, marks=((at(10, w) + .6, mk),)) for nm, w, lab, mk in f) + '</div>'
        '<div class="punch" style="--kd:%.2fs;text-align:center">Filled in exactly. Nothing retyped.</div></div>' % at(10, 'exactly'),
        ''))
    # 11 one package, checked by the branch
    sc.append(split(11,
        eb('One package') +
        row('list', 'Every form and document, in order', at(11, 'package'), 'one PDF, ready for head office') +
        row('check', 'Checked by our branch', at(11, 'checks'), 'before it goes anywhere', 'ok') +
        row('shield', 'Then on to head office', at(11, 'head'), ''),
        '<div class="fan">%s</div>' % ''.join(
            '<div class="fp" style="--r:%ddeg;--x:%dpx;--kd:%.2fs"><img src="%s" alt=""></div>' % (r, x, at(11, 'package') + i * .12, img(nm))
            for i, (nm, r, x) in enumerate([('pkg14.png', 12, 120), ('pkg09.png', 7, 70), ('pkg04.png', 2, 25), ('pkg02.png', -3, -20), ('pkg01.png', -8, -70)]))
        + '<div class="pg18" style="--kd:%.2fs"><b>18</b>pages, every one checked</div>' % at(11, 'checks'),
        'wide'))
    # 12 the employer's copy
    sc.append(split(12,
        eb('Your copy') +
        '<div class="tabs3">' + chip('Print', at(12, 'print'), 'tab') + chip('Sign', at(12, 'sign'), 'tab') + chip('Stamp', at(12, 'stamp'), 'tab') +
        chip('Send', at(12, 'send'), 'tab') + '</div>' +
        '<div class="punch" style="--kd:%.2fs">Nothing to retype.</div>' % at(12, 'retype') +
        '<div class="punch" style="--kd:%.2fs;margin-top:4px">Nothing to chase.</div>' % at(12, 'chase'),
        '<div class="copyw">' +
        mailcard('Your pension package: Marcus Alleyne', 'To HR &middot; Harbour Point Logistics Ltd',
                 '<p>Here is the package for Marcus Alleyne, every form filled in. Please print it, sign and stamp where marked, and send it back to us.</p>'
                 '<div class="att" style="--kd:%.2fs"><b>PDF</b><span>Pension package &middot; Marcus Alleyne<i>18 pages</i></span></div>' % (at(12, 'copy') + .3), .3) +
        '<div class="stamp sm" style="--kd:%.2fs">SIGNED</div></div>' % at(12, 'stamp'),
        'wide'))
    # 13 everyone sees where it stands
    sc.append(split(13,
        eb('Everyone sees where it stands') +
        row('user', 'You, the employer', at(13, 'you'), '') +
        row('users', 'Your employee', at(13, 'employee'), '') +
        row('shield', 'And our team', at(13, 'team'), 'all the way to the policy being issued', 'ok'),
        '<div class="duo m">%s%s</div>' % (
            card('s11-tracked.png', 'back', .2, n=13, w=420, maxh=440, moves=((at(13, 'you'), 'timeline', 1.0),), marks=((at(13, 'you') + .4, 'timeline'),)),
            phone('p10-ee-track.png', 'front', at(13, 'employee', lead=.4), n=13, w=210, marks=((at(13, 'employee') + .3, 'timeline'),))),
        'wide3'))
    # 14 a journey, not a transaction
    sc.append(S(14,
        '<div class="mid"><img class="mk" src="%s" alt="">%s<h1>%s</h1>'
        '<div class="flow">%s%s%s</div>'
        '<div class="sub" style="--kd:%.2fs">Company pensions &middot; Ricky Rampersad Branch &middot; Guardian Life of the Caribbean</div>'
        '<div class="url" style="--kd:%.2fs">support@rickyrampersadbranch.com &middot; HELP 868 on WhatsApp</div></div>'
        % (MARK, eb('Too many forms used to hold pensions back', .4), kin('A journey, not a transaction.', at(14, 'journey', lead=.3), hi=('journey,',)),
           '<div class="fs" style="--kd:%.2fs">One link</div>' % at(14, 'link'),
           '<div class="fs" style="--kd:%.2fs">A few minutes</div>' % at(14, 'minutes'),
           '<div class="fs" style="--kd:%.2fs">A team that stays with you</div>' % at(14, 'stays'),
           at(14, 'journey') + .6, at(14, 'transaction') + .6),
        'blue'))
    return sc


# ------------------------------------------------------------------------- group health enrolment (17 Nov 2026)
def henr():
    """Asked for on 17 November 2026: "do the same vid for the health and termination enrollments". The employee's own
       enrolment link, benefits/enroll.html, on a made-up employee (Marcus Sample) of a made-up company (Harbour Point
       Logistics Ltd), shot by the scratchpad's henr/shoot.js with the branch's webhook mocked, so nothing was filed."""
    sc = []
    away = at(1, 'weeks') + .9
    sc.append(split(1,
        eb('Group health &amp; life &middot; joining', .3) +
        '<h1>%s</h1>' % kin('Joining your plan, without the paperwork.', .6, hi=('without',)) +
        '<div class="tabs3">' + ''.join(chip('%s<i class="xs" style="--kd:%.2fs"></i>' % (t, away + i * .15), at(1, w), 'bad x')
                                        for i, (t, w) in enumerate((('Piles of paper', 'paper'), ('Missing signatures', 'signature'), ('Weeks of waiting', 'weeks')))) + '</div>',
        '<div class="pile">%s<div class="onelink" style="--kd:%.2fs"><img src="%s" alt=""><b>One link</b><span>for every new employee</span></div></div>'
        % (''.join(paper(i, .2 + i * .12, away + i * .05) for i in range(6)), away + .35, MARK), 'wide'))
    sc.append(split(2,
        eb('It starts with your HR team') +
        row('mail', 'One link for your team', at(2, 'link'), 'copied, or shared in one tap') +
        row('chat', 'On WhatsApp or by e-mail', at(2, 'WhatsApp'), '') +
        row('check', 'Your company already filled in', at(2, 'company'), 'and the date cover starts', 'ok'),
        lap('s01-share.png', d=.3, n=2, w=558, h=350, moves=((at(2, 'link'), 'share', 1.25), (at(2, 'company') - .2, 'company', 1.25)),
            taps=((at(2, 'WhatsApp'), 'wa'),), marks=((at(2, 'link') + .4, 'share'), (at(2, 'company') + .3, 'company'))),
        'wide'))
    sc.append(split(3,
        eb('The employee&rsquo;s part') +
        '<h2>%s</h2>' % kin('A few minutes, on their phone.', at(3, 'minutes', lead=.4), hi=('minutes,',)) +
        '<div class="tabs3">' + chip('Details', at(3, 'step'), 'tab') + chip('Family', at(3, 'step') + .2, 'tab') +
        chip('Health', at(3, 'step') + .4, 'tab') + chip('Sign', at(3, 'step') + .6, 'tab') + '</div>',
        phone('p02-open.png', d=.3, n=3, marks=((at(3, 'step'), 'stepper'), (at(3, 'phone') + .3, 'company'))),
        'wide2'))
    sc.append(split(4,
        eb('Their details and their cover') +
        row('user', 'Their own details', at(4, 'details'), 'typed once') +
        row('shield', 'Group health', at(4, 'health'), '') +
        row('users', 'Group life, or both', at(4, 'life'), '', 'ok'),
        '<div class="duo">%s%s</div>' % (
            phone('p03-details.png', 'back', .2, n=4, w=200, marks=((at(4, 'details'), 'name'),)),
            phone('p03b-cover.png', 'front', at(4, 'cover', lead=.4), n=4, marks=((at(4, 'health'), 'cover'),), taps=((at(4, 'both'), 'next'),))),
        'wide2'))
    sc.append(split(5,
        eb('The family') +
        row('users', 'Spouse and children to be covered', at(5, 'family'), '') +
        row('doc', 'Who the life cover pays', at(5, 'pays'), '') +
        row('check', 'And the percentage for each', at(5, 'percentage'), 'it has to total 100%', 'ok'),
        '<div class="duo l">%s%s</div>' % (
            lap('s04-deps.png', 'back', .2, n=5, w=520, h=320, moves=((at(5, 'family'), 'deps', 1.2),), marks=((at(5, 'family') + .4, 'deps'),)),
            lap('s05-bens.png', 'front', at(5, 'pays', lead=.4), n=5, w=520, h=320, moves=((at(5, 'pays'), 'bens', 1.25),), marks=((at(5, 'percentage'), 'bens'),))),
        'wide3'))
    sc.append(split(6,
        eb('The health questions') +
        '<div class="punch" style="--kd:%.2fs">One tick.</div>' % at(6, 'tick') +
        '<div class="note" style="--kd:%.2fs">&ldquo;No&rdquo; to every question, for everyone on the form.</div>' % (at(6, 'tick') + .5) +
        '<div class="note" style="--kd:%.2fs">Any answer can still be changed.</div>' % at(6, 'change'),
        '<div class="duo">%s%s</div>' % (
            phone('p06-health.png', 'back', .2, n=6, w=200, marks=((at(6, 'questions'), 'host'),)),
            phone('p06b-well.png', 'front', at(6, 'tick', lead=.5), n=6, marks=((at(6, 'tick') + .2, 'well'),), taps=((at(6, 'tick'), 'well'),))),
        'wide2'))
    sc.append(split(7,
        eb('Signed on the screen') +
        row('tick2', 'With a finger', at(7, 'finger'), 'theirs and their spouse&rsquo;s', 'ok') +
        '<div class="tabs3">' + ''.join(chip('%s<i class="xs" style="--kd:%.2fs"></i>' % (t, at(7, w) + .4), at(7, w), 'bad x')
                                        for t, w in (('Printing', 'printing'), ('Scanning', 'scanning'))) + '</div>',
        phone('p07-sign.png', d=.3, n=7, marks=((at(7, 'sign'), 'sig'), (at(7, 'finger') + .4, 'sig2'))),
        'wide2'))
    sc.append(split(8,
        eb('Guardian&rsquo;s own form') +
        row('doc', 'The Group Health and Life Application', at(8, 'application'), 'filled in from their answers') +
        '<div class="punch" style="--kd:%.2fs">Exactly as it will print.</div>' % at(8, 'exactly'),
        pdfpage('s08-gio.png', at(8, 'Guardian', lead=.4), 470, 470, 'Group Health and Life Application &middot; GIO001', n=8,
                moves=((at(8, 'application'), 'secA', 1.15), (at(8, 'filled'), 'cover', 1.15), (at(8, 'exactly'), 'deps', 1.1)),
                marks=((at(8, 'filled') + .4, 'secA'),)),
        'wide'))
    sc.append(split(9,
        eb('And the declaration') +
        row('shield', 'The declaration of insurability', at(9, 'declaration'), '') +
        row('list', 'Every health answer', at(9, 'health'), '') +
        row('tick2', 'Their signature in place', at(9, 'signature'), '', 'ok'),
        pdfpage('s09-doi.png', .3, 470, 470, 'Group Health Plan &middot; Declaration of Insurability', n=9,
                moves=((at(9, 'health'), 'partC', 1.1), (at(9, 'signature'), None, 1.0)), marks=((at(9, 'declaration') + .2, 'partB'),)),
        'wide'))
    sc.append(split(10,
        eb('Sent') +
        row('check', 'A reference, straight away', at(10, 'reference'), '', 'ok') +
        row('mail', 'The whole application to our branch', at(10, 'branch'), ''),
        '<div class="duo m">%s%s</div>' % (
            phone('p10-done.png', 'back', .2, n=10, w=210, marks=((at(10, 'send'), 'print'),)),
            mailcard('New enrolment &middot; sample reference', 'To our branch &middot; Harbour Point Logistics Ltd',
                     '<p><b>Marcus Sample</b> &middot; Group Health and Group Life</p>'
                     '<p>Employee + family &middot; spouse and two children &middot; beneficiaries 60%% and 40%%</p>'
                     '<p class="t">Cover from <b>1 December 2026</b></p>'
                     '<div class="btnish sm" style="--kd:%.2fs">Guardian&rsquo;s form, ready</div>' % (at(10, 'branch') + .3), at(10, 'branch', lead=.4), 'front')),
        'wide3'))
    sc.append(split(11,
        eb('Then it&rsquo;s ours') +
        row('check', 'We check every page', at(11, 'check'), '') +
        row('shield', 'Send it to Guardian', at(11, 'send'), '') +
        row('clock', 'And follow it through', at(11, 'follow'), 'until the cover is in place', 'ok') +
        '<div class="note" style="--kd:%.2fs">Or your HR team enrols someone straight from your group page.</div>' % at(11, 'HR'),
        card('c10-form-search.png', d=.3, n=11, w=420, maxh=460, marks=((at(11, 'group'), 'forms'),)),
        'wide2'))
    sc.append(S(12,
        '<div class="mid"><img class="mk" src="%s" alt="">%s<h1>%s</h1>'
        '<div class="flow">%s%s%s</div>'
        '<div class="sub" style="--kd:%.2fs">Group health &amp; life &middot; Ricky Rampersad Branch &middot; Guardian Life of the Caribbean</div>'
        '<div class="url" style="--kd:%.2fs">support@rickyrampersadbranch.com &middot; HELP 868 on WhatsApp</div></div>'
        % (MARK, eb('Joining your plan', .4), kin('Minutes, not weeks.', at(12, 'minutes', lead=.3), hi=('minutes,',)),
           '<div class="fs" style="--kd:%.2fs">One link</div>' % (at(12, 'minutes') + .4),
           '<div class="fs" style="--kd:%.2fs">Guardian&rsquo;s own forms</div>' % at(12, 'branch'),
           '<div class="fs" style="--kd:%.2fs">A journey, not a transaction</div>' % at(12, 'journey'),
           at(12, 'journey') + .6, at(12, 'transaction') + .6),
        'blue'))
    return sc

# ------------------------------------------------------------------------------------- terminations (17 Nov 2026)
def term():
    """The group's own page (groupclientmanagement/client.html) on the made-up group of the walkthrough film: Darnell
       Pierre terminated on Guardian's EB0010, filled from our records (the scratchpad's gcmwalk/make-pdf.js fills the
       real blank the way GroupBilling.gs does), and a pension paid through payroll left. Nothing reached a backend."""
    sc = []
    sc.append(split(1,
        eb('When someone leaves', .3) +
        '<h1>%s</h1>' % kin('Their cover has to come off the plan.', .6, hi=('off',)) +
        '<div class="tabs3">' + chip('The right form', at(1, 'right'), 'tab') + chip('On time', at(1, 'time'), 'tab') + '</div>',
        pdfpage('seb1.png', at(1, 'form', lead=.4), 430, 470, 'Guardian&rsquo;s Group and Individual Policy Change Form &middot; EB0010', n=1,
                marks=((at(1, 'right') + .3, 'removed'),)),
        'wide'))
    sc.append(split(2,
        eb('Your own group page') +
        row('lock', 'Sign in', at(2, 'sign'), 'with your list bill and access code') +
        row('check', 'Everything in one place', at(2, 'group'), '', 'ok'),
        phone('c01-signin.png', d=.3, n=2, marks=((at(2, 'list'), 'listbill'), (at(2, 'code'), 'code')), taps=((at(2, 'code') + .7, 'signin'),)),
        'wide2'))
    sc.append(split(3,
        eb('Your people') +
        row('users', 'Everyone on your plans', at(3, 'everyone'), '') +
        row('clock', 'Who came off this year', at(3, 'came'), 'and when their cover ended') +
        row('alert', 'Anything still pending', at(3, 'pending'), '', 'warn'),
        phone('t01-people-off.png', d=.3, n=3, marks=((at(3, 'came'), 'dropdown'), (at(3, 'came') + .7, 'first-card'))),
        'wide2'))
    sc.append(split(4,
        eb('Guardian&rsquo;s forms') +
        '<div class="tabs3">' + chip('Change or terminate', at(4, 'terminate'), 'tab') + chip('EB0010', at(4, 'terminate') + .3, 'info') + '</div>' +
        row('list', 'Search by name', at(4, 'search'), 'or certificate number'),
        phone('c10-form-search.png', d=.3, n=4, marks=((at(4, 'forms'), 'forms'), (at(4, 'search'), 'search'), (at(4, 'certificate'), 'result1'))),
        'wide2'))
    sc.append(split(5,
        eb('Filled from our records') +
        '<div class="tabs3">' + chip('Policy', at(5, 'policy'), 'ok') + chip('Date of birth', at(5, 'birth'), 'ok') +
        chip('Contact details', at(5, 'contact'), 'ok') + chip('Dependants on record', at(5, 'dependants'), 'ok') + '</div>',
        phone('c10-form.png', d=.3, n=5, marks=((at(5, 'Pick'), 'picked'),), taps=((at(5, 'Pick') - .1, 'picked'),)),
        'wide2'))
    sc.append(split(6,
        eb('You give the date') +
        row('clock', 'The day their cover ends', at(6, 'date'), '') +
        row('list', 'What we don&rsquo;t have', at(6, 'listed'), 'listed for you') +
        '<div class="punch" style="--kd:%.2fs">Never guessed.</div>' % at(6, 'guessed'),
        '<div class="duo">%s%s</div>' % (
            phone('c10-form.png', 'back', .2, n=6, w=200, marks=((at(6, 'date'), 'effective'),)),
            phone('c10b-form-pdf.png', 'front', at(6, 'listed', lead=.5), n=6, marks=((at(6, 'listed') + .2, 'preview-note'),))),
        'wide2'))
    sc.append(S(7,
        '<div style="width:100%">' + eb('Guardian&rsquo;s own form') +
        '<h2>%s</h2>' % kin('Filled in exactly, page by page.', at(7, 'exactly', lead=.4), hi=('exactly,',)) +
        '<div class="pages4">' +
        pdfpage('seb1.png', at(7, 'Guardian', lead=.3), 330, 400, 'Page 1 &middot; who and what changes', n=7, moves=((at(7, 'change'), 'secA', 1.0), (at(7, 'exactly'), 'removed', 1.0)),
                marks=((at(7, 'exactly') + .5, 'removed'),)) +
        pdfpage('seb2.png', at(7, 'page'), 330, 400, 'Page 2 &middot; signed off by your administrator', n=7) +
        '</div></div>', ''))
    sc.append(split(8,
        eb('Sent') +
        row('mail', 'Straight to Guardian&rsquo;s EB Customer Care', at(8, 'straight'), '') +
        row('check', 'Our branch copied', at(8, 'copied'), '', 'ok'),
        phone('t02-term-sent.png', d=.3, n=8, marks=((at(8, 'send') + .2, 'ok'),)),
        'wide2'))
    sc.append(split(9,
        eb('Behind it') +
        row('user', 'A task for your account manager', at(9, 'task'), '') +
        row('clock', 'No reply? We follow it up', at(9, 'reply'), 'every three working days') +
        row('check', 'Until it&rsquo;s done', at(9, 'done'), '', 'ok'),
        '<div class="crm" style="--kd:.3s"><div class="ch"><b>Task &middot; on our records</b><span>Termination &middot; Darnell Pierre</span></div>'
        '<div class="cr" style="--kd:%.2fs"><span>For</span><b>Your account manager</b></div>'
        '<div class="cr" style="--kd:%.2fs"><span>Sent to</span><b>EB Customer Care</b></div>'
        '<div class="cr" style="--kd:%.2fs"><span>Followed up</span><b>Day 3 &middot; day 6 &middot; day 9</b></div>'
        '<div class="cr" style="--kd:%.2fs"><span>Closed</span><b>When Guardian confirms</b></div>'
        '<div class="ai" style="--kd:%.2fs"><i></i>Every follow-up on the record</div>%s</div>'
        % (at(9, 'task'), at(9, 'task') + .3, at(9, 'three'), at(9, 'done'), at(9, 'done') + .4, TAG),
        'wide'))
    sc.append(split(10,
        eb('A pension or a plan from salary') +
        row('shield', 'It belongs to the person', at(10, 'belongs'), 'leaving doesn&rsquo;t end it') +
        row('phone', 'We contact them', at(10, 'contact'), 'about another way to pay') +
        row('check', 'Off your list bill', at(10, 'list'), '', 'ok'),
        '<div class="duo m">%s%s</div>' % (
            phone('c14-pay-leave.png', 'back', .2, n=10, w=200, marks=((at(10, 'pension'), 'leave'), (at(10, 'belongs') + .3, 'result1'))),
            card('c14c-pay-leave-sent-card.png', 'front', at(10, 'contact', lead=.4), n=10, w=300, maxh=470, moves=((at(10, 'contact'), 'ok', 1.0),), marks=((at(10, 'list'), 'ok'),))),
        'wide3'))
    sc.append(S(11,
        '<div class="mid"><img class="mk" src="%s" alt="">%s<h1>%s</h1>'
        '<div class="flow">%s%s%s</div>'
        '<div class="sub" style="--kd:%.2fs">Leavers and changes &middot; Ricky Rampersad Branch &middot; Guardian Life of the Caribbean</div>'
        '<div class="url" style="--kd:%.2fs">support@rickyrampersadbranch.com &middot; HELP 868 on WhatsApp</div></div>'
        % (MARK, eb('When someone leaves', .4), kin('Nothing missed.', at(11, 'missed', lead=.3), hi=('missed.',)),
           '<div class="fs" style="--kd:%.2fs">No paper</div>' % at(11, 'paper'),
           '<div class="fs" style="--kd:%.2fs">No chasing</div>' % at(11, 'chasing'),
           '<div class="fs" style="--kd:%.2fs">Nothing missed</div>' % at(11, 'missed'),
           at(11, 'group') + .2, at(11, 'group') + .5),
        'blue'))
    return sc

PEN_CSS = """
.chip.x{position:relative}
.xs{position:absolute;left:12px;right:12px;top:50%;height:3px;border-radius:2px;background:#D64545;transform:scaleX(0);transform-origin:left;
  animation:sx .4s ease-out forwards;animation-delay:var(--kd)}
.pile{position:relative;width:520px;height:440px}
.paper{position:absolute;left:150px;top:70px;width:220px;height:290px;border-radius:6px;background:#fff;border:1px solid #D3DBE8;
  box-shadow:0 14px 30px rgba(15,42,94,.18);padding:30px 24px;transform:translate(var(--x),var(--y)) rotate(var(--r));
  animation:pin .55s cubic-bezier(.2,1.2,.4,1) both,pout .7s cubic-bezier(.5,0,.8,.4) forwards;animation-delay:var(--kd),var(--ko)}
.paper i{display:block;height:9px;border-radius:4px;background:#E3E9F2;margin-bottom:22px}
.paper i:nth-child(2n){width:70%}.paper i:first-child{background:#C9D6EA;width:60%}
@keyframes pin{from{opacity:0;transform:translate(var(--x),-320px) rotate(calc(var(--r) * 3))}to{opacity:1;transform:translate(var(--x),var(--y)) rotate(var(--r))}}
@keyframes pout{from{opacity:1;transform:translate(var(--x),var(--y)) rotate(var(--r))}to{opacity:0;transform:translate(var(--fx),var(--fy)) rotate(calc(var(--r) * 6))}}
.onelink{position:absolute;left:110px;top:90px;width:300px;padding:30px 24px;border-radius:24px;text-align:center;
  background:linear-gradient(160deg,#1D5BC4,#13408F);color:#fff;box-shadow:0 30px 60px rgba(19,64,143,.4);
  animation:pop .7s cubic-bezier(.2,1.5,.4,1) both;animation-delay:var(--kd)}
.onelink img{width:72px;height:72px;border-radius:16px;display:block;margin:0 auto 14px}
.onelink b{display:block;font-size:40px}.onelink span{display:block;font-size:18px;color:#DCE8FB;margin-top:6px}
.crm{position:relative;width:520px;border-radius:18px;overflow:hidden;background:#fff;border:1px solid #D5DEEA;
  box-shadow:0 26px 54px rgba(15,42,94,.22);animation:ph .8s cubic-bezier(.2,.8,.25,1) both;animation-delay:var(--kd)}
.crm .ch{padding:18px 22px;background:#0B2557;color:#fff}.crm .ch b{display:block;font-size:14px;letter-spacing:2px;text-transform:uppercase;color:#9FC2FF}
.crm .ch span{display:block;font-size:24px;font-weight:600;margin-top:4px}
.crm .cr{display:flex;justify-content:space-between;gap:12px;padding:15px 22px;border-bottom:1px solid #E6EBF2;font-size:17px;
  animation:wup .45s both;animation-delay:var(--kd)}
.crm .cr span{color:#4B586C}.crm .cr b{color:#142033}
.crm .ai{display:flex;align-items:center;gap:12px;margin:16px 22px 22px;padding:14px 16px;border-radius:12px;background:#EBF2FD;color:#13408F;
  font-size:17px;font-weight:600;animation:pop .5s cubic-bezier(.2,1.5,.4,1) both;animation-delay:var(--kd)}
.crm .ai i{width:14px;height:14px;border-radius:50%;background:#1D5BC4;box-shadow:0 0 0 0 rgba(29,91,196,.5);animation:aip 1.4s ease-out infinite}
@keyframes aip{from{box-shadow:0 0 0 0 rgba(29,91,196,.55)}to{box-shadow:0 0 0 16px rgba(29,91,196,0)}}
.duo.m{width:662px;height:500px}
.duo.m>.back{position:absolute;left:0;top:0}
.duo.m>.front{position:absolute;right:0;bottom:0}
.duo.l>.lap{position:absolute}
.wa{width:232px;height:503px;background:#ECE5DD}
.wa .wah{padding:14px 14px 12px;background:#128C7E;color:#fff}
.wa .wah b{display:block;font-size:17px}.wa .wah span{display:block;font-size:11px;color:#D8F3EE}
.wa .wab{padding:14px 10px}
.wa p{max-width:88%;padding:10px 12px;border-radius:12px;font-size:13px;line-height:1.35;margin-bottom:10px;
  box-shadow:0 1px 1px rgba(0,0,0,.08);animation:wup .45s both;animation-delay:var(--kd)}
.wa p.me{margin-left:auto;background:#DCF8C6;color:#142033}
.wa p.it{background:#fff;color:#142033}
.wa p.ref{background:#fff;color:#128C7E;font-weight:600;font-size:12px}
.loop{position:relative;width:420px;height:230px;margin-top:10px;animation:wup .5s both;animation-delay:var(--kd)}
.loop svg{position:absolute;inset:0;width:420px;height:210px}
.loop path{stroke:#1D5BC4;stroke-width:3;fill:none;stroke-dasharray:8 8;animation:dash 1.2s linear infinite}
.loop .ln{position:absolute;padding:10px 14px;border-radius:12px;background:#fff;border:1.5px solid #B8CEF4;font-size:16px;
  box-shadow:0 10px 22px rgba(15,42,94,.1);animation:pop .5s cubic-bezier(.2,1.4,.4,1) both;animation-delay:var(--kd)}
.loop .ln.a{left:0;top:146px}.loop .ln.b{left:135px;top:0}.loop .ln.c{right:0;top:146px;background:#13408F;color:#fff;border-color:#13408F}
.big.c b{font-weight:600}
.pdfc{position:relative;display:inline-block;border-radius:6px;overflow:hidden;background:#fff;border:1px solid #CBD4E3;
  box-shadow:0 22px 44px rgba(15,42,94,.22);animation:ph .7s cubic-bezier(.2,.8,.25,1) both;animation-delay:var(--kd)}
.pdfc .sweep{position:absolute;left:0;right:0;top:0;height:70px;pointer-events:none;
  background:linear-gradient(180deg,rgba(42,111,216,0),rgba(42,111,216,.22),rgba(42,111,216,0));
  animation:swp 1.3s ease-in-out both;animation-delay:var(--kd)}
@keyframes swp{from{transform:translateY(-80px);opacity:1}to{transform:translateY(460px);opacity:0}}
.pdfc .pl{display:block;padding:10px 12px;font-size:15px;font-weight:600;color:#13408F;background:#F3F6FB;border-top:1px solid #E1E7F0;
  animation:wup .4s both;animation-delay:var(--kd)}
.pages4{display:flex;justify-content:center;gap:22px;margin-top:6px}
.fan{position:relative;width:520px;height:470px}
.fp{position:absolute;left:150px;top:30px;width:270px;border-radius:6px;overflow:hidden;background:#fff;border:1px solid #CBD4E3;
  box-shadow:0 18px 40px rgba(15,42,94,.22);transform:translateX(var(--x)) rotate(var(--r));
  animation:fpin .6s cubic-bezier(.2,1.2,.4,1) both;animation-delay:var(--kd)}
.fp img{display:block;width:270px}
@keyframes fpin{from{opacity:0;transform:translate(0,80px) rotate(0)}to{opacity:1;transform:translateX(var(--x)) rotate(var(--r))}}
.pg18{position:absolute;right:0;bottom:6px;padding:14px 18px;border-radius:14px;background:#13408F;color:#fff;font-size:16px;
  box-shadow:0 14px 30px rgba(19,64,143,.35);animation:pop .55s cubic-bezier(.2,1.5,.4,1) both;animation-delay:var(--kd)}
.pg18 b{display:block;font-size:40px;line-height:1}
.copyw{position:relative}
.att{display:flex;align-items:center;gap:12px;margin-top:8px;padding:12px;border:1px solid #DCE3EE;border-radius:12px;background:#F7F9FC;
  animation:wup .45s both;animation-delay:var(--kd)}
.att b{display:grid;place-items:center;width:44px;height:52px;border-radius:6px;background:#D64545;color:#fff;font-size:13px}
.att span{font-size:15px;font-weight:600;color:#142033}.att i{display:block;font-style:normal;font-size:13px;font-weight:500;color:#4B586C}
.stamp.sm{position:absolute;right:-18px;bottom:-26px;font-size:40px;padding:6px 18px;border-width:4px;letter-spacing:4px;background:rgba(255,255,255,.85)}
"""

# ---------------------------------------------------------------------------------------------- the staff film
def staff():
    sc = []
    L1 = dict(w=650, h=406)                 # one laptop screen
    L2 = dict(w=520, h=325)                 # two, overlapped
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
        lap('s03c-preview.png', d=.3, n=4, moves=((at(4, 'six'), 'preview', 1.45), (at(4, 'Friday'), 'approve', 2.0)),
            taps=((at(4, 'Friday') + .7, 'approve'),), **L1), 'wide3'))
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
        row('users', 'Every group still without its letter', at(6, 'names'), '') +
        row('user', 'And who&rsquo;s responsible for it', at(6, 'responsible'), '', 'warn'),
        mailcard('Group letters this week: 7 of 8 out', '1 not out &middot; who is responsible',
                 '<div class="lst"><div><b>Coral Bay Foods Ltd</b><span>not approved &middot; Dana</span></div></div>'
                 '<p class="t" style="margin-top:12px">To every account owner, the Branch Manager&rsquo;s Assistant, the Branch Manager and sales support.</p>',
                 at(6, 'note'))))
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
        lap('s05-steps.png', d=.3, n=9, moves=((at(9, 'eight'), 'strip', 1.55), (at(9, 'finding'), 'panel', 1.35)),
            taps=((at(9, 'Upload'), 'step1'),), marks=((at(9, 'eight') + .5, 'strip'),), **L1), 'wide3'))
    sc.append(split(10,
        eb('The upload does the typing') +
        row('cash', 'The month&rsquo;s billing record, updated to match', at(10, 'record'), 'in Salesforce, field by field', 'ok') +
        row('user', 'A task for everyone who left or changed their cover', at(10, 'left'), 'for the account owner') +
        row('doc', 'One more to query the adjustments', at(10, 'adjustments'), 'with Head Office', 'warn'),
        lap('s06b-salesforce.png', d=.3, n=10, moves=((at(10, 'record'), 'sf-fields', 1.7), (at(10, 'left'), 'sf-tasks', 1.7)),
            marks=((at(10, 'left') + .6, 'sf-tasks'),), **L1), 'wide3'))
    sc.append(split(11,
        eb('Answer, and update') + '<h2>%s</h2>' % kin('One tap. On Chatter, in your name.', at(11, 'Answer')) +
        row('chat', 'Last month&rsquo;s tasks, against this month&rsquo;s bill', at(11, 'update'), '', 'ok'),
        '<div class="duo l">%s%s</div>' % (
            lap('s07-questions.png', 'back', .2, n=11, moves=((at(11, 'tap', lead=.4), 'question', 1.6),), taps=((at(11, 'tap'), 'tap1'),), **L2),
            lap('s08b-update.png', 'front', at(11, 'update', lead=.4), n=11, moves=((at(11, 'update'), 'update', 1.6),),
                taps=((at(11, 'bill'), 'post'),), **L2)),
        'wide3'))
    sc.append(split(12,
        eb('Joiners, leavers and the people') +
        row('doc', 'Guardian&rsquo;s own forms, filled in from Salesforce', at(12, 'forms'), 'chased every three working days', 'ok') +
        row('cake', 'Who&rsquo;s turning sixty-five, or coming of age', at(12, 'sixty'), 'shown at the people step'),
        '<div class="duo l">%s%s</div>' % (
            lap('s09-forms.png', 'back', .2, n=12, taps=((at(12, 'forms'), 'form-eb0010'),), **L2),
            lap('s10b-flags.png', 'front', at(12, 'people', 1, lead=.4), n=12, moves=((at(12, 'sixty'), 'turning-65', 1.8),), **L2)),
        'wide3'))
    sc.append(split(13,
        eb('The statement') + '<h2>%s</h2>' % kin('What&rsquo;s due, and what&rsquo;s still unpaid.', .3) +
        row('tick2', 'Tick reconciled only when you&rsquo;ve checked it yourself', at(13, 'reconciled'), '', 'ok') +
        row('check', 'Then approve it for the billing day', at(13, 'approve'), '', 'ok'),
        '<div class="duo l">%s%s</div>' % (
            lap('s11-statement.png', 'back', .2, n=13, moves=((at(13, 'due'), 'tiles', 1.5),), **L2),
            lap('s12-approve.png', 'front', at(13, 'reconciled', lead=.5), n=13,
                moves=((at(13, 'reconciled'), 'reconciled', 1.9), (at(13, 'approve'), 'approve', 1.9)),
                taps=((at(13, 'reconciled') + .4, 'reconciled'), (at(13, 'approve') + .4, 'approve')), **L2)),
        'wide3'))
    sc.append(split(14,
        eb('The bill&rsquo;s e-mail') + '<h2>%s</h2>' % kin('It greets the contact by name.', .3) +
        stars(at(14, 'rate'), gap=.1) +
        '<div class="callout" style="--kd:%.2fs">Those stars count on <b>your</b> record.</div>' % at(14, 'stars'),
        '<div class="duo l">%s%s</div>' % (
            lap('s12c-email.png', 'back', .2, n=14, moves=((at(14, 'greets'), 'greeting', 2.0),), **L2),
            lap('s12e-stars.png', 'front', at(14, 'rate', lead=.5), n=14, moves=((at(14, 'rate'), 'stars', 1.9),),
                taps=((at(14, 'stars'), 'star5'),), **L2)),
        'wide3'))
    sc.append(split(15,
        eb('Missed the deadline?') + '<h2>%s</h2>' % kin('Give the real reason.', at(15, 'Give')) +
        '<div class="pair">' + chip('On the bill', at(15, 'bill')) + chip('On Chatter', at(15, 'Chatter')) +
        chip('To the Branch Manager', at(15, 'straight')) + '</div>',
        lap('s13-late.png', d=.3, n=15, moves=((at(15, 'why'), 'dialog', 1.3), (at(15, 'Give'), 'reason', 1.8)),
            taps=((at(15, 'straight'), 'send'),), **L1), 'wide3'))
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
        '<div class="duo l">%s%s</div>' % (
            lap('s01b-team-bma.png', 'back', .2, n=17, moves=((at(17, 'chases'), 'meters', 1.6),), **L2),
            lap('s02-hold.png', 'front', at(17, 'hold', lead=.5), n=17, moves=((at(17, 'hold'), 'dialog', 1.4), (at(17, 'reason'), 'reason', 1.9)),
                taps=((at(17, 'Nobody'), 'confirm'),), **L2)),
        'wide3'))
    sc.append(split(18,
        eb('Until we go live') +
        '<div class="stamp" style="--kd:%.2fs">TEST</div>' % at(18, 'test') +
        '<div class="note" style="--kd:%.2fs">Every bill comes to you marked test.</div>' % at(18, 'bill') +
        '<div class="punch" style="--kd:%.2fs">But Salesforce is real. Check before you press.</div>' % at(18, 'Salesforce'),
        lap('s04-door-list.png', d=.3, n=18, moves=((at(18, 'test'), 'test-mode', 2.2),), marks=((at(18, 'test') + .6, 'test-mode'),), **L1),
        'wide3'))
    sc.append(split(19,
        eb('The training programme') + '<h1>%s</h1>' % kin('This is our new way.', at(19, 'This'), hi=('new',)) +
        '<div class="pair">' + chip('Read the programme', at(19, 'Read')) + chip('Take the test', at(19, 'test')) + '</div>',
        lap('s14-training.png', d=.3, n=19, moves=((at(19, 'Read'), 'sections', 1.4), (at(19, 'test'), 'take-test', 2.0)),
            taps=((at(19, 'test') + .6, 'take-test'),), **L1), 'wide3'))
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
.sc.wide3 .split{gap:40px}.sc.wide3 .R{flex:0 0 662px}

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
.duo{position:relative;width:470px;height:520px}
.duo .phone{position:absolute}
.duo .back{left:0;top:0;opacity:.9}
.duo .front{right:0;bottom:0}
.duo .back .vp{filter:saturate(.8)}
.duo.l{width:662px;height:500px}
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
body.port .in{padding:96px 44px 420px;align-items:flex-start}
body.port .mid{margin-top:120px}
body.port .split{flex-direction:column;gap:26px;align-items:stretch}
body.port .split .R,body.port .sc.wide .R,body.port .sc.wide2 .R{flex:none}
body.port h1{font-size:50px}body.port h2{font-size:36px}
body.port .phone{zoom:.92}
body.port .duo{width:470px;height:520px;margin:0 auto;zoom:.92}
body.port .cardshot{zoom:.9}
body.port .mail{width:560px}
body.port .net{transform:scale(.72);transform-origin:top center;width:900px;margin-left:-134px}
body.port .clock{font-size:76px}body.port .big{font-size:110px}
"""

# ------------------------------------------------------------------- a year with your group, for employers (27 Nov 2026)
def employers():
    """Asked for on 27 Nov 2026 as one film for employers: what we do every week, every month and at renewal, the
       enrolment, the leavers, Guardian's easiConnect for their employees, the work behind it, and HELP 868. Fifteen
       lines. The screens are the redesigned group page and the new staff Home on an invented branch (gcmshots-emp);
       the easiConnect screen is Guardian's real sign-in page, with no member on it. In the branch teal."""
    sc = []
    def plain(name, d, w=520):
        iw, ih = _size(name)
        return ('<div class="lap" style="--kd:%.2fs"><div class="bar3"><i></i><i></i><i></i></div>'
                '<div class="vp" style="width:%dpx;height:%dpx"><img src="%s" alt="" style="width:%dpx"></div></div>'
                % (d, w, round(w * ih / iw), img(name), w))
    # 1 the title
    sc.append(S(1,
        '<div class="mid"><img class="mk" src="%s" alt="">%s<h1>%s</h1>'
        '<div class="sub" style="--kd:%.2fs">Group Life &middot; Group Health &middot; Pension &middot; all of it digital</div></div>'
        % (MARK, eb('Ricky Rampersad Branch &middot; Guardian Life of the Caribbean', .4), kin('A year with your group', .7, hi=('group',)), at(1, 'digital')),
        'blue title'))
    # 2 the usual way
    sc.append(S(2,
        '<div class="mid">' + eb('The usual way', .15) +
        '<h2>%s</h2>' % kin('Paper, phone calls and long e-mail chains.', .3) +
        '<div class="olds">' +
        ''.join('<div class="old" style="--kd:%.2fs"><b>%s</b><span>%s</span><s style="--kd:%.2fs"></s></div>' % (d, ICON[i], t, d + .5)
                for d, i, t in ((at(2, 'paper'), 'doc', 'Forms printed, signed and scanned'),
                                (at(2, 'phone'), 'phone', '&ldquo;Where is it?&rdquo; on the phone'),
                                (at(2, 'chains'), 'mail', 'The same question, e-mailed three times'))) +
        '</div><div class="strike" style="--kd:%.2fs">You ask, and then <b class="waitw" style="--kd:%.2fs">you wait.</b></div></div>' % (at(2, 'ask'), at(2, 'wait')),
        'old2'))
    # 3 our way
    sc.append(split(3,
        eb('Our way') +
        '<h2>%s</h2>' % kin('One system, built in our branch.', at(3, 'Everything'), hi=('one', 'system,')) +
        row('list', 'Everything we do for your group', at(3, 'system'), 'in one place, as it happens', 'ok') +
        row('user', 'A real person behind every step', at(3, 'real'), 'with a name you know', 'ok'),
        lap('l01-home.png', d=.3, n=3, moves=((at(3, 'system'), 'needs', 1.25),), marks=((at(3, 'step'), 'needs'),)),
        'wide'))
    # 4 joining
    sc.append(split(4,
        eb('Someone joins') +
        row('phone', 'Their own link', at(4, 'link'), 'they fill in their part on their phone') +
        row('check', 'You check it and approve it', at(4, 'approve'), '', 'ok') +
        row('doc', 'Guardian&rsquo;s own form, already filled in', at(4, 'form'), 'and sent to Guardian Life', 'ok'),
        '<div class="duo">%s%s</div>' % (
            phone('p03-details.png', 'back', .2, n=4, w=200, marks=((at(4, 'fill'), 'name'),)),
            phone('s08-gio.png', 'front', at(4, 'approve', lead=.4), n=4, moves=((at(4, 'form'), 'secA', 1.3),), marks=((at(4, 'filled'), 'secA'),))),
        'wide2'))
    # 5 every week
    sc.append(split(5,
        eb('Every week') +
        '<div class="clock" style="--kd:%.2fs">Monday<span>10:30, one short report by e-mail</span></div>' % at(5, 'Monday') +
        row('check', 'What we finished', at(5, 'finished'), '', 'ok') +
        row('clock', 'What&rsquo;s still open, and who has it', at(5, 'open')) +
        row('alert', 'What we need from you', at(5, 'need'), 'answered on your own page', 'warn'),
        mailcard('Your weekly service report', 'Harbour Point Logistics Ltd &middot; Monday 23 November',
                 '<p>Good morning, Pat. Here is where everything we are doing for your group stands.</p>'
                 '<div class="cnts"><div><b class="cnt" data-to="6" data-at="%d">6</b><span>finished</span></div>'
                 '<div><b class="cnt" data-to="4" data-at="%d">4</b><span>still open</span></div>'
                 '<div class="w"><b class="cnt" data-to="2" data-at="%d">2</b><span>need you</span></div></div>'
                 '<div class="btnish sm">Open your service page</div>'
                 % (at(5, 'finished') * 1000, at(5, 'open') * 1000, at(5, 'need') * 1000), .5)))
    # 6 pending, at the top
    sc.append(split(6,
        eb('What&rsquo;s pending') +
        row('clock', 'Applications and increases', at(6, 'Applications'), 'Group Life, Group Health and Pension') +
        row('alert', 'How many days each has been open', at(6, 'days'), 'past our target, in red', 'warn') +
        row('users', 'Who it&rsquo;s waiting on', at(6, 'waiting'), 'Guardian Life, the employee, or you'),
        phone('e04b-pending-cards.png', d=.3, n=6, moves=((at(6, 'days'), 'pend', 1.12),), marks=((at(6, 'waiting'), 'pend'),)),
        'ph'))
    # 7 answer and rate
    sc.append(split(7,
        eb('Your say') +
        '<div class="tabs3">' + chip('Correct', at(7, 'answer'), 'ok') + chip('Needs a change', at(7, 'answer') + .3, 'tab') +
        chip('Not ours', at(7, 'answer') + .6, 'tab') + '</div>' + stars(at(7, 'star')) +
        '<div class="note big2" style="--kd:%.2fs">A real person reads every answer.</div>' % at(7, 'real'),
        '<div class="duo">%s%s</div>' % (
            phone('e02b-item-answer.png', 'back', .2, n=7, w=200, marks=((at(7, 'answer'), 'choices'),)),
            phone('e03-rate.png', 'front', at(7, 'give', lead=.4), n=7, taps=((at(7, 'star'), 'star5'),))),
        'wide2'))
    # 8 every month
    sc.append(split(8,
        eb('Every month') +
        '<div class="days2"><div style="--kd:%.2fs"><b>25<sup>th</sup></b><span>your bills reach us, and we check every line against our records</span></div>'
        '<div style="--kd:%.2fs"><b>26<sup>th</sup></b><span>you get one clear statement of what&rsquo;s due</span></div></div>' % (at(8, 'check'), at(8, 'statement')),
        phone('e07b-statement.png', d=.3, n=8, moves=((at(8, 'statement'), 'tiles', 1.25),), marks=((at(8, 'statement') + .4, 'tiles'),)),
        'ph'))
    # 9 your people
    sc.append(split(9,
        eb('Your people') +
        row('users', 'Who&rsquo;s on your plans', at(9, 'plans')) +
        row('user', 'Who came off this year', at(9, 'came')) +
        row('cake', 'Turning sixty-five', at(9, 'sixty'), 'the group cover ends: we help them convert') +
        row('grad', 'A child coming of age', at(9, 'child'), 'and moving off the family plan'),
        '<div class="duo">%s%s</div>' % (
            phone('e06-people.png', 'back', .2, n=9, w=200, marks=((at(9, 'plans'), 'seg'),)),
            phone('e05-coming.png', 'front', at(9, 'coming', lead=.4), n=9)),
        'wide2'))
    # 10 someone leaves
    sc.append(split(10,
        eb('Someone leaves') +
        row('users', 'Search their name', at(10, 'search'), 'everyone on your plan, from our records') +
        row('doc', 'Guardian&rsquo;s change form fills itself in', at(10, 'fills'), '', 'ok') +
        row('check', 'We follow it through until it&rsquo;s done', at(10, 'follow'), 'chased every three working days', 'ok'),
        '<div class="duo">%s%s</div>' % (
            phone('c10-form-search.png', 'back', .2, n=10, w=200, taps=((at(10, 'search') + .3, 'result1'),)),
            phone('c10b-form-pdf.png', 'front', at(10, 'form', lead=.5), n=10, moves=((at(10, 'fills'), 'pdf-page1', 1.15),))),
        'wide2'))
    # 11 easiConnect, for their employees
    sc.append(split(11,
        eb('For your employees') +
        '<h2>%s</h2>' % kin('Guardian&rsquo;s own health portal.', at(11, 'portal')) +
        row('list', 'Their claims', at(11, 'claims'), 'what was paid, and what&rsquo;s still in progress') +
        row('shield', 'Their cover', at(11, 'cover')) +
        row('mail', 'A request to Guardian', at(11, 'request'), 'straight from the portal') +
        '<div class="note" style="--kd:%.2fs">easiconnect.myguardiangroup.com</div>' % at(11, 'sign'),
        '<div class="easi">%s<div class="cap" style="--kd:%.2fs">Guardian&rsquo;s easiConnect sign-in page</div></div>' % (plain('x01-easi-signin.png', .3), at(11, 'Easy')),
        'wide'))
    # 12 renewal
    steps = (('We start early', 'well before the renewal date', at(12, 'early')),
             ('Your updated staff list', 'so the terms are priced on today&rsquo;s people', at(12, 'staff')),
             ('Guardian&rsquo;s renewal terms', 'in good time, in plain words', at(12, 'terms')),
             ('Anyone leaving the plan', 'helped to a plan of their own', at(12, 'leaving')))
    sc.append(S(12,
        '<div class="mid">' + eb('At renewal', .15) + '<h2>%s</h2>' % kin('No surprises at renewal time.', .3, hi=('no', 'surprises')) +
        '<div class="four">' + ''.join('<div class="pt" style="--kd:%.2fs"><i>%d</i><b>%s</b><span>%s</span></div>' % (d, k + 1, t, u)
                                       for k, (t, u, d) in enumerate(steps)) + '</div></div>',
        'ren'))
    # 13 behind it all
    sc.append(split(13,
        eb('Behind it all') +
        row('tick2', 'Every request is a task with a name on it', at(13, 'task'), '', 'ok') +
        row('list', 'Our branch sees what&rsquo;s moving, and what isn&rsquo;t', at(13, 'moving')) +
        '<div class="punch" style="--kd:%.2fs">You never have to chase us.</div>' % at(13, 'never'),
        lap('l04-staff-home.png', d=.3, n=13),
        'wide'))
    # 14 HELP 868
    sc.append(split(14,
        eb('Rather send a message?') +
        '<div class="h868" style="--kd:%.2fs"><b>%s</b><div>HELP 868<span>on WhatsApp &middot; +1 868 435 7868</span></div></div>' % (at(14, 'Help'), ICON['chat']) +
        row('check', 'Connected to our system', at(14, 'connected'), 'your message reaches the right person', 'ok'),
        phone('e09-help.png', d=.3, n=14, marks=((at(14, 'WhatsApp'), 'wa'),)),
        'ph'))
    # 15 the close
    sc.append(S(15,
        '<div class="mid"><img class="mk sm" src="%s" alt="">'
        '<h1>%s</h1>'
        '<div class="sub" style="--kd:%.2fs">Your group, looked after by people who know your name.</div>'
        '<div class="call" style="--kd:%.2fs">%s<b>HELP 868 on WhatsApp</b></div>'
        '<div class="url" style="--kd:%.2fs">rickyrampersadbranch.com</div></div>'
        % (MARK, kin('We don&rsquo;t wait for what&rsquo;s coming. We make it happen.', at(15, 'Because', lead=.3), hi=('make', 'it', 'happen.')),
           at(15, 'looked'), at(15, 'people'), ICON['chat'], at(15, 'name')),
        'blue close'))
    return sc

EMP_CSS = """
.olds{display:flex;gap:18px;justify-content:center;margin:26px 0 6px}
.old{position:relative;width:300px;padding:20px 18px;border-radius:16px;background:#fff;border:1px solid #DCE3EE;text-align:left;
  box-shadow:0 14px 30px rgba(15,42,94,.1);animation:wup .5s both;animation-delay:var(--kd)}
.old b{display:grid;place-items:center;width:42px;height:42px;border-radius:11px;background:#FCEDEA;color:#B4372B;margin-bottom:10px}
.old b svg{width:24px;height:24px}
.old span{display:block;font-size:19px;line-height:1.3;color:#142033}
.old s{position:absolute;left:14px;right:14px;top:50%;height:3px;background:#B4372B;border-radius:2px;transform:scaleX(0);transform-origin:left;
  animation:sx .45s cubic-bezier(.6,0,.2,1) both;animation-delay:var(--kd)}
@keyframes sx{to{transform:scaleX(1)}}
.days2{display:grid;gap:16px;margin-top:6px}
.days2 div{display:flex;gap:18px;align-items:center;padding:18px 20px;border-radius:16px;background:#fff;border:1px solid #DCE3EE;
  box-shadow:0 14px 30px rgba(15,42,94,.1);animation:wup .5s both;animation-delay:var(--kd)}
.days2 b{font-size:58px;font-weight:600;color:#13408F;line-height:1;min-width:120px;letter-spacing:-2px}
.days2 sup{font-size:22px;letter-spacing:0}
.days2 span{font-size:20px;line-height:1.35;color:#142033}
.easi{display:flex;flex-direction:column;align-items:center;gap:12px}
.easi .cap{font-size:15px;color:#4B586C;animation:wup .5s both;animation-delay:var(--kd)}
.h868{display:flex;gap:16px;align-items:center;margin:8px 0 18px;animation:pop .6s cubic-bezier(.2,1.4,.4,1) both;animation-delay:var(--kd)}
.h868 b{display:grid;place-items:center;width:74px;height:74px;border-radius:20px;background:#1FA463;color:#fff}
.h868 b svg{width:38px;height:38px}
.h868 div{font-size:52px;font-weight:600;color:#13408F;line-height:1;letter-spacing:-1px}
.h868 span{display:block;font-size:19px;font-weight:500;color:#4B586C;letter-spacing:0;margin-top:8px}
.sc.ren .four{margin-top:26px}
.waitw{color:#B4372B;font-weight:600;display:inline-block;animation:wup .5s both;animation-delay:var(--kd)}
"""

TEAL = (('#0F2A5E', '#0A3350'), ('#13408F', '#0A4A52'), ('#1D5BC4', '#00728D'), ('#2A6FD8', '#0E93B0'), ('#EBF2FD', '#E3F3F5'),
        ('#DCE8FB', '#DDF0F2'), ('#BFD3F7', '#BFE6EC'), ('#FFD36B', '#9FE7F2'), ('rgba(15,42,94', 'rgba(10,51,80'),
        ('rgba(19,64,143', 'rgba(10,74,82'), ('rgba(29,91,196', 'rgba(0,114,141'), ('rgba(42,111,216', 'rgba(14,147,176'))
def teal(t):
    """The employers film is in the branch teal (the group look since 26 Nov 2026); the other films keep their blue."""
    if FILM != 'employers':
        return t
    for a, b in TEAL:
        t = t.replace(a, b).replace(a.lower(), b)
    return t

def main():
    sc = {'client': client, 'walk': walk, 'staff': staff, 'pension': pension, 'henr': henr, 'term': term, 'employers': employers}[FILM]()
    if len(sc) != N_LINES:
        sys.exit('SCENES: %d scenes for %d lines' % (len(sc), N_LINES))
    title = {'client': 'Our new way of looking after your group', 'staff': 'Group client management, the new way', 'walk': 'What you see when you sign in',
             'pension': 'Company pensions, without the paperwork', 'henr': 'Joining your group health plan',
             'term': 'When someone leaves your plan', 'employers': 'A year with your group'}[FILM]
    page = ('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex">'
            '<title>%s</title><style>' % title + teal((CSS + PEN_CSS + EMP_CSS).replace('__PLEX__', PLEX)) + '</style></head><body>'
            '<div id="stage" style="--total:%dms"><div class="dots grain"></div><div class="glow g1"></div><div class="glow g2"></div><i id="prog" class="grain"></i>' % sum(DURS)
            + teal('\n'.join(sc)) + '</div><div id="strip"></div><style>' + ''.join(EXTRA) + '</style>'
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
    for m in re.finditer(r'([^{}]+)\{', CSS + PEN_CSS + EMP_CSS):
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
