#!/usr/bin/env python3
"""The FY27 rise — /blastoff/, second cut.

Asked for on 28 October 2026, the evening before the branch group sees it:
"we had about 12 agents who left us... it's our first meeting coming together
after they have left. We want to rise strong and something that signifies the
uprise. So even more powerful, more graphs, more charts, more colors, more
graphics, more motion."

Two rules decided how that was answered.

NOBODY WHO LEFT IS CHARACTERISED, AND NOBODY IS COUNTED.  The house rule on
the transition letters is that Guardian Life's notice is stated and nothing
else: no reason, no adjective, no number.  This file sits at a public URL, so
it holds to that harder, not more loosely.  One line says the branch took a
hit; the crack in the shield says the rest.  What the film actually counts is
who stayed — which is the stronger answer anyway, and it is true.

NO CLIENT ANYTHING.  Never a client name and never a client count in an MP4
(the files are public even when the pages are noindex).  So the campaign's own
numbers, which are client counts, are not here.  Every figure on screen is
about our own people, our own year, and Friday's own agenda.

The spine is the branch's own roster, read out of Salesforce on 28 October
2026: the active AGENT contacts of the two units.  Twenty-two of them carry a
hire date and 263.0 years between them.  The bars show FULL years each, which
is why they sum to 252 and the headline says 263 — the difference is the part
years, and the chart says "full years" on it so the two can be reconciled by
anyone who adds them up.  Flooring rather than rounding also keeps the bands
honest: Randolph is 9.94 years in and belongs under the ten-year line, and
rounding put a "10" on a bar that the ten-year colour does not claim.
"""

import json, math, re, pathlib
from datetime import date

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent.parent
SHELL = ROOT / 'donthaveanagent' / 'client-film.html'
LINES = json.loads((HERE / 'rise-lines.json').read_text())
TIMING = HERE / 'rise-timing.json'
OUT = ROOT / 'blastoff' / 'film.html'

TODAY = date(2026, 10, 30)                 # Friday, the meeting

# the shield, straight out of logo-mark.svg — nothing here is redrawn
SHIELD = 'M44 9L73 21.5V41C73 60.5 60.5 72 44 78.5C27.5 72 15 60.5 15 41V21.5Z'
CHECK = 'M30 44L39.5 53.5L58 32.5'
# the same silhouette cut down the centre, so a crack can run through it
LEFT = 'M44 9L15 21.5V41C15 60.5 27.5 72 44 78.5Z'
RIGHT = 'M44 9L73 21.5V41C73 60.5 60.5 72 44 78.5Z'

# ── the roster ───────────────────────────────────────────────────────────────
# Active AGENT contacts, units Ricky_Rampersad and Akaash_Kalladeen, read from
# Salesforce on 28 October 2026.  First names only: a surname on a public film
# earns nothing.  Steven Blanc is active with no hire date on file, so he is in
# the twenty-three and not in the chart; the chart says twenty-two.
ROSTER = [
    ("Ricky", 1993, 12), ("Narissa", 1999, 7), ("Richard", 2003, 8),
    ("Premchand", 2004, 12), ("Javid", 2005, 11), ("Aleema", 2005, 11),
    ("Akaash", 2011, 7), ("Joy", 2012, 9), ("Faizal", 2012, 10),
    ("Meera", 2014, 10), ("Petra", 2016, 4), ("Randolph", 2016, 11),
    ("Neil", 2018, 7), ("Varun", 2019, 6), ("Darryl", 2021, 4),
    ("Malcolm", 2022, 4), ("Fawwaz", 2023, 3), ("Stephanie", 2023, 3),
    ("Jamil", 2023, 8), ("Daniel", 2025, 7), ("Felicia", 2025, 8),
    ("Rajiv", 2026, 7),
]
SUPPORT = ["Kamla", "Sasha", "Elizabeth", "Azariah", "Pawan"]

PEOPLE = []
for nm, y, m in ROSTER:
    yrs = (TODAY - date(y, m, 1)).days / 365.25
    PEOPLE.append({
        'n': nm,
        'y': yrs,
        'full': int(yrs),                      # full years served
        'band': 'g' if yrs >= 10 else ('t' if yrs < 3 else 's'),
    })
PEOPLE.sort(key=lambda p: -p['y'])
TOTAL = int(round(sum(p['y'] for p in PEOPLE)))        # 263
LONG = sum(1 for p in PEOPLE if p['band'] == 'g')      # 11
NEW = sum(1 for p in PEOPLE if p['band'] == 't')       # 3
MID = len(PEOPLE) - LONG - NEW                         # 8
HEADCOUNT = len(ROSTER) + 1                            # +1, the one with no date
MAXY = max(p['y'] for p in PEOPLE)

# data-d is milliseconds. importvox.py writes rise-timing.json in SECONDS and
# the older hand-built timing files are in milliseconds, which is a quiet way
# to build an 18-scene film 0.1s long — so the unit is decided here, out loud,
# rather than assumed.
_t = json.loads(TIMING.read_text())['durs'] if TIMING.exists() else [5.0] * len(LINES['scenes'])
durs = [d * 1000 if d < 1000 else d for d in _t]          # seconds -> milliseconds
SECS = [round(d / 1000, 2) for d in durs]                 # what films.json wants


# ── small helpers ────────────────────────────────────────────────────────────

def shield(cls='', extra=''):
    return (f'<svg class="rssh {cls}" viewBox="0 0 88 88" aria-hidden="true">'
            f'<path class="shL" d="{LEFT}"/><path class="shR" d="{RIGHT}"/>{extra}</svg>')


