#!/usr/bin/env python3
"""Assemble orphan-video/film.html from the proven client-film shell.

Same trick as build-wallfilm.py: the shell carries eight embedded woff2 faces
and the scene runner, both of which the recorder depends on, so it is cloned
and only the chrome-to-tapzone span is replaced. The theme is then overridden
to the branch's own — navy and gold with the shield, not Ink & Coral — because
this film plays on rickyrampersadbranch.com, not donthaveanagent.com.

No client name and no client count appears anywhere in it. The file sits at a
public URL once recorded, and the house rule on that is absolute.

  python3 build-orphanfilm.py [timing.json]
"""
import json, pathlib, re, sys

HERE = pathlib.Path(__file__).resolve().parent       # tools/film
ROOT = HERE.parent.parent                             # the repository
SRC = ROOT / 'donthaveanagent' / 'client-film.html'   # the shell that is cloned
OUTDIR = ROOT / 'orphan-video'
OUT = OUTDIR / 'film.html'

TIMING = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else HERE / 'orphan-timing.json'
D = json.load(open(TIMING))['durs']
ms = [int(round(d * 1000)) for d in D]
assert len(ms) == 15, f'expected 15 scenes, timing has {len(ms)}'

s = SRC.read_text()

# ── the branch's own look, appended last so it wins ───────────────────
CSS = r"""
/* ══ orphan film · branch theme ════════════════════════════════════════
   Navy and gold with the shield. The donthaveanagent palette is deliberately
   not used here — two marks, two products, on purpose. */
.of{--navy:#07131f;--gold:#efc24b;--gold2:#c9942c;--teal:#00CFEA;
    --ink:#e9f2fb;--dim:#8fa8c0;--line:rgba(239,194,75,.22)}
.scene.of{background:
  radial-gradient(1100px 620px at 12% -14%,rgba(239,194,75,.13),transparent 62%),
  radial-gradient(820px 500px at 94% 108%,rgba(0,207,234,.07),transparent 64%),
  linear-gradient(168deg,#0b1b2b 0%,#07131f 58%,#040d16 100%)}
.scene.of .inner{color:var(--ink)}
.scene.of h1,.scene.of h2{color:#fff;text-shadow:0 2px 34px rgba(0,0,0,.4)}
.scene.of h1 em,.scene.of h2 em{color:var(--gold);font-style:normal}
.scene.of .eyebrow{color:var(--gold)}
.scene.of .big-sub,.scene.of p{color:var(--dim)}
.scene.of.warm{background:
  radial-gradient(1100px 640px at 50% -10%,rgba(239,194,75,.20),transparent 64%),
  linear-gradient(168deg,#102232 0%,#07131f 62%,#040d16 100%)}

/* the shield, drawn not linked — a linked image does not load in the capture */
.shield{width:78px;height:78px;display:block;margin:0 auto 18px}
.shield.sm{width:30px;height:30px;margin:0}
.scene.on .shield{animation:beatpop .6s ease}

/* ── the three things that keep running ── */
.keeps{display:grid;gap:11px;max-width:620px;margin:22px auto 0}
.keep{display:flex;align-items:center;gap:14px;background:rgba(255,255,255,.04);
  border:1px solid var(--line);border-radius:13px;padding:15px 19px;text-align:left;
  opacity:0;transform:translateX(-14px)}
.scene.on .keep{animation:slidein .5s cubic-bezier(.2,.9,.3,1) forwards}
.scene.on .keep:nth-child(1){animation-delay:.30s}
.scene.on .keep:nth-child(2){animation-delay:.70s}
.scene.on .keep:nth-child(3){animation-delay:1.10s}
@keyframes slidein{to{opacity:1;transform:none}}
.keep .tk{width:31px;height:31px;flex:none;border-radius:50%;display:grid;place-items:center;
  background:linear-gradient(180deg,var(--gold),var(--gold2));color:#07131f;
  font:900 16px var(--head)}
.keep b{font:700 18px/1.2 var(--head);color:#fff;letter-spacing:-.01em}
.keep i{display:block;font-style:normal;font:400 13.5px var(--body);color:var(--dim);margin-top:3px}

/* ── the three things you give up: same shape, drained of colour ── */
.keep.off{border-color:rgba(255,255,255,.08);background:rgba(255,255,255,.02)}
.keep.off .tk{background:rgba(255,255,255,.08);color:#61798f;
  box-shadow:inset 0 0 0 1px rgba(255,255,255,.10)}
.keep.off b{color:#9fb4c8}

/* ── the pivot ── */
.pivot{font:900 clamp(30px,7vw,58px)/1.08 var(--head);color:#fff;letter-spacing:-.035em}
.pivot em{color:var(--gold);font-style:normal}

/* ── the price lock ── */
.lock{max-width:560px;margin:20px auto 0;background:rgba(239,194,75,.07);
  border:1px solid var(--line);border-radius:16px;padding:22px 24px}
.lock .age{font:900 clamp(25px,5vw,40px)/1.08 var(--head);color:var(--gold);letter-spacing:-.03em}
.lock .cap{font:700 10.5px var(--head);letter-spacing:.2em;text-transform:uppercase;
  color:var(--dim);margin-top:10px}
.lock .yrs{display:flex;gap:5px;justify-content:center;margin-top:16px}
.lock .yrs i{width:13px;height:30px;border-radius:4px;background:rgba(239,194,75,.22);
  transform:scaleY(0);transform-origin:bottom}
.scene.on .lock .yrs i{animation:yrup .34s cubic-bezier(.2,1.1,.4,1) forwards}
@keyframes yrup{to{transform:scaleY(1)}}
.lock .yrs i:nth-child(n){animation-delay:calc(.35s + var(--n,0) * .055s)}

/* ── the two doors ── */
.doors{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;max-width:860px;margin:18px auto 0}
.door{background:rgba(255,255,255,.04);border:1px solid var(--line);border-radius:15px;
  padding:20px 20px 22px;text-align:left;opacity:0;transform:translateY(12px)}
.scene.on .door{animation:slidein .5s cubic-bezier(.2,.9,.3,1) forwards}
.scene.on .door:nth-child(1){animation-delay:.35s}
.scene.on .door:nth-child(2){animation-delay:.70s}
.scene.on .door:nth-child(3){animation-delay:1.05s}
.door .n{font:900 11px var(--head);letter-spacing:.2em;text-transform:uppercase;color:var(--gold)}
.door b{display:block;font:800 17px/1.2 var(--head);color:#fff;margin:8px 0 6px;letter-spacing:-.02em}
.door span{font:400 13px/1.45 var(--body);color:var(--dim)}
.door.hl{background:linear-gradient(180deg,rgba(239,194,75,.14),rgba(255,255,255,.03));
  border-color:rgba(239,194,75,.45)}

/* ── the click ── */
.click{display:inline-flex;align-items:center;gap:11px;background:linear-gradient(180deg,var(--gold),var(--gold2));
  color:#07131f;border-radius:12px;padding:15px 26px;font:800 19px var(--head);letter-spacing:-.01em;
  margin-top:20px;box-shadow:0 18px 44px rgba(239,194,75,.24)}
.scene.on .click{animation:beatpop .6s .5s ease both}
.cur{width:19px;height:19px}

/* ── close ── */
.signoff{font:800 clamp(21px,4.4vw,33px)/1.2 var(--head);color:#fff;letter-spacing:-.025em}
.signoff i{display:block;font-style:normal;font:500 14px var(--body);color:var(--dim);
  letter-spacing:.04em;margin-top:11px}
.url{display:inline-block;margin-top:20px;font:700 14.5px var(--head);color:var(--gold);
  border:1px solid var(--line);border-radius:9px;padding:9px 17px}

/* the chrome and the progress bar take the branch's colours: the shell's own
   rules are coral, and they sit later in the cascade, so these are explicit. */
#chrome .who{color:#e9f2fb}
#chrome .who i{color:#8fa8c0}
#bars i{background:rgba(239,194,75,.16)}
#bars i::after{background:linear-gradient(90deg,var(--gold2),var(--gold))}
#bars i.done::after{background:rgba(239,194,75,.45)}
"""

