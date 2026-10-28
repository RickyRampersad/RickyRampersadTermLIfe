#!/usr/bin/env python3
"""
Build the FY27 blast-off film page from blastoff-lines.json + blastoff-timing.json.

  python3 build-blastoff.py

WHY IT IS ITS OWN BUILDER
  The board films draw board screens; this one draws one object changing. It
  shares their machinery (the shell's SC/go/paused contract, so render.js and
  mixany.py drive it unchanged) and nothing else.

THE METAPHOR IS THE BRAND'S OWN SILHOUETTE
  Asked for on 28 October 2026 as "a refresh or rebirth coming out of a
  cocoon". The chrysalis is the branch's own shield, sealed: the shape in
  logo-mark.svg, nothing redrawn and nothing invented. It is lit along its
  centre seam, it fills with the year's figures and with the lattice of the
  new way of working, the seam splits, the halves swing out like wings, and
  they close back into the whole shield with the check stroking on. One
  object, eleven scenes, so the film reads as one thing becoming itself
  rather than eleven slides.

  Never a drawn butterfly. The same rule that took the cartoon car off the
  motor page: abstract and geometric, or it reads as a child's drawing.

THE LOOK IS THE WALL'S
  Warm graphite, a soft gold and a soft teal, the values Wall Intelligence
  already runs (--bg #121317, --gold #E3B85A, --teal #4FC1B0). It plays
  beside /howweworkvid/, which is recorded off that wall, so it has to look
  like its sibling. Not the hard #efc24b and #00CFEA, which were chosen for
  a near-black page and read as neon on graphite.

EVERY VISUAL IS A CSS ANIMATION
  render.js pauses the page and sets each animation to the frame's own
  moment. Anything driven by a JS timer would not be scrubbable and would
  drift from the voice, so there is no setTimeout in a scene.
"""
import json, re, pathlib

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent.parent
SHELL = ROOT / 'donthaveanagent' / 'client-film.html'
LINES = json.loads((HERE / 'blastoff-lines.json').read_text())
TIMING = HERE / 'blastoff-timing.json'
OUT = ROOT / 'blastoff' / 'film.html'

# the shield, straight out of logo-mark.svg — the silhouette, and the check
SHIELD = 'M44 9L73 21.5V41C73 60.5 60.5 72 44 78.5C27.5 72 15 60.5 15 41V21.5Z'
CHECK = 'M30 44L39.5 53.5L58 32.5'
# the same shield cut down its centre line, so the halves can swing apart
LEFT = 'M44 9L15 21.5V41C15 60.5 27.5 72 44 78.5Z'
RIGHT = 'M44 9L73 21.5V41C73 60.5 60.5 72 44 78.5Z'

durs = json.loads(TIMING.read_text())['durs'] if TIMING.exists() else [5000] * len(LINES['scenes'])


def shell_svg(cls='', extra=''):
    return (f'<svg class="sh {cls}" viewBox="0 0 88 88" aria-hidden="true">'
            f'<path class="shL" d="{LEFT}"/><path class="shR" d="{RIGHT}"/>{extra}</svg>')


def words(text, cls='w'):
    """A headline that lands word by word — never letter by letter, which is the
       dated form and reads as a pile of spans to a screen reader."""
    return ''.join(f'<span class="{cls}" style="--i:{i}">{w}&nbsp;</span>'
                   for i, w in enumerate(text.split(' ')))


def scr(lines, cls=''):
    return ''.join(f'<div class="ln {cls}" style="--i:{i}">{t}</div>' for i, t in enumerate(lines))