def words(text, cls='rsw'):
    """Word by word, never letter by letter — the dated form, and it reads as a
       pile of spans to anything assistive."""
    sp = ''.join(f'<span class="{cls}" style="--i:{i}">{w}&nbsp;</span>'
                 for i, w in enumerate(text.split(' ')))
    return f'<div class="rsline">{sp}</div>'


def cnt(to, at=400, pre='', suf=''):
    """render.js animates .cnt from its data-to; the true figure is in the
       markup, so a frame rendered before it runs still shows the right one."""
    return (f'<b class="rscnt cnt" data-to="{to}" data-at="{at}"'
            f'{f" data-pre={chr(34)}{pre}{chr(34)}" if pre else ""}'
            f'{f" data-suf={chr(34)}{suf}{chr(34)}" if suf else ""}>{pre}{to}{suf}</b>')


def crack(cls=''):
    """The tear across the shield. One path, drawn with a dash offset so it can
       run across in scene one and fill with gold in scene thirteen — the same
       geometry both times, which is what makes the mend read as a mend."""
    d = 'M17 30 L31 39 L25 47 L40 54 L34 62 L49 60 L58 70'
    return (f'<svg class="rscr {cls}" viewBox="0 0 88 88" aria-hidden="true">'
            f'<path class="crk" d="{d}"/><path class="crkg" d="{d}"/></svg>')


def mesh(mode, n=9):
    """The lattice: eight points on a ring and one at the centre, every chord
       between them. Carried over from the first cut, where it is the branch's
       connected work made visible, so the two films are one family."""
    R = 21.0
    pts = [(44 + R * math.cos(math.radians(a)), 44 + R * math.sin(math.radians(a)))
           for a in range(-90, 270, 45)]
    pts.append((44.0, 44.0))
    eh = ''.join(
        f'<line class="mx-e" style="--i:{k}" x1="{pts[i][0]:.1f}" y1="{pts[i][1]:.1f}" '
        f'x2="{pts[j][0]:.1f}" y2="{pts[j][1]:.1f}"/>'
        for k, (i, j) in enumerate([(i, j) for i in range(len(pts)) for j in range(i + 1, len(pts))]))
    nh = ''.join(
        f'<circle class="mx-n" style="--i:{k};--dx:{(x-44)*3.4:.1f};--dy:{(y-44)*3.4:.1f}" '
        f'cx="{x:.1f}" cy="{y:.1f}" r="{2.6 if k == len(pts)-1 else 1.9}"/>'
        for k, (x, y) in enumerate(pts))
    return f'<svg class="mx mx-{mode}" viewBox="0 0 88 88" aria-hidden="true">{eh}{nh}</svg>'


def tenure_chart(coloured):
    """Twenty-two horizontal bars, longest first, in two columns of eleven.

       Length carries the magnitude. Hue carries the band the narration names —
       ten years and up, and joined in the last three — so colour is doing a job
       and not decorating. Validated against the ground: gold/teal worst pair
       is dE 18.2 normal vision, 11.4 protan, and every slot clears 3:1.

       Before the bands land (scene six) every bar is one hue: a single series
       needs no palette, and the chart's first job is the total."""
    cols = ''
    for c in (PEOPLE[:11], PEOPLE[11:]):
        rows = ''
        for i, p in enumerate(c):
            pct = max(2.0, p['y'] / MAXY * 100)
            band = p['band'] if coloured else 'n'
            shown = '&lt;1' if p['full'] == 0 else str(p['full'])
            rows += (f'<div class="rsrow" style="--i:{i};--p:{pct:.1f}">'
                     f'<span class="rsnm">{p["n"]}</span>'
                     f'<span class="rstrk"><i class="b-{band}"></i></span>'
                     f'<span class="rsyr">{shown}</span></div>')
        cols += f'<div class="rscol">{rows}</div>'
    return f'<div class="rschart{" lit" if coloured else ""}">{cols}</div>'


def donut(part, whole, label):
    """Part to whole, one accent against the recessive slate, labelled in the
       middle — never a pie, never a slice nobody can compare."""
    r, c = 15.9155, 2 * math.pi * 15.9155
    frac = part / whole
    return (f'<div class="rsring"><svg class="rsdo" viewBox="0 0 42 42" aria-hidden="true">'
            f'<circle class="do-bg" cx="21" cy="21" r="{r}"/>'
            f'<circle class="do-fg" cx="21" cy="21" r="{r}" '
            f'style="--dash:{c*frac:.2f};--gap:{c*(1-frac):.2f};--c:{c:.2f}"/>'
            f'</svg><div class="rsdol"><b>{part}</b></div></div>'
            f'<div class="rsdocap">{label}</div>')


def arc(part, whole, mid, sub):
    """FY27 as a ring: how much of the year has gone."""
    r, c = 15.9155, 2 * math.pi * 15.9155
    frac = part / whole
    return (f'<div class="rsarc"><svg viewBox="0 0 42 42" aria-hidden="true">'
            f'<circle class="ar-bg" cx="21" cy="21" r="{r}"/>'
            f'<circle class="ar-fg" cx="21" cy="21" r="{r}" '
            f'style="--dash:{c*frac:.2f};--gap:{c*(1-frac):.2f};--c:{c:.2f}"/></svg>'
            f'<div class="rsarcl"><b>{mid}</b><span>{sub}</span></div></div>')


# ── the scenes ───────────────────────────────────────────────────────────────

