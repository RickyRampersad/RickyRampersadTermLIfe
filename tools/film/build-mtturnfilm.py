#!/usr/bin/env python3
"""Reset and rise, the turn (2 November 2026).

Ricky, 8:51am: "make more compact, more encouraging ... a typical day. They see us, we see them, everyone is
accountable. Show not a coach on screen whole day, but proactive, us calling to understand what's going on ...
show the screens what Rajiv was logging, how it's working for him, where Rajiv is, and we'd want everybody to get
up to those levels. Let us mean what we said as we listened to everyone closely on Friday ... October is already
done. Our financial year has started, and let's really make that turn. So much more impactful, much more motions,
much more scaling, much more graphics."

THE ARC: October closes and November 1st flips up in gold; the room that spoke on Friday, heard; a day (check in,
the goal ring fills); both ways (you see us working for your clients, we see your day); we call when something
stalls; Rajiv's own screen (his update to Sasha in his own words, his 5 of 5, seven applications picked up in
October: his Salesforce record); the level, and every one of us rising to it; check in, lift each other, rise.

Rajiv's figure is his own, applications not money, and he is the only person named. No client, nobody ranked.

THE PHONE CUT (resetrise/turn-phone.mp4, 1080x1920): the wide film's stage (crop 1280x616) at 1080x520 over a blurred
copy of itself, with captions-mtturn.ass restyled at 1080x1920 (DejaVu Sans Bold 50, top-aligned under the picture)
plus "RESET AND RISE / The turn" above and the branch line below. Poster at 2.4s.
"""
import base64, json, pathlib, re, sys

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent.parent
OUT = ROOT / 'resetrise' / 'turn.html'
TIMING = HERE / 'mtturn-timing.json'


def b64(p, mime):
    return 'data:%s;base64,%s' % (mime, base64.b64encode(pathlib.Path(p).read_bytes()).decode())


MARK = b64(ROOT / 'orphan-transition' / 'board-mark.png', 'image/png')
PLEX = b64(HERE / 'fonts' / 'IBMPlexSans-latin.woff2', 'font/woff2')

T = json.loads(TIMING.read_text()) if TIMING.exists() else {}
DURS = [int(round(d * 1000)) for d in (T.get('durs') or [4.5] * 8)]
WORDS = [l.get('words', []) for l in T.get('lines', [])]


def at(n, word, k=0):
    """The second a spoken word begins. 0.4s is the mixer's lead on the voice."""
    try:
        ws = WORDS[n - 1]
    except Exception:
        return 1.0
    want = re.sub(r'[^a-z]', '', word.lower())
    hits = [w for w in ws if re.sub(r'[^a-z]', '', str(w[1]).lower()) == want]
    return round(float(hits[k][0]) + 0.4, 2) if len(hits) > k else 1.0


def motes(n, seed):
    out = []
    for i in range(14):
        x = (seed * 37 + i * 71) % 100; y = (seed * 53 + i * 29) % 100; s = 3 + (i * 7 + seed) % 5
        out.append('<i style="left:%d%%;top:%d%%;width:%dpx;height:%dpx;--md:%.1fs"></i>' % (x, y, s, s, (i % 5) * .3))
    return '<div class="motes">%s</div>' % ''.join(out)


def S(n, body, cls=''):
    return ('<section class="sc %s" data-d="%d"><div class="in"><div class="cam">%s</div>%s</div></section>'
            % (cls, DURS[n - 1], body, motes(14, n)))


def kin(text, d=0.0, step=0.06):
    """Word by word, never letter by letter."""
    return ' '.join('<span class="kw" style="--kd:%.2fs">%s</span>' % (d + i * step, w)
                    for i, w in enumerate(text.split(' ')))


def people(n, d=0.0, step=0.035):
    """One silhouette per person still here. Neutral: the branch's own record
       does not carry everybody's sex, and this grid claims nothing."""
    out = []
    for i in range(n):
        out.append(
            '<svg class="pp" viewBox="0 0 24 27" style="--kd:%.2fs" aria-hidden="true">'
            '<circle cx="12" cy="7" r="5.2"/>'
            '<path d="M2.4 26.5a9.6 9.6 0 0 1 19.2 0z"/></svg>' % (d + i * step))
    return '<div class="crowd">%s</div>' % ''.join(out)


def phone(inner, cls=''):
    return '<div class="ph %s"><div class="phs">%s</div></div>' % (cls, inner)


def people(n, d, step=.03, centre=None, cls='pp'):
    c = centre if centre is not None else n // 2
    return ''.join('<svg class="%s" viewBox="0 0 24 27" style="--kd:%.2fs" aria-hidden="true"><circle cx="12" cy="7" r="5.2"/>'
                   '<path d="M2.4 26.5a9.6 9.6 0 0 1 19.2 0z"/></svg>' % (cls, d + abs(i - c) * step) for i in range(n))


STEPS = [('8:00', 'Morning'), ('10:30', 'Check in'), ('12:00', 'Midday'), ('5:30', 'Close off')]


def day(cur, kd, you, us):
    """The day's four circles across the top, then the agent's card and ours, joined live."""
    f0, f1 = max(cur - 1, 0) / 3.0, cur / 3.0
    st = ''.join('<div class="dst %s" style="--kd:%.2fs"><i>%s</i><b>%s</b><small>%s</small></div>'
                 % ('done' if i < cur else ('now' if i == cur else ''), kd + (.25 if i == cur else 0),
                    '&#10003;' if i < cur else str(i + 1), t, l) for i, (t, l) in enumerate(STEPS))
    return ('<div class="dayw"><div class="trk"><span class="tf" style="--f0:%.3f;--f1:%.3f;--kd:%.2fs"></span>%s</div>'
            '<div class="duo"><div class="you" style="--kd:%.2fs">%s</div>'
            '<div class="link"><i style="--kd:%.2fs"></i><i class="b2" style="--kd:%.2fs"></i><i style="--kd:%.2fs"></i></div>'
            '<div class="us" style="--kd:%.2fs">%s</div></div></div>'
            % (f0, f1, kd + .1, st, kd + .15, you, kd + .6, kd + 1.3, kd + 2.0, kd + .45, us))


def mring(pct, kd):
    return ('<div class="mr"><svg class="ring mini" viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="48" class="rt"/>'
            '<circle cx="60" cy="60" r="48" class="rf5" style="--to:%d;--kd:%.2fs"/></svg>'
            '<div class="mrt"><b class="cnt" data-to="%d" data-suf="%%" data-at="%d">%d%%</b><small>of November</small></div></div>'
            % (round(302 * (1 - pct / 100.0)), kd, pct, int(kd * 1000), pct))


def yrow(n, label, kd, cls=''):
    return '<div class="yrow" style="--kd:%.2fs"><b class="%s">%s</b><span>%s</span></div>' % (kd, cls, n, label)


def urow(who, what, kd, done):
    return ('<div class="urow" style="--kd:%.2fs"><b>%s</b><span>%s</span>%s</div>'
            % (kd, who, what, '<s style="--kd:%.2fs">&#10003;</s>' % (kd + .5) if done else '<s class="wip"></s>'))


def callr(av, who, sub, kd):
    return ('<div class="callr" style="--kd:%.2fs"><div class="av2"><i></i><i></i>%s</div><div><b>%s</b><small>%s</small></div></div>'
            % (kd, av, who, sub))


def bar(label, done, plan, kd):
    return ('<div class="br"><div><span>%s</span><b>%d of %d</b></div><p><i style="--w:%d%%;--kd:%.2fs"></i></p></div>'
            % (label, done, plan, round(100.0 * done / plan), kd))


def mailrow(tm, subj, sub, kd, cls=''):
    """One reminder as it lands: when, its real subject line, and what it carries."""
    return ('<div class="ml %s" style="--kd:%.2fs"><span class="mt">%s</span><div><b>%s</b><small>%s</small></div></div>'
            % (cls, kd, tm, subj, sub))


def stars(kd, n=5, step=.12):
    return '<span class="st5">%s</span>' % ''.join('<i style="--kd:%.2fs">&#9733;</i>' % (kd + k * step) for k in range(n))


def stat(big, label, kd, suf='', cls=''):
    """A count that rolls up when it is said."""
    sep = ' data-sep="1"' if int(big) >= 1000 else ''
    return ('<div class="stt %s" style="--kd:%.2fs"><b class="cnt" data-to="%s" data-suf="%s" data-at="%d"%s>%s%s</b><span>%s</span></div>'
            % (cls, kd - .15, big, suf, int(kd * 1000), sep, '{:,}'.format(int(big)), suf, label))


