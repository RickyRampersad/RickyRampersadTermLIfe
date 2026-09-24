#!/usr/bin/env python3
"""Generate the transition letters as sendable e-mail HTML, and the team's page.

One compact shell, one opening per situation. The words live in
openings.json beside this script; the shell lives here. Every letter is: a
headline, one short paragraph, the facts read off the Branch Portfolio sheet
for that client, what the branch team has done for them (their own record,
from service-record.py), the answers they can give with one tap, the film in
one line, and the sign-off. Generated, not hand-typed, so a change to the
shell reaches every letter in one run.

E-mail rules: 600px table, every style inline, the logo a hosted PNG — Gmail
strips SVG and blocks data: URIs, so anything else arrives as an empty box.

Merge fields are {{double_braces}}, filled per client at send time from the
sheet; FIELDS below says which column each one reads. No client data lives
here; the merge file is built outside the repository. No money figure ever
appears: days and dates only.

  python3 build-letters.py     → orphan-transition/letters/*.html, templates/index.html
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
PROTECT = 'https://rickyrampersadbranch.com/your-policy/protected?t={{token}}&s={{segment}}'
# One tap: the answer travels as r= and the page logs it on arrival. The
# 'urgent' tap is logged and then carried straight into the questionnaire,
# so the client states their concerns before anyone is named.
TAP = 'https://rickyrampersadbranch.com/your-policy/?t={{token}}&s={{segment}}&r='

# ── what a letter can read off the sheet ─────────────────────────────
# merge field → where the send-list builder takes it from. A blank field
# drops that fact from the strip; it never prints as an empty cell.
FIELDS = {
 'first_name':       'Client — first name only',
 'agent_first_name': 'Agent — first name only',
 'agent_or_rep':     'Agent — first name only, or "Your representative" when the sheet has none (the subject line)',
 'first_year':       'Issue Date — the year',
 'years':            'Issue Date — whole years held',
 'issue_date':       'Issue Date',
 'paid_to':          'Paid To Date',
 'days':             'Days — days outstanding',
 'projected_lapse':  'Projected Lapse Date',
 'app_received':     'App Received Date',
 'matured_on':       'policy admin — not on the portfolio sheet',
 'maturity_date':    'the intelligence sheet or policy admin — not on the portfolio sheet',
 'token':            'the send list — opaque, never a policy number',
 'segment':          'the send list — the letter\'s own key',
 'svc_docs':         'service-record.py — documents on their policies in the Log Book, checked and sent on by the document team',
 'svc_requests':     'service-record.py — Salesforce service tasks the branch team completed for them',
 'svc_reminders':    'service-record.py — premium reminders sent to them',
 'svc_birthday':     'service-record.py — the month of their last birthday note',
}

# ── the taps a letter can offer ───────────────────────────────────────
TAPS = {
 'urgent':   ('I want an agent now. Let me tell you my concerns first',
              'Fifteen minutes on your phone. We read every word before we name anyone, then match you to the agent who fits your file.'),
 'review':   ('Tell us more about yourself',
              'A short form on what you hold and what matters to you. A person can go through it with you.'),
 'callme':   ('Call me', 'Today or tomorrow, at a time you choose.'),
 'claim':    ('Help me claim it', 'We bring the form and walk it through with you.'),
 'deliver':  ('Bring me my contract', 'By hand, and we go through it with you.'),
 'finish':   ('Finish my application', 'We bring whatever is still needed to you.'),
 'paid':     ('I have already paid', 'We check the record against your receipt and confirm within two working days.'),
 'pay':      ('Set me up to pay Guardian Life directly', 'One call, and every payment from then on carries Guardian Life\'s own receipt.'),
 'stop':     ('I would rather not proceed', 'We close the file properly and confirm that nothing is owed.'),
 'informed': ('All good, keep my details', 'We will ask again rather than assume.'),
 'question': ('My details have changed', 'Reply to this letter with the change and we put it right.'),
}

SEGMENTS = {k: v for k, v in json.loads((HERE / 'openings.json').read_text(encoding='utf-8')).items() if not k.startswith('_')}

# ── two questions, one tap each ───────────────────────────────────────
# Asked for on 24 September: "questions that ... show their agent did not even
# tell them". A letter may never say or suggest that; it may ask what the client
# knows, and an honest "not sure" makes the point on its own. Each answer rides
# an existing tap (so no backend change) with the answer itself in q=, which the
# client page puts in the Page column of Client Responses; a letter lists the
# questions it asks under "questions" in openings.json.
QUESTIONS = {
 # 24 September, after the first staff test: "when click on this it taking too long to open and would
 # like this as a check in the email! It must be easy for a client!" The review form behind "Tell us
 # more about yourself" became these checks, answered in the e-mail itself; the form stays one line
 # away (the letter's "more" line) for a client who wants to write. Each answer is an ordinary tap,
 # so a "could be better" or a change in their life reaches a person as a callme.
 'rating':     ('How have we looked after you so far?',
                [('Very well', 'informed', 'rate_verywell'), ('Well', 'informed', 'rate_well'),
                 ('Could be better', 'callme', 'rate_better')]),
 'life':       ('Has anything changed for you since you took out your policy?',
                [('Yes: family, home or work', 'callme', 'life_changed'), ('No, nothing has changed', 'informed', 'life_same')]),
 'whopays':    ('Do you know who your policy pays today?',
                [('Yes', 'informed', 'whopays_yes'), ('Not sure, check it for me', 'callme', 'whopays_unsure')]),
 'approached': ('Has anyone suggested you cancel, cash in or replace a policy?',
                [('No', 'informed', 'approached_no'), ('Yes, talk to me first', 'urgent', 'approached_yes')]),
}
# asked only on the page a tap opens, where the answer helps the agent who calls
REACH = ('What is the best way to reach you?',
         [('Phone call', 'informed', 'reach_phone'), ('WhatsApp', 'informed', 'reach_whatsapp'), ('E-mail', 'informed', 'reach_email')])
# what the page says the moment a check is answered: what happens next, nothing more
SAID_Q = {
 'rate_verywell':  'Thank you. That is good to hear, and the same team keeps looking after you.',
 'rate_well':      'Thank you. If there is one thing we could do better, the full review below is the place to say it.',
 'rate_better':    'Thank you for telling us. Someone from the branch will call you today or tomorrow to hear what we should do better.',
 'life_changed':   'Thank you. Someone from the branch will call you today or tomorrow to check your cover still fits.',
 'life_same':      'Thank you. Nothing about your policy changes.',
 'whopays_yes':    'Thank you. If who it pays ever needs to change, tell us and we put it right the same week.',
 'whopays_unsure': 'Thank you. We will check who your policy pays and go through it with you by phone, once we have confirmed it is you.',
 'approached_no':  'Thank you. Nothing about your policy changes, and we will ask again rather than assume.',
 'approached_yes': 'Thank you for telling us. Tell us what was suggested. A person reads it and calls you before you decide anything.',
 'reach_phone':    'Noted: we will call you.',
 'reach_whatsapp': 'Noted: we will reach you on WhatsApp.',
 'reach_email':    'Noted: we will write to you by e-mail.',
}
# and for a tap on its own
TAP_SAID = {
 'informed': 'Noted, with thanks. Nothing about your policy changes.',
 'callme':   'Someone from the branch will call you, today or tomorrow, at a time you choose.',
 'urgent':   'We read it before we name anyone, then match you to the agent who fits your file.',
 'review':   'It saves as you go, and a person goes through it with you if you would like one to.',
 'paid':     'We will check the record against your receipt and confirm within two working days.',
 'pay':      'We will call to set up payment to Guardian Life directly, with Guardian Life\'s own receipt every time.',
 'claim':    'We will bring the maturity form and walk it through with you.',
 'deliver':  'We will bring your contract and go through it with you. The only signature it needs is the acknowledgement.',
 'finish':   'We will bring whatever is still needed to finish your application. You do not have to find anything.',
 'stop':     'Understood. We will close the file properly and confirm that nothing is owed.',
 'question': 'Reply to the e-mail this link came from and tell us the question. It reaches us the same day.',
}
# ── who answers ──────────────────────────────────────────────────────
# The receipt a tap earns, the "still on it" note and the page a tap opens
# all say who has the client's answer, so it reads as people, not a queue.
# Decided 24 September 2026: "this should be the Ricky Rampersad Branch
# Client Support team" — the team signs, never an individual (a first draft
# carried a person's name that turned out not to exist). `us` is the phrase
# mid-sentence, `Us` at the start of one, `name` the signature.
CARE = {'name': 'Client Support Team', 'us': 'our Client Support team', 'Us': 'Our Client Support team',
        'line': 'Ricky Rampersad Branch &middot; Guardian Life of the Caribbean'}
# what the receipt promises, in the client's own second person, by tap and by
# quick-check answer; a noted answer (informed) earns no receipt
NEXT = {
 'callme':   'Someone from the branch calls you today or tomorrow, at a time you choose.',
 'urgent':   'We read every word you wrote before we name anyone, then match you to the agent who fits your file.',
 'review':   'A person reads your review, then we match you to the agent who fits your file.',
 'paid':     'We check the record against your receipt and confirm within two working days.',
 'pay':      'We call to set up payment to Guardian Life directly, with Guardian Life\'s own receipt every time.',
 'claim':    'We bring the maturity form and walk it through with you.',
 'deliver':  'We bring your contract and go through it with you. The only signature it needs is the acknowledgement.',
 'finish':   'We bring whatever is still needed to finish your application. You do not have to find anything.',
 'stop':     'We close the file properly and confirm that nothing is owed.',
 'question': 'A person answers your question the same day.',
 'assign':   'We match you to the agent who fits your file, and introduce you.',
 'selfserve': 'Take your time with the review. It saves as you go, and a person reads it the day you send it.',
 'informed': 'Nothing about your policy changes, and we will ask again rather than assume.',
}
NEXT_Q = {
 'rate_better':    'Someone from the branch calls you today or tomorrow to hear what we should do better.',
 'life_changed':   'Someone from the branch calls you today or tomorrow to check your cover still fits your life.',
 'whopays_unsure': 'We check who your policy pays and go through it with you by phone, once we have confirmed it is you.',
 'approached_yes': 'A person reads what was suggested and calls you before you decide anything.',
}
BOX = '&#9744;'   # ☐ — an answer reads as a box to tick, which is what the client is doing


def checks_head(qs):
    return 'Quick checks, one tap each.' if len(qs) > 1 else 'One quick check, one tap.'


MORE_ASK, MORE_LINK = 'Would you rather tell us in your own words?', 'The full review, about five minutes'


def tap(cfg, r):
    """A tap's words on this letter: its own tap_text when it has one, else the
    shared wording. Only the words change; the tap records the same answer."""
    return tuple(cfg.get('tap_text', {}).get(r) or TAPS[r])


for _seg, _cfg in SEGMENTS.items():
    if len(_cfg['open'].split()) >= 45:
        print(f'  ! {_seg}: the opening runs to {len(_cfg["open"].split())} words; the shell is built for under 45')

# ── the shell ─────────────────────────────────────────────────────────
# Inline styles throughout: e-mail clients strip <style> blocks unpredictably.
# The design pass of 24 September 2026 ("polish up the fonts and make it more
# appealing and graphical, a wow template"): a navy hero carrying the headline
# and the brand, the notice in a gold-edged card, the service record as stat
# tiles, the checks as pills, the taps as one navy and one white card, and the
# film as a picture with a play badge. All of it tables, inline styles and
# hosted images, which is what an e-mail can carry; nothing here needs a
# script or a stylesheet to read.
#
# The fonts: the branch face (Plus Jakarta Sans, Inter) where a mail app will
# load it — Apple Mail and iOS Mail honour the <link> in the head — and the
# phone's own face everywhere else: San Francisco, Segoe UI, Roboto. Arial is
# the last resort, not the first, as it was before.
HEAD = "'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"
BODY = "Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"
FONTS = 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@700;800&family=Inter:wght@400;600;700&display=swap'
NAVY, GOLD, GOLD2, TEAL, TDARK = '#07131f', '#efc24b', '#c9942c', '#00CFEA', '#07606f'
INK, BODYC, DIM, LINE = '#12202e', '#33465a', '#5d7186', '#cfe3ea'
# the film card: one picture, rendered by tools/letters/film-card.js from film-card.html
FILM_CARD = 'https://rickyrampersadbranch.com/orphan-video/film-card.jpg'


def facts_block(cfg):
    """The strip of facts. The comment markers are for the sender (Transition.gs):
    a cell whose field is blank for that client is cut out between its
    <!--fact:key--> marks, and the strip goes with the last cell."""
    if not cfg.get('facts'):
        return ''
    cells = ''.join(f"""<!--fact:{val.strip('{}')}--><td style="padding:0 22px 0 0;vertical-align:top">
      <div style="font:700 9.5px/1.2 {HEAD};letter-spacing:.16em;text-transform:uppercase;color:{TDARK}">{label}</div>
      <div style="font:800 16px/1.3 {HEAD};color:{INK};margin-top:4px">{val}</div></td><!--/fact-->""" for label, val in cfg['facts'])
    return f"""
