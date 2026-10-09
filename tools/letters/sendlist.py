#!/usr/bin/env python3
"""Build the Transition Send list for the letters, from the Branch Portfolio
sheet. Client data never enters the repository: run this in a scratch
directory, on a copy of the sheet, and import the CSV it writes. The CSV is imported into the
"Transition Send" tab of the Service Questionnaire spreadsheet, where
Transition.gs reads it.

One row per client. The waterfall picks the letter; the merge fields are read
off the client's own rows; the departed agents' own policies and their
households are excluded before anything else is looked at.
"""
import csv, re, json, datetime, secrets, string
from collections import defaultdict, Counter

import sys, pathlib

HERE = pathlib.Path(__file__).resolve().parent
# usage: sendlist.py <branch-portfolio.csv> [yyyy-mm-dd]   → writes the two CSVs beside the portfolio
PORTFOLIO = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else 'branch-portfolio.csv')
TODAY = datetime.date(*map(int, sys.argv[2].split('-'))) if len(sys.argv) > 2 else datetime.date.today()
# The departed agents, one name per line, exactly as the Agent column spells
# them, in departed.txt beside this script. That file is git-ignored: the
# names never enter the repository.
NINE = [l.strip() for l in (HERE / 'departed.txt').read_text(encoding='utf-8').splitlines() if l.strip()]
if not NINE:
    sys.exit('departed.txt is empty: one departed agent per line, as the Agent column spells them')
# Anyone the branch names by hand — a departed agent's spouse, parent or
# child under another surname, or anyone else who must not be written to —
# goes in exclude.txt beside this script (git-ignored): one Client Number or
# one exact client name per line. Applied before anything else is looked at.
_ex = HERE / 'exclude.txt'
LISTED = {l.strip().lower() for l in _ex.read_text(encoding='utf-8').splitlines() if l.strip()} if _ex.exists() else set()
HEADERS = ['Token', 'Segment', 'First name', 'Email', 'Agent first name', 'Client', 'Agent',
           'Client number', 'first_year', 'years', 'issue_date', 'paid_to', 'days', 'projected_lapse',
           'app_received', 'matured_on', 'maturity_date', 'collected_on', 'promised_on', 'terminated_on', 'Exclude', 'Reason', 'Test', 'Send on',
           'Sent at', 'Status']   # collected_on and promised_on (letter J) and terminated_on (letter T) are filled by hand or by contracts.py, outside the repository
# The waves (25 September 2026: "combine and regroup … with a flow"): the family is the day the letter goes,
# in working days from TODAY, which is the go-live day. The notice and the action letters first; the in-force
# letters over three days by tenure, the longest first; the lapsed and matured letters a week on. The reminder
# needs no date: Transition.gs sends the same letter again to anyone unanswered after REMIND_DAYS.
WAVE = {'T': 0, 'T1': 0, 'J': 0, 'K': 0, 'I': 0, 'F5': 1, 'F4': 1, 'F3': 1, 'F2': 2, 'R1': 2, 'R2': 2, 'F1': 3, 'G': 5, 'A': 5}


def working_days_on(start, n):
    """The date n working days after start (Monday to Friday), start itself counting as day 0."""
    d = start
    while d.weekday() >= 5:
        d += datetime.timedelta(days=1)
    for _ in range(n):
        d += datetime.timedelta(days=1)
        while d.weekday() >= 5:
            d += datetime.timedelta(days=1)
    return d
PENDING = ('underwriting', 'awaiting settlement')   # 'postponed' is a decision, not a file in progress: check, never auto-send
INFORCE = ('premium paying', 'waiver of prem', 'paid up')
ALNUM = string.ascii_letters + string.digits


def toks(s):
    return [t for t in re.sub(r'[^a-z ]', ' ', (s or '').lower()).split() if t]


def ne(e):
    e = re.sub(r'\s+', '', str(e or '')).lower()
    return e if '@' in e and '.' in e.split('@')[-1] else ''


