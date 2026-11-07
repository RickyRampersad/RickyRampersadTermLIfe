# The recruiting films: what was turned down, and what is here

Five cuts of the three recruiting films were rejected on the night of 6–7
November 2026. **Read this before making a sixth.** Everything in this folder
was built in a session scratchpad, which is deleted when the container is
reclaimed, so it is committed here to stop the next attempt starting from
nothing — not because any of it is finished.

## What was rejected, in order, and in his words

| | what was shown | the answer |
|---|---|---|
| 1 | text cards, large type | *"I'm finding the words very difficult to read"* |
| 2 | the same, bigger type | *"horrible fonts that take up the fucking screen no fucking motion"* |
| 3 | full rebuild: composed scenes, drawn visuals, near-black ground, electric cyan | *"more soft colors … easy on the eyes"* |
| 4 | softened palette, canvas aurora, 3D tilt, 52 seconds | **"Horrible!!"** |
| 5 | six palettes of the same frames | **"all look the same!!!!!"** |
| 6 | new layout: screens full-bleed, words over them, statements at frame size | **"Still wrong"** |
| 7 | 19 s, cut on the beat, no voice, music-led | *"still horrible no creativity horrible"* |

**The lesson, and it cost an evening: he was right every time, and each of my
fixes was a skin on the same thing.** Colour, type size, pace and layout all
changed; what never changed is that these are drawn boxes with app
screenshots and no human being anywhere in them. "All look the same" is the
clearest thing he said — six hue swaps of one design *are* the same design.

**So do not open this folder and change a colour.** The next version needs a
different medium (footage, photographs, real faces) or a real advertising
idea, not another repaint. He was offered generated footage, shooting it
himself, or stopping; he chose to stop and look at it fresh.

## What is here

| | |
|---|---|
| `beat.html`, `beat.js` | the beat engine: cuts land on the beat (98.7 BPM, 0.608 s, first beat 0.289 s), no voice, two to four words a card. `BEAT_CFG.hits[].b` is a hit's length in beats. |
| `bt-bwagent.js` | the advisor's beat script, 31 beats. **Cut to the track, not looped**: the music is 19.35 s and looping it puts a seam through the beat grid. |
| `renderbeat.js`, `beatshots.js` | render / screenshot harnesses for the beat engine. |
| `engine.html`, `engine.js` | the narrated engine (versions 3–6), with six palettes behind `?pal=` and the full-bleed hero layout. |
| `palshots.js`, `newlook.js` | the comparison sheets that were sent. |

## Things that are true whatever the next version looks like

- **Type is a share of the frame WIDTH, never the short edge.** A feed plays
  any film about 400 px wide whatever its pixels. Nothing under ~3.4% of the
  width survives.
- **A QR is sized the same way**, and the wide cut needs its own number: at
  the upright cut's units it is 14% of a 1920 frame, which is 53 px on a phone
  and decodes as nothing.
- **Never let the camera move on a QR.** A slowly changing, non-integer scale
  resamples the code's modules on every frame, so it decodes at one timestamp
  and not the next. Hold the camera, fade the code in, round its width to
  whole pixels.
- **Check the code at five timestamps, at full size and at 405 px.** One
  sample passes things that do not scan.
- **Source order decides** when two rules have the same specificity. Three
  separate rules in `engine.html` did nothing because they were written above
  the rules they were meant to override.
- The narration, if one ever comes back, is Andrew Expressive on the
  `tts-run` runner, every clip checked word by word.
