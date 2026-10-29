#!/usr/bin/env python3
"""Generate one address per advisor, from the roster in ffproject.html.

The README beside this file says these pages are generated and must never be
hand-edited, but the generator itself was not in the repository — so the only
way to add an advisor was to copy a folder and edit five occurrences of a code
by hand, which is exactly what the README forbids.

The roster in fact-find-analyzer/ffproject.html is the single source of truth:
the same list the fact find uses for its advisor dropdown, so the dropdown and
the link previews cannot drift apart.

    python3 meet/a/generate.py --check     regenerate into memory and compare
    python3 meet/a/generate.py --write     write the files

--check is the one that matters. It reproduces every existing page and fails
loudly on any byte that differs, so a change to the template is proved against
thirty known-good files before it is written to any of them.
"""
import argparse, os, re, sys, urllib.request
from urllib.parse import quote

HERE = os.path.dirname(os.path.abspath(__file__))
LIVE = 'https://factfind360.com/ffproject'
LOCAL = os.path.join(HERE, '..', '..', '..', 'fact-find-analyzer', 'ffproject.html')

HEADLINE = 'If your income stopped tomorrow, how long would your family be alright?'

# Codes that are no longer on the advisor roster — whether they have left or
# the branch simply does not attribute prospects to them. Their address stays
# alive, because every link they
# ever sent is still out there on somebody's phone and a 404 is the worst thing
# a prospect can meet. But the page stops carrying their name: it drops the
# advisor, the name and the token, so /meet/ sees the arrival as "direct" —
# nobody targeted — and the branch picks the person up instead of logging them
# against somebody who is gone. The name here is only for the file comment, so
# the next person can see whose address it was; it is not in the preview.
RETIRED = {
    'A01452': 'Richard Ramdwar',
    'A12749': 'Aidan Eugene',
    # Taken off the advisor dropdown on the branch manager's instruction. These
    # three are still ACTIVE on the Access tab, so the dashboard will still build
    # them a prospect link if they sign in — which is exactly why the address has
    # to keep resolving. Unattributed is the safe state: nothing 404s, and no
    # enquiry is logged against somebody the branch does not treat as an advisor.
    # If any of them is in fact prospecting, they belong back on the roster.
    'A04020': 'Javid Ali',
    'A04028': 'Aleema Mohammed-Ali',
    'A13064': 'Roberta Laltoo',
}
BLURB = ('Sent to you by {name} · Ricky Rampersad Branch, Guardian Life. '
         'A minute to watch, then nothing to fill in — just tap what is '
         'actually on your mind. Nothing to buy and nothing to sign.')

TEMPLATE = '''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow">

<!-- {name} — {code}
     One address per advisor, because a link preview is fetched once per
     address and WhatsApp does not run JavaScript. /meet/ can never carry a
     name in its preview whatever is on the query string; this page can,
     because the name is in the file.
     Generated. Do not hand-edit — see meet/a/README.md. -->
<title>{headline}</title>
<meta property="og:type" content="website">
<meta property="og:site_name" content="Ricky Rampersad Branch · Guardian Life">
<meta property="og:title" content="{headline}">
<meta property="og:description" content="{blurb}">
<meta property="og:image" content="https://rickyrampersadbranch.com/prospect-poster.jpg">
<meta property="og:url" content="https://rickyrampersadbranch.com/meet/a/{code}/">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{headline}">
<meta name="twitter:description" content="{blurb}">
<meta name="twitter:image" content="https://rickyrampersadbranch.com/prospect-poster.jpg">
<meta name="description" content="{blurb}">

<!-- A crawler reads the tags above and stops. A person is moved on at once,
     carrying whatever the advisor put on the link — the prospect's name, the
     tracking token — so nothing is lost by coming through here. -->
<script>
  (function () {{
    var q = new URLSearchParams(location.search);
    q.set('a', '{code}');
    q.set('n', '{name}');
    location.replace('/meet/?' + q.toString());
  }})();
</script>
<meta http-equiv="refresh" content="0; url=/meet/?a={code}&n={enc}">
</head>
<body style="font:16px/1.6 -apple-system,Arial,sans-serif;padding:40px 22px;text-align:center">
<p>Opening&hellip; <a href="/meet/?a={code}&n={enc}">tap here if nothing happens</a>.</p>
</body>
</html>
'''

def roster(src):
    if src and os.path.exists(src):
        text = open(src, encoding='utf-8').read()
        where = src
    else:
        text = urllib.request.urlopen(LIVE, timeout=60).read().decode('utf-8')
        where = LIVE
    pairs = re.findall(r"code:\s*'(A\d{5})'\s*,\s*name:\s*'([^']+)'", text)
    seen, out = set(), []
    for code, name in pairs:
        if code in seen:
            continue
        seen.add(code)
        out.append((code, name.strip()))
    return out, where

