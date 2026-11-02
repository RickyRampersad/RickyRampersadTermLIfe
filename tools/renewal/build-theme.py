#!/usr/bin/env python3
"""Fold renewal/theme.css and renewal/theme.js into apps-script/RenewalTheme.html.

The renewal pages served by Apps Script (the client portal, the property portal,
the staff dashboard, the renewal board, Track your renewal) cannot link a file
from the website reliably, so they take the theme inline through rrTheme_() in
Code.gs. The static pages in /renewal/ link the two files. One source, two homes:
edit theme.css and theme.js, run this, never edit RenewalTheme.html by hand.
tests/test-renewal-theme.js fails when the copy is stale.
"""
import pathlib
root = pathlib.Path(__file__).resolve().parents[2]
css = (root / 'renewal/theme.css').read_text()
js = (root / 'renewal/theme.js').read_text()
out = ('<!-- Built by tools/renewal/build-theme.py from renewal/theme.css and renewal/theme.js. Do not edit. -->\n'
       '<style>\n' + css + '</style>\n<script>\n' + js + '</script>\n')
(root / 'apps-script/RenewalTheme.html').write_text(out)
print('apps-script/RenewalTheme.html', len(out), 'bytes')
