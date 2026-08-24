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

Films carry **subtitles on every line** — most people meet them muted.
Example data is labelled as example data, on screen.

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