SHIELD = ('<svg class="shield{cls}" viewBox="0 0 48 48" aria-hidden="true">'
          '<defs><linearGradient id="{gid}" x1="0" y1="0" x2="0" y2="1">'
          '<stop offset="0" stop-color="#efc24b"/><stop offset="1" stop-color="#c9942c"/>'
          '</linearGradient></defs>'
          '<path d="M24 5 L39 10 V24 C39 33 32 40 24 43 C16 40 9 33 9 24 V10 Z" fill="url(#{gid})"/>'
          '<path d="M16.5 24.5 L21.5 29.5 L32 18.5" fill="none" stroke="#fff" stroke-width="4" '
          'stroke-linecap="round" stroke-linejoin="round"/></svg>')

YEARS = ''.join(f'<i style="--n:{i}"></i>' for i in range(12))

SCENES = f"""
<!-- 1 · title -->
<section class="scene of warm" data-d="{ms[0]}">
  <div class="inner">
    {SHIELD.format(cls='', gid='sh1')}
    <div class="eyebrow st d2">A Ricky Rampersad Branch film</div>
    <h1 class="st d3">Your representative<br>has <em>moved on.</em></h1>
    <div class="big-sub st d4">Your policy has not.</div>
  </div>
</section>

<!-- 2 · the question -->
<section class="scene of" data-d="{ms[1]}">
  <div class="inner">
    <div class="eyebrow st">The question nobody answers</div>
    <h1 class="st d2">What happens if you<br>choose <em>not</em> to have<br>an agent at all?</h1>
  </div>
</section>

<!-- 3 · the honest part -->
<section class="scene of" data-d="{ms[2]}">
  <div class="inner">
    <div class="eyebrow st">Start with the honest part</div>
    <h1 class="st d2">Your policy does not<br>need an agent <em>to work.</em></h1>
  </div>
</section>

<!-- 4 · what keeps running -->
<section class="scene of" data-d="{ms[3]}">
  <div class="inner">
    <div class="eyebrow st">This carries on regardless</div>
    <div class="keeps">
      <div class="keep"><span class="tk">&#10003;</span><div><b>Your premiums are collected</b>
        <i>Exactly as they are today</i></div></div>
      <div class="keep"><span class="tk">&#10003;</span><div><b>Your cover stays in force</b>
        <i>Same sum assured, same beneficiaries</i></div></div>
      <div class="keep"><span class="tk">&#10003;</span><div><b>A claim is still paid</b>
        <i>By Guardian Life, not by a person</i></div></div>
    </div>
  </div>
</section>

<!-- 5 · the branch programme -->
<section class="scene of" data-d="{ms[4]}">
  <div class="inner">
    <div class="eyebrow st">And the branch keeps writing</div>
    <div class="keeps">
      <div class="keep"><span class="tk">&#9993;</span><div><b>A note on your birthday</b>
        <i>Every year, whether or not you have an agent</i></div></div>
      <div class="keep"><span class="tk">&#9200;</span><div><b>A reminder before a premium is due</b>
        <i>So a payment never slips by accident</i></div></div>
      <div class="keep"><span class="tk">&#9742;</span><div><b>A desk that answers</b>
        <i>A person, not a menu</i></div></div>
    </div>
  </div>
</section>

<!-- 6 · none of it depended on an agent -->
<section class="scene of" data-d="{ms[5]}">
  <div class="inner">
    <div class="eyebrow st">Worth being clear about</div>
    <h1 class="st d2">None of that has ever<br>depended on <em>having<br>an agent.</em></h1>
  </div>
</section>

<!-- 7 · the pivot -->
<section class="scene of warm" data-d="{ms[6]}">
  <div class="inner">
    <div class="pivot st">So what do you<br><em>actually give up?</em></div>
  </div>
</section>

<!-- 8 · nobody reviews -->
<section class="scene of" data-d="{ms[7]}">
  <div class="inner">
    <div class="eyebrow st">Without someone of your own</div>
    <div class="keeps">
      <div class="keep off"><span class="tk">&#8212;</span><div><b>Nobody reviews the fit</b>
        <i>Whether the cover you bought still matches the life you have</i></div></div>
    </div>
  </div>
</section>

<!-- 9 · nobody tells you -->
<section class="scene of" data-d="{ms[8]}">
  <div class="inner">
    <div class="eyebrow st">And nobody tells you what is inside</div>
    <div class="keeps">
      <div class="keep off"><span class="tk">&#8212;</span><div><b>Nobody reviews the fit</b>
        <i>Whether the cover you bought still matches the life you have</i></div></div>
      <div class="keep off"><span class="tk">&#8212;</span><div><b>Nobody tells you what is already in there</b>
        <i>Benefits sitting inside your policy, unclaimed</i></div></div>
    </div>
  </div>
</section>

<!-- 10 · nobody notices -->
<section class="scene of" data-d="{ms[9]}">
  <div class="inner">
    <div class="eyebrow st">And nobody notices a stopped payment</div>
    <div class="keeps">
      <div class="keep off"><span class="tk">&#8212;</span><div><b>Nobody reviews the fit</b>
        <i>Whether the cover you bought still matches the life you have</i></div></div>
      <div class="keep off"><span class="tk">&#8212;</span><div><b>Nobody tells you what is already in there</b>
        <i>Benefits sitting inside your policy, unclaimed</i></div></div>
      <div class="keep off"><span class="tk">&#8212;</span><div><b>Nobody notices when a payment stops</b>
        <i>Until a letter arrives, and by then it has been months</i></div></div>
    </div>
  </div>
</section>

<!-- 11 · the price lock -->
<section class="scene of warm" data-d="{ms[10]}">
  <div class="inner">
    <div class="eyebrow st">One more thing, and it is the big one</div>
    <div class="lock st d2">
      <div class="age">Your age<br>when you started</div>
      <div class="cap">is the price you still pay</div>
      <div class="yrs">{YEARS}</div>
    </div>
  </div>
</section>

<!-- 12 · nobody can sell you that again -->
<section class="scene of" data-d="{ms[11]}">
  <div class="inner">
    <div class="eyebrow st">Which is why it matters</div>
    <h1 class="st d2">Nobody can sell you<br>that price again.<br><em>Not us. Not anyone.</em></h1>
  </div>
</section>

<!-- 13 · what a qualified agent is -->
<section class="scene of" data-d="{ms[12]}">
  <div class="inner">
    <div class="eyebrow st">What we would rather you did</div>
    <h1 class="st d2" style="margin-bottom:6px">Have an agent <em>of your own.</em></h1>
    <div class="doors">
      <div class="door hl"><div class="n">Qualified</div>
        <b>Trained and examined</b>
        <span>Not a friend of the family with a form. Someone who has had to earn the right to advise you.</span></div>
      <div class="door hl"><div class="n">Registered</div>
        <b>On the record, by law</b>
        <span>No individual may act as an agent in Trinidad and Tobago unless they are registered.</span></div>
      <div class="door hl"><div class="n">Answerable</div>
        <b>To you, and to us</b>
        <span>Their advice is on file, and the branch stands behind it.</span></div>
    </div>
  </div>
</section>

<!-- 14 · the ask -->
<section class="scene of warm" data-d="{ms[13]}">
  <div class="inner">
    <div class="eyebrow st">We will make the introduction</div>
    <h1 class="st d2">We'll match you<br>to <em>yours.</em></h1>
    <div class="click st d3">
      <svg class="cur" viewBox="0 0 24 24" fill="none" stroke="#07131f" stroke-width="2.4"
           stroke-linecap="round" stroke-linejoin="round">
        <path d="M5 3l14 9-6 1.5L10 20z"/></svg>
      One click, and we do the rest.
    </div>
  </div>
</section>

<!-- 15 · close -->
<section class="scene of warm" data-d="{ms[14]}">
  <div class="inner" id="finale">
    <div class="eyebrow st" style="margin-bottom:14px">Thank you for watching</div>
    {SHIELD.format(cls='', gid='sh2')}
    <div class="signoff st d2">Ricky Rampersad Branch<i>Guardian Life of the Caribbean</i></div>
    <div class="url st d3">rickyrampersadbranch.com / orphan-video</div>
  </div>
</section>
"""

