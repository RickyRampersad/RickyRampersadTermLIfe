# Ricky Rampersad Branch — house notes

Standing decisions for this repository. Read before regenerating narration,
scoring a film, or adding a product to the fact find.

## The mark — a gold shield with a check

`logo-mark.png` at the repository root, rasterised 4x from `favicon.svg`: a
**gold shield carrying a white check**, on the branch navy `#07131f`. That is
the branch's logo. It is not a monogram and there is no "RR" tile.

**Every screen and every letter uses that file.** Nothing draws a substitute.
Twice now a new screen has shipped with an invented "RR" on a blue gradient,
and both times it went out beside three screens carrying the real mark — a
branch whose own walls disagree about its logo is the first thing anybody in
the room notices.

```html
<div class="mark"><img src="<path>/logo-mark.png" alt=""></div>
```

**One exception, decided 17 September 2026**: the Branch Pending Wall slides
(`intelligence/wall/pending.html`, `intelligence/wall/reqs.html`,
`intelligence/wall/increases.html`, `intelligence/wall/codes.html`) carry a gold **nameplate** instead — `<div class="plate"><b>PENDING</b><span>wall</span></div>`
— because that is the one wall the branch stands in front of and argues from,
it runs over several slides, and the room has to know which wall it is watching.
Asked for in those words: *"remove the shield in this wall so persons will know
what wall they are watching."* A nameplate is a slide's name, not a substitute
logo; the rule against inventing a mark stands everywhere, this one included.
```css
.mark{border-radius:13px;overflow:hidden;background:#07131f;display:grid;place-items:center}
.mark img{width:100%;height:100%;display:block}
```

The palette that goes with it: navy `#07131f`, gold `#efc24b` into `#c9942c`,
teal `#00CFEA`. Those are the values in `IBRAND` in `Intelligence.gs`, which is
what the client letters read.

**In e-mail the logo must be a hosted PNG**, never SVG and never a `data:` URI —
Gmail strips the first and blocks the second, so the masthead arrives empty.
`IBRAND.LOGO` points at `https://rickyrampersadbranch.com/logo-mark.png` for
exactly that reason.

**In a film it has to be embedded**, because the film is one file played in an
iframe and a linked image does not load there. The builder folds it in as a
data URI under the `mark` key.

## The voice — narration on every film

Rendered with **edge-tts**. Free, no account, no licence, so nothing here needs
clearing before it goes on WhatsApp, YouTube or a wall screen.

```
pip install edge-tts

VOICE="en-US-AndrewNeural"     # NOT the Multilingual variant — see below
RATE="-12%"                    # -8% for a trailer; -3% was rushing

edge-tts --voice "$VOICE" --rate="$RATE" --text "…" --write-media line01.mp3
```

**Never the Multilingual variant.** `en-US-AndrewMultilingualNeural` detects
language from the text and will read a phrase in another one. It was used for
the first cut of both wall films and the note back was "I am hearing a different
language" — which was exactly what it was. `en-US-AndrewNeural` is the same warm,
confident read with no language detection in it.

Output is 24 kHz mono MP3 — plenty for speech over a music bed.

**Why these settings.** Andrew at `-12%` reads under natural pace, lets a full
stop land, and does not smile. `-3%` was the first setting and it rushed: thirty
lines at that rate with half a second between them is a briefing, not a
walkthrough. The pauses come from the film's `GAP` — the silence between lines —
not from punctuation tricks in the text.

**Writing for it.** Short declarative sentences. State the fact and trust it —
do not sell. If a line needs to breathe more, split it into two sentences
rather than reaching for commas. The browser's own speech synthesis was tried
first and was not good enough; do not go back to it.

`benefits/audio/build-voice.sh` regenerates the narration and prints durations.
`benefits/audio/embed-audio.py` folds the MP3s back in as data URIs — the film
has to stay one file, because the wall plays it in an iframe and the hosted copy
will not fetch a sibling. A linked MP3 is silent in exactly the two places that
matter.

Timings come from the rendered audio, never from estimates. Scene boundaries sit
just before each line, every line gets a beat of silence after it, and reveal
counters fire on the words that name them — read those offsets off the subtitle
cues edge-tts emits. Measured drift across a full play is 0.02 s.

## The branch theme — why three films sound like one organisation

Written for the branch, not licensed from anyone. Every film shares its key and
tempo; that is the whole reason they sound related.

| | |
|---|---|
| Key and tempo | **D major · 108 BPM** |
| Progression | **D – A – Bm – G** |
| Voicing | Pads, pluck, brushed hat |
| File | `rr-branch-theme.mp3` |

### The launch film's bed is played, not loaded

`benefits/launch-eb.html` synthesises its own score in Web Audio — no track to
licence, no file to ship.

- Progression **D – F#m – Bm – G – D – A – G – D**, plain, major, unhurried
- `8.7 s` per chord; eight chords carry the film
- Four voices per chord: two detuned saws through a soft low-pass (900 Hz,
  Q 0.4) for warmth, a triangle an octave up for air, a sine underneath for
  weight
- Long attacks and releases, so chords bloom into each other instead of stepping
- Sits well under the voice, lifts into the reveal, opens out for the close —
  the only two places a bed like this should be noticed

## WhatsApp messages to the branch — short, or nobody reads it

Every message written for the branch group follows the same four rules, and the
first one is the one that keeps getting broken:

| | |
|---|---|
| **Compact** | Under about 120 words. A 280-word message is a memo, and a memo in a WhatsApp group is scrolled past. |
| **Motivating** | Address the agent, not the branch. "Your name is on it", not "agents can see their names". |
| **Innovative** | Lead with the number nobody in the room already knows. One finding, not five. |
| **Prompts a comeback** | End with a specific ask that is easy to answer — *"Reply with one client you're calling Monday."* A message with nothing to reply to gets no replies. |

Shape: a bold one-line headline, two or three short paragraphs, one bulletless
finding, the ask. WhatsApp bold is `*single asterisks*`. No hard line wraps
inside a paragraph — WhatsApp reflows, and wrapped text arrives ragged on a
phone. Long-form detail belongs in the reply to the branch manager, not in the
group message.

If the picture carries a caveat banner ("preview · sample figures"), the message
does not need to repeat it.

## Hosting — the two chains never touch

| Source | Host | Serves |
|---|---|---|
| `RickyRampersadTermLIfe` (this repo) | **GitHub Pages** | rickyrampersadbranch.com |
| `fact-find-analyzer` | **Netlify** (project `factfinds`) | factfind360.com |

The `netlify.toml` in this repo is **inert** — GitHub Pages ignores it, so the
`/data/` block and the `/claims/` and `/renewal/` security headers it declares
are not applied. Do not treat it as protection.

`factfind360.com/ffproject` is served from **lowercase `ffproject.html`**.
Renaming it or changing its capitals moves the address every advisor already
has. Never deploy that site by dragging a folder onto Netlify — a manual deploy
replaces every file, and on 23 August 2026 that silently deleted
`walkthrough.html`, `insights.html`, `wall.html` and the 22 MB tour video. Two of
those are not linked from the home page, so nothing on screen showed they were
gone.

## The fact find — things that have bitten

**Emails are not in any repository.** The client approval letter and the manager
digest are both built in the **Google Apps Script** project. Searching this repo
or `fact-find-analyzer` for their text finds nothing; that is expected.

**Only life sums assured count as life cover.** `health` reimburses against a
schedule of benefits, `pa-di` pays a monthly income, `annuity-deferred` is a
savings target — none is payable on death, so none belongs in a total tested
against the life underwriting ceiling. Adding them is what produced a branch
"cover recommended" figure of TT$121m against twelve fact finds and a
recommend-ratio above 100% for every advisor at once.

**Check the type, never the name.** `Life Secure` and `Tophat` read as life
products and are both `annuity-deferred`.

**Five products carry no `type`** — `Lifestyle Pension`, `Lifestyle Privilege`,
`IPI`, `Rejuvenator`, `SPIA` — so type-based rules cannot see them. Get the
classification from the product sheet; do not guess one into a compliance
system.

**Products outside `PRODUCT_RULES` get no checks at all.** `Lifestyle Special
Edition` is not in the library, which is why the row carrying the largest figure
in a case was the one row nothing validated.

## The view counter — every page reports, one sheet records

Every served HTML page carries a `<!-- rrb-views -->` beacon before `</body>`.
It pings the Apps Script in `gs/views-counter.gs`, which appends
`time · page · referrer` to the **"RRB Site View Counter"** spreadsheet
(ID in the .gs). No client data — path and referrer only.

- **Keep the beacon** when regenerating or rewriting a page; re-add it if lost.
- `RRB_VIEWS_URL` in the beacon is replaced with the deployed /exec URL —
  if you see the literal placeholder, the counter is armed but not yet live.
- Redirect stubs (`about-us/`, `health-1/`, `xpress-life-application/`) and
  `apps-script/` templates deliberately carry no beacon.

