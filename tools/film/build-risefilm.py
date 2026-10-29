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

import json, math, os, re, pathlib
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
# the headcount and not in the chart; the chart says one fewer.
#
# Two were taken out on the branch manager's word, 29 October 2026 ("take out
# javid, aleema"), before the film was cut.  Both carried twenty years, so the
# total, the headcount and the ten-year band all move with them — every figure
# in this film is derived from this list for exactly that reason, and none is
# typed into a line by hand.  Nothing in the film says anyone left, here or
# anywhere: the house rule is that nobody who goes is characterised or counted.
ROSTER = [
    ("Ricky", 1993, 12), ("Narissa", 1999, 7), ("Richard", 2003, 8),
    ("Premchand", 2004, 12),
    ("Akaash", 2011, 7), ("Joy", 2012, 9), ("Faizal", 2012, 10),
    ("Meera", 2014, 10), ("Petra", 2016, 4), ("Randolph", 2016, 11),
    ("Neil", 2018, 7), ("Varun", 2019, 6), ("Darryl", 2021, 4),
    ("Malcolm", 2022, 4), ("Fawwaz", 2023, 3), ("Stephanie", 2023, 3),
    ("Jamil", 2023, 8), ("Daniel", 2025, 7), ("Felicia", 2025, 8),
    ("Rajiv", 2026, 7),
]
SUPPORT = ["Kamla", "Sasha", "Elizabeth", "Azariah", "Pawan"]

# ── the branch's own history ─────────────────────────────────────────────────
#  Every date here is one this repository can show: the day the thing went
#  live, out of the house notes. Nothing is rounded up and nothing is claimed
#  that is not in the tree. The spoken count is len(BUILT), so adding one here
#  and forgetting the line is caught by the assertion under it.
BUILT = [
    ('Aug',  'The digital fact find'),
    ('Sep',  'The transition letters'),
    ('Sep',  'The assignment board'),
    ('Oct',  'Group client management'),
    ('Oct',  'The Premium Due Desk'),
    ('Oct',  'Match'),
    ('Oct',  'The stream'),
    ('Oct',  'The dashboard'),
    ('Oct',  'The agents view'),
    ('Oct',  'The training and the test'),
    ('Oct',  'The Log Book'),
    ('Oct',  'The Delivery Book'),
    ('Oct',  'The branch app'),
    ('Oct',  'Wall Intelligence'),
    ('Oct',  'Service ratings'),
    ('Oct',  'The motor quote'),
    ('Oct',  'Our own quote forms'),
    ('Oct',  'The meeting builder'),
]

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
TOTAL = int(round(sum(p['y'] for p in PEOPLE)))        # derived; do not hand-type it into a line
LONG = sum(1 for p in PEOPLE if p['band'] == 'g')      # ten years or more
NEW = sum(1 for p in PEOPLE if p['band'] == 't')       # joined in the last three
MID = len(PEOPLE) - LONG - NEW                         # the band between
HEADCOUNT = len(ROSTER) + 1                            # +1, the one with no hire date on file
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


def cnt(to, at=400, pre='', suf='', sep=False):
    """render.js animates .cnt from its data-to; the true figure is in the
       markup, so a frame rendered before it runs still shows the right one.

       sep puts the thousands separator in, on the markup and on every frame
       render.js writes."""
    shown = f'{to:,}' if sep else str(to)
    return (f'<b class="rscnt cnt" data-to="{to}" data-at="{at}"'
            f'{f" data-sep={chr(34)}1{chr(34)}" if sep else ""}'
            f'{f" data-pre={chr(34)}{pre}{chr(34)}" if pre else ""}'
            f'{f" data-suf={chr(34)}{suf}{chr(34)}" if suf else ""}>{pre}{shown}{suf}</b>')


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


