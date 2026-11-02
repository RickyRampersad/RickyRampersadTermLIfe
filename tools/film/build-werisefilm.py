#!/usr/bin/env python3
"""From Friday, we rise: the short film after the branch meeting of Fri 30 Oct 2026.

Asked for on 2 Nov 2026: "a small little voice video ... arising out of the Friday meeting ... from Friday,
we rise and reinvent ourselves and reset ... it's up to everyone, because they have all the data at their
fingertips. We will know what they're doing and they will know what we are doing. So screenshots as to our
new way forward."

Every screen is a real page of the branch's own, shot against the test harnesses' mocked backends
(tests/e2e-agent-workday.js, e2e-coach.js, e2e-managers.js, the branch app's ?demo=a, the wall's ?demo=1,
the meeting builder's agenda). The clients on them are made up; the staff and agents are the branch's own,
as in the Log Book films. No client of the branch and no real figure is in it.

Midnight blue and the blue shield, the board films' look, because the branch app and My day carry it.

Re-cut:  python3 build-werisefilm.py, then sfx.py / usetrack.py / render.js / mixany.py as the other films.
"""
import base64, json, pathlib, re, sys

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent.parent
SHOTS = HERE / 'wrshots'
OUT = ROOT / 'werise' / 'film.html'
T = json.loads((HERE / 'werise-timing.json').read_text())
DURS = [int(round(d * 1000)) for d in T['durs']]
WORDS = [l.get('words', []) for l in T['lines']]


def b64(p, mime):
    return 'data:%s;base64,%s' % (mime, base64.b64encode(pathlib.Path(p).read_bytes()).decode())


IMG = {k: b64(SHOTS / (k + '.jpg'), 'image/jpeg') for k in ['app', 'plan', 'close', 'coach', 'timeline', 'wall', 'agenda']}
MARK = b64(ROOT / 'orphan-transition' / 'board-mark.png', 'image/png')
PLEX = b64(HERE / 'fonts' / 'IBMPlexSans-latin.woff2', 'font/woff2')


def at(n, word, k=0):
    """The second a spoken word begins (plus the mixer's 0.4s lead), so a reveal lands on its word."""
    want = re.sub(r'[^a-z]', '', word.lower())
    hits = [w for w in WORDS[n - 1] if re.sub(r'[^a-z]', '', str(w[1]).lower()) == want]
    return round(float(hits[k][0]) + 0.4, 2) if len(hits) > k else 1.0


def S(n, body, cls=''):
    return '<section class="sc %s" data-d="%d"><div class="in">%s</div></section>' % (cls, DURS[n - 1], body)


def kin(text, d=0.0, step=0.06):
    return ' '.join('<span class="kw" style="--kd:%.2fs">%s</span>' % (d + i * step, w) for i, w in enumerate(text.split(' ')))


def screen(key, h_img, n, win=500, w=300, start=0.9):
    """A phone-width card that scrolls slowly down the real page across the scene."""
    shown = h_img * w / 600.0
    travel = max(0, shown - win)
    dur = max(1.0, DURS[n - 1] / 1000.0 - start - 0.8)
    return ('<div class="scr" style="width:%dpx;height:%dpx"><img src="%s" style="--ty:-%dpx;--pd:%.2fs;--ps:%.2fs" alt=""></div>'
            % (w, win, IMG[key], travel, dur, start))


