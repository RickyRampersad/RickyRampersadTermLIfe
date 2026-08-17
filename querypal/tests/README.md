# Query Pal attachment tests

Eight suites. Two run against the live build today; the rest skip with a reason
until their code is ported onto it.

| suite | status |
|---|---|
| `attachments.browser` | **runs** — 26 assertions on the live `index.html` |
| `wall.browser` | **runs** — 33 assertions on `wall.html` |
| `patch` | **runs** — 46 assertions on `QueryPalPatch.gs` with the real agent tables |
| `portal.backend` | **runs** — 35 assertions on the client-portal endpoints |
| `portal.browser` | **runs** — 32 assertions driving the portal in Chromium |
| `leavers.backend` | **runs** — 81 assertions on the company leaver run and the GET guard |
| `leavers.browser` | **runs** — 45 assertions driving the leaver run in Chromium |
| `attachments.backend`, `routing`, `security`, `wall` | skip — superseded by `patch.test.js`; kept for the full-file port |
| `leaderboard.browser`, `signin.browser` | skip — features not yet ported to the live `index.html` |

The repo was seeded from an old archive (frontend v27.2, script v6.9-COLOR-CODE)
while production runs v10.2-CLIENT-PORTAL. The frontend has since been replaced
with the live 11 Aug build; the Apps Script still needs exporting from the editor.

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

# wall — server-side aggregation over a seeded sheet
node wall.test.js

# wall — all seven panels rendered in Chromium, gating and range switching
NODE_PATH=/opt/node22/lib/node_modules node wall.browser.test.mjs

# patch file — routing table vs the live catalog, attachments, managers, passwords
node patch.test.js

# client portal — code issuance, enrollment, client-safe history, stats
node portal.backend.test.js
NODE_PATH=/opt/node22/lib/node_modules node portal.browser.test.mjs

# company leaver run — access control, the GET guard, death-in-service, backdating
node leavers.backend.test.js
NODE_PATH=/opt/node22/lib/node_modules node leavers.browser.test.mjs
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

**Wall** — aggregates are computed over every row (not the dashboard's 300-row
page): totals, on-time, ageing buckets that reconcile with the open count,
12-week volume, per-department and per-agent breakdowns, rating distribution
and time windows. The payload carries no client names, references or request
text. In the browser: the wall is gated behind sign-in, all seven panels render,
volume bars have real height, ranks are ordered by on-time as the caption
claims, switching the range reloads, and an agent sees only their own scorecard.

## Not covered here

Live email delivery. After redeploying the Apps Script, send one real query
with `TEST_MODE = true` and confirm the attachments arrive in the test inbox —
see the deployment notes in the commit message.