---
---

# donthaveanagent.com — working notes

Guardian Life of the Caribbean, Trinidad & Tobago. Two products live here:

- **`donthaveanagent/`** — donthaveanagent.com, the site for orphan
  policyholders. Publishes on Netlify with `donthaveanagent` as the base
  directory, so only that folder reaches the web at that domain.
- **`service/`, `renewal/`, root `netlify.toml`** — the branch site
  (rickyrampersadbranch.com), including the Service Questionnaire. That site
  is on **GitHub Pages**, so the root `netlify.toml` is inert there (see the
  hosting note above). donthaveanagent.com is on **Netlify** with
  `donthaveanagent` as the base directory, and **`donthaveanagent/netlify.toml`
  is live** — its redirects and headers are real.

Both talk to one Apps Script backend, `apps-script/Service.gs`.

### What the domain is actually serving — check before believing a report

On 7 September 2026 donthaveanagent.com was still serving a **snapshot from
22 August**: the oxblood theme, the 78-second launch film, three old MP4s,
and a 404 for everything made since (`client-film.html`, `process-film.html`,
`wall.html`, `preview.html`, the ad). `main` has never carried a
`donthaveanagent/` folder, so that snapshot did not come from a git deploy —
it is a manual upload, or a build that has been failing since.

So a note like "the birthday is not in one and in the other" is usually the
old cut on the domain against the new cut in the chat. Before hunting a bug,
`curl -sI https://donthaveanagent.com/<file>` and compare `Content-Length`
with the file in the repository.

To put the current site live: merge the branch, then in Netlify confirm the
site is **linked to this repository**, production branch `main`, base
directory `donthaveanagent`. If the site was created by dragging a folder, it
is not linked to anything — either link it (Site configuration → Build &
deploy → Continuous deployment) or download the repository zip and drag the
`donthaveanagent` folder onto Netlify Drop again. A drag-and-drop deploy
replaces every file, so it must be the whole folder every time.

---

## Where the soundtrack is stored

**`tools/film/audio/inspired-kevin-macleod.mp3`** — "Inspired" by Kevin
MacLeod, 4:46, CC BY 4.0. This is the single source every film's music bed is
built from.

It was for a long time held only in a session scratchpad, which is deleted
when the container is reclaimed. It now lives in the repository so the films
can always be re-encoded. `tools/film/audio/ATTRIBUTION.md` carries the
licence and the exact credit line that must accompany it.

The repository root is published for the branch site, so this file is
reachable on the web. That is acceptable — CC BY permits redistribution — but
do not put anything there that is not licensed for it.

To change the music, drop any audio file in and rebuild every bed at once:

```bash
cd tools/film
python3 usetrack.py /path/to/new-track.mp3     # rebuilds bed-*.wav for all films
```

Per film, `films.json` sets `start` (the second of the track to begin at, since
the opening of a cue is rarely its most lifting minute) and `musicgain` (the
bed level under the voice; the wall film uses `0.62`, about −21 dB RMS).

---

## The films

| Film | Page | MP4 | Length |
|---|---|---|---|
| Client film | `client-film.html` | `dhaa-film.mp4` | 148s |
| What happens next | `process-film.html` | `dhaa-process.mp4` | 110s |
| The agent's side | `agent-side-film.html` | `dhaa-your-side.mp4` | 86s |
| For agents | `agent-film.html` | `dhaa-agent-film.mp4` | 79s |
| How we work | `how-we-work-film.html` | `dhaa-how-we-work.mp4` | 87s |
| The branch wall | `wall-film.html` | `dhaa-wall.mp4` | 118s |

All six are narrated on **`en-US-AndrewNeural` at −12%** (the ad at −8%); the
lengths above are from the 7 September 2026 re-voice, which is also when the
process film gained its month-by-month birthday strip and the "looked after
by" chip on the worklist. Every film page pauses on a tap in the middle of the
screen and carries a clock in its control row.

**Never put a real client name or a real client count in an MP4.** The files
sit at public URLs even when the pages are `noindex`. Every number on screen
is illustrative.

### The player — every embedded film goes through `player.js`

A `<video>` with no `controls` is a film nobody can pause. The site pages
used to switch the browser's controls on after the cover was tapped, which
on a phone means a bar that hides itself in two seconds and a viewer who
cannot find the way back. `donthaveanagent/player.js` replaces that on every
`.vwrap` that holds a `<video>` and a `.vcover`:

- tap the picture to pause and to resume, with a glyph that flashes
- a seekable rail with **a dot for every scene** and the scene's name beside it
- elapsed / total, mute, full screen; the rail folds away while playing and a
  thin line at the foot keeps showing progress

