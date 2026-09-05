# The wall's films

Two, sharing one builder.

| | | |
|---|---|---|
| `film/` → `../film.html` | **95 s** | the explainer: the problem, the announcement, all four walls, the Act |
| `sneak/` → `../sneak.html` | **40 s** | the trailer: Monday, and what lands on the wall |

```
cd film   && ./render.py          # narration -> line01..N.mp3
cd ..
./build.py film  <shots-dir>      # stills + narration -> ../film.html
./build.py sneak <shots-dir>
```

`<shots-dir>` holds 1920×1080 captures named `f-w45.png`, `f-w60.png`,
`f-w90.png`, `f-poss.png`, `f-dlv.png`, `f-lic.png`, `f-possfilt.png` and
`mark.png`. They are the evidence the film makes a claim about, so a stale
capture is worse than no capture — recapture when a wall changes.

Each film directory carries its own `config.py`, `head.html`, `scenes.html`,
`player.js` and MP3s. Everything else lives in `build.py`, once: two films that
drift apart in how they are built drift apart in how they look.

## The rules that are not obvious

**A film has to stay one file.** It plays in an iframe on the branch screen and
the hosted copy will not fetch a sibling — a linked MP3 or PNG is missing in
exactly the two places that matter. Everything is folded in as a data URI.

**Timings come from the rendered audio, never estimates.** `build.py` measures
each line by counting MPEG frames, lays the cues out with a fixed beat, and puts
every scene boundary just before its first line. Change a line and rebuild; do
not hand-edit numbers in the output.

**The chord length never moves.** 8.7 s, in both films and in
`benefits/launch-eb.html`. What changes is how many: eleven for the explainer
(95.7 s), five for the sneak peek (43.5 s). Both land home on D. If a film does
not fit its bed, change the film or add a chord — never the chord.

**The pace is the only difference in tone.** Same voice, same rate: Andrew at
-3%. The sneak peek reads as a trailer because `GAP` is 0.36 s against the
explainer's 0.55, the scenes cut in 0.28 s rather than dissolving in 0.8, and
the wall shots go full bleed with the words on them. A branch that suddenly
sounds like somebody else for one film sounds like two branches.

**No changing numbers are spoken.** The screen carries the arithmetic, the voice
carries the meaning. Every figure on these walls moves on the next rebuild and
the audio does not, so a spoken count is confidently wrong within a day over a
screen showing the right one. The only numbers in either script are band
definitions and the statutory twenty business days.

**A phone gets a portrait cut, not a smaller landscape one.** A 16:9 stage on a
handset held upright filled 26% of the screen; an iPad upright, 39%. Scaling
cannot fix a wrong shape. So under `(orientation:portrait) and (max-width:1080px)`
the stage becomes 1080 wide by the *device's own ratio* — `fit()` sets the height
and clamps it to 1.30–2.25 — and the scenes re-lay into it. Same timings, same
audio, 100% of every phone and tablet tested. The `1620` in the stylesheet is the
scripting-off fallback and nothing else reads it.

**Portrait shows the wall whole.** Cover-cropping a 16:9 capture into a portrait
frame shows 44% of its width and cuts every panel mid-word — it reads as a fault,
not as detail. Contained in its own framed box the wall is small but coherent,
and the caption gets clean navy underneath instead of fighting body text. The
landscape pan is a landscape idea; nothing overflows in portrait, so the shot
arrives rather than travels.

**Stills ship as JPEG, the mark as PNG.** Straight PNG took the explainer to
9.5 MB. Quality 82 puts it at 2.6 MB and the difference is invisible across a
room. The shield keeps its alpha.

## Rendering from inside a Claude sandbox

edge-tts fails behind the agent proxy with `SSLCertVerificationError`, which
reads exactly like the tunnel refusing a WebSocket upgrade. That is the wrong
diagnosis and it cost an afternoon. `edge_tts` pins its own context at import —

    edge_tts/communicate.py:  _SSL_CTX = ssl.create_default_context(cafile=certifi.where())

— and never consults `SSL_CERT_FILE` or `REQUESTS_CA_BUNDLE`, so appending the
proxy CA to certifi does nothing. Replace the context and pass the proxy; both
`render.py` files do exactly that and work in-session.
