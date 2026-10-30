#!/usr/bin/env python3
"""The meeting sign-in film: what to do, and what is expected.

Built 29 October 2026, the evening before the branch meeting, asked for as
"can you do a small vid as to what to do and whats expected?"

The phone screens are the REAL meetings gate, shot by shots.js against a
fully mocked backend, so nothing was written to the live sheet.  The agent
number and the name on them are invented: no real agent number, and no
client anything, goes into an MP4 that sits at a public URL.

It carries the GOLD shield, not the board blue, because the page it teaches
carries gold and every screen inside it shows gold.  A film whose mark
disagrees with the screens it is made of is the first thing a room notices.

THE ONE THING THIS FILM MUST GET RIGHT: there are two taps, not one.
apiLogin_ writes only to the Log tab; apiCheckIn_ alone writes the
attendance row.  "Signing in is the register" is a slogan about there being
no password - it is not the attendance mark.  Teach one tap and the branch
signs in tonight, believes it is present, and never presses "I am here".

Re-cut:  python3 build-mtfilm.py   then sfx.py / usetrack.py / render.js /
mixany.py / chapters.py, as the board films do.
"""
import base64, json, os, pathlib, re, sys

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent.parent
SHOTS = pathlib.Path(os.environ.get('MT_SHOTS', HERE / 'mtshots'))
OUT = ROOT / 'meetings' / 'film.html'
TIMING = HERE / 'mtsign-timing.json'

def b64(p, mime):
    return 'data:%s;base64,%s' % (mime, base64.b64encode(pathlib.Path(p).read_bytes()).decode())

SHOT = {k: b64(SHOTS / (k + '.jpg'), 'image/jpeg')
        for k in ['01-gate', '02-typed', '03-here', '04-done', '05-guest',
                  'c-typed', 'c-here', 'c-done', 'c-guest']}
MARK = b64(ROOT / 'logo-mark.png', 'image/png')
PLEX = b64(HERE / 'fonts' / 'IBMPlexSans-latin.woff2', 'font/woff2')

T = json.loads(TIMING.read_text()) if TIMING.exists() else {}
#  importvox writes SECONDS; data-d is MILLISECONDS. Mixing them builds a
#  twelve-scene film a tenth of a second long and nothing complains.
DURS = [int(round(d * 1000)) for d in (T.get('durs') or [5.0] * 12)]
#  Each word is [seconds, word], in that order.
WORDS = [l.get('words', []) for l in T.get('lines', [])]

def at(n, word, k=0):
    """The second a spoken word begins, so a reveal lands on the word that
    names it.  0.4s is the lead the mixer gives the voice."""
    try:
        ws = WORDS[n - 1]
    except Exception:
        return 1.0
    want = re.sub(r'[^a-z]', '', word.lower())
    hits = [w for w in ws if re.sub(r'[^a-z]', '', str(w[1]).lower()) == want]
    if len(hits) > k:
        return round(float(hits[k][0]) + 0.4, 2)
    return 1.0

def phone(src, cls=''):
    return ('<div class="phone %s"><img src="%s" alt=""></div>' % (cls, src))


def card(src, cls=''):
    """The card on its own, cropped by the element itself. A phone at 272px
       in a 1280 frame renders the field they must type into about 10px tall."""
    return ('<div class="cardshot %s"><img src="%s" alt=""></div>' % (cls, src))

#  ----------------------------------------------------------------- scenes
def S(n, body, cls=''):
    return '<section class="sc %s" data-d="%d"><div class="in">%s</div></section>' % (cls, DURS[n - 1], body)

def kin(text, d=0.0):
    out = []
    for i, w in enumerate(text.split(' ')):
        out.append('<span class="kw" style="--kd:%.2fs">%s</span>' % (d + i * 0.055, w))
    return ' '.join(out)

