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