def V(name, s):
    """One scene's innards. `s` is its entry from blastoff-lines.json."""
    on = s.get('screen', [])

    if name == 'seam':
        return (f'<div class="bostage">{shell_svg("dim")}'
                f'<div class="seam"></div><div class="glowdot"></div></div>'
                f'<div class="cap">{scr(on)}</div>')

    if name == 'figures':
        tiles = ''.join(
            f'<div class="bofig" style="--i:{i}"><b>{t}</b></div>' for i, t in enumerate(on))
        return (f'<div class="bostage">{shell_svg("dim")}<div class="seam lit"></div></div>'
                f'<div class="figs">{tiles}</div>')

    if name == 'lattice':
        # a triangulated mesh that draws itself inside the shell: the system, assembling
        import math
        pts = [(44 + 19 * math.cos(math.radians(a)), 44 + 21 * math.sin(math.radians(a)))
               for a in range(-90, 270, 45)]
        seg = []
        for i, (x, y) in enumerate(pts):
            for j in range(i + 1, len(pts)):
                x2, y2 = pts[j]
                seg.append(f'<line class="lt" style="--i:{len(seg)}" x1="{x:.1f}" y1="{y:.1f}" x2="{x2:.1f}" y2="{y2:.1f}"/>')
        nodes = ''.join(f'<circle class="nd" style="--i:{i}" cx="{x:.1f}" cy="{y:.1f}" r="1.9"/>'
                        for i, (x, y) in enumerate(pts))
        return (f'<div class="bostage">{shell_svg("dim", "".join(seg) + nodes)}</div>'
                f'<div class="cap">{scr(on)}</div>')

    if name == 'tight':
        return (f'<div class="bostage breathe">{shell_svg("sealed")}<div class="seam bohot"></div></div>'
                f'<div class="cap"><h2 class="kin">{words(on[0])}</h2></div>')

    if name == 'crack':
        return (f'<div class="bostage">{shell_svg("split")}'
                f'<div class="burst"></div><div class="rays"></div></div>'
                f'<div class="cap"><h2 class="kin">{words(on[0])}</h2></div>')

    if name == 'table':
        rows = ''.join(f'<i style="--i:{i}"></i>' for i in range(5))
        return (f'<div class="cap top"><div class="eyeb">{on[0]}</div>'
                f'<div class="dt">{on[1]}</div></div>'
                f'<div class="tbl"><div class="card"><div class="ch"></div>{rows}</div></div>')

    if name == 'invite':
        return (f'<div class="cap big"><div class="eyeb">{on[0]}</div>'
                f'<div class="noon">{on[1]}</div></div>')

    if name == 'silence':
        bars = ''.join(f'<i style="--i:{i};--w:{w}%"></i>' for i, w in
                       enumerate([84, 62, 93, 71, 55, 88, 66]))
        return (f'<div class="quietpage">{bars}</div>'
                f'<div class="cap"><h2 class="kin">{words(on[0] + " " + on[1])}</h2></div>')

    if name == 'quietest':
        bars = ''.join(f'<i style="--i:{i};--h:{h}%" class="eq"></i>' for i, h in
                       enumerate([26, 94, 41, 100, 33, 78, 22, 88, 30]))
        return (f'<div class="eqrow">{bars}</div>'
                f'<div class="cap"><h2 class="kin">{words(on[0])}</h2></div>')

    if name == 'ask':
        return (f'<div class="cap big"><div class="bourl">{on[0]}</div>'
                f'<div class="three"><span style="--i:0"></span><span style="--i:1"></span>'
                f'<span style="--i:2"></span></div>'
                f'<div class="eyeb bolo">{on[1]}</div></div>')

    if name == 'flight':
        ck = '<path class="ck" d="' + CHECK + '"/>'
        return (f'<div class="bostage">{shell_svg("fly", ck)}</div>'
                f'<div class="cap"><div class="noon sm">{on[0]}</div>'
                f'<div class="eyeb bolo">Ricky Rampersad Branch</div></div>')

    return f'<div class="cap">{scr(on)}</div>'


sections = []
for i, s in enumerate(LINES['scenes']):
    d = durs[i] if i < len(durs) else 5000
    # The shell's go() fires confetti() on the last scene and it looks for
    # #finale; without it the page throws and render.js stops. The close here
    # is the shield coming back whole, so the id is given and the confetti
    # itself is hidden in CSS — a burst of paper would cheapen it.
    fin = ' id="finale"' if i == len(LINES['scenes']) - 1 else ''
    sections.append(f'<section class="scene bo v-{s["v"]}" data-d="{int(d)}"{fin}>'
                    f'<div class="inner">{V(s["v"], s)}</div></section>')