def build():
    sc = []

    # 1 ---------------------------------------------------------- the title
    sc.append(S(1,
        '<div class="mid">'
        '<img class="mk" src="%s" alt="">'
        '<div class="eyebrow" style="--kd:.5s">The branch meeting</div>'
        '<h1>%s</h1>'
        '<div class="sub" style="--kd:%.2fs">Friday 30 October &middot; 12 noon</div>'
        '</div>' % (MARK, kin('How to sign in, and what we expect.', 0.9), at(1, 'twelve')),
        'title'))

    # 2 ------------------------------------------------------------ the URL
    sc.append(S(2,
        '<div class="split">'
        '<div class="L">'
        '<div class="eyebrow">Step one</div>'
        '<div class="url" style="--kd:%.2fs">rickyrampersadbranch.com<br><b>/meetings</b></div>'
        '<div class="note" style="--kd:%.2fs">Any phone. Nothing to install.</div>'
        '</div>'
        '<div class="R">%s</div></div>' % (at(2, 'Open'), at(2, 'meetings'), phone(SHOT['01-gate'])),
        'url'))

    # 3 -------------------------------------------------- the agent number
    sc.append(S(3,
        '<div class="split">'
        '<div class="L">'
        '<div class="eyebrow">Step two</div>'
        '<h2>%s</h2>'
        '<div class="chips">'
        '<span class="chip" style="--kd:%.2fs">The one on your card</span>'
        '<span class="chip no" style="--kd:%.2fs">No password</span>'
        '<span class="chip no" style="--kd:%.2fs">Nothing to remember</span>'
        '</div></div>'
        '<div class="R">%s</div></div>'
        % (kin('Type your agent number.', 0.3), at(3, 'card'),
           at(3, 'password'), at(3, 'remember'), card(SHOT['c-typed'])),
        'type wide'))

    # 4 ------------------------------------------- in the room, not present
    sc.append(S(4,
        '<div class="split">'
        '<div class="L">'
        '<div class="eyebrow">Careful</div>'
        '<div class="two">'
        '<div class="row good" style="--kd:.4s"><b>&#10003;</b><span>You are in the room</span></div>'
        '<div class="row bad" style="--kd:%.2fs"><b>&#10007;</b><span>You are <u>not</u> on the register</span></div>'
        '</div>'
        '<div class="note" style="--kd:%.2fs">Signing in is not the attendance mark.</div>'
        '</div>'
        '<div class="R">%s</div></div>'
        % (at(4, 'not'), at(4, 'yet'), phone(SHOT['03-here'], 'dim')),
        'notyet'))

    # 5 ------------------------------------------------------- press it
    sc.append(S(5,
        '<div class="split">'
        '<div class="L">'
        '<div class="eyebrow">Step three</div>'
        '<h2>%s</h2>'
        '<div class="btnish" style="--kd:%.2fs">&#10003;&nbsp; I am here</div>'
        '</div>'
        '<div class="R">%s<div class="ring" style="--kd:%.2fs"></div></div></div>'
        % (kin('The card asks: are you here?', 0.3), at(5, 'Press'),
           card(SHOT['c-here']), at(5, 'Press')),
        'press wide'))

    # 6 ------------------------------------------------------ the register
    sc.append(S(6,
        '<div class="split">'
        '<div class="L">'
        '<div class="eyebrow">That tap is the register</div>'
        '<h2>%s</h2>'
        '<div class="note" style="--kd:%.2fs">There is nothing else to sign.</div>'
        '</div>'
        '<div class="R">%s</div></div>'
        % (kin('Time-stamped, on the spot.', 0.3), at(6, 'nothing'), card(SHOT['c-done'])),
        'done wide'))

    # 7 --------------------------------------------------- press it or not
    sc.append(S(7,
        '<div class="mid">'
        '<div class="eyebrow">So press it</div>'
        '<div class="cards">'
        '<div class="cd ok" style="--kd:.5s"><div class="t">Pressed it</div>'
        '<div class="v">PRESENT</div><div class="m">time-stamped</div></div>'
        '<div class="cd no" style="--kd:%.2fs"><div class="t">Signed in, never pressed</div>'
        '<div class="v">ABSENT</div><div class="m">no row on the register</div></div>'
        '</div></div>' % at(7, 'absent'),
        'two'))

    # 8 --------------------------------------------------------- the clock
    sc.append(S(8,
        '<div class="mid">'
        '<div class="eyebrow">Tomorrow</div>'
        '<div class="rail">'
        '<div class="tk" style="--kd:%.2fs"><b>11:30</b><span>the button opens</span></div>'
        '<div class="ln"></div>'
        '<div class="tk hi" style="--kd:%.2fs"><b>12:00</b><span>we start</span></div>'
        '<div class="ln"></div>'
        '<div class="tk late" style="--kd:%.2fs"><b>after</b><span>present, but late</span></div>'
        '</div></div>' % (at(8, 'half'), at(8, 'twelve'), at(8, 'twelve') + 0.15),
        'clock'))

    # 9 ------------------------------------------------------ ninety minutes
    sc.append(S(9,
        '<div class="mid">'
        '<div class="eyebrow">What we expect</div>'
        '<h2 class="big"><span class="cnt" data-to="90" data-at="%d">0</span> minutes</h2>'
        '<div class="bar">'
        '<div class="bs read" style="--w:11.1%%;--kd:%.2fs"><b>10</b><span>to read</span></div>'
        '<div class="bs talk" style="--w:55.6%%;--kd:%.2fs"><b>50</b><span>to discuss</span></div>'
        '<div class="bs dec" style="--w:22.2%%;--kd:%.2fs"><b>20</b><span>to decide</span></div>'
        '</div></div>'
        % (int(at(9, 'Ninety') * 1000), at(9, 'read'), at(9, 'discuss'), at(9, 'decide')),
        'ninety'))

    # 10 ------------------------------------------------- a name and a date
    sc.append(S(10,
        '<div class="mid">'
        '<div class="eyebrow">Every decision</div>'
        '<h2>%s</h2>'
        '<div class="acts">'
        '<div class="ah"><span>What was decided</span><span>Who</span><span>By when</span></div>'
        '<div class="ar" style="--kd:%.2fs"><span>Re-check the lapsed list</span>'
        '<span class="w">The unit manager</span><span class="w">Fri 6 Nov</span></div>'
        '</div>'
        '<div class="note">No name, no date &mdash; it did not happen.</div>'
        '</div>' % (kin('Nothing leaves without a name and a date.', 0.3),
                    at(10, 'name')),
        'named'))

    # 11 ------------------------------------------------------- the visitor
    sc.append(S(11,
        '<div class="split">'
        '<div class="L">'
        '<div class="eyebrow">Looking in, not attending?</div>'
        '<div class="zeros" style="--kd:%.2fs"><i>0</i><i>0</i><i>0</i><i>0</i></div>'
        '<div class="note" style="--kd:%.2fs">Give your name and your role. '
        'Visitors are never counted on the branch register.</div>'
        '</div>'
        '<div class="R">%s</div></div>'
        % (at(11, 'zero'), at(11, 'role'), card(SHOT['c-guest'])),
        'guest wide'))

    # 12 ----------------------------------------------------------- the close
    sc.append(S(12,
        '<div class="mid">'
        '<img class="mk sm" src="%s" alt="">'
        '<h1>%s</h1>'
        '<div class="url close" style="--kd:%.2fs">rickyrampersadbranch.com<b>/meetings</b></div>'
        '<div class="note" style="--kd:%.2fs">If you cannot get in, say so tonight.</div>'
        '</div>' % (MARK, kin('Try it tonight.', 0.4), at(12, 'tonight'), at(12, 'cannot')),
        'close'))

    return '\n'.join(sc)

