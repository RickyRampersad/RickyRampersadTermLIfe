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
 # ── the three action letters: they come before the waterfall ─────────
 'I': dict(
  name='A premium due for more than sixty days',
  subject='A premium on your policy is showing as due — and the simplest way to pay Guardian Life directly',
  preheader='If you have already paid, tell us and we will put the record right. If not, nothing has been lost yet.',
  headline='A premium is showing as <em>due.</em>',
  open=['Our records show a premium on your policy that has been due for more than sixty days. If you have paid it '
        '&mdash; to the branch, to a representative, or by any other route &mdash; please tell us, because a premium '
        'paid to a representative counts in law as paid to Guardian Life, and we will put the record right against '
        'your receipt. If it has not been paid, nothing has been lost yet: the Insurance Act requires written notice '
        'before a policy can be forfeited, and this letter is the branch making sure you hear from us first.',
        'The simplest thing from here is to pay Guardian Life directly, so that every payment carries Guardian '
        'Life\'s own receipt. Reply to this letter or call the branch and we will set that up with you in one call. '
        'Your representative, {{agent_first_name}}, has moved on from Guardian Life; your policy, your cover and '
        'your beneficiary are unchanged.'],
  send='Goes only after the paid-to date is checked against cash and the deduction file. It never states a figure. '
       'Direct-bill clients first.'),
 'J': dict(
  name='Contract ready, not yet delivered',
  subject='Your policy is in force — and your contract is ready to be delivered',
  preheader='The document itself has not reached you yet. We will bring it.',
  headline='Your policy is in force. Your <em>contract</em> is ready.',
  open=['Your policy has been issued and is in force. The contract document &mdash; the policy itself, with your '
        'schedule and the beneficiary you named &mdash; has not yet been delivered to you. We are putting that '
        'right: the branch will bring it to you, and we will go through it with you when we do, so that you know '
        'exactly what you hold.',
        'Your representative, {{agent_first_name}}, has moved on from Guardian Life. Nothing about your policy '
        'changes. When the contract reaches you, the only signature it needs is the acknowledgement that you '
        'received it; you are not being asked to sign anything else.'],
  send='Built from the contracts-given-to-agent list, not the sheet. Delivered within the week by the receiving '
       'agent, with the acknowledgement letter.'),
 'K': dict(
  name='An application still in progress',
  subject='Your application with Guardian Life — where it stands, and who is finishing it',
  preheader='It has not been forgotten. Here is what is outstanding and who is completing it.',
  headline='Your application is <em>still in progress.</em>',
  open=['You applied for a policy with Guardian Life and the application has not yet been completed. That is ours '
        'to finish, not yours to chase. We are going through every open file this week, and if anything is still '
        'needed from you &mdash; a signature, a medical, a document &mdash; the person who calls will know exactly '
        'what it is, and will bring it to you rather than ask you to find it.',
        'Your representative, {{agent_first_name}}, has moved on from Guardian Life. Your application stays with '
        'Guardian Life and with this branch, and it will be completed by a registered agent of your own. If you '
        'would rather not proceed, say so and we will close it properly; you owe nothing either way.'],
  send='Built from the pending list. Every file is read before the call; the agent brings the outstanding '
       'requirement, never a list of them.'),
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

# ── /templates: the one page for the team ────────────────────────────
# The letters are one shell with eight openings, so an agent needs to read
# one letter in full and the eight openings — not eight letters. This page
# is that, with the film above it and one verdict form beneath it. The
# full set is folded away at the foot for anyone who wants it. Generated
# with the letters so it can never drift from them; who gets which letter
# is said in words, never as a count, because the page is public once
# merged. Run tools/film/chapters.py afterwards to mark the film's chapters.
TPL = ROOT / 'templates' / 'index.html'
CORE = 'F'
WORDS = {8: 'eight', 9: 'nine', 10: 'ten', 11: 'eleven', 12: 'twelve', 13: 'thirteen', 14: 'fourteen'}
NOPEN = WORDS.get(len(SEGMENTS), str(len(SEGMENTS)))
WHO = {'A': 'a client with a policy that has matured', 'B': 'a client whose policy is paid up',
       'C': 'a client carrying a waiver of premium', 'D': 'a client whose premium comes off a payroll',
       'E': 'a client who has held cover for ten years or more', 'F': 'a client with a policy in force',
       'G': 'a client whose policy lapsed', 'H': 'a client with nothing in force and nothing lapsed',
       'I': 'a client whose premium has been due for more than sixty days',
       'J': 'a client whose policy is in force but whose contract has not reached them',
       'K': 'a client whose application is still in progress'}
