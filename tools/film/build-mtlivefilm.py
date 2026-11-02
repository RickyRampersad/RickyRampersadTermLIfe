#!/usr/bin/env python3
"""Reset and rise, part two: the go-live (2 November 2026).

Ricky, 8:11am: "as I presented last Friday, do we have a small little vid and a nice WhatsApp message with
Andrew's voice? Because we kicked off Friday in terms of our reset and rise ... relating this to the kickoff
today: we went live now, we demonstrated the pilot, Rajiv, what he's logging, and now it's extended to the
entire branch."

THE ARC: Friday's reset, cold; the turn on "today, we rise"; the five who went first, Rajiv lit among them;
the three beats of the day; then every one of us, warming to emerald and the branch's gold (no cyan); the
agent's day as it now reads (goal first, one thing, check in, midday, close off, one screen); no rankings,
each against their own best; reset, rise.

WHAT IT MAY NOT SAY: no client, no agent's figures, nobody ranked, nobody counted who left. The screens are
drawn, not captured, and carry no real numbers. Rajiv is named because he showed the branch on Friday.

Re-cut: edit mtlive-lines.json, push tts/job.json to the tts-run branch, importvox.py <out> vomtlive 1.15
--timing mtlive-timing.json --lines mtlive-lines.json, then this, then sfx.py / usetrack.py / render.js /
mixany.py.
"""
import base64, json, pathlib, re, sys

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent.parent
OUT = ROOT / 'resetrise' / 'film.html'
TIMING = HERE / 'mtlive-timing.json'


def b64(p, mime):
    return 'data:%s;base64,%s' % (mime, base64.b64encode(pathlib.Path(p).read_bytes()).decode())


MARK = b64(ROOT / 'orphan-transition' / 'board-mark.png', 'image/png')
PLEX = b64(HERE / 'fonts' / 'IBMPlexSans-latin.woff2', 'font/woff2')

T = json.loads(TIMING.read_text()) if TIMING.exists() else {}
DURS = [int(round(d * 1000)) for d in (T.get('durs') or [5.0] * 12)]
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


