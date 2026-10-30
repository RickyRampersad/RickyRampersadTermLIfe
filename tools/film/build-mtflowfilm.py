#!/usr/bin/env python3
"""Four parts of a branch meeting: before, the start, the middle, after.

Built 30 October 2026, asked for as "a revised video on the expectation
before and at the start of the meeting and during the meeting as well after
the meeting on wednesday, this must be different ok, so lots of motion,
contact very short and animations a wow".

DIFFERENT FROM THE SIGN-IN FILM ON PURPOSE.  That one is navy, and it is
made of photographs of the real gate.  This one is near-black, it is drawn
rather than shot, and its spine is a four-part rail that the whole film
travels along - so the two read as two films rather than two cuts of one.
Each act owns a colour and keeps it: violet before, cyan at the start,
amber through the middle, green after.

Nothing here is a screenshot and nothing here is real: every name, number
and answer on screen is invented, because the MP4 sits at a public URL.

Re-cut:  edit mtflow-lines.json, push tts/job.json to the tts-run branch,
importvox.py <out> vomtflow 1.15 --timing mtflow-timing.json, then this,
then sfx.py / usetrack.py / render.js / mixany.py / chapters.py.
"""
import base64, json, pathlib, re, sys

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent.parent
OUT = ROOT / 'meetings' / 'flow.html'
TIMING = HERE / 'mtflow-timing.json'


def b64(p, mime):
    return 'data:%s;base64,%s' % (mime, base64.b64encode(pathlib.Path(p).read_bytes()).decode())


MARK = b64(ROOT / 'logo-mark.png', 'image/png')
PLEX = b64(HERE / 'fonts' / 'IBMPlexSans-latin.woff2', 'font/woff2')

T = json.loads(TIMING.read_text()) if TIMING.exists() else {}
#  importvox writes SECONDS; data-d is MILLISECONDS.
DURS = [int(round(d * 1000)) for d in (T.get('durs') or [5.0] * 7)]
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


def S(n, body, cls=''):
    return ('<section class="sc %s" data-d="%d"><div class="in">%s</div></section>'
            % (cls, DURS[n - 1], body))


def kin(text, d=0.0, step=0.055):
    """Kinetic headline, word by word. Never letter by letter: that is the
       dated form and it wrecks the screen-reader read."""
    return ' '.join('<span class="kw" style="--kd:%.2fs">%s</span>' % (d + i * step, w)
                    for i, w in enumerate(text.split(' ')))


ACTS = [('Before', 'a1'), ('The start', 'a2'), ('The middle', 'a3'), ('After', 'a4')]


def rail(live=-1, d=0.0):
    """The spine of the whole film: four parts, one lit."""
    out = []
    for i, (name, k) in enumerate(ACTS):
        out.append('<div class="rp %s%s" style="--kd:%.2fs"><i></i><span>%s</span></div>'
                   % (k, ' on' if i == live else '', d + i * .14, name))
    return '<div class="rail">%s</div>' % ''.join(out)


