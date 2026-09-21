#!/usr/bin/env python3
"""Generate the eight transition letters as sendable e-mail HTML.

One shell, eight openings. Every letter carries the film, the Act note, the
two doors into the review and the same sign-off; only the subject and the
first paragraphs change by segment. Generated, not hand-typed, so a change to
the shell reaches all eight in one run.

E-mail rules: 600px table, every style inline, the logo a hosted PNG — Gmail
strips SVG and blocks data: URIs, so anything else arrives as an empty box.

Merge fields are {{double_braces}}. No client data lives here; the merge file
that fills them is built outside the repository.

  python3 build-letters.py          → orphan-transition/letters/*.html
"""
import html, json, pathlib

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent.parent
OUT = ROOT / 'orphan-transition' / 'letters'
OUT.mkdir(parents=True, exist_ok=True)

LOGO = 'https://rickyrampersadbranch.com/logo-mark.png'
# The addresses a client sees. /your-policy/ forwards to /orphan-video/ with
# the token and segment intact — nothing in a client's hand carries the word
# "orphan", which is the trade's word for them and not one to hand a rival.
FILM = 'https://rickyrampersadbranch.com/your-policy/?t={{token}}&s={{segment}}'
REVIEW = 'https://donthaveanagent.com/start?t={{token}}'
ASSIGN = 'https://rickyrampersadbranch.com/your-policy/?t={{token}}&s={{segment}}#choose'
PROTECT = 'https://rickyrampersadbranch.com/your-policy/protected?t={{token}}&s={{segment}}'