def build():
    sc = []
    # 1 the title
    sc.append(S(1,
        '<div class="mid"><img class="mk" src="%s" alt="">'
        '<div class="eyebrow" style="--kd:.3s">Friday 30 October &middot; the branch meeting</div>'
        '<h1>%s</h1>'
        '<div class="trio"><span class="hot" style="--kd:%.2fs">Rise</span><i style="--kd:%.2fs">&middot;</i><span style="--kd:%.2fs">Reinvent</span><i style="--kd:%.2fs">&middot;</i><span style="--kd:%.2fs">Reset</span></div>'
        '</div>' % (MARK, kin('From Friday, we rise.', at(1, 'From') - 0.2), at(1, 'rise') + 0.5, at(1, 'reinvent'), at(1, 'reinvent'), at(1, 'reset'), at(1, 'reset')),
        'title'))
    # 2 the branch app
    sc.append(S(2,
        '<div class="split"><div class="L"><div class="eyebrow">One sign in</div>'
        '<h2>%s</h2>'
        '<div class="chips"><span class="chip" style="--kd:%.2fs">Log Book</span><span class="chip" style="--kd:%.2fs">My clients</span>'
        '<span class="chip" style="--kd:%.2fs">Fact Find</span><span class="chip hi" style="--kd:%.2fs">My day</span></div>'
        '<div class="url" style="--kd:%.2fs">rickyrampersadbranch.com<b>/app</b></div></div>'
        '<div class="R">%s</div></div>'
        % (kin('The Branch App. Every tool, one place.', at(2, 'Branch') - 0.2), at(2, 'tool'), at(2, 'tool') + 0.2,
           at(2, 'tool') + 0.4, at(2, 'one', 1), at(2, 'place'), screen('app', 1298, 2, start=0.6)),
        'app'))
    # 3 the morning projection
    sc.append(S(3,
        '<div class="split"><div class="L"><div class="eyebrow">Every morning</div>'
        '<h2>%s</h2>'
        '<div class="clock"><div class="ck" style="--kd:%.2fs"><b>2</b><span>minutes</span></div>'
        '<div class="ck hot" style="--kd:%.2fs"><b>10:30</b><span>projected by</span></div></div>'
        '<div class="note" style="--kd:%.2fs">Your manager gets a copy.</div></div>'
        '<div class="R">%s</div></div>'
        % (kin('Your day lands. Project it.', at(3, 'day') - 0.2), at(3, 'two'), at(3, 'half'), at(3, 'half') + 0.8,
           screen('plan', 1536, 3)),
        'plan'))
    # 4 the close-off and the balance
    sc.append(S(4,
        '<div class="split"><div class="L"><div class="eyebrow">At 5:30pm</div>'
        '<h2>%s</h2>'
        '<div class="bal" style="--kd:%.2fs"><div><span>Projected</span><b class="cnt" data-to="24" data-at="%d">0</b></div>'
        '<div><span>Done</span><b class="cnt" data-to="22" data-at="%d">0</b></div>'
        '<div class="neg"><span>Balance</span><b>&minus;2</b></div></div>'
        '<div class="note" style="--kd:%.2fs">Every line, against what you said you would do.</div></div>'
        '<div class="R">%s</div></div>'
        % (kin('Close it off. The day balances.', at(4, 'close') - 0.2), at(4, 'balances'),
           int(at(4, 'balances') * 1000), int(at(4, 'balances') * 1000) + 250, at(4, 'said'), screen('close', 1535, 4)),
        'close'))
    # 5 the staff coach
    sc.append(S(5,
        '<div class="split"><div class="L"><div class="eyebrow">Our staff</div>'
        '<h2>%s</h2>'
        '<div class="steps"><span style="--kd:%.2fs">In</span><span style="--kd:%.2fs">Scrub</span><span class="hot" style="--kd:%.2fs">Update</span>'
        '<span style="--kd:%.2fs">Lunch</span><span style="--kd:%.2fs">Close</span><span style="--kd:%.2fs">Out</span></div></div>'
        '<div class="R">%s</div></div>'
        % (kin('A coach on the screen, all day.', at(5, 'coach') - 0.3),
           at(5, 'telling'), at(5, 'telling') + .15, at(5, 'next'), at(5, 'next') + .15, at(5, 'all'), at(5, 'long'),
           screen('coach', 1200, 5)),
        'coach'))
    # 6 the managers, as it happens
    sc.append(S(6,
        '<div class="split"><div class="L"><div class="eyebrow">Your managers</div>'
        '<h2>%s</h2>'
        '<div class="who"><div style="--kd:%.2fs">Who called.</div><div style="--kd:%.2fs">Who wrote.</div><div class="hot" style="--kd:%.2fs">What moved.</div></div></div>'
        '<div class="R">%s</div></div>'
        % (kin('The work, as it happens.', at(6, 'work') - 0.2), at(6, 'called'), at(6, 'wrote'), at(6, 'moved'),
           screen('timeline', 864, 6)),
        'mgr'))
    # 7 the wall and Wednesday's meeting
    sc.append(S(7,
        '<div class="mid"><div class="eyebrow">Everyone sees the score</div>'
        '<div class="duo"><div class="lap" style="--kd:%.2fs"><img src="%s" alt=""><span>The wall</span></div>'
        '<div class="lap" style="--kd:%.2fs"><img src="%s" alt=""><span>Every Wednesday, 9am</span></div></div></div>'
        % (at(7, 'wall'), IMG['wall'], at(7, 'meeting'), IMG['agenda']),
        'wall'))
    # 8 both ways
    sc.append(S(8,
        '<div class="mid"><div class="eyebrow">Both ways</div>'
        '<div class="ways"><div class="wy" style="--kd:%.2fs"><b>You</b><span>know what we are doing</span></div>'
        '<div class="arr" style="--kd:%.2fs">&#8644;</div>'
        '<div class="wy" style="--kd:%.2fs"><b>We</b><span>know what you are doing</span></div></div>'
        '<h2 class="tips">%s</h2></div>'
        % (at(8, 'You'), at(8, 'We'), at(8, 'We'), kin('The data is at your fingertips.', at(8, 'data') - 0.3)),
        'ways8'))
    # 9 the close
    sc.append(S(9,
        '<div class="mid"><img class="mk sm" src="%s" alt="">'
        '<div class="eyebrow" style="--kd:%.2fs">The rest is up to you</div>'
        '<div class="end"><span style="--kd:%.2fs">Log in.</span><span style="--kd:%.2fs">Log out.</span><span class="hot" style="--kd:%.2fs">Rise.</span></div>'
        '<div class="note" style="--kd:%.2fs">Reply <b>IN</b> on the branch group once your day is projected.</div></div>'
        % (MARK, at(9, 'rest'), at(9, 'in'), at(9, 'out'), at(9, 'rise'), at(9, 'rise') + 0.7),
        'end9'))
    return '\n'.join(sc)


