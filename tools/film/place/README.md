# "Build with us" — the place cut

The eighth attempt at the administrator's film, and the first with real
photography in it. Seven cuts before it were rejected; `tools/film/beat/README.md`
records each one in the manager's own words. What they had in common, and what
this one changes, is worth reading before cutting another.

**Every one of the seven was the same design in different clothes.** Text cards,
then bigger text, then softer colours, then six palettes of the same frames,
then screenshots in boxes, then a fast music-led cut, then the form film. When
the answer came back *"all look the same!!!!!"*, that was literally true: six
hue swaps of one layout. Colour was never the problem. **A rejection is not a
brief to re-skin — change the thing that was named and keep the rest.**

This cut is different in kind, not in degree: photography is the subject, the
type sits in the lower third and never takes the screen, and the camera moves
slowly instead of cutting fast. The direction the manager chose was *"that's a
place I want to work"* — the branch itself as the draw — so the film has to
show a place, and a place cannot be drawn in boxes.

## The footage, and how it got here

Canva's **video** generation was out of quota, which is what had blocked this
for days. Image generation was not, but the MCP tool only ever hands back a
**200×200 thumbnail** — useless as footage — and the full-size file stays
inside Canva. `canva.com` and `design.canva.ai` both answer **403** to a plain
fetch, so there is no direct download.

**The way out is the export pipeline, and it works end to end:**

1. `generate-image` → a Canva **media id** (`MAHa…`). The thumbnail you are
   shown is not the asset.
2. `copy-design` an existing 1080×1920 design to get a working copy — never
   edit the manager's own design; it holds another campaign's images.
3. `read-design` with `open_transaction: true` → a `transaction_id` and the
   **page ids**.
4. `edit-design` → `insert_fill` the media onto each page, one call per page
   (`page_index` is required with operations, so pages cannot be batched).
5. `edit-design` → `finalize: "commit"`.
6. `export-design` → **signed `export-download.canva.com` URLs, which `curl`
   fetches fine.** That is the one Canva host that does not need a session.

Two traps inside that:

- **`aspectRatio: "PORTRAIT_9_16"` is advisory and came back square.** Plan for
  a square source.
- **`insert_fill` into a 1080×1920 frame zooms the media to cover**, leaving an
  `imageBox` of 1920×1920 at `left: -420` — a 1.78× crop you did not ask for.
  Insert at **1080×1080** instead and the box comes back `0,0,1080,1080` with
  nothing lost. On a frame that is already wrong, `crop_media` resets it.

Export at **2160×3840** and crop `2160:2160:0:840` to recover the whole square
at full size. `stills/s1..s6.jpg` are those six frames.

## The film

`film.html` + `film.js`, rendered by `render.js` (Playwright, frame by frame),
then encoded against the branch bed.

- **1080×1920, 19.35 s**, which is the bed's own length — the track is 19.35 s
  and does not loop, so the film is cut to it.
- **98.7 BPM**: beat 0.608 s, bar 2.432 s. Six shots, one bar each (the first
  gets the 0.289 s lead as well), then a still end card from 14.881 s.
- **The source square is shown at 1920×1920 inside a 1080-wide window**, so
  nothing is upscaled and there are 840 px of room to drift inside. Each shot
  pushes about 6% and drifts; `SH` in `film.js` carries the window position,
  the zoom and the drift per shot.
- **Constant velocity, not eased.** A camera moves at a constant speed; an
  eased move reads as a slide.
- **Words, never letters.** Letter-by-letter is the dated form and wrecks the
  screen-reader read; each caption also carries its whole sentence as an
  `aria-label`.
- **The end card does not move at all.** A camera on a QR is what stopped the
  earlier cuts decoding: every scene pushed `scale(1.015)` → `scale(1.07)`,
  resampling the modules differently each frame. Hold it at exactly 1.
- **Checked, not assumed:** the QR is decoded back out of the *encoded* MP4 at
  five timestamps, at full size and again at **405 px**, which is about what a
  feed gives a phone. `scratchpad/film/qrcheck.py` is that check.

CRF 21 gives about 6 MB here. Photography encodes far cheaper than the blurred
gradient grounds of the earlier cuts, which needed CRF 22 to stay under the
20 MiB artifact asset cap.

## What is not settled

- **The stills are stand-ins, not the branch.** No real person, no real
  building, nothing that says "this is our office" in the words. Real
  photographs of the actual branch and team would be better than any of this
  and only the branch can take them. If a shot is ever made to claim premises
  or people as ours, it has to be ours.
- **No lettering is generated into a frame**, deliberately: every screen in
  shot is abstract, so no invented figure or client name can appear.
- **Only the upright cut exists.** The 4:5 feed and 16:9 cuts are a re-render
  with `W`/`H` set, once the look is approved — not before. Seven rejected cuts
  were rendered in three shapes each.
