# Ricky Rampersad Branch — repository notes

Guardian Life of the Caribbean, Trinidad & Tobago. This file loads at the start
of every Claude Code session in this repository, so anything here is in hand
before work starts rather than after.

---

## The branch theme

Every branch film shares one key, tempo and progression. That is deliberate:
it is why they sound like one organisation rather than three separate videos.

| | |
| --- | --- |
| **Key and tempo** | **D major · 108 BPM** |
| **Progression** | **D – A – Bm – G** |
| **Voicing** | **Pads, pluck, brushed hat** |

Written for the branch, not licensed — nothing to pay, nothing to credit, fine
on WhatsApp, YouTube or a wall screen.

### How the pension film plays it

`pension/music/score.py` writes a MIDI file; FluidSynth plays it through
FluidR3_GM, a library of sampled instruments, so the theme is **played rather
than synthesised** — a Rhodes electric piano, an upright bass, a warm pad, a
nylon guitar, a vibraphone and a real kit.

That distinction matters and was learned the hard way. Three earlier scores for
this film generated their waveforms directly in code out of sine tones, and all
three were rejected as cold or frightening. A computed sine has no warmth in it
to find, and a **held** one is the sound of suspense — which is why changing the
key from minor to major did not help. If a future score has to be written, play
it, do not synthesise it. See `pension/music/README.md`.

### The other films

The launch film at `benefits/launch-eb.html` (a different repository)
synthesises its own bed in Web Audio on
`D – F#m – Bm – G – D – A – G – D`, 8.7 s per chord, eight chords carrying the
film. Same key, same family.

---

## The film's voice

**`en-US-AndrewMultilingualNeural`, via `edge-tts`, at `--rate=-3%`.**

```
pip install edge-tts
edge-tts --voice "en-US-AndrewMultilingualNeural" --rate="-3%" \
         --text "…" --write-media line01.mp3
```

Three offline engines were tried before this — Piper, Kokoro and Chatterbox —
and every one was heard as robotic. Do not spend time tuning them again.
Andrew measures ~19 semitones of pitch movement against the best offline
attempt's 12, and pitch movement is what a listener hears as "not a robot".

**Behind the agent proxy**, edge-tts fails TLS: it builds its SSL context from
certifi alone and ignores `SSL_CERT_FILE`. Add the proxy CA to that context
rather than disabling verification — see
`pension/music/edge-tts-proxy.py`.

A real recorded voice still beats it with a Trinidadian company.
`pension/add-narration.sh` puts one on the film in about a minute without
re-rendering a frame.

---

## Things that are true about this repository

- **The wizard runs entirely in the agent's browser.** Case data lives in
  `localStorage` and leaves the device only in the PDFs the agent downloads.
- **`ANTHROPIC_API_KEY` must never reach the browser.** RIA talks to
  `/api/pension-ai`, a Netlify function, which talks to Anthropic.
- **The register is read-only to clients** and returns nothing without a code
  that matches a row. An employer never sees an employee's access code.
- **The wall** (`/wall?key=…`) counts rather than names, except the
  waiting-on-an-employee list, which exists to be acted on. It is staff-only —
  never send it to a company.
- **Declaration 1 and 2, page 3**: the address / identification / expiry fields
  stay blank. They belong to the declaration for an illiterate proposer.
- **The git history was scrubbed of client data** (`data/fleet-register.csv`,
  `data/risk-details.csv`). Never force-push history that would restore them.
- **No client-identifying data from the uploaded policy PDFs** belongs in this
  repository — product terms only.

Full setup and maintenance: `PENSION-SETUP.md`.
