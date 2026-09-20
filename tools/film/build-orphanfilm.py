#!/usr/bin/env python3
"""Assemble orphan-video/film.html from the proven client-film shell.

Same trick as build-wallfilm.py: the shell carries eight embedded woff2 faces
and the scene runner, both of which the recorder depends on, so it is cloned
and only the chrome-to-tapzone span is replaced. The theme is then overridden
to the branch's own — navy, gold and teal with the shield, not Ink & Coral —
because this film plays on rickyrampersadbranch.com, not donthaveanagent.com.

The film is agent-driven: it ends on getting a qualified agent, and it arms
the client with what the Insurance Act already entitles them to ask for.

No client name, no client count and no figure appears anywhere in it. The
file sits at a public URL once recorded, and the house rule on that is
absolute — the segments are named as things a client might hold, never as
counts of who holds them.

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
assert len(ms) == 17, f'expected 17 scenes, timing has {len(ms)}'

s = SRC.read_text()

# ── the branch's own look, appended last so it wins ───────────────────
CSS = r"""
/* ══ orphan film · branch theme ════════════════════════════════════════
   Navy ground, gold on the mark and the headlines, teal on everything that
   asks the viewer to do something. The donthaveanagent palette is
   deliberately not used here — two marks, two products, on purpose. */
