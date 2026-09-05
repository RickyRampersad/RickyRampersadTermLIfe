# Ricky Rampersad Branch — working notes

Guardian Life of the Caribbean, Trinidad & Tobago. Two products live here:

- **`donthaveanagent/`** — donthaveanagent.com, the site for orphan
  policyholders. Publishes on Netlify with `donthaveanagent` as the base
  directory, so only that folder reaches the web at that domain.
- **`service/`, `renewal/`, root `netlify.toml`** — the branch site
  (rickyrampersadbranch.com), including the Service Questionnaire.

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

### Rebuilding one

The pipeline is in `tools/film/`. It needs `edge-tts`, `ffmpeg` **with
libass**, Playwright with Chromium, numpy.

1. **Narrate.** One file per scene, numbered, into a `vox` directory:
   ```bash
   edge-tts --voice en-US-AndrewMultilingualNeural --rate=-3% \
     --text "…" --write-media vowall2/01.mp3 --write-subtitles vowall2/01.vtt
   ```
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
- **This is a Ricky Rampersad project**, not a Guardian Life one. The brand is
  Ink & Coral — `#0F1A2B` ink, `#1B2A44` surface, `#FF5C4D` coral, `#FFE9E5`
  tint, `#FFF6F4` paper, `#6B7C96` muted — with The Knot as the mark. Guardian
  is named only where it is a matter of fact: the insurer, the form, the
  customer-service desk.
