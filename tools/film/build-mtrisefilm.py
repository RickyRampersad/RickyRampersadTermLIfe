#!/usr/bin/env python3
"""FY27 starts here: the film for the first meeting after the departures.

Built 30 October 2026, replacing a first cut that explained the meeting's
timetable.  The note back: "horrible and not motivating for a first meet no
excitement, remember we just lost a group of agents and rebuilding and this
is supposed to make a big impact".  He was right.  A branch that has just
lost people does not need a procedure; it needs to be shown what it still
has.

THE ARC IS THE DESIGN.  It opens cold and almost unlit, turns on the line
"look at what did not leave", and warms through cyan to emerald, ending on
the people still in the room.  Every scene after the turn is brighter than
the one before it.  The timetable survives as eight seconds in the middle,
because that is all it is worth.

WHAT IT MAY NOT SAY, and this is the rule the whole branch works to:
nobody who left is characterised, and nobody who left is COUNTED.  The hit
is named once, in one sentence, and the film never returns to it.  No
client name and no client count goes into an MP4 that sits at a public URL,
so the book is "a book of our own came home" and never a number.

Every figure on screen is the branch's own record, measured: the lapse
rate, the fact find, the requests closed, the people still here.

Re-cut:  edit the lines, push tts/job.json to the tts-run branch,
importvox.py <out> vomtrise 1.15 --timing mtrise-timing.json, then this,
then sfx.py / usetrack.py / render.js / mixany.py.
"""
import base64, json, pathlib, re, sys

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent.parent
OUT = ROOT / 'meetings' / 'fy27.html'
TIMING = HERE / 'mtrise-timing.json'


def b64(p, mime):
    return 'data:%s;base64,%s' % (mime, base64.b64encode(pathlib.Path(p).read_bytes()).decode())


MARK = b64(ROOT / 'orphan-transition' / 'board-mark.png', 'image/png')
PLEX = b64(HERE / 'fonts' / 'IBMPlexSans-latin.woff2', 'font/woff2')

T = json.loads(TIMING.read_text()) if TIMING.exists() else {}
DURS = [int(round(d * 1000)) for d in (T.get('durs') or [6.0] * 10)]
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