def V(name, s):
    on = s.get('screen', '')

    # 1 · the hit. The shield whole, then a tear runs across it and the light
    #     goes cold. Nothing is said about anyone; the crack says it.
    if name == 'hit':
        return (f'<div class="rsstage shake">{shield("whole")}{mesh("pulse")}'
                f'{crack("cut")}<div class="rsflash"></div></div>')

    # 2 · people left. Points detach from the lattice and drift out, and the
    #     chords to them fade. No number, no name, no direction.
    if name == 'left':
        return (f'<div class="rsstage">{shield("cold")}{mesh("shed")}{crack("held")}</div>')

    # 3 · it held. The tear stops where it stopped.
    if name == 'held':
        return (f'<div class="rsstage">{shield("cold steady")}{mesh("thin")}{crack("held")}'
                f'</div><div class="rscap"><div class="rseyeb">{on}</div></div>')

    # 4 · so look at who is still standing.
    if name == 'stayed':
        return f'<div class="rscap big">{words(s["say"])}</div>'

    # 5 · the count. Twenty-three chips light one by one, then five more
    #     behind them in teal — the support team is in this branch's story and
    #     leaving them out of "who stayed" would be a lie by omission.
    chips = ''
    if name == 'count':
        for i, p in enumerate(PEOPLE):
            chips += f'<span class="rschip" style="--i:{i}">{p["n"][0]}</span>'
        chips += f'<span class="rschip" style="--i:22">S</span>'
        sup = ''.join(f'<span class="rschip sup" style="--i:{23+i}">{n[0]}</span>'
                      for i, n in enumerate(SUPPORT))
        return (f'<div class="rscap"><div class="rschips">{chips}</div>'
                f'<div class="rschips sup">{sup}</div>'
                f'<div class="rsbig">{cnt(HEADCOUNT + len(SUPPORT), 900)}'
                f'<span class="rsbigl">still here</span></div></div>')

    # 6 · the chart, one hue: the total is the point, and a single series needs
    #     no palette.
    if name == 'years':
        return (f'<div class="rscap wide"><div class="rshead">'
                f'{cnt(TOTAL, 300)}<span class="rsbigl">years of this work, between us</span>'
                f'</div>{tenure_chart(False)}'
                f'<div class="rsfoot">full years each &middot; {TOTAL} in all</div></div>')

    # 7 · the same chart, now carrying the two bands the line names, with the
    #     legend beside it so identity is never colour alone.
    if name == 'mix':
        leg = ('<div class="rsleg">'
               f'<span><i class="b-g"></i>{LONG} at ten years or more</span>'
               f'<span><i class="b-s"></i>{MID} between</span>'
               f'<span><i class="b-t"></i>{NEW} joined in the last three</span></div>')
        return (f'<div class="rscap wide">{leg}{tenure_chart(True)}'
                f'<div class="rsdonut">{donut(LONG, len(PEOPLE), f"of {len(PEOPLE)} at ten years or more")}</div>'
                f'</div>')

    # 8 · and while that was going on, we rebuilt how the branch runs.
    if name == 'rebuild':
        return (f'<div class="rsstage">{shield("warm")}{mesh("relink")}{crack("held")}</div>'
                f'<div class="rscap"><div class="rseyeb">WE REBUILT IT</div></div>')

    # 9 · one sign-in, every tool behind it.
    if name == 'one':
        tools = ['Log Book', 'Delivery Book', 'Clients board', 'Premium Due Desk',
                 'Group clients', 'Fact Find', 'Query Pal', 'The wall']
        fan = ''.join(f'<span class="rstool" style="--i:{i}">{t}</span>'
                      for i, t in enumerate(tools))
        return (f'<div class="rscap"><div class="rseyeb">{on}</div>'
                f'<div class="rsdoor"><span class="rskey"></span></div>'
                f'<div class="rstools">{fan}</div></div>')

    # 10 · the system sets your day before you are up.
    if name == 'day':
        ticks = ''.join(f'<span class="rstick" style="--i:{i}"></span>' for i in range(7))
        return (f'<div class="rscap"><div class="rseyeb">{on}</div>'
                f'<div class="rsday"><div class="rsdayb"></div>{ticks}</div>'
                f'<div class="rsdayl"><span>5am</span><span>set before you wake</span>'
                f'<span>6pm</span></div></div>')

    # 11 · the wall shows the score, and everybody sees the same numbers.
    if name == 'wall':
        bars = ''.join(f'<i style="--i:{i};--h:{h}"></i>'
                       for i, h in enumerate([44, 68, 52, 81, 60, 73, 38, 90, 57]))
        return (f'<div class="rscap"><div class="rseyeb">{on}</div>'
                f'<div class="rswall"><div class="rswbars">{bars}</div></div>'
                f'<div class="rsfoot">one score, in front of everybody</div></div>')

    # 12 · FY27 is thirty days old and every goal plan is in.
    if name == 'fy27':
        return (f'<div class="rscap"><div class="rseyeb">{on}</div>'
                f'{arc(30, 365, "30", "days into FY27")}'
                f'<div class="rsfoot">every goal plan is in</div></div>')

    # 13 · the mend. The crack from scene one, filled with gold — the branch's
    #      own colour doing the one job it is best at.
    if name == 'gold':
        return (f'<div class="rsstage">{shield("warm")}{mesh("field")}{crack("fill")}'
                f'<div class="rsglow"></div></div>')

    # 14 · not going back; going somewhere better.
    if name == 'better':
        return (f'<div class="rsstage rise">{shield("gold")}{mesh("home")}{crack("mended")}</div>'
                f'<div class="rscap">{words(s["say"])}</div>')

    # 15 · Friday.
    if name == 'friday':
        return (f'<div class="rscap big"><div class="rseyeb">{on}</div>'
                f'<div class="rsnoon">12 noon</div>'
                f'<div class="rsfoot">ninety minutes</div></div>')

    # 16 · seventy-five of those minutes are yours. One bar, two parts, both
    #      labelled — the agenda's own split, not an illustration of one.
    if name == 'yours':
        return (f'<div class="rscap"><div class="rseyeb">{on}</div>'
                f'<div class="rssplit"><i class="y"></i><i class="m"></i></div>'
                f'<div class="rssplitl"><span class="y">75 minutes &mdash; the room</span>'
                f'<span class="m">15 &mdash; the chair</span></div></div>')

    # 17 · three questions are waiting. Answer one tonight.
    if name == 'ask':
        q = ''.join(f'<span class="rsq" style="--i:{i}"></span>' for i in range(3))
        return (f'{mesh("field")}<div class="rscap big">'
                f'<div class="rsurl">rickyrampersadbranch.com/meetings</div>'
                f'<div class="rsqs">{q}</div>'
                f'<div class="rseyeb">{on}</div></div>')

    # 18 · the close. Whole, with the seams showing, and the check drawn on.
    if name == 'rise':
        ck = (f'<path class="ckc" d="{CHECK}"/>'
              f'<path class="ck" d="{CHECK}"/>')
        return (f'<div class="rsstage rise">{shield("gold fly", ck)}{mesh("home")}'
                f'{crack("mended")}</div>'
                f'<div class="rscap"><div class="rsrise">We rise together</div>'
                f'<div class="rseyeb rslo">Ricky Rampersad Branch</div></div>')

    return f'<div class="rscap">{words(s["say"])}</div>'


