#!/usr/bin/env python3
"""Reset and rise, the short cut (2 November 2026).

Ricky, 8:35am: "can I see the revised film, condensed, very short and very impactful, that will motivate and move
them to really mean what we spoke about on Friday last? Also, the progress bar, the wall, what staff do, what we
do, and motivational stuff."

Friday's own words, from the Blast Off minutes: "We rise together", "not going back to what it was", and Darryl's
"be each other's keepers and lift each other". Then the whole system in one breath: the agent's goal ring and one
thing first; staff with the coach and its stops; the managers seeing the day and coming when asked; the wall, each
against their own best, never ranked; Rajiv first (his own record: the update to Sasha, the 5 of 5); every one of us.

Same rules as the long cut: no client, no agent's figures, nobody ranked. Drawn screens, no real numbers. The 26
silhouettes are the branch as presented on Friday (19 agents, 2 unit managers, 5 support).
"""
import base64, json, pathlib, re, sys

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent.parent
OUT = ROOT / 'resetrise' / 'short.html'
TIMING = HERE / 'mtshort-timing.json'


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


def S(n, body, cls=''):
    return ('<section class="sc %s" data-d="%d"><div class="in">%s</div></section>'
            % (cls, DURS[n - 1], body))


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


def crowd(n, d, step=.03, centre=None):
    c = centre if centre is not None else n // 2
    return '<div class="crowd">%s</div>' % ''.join(
        '<svg class="pp" viewBox="0 0 24 27" style="--kd:%.2fs" aria-hidden="true"><circle cx="12" cy="7" r="5.2"/>'
        '<path d="M2.4 26.5a9.6 9.6 0 0 1 19.2 0z"/></svg>' % (d + abs(i - c) * step) for i in range(n))