# ── splice ────────────────────────────────────────────────────────────
chrome_end = s.index('</div>', s.index('<div id="chrome">')) + len('</div>')
tap = s.index('<div class="tapzone" id="zL"')
out = s[:chrome_end] + "\n" + SCENES.strip() + "\n\n" + s[tap:]

last_style_close = out.rindex('</style>')
out = out[:last_style_close] + CSS + out[last_style_close:]

# ── re-badge the chrome and the cover for the branch ──────────────────
out = re.sub(r'<title>.*?</title>',
             '<title>If you choose not to have an agent — Ricky Rampersad Branch</title>',
             out, count=1, flags=re.S)

# the chrome mark: The Knot out, the shield in
out = re.sub(r'<svg class="mark" viewBox="0 0 88 88" aria-hidden="true">.*?</svg>',
             lambda m: SHIELD.format(cls=' sm', gid='shc').replace('class="shield sm"',
                                                                   'class="mark shield sm"'),
             out, count=1, flags=re.S)
out = re.sub(r'<span class="who">.*?</span>',
             '<span class="who">Ricky Rampersad Branch<i>Guardian Life of the Caribbean</i></span>',
             out, count=1, flags=re.S)
out = re.sub(r'<span class="live">.*?</span>', '', out, count=1, flags=re.S)