sections = []
for i, s in enumerate(LINES['scenes']):
    d = durs[i] if i < len(durs) else 5000
    # The shell's go() fires confetti() on the last scene and looks for #finale;
    # without it the page throws and render.js stops. The close here is the
    # shield coming back whole, so the id is given and the confetti hidden —
    # a burst of paper would cheapen it.
    fin = ' id="finale"' if i == len(LINES['scenes']) - 1 else ''
    sections.append(f'<section class="scene rs v-{s["v"]}" data-d="{int(d)}"{fin}>'
                    f'<div class="inner">{V(s["v"], s)}</div></section>')
SCENES = '\n'.join(sections)

CSS = r"""
/* ══ the FY27 rise (build-risefilm.py) ════════════════════════════════════
   The frame is 1280x720 and THE MIXER CROPS THE BOTTOM 104px AWAY — mixany.py
   takes 1280x616 and pads the caption strip back underneath, so anything laid
   against the bottom of a 720px page is cut in half in the MP4 while looking
   perfect in the browser. The scene box therefore ends at 616 and every
   percentage inside it is a percentage of what survives.

   Every motion is a CSS animation, because render.js pauses the page and sets
   each animation to the frame's own moment; a JS timer would drift from the
   voice and could not be scrubbed at all. */
.rs{--bg:#070F26;--ink:#EAF0FF;--mut:#9FB0D0;--dim:#6B7A99;
    --cy:#00E5FF;--peri:#7C8CF8;--slate:#5E6B85;--cold:#8295B5;--line:#1A2744}
.rs,.rs .inner{background:#070F26;color:#EAF0FF}
.rs .inner{position:absolute;inset:0 0 104px 0;display:grid;place-items:center;
  gap:0;padding:0;max-width:none;overflow:hidden}
.rs *{font-family:'IBM Plex Sans',system-ui,sans-serif}

/* ── the shield, and the tear through it ─────────────────────────────────── */
.rs .rsstage{position:relative;width:min(62vh,44vw);aspect-ratio:1;display:grid;place-items:center}
.rs .rssh{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
.rs .rssh path.shL,.rs .rssh path.shR{fill:none;stroke:#24365E;stroke-width:2.2}
.rs .rssh.whole path{stroke:var(--cy);filter:drop-shadow(0 0 .6rem rgba(0,229,255,.45))}
.rs .rssh.cold path{stroke:var(--cold);opacity:.55;animation:coldIn 1.1s both}
.rs .rssh.cold.steady path{animation:coldHold 1.2s both}
.rs .rssh.warm path{stroke:var(--cy);opacity:.8;animation:warmUp 1.6s both}
.rs .rssh.gold path{stroke:var(--cy);stroke-width:2.6;
  filter:drop-shadow(0 0 1rem rgba(0,229,255,.6));animation:goldIn 1.4s both}
@keyframes coldIn{from{stroke:var(--cy);opacity:1}to{stroke:var(--cold);opacity:.55}}
@keyframes coldHold{from{opacity:.4}to{opacity:.7}}
@keyframes warmUp{from{stroke:var(--cold);opacity:.5}to{stroke:var(--cy);opacity:.8}}
@keyframes goldIn{from{opacity:.6;stroke-width:2.2}to{opacity:1;stroke-width:2.6}}
.rs .rssh.fly{animation:flyOpen 2.6s .6s both}
@keyframes flyOpen{from{transform:scale(.96)}to{transform:scale(1.04)}}
.rs .rssh path.ckc,.rs .rssh.gold path.ckc{fill:none;stroke:#070F26;stroke-width:8.5;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:46;stroke-dashoffset:46;animation:ckDraw 1.1s 1.1s both}
.rs .rssh path.ck,.rs .rssh.gold path.ck,.rs .rssh.fly path.ck{fill:none;stroke:#fff;stroke-width:3.4;stroke-linecap:round;stroke-linejoin:round;
  stroke-dasharray:46;stroke-dashoffset:46;animation:ckDraw 1.1s 1.1s both}
@keyframes ckDraw{to{stroke-dashoffset:0}}

.rs .rscr{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
.rs .rscr path{fill:none;stroke-linecap:round;stroke-linejoin:round}
.rs .rscr .crk{stroke:#CFE2FF;stroke-width:1.5;stroke-dasharray:120;stroke-dashoffset:120;opacity:0}
.rs .rscr .crkg{stroke:var(--cy);stroke-width:2.6;stroke-dasharray:120;stroke-dashoffset:120;opacity:0}
/* it tears across */
.rs .rscr.cut .crk{opacity:1;animation:crkRun .55s .45s both}
@keyframes crkRun{from{stroke-dashoffset:120;filter:drop-shadow(0 0 1.2rem #CFE2FF)}
  to{stroke-dashoffset:0;filter:drop-shadow(0 0 .2rem rgba(233,242,250,.4))}}
/* it stops, and stays */
.rs .rscr.held .crk{opacity:.45;stroke-dashoffset:0;stroke:#7E8FB0}
/* it fills with gold — the same geometry, which is what makes it read as a mend */
.rs .rscr.fill .crk{opacity:.2;stroke-dashoffset:0;stroke:#55658A}
.rs .rscr.fill .crkg{opacity:1;animation:crkGold 2.2s .35s both}
@keyframes crkGold{from{stroke-dashoffset:120;filter:drop-shadow(0 0 0 rgba(0,229,255,0))}
  to{stroke-dashoffset:0;filter:drop-shadow(0 0 1.1rem rgba(0,229,255,.85))}}
.rs .rscr.mended .crkg{opacity:1;stroke-dashoffset:0;animation:crkBr 3.2s infinite}
@keyframes crkBr{0%,100%{filter:drop-shadow(0 0 .7rem rgba(0,229,255,.5))}
  50%{filter:drop-shadow(0 0 1.6rem rgba(0,229,255,.9))}}

.rs .rsstage.shake{animation:shk .5s .45s both}
@keyframes shk{0%{transform:translate(0,0)}15%{transform:translate(-1.1%,.7%)}
  30%{transform:translate(.9%,-.6%)}45%{transform:translate(-.6%,.4%)}
  60%{transform:translate(.4%,-.3%)}100%{transform:translate(0,0)}}
.rs .rsstage.rise{animation:rsUp 3s both}
@keyframes rsUp{from{transform:translateY(2.5%) scale(.97)}to{transform:translateY(-1%) scale(1.02)}}
.rs .rsflash{position:absolute;inset:-40%;background:radial-gradient(circle,#CFE2FF 0%,transparent 60%);
  opacity:0;animation:flash .5s .45s both}
@keyframes flash{0%{opacity:0}18%{opacity:.5}100%{opacity:0}}
.rs .rsglow{position:absolute;inset:-30%;background:radial-gradient(circle,rgba(0,229,255,.35) 0%,transparent 62%);
  opacity:0;animation:glowUp 2.6s .4s both}
@keyframes glowUp{0%{opacity:0}60%{opacity:1}100%{opacity:.75}}

/* ── the lattice, carried over from the first cut ────────────────────────── */
.rs .mx{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
.rs .mx-e{stroke:var(--peri);stroke-width:.38;opacity:0;stroke-dasharray:62;stroke-dashoffset:62}
.rs .mx-n{fill:var(--peri);opacity:0;transform-box:fill-box;transform-origin:50% 50%}
.rs .mx-pulse .mx-n{animation:nPul 2.6s calc(var(--i)*.07s) infinite}
.rs .mx-pulse .mx-e{opacity:.42;stroke-dashoffset:0}
@keyframes nPul{0%,100%{opacity:.75;transform:scale(1)}50%{opacity:1;transform:scale(1.22)}}
/* shed · points detach and drift out, and their chords go with them */
.rs .mx-shed .mx-n{opacity:.8;animation:nShed 1.9s calc(var(--i)*.1s) both}
@keyframes nShed{0%{opacity:.8;transform:translate(0,0) scale(1)}
  100%{opacity:0;transform:translate(calc(var(--dx)*.4px),calc(var(--dy)*.4px)) scale(.4)}}
.rs .mx-shed .mx-e{opacity:.3;animation:eFade 1.3s both}
@keyframes eFade{to{opacity:0}}
/* thin · what is left, steady */
.rs .mx-thin .mx-n{opacity:.55;animation:nSteady 1.2s both}
@keyframes nSteady{from{opacity:.3}to{opacity:.62}}
.rs .mx-thin .mx-e{opacity:.14;stroke-dashoffset:0}
/* relink · the chords draw themselves again, in gold */
.rs .mx-relink .mx-n{fill:var(--cy);opacity:.9;animation:nWarm .6s calc(var(--i)*.08s) both}
@keyframes nWarm{from{opacity:.4;transform:scale(.7)}to{opacity:.92;transform:scale(1)}}
.rs .mx-relink .mx-e{stroke:var(--cy);animation:eDraw .5s calc(.25s + var(--i)*26ms) both}
@keyframes eDraw{from{opacity:0;stroke-dashoffset:62}to{opacity:.5;stroke-dashoffset:0}}
/* field · faint and wide, so the middle of the film is still one thing */
.rs .mx-field{inset:-22%;width:144%;height:144%;opacity:.17}
.rs .mx-field .mx-n{opacity:.5}
.rs .mx-field .mx-e{opacity:.3;stroke-dashoffset:0}
/* home · back in, and settled */
.rs .mx-home .mx-n{fill:var(--cy);animation:nHome 1.5s calc(var(--i)*.05s) both}
@keyframes nHome{from{opacity:0;transform:translate(calc(var(--dx)*1px),calc(var(--dy)*1px)) scale(.4)}
  to{opacity:.95;transform:translate(0,0) scale(1)}}
.rs .mx-home .mx-e{stroke:var(--cy);animation:eDraw .6s calc(.8s + var(--i)*22ms) both}

/* ── type ────────────────────────────────────────────────────────────────── */
.rs .rscap{display:grid;place-items:center;gap:1.6vh;text-align:center;padding:0 5vw;width:100%}
.rs .rscap.wide{padding:0 3vw}
.rs .rsline{max-width:min(1060px,86%);line-height:1.08}
.rs .rscap.big .rsw{font-size:clamp(1.4rem,3.6vw,3.1rem)}
.rs .rsw{display:inline-block;font-weight:800;letter-spacing:-.01em;
  font-size:clamp(1.3rem,3.2vw,2.8rem);opacity:0;animation:wIn .5s calc(.2s + var(--i)*.1s) both}
@keyframes wIn{from{opacity:0;transform:translateY(.5em) rotate(1.5deg)}
  to{opacity:1;transform:none}}
.rs .rseyeb{font-size:1.5vw;font-weight:800;letter-spacing:.22em;color:var(--cy);
  text-transform:uppercase;opacity:0;animation:fIn .7s .25s both}
.rs .rseyeb.rslo{color:var(--dim);letter-spacing:.16em;font-size:1.15vw}
@keyframes fIn{from{opacity:0;transform:translateY(.6rem)}to{opacity:1;transform:none}}
.rs .rsfoot{font-size:1.35vw;color:var(--mut);opacity:0;animation:fIn .8s .9s both}
.rs .rsbig{display:flex;align-items:baseline;gap:1.4vw;opacity:0;animation:fIn .8s .7s both}
.rs .rsbigl{font-size:1.6vw;color:var(--mut);font-weight:600}
.rs .rscnt{font-size:7.6vw;font-weight:800;color:var(--cy);line-height:1;
  font-variant-numeric:tabular-nums;letter-spacing:-.02em}
.rs .rshead{display:flex;align-items:baseline;gap:1.4vw;margin-bottom:.4vh;
  opacity:0;animation:fIn .7s .2s both}
.rs .rsrise{font-size:4.6vw;font-weight:800;letter-spacing:-.01em;
  opacity:0;animation:wIn .9s .5s both}
.rs .rsnoon{font-size:8vw;font-weight:800;color:var(--cy);line-height:1;
  opacity:0;animation:fIn .8s .5s both}
.rs .rsurl{font-size:2vw;font-weight:700;color:var(--peri);opacity:0;animation:fIn .8s .3s both}

/* ── the tenure chart ────────────────────────────────────────────────────── */
.rs .rschart{display:grid;grid-template-columns:1fr 1fr;gap:0 3.2vw;width:92%;max-width:1120px}
.rs .rscol{display:grid;gap:.42vh}
.rs .rsrow{display:grid;grid-template-columns:7.2vw 1fr 2.2vw;align-items:center;gap:.8vw}
.rs .rsnm{font-size:1.32vw;color:var(--mut);text-align:right;white-space:nowrap;
  opacity:0;animation:fIn .4s calc(.25s + var(--i)*.045s) both}
.rs .rstrk{position:relative;height:1.5vh;background:#122043;border-radius:3px;overflow:hidden}
.rs .rstrk i{position:absolute;inset:0 auto 0 0;width:0;border-radius:0 4px 4px 0;
  animation:grow .75s calc(.3s + var(--i)*.05s) both}
@keyframes grow{to{width:calc(var(--p)*1%)}}
/* before the bands land every bar is one hue — a single series needs no palette */
.rs .rstrk i.b-n{background:linear-gradient(90deg,#1D5BC4,var(--cy))}
/* and after it, hue carries the band the line names. gold/teal worst adjacent
   pair is dE 18.2 normal vision and 11.4 protan on this ground; the slate is
   recessive on purpose, and the legend names all three so identity is never
   colour alone. */
.rs .rschart.lit .rstrk i.b-g{background:linear-gradient(90deg,#1D5BC4,var(--cy))}
.rs .rschart.lit .rstrk i.b-s{background:var(--slate)}
.rs .rschart.lit .rstrk i.b-t{background:linear-gradient(90deg,#3E46A8,var(--peri))}
.rs .rsyr{font-size:1.28vw;font-weight:700;color:var(--mut);text-align:right;
  font-variant-numeric:tabular-nums;opacity:0;animation:fIn .4s calc(.75s + var(--i)*.045s) both}
.rs .rsleg{display:flex;gap:2.2vw;justify-content:center;margin-bottom:1vh;
  font-size:1.25vw;color:var(--mut);opacity:0;animation:fIn .6s .15s both}
.rs .rsleg span{display:flex;align-items:center;gap:.5vw}
.rs .rsleg i{width:1.1vw;height:1.1vw;border-radius:3px;display:inline-block}
.rs .rsleg i.b-g{background:var(--cy)}
.rs .rsleg i.b-s{background:var(--slate)}
.rs .rsleg i.b-t{background:var(--peri)}

/* ── the donut ───────────────────────────────────────────────────────────── */
.rs .rsdonut{position:absolute;right:2.6vw;bottom:1vh;width:13vw;
  display:grid;place-items:center;gap:.5vh;opacity:0;animation:fIn .8s 1.5s both}
.rs .rsdonut .rsring{position:relative;width:9vw;height:9vw;display:grid;place-items:center}
.rs .rsdo{position:absolute;inset:0;width:100%;height:100%;transform:rotate(-90deg)}
.rs .rsdo circle{fill:none;stroke-width:4.2}
.rs .rsdo .do-bg{stroke:#16254A}
.rs .rsdo .do-fg{stroke:var(--cy);stroke-linecap:round;
  stroke-dasharray:0 var(--c);animation:doGo 1.2s 1.7s both}
@keyframes doGo{to{stroke-dasharray:var(--dash) var(--gap)}}
.rs .rsdol{position:absolute;inset:0;display:grid;place-items:center;text-align:center}
.rs .rsdol b{display:block;font-size:3vw;font-weight:800;color:var(--cy)}
.rs .rsdol span{display:none}
.rs .rsdocap{font-size:.95vw;color:var(--mut);text-align:center;white-space:nowrap}

/* ── the year arc ────────────────────────────────────────────────────────── */
.rs .rsarc{position:relative;width:22vh;height:22vh;display:grid;place-items:center;
  opacity:0;animation:fIn .7s .4s both}
.rs .rsarc svg{position:absolute;inset:0;width:100%;height:100%;transform:rotate(-90deg)}
.rs .rsarc circle{fill:none;stroke-width:3.4}
.rs .rsarc .ar-bg{stroke:#16254A}
.rs .rsarc .ar-fg{stroke:var(--cy);stroke-linecap:round;
  stroke-dasharray:0 var(--c);animation:doGo 1.4s .7s both}
.rs .rsarcl{position:relative;text-align:center}
.rs .rsarcl b{display:block;font-size:5vw;font-weight:800;color:var(--ink);line-height:1}
.rs .rsarcl span{font-size:1.1vw;color:var(--mut)}

/* ── who stayed: the chips ───────────────────────────────────────────────── */
.rs .rschips{display:flex;flex-wrap:wrap;gap:.7vw;justify-content:center;max-width:62vw}
.rs .rschips.sup{margin-top:.6vh}
.rs .rschip{width:3.4vw;height:3.4vw;border-radius:50%;display:grid;place-items:center;
  font-size:1.5vw;font-weight:800;color:#070F26;background:var(--cy);
  opacity:0;animation:chipIn .4s calc(.25s + var(--i)*.055s) both}
.rs .rschip.sup{background:var(--peri);width:2.9vw;height:2.9vw;font-size:1.3vw}
@keyframes chipIn{from{opacity:0;transform:scale(.3)}60%{opacity:1;transform:scale(1.18)}
  to{opacity:1;transform:scale(1)}}

/* ── one sign-in, and the tools behind it ────────────────────────────────── */
.rs .rsdoor{position:relative;width:7vw;height:9vw;border:.22vw solid var(--cy);
  border-radius:.6vw;display:grid;place-items:center;opacity:0;animation:fIn .6s .4s both}
.rs .rskey{width:1.3vw;height:1.3vw;border-radius:50%;background:var(--cy);
  box-shadow:0 0 1.4rem rgba(0,229,255,.8);animation:keyPul 2.2s .9s infinite}
@keyframes keyPul{0%,100%{transform:scale(1);opacity:.85}50%{transform:scale(1.3);opacity:1}}
.rs .rstools{display:flex;flex-wrap:wrap;gap:.7vw;justify-content:center;max-width:64vw}
.rs .rstool{font-size:1.2vw;color:var(--mut);border:1px solid var(--line);border-radius:999px;
  padding:.5vh 1.1vw;opacity:0;animation:toolIn .5s calc(.9s + var(--i)*.1s) both}
@keyframes toolIn{from{opacity:0;transform:translateY(.8rem) scale(.9)}to{opacity:1;transform:none}}

/* ── the day ─────────────────────────────────────────────────────────────── */
.rs .rsday{position:relative;width:62vw;height:2.4vh;background:#122043;border-radius:999px;
  display:flex;align-items:center;opacity:0;animation:fIn .6s .3s both}
.rs .rsdayb{position:absolute;inset:0;width:0;border-radius:999px;
  background:linear-gradient(90deg,#1D5BC4,var(--cy));animation:grow2 2.4s .5s both}
@keyframes grow2{to{width:100%}}
.rs .rstick{position:absolute;width:1.1vw;height:1.1vw;border-radius:50%;background:#070F26;
  border:.18vw solid var(--cy);top:50%;left:calc(6% + var(--i)*14.5%);
  transform:translate(-50%,-50%) scale(0);animation:tickIn .35s calc(.7s + var(--i)*.26s) both}
@keyframes tickIn{from{transform:translate(-50%,-50%) scale(0)}
  60%{transform:translate(-50%,-50%) scale(1.3)}to{transform:translate(-50%,-50%) scale(1)}}
.rs .rsdayl{display:flex;justify-content:space-between;width:62vw;font-size:1.15vw;
  color:var(--mut);opacity:0;animation:fIn .6s 1.1s both}

/* ── the wall ────────────────────────────────────────────────────────────── */
.rs .rswall{width:52vw;height:26vh;border:.26vw solid var(--line);border-radius:.8vw;
  padding:2vh 2vw;display:grid;align-items:end;opacity:0;animation:fIn .6s .3s both}
.rs .rswbars{display:flex;gap:1.4vw;align-items:flex-end;height:100%}
.rs .rswbars i{flex:1;border-radius:4px 4px 0 0;height:0;
  background:linear-gradient(180deg,var(--cy),#1D5BC4);
  animation:wUp .7s calc(.55s + var(--i)*.09s) both}
@keyframes wUp{to{height:calc(var(--h)*1%)}}

/* ── the ninety minutes ──────────────────────────────────────────────────── */
.rs .rssplit{display:flex;width:64vw;height:3.4vh;border-radius:999px;overflow:hidden;
  background:#122043;opacity:0;animation:fIn .6s .3s both}
.rs .rssplit i{height:100%;width:0}
.rs .rssplit i.y{background:linear-gradient(90deg,#1D5BC4,var(--cy));animation:sp 1.1s .6s both}
.rs .rssplit i.m{background:var(--slate);animation:sp2 1.1s .6s both}
@keyframes sp{to{width:83.33%}}
@keyframes sp2{to{width:16.67%}}
.rs .rssplitl{display:flex;justify-content:space-between;width:64vw;font-size:1.3vw;
  opacity:0;animation:fIn .6s 1.3s both}
.rs .rssplitl .y{color:var(--cy);font-weight:700}
.rs .rssplitl .m{color:var(--mut)}

/* ── the three questions ─────────────────────────────────────────────────── */
.rs .rsqs{display:flex;gap:1.6vw;justify-content:center}
.rs .rsq{width:1.5vw;height:1.5vw;border-radius:50%;background:var(--cy);opacity:0;
  animation:qIn .5s calc(.6s + var(--i)*.22s) both}
@keyframes qIn{from{opacity:0;transform:scale(.2)}60%{opacity:1;transform:scale(1.35)}
  to{opacity:.95;transform:scale(1)}}
"""