CSS = """
@font-face{font-family:Plex;src:url(__PLEX__) format('woff2');font-weight:100 700;font-display:block}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1280px;height:720px;overflow:hidden;background:#05101f}
body{font-family:Plex,system-ui,sans-serif;color:#EAF1FF;-webkit-font-smoothing:antialiased}
#stage{position:relative;width:1280px;height:616px;overflow:hidden;
  background:radial-gradient(1100px 700px at 72% 18%,#13284d 0%,#0a1930 45%,#070F26 100%)}
#stage:before{content:'';position:absolute;inset:-20%;pointer-events:none;
  background:radial-gradient(500px 300px at 20% 80%,rgba(0,229,255,.10),transparent 70%),
  radial-gradient(520px 320px at 85% 20%,rgba(42,109,224,.16),transparent 70%);animation:drift 18s ease-in-out infinite alternate}
@keyframes drift{from{transform:translate(0,0)}to{transform:translate(4%,-3%)}}
.sc{position:absolute;left:0;top:0;width:1280px;height:616px;opacity:0;visibility:hidden}
.sc.act{opacity:1;visibility:visible;animation:zin .72s cubic-bezier(.2,.7,.2,1) both}
.sc.out{opacity:1;visibility:visible;animation:zout .72s cubic-bezier(.4,0,.8,.3) both}
@keyframes zin{from{transform:scale(1.07);filter:blur(10px);opacity:0}to{transform:none;filter:none;opacity:1}}
@keyframes zout{from{transform:none;opacity:1}to{transform:scale(.95);opacity:0;filter:blur(6px)}}
.in{position:absolute;left:0;top:0;width:1280px;height:616px;padding:46px 80px;display:flex;align-items:center}
.mid{width:100%;text-align:center}
.split{width:100%;display:flex;align-items:center;gap:64px}
.split .L{flex:1;min-width:0}
.split .R{flex:0 0 300px;position:relative}
.mk{width:96px;height:96px;border-radius:22px;display:block;margin:0 auto 22px;animation:pop .7s cubic-bezier(.2,1.5,.4,1) both}
.mk.sm{width:70px;height:70px;border-radius:16px}
@keyframes pop{from{transform:scale(.4);opacity:0}to{transform:none;opacity:1}}
h1{font-size:64px;font-weight:600;line-height:1.1;letter-spacing:-.8px}
h2{font-size:44px;font-weight:600;line-height:1.14;letter-spacing:-.5px}
.kw{display:inline-block;animation:wup .5s cubic-bezier(.2,.9,.3,1) both;animation-delay:var(--kd)}
@keyframes wup{from{opacity:0;transform:translateY(16px) scale(.96);filter:blur(4px)}to{opacity:1;transform:none;filter:none}}
.eyebrow{font-size:15px;font-weight:600;letter-spacing:3px;text-transform:uppercase;color:#00E5FF;margin-bottom:16px;
  animation:wup .5s both;animation-delay:var(--kd,.15s)}
.note{font-size:21px;color:#BFD3F7;margin-top:24px;line-height:1.4;animation:wup .5s both;animation-delay:var(--kd)}
.note b{color:#00E5FF}
.hot{color:#00E5FF}
.trio{display:flex;justify-content:center;align-items:center;gap:22px;margin-top:30px;font-size:30px;font-weight:600}
.trio span{animation:pop .55s cubic-bezier(.2,1.5,.4,1) both;animation-delay:var(--kd)}
.trio i{font-style:normal;color:#4b6a9b;animation:wup .4s both;animation-delay:var(--kd)}
.scr{border-radius:26px;overflow:hidden;border:5px solid #1b2b47;background:#0b1220;box-shadow:0 28px 64px rgba(3,10,22,.75);
  animation:ph .8s cubic-bezier(.2,.8,.25,1) both}
.scr img{width:100%;display:block;animation:pan var(--pd) cubic-bezier(.45,.05,.55,.95) both;animation-delay:var(--ps)}
@keyframes pan{from{transform:translateY(0)}to{transform:translateY(var(--ty))}}
@keyframes ph{from{opacity:0;transform:translateY(34px) rotate(2deg)}to{opacity:1;transform:none}}
.chips{display:flex;flex-wrap:wrap;gap:12px;margin-top:28px}
.chip{font-size:19px;padding:10px 18px;border-radius:999px;background:rgba(42,109,224,.22);border:1px solid rgba(42,109,224,.5);
  animation:wup .45s both;animation-delay:var(--kd)}
.chip.hi{background:rgba(0,229,255,.16);border-color:rgba(0,229,255,.6);color:#00E5FF}
.url{font-size:26px;font-weight:300;margin-top:30px;animation:wup .5s both;animation-delay:var(--kd)}
.url b{font-weight:700;color:#00E5FF}
.clock{display:flex;gap:22px;margin-top:30px}
.ck{flex:0 0 190px;padding:18px 20px;border-radius:18px;background:rgba(255,255,255,.05);border:1px solid rgba(160,190,230,.2);
  animation:wup .5s both;animation-delay:var(--kd)}
.ck b{display:block;font-size:46px;font-weight:600}
.ck span{font-size:16px;color:#BFD3F7}
.ck.hot{border-color:rgba(0,229,255,.55);background:rgba(0,229,255,.08)}
.bal{display:flex;gap:16px;margin-top:30px;animation:wup .5s both;animation-delay:var(--kd)}
.bal div{flex:0 0 150px;padding:16px 18px;border-radius:16px;background:rgba(255,255,255,.05);border:1px solid rgba(160,190,230,.2)}
.bal span{display:block;font-size:15px;color:#BFD3F7;margin-bottom:6px}
.bal b{font-size:44px;font-weight:600}
.bal .neg{border-color:rgba(255,133,133,.5)}
.bal .neg b{color:#ff8585}
.steps{display:flex;gap:10px;margin-top:30px;flex-wrap:wrap}
.steps span{font-size:18px;padding:10px 16px;border-radius:12px;background:rgba(255,255,255,.06);border:1px solid rgba(160,190,230,.22);
  animation:wup .4s both;animation-delay:var(--kd)}
.steps span.hot{background:rgba(255,196,77,.16);border-color:rgba(255,196,77,.6);color:#ffd27a}
.who{margin-top:26px}
.who div{font-size:34px;font-weight:600;margin:8px 0;animation:wup .45s both;animation-delay:var(--kd)}
.duo{display:flex;gap:34px;justify-content:center;margin-top:20px}
.lap{flex:0 0 520px;animation:ph .7s both;animation-delay:var(--kd)}
.lap img{width:520px;border-radius:14px;border:1px solid rgba(160,190,230,.3);box-shadow:0 24px 56px rgba(3,10,22,.7);display:block}
.lap span{display:block;font-size:22px;font-weight:600;margin-top:16px}
.ways{display:flex;align-items:center;justify-content:center;gap:34px;margin:28px 0 40px}
.wy{flex:0 0 360px;padding:30px 24px;border-radius:22px;background:rgba(255,255,255,.05);border:1px solid rgba(160,190,230,.22);
  animation:wup .55s both;animation-delay:var(--kd)}
.wy b{display:block;font-size:56px;font-weight:600;color:#00E5FF}
.wy span{display:block;font-size:22px;color:#BFD3F7;margin-top:8px}
.arr{font-size:52px;color:#00E5FF;animation:pop .6s cubic-bezier(.2,1.5,.4,1) both;animation-delay:var(--kd)}
.tips{font-size:40px}
.end{display:flex;justify-content:center;gap:30px;font-size:72px;font-weight:600;letter-spacing:-1px;margin-top:6px}
.end span{animation:pop .55s cubic-bezier(.2,1.5,.4,1) both;animation-delay:var(--kd)}
#strip{position:absolute;left:0;top:616px;width:1280px;height:104px;background:#05101f}
"""