def d(s):
    s = (s or '').strip()
    if re.match(r'^\d{4}-\d{2}-\d{2}$', s):
        return datetime.date(*map(int, s.split('-')))
    m = re.match(r'^(\d{1,2}) (\w{3}) (\d{4})$', s)
    if m:
        try:
            return datetime.datetime.strptime(s, '%d %b %Y').date()
        except ValueError:
            return None
    return None


def long(dt):
    return f'{dt.day} {dt.strftime("%B %Y")}' if dt else ''


def norm_addr(a):
    return re.sub(r'[^a-z0-9]', '', (a or '').lower())


def token():
    return ''.join(secrets.choice(ALNUM) for _ in range(12))


rows = [r for r in csv.DictReader(open(PORTFOLIO, newline='', encoding='utf-8'))
        if (r.get('Agent') or '').strip() in NINE]

# ── the agents as clients: their own rows, by name ─────────────────────
agent_toks = {a: toks(a) for a in NINE}
own = defaultdict(list)          # agent → their own client rows (full-name match)
for r in rows:
    ct = set(toks(r['Client']))
    for a, at in agent_toks.items():
        if all(t in ct for t in at):
            own[a].append(r)
contact = {}                     # agent → {addresses, phones, emails} from their own rows
for a in NINE:
    contact[a] = {'addr': {norm_addr(r['Address']) for r in own[a] if norm_addr(r['Address'])},
                  'phone': {re.sub(r'\D', '', r['Phone'] or '') for r in own[a] if re.sub(r'\D', '', r['Phone'] or '')},
                  'email': {ne(r['email']) for r in own[a] if ne(r['email'])}}
AGENT_EMAILS = set().union(*(contact[a]['email'] for a in NINE))
# how many clients share each address, phone and e-mail: one shared by more
# than six is an office line or an employer, not a family
_seen = defaultdict(set)
for r in rows:
    cid = (r.get('Client Number') or '').strip()
    if len(norm_addr(r['Address'])) >= 12: _seen['a:' + norm_addr(r['Address'])].add(cid)
    if len(re.sub(r'\D', '', r['Phone'] or '')) >= 7: _seen['p:' + re.sub(r'\D', '', r['Phone'] or '')].add(cid)
    if ne(r['email']): _seen['e:' + ne(r['email'])].add(cid)
FAMILY_KEYS = set()
for a in NINE:
    FAMILY_KEYS |= {'a:' + x for x in contact[a]['addr'] if len(x) >= 12 and len(_seen['a:' + x]) <= 6}
    FAMILY_KEYS |= {'p:' + x for x in contact[a]['phone'] if len(x) >= 7 and len(_seen['p:' + x]) <= 6}
    FAMILY_KEYS |= {'e:' + x for x in contact[a]['email'] if len(_seen['e:' + x]) <= 6}
BANDS = [(2, 'F1'), (3, 'F2'), (5, 'F3'), (10, 'F4')]   # under 2, 2–3, 3–5, 5–10; ten or more is F5

# ── one record per client ──────────────────────────────────────────────
C = defaultdict(lambda: dict(rows=[], name='', email='', agent='', number=''))
for r in rows:
    cid = (r.get('Client Number') or '').strip()
    if not cid:
        continue
    c = C[cid]
    c['rows'].append(r)
    c['name'] = c['name'] or (r['Client'] or '').strip()
    c['email'] = c['email'] or ne(r['email'])
    c['agent'] = c['agent'] or (r['Agent'] or '').strip()
    c['number'] = cid


def status(r):
    return (r['Status Description'] or '').strip().lower()


def days(r):
    try:
        return int(float(r['Days'] or 0))
    except ValueError:
        return 0


ENDED = ('lapse', 'surrender')
NEVER = ('not proceeded', 'not taken', 'declined', 'rejected', 'postponed', 'file closed', 'underwriting',
         'awaiting settlement')