<!--facts--><table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 14px">
<tr><td bgcolor="#f4f8fa" style="background:#f4f8fa;border-radius:12px;padding:13px 18px">
  <table role="presentation" cellpadding="0" cellspacing="0"><tr>{cells}</tr></table>
</td></tr></table><!--/facts-->"""


def taps_block(cfg):
    """The one-thumb answers: the first as a navy card with a gold title, the
    rest white, so the eye lands on the one that matters most on that letter."""
    rows = ''
    for i, r in enumerate(cfg['taps']):
        bg, border, title, text = (NAVY, NAVY, GOLD, '#c6d6e4') if i == 0 else ('#ffffff', LINE, INK, DIM)
        rows += f"""
<tr><td style="padding:0 0 9px">
  <a href="{TAP}{r}" style="display:block;text-decoration:none;background:{bg};border:1.5px solid {border};border-radius:13px;padding:14px 17px">
    <div style="font:800 16px/1.3 {HEAD};color:{title}">{tap(cfg, r)[0]}&nbsp;&rarr;</div>
    <div style="font:400 13px/1.5 {BODY};color:{text};margin-top:3px">{tap(cfg, r)[1]}</div>
  </a>
</td></tr>"""
    # every letter carries the door into the questionnaire, as a card where it
    # is one of the taps and as a single line where it is not
    urgent_line = '' if 'urgent' in cfg['taps'] else f"""
