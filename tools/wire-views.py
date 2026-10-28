#!/usr/bin/env python3
"""Point every page's view beacon at the deployed RRB Views web app.

    python3 tools/wire-views.py https://script.google.com/macros/s/AKfy.../exec
    python3 tools/wire-views.py --unwire          # back to the placeholder
    python3 tools/wire-views.py --check           # report, change nothing

Every served page carries a `<!-- rrb-views -->` beacon before </body> whose
first line reads `var u='RRB_VIEWS_URL'`. Until that holds a real address the
guard `if(u.indexOf('http')!==0)return` makes the beacon a no-op, so an
un-wired page costs the visitor nothing.

Two rules this script exists to enforce, both of which have been broken by
hand before:

  - It rewrites ONLY the string inside the beacon block. On 26 October six
    pages were found with the Branch Intelligence backend pasted into their
    beacon, so every visitor to mycover, motor-quote and the renewals pages
    fired an unauthenticated request at Intelligence.gs and got a 403 back.
    A blunt find-and-replace across the file would have hit each page's own
    API_URL as well.

  - It refuses an address that is not an Apps Script /exec URL, so a page
    cannot be wired to send its visitors' paths somewhere unintended.

Redirect stubs and apps-script/ templates deliberately carry no beacon and
are therefore never touched: the script only edits what it finds.
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
PLACEHOLDER = 'RRB_VIEWS_URL'

# The beacon block, with the quoted value of `u` as its own group so the
# replacement can be surgical. DOTALL because the block spans lines.
BEACON = re.compile(
    r"(<!--\s*rrb-views\s*-->.*?var\s+u\s*=\s*')([^']*)(')",
    re.S | re.I,
)

EXEC_URL = re.compile(
    r"^https://script\.google\.com/macros/s/[A-Za-z0-9_-]{30,}/exec$"
)

SKIP_DIRS = {'.git', 'node_modules'}


def pages():
    for p in sorted(ROOT.rglob('*.html')):
        if SKIP_DIRS & set(p.relative_to(ROOT).parts):
            continue
        yield p


def main(argv):
    if len(argv) != 2:
        print(__doc__)
        return 2

    arg = argv[1]
    if arg == '--check':
        target = None
    elif arg == '--unwire':
        target = PLACEHOLDER
    else:
        if not EXEC_URL.match(arg):
            print(f"refused: {arg!r}\n"
                  "  must be an Apps Script web-app address ending in /exec.\n"
                  "  Deploy gs/views-counter.gs as a Web app (Execute as: Me,\n"
                  "  Who has access: Anyone) and pass the URL it gives you.")
            return 1
        target = arg

    seen = changed = 0
    already = {}

    for p in pages():
        text = p.read_text(encoding='utf-8', errors='surrogateescape')
        m = BEACON.search(text)
        if not m:
            continue
        seen += 1
        current = m.group(2)
        already[current] = already.get(current, 0) + 1

        if target is None or current == target:
            continue

        p.write_text(
            text[:m.start(2)] + target + text[m.end(2):],
            encoding='utf-8', errors='surrogateescape',
        )
        changed += 1

    print(f"pages carrying a beacon: {seen}")
    for value, n in sorted(already.items(), key=lambda kv: -kv[1]):
        label = 'placeholder (inert)' if value == PLACEHOLDER else value
        print(f"  {n:4d}  {label}")
    if target is not None:
        print(f"rewritten: {changed}")
        if changed:
            print(f"now pointing at: {target}")
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