def build():
    sc = []

    # 1 -------------------------------------------------- four parts, slammed in
    sc.append(S(1,
        '<div class="mid">'
        '<div class="eyebrow" style="--kd:.15s">Every branch meeting</div>'
        '<h1>%s</h1>%s</div>'
        % (kin('Four parts.', .35, .09), rail(-1, at(1, 'four'))),
        'open'))

    # 2 ------------------------------------------------------- before: you bring
    sc.append(S(2,
        '<div class="half">'
        '<div class="L">%s'
        '<h2>%s</h2>'
        '<div class="steps">'
        '<div class="st" style="--kd:%.2fs"><b>1</b>Your agent number opens the page</div>'
        '<div class="st" style="--kd:%.2fs"><b>2</b>Pick the item, answer its question</div>'
        '<div class="st" style="--kd:%.2fs"><b>3</b>Type it. That is all.</div>'
        '</div></div>'
        '<div class="R">'
        '<div class="deck">'
        '<div class="dk d1" style="--kd:%.2fs"><u>Commitment</u>Fifteen households by 14 November.</div>'
        '<div class="dk d2" style="--kd:%.2fs"><u>Concern</u>Half have no phone number on file.</div>'
        '<div class="dk d3" style="--kd:%.2fs"><u>Point</u>Calling after six o&rsquo;clock works.</div>'
        '</div>'
        '<div class="tally" style="--kd:%.2fs"><b class="cnt" data-to="26" data-at="%.2f">26</b>'
        '<span>on the agenda<br>before anybody sat down</span></div>'
        '</div></div>'
        % (rail(0, .1), kin('You bring one thing.', .3),
           at(2, 'number'), at(2, 'item'), at(2, 'Type'),
           at(2, 'Pick'), at(2, 'answer'), at(2, 'lands'),
           at(2, 'agenda'), at(2, 'agenda')),
        'before'))

    # 3 ------------------------------------------------- the start: the register
    sc.append(S(3,
        '<div class="half">'
        '<div class="L">%s'
        '<h2>%s</h2>'
        '<div class="two">'
        '<div class="rw yes" style="--kd:%.2fs"><b>&#10003;</b>That is the register</div>'
        '<div class="rw no" style="--kd:%.2fs"><b>&#10007;</b>Nothing else marks you present</div>'
        '</div></div>'
        '<div class="R">'
        '<div class="btnbig" style="--kd:%.2fs"><i></i>&#10003;&nbsp; I am here</div>'
        '<div class="ring" style="--kd:%.2fs"></div>'
        '<div class="stamp" style="--kd:%.2fs">PRESENT<small>11:52</small></div>'
        '</div></div>'
        % (rail(1, .1), kin('Press the button.', .3),
           at(3, 'register'), at(3, 'present'),
           at(3, 'Press'), at(3, 'button'), at(3, 'register')),
        'start'))

    # 4 ------------------------------------------------------ ten minutes of quiet
    sc.append(S(4,
        '<div class="mid">%s'
        '<div class="clockwrap">'
        '<svg class="dial" viewBox="0 0 200 200" aria-hidden="true">'
        '<circle cx="100" cy="100" r="86" fill="none" stroke="rgba(190,205,235,.16)" stroke-width="10"/>'
        '<circle class="arc" cx="100" cy="100" r="86" fill="none" stroke="#22D3EE" stroke-width="10"'
        ' stroke-linecap="round" pathLength="100" transform="rotate(-90 100 100)"'
        ' style="--kd:%.2fs"/></svg>'
        '<div class="dnum"><b class="cnt" data-to="10" data-at="%.2f">10</b><span>minutes</span></div>'
        '</div>'
        '<h2 class="qt">%s</h2>'
        '<div class="note" style="--kd:%.2fs">Nobody presents what could have been read.</div>'
        '</div>'
        % (rail(1, .1), at(4, 'ten'), at(4, 'ten'),
           kin('Quiet. We read what the room brought.', at(4, 'quiet')),
           at(4, 'brought')),
        'quiet'))

    # 5 ------------------------------------------- the middle: answers with names
    sc.append(S(5,
        '<div class="half">'
        '<div class="L">%s'
        '<div class="bignum" style="--kd:%.2fs"><b class="cnt" data-to="50" data-at="%.2f">50</b>'
        '<span>minutes</span></div>'
        '<h2>%s</h2></div>'
        '<div class="R">'
        '<div class="qa q1" style="--kd:%.2fs"><u>Question</u>Who owns the dues list on a Wednesday?'
        '<em style="--kd:%.2fs">Sasha &middot; by 6 Nov</em></div>'
        '<div class="qa q2" style="--kd:%.2fs"><u>Question</u>What is the branch number for FY27?'
        '<em style="--kd:%.2fs">Answered in the room</em></div>'
        '<div class="qa q3" style="--kd:%.2fs"><u>Concern</u>No phone numbers on half my book.'
        '<em style="--kd:%.2fs">Kamla &middot; by 7 Nov</em></div>'
        '</div></div>'
        % (rail(2, .1), at(5, 'Fifty'), at(5, 'Fifty'),
           kin('An answer, or a name and a date.', at(5, 'answer')),
           at(5, 'Every'), at(5, 'name'),
           at(5, 'question'), at(5, 'name', 0),
           at(5, 'gets'), at(5, 'date')),
        'middle'))

    # 6 ---------------------------------------------------- after: read back, out
    sc.append(S(6,
        '<div class="half">'
        '<div class="L">%s'
        '<div class="bignum" style="--kd:%.2fs"><b class="cnt" data-to="20" data-at="%.2f">20</b>'
        '<span>minutes of decisions</span></div>'
        '<h2>%s</h2></div>'
        '<div class="R">'
        '<div class="done t1" style="--kd:%.2fs"><b>&#10003;</b>Every household named by 14 Nov'
        '<em>Branch Manager</em></div>'
        '<div class="done t2" style="--kd:%.2fs"><b>&#10003;</b>Birthday month is a call, not a note'
        '<em>Client Support</em></div>'
        '<div class="done t3" style="--kd:%.2fs"><b>&#10003;</b>Nothing about a client in WhatsApp'
        '<em>Everyone</em></div>'
        '<div class="after" style="--kd:%.2fs">Minutes within the hour &middot; on your board by Monday</div>'
        '</div></div>'
        % (rail(3, .1), at(6, 'Twenty'), at(6, 'Twenty'),
           kin('Read back out loud.', at(6, 'read')),
           at(6, 'decisions'), at(6, 'loud'), at(6, 'Minutes'), at(6, 'board')),
        'after'))

    # 7 ----------------------------------------------------------- and round again
    sc.append(S(7,
        '<div class="mid">'
        '<img class="mk" src="%s" alt="">%s'
        '<h1 class="close">%s</h1>'
        '<div class="sub" style="--kd:%.2fs">Bring one thing.</div>'
        '</div>'
        % (MARK, rail(-1, .25), kin('Again on Wednesday.', at(7, 'again')),
           at(7, 'Bring')),
        'close'))

    return ''.join(sc)