# ── the eight openings ────────────────────────────────────────────────
SEGMENTS = {
 'A': dict(
  name='A policy has matured',
  subject='A policy of yours has matured — there is money to claim',
  preheader='It reached the end of its term. The money is yours, and it is waiting.',
  headline='One of your policies has <em>matured.</em>',
  open=['One of your policies reached the end of its term and has matured. That money is yours, and it '
        'is sitting there waiting to be claimed. Nothing about this is a sales call &mdash; we would simply '
        'rather you had it than not.',
        'Your representative, {{agent_first_name}}, has moved on from Guardian Life, which is why this is '
        'coming from the branch. Your other policies are completely unaffected.'],
  send='Only a handful of this group have an e-mail. The rest is a phone call, and it is the one call '
       'nobody resents.'),
 'B': dict(
  name='Paid up',
  subject='You have finished paying for this one',
  preheader='Nothing more to pay. Here is what you own outright.',
  headline='Your policy is <em>paid up.</em>',
  open=['Your policy is paid up. There is nothing more to pay, and the cover stands for the rest of your '
        'life. Most people in that position have never been told what it is now worth, or what it can '
        'still do for them.',
        'Your representative, {{agent_first_name}}, has moved on from Guardian Life. Your policy is '
        'completely unaffected &mdash; it is yours, outright.'],
  send='Nearly all of this group have e-mail.'),
 'C': dict(
  name='Carrying waiver of premium',
  subject='There is a benefit inside your policy you may not know about',
  preheader='If illness stopped you working, Guardian Life would pay your premiums for you.',
  headline='Your policy carries a <em>waiver of premium.</em>',
  open=['In plain terms: if illness or injury stopped you working, Guardian Life would keep paying your '
        'premiums for you, and your cover would stay in force while you recovered. You have been paying for '
        'that protection all along. Most people who hold it have never been told.',
        'Your representative, {{agent_first_name}}, has moved on from Guardian Life. Your policy, and that '
        'benefit inside it, are completely unaffected.'],
  send='The strongest letter in the set. Send it second, after A and B have warmed the domain.'),
 'D': dict(
  name='Collected off a payroll',
  subject='Your policy, and a check we are running on your salary deduction',
  preheader='Deductions sometimes stop quietly. We are checking yours so that you do not have to.',
  headline='Your policy is unchanged. We are also checking your <em>deduction.</em>',
  open=['Your premium comes off your salary. Those arrangements sometimes stop quietly &mdash; a change of '
        'employer, a payroll system, a posting &mdash; and the first anybody notices is a gap. We are '
        'checking your deduction against our own records this week, so that if something has slipped we '
        'find it rather than you. You do not need to do anything. And if you would ever like to know exactly '
        'what Guardian Life has recorded as paid on your policy, ask the branch for your paid-to date &mdash; '
        'it is on your file and takes one call.',
        'Your representative, {{agent_first_name}}, has moved on from Guardian Life. Your policy is '
        'completely unaffected.'],
  send='The word "arrears" does not appear. Until the deduction file is reconciled, a gap is ours to '
       'chase, not theirs to explain.'),
 'E': dict(
  name='Held ten years or more',
  subject='You have held this cover for {{years}} years',
  preheader='Your premium is fixed on the age you were when you started. Nobody can sell you that again.',
  headline='A policy held for {{years}} years cannot be bought again <em>at the price you pay.</em>',
  open=['Your premium is fixed on the age you were when you took this policy out &mdash; not your age now. '
        'A policy written for you {{years}} years ago is still charging {{years}}-years-ago prices, and no '
        'company can sell that price back to you. It is the part of a life policy people give away without '
        'realising they owned it. The value inside it is not sitting idle either: after three years of '
        'premiums, the Insurance Act entitles you to a smaller policy fully paid for life instead of cashing '
        'it in, and the branch will put that figure in writing beside what a surrender would pay before you '
        'decide anything.',
        'Your representative, {{agent_first_name}}, has moved on from Guardian Life. Your policy, and that '
        'price, are completely unaffected.'],
  send='Only a third of this group have e-mail. The other two-thirds are worth a phone call, because the '
       'argument is strongest here.'),
 'F': dict(
  name='In force',
  subject='A quick summary of your Guardian Life cover — and two ways to pick this up',
  preheader='A short film, then whichever door suits you.',
  headline='You have been with us {{years}} years. Here is where <em>things stand.</em>',
  open=['Your representative, {{agent_first_name}}, has moved on from Guardian Life. Your policy is '
        'completely unaffected &mdash; same cover, same premium, same beneficiaries. I wanted you to hear '
        'that from us rather than wonder.',
        'Before anything else, a short film that answers the question most people actually have.'],
  send='The core letter. The largest group and the best reach.'),
 'G': dict(
  name='Lapsed',
  subject='A policy you may have written off — let us tell you what it is worth',
  preheader='A policy that stopped does not always stop being worth something.',
  headline='You may still have <em>money</em> in a policy you think is gone.',
  open=['You held a policy with us that stopped being paid. People assume that is the end of it. Often it '
        'is not &mdash; some build a value that stays yours, some can be restarted, and a few quietly mature '
        'with nobody claiming them.',
        'We are not asking you for anything. We would just like to tell you what you have.'],
  send='A week behind the others, and it does not mention the departure at all &mdash; these clients '
       'stopped paying years ago and it is irrelevant to them.',
  inforce=False),
 'H': dict(
  name='Nothing held',
  subject='Is this still the right address for you?',
  preheader='A short note from the branch that looked after you.',
  headline='A short note from the <em>branch.</em>',
  open=['You were a client of this branch, and our records still carry your details. We are writing to '
        'everyone we have looked after, to make sure we can still reach you, and to leave you with something '
        'worth two minutes of your time.',
        'There is nothing to do and nothing to pay. If the address is wrong, a reply puts it right.'],
  send='Lightest touch. No claim about anything they hold, because they hold nothing. Last to go.',
  inforce=False),
}

