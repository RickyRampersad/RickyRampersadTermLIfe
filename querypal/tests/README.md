# Query Pal attachment tests

Eight suites. Two run against the live build today; the rest skip with a reason
until their code is ported onto it.

| suite | status |
|---|---|
| `attachments.browser` | **runs** — 26 assertions on the live `index.html` |
| `wall.browser` | **runs** — 33 assertions on `wall.html` |
| `patch` | **runs** — 46 assertions on `QueryPalPatch.gs` with the real agent tables |
| `thread` | **runs** — 44 assertions on thread-finding, reply insight and the owed-reply sweep |
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

# the trail — finding the original thread, reading a reply, chasing our own side
node thread.test.js

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

## The demo film

`record-demo.mjs` drives the real app in Chromium and records it (backend
mocked — no live email), logging a caption timeline to `demo/timeline.json`.
`build_soundtrack.py` then narrates that timeline with Kokoro text-to-speech
(the open-weights `af_heart` voice, Apache-licensed, runs offline; the model
downloads itself from Hugging Face on first run) and composes an original
motivational score under it in numpy (D major, 112 BPM — pads, bass, plucks,
kick, a riser into the wall finale), ducking the music whenever the voice
speaks. Nothing is licensed from anyone; every note is synthesized here.
Captions render as a thin full-width strip on the bottom edge of the frame so
they never cover the app.

The screen recorder's encoder falls behind on longer films — by the outro the
picture can lag the recorder's wall clock by 10+ seconds. So the recorder
paints a 10px sync dot (red→green→blue, advancing on every caption) in the
bottom-left corner; `sync_timeline.py` reads the dots back out of the video to
recover every mark's TRUE on-screen time, and `build_soundtrack.py` places the
narration on those. The final encode masks the dot with a dark box.

```bash
NODE_PATH=/opt/node22/lib/node_modules node record-demo.mjs
pip install --index-url https://download.pytorch.org/whl/cpu torch
pip install kokoro soundfile numpy && apt-get install -y espeak-ng
python3 sync_timeline.py          # webm -> demo/timeline-video.json
python3 build_soundtrack.py
ffmpeg -ss 1.1 -i demo/querypal-demo.webm -ss 1.1 -i demo/soundtrack.wav \
  -map 0:v -map 1:a -vf "drawbox=x=0:y=784:w=16:h=16:color=0x04141f:t=fill" \
  -c:v libx264 -crf 23 -pix_fmt yuv420p -c:a aac -b:a 192k \
  -movflags +faststart -shortest demo/querypal-demo-final.mp4
```
(The -ss trims to just before the title card — check mark 0 in
timeline-video.json if the load time changes. `tests/email-gallery.html` is the
follow-up/hold template showcase the film pans through in scene 2b.)

If a viewer reports no audio, check the file before rebuilding anything:

```bash
ffprobe -v error -select_streams a -show_entries stream=codec_name,channels -of default demo/querypal-demo-final.mp4
ffmpeg -i demo/querypal-demo-final.mp4 -af volumedetect -f null - 2>&1 | grep volume
```
A healthy cut reports `aac` / 2 channels and a mean around -15 dB. When that
holds, the silence is the player, not the film — inline previews often start
muted. `demo/querypal-soundtrack.mp3` (exported from soundtrack.wav) is the
quickest way to prove the audio itself plays.