# A class the shell already styles wins silently, and the first cut of the
# blast-off learned it the hard way: .stage is the shell's own and its rule
# collapsed the stage from 461px to 146, so the shield rendered at a sixth of
# its size with nothing in the console. Every class here is rs-prefixed, and
# this refuses to write a page where one has slipped through anyway.
def _guard(html):
    css = '\n'.join(re.findall(r'<style>(.*?)</style>', SHELL.read_text(), re.S))
    theirs = set(re.findall(r'\.([a-zA-Z][\w-]*)', css))
    ours = set()
    for m in re.findall(r'class="([^"]+)"', html):
        ours.update(c for c in m.split() if not c.startswith('--'))
    keep = {'scene', 'inner', 'on', 'cnt'}       # the shell's and render.js's own contract
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
             '<title>We rise together — Ricky Rampersad Branch</title>', out, count=1, flags=re.S)
out = re.sub(r'<span class="who">.*?</span>',
             '<span class="who">Ricky Rampersad Branch<i>FY27</i></span>', out, count=1, flags=re.S)
out = re.sub(r'<span class="live">.*?</span>', '', out, count=1, flags=re.S)
out = out.replace('<body>', '<body class="rsoff">')

# The shell is donthaveanagent's: its chrome carries The Knot in Ink & Coral
# and its progress bars are coral. Two marks, two products, on purpose — and a
# branch film carrying the other one is the exact error the mark rule warns
# about. Both become the branch's own. Nothing is redrawn: the path is
# logo-mark.svg's.
MARK = ('<svg class="mark" viewBox="0 0 88 88" aria-hidden="true">'
        '<defs><linearGradient id="rsg1" x1="0" y1="0" x2="1" y2="1">'
        '<stop offset="0%" stop-color="#2A6DE0"/><stop offset="60%" stop-color="#1D5BC4"/>'
        '<stop offset="100%" stop-color="#13408F"/></linearGradient></defs>'
        f'<path d="{SHIELD}" fill="url(#rsg1)"/>'
        f'<path d="{CHECK}" stroke="#070F26" stroke-width="6.5" fill="none" '
        'stroke-linecap="round" stroke-linejoin="round"/>'
        f'<path d="{CHECK}" stroke="#fff" stroke-width="2.8" fill="none" '
        'stroke-linecap="round" stroke-linejoin="round"/></svg>')