The scene dots come from `data-scenes` (the film's `durs` out of `films.json`)
and the names from `data-chapters` (each scene's eyebrow in the film's own
page). **`tools/film/chapters.py` writes both onto every page** — run it after
any film is re-timed, never type them. A page that includes `player.js` must
not also switch native `controls` on; the two fight over the same taps.

`preview.html` (`/preview`) lists every film and both ad cuts through the
same player, grouped by who sees them. It is the place to check a cut.

### The social ad

Two cuts of one 23-second spot, both from `donthaveanagent/ad-reel.html`:
`dhaa-ad-reel.mp4` (9:16, Reels and Stories) and `dhaa-ad-feed.mp4` (4:5,
feed). The 4:5 rules are a `@media (max-height:1400px)` block in the same
page, so recording it at 1080×1350 gives the feed cut with nothing to keep in
step. Copy, targeting and the rebuild commands are in
`tools/film/AD-COPY.md`.

`mixany.py` takes `w`, `h`, `capmode`, `capsize` and `capwrap`. The films use
`capmode: "strip"` — picture cropped, captions in a band beneath. The ads use
`"over"` — captions burned across the frame with an outline, because most of
the audience watches with the sound off.

### Re-voicing one — `revoice.py`

When only the voice has to change, the words are already approved and the
scenes only need re-timing to the new read:

```bash
cd <scratch>            # the vox directories live outside the repository
python3 tools/film/revoice.py client voc3 voc4 donthaveanagent/client-film.html
```

It reads each scene's line back out of the old `NN.vtt`, renders it on
`en-US-AndrewNeural`, keeps the air every scene had around its old line
(floored at 1.2 s), rewrites `data-d` in scene order, and updates `durs`,
`dur` and the tick cues in `films.json`. Then `record.js` and `mixany.py` as
below. The wall page is generated, so after re-voicing it `wall-timing.json`
is rewritten and `build-wallfilm.py` must reproduce the same `data-d` — the
Phase A script asserts exactly that.

### Rebuilding one

The pipeline is in `tools/film/`. It needs `edge-tts`, `ffmpeg` **with
libass**, Playwright with Chromium, numpy.

1. **Narrate.** One file per scene, numbered, into a `vox` directory:
   ```bash
   edge-tts --voice en-US-AndrewNeural --rate=-8% \
     --text "…" --write-media vowall2/01.mp3 --write-subtitles vowall2/01.vtt
   ```
   **`en-US-AndrewNeural`, never the Multilingual variant** — see the house
   rule above. The Multilingual voice reads a phrase in another language when
   it feels like it, and it did exactly that on the first cut of the wall
   film. Every film was re-voiced on the plain voice on 7 September 2026
   with `revoice.py`; nothing published carries the Multilingual voice any
   more. `-8%` for a short spot, `-12%` for a walkthrough.
   Then convert each to WAV — **the mixer reads `NN.wav`, not `NN.mp3`.** Miss
   this and it encodes silently with no narration; the giveaway is
   `speech covers 0% of runtime` in the mixer's own output.

   Spell URLs as words: `donthaveanagent` as one token comes out as
   gibberish. Write "Don't have an agent dot com, slash wall".

2. **Time the scenes from the audio, not by guessing.** Measure each line and
   set `data-d` to the line plus about 1.15s of air. Put the same list in
   `films.json` as `durs`.

3. **Sound design and bed:**
   ```bash
   python3 sfx.py "$(python3 -c 'import json;print(json.dumps(json.load(open("films.json"))["wall"]))')" sfx-wall.wav
   python3 usetrack.py audio/inspired-kevin-macleod.mp3
   ```

4. **Record** with `record.js <page> <capture-dir> <seconds>` (Playwright,
   1280×720; `record-film.js` is the wall-only original). Run it with
   nothing else on the machine — CPU contention corrupts the capture timeline
   and the encode will be rejected.

5. **Mix and encode:**
   ```bash
   python3 mixany.py "$(…films.json…)" dhaa-wall.mp4
   ```

### What the pipeline knows that you don't

- **Playwright's capture runs slow.** It writes at a nominal frame rate it
  never achieves, so `video_t = LEAD + STRETCH * film_t`, with STRETCH around
  1.13. `mixany.py` measures this from the film's own scene transitions and
  undoes it. Do not assume the capture is real time.
- **The fit is by RANSAC, not index pairing.** Two adjacent scenes that look
  alike fall below the detection threshold, so the detected transitions do not
  line up one-for-one with the schedule. Every pair of correspondences
  proposes a (LEAD, STRETCH) and the proposal explaining the most transitions
  wins. It refuses to encode if the residual is too large — that guard has
  caught three corrupted recordings; do not weaken it.
- **libass.** The `imageio_ffmpeg` bundled build has no libass, so the caption
  burn has no filter to call. `mixany.py` now picks the first ffmpeg that
  reports a `subtitles` filter. On a fresh container: `apt-get install ffmpeg`.
- **Captions are clamped to the next cue's start**, so they never overlap —
  libass stacks overlapping cues and pushes a line out of the strip onto the
  picture.
- **The strip.** Video is cropped to 1280×616 and padded back to 720, with
  captions burned into the band. Scene content must sit inside the top 616px.
- **Loudness** is two-pass loudnorm to −14 LUFS with the true-peak target set
  to −2.0, which actually delivers about −1.8; linear mode will not reach its
  stated ceiling.

---

## The backend — `apps-script/Service.gs`

**Container-bound.** It uses `SpreadsheetApp.getActiveSpreadsheet()` and
`getUi()`, so it must be created from the Sheet (Extensions → Apps Script). A
standalone project returns null and throws.

**The project is three files, not one:** `Service.gs`, `Transition.gs` and
`ServiceSalesforce.gs` (the Salesforce trace a review runs before it files).
On 23 September the live project had only the first two, and every review
and questionnaire from the website failed on the backend with
"svcSplitName_ is not defined" — the client saw a done screen and nothing
was filed. `Service.gs` now guards those calls, but the file belongs in the
project. After any paste, submit one test review and read the reply: a
reference from the server, not the page's local fallback.

**A full paste of `Service.gs` blanks `TEAM_CODE`** (the repository copy
ships it empty because the file is public). Re-enter it after every paste,
or the wall and the responses page lock everyone out.

**Re-deploying:** Deploy → Manage deployments → pencil → New version. Using
*New deployment* instead issues a fresh `/exec` URL and every front end has to
be re-wired.

**Front ends holding `API_URL`** — all six must be updated together if the
deployment URL ever changes: `donthaveanagent/agents.html`, `how-we-work.html`,
`review.html`, `status.html`, `wall.html`, and root `service/index.html`. Both
POST paths send `text/plain` so Apps Script never gets a CORS preflight it
cannot answer.

**A POST to `/exec` returns a 302.** Browsers convert that to a GET and it
works. `curl -L` re-POSTs to the redirect target and gets a 405 — that is
curl, not a broken backend.

**Settings that ship empty on purpose:** `CS_EMAIL` (Guardian Customer
Service — until it is set, everything routes to the branch alone and says so),
`TEAM_CC`, `TEAM_CODE`. `SALES_SUPPORT_EMAIL` is
`rickyrampersadsalessupport@myguardiangroup.com`.

**Sheet tabs used as the datastore:** Service Questionnaires, Group Service
Questionnaires, Agent Skill Bank, Link Activity, Callback Requests, Service
Activity — plus two that create themselves on first write: **Client Responses**
(a client's one-click answer to a transition letter, `action=resp`) and
**Team Feedback** (an agent's verdict on a letter or the film from the team
review page, `action=feedback`).

### The campaign is the wall's first two slides

The branch agreed to work its own orphan book, and that is the core KPI, so
the wall opens on it rather than on activity counts. `SVC.CAMPAIGN` holds the
book size, the target, the end date and the per-agent weekly commitment;
`campaignStats_` derives everything else — progress, days left, the weekly pace
needed to finish on time, who has met their number this week and who has not.

The measured unit is **a review filed**, because that is the only thing the
system can see end to end. A conversation nobody files does not count.

`book` and `target` ship at zero and the wall says the target is not set rather
than showing a percentage of nothing. Do not put a placeholder number there —
a fabricated target on a screen the whole branch walks past is worse than no
target.

### The lifetime promise runs off one trigger

"A review every six months and every birthday month, for life" is on eight
pages and in every film, and all of it — plus the chase when we miss our own
deadline, and the "still on it" note while a file is open — hangs on the daily
`dailyServiceFollowUp` trigger.

`setupService()` installs it. It used to be a menu item nobody was told to
click, which meant the central promise of the product could silently never
fire. `automationOn_()` reports whether it is scheduled, the `ping` returns it
as `automation`, and the wall shows a red banner across the bottom when it is
off. Never remove those; a quiet failure here is invisible for months.

### The documents are the point

Form **2000-03-147** is reproduced exactly — same title, same twenty questions
in the same order and words, same YES/NO boxes, down to the form number. Both
front doors produce it; a review from donthaveanagent.com is mapped onto the
printed questions by `paperAnswers_`, and questions the shorter review never
asked are named in the addendum so a blank is never mistaken for a client who
declined to answer.

**Page 1 must fit one US Legal sheet** — 1344px at 96dpi, currently sitting at
about 1302. Anything added to page 1 has to be measured. Extra questions go on
the addendum page, inside the same document.

---

## The transition campaign — when agents leave

Built in September 2026 for nine books whose agents resigned together. The
manual is `orphan-transition/index.html`; the client-facing pieces are
`orphan-video/` (the film and the two doors) and `orphan-video/protected.html`
(the Insurance Act's policyholder protections, quoted and explained). **The
letters link to `/your-policy/` and `/your-policy/protected`**, two stubs that
forward to those pages with the query string intact — "orphan" is the trade's
word for these clients and must not appear in an address a client holds.
`/vid/` is the film alone, for WhatsApp, and `/templates/` is the one page
for the team: the film, letter F in full, every opening and one verdict
form, with all the letters folded away beneath — generated by
`build-letters.py` with the letters, never edited by hand (run `chapters.py`
after it, to mark the film's chapters there); `tools/film/chapters.py` walks
`/vid/`, `/templates/` and
`orphan-transition/` too, matching the film by file name, so a re-timing
reaches every page that embeds it.

**The branch film is built from one file.** `tools/film/orphan-lines.json`
carries, per scene, the spoken line, the words on screen and the visual
(`title`, `statement`, `keeps`, `keeps-off`, `keeps-find`, `pivot`, `lock`,
`act`, `creds`, `click`, `close`); `build-orphanfilm.py` renders the page from
it, and `voice-lines.py orphan-lines.json <vox> --changed-only --timing
orphan-timing.json --films films.json --key orphan` voices only the lines
whose words changed, keeps every other recording, and times the scenes from
the audio (line plus 1.15 s of air, plus `extra` where a scene asks for it).
Then `build-orphanfilm.py`, `sfx.py`, `usetrack.py <track> orphan`,
`record.js` (alone on the machine, with the poster path so the poster is
re-shot), `mixany.py`, `chapters.py`. The mixer reads the vox directory named
in `films.json` **beside itself** (`tools/film/voorph`, git-ignored) — copy
the new WAV and VTT files there before mixing, or it re-encodes the old
voice under the new timing and the caption gives it away.

- **Nothing names or characterises anyone who left.** "Your representative
  has moved on from Guardian Life" is the whole reference — in every letter,
  page, film line and script. No reason, no tone, and no warning that someone
  may approach the client: ask whether someone has, never say who might. The
  one exception is letter T, for a contract Guardian Life terminated in
  writing: see its own bullet below.
- **Segment counts, client names and per-book figures stay outside the
  repository.** The segment file, merge file, send list, deep-dive report and
  household list are built in the session scratchpad from the Branch
  Portfolio sheet. Branch-wide activity counts (birthday notes, reminders) are
  fine on an internal page; per-book client counts are not.
- **Every Act quotation on `protected.html` was checked against the source
  text** (`act2018.dec.txt`, decoded from the published PDF — lowercase, no
  spaces, digits garbled). **No section numbers anywhere**: the PDF's font does
  not yield them reliably, and an invented one is worse than none. Compliance
  supplies them if they are ever wanted.
- The Act binds "an agent, agency, broker, brokerage or a sales
  representative" in one sentence. Wherever the material says what an agent
  may not do, say broker too — that is where departing agents go.
- **The letters are generated** by `tools/letters/build-letters.py` from the
  words in `tools/letters/openings.json`. Edit those two, never a letter. One
  run writes the letters, `/templates/`, and the letter cards and merge-field
  table on the manual and the team page (between `<!-- letters:start -->` and
  `<!-- fields:start -->` markers). The shell is compact on purpose, decided
  22 September 2026 ("a much more catchy, condensed letter"): a headline, one
  paragraph of under 45 words, a strip of facts read off the Branch Portfolio
  sheet for that client (`{{paid_to}}`, `{{days}}`, `{{projected_lapse}}`,
  `{{first_year}}`, `{{issue_date}}`, `{{app_received}}` — days and dates,
  never a money figure), the client's own record with the branch team (see
  below), the one-tap answers, the film in one line, and the closing.
  **The notice is the second thing the client
  reads**, straight after "Dear": "Your representative, X, has moved on from
  Guardian Life. Your policy has not." — asked for in those terms on 22
  September ("now officially letting them know that the agents have moved
  on, that important letter"). It is in the shell, once, in the same words
  on every letter; an opening never repeats it. `{{token}}` and
  `{{segment}}` travel with every tap so responses read by segment.
- **Fourteen letters: five situations, the in-force letter in five tenure
  versions, two check letters, T for a terminated contract (its own
  bullet below) and T1 for a client of that book whose application is
  still in progress (the terminated notice, then the application letter's
  own words and question, because cover is not in place until the policy
  is issued; T1 sorts with T, and `tHold_` holds it like T without an
  agent name or a date).** Condensed to six on 22 September ("condense the amount of
  letters so we will be focused"); on 23 September the in-force letter was
  split by how long the client has held their longest in-force policy —
  "we have banded 5 so each is different, wanting feedback with a catchy
  line" — F1 under two years, F2 two to three, F3 three to five, F4 five to
  ten, F5 ten or more, the same bands as the reassignment workbook. Each
  version has its own headline and opening and puts the feedback tap
  (`review`) first; the fixed notice and the shell are the same on all.
  The situations: A (matured, or maturing within six months), G (lapsed),
  I (a premium due: a row the sheet flags `Overdue` in Status(2) with more
  than sixty on its Days column — the days outstanding and the projected
  lapse date are printed, so the letter need not say how far behind),
  J (contract not delivered), K (application in progress). Paid up, waiver
  and payroll clients take their tenure version. Nothing-held clients are
  not written to. On 24 September, asked for because clients on these books
  had cover ended and restarted ("the only person that suffered was the
  client"), an in-force client with a policy that lapsed or was surrendered
  between six months before and a year after another began gets **R1**
  (newest such start inside three years) or **R2** (before that) instead of
  a tenure version: a free check of the file and of who the policy pays.
  Its "with us since" counts every policy ever issued, ended ones too.
  The letter states only what the client's own record shows — cover that
  ended and started again — never how, never by whom; the rule about
  anyone who left holds here more than anywhere. Do not grow the set beyond
  this without being asked: the team reads one page, and the taps carry the
  difference. A letter can reword a tap for itself (`tap_text` in
  openings.json — R1 and R2 call `callme` "Check my file with me") without
  changing what the tap records, so no backend change is needed for it.
- **Letter T names the agent, and it is the one letter that does.** Decided
  24 September 2026 on Guardian Life's own written notice that it had
  terminated an agent's contract with immediate effect following an
  investigation: every client on that book must know who may no longer act
  for Guardian Life ("his clients get a notification he was terminated with
  immediate effect … and is not authorised to conduct any business on behalf
  of Guardian Life"). The notice card and the subject carry the company's
  notice and nothing else: the contract was terminated, on a date, as a
  result of an investigation, and the agent is not authorised to act. Never
  why, never the grounds, never anyone else's name. `{{agent_name}}` and
  `{{terminated_on}}` are filled from the sheet (the Agent column and a
  `terminated_on` column, letter T only), so neither the name nor the date
  is in the repository; a T row without either is held. The name in the
  notice sits between the `<!--agent-->` marks like the standard notice's,
  because `tLetters_` refuses any letter that carries `{{agent_first_name}}`
  without them (the first cut of T did not, and the Test run stopped with
  "carries no agent markers" before it sent a row). The letter asks
  whether the agent has been in touch since that date (`contact`: the agent
  is named on the letter through `LETTER_Q`, and the page and the receipt
  ask it in neutral words, because a merge field inside the recap would
  stop the receipt); "Yes" brings a call before anything else. It carries a
  `paid` tap for a premium handed over that is not showing, its checks sit
  above the taps (`checks_first`), and its rows sort first (`ORDER`). The
  subject says "no longer with Guardian Life", not "no longer with us",
  which reads as a death. Compliance sees the words before that batch goes.
  The rule that nothing characterises anyone who left holds everywhere
  else, and this letter goes only to a book whose agent Guardian Life
  itself terminated in writing.
- **The branded letter is the design; the plain letter is what the connector
  can carry.** Design pass of 24 September ("polish up the fonts and make it
  more appealing and graphical, a wow template"): a navy hero with the
  brand, the headline and the preheader as its subline; the notice in a
  gold-edged card; the facts strip; the service record as stat tiles; the
  checks as pills; the first tap a navy card with a gold title, the rest
  white; the film as a picture with a play badge (`orphan-video/film-card.jpg`,
  rendered by `tools/letters/film-card.js` from `film-card.html`, committed
  because the letters link to the hosted copy) over a navy caption bar; the
  signature on a gold rule. Fonts: the branch face where a mail app loads the
  `<link>` (Apple Mail, iOS Mail), the phone's own face elsewhere (San
  Francisco, Segoe UI, Roboto); Arial last. All tables, inline styles and
  two hosted images, so any mail app can show it. **None of it reaches a
  client through the Microsoft 365 connector**: that route accepts tags
  only (p, br, a[href], b, i, lists, h1–h6, table, hr, div) and rejects any
  attribute, image or style outright (checked with a draft on 24 September).
  The plain letters carry the same words with headings for structure and
  nothing else. The branded letter goes out only from Transition.gs through
  Microsoft Graph, which needs the Entra app; until then the "wow" is on the
  site and the team page, and the client gets the plain one.
- **Every subject line is the notice.** Decided 24 September ("on the
  subject line shall we put the names … more catchy"): `{{agent_or_rep}} has
  moved on.` and a short tail — "Your policy has not." on the in-force and
  check letters, the urgent point on the action letters. `{{agent_or_rep}}`
  is the agent's first name, or "Your representative" when the sheet has
  none, filled by `fill-plain.py` and by `tFill_` in Transition.gs alike.
  "Moved on", never "left": the notice's own words, nothing more.
- **Quick checks, answered in the e-mail itself.** First two questions on
  24 September — questions that would show a client what nobody had told
  them. A letter may not say or suggest that; it asks what the client
  knows, and an honest "not sure" makes the point by itself: *Do you know
  who your policy pays today?* and *Has anyone suggested you cancel, cash in
  or replace a policy?* Then, the same evening, after the staff test ("when
  click on this it taking too long to open and would like this as a check in
  the email! It must be easy for a client!"), the long review behind "Tell
  us more about yourself" became checks too: *How have we looked after you
  so far?* and *Has anything changed for you since you took out your
  policy?* The in-force letters ask all four, and ask them before the taps,
  because the rating is the letter's feedback; R1 and R2 ask the rating and
  the two originals; G asks the life change and the approach; the action
  letters keep the originals under their taps. Every answer shows as a box
  to tick (☐) and rides an existing tap — `informed` for a noted answer,
  `callme` for "Could be better", "Yes: family, home or work" and "Not
  sure", `urgent` for "Yes, talk to me first" — with the answer itself in
  `q=`, which lands in the Page column of Client Responses
  (`/your-policy/?q=rate_better`), so the backend needs nothing new. The
  full review is one line under the taps ("Would you rather tell us in your
  own words?"), not a tap. `QUESTIONS` in build-letters.py is the one list:
  the letters, and the page a tap opens, are both written from it.
- **The questions are offers, not check-ups.** Rewritten the evening of 24
  September 2026 after the manager read them as a client would: "asking if
  they advise to cash in is not a nice question, as the objective is to
  have them stay and not go with the agent, and want a review … deep dive
  and research very appealing questions that will give great responses as
  well as show our service levels". The principles applied (customer
  research on question wording: positive framing, help inside the
  question, the caring answer as the easy first option, "your policy"
  throughout, an easy question first and the commitment last): `rating`
  (unchanged, the feedback, first); `life` ("has life moved on: a new
  home, a new job, someone new in the family?" → "Yes, update my cover"
  brings a call); `pays` ("would you like us to confirm, in plain words,
  exactly what your policy pays and to whom?"); `checkfirst` ("if anyone
  ever suggests you change or replace your policy, would you like us to
  check it with you first, free?" → "Yes, always check with me first",
  "Someone already has. Call me", which is how a rival approach is heard
  without a question that sounds like suspicion, or "I will decide
  myself", the polite way out, because a question with no soft exit
  lowers response; the old `approached` question is gone); `stay`, last
  on every in-force letter ("Would you
  like our branch team to keep looking after your policy?", the letter's
  own version naming the year since which the team has looked after it,
  `LETTER_Q`, the year between fact markers so an application reads
  without it); `value` on the lapsed letter (the free look at what the
  policy still holds, as a question). Every "yes" that asks something of
  us is a `callme`; nothing on a check opens the form any more. The
  service record panel above the questions is the evidence the questions
  lean on; the questions never quote a count themselves, because a blank
  cell would break the sentence. **Modelled by band** (25 September: "did
  you model it by age bands … our biggest is the under 5 years"): F1
  swaps the life question for `walk` (a plain-words walk-through of what
  the policy does, since under two years it may never have been
  explained) and asks the rating "since you joined us"; F3 swaps `pays`
  for `built` (what the policy has built so far); F5 swaps the life
  question for `more` (what more the cover could do now: family,
  retirement, health) and asks the rating "after all these years"; a
  letter's own wording of a question is `question_text` in openings.json.
  **The two letters with a hard question first** (`checks_first`): J,
  "Has your policy contract reached you?" (`received`: "No, it never
  reached me" is the `deliver` tap itself; "Not sure what I should have"
  a call), because the record says the contract was collected for
  delivery and never acknowledged, and the letter says exactly that; and
  K, "Is anything you were asked for still outstanding: a medical, a
  document, a signature?" (`outstanding`: "Yes, help me finish it" is the
  `finish` tap, "I no longer wish to proceed" the `stop` tap), with the
  opening now saying plainly that the cover applied for is not in place
  until the policy is issued, because that is the truth that makes a
  client finish. T carries `received` too, since a third of that book's
  contracts were never acknowledged.
- **Who gets letter J: the contracts the Power BI export shows dispatched
  and never acknowledged, dispatched in the last two years.** The
  conservation export from Power BI (`pbi-conservation.xlsx` in the
  session scratchpad) carries, per policy, `Dispatch Date`,
  `Acknowledgement Date` and `Delivery Category` ("Undelivered" when the
  acknowledgement is blank); it is the acknowledgement of record. A first
  cut on 25 September read "no acknowledgement" off Salesforce and the
  Log Book instead and put four hundred-odd clients on J; the export
  showed all but a handful of them acknowledged, so never infer
  non-delivery from the Log Book, which records a fifth of
  acknowledgements at best. Salesforce adds two things: the "Guardian
  Life Policy Delivery Update and Next Steps: Policy Contract Received
  for <client> Policy Number <n>" e-mail task, dated the day the contract
  was given to the agent to deliver (that date is `collected_on`, a
  column on the send list and a fact on J and T, with the PBI dispatch
  date as the fallback), and the "Undelivered Script <client> <policy>"
  tasks, sales admin's chase, which stand in for a policy the export
  does not carry. Older undelivered contracts (dispatched before the
  two-year cut, some as far back as 2003) are not written to about a
  contract the client has plainly lived with: they go to the team as a
  call list. A client already on I, K, A, G or T keeps that letter and
  gains the contract date; the rest move to J, first wave. The pending
  applications are the rows the sheet flags `Pending` in Status(2)
  (every one of them reads "Underwriting incomplete", "Missing Reqts" or
  "Awaiting Settlement" in Status Description, which is the rule
  sendlist.py applies), and the team gets them as a list too, with the
  status description, for assignment. Counts stay outside the repository. The research behind the shape, checked
  on 25 September 2026: a positive frame rates better on identical facts
  (Levin, Schneider and Gaeth 1998); asking a customer how they were
  looked after cuts defection for a year afterwards (Dholakia and Morwitz
  2002); "your policy" is worth more to its owner than to anyone else
  (Kahneman, Knetsch and Thaler 1990); two or three options beat a list
  (Iyengar, Huberman and Jiang 2004); easy questions first and the
  commitment last (Dillman); a gift given before the ask lifts response
  far more than one promised after it (Church 1993), which is what the
  free checks inside the questions are; and the FCA's redress letters
  trial (Adams and Hunt 2013) found short bullets, "takes five minutes"
  and a reminder at three to six weeks lifted response, while a
  big-name signature lowered it. Words to keep out of a client's letter:
  orphan, reassigned, lapse, book, and "verify" or "confirm your
  details", which read as phishing. There is no controlled study of
  orphaned policyholders; the industry figures (Capgemini and LIMRA's
  World Life Insurance Report 2027: nearly forty per cent rarely or never
  hear from insurer or agent after buying; J.D. Power 2025: any contact
  in the past year lifts satisfaction) argue for the six-month and
  birthday reviews the branch promises, and for a second letter to
  anyone who has not answered in three to six weeks.
- **Every answer opens the page; the reply mode is built, tested and
  switched off.** Three decisions in an hour on the evening of 24
  September 2026, after the first Test letters were read on a phone. "When
  you are clicking on the question its opening the browser and this is not
  supposed to be happening, its supposed to be inside the email for easy
  use", then "for all it should not open any browsers": so every check and
  tap became a `mailto:` to support@ (`reply_link` in build-letters.py: the
  answer as the subject, the question and the answer as the first lines of
  the body, a spare line for anything more, `Ref: <token> <tap> <answer>`
  on the last line; the two questionnaire doors as replies whose body asks
  for the client's words, `REPLY_LINES`). Then the first reply was tried:
  "when i check the question and answer it moved to the email reply!!! its
  supposed to allow me to answer all the questions and capture the
  responses", which only the page does. Offered the three ways there are
  (the page; one reply per answer; one reply listing every question with
  an X to type), the manager chose the page. `ANSWER_MODE` in
  build-letters.py is `'page'`; `'reply'` rebuilds the letters the other
  way, and `receipt.json` `reply.mode` and `reply.form_taps` (every tap in
  page mode) tell the receipt and the test which way the letters were
  built, so Transition.gs needs no paste for a switch. `transitionInbox`
  (Transition.gs, every five minutes, installed by setup and go live)
  stays on in either mode: it reads the support@ inbox through Graph
  (application permission **Mail.Read**, admin consent, on the same Entra
  app), changes nothing in the mailbox (a reply stays unread for the
  team), files a reply carrying a reference on Client Responses exactly as
  the page files a tap (`Page` = `/reply?q=…`, `Referrer` = `reply <message
  id>`, which is how a message is never filed twice), matches a reply with
  no reference to the client by its sender address and files it as a
  `question` with `q=wrote`, and puts the client's own words in the Note
  cell (`tWords_` strips the pre-written lines in `receipt.json`
  `reply.lines` and anything quoted beneath); the receipt quotes those
  words back. So a client who simply replies to a letter is captured with
  what they wrote. The receipt offers the letter's other checks, how to
  reach them and, once a call is coming, when (`[[more]]`), as page links
  or replies to match. A merge field can never appear inside a reply body,
  since it is URL-encoded: a reply carries QUESTIONS' own words.
  `tap-test.js` checks whichever mode the letters were built in;
  `svc/inbox-harness.js` in the session scratchpad runs the reader's
  parsing on sample replies.
- **A tap opens one small page, at once.** `/your-policy/` with `r=` in the
  address is the whole journey: it records the answer, says what happens
  next, and offers the letter's other checks and *What is the best way to
  reach you?* one tap each on the page, without loading the film page or the
  form. Only `urgent` (and "talk to me first") and the full review go on to
  the form, a quarter of a second later. Before this a tap loaded the stub,
  the film page with its fonts and poster, waited 900 ms, then loaded the
  108 KB form — behind the mail scanner's own check. Without `r=` (the film
  line) it forwards to `/orphan-video/` as it always did. **A scripted
  browser records nothing** (`navigator.webdriver`): mail security, Avanan
  at Guardian among them, opens links in a headless browser, and it must
  never answer for the client. `tools/letters/tap-test.js` follows every
  link in every letter on a local copy of the site, with the beacons
  intercepted; run it after any change to the letters or the page.
- **The receipt: one e-mail, a few minutes after the client's last tap,
  that recaps everything they told us.** Asked for on 24 September ("recap
  the concerns and a bit more … Thank you, client name, we have received
  your response … a wow experience, and follow through"). `tAckClient_` no
  longer sends anything; `transitionReceipts` runs every five minutes
  (installed by `transitionSetup`, made sure of by `transitionGoLive`,
  also on the menu) and, for every token this campaign recognises with
  taps not yet marked `[receipt]` in their Note cell, waits until the
  newest is `RECEIPT_WAIT_MIN` old (three minutes, so a client ticking
  four checks gets one e-mail) — and, when a tap opened the form, until the
  review is filed or `RECEIPT_FORM_WAIT_MIN` (thirty) has passed — then
  sends one receipt and marks the rows. The e-mail: "Thank you,
  {{first_name}}. We have received your response."; when it reached us;
  **What you told us** (each quick-check answer with its question, a bare
  tap in the words the client tapped on that letter); **Your concerns, in
  your words** (the review filed under `Link ref` `transition:<token>`,
  the questions in `REVIEW_RECAP` that were answered, quoted); **What
  happens next** (one line per thing asked of us, the most pressing first,
  never the same line twice, the review's reference first when there is
  one); **How we follow through** (`FOLLOW`); the reply line; signed by
  the Client Support Team. Every word is in build-letters.py and travels
  in `receipt.json` (`recap`, `review`, `tpl`); the blocks arrive in
  `receipt.html` as `[[recap]]`, `[[concerns]]`, `[[next]]`, `[[follow]]`,
  unescaped, and `<!--recap-->` / `<!--concerns-->` are cut when empty.
  The review's own confirmation ("your service questionnaire is in", with
  the reference and access code) still goes from Service.gs as before, so
  a client who fills the review gets both. A noted answer ("Very well") is
  thanked too, with "nothing about your policy changes". The page a tap
  opens says a copy is on its way (`receipts: True` in the page's CHECKS,
  written by build-letters.py): **set it False if the letters go by hand
  through the connector**, where nothing sends a receipt on its own.
  `tools/letters/…/svc/receipt-harness.js` in the session scratchpad runs
  `tReceiptMail_` in Node on sample taps and a sample review.
- **Once a call is coming, the page asks when.** `WHEN` in build-letters.py
  ("When suits you best for a call?": morning, afternoon, evening) is asked
  on the page a tap opens whenever the tap was `callme`, and appears the
  moment an on-page answer brings a call, so the receipt's "at the time you
  chose" is true. The answer rides `informed` with `q=when_*` and is
  recapped like any other.
- **The review's own e-mails go from support@ too, once Microsoft 365 is set
  up.** `clientMail_` in Service.gs sends the questionnaire confirmation
  ("your service questionnaire is in", with the reference and access code)
  and the "Meet your agent" introduction through `tMsSend_` — which now
  takes Blob attachments for the PDFs — when the three Script properties
  exist, and from the script owner's account as before when they do not,
  because the reference and access code must always reach the client. The
  introduction is copied to `TRANSITION.CC`: it is the follow-through the
  receipt promises in writing.
- **The send goes in four families, one wave a day, and the reminder runs
  by itself from day 22.** Decided 25 September 2026 ("combine and regroup
  to ensure we scale proper and with a flow"). Every letter carries
  `family` in `openings.json` — *notice* (T, T1), *action* (J, K, I),
  *keep* (F1–F5, R1, R2), *return* (G, A) — and the family is the wave, so
  Client Support reads one day's responses before the next day's letters
  go: day 1 the notice and the action letters, day 2 F5, F4 and F3, day 3
  F2 with R1 and R2, day 4 F1, day 8 G and A, in working days from the
  go-live day (`WAVE` in `sendlist.py`, `WAVES` and `FAMILIES` in
  `build-letters.py`). The `Send on` column carries the dates; moving a
  wave is editing that column. **On the go-live morning, 25 September
  2026, every date was set to that day** ("so i need all to go out in
  batches today"; then "the run should be every 30 mins"): the whole list
  in one day, in batches of up to 120 every thirty minutes (`BATCH` and
  `SEND_EVERY_MIN` in Transition.gs; `transitionGoLive` replaces the send
  trigger with the configured cadence every time it is pressed, so a
  change is a paste and a press, never a second trigger beside the first).
  Three ceilings sit under that: Microsoft 365 takes thirty a minute from
  one mailbox, so a letter never follows the last inside `PACE_MS` (2.15 s,
  counted from when the last began, `tPace_`), which makes 120 a run four
  and a half minutes of the six a run is allowed, and a row is marked the
  moment it is sent, so a run cut short never sends a row twice — but a
  run Apps Script kills at six minutes writes no log line and shows no
  alert, which is what the first batch of the go-live morning did at 106
  letters (holding 95 same-address rows first cost it a minute and a
  half), so `RUN_BUDGET_MS` (five minutes) now stops the sending inside
  the run, says how many of the batch were left, and the next run takes
  them; and the
  script owner is a consumer Google account, whose triggers may run about
  ninety minutes a day in all — fourteen hundred letters take some fifty
  of them, the five-minute reads and receipts the rest — so on a heavy day
  the menu's "send a batch now" is the relief valve: a run started by hand
  is not counted. The team page opens on the four families and the path a
  tap follows, and the letter cards on the manual and the team page are
  grouped the same way. Every letter ends in the same four-step "What
  happens after you tap" strip (`FLOW`), which the receipt's
  follow-through and the team page repeat, so nothing is promised in one
  place that another does not keep. **The reminder is not a letter of its
  own**: `tRemind_`, at the end of every hourly batch and inside the same
  cap, sends the client's own letter once more to any row sent
  `REMIND_DAYS` (21) or more ago, still `sent`, whose token has no row on
  Client Responses and no review (`tAnswered_`), with `sent_on` set so the
  banner above the greeting says when the first went and the subject reads
  "Reminder:", and marks Status `reminded <date>` — never twice, `Sent at`
  untouched (it is the first send's date and what keeps the row out of the
  batch), at most `REMIND_MAX_PER_RUN` (30) a run, in its own try/catch so
  it can never stop the day's letters; `REMIND_DAYS` 0 turns it off. The
  FCA's redress-letter trial (Adams and Hunt 2013) is the reason: a
  reminder at three to six weeks lifted response more than any change of
  words. `svc/remind-harness.js` in the session scratchpad runs the pass in
  Node on a mocked tab.
- **The Act's own words are on every letter whose situation it speaks to,
  and the days are worked out on the day the letter goes.** 25 September
  2026: "include the insurance act and days to deliver and come across
  relevant … the agents who left hate you and your team". `act` and `plain`
  in `openings.json` put a teal card above the answers: the quotation, and
  what it means for this client in our words. J quotes the premium rule (a
  premium handed to a representative is deemed received by the insurer, so
  anything paid when the contract was brought counts and the receipt is
  Guardian Life's) and states the branch's own standard, personal delivery
  within 28 days — the words of the branch's delivery-update e-mail, sent
  to a client whenever a contract is ready since September 2025; K and T1
  quote the issue rule (an individual life policy is issued within twenty
  business days of acceptance of the risk); T quotes the revocation of a
  registration on notice of a termination, and says the Act requires the
  insurer to notify the Central Bank within five business days and that a
  premium handed to the agent while registered counts as paid; A the cheque
  rule (five business days); G the non-forfeiture rule (a policy whose
  surrender value covers the overdue premium is not forfeited); I as
  before. Under the check-first question on every letter, one line
  (`Q_NOTE`): no agent or broker may cause a policyholder to discontinue or
  replace a policy without first discussing the advantages and the
  disadvantages. **Every quotation was checked against `act2018.dec.txt`**
  with the capitals dropped and a hyphen read as `b`, which is how the
  decoded PDF garbles them (the check lives in the session scratchpad);
  still no section numbers anywhere. The days: `days_held` (J, from
  `collected_on`) and `days_open` (K and T1, from `app_received`) are
  derived at send time by `tDerive_` in Transition.gs and `derive()` in
  `fill-plain.py`, never stored on the sheet (`T_DERIVED`). `promised_on`
  (J) is the date of the branch's delivery-update e-mail to that client,
  taken from the Salesforce task by policy number, and the sentence "On
  {{promised_on}} we wrote to you that your policy contract would be
  delivered to you personally within 28 days" sits between fact markers
  inside the opening, so a client who got no such e-mail reads the letter
  without it. T also asks how the client pays today (`paying`: "in person,
  to a representative" is the `pay` tap, the one exposure after a
  termination). The send list is now 30 columns (`promised_on` after
  `collected_on`), and **Transition.gs must be pasted before any send, the
  Test rows included**: every letter now carries `{{sent_on}}` for the
  reminder banner, and the previous script stops each row with "carries
  {{sent_on}}, which this script cannot fill" rather than send it.
- **Two reports: the digest twice a day, and the Monday insight report.**
  Asked for on 25 September 2026 ("I need to have some serious insights").
  `transitionDigest` goes at the hours in `DIGEST_HOURS` (8 and 12, sheet
  time; Apps Script fires within the hour) to `DIGEST_TO` (blank = the
  script owner): tiles (sent, waiting, taps, reviews, late), then the
  insight block for the last day, by letter, taps, the late list, reviews,
  verdicts, last runs. `transitionWeekly` goes every Monday within
  `WEEKLY_HOUR` (7) to `WEEKLY_TO` (blank = `DIGEST_TO`; several addresses
  comma-separated): the week to that day, read for what it means.
  `tInsights_(days)` computes everything on the fly from the three tabs,
  staff Test rows never counted, and `tInsightHtml_` lays it out — tiles;
  "What it means" in sentences written only where there is data (response
  and how fast it comes, approaches by former book, the rating, who wants
  the pays check, stay or talk, contracts missing, applications, in-person
  payers, reviews, open and late answers with the median working days to a
  name, reminders and the answers after them, failed sends); by family; by
  letter; every question with each answer's count, share and bar (the words
  from receipt.json, so report and letters agree); by former agent's book
  sorted by approaches (the poaching map); when the first answer comes,
  from the day the letter went; taps by type; follow-through; the "to act
  on" list (clients whose answer is in `T_RISK`, open first, with who is
  named); the next seven days and the reminders due. Installed by
  `transitionSetup` and by `transitionGoLive` (`tWeeklyTrigger_`); the
  menu item "Transition: e-mail the weekly insight report now" needs a
  Service.gs paste, and until then the editor's Run button on
  `transitionWeekly` does the same. `svc/insights-harness.js` in the
  session scratchpad runs both on a mocked campaign.
- **Every client e-mail ends in the confidentiality footer, and every
  internal one says it is internal.** Asked for on 25 September 2026 ("the
  proper disclaimer … in the event of confidentiality you can take action
  and you are protected; review the laws in Trinidad under data
  protection"). `LEGAL` in build-letters.py is the one text: on the branded
  and plain letters, the receipt, and in receipt.json (`legal`), from which
  `tLegal_` in Transition.gs puts it on the "still on it" note and
  `clientMail_` in Service.gs on the questionnaire confirmation and the
  introduction, with the same words as a fallback in the script. The law
  it rests on, checked that day: the Data Protection Act 2011 (Chap.
  22:04) is only partly in force — Part I with the General Privacy
  Principles and the sections establishing the Office of the Information
  Commissioner came into operation on 6 January 2012; the private-sector
  obligations and penalties have not been proclaimed — so the footer
  commits the branch to the Principles by name, never to a section, and
  names the Commissioner's office as the authority the Act establishes,
  not as a court; the confidentiality duty is the Insurance Act 2018's own
  (no registrant, officer, employee or agent may disclose a policyholder's
  affairs without express consent unless the law compels it), quoted on
  protected.html. What it promises the client: the e-mail is for them
  alone; tell us and delete it if it came in error; their information is
  used only to look after the policy, never sold, never disclosed without
  express consent; they may ask what we hold and have it corrected; a
  concern can go to the branch, to Guardian Life or to the Commissioner's
  office, and raising it never changes how the policy is looked after.
  Compliance sees the wording. The digest, the Monday report and the
  internal chase carry `INTERNAL` ("do not forward outside the branch")
  because they carry client names.
- **The clients with no e-mail are a call list, and a phone answer is
  recorded on the client's own link.** Asked for on 25 September 2026
  ("persons who don't have email: the call list to get in touch with, how
  to handle"). The send list holds them with `no e-mail` in Exclude; the
  call list is built beside it in the session scratchpad from those rows,
  with the letter they would have had, the facts off the sheet, the phone
  and address off the portfolio, one line on why we are calling, and the
  client's own `/your-policy/?t=…&s=…` link. `orphan-transition/call-script.html`
  is the call: the letter spoken, in the same order, with the same
  questions, and the caller ticks the answers on that link with the client
  on the line, so they land on Client Responses and in the reports like a
  tap. `tInsights_` counts them on their own (`calls`: listed, reached,
  approached, by letter; the risk list marks them "by phone"), never among
  the letters sent, so the response rate stays the letters' rate;
  `tReceipts_` marks a no-e-mail token `[receipt] no e-mail: by phone`
  rather than holding it every five minutes, because on that call the
  caller is the receipt. Never call a row the list holds for a person to
  check first.
- **Every letter shows the client their own record with the branch team.**
  Asked for on 24 September ("they are to see us as from onboarding and a
  team service, as we have all the data on service levels"). A gold panel
  under the facts, "Handled for you by our branch team", one cell per count:
  documents handled (the Log Book, by policy number), requests handled
  (completed Salesforce service tasks), premium reminders, and the month of
  the last birthday note. `tools/letters/service-record.py` writes them onto
  the send list as `svc_docs`, `svc_requests`, `svc_reminders` and
  `svc_birthday`; run it after `sendlist.py`, on the same copies, outside the
  repository. A zero or a blank cuts its cell like a blank fact, and a client
  with nothing on record reads one line about the team instead (between
  `<!--nosvc-->` marks). The premium and lapsed letters leave the reminders
  out: a count of reminders beside a premium still unpaid reads as a
  reproach. **Only precise links count**, because the client reads the
  numbers: their own portfolio record, their policy numbers, a contact whose
  name is theirs, never an Account, which would lend one client a
  household's or an employer's history. Every service task in the branch's
  Salesforce was created by the branch team (sales support, the manager's
  assistant, the personal assistants, the manager), none by an agent, which
  is what lets the panel say "our branch team". Tasks begin in 2025 and the
  Log Book in 2023, so a count understates a long relationship and never
  overstates one. The pace line ("most within a working day") is the Log
  Book's own: three documents in four went on to Guardian Life within one
  working day in the twelve months to September 2026. Measure it again
  before changing those words. The panel says what the team did, never what
  anyone else would not do.
- **Transition.gs stops a run on an unfilled field.** A letter on the site
  carrying a `{{field}}` the pasted script does not know would reach the
  client as `{{svc_docs}}`, so the send throws before the first one. The
  copy in the project predates the service record: paste the current
  `Transition.gs` before any send from Apps Script. Import the send list
  with "Convert text to numbers, dates and formulas" ticked: the dates then
  print long, and the birthday month, which the import also reads as a date,
  is printed back as a month ("August 2026", never "1 August 2026").
- **The `review` tap opens the form.** It is the full review line now, not a
  card; the page a tap opens logs it and carries the client into the
  review, like `urgent`. Until 24 September it showed a thank-you and dimmed
  the review door, so the first tap on every in-force letter led nowhere.
- **Team verdicts on any letter are accepted.** `FEEDBACK_ITEMS` in
  Service.gs used to list the six original letters, and the backend
  dropped every verdict on F1–F5 in silence (the page still said logged).
  It now takes any letter key, one capital and an optional digit.
- **The `urgent` tap is the questionnaire door.** "I want an agent now. Let
  me tell you my concerns first" is on every letter (a card where it is one
  of the taps, a line beneath them where it is not). The client page logs it
  with the token and then forwards to the review, so the client states what
  went wrong before anyone is named and the branch reads it before it
  assigns. **No timeline is promised for the agent**, decided 24 September
  ("don't commit to assign an agent … their concerns will be reviewed and
  we will assign the appropriate agent, don't give a timeline"): every
  letter, tap, page line and receipt says the concerns are read by a
  person first and then the client is matched to the agent who fits, and
  nothing says when. "Next working day" and "within two working days" are
  gone from the campaign's client-facing words; `WAIT_URGENT` and
  `WAIT_DAYS` in Transition.gs are the branch's own targets for the chase
  and are never shown to a client. What is still promised is what Client
  Support controls itself: a call today or tomorrow, a receipt checked
  within two working days, a document on to Guardian Life mostly within a
  working day. The film's own line ("be matched, within two working days")
  and the donthaveanagent.com pages still carry the standing two-day
  promise; changing the film means re-voicing one line.
- **The pages are wired to the Service Questionnaire deployment** (the same
  `/exec` URL the six front ends hold) and ask it `action=ping` on load. Only
  a version carrying the `resp`/`feedback` actions answers with
  `campaign: 2`, so the team pages keep their amber "not recording yet"
  notice until Manage deployments → New version is published, then clear it
  themselves. Nothing to paste. Client taps fire regardless; against an old
  version they fall through to the form redirect and are lost, which is why
  no letter goes out before the notice has cleared.
- **The send runs from `apps-script/Transition.gs`**, a second file in the
  same container-bound project as `Service.gs`. It fetches the six generated
  letters from the site, fills the `{{fields}}` from the **Transition Send**
  tab, cuts a blank fact out between the `<!--fact:key-->` markers the
  generator writes, and sends it through Microsoft 365 as
  support@rickyrampersadbranch.com from a trigger every `SEND_EVERY_MIN`
  minutes (thirty), working hours only, up to `BATCH` (120) a run, the
  notice and the action letters first. A projected lapse date already gone by is cut at
  send time (`tDerive_`, and `derive()` in `fill-plain.py`): the sheet still
  flags the policy `Overdue`, so the projection did not happen, and
  "Projected lapse 18 August 2012" is not a fact a client can use — 88 of
  the first day's rows carried one; Paid to and Days outstanding still
  print. Forty of the I rows were more than a year past their paid-to date
  (the sheet's `Overdue`, most likely an automatic premium loan); the count
  was put to the manager before the first batch. No letter
  text lives in the script: rebuild the letters and the next batch carries
  the change. `transitionSetup` makes the tab and the 8:00 digest only;
  `transitionPreviewToMe` sends one of each to the owner;
  `transitionSendTest` sends the rows marked `Test = Y`, live or not, and
  sends them all again on every press, sent before or not (24 September,
  evening: the branch could not find the Sent at cells to clear) — and a
  Test row is always a team member standing in as a client, never a client's
  own row, because that button sends whatever carries the mark;
  `transitionGoLive` (menu: "Transition: go live") sets the `transition_live`
  script property and installs the hourly trigger, and `transitionPause`
  clears both — until go live, the hourly run sends nothing, however long the
  list sits in the tab. A row with anything in Exclude never sends; a row with
  no Send on date is held; a sent row never sends twice; a row the sender
  cannot use (no e-mail, no first name, no letter for its segment) is moved
  to Exclude with the reason. The page and the digest show a red banner while
  the send is off, and the last runs with their reasons.
- **Every client e-mail goes out as support@rickyrampersadbranch.com,
  never from Gmail.** Decided 23 September: "we need to have
  support@rickyrampersadbranch.com and copy" the sales-support and branch
  manager's Guardian addresses. The letters, the receipts and the "still on
  it" notes go through Microsoft Graph (`tMsSend_`), carry both Guardian
  addresses in **visible** CC (`TRANSITION.CC`, the manager's choice), take
  replies at support@, and land in its Sent Items. The sign-in is an Entra
  app registration with the Graph **Mail.Send** application permission, held
  in three Script properties — `MS_TENANT`, `MS_CLIENT`, `MS_SECRET` — and
  never in the code, because the `.gs` files are public on the website.
  Until they are set nothing client-facing sends: no fallback to MailApp,
  which sends from the personal Google account that owns the script and
  allows about a hundred recipients a day, every CC counted — two copies on
  every letter would have held the send to some twenty-five letters a day.
  The mailbox's display name read "querymypolicy.com" until 24 September
  2026, when it was renamed "Ricky Rampersad Branch" (Microsoft 365 admin →
  Users → Active users → Edit user → Display name); the address did not
  change and must not — the letters send from it.
  **Until the Entra app exists, the letters go through the Claude Microsoft
  365 connector instead** (24 September 2026: "I don't know how to do the
  Entra, it's complicated, can you just work with what we have"). The
  connector is signed in as support@; it could only read mail until the
  admin granted it consent through the admin-consent link for its app, which
  added Mail.Send and Mail.ReadWrite. It sends from support@, saves to Sent
  Items and keeps the visible CC, but it accepts only p, br, a, b/strong,
  i/em, lists, headings, tables, hr and div — no logo, no colours — so it
  sends the plain letters `build-letters.py` writes to
  `orphan-transition/letters/plain/`, filled per row by
  `tools/letters/fill-plain.py` (run in a scratch directory; it holds the
  same rows the sender would hold and checks every body against that
  allowlist). A Claude session sends them one by one; nothing is automatic
  on this route, and client receipts go only when a session sends them. The
  eight staff tests went this way on 24 September; no client letter goes
  without the manager's word. Internal mail (the digest,
  the late nudges) still goes through MailApp. The older service e-mails in
  `Service.gs` (the daily follow-up's "still on it" notes, the six-month and
  birthday reviews) still send from Gmail, so the `dailyServiceFollowUp`
  trigger stays off until they are moved over too.
- **The send list is built by `tools/letters/sendlist.py` outside the
  repository**, on a copy of the Branch Portfolio sheet, with the departed
  agents' names in the git-ignored `departed.txt` beside it. It fills the
  exclusions before it picks a letter: the agents' own policies (full-name
  match), their households (same surname and the same address, phone or
  e-mail as the agent's own rows), staff addresses, death claims. A shared
  surname alone in the agent's own book, a matured policy and a postponed
  application are `check`, never auto-sent. Asked for on 22 September:
  "exclude the agents' policies who left … and his family, etc."
  **The Days column is days past the paid-to date only on a row the sheet
  flags `Overdue` (Status(2)).** On every other row it means something else,
  often days since issue. The first list read it bare and put 665 clients
  who owed nothing on the premium letter, printing a false "days
  outstanding"; caught on 23 September before any client letter went out.
  Test with the flag, never with Days alone. And the tool never marks a
  row `Test`: the Test rows are team members standing in as clients.
  **Two more exclusions, added 23 September ("not sending to the agents or
  their direct families"):** a client whose e-mail on file is one of the
  departed agents' own addresses (two rows would otherwise have mailed an
  agent directly), and anyone sharing a home address, phone or e-mail with a
  departed agent's own policy whatever their surname — a spouse or child
  under another name. An address, phone or e-mail shared by more than six
  clients is an office line, not a family, and does not count.
- **Every response gets a receipt, and the branch gets a copy.** The moment
  a client taps, `tAckClient_` (Transition.gs) e-mails them a short
  thank-you naming what happens next, CC'd to `TRANSITION.CC` — asked for
  on 22 September ("are responses coming in
  and I am to be copied"). `tChase_`, run once a day from `transitionDigest`
  (never from `tSummary_`, which the responses page polls every two
  minutes, so a chase can never double-fire), nudges the branch internally
  once a tap has been `Open` past its wait (`WAIT_DAYS`, or `WAIT_URGENT`
  for the urgent tap), and — still open at `WAIT × CHASE_MULT` — sends the
  client a warm "still on it" note and the branch a second, plainer nudge.
  Both stop the moment Status reads anything other than `Open`; the level
  already sent is recorded in that row's own Note cell, appended rather
  than overwritten, so a human note there survives.
- **The chase only ever acts on a token this campaign's own Transition Send
  tab recognises.** Client Responses has recorded taps from the site's
  original doors since before this campaign — months of rows that still
  read `Open` because nothing before 22 September ever looked at that
  column again. The first version of `tChase_` did not know the
  difference, tried to chase all of it in one run — up to three per-row
  full re-reads of the Transition Send tab, times however many rows had
  piled up — and timed out at Apps Script's six-minute ceiling with an
  unknown number of internal nudges and client "still on it" notes already
  sent to people who had nothing to do with this campaign. Fixed the same
  day: the token map is read once per run (`tTokenMap_`), any row whose
  token is not on it is passed over in silence, and `CHASE_MAX_PER_RUN`
  bounds how much a single run will act on regardless, logging what was
  deferred. Never widen the chase back to "every `Open` row" — that is the
  exact bug.
- **What comes back is watched on `orphan-transition/responses.html`**
  (opens with the branch code, like the wall; `action=transition`) and in
  the digest from `transitionDigest`, which fires as many times a day as
  `TRANSITION.DIGEST_HOURS` lists (`[8, 12]` by default — the noon run was
  asked for on 22 September, for a lunchtime VP meeting).
  `transitionSetup` tears down and rebuilds the digest triggers from that
  list every time it runs, so changing the hours is just running it again.
  First on both page and digest: taps waiting more than two working days
  with nobody assigned. The manager's `dashboard.html` and the branch's
  `wall.html` (six big slides, first names only) read the same answer.
  **All three share one answer**: `transitionData_` caches `tSummary_` for
  thirty seconds, because on the go-live afternoon the summary took seven
  seconds a request and one request in eight was lost to the web app's own
  timeout while several screens polled at once, which read on the screens
  as "no walls are opening". A gate that could not reach the sheet tries
  again by itself after fifteen seconds; only a refused code (the backend
  says `refused: true`) sends a viewer back to the gate for good. **The wall
  and the dashboard open on their last good answer** (25 September, "have
  the wall a little faster"): each keeps it in `localStorage`
  (`rrb-wall-snapshot`, `rrb-dash-snapshot`, twelve hours at most), paints
  it the moment the page loads with "updating from the sheet…" on the
  stamp, and swaps in the fresh answer when it arrives, so a wall switched
  on again or a phone opening the page a second time never waits on the
  gate; the first open on a new device still waits for the sheet, and a
  refused code clears the saved picture. The branch code is `TEAM_CODE` in
  Service.gs, never in the repository.
- **The team sees it first.** `orphan-transition/team-review.html` before any
  letter reaches a client; then the roster of receiving agents by town, from
  the ticks on the Team Feedback tab.
- Never send the branch a link to any of this before the branch is merged to
  `main`. A 404 in the WhatsApp group has happened once already.

## Standing rules

- **Client data never enters the repository.** `Orphan-Register.xlsx` and
  `Manager-Insights.html` are local-only.
- **Guardian-only scope** stays in `Service.gs`: if a policy was not issued by
  Guardian Life of the Caribbean, the file is closed and the client is pointed
  to their own insurer.
- **Branch:** develop and push to `claude/service-questioner-automation-6ihjzn`.
  No pull request unless asked for one.
- **Two marks, two products, on purpose.** The branch site
  (rickyrampersadbranch.com) carries the gold shield in `logo-mark.png` — the
  house rule above. donthaveanagent.com carries **The Knot** in Ink & Coral,
  because it is presented as a Ricky Rampersad project that stands on its own.
  Do not "correct" one into the other.
- **This is a Ricky Rampersad project**, not a Guardian Life one. The brand is
  Ink & Coral — `#0F1A2B` ink, `#1B2A44` surface, `#FF5C4D` coral, `#FFE9E5`
  tint, `#FFF6F4` paper, `#6B7C96` muted — with The Knot as the mark. Guardian
  is named only where it is a matter of fact: the insurer, the form, the
  customer-service desk.