def donut(part, whole, label, mid=None):
    """Part to whole, one accent against the recessive slate, labelled in the
       middle — never a pie, never a slice nobody can compare."""
    r, c = 15.9155, 2 * math.pi * 15.9155
    frac = part / whole
    return (f'<div class="rsring"><svg class="rsdo" viewBox="0 0 42 42" aria-hidden="true">'
            f'<circle class="do-bg" cx="21" cy="21" r="{r}"/>'
            f'<circle class="do-fg" cx="21" cy="21" r="{r}" '
            f'style="--dash:{c*frac:.2f};--gap:{c*(1-frac):.2f};--c:{c:.2f}"/>'
            f'</svg><div class="rsdol"><b>{mid if mid is not None else part}</b></div></div>'
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


# ── the spoken figures must be the derived ones ──────────────────────────────
#  Two people came off the roster on 29 October and three narrated figures
#  moved with them. A line is recorded once and then lives in an MP4 that
#  nobody re-reads, so the film asserts its own arithmetic rather than trusting
#  whoever edited the roster to remember the script.
_ONES = ('zero one two three four five six seven eight nine ten eleven twelve '
         'thirteen fourteen fifteen sixteen seventeen eighteen nineteen').split()
_TENS = ('  twenty thirty forty fifty sixty seventy eighty ninety').split()


def spoken(n):
    if n < 20:
        return _ONES[n]
    if n < 100:
        t, r = divmod(n, 10)
        return _TENS[t - 2] + ('-' + _ONES[r] if r else '')
    h, r = divmod(n, 100)
    return _ONES[h] + ' hundred' + (' and ' + spoken(r) if r else '')


def _say(key):
    return next(x['say'] for x in LINES['scenes'] if x['v'] == key).lower()


for key, want in (('count', HEADCOUNT), ('years', TOTAL), ('mix', LONG)):
    said = _say(key)
    assert spoken(want) in said, (
        f'scene {key!r} says {said!r} but the roster now gives {want} '
        f'({spoken(want)}). Edit rise-lines.json and re-voice that line.')
assert spoken(NEW) in _say('mix'), 'the mix line has the wrong new-joiner count'
assert str(len(BUILT)) in _say('built') or spoken(len(BUILT)) in _say('built'), \
    'the built line and BUILT disagree on how many things went live'

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

    # 3a · the proof that it held, and the best number in the film. Requests
    #      closed by the five desks, read off Salesforce on 29 October 2026,
    #      logged e-mails and the birthday flow left out as everywhere else.
    #      September is the month it happened; October is still running, which
    #      the foot says, because a figure that is going to grow is stronger
    #      stated short than rounded up.
    if name == 'rose':
        a, b = 204, 240
        return (f'<div class="rscap"><div class="rseyeb">{on}</div>'
                f'<div class="rspair">'
                f'<div class="rspb" style="--h:{a / b * 100:.0f}">'
                f'<span class="rspn">{cnt(a, 300)}</span><i></i>'
                f'<span class="rspl">September</span></div>'
                f'<div class="rspb lit" style="--h:100">'
                f'<span class="rspn">{cnt(b, 600)}</span><i></i>'
                f'<span class="rspl">October</span></div>'
                f'<div class="rspd">+{round((b - a) / a * 100)}%</div></div>'
                f'<div class="rsfoot">requests closed &middot; October still has two days to run</div>'
                f'</div>')

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

    # 7a · the branch on one line. A dot for every person at the year they
    #      joined, stacked where a year repeats, so the eye reads a branch
    #      that has been keeping people for three decades rather than a list.
    if name == 'story':
        y0, y1 = 1993, TODAY.year
        span = y1 - y0
        seen = {}
        dots = ''
        for i, (nm, yy, mm) in enumerate(sorted(ROSTER, key=lambda r: (r[1], r[2]))):
            at = (yy + (mm - 1) / 12 - y0) / span * 100
            k = round(at / 3)
            seen[k] = seen.get(k, 0) + 1
            dots += (f'<span class="rsdot" style="--x:{at:.2f};--s:{seen[k] - 1};'
                     f'--l:{i % 3};--i:{i}"><i>{nm}</i></span>')
        ticks = ''.join(
            f'<span class="rstk" style="--x:{(d - y0) / span * 100:.2f}">{d}</span>'
            for d in range(2000, y1 + 1, 5))
        return (f'<div class="rscap wide"><div class="rseyeb">{on}</div>'
                f'<div class="rstl"><span class="rstlr"></span>{dots}'
                f'<span class="rstla">{y0}</span>'
                f'<span class="rstlz">{y1}</span>{ticks}</div>'
                f'<div class="rsfoot">one dot a person, at the year they joined</div>'
                f'</div>')

    # 9a · and nearly all of it was built since August. The same idea turned on
    #      its side: eighteen things, ninety days, each landing on the beat.
    if name == 'built':
        items = ''.join(
            f'<div class="rsbi" style="--i:{i}"><span class="rsbm">{m}</span>'
            f'<span class="rsbd"></span><span class="rsbt">{t}</span></div>'
            for i, (m, t) in enumerate(BUILT))
        return (f'<div class="rscap wide"><div class="rseyeb">{on}</div>'
                f'<div class="rshead">{cnt(len(BUILT), 300)}'
                f'<span class="rsbigl">of these went live in ninety days</span></div>'
                f'<div class="rsbuilt">{items}</div></div>')

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

    # 12a · the work itself. This counts REQUESTS CLOSED, never clients: a
    #       client count may not go in an MP4 at a public URL, and what the
    #       branch wants credit for here is its own work anyway. Read off
    #       Salesforce on 28 October 2026 over the five desks, twelve months,
    #       with logged e-mails and the birthday flow left out — they are not
    #       work, and counted they would flatter the record by five to one.
    if name == 'served':
        kinds = [('Pendings', 889), ('Renewals and billing', 687),
                 ('Servicing', 560), ('Scripts and call-backs', 151),
                 ('Everything else', 208)]
        top = max(n for _, n in kinds)
        rows = ''.join(
            f'<div class="rsrow" style="--i:{i};--p:{n / top * 100:.1f}">'
            f'<span class="rsnm">{k}</span>'
            f'<span class="rstrk"><i class="b-n"></i></span>'
            f'<span class="rsyr">{n}</span></div>'
            for i, (k, n) in enumerate(kinds))
        return (f'<div class="rscap wide"><div class="rseyeb">{on}</div>'
                f'<div class="rshead">{cnt(2495, 300, sep=True)}'
                f'<span class="rsbigl">requests closed, in twelve months</span></div>'
                f'<div class="rschart one"><div class="rscol">{rows}</div></div>'
                f'<div class="rsfoot">the five desks, over the last twelve months</div></div>')

    # 12b · the papers. The Log Book's own year, measured off the old book
    #       rather than claimed: 3,634 lines, and 72% on to Guardian inside
    #       one working day.
    if name == 'papers':
        return (f'<div class="rscap"><div class="rseyeb">{on}</div>'
                f'<div class="rsbig">{cnt(3634, 400, sep=True)}'
                f'<span class="rsbigl">papers through the Log Book</span></div>'
                f'<div class="rsdonut mid">'
                f'{donut(72, 100, "on to Guardian inside one working day", mid="72%")}'
                f'</div></div>')

    # 12c · the fact find. His own line from the FY27 wall, and the one number
    #       in this film that is a nought on purpose.
    if name == 'ff':
        return (f'<div class="rscap"><div class="rseyeb">{on}</div>'
                f'<div class="rsbig"><span class="rszero">0</span>'
                f'<span class="rsbigl">of those cases has lapsed</span></div>'
                f'<div class="rsfoot">since the digital fact find went live</div></div>')

    # 16a · the business stays. Branch 26000 Production and Manpower Record,
    #       2014-2026: the lowest lapse rate of every branch in the Board Paper
    #       for 2025, and again for FY2026 to 31 August. The comparison is
    #       against the main branches, which is how the record states it.
    #
    #       NOTHING FROM THESE PAPERS THAT NAMES ANYONE, NAMES A COMPETITOR,
    #       OR CARRIES A DOLLAR FIGURE IS IN THIS FILM. It sits at a public URL
    #       anybody can forward, and the four documents behind this scene are a
    #       three-year plan, a note of a meeting with the Vice President, a unit
    #       plan that sets out individual agents' quota and persistency, and a
    #       manpower record that names people who left and people terminated.
    #       What is here is the branch's own quality record and nothing else.
    if name == 'keep':
        #  A lapse rate is 4.96%, not 496. The counter only does whole numbers,
        #  so these two are plain text: a wrong unit on a headline figure costs
        #  more than the count-up is worth. Shorter is better here, and the
        #  foot says so, because a short bar reads as "worse" by default.
        return (f'<div class="rscap"><div class="rseyeb">{on}</div>'
                f'<div class="rspair tight">'
                f'<div class="rspb lit" style="--h:56">'
                f'<span class="rspn">4.96%</span><i></i>'
                f'<span class="rspl">this branch</span></div>'
                f'<div class="rspb" style="--h:100">'
                f'<span class="rspn">8.82%</span><i></i>'
                f'<span class="rspl">the main branches</span></div></div>'
                f'<div class="rsfoot">lapse rate, FY2026 to 31 August &middot; '
                f'lower is better &middot; the lowest of every branch</div></div>')

    # 16b · and the people stay. The same record, and the note of 12 October:
    #       ours against the published career-agency figures.
    if name == 'stay':
        rows = [('Still here after one year', 67, 58, 'published 55&ndash;60%'),
                ('Still here after four years', 31, 16, 'published about 16%'),
                ('The 2023 intake, kept to August', 67, 48, 'network 48%')]
        out = ''
        for i, (lab, us, them, note) in enumerate(rows):
            out += (f'<div class="rsvs" style="--i:{i}">'
                    f'<span class="rsvl">{lab}</span>'
                    f'<span class="rsvb"><i class="ours" style="--p:{us}"></i>'
                    f'<b class="rsmk" style="--p:{them}"><span>{note}</span></b></span>'
                    f'<span class="rsvn">{us}%</span></div>')
        return (f'<div class="rscap wide"><div class="rseyeb">{on}</div>'
                f'<div class="rsvsw">{out}</div>'
                f'<div class="rsfoot">Branch 26000 Production and Manpower Record</div></div>')

    # 17a · the career path. The ladder itself, not who has climbed it: two of
    #       the three managers this branch grew are no longer here, and the
    #       house rule is that nobody who goes is named or counted.
    if name == 'path':
        #  Reversed, so the ladder is read from the bottom rung up: the first
        #  cut listed Agent at the top and Branch Manager at the foot, which is
        #  a way down.
        rungs = ['Branch Manager', 'Assistant Branch Manager', 'Unit Manager',
                 'Trainee Manager', 'Executive Agent', 'Agent']
        out = ''.join(
            f'<div class="rsrung" style="--i:{i};--n:{len(rungs)}">'
            f'<span class="rsrd"></span><span class="rsrt">{r}</span></div>'
            for i, r in enumerate(rungs))
        return (f'<div class="rscap wide"><div class="rseyeb">{on}</div>'
                f'<div class="rsladder">{out}</div>'
                f'<div class="rsfoot">this branch grows its own managers, and always has</div>'
                f'</div>')

    # 17b · the three-year plan, 1 October 2026 to 30 September 2029. The
    #       horizon and the direction only: the plan's quotas, scenarios and
    #       attainment ranking stay in the paper.
    if name == 'plan':
        yrs = [('FY27', 'rebuild the bench'), ('FY28', 'grow the units'),
               ('FY29', 'forty agents')]
        out = ''.join(
            f'<div class="rsyr3" style="--i:{i}"><b>{y}</b><span>{t}</span></div>'
            for i, (y, t) in enumerate(yrs))
        return (f'<div class="rscap"><div class="rseyeb">{on}</div>'
                f'<div class="rsrun"><span class="rsrunr"></span>{out}</div>'
                f'<div class="rsfoot">the three-year plan &middot; '
                f'1 October 2026 to 30 September 2029</div></div>')

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
.rs .rspair{position:relative;display:flex;align-items:flex-end;gap:5vw;margin-top:1vh}
.rs .rspb{display:flex;flex-direction:column;align-items:center;justify-content:flex-end}
.rs .rspn{font-size:3.4vw;font-weight:800;color:var(--slate);line-height:1;margin-bottom:.8vh;
  opacity:0;animation:fIn .7s .5s both}
.rs .rspb.lit .rspn{color:var(--cy)}
.rs .rspb i{display:block;flex:none;width:8.5vw;height:calc(var(--h)*.2vh);background:var(--slate);
  border-radius:6px 6px 0 0;transform-origin:bottom;transform:scaleY(0);
  animation:growY 1.1s .5s both}
.rs .rspb.lit i{background:linear-gradient(180deg,var(--cy),#1D5BC4);
  box-shadow:0 0 1.6rem rgba(0,229,255,.35);animation-delay:.8s}
.rs .rspl{font-size:1.25vw;color:var(--mut);margin-top:1.2vh;opacity:0;animation:fIn .7s .9s both}
.rs .rspd{position:absolute;right:-6.5vw;top:8%;font-size:2.4vw;font-weight:800;color:var(--cy);
  opacity:0;transform:translateY(1vh);animation:fUp .6s 1.7s both}
.rs .rspair.tight{gap:3.4vw}
.rs .rsvsw{display:grid;gap:2.6vh;width:78%;max-width:980px;margin-top:.6vh}
.rs .rsvs{display:grid;grid-template-columns:17vw 1fr 4vw;align-items:center;
  column-gap:1.2vw;row-gap:1.5vh;opacity:0;animation:fUp .5s both;
  animation-delay:calc(.5s + var(--i)*.28s)}
.rs .rsvl{font-size:1.2vw;color:var(--mut);text-align:right}
.rs .rsvb{position:relative;height:2.3vh;background:var(--trk, #122043);border-radius:4px}
.rs .rsvb i{position:absolute;left:0;top:0;bottom:0;border-radius:4px;width:0;
  animation:grow .9s both;animation-delay:calc(.7s + var(--i)*.28s)}
.rs .rsvb i.ours{background:linear-gradient(90deg,#1D5BC4,var(--cy));z-index:1}
.rs .rsvb b.rsmk{position:absolute;top:-.35vh;bottom:-.35vh;width:2px;
  background:var(--mut);left:calc(var(--p)*1%);opacity:0;animation:fIn .5s both;
  animation-delay:calc(1.3s + var(--i)*.28s)}
.rs .rsvb b.rsmk span{position:absolute;left:50%;top:calc(100% + .25vh);
  transform:translateX(-50%);font-size:.88vw;font-weight:400;color:var(--dim);
  white-space:nowrap}
.rs .rsvn{font-size:1.4vw;font-weight:800;color:var(--cy)}
.rs .rsvt{grid-column:2;font-size:.95vw;color:var(--dim);margin-top:-.2vh}
.rs .rsladder{display:grid;gap:.85vh;width:66%;max-width:880px;margin-top:.4vh}
.rs .rsrung{display:grid;grid-template-columns:1.1vw 1fr;align-items:center;gap:1.1vw;
  padding:.75vh 1.3vw;border-radius:8px;background:var(--trk, #122043);
  margin-left:calc(var(--i)*2.4vw);margin-right:calc((var(--n) - 1 - var(--i))*2.4vw);
  opacity:0;transform:translateX(-1vw);animation:fRt .5s both;
  animation-delay:calc(.4s + (var(--n) - 1 - var(--i))*.22s)}
@keyframes fRt{to{opacity:1;transform:none}}
.rs .rsrd{width:1.1vw;height:1.1vw;border-radius:50%;background:var(--cy);
  box-shadow:0 0 .7rem rgba(0,229,255,.55)}
.rs .rsrt{font-size:1.25vw;color:var(--ink);font-weight:600;text-align:left}
.rs .rsrun{position:relative;display:flex;justify-content:space-between;
  width:72%;max-width:920px;margin-top:2vh;padding-top:3vh}
.rs .rsrunr{position:absolute;left:0;right:0;top:0;height:2px;background:var(--line);
  transform-origin:left;transform:scaleX(0);animation:growX 1.3s .3s both}
.rs .rsyr3{display:flex;flex-direction:column;align-items:center;gap:.5vh;
  opacity:0;animation:fUp .55s both;animation-delay:calc(.7s + var(--i)*.35s)}
.rs .rsyr3 b{font-size:2.6vw;font-weight:800;color:var(--cy);line-height:1}
.rs .rsyr3 span{font-size:1.15vw;color:var(--mut)}
.rs .rstl{position:relative;width:88%;max-width:1060px;height:24vh;margin-top:1.4vh}
.rs .rstlr{position:absolute;left:0;right:0;bottom:4.2vh;height:2px;background:var(--line);
  transform-origin:left;transform:scaleX(0);animation:growX 1.2s .3s both}
.rs .rsdot{position:absolute;left:calc(var(--x)*1%);bottom:calc(4.2vh + var(--s)*1.5vw);
  width:1.05vw;height:1.05vw;margin-left:-.52vw;border-radius:50%;background:var(--cy);
  opacity:0;transform:scale(.3);animation:dotIn .5s both;animation-delay:calc(.5s + var(--i)*.07s);
  box-shadow:0 0 .7rem rgba(0,229,255,.55)}
.rs .rsdot i{position:absolute;left:50%;bottom:calc(1.5vw + var(--l)*2.6vw);transform:translateX(-50%) rotate(-52deg);
  transform-origin:left bottom;font-size:.82vw;font-style:normal;color:var(--mut);
  white-space:nowrap;letter-spacing:.02em}
@keyframes dotIn{from{opacity:0;transform:scale(.3)}to{opacity:1;transform:scale(1)}}
.rs .rstla,.rs .rstlz{position:absolute;bottom:.9vh;font-size:1.5vw;font-weight:800;
  color:var(--ink);opacity:0;animation:fIn .7s .6s both}
.rs .rstla{left:0}.rs .rstlz{right:0}
.rs .rstk{position:absolute;left:calc(var(--x)*1%);bottom:1.4vh;transform:translateX(-50%);
  font-size:.88vw;color:var(--dim);opacity:0;animation:fIn .7s 1s both}
.rs .rsbuilt{display:grid;grid-template-columns:repeat(3,1fr);gap:.75vh 2.4vw;
  width:88%;max-width:1080px;margin-top:.6vh}
.rs .rsbi{display:grid;grid-template-columns:2.6vw .7vw 1fr;align-items:center;gap:.7vw;
  opacity:0;transform:translateY(.6vh);animation:fUp .45s both;
  animation-delay:calc(.45s + var(--i)*.11s)}
@keyframes fUp{to{opacity:1;transform:none}}
.rs .rsbm{font-size:.92vw;font-weight:800;letter-spacing:.12em;color:var(--dim);text-align:right}
.rs .rsbd{width:.7vw;height:.7vw;border-radius:50%;background:var(--cy);
  box-shadow:0 0 .55rem rgba(0,229,255,.6)}
.rs .rsbt{font-size:1.12vw;color:var(--ink);white-space:nowrap;overflow:hidden;
  text-overflow:ellipsis}
.rs .rschart.one{grid-template-columns:1fr;width:68%;max-width:860px;gap:.9vh 0}
.rs .rschart.one .rsrow{grid-template-columns:15vw 1fr 3.4vw;gap:1.1vw}
.rs .rschart.one .rstrk{height:2.1vh}
.rs .rsdonut.mid{position:static;width:auto;align-items:center;gap:.8vh}
.rs .rsdonut.mid .rsring{width:11vw;height:11vw}
.rs .rsdonut.mid .rsdol b{font-size:2.4vw}
.rs .rszero{font-size:9vw;font-weight:800;line-height:.9;color:var(--cy);
  letter-spacing:-.03em;filter:drop-shadow(0 0 2.2rem rgba(0,229,255,.45))}
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
@keyframes growY{to{transform:none}}
@keyframes growX{to{transform:none}}
@keyframes growY{to{transform:none}}
@keyframes growX{to{transform:none}}
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

# ── the palette, by name ─────────────────────────────────────────────────────
#  28 October 2026: "More color options". Gold was turned down the evening
#  before, so rather than pick a second time, the five below are built on the
#  same frames and shown to him to choose from. Each is a repaint of one
#  baseline (the midnight blue of the board films) by exact hex, in a single
#  pass, so nothing can cascade: a value a palette maps TO is never read back
#  as a value to map FROM.
#
#  Every one clears the three checks that decide whether a reader can tell the
#  bands apart (CVD separation, normal-vision floor, 3:1 on the ground). The
#  validator also flags the lightness band and the chroma floor on all five,
#  and that is the design, not a fault: the slate is MEANT to recede, because
#  it carries the eight people between the two bands the narration names, and
#  an equal-weight palette would have the chart shouting all three at once.
#
#  Rejected on the measurements: emerald with a sky-blue second accent (tritan
#  dE 5.5 — the two bands collapse for a tritan viewer), and an ice/steel pair
#  on the ink ground (dE 13.8 normal vision, under the 15 floor).
BASE = ['bg','ink','mut','dim','line','a1','a2','slate','cold','trk','ring',
        'shoff','g1','g2','sh1','sh3','tear1','tear2','tear3','a1rgb']
NAVY = dict(zip(BASE, [
    '#070F26','#EAF0FF','#9FB0D0','#6B7A99','#1A2744','#00E5FF','#7C8CF8',
    '#5E6B85','#8295B5','#122043','#16254A','#24365E','#1D5BC4','#3E46A8',
    '#2A6DE0','#13408F','#CFE2FF','#7E8FB0','#55658A','0,229,255']))

PALETTES = {
    # dE normal / deutan / tritan on the worst adjacent pair of the three bands
    'blue':    dict(zip(BASE, [   # 19.0 / 18.3 / 15.4 — the board films' own
        '#070F26','#EAF0FF','#9FB0D0','#6B7A99','#1A2744','#00E5FF','#7C8CF8',
        '#5E6B85','#8295B5','#122043','#16254A','#24365E','#1D5BC4','#3E46A8',
        '#2A6DE0','#13408F','#CFE2FF','#7E8FB0','#55658A','0,229,255'])),
    'ink':     dict(zip(BASE, [   # 17.2 / 16.4 / 16.6 — the most restrained
        '#101217','#EDF1F6','#A3ADBC','#6E7786','#22262E','#CFE0F5','#4E8FD6',
        '#5A6472','#7D8899','#1A1E26','#20252E','#333945','#2C5E96','#2B4E7E',
        '#6FA8DC','#2C5E96','#E6EDF5','#8C96A6','#5E6774','207,224,245'])),
    'emerald': dict(zip(BASE, [   # 26.7 / 14.1 / 15.9 — growth, and ours alone
        '#07140F','#E8F5EE','#9DBAAB','#6A8277','#16281F','#2FD39A','#C9A4FF',
        '#5D6B66','#7E9A90','#112A20','#163024','#26453A','#137A57','#6A4BA8',
        '#3FE0A8','#137A57','#DFF3EA','#7E9A90','#4E6760','47,211,154'])),
    'violet':  dict(zip(BASE, [   # 23.5 / 14.8 / 17.6 — the purple he liked
        '#0E0B22','#EEEAFF','#ADA3CE','#766D95','#231E42','#B69CFF','#5EE7D7',
        '#6B6485','#8E86AE','#1C1740','#221C49','#3A3268','#6A4BC8','#2A8F86',
        '#C9B4FF','#5B3FB0','#E8E2FF','#8E86AE','#625B82','182,156,255'])),
    'crimson': dict(zip(BASE, [   # 30.6 / 19.9 / 31.4 — the clearest, and the
        '#14121A','#F4F0F2','#B2A9B2','#7D7480','#28242F','#FF5D6C','#74C8FF',
        '#6B6472','#8C94A6','#231F2C','#282433','#413B4C','#A32B3C','#2B6E9E',
        '#FF8793','#A32B3C','#EFE9EE','#8C8494','#635B6B','255,93,108'])),
'white':   dict(zip(BASE, [   # 21.2 / 20.9 / 18.3 — the most premium
        '#0B0E14','#F2F5FA','#A7B0C2','#717B8E','#1C2130','#F0F4FF','#4D8BFF',
        '#5C6578','#828DA3','#151A26','#1A2030','#2E3647','#6E86B8','#2B5BB5',
        '#8FA8E8','#2B5BB5','#F2F5FA','#8A94A8','#5F6878','240,244,255'])),
    'rose':    dict(zip(BASE, [   # 21.9 / 12.5 / 27.3 — warm, and nothing
        '#1A0F16','#F8EEF1','#BBA6AE','#86707A','#2E1C26','#FF8FA3','#8FD4FF',  # else at the branch is
        '#70646A','#9A838C','#2A1822','#2F1C27','#4A3340','#A33A52','#2F6E9E',
        '#FFB0BF','#A33A52','#F6E8EC','#9A838C','#6E5A62','255,143,163'])),
    'teal':    dict(zip(BASE, [   # 27.1 / 9.1 / 29.1 — the branch's own teal;
        '#0A1A1F','#E6F4F6','#9AB6BB','#688085','#152C33','#2DD4BF','#FF8A7E',  # the 9.1 is legal
        '#5A6E70','#7E989D','#12282F','#163036','#27454C','#11796E','#B0493F',  # only because the
        '#3FE3CE','#11796E','#DFF1F3','#7E989D','#4F6468','45,212,191'])),      # legend names each band
}

def _paint(html, pal):
    """Repaint the baseline in one pass.

    Case-sensitive and longest-first, so a value a palette maps TO can never be
    read back as a value to map FROM: map bg #070F26 -> #14121A while sh3 maps
    #13408F -> #A32B3C, and a cascading two-pass replace would turn the new
    ground into something else again.
    """
    pairs = {NAVY[k]: pal[k] for k in BASE if NAVY[k] != pal[k]}
    if not pairs:
        return html
    pat = re.compile('|'.join(re.escape(k) for k in sorted(pairs, key=len, reverse=True)))
    return pat.sub(lambda m: pairs[m.group(0)], html)


PAL = os.environ.get('RISE_PAL', 'blue')
assert PAL in PALETTES, 'unknown palette: ' + PAL
out = _paint(out, PALETTES[PAL])
if os.environ.get('RISE_VARIANT'):
    OUT = ROOT / 'blastoff' / ('film-%s.html' % PAL)

OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(out)
tot = sum(durs) / 1000
print(f'{OUT.relative_to(ROOT)} — {len(LINES["scenes"])} scenes, {tot:.1f}s, '
      f'{len(PEOPLE)} in the chart, {TOTAL} years, bands {LONG}/{MID}/{NEW}')
