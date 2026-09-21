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
FILM = 'https://rickyrampersadbranch.com/orphan-video?t={{token}}&s={{segment}}'
REVIEW = 'https://donthaveanagent.com/start?t={{token}}'
ASSIGN = 'https://rickyrampersadbranch.com/orphan-video?t={{token}}&s={{segment}}#choose'

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
  send='Nineteen of twenty-one have e-mail.'),
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
        'find it rather than you. You do not need to do anything.',
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
        'realising they owned it.',
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
       'stopped paying years ago and it is irrelevant to them.'),
 'H': dict(
  name='Nothing held',
  subject='Is this still the right address for you?',
  preheader='A short note from the branch that looked after you.',
  headline='A short note from the <em>branch.</em>',
  open=['You were a client of this branch, and our records still carry your details. We are writing to '
        'everyone we have looked after, to make sure we can still reach you, and to leave you with something '
        'worth two minutes of your time.',
        'There is nothing to do and nothing to pay. If the address is wrong, a reply puts it right.'],
  send='Lightest touch. No claim about anything they hold, because they hold nothing. Last to go.'),
}

# ── the shell ─────────────────────────────────────────────────────────
# Inline styles throughout: e-mail clients strip <style> blocks unpredictably.
def shell(seg, cfg):
    open_ps = ''.join(f'<p style="margin:0 0 14px">{p}</p>' for p in cfg['open'])
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
    law_block = '''
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 16px">
<tr><td style="background:#f5fbfd;border-left:3px solid #00CFEA;padding:12px 15px;font:400 13.5px/1.55 Inter,Arial,sans-serif;color:#33465a">
  <b style="display:block;color:#12202e;margin-bottom:4px;font-size:13px">One thing worth knowing</b>
  A life policy cannot be transferred to another company. If anyone suggests you move, what is being proposed is
  that you end this one and buy a new one. Under the Insurance Act they must discuss the advantages <i>and</i> the
  disadvantages with you first &mdash; so ask for it in writing.
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
    <div style="font:400 13.5px/1.5 Inter,Arial,sans-serif;color:#5d7186">Same review, same questions, only somebody walks you through it &mdash; in person or on the phone, whichever you prefer.</div>
  </a>
</td></tr></table>'''
    return f'''<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{html.escape(cfg['subject'])}</title>
<!-- segment {seg} · {html.escape(cfg['name'])} · generated by tools/letters/build-letters.py -->
</head>
<body style="margin:0;padding:0;background:#eef4f7">
<div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:#eef4f7">{html.escape(cfg['preheader'])}</div>
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#eef4f7"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;width:100%;background:#ffffff;border-radius:10px;overflow:hidden">

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
  <p style="margin:0 0 14px">If neither appeals today, that is genuinely fine. Your birthday note and your premium
    reminders carry on either way, and we will ask again rather than assume.</p>
  <p style="margin:18px 0 0;font:400 14.5px/1.5 Inter,Arial,sans-serif;color:#12202e">
    <b style="display:block">Ricky Rampersad</b>Branch Manager &middot; Ricky Rampersad Branch<br>Guardian Life of the Caribbean</p>
</td></tr>

<tr><td style="background:#f4f8fa;padding:13px 24px;border-top:1px solid #e0eaef;font:400 11.5px/1.5 Inter,Arial,sans-serif;color:#64798e">
  Sent because you hold, or held, a policy serviced by this branch. Policy numbers and personal details are
  deliberately kept out of this e-mail. Prefer post or a phone call? Just reply &mdash; it reaches a person
  the same day.
</td></tr>
</table></td></tr></table>
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
