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
| Client film | `client-film.html` | `dhaa-film.mp4` | 142s |
| What happens next | `process-film.html` | `dhaa-process.mp4` | 104s |
| The agent's side | `agent-side-film.html` | `dhaa-your-side.mp4` | 84s |
| For agents | `agent-film.html` | `dhaa-agent-film.mp4` | 75s |
| How we work | `how-we-work-film.html` | `dhaa-how-we-work.mp4` | 84s |
| The branch wall | `wall-film.html` | `dhaa-wall.mp4` | 112s |

**Never put a real client name or a real client count in an MP4.** The files
sit at public URLs even when the pages are `noindex`. Every number on screen
is illustrative.

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
   film. The films made before this rule was found still carry it; the ad
   was re-voiced. `-8%` for a short spot, `-12%` for a walkthrough.
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

4. **Record** with `record-film.js` (Playwright, 1280×720). Run it with
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
Activity.

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