SCENES = '\n'.join(sections)

CSS = r"""
/* ══ the FY27 blast-off (build-blastoff.py) ═══════════════════════════════
   One object — the branch's own shield — sealed, filled, cracked and flown.
   Every motion is a CSS animation so render.js can set it to the frame's own
   moment; a JS timer here would drift from the voice. */
.bo{--bg:#121317;--ink:#F4F1EA;--mut:#A9AEBA;--gold:#E3B85A;--teal:#4FC1B0;--line:#2E323C}
.bo,.bo .inner{background:#121317;color:#F4F1EA}
.bo .inner{position:absolute;inset:0 0 104px 0;display:grid;place-items:center;gap:0;padding:0;max-width:none}
/*  THE MIXER CROPS THE BOTTOM 104px AWAY. mixany.py takes 1280x616 out of the
 *  frame and pads the caption strip back underneath, so anything laid out
 *  against the bottom of a 720px page is cut in half in the MP4 — the first
 *  cut lost the foot of 'The system sets the day' and of 'Friday 12 noon'.
 *  The scene box therefore ends at 616, and every percentage inside it is a
 *  percentage of what survives. */
.bo *{font-family:'IBM Plex Sans',system-ui,sans-serif}
.bo .bostage{position:relative;width:min(64vh,47vw);aspect-ratio:1;display:grid;place-items:center}
.bo .sh{position:absolute;inset:0;width:100%;height:100%;overflow:visible;perspective:900px}
.bo .sh path.shL,.bo .sh path.shR{fill:none;stroke:#2E323C;stroke-width:2.2;
  transform-box:fill-box;transform-origin:100% 50%}
.bo .sh path.shR{transform-origin:0% 50%}
.bo .sh.dim path{stroke:#39404D}
.bo .sh.sealed path{stroke:var(--gold);filter:drop-shadow(0 0 .5rem rgba(227,184,90,.5))}

/* 1 · the seam of light down the centre line */
.bo .seam{position:absolute;top:11%;bottom:11%;width:2px;background:linear-gradient(180deg,
  transparent,var(--gold),transparent);opacity:0;animation:seamIn 2.2s .3s both,seamBr 3.4s 2.2s infinite}
.bo .seam.lit{animation:seamIn .6s both,seamBr 3s .6s infinite}
.bo .seam.hot{animation:seamIn .5s both,seamHot 1.8s .5s infinite}
@keyframes seamIn{from{opacity:0;transform:scaleY(.1)}to{opacity:1;transform:scaleY(1)}}
@keyframes seamBr{0%,100%{opacity:.55;box-shadow:0 0 .7rem .1rem rgba(227,184,90,.35)}
  50%{opacity:1;box-shadow:0 0 1.6rem .2rem rgba(227,184,90,.6)}}
@keyframes seamHot{0%,100%{opacity:.8;box-shadow:0 0 1rem .15rem rgba(227,184,90,.5)}
  50%{opacity:1;box-shadow:0 0 2.6rem .4rem rgba(227,184,90,.85)}}
.bo .glowdot{position:absolute;width:.5rem;height:.5rem;border-radius:50%;background:var(--gold);
  opacity:0;animation:dotUp 2.6s 1s both}
@keyframes dotUp{0%{opacity:0;transform:translateY(5rem) scale(.4)}
  40%{opacity:1}100%{opacity:0;transform:translateY(-5rem) scale(1.3)}}

/* 3 · the lattice drawing itself */
.bo .lt{stroke:var(--teal);stroke-width:.4;opacity:0;
  stroke-dasharray:60;stroke-dashoffset:60;animation:draw .5s calc(.25s + var(--i)*45ms) both}
@keyframes draw{from{opacity:0;stroke-dashoffset:60}to{opacity:.45;stroke-dashoffset:0}}
.bo .nd{fill:var(--teal);opacity:0;animation:pop .4s calc(.9s + var(--i)*70ms) both}
@keyframes pop{from{opacity:0;transform:scale(0)}to{opacity:1;transform:scale(1)}}

/* 4 · the breath before it opens */
.bo .breathe{animation:breathe 3.2s ease-in-out infinite}
@keyframes breathe{0%,100%{transform:scale(1)}50%{transform:scale(.975)}}

/* 5 · the seam splits, the halves part, light floods through */
.bo .sh.split path.shL{stroke:var(--gold);animation:openL 1.9s .35s both}
.bo .sh.split path.shR{stroke:var(--gold);animation:openR 1.9s .35s both}
@keyframes openL{0%{transform:none}
  22%{transform:translateX(-1%) rotateY(-6deg)}
  100%{transform:translateX(-16%) rotateY(-38deg)}}
@keyframes openR{0%{transform:none}
  22%{transform:translateX(1%) rotateY(6deg)}
  100%{transform:translateX(16%) rotateY(38deg)}}
.bo .burst{position:absolute;width:38%;aspect-ratio:1;border-radius:50%;
  background:radial-gradient(circle,rgba(227,184,90,.85),rgba(227,184,90,0) 68%);
  opacity:0;animation:burst 2.4s .5s both}
@keyframes burst{0%{opacity:0;transform:scale(.2)}35%{opacity:1}100%{opacity:.55;transform:scale(2.5)}}
.bo .rays{position:absolute;inset:-30%;opacity:0;animation:rays 2.6s .6s both;
  background:repeating-conic-gradient(from 0deg,rgba(227,184,90,.16) 0deg 3deg,transparent 3deg 14deg)}
@keyframes rays{0%{opacity:0;transform:rotate(-8deg) scale(.7)}
  40%{opacity:.9}100%{opacity:.35;transform:rotate(10deg) scale(1.15)}}

/* 11 · the halves swing wide, then close back whole and the check strokes on */
.bo .sh.fly path.shL{stroke:var(--gold);animation:flyL 3.4s both}
.bo .sh.fly path.shR{stroke:var(--gold);animation:flyR 3.4s both}
@keyframes flyL{0%{transform:translateX(-16%) rotateY(-38deg)}
  34%{transform:translateX(-26%) rotateY(-68deg)}100%{transform:none}}
@keyframes flyR{0%{transform:translateX(16%) rotateY(38deg)}
  34%{transform:translateX(26%) rotateY(68deg)}100%{transform:none}}
.bo .ck{fill:none;stroke:#F4F1EA;stroke-width:6.5;stroke-linecap:round;stroke-linejoin:round;
  stroke-dasharray:46;stroke-dashoffset:46;animation:stroke .9s 2.5s both}
@keyframes stroke{to{stroke-dashoffset:0}}

/* type */
.bo .cap{position:absolute;left:0;right:0;bottom:7%;text-align:center;padding:0 6%}
.bo .cap.top{top:12%;bottom:auto}
.bo .cap.big{position:static;text-align:center}
.bo .ln{font-size:clamp(1.1rem,2.5vw,2rem);font-weight:700;letter-spacing:-.01em;
  opacity:0;animation:rise .7s calc(.3s + var(--i)*.42s) both}
@keyframes rise{from{opacity:0;transform:translateY(1.1rem)}to{opacity:1;transform:none}}
.bo .kin{font-size:clamp(1.4rem,3.6vw,3rem);font-weight:800;letter-spacing:-.02em;margin:0;line-height:1.12}
.bo .kin .w{display:inline-block;opacity:0;animation:wIn .55s calc(.25s + var(--i)*.09s) both}
@keyframes wIn{from{opacity:0;transform:translateY(.8rem) scale(.94);filter:blur(5px)}
  to{opacity:1;transform:none;filter:none}}
.bo .eyeb{font-size:clamp(.72rem,1.2vw,1rem);letter-spacing:.26em;font-weight:800;color:var(--gold);
  text-transform:uppercase;opacity:0;animation:rise .7s .3s both}
.bo .eyeb.lo{color:var(--mut);letter-spacing:.2em;animation-delay:2.9s}
.bo .dt{font-size:clamp(1rem,2vw,1.6rem);color:var(--mut);margin-top:.6rem;
  opacity:0;animation:rise .7s .8s both}
.bo .noon{font-size:clamp(2.4rem,8vw,6.6rem);font-weight:800;letter-spacing:-.04em;line-height:1;
  margin-top:.5rem;opacity:0;animation:noonIn .9s .7s both}
.bo .noon.sm{font-size:clamp(1.8rem,5vw,4rem);margin-bottom:.9rem}
@keyframes noonIn{from{opacity:0;transform:scale(.86);filter:blur(8px)}to{opacity:1;transform:none;filter:none}}
.bo .bourl{font-family:'JetBrains Mono',ui-monospace,monospace;font-weight:700;
  font-size:clamp(.95rem,2.4vw,2rem);color:var(--teal);opacity:0;animation:rise .7s .3s both;
  word-break:break-word}

/* 2 · the year's figures */
.bo .figs{position:absolute;left:0;right:0;bottom:9%;display:flex;gap:clamp(.8rem,3vw,3rem);
  justify-content:center;flex-wrap:wrap;padding:0 5%}
.bo .bofig{opacity:0;animation:rise .7s calc(.5s + var(--i)*.5s) both}
.bo .bofig b{display:block;font-size:clamp(1rem,2.4vw,2rem);font-weight:800;color:var(--gold)}

/* 6 · the record on the table */
.bo .tbl{display:grid;place-items:center}
.bo .card{width:min(44vw,30rem);padding:clamp(1rem,2.4vw,2rem);border:1px solid var(--line);
  border-radius:.8rem;background:#17191E;opacity:0;animation:cardIn .9s .9s both}
@keyframes cardIn{from{opacity:0;transform:translateY(1.6rem) rotateX(14deg)}to{opacity:1;transform:none}}
.bo .card .ch{height:.5rem;width:42%;background:var(--gold);border-radius:99px;margin-bottom:1rem}
.bo .card i{display:block;height:.42rem;border-radius:99px;background:#2E323C;margin:.62rem 0;
  width:0;animation:grow .5s calc(1.5s + var(--i)*.22s) both}
@keyframes grow{to{width:var(--w,88%)}}
.bo .card i:nth-child(3){--w:72%}.bo .card i:nth-child(5){--w:64%}.bo .card i:nth-child(6){--w:80%}

/* 8 · what was written, read in silence */
.bo .quietpage{position:absolute;top:16%;left:50%;transform:translateX(-50%);
  width:min(52vw,36rem);display:grid;gap:.75rem}
.bo .quietpage i{height:.46rem;border-radius:99px;background:#39404D;width:0;
  animation:grow .45s calc(.3s + var(--i)*.3s) both}
.bo .quietpage i{--w:var(--w)}

/* 9 · every voice the same height */
.bo .eqrow{position:absolute;top:20%;left:50%;transform:translateX(-50%);height:26vh;
  display:flex;align-items:flex-end;gap:clamp(.4rem,1.4vw,1.1rem)}
.bo .eq{width:clamp(.8rem,2.4vw,2.2rem);border-radius:.3rem .3rem 0 0;background:#39404D;
  height:var(--h);animation:level 1.3s calc(1.1s + var(--i)*.07s) both}
@keyframes level{to{height:72%;background:var(--teal)}}

/* the shell's confetti has no place in this close */
.bo .conf{display:none!important}

/* 10 · three questions */
.bo .three{display:flex;gap:.9rem;justify-content:center;margin:1.4rem 0 1rem}
.bo .three span{width:clamp(2.2rem,5vw,3.4rem);height:.42rem;border-radius:99px;background:#39404D;
  animation:fill .5s calc(1.1s + var(--i)*.4s) both}
@keyframes fill{to{background:var(--gold)}}
"""