.of{--navy:#07131f;--gold:#efc24b;--gold2:#c9942c;--teal:#00CFEA;--teal2:#0aa8bf;
    --ink:#e9f2fb;--dim:#8fa8c0;--line:rgba(239,194,75,.22);--tline:rgba(0,207,234,.3)}
.scene.of{background:
  radial-gradient(1000px 560px at 88% -16%,rgba(0,207,234,.13),transparent 60%),
  radial-gradient(1100px 620px at 10% -14%,rgba(239,194,75,.12),transparent 62%),
  linear-gradient(168deg,#0a2330 0%,#07131f 58%,#040d16 100%)}
.scene.of .inner{color:var(--ink)}
.scene.of h1,.scene.of h2{color:#fff;text-shadow:0 2px 34px rgba(0,0,0,.4)}
.scene.of h1 em,.scene.of h2 em{color:var(--gold);font-style:normal}
.scene.of .eyebrow{color:var(--teal)}
.scene.of .big-sub,.scene.of p{color:var(--dim)}
.scene.of.warm{background:
  radial-gradient(1100px 640px at 50% -10%,rgba(239,194,75,.20),transparent 64%),
  linear-gradient(168deg,#132534 0%,#07131f 62%,#040d16 100%)}
.scene.of.warm .eyebrow{color:var(--gold)}
.scene.of.law{background:
  radial-gradient(1200px 660px at 50% -12%,rgba(0,207,234,.20),transparent 62%),
  linear-gradient(168deg,#06212c 0%,#05131c 62%,#030b12 100%)}

/* the shield, drawn not linked — a linked image does not load in the capture */
.shield{width:78px;height:78px;display:block;margin:0 auto 18px}
.shield.sm{width:30px;height:30px;margin:0}
.scene.on .shield{animation:beatpop .6s ease}

/* ── rows that build one at a time ── */
.keeps{display:grid;gap:11px;max-width:640px;margin:20px auto 0}
.keep{display:flex;align-items:center;gap:14px;background:rgba(255,255,255,.04);
  border:1px solid var(--line);border-radius:13px;padding:14px 18px;text-align:left;
  opacity:0;transform:translateX(-14px)}
.scene.on .keep{animation:slidein .5s cubic-bezier(.2,.9,.3,1) forwards}
.scene.on .keep:nth-child(1){animation-delay:.30s}
.scene.on .keep:nth-child(2){animation-delay:.70s}
.scene.on .keep:nth-child(3){animation-delay:1.10s}
@keyframes slidein{to{opacity:1;transform:none}}
.keep .tk{width:31px;height:31px;flex:none;border-radius:50%;display:grid;place-items:center;
  background:linear-gradient(180deg,var(--gold),var(--gold2));color:#07131f;font:900 16px var(--head)}
.keep b{font:700 17.5px/1.2 var(--head);color:#fff;letter-spacing:-.01em}
.keep i{display:block;font-style:normal;font:400 13.5px var(--body);color:var(--dim);margin-top:3px}
.keep.off{border-color:rgba(255,255,255,.08);background:rgba(255,255,255,.02)}
.keep.off .tk{background:rgba(255,255,255,.08);color:#61798f;
  box-shadow:inset 0 0 0 1px rgba(255,255,255,.10)}
.keep.off b{color:#9fb4c8}
/* the things people find out too late: same shape, but worth something */
.keep.find{border-color:var(--tline);background:linear-gradient(90deg,rgba(0,207,234,.10),rgba(255,255,255,.03))}
.keep.find .tk{background:linear-gradient(180deg,var(--teal),var(--teal2));color:#052a33}

/* ── the pivot ── */
.pivot{font:900 clamp(30px,7vw,58px)/1.08 var(--head);color:#fff;letter-spacing:-.035em}
.pivot em{color:var(--gold);font-style:normal}

/* ── the price lock ── */
.lock{max-width:560px;margin:18px auto 0;background:rgba(239,194,75,.07);
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

/* ── the Act ── */
.act{max-width:760px;margin:16px auto 0;background:rgba(0,207,234,.07);
  border:1px solid var(--tline);border-left:4px solid var(--teal);border-radius:14px;
  padding:22px 26px;text-align:left}
.act .src{font:800 10px var(--head);letter-spacing:.2em;text-transform:uppercase;color:var(--teal)}
.act q{display:block;font:600 clamp(17px,3.1vw,25px)/1.38 var(--head);color:#fff;
  letter-spacing:-.015em;margin:11px 0 0;quotes:'\201C' '\201D'}
.act .ask{display:block;font:700 15px var(--body);color:var(--gold);margin-top:14px}

/* ── what a qualified agent is ── */
.creds{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;max-width:860px;margin:18px auto 0}
.cred{background:linear-gradient(180deg,rgba(0,207,234,.13),rgba(255,255,255,.03));
  border:1px solid var(--tline);border-radius:15px;padding:19px 19px 21px;text-align:left;
  opacity:0;transform:translateY(12px)}
.scene.on .cred{animation:slidein .5s cubic-bezier(.2,.9,.3,1) forwards}
.scene.on .cred:nth-child(1){animation-delay:.35s}
.scene.on .cred:nth-child(2){animation-delay:.70s}
.scene.on .cred:nth-child(3){animation-delay:1.05s}
.cred .n{font:900 11px var(--head);letter-spacing:.2em;text-transform:uppercase;color:var(--teal)}
.cred b{display:block;font:800 17px/1.2 var(--head);color:#fff;margin:8px 0 6px;letter-spacing:-.02em}
.cred span{font:400 13px/1.45 var(--body);color:var(--dim)}

/* ── the click ── */
.click{display:inline-flex;align-items:center;gap:11px;
  background:linear-gradient(135deg,var(--teal),var(--teal2));
  color:#fff;border-radius:12px;padding:15px 26px;font:800 19px var(--head);letter-spacing:-.01em;
  margin-top:18px;box-shadow:0 18px 44px rgba(0,207,234,.28)}
.scene.on .click{animation:beatpop .6s .5s ease both}
.cur{width:19px;height:19px}

/* ── close ── */
.signoff{font:800 clamp(21px,4.4vw,33px)/1.2 var(--head);color:#fff;letter-spacing:-.025em}
.signoff i{display:block;font-style:normal;font:500 14px var(--body);color:var(--dim);
  letter-spacing:.04em;margin-top:11px}
.url{display:inline-block;margin-top:18px;font:700 14.5px var(--head);color:var(--teal);
  border:1px solid var(--tline);border-radius:9px;padding:9px 17px}

/* the chrome and the progress bar take the branch's colours: the shell's own
   rules are coral, and they sit later in the cascade, so these are explicit. */
#chrome .who{color:#e9f2fb}
#chrome .who i{color:#8fa8c0}
#bars i{background:rgba(0,207,234,.16)}
#bars i::after{background:linear-gradient(90deg,var(--teal2),var(--teal))}
#bars i.done::after{background:rgba(0,207,234,.45)}
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

<!-- 5 · and the branch keeps writing -->
<section class="scene of" data-d="{ms[4]}">
  <div class="inner">
    <div class="eyebrow st">And the branch keeps writing</div>
    <div class="keeps">
      <div class="keep"><span class="tk">&#9993;</span><div><b>A note on your birthday</b>
        <i>Every year, agent or no agent</i></div></div>
      <div class="keep"><span class="tk">&#9200;</span><div><b>A reminder before a premium is due</b>
        <i>So nothing lapses by accident</i></div></div>
      <div class="keep"><span class="tk">&#9742;</span><div><b>A desk that answers</b>
        <i>A person, not a menu</i></div></div>
    </div>
  </div>
</section>

<!-- 6 · the pivot -->
<section class="scene of warm" data-d="{ms[5]}">
  <div class="inner">
    <div class="pivot st">So what do you<br><em>actually give up?</em></div>
  </div>
</section>

<!-- 7 · nobody reviews the fit -->
<section class="scene of" data-d="{ms[6]}">
  <div class="inner">
    <div class="eyebrow st">Without someone of your own</div>
    <div class="keeps">
      <div class="keep off"><span class="tk">&#8212;</span><div><b>Nobody reviews the fit</b>
        <i>Whether the cover you bought still matches the life you have</i></div></div>
    </div>
  </div>
</section>

<!-- 8 · nobody opens the policy -->
<section class="scene of" data-d="{ms[7]}">
  <div class="inner">
    <div class="eyebrow st">And nobody opens the policy</div>
    <h1 class="st d2">Nobody tells you what<br>is <em>already inside it.</em></h1>
  </div>
</section>

<!-- 9 · the segments, named as things a client might hold -->
<section class="scene of" data-d="{ms[8]}">
  <div class="inner">
    <div class="eyebrow st">Things people find out too late</div>
    <div class="keeps">
      <div class="keep find"><span class="tk">&#9873;</span><div><b>A waiver of premium</b>
        <i>If illness or injury stops you working, it pays your premiums for you</i></div></div>
      <div class="keep find"><span class="tk">&#9873;</span><div><b>A policy that has matured</b>
        <i>It reached the end of its term. The money is yours and it is waiting</i></div></div>
      <div class="keep find"><span class="tk">&#9873;</span><div><b>Value in one that lapsed</b>
        <i>A policy that stopped does not always stop being worth something</i></div></div>
    </div>
  </div>
</section>

<!-- 10 · nobody notices -->
<section class="scene of" data-d="{ms[9]}">
  <div class="inner">
    <div class="eyebrow st">Nobody notices a stopped payment</div>
    <h1 class="st d2">Until a letter arrives,<br>and by then it has been<br><em>months.</em></h1>
  </div>
</section>

<!-- 11 · the price lock -->
<section class="scene of warm" data-d="{ms[10]}">
  <div class="inner">
    <div class="eyebrow st">The part worth protecting</div>
    <div class="lock st d2">
      <div class="age">Your age<br>when you started</div>
      <div class="cap">is the price you still pay</div>
      <div class="yrs">{YEARS}</div>
    </div>
  </div>
</section>

<!-- 12 · nobody can sell it back -->
<section class="scene of" data-d="{ms[11]}">
  <div class="inner">
    <div class="eyebrow st">Which is why it matters</div>
    <h1 class="st d2">Nobody can sell you<br>that price again.<br><em>Not us. Not anyone.</em></h1>
  </div>
</section>

<!-- 13 · if anyone asks you to change it -->
<section class="scene of law" data-d="{ms[12]}">
  <div class="inner">
    <div class="eyebrow st">If anyone asks you to change it</div>
    <h1 class="st d2">The law is already<br><em>on your side.</em></h1>
  </div>
</section>

<!-- 14 · the Act -->
<section class="scene of law" data-d="{ms[13]}">
  <div class="inner">
    <div class="act st d2">
      <div class="src">The Insurance Act &middot; Trinidad and Tobago</div>
      <q>An agent, agency, broker, brokerage or a sales representative shall not &hellip; cause a
        policyholder to replace a long-term insurance policy without first discussing the advantages
        and disadvantages of the discontinuance of the policy.</q>
      <span class="ask">So ask for it in writing. Anyone acting properly will give it to you.</span>
    </div>
  </div>
</section>

<!-- 15 · what a qualified agent is -->
<section class="scene of" data-d="{ms[14]}">
  <div class="inner">
    <div class="eyebrow st">That is what your own agent is for</div>
    <div class="creds">
      <div class="cred"><div class="n">Trained</div>
        <b>Examined before they advise</b>
        <span>Not a friend of the family with a form. Someone who has had to earn the right.</span></div>
      <div class="cred"><div class="n">Registered</div>
        <b>On the record, by law</b>
        <span>No individual may act as an agent in Trinidad and Tobago unless they are registered.</span></div>
      <div class="cred"><div class="n">Answerable</div>
        <b>To you, and to the branch</b>
        <span>Their advice is on your file, and the branch stands behind it.</span></div>
    </div>
  </div>
</section>

<!-- 16 · the introduction -->
<section class="scene of warm" data-d="{ms[15]}">
  <div class="inner">
    <div class="eyebrow st">We will make the introduction</div>
    <h1 class="st d2">Let us introduce you<br>to <em>yours.</em></h1>
    <div class="click st d3">
      <svg class="cur" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4"
           stroke-linecap="round" stroke-linejoin="round">
        <path d="M5 3l14 9-6 1.5L10 20z"/></svg>
      One click, and we do the rest.
    </div>
  </div>
</section>

<!-- 17 · close -->
<section class="scene of warm" data-d="{ms[16]}">
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
             'const cols = ["#00CFEA", "#efc24b", "#0aa8bf", "#8fa8c0", "#ffffff"]',
             out, count=1)

# the cover
out = re.sub(r'<h1>The launch of<br>donthaveanagent<em>\.com</em></h1>',
             '<h1>If you choose<br>not to have <em>an agent</em></h1>', out, count=1)
out = re.sub(r'<div class="eyebrow" style="margin-top:16px">[^<]*</div>',
             '<div class="eyebrow" style="margin-top:16px">A Ricky Rampersad Branch film</div>',
             out, count=1)
out = re.sub(r'<button id="playBtn"><span class="tri"></span>[^<]*</button>',
             '<button id="playBtn"><span class="tri"></span>Watch — under two minutes</button>',
             out, count=1)
out = re.sub(r'🔊 \d+ seconds, with music — tap to begin\.',
             '🔊 Under two minutes, with sound — tap to begin.', out, count=1)

# The \n pairs below must survive into the JavaScript as the two characters
# backslash-n, inside the string literals. Everything between the literals is
# real source, so the line breaks here are actual newlines.
MSG = ('const MSG = "What happens if you choose not to have an agent?\\n\\n" +\n'
       '  "From the Ricky Rampersad Branch — what carries on either way, what is already inside '
       'your policy, and what the Insurance Act entitles you to ask for.\\n\\n" +\n'
       '  "▶ https://rickyrampersadbranch.com/orphan-video";')
out = re.sub(r'const MSG = ".*?";', lambda m: MSG, out, count=1, flags=re.S)
out = out.replace('document.getElementById("waBtn").href =',
                  'if (document.getElementById("waBtn")) document.getElementById("waBtn").href =')

OUTDIR.mkdir(parents=True, exist_ok=True)
OUT.write_text(out)
print('wrote', OUT, len(out), 'bytes ·', len(ms), 'scenes ·', round(sum(D), 1), 's')