def main():
    OUT.parent.mkdir(exist_ok=True)
    page = ('<!doctype html><html lang="en"><head><meta charset="utf-8"><title>From Friday, we rise</title>'
            '<style>' + CSS.replace('__PLEX__', PLEX) + '</style></head><body>'
            '<div id="stage">' + build() + '</div><div id="strip"></div><script>'
            'var SC=[].slice.call(document.querySelectorAll(".sc"));var paused=false,timer=null,cur=-1;'
            'function go(n){if(cur>=0&&SC[cur]){SC[cur].classList.remove("act");SC[cur].classList.add("out");}'
            'var p=cur;cur=n;SC[n].classList.remove("out");SC[n].offsetWidth;SC[n].classList.add("act");'
            'if(p>=0&&SC[p])setTimeout(function(){SC[p].classList.remove("out");},720);'
            'if(!paused&&!window.__RENDER){timer=setTimeout(function(){go((n+1)%SC.length);},+SC[n].dataset.d);}}'
            'go(0);</script></body></html>')
    OUT.write_text(page)
    RESERVED = {'act', 'out', 'cnt', 'sc', 'in', 'rolling'}
    for m in re.finditer(r'([^{}]+)\{', CSS):
        head = m.group(1).strip()
        if head.startswith('@') or head in ('from', 'to'):
            continue
        for sel in head.split(','):
            subject = re.split(r'[\s>+~]+', sel.strip())[-1]
            for cls in re.findall(r'\.([a-zA-Z][\w-]*)', subject):
                if cls in RESERVED and subject not in ('.sc', '.sc.act', '.sc.out', '.in'):
                    sys.exit('RESERVED CLASS: %s' % sel)
    print('wrote %s  (%d scenes, %.1fs, %d KB)' % (OUT, len(DURS), sum(DURS) / 1000.0, len(page) // 1024))


if __name__ == '__main__':
    main()