GLAD = {'A': 'money is waiting to be claimed', 'B': 'they own it outright and may not know what it is worth',
        'C': 'a benefit inside the policy they were probably never told about',
        'D': 'we are checking the deduction so they do not have to', 'E': 'a price nobody can sell them again',
        'F': 'the same cover, the same premium, the same beneficiaries', 'G': 'a policy they wrote off may still hold value',
        'H': 'nothing to do and nothing to pay',
        'I': 'a payment to a representative counts as paid, and the law requires notice before anything is forfeited',
        'J': 'the policy is in force, and the branch is bringing the contract',
        'K': 'the file is being finished for them, not chased'}
openings = ''.join(f"""
  <div class="op" id="{seg}">
    <div class="k"><b>{seg}</b><span>{html.escape(cfg['name'])}</span><em>goes to {WHO[seg]}</em></div>
    <div class="subj">{html.escape(cfg['subject'])}</div>
    <div class="glad">What they are glad to hear: {GLAD[seg]}.</div>
    <div class="ps">{''.join(f'<p>{para}</p>' for para in cfg['open'])}</div>
  </div>""" for seg, cfg in SEGMENTS.items())
full = ''.join(f"""
  <details class="tpl" id="full-{seg}">
    <summary><b>Letter {seg}</b> &middot; {html.escape(cfg['name'])} &mdash; <i>{html.escape(cfg['subject'])}</i></summary>
    <div class="mail"><div class="in">{letter_table(seg, cfg)}</div></div>
  </details>""" for seg, cfg in SEGMENTS.items())