<p style="margin:0 0 14px;font:400 13px/1.5 {BODY};color:{DIM}">Would you rather have an agent of your own?
  <a href="{TAP}urgent" style="color:{TDARK};font-weight:700;text-decoration:none">Tell us your concerns first, and we match you to the one who fits&nbsp;&rarr;</a></p>"""
    return f"""
<p style="margin:4px 0 10px;font:800 15px/1.4 {HEAD};color:{INK}">One tap tells us what you would like. We do the rest.</p>
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 12px">{rows}</table>{urgent_line}"""


def questions_block(cfg):
    """The quick checks: each answer a pill with a box to tick."""
    qs = [QUESTIONS[q] for q in cfg.get('questions', [])]
    if not qs:
        return ''
    link = lambda label, tapkey, ans: (f'<a href="{TAP}{tapkey}&q={ans}" style="display:inline-block;margin:0 8px 8px 0;padding:9px 14px;'
                                       f'border:1.5px solid #b9d6df;border-radius:999px;background:#f7fbfc;color:{TDARK};'
                                       f'font:700 14px/1.2 {BODY};text-decoration:none;white-space:nowrap">{BOX}&nbsp;{label}</a>')
    rows = ''.join(f"""
<tr><td style="padding:0 0 8px;font:600 14.5px/1.45 {BODY};color:{INK}">{q}<div style="margin-top:7px">{''.join(link(*a) for a in answers)}</div></td></tr>""" for q, answers in qs)
    return f"""
<p style="margin:4px 0 10px;font:800 15px/1.4 {HEAD};color:{INK}">{checks_head(qs)}</p>
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 10px">{rows}</table>"""


def more_line(cfg):
    """The full review, one line away, for a client who would rather write."""
    if not cfg.get('more'):
        return ''
    return f"""
<p style="margin:0 0 16px;font:400 13px/1.5 {BODY};color:{DIM}">{MORE_ASK}
  <a href="{TAP}review" style="color:{TDARK};font-weight:700;text-decoration:none">{MORE_LINK}&nbsp;&rarr;</a></p>"""


def act_block(cfg):
    """The Act's own words, on the premium letters, right above the taps."""
    if cfg.get('mode') != 'premium':
        return ''
    return f"""
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 16px">
<tr><td bgcolor="#f3fbfd" style="background:#f3fbfd;border-left:4px solid {TEAL};border-radius:0 12px 12px 0;padding:13px 16px;font:400 13px/1.55 {BODY};color:{BODYC}">
  <b style="display:block;font:800 9.5px/1 {HEAD};letter-spacing:.18em;text-transform:uppercase;color:{TDARK};margin-bottom:7px">The Insurance Act &middot; Trinidad and Tobago</b>
  <span style="display:block;font:700 13.5px/1.5 {HEAD};color:{INK}">&ldquo;{cfg['act']}&rdquo;</span>
  <span style="display:block;margin-top:7px">{cfg['plain']} <a href="{PROTECT}" style="color:{TDARK};font-weight:700;text-decoration:none">Everything else the law gives you&nbsp;&rarr;</a></span>
</td></tr></table>"""


def law_line(cfg):
    """One line on the law, on every other letter, after the film."""
    if cfg.get('mode') == 'premium':
        return ''
    return f"""
<p style="margin:0 0 14px;font:400 13px/1.55 {BODY};color:#64798e">A life policy cannot be transferred. Anyone who suggests a change must
  set out the advantages <i>and</i> the disadvantages for you first, so ask for it in writing.
  <a href="{PROTECT}" style="color:{TDARK};font-weight:700;text-decoration:none">How the law protects you&nbsp;&rarr;</a></p>"""


# ── the service record: what the branch team has done for this client ─
# Asked for on 24 September 2026: the client should see a team that has been
# there since the application, and the proof is in the branch's own records.
# tools/letters/service-record.py fills one count per cell from the Log Book
# and Salesforce, precise links only; a blank or zero cell is cut like a blank
# fact, and the panel goes with its last cell. The panel says what the team did
# and how fast it works, never what anyone else would or would not do. When a
# client has nothing on record, the plain line between the <!--nosvc--> marks
# stands in, and it claims nothing about that client in particular.
# The pace is the Log Book's: in the twelve months to September 2026 three
# documents in four went on to Guardian Life within one working day of reaching
# the branch. Measure it again before changing the words.
SVC_CELLS = {'svc_docs': 'Documents handled', 'svc_requests': 'Requests handled',
             'svc_reminders': 'Premium reminders', 'svc_birthday': 'Last birthday note'}
SVC_HEAD = 'Handled for you by our branch team'
SVC_PACE = ('Every form you send is checked by our document team before it goes to Guardian Life, most within a working day. '
            'The same team keeps your file today.')
SVC_NONE = ('Your file is kept by our branch team. Every form you send is checked by our document team before it goes to '
            'Guardian Life, most within a working day, and a person answers when you call.')


def svc_keys(cfg):
    """The cells a letter shows. The premium and lapsed letters leave the reminders out: a count of
    reminders beside a premium still unpaid reads as a reproach, whatever it means."""
    return cfg.get('service', list(SVC_CELLS))


def service_block(cfg, preview=False):
    """The stat tiles. preview: the team's page shows the panel alone, not the line that stands in for it."""
    cells = ''.join(f"""<!--fact:{k}--><td style="padding:0 18px 0 0;vertical-align:top">
      <div style="font:800 21px/1.1 {HEAD};color:{INK};letter-spacing:-.3px">{{{{{k}}}}}</div>
      <div style="font:700 9.5px/1.3 {HEAD};letter-spacing:.12em;text-transform:uppercase;color:#8a6420;margin-top:5px">{SVC_CELLS[k]}</div></td><!--/fact-->""" for k in svc_keys(cfg))
    return f"""
<!--facts--><!--svcpanel--><table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 16px">
<tr><td bgcolor="#fff8e6" style="background:#fff8e6;border:1px solid #f0dca6;border-radius:14px;padding:14px 18px 13px">
  <table role="presentation" cellpadding="0" cellspacing="0"><tr>
    <td style="width:22px;padding-right:8px"><img src="{LOGO}" width="22" height="22" alt="" style="display:block;border-radius:5px"></td>
    <td style="font:800 13.5px/1.3 {HEAD};color:{INK}">{SVC_HEAD}</td></tr></table>
  <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:11px"><tr>{cells}</tr></table>
  <div style="font:400 12.5px/1.5 {BODY};color:{DIM};margin-top:11px;padding-top:9px;border-top:1px solid #f0dca6">{SVC_PACE}</div>
</td></tr></table><!--/facts-->""" + ('' if preview else f"""<!--nosvc-->
<p style="margin:0 0 16px;font:400 13.5px/1.55 {BODY};color:{BODYC}">{SVC_NONE}</p><!--/nosvc-->""")