# the cover's own logo, and the favicon: both carry The Knot in the shell
out = re.sub(r'<svg class="biglogo" viewBox="0 0 88 88" aria-hidden="true">.*?</svg>',
             lambda m: SHIELD.format(cls='', gid='shb')
                              .replace('class="shield"', 'class="biglogo shield"')
                              .replace('width:78px', 'width:96px'),
             out, count=1, flags=re.S)
FAVICON = ("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 48'"
           "%3E%3Crect width='48' height='48' rx='11' fill='%2307131f'/%3E%3Cpath d='M24 8 L37 12 V24 "
           "C37 31 31 37 24 39 C17 37 11 31 11 24 V12 Z' fill='%23efc24b'/%3E%3Cpath d='M17.5 24.5 "
           "L22 29 L31 19' fill='none' stroke='%2307131f' stroke-width='3.6' stroke-linecap='round' "
           "stroke-linejoin='round'/%3E%3C/svg%3E")
out = re.sub(r'(<link rel="icon" href=")[^"]*(")', lambda m: m.group(1) + FAVICON + m.group(2),
             out, count=1)

# confetti in the branch's colours, not the project's
out = re.sub(r'const cols = \[[^\]]*\]',
             'const cols = ["#efc24b", "#c9942c", "#00CFEA", "#8fa8c0", "#ffffff"]',
             out, count=1)