CSS = """
@font-face{font-family:Plex;src:url(__PLEX__) format('woff2');font-weight:100 700;font-display:block}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1280px;height:720px;overflow:hidden;background:#05060A}
body{font-family:Plex,system-ui,sans-serif;color:#F2F5FA;-webkit-font-smoothing:antialiased}
#stage{position:relative;width:1280px;height:616px;overflow:hidden;background:#07080C}
#stage:before{content:'';position:absolute;inset:-20%;pointer-events:none;
  background:conic-gradient(from 0deg at 50% 50%,rgba(167,139,250,.13),rgba(34,211,238,.13),
    rgba(251,191,36,.11),rgba(52,211,153,.12),rgba(167,139,250,.13));
  animation:spin 26s linear infinite;filter:blur(90px)}
@keyframes spin{to{transform:rotate(360deg)}}
#stage:after{content:'';position:absolute;inset:0;pointer-events:none;
  background:radial-gradient(1000px 600px at 50% 110%,rgba(0,0,0,.55),transparent 65%)}

.sc{position:absolute;left:0;top:0;width:1280px;height:616px;opacity:0;visibility:hidden}
.sc.act{opacity:1;visibility:visible;animation:sin .66s cubic-bezier(.16,.9,.2,1) both}
.sc.out{opacity:1;visibility:visible;animation:sout .66s cubic-bezier(.5,0,.85,.2) both}
@keyframes sin{from{opacity:0;transform:translateX(64px)}to{opacity:1;transform:none}}
@keyframes sout{from{opacity:1;transform:none}to{opacity:0;transform:translateX(-52px)}}
.in{position:absolute;left:0;top:0;width:1280px;height:616px;padding:46px 68px;
  display:flex;align-items:center}
.mid{width:100%;text-align:center}
.half{width:100%;display:flex;align-items:center;gap:56px}
.half .L{flex:1 1 0;min-width:0}
.half .R{flex:0 0 476px;position:relative}

h1{font-size:62px;font-weight:600;line-height:1.08;letter-spacing:-1.2px}
h1.close{font-size:54px}
h2{font-size:40px;font-weight:600;line-height:1.14;letter-spacing:-.5px;margin-bottom:26px}
h2.qt{font-size:34px;margin:30px 0 0}
.kw{display:inline-block;animation:wup .52s cubic-bezier(.2,.9,.3,1) both;animation-delay:var(--kd)}
@keyframes wup{from{opacity:0;transform:translateY(22px) scale(.94);filter:blur(5px)}
  to{opacity:1;transform:none;filter:none}}
.eyebrow{font-size:14px;font-weight:600;letter-spacing:4px;text-transform:uppercase;
  color:#9AA6BF;margin-bottom:18px;animation:wup .5s both;animation-delay:var(--kd,.1s)}
.sub{font-size:26px;color:#C6D2E8;margin-top:22px;animation:wup .5s both;animation-delay:var(--kd)}
.note{font-size:20px;color:#9AA6BF;margin-top:22px;animation:wup .5s both;animation-delay:var(--kd)}

/* the spine */
.rail{display:flex;gap:14px;justify-content:center;margin-top:40px}
.half .rail{justify-content:flex-start;margin:0 0 26px}
.rp{display:flex;align-items:center;gap:9px;padding:9px 16px 9px 12px;border-radius:999px;
  background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.09);
  font-size:15px;font-weight:600;color:#8C96AD;
  animation:rup .5s cubic-bezier(.2,1.3,.4,1) both;animation-delay:var(--kd)}
.rp i{width:11px;height:11px;border-radius:50%;background:rgba(255,255,255,.2);display:block}
@keyframes rup{from{opacity:0;transform:translateY(14px) scale(.9)}to{opacity:1;transform:none}}
.rp.on{color:#07080C;font-weight:700}
.rp.on i{background:rgba(7,8,12,.35)}
.rp.a1.on{background:#A78BFA;border-color:#A78BFA;box-shadow:0 0 34px rgba(167,139,250,.5)}
.rp.a2.on{background:#22D3EE;border-color:#22D3EE;box-shadow:0 0 34px rgba(34,211,238,.5)}
.rp.a3.on{background:#FBBF24;border-color:#FBBF24;box-shadow:0 0 34px rgba(251,191,36,.45)}
.rp.a4.on{background:#34D399;border-color:#34D399;box-shadow:0 0 34px rgba(52,211,153,.45)}

/* before */
.steps{margin-top:6px}
.st{display:flex;align-items:center;gap:15px;font-size:23px;color:#DCE4F2;padding:11px 0;
  animation:slin .55s cubic-bezier(.2,.9,.3,1) both;animation-delay:var(--kd)}
.st b{flex:0 0 36px;height:36px;border-radius:50%;background:rgba(167,139,250,.2);
  color:#C4B5FD;font-size:17px;display:flex;align-items:center;justify-content:center}
@keyframes slin{from{opacity:0;transform:translateX(-26px)}to{opacity:1;transform:none}}
.deck{position:relative;height:250px}
.dk{position:absolute;left:0;width:430px;padding:16px 20px;border-radius:16px;
  background:#121523;border:1px solid rgba(255,255,255,.1);font-size:20px;line-height:1.4;
  color:#E6ECF8;box-shadow:0 22px 48px rgba(0,0,0,.6);
  animation:fly .72s cubic-bezier(.17,.95,.25,1) both;animation-delay:var(--kd)}
.dk u{display:block;font-size:12px;letter-spacing:2.4px;text-transform:uppercase;
  text-decoration:none;margin-bottom:6px}
.dk.d1{top:0;border-left:4px solid #34D399}.dk.d1 u{color:#34D399}
.dk.d2{top:84px;left:26px;border-left:4px solid #FBBF24}.dk.d2 u{color:#FBBF24}
.dk.d3{top:168px;left:52px;border-left:4px solid #A78BFA}.dk.d3 u{color:#A78BFA}
@keyframes fly{from{opacity:0;transform:translate(90px,38px) rotate(7deg) scale(.9)}
  to{opacity:1;transform:none}}
.tally{display:flex;align-items:center;gap:16px;margin-top:16px;
  animation:wup .5s both;animation-delay:var(--kd)}
.tally b{font-size:62px;font-weight:700;color:#A78BFA;line-height:1}
.tally span{font-size:17px;color:#9AA6BF;line-height:1.4}

/* the start */
.two{margin-top:4px}
.rw{display:flex;align-items:center;gap:14px;font-size:24px;padding:10px 0;color:#DCE4F2;
  animation:slin .5s both;animation-delay:var(--kd)}
.rw b{width:34px;height:34px;border-radius:50%;display:flex;align-items:center;
  justify-content:center;font-size:17px}
.rw.yes b{background:rgba(34,211,238,.18);color:#22D3EE}
.rw.no b{background:rgba(248,113,113,.16);color:#F87171}
.btnbig{position:relative;width:330px;margin:0 auto;padding:26px 0;border-radius:18px;
  background:linear-gradient(180deg,#22D3EE,#0EA5C4);color:#042026;font-size:30px;
  font-weight:700;text-align:center;box-shadow:0 20px 54px rgba(34,211,238,.4);
  animation:press .9s cubic-bezier(.2,1.4,.35,1) both;animation-delay:var(--kd)}
@keyframes press{0%{opacity:0;transform:scale(.82)}55%{opacity:1;transform:scale(1.04)}
  70%{transform:scale(.97)}100%{opacity:1;transform:none}}
.btnbig i{position:absolute;inset:0;border-radius:18px;background:rgba(255,255,255,.5);
  opacity:0;animation:flash .5s ease-out both;animation-delay:calc(var(--kd) + .5s)}
@keyframes flash{0%{opacity:.55;transform:scale(1)}100%{opacity:0;transform:scale(1.14)}}
.ring{position:absolute;left:50%;top:48px;width:330px;height:92px;margin-left:-165px;
  border:2px solid #22D3EE;border-radius:18px;opacity:0;
  animation:rip 1.4s ease-out 2;animation-delay:var(--kd)}
@keyframes rip{0%{opacity:.75;transform:scale(1)}100%{opacity:0;transform:scale(1.3)}}
.stamp{margin:30px auto 0;width:250px;padding:14px 0;text-align:center;border-radius:12px;
  border:3px solid #34D399;color:#34D399;font-size:30px;font-weight:700;letter-spacing:4px;
  transform:rotate(-5deg);animation:slam .55s cubic-bezier(.2,1.6,.4,1) both;
  animation-delay:var(--kd)}
.stamp small{display:block;font-size:15px;letter-spacing:2px;font-weight:600;margin-top:3px}
@keyframes slam{from{opacity:0;transform:rotate(-5deg) scale(2.1)}
  to{opacity:1;transform:rotate(-5deg) scale(1)}}

/* the quiet */
.clockwrap{position:relative;width:200px;height:200px;margin:34px auto 0}
.dial{width:200px;height:200px;display:block}
.arc{stroke-dasharray:100;stroke-dashoffset:100;
  animation:draw 2.6s cubic-bezier(.3,.6,.3,1) both;animation-delay:var(--kd)}
@keyframes draw{to{stroke-dashoffset:0}}
.dnum{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;
  justify-content:center}
.dnum b{font-size:62px;font-weight:700;color:#22D3EE;line-height:1}
.dnum span{font-size:16px;color:#9AA6BF;letter-spacing:2px;text-transform:uppercase}

/* the middle */
.bignum{display:flex;align-items:baseline;gap:14px;margin-bottom:20px;
  animation:wup .5s both;animation-delay:var(--kd)}
.bignum b{font-size:92px;font-weight:700;color:#FBBF24;line-height:.95}
.bignum span{font-size:21px;color:#9AA6BF}
.qa{position:relative;padding:16px 20px 16px 20px;border-radius:16px;background:#121523;
  border:1px solid rgba(255,255,255,.1);border-left:4px solid #FBBF24;margin-bottom:14px;
  font-size:21px;line-height:1.4;color:#E6ECF8;
  animation:slin .6s cubic-bezier(.2,.9,.3,1) both;animation-delay:var(--kd)}
.qa u{display:block;font-size:12px;letter-spacing:2.4px;text-transform:uppercase;
  text-decoration:none;color:#FBBF24;margin-bottom:6px}
.qa em{display:inline-block;margin-top:10px;font-style:normal;font-size:16px;font-weight:600;
  background:rgba(52,211,153,.16);color:#34D399;padding:6px 13px;border-radius:999px;
  animation:pop .5s cubic-bezier(.2,1.5,.4,1) both;animation-delay:var(--kd)}
@keyframes pop{from{opacity:0;transform:scale(.6)}to{opacity:1;transform:none}}

/* after */
/* the after act owns green: an amber figure under a green chip is the
   first thing a room notices */
.sc.after .bignum b{color:#34D399}
.done{display:flex;align-items:center;gap:14px;padding:14px 18px;border-radius:14px;
  background:rgba(52,211,153,.09);border:1px solid rgba(52,211,153,.26);margin-bottom:13px;
  font-size:19px;line-height:1.3;color:#E6ECF8;animation:slin .55s both;animation-delay:var(--kd)}
.done b{flex:0 0 32px;height:32px;border-radius:50%;background:#34D399;color:#042a1d;
  display:flex;align-items:center;justify-content:center;font-size:17px}
.done em{margin-left:auto;font-style:normal;font-size:14px;color:#34D399;font-weight:600;
  white-space:nowrap;flex:0 0 auto}
.after{margin-top:18px;font-size:19px;color:#9AA6BF;text-align:center;
  animation:wup .5s both;animation-delay:var(--kd)}

.mk{width:84px;height:84px;border-radius:19px;display:block;margin:0 auto 24px;
  animation:pop .7s cubic-bezier(.2,1.5,.4,1) both}
"""


def main():
    page = ('<!doctype html><html lang="en"><head><meta charset="utf-8">'
            '<title>Four parts of a meeting</title><style>'
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

    #  One class styled by two different rules, the later silently winning,
    #  has cost three shots across the other films. Key on the WHOLE selector.
    seen = {}
    for m in re.finditer(r'([^{}]+)\{([^}]*)\}', CSS):
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

    #  render.js owns .act/.out/.cnt/.sc/.in/.rolling. A rule whose SUBJECT is
    #  one of those lands on the scene itself.
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