def dotfield(t0, t1, t2, n=1781, lit=665, gold=262, cols=59):
    """1,781 clients written to, one dot each (Transition Send, 25 Sep to 1 Oct 2026). 665 answered (Client Responses,
       test tokens left out); 262 of them asked us to call. Which dots light is a fixed shuffle: no dot is a client."""
    import random
    rnd = random.Random(26000)
    order = list(range(n)); rnd.shuffle(order)
    ans = order[:lit]; calls = set(ans[:gold]); ans_rank = {d: i for i, d in enumerate(ans)}
    call_rank = {d: i for i, d in enumerate(ans[:gold])}
    out = []
    for i in range(n):
        r, c = divmod(i, cols)
        a = t0 + (c + r * .6) / (cols + 30 * .6) * 1.0
        inner = ''
        if i in ans_rank:
            inner += '<b style="--b:%.2fs"></b>' % (t1 + ans_rank[i] / lit * 1.6)
        if i in calls:
            inner += '<u style="--c:%.2fs"></u>' % (t2 + call_rank[i] / gold * 1.2)
        out.append('<i style="--a:%.2fs">%s</i>' % (a, inner))
    return ''.join(out)


def kn(k, v, kd):
    return '<div class="kn" style="--kd:%.2fs"><b>%s</b><span>%s</span><s>&#10003;</s></div>' % (kd, k, v)


def jstop(day, label, icon, kd, cls=''):
    return ('<div class="jsp %s" style="--kd:%.2fs"><i>%s</i><b>%s</b><span>%s</span></div>' % (cls, kd, icon, day, label))


