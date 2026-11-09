#!/usr/bin/env python3
"""The recruiting posters — the thing that actually gets posted.

The branch had three recruiting pages and three films and no still ad. A page
is where somebody lands; a poster is what makes them land. Asked for on
7 November 2026: *"want to see the ad with a more punch and impact."*

Built in the board films' own midnight blue, from the same fonts, the same
blue shield and the same QR codes, so the poster, the film and the page are
plainly one campaign. Everything is drawn: no photographs, no faces, no stock.

    python3 build-ad.py clientmanager        # writes every shape
    python3 build-ad.py clientmanager feed   # one shape, to iterate on

Shapes: feed 1080x1350 (Facebook, Instagram, LinkedIn), story 1080x1920
(Status, Stories, Reels cover), wide 1200x630 (a link preview, and a slide).

The HTML goes to the session scratchpad and the JPEGs to <page>/ad-<shape>.jpg,
shot by shoot-ad.js. Re-run both after any change to the copy.
"""
import base64, json, pathlib, sys

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent.parent
FILM = ROOT / 'tools' / 'film'

PLEX = base64.b64encode((FILM / 'fonts' / 'IBMPlexSans-latin.woff2').read_bytes()).decode()
LOGO = base64.b64encode((FILM / 'board-mark.png').read_bytes()).decode()

SHAPES = {'feed': (1080, 1350), 'story': (1080, 1920), 'wide': (1200, 630)}

# ── the three ads ────────────────────────────────────────────────────────────
# Every line here is the page's own line. A poster that promises something the
# page does not say is the fastest way to lose the candidate on arrival.
ADS = {
    'clientmanager': {
        'dir': 'clientmanager',
        'under': 'General insurance &middot; Central Trinidad',
        'badge': 'We are hiring',
        # No seat count on this one: 8 November 2026, he chose as many
        # applications as possible over the scarcity the other two keep. The
        # slot carries the offer instead — and it may not repeat the masthead,
        # which already says General insurance - Central Trinidad.
        'vacancy': 'Hours that suit you',
        # 8 November 2026: "don't say Chaguanas". A recruiting ad still has to
        # say where the office is or people cannot judge the drive, so the
        # town stays in the page's practical line and the posters lead with
        # the region.
        'where': 'Central Trinidad',
        'role': 'Client Manager &middot; General Insurance',
        'head': ['The book is', 'already there.'],
        'em': ['What it has', 'never had is you.'],
        # 9 November 2026. The pull used to open on the reader's filing cabinet
        # and his inbox that never empties: "why are you saying still lives in a
        # cabinet, I asked for creativity and not bash." A poster that opens by
        # telling a man his desk is primitive is an insult he reads in public,
        # and it is beaten anyway by the one true thing this ad has — the book
        # exists, it is big, and it has never had one person. So the pull flatters
        # his expertise instead of pitying his week, and claims nothing about
        # where he works now. It is the page's own pull, tightened for the frame.
        'pull': 'If you know general insurance well enough to look at a book this '
                'size, across ten lines, and see exactly what it has been missing '
                '&mdash; read this one.',
        'chips': ['Judged on the book, not on the clock',
                  'A change you ask for gets built that week',
                  'Every endorsement written to the Act',
                  'Ten lines written here, seven in force today'],
        'url': 'rickyrampersadbranch.com/clientmanager',
        'qr': 'qr-cmadmin.png',
        'foot': 'Your CV and fifteen minutes. Read by the Branch Manager alone.',
    },
    'buildwithus': {
        'dir': 'buildwithus',
        'under': 'Guardian Life of the Caribbean',
        'badge': 'We are hiring',
        'vacancy': 'One vacancy',
        'role': 'Administrator &amp; branch builder',
        'head': ['You already know how', 'your office should run.'],
        'em': ['Nobody has given', 'you the tools.'],
        'pull': 'If you have ever fixed something at work on your own time, because '
                'waiting for somebody else to fix it was unbearable &mdash; this is the one.',
        'chips': ['Half the day is the branch&rsquo;s admin',
                  'The other half is making that admin not need doing',
                  'Not a developer&rsquo;s job &mdash; but you have written something'],
        'url': 'rickyrampersadbranch.com/buildwithus',
        'qr': 'qr-bwadmin.png',
        'foot': 'No CV needed. Fifteen minutes. Read by the Branch Manager alone.',
    },
    'joinourbranch': {
        'dir': 'joinourbranch',
        'under': 'Guardian Life of the Caribbean',
        'badge': 'We are hiring',
        'vacancy': 'Advisors',
        'role': 'Financial advisor &middot; full training',
        'head': ['Most people start', 'this career with a', 'list of their friends.'],
        'em': ['Not here.'],
        'pull': 'If you are good with people and have always been told the only way in '
                'is to sell to everyone you know &mdash; that is not how we do it.',
        'chips': ['The branch brings you the clients',
                  'A digital fact find, checked by a manager',
                  'Paid training while you qualify'],
        'url': 'rickyrampersadbranch.com/joinourbranch',
        'qr': 'qr-jbadvisor.png',
        'foot': 'Fifteen minutes. Read by the Branch Manager and the Unit Manager.',
    },
}