# The film, as a picture with a play badge and a navy caption bar. The picture
# is the one hosted image besides the logo; when a mail app holds images back,
# the caption still carries the link and the alt text says what it is.
FILM_LINE = f"""
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 16px">
<tr><td style="line-height:0;border-radius:14px 14px 0 0;overflow:hidden"><a href="{FILM}" style="display:block;line-height:0">
  <img src="{FILM_CARD}" width="556" alt="The film: two minutes on what carries on either way, and what is already inside your policy" style="display:block;width:100%;max-width:556px;height:auto;border:0;border-radius:14px 14px 0 0"></a></td></tr>
<tr><td bgcolor="{NAVY}" style="background:{NAVY};padding:11px 16px;border-radius:0 0 14px 14px"><a href="{FILM}" style="text-decoration:none;font:700 13.5px/1.45 {BODY};color:#eaf4ff">
  <span style="color:{GOLD}">&#9654;</span>&nbsp; Watch: two minutes on what carries on either way, and what is already inside your policy&nbsp;<span style="color:{GOLD}">&rarr;</span></a></td></tr>
</table>"""


def letter_table(seg, cfg, preview=False):
    """The 600px table: the e-mail's body, and what /templates shows."""
    # The notice is the official word that the representative has moved on, and
    # the reason the letter exists. It is the second thing the client reads,
    # once, in the same words on every letter, in a gold-edged card so it is
    # not missed; the film's own line answers it: the policy has not.
    # The name sits between <!--agent--> marks so the sender can drop it when the
    # row carries none: "Your representative has moved on" still reads.
    notice = f"""<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 16px"><tr>
    <td bgcolor="#f4f8fa" style="background:#f4f8fa;border-left:4px solid {GOLD};border-radius:0 12px 12px 0;padding:12px 16px;font:400 15px/1.55 {BODY};color:{BODYC}">
    <b style="color:{INK}">Your representative<!--agent-->, {{{{agent_first_name}}}},<!--/agent--> has moved on from Guardian Life.</b>
    {cfg.get('notice_tail', 'Your policy has not.')}</td></tr></table>"""
    headline = cfg['headline'].replace('<em>', f'<span style="color:{GOLD}">').replace('</em>', '</span>')
    # The branch, not the manager's name: the objective is to reassign every
    # client urgently, so the closing says the match is already under way.
    closing = f"""<p style="margin:0 0 6px;font:400 14.5px/1.6 {BODY};color:{BODYC}">Your policy is looked after by the branch. Whatever you tell us is
    read by a person first, and then we match you to the agent who fits your file.</p>"""
    return f"""<table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden">

<tr><td bgcolor="{NAVY}" class="hero" style="background:{NAVY};background-image:linear-gradient(150deg,#0c2434 0%,{NAVY} 55%,#040d16 100%);padding:20px 26px 22px;border-bottom:3px solid {GOLD}">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr>
    <td style="width:38px;padding-right:11px"><img src="{LOGO}" width="38" height="38" alt="" style="display:block;border-radius:9px"></td>
    <td style="font:800 14.5px/1.25 {HEAD};color:#eaf4ff">Ricky Rampersad Branch<br>
      <span style="font:500 11px/1.3 {BODY};color:#8fd8e6;letter-spacing:.02em">Guardian Life of the Caribbean</span></td>
  </tr></table>
  <h1 class="h1" style="font:800 27px/1.2 {HEAD};color:#ffffff;margin:22px 0 8px;letter-spacing:-.5px">{headline}</h1>
  <p style="margin:0;font:400 14px/1.5 {BODY};color:#9dbdd8">{cfg['preheader']}</p>
</td></tr>

<tr><td class="pad" style="padding:24px 26px 8px;font:400 15.5px/1.6 {BODY};color:{BODYC}">
  <p style="margin:0 0 12px">Dear {{{{first_name}}}},</p>
  {notice}
  <p style="margin:0 0 16px">{cfg['open']}</p>
  {facts_block(cfg)}
  {service_block(cfg, preview)}
  {act_block(cfg)}
  {(questions_block(cfg) + taps_block(cfg)) if 'rating' in cfg.get('questions', []) else (taps_block(cfg) + questions_block(cfg))}
  {more_line(cfg)}
  {FILM_LINE}
  {law_line(cfg)}
  {closing}
  <table role="presentation" cellpadding="0" cellspacing="0" style="margin:16px 0 4px"><tr>
    <td style="border-left:3px solid {GOLD};padding:2px 0 2px 12px;font:400 13.5px/1.5 {BODY};color:{DIM}">
      <b style="display:block;font:800 15.5px/1.3 {HEAD};color:{INK}">Ricky Rampersad</b>Branch Manager &middot; Ricky Rampersad Branch<br>Guardian Life of the Caribbean</td></tr></table>
</td></tr>

<tr><td bgcolor="#f4f8fa" class="pad" style="background:#f4f8fa;padding:12px 26px;border-top:1px solid #e0eaef;font:400 11.5px/1.55 {BODY};color:#64798e">
  Sent because you hold, or held, a policy serviced by this branch. Policy numbers and personal details are
  deliberately kept out of this e-mail. Prefer post or a phone call? Just reply. It reaches a person the same day.
</td></tr>
</table>"""


def shell(seg, cfg):
    """The e-mail document: preheader, grey ground, the letter table centred."""
    return f'''<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">
<title>{html.escape(cfg['subject'])}</title>
<!-- segment {seg} · {html.escape(cfg['name'])} · generated by tools/letters/build-letters.py from openings.json -->
<link href="{FONTS}" rel="stylesheet">
<style>
  @media only screen and (max-width:480px) {{
    .h1 {{ font-size:23px !important; }}
    .hero, .pad {{ padding-left:18px !important; padding-right:18px !important; }}
  }}
</style>
</head>
<body style="margin:0;padding:0;background:#eef4f7">
<div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:#eef4f7">{html.escape(cfg['preheader'])}</div>
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#eef4f7"><tr><td align="center" style="padding:24px 12px">
{letter_table(seg, cfg)}
</td></tr></table>
</body></html>
'''


manifest = {'fields': FIELDS, 'taps': {k: v[0] for k, v in TAPS.items()}, 'letters': []}
for seg, cfg in SEGMENTS.items():
    path = OUT / f'{seg}.html'
    path.write_text(shell(seg, cfg), encoding='utf-8')
    manifest['letters'].append({'segment': seg, 'name': cfg['name'], 'subject': cfg['subject'], 'preheader': cfg['preheader'],
                                'file': path.name, 'facts': [v.strip('{}') for _, v in cfg.get('facts', [])],
                                'service': svc_keys(cfg),
                                'taps': cfg['taps'], 'tap_labels': {r: tap(cfg, r)[0] for r in cfg['taps']},
                                'send_note': cfg['send']})
    print(f'  {seg:<3} {cfg["name"]:<38} → {path.name}')
(OUT / 'manifest.json').write_text(json.dumps(manifest, indent=1), encoding='utf-8')
print(f'wrote {len(manifest["letters"])} letters + manifest.json to {OUT}')


