#!/usr/bin/env python3
"""Point every page and tool at a project's new /exec after it moves accounts.

    python3 tools/move/repoint.py <old /exec URL> <new /exec URL>          # change the files
    python3 tools/move/repoint.py <old /exec URL> <new /exec URL> --check  # only count

A project moved by File -> Make a copy answers at a new /exec, and every page that
held the old address keeps calling the old project until it is changed. This finds
the old address in every tracked text file and swaps it, whole, for the new one,
and nothing else. It refuses anything that is not an Apps Script /exec, and it
never touches CLAUDE.md, which records history rather than wiring.
"""
import re, subprocess, sys

EXEC = re.compile(r'^https://script\.google\.com/macros/s/[A-Za-z0-9_-]{20,}/exec$')

def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    check = '--check' in sys.argv
    if len(args) != 2 or not all(EXEC.match(a) for a in args) or args[0] == args[1]:
        sys.exit(__doc__)
    old, new = args
    files = subprocess.run(['git', 'ls-files'], capture_output=True, text=True, check=True).stdout.split('\n')
    total = 0
    for f in files:
        if not f or f == 'CLAUDE.md':
            continue
        try:
            text = open(f, encoding='utf-8').read()
        except (UnicodeDecodeError, IsADirectoryError, FileNotFoundError):
            continue
        n = text.count(old)
        if not n:
            continue
        total += n
        print('%4d  %s' % (n, f))
        if not check:
            open(f, 'w', encoding='utf-8').write(text.replace(old, new))
    print(('would change ' if check else 'changed ') + str(total) + ' place(s)')

if __name__ == '__main__':
    main()
