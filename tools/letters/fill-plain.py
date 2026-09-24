#!/usr/bin/env python3
"""Fill the plain letters for the Microsoft 365 connector, one e-mail per row of the Transition Send list.

A Claude session holding the Microsoft 365 connector, signed in as support@rickyrampersadbranch.com, sends
what this writes, until the Entra app lets Transition.gs send the branded letters itself (24 September 2026).
The connector refuses anything outside p, br, a[href], b/strong, i/em, lists, headings, tables, hr and div,
so these are the plain letters build-letters.py writes to orphan-transition/letters/plain/, filled the way
Transition.gs fills the branded ones: a blank fact is cut out, the strip goes with its last fact, a row with
no agent's first name still reads "Your representative has moved on".

Client data never enters the repository: run this in a scratch directory and keep what it writes there.

  python3 fill-plain.py <send-list.csv> <out.jsonl> [--test] [--segments F1,R1] [--limit N] [--today yyyy-mm-dd]

Each line of out.jsonl is one e-mail: token, segment, to, cc, subject, body. The rows the sender would hold
are held here too, with the reason counted: anything in Exclude, already sent, no e-mail, no first name, no
letter for the segment, and (except with --test) no Send on date or one still to come. --test keeps only
the rows marked Test = Y, which are always staff standing in as clients, never a client's own row.
"""
import argparse, csv, datetime, html, json, pathlib, re
from collections import Counter

HERE = pathlib.Path(__file__).resolve().parent
PLAIN = HERE.parent.parent / 'orphan-transition' / 'letters' / 'plain'
OPENINGS = json.loads((HERE / 'openings.json').read_text(encoding='utf-8'))
# the visible copies on every client e-mail: TRANSITION.CC in Transition.gs, the manager's choice
CC = ['rickyrampersadsalessupport@myguardiangroup.com', 'Ricky.Rampersad@myguardiangroup.com']
FACTS = ['first_year', 'issue_date', 'paid_to', 'days', 'projected_lapse', 'app_received', 'matured_on', 'maturity_date']
FIELDS = ['first_year', 'years', 'issue_date', 'paid_to', 'days', 'projected_lapse', 'app_received', 'matured_on', 'maturity_date']
ALLOWED = {'p', 'br', 'a', 'b', 'strong', 'i', 'em', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
           'table', 'thead', 'tbody', 'tr', 'th', 'td', 'code', 'pre', 'hr', 'div', 'strike'}


def fill(text, row):
    v = lambda k: (row.get(k) or '').strip()
    out = text
    for k in FACTS:
        if not v(k):
            out = re.sub(r'<!--fact:' + k + r'-->[\s\S]*?<!--/fact-->', '', out)
    out = re.sub(r'<!--facts-->([\s\S]*?)<!--/facts-->', lambda m: m.group(0) if '<!--fact:' in m.group(1) else '', out)
    if not v('Agent first name'):
        out = re.sub(r'<!--agent-->[\s\S]*?<!--/agent-->', '', out)
    vals = {'first_name': v('First name'), 'agent_first_name': v('Agent first name'), 'token': v('Token'),
            'segment': v('Segment').upper(), **{k: v(k) for k in FIELDS}}
    out = re.sub(r'\{\{(\w+)\}\}', lambda m: html.escape(vals[m.group(1)]) if m.group(1) in vals else m.group(0), out)
    out = re.sub(r'<!--[\s\S]*?-->', '', out)            # the markers have done their job; the connector refuses comments
    return re.sub(r'href="([^"]*)"', lambda m: 'href="' + m.group(1).replace('&amp;', '&').replace('&', '&amp;') + '"', out)


def check(body):
    """Refuse here what the connector would refuse there, so a batch never stops half-sent."""
    for tag, attrs in re.findall(r'<\s*/?\s*([a-zA-Z0-9]+)([^>]*)>', body):
        if tag.lower() not in ALLOWED:
            raise ValueError(f'<{tag}> is outside the connector allowlist')
        names = {n.lower() for n in re.findall(r'([a-zA-Z-]+)\s*=', re.sub(r'"[^"]*"|\'[^\']*\'', '""', attrs))}
        if names and (tag.lower() != 'a' or names - {'href'}):
            raise ValueError(f'{sorted(names)} on <{tag}> is outside the connector allowlist')
    if '{{' in body or '<!--' in body:
        raise ValueError('a field or a marker was left unfilled')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('csv'); ap.add_argument('out')
    ap.add_argument('--test', action='store_true'); ap.add_argument('--segments'); ap.add_argument('--limit', type=int)
    ap.add_argument('--today', default=datetime.date.today().isoformat())
    a = ap.parse_args()
    segs = {s.strip().upper() for s in a.segments.split(',')} if a.segments else None
    held, n = Counter(), 0
    with open(a.csv, newline='', encoding='utf-8-sig') as src, open(a.out, 'w', encoding='utf-8') as out:
        for r in csv.DictReader(src):
            seg = (r.get('Segment') or '').strip().upper()
            send_on = (r.get('Send on') or '').strip()[:10]
            why = ('excluded' if (r.get('Exclude') or '').strip() else
                   'not a test row' if a.test and (r.get('Test') or '').strip().upper() != 'Y' else
                   'already sent' if (r.get('Sent at') or '').strip() else
                   'no e-mail' if '@' not in (r.get('Email') or '') else
                   'no first name' if not (r.get('First name') or '').strip() else
                   'no letter for the segment' if not seg or not (PLAIN / f'{seg}.html').exists() else
                   'not in --segments' if segs and seg not in segs else
                   'no Send on date' if not a.test and not send_on else
                   'Send on still to come' if not a.test and send_on > a.today else '')
            if why:
                held[why] += 1
                continue
            body = fill((PLAIN / f'{seg}.html').read_text(encoding='utf-8'), r)
            check(body)
            out.write(json.dumps(dict(token=r['Token'], segment=seg, to=[r['Email'].strip()], cc=CC,
                                      subject=fill(OPENINGS[seg]['subject'], r), body=body)) + '\n')
            n += 1
            if a.limit and n >= a.limit:
                break
    print(f'{n} e-mails ready in {a.out}; held back: {dict(held) or "none"}')


if __name__ == '__main__':
    main()