def build():
    sc = []
    # 1 October done, November the turn
    sc.append(S(1,
        '<div class="mid"><div class="cal">'
        '<div class="pg oct" style="--kd:%.2fs"><em>October</em><b>31</b><s>done</s></div>'
        '<div class="pg nov" style="--kd:%.2fs"><em>November</em><b>1</b><s>the turn</s></div></div>'
        '<div class="flare" style="--kd:%.2fs"></div><h1 class="rise">%s</h1></div>'
        % (at(1, 'October'), at(1, 'November'), at(1, 'turn'), kin('The turn starts now.', at(1, 'turn'), .1)),
        'hit'))
    # 2 we listened, now we mean it
    bub = ''.join('<span class="bub" style="--kd:%.2fs"></span>' % (at(2, 'listened') + k * .07) for k in range(26))
    sc.append(S(2,
        '<div class="mid"><div class="eyebrow" style="--kd:.15s">Friday 30 October</div>'
        '<div class="room">%s<div class="bubs">%s</div></div><h1 class="shout">%s</h1></div>'
        % (people(26, .2, .02), bub, kin('We listened. Now we mean it.', at(2, 'listened'), .1)),
        'heard'))
    # 3-6 the day, from both sides: YOU large (the agent), US beside it, a live link between them
    sc.append(S(3, day(0, at(3, 'Here'),
        '<em>You</em><h3>%s</h3><div class="yg">%s<div class="yl">%s%s%s%s</div></div>'
        % (kin('Your goal, first.', at(3, 'sides') - .2, .08), mring(41, at(3, 'Eight')),
           yrow('2', 'Fact finds this week', at(3, 'fact') - .2), yrow('3', 'Orphan clients to call', at(3, 'clients') - .2),
           yrow('1', 'Case that should settle', at(3, 'clients') + .3, 'g'), yrow('6', 'Calls for today', at(3, 'clients') + .6)),
        '<em>Us</em><h3>Already on your cases</h3>%s%s%s'
        % (urow('Sasha', 'chasing a pending', at(3, 'clients') - .4, True), urow('Elizabeth', 'documents in', at(3, 'team'), True),
           urow('Azariah', 'underwriting follow-up', at(3, 'chasing'), False))), 'd1'))
    sc.append(S(4, day(1, .2,
        '<em>You</em><h3>%s</h3><div class="btn2" style="--kd:%.2fs">Check in and plan my day</div>'
        '<div class="pres2" style="--kd:%.2fs">Present &#10003;</div>'
        '<div class="plan" style="--kd:%.2fs"><b>Plan</b> 6 calls &middot; 2 fact finds &middot; 1 to settle</div><div class="wk">%s</div>'
        % (kin('Check in. You are present.', at(4, 'check'), .08), at(4, 'check'), at(4, 'present'), at(4, 'present') + .3,
           ''.join('<span class="%s" style="--kd:%.2fs">%s</span>' % (c, at(4, 'present') + .4 + k * .1, d)
                   for k, (d, c) in enumerate([('Mon', 'on'), ('Tue', 'on'), ('Wed', 'on'), ('Thu', 'on'), ('Fri', 'td')]))),
        '<em>Us</em><h3>We see you</h3><div class="pres3" style="--kd:%.2fs">Present &middot; 8:12am &#10003;</div>'
        '<div class="ifn" style="--kd:%.2fs">Not checked in?</div>%s'
        % (at(4, 'present'), at(4, 'Not'), callr('M', 'We call you', 'to understand', at(4, 'call')))), 'd2'))
    sc.append(S(5, day(2, .2,
        '<em>You</em><h3>%s</h3><div class="ch2"><span style="--kd:%.2fs">Going well</span><span class="hl" style="--kd:%.2fs">Need help</span></div>'
        '<div class="typed" style="--kd:%.2fs"><em>Your note &middot; 12:04pm</em>Waiting on a client&rsquo;s medical. Can you push it?</div>'
        % (kin('How is it going?', at(5, 'noon'), .08), at(5, 'going'), at(5, 'Need'), at(5, 'Need') + .7),
        '<em>Us</em><h3>Straight to your manager</h3>'
        '<div class="ntf" style="--kd:%.2fs"><em>Need help &middot; 12:04pm</em><b>A client&rsquo;s medical is outstanding</b></div>%s'
        % (at(5, 'manager'), callr('M', 'Your manager', 'calling you&hellip;', at(5, 'straight')))), 'd3'))
    sc.append(S(6, day(3, .2,
        '<em>You</em><h3>%s</h3><div class="yc"><div class="bars">%s%s%s</div>'
        '<div class="donep" style="--kd:%.2fs"><b class="cnt" data-to="89" data-suf="%%" data-at="%d">89%%</b><span>of your plan,<br>done</span></div></div>'
        % (kin('Close off. Planned, and done.', at(6, 'close'), .08),
           bar('Calls', 5, 6, at(6, 'planned')), bar('Fact finds', 2, 2, at(6, 'planned') + .25), bar('Cases settled', 1, 1, at(6, 'planned') + .5),
           at(6, 'did'), int(at(6, 'did') * 1000)),
        '<em>Us</em><h3>%s</h3>%s%s'
        % (kin('We see it too', at(6, 'see'), .08), urow('Close-off', 'received 5:31pm', at(6, 'see'), True),
           urow('Your manager', 'sees your day', at(6, 'see') + .35, True))), 'd4'))
    # 7 both ways: everyone accountable
    sc.append(S(7,
        '<div class="mid"><div class="both">'
        '<div class="side L2" style="--kd:%.2fs"><em>You see us</em>'
        '<div class="ln2" style="--kd:%.2fs"><b>Sasha</b> closed it &middot; client called</div>'
        '<div class="ln2" style="--kd:%.2fs"><b>Elizabeth</b> on it today</div>'
        '<div class="ln2" style="--kd:%.2fs"><b>Azariah</b> documents in</div></div>'
        '<div class="arrows" style="--kd:%.2fs"><i></i><i></i></div>'
        '<div class="side R2" style="--kd:%.2fs"><em>We see you</em>'
        '<div class="ln2" style="--kd:%.2fs"><b>Present</b> 8:12am</div>'
        '<div class="ln2" style="--kd:%.2fs"><b>Midday</b> help asked, called</div>'
        '<div class="ln2" style="--kd:%.2fs"><b>Close-off</b> 89%% of the plan</div></div></div>'
        '<h1 class="go sm">%s</h1></div>'
        % (at(7, 'You'), at(7, 'You') + .2, at(7, 'You') + .4, at(7, 'You') + .6, at(7, 'We'), at(7, 'We'),
           at(7, 'We') + .2, at(7, 'We') + .4, at(7, 'We') + .6, kin('Everyone is accountable.', at(7, 'Everyone'), .1)),
        'both2'))
    # 8 every reminder on a template: yours, and your clients'
    sc.append(S(8,
        '<div class="rem"><div class="inbx" style="--kd:.15s"><em>You &middot; your reminders</em>%s%s%s%s</div>'
        '<div class="cmail" style="--kd:%.2fs"><div class="cmh"><small>To your client</small><b>Your request is complete</b></div>'
        '<div class="cmb"><p>Dear [first name],</p><p>We have now taken care of your request. Thank you for giving us the chance to help.</p>'
        '<p class="ask">How did we do? Tap a star.</p>%s</div>'
        '<div class="chips3"><span style="--kd:%.2fs">A question about your first year with us</span>'
        '<span style="--kd:%.2fs">Thank you. We have received your response.</span><span style="--kd:%.2fs">Still on it.</span></div></div></div>'
        % (mailrow('8:00am', 'Your day &middot; good morning', 'Your goal, your fact finds, your clients', at(8, 'morning')),
           mailrow('12 noon', 'Midday progress', 'How is it going? Going well, or need help', at(8, 'midday')),
           mailrow('5:30pm', 'Close off your day', 'What you planned, and what you did', at(8, 'close-off')),
           mailrow('Closed', 'Done: your case &middot; how did we do?', stars(at(8, 'star') + .1), at(8, 'star'), 'hot'),
           at(8, 'clients') - .3, stars(at(8, 'clients') + .5, step=.14),
           at(8, 'too') - .2, at(8, 'too'), at(8, 'too') + .2),
        'tpl'))
    # 9 and they answer: every client written to, a dot each; the answers light up; the calls asked for, in gold
    sc.append(S(9,
        '<div class="rem"><div class="dotw"><div class="dots">%s</div><div class="dkey"><span class="k1">Answered</span><span class="k2">Asked us to call</span></div></div>'
        '<div class="stts">%s%s%s<div class="bigwin" style="--kd:%.2fs">That is the big win.</div></div></div>'
        % (dotfield(at(9, 'written'), at(9, 'answered'), at(9, 'call')),
           stat('1781', 'clients written to', at(9, 'Seventeen')), stat('665', 'answered', at(9, 'Six'), cls='g'),
           stat('262', 'asked us to call', at(9, 'Two')), at(9, 'big') - .2),
        'win'))
    # 10 the fact find's journey: FFRevised (Client Draft Sent At, Journey Reminder 1 At, Journey Reminder 2 At, Journey Call Asked At,
    #    Client Confirmed At, Client Rating), counted 2 Nov 2026: 24 confirmed, 12 on the first e-mail, 8 after reminder 1, 4 after
    #    reminder 2; every rating since 1 October five stars (14 of 14); 125 fact finds since the August launch.
    sc.append(S(10,
        '<div class="ffj"><div class="eyebrow" style="--kd:.1s">The fact find&rsquo;s journey &middot; 125 since August</div>'
        '<div class="jt"><span class="jf" style="--kd:%.2fs;--jd:%.2fs"></span>%s%s%s%s</div>'
        '<div class="jst"><div class="cbar" style="--kd:%.2fs"><div class="cbh">24 clients confirmed</div><div class="cb">'
        '<i class="c1" style="--kd:%.2fs"></i><i class="c2" style="--kd:%.2fs"></i><i class="c3" style="--kd:%.2fs"></i></div>'
        '<div class="cbl"><span>12 on the first e-mail</span><span>8 after reminder 1</span><span>4 after 2</span></div>'
        '<div class="cbh2" style="--kd:%.2fs">Half came after a reminder</div></div>'
        '<div class="st14" style="--kd:%.2fs">%s<span>14 of 14 ratings<br>since October</span></div></div></div>'
        % (at(10, 'same'), max(1.0, at(10, 'call') - at(10, 'same')),
           jstop('Day 0', 'Plan sent', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>', at(10, 'same')), jstop('Day 3', 'Reminder 1', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8M10 20a2 2 0 0 0 4 0"/></svg>', at(10, 'three')),
           jstop('Day 8', 'Reminder 2', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8M10 20a2 2 0 0 0 4 0"/></svg>', at(10, 'eight')), jstop('Then', 'We ask you to call', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/></svg>', at(10, 'call'), 'call'),
           at(10, 'Half') - .4, at(10, 'Half') - .3, at(10, 'Half') + .1, at(10, 'Half') + .4, at(10, 'Half') + .6,
           at(10, 'rating') - .2, stars(at(10, 'rating'), step=.1)),
        'ffj2'))
    # 11 no more guessing: the system shows us, then people coach, in person
    sc.append(S(11,
        '<div class="co2"><div class="co2t">'
        '<div class="gss" style="--kd:.15s"><em>Before</em><div class="qm"><b style="--kd:.3s">?</b><b style="--kd:.45s">?</b><b style="--kd:.6s">?</b></div>'
        '<span class="gw">Guessing</span><i class="sk" style="--kd:%.2fs"></i></div>'
        '<div class="knw" style="--kd:%.2fs"><em>Now &middot; the system shows us</em>%s%s%s%s</div></div>'
        '<div class="cch"><span class="cc" style="--kd:%.2fs"><i><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/></svg></i>A call</span><span class="cc" style="--kd:%.2fs"><i><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-7 9 7M5 10v10h14V10M10 20v-6h4v6"/></svg></i>A visit</span>'
        '<span class="cc" style="--kd:%.2fs"><i><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="7" cy="6" r="2.5"/><circle cx="17" cy="6" r="2.5"/><path d="M3 21v-5a4 4 0 0 1 8 0v5M13 21v-5a4 4 0 0 1 8 0v5M2 13h20"/></svg></i>A sit-down</span></div><b class="co2h" style="--kd:%.2fs">Systems show us. People coach.</b></div>'
        % (at(11, 'guessing') + .2, at(11, 'system'),
           kn('Present', '8:12am', at(11, 'shows')), kn('Fact finds', '2 waiting on you', at(11, 'shows') + .3),
           kn('To close off', '$4.8k should settle', at(11, 'stands') - .2), kn('Midday', 'Need help, 12:04pm', at(11, 'stands') + .1),
           at(11, 'call'), at(11, 'visit'), at(11, 'sit-down'), at(11, 'facts') - .1),
        'coach'))
    # 12 Rajiv: his screen, his record
    sc.append(S(12,
        '<div class="half"><div class="L"><div class="eyebrow" style="--kd:.15s">Rajiv went first</div>'
        '<div class="seven" style="--kd:%.2fs"><b class="cnt" data-to="7" data-at="%d">7</b><span>applications<br>in October</span></div>'
        '<h2 class="lead">%s</h2></div><div class="R">%s</div></div>'
        % (at(12, 'Seven') - .1, int(at(12, 'Seven') * 1000), kin('His updates, on the record.', at(12, 'updates'), .08),
           phone('<div class="rh"><b>Rajiv</b><span>My day</span></div>'
                 '<div class="msg" style="--kd:%.2fs"><em>Wed 28 Oct &middot; to Sasha</em>&ldquo;All o/s will be sorted out today.&rdquo;</div>'
                 '<div class="rate" style="--kd:%.2fs"><em>Mon 2 Nov &middot; Sasha closed it</em><span>%s</span></div>'
                 '<div class="pick" style="--kd:%.2fs"><em>October &middot; picked up</em><b>7 apps</b></div>'
                 % (at(12, 'updates'), at(12, 'record'), ''.join('<i style="--kd:%.2fs">&#9733;</i>' % (at(12, 'record') + k * .12) for k in range(5)), at(12, 'Seven')), 'slide')),
        'rajiv'))
    # 13 that is the level: every one of us
    sc.append(S(13,
        '<div class="mid"><div class="lvl"><div class="bar2" style="--kd:%.2fs"><span>Rajiv&rsquo;s level</span></div>'
        '<div class="crowd2">%s</div></div><h1 class="go">%s</h1></div>'
        % (at(13, 'level'), people(26, at(13, 'Every'), .025, cls='pr2'), kin('Every one of us, there.', at(13, 'Every'), .1)),
        'level'))
    # 14 thank you, to every one of us who stayed the course
    sc.append(S(14,
        '<div class="mid"><div class="eyebrow" style="--kd:.15s">To every one of you who stayed the course</div>'
        '<div class="crowd2">%s</div><h1 class="tyh">%s</h1><h2 class="lead">%s</h2></div>'
        % (people(26, at(14, 'stayed'), .03, cls='ty'), kin('Thank you.', at(14, 'thank'), .12),
           kin('You built this with us. Now we reap it, together.', at(14, 'built'), .07)),
        'thanks'))
    # 15 check in, lift each other, rise
    sc.append(S(15,
        '<div class="mid"><div class="flare big" style="--kd:%.2fs"></div><div class="eyebrow" style="--kd:.15s">Ricky Rampersad Branch &middot; FY27</div>'
        '<div class="three"><span style="--kd:%.2fs">Check in.</span><span style="--kd:%.2fs">Lift each other.</span><b style="--kd:%.2fs">Rise.</b></div></div>'
        % (at(15, 'Rise'), at(15, 'Check'), at(15, 'Lift'), at(15, 'Rise')),
        'end'))
    return ''.join(sc)


CSS = """
@font-face{font-family:Plex;src:url(__PLEX__) format('woff2');font-weight:100 700;font-display:block}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1280px;height:720px;overflow:hidden;background:#04060A}
body{font-family:Plex,system-ui,sans-serif;color:#F2F5F3;-webkit-font-smoothing:antialiased}
#stage{position:relative;width:1280px;height:616px;overflow:hidden;background:#06080A}
#stage:before{content:'';position:absolute;inset:-25%;pointer-events:none;
  background:radial-gradient(60% 60% at 50% 50%,rgba(16,185,129,.14),transparent 70%),radial-gradient(40% 40% at 80% 20%,rgba(227,178,60,.10),transparent 70%);
  animation:breathe 9s ease-in-out infinite}
@keyframes breathe{0%,100%{transform:scale(1);opacity:.75}50%{transform:scale(1.16);opacity:1}}
.sc{position:absolute;left:0;top:0;width:1280px;height:616px;opacity:0;visibility:hidden}
.sc.act{opacity:1;visibility:visible;animation:pin .6s cubic-bezier(.15,.95,.2,1) both}
.sc.out{opacity:1;visibility:visible;animation:pout .6s cubic-bezier(.5,0,.85,.2) both}
@keyframes pin{from{opacity:0;transform:scale(1.06)}to{opacity:1;transform:none}}
@keyframes pout{from{opacity:1;transform:none}to{opacity:0;transform:scale(.97)}}
.in{position:absolute;left:0;top:0;width:1280px;height:616px;padding:44px 74px;display:flex;align-items:center}
.mid{width:100%;text-align:center;position:relative}
.half{width:100%;display:flex;align-items:center;gap:64px}
.half .L{flex:1 1 0;min-width:0;text-align:left}
.half .R{flex:0 0 360px;display:flex;justify-content:center}
h1{font-size:66px;font-weight:600;line-height:1.06;letter-spacing:-1.4px}
h1.ttl{font-size:60px}
h2{font-size:34px;font-weight:600;line-height:1.18;letter-spacing:-.4px}
h2.lead{margin-top:16px;color:#C9D6CF}
h2.lead.big{font-size:42px;margin-top:22px}
.kw{display:inline-block;animation:wup .55s cubic-bezier(.2,.9,.3,1) both;animation-delay:var(--kd)}
@keyframes wup{from{opacity:0;transform:translateY(26px) scale(.93);filter:blur(6px)}to{opacity:1;transform:none;filter:none}}
.eyebrow{font-size:14px;font-weight:600;letter-spacing:4px;text-transform:uppercase;color:#E3B23C;margin-bottom:14px;animation:wup .5s both;animation-delay:var(--kd,.1s)}
h1.cold{color:#7D8792;font-size:58px}
h1.rise{position:relative;font-size:84px;color:#FFFFFF;margin-top:18px}
.flare{position:absolute;left:50%;top:62%;width:10px;height:10px;margin:-5px 0 0 -5px;border-radius:50%;background:#6EE7B7;
  box-shadow:0 0 120px 70px rgba(110,231,183,.45);opacity:0;animation:burst 1.1s cubic-bezier(.1,.8,.2,1) both;animation-delay:var(--kd)}
@keyframes burst{0%{opacity:0;transform:scale(.2)}35%{opacity:1}100%{opacity:0;transform:scale(9)}}
.five{display:flex;gap:30px;justify-content:center;margin:0 0 50px}
.p5{position:relative;width:74px;animation:prise .6s cubic-bezier(.2,1.4,.4,1) both;animation-delay:var(--kd)}
.p5 svg{width:60px;height:68px;fill:#2B3A33}
.p5.me svg{fill:#34D399;filter:drop-shadow(0 0 22px rgba(52,211,153,.6))}
.p5 b{position:absolute;left:50%;top:74px;transform:translateX(-50%);font-size:20px;color:#E3B23C;white-space:nowrap;animation:wup .5s both;animation-delay:var(--kd)}
@keyframes prise{from{opacity:0;transform:translateY(22px) scale(.7)}to{opacity:1;transform:none}}
.snips{display:flex;gap:18px;justify-content:center;margin-top:26px}
.snip{width:470px;text-align:left;padding:16px 18px;border-radius:16px;background:#F7F5EF;color:#1F2433;border-left:6px solid #E3B23C;animation:rup .6s cubic-bezier(.2,1.3,.4,1) both;animation-delay:var(--kd)}
.snip em{display:block;font-style:normal;font-size:14px;letter-spacing:1.5px;text-transform:uppercase;color:#8A6A12}
.snip b{display:block;font-size:20px;line-height:1.35;margin-top:6px;font-weight:600}
.beats{display:flex;gap:26px;justify-content:center}
.beat{width:330px;padding:26px 22px;border-radius:22px;background:rgba(52,211,153,.08);border:1px solid rgba(52,211,153,.28);text-align:left;
  animation:rup .6s cubic-bezier(.2,1.3,.4,1) both;animation-delay:var(--kd)}
.beat em{display:block;font-style:normal;font-size:16px;letter-spacing:2px;text-transform:uppercase;color:#E3B23C}
.beat b{display:block;font-size:46px;font-weight:700;margin-top:8px;color:#FFFFFF}
.beat span{display:block;font-size:20px;color:#A9B8B0;margin-top:4px}
@keyframes rup{from{opacity:0;transform:translateY(18px) scale(.9)}to{opacity:1;transform:none}}
.crowd{display:flex;flex-wrap:wrap;gap:10px 12px;justify-content:center;max-width:760px;margin:0 auto 26px}
.pp{width:38px;height:42px;fill:#34D399;animation:prise .6s cubic-bezier(.2,1.4,.4,1) both;animation-delay:var(--kd)}
h1.go{font-size:64px;color:#FFFFFF}
h1.go.sm{font-size:56px;margin-top:26px}
.ph{width:300px;height:500px;border-radius:40px;background:#111714;border:2px solid #27342D;padding:16px;box-shadow:0 30px 80px rgba(0,0,0,.55);animation:rup .6s both}
.phs{width:100%;height:100%;border-radius:28px;background:#F7F5EF;color:#1F2433;padding:22px 18px;overflow:hidden;text-align:left}
.pr{display:flex;gap:14px;align-items:center}
.ring{width:118px;height:118px;transform:rotate(-90deg)} .ring.big{width:200px;height:200px}
.rt{fill:none;stroke:#ECE7DA;stroke-width:12}
.rf,.rf2{fill:none;stroke:#2C7A57;stroke-width:12;stroke-linecap:round;stroke-dasharray:302;animation:fill 1.6s cubic-bezier(.3,.8,.2,1) both;animation-delay:var(--kd)}
.rf{--to:188} .rf2{--to:42}
@keyframes fill{from{stroke-dashoffset:302}to{stroke-dashoffset:var(--to)}}
.ring text{transform:rotate(90deg);transform-origin:60px 60px;font:700 26px Plex,sans-serif;fill:#1F2433}
.prt small{display:block;font-size:13px;color:#6A7180} .prt b{font-size:22px}
.pl{height:10px;border-radius:6px;background:#ECE7DA;margin:22px 0 10px;overflow:hidden}
.pl i{display:block;height:100%;width:38%;background:#2C7A57;border-radius:6px;transform-origin:0 50%;animation:grow2 1.2s both;animation-delay:var(--kd)}
@keyframes grow2{from{transform:scaleX(0)}to{transform:none}}
.pls{font-size:14px;color:#6A7180;line-height:1.45}
.note{border-left:5px solid #E3B23C;background:#FFF9EC;border-radius:0 16px 16px 0;padding:16px;animation:rup .6s both;animation-delay:var(--kd)}
.note b{font-size:20px;color:#141C4A} .note p{font-size:15px;line-height:1.5;margin-top:8px;color:#1F2433}
.first{margin-top:12px;font-size:16px;line-height:1.45} .first em{font-style:normal;font-weight:700}
.btn{background:#141C4A;color:#F7F5EF;border-radius:14px;padding:16px;text-align:center;font-size:17px;font-weight:600;animation:press 1s both;animation-delay:var(--kd)}
@keyframes press{0%{opacity:0;transform:translateY(10px)}40%{opacity:1;transform:none}70%{transform:scale(.95)}100%{transform:none}}
.stp{margin-top:14px}
.st{display:flex;justify-content:space-between;font-size:16px;padding:9px 2px;border-top:1px solid #ECE7DA;animation:rup .5s both;animation-delay:var(--kd)}
.st b{color:#141C4A}
.pres{margin-top:16px;background:#E8F3EC;color:#1F5E42;border-radius:14px;padding:14px;font-size:17px;font-weight:700;text-align:center;animation:slam2 .6s cubic-bezier(.2,1.5,.35,1) both;animation-delay:var(--kd)}
@keyframes slam2{from{opacity:0;transform:scale(1.4)}to{opacity:1;transform:none}}
.chips{display:flex;flex-direction:column;gap:12px;margin-top:20px}
.chips span{border:1.5px solid #D9CFBA;border-radius:999px;padding:14px 16px;font-size:18px;text-align:center;animation:rup .5s both;animation-delay:var(--kd)}
.chips span.hl{background:#141C4A;color:#F7F5EF;border-color:#141C4A}
.ping{margin-top:26px;background:#FFF4E0;border-radius:14px;padding:14px;font-size:15px;color:#7A4A06;animation:slam2 .6s both;animation-delay:var(--kd)}
.ping b{display:block;font-size:17px;color:#1F2433;margin-bottom:4px}
.cr{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%}
.cr small{font-size:18px;color:#6A7180;margin-top:14px}
.cards{display:grid;grid-template-columns:repeat(4,1fr);gap:18px}
.cd{padding:24px 18px;border-radius:20px;background:#F7F5EF;color:#1F2433;text-align:left;min-height:170px;animation:rup .6s cubic-bezier(.2,1.3,.4,1) both;animation-delay:var(--kd)}
.cd b{display:block;font-size:24px;color:#141C4A} .cd span{display:block;font-size:17px;color:#6A7180;margin-top:10px;line-height:1.4}
.strike{font-size:40px;color:#7D8792;text-decoration:line-through;text-decoration-color:#E3B23C;text-decoration-thickness:4px;animation:wup .5s both;animation-delay:var(--kd)}
.climb{width:600px;height:160px;margin:18px auto 8px;display:block}
.climb path{fill:none;stroke:#34D399;stroke-width:6;stroke-linecap:round;stroke-dasharray:720;stroke-dashoffset:720;filter:drop-shadow(0 0 14px rgba(52,211,153,.5));animation:draw 1.8s cubic-bezier(.3,.8,.2,1) forwards;animation-delay:var(--kd)}
@keyframes draw{to{stroke-dashoffset:0}}
h1.shout{font-size:62px;color:#FFFFFF}
h1.end{font-size:96px;color:#E3B23C;letter-spacing:-2px}
.cam{position:relative;width:100%;display:flex;align-items:center;animation:push 9s linear both}
@keyframes push{from{transform:scale(1)}to{transform:scale(1.06)}}
.motes{position:absolute;inset:0;pointer-events:none}
.motes i{position:absolute;border-radius:50%;background:rgba(227,178,60,.35);animation:mote 6s ease-in-out both;animation-delay:var(--md)}
@keyframes mote{from{opacity:0;transform:translateY(30px)}30%{opacity:1}to{opacity:0;transform:translateY(-60px)}}
.cal{display:flex;gap:40px;justify-content:center;perspective:900px;margin-bottom:26px}
.pg{width:230px;padding:22px 0 18px;border-radius:24px;text-align:center;animation:flipin .8s cubic-bezier(.2,1.3,.4,1) both;animation-delay:var(--kd)}
.pg em{display:block;font-style:normal;font-size:20px;letter-spacing:3px;text-transform:uppercase}
.pg b{display:block;font-size:120px;font-weight:700;line-height:1}
.pg s{display:block;text-decoration:none;font-size:22px;margin-top:4px}
.pg.oct{background:#141A17;color:#6E7A73;border:2px solid #22302A}
.pg.oct s{color:#7D8792}
.pg.nov{background:linear-gradient(160deg,#E3B23C,#C98E1A);color:#1A1405;box-shadow:0 0 60px rgba(227,178,60,.45)}
@keyframes flipin{from{opacity:0;transform:rotateX(80deg) translateY(-30px)}to{opacity:1;transform:none}}
.flare.big{top:50%}
.room{position:relative;display:flex;flex-wrap:wrap;gap:10px 14px;justify-content:center;max-width:760px;margin:0 auto 30px}
.bubs{position:absolute;inset:-26px 0 0 0;display:flex;flex-wrap:wrap;gap:10px 14px;justify-content:center;pointer-events:none}
.bub{width:38px;height:22px;display:block;position:relative;opacity:0;animation:bpop 1.6s ease-out both;animation-delay:var(--kd)}
.bub:after{content:'';position:absolute;left:12px;top:0;width:16px;height:12px;border-radius:8px;background:#E3B23C}
@keyframes bpop{0%{opacity:0;transform:translateY(8px) scale(.4)}30%{opacity:1;transform:none}100%{opacity:0;transform:translateY(-10px)}}
.ph.slide{animation:slidein .8s cubic-bezier(.2,1.1,.3,1) both}
@keyframes slidein{from{opacity:0;transform:translateX(120px) rotate(4deg) scale(.9)}to{opacity:1;transform:none}}
.ph.dark .phs{background:#0E1612;color:#F2F5F3}
.btn2{background:#141C4A;color:#F7F5EF;border-radius:14px;padding:16px;text-align:center;font-size:17px;font-weight:600;animation:press 1s both;animation-delay:var(--kd)}
.pres2{margin-top:12px;background:#E8F3EC;color:#1F5E42;border-radius:14px;padding:12px;text-align:center;font-size:18px;font-weight:700;animation:slam2 .6s cubic-bezier(.2,1.5,.35,1) both;animation-delay:var(--kd)}
.rw{position:relative;display:flex;flex-direction:column;align-items:center;margin-top:16px}
.ring.huge{width:210px;height:210px}
.rf4{fill:none;stroke:#2C7A57;stroke-width:12;stroke-linecap:round;stroke-dasharray:302;--to:115;animation:fill 1.4s cubic-bezier(.3,.8,.2,1) both;animation-delay:var(--kd)}
.rwt{position:absolute;top:66px;left:0;right:0;text-align:center}
.rwt b{display:block;font-size:44px;font-weight:700;color:#141C4A}
.rwt small{display:block;font-size:13px;color:#6A7180;margin-top:96px}
.both{display:flex;align-items:center;justify-content:center;gap:30px;margin-bottom:26px}
.side{width:400px;text-align:left;padding:20px 22px;border-radius:22px;background:#F7F5EF;color:#1F2433;animation:rup .6s cubic-bezier(.2,1.3,.4,1) both;animation-delay:var(--kd)}
.side em{display:block;font-style:normal;font-size:15px;letter-spacing:3px;text-transform:uppercase;color:#8A6A12;margin-bottom:10px}
.ln2{font-size:19px;padding:9px 0;border-top:1px solid #E7E2D6;animation:slin .5s both;animation-delay:var(--kd)}
.ln2 b{color:#2C7A57;margin-right:6px}
.arrows{display:flex;flex-direction:column;gap:14px;animation:wup .5s both;animation-delay:var(--kd)}
.arrows i{display:block;width:70px;height:6px;border-radius:3px;background:#E3B23C;position:relative;animation:pulse 1.2s ease-in-out infinite}
.arrows i:first-child:after{content:'';position:absolute;right:-4px;top:-7px;border:10px solid transparent;border-left:14px solid #E3B23C;border-right:0}
.arrows i:last-child:before{content:'';position:absolute;left:-4px;top:-7px;border:10px solid transparent;border-right:14px solid #E3B23C;border-left:0}
@keyframes pulse{0%,100%{opacity:.55}50%{opacity:1}}
@keyframes slin{from{opacity:0;transform:translateX(-30px)}to{opacity:1;transform:none}}
.callw{position:relative}
.inc{display:flex;flex-direction:column;align-items:center;padding-top:40px;animation:rup .6s both;animation-delay:var(--kd)}
.rip{position:relative;width:120px;height:120px;margin-bottom:-120px}
.rip i{position:absolute;inset:0;border-radius:50%;border:3px solid #34D399;animation:ripple 1.8s ease-out infinite}
.rip i:nth-child(2){animation-delay:.6s} .rip i:nth-child(3){animation-delay:1.2s}
@keyframes ripple{from{transform:scale(.7);opacity:.9}to{transform:scale(1.9);opacity:0}}
.av{position:relative;width:120px;height:120px;border-radius:50%;background:#2C7A57;color:#FFFFFF;font-size:52px;font-weight:700;display:flex;align-items:center;justify-content:center}
.inc b{font-size:24px;margin-top:22px} .inc small{font-size:16px;color:#A9B8B0;margin-top:4px}
.cbtn{display:flex;gap:70px;margin-top:70px} .cbtn span{width:62px;height:62px;border-radius:50%}
.cbtn .no{background:#B8412F} .cbtn .yes{background:#34D399;animation:pulse 1s ease-in-out infinite}
.seven{display:flex;align-items:center;gap:20px;margin:6px 0 4px;transform-origin:left center;animation:sevin .7s cubic-bezier(.2,1.35,.4,1) both;animation-delay:var(--kd)}
@keyframes sevin{from{opacity:0;transform:scale(.55)}to{opacity:1;transform:none}}
.heard .eyebrow{margin-bottom:46px}
.dayw{width:100%}
.trk{position:relative;display:flex;justify-content:space-between;margin:0 30px 24px}
.trk:before{content:'';position:absolute;left:75px;right:75px;top:21px;height:4px;border-radius:2px;background:#22302A}
.tf{position:absolute;left:75px;top:21px;height:4px;border-radius:2px;background:#34D399;width:calc((100% - 150px) * var(--f1));
  animation:tfill 1s cubic-bezier(.3,.8,.2,1) both;animation-delay:var(--kd)}
@keyframes tfill{from{width:calc((100% - 150px) * var(--f0))}to{width:calc((100% - 150px) * var(--f1))}}
.dst{position:relative;z-index:1;width:150px;display:flex;flex-direction:column;align-items:center}
.dst i{width:46px;height:46px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-style:normal;font-size:20px;font-weight:700;
  background:#141A17;border:3px solid #2B3A33;color:#5C6B63}
.dst b{margin-top:8px;font-size:21px;font-weight:700;color:#5C6B63}
.dst small{font-size:13px;letter-spacing:1.5px;text-transform:uppercase;color:#5C6B63}
.dst.done i{background:#34D399;border-color:#34D399;color:#06120C}
.dst.done b{color:#DDE7E1} .dst.done small{color:#8FA39A}
.dst.now i{background:#E3B23C;border-color:#E3B23C;color:#1A1405;box-shadow:0 0 0 8px rgba(227,178,60,.18);animation:nowpop .7s cubic-bezier(.2,1.5,.35,1) both;animation-delay:var(--kd)}
.dst.now b{color:#FFFFFF} .dst.now small{color:#E3B23C}
@keyframes nowpop{from{transform:scale(.4);background:#141A17;border-color:#2B3A33}to{transform:none}}
.duo{display:flex;align-items:stretch}
.you{flex:0 0 660px;position:relative;background:#F7F5EF;color:#1F2433;border-radius:26px;padding:20px 26px 22px;box-shadow:0 30px 80px rgba(0,0,0,.5);
  animation:youin .75s cubic-bezier(.2,1.2,.3,1) both;animation-delay:var(--kd)}
.us{flex:0 0 392px;background:linear-gradient(160deg,#103026,#0B1A15);border:1px solid rgba(110,231,183,.32);border-radius:26px;padding:20px 24px;color:#E6F2EC;
  animation:usin .75s cubic-bezier(.2,1.2,.3,1) both;animation-delay:var(--kd)}
@keyframes youin{from{opacity:0;transform:translateX(-90px) rotate(-2deg) scale(.9)}to{opacity:1;transform:none}}
@keyframes usin{from{opacity:0;transform:translateX(90px) rotate(2deg) scale(.9)}to{opacity:1;transform:none}}
.you>em,.us>em{display:block;font-style:normal;font-size:16px;font-weight:700;letter-spacing:5px;text-transform:uppercase}
.you>em{color:#B07F0E} .us>em{color:#6EE7B7}
.you h3{font-size:36px;font-weight:700;line-height:1.1;letter-spacing:-.6px;color:#141C4A;margin:4px 0 14px}
.us h3{font-size:25px;font-weight:700;line-height:1.15;color:#FFFFFF;margin:4px 0 12px}
.link{flex:1 1 auto;position:relative}
.link:before{content:'';position:absolute;left:4px;right:4px;top:50%;border-top:3px dotted rgba(227,178,60,.45)}
.link i{position:absolute;top:50%;left:0;width:12px;height:12px;margin-top:-5px;border-radius:50%;background:#E3B23C;box-shadow:0 0 14px #E3B23C;
  opacity:0;animation:trav 1.5s linear infinite;animation-delay:var(--kd)}
.link i.b2{background:#6EE7B7;box-shadow:0 0 14px #6EE7B7;animation-name:travb}
@keyframes trav{0%{left:0;opacity:0}15%{opacity:1}85%{opacity:1}100%{left:calc(100% - 12px);opacity:0}}
@keyframes travb{0%{left:calc(100% - 12px);opacity:0}15%{opacity:1}85%{opacity:1}100%{left:0;opacity:0}}
.yg{display:flex;gap:24px;align-items:center}
.mr{position:relative;flex:0 0 170px}
.ring.mini{width:170px;height:170px}
.rf5{fill:none;stroke:#2C7A57;stroke-width:12;stroke-linecap:round;stroke-dasharray:302;animation:fill 1.4s cubic-bezier(.3,.8,.2,1) both;animation-delay:var(--kd)}
.mrt{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}
.mrt b{font-size:42px;font-weight:700;color:#141C4A;line-height:1}
.mrt small{font-size:13px;color:#6A7180;margin-top:4px}
.yl{flex:1 1 auto}
.yrow{display:flex;align-items:center;gap:14px;padding:8px 0;border-top:1px solid #E7E2D6;font-size:20px;animation:slin .5s both;animation-delay:var(--kd)}
.yrow b{flex:0 0 42px;height:42px;border-radius:12px;background:#E8F3EC;color:#1F5E42;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:700}
.yrow b.g{background:#FFF1CC;color:#8A6A12}
.urow{display:flex;align-items:center;gap:10px;padding:10px 0;border-top:1px solid rgba(110,231,183,.16);font-size:18px;animation:slin .5s both;animation-delay:var(--kd)}
.urow b{color:#6EE7B7;font-weight:700}
.urow span{color:#D5E3DC}
.urow s{margin-left:auto;text-decoration:none;font-weight:700;font-size:20px;color:#34D399;animation:slam2 .5s cubic-bezier(.2,1.5,.35,1) both;animation-delay:var(--kd)}
.urow s.wip{width:16px;height:16px;border-radius:50%;border:3px solid rgba(227,178,60,.35);border-top-color:#E3B23C;animation:spin 1s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.plan{margin-top:14px;font-size:20px;animation:rup .5s both;animation-delay:var(--kd)}
.plan b{color:#1F5E42;margin-right:6px}
.wk{display:flex;gap:10px;margin-top:14px}
.wk span{flex:1 1 0;text-align:center;padding:10px 0;border-radius:12px;font-size:16px;font-weight:700;animation:rup .4s both;animation-delay:var(--kd)}
.wk span.on{background:#E8F3EC;color:#1F5E42}
.wk span.td{background:#E3B23C;color:#1A1405;animation:slam2 .6s cubic-bezier(.2,1.5,.35,1) both;animation-delay:var(--kd)}
.pres3{background:rgba(52,211,153,.14);color:#6EE7B7;border-radius:14px;padding:12px 14px;font-size:19px;font-weight:700;animation:slam2 .6s cubic-bezier(.2,1.5,.35,1) both;animation-delay:var(--kd)}
.ifn{margin-top:18px;font-size:14px;letter-spacing:2px;text-transform:uppercase;color:#E3B23C;animation:wup .5s both;animation-delay:var(--kd)}
.callr{display:flex;align-items:center;gap:16px;margin-top:12px;animation:rup .55s cubic-bezier(.2,1.3,.4,1) both;animation-delay:var(--kd)}
.av2{position:relative;flex:0 0 62px;height:62px;border-radius:50%;background:#2C7A57;color:#FFFFFF;font-size:28px;font-weight:700;display:flex;align-items:center;justify-content:center}
.av2 i{position:absolute;inset:0;border-radius:50%;border:3px solid #34D399;animation:ripple 1.8s ease-out infinite}
.av2 i+i{animation-delay:.9s}
.callr b{display:block;font-size:21px;color:#FFFFFF}
.callr small{display:block;font-size:16px;color:#A9B8B0}
.ch2{display:flex;gap:14px;margin:4px 0 14px}
.ch2 span{flex:1 1 0;text-align:center;border:2px solid #D9CFBA;border-radius:999px;padding:14px 0;font-size:21px;font-weight:600;animation:rup .5s both;animation-delay:var(--kd)}
.ch2 span.hl{animation:tap 1.3s both;animation-delay:var(--kd)}
@keyframes tap{0%{opacity:0;transform:translateY(10px)}25%{opacity:1;transform:none;background:transparent;border-color:#D9CFBA}
  55%{transform:scale(.92)}75%{transform:scale(1.04);background:#E3B23C;border-color:#E3B23C;color:#1A1405}100%{transform:none;background:#E3B23C;border-color:#E3B23C;color:#1A1405}}
.typed{background:#FFFFFF;border:1px solid #E7E2D6;border-left:5px solid #E3B23C;border-radius:14px;padding:12px 14px;font-size:19px;line-height:1.4;animation:rup .5s both;animation-delay:var(--kd)}
.typed em{display:block;font-style:normal;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:#8A6A12;margin-bottom:4px}
.ntf{background:rgba(255,255,255,.06);border:1px solid rgba(227,178,60,.55);border-radius:16px;padding:12px 14px;animation:drop .6s cubic-bezier(.2,1.4,.4,1) both;animation-delay:var(--kd)}
@keyframes drop{from{opacity:0;transform:translateY(-34px) scale(.9)}to{opacity:1;transform:none}}
.ntf em{display:block;font-style:normal;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:#E3B23C;margin-bottom:4px}
.ntf b{display:block;font-size:19px;color:#FFFFFF;font-weight:600}
.yc{display:flex;gap:22px;align-items:center}
.bars{flex:1 1 auto}
.br{margin:0 0 12px}
.br div{display:flex;justify-content:space-between;font-size:19px}
.br div b{color:#141C4A}
.br p{height:14px;border-radius:7px;background:#ECE7DA;margin-top:6px;overflow:hidden}
.br p i{display:block;height:100%;width:var(--w);border-radius:7px;background:#2C7A57;transform-origin:0 50%;animation:grow2 1.1s cubic-bezier(.3,.8,.2,1) both;animation-delay:var(--kd)}
.donep{flex:0 0 190px;text-align:center;animation:sevin .7s cubic-bezier(.2,1.35,.4,1) both;animation-delay:var(--kd)}
.donep b{display:block;font-size:78px;font-weight:700;line-height:1;color:#2C7A57;letter-spacing:-2px}
.donep span{display:block;font-size:17px;color:#6A7180;margin-top:4px;line-height:1.25}
.both .L2{animation-name:youin}
.both .R2{animation-name:usin}
.rem{width:100%;display:flex;gap:40px;align-items:center;justify-content:center}
.inbx{flex:0 0 620px;background:#F7F5EF;color:#1F2433;border-radius:26px;padding:16px 18px 10px;box-shadow:0 30px 80px rgba(0,0,0,.5);animation:youin .75s cubic-bezier(.2,1.2,.3,1) both;animation-delay:var(--kd)}
.inbx>em{display:block;font-style:normal;font-size:15px;font-weight:700;letter-spacing:4px;text-transform:uppercase;color:#B07F0E;padding:2px 6px 8px}
.ml{display:flex;gap:14px;align-items:center;padding:10px 8px;border-top:1px solid #E7E2D6;animation:mailin .55s cubic-bezier(.2,1.3,.4,1) both;animation-delay:var(--kd)}
@keyframes mailin{from{opacity:0;transform:translateY(-26px) scale(.95)}to{opacity:1;transform:none}}
.ml .mt{flex:0 0 74px;font-size:14px;font-weight:700;color:#8A6A12;text-transform:uppercase;letter-spacing:1px}
.ml b{display:block;font-size:19px;font-weight:700;color:#141C4A;line-height:1.2}
.ml small{display:block;font-size:15px;color:#6A7180;margin-top:2px}
.ml.hot{background:#FFF7E3;border-radius:14px;border-top-color:transparent}
.st5 i{display:inline-block;font-style:normal;font-size:26px;color:#E3B23C;margin-right:2px;animation:slam2 .45s cubic-bezier(.2,1.5,.35,1) both;animation-delay:var(--kd)}
.stts{flex:1 1 auto;display:flex;flex-direction:column;gap:18px}
.stt{animation:rup .6s cubic-bezier(.2,1.3,.4,1) both;animation-delay:var(--kd)}
.stt b{display:block;font-size:96px;font-weight:700;line-height:.95;color:#E3B23C;letter-spacing:-3px;text-shadow:0 0 40px rgba(227,178,60,.3)}
.stt span{display:block;font-size:24px;font-weight:600;color:#FFFFFF;margin-top:2px;line-height:1.2}
.stt.g b{color:#6EE7B7;text-shadow:0 0 40px rgba(110,231,183,.3)}
.cmail{flex:0 0 470px;background:#FFFFFF;color:#1F2433;border-radius:24px;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,.5);animation:youin .75s cubic-bezier(.2,1.2,.3,1) both;animation-delay:var(--kd)}
.cmh{background:#0F2A22;color:#E6F2EC;padding:14px 20px}
.cmh small{display:block;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#6EE7B7}
.cmh b{display:block;font-size:22px;margin-top:2px}
.cmb{padding:16px 20px 14px;font-size:18px;line-height:1.5}
.cmb p{margin:0 0 8px}
.cmb .ask{font-weight:700;margin-top:6px}
.cmb .st5 i{font-size:40px;margin-right:6px}
.chips3{display:flex;flex-wrap:wrap;gap:8px;padding:0 20px 16px}
.chips3 span{font-size:14px;border:1px solid #E7E2D6;border-radius:999px;padding:6px 12px;color:#3B4150;background:#F7F5EF;animation:rup .45s both;animation-delay:var(--kd)}
.tapd{position:relative}
.tapd:after{content:'';position:absolute;left:50%;top:50%;width:46px;height:46px;margin:-23px 0 0 -23px;border-radius:50%;border:3px solid #E3B23C;opacity:0;animation:tapring .9s ease-out both;animation-delay:var(--kd)}
@keyframes tapring{0%{opacity:0;transform:scale(.4)}30%{opacity:1}100%{opacity:0;transform:scale(1.8)}}
.dotw{flex:0 0 650px}
.dots{display:grid;grid-template-columns:repeat(59,8px);gap:3px}
.dots i{position:relative;width:8px;height:8px;border-radius:50%;background:#26352E;opacity:0;animation:dotin .35s both;animation-delay:var(--a)}
@keyframes dotin{from{opacity:0;transform:scale(.3)}to{opacity:1;transform:none}}
.dots i b,.dots i u{position:absolute;left:0;top:0;width:8px;height:8px;border-radius:50%;opacity:0;animation:dlit .45s both}
.dots i b{background:#34D399;box-shadow:0 0 6px rgba(52,211,153,.75);animation-delay:var(--b)}
.dots i u{background:#E3B23C;box-shadow:0 0 8px rgba(227,178,60,.85);animation-delay:var(--c)}
@keyframes dlit{from{opacity:0;transform:scale(2)}to{opacity:1;transform:none}}
.dkey{display:flex;gap:26px;margin-top:16px;font-size:17px;color:#C9D6CF}
.dkey span:before{content:'';display:inline-block;width:12px;height:12px;border-radius:50%;margin-right:8px;vertical-align:-1px}
.dkey .k1:before{background:#34D399} .dkey .k2:before{background:#E3B23C}
.bigwin{margin-top:6px;font-size:40px;font-weight:700;color:#FFFFFF;animation:slam2 .7s cubic-bezier(.2,1.5,.35,1) both;animation-delay:var(--kd)}
.win .stt b{font-size:84px}
.win .stts{gap:12px}
.co2{width:100%;display:flex;flex-direction:column;align-items:center;gap:24px}
.co2t{display:flex;gap:34px;align-items:stretch}
.gss{position:relative;flex:0 0 300px;border-radius:24px;border:2px dashed #3A4A42;padding:20px 22px;text-align:center;animation:rup .6s both;animation-delay:var(--kd)}
.gss em,.knw em{display:block;font-style:normal;font-size:14px;font-weight:700;letter-spacing:3px;text-transform:uppercase}
.gss em{color:#7D8792}
.qm{display:flex;justify-content:center;gap:16px;margin:16px 0 8px}
.qm b{font-size:72px;font-weight:700;color:#4A5A52;animation:wob 1.6s ease-in-out both;animation-delay:var(--kd)}
@keyframes wob{0%{opacity:0;transform:translateY(20px) rotate(-12deg)}40%{opacity:1;transform:rotate(8deg)}100%{opacity:.8;transform:rotate(-4deg)}}
.gw{font-size:30px;font-weight:600;color:#7D8792}
.sk{position:absolute;left:30px;right:30px;top:54%;height:6px;border-radius:3px;background:#E3B23C;transform-origin:0 50%;transform:rotate(-8deg) scaleX(0);animation:skr .5s cubic-bezier(.3,.8,.2,1) forwards;animation-delay:var(--kd)}
@keyframes skr{to{transform:rotate(-8deg) scaleX(1)}}
.knw{flex:0 0 560px;background:#F7F5EF;color:#1F2433;border-radius:24px;padding:18px 22px;box-shadow:0 30px 80px rgba(0,0,0,.5);animation:usin .75s cubic-bezier(.2,1.2,.3,1) both;animation-delay:var(--kd)}
.knw em{color:#2C7A57;margin-bottom:6px}
.kn{display:flex;align-items:center;gap:12px;padding:9px 0;border-top:1px solid #E7E2D6;font-size:20px;animation:slin .5s both;animation-delay:var(--kd)}
.kn b{flex:0 0 150px;color:#141C4A}
.kn span{flex:1 1 auto;color:#3B4150}
.kn s{text-decoration:none;color:#2C7A57;font-weight:700;font-size:22px}
.cch{display:flex;align-items:center;gap:22px}
.cc{display:flex;align-items:center;gap:12px;font-size:24px;font-weight:600;color:#FFFFFF;animation:slam2 .6s cubic-bezier(.2,1.5,.35,1) both;animation-delay:var(--kd)}
.cc i{width:60px;height:60px;border-radius:50%;background:#2C7A57;color:#FFFFFF;display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 8px rgba(52,211,153,.15)}
.cc i svg{width:28px;height:28px}
.co2h{font-size:38px;font-weight:700;color:#E3B23C;animation:wup .6s both;animation-delay:var(--kd)}
.ffj{width:100%;display:flex;flex-direction:column;align-items:center;gap:28px}
.jt{position:relative;width:1000px;display:flex;justify-content:space-between}
.jt:before{content:'';position:absolute;left:70px;right:70px;top:38px;height:6px;border-radius:3px;background:#22302A}
.jf{position:absolute;left:70px;top:38px;height:6px;width:calc(100% - 140px);border-radius:3px;background:linear-gradient(90deg,#34D399,#E3B23C);
  transform-origin:0 50%;transform:scaleX(0);animation:jfill var(--jd) linear forwards;animation-delay:var(--kd)}
@keyframes jfill{to{transform:scaleX(1)}}
.jsp{position:relative;z-index:1;width:140px;display:flex;flex-direction:column;align-items:center;text-align:center;animation:slam2 .6s cubic-bezier(.2,1.5,.35,1) both;animation-delay:var(--kd)}
.jsp i{width:80px;height:80px;border-radius:50%;background:#F7F5EF;color:#141C4A;display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 8px rgba(227,178,60,.16)}
.jsp i svg{width:36px;height:36px}
.jsp b{margin-top:12px;font-size:22px;color:#E3B23C}
.jsp span{font-size:19px;color:#FFFFFF;line-height:1.2}
.jsp.call i{background:#2C7A57;color:#FFFFFF;box-shadow:0 0 0 8px rgba(52,211,153,.2)}
.jst{display:flex;gap:56px;align-items:center}
.cbar{width:560px;animation:rup .6s both;animation-delay:var(--kd)}
.cbh{font-size:30px;font-weight:700;color:#FFFFFF;margin-bottom:12px}
.cb{display:flex;height:34px;border-radius:10px;overflow:hidden;background:#22302A}
.cb i{display:block;height:100%;transform-origin:0 50%;animation:grow2 .8s cubic-bezier(.3,.8,.2,1) both;animation-delay:var(--kd)}
.cb i.c1{width:50%;background:#34D399} .cb i.c2{width:33.4%;background:#E3B23C} .cb i.c3{width:16.6%;background:#F2D27E}
.cbl{display:flex;justify-content:space-between;font-size:17px;color:#C9D6CF;margin-top:8px}
.cbh2{margin-top:14px;font-size:28px;font-weight:700;color:#E3B23C;animation:wup .5s both;animation-delay:var(--kd)}
.st14{text-align:center;animation:rup .6s both;animation-delay:var(--kd)}
.st14 .st5 i{font-size:48px;margin:0 2px}
.st14>span{display:block;font-size:22px;font-weight:600;color:#FFFFFF;margin-top:8px;line-height:1.2}
.ty{width:42px;height:46px;fill:#2B3A33;animation:tylit .7s ease-out both;animation-delay:var(--kd)}
@keyframes tylit{from{opacity:.3;transform:translateY(10px)}to{opacity:1;transform:none;fill:#E3B23C;filter:drop-shadow(0 0 10px rgba(227,178,60,.55))}}
h1.tyh{font-size:96px;color:#FFFFFF;margin-top:22px;letter-spacing:-2px}
.seven b{font-size:190px;font-weight:700;line-height:.85;color:#E3B23C;letter-spacing:-6px;text-shadow:0 0 50px rgba(227,178,60,.35)}
.seven span{font-size:30px;font-weight:600;line-height:1.15;color:#FFFFFF}
.rh{display:flex;justify-content:space-between;align-items:baseline;border-bottom:1px solid #E7E2D6;padding-bottom:10px}
.rh b{font-size:22px;color:#141C4A} .rh span{font-size:14px;color:#6A7180}
.msg,.rate,.pick{margin-top:14px;border-radius:14px;padding:12px 14px;animation:rup .55s cubic-bezier(.2,1.3,.4,1) both;animation-delay:var(--kd)}
.msg{background:#FFFFFF;border-left:5px solid #2C7A57;font-size:16px;line-height:1.4}
.msg em,.rate em,.pick em{display:block;font-style:normal;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#8A6A12;margin-bottom:4px}
.rate{background:#FFF9EC} .rate span i{font-style:normal;font-size:26px;color:#E3B23C;display:inline-block;animation:slam2 .5s both;animation-delay:var(--kd)}
.pick{background:#E8F3EC} .pick b{font-size:26px;color:#1F5E42}
.lvl{position:relative;width:800px;margin:0 auto 22px;padding-top:30px}
.bar2{position:absolute;left:0;right:0;top:24px;height:0;border-top:3px dashed #E3B23C;animation:wup .6s both;animation-delay:var(--kd)}
.bar2 span{position:absolute;right:0;top:-30px;font-size:16px;letter-spacing:2px;text-transform:uppercase;color:#E3B23C}
.crowd2{display:flex;flex-wrap:wrap;gap:10px 12px;justify-content:center;padding-top:20px}
.pr2{width:42px;height:46px;fill:#34D399;animation:climb2 .9s cubic-bezier(.2,1.4,.4,1) both;animation-delay:var(--kd)}
@keyframes climb2{from{opacity:.25;fill:#2B3A33;transform:translateY(46px)}to{opacity:1;transform:none}}
.three{display:flex;gap:30px;justify-content:center;align-items:baseline;margin-top:20px;position:relative}
.three span{font-size:54px;font-weight:600;color:#FFFFFF;animation:wup .55s both;animation-delay:var(--kd)}
.three b{font-size:120px;font-weight:700;color:#E3B23C;letter-spacing:-3px;animation:slam2 .7s cubic-bezier(.2,1.5,.35,1) both;animation-delay:var(--kd)}
"""


def main():
    page = ('<!doctype html><html lang="en"><head><meta charset="utf-8">'
            '<title>Reset and rise: the turn</title><style>'
            + CSS.replace('__PLEX__', PLEX) + '</style></head><body>'
            '<div id="stage">' + build() + '</div>'
            '<script>'
            'var SC=[].slice.call(document.querySelectorAll(".sc"));'
            'var paused=false,timer=null,cur=-1;'
            'function go(n){'
            ' if(cur>=0&&SC[cur]){SC[cur].classList.remove("act");SC[cur].classList.add("out");}'
            ' var p=cur;cur=n;'
            ' SC[n].classList.remove("out");'
            ' SC[n].offsetWidth;'
            ' SC[n].classList.add("act");'
            ' if(p>=0&&SC[p])setTimeout(function(){SC[p].classList.remove("out");},720);'
            ' if(!paused&&!window.__RENDER){'
            '  timer=setTimeout(function(){go((n+1)%SC.length);},+SC[n].dataset.d);}'
            '}'
            'go(0);'
            '</script></body></html>')
    OUT.write_text(page)
    print('wrote %s  (%d scenes, %.1fs, %d KB)'
          % (OUT, len(DURS), sum(DURS) / 1000.0, len(page) // 1024))

    seen = {}
    css = re.sub(r'/\*.*?\*/', '', CSS, flags=re.S)
    for m in re.finditer(r'([^{}]+)\{([^}]*)\}', css):
        head = m.group(1).strip()
        if head.startswith('@') or not head:
            continue
        for sel in [x.strip() for x in head.split(',') if x.strip()]:
            if sel in ('from', 'to') or re.fullmatch(r'[\d.]+%?', sel):
                continue
            for decl in m.group(2).split(';'):
                if ':' not in decl:
                    continue
                prop, val = decl.split(':', 1)
                prop, val = prop.strip(), val.strip()
                if prop.startswith('--'):
                    continue
                key = (sel, prop)
                if key in seen and seen[key] != val:
                    sys.exit('CLASS COLLISION: "%s" sets %s twice (%r vs %r)'
                             % (sel, prop, seen[key], val))
                seen[key] = val
    print('  no class collisions (%d selector/property pairs)' % len(seen))

    RESERVED = {'act', 'out', 'cnt', 'sc', 'in', 'rolling'}
    for sel in {s for (s, _) in seen}:
        subject = re.split(r'[\s>+~]+', sel.strip())[-1]
        if subject in ('#ctrl', '#poster'):
            continue
        for cls in re.findall(r'\.([a-zA-Z][\w-]*)', subject):
            if cls in RESERVED and subject not in ('.sc', '.sc.act', '.sc.out', '.in'):
                sys.exit('RESERVED CLASS: "%s" styles .%s, which render.js owns'
                         % (sel, cls))
    print("  no rule touches render.js's reserved classes")


if __name__ == '__main__':
    main()
