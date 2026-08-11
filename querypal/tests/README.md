# Query Pal attachment tests

Six suites covering attachments, routing, reminders, the leaderboard and security.

```bash
cd querypal/tests

# attachments — backend blob building, with Apps Script stubbed
node attachments.backend.test.js

# attachments — drives index.html in Chromium with real PDF / Word / PNG files
NODE_PATH=/opt/node22/lib/node_modules node attachments.browser.test.mjs

# routing + reminders — manager CC, health override, deadlines, chase rules
node routing.test.js

# leaderboard — rankings, role gating, time-range interactivity
NODE_PATH=/opt/node22/lib/node_modules node leaderboard.browser.test.mjs

# security — routing lookup, escaping, rate limits, password hashing, tokens
node security.test.js

# sign-in — credentials leave over POST, token drives the dashboard
NODE_PATH=/opt/node22/lib/node_modules node signin.browser.test.mjs
```

Each prints `N passed, 0 failed` and exit non-zero on failure. Test fixtures
(PDF, .docx, PNG, a rejected .exe, an oversized file) are generated into
`fixtures/` on each run, so no binaries live in the repo — `fixtures/` is
disposable and git-ignored.

The browser suite needs Playwright. If `NODE_PATH` differs on your machine,
run it from wherever `playwright` is installed, or `npm i -D playwright`.

## What is covered

**Backend** — mixed document types attach with the correct MIME; executables
and HTML are rejected; oversized files are dropped without killing the rest;
filenames are stripped of path separators and CRLF; the older single-file
payload still works; `files[]` takes priority so nothing is attached twice;
the 6-file cap and malformed base64 are handled.

**Frontend** — the picker accepts documents and multiple files; PDFs and Word
docs keep their own type while photos are compressed to JPEG; each file shows
a chip (icon for documents, thumbnail for photos); rejected files explain
themselves; individual removal works and a removed file can be re-picked;
attachments reset when the query type changes; no page errors.

**Routing and reminders** — agents resolve to the right manager despite spelling
variants, and unknown names fall back visibly rather than silently; only the two
health query types reroute to Sales Support; working-day deadlines skip weekends;
the autopilot chases every unresolved status and stops on closed/cancelled.

**Leaderboard** — on-time percentages, averages and CSAT are computed correctly;
agents see only their own scorecard while managers and branch see rankings; the
time-range pills move both the board and the stat tiles.

**Security** — the department is chosen server-side from the query type and an
unknown type is refused rather than relayed; client text is HTML-escaped before
it reaches the routed email; rate limits hold for sign-in, submissions and the
assistant proxy; passwords are salted-hashed and never stored in clear; session
tokens are random, per-login and carry no agent code; the reference number is
allocated under a lock that spans the row append.

**Sign-in** — credentials go out in a POST body and appear nowhere in the URL;
the token is stored and used for dashboard calls; a rejected sign-in leaves no
session; throttle and missing-password responses each explain themselves.

## Not covered here

Live email delivery. After redeploying the Apps Script, send one real query
with `TEST_MODE = true` and confirm the attachments arrive in the test inbox —
see the deployment notes in the commit message.