opts = ''.join(f'<option value="{seg}">Letter {seg} &middot; {html.escape(cfg["name"])}</option>' for seg, cfg in SEGMENTS.items())
page = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>What goes out | Ricky Rampersad Branch</title>
<meta name="description" content="The film, the letter, the eight openings, and one question — for the branch, before any client sees it.">
<meta name="robots" content="noindex">
<meta property="og:title" content="What goes out — read it before any client does">
<meta property="og:description" content="One letter, eight openings, one film. Say send, change, or hold.">
<meta property="og:image" content="https://rickyrampersadbranch.com/orphan-video/poster.jpg">
<link rel="icon" href="../logo-mark.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;700;800&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  :root{{--navy:#07131f;--ink:#12202e;--body:#33465a;--dim:#64798e;--gold:#efc24b;--gold2:#c9942c;--teal:#00CFEA;--teal2:#0aa8bf;--tdark:#07606f;
    --paper:#eef4f7;--card:#fff;--line:#d7e3ea;--notebg:#eafaFD;--okbg:#eef7f2;--ok:#1f6f4a;--warnbg:#fff6df;--f:'Plus Jakarta Sans',Inter,system-ui,sans-serif}}
  *{{box-sizing:border-box}}
  html{{scroll-behavior:smooth}}
  body{{margin:0;background:var(--paper);color:var(--body);font:16px/1.65 Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif}}
  .wrap{{width:min(900px,100% - 34px);margin:0 auto}}
  header{{background:var(--navy);color:#eaf4ff;border-bottom:3px solid transparent;border-image:linear-gradient(90deg,var(--gold),var(--teal)) 1}}
  header .wrap{{display:flex;align-items:center;gap:12px;padding:16px 0}}
  .mark{{width:40px;height:40px;border-radius:11px;overflow:hidden;background:#07131f;display:grid;place-items:center;flex:none}}
  .mark img{{width:100%;height:100%;display:block}}
  .brand{{font-family:var(--f);font-weight:800;font-size:15px;letter-spacing:-.2px;line-height:1.25}}
  .brand i{{display:block;font-style:normal;font-weight:500;font-size:11.5px;color:#9dbdd8;letter-spacing:.03em}}
  .hero{{background:radial-gradient(900px 520px at 88% -24%,rgba(0,207,234,.22),transparent 60%),
    radial-gradient(1100px 600px at 8% -18%,rgba(239,194,75,.15),transparent 62%),
    linear-gradient(168deg,#0a2330 0%,var(--navy) 58%,#040d16 100%);color:#eaf4ff;padding:32px 0 40px}}
  .eyebrow{{font-family:var(--f);font-weight:800;font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:var(--gold)}}
  h1{{font-family:var(--f);font-weight:800;font-size:clamp(25px,4.6vw,38px);line-height:1.16;letter-spacing:-.6px;margin:10px 0 10px;color:#fff}}
  h1 em{{font-style:normal;color:var(--gold)}}
  .lead{{color:#9dbdd8;max-width:60ch;margin:0;font-size:16.5px}}
  .steps{{display:grid;gap:8px;margin:18px 0 0;max-width:640px}}
  @media(min-width:640px){{.steps{{grid-template-columns:repeat(3,1fr)}}}}
  .steps a{{display:block;background:rgba(255,255,255,.06);border:1px solid rgba(0,207,234,.3);border-radius:11px;padding:11px 13px;color:#eaf4ff;text-decoration:none;font-size:14px}}
  .steps a b{{display:block;font-family:var(--f);color:var(--teal);font-size:10.5px;letter-spacing:.18em;text-transform:uppercase;margin-bottom:3px}}
  h2{{font-family:var(--f);font-weight:800;font-size:clamp(20px,3vw,26px);color:var(--ink);letter-spacing:-.4px;margin:0 0 6px}}
  .sub{{color:var(--dim);margin:0 0 16px;font-size:15.5px}}
  section.band{{padding:34px 0}}
  section.band.alt{{background:var(--card);border-block:1px solid var(--line)}}
  .vwrap{{--dp-accent:var(--gold);position:relative;margin:0;border-radius:15px;overflow:hidden;background:#000;box-shadow:0 26px 70px rgba(4,13,22,.35);aspect-ratio:16/9}}
  .vwrap video{{width:100%;height:100%;display:block;object-fit:contain;background:#000}}
  .vcover{{position:absolute;inset:0;background-size:cover;background-position:center;display:grid;place-items:center;cursor:pointer;z-index:4}}
  .vcover::after{{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(4,13,22,.34),rgba(4,13,22,.62))}}
  .vcover .pl{{position:relative;z-index:2;display:flex;align-items:center;gap:13px;background:linear-gradient(135deg,var(--teal),var(--teal2));
    color:#fff;border-radius:13px;padding:15px 25px;font-family:var(--f);font-weight:800;font-size:18px;box-shadow:0 20px 48px rgba(0,207,234,.34)}}
  .vcover .pl svg{{width:19px;height:19px}}
  .vnote{{color:var(--dim);font-size:13.5px;margin:10px 0 0;text-align:center}}
  .mail{{background:var(--paper);border:1px solid var(--line);border-radius:14px;padding:22px 12px}}
  .mail .in{{max-width:600px;margin:0 auto}}
  .fields{{background:#fff7e3;border:1px solid #efd9a0;border-left:4px solid var(--gold2);border-radius:10px;padding:11px 15px;margin:0 0 14px;font-size:14px}}
  .fields b{{color:#8a6420}}
  .ops{{display:grid;gap:12px}}
  @media(min-width:720px){{.ops{{grid-template-columns:1fr 1fr}}}}
  .op{{background:var(--card);border:1px solid var(--line);border-top:3px solid var(--teal);border-radius:13px;padding:15px 17px;scroll-margin-top:16px}}
  .op .k{{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}}
  .op .k b{{display:inline-grid;place-items:center;width:28px;height:28px;border-radius:50%;background:linear-gradient(180deg,var(--gold),var(--gold2));color:#07131f;font-family:var(--f);font-weight:900;font-size:14px}}
  .op .k span{{font-family:var(--f);font-weight:800;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--tdark)}}
  .op .k em{{font-style:normal;color:var(--dim);font-size:13px;flex-basis:100%}}
  .op .subj{{font-family:var(--f);font-weight:800;font-size:15.5px;color:var(--ink);margin:8px 0 4px;letter-spacing:-.2px}}
  .op .glad{{font-size:13.5px;color:var(--tdark);font-weight:600;margin:0 0 8px}}
  .op .ps p{{margin:0 0 8px;font-size:14px;color:var(--body);padding-left:12px;border-left:3px solid var(--line)}}
  .op .ps p:last-child{{margin-bottom:0}}
  form{{background:var(--card);border:1px solid var(--line);border-radius:15px;padding:20px 22px}}
  label{{display:block;font-family:var(--f);font-weight:700;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--tdark);margin:12px 0 5px}}
  input[type=text],select,textarea{{width:100%;font:15px/1.5 Inter,system-ui,sans-serif;color:var(--ink);background:#fff;border:1px solid #bfd0da;border-radius:9px;padding:10px 12px}}
  textarea{{min-height:80px;resize:vertical}}
  input:focus,select:focus,textarea:focus{{outline:2px solid var(--teal);border-color:var(--teal)}}
  .row2{{display:grid;gap:0 14px}} @media(min-width:640px){{.row2{{grid-template-columns:1fr 1fr}}}}
  .verdicts{{display:grid;gap:8px}} @media(min-width:640px){{.verdicts{{grid-template-columns:repeat(3,1fr)}}}}
  .verdicts label{{margin:0;display:flex;align-items:center;gap:9px;background:var(--paper);border:1px solid var(--line);border-radius:10px;padding:11px 13px;cursor:pointer;text-transform:none;letter-spacing:0;font-size:14.5px;color:var(--ink)}}
  .verdicts label:has(input:checked){{border-color:var(--teal);background:var(--notebg)}}
  .verdicts input{{width:auto;margin:0}}
  .check{{display:flex;align-items:center;gap:9px;margin-top:14px;font-size:15px;color:var(--ink);text-transform:none;letter-spacing:0;font-family:Inter,system-ui,sans-serif;font-weight:500}}
  .check input{{width:18px;height:18px;margin:0}}
  button{{margin-top:16px;background:linear-gradient(135deg,var(--teal),var(--teal2));color:#fff;border:0;border-radius:11px;padding:13px 22px;font-family:var(--f);font-weight:800;font-size:15.5px;cursor:pointer;box-shadow:0 14px 34px rgba(0,207,234,.26)}}
  .box{{border-radius:10px;padding:13px 16px;margin:14px 0 0;border:1px solid}}
  .box.ok{{background:var(--okbg);border-color:#c8e3d6;border-left:4px solid var(--ok)}} .box.ok b{{color:var(--ok)}}
  .box.warn{{background:var(--warnbg);border-color:#efd9a0;border-left:4px solid var(--gold2);margin:0 0 14px}} .box.warn b{{color:#8a6420}}
  #logged,#unwired{{display:none}}
  details.tpl{{background:var(--card);border:1px solid var(--line);border-radius:12px;margin:0 0 10px;overflow:hidden}}
  details.tpl summary{{padding:13px 17px;cursor:pointer;font-size:15px;color:var(--ink)}} details.tpl summary i{{color:var(--dim);font-style:normal}}
  details.tpl .mail{{border:0;border-top:1px solid var(--line);border-radius:0}}
  .links{{display:grid;gap:10px;margin-top:6px}} @media(min-width:640px){{.links{{grid-template-columns:1fr 1fr}}}}
  .links a{{display:block;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px 16px;text-decoration:none;color:var(--body);font-size:14px}}
  .links a b{{display:block;font-family:var(--f);color:var(--ink);font-size:15px;margin-bottom:3px}}
  footer{{background:var(--navy);color:#7e97ae;padding:22px 0;font-size:13px}} footer b{{color:#eaf4ff}}
</style>
</head>
<body>

<header><div class="wrap">
  <div class="mark"><img src="../logo-mark.png" alt=""></div>
  <div class="brand">Ricky Rampersad Branch<i>Guardian Life of the Caribbean</i></div>
</div></header>

<div class="hero"><div class="wrap">
  <div class="eyebrow">What goes out &middot; read it before any client does</div>
  <h1>One letter. {NOPEN.capitalize()} openings. <em>One film.</em></h1>
  <p class="lead">Every client of a representative who has moved on gets the letter below. Only the opening
    changes, with what they hold. Not one word in any of it is about who left. Watch the film, read the
    letter, skim the {NOPEN} openings, and answer one question at the foot.</p>
  <div class="steps">
    <a href="#film"><b>1 &middot; two minutes</b>The film</a>
    <a href="#letter"><b>2 &middot; three minutes</b>The letter, and the {NOPEN} openings</a>
    <a href="#verdict"><b>3 &middot; one minute</b>Send, change, or hold</a>
  </div>
</div></div>

<section class="band" id="film"><div class="wrap">
  <h2>The film</h2>
  <p class="sub">Under two minutes. It settles the client first, then what they already own, then the law as
    their right, then the agent. Every figure on screen is illustrative.</p>
  <div class="vwrap">
    <video id="filmv" playsinline preload="metadata" poster="../orphan-video/poster.jpg">
      <source src="../orphan-video/rrb-orphan-video.mp4" type="video/mp4">
    </video>
    <div class="vcover" style="background-image:url(../orphan-video/poster.jpg)">
      <div class="pl"><svg viewBox="0 0 24 24" fill="#fff" aria-hidden="true"><path d="M7 4l13 8-13 8z"/></svg>Watch the film</div>
    </div>
  </div>
  <p class="vnote">Sound on. Tap the picture to pause. The client sees it beneath the two doors at
    <a href="../your-policy/">rickyrampersadbranch.com/your-policy</a>.</p>
</div></section>

<section class="band alt" id="letter"><div class="wrap">
  <h2>The letter, in full</h2>
  <p class="sub">This is letter {CORE}, the one most clients receive. Every letter carries the same film block,
    the same note on the Act, the same two doors and the same closing. Only the opening paragraphs differ.</p>
  <div class="fields"><b>The curly fields</b> &mdash; <code>{{{{first_name}}}}</code>, <code>{{{{years}}}}</code>,
    <code>{{{{agent_first_name}}}}</code> &mdash; are filled per client at send time. The logo loads from the
    site once the page is live.</div>
  <div class="mail"><div class="in">{letter_table(CORE, SEGMENTS[CORE])}</div></div>
</div></section>

<section class="band" id="openings"><div class="wrap">
  <h2>The {NOPEN} openings</h2>
  <p class="sub">What changes, and who gets which. Each one leads with the thing the client is glad to hear.</p>
  <div class="ops">{openings}
  </div>
</div></section>

<section class="band alt" id="verdict"><div class="wrap">
  <h2>Your verdict</h2>
  <p class="sub">One question. It lands on the branch sheet under your name, and every &ldquo;change&rdquo; and
    &ldquo;hold&rdquo; gets an answer before the send.</p>
  <div class="box warn" id="unwired"><b>Not recording yet.</b> The sheet is not wired to this page, so send your
    verdict to the branch manager on WhatsApp instead until this notice disappears.</div>
  <form id="fb" autocomplete="on">
    <div class="row2">
      <div><label for="n">Your name</label><input type="text" id="n" name="n" maxlength="60" required placeholder="As it appears on your licence"></div>
      <div><label for="town">Your town, or the towns you cover</label><input type="text" id="town" name="town" maxlength="40" placeholder="Sangre Grande, Chaguanas, Penal &hellip;"></div>
    </div>
    <label>Verdict on the set</label>
    <div class="verdicts">
      <label><input type="radio" name="v" value="send" required> Send it as it is</label>
      <label><input type="radio" name="v" value="change"> Send it, with a change</label>
      <label><input type="radio" name="v" value="hold"> Hold it</label>
    </div>
    <label for="i">If one piece in particular</label>
    <select id="i" name="i"><option value="whole">The whole set</option><option value="film">The film</option>{opts}</select>
    <label for="c">What you would change, or why it should wait</label>
    <textarea id="c" name="c" maxlength="600" placeholder="Quote the line if you can."></textarea>
    <label class="check"><input type="checkbox" id="a" name="a" value="1"> I am taking assignments &mdash; match clients in my town to me</label>
    <button type="submit">Log my verdict</button>
    <div class="box ok" id="logged"><b>Logged, thank you.</b> <span id="loggedtxt"></span></div>
  </form>
</div></section>

<section class="band" id="more"><div class="wrap">
  <h2>If you want the rest</h2>
  <p class="sub">Nothing here is required before you answer. It is where the detail lives.</p>
  <div class="links">
    <a href="../orphan-transition/team-review.html"><b>The team page</b>What the branch has done this year, four things to check, and how we come across on the first call.</a>
    <a href="../orphan-transition/if-they-say.html"><b>If a client says&hellip;</b>What a client may repeat, what is simply true, and the one warm sentence that answers it.</a>
    <a href="../your-policy/protected"><b>How the law protects you</b>The Insurance Act's protections, quoted, as the client reads them.</a>
    <a href="../orphan-transition/"><b>The manual</b>The segments, the feedback loop, the call list and the run sheet.</a>
  </div>
  <h2 style="margin-top:30px">All {NOPEN} letters, in full</h2>
  <p class="sub">Folded away. Open any one to read it as the client will.</p>
  {full}
</div></section>

<footer><div class="wrap">
  <b>Ricky Rampersad Branch</b> &middot; Guardian Life of the Caribbean &middot; internal, not for clients.
</div></footer>

<script src="../orphan-video/player.js"></script>
<script>
/* Verdicts go to the Service Questionnaire backend, action=feedback, and land
   on the Team Feedback tab. Until the placeholder is replaced with the
   deployed /exec URL the page says so, instead of losing them quietly. */
var SVC = 'RRB_SERVICE_URL';
var wired = SVC.indexOf('http') === 0;
if (!wired) document.getElementById('unwired').style.display = 'block';
var form = document.getElementById('fb');
form.addEventListener('submit', function (e) {{
  e.preventDefault();
  var f = new FormData(form);
  var v = f.get('v'), i = f.get('i') || 'whole', n = (f.get('n') || '').trim();
  if (!n || !v) return;
  var url = SVC + '?action=feedback&n=' + encodeURIComponent(n) +
    '&town=' + encodeURIComponent((f.get('town') || '').trim()) +
    '&i=' + encodeURIComponent(i) + '&v=' + encodeURIComponent(v) +
    '&c=' + encodeURIComponent((f.get('c') || '').trim()) +
    '&a=' + (f.get('a') ? '1' : '0') + '&z=' + Date.now();
  if (wired) {{ try {{ (new Image()).src = url; }} catch (err) {{}} }}
  document.getElementById('loggedtxt').textContent = wired
    ? 'Change the piece and log again if you have more to say.'
    : 'Recorded on this screen only — send the same words to the branch manager on WhatsApp.';
  var box = document.getElementById('logged'); box.style.display = 'block';
  box.scrollIntoView({{ behavior: 'smooth', block: 'center' }});
  document.getElementById('c').value = '';
}});
</script>

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
print(f'wrote {TPL} ({len(page)} bytes) — the film, the letter, the {NOPEN} openings, one verdict')