# ── the plain letters: the same words, for the Microsoft 365 connector ─
# The connector that sends as support@ accepts p, br, a[href], b/strong, i/em,
# lists, headings, tables, hr and div, and nothing else: no images, no style=,
# no span. So the logo and the colours cannot travel that way, and these carry
# the letter's words, facts, taps and links in those tags only (24 September
# 2026, when the Entra app for the branded send was not yet set up). Same
# fact and agent markers as the branded letters, so tools/letters/fill-plain.py
# fills them exactly as Transition.gs fills the others.
PLAIN = OUT / 'plain'
PLAIN.mkdir(exist_ok=True)


def plain_questions(cfg):
    qs = [QUESTIONS[q] for q in cfg.get('questions', [])]
    if not qs:
        return ''
    items = ''.join(f'<li><b>{q}</b><br>' + ' &nbsp; '.join(f'<a href="{TAP}{t}&q={a}">{BOX}&nbsp;{label}</a>' for label, t, a in answers) + '</li>'
                    for q, answers in qs)
    return f'<h3>{checks_head(qs)}</h3><ul>{items}</ul>'


# Lists, not tables: the connector allows no cellpadding or style, so a table's
# cells run together ("Held since Paid to") in every mail app. A list reads
# cleanly on a phone and cuts cleanly, one item per fact.
def plain_service(cfg):
    items = ''.join(f'<!--fact:{k}--><li>{SVC_CELLS[k]}: <b>{{{{{k}}}}}</b></li><!--/fact-->' for k in svc_keys(cfg))
    return (f'<!--facts--><!--svcpanel--><h3>{SVC_HEAD}</h3><ul>{items}</ul><p><i>{SVC_PACE}</i></p><!--/facts-->'
            f'<!--nosvc--><p>{SVC_NONE}</p><!--/nosvc-->')


def plain_letter(seg, cfg):
    facts = ''
    if cfg.get('facts'):
        items = ''.join(f'<!--fact:{v.strip("{}")}--><li>{label}: <b>{v}</b></li><!--/fact-->' for label, v in cfg['facts'])
        facts = f'<!--facts--><ul>{items}</ul><!--/facts-->'
    facts += plain_service(cfg)
    act = (f'<h3>The Insurance Act &middot; Trinidad and Tobago</h3><p><i>&ldquo;{cfg["act"]}&rdquo;</i><br>{cfg["plain"]} '
           f'<a href="{PROTECT}">Everything else the law gives you&nbsp;&rarr;</a></p>') if cfg.get('mode') == 'premium' else ''
    taps = ''.join(f'<li><a href="{TAP}{r}"><b>{tap(cfg, r)[0]}&nbsp;&rarr;</b></a><br>{tap(cfg, r)[1]}</li>' for r in cfg['taps'])
    urgent = '' if 'urgent' in cfg['taps'] else (f'<p>Would you rather have an agent of your own? <a href="{TAP}urgent"><b>Tell us your '
                                                 f'concerns first, and we match you to the one who fits&nbsp;&rarr;</b></a></p>')
    tapsblock = f'<h3>One tap tells us what you would like. We do the rest.</h3><ul>{taps}</ul>{urgent}'
    law = '' if cfg.get('mode') == 'premium' else (f'<p>A life policy cannot be transferred. Anyone who suggests a change must set out the '
                                                   f'advantages <i>and</i> the disadvantages for you first, so ask for it in writing. '
                                                   f'<a href="{PROTECT}">How the law protects you&nbsp;&rarr;</a></p>')
    return (f'<p><b>Ricky Rampersad Branch</b><br>Guardian Life of the Caribbean</p><hr>'
            f'<h2>{cfg["headline"]}</h2>'
            f'<p>Dear {{{{first_name}}}},</p>'
            f'<p><b>Your representative<!--agent-->, {{{{agent_first_name}}}},<!--/agent--> has moved on from Guardian Life.</b> '
            f'{cfg.get("notice_tail", "Your policy has not.")}</p>'
            f'<p>{cfg["open"]}</p>{facts}{act}'
            + (plain_questions(cfg) + tapsblock if 'rating' in cfg.get('questions', []) else tapsblock + plain_questions(cfg))
            + (f'<p>{MORE_ASK} <a href="{TAP}review">{MORE_LINK}&nbsp;&rarr;</a></p>' if cfg.get('more') else '') +
            f'<p><a href="{FILM}">&#9654;&nbsp; Two minutes on what carries on either way, and what is already inside your policy&nbsp;&rarr;</a></p>'
            f'{law}'
            f'<p>Your policy is looked after by the branch. Whatever you tell us is read by a person first, and then we match you '
            f'to the agent who fits your file.</p>'
            f'<p><b>Ricky Rampersad</b><br>Branch Manager &middot; Ricky Rampersad Branch<br>Guardian Life of the Caribbean</p><hr>'
            f'<p><i>Sent because you hold, or held, a policy serviced by this branch. Policy numbers and personal details are '
            f'deliberately kept out of this e-mail. Prefer post or a phone call? Just reply. It reaches a person the same day.</i></p>\n')


for seg, cfg in SEGMENTS.items():
    (PLAIN / f'{seg}.html').write_text(plain_letter(seg, cfg), encoding='utf-8')
print(f'wrote {len(SEGMENTS)} plain letters to {PLAIN}')

# ── /templates: the one page for the team ────────────────────────────
# One letter in full, every opening, the film above, one verdict form
# beneath, the full set folded away. Generated with the letters so it can
# never drift from them; who gets which letter is said in words, never as a
# count, because the page is public once merged. Run tools/film/chapters.py
# afterwards to mark the film's chapters.
TPL = ROOT / 'templates' / 'index.html'
CORE = 'F1'   # the in-force version most clients on the nine books receive
WORDS = {4: 'four', 5: 'five', 6: 'six', 7: 'seven', 8: 'eight', 9: 'nine', 10: 'ten', 11: 'eleven', 12: 'twelve'}
NOPEN = WORDS.get(len(SEGMENTS), str(len(SEGMENTS)))
WHO = {'A': 'a client with a policy that has matured, or matures within six months',
       'F1': 'a client in force whose longest-held policy is under two years old',
       'F2': 'a client in force whose longest-held policy is two to three years old',
       'F3': 'a client in force whose longest-held policy is three to five years old',
       'F4': 'a client in force whose longest-held policy is five to ten years old',
       'F5': 'a client in force whose longest-held policy is ten years old or more',
       'R1': 'a client in force with a policy that lapsed or was surrendered close to the start of another, the newest such start in the last three years',
       'R2': 'a client in force with a policy that lapsed or was surrendered close to the start of another, more than three years ago',
       'G': 'a client whose policy lapsed',
       'I': 'a client with a premium due more than sixty days, by the Days column',
       'J': 'a client whose policy is in force but whose contract has not reached them',
       'K': 'a client whose application is still in progress'}
