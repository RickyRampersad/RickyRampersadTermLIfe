# RR Branch — house notes

Ricky Rampersad Branch 26000, Chaguanas, Trinidad. Guardian Life.
Everything here is branch-built and branch-owned.

## The branch theme

| | |
|---|---|
| Key and tempo | **D major · 108 BPM** |
| Progression | **D – A – Bm – G** |
| Voicing | Pads, pluck, brushed hat |

Written for the branch, not licensed — nothing to pay, nothing to credit, fine
on WhatsApp, YouTube or a wall screen. Every film sharing this key and tempo is
why they sound like one organisation rather than three unrelated videos.

**The bed is played, not loaded.** Films synthesise their own score in Web
Audio — no track to licence, no file to ship:

- Four voices per chord: two detuned saws through a soft low-pass (900 Hz,
  Q 0.4) for warmth, a triangle an octave up for air, a sine underneath for
  weight.
- Long attacks and releases, so chords bloom into each other instead of
  stepping.
- Sits under the voice, lifts into the reveal, opens out for the close.

## The voice

```bash
VOICE="en-US-AndrewMultilingualNeural"
RATE="-3%"
edge-tts --voice "$VOICE" --rate="$RATE" --text "…" --write-media line01.mp3
```

`pip install edge-tts`. Free, no account, no licence. 24 kHz mono MP3 — plenty
for speech over a music bed.

Delivery comes from **the voice and the rate, not punctuation tricks**. Andrew
at −3% reads slightly under natural pace, lets a full stop land, and does not
smile. Short sentences do the rest. A line that needs to breathe more gets
**split into two sentences** rather than reaching for commas.

> In a sandboxed session, `edge-tts` fails TLS against
> `speech.platform.bing.com` because the agent proxy substitutes its
> certificate and edge-tts pins `certifi`'s bundle. Fix by appending the proxy
> CA to the bundle that `edge_tts` actually imports — check
> `python3 -c "import certifi; print(certifi.where())"` **from the same
> interpreter edge-tts uses**, as more than one certifi may be installed:
> `cat /root/.ccr/ca-bundle.crt >> "$(...)"`. Do not disable verification.

## How a film is built

One **self-contained HTML file**. The narration is folded in as base64 data
URIs between `/*__VO_START__*/` and `/*__VO_END__*/` markers; the score is
played live; every frame is drawn in the DOM. It has to stay one file: the wall
plays it in an iframe, and the hosted copy runs under a policy that will not
fetch a sibling asset, so an `<audio src="line01.mp3">` would be silent in
exactly the two places it matters.

```
film/
  story-film.html        the film
  voice/build-voice.sh   regenerate the narration (Andrew, −3%)
  voice/embed-audio.py   fold the MP3s back into the film
```

**iPhone has its own rules, and they bite.** An `Audio` element only plays if
that element was started inside a user gesture — ones built later in a loop are
refused silently, so narration goes through `decodeAudioData` and buffer
sources on the same AudioContext instead. Resume the context inside the tap.
And the hardware ring switch mutes Web Audio, so say so on the start screen
rather than shipping a film someone hears nothing from. Films must also reflow
for a portrait phone: stack what is side by side, drop what will not fit.

Films carry **subtitles on every line** — most people meet them muted.
Example data is labelled as example data, on screen.

**The mark is `querypal/qp-shield.png`** — a coral shield with a white check on
deep navy. The palette follows the mark, not the other way round: navy
`#1B2A4A` / `#0E1830` ground, coral `#E4644B` with `#F0906F` lit, gold `#F5B935`
for ratings. Embed it as a data URI; never draw a lettered box in its place.

**Watch the bed's level.** A score at −21 dBFS against a full-scale voice is
inaudible — it reads to the viewer as "no music". Run the bed loud and duck it
to about 40% under narration rather than leaving it quiet throughout.

**A film needs a journey.** Six stations along the foot of the frame — Asked,
Logged, Routed, Chased, Answered, Rated — lit as the story reaches them, so the
viewer always knows where they are and can feel the distance travelled.

## Why Query Pal exists

A **Ricky Rampersad initiative**, built at Branch 26000. The branch ran on
email, and email is where a request goes to die: the agent had to guess which
of sixteen departments a request belonged to, guess wrong and it sat in the
wrong inbox for a week, and nobody — agent, staff or client — could see where
anything stood. Ricky took what he learned at McKinsey — *a process you cannot
see is a process you cannot fix* — and built one place that serves all three.

The promise, and the line every film ends on: **log it once and forget it.
The system does the rest.**

**Escalation to the branch manager is a failure state, not a feature.** The BM
is the last resort, and the measure of the system working is that it almost
never gets there. Never present the manager step as the exciting part of the
chase — the chasers doing their job without anyone is the point.

## Query Pal

Static front end on Netlify (`querymypolicies.netlify.app`), Google Apps Script
backend writing to Google Sheets. Production script is `v10.2-CLIENT-PORTAL`;
`querypal/QueryPalPatch.gs` plus the find-and-replace edits in
`querypal/PATCH-INSTRUCTIONS.md` take it to `v10.3-HARDENED`. **Never replace
`Code.gs` wholesale** — it is the source of truth and it stays the branch's.

Routes: `/` the app, `/wall` the branch board (open, no sign-in), `/story` the
film.

Rules that do not bend:
- Never send test email to a real department — `TEST_MODE = true` sends to
  `rampersadricky@gmail.com`.
- Internal notes never reach a client view.
- The wall carries aggregates only — no names, references or request text.
- Client scoping is enforced on the server, never in the page.