# ── the shell's own class names leak into the scenes ─────────────────────
#  The film shell styles .stage, .url, .fig, .hot and others for its own
#  scenes, and a collision does not error — it quietly wins. The first cut
#  of this film used .stage and the shell's rule collapsed it from 461px to
#  146, so the shield rendered at a sixth of its size and the metaphor the
#  whole film rests on was a smudge. build-boardfilm.py refuses to write a
#  page with a collision for exactly this reason; so does this.
def _guard(html):
    css = '\n'.join(re.findall(r'<style>(.*?)</style>', SHELL.read_text(), re.S))
    theirs = set(re.findall(r'\.([a-zA-Z][\w-]*)', css))
    ours = set()
    for m in re.findall(r'class="([^"]+)"', SCENES):
        ours.update(m.split())
    keep = {'scene', 'inner', 'on'}          # the shell's own contract, used on purpose
    bad = sorted((ours & theirs) - keep)
    if bad:
        raise SystemExit('These scene classes are already styled by the shell and would be '
                         'overridden silently: ' + ', '.join('.' + c for c in bad))

_guard(SCENES)

shell = SHELL.read_text()
chrome_end = shell.index('</div>', shell.index('<div id="chrome">')) + len('</div>')
tap = shell.index('<div class="tapzone" id="zL"')
out = shell[:chrome_end] + '\n' + SCENES + '\n\n' + shell[tap:]
last = out.rindex('</style>')
out = out[:last] + CSS + '\n' + out[last:]
out = re.sub(r'<title>.*?</title>',
             '<title>Out of the quiet — Ricky Rampersad Branch</title>', out, count=1, flags=re.S)