# the cover
out = re.sub(r'<h1>The launch of<br>donthaveanagent<em>\.com</em></h1>',
             '<h1>If you choose<br>not to have <em>an agent</em></h1>', out, count=1)
out = re.sub(r'<div class="eyebrow" style="margin-top:16px">[^<]*</div>',
             '<div class="eyebrow" style="margin-top:16px">A Ricky Rampersad Branch film</div>',
             out, count=1)
out = re.sub(r'<button id="playBtn"><span class="tri"></span>[^<]*</button>',
             '<button id="playBtn"><span class="tri"></span>Watch — 90 seconds</button>', out, count=1)
out = re.sub(r'🔊 \d+ seconds, with music — tap to begin\.',
             '🔊 90 seconds, with sound — tap to begin.', out, count=1)

# the share line
# The \n pairs below must survive into the JavaScript as the two characters
# backslash-n, inside the string literals. Everything between the literals is
# real source, so the line breaks here are actual newlines.
MSG = ('const MSG = "What happens if you choose not to have an agent?\\n\\n" +\n'
       '  "Ninety seconds, from the Ricky Rampersad Branch. What keeps running either way, '
       'and what you give up.\\n\\n" +\n'
       '  "▶ https://rickyrampersadbranch.com/orphan-video";')
out = re.sub(r'const MSG = ".*?";', lambda m: MSG, out, count=1, flags=re.S)
out = out.replace('document.getElementById("waBtn").href =',
                  'if (document.getElementById("waBtn")) document.getElementById("waBtn").href =')

OUTDIR.mkdir(parents=True, exist_ok=True)
OUT.write_text(out)
print('wrote', OUT, len(out), 'bytes ·', len(ms), 'scenes ·', round(sum(D), 1), 's')