out = re.sub(r'<svg class="mark" viewBox="0 0 88 88" aria-hidden="true">.*?</svg>',
             lambda m: MARK, out, count=1, flags=re.S)

# The shell also wires a WhatsApp share button these scenes do not carry, and
# an unguarded throw there stops every line of its script after it.
out = out.replace('document.getElementById("waBtn").href = "https://wa.me/?text=" + encodeURIComponent(MSG);',
                  'var _wa = document.getElementById("waBtn");\n'
                  'if (_wa) _wa.href = "https://wa.me/?text=" + encodeURIComponent(MSG);')

out += ('\n<style>'
        'body.rsoff{background:#070F26}body.rsoff .orb{display:none}'
        'body.rsoff .conf,body.rsoff #confetti{display:none}'
        'body.rsoff #chrome .who{color:#9FB0D0}body.rsoff #chrome .who i{color:#6B7A99}'
        'body.rsoff #bars i{background:#16254A}'
        'body.rsoff #bars i::after{background:#00E5FF}'
        'body.rsoff #bars i.done{background:#00E5FF}'
        'body.rsoff #bars i.run::after{background:#00E5FF}'
        '</style>\n')

OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(out)
tot = sum(durs) / 1000
print(f'{OUT.relative_to(ROOT)} — {len(LINES["scenes"])} scenes, {tot:.1f}s, '
      f'{len(PEOPLE)} in the chart, {TOTAL} years, bands {LONG}/{MID}/{NEW}')
