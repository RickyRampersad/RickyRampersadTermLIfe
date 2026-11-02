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
    # 3 a day: check in, the goal right there
    ring = ('<svg class="ring huge" viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="48" class="rt"/>'
            '<circle cx="60" cy="60" r="48" class="rf4" style="--kd:%.2fs"/></svg>' % at(3, 'goal'))
    sc.append(S(3,
        '<div class="half"><div class="L"><div class="eyebrow" style="--kd:.15s">A day &middot; 8:12am</div><h1 class="ttl">%s</h1><h2 class="lead">%s</h2></div>'
        '<div class="R">%s</div></div>'
        % (kin('Check in.', at(3, 'check'), .1), kin('Your goal, right there.', at(3, 'goal'), .08),
           phone('<div class="btn2" style="--kd:%.2fs">Check in and plan my day</div><div class="pres2" style="--kd:%.2fs">Present &#10003;</div>'
                 '<div class="rw">%s<div class="rwt"><b class="cnt" data-to="62" data-suf="%%" data-at="%d">62%%</b><small>of the month, on your plan</small></div></div>'
                 % (at(3, 'check'), at(3, 'check') + .7, ring, int(at(3, 'goal') * 1000)), 'slide')),
        'day'))
    # 4 both ways: everyone accountable
    sc.append(S(4,
        '<div class="mid"><div class="both">'
        '<div class="side L2" style="--kd:%.2fs"><em>You see us</em>'
        '<div class="ln2" style="--kd:%.2fs"><b>Sasha</b> closed it &middot; client called</div>'
        '<div class="ln2" style="--kd:%.2fs"><b>Elizabeth</b> on it today</div>'
        '<div class="ln2" style="--kd:%.2fs"><b>Azariah</b> documents in</div></div>'
        '<div class="arrows" style="--kd:%.2fs"><i></i><i></i></div>'
        '<div class="side R2" style="--kd:%.2fs"><em>We see you</em>'
        '<div class="ln2" style="--kd:%.2fs"><b>Present</b> 8:12am</div>'
        '<div class="ln2" style="--kd:%.2fs"><b>Plan</b> 6 calls &middot; 2 fact finds</div>'
        '<div class="ln2" style="--kd:%.2fs"><b>Midday</b> on track</div></div></div>'
        '<h1 class="go sm">%s</h1></div>'
        % (at(4, 'see'), at(4, 'working'), at(4, 'working') + .25, at(4, 'clients'), at(4, 'We') - .2, at(4, 'We') - .2,
           at(4, 'We') + .1, at(4, 'We') + .35, at(4, 'We') + .6, kin('Everyone is accountable.', at(4, 'Everyone'), .1)),
        'both2'))
    # 5 we call
    sc.append(S(5,
        '<div class="half"><div class="L"><div class="eyebrow" style="--kd:.15s">When something stalls</div><h1 class="ttl">%s</h1><h2 class="lead">%s</h2></div>'
        '<div class="R"><div class="callw">%s</div></div></div>'
        % (kin('We call you.', at(5, 'call'), .1), kin('To understand. To help.', at(5, 'understand'), .1),
           phone('<div class="inc" style="--kd:%.2fs"><div class="rip"><i></i><i></i><i></i></div><div class="av">M</div><b>Your manager</b><small>calling&hellip;</small>'
                 '<div class="cbtn"><span class="no"></span><span class="yes"></span></div></div>' % at(5, 'stalls'), 'dark')),
        'call'))
    # 6 Rajiv: his screen, his record
    sc.append(S(6,
        '<div class="half"><div class="L"><div class="eyebrow" style="--kd:.15s">Rajiv went first</div>'
        '<div class="seven" style="--kd:%.2fs"><b class="cnt" data-to="7" data-at="%d">7</b><span>applications<br>in October</span></div>'
        '<h2 class="lead">%s</h2></div><div class="R">%s</div></div>'
        % (at(6, 'Seven') - .1, int(at(6, 'Seven') * 1000), kin('His updates, on the record.', at(6, 'updates'), .08),
           phone('<div class="rh"><b>Rajiv</b><span>My day</span></div>'
                 '<div class="msg" style="--kd:%.2fs"><em>Wed 28 Oct &middot; to Sasha</em>&ldquo;All o/s will be sorted out today.&rdquo;</div>'
                 '<div class="rate" style="--kd:%.2fs"><em>Mon 2 Nov &middot; Sasha closed it</em><span>%s</span></div>'
                 '<div class="pick" style="--kd:%.2fs"><em>October &middot; picked up</em><b>7 apps</b></div>'
                 % (at(6, 'updates'), at(6, 'record'), ''.join('<i style="--kd:%.2fs">&#9733;</i>' % (at(6, 'record') + k * .12) for k in range(5)), at(6, 'Seven')), 'slide')),
        'rajiv'))
    # 7 that is the level: every one of us
    sc.append(S(7,
        '<div class="mid"><div class="lvl"><div class="bar2" style="--kd:%.2fs"><span>Rajiv&rsquo;s level</span></div>'
        '<div class="crowd2">%s</div></div><h1 class="go">%s</h1></div>'
        % (at(7, 'level'), people(26, at(7, 'Every'), .025, cls='pr2'), kin('Every one of us, there.', at(7, 'Every'), .1)),
        'level'))
    # 8 check in, lift each other, rise
    sc.append(S(8,
        '<div class="mid"><div class="flare big" style="--kd:%.2fs"></div><div class="eyebrow" style="--kd:.15s">Ricky Rampersad Branch &middot; FY27</div>'
        '<div class="three"><span style="--kd:%.2fs">Check in.</span><span style="--kd:%.2fs">Lift each other.</span><b style="--kd:%.2fs">Rise.</b></div></div>'
        % (at(8, 'Rise'), at(8, 'Check'), at(8, 'Lift'), at(8, 'Rise')),
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