# ── the shell ─────────────────────────────────────────────────────────
# Inline styles throughout: e-mail clients strip <style> blocks unpredictably.
def letter_table(seg, cfg):
    """The 600px table: the e-mail's body, and what /templates shows."""
    open_ps = ''.join(f'<p style="margin:0 0 14px">{p}</p>' for p in cfg['open'])
    # The closing says what the client keeps whatever they do. A lapsed or empty
    # file (G, H) gets the short form: there is no in-force contract to describe.
    if cfg.get('inforce', True):
        closing = '''
  <p style="margin:0 0 14px">If neither appeals today, that is genuinely fine. Your policy is a contract between you
    and Guardian Life of the Caribbean: its cover, its premium and the beneficiary you named are written into it,
    and none of them depends on any person. Anything you ever want done on it &mdash; a change of beneficiary, a
    claim, a question about a premium &mdash; is done through Guardian Life, and the branch does it with you.</p>
  <p style="margin:0 0 14px">Until you choose, your policy is looked after by this branch under my name; from the
    moment you ask, you have an agent of your own, by name and with a direct number, within two working days. The
    birthday note, the premium reminder before a due date, and a person who answers when you call all carry on
    exactly as they have. We will ask again rather than assume.</p>'''
    else:
        closing = '''
  <p style="margin:0 0 14px">If neither appeals today, that is genuinely fine. Nothing about how the branch looks
    after you changes: the birthday note, the premium reminder before a due date, and a person who answers when
    you call, all carry on exactly as they have. We will ask again rather than assume.</p>'''
    film_block = f'''
<a href="{FILM}" style="display:block;text-decoration:none;border-radius:10px;overflow:hidden;
   background:#0a2330;border:1px solid #17384a;margin:0 0 16px">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr><td style="padding:20px 22px">
    <div style="font:800 10px/1 'Plus Jakarta Sans',Arial,sans-serif;letter-spacing:.18em;text-transform:uppercase;color:#00CFEA">Under two minutes</div>
    <div style="font:800 17px/1.3 'Plus Jakarta Sans',Arial,sans-serif;color:#ffffff;margin:8px 0 4px">If you choose not to have an agent</div>
    <div style="font:400 13.5px/1.5 Inter,Arial,sans-serif;color:#9dbdd8">What carries on either way, what is already sitting inside your policy, and what the law entitles you to ask for.</div>
    <div style="display:inline-block;margin-top:13px;background:#00CFEA;color:#ffffff;border-radius:9px;padding:10px 17px;font:800 14.5px/1 'Plus Jakarta Sans',Arial,sans-serif">&#9654;&nbsp; Watch it</div>
  </td></tr></table>
</a>'''
    law_block = f'''
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 16px">
<tr><td style="background:#f5fbfd;border-left:3px solid #00CFEA;padding:12px 15px;font:400 13.5px/1.55 Inter,Arial,sans-serif;color:#33465a">
  <b style="display:block;color:#12202e;margin-bottom:4px;font-size:13px">One thing worth knowing</b>
  A life policy cannot be transferred. No agent, no broker and no other company can move it for you &mdash; if
  anyone suggests you move, what is being proposed is that you end this one and buy a new one, priced at your
  age now and underwritten on your health today. Anything a doctor has told you since this one began is priced,
  excluded or declined afresh; the policy you hold is already issued, and nothing about your health now can
  touch it.
  <span style="display:block;margin-top:8px">Under the Insurance Act, whoever suggests it &mdash; agent, broker or company &mdash; must discuss the
  advantages <i>and</i> the disadvantages with you first. So ask for it in writing, with both policies side by
  side: same sum assured, same term, same benefits, priced at the age you are now. And whatever you ever
  decide, keep this policy in force until any new one has actually been issued and is in your hands &mdash; a
  new application can take weeks, and it costs nothing to wait.</span>
  <a href="{PROTECT}" style="display:block;margin-top:8px;color:#07606f;font-weight:700;text-decoration:none">How the law protects you, in plain words &rarr;</a>
</td></tr></table>'''
    doors_block = f'''
<p style="margin:0 0 12px">Then, whenever suits you, there is a short review of what you hold. <b>It is the same
  review either way</b> &mdash; the only question is who fills it in.</p>
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 16px">
<tr><td style="padding:0 0 9px">
  <a href="{REVIEW}" style="display:block;text-decoration:none;background:#eafafd;border:1px solid #8fd8e6;border-radius:10px;padding:13px 16px">
    <div style="font:800 9.5px/1 'Plus Jakarta Sans',Arial,sans-serif;letter-spacing:.18em;text-transform:uppercase;color:#07606f">Do it now, yourself</div>
    <div style="font:800 16px/1.3 'Plus Jakarta Sans',Arial,sans-serif;color:#12202e;margin:5px 0 3px">Start my review &rarr;</div>
    <div style="font:400 13.5px/1.5 Inter,Arial,sans-serif;color:#5d7186">About fifteen minutes on your phone. Whoever we match you to reads it <b>before</b> you meet, so the first conversation starts where it should.</div>
  </a>
</td></tr>
<tr><td>
  <a href="{ASSIGN}" style="display:block;text-decoration:none;background:#ffffff;border:1px solid #cfe3ea;border-radius:10px;padding:13px 16px">
    <div style="font:800 9.5px/1 'Plus Jakarta Sans',Arial,sans-serif;letter-spacing:.18em;text-transform:uppercase;color:#07606f">Or do it together</div>
    <div style="font:800 16px/1.3 'Plus Jakarta Sans',Arial,sans-serif;color:#12202e;margin:5px 0 3px">Have an agent go through it with me &rarr;</div>
    <div style="font:400 13.5px/1.5 Inter,Arial,sans-serif;color:#5d7186">Same review, same questions, only somebody walks you through it &mdash; in person or on the phone, whichever you prefer. If there is a particular agent at this branch you would like, tell us the name in a reply to this letter, and that is who you will have.</div>
  </a>
</td></tr></table>'''
    return f'''<table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;width:100%;background:#ffffff;border-radius:10px;overflow:hidden">

<tr><td style="background:#07131f;padding:15px 24px;border-bottom:3px solid #efc24b">
  <table role="presentation" cellpadding="0" cellspacing="0"><tr>
    <td style="width:32px;padding-right:11px"><img src="{LOGO}" width="32" height="32" alt="" style="display:block;border-radius:8px"></td>
    <td style="font:800 13px/1.25 'Plus Jakarta Sans',Arial,sans-serif;color:#eaf4ff">Ricky Rampersad Branch<br>
      <span style="font:500 10.5px/1.3 Inter,Arial,sans-serif;color:#8fd8e6">Guardian Life of the Caribbean</span></td>
  </tr></table>
</td></tr>

<tr><td style="padding:24px 24px 8px;font:400 15.5px/1.6 Inter,Arial,sans-serif;color:#33465a">
  <h1 style="font:800 19px/1.3 'Plus Jakarta Sans',Arial,sans-serif;color:#12202e;margin:0 0 14px;letter-spacing:-.2px">{cfg['headline'].replace('<em>','<span style="color:#c9942c">').replace('</em>','</span>')}</h1>
  <p style="margin:0 0 13px">Dear {{{{first_name}}}},</p>
  {open_ps}
  {film_block}
  {law_block}
  {doors_block}
  {closing}
  <p style="margin:18px 0 0;font:400 14.5px/1.5 Inter,Arial,sans-serif;color:#12202e">
    <b style="display:block">Ricky Rampersad</b>Branch Manager &middot; Ricky Rampersad Branch<br>Guardian Life of the Caribbean</p>
</td></tr>

<tr><td style="background:#f4f8fa;padding:13px 24px;border-top:1px solid #e0eaef;font:400 11.5px/1.5 Inter,Arial,sans-serif;color:#64798e">
  Sent because you hold, or held, a policy serviced by this branch. Policy numbers and personal details are
  deliberately kept out of this e-mail. Prefer post or a phone call? Just reply &mdash; it reaches a person
  the same day.
</td></tr>
</table>'''


