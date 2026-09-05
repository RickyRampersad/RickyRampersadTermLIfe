# The launch film's narration and build

    ./render.py                       # 19 lines -> line01..19.mp3
    ./build-film.py <shots-dir>       # + stills -> ../../film.html

`<shots-dir>` holds the wall screenshots the film shows, named
`f-w45.png`, `f-w60.png`, `f-w90.png`, `f-poss.png`, `f-dlv.png`, `f-lic.png`,
`f-possfilt.png` and `mark.png`. Capture them at **1920×1080** against a live
or stubbed feed — they are the evidence the film is making a claim about, so a
stale shot is worse than no shot.

**The film has to stay one file.** It plays in an iframe on the branch screen,
and the hosted copy will not fetch a sibling — a linked MP3 or PNG is missing in
exactly the two places that matter. Everything is folded in as a data URI.

**Stills ship as JPEG, the mark as PNG.** Straight PNG took this film to 9.5 MB,
which is not a file anyone waits for over branch wifi, for a difference nobody
can see across a room. Quality 82 puts it at 2.6 MB. The shield keeps its alpha.

**Timings come from the rendered audio, never from estimates.** `build-film.py`
measures each line by counting MPEG frames, lays the cues out with a fixed beat,
and puts every scene boundary just before its first line so the picture is
already there when the voice arrives. Change a line and rebuild — do not hand-
edit the numbers in `film.html`.

**Eleven chords, not eight.** The shorter films run the branch theme once
through — D F#m Bm G D A G D at 8.7s a chord, 69.6s. This film is 95.7s, so the
progression adds Bm G D and lands home on the eleventh instead of being cut off
mid-phrase. The chord length itself does not move: it is the house sound.

**No changing numbers are spoken.** The screen carries the arithmetic, the voice
carries the meaning. Every figure on these walls moves on the next rebuild and
the audio does not, so a spoken count is confidently wrong within a day over a
screen showing the right one. The only numbers in the script are the band
definitions and the statutory twenty business days — none of which move.

## Rendering from inside a Claude sandbox

edge-tts fails behind the agent proxy with `SSLCertVerificationError`, which
reads exactly like the tunnel refusing a WebSocket upgrade. That is the wrong
diagnosis and it cost an afternoon. `edge_tts` pins its own context at import —

    edge_tts/communicate.py:  _SSL_CTX = ssl.create_default_context(cafile=certifi.where())

— and never consults `SSL_CERT_FILE` or `REQUESTS_CA_BUNDLE`, so appending the
proxy CA to certifi does nothing. Replace the context and pass the proxy;
`render.py` does both and works in-session.