CSS = r"""
@font-face{font-family:'IBM Plex Sans';font-style:normal;font-weight:100 700;
  font-display:block;src:url(data:font/woff2;base64,__PLEX__) format('woff2')}
*,*::before,*::after{box-sizing:border-box}
html,body{margin:0;padding:0;background:#070F26}
:root{
  --navy:#070F26; --b1:#13408F; --b2:#1D5BC4; --b3:#2A6DE0; --cyan:#00E5FF;
  --pale:#BFD3F7; --ink:#0B1B33;
  --f:'IBM Plex Sans',system-ui,sans-serif;
}
.ad{position:relative;overflow:hidden;background:var(--navy);color:#fff;
  font-family:var(--f);display:flex;flex-direction:column}

/* the ground: the films' own aurora, rays and dot mesh */
.bg{position:absolute;inset:0;z-index:0;pointer-events:none}
.bg .aur{position:absolute;inset:-25%;
  background:radial-gradient(42% 38% at 18% 14%,rgba(29,91,196,.55),transparent 62%),
             radial-gradient(46% 40% at 86% 78%,rgba(0,229,255,.20),transparent 62%),
             radial-gradient(40% 34% at 62% 36%,rgba(42,109,224,.30),transparent 60%)}
.bg .rays{position:absolute;inset:-30%;opacity:.5;
  background:repeating-linear-gradient(118deg,rgba(255,255,255,.045) 0 2.2%,transparent 2.2% 6.4%)}
.bg .dots{position:absolute;inset:0;opacity:.5;
  background-image:radial-gradient(rgba(191,211,247,.22) 1px,transparent 1px);
  background-size:26px 26px}
.bg .ring{position:absolute;border:1px solid rgba(0,229,255,.13);border-radius:50%}
.bg .r1{inset:auto -18% -26% auto;width:72%;aspect-ratio:1}
.bg .r2{inset:auto -34% -44% auto;width:104%;aspect-ratio:1}
.bg .glow{position:absolute;left:-14%;top:-18%;width:70%;aspect-ratio:1;border-radius:50%;
  background:radial-gradient(circle,rgba(0,229,255,.18),transparent 62%);filter:blur(10px)}

.in{position:relative;z-index:1;display:flex;flex-direction:column;height:100%}

/* masthead */
.mast{display:flex;align-items:center;gap:var(--g-s)}
.mk{width:var(--mk);height:var(--mk);flex:none;border-radius:calc(var(--mk)*.26);
  background:url(data:image/png;base64,__LOGO__) center/contain no-repeat}
.mast b{display:block;font-weight:700;font-size:var(--f-mast);letter-spacing:-.01em;line-height:1.15}
.mast span{display:block;font-weight:600;font-size:var(--f-mast-s);letter-spacing:.17em;
  text-transform:uppercase;color:var(--pale);margin-top:.25em}

/* the badge: it has to read as a hiring ad from a thumbnail */
.badge{display:inline-flex;align-items:center;gap:var(--g-s);align-self:flex-start}
.badge .pill{display:inline-flex;align-items:center;gap:.5em;
  background:linear-gradient(135deg,var(--cyan),#6FE8FF);color:var(--ink);
  font-weight:700;font-size:var(--f-badge);letter-spacing:.14em;text-transform:uppercase;
  padding:.5em 1em;border-radius:999px}
.badge .pill i{width:.62em;height:.62em;border-radius:50%;background:var(--ink);flex:none}
.badge .vac{font-weight:700;font-size:var(--f-badge);letter-spacing:.14em;
  text-transform:uppercase;color:var(--cyan)}

/* the headline does the work */
h1{margin:0;font-weight:700;font-size:var(--f-h);line-height:1.02;letter-spacing:-.028em}
h1 .em{color:var(--cyan);display:block}
.role{font-weight:700;font-size:var(--f-role);letter-spacing:.15em;text-transform:uppercase;
  color:var(--pale)}

.pull{position:relative;padding-left:var(--g-m);font-weight:600;
  font-size:var(--f-pull);line-height:1.34;color:#EAF2FF;max-width:30ch}
.pull::before{content:"";position:absolute;left:0;top:.14em;bottom:.14em;width:5px;
  border-radius:5px;background:linear-gradient(180deg,var(--cyan),var(--b3))}

.chips{display:flex;flex-direction:column;gap:var(--g-s);align-items:flex-start}
.chip{display:inline-flex;align-items:center;gap:.6em;font-style:normal;font-weight:600;font-size:var(--f-chip);
  color:#DCE8FB;background:rgba(29,91,196,.30);border:1px solid rgba(0,229,255,.28);
  border-radius:999px;padding:.52em 1em;line-height:1.25}
.chip s{flex:none;width:.72em;height:.72em;border-radius:50%;background:var(--cyan);
  text-decoration:none}

/* the foot carries the one thing they have to do */
.foot{margin-top:auto;display:flex;align-items:center;gap:var(--g-m);
  border-top:1px solid rgba(191,211,247,.22);padding-top:var(--g-m)}
.foot .qr{width:var(--qr);height:var(--qr);flex:none;border-radius:calc(var(--qr)*.09);
  background:#fff;padding:calc(var(--qr)*.055)}
.foot .qr img{display:block;width:100%;height:100%;image-rendering:pixelated}
.foot .u{font-weight:700;font-size:var(--f-url);letter-spacing:-.01em;color:#fff;
  line-height:1.2;word-break:break-word}
.foot .s{font-weight:500;font-size:var(--f-foot);color:var(--pale);margin-top:.5em;line-height:1.35}

/* ── feed · 1080x1350 ─────────────────────────────────────────────────────── */
.feed{width:1080px;height:1350px;--mk:58px;--qr:176px;
  --g-s:14px; --g-m:24px;
  --f-mast:26px; --f-mast-s:14px; --f-badge:21px; --f-h:82px; --f-role:22px;
  --f-pull:29px; --f-chip:21px; --f-url:29px; --f-foot:19px}
.feed .in{padding:62px 70px 58px}
/* 8 November 2026: the longer pull — the filing-cabinet line — put 23px of
   the foot outside the 1350 frame, which is the QR and the address simply
   gone. The frame gives, the copy does not: 24px came out of three margins
   and nothing came out of a line. */
.feed .mast{margin-bottom:32px}
.feed .badge{margin-bottom:22px}
.feed h1{margin-bottom:22px}
.feed .role{margin-bottom:26px}
.feed .pull{margin-bottom:26px}

/* ── story · 1080x1920 ────────────────────────────────────────────────────── */
.story{width:1080px;height:1920px;--mk:66px;--qr:214px;
  --g-s:18px; --g-m:30px;
  --f-mast:29px; --f-mast-s:16px; --f-badge:24px; --f-h:100px; --f-role:25px;
  --f-pull:34px; --f-chip:25px; --f-url:33px; --f-foot:22px}
.story .in{padding:178px 82px 162px}
.story .mast{margin-bottom:84px}
.story .badge{margin-bottom:38px}
.story h1{margin-bottom:32px}
.story .role{margin-bottom:46px}
.story .pull{margin-bottom:58px}

/* ── wide · 1200x630, a link preview and a slide ──────────────────────────── */
.wide{width:1200px;height:630px;--mk:44px;--qr:152px;
  --g-s:12px; --g-m:20px;
  --f-mast:19px; --f-mast-s:11px; --f-badge:15px; --f-h:52px; --f-role:15px;
  --f-pull:21px; --f-chip:0px; --f-url:22px; --f-foot:14px}
.wide .in{padding:40px 54px 34px}
.wide .mast{margin-bottom:20px}
.wide .badge{margin-bottom:14px}
.wide .wrap2{display:flex;gap:40px;align-items:flex-start}
.wide h1{margin-bottom:16px}
.wide .role{margin-bottom:14px}
.wide .pull{max-width:34ch}
.wide .chips{display:none}
"""