def shell(seg, cfg):
    """The e-mail document: preheader, grey ground, the letter table centred."""
    return f'''<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{html.escape(cfg['subject'])}</title>
<!-- segment {seg} · {html.escape(cfg['name'])} · generated by tools/letters/build-letters.py -->
</head>
<body style="margin:0;padding:0;background:#eef4f7">
<div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:#eef4f7">{html.escape(cfg['preheader'])}</div>
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#eef4f7"><tr><td align="center" style="padding:24px 12px">
{letter_table(seg, cfg)}
</td></tr></table>
</body></html>
'''

manifest = []
for seg, cfg in SEGMENTS.items():
    path = OUT / f'{seg}.html'
    path.write_text(shell(seg, cfg), encoding='utf-8')
    manifest.append({'segment': seg, 'name': cfg['name'], 'subject': cfg['subject'],
                     'preheader': cfg['preheader'], 'file': path.name, 'send_note': cfg['send']})
    print(f'  {seg}  {cfg["name"]:<30} → {path.name}')
(OUT / 'manifest.json').write_text(json.dumps(manifest, indent=1), encoding='utf-8')
print(f'wrote {len(manifest)} letters + manifest.json to {OUT}')

# ── /templates: every letter as the client sees it, on one page ───────
# The team's viewing page, the way /vid is for the film. Generated with the
# letters so it can never drift from them. Who gets which letter is said in
# words; no counts, because the page is public once merged.
TPL = ROOT / 'templates' / 'index.html'
WHO = {'A': 'a client with a policy that has matured', 'B': 'a client whose policy is paid up',
       'C': 'a client carrying a waiver of premium', 'D': 'a client whose premium comes off a payroll',
       'E': 'a client who has held cover for ten years or more', 'F': 'a client with a policy in force',
       'G': 'a client whose policy lapsed', 'H': 'a client with nothing in force and nothing lapsed'}