GLAD = {'A': 'the money is theirs, and it will reach them on time',
        'F1': 'their new policy is unchanged, and someone is looking after it from the start',
        'F2': 'nothing has changed, and it is a good moment to check the cover still fits their life',
        'F3': 'everything the policy has built over those years is still theirs',
        'F4': 'every year of cover still counts, and nothing is lost',
        'F5': 'more than a decade of cover is still theirs, and their view is the one that matters most',
        'R1': 'someone will check, free, that the fresh start cost them nothing it did not have to, and who the policy pays',
        'R2': 'their years with Guardian Life are recognised, and someone will check what carried over and who the policy pays',
        'G': 'a policy they wrote off may still hold value',
        'I': 'nothing is lost, a payment to a representative counts as paid, and nothing can be forfeited without notice',
        'J': 'the policy is in force, and the branch is bringing the contract',
        'K': 'the file is being finished for them, not chased'}
openings = ''.join(f"""
  <div class="op" id="{seg}">
    <div class="k"><b>{seg}</b><span>{html.escape(cfg['name'])}</span><em>goes to {WHO[seg]}</em></div>
    <div class="subj">{html.escape(cfg['subject'].replace('{{agent_or_rep}}', '[Agent’s first name]'))}</div>
    <div class="glad">What they are glad to hear: {GLAD[seg]}.</div>
    <div class="ps"><p>{cfg['open']}</p></div>
    <div class="facts">{'Reads off the sheet: ' + ', '.join(l.lower() for l, _ in cfg['facts']) + '.' if cfg.get('facts') else 'Reads nothing off the sheet.'}</div>
    <div class="taps">Taps: {' &middot; '.join(tap(cfg, r)[0] for r in cfg['taps'])}{(' &middot; Asks: ' + ' / '.join(QUESTIONS[q][0] for q in cfg.get('questions', []))) if cfg.get('questions') else ''}</div>
    <a class="more" href="#full-{seg}">Read letter {seg} in full &rarr;</a>
  </div>""" for seg, cfg in SEGMENTS.items())
full = ''.join(f"""
  <details class="tpl" id="full-{seg}">
    <summary><b>Letter {seg}</b> &middot; {html.escape(cfg['name'])} &mdash; <i>{html.escape(cfg['subject'].replace('{{agent_or_rep}}', '[Agent’s first name]'))}</i></summary>
    <div class="mail"><div class="in">{letter_table(seg, cfg, True)}</div></div>
  </details>""" for seg, cfg in SEGMENTS.items())