def html(key, shape):
    a = ADS[key]
    w, h = SHAPES[shape]
    qr = base64.b64encode((FILM / a['qr']).read_bytes()).decode()
    head = ''.join(f'{x}<br>' for x in a['head']) + \
           '<span class="em">' + '<br>'.join(a['em']) + '</span>'
    chips = ''.join(f'<i class="chip"><s></s>{c}</i>' for c in a['chips'])
    body = (f'<p class="role">{a["role"]}</p>'
            f'<h1>{head}</h1>'
            f'<p class="pull">{a["pull"]}</p>'
            f'<div class="chips">{chips}</div>')
    if shape == 'wide':
        body = (f'<p class="role">{a["role"]}</p><div class="wrap2"><div><h1>{head}</h1></div>'
                f'<div><p class="pull">{a["pull"]}</p></div></div>')
    css = CSS.replace('__PLEX__', PLEX).replace('__LOGO__', LOGO)
    return (f'<!doctype html><html lang="en"><head><meta charset="utf-8">'
            f'<title>{key} ad · {shape}</title><style>{css}</style></head><body>'
            f'<div class="ad {shape}">'
            f'<div class="bg"><div class="aur"></div><div class="rays"></div><div class="dots"></div>'
            f'<div class="glow"></div><div class="ring r1"></div><div class="ring r2"></div></div>'
            f'<div class="in">'
            f'<div class="mast"><i class="mk"></i><div><b>Ricky Rampersad Branch</b>'
            f'<span>{a["under"]}</span></div></div>'
            f'<div class="badge"><span class="pill"><i></i>{a["badge"]}</span>'
            f'<span class="vac">{a["vacancy"]} &middot; {a.get("where", "Chaguanas")}</span></div>'
            f'{body}'
            f'<div class="foot"><span class="qr"><img src="data:image/png;base64,{qr}" alt=""></span>'
            f'<div><div class="u">{a["url"]}</div><div class="s">{a["foot"]}</div></div></div>'
            f'</div></div></body></html>')


if __name__ == '__main__':
    key = sys.argv[1] if len(sys.argv) > 1 else 'clientmanager'
    want = sys.argv[2:] or list(SHAPES)
    out = pathlib.Path(sys.argv[0]).resolve().parent / 'out'
    out.mkdir(exist_ok=True)
    made = []
    for s in want:
        f = out / f'{key}-{s}.html'
        f.write_text(html(key, s))
        made.append(str(f))
        print(f'{f}  {SHAPES[s][0]}x{SHAPES[s][1]}')
    print(json.dumps({'key': key, 'dir': ADS[key]['dir'], 'files': made}))