def build():
    sc = []

    # 1 ------------------------------------------------------------ the hit
    sc.append(S(1,
        '<div class="mid">'
        '<h1 class="cold">%s</h1>'
        '<div class="sub cold2" style="--kd:%.2fs">We will not pretend otherwise.</div>'
        '</div>' % (kin('This branch took a hit.', .35, .1), at(1, 'pretend')),
        'hit'))

    # 2 ------------------------------------------------------------ the turn
    sc.append(S(2,
        '<div class="mid"><div class="flare" style="--kd:%.2fs"></div>'
        '<h1 class="turn">%s</h1></div>'
        % (at(2, 'look'), kin('Now look at what stayed.', at(2, 'look'), .09)),
        'turn'))

    # 3 ------------------------------------------------- persistency, measured
    sc.append(S(3,
        '<div class="half">'
        '<div class="L"><div class="eyebrow" style="--kd:.2s">Lapse rate &middot; to 31 August</div>'
        '<div class="hero"><b class="cnt" data-to="4.96" data-dec="2" data-at="%.2f">4.96</b>'
        '<span>%%</span></div>'
        '<h2 class="lead">%s</h2></div>'
        '<div class="R"><div class="bars">'
        '<div class="bar us" style="--kd:%.2fs"><i></i><u>Us<br><b>4.96%%</b></u></div>'
        '<div class="bar them" style="--kd:%.2fs"><i></i><u>Main branches<br><b>8.82%%</b></u></div>'
        '</div></div></div>'
        % (at(3, 'four'), kin('The lowest of any branch.', at(3, 'lowest'), .07),
           at(3, 'four'), at(3, 'eight')),
        'lapse'))

    # 4 ---------------------------------------------------------- not one case
    sc.append(S(4,
        '<div class="mid">'
        '<div class="eyebrow" style="--kd:.2s">Our own fact find &middot; since launch</div>'
        '<div class="zero" style="--kd:%.2fs">0</div>'
        '<h2 class="lead">%s</h2></div>'
        % (at(4, 'one'), kin('Cases lapsed. Not one.', at(4, 'lapsed'), .09)),
        'zero'))

    # 5 --------------------------------------------------- the work, with fewer
    sc.append(S(5,
        '<div class="half">'
        '<div class="L"><div class="eyebrow" style="--kd:.2s">Client requests closed &middot; twelve months</div>'
        '<div class="hero"><b class="cnt" data-to="2495" data-sep="1" data-at="%.2f">2,495</b></div>'
        '<h2 class="lead">%s</h2></div>'
        '<div class="R"><div class="mbars">'
        '<div class="mb" style="--kd:%.2fs;--h:68%%"><i></i><u>Sep<br><b>204</b></u></div>'
        '<div class="mb up" style="--kd:%.2fs;--h:100%%"><i></i><u>Oct<br><b>240</b></u></div>'
        '</div><div class="fewer" style="--kd:%.2fs">with fewer of us</div></div></div>'
        % (at(5, 'Two'), kin('And October beat September.', at(5, 'October'), .07),
           at(5, 'September'), at(5, 'October', 1) if len(
               [w for w in WORDS[4] if re.sub(r'[^a-z]', '', str(w[1]).lower()) == 'october']) > 1
           else at(5, 'October'), at(5, 'fewer')),
        'work'))

    # 6 -------------------------------------------------- the book came home
    sc.append(S(6,
        '<div class="mid">'
        '<img class="mk" src="%s" alt="">'
        '<div class="stream">%s</div>'
        '<h2 class="lead big">%s</h2>'
        '<div class="sub" style="--kd:%.2fs">Waiting to hear from somebody who turns up.</div>'
        '</div>'
        % (MARK,
           ''.join('<i style="--kd:%.2fs;--a:%ddeg"></i>' % (at(6, 'book') + i * .07, i * 30)
                   for i in range(12)),
           kin('A book of our own came home.', at(6, 'book'), .07), at(6, 'waiting')),
        'book'))

    # 7 ------------------------------------------------------ the statement
    sc.append(S(7,
        '<div class="mid">'
        '<div class="strike" style="--kd:%.2fs">Not a branch in trouble.</div>'
        '<h1 class="shout">%s</h1></div>'
        % (at(7, 'trouble'),
           kin('A branch holding everything that matters.', at(7, 'holding'), .075)),
        'shout'))

    # 8 ---------------------------------------------------------- the meeting
    sc.append(S(8,
        '<div class="mid">'
        '<div class="eyebrow" style="--kd:.2s">FY27 starts here</div>'
        '<h1 class="date">%s</h1>'
        '<div class="asks">'
        '<div class="ask" style="--kd:%.2fs"><b>1</b>Bring one thing</div>'
        '<div class="ask" style="--kd:%.2fs"><b>2</b>Press <i>I am here</i></div>'
        '<div class="ask tag" style="--kd:%.2fs">That tap is the register</div>'
        '</div></div>'
        % (kin('Friday. Twelve noon.', .4, .1),
           at(8, 'Bring'), at(8, 'Press'), at(8, 'register')),
        'meet'))

    # 9 ------------------------------------------------- and how it will run
    sc.append(S(9,
        '<div class="mid">'
        '<div class="pair" style="--kd:%.2fs"><span>Every question</span>'
        '<em>an answer, or a name and a date</em></div>'
        '<div class="pair" style="--kd:%.2fs"><span>Every decision</span>'
        '<em>read back out loud</em></div></div>'
        % (at(9, 'question'), at(9, 'decision')),
        'run'))

    # 10 ------------------------------------------------------- still here
    sc.append(S(10,
        '<div class="mid">%s'
        '<div class="tally2" style="--kd:%.2fs">'
        '<b class="cnt" data-to="26" data-at="%.2f">26</b><span>of us &middot; more than 200 years between us</span>'
        '</div>'
        '<h1 class="go">%s</h1></div>'
        % (people(26, at(10, 'Twenty')), at(10, 'hundred'), at(10, 'Twenty'),
           kin('Still here. Let’s go.', at(10, 'Still'), .11)),
        'close'))

    return ''.join(sc)


