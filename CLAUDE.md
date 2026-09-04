# Ricky Rampersad Branch — house notes

Standing decisions for this repository. Read before regenerating narration,
scoring a film, or adding a product to the fact find.

## The voice — narration on every film

Rendered with **edge-tts**. Free, no account, no licence, so nothing here needs
clearing before it goes on WhatsApp, YouTube or a wall screen.

```
pip install edge-tts

VOICE="en-US-AndrewMultilingualNeural"
RATE="-3%"

edge-tts --voice "$VOICE" --rate="$RATE" --text "…" --write-media line01.mp3
```

Output is 24 kHz mono MP3 — plenty for speech over a music bed.

**Why these settings.** Andrew at `-3%` reads slightly under natural pace, lets
a full stop land, and does not smile. The delivery comes from the voice and the
rate, not from punctuation tricks.

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

## Apps Script — the last definition wins, and that is a trap

The branch backend is one shared namespace across `Code.gs`, `RRBranchOS.gs`,
`RRBranchEmails.gs` and `RRB_Additions.gs`. Two functions with the same name are
not an error: **the last one loaded is the one that runs.** Every fix delivered
to this project is therefore a block appended at the end of a file, because an
append always wins over whatever is above it.

That works, and it is why nothing here is ever edited in place over WhatsApp —
a paste that lands inside an existing function eats its closing brace, and the
whole project stops with a `SyntaxError` on a line nobody typed.

**But an append also silently discards any later fix to the same function.**

On 4 September the settlement board could not find its tab. The spreadsheet id
had been saved to Script Properties, and the version of `rrbSettleSheet_` that
reads that property had been pasted and saved. Both were correct. The board was
running a *different* `rrbSettleSheet_` — an older copy, from a settlement block
that had been pasted three more times underneath it. Last wins, and last was the
one that did not know about the property.

It cost an evening, because from outside the script all three possible causes
look identical: the file not pasted, the version not deployed, and a later copy
winning. Reading the file settled it in seconds.

So, when appending:

- **Say what the block redefines**, at the top, by name. If a function is being
  replaced, the next person needs to know without diffing.
- **Never send the same block twice.** A second paste of an older copy undoes
  every fix made to those functions since.
- **Carry a build marker** in `doGet`'s "Unknown action" reply. `?action=zzz`
  then names the running build from outside, with no sign-in.
- **Ship a self-check** with anything structural. `String(fn).indexOf('...')`
  reads the *live* function body, so the script can be asked which copy won
  instead of it being inferred. `rrbSettlementSelfCheck` is the pattern.

A marker alone is not enough: it lives inside the block being pasted, so it
cannot tell "never pasted" apart from "never deployed". The self-check can.