RETIRED_TEMPLATE = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow">

<!-- {name} — {code} — NOT ON THE ADVISOR ROSTER.
     Either they have left, or the branch does not attribute prospects to them.
     This address is kept alive on purpose either way: every link {name} ever
     sent is still on somebody's phone, and deleting the folder would turn each
     one into a 404 for the prospect who taps it.
     It no longer carries their name. The advisor, the name and the tracking
     token are stripped before the redirect, so /meet/ treats the arrival as
     "direct" — nobody targeted — and the branch picks the person up rather
     than logging the enquiry against somebody who is not taking it.
     Generated. Do not hand-edit — see meet/a/README.md. -->
<title>{headline}</title>
<meta property="og:type" content="website">
<meta property="og:site_name" content="Ricky Rampersad Branch · Guardian Life">
<meta property="og:title" content="{headline}">
<meta property="og:description" content="{blurb}">
<meta property="og:image" content="https://rickyrampersadbranch.com/prospect-poster.jpg">
<meta property="og:url" content="https://rickyrampersadbranch.com/meet/a/{code}/">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{headline}">
<meta name="twitter:description" content="{blurb}">
<meta name="twitter:image" content="https://rickyrampersadbranch.com/prospect-poster.jpg">
<meta name="description" content="{blurb}">

<script>
  (function () {{
    var q = new URLSearchParams(location.search);
    // The three that attribute this person to an advisor who has left.
    q.delete('a'); q.delete('n'); q.delete('t');
    var s = q.toString();
    location.replace('/meet/' + (s ? '?' + s : ''));
  }})();
</script>
<meta http-equiv="refresh" content="0; url=/meet/">
</head>
<body style="font:16px/1.6 -apple-system,Arial,sans-serif;padding:40px 22px;text-align:center">
<p>Opening&hellip; <a href="/meet/">tap here if nothing happens</a>.</p>
</body>
</html>
"""

RETIRED_BLURB = ('Ricky Rampersad Branch, Guardian Life. A minute to watch, then '
                 'nothing to fill in — just tap what is actually on your mind. '
                 'Nothing to buy and nothing to sign.')


def retired_page(code, name):
    return RETIRED_TEMPLATE.format(code=code, name=name, headline=HEADLINE,
                                   blurb=RETIRED_BLURB)


def page(code, name):
    blurb = BLURB.format(name=name)
    return TEMPLATE.format(code=code, name=name, headline=HEADLINE,
                           blurb=blurb, enc=quote(name))

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--write', action='store_true')
    ap.add_argument('--check', action='store_true')
    ap.add_argument('--roster', default=LOCAL)
    a = ap.parse_args()
    if not (a.write or a.check):
        a.check = True

    people, where = roster(a.roster)
    print('roster: %d advisor(s) from %s' % (len(people), where))
    print('retired: %d address(es) kept alive, unattributed' % len(RETIRED))
    people = people + [(c, n) for c, n in sorted(RETIRED.items())]

    same = diff = new = 0
    for code, name in people:
        path = os.path.join(HERE, code, 'index.html')
        want = retired_page(code, name) if code in RETIRED else page(code, name)
        if os.path.exists(path):
            have = open(path, encoding='utf-8').read()
            if have == want:
                same += 1
            else:
                diff += 1
                print('  DIFFERS  %s  %s' % (code, name))
                hl = have.splitlines(); wl = want.splitlines()
                for i in range(max(len(hl), len(wl))):
                    h = hl[i] if i < len(hl) else '(missing)'
                    w = wl[i] if i < len(wl) else '(missing)'
                    if h != w:
                        print('      line %d' % (i + 1))
                        print('        on disk : %s' % h[:110])
                        print('        would be: %s' % w[:110])
                        break
        else:
            new += 1
            print('  NEW      %s  %s' % (code, name))
        if a.write:
            os.makedirs(os.path.dirname(path), exist_ok=True)
            open(path, 'w', encoding='utf-8').write(want)

    have_dirs = {d for d in os.listdir(HERE)
                 if re.fullmatch(r'A\d{5}', d) and os.path.isdir(os.path.join(HERE, d))}
    orphan = sorted(have_dirs - {c for c, _ in people} - set(RETIRED))
    print('')
    print('identical %d   differ %d   new %d   on disk with no roster entry %d'
          % (same, diff, new, len(orphan)))
    for o in orphan:
        print('  ORPHAN   %s  (no longer on the roster)' % o)
    if a.write:
        print('written.')
    return 1 if (diff and a.check and not a.write) else 0

if __name__ == '__main__':
    sys.exit(main())