opts = ''.join(f'<option value="{seg}">Letter {seg} &middot; {html.escape(cfg["name"])}</option>' for seg, cfg in SEGMENTS.items())
fieldlist = ', '.join(f'<code>{{{{{k}}}}}</code>' for k in ('first_name', 'first_year', 'issue_date', 'paid_to', 'days', 'projected_lapse', 'agent_first_name'))
svclist = ', '.join(f'<code>{{{{{k}}}}}</code>' for k in SVC_CELLS)
page = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>What goes out | Ricky Rampersad Branch</title>
<meta name="description" content="The film, the letter, the openings, and one question — for the branch, before any client sees it.">
<meta name="robots" content="noindex">
<meta property="og:title" content="What goes out — read it before any client does">
<meta property="og:description" content="One letter, {NOPEN} openings, one film. Say send, change, or hold.">
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
  .op .k b{{display:inline-grid;place-items:center;min-width:28px;height:28px;padding:0 7px;border-radius:14px;background:linear-gradient(180deg,var(--gold),var(--gold2));color:#07131f;font-family:var(--f);font-weight:900;font-size:13px}}
  .op .k span{{font-family:var(--f);font-weight:800;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--tdark)}}
  .op .k em{{font-style:normal;color:var(--dim);font-size:13px;flex-basis:100%}}
  .op .subj{{font-family:var(--f);font-weight:800;font-size:15.5px;color:var(--ink);margin:8px 0 4px;letter-spacing:-.2px}}
  .op .glad{{font-size:13.5px;color:var(--tdark);font-weight:600;margin:0 0 8px}}
  .op .ps p{{margin:0 0 8px;font-size:14px;color:var(--body);padding-left:12px;border-left:3px solid var(--line)}}
  .op .facts,.op .taps{{font-size:12.5px;color:var(--dim);margin-top:5px}}
  .op .more{{display:inline-block;margin-top:9px;font-family:var(--f);font-weight:800;font-size:13px;color:var(--tdark);text-decoration:none}}
  details.tpl{{scroll-margin-top:14px}}
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
    changes, with what they hold, and the facts in it are read off the sheet for that client. Every letter
    ends in taps they can answer with one thumb. Not one word in any of it is about who left.</p>
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
  <p class="sub">This is letter {CORE}, the one most clients receive. Every letter has the same shape: a
    headline, the notice that the representative has moved on, one paragraph, the facts off the sheet, what
    the branch team has done for them, the taps, the film in one line, and the sign-off. Only the opening, the
    facts and the taps differ.</p>
  <div class="fields"><b>The curly fields</b> &mdash; {fieldlist} &mdash; are filled per client at send time
    from the Branch Portfolio sheet. Days and dates only, never a figure. A blank field drops its fact from the
    strip. <b>The gold panel</b> &mdash; {svclist} &mdash; is the client's own record with the branch team, from
    the Log Book and Salesforce: a blank or zero drops its cell, and a client with nothing on record reads one
    line about the team instead. The logo loads from the site once the page is live.</div>
  <div class="mail"><div class="in">{letter_table(CORE, SEGMENTS[CORE], True)}</div></div>
</div></section>

<section class="band" id="openings"><div class="wrap">
  <h2>The {NOPEN} openings</h2>
  <p class="sub">What changes, who gets which, what each reads off the sheet, and the taps it offers. Each leads
    with the thing the client is glad to hear.</p>
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
/* "Read letter X in full" unfolds that letter before scrolling to it */
function unfold() {{
  var h = location.hash || '';
  if (h.indexOf('#full-') !== 0) return;
  var d = document.getElementById(h.slice(1));
  if (d && d.tagName === 'DETAILS') {{ d.open = true; d.scrollIntoView({{ behavior: 'smooth', block: 'start' }}); }}
}}
window.addEventListener('hashchange', unfold); unfold();
/* Verdicts go to the Service Questionnaire backend, action=feedback, and land
   on the Team Feedback tab. Until the placeholder is replaced with the
   deployed /exec URL the page says so, instead of losing them quietly. */
var SVC = 'https://script.google.com/macros/s/AKfycbxdW5mVcK6DZbq4qnCj1l1cJvjsTYWZ9UMH91H6yC_NrElNYpGd1vRyJH1W_1mcu61woQ/exec';
/* wired = the deployed backend knows the campaign actions. Only the
   version carrying resp/feedback answers the ping with campaign:2, so
   the notice stays up until a New version is published, then clears. */
var wired = false;
var unwiredBox = document.getElementById('unwired');
unwiredBox.style.display = 'block';
fetch(SVC + '?action=ping&z=' + Date.now()).then(function (r) {{ return r.json(); }})
  .then(function (j) {{ if (j && j.campaign) {{ wired = true; unwiredBox.style.display = 'none'; }} }})
  .catch(function () {{}});
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


# ── the letter cards on the manual and the team page ─────────────────
# Both pages list the letters by subject. Hand-typed, they drift the first
# time a subject changes; so the generator rewrites the block between the
# markers, and the merge-field table on the manual with it.
def splice(rel, tag, body):
    p = ROOT / rel
    src = p.read_text(encoding='utf-8')
    a, b = f'<!-- {tag}:start -->', f'<!-- {tag}:end -->'
    i, j = src.find(a), src.find(b)
    if i < 0 or j < 0 or j < i:
        print(f'  ! {rel}: no {tag} markers, left alone'); return
    out = src[:i + len(a)] + '\n' + body + '  ' + src[j:]
    if out != src:
        p.write_text(out, encoding='utf-8'); print(f'  {rel}: {tag} block rewritten')


def card(seg, cfg, note, blank):
    tgt = ' target="_blank"' if blank else ''
    return (f'    <a class="letter" href="letters/{seg}.html"{tgt}><div class="s">{seg} &middot; {html.escape(cfg["name"])}</div>'
            f'<b>{html.escape(cfg["subject"].replace("{{agent_or_rep}}", "[Agent’s first name]"))}</b><span>{html.escape(note)}</span></a>\n')


splice('orphan-transition/index.html', 'letters',
       ''.join(card(seg, cfg, cfg['send'], False) for seg, cfg in SEGMENTS.items()))
splice('orphan-transition/index.html', 'fields',
       ''.join(f'    <tr><td><code>{{{{{k}}}}}</code></td><td>{html.escape(v)}</td></tr>\n' for k, v in FIELDS.items()))
splice('orphan-transition/team-review.html', 'letters',
       ''.join(card(seg, cfg, f'What they are glad to hear: {GLAD[seg]}.', True) for seg, cfg in SEGMENTS.items()))


# ── the page a tap opens: /your-policy/ ──────────────────────────────
# Records the answer at once and offers the letter's other checks, one tap
# each. Its questions, and what it says after each answer, are written here
# from the same QUESTIONS the letters use, so the page and the e-mails cannot
# disagree about what was asked.
def landing_checks():
    data = {'questions': {**{k: [q, [list(a) for a in ans]] for k, (q, ans) in QUESTIONS.items()},
                          'reach': [REACH[0], [list(a) for a in REACH[1]]]},
            'segments': {**{seg: cfg.get('questions', []) for seg, cfg in SEGMENTS.items()}, '_': ['approached']},
            'said': SAID_Q, 'tap_said': TAP_SAID, 'care': CARE,
            # the receipt is automatic only on the Apps Script route; set False if the letters go by hand
            'receipts': True, 'receipt_line': 'A copy of everything you have told us is on its way to your inbox.'}
    missing = [a[2] for _, ans in list(QUESTIONS.values()) + [REACH] for a in ans if a[2] not in SAID_Q]
    assert not missing, f'no thank-you line for {missing}'
    return json.dumps(data, ensure_ascii=False)


LANDING = ROOT / 'your-policy' / 'index.html'
_src = LANDING.read_text(encoding='utf-8')
_a, _b = '/* checks:start', '/* checks:end */'
_i, _j = _src.find(_a), _src.find(_b)
if _i < 0 or _j < _i:
    print('  ! your-policy/index.html: no checks markers, left alone')
else:
    _line_end = _src.index('\n', _i)
    _out = _src[:_line_end + 1] + f'var CHECKS = {landing_checks()};\n' + _src[_j:]
    if _out != _src:
        LANDING.write_text(_out, encoding='utf-8'); print('  your-policy/index.html: checks rewritten')


# ── the receipt: what a response earns in the inbox ───────────────────
# Sent by Transition.gs (transitionReceipts, every five minutes) a few
# minutes after a client's last tap, from support@ with the branch copied:
# one e-mail that recaps everything they told us — every quick check, the
# tap they chose and, if they filled the review, their concerns in their
# own words — then what happens next and how we follow through. Asked for
# on 24 September 2026 ("recap the concerns and a bit more … Thank you,
# client name, we have received your response … a wow experience, and
# follow through"). The words are here; receipt.json carries them to the
# script, which holds none of its own. Fields: {{first_name}}, {{time}}
# (the last tap, sheet time), {{care_*}}; the built blocks arrive as
# [[recap]], [[concerns]], [[next]] and [[follow]], unescaped, and the
# <!--recap--> and <!--concerns--> blocks are cut when empty. The plain
# one is for a receipt sent by hand through the connector.
RECEIPT_SUBJECT = 'Thank you, {{first_name}}. We have received your response.'
RECEIPT_OPEN = 'We have received your response. It reached us at {{time}}, and it is with {{care_us}} now: a person, not a queue.'
RECEIPT_REPLY = 'Reply to this e-mail at any time. It reaches {{care_us}} directly.'
RECEIPT_HEADS = {'recap': 'What you told us', 'concerns': 'Your concerns, in your words',
                 'next': 'What happens next', 'follow': 'How we follow through'}
FOLLOW = [
 'A person reads this, not a system. Your file is read before anyone is matched to you.',
 'If you asked for a call, it comes today or tomorrow, at the time you chose.',
 'Once your file has been read, we introduce the agent who fits it, in writing, with a name and a number.',
 'If we are slower than we should be, we tell you so rather than leave you wondering.',
]
STILL = {'subject': 'Still on it, {{first_name}}.',
         'line': 'You have not been forgotten, and {{care_us}} is still on it. {{next}} We will ask again rather than assume, '
                 'and you are welcome to reply here at any time.'}
# the recap: a quick-check answer is echoed with its question; a bare tap with the words the client tapped
RECAP = {'tapped': 'You tapped',
         'q': {ans: [q, label] for q, answers in list(QUESTIONS.values()) + [REACH] for label, _, ans in answers},
         'taps': {**{r: v[0] for r, v in TAPS.items()}, 'review': 'The full review, in your own words',
                  'selfserve': 'The full review, in your own words', 'assign': 'Match me to an agent'},
         'tap_text': {seg: {r: v[0] for r, v in cfg.get('tap_text', {}).items()} for seg, cfg in SEGMENTS.items() if cfg.get('tap_text')}}
# the review's own questions the receipt echoes, as the sheet heads its columns (the label, cut at 120)
REVIEW_RECAP = [
 'What happened to the agent who sold you this?',
 'Has anyone been in touch with you about moving or replacing this policy?',
 'Who was it?',
 'Would you like us to go through it with you before you decide anything?',
 'When did somebody last review this policy with you?',
 'How well do you feel you understand what you own?',
 'Do you know what your policy would pay, and to whom?',
 'When you have asked about this policy, were you happy with the answer you got?',
 'What were you not given a straight answer on?',
 'Are you still paying premiums on it?',
 'What happened with the premiums?',
 'Is there anything outstanding that was never sorted out?',
 'Tell us what happened',
 'How urgent is it?',
 "Anything you'd like to say about how you've been treated?",
 'What would you like help with?',
 'Is there something specific you want to ask?',
 'How often would you like your agent to check in with you?',
 'How would you like to be looked after?',
 'What matters most to you in an agent?',
 'Anything else your ideal agent should know about you?',
]
RECEIPT_TPL = {
 'items': '<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-top:4px">{items}</table>',
 'item': f'<tr><td style="padding:8px 0 7px;border-top:1px solid #e0eaef;font:400 13px/1.45 {BODY};color:{DIM}">{{q}}'
         f'<div style="font:700 15px/1.4 {HEAD};color:{INK};margin-top:2px">{{a}}</div></td></tr>',
 'quote': f'<p style="margin:0 0 11px;font:400 14.5px/1.55 {BODY};color:{INK}"><span style="display:block;font:400 12.5px/1.4 {BODY};color:{DIM};margin-bottom:2px">{{q}}</span>&ldquo;{{a}}&rdquo;</p>',
 'bullets': '<table role="presentation" cellpadding="0" cellspacing="0" width="100%">{items}</table>',
 'bullet': f'<tr><td style="padding:3px 0;font:400 14.5px/1.55 {BODY};color:{INK}"><span style="color:{GOLD2};font-weight:800">&#9656;</span>&nbsp; {{a}}</td></tr>',
 'bullets_dark': '<table role="presentation" cellpadding="0" cellspacing="0" width="100%">{items}</table>',
 'bullet_dark': f'<tr><td style="padding:4px 0;font:400 14px/1.55 {BODY};color:#dbe7f1"><span style="color:{GOLD};font-weight:800">&#9656;</span>&nbsp; {{a}}</td></tr>',
}
RECEIPT_TPL_PLAIN = {'items': '<ul>{items}</ul>', 'item': '<li>{q}<br><b>{a}</b></li>', 'quote': '<p>{q}<br><i>&ldquo;{a}&rdquo;</i></p>',
                     'bullets': '<ul>{items}</ul>', 'bullet': '<li>{a}</li>', 'bullets_dark': '<ul>{items}</ul>', 'bullet_dark': '<li>{a}</li>'}


def receipt_card(bg, border, eyebrow_colour, head, body, dark=False):
    return f"""<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 14px"><tr>
    <td bgcolor="{bg}" style="background:{bg};border-left:4px solid {border};border-radius:0 12px 12px 0;padding:13px 16px 11px">
    <b style="display:block;font:800 9.5px/1 {HEAD};letter-spacing:.18em;text-transform:uppercase;color:{eyebrow_colour};margin-bottom:6px">{head}</b>{body}</td></tr></table>"""


def receipt_table():
    H = RECEIPT_HEADS
    return f"""<table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden">
<tr><td bgcolor="{NAVY}" style="background:{NAVY};padding:16px 26px;border-bottom:3px solid {GOLD}">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr>
    <td style="width:34px;padding-right:10px"><img src="{LOGO}" width="34" height="34" alt="" style="display:block;border-radius:8px"></td>
    <td style="font:800 14px/1.25 {HEAD};color:#eaf4ff">Ricky Rampersad Branch<br><span style="font:500 11px/1.3 {BODY};color:#8fd8e6">Guardian Life of the Caribbean</span></td>
    <td align="right" style="font:800 9.5px/1.5 {HEAD};letter-spacing:.18em;text-transform:uppercase;color:{GOLD};white-space:nowrap">Received<br><span style="font:700 13px/1.3 {HEAD};letter-spacing:0;text-transform:none;color:#eaf4ff">{{{{time}}}}</span></td>
  </tr></table>
</td></tr>
<tr><td style="padding:24px 26px 20px;font:400 15.5px/1.6 {BODY};color:{BODYC}">
  <h1 style="font:800 25px/1.2 {HEAD};color:{INK};margin:0 0 10px;letter-spacing:-.4px">Thank you, {{{{first_name}}}}.</h1>
  <p style="margin:0 0 16px">{RECEIPT_OPEN}</p>
  <!--recap-->{receipt_card('#f4f8fa', GOLD, '#8a6420', H['recap'], '[[recap]]')}<!--/recap-->
  <!--concerns-->{receipt_card('#ffffff', TEAL, TDARK, H['concerns'], '[[concerns]]')}<!--/concerns-->
  {receipt_card('#fff8e6', GOLD, '#8a6420', H['next'], '[[next]]')}
  {receipt_card(NAVY, GOLD, GOLD, H['follow'], '[[follow]]', dark=True)}
  <p style="margin:0 0 6px">{RECEIPT_REPLY}</p>
  <table role="presentation" cellpadding="0" cellspacing="0" style="margin:16px 0 0"><tr>
    <td style="border-left:3px solid {GOLD};padding:2px 0 2px 12px;font:400 13.5px/1.5 {BODY};color:{DIM}">
      <b style="display:block;font:800 15.5px/1.3 {HEAD};color:{INK}">{{{{care_name}}}}</b>{{{{care_line}}}}</td></tr></table>
</td></tr>
<tr><td bgcolor="#f4f8fa" style="background:#f4f8fa;padding:12px 26px;border-top:1px solid #e0eaef;font:400 11.5px/1.55 {BODY};color:#64798e">
  Sent because you answered our letter. Policy numbers and personal details are deliberately kept out of this e-mail.
</td></tr>
</table>"""


def receipt_doc():
    return f"""<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light">
<title>{html.escape(RECEIPT_SUBJECT)}</title>
<!-- the receipt a response earns · generated by tools/letters/build-letters.py -->
<link href="{FONTS}" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:#eef4f7">
<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#eef4f7"><tr><td align="center" style="padding:24px 12px">
{receipt_table()}
</td></tr></table>
</body></html>
"""


PLAIN_RECEIPT = ('<p><b>Ricky Rampersad Branch</b><br>Guardian Life of the Caribbean</p><hr>'
                 '<h2>Thank you, {{first_name}}.</h2>'
                 f'<p>{RECEIPT_OPEN}</p>'
                 f'<!--recap--><h3>{RECEIPT_HEADS["recap"]}</h3>[[recap]]<!--/recap-->'
                 f'<!--concerns--><h3>{RECEIPT_HEADS["concerns"]}</h3>[[concerns]]<!--/concerns-->'
                 f'<h3>{RECEIPT_HEADS["next"]}</h3>[[next]]'
                 f'<h3>{RECEIPT_HEADS["follow"]}</h3>[[follow]]'
                 f'<p>{RECEIPT_REPLY}</p>'
                 '<p><b>{{care_name}}</b><br>{{care_line}}</p><hr>'
                 '<p><i>Sent because you answered our letter. Policy numbers and personal details are deliberately kept out of this e-mail.</i></p>\n')

(OUT / 'receipt.html').write_text(receipt_doc(), encoding='utf-8')
(PLAIN / 'receipt.html').write_text(PLAIN_RECEIPT, encoding='utf-8')
(OUT / 'receipt.json').write_text(json.dumps({'subject': RECEIPT_SUBJECT, 'file': 'receipt.html', 'plain': 'plain/receipt.html',
                                              'care': CARE, 'next': NEXT, 'next_q': NEXT_Q, 'still': STILL, 'heads': RECEIPT_HEADS,
                                              'follow': FOLLOW, 'recap': RECAP, 'review': REVIEW_RECAP,
                                              'tpl': RECEIPT_TPL, 'tpl_plain': RECEIPT_TPL_PLAIN}, indent=1, ensure_ascii=False),
                                  encoding='utf-8')
print(f'wrote the receipt: {OUT / "receipt.html"}, {PLAIN / "receipt.html"}, {OUT / "receipt.json"}')