def build():
    sc = []
    # 1 reset, rise
    sc.append(S(1,
        '<div class="mid"><h1 class="cold">%s</h1><div class="flare" style="--kd:%.2fs"></div>'
        '<h1 class="rise">%s</h1></div>'
        % (kin('Friday, we reset.', .3, .1), at(1, 'Today'), kin('Today, we rise.', at(1, 'Today'), .11)),
        'hit'))
    # 2 the five who went first
    five = ''.join('<div class="p5%s" style="--kd:%.2fs"><svg viewBox="0 0 24 27" aria-hidden="true"><circle cx="12" cy="7" r="5.2"/>'
                   '<path d="M2.4 26.5a9.6 9.6 0 0 1 19.2 0z"/></svg>%s</div>'
                   % (' me' if i == 2 else '', at(2, 'five') + i * .12, '<b style="--kd:%.2fs">Rajiv</b>' % at(2, 'Rajiv') if i == 2 else '')
                   for i in range(5))
    # Rajiv's own record in Salesforce (read 2 Nov 2026): his update on a client's task from his day (Wed 28 Oct, 5:29pm, to
    # Sasha), and this morning's rating of a task Sasha closed for him (8:16am, 5 of 5). No client, no figure.
    snip = lambda when, what, d: '<div class="snip" style="--kd:%.2fs"><em>%s</em><b>%s</b></div>' % (d, when, what)
    sc.append(S(2,
        '<div class="mid"><div class="eyebrow" style="--kd:.2s">Last week &middot; the pilot</div>'
        '<div class="five">%s</div><h2 class="lead">%s</h2><div class="snips">%s%s</div></div>'
        % (five, kin('Five went first. Rajiv showed us how.', at(2, 'five'), .07),
           snip('Wed 28 Oct &middot; 5:29pm', 'Rajiv posts an update on his client&rsquo;s task, from his day, straight to Sasha', at(2, 'showed')),
           snip('Mon 2 Nov &middot; 8:16am', 'Rajiv rates the service on a task closed for him: 5 of 5. Thank you, Sasha.', at(2, 'works'))),
        'pilot'))
    # 3 the three beats
    beat = lambda t, w, k, d: '<div class="beat" style="--kd:%.2fs"><em>%s</em><b>%s</b><span>%s</span></div>' % (d, t, w, k)
    sc.append(S(3,
        '<div class="mid"><div class="beats">%s%s%s</div></div>'
        % (beat('by 10:30am', 'Plan', 'the morning', at(3, 'Plan')), beat('12 noon', 'Check in', 'how is it going', at(3, 'Check')),
           beat('5:30pm', 'Close off', 'what you did', at(3, 'Close'))),
        'beats3'))
    # 4 every one of us
    crowd = ''.join('<svg class="pp" viewBox="0 0 24 27" style="--kd:%.2fs" aria-hidden="true"><circle cx="12" cy="7" r="5.2"/>'
                    '<path d="M2.4 26.5a9.6 9.6 0 0 1 19.2 0z"/></svg>' % (at(4, 'every') + (abs(i - 13) * .03)) for i in range(27))
    sc.append(S(4,
        '<div class="mid"><div class="crowd">%s</div><h1 class="go">%s</h1></div>'
        % (crowd, kin('From today, every one of us.', at(4, 'From'), .09)),
        'all'))
    # 5 goal first
    ring = ('<svg class="ring" viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="48" class="rt"/>'
            '<circle cx="60" cy="60" r="48" class="rf" style="--kd:%.2fs"/></svg>' % at(5, 'month'))
    sc.append(S(5,
        '<div class="half"><div class="L"><div class="eyebrow" style="--kd:.2s">Every morning</div>'
        '<h1 class="ttl">%s</h1><h2 class="lead">%s</h2></div><div class="R">%s</div></div>'
        % (kin('Your goal comes first.', .3, .09), kin('Your month, against your own plan.', at(5, 'where'), .07),
           phone('<div class="pr">%s<div class="prt"><small>This month</small><b>on your plan</b></div></div>'
                 '<div class="pl"><i style="--kd:%.2fs"></i></div><div class="pls">Your week: contacts &middot; appointments &middot; fact finds &middot; apps</div>'
                 % (ring, at(5, 'own')))),
        'goal'))
    # 6 one thing first
    sc.append(S(6,
        '<div class="half"><div class="L"><h1 class="ttl">%s</h1><h2 class="lead">%s</h2></div><div class="R">%s</div></div>'
        % (kin('One thing to do first.', at(6, 'one'), .09), kin('Written for you, from your own numbers.', at(6, 'written'), .07),
           phone('<div class="note" style="--kd:%.2fs"><b>Make today count</b><p>%s</p><div class="first"><em>First:</em> %s</div></div>'
                 % (at(6, 'one'), 'Your week needs a few more fact finds. The quickest names are waiting for your call.', kin('call the client who asked for a call.', at(6, 'numbers'), .06)))),
        'one'))
    # 7 check in: present
    sc.append(S(7,
        '<div class="half"><div class="L"><h1 class="ttl">%s</h1><h2 class="lead">%s</h2></div><div class="R">%s</div></div>'
        % (kin('Check in.', at(7, 'Check'), .1), kin('Your plan is already filled in.', at(7, 'plan'), .07),
           phone('<div class="btn" style="--kd:%.2fs">Check in and plan my day</div>'
                 '<div class="stp">%s</div><div class="pres" style="--kd:%.2fs">Present &middot; checked in 8:12am</div>'
                 % (at(7, 'Check'), ''.join('<div class="st" style="--kd:%.2fs"><span>%s</span><b>%s</b></div>' % (at(7, 'filled') + i * .1, n, v)
                                           for i, (n, v) in enumerate([('Calls', '6'), ('Appointments', '2'), ('Fact finds', '2'), ('Applications', '1')])),
                    at(7, 'present')))),
        'checkin'))
    # 8 midday: need help, the manager hears
    sc.append(S(8,
        '<div class="half"><div class="L"><div class="eyebrow" style="--kd:.2s">12 noon</div><h1 class="ttl">%s</h1><h2 class="lead">%s</h2></div><div class="R">%s</div></div>'
        % (kin('How is it going?', at(8, 'how'), .09), kin('Need help? Your manager hears it straight away.', at(8, 'Need'), .06),
           phone('<div class="chips"><span style="--kd:%.2fs">On track</span><span style="--kd:%.2fs">A bit behind</span><span class="hl" style="--kd:%.2fs">Need help</span></div>'
                 '<div class="ping" style="--kd:%.2fs"><b>To your manager</b>Help asked for at midday</div>'
                 % (at(8, 'going'), at(8, 'going') + .15, at(8, 'Need'), at(8, 'manager')))),
        'mid'))
    # 9 close off
    ring2 = ('<svg class="ring big" viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="48" class="rt"/>'
             '<circle cx="60" cy="60" r="48" class="rf2" style="--kd:%.2fs"/><text x="60" y="68" text-anchor="middle">86%%</text></svg>' % at(9, 'did'))
    sc.append(S(9,
        '<div class="half"><div class="L"><div class="eyebrow" style="--kd:.2s">5:30pm</div><h1 class="ttl">%s</h1><h2 class="lead">%s</h2></div><div class="R">%s</div></div>'
        % (kin('Close off the day.', at(9, 'close'), .09), kin('What you planned. What you did.', at(9, 'planned'), .08),
           phone('<div class="cr">%s<small>of your plan, done</small></div>' % ring2)),
        'close'))
    # 10 one screen
    cards = [('Fact finds', 'what is open, and what is in the way'), ('Orphan clients', 'who is waiting for your call'),
             ('Should settle', 'the cases one step away'), ('Your calls today', 'names, in order')]
    sc.append(S(10,
        '<div class="mid"><div class="cards">%s</div><h1 class="go sm">%s</h1></div>'
        % (''.join('<div class="cd" style="--kd:%.2fs"><b>%s</b><span>%s</span></div>' % (at(10, w) if w else 1.0, n, s)
                   for (n, s), w in zip(cards, ['fact', 'orphan', 'settle', 'calls'])),
           kin('One screen.', at(10, 'One'), .12)),
        'screen'))
    # 11 no rankings
    sc.append(S(11,
        '<div class="mid"><div class="strike" style="--kd:%.2fs">No rankings.</div>'
        '<svg class="climb" viewBox="0 0 600 160" aria-hidden="true"><path style="--kd:%.2fs" d="M10 150 C 120 140, 180 110, 260 100 S 420 60, 590 12"/></svg>'
        '<h1 class="shout">%s</h1></div>'
        % (at(11, 'rankings'), at(11, 'Just'), kin('Just you, against your own best.', at(11, 'Just'), .08)),
        'best'))
    # 12 reset, rise
    sc.append(S(12,
        '<div class="mid"><div class="eyebrow" style="--kd:.15s">Ricky Rampersad Branch &middot; FY27</div><h1 class="end">%s</h1><h2 class="lead big">%s</h2></div>'
        % (kin('Reset. Rise.', .25, .3), kin('Let&rsquo;s make this the best year ever.', at(12, 'make'), .08)),
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
"""


def main():
    page = ('<!doctype html><html lang="en"><head><meta charset="utf-8">'
            '<title>Reset and rise: from today, every one of us</title><style>'
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
