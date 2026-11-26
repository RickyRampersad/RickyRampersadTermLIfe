#!/usr/bin/env python3
"""Point the group pages at the group project's own /exec (26 November 2026).

    python3 tools/move/repoint-group.py <new /exec URL>           change the pages
    python3 tools/move/repoint-group.py <new /exec URL> --check   only report

The group side (group client management, the group bills, the GI renewal desk) moves out of the Service Questionnaire
project into a project of its own. Every page that talks to the group side holds the Service Questionnaire's /exec.
This swaps it for the new one in those pages, and only in those pages: the other pages that hold the same address
(the orphan board, the walls, the quote forms, the service questionnaire itself) keep it.

A page is changed only when every action it sends is a gcm.* action, so a page that also talks to the orphan side
can never be cut off from it. A page that sends gcm.* actions but is not on the list is reported, never changed.
"""
import re, subprocess, sys

SQ = 'https://script.google.com/macros/s/AKfycbxdW5mVcK6DZbq4qnCj1l1cJvjsTYWZ9UMH91H6yC_NrElNYpGd1vRyJH1W_1mcu61woQ/exec'
EXEC = re.compile(r'^https://script\.google\.com/macros/s/[A-Za-z0-9_-]{20,}/exec$')
PAGES = [
    'groupclientmanagement/index.html',      # the staff page
    'groupclientmanagement/client.html',     # a group's own page
    'groupclientmanagement/wall.html',       # the groups wall
    'groupclientmanagement/training.html',   # the group course
    'groupclientmanagement/billing-door.js', # the billing door
    'orphan-transition/training.html',       # the orphan course, which runs on the group course's machinery (gcm.train)
    'benefits/enroll.html',                  # a new member's own part of the enrolment (gcm.enrolGet, gcm.enrolSubmit)
    'renewaldesk/desk.js',                   # the GI renewal desk
    'myrenewal/index.html',                  # a client's renewal page
    'renewal/index.html',                    # the renewal portal's door, which asks gcm.ping whether the desk is live
]
ACTION = re.compile(r"""action(?:\s*[:=]\s*|=)['"]?([A-Za-z][\w.]*)""")


def actions(text):
    """Every action name the page sends, except the obvious non-actions a regex picks up in prose or code."""
    return {a for a in ACTION.findall(text) if '.' in a or a in ('ping', 'resp', 'service', 'board')}


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    check = '--check' in sys.argv
    if len(args) != 1 or not EXEC.match(args[0]) or args[0] == SQ:
        sys.exit(__doc__)
    new = args[0]
    bad = 0
    for f in PAGES:
        text = open(f, encoding='utf-8').read()
        n = text.count(SQ)
        others = sorted(a for a in actions(text) if not a.startswith('gcm.'))
        if others:
            print('REFUSED  %s sends %s as well: change it by hand' % (f, ', '.join(others)))
            bad += 1
            continue
        if not n:
            print('   --    %s (%s)' % (f, 'already on the new address' if new in text else 'holds neither address'))
            continue
        print('%4d  %s' % (n, f))
        if not check:
            open(f, 'w', encoding='utf-8').write(text.replace(SQ, new))
    files = subprocess.run(['git', 'ls-files', '*.html', '*.js'], capture_output=True, text=True, check=True).stdout.split('\n')
    for f in files:
        if not f or f in PAGES or f.startswith(('tests/', 'tools/', 'apps-script/')):
            continue
        try:
            text = open(f, encoding='utf-8').read()
        except (UnicodeDecodeError, FileNotFoundError, IsADirectoryError):
            continue
        if SQ in text and re.search(r"""['"=]gcm\.[a-zA-Z]""", text):
            print('NOT ON THE LIST  %s sends gcm.* to the old address: add it to PAGES or change it by hand' % f)
            bad += 1
    print('checked only' if check else 'done', '-', 'problems: %d' % bad if bad else 'no problems')
    sys.exit(1 if bad else 0)


if __name__ == '__main__':
    main()