def restarts(rs):
    """The dates a policy of this client's began close to the end of another: a
    policy that lapsed or was surrendered, and one that began between six months
    before and a year after the last premium the ended one was paid to. Those
    clients get the check letter (24 September)."""
    out = []
    for e in rs:
        ei, ep = d(e['Issue Date']), d(e['Paid To Date'])
        if not status(e).startswith(ENDED) or not ei or not ep:
            continue
        for n in rs:
            ni = d(n['Issue Date'])
            if n is e or not ni or ni <= ei or status(n).startswith(NEVER):
                continue
            if -180 <= (ni - ep).days <= 365:
                out.append(ni)
    return out


out, excl = [], Counter()
for cid, c in sorted(C.items(), key=lambda kv: kv[1]['name']):
    rs = c['rows']
    first = (c['name'].split() or [''])[0].title()
    agent_first = c['agent'].split()[0]
    rec = {h: '' for h in HEADERS}
    rec.update({'Token': token(), 'First name': first, 'Email': c['email'], 'Agent first name': agent_first,
                'Client': c['name'], 'Agent': c['agent'], 'Client number': cid})

    # ── exclusions first ──
    ct = set(toks(c['name']))
    reason = ''
    if cid.lower() in LISTED or c['name'].lower() in LISTED:
        reason = 'listed: named by the branch in exclude.txt'
    for a, at in agent_toks.items():
        if reason:
            break
        if all(t in ct for t in at):
            reason = 'agent: their own policy'
            break
    if not reason:
        for a, at in agent_toks.items():
            if at[-1] in ct:                         # shares the agent's surname
                k = contact[a]
                addrs = {norm_addr(r['Address']) for r in rs}
                phones = {re.sub(r'\D', '', r['Phone'] or '') for r in rs}
                emails = {ne(r['email']) for r in rs}
                if (addrs & k['addr']) or (phones & k['phone']) or (emails & k['email']):
                    reason = 'agent household: same surname and same address, phone or e-mail as the agent'
                elif c['agent'] == a:
                    reason = 'check: same surname as the agent, in their own book'
                else:
                    reason = 'check: shares a departed agent\'s surname'
                break
    # a departed agent's own address on a client's record: the letter would reach the agent
    if not reason and c['email'] and c['email'] in AGENT_EMAILS:
        reason = 'agent e-mail: the address on file belongs to a departed agent'
    # family under any surname: the same home, phone or e-mail as a departed agent's own policy
    if not reason:
        keys = set()
        for r in rs:
            if len(norm_addr(r['Address'])) >= 12: keys.add('a:' + norm_addr(r['Address']))
            if len(re.sub(r'\D', '', r['Phone'] or '')) >= 7: keys.add('p:' + re.sub(r'\D', '', r['Phone'] or ''))
            if ne(r['email']): keys.add('e:' + ne(r['email']))
        if keys & FAMILY_KEYS:
            reason = 'agent household: lives with a departed agent (same address, phone or e-mail)'
    if not reason and c['email'].endswith('@myguardiangroup.com'):
        reason = 'staff e-mail'
    if not reason and any('death' in status(r) for r in rs):
        reason = 'death claim on file'

    # ── the waterfall ──
    inforce = [r for r in rs if status(r).startswith(INFORCE)]
    paying = [r for r in rs if status(r).startswith('premium paying')]
    pending = [r for r in rs if status(r).startswith(PENDING)]
    matured = [r for r in rs if status(r).startswith('matur')]
    lapsed = [r for r in rs if status(r).startswith('lapse')]
    # Days is days past the paid-to date only on a row the sheet flags Overdue;
    # on every other row it means something else (often days since issue), and
    # reading it bare put 665 clients who owed nothing on the premium letter.
    overdue = [r for r in paying if (r.get('Status(2)') or '').strip().lower() == 'overdue' and days(r) > 60]
    issue = [d(r['Issue Date']) for r in inforce + lapsed if d(r['Issue Date'])]
    if issue:
        rec['first_year'] = str(min(issue).year)
        rec['years'] = str((TODAY - min(issue)).days // 365)
    seg = ''
    postponed = [r for r in rs if status(r).startswith('postponed')]
    if pending or postponed:
        seg = 'K'
        if postponed and not pending and not reason:
            reason = 'check: postponed by underwriting — confirm before writing'
        pending = pending or postponed
        p = sorted(pending, key=lambda r: d(r['App Received Date']) or datetime.date.min)[-1]
        rec['app_received'] = long(d(p['App Received Date']))
        rec['first_year'] = rec['years'] = ''
    elif overdue:
        seg = 'I'
        o = max(overdue, key=days)
        rec['paid_to'] = long(d(o['Paid To Date']))
        rec['days'] = str(days(o))
        rec['projected_lapse'] = long(d(o['Projected Lapse Date']))
    elif matured:
        seg = 'A'
        if not reason:
            reason = 'check: matured — confirm it is unclaimed before sending'
    elif inforce and restarts(rs):
        # cover that ended and started again: the check letter, R1 while the
        # newest start is inside three years, R2 after (24 September). "With us
        # since" counts every policy that was ever issued, the ended ones too,
        # because the in-force date alone would call a long relationship new.
        newest = max(restarts(rs))
        seg = 'R1' if (TODAY - newest).days <= 1095 else 'R2'
        issued = [d(r['Issue Date']) for r in rs if d(r['Issue Date']) and not status(r).startswith(NEVER)]
        rec['first_year'] = str(min(issued).year)
        rec['years'] = str((TODAY - min(issued)).days // 365)
        rec['issue_date'] = long(newest)
        pt = [d(r['Paid To Date']) for r in paying if d(r['Paid To Date'])]
        rec['paid_to'] = long(max(pt)) if pt else ''
    elif inforce:
        # five versions by how long the client has held their longest policy (23 September)
        first = min((d(r['Issue Date']) for r in inforce if d(r['Issue Date'])), default=None)
        held = ((TODAY.year - first.year) - ((TODAY.month, TODAY.day) < (first.month, first.day))) if first else 0
        seg = next((s for limit, s in BANDS if held < limit), 'F5')
        pt = [d(r['Paid To Date']) for r in paying if d(r['Paid To Date'])]
        rec['paid_to'] = long(max(pt)) if pt else ''
    elif lapsed:
        seg = 'G'
        pt = [d(r['Paid To Date']) for r in lapsed if d(r['Paid To Date'])]
        rec['paid_to'] = long(max(pt)) if pt else ''
    else:
        if not reason:
            reason = 'nothing held: not written to'
    if not reason and not c['email']:
        reason = 'no e-mail: call list'
    rec['Segment'] = seg
    if reason:
        rec['Exclude'] = reason.split(':')[0]
        rec['Reason'] = reason
        excl[reason.split(':')[0]] += 1
    rec['Send on'] = working_days_on(TODAY, WAVE.get(seg, 0)).isoformat() if seg else ''
    out.append(rec)

# No row on this list is ever marked Test: "send the Test rows now" sends
# whatever carries Test = Y, and on this list that would be a real client. The
# tests go to staff, from their own rows, never to a client (23 September).

with open(PORTFOLIO.parent / 'transition-send-list.csv', 'w', newline='', encoding='utf-8') as f:
    w = csv.DictWriter(f, fieldnames=HEADERS); w.writeheader(); w.writerows(out)
with open(PORTFOLIO.parent / 'transition-exclusions.csv', 'w', newline='', encoding='utf-8') as f:
    w = csv.DictWriter(f, fieldnames=HEADERS); w.writeheader()
    w.writerows(sorted((r for r in out if r['Exclude'] and r['Exclude'] not in ('nothing held', 'no e-mail')),
                       key=lambda r: (r['Exclude'], r['Agent'], r['Client'])))

send = [r for r in out if r['Segment'] and not r['Exclude']]
print(f'{len(out)} clients on the nine books; {len(send)} letters ready to send; '
      f'{sum(1 for r in out if r["Exclude"] == "no e-mail")} with no e-mail (call list)')
print('\nready to send, by letter:')
for s, n in sorted(Counter(r['Segment'] for r in send).items()):
    print(f'  {s}  {n:>5}')
print('\nheld back, by reason:')
for k, n in excl.most_common():
    print(f'  {n:>5}  {k}')
print('\nagents found as clients themselves:', {a: len(v) for a, v in own.items() if v})