nav = ''.join(f'<a href="#{seg}"><b>{seg}</b> {html.escape(cfg["name"])}</a>' for seg, cfg in SEGMENTS.items())
cards = ''.join(f"""
<section class="tpl" id="{seg}">
  <div class="head">
    <div class="s">Letter {seg} &middot; {html.escape(cfg['name'])}</div>
    <b>{html.escape(cfg['subject'])}</b>
    <span>{html.escape(cfg['preheader'])}</span>
    <i>Goes to {WHO[seg]}.</i>
  </div>
  <div class="mail"><div class="in">{letter_table(seg, cfg)}</div></div>
</section>""" for seg, cfg in SEGMENTS.items())
page = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>The letters going out | Ricky Rampersad Branch</title>
<meta name="description" content="Every letter the branch sends to the clients of representatives who have moved on, exactly as the client receives it.">
<meta name="robots" content="noindex">
<link rel="icon" href="../logo-mark.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;700;800&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  :root{{--navy:#07131f;--ink:#12202e;--body:#33465a;--dim:#64798e;--gold:#efc24b;--gold2:#c9942c;--teal:#00CFEA;--teal2:#0aa8bf;--tdark:#07606f;
    --paper:#eef4f7;--card:#fff;--line:#d7e3ea;--f:'Plus Jakarta Sans',Inter,system-ui,sans-serif}}
  *{{box-sizing:border-box}}
  body{{margin:0;background:var(--paper);color:var(--body);font:16px/1.65 Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif}}
  .wrap{{width:min(980px,100% - 34px);margin:0 auto}}
  header{{background:var(--navy);color:#eaf4ff;border-bottom:3px solid transparent;border-image:linear-gradient(90deg,var(--gold),var(--teal)) 1}}
  header .wrap{{display:flex;align-items:center;gap:12px;padding:16px 0}}
  .mark{{width:40px;height:40px;border-radius:11px;overflow:hidden;background:#07131f;display:grid;place-items:center;flex:none}}
  .mark img{{width:100%;height:100%;display:block}}
  .brand{{font-family:var(--f);font-weight:800;font-size:15px;letter-spacing:-.2px;line-height:1.25}}
  .brand i{{display:block;font-style:normal;font-weight:500;font-size:11.5px;color:#9dbdd8;letter-spacing:.03em}}
  .hero{{background:radial-gradient(900px 520px at 88% -24%,rgba(0,207,234,.22),transparent 60%),
    radial-gradient(1100px 600px at 8% -18%,rgba(239,194,75,.15),transparent 62%),
    linear-gradient(168deg,#0a2330 0%,var(--navy) 58%,#040d16 100%);color:#eaf4ff;padding:34px 0 36px}}
  .eyebrow{{font-family:var(--f);font-weight:800;font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:var(--gold)}}
  h1{{font-family:var(--f);font-weight:800;font-size:clamp(25px,4.6vw,38px);line-height:1.16;letter-spacing:-.6px;margin:10px 0 10px;color:#fff}}
  h1 em{{font-style:normal;color:var(--gold)}}
  .lead{{color:#9dbdd8;max-width:62ch;margin:0;font-size:16.5px}}
  .verdict{{display:inline-block;margin-top:18px;background:linear-gradient(135deg,var(--teal),var(--teal2));color:#fff;border-radius:11px;
    padding:12px 20px;font-family:var(--f);font-weight:800;font-size:15px;text-decoration:none;box-shadow:0 16px 40px rgba(0,207,234,.28)}}
  nav.toc{{background:var(--card);border-bottom:1px solid var(--line);position:sticky;top:0;z-index:5}}
  nav.toc .wrap{{display:flex;flex-wrap:wrap;gap:4px 16px;padding:11px 0;font-size:13.5px}}
  nav.toc a{{color:var(--tdark);text-decoration:none;font-weight:600}} nav.toc a b{{color:var(--ink);margin-right:3px}}
  main{{padding:26px 0 50px}}
  .tpl{{background:var(--card);border:1px solid var(--line);border-radius:15px;overflow:hidden;margin:0 0 22px;scroll-margin-top:60px}}
  .tpl .head{{padding:16px 20px 14px;border-bottom:1px solid var(--line)}}
  .tpl .s{{font-family:var(--f);font-weight:800;font-size:10.5px;letter-spacing:.16em;text-transform:uppercase;color:var(--tdark)}}
  .tpl .head b{{display:block;font-family:var(--f);font-size:17px;color:var(--ink);margin:5px 0 3px;letter-spacing:-.2px}}
  .tpl .head span{{display:block;color:var(--dim);font-size:14px}}
  .tpl .head i{{display:block;font-style:normal;color:var(--body);font-size:14px;margin-top:6px}}
  .mail{{background:var(--paper);padding:22px 12px}}
  .mail .in{{max-width:600px;margin:0 auto}}
  .note{{background:#fff7e3;border:1px solid #efd9a0;border-left:4px solid var(--gold2);border-radius:10px;padding:13px 16px;margin:0 0 22px;font-size:14.5px}}
  .note b{{color:#8a6420}}
  footer{{background:var(--navy);color:#7e97ae;padding:24px 0;font-size:13px}} footer b{{color:#eaf4ff}}
</style>
</head>
<body>

<header><div class="wrap">
  <div class="mark"><img src="../logo-mark.png" alt=""></div>
  <div class="brand">Ricky Rampersad Branch<i>Guardian Life of the Caribbean</i></div>
</div></header>

<div class="hero"><div class="wrap">
  <div class="eyebrow">The letters going out &middot; as the client receives them</div>
  <h1>One shell, eight openings. <em>Read the one for a client you know.</em></h1>
  <p class="lead">Every client of a representative who has moved on receives one of these, chosen by what they
    hold. Each opens with something the client is glad to hear, carries the film, says what the Insurance Act
    gives them, and offers two doors into a review. Not one word in any of them is about who left.</p>
  <a class="verdict" href="../orphan-transition/team-review.html#verdict">Say send, change, or hold &rarr;</a>
</div></div>

<nav class="toc"><div class="wrap">{nav}</div></nav>

<main><div class="wrap">
  <div class="note"><b>The curly fields</b> &mdash; <code>{{{{first_name}}}}</code>, <code>{{{{years}}}}</code>,
    <code>{{{{agent_first_name}}}}</code> &mdash; are filled per client at send time. Everything else is exactly
    what lands in the inbox. The logo loads from the site, so it shows once the page is live.</div>
  {cards}
</div></main>

<footer><div class="wrap">
  <b>Ricky Rampersad Branch</b> &middot; Guardian Life of the Caribbean &middot; the film is at
  <a href="../vid/" style="color:#8fd8e6">rickyrampersadbranch.com/vid</a>
</div></footer>

<!-- rrb-views -->
<script>
(function(){{var u='RRB_VIEWS_URL';if(u.indexOf('http')!==0)return;try{{
(new Image()).src=u+'?p='+encodeURIComponent(location.pathname)+'&r='+encodeURIComponent((document.referrer||'').slice(0,200))+'&z='+Date.now();
}}catch(e){{}}}})();
</script>
</body>
</html>
"""
TPL.parent.mkdir(parents=True, exist_ok=True)
TPL.write_text(page, encoding='utf-8')
print(f'wrote {TPL} ({len(page)} bytes) — every letter on one page')