def build():
    sc = []
    # 1 Friday's words
    sc.append(S(1,
        '<div class="mid"><div class="eyebrow" style="--kd:.2s">Friday 30 October &middot; the Blast Off</div>'
        '%s<h1 class="rise">%s</h1></div>'
        % (crowd(26, at(1, 'rise')), kin('We rise together.', at(1, 'rise'), .12)),
        'hit'))
    # 2 not going back
    sc.append(S(2,
        '<div class="mid"><div class="strike big2" style="--kd:%.2fs">what it was</div>'
        '<svg class="up" viewBox="0 0 120 120" aria-hidden="true"><path style="--kd:%.2fs" d="M60 108 V18 M24 52 L60 16 L96 52"/></svg>'
        '<h1 class="shout">%s</h1></div>'
        % (at(2, 'what'), at(2, 'back'), kin('Not going back.', at(2, 'not'), .12)),
        'back'))
    # 3 the agent: the goal ring and one thing first
    ring = ('<svg class="ring big" viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="48" class="rt"/>'
            '<circle cx="60" cy="60" r="48" class="rf3" style="--kd:%.2fs"/><text x="60" y="68" text-anchor="middle">62%%</text></svg>' % at(3, 'goal'))
    sc.append(S(3,
        '<div class="half"><div class="L"><div class="eyebrow" style="--kd:.2s">Every agent &middot; every morning</div>'
        '<h1 class="ttl">%s</h1><h2 class="lead">%s</h2></div><div class="R">%s</div></div>'
        % (kin('Your goal, first.', at(3, 'goal'), .1), kin('And one thing to do first.', at(3, 'one'), .07),
           phone('<div class="cr2">%s<small>of the month, on your own plan</small></div><div class="note sm" style="--kd:%.2fs"><div class="first"><em>First:</em> call the client who asked for a call.</div></div>'
                 % (ring, at(3, 'one')))),
        'agent'))
    # 4 staff: the coach and its stops
    stops = [('In', 'checked in'), ('Scrub', 'what came in'), ('Update', 'before lunch'), ('Lunch', ''), ('Scrub', 'after lunch'), ('Close', 'the day')]
    rail = ''.join('<div class="stop" style="--kd:%.2fs"><i></i><b>%s</b><span>%s</span></div>' % (at(4, 'coach') + k * .32, a, b) for k, (a, b) in enumerate(stops))
    sc.append(S(4,
        '<div class="mid"><div class="eyebrow" style="--kd:.2s">Our staff</div><h1 class="ttl c">%s</h1>'
        '<div class="rail"><div class="track"><u style="--kd:%.2fs"></u></div>%s</div></div>'
        % (kin('A coach on the screen, all day.', at(4, 'coach'), .08), at(4, 'coach'), rail),
        'staff'))
    # 5 the managers, and we come
    tl = [('Agent', 'An update on a client&rsquo;s task', 'at(5,"see")'), ('Sales support', 'Done, and the client called', ''), ('Manager', 'On it this afternoon', '')]
    sc.append(S(5,
        '<div class="half"><div class="L"><div class="eyebrow" style="--kd:.2s">Your managers</div><h1 class="ttl">%s</h1><h2 class="lead">%s</h2></div><div class="R">%s</div></div>'
        % (kin('Your day, as it happens.', at(5, 'see'), .08), kin('Ask for help, and we come to you.', at(5, 'Ask'), .07),
           phone('<div class="tl2">%s</div><div class="ping" style="--kd:%.2fs"><b>Need help</b>Your manager has it</div>'
                 % (''.join('<div class="tli" style="--kd:%.2fs"><b>%s</b>%s</div>' % (at(5, 'see') + k * .35, w, s) for k, (w, s, _) in enumerate(tl)), at(5, 'help')))),
        'managers'))
    # 6 the wall: each against their own best, never ranked
    rings = ''.join('<div class="wr" style="--kd:%.2fs"><svg viewBox="0 0 60 60" aria-hidden="true"><circle cx="30" cy="30" r="24" class="wt"/>'
                    '<circle cx="30" cy="30" r="24" class="wf" style="--to:%d;--kd:%.2fs"/></svg></div>'
                    % (at(6, 'wall') + k * .05, [60, 30, 95, 45, 20, 70, 10, 55, 85, 35, 65, 25][k % 12], at(6, 'own') + k * .04) for k in range(12))
    sc.append(S(6,
        '<div class="mid"><div class="tv"><div class="tvh">The branch today</div><div class="wrs">%s</div></div>'
        '<h1 class="go sm">%s</h1><div class="sub2" style="--kd:%.2fs">Never ranked.</div></div>'
        % (rings, kin('Each of us, against our own best.', at(6, 'Each'), .07), at(6, 'Never')),
        'wall'))
    # 7 Rajiv went first (his own record)
    snip = lambda when, what, d: '<div class="snip" style="--kd:%.2fs"><em>%s</em><b>%s</b></div>' % (d, when, what)
    sc.append(S(7,
        '<div class="mid"><h1 class="ttl c">%s</h1><div class="snips">%s%s</div><h2 class="lead">%s</h2></div>'
        % (kin('Rajiv went first.', at(7, 'went'), .1),
           snip('Wed 28 Oct &middot; 5:29pm', 'An update on his client&rsquo;s task, from his day, straight to Sasha', at(7, 'first')),
           snip('Mon 2 Nov &middot; 8:16am', 'Rates the service on a task closed for him: 5 of 5', at(7, 'first') + .4),
           kin('Now it&rsquo;s every one of us.', at(7, 'Now'), .08)),
        'rajiv'))
    # 8 check in, lift each other, rise
    sc.append(S(8,
        '<div class="mid"><div class="eyebrow" style="--kd:.15s">Ricky Rampersad Branch &middot; FY27</div>'
        '<div class="three"><span style="--kd:%.2fs">Check in.</span><span style="--kd:%.2fs">Lift each other.</span><b style="--kd:%.2fs">Rise.</b></div></div>'
        % (at(8, 'Check'), at(8, 'Lift'), at(8, 'Rise')),
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
h1.ttl.c{text-align:center}
.cr2{display:flex;flex-direction:column;align-items:center;padding-top:14px}
.cr2 small{font-size:15px;color:#6A7180;margin-top:8px}
.rf3{fill:none;stroke:#2C7A57;stroke-width:12;stroke-linecap:round;stroke-dasharray:302;--to:115;animation:fill 1.6s cubic-bezier(.3,.8,.2,1) both;animation-delay:var(--kd)}
.note.sm{margin-top:22px;padding:12px 14px}
.strike.big2{font-size:56px;margin-bottom:6px}
.up{width:110px;height:110px;display:block;margin:6px auto 10px}
.up path{fill:none;stroke:#34D399;stroke-width:10;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:240;stroke-dashoffset:240;animation:draw 1s cubic-bezier(.3,.8,.2,1) forwards;animation-delay:var(--kd)}
.rail{position:relative;margin:40px auto 0;width:1040px;display:flex;justify-content:space-between}
.track{position:absolute;left:30px;right:30px;top:20px;height:6px;border-radius:4px;background:#22302A}
.track u{display:block;height:100%;border-radius:4px;background:linear-gradient(90deg,#34D399,#E3B23C);transform-origin:0 50%;animation:grow2 2.2s cubic-bezier(.3,.8,.2,1) both;animation-delay:var(--kd)}
.stop{position:relative;width:150px;text-align:center;animation:rup .5s both;animation-delay:var(--kd)}
.stop i{display:block;width:46px;height:46px;margin:0 auto;border-radius:50%;background:#0E1612;border:5px solid #34D399;box-shadow:0 0 22px rgba(52,211,153,.45)}
.stop b{display:block;font-size:24px;margin-top:12px;color:#FFFFFF} .stop span{display:block;font-size:16px;color:#A9B8B0;margin-top:2px}
.tl2{display:flex;flex-direction:column;gap:12px;margin-top:6px}
.tli{border-left:4px solid #2C7A57;background:#FFFFFF;border-radius:0 12px 12px 0;padding:10px 12px;font-size:15px;color:#1F2433;animation:rup .5s both;animation-delay:var(--kd)}
.tli b{display:block;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;color:#2C7A57;margin-bottom:2px}
.tv{width:820px;margin:0 auto;padding:18px 24px 22px;border-radius:22px;background:#0D1411;border:2px solid #22302A;box-shadow:0 30px 70px rgba(0,0,0,.5);animation:rup .6s both}
.tvh{font-size:15px;letter-spacing:3px;text-transform:uppercase;color:#E3B23C;text-align:left;margin-bottom:12px}
.wrs{display:grid;grid-template-columns:repeat(6,1fr);gap:16px}
.wr{animation:rup .5s both;animation-delay:var(--kd)} .wr svg{width:86px;height:86px;transform:rotate(-90deg)}
.wt{fill:none;stroke:#22302A;stroke-width:7}
.wf{fill:none;stroke:#34D399;stroke-width:7;stroke-linecap:round;stroke-dasharray:151;stroke-dashoffset:151;animation:wfill 1.4s cubic-bezier(.3,.8,.2,1) forwards;animation-delay:var(--kd)}
@keyframes wfill{to{stroke-dashoffset:calc(151 - 151 * var(--to) / 100)}}
.sub2{font-size:26px;color:#E3B23C;font-weight:600;margin-top:10px;animation:wup .5s both;animation-delay:var(--kd)}
.three{display:flex;gap:30px;justify-content:center;align-items:baseline;margin-top:20px}
.three span{font-size:54px;font-weight:600;color:#FFFFFF;animation:wup .55s both;animation-delay:var(--kd)}
.three b{font-size:110px;font-weight:700;color:#E3B23C;letter-spacing:-3px;animation:slam2 .7s cubic-bezier(.2,1.5,.35,1) both;animation-delay:var(--kd)}
"""


def main():
    page = ('<!doctype html><html lang="en"><head><meta charset="utf-8">'
            '<title>Reset and rise: the short cut</title><style>'
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