CSS = """
@font-face{font-family:Plex;src:url(__PLEX__) format('woff2');font-weight:100 700;font-display:block}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1280px;height:720px;overflow:hidden;background:#04060A}
body{font-family:Plex,system-ui,sans-serif;color:#EEF3FA;-webkit-font-smoothing:antialiased}
#stage{position:relative;width:1280px;height:616px;overflow:hidden;background:#05070C}
#stage:before{content:'';position:absolute;inset:-25%;pointer-events:none;
  background:radial-gradient(60% 60% at 50% 50%,rgba(16,185,129,.16),transparent 70%);
  animation:breathe 9s ease-in-out infinite}
@keyframes breathe{0%,100%{transform:scale(1);opacity:.75}50%{transform:scale(1.18);opacity:1}}
#stage:after{content:'';position:absolute;inset:0;pointer-events:none;
  background:radial-gradient(1200px 700px at 50% 120%,rgba(0,0,0,.6),transparent 60%)}

.sc{position:absolute;left:0;top:0;width:1280px;height:616px;opacity:0;visibility:hidden}
.sc.act{opacity:1;visibility:visible;animation:pin .6s cubic-bezier(.15,.95,.2,1) both}
.sc.out{opacity:1;visibility:visible;animation:pout .6s cubic-bezier(.5,0,.85,.2) both}
@keyframes pin{from{opacity:0;transform:scale(1.06)}to{opacity:1;transform:none}}
@keyframes pout{from{opacity:1;transform:none}to{opacity:0;transform:scale(.97)}}
.in{position:absolute;left:0;top:0;width:1280px;height:616px;padding:44px 68px;
  display:flex;align-items:center}
.mid{width:100%;text-align:center}
.half{width:100%;display:flex;align-items:center;gap:62px}
.half .L{flex:1 1 0;min-width:0;text-align:left}
.half .R{flex:0 0 470px}

h1{font-size:66px;font-weight:600;line-height:1.06;letter-spacing:-1.4px}
h2{font-size:38px;font-weight:600;line-height:1.14;letter-spacing:-.5px}
h2.lead{margin-top:16px;color:#CBD7E8}
h2.lead.big{font-size:46px;margin-top:26px}
.kw{display:inline-block;animation:wup .55s cubic-bezier(.2,.9,.3,1) both;animation-delay:var(--kd)}
@keyframes wup{from{opacity:0;transform:translateY(26px) scale(.93);filter:blur(6px)}
  to{opacity:1;transform:none;filter:none}}
.eyebrow{font-size:14px;font-weight:600;letter-spacing:4px;text-transform:uppercase;
  color:#6EE7B7;margin-bottom:14px;animation:wup .5s both;animation-delay:var(--kd,.1s)}
.sub{font-size:26px;color:#9FB0C6;margin-top:22px;animation:wup .5s both;animation-delay:var(--kd)}

/* 1 - cold */
h1.cold{color:#8A97AA}
.cold2{color:#5E6B7E}

/* 2 - the turn */
.flare{position:absolute;left:50%;top:50%;width:10px;height:10px;margin:-5px 0 0 -5px;
  border-radius:50%;background:#6EE7B7;box-shadow:0 0 120px 70px rgba(110,231,183,.45);
  opacity:0;animation:burst 1.1s cubic-bezier(.1,.8,.2,1) both;animation-delay:var(--kd)}
@keyframes burst{0%{opacity:0;transform:scale(.2)}35%{opacity:1}100%{opacity:0;transform:scale(9)}}
h1.turn{position:relative;font-size:72px}

/* 3 - lapse */
.hero{display:flex;align-items:baseline;gap:8px}
.hero b{font-size:132px;font-weight:700;line-height:.9;color:#34D399;letter-spacing:-5px}
.hero span{font-size:52px;font-weight:600;color:#34D399}
.bars{display:flex;align-items:flex-end;gap:46px;height:330px}
.bar{position:relative;flex:1;display:flex;flex-direction:column;justify-content:flex-end;height:100%}
.bar i{display:block;border-radius:12px 12px 0 0;transform-origin:50% 100%;
  animation:grow .95s cubic-bezier(.2,.9,.25,1) both;animation-delay:var(--kd)}
.bar u{text-decoration:none;display:block;margin-top:12px;font-size:16px;color:#9FB0C6;line-height:1.35}
.bar u b{font-size:24px;color:#EEF3FA}
.bar.us i{height:33%;background:linear-gradient(180deg,#34D399,#0E9F6E);
  box-shadow:0 0 44px rgba(52,211,153,.5)}
.bar.them i{height:59%;background:#1E2735}
@keyframes grow{from{transform:scaleY(0)}to{transform:none}}

/* 4 - zero */
.zero{font-size:230px;font-weight:700;line-height:.86;color:#34D399;letter-spacing:-10px;
  animation:slam .6s cubic-bezier(.2,1.5,.35,1) both;animation-delay:var(--kd)}
@keyframes slam{from{opacity:0;transform:scale(2.4);filter:blur(12px)}
  to{opacity:1;transform:none;filter:none}}

/* 5 - the work */
.mbars{display:flex;align-items:flex-end;gap:54px;height:300px}
.mb{position:relative;flex:1;display:flex;flex-direction:column;justify-content:flex-end;height:100%}
.mb i{display:block;height:var(--h);border-radius:12px 12px 0 0;background:#1E2735;
  transform-origin:50% 100%;animation:grow .9s cubic-bezier(.2,.9,.25,1) both;
  animation-delay:var(--kd)}
.mb.up i{background:linear-gradient(180deg,#34D399,#0E9F6E);box-shadow:0 0 44px rgba(52,211,153,.45)}
.mb u{text-decoration:none;display:block;margin-top:12px;font-size:16px;color:#9FB0C6;line-height:1.35}
.mb u b{font-size:26px;color:#EEF3FA}
.fewer{margin-top:16px;font-size:20px;color:#6EE7B7;font-weight:600;
  animation:wup .5s both;animation-delay:var(--kd)}

/* 6 - the book */
.mk{width:96px;height:96px;border-radius:22px;display:block;margin:0 auto;position:relative;z-index:2;
  animation:pop .7s cubic-bezier(.2,1.5,.4,1) both}
@keyframes pop{from{opacity:0;transform:scale(.45)}to{opacity:1;transform:none}}
.stream{position:absolute;left:50%;top:50%;width:0;height:0}
.stream i{position:absolute;left:0;top:0;width:9px;height:9px;margin:-4px 0 0 -4px;
  border-radius:50%;background:#6EE7B7;
  animation:home 1.5s cubic-bezier(.3,.1,.2,1) both;animation-delay:var(--kd)}
@keyframes home{from{opacity:0;transform:rotate(var(--a)) translateX(620px)}
  40%{opacity:1}to{opacity:0;transform:rotate(var(--a)) translateX(70px)}}

/* 7 - the statement */
.strike{font-size:34px;color:#5E6B7E;text-decoration:line-through;
  text-decoration-color:#F87171;text-decoration-thickness:3px;margin-bottom:22px;
  animation:wup .5s both;animation-delay:var(--kd)}
h1.shout{font-size:72px;color:#FFFFFF}

/* 8 - the meeting */
h1.date{font-size:78px;color:#34D399}
.asks{display:flex;gap:16px;justify-content:center;flex-wrap:wrap;margin-top:34px}
.ask{display:flex;align-items:center;gap:12px;padding:14px 22px;border-radius:999px;
  background:rgba(52,211,153,.1);border:1px solid rgba(52,211,153,.32);font-size:23px;
  animation:rup .55s cubic-bezier(.2,1.3,.4,1) both;animation-delay:var(--kd)}
.ask b{width:30px;height:30px;border-radius:50%;background:#34D399;color:#042a1d;
  display:flex;align-items:center;justify-content:center;font-size:16px}
.ask.tag{background:none;border-color:transparent;color:#6EE7B7;font-weight:600}
@keyframes rup{from{opacity:0;transform:translateY(18px) scale(.9)}to{opacity:1;transform:none}}

/* 9 - how it runs */
.pair{display:flex;align-items:baseline;justify-content:center;gap:22px;margin:18px 0;
  animation:slin .6s cubic-bezier(.2,.9,.3,1) both;animation-delay:var(--kd)}
.pair span{font-size:44px;font-weight:600;color:#FFFFFF}
.pair em{font-style:normal;font-size:30px;color:#6EE7B7}
@keyframes slin{from{opacity:0;transform:translateX(-40px)}to{opacity:1;transform:none}}

/* 10 - still here */
.crowd{display:flex;flex-wrap:wrap;gap:10px 12px;justify-content:center;max-width:720px;
  margin:0 auto 26px}
.pp{width:34px;height:38px;fill:#34D399;
  animation:prise .6s cubic-bezier(.2,1.4,.4,1) both;animation-delay:var(--kd)}
@keyframes prise{from{opacity:0;transform:translateY(22px) scale(.7)}to{opacity:1;transform:none}}
.tally2{display:flex;align-items:baseline;gap:14px;justify-content:center;margin-bottom:18px;
  animation:wup .5s both;animation-delay:var(--kd)}
.tally2 b{font-size:62px;font-weight:700;color:#FFFFFF;line-height:1}
.tally2 span{font-size:21px;color:#9FB0C6}
h1.go{font-size:62px;color:#FFFFFF}
"""


def main():
    page = ('<!doctype html><html lang="en"><head><meta charset="utf-8">'
            '<title>FY27 starts here</title><style>'
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