CSS = """
@font-face{font-family:Plex;src:url(__PLEX__) format('woff2');font-weight:100 700;font-display:block}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1280px;height:720px;overflow:hidden;background:#05101f}
body{font-family:Plex,system-ui,sans-serif;color:#EAF1FF;-webkit-font-smoothing:antialiased}
#stage{position:relative;width:1280px;height:616px;overflow:hidden;
  background:radial-gradient(1100px 700px at 72% 18%,#13284d 0%,#0a1930 45%,#070F26 100%)}
#stage:after{content:'';position:absolute;inset:0;pointer-events:none;
  background:radial-gradient(900px 500px at 50% 120%,rgba(0,229,255,.10),transparent 70%)}
.sc{position:absolute;left:0;top:0;width:1280px;height:616px;opacity:0;visibility:hidden}
.sc.act{opacity:1;visibility:visible;animation:zin .72s cubic-bezier(.2,.7,.2,1) both}
.sc.out{opacity:1;visibility:visible;animation:zout .72s cubic-bezier(.4,0,.8,.3) both}
@keyframes zin{from{transform:scale(1.07);filter:blur(10px);opacity:0}to{transform:none;filter:none;opacity:1}}
@keyframes zout{from{transform:none;opacity:1}to{transform:scale(.95);opacity:0;filter:blur(6px)}}
.in{position:absolute;left:0;top:0;width:1280px;height:616px;padding:54px 72px;display:flex;align-items:center}
.mid{width:100%;text-align:center}
.split{width:100%;display:flex;align-items:center;gap:60px}
.split .L{flex:1;min-width:0}
.split .R{position:relative;flex:0 0 272px}
.sc.wide .R{flex:0 0 530px}
.cardshot{width:530px;max-height:468px;border-radius:18px;overflow:hidden;border:1px solid rgba(160,190,230,.26);
  box-shadow:0 26px 60px rgba(3,10,22,.7);background:#0b1220;
  animation:ph .8s cubic-bezier(.2,.8,.25,1) both}
.cardshot img{width:100%;display:block}

.mk{width:92px;height:92px;border-radius:20px;display:block;margin:0 auto 22px;
  animation:pop .7s cubic-bezier(.2,1.5,.4,1) both}
.mk.sm{width:68px;height:68px;border-radius:15px;margin-bottom:18px}
@keyframes pop{from{transform:scale(.4);opacity:0}to{transform:none;opacity:1}}

h1{font-size:50px;font-weight:600;line-height:1.14;letter-spacing:-.6px}
h2{font-size:40px;font-weight:600;line-height:1.16;letter-spacing:-.4px}
h2.big{font-size:74px;margin-bottom:26px}
.kw{display:inline-block;animation:wup .5s cubic-bezier(.2,.9,.3,1) both;animation-delay:var(--kd)}
@keyframes wup{from{opacity:0;transform:translateY(16px) scale(.96);filter:blur(4px)}
  to{opacity:1;transform:none;filter:none}}
.eyebrow{font-size:15px;font-weight:600;letter-spacing:3px;text-transform:uppercase;
  color:#00E5FF;margin-bottom:16px;animation:wup .5s both;animation-delay:var(--kd,.1s)}
.sub{font-size:24px;color:#BFD3F7;margin-top:20px;animation:wup .5s both;animation-delay:var(--kd)}
.note{font-size:21px;color:#BFD3F7;margin-top:22px;line-height:1.4;
  animation:wup .5s both;animation-delay:var(--kd)}

.url{font-size:34px;font-weight:300;color:#EAF1FF;letter-spacing:-.4px;
  animation:wup .5s both;animation-delay:var(--kd)}
.url b{font-weight:700;color:#00E5FF}
.url.close{font-size:34px;margin-top:22px}

.phone{width:272px;border-radius:26px;overflow:hidden;border:5px solid #1b2b47;
  box-shadow:0 26px 60px rgba(3,10,22,.75);background:#0b1220;
  animation:ph .8s cubic-bezier(.2,.8,.25,1) both}
.phone img{width:100%;display:block}
.phone.dim img{filter:saturate(.55) brightness(.72)}
@keyframes ph{from{opacity:0;transform:translateY(34px) rotateX(10deg)}to{opacity:1;transform:none}}
.ring{position:absolute;left:50%;top:70%;width:190px;height:190px;margin:-95px 0 0 -95px;
  border:4px solid #34d399;border-radius:50%;
  animation:rp 1.5s ease-out infinite both;animation-delay:var(--kd)}
.ring:after{content:'';position:absolute;inset:-4px;border:4px solid #34d399;border-radius:50%;
  animation:rp 1.5s ease-out infinite both;animation-delay:calc(var(--kd) + .5s)}
@keyframes rp{from{transform:scale(.45);opacity:1}to{transform:scale(1.25);opacity:0}}

.chips{display:flex;flex-wrap:wrap;gap:12px;margin-top:28px}
.chip{font-size:19px;padding:10px 18px;border-radius:999px;background:rgba(42,109,224,.22);
  border:1px solid rgba(42,109,224,.5);color:#EAF1FF;
  animation:wup .45s both;animation-delay:var(--kd)}
.chip.no{background:rgba(120,140,170,.12);border-color:rgba(160,180,210,.3);color:#BFD3F7}

.two{margin-top:12px}
.row{display:flex;align-items:center;gap:16px;font-size:26px;margin:14px 0;
  animation:wup .5s both;animation-delay:var(--kd)}
.row b{width:44px;height:44px;border-radius:12px;display:grid;place-items:center;font-size:24px;flex:0 0 44px}
.row.good b{background:rgba(52,211,153,.2);color:#34d399}
.row.bad b{background:rgba(255,107,107,.18);color:#ff8585}
.row.bad u{text-decoration-color:#ff8585;text-underline-offset:5px}

.cards{display:flex;gap:30px;justify-content:center;margin-top:34px}
.cd{flex:0 0 330px;padding:28px 24px;border-radius:20px;background:rgba(255,255,255,.045);
  border:1px solid rgba(160,190,230,.18);animation:wup .55s both;animation-delay:var(--kd)}
.cd .t{font-size:18px;color:#BFD3F7;margin-bottom:14px}
.cd .v{font-size:46px;font-weight:700;letter-spacing:1px}
.cd .m{font-size:17px;color:#9DB4D6;margin-top:10px}
.cd.ok{border-color:rgba(52,211,153,.5);background:rgba(52,211,153,.10)}
.cd.ok .v{color:#34d399}
.cd.no{border-color:rgba(255,107,107,.45);background:rgba(255,107,107,.08)}
.cd.no .v{color:#ff8585}

.rail{display:flex;align-items:center;justify-content:center;gap:0;margin-top:40px}
.tk{text-align:center;padding:0 26px;animation:wup .5s both;animation-delay:var(--kd)}
.tk b{display:block;font-size:46px;font-weight:600}
.tk span{display:block;font-size:17px;color:#BFD3F7;margin-top:8px}
.tk.hi b{color:#00E5FF}
.tk.late b{color:#ffd166;font-size:34px}
.ln{width:120px;height:2px;background:linear-gradient(90deg,rgba(42,109,224,.2),rgba(42,109,224,.75))}

.bar{display:flex;height:76px;border-radius:14px;overflow:hidden;max-width:880px;margin:0 auto}
.bs{display:grid;place-items:center;width:var(--w);transform-origin:left center;
  animation:gw .6s cubic-bezier(.2,.8,.3,1) both;animation-delay:var(--kd)}
.bs b{font-size:28px;font-weight:700;line-height:1}
.bs span{font-size:15px;color:rgba(255,255,255,.8);margin-top:5px}
@keyframes gw{from{transform:scaleX(0);opacity:0}to{transform:none;opacity:1}}
.bs.read{background:#1D5BC4}.bs.talk{background:#2A6DE0}.bs.dec{background:#00a9c4;color:#04202a}
.bs.dec span{color:rgba(4,32,42,.8)}

.acts{max-width:860px;margin:34px auto 0;border-radius:14px;overflow:hidden;
  border:1px solid rgba(160,190,230,.22)}
.ah,.ar{display:grid;grid-template-columns:2fr 1fr 1fr}
.ah span{padding:14px 18px;font-size:15px;letter-spacing:1.6px;text-transform:uppercase;
  color:#9DB4D6;background:rgba(255,255,255,.05)}
.ar span{padding:20px 18px;border-top:1px solid rgba(160,190,230,.14);min-height:62px}
.ar{animation:wup .5s both;animation-delay:var(--kd)}
.ar .w{border-left:1px solid rgba(160,190,230,.14);color:#00E5FF}

.zeros{display:flex;gap:14px;margin-top:6px}
.zeros i{font-style:normal;width:76px;height:92px;border-radius:14px;display:grid;place-items:center;
  font-size:46px;font-weight:600;background:rgba(255,255,255,.06);
  border:1px solid rgba(160,190,230,.26);
  animation:wup .4s both;animation-delay:calc(var(--kd) + var(--i,0s))}
.zeros i:nth-child(2){--i:.12s}.zeros i:nth-child(3){--i:.24s}.zeros i:nth-child(4){--i:.36s}

.btnish{display:inline-flex;align-items:center;gap:10px;margin-top:30px;padding:18px 40px;
  border-radius:14px;background:linear-gradient(180deg,#43d9a3,#2bb886);color:#06281d;
  font-size:30px;font-weight:700;animation:pop .5s cubic-bezier(.2,1.5,.4,1) both;
  animation-delay:var(--kd);box-shadow:0 14px 34px rgba(43,184,134,.3)}

#strip{position:absolute;left:0;top:616px;width:1280px;height:104px;background:#05101f}
body.rolling #ctrl,body.rolling #poster{display:none!important}
"""