out = re.sub(r'<span class="who">.*?</span>',
             '<span class="who">Ricky Rampersad Branch<i>FY27</i></span>', out, count=1, flags=re.S)
out = re.sub(r'<span class="live">.*?</span>', '', out, count=1, flags=re.S)
out = out.replace('<body>', '<body class="boff">')

# The shell is donthaveanagent's: its chrome carries The Knot in Ink & Coral
# and its progress bars are coral. This is a branch film, so both become the
# branch's own gold shield and gold bars. Nothing is redrawn — the path is
# logo-mark.svg's.
MARK = ('<svg class="mark" viewBox="0 0 88 88" aria-hidden="true">'
        '<defs><linearGradient id="bg1" x1="0" y1="0" x2="1" y2="1">'
        '<stop offset="0%" stop-color="#f0c448"/><stop offset="60%" stop-color="#c9942c"/>'
        '<stop offset="100%" stop-color="#7a5810"/></linearGradient></defs>'
        f'<path d="{SHIELD}" fill="url(#bg1)"/>'
        f'<path d="{CHECK}" stroke="#0d1f33" stroke-width="6.5" fill="none" '
        'stroke-linecap="round" stroke-linejoin="round"/>'
        f'<path d="{CHECK}" stroke="#fff" stroke-width="2.8" fill="none" '
        'stroke-linecap="round" stroke-linejoin="round"/></svg>')
out = re.sub(r'<svg class="mark" viewBox="0 0 88 88" aria-hidden="true">.*?</svg>',
             lambda m: MARK, out, count=1, flags=re.S)

# The shell also wires a WhatsApp share button these scenes do not carry, and
# the throw stops every line of its script after it.
out = out.replace('document.getElementById("waBtn").href = "https://wa.me/?text=" + encodeURIComponent(MSG);',
                  'var _wa = document.getElementById("waBtn");\n'
                  'if (_wa) _wa.href = "https://wa.me/?text=" + encodeURIComponent(MSG);')

out += ('\n<style>'
        'body.boff{background:#121317}body.boff .orb{display:none}'
        'body.boff #chrome .who{color:#A9AEBA}body.boff #chrome .who i{color:#737886}'
        'body.boff #bars i{background:#23262E}'
        'body.boff #bars i::after{background:#E3B85A}'
        'body.boff #bars i.done{background:#E3B85A}'
        'body.boff #bars i.run::after{background:#E3B85A}'
        '</style>\n')

OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(out)
tot = sum(durs) / 1000
print(f'{OUT.relative_to(ROOT)} — {len(LINES["scenes"])} scenes, {tot:.1f}s')