def main():
    page = ('<!doctype html><html lang="en"><head><meta charset="utf-8">'
            '<title>The meeting sign-in</title><style>' + CSS.replace('__PLEX__', PLEX) + '</style></head><body>'
            '<div id="stage">' + build() + '</div><div id="strip"></div>'
            '<script>'
            'var SC=[].slice.call(document.querySelectorAll(".sc"));'
            'var paused=false,timer=null,cur=-1;'
            'function go(n){'
            ' if(cur>=0&&SC[cur]){SC[cur].classList.remove("act");SC[cur].classList.add("out");}'
            ' var p=cur;cur=n;'
            ' SC[n].classList.remove("out");'
            ' SC[n].offsetWidth;'              # restart the entrance
            ' SC[n].classList.add("act");'
            ' if(p>=0&&SC[p])setTimeout(function(){SC[p].classList.remove("out");},720);'
            ' if(!paused&&!window.__RENDER){'
            '  timer=setTimeout(function(){go((n+1)%SC.length);},+SC[n].dataset.d);}'
            '}'
            'go(0);'
            '</script></body></html>')
    OUT.write_text(page)
    kb = len(page) // 1024
    print('wrote %s  (%d scenes, %.1fs, %d KB)' % (OUT, len(DURS), sum(DURS) / 1000.0, kb))

    #  The collision that has cost three shots on other films: one class
    #  styled by two different scenes' rules, the later one silently winning.
    #  Key on the WHOLE selector, so .chip.no and .cd.no stay distinct and
    #  only a genuine redefinition is refused.
    seen = {}
    for m in re.finditer(r'([^{}]+)\{([^}]*)\}', CSS):
        head = m.group(1).strip()
        if head.startswith('@') or not head:
            continue
        for sel in [x.strip() for x in head.split(',') if x.strip()]:
            #  a keyframe step is not a selector: the nested braces of
            #  @keyframes come through this regex as from{} / to{} / 50{}
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

    #  render.js puts .act / .out on the live and outgoing SECTION, reads .cnt
    #  for counters, and .rolling on the body. A rule for any of those names is
    #  a rule that lands on the scene itself: .act as an action table gave every
    #  live scene max-width:860px and clipped 420px off every frame.
    RESERVED = {'act', 'out', 'cnt', 'sc', 'in', 'rolling'}
    for sel in {s for (s, _) in seen}:
        #  only the SUBJECT of the selector (its last compound) is styled by it;
        #  .sc.wide .R styles .R, not .sc.
        subject = re.split(r'[\s>+~]+', sel.strip())[-1]
        if subject in ('#ctrl', '#poster'):
            continue
        for cls in re.findall(r'\.([a-zA-Z][\w-]*)', subject):
            if cls in RESERVED and subject not in ('.sc', '.sc.act', '.sc.out', '.in'):
                sys.exit('RESERVED CLASS: "%s" styles .%s, which render.js owns'
                         % (sel, cls))
    print('  no rule touches render.js\'s reserved classes')


if __name__ == '__main__':
    main()
