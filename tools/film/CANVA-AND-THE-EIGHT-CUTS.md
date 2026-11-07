# The administrator's film: eight cuts that missed, and what the ninth is

Read this before cutting anything for `/buildwithus/`. Nine attempts went into
one 86-second film, and the eight that failed each failed for a reason worth
writing down. `tools/film/beat/README.md` has the manager's words on the first
seven; this adds the eighth and what finally landed.

## What he was asking for the whole time, and what I kept hearing

The brief, in his own words on 7 November 2026, after the eighth:

> "you ahve beeen my consultant for months and know insife out the admin we are
> looking for i asked for motion and a qualification as to what the person will
> do as to what you all work on and a person who is somewheree with no tools"

Then, minutes later: *"no i want you graphics, motion and cards"* and *"i dont
want read persons icone and etc"*.

Three things, and I had missed all three for eight cuts:

1. **A qualification** — the film has to *show what the person would actually
   do*, on the systems this branch actually runs. Not a mood, not a promise.
   That is the middle of the film, not a line at the end.
2. **The person with no tools** — it opens on somebody who can already see what
   should be fixed and has a spreadsheet, a group chat and no permission.
3. **Graphics, motion and cards** — everything drawn and moving. No
   photographs, no people, no avatars.

**The eighth cut was the worst miss, and it is the one to learn from.** It was
AI-generated photography: a desk at golden hour, hands on a keyboard, an empty
office, a building among palms. Technically clean, warm, cinematic — and
completely wrong. It showed somebody else's office while the one thing this
branch has that nobody else has is **its own software**, which I had been
inside for months. Reaching for stock when you are holding the real thing is
the error, and it is the same error as cuts one to seven in a different coat:
the film was *about* the branch instead of *being* it.

So the ninth cut is the board films' own engine (`build-boardfilm.py`, the
midnight-blue look he chose on 15 October), with twelve scenes drawn as cards:
the Log Book on a phone, the 45/60/75/90 timeline, the invoice checked against
our records line by line, the editor typing real Apps Script, the four tools
with "connected" on each. Every file name on screen is a real file in
`apps-script/`; every figure is one this repository can stand up.

## The Canva export pipeline, which is worth keeping

Canva **video** generation was out of quota, and this is how to get full-size
imagery out of Canva anyway when it is ever wanted again. `generate-image`
hands back only a **200×200 thumbnail**, and `canva.com` and `design.canva.ai`
both answer **403** to a plain fetch, so there is no direct download. The way
out:

1. `generate-image` → a Canva **media id** (`MAHa…`). The thumbnail is not the
   asset.
2. `copy-design` an existing 1080×1920 design — never edit the manager's own,
   which holds another campaign's images.
3. `read-design` with `open_transaction: true` → a `transaction_id` and the
   **page ids**.
4. `edit-design` → `insert_fill` the media onto each page, one call per page
   (`page_index` is required with operations, so pages cannot be batched).
5. `edit-design` → `finalize: "commit"`.
6. `export-design` → **signed `export-download.canva.com` URLs, which `curl`
   fetches fine.** That is the one Canva host that does not need a session.

Two traps inside it:

- **`aspectRatio: "PORTRAIT_9_16"` is advisory and came back square.**
- **`insert_fill` into a 1080×1920 frame zooms the media to cover**, leaving an
  `imageBox` of 1920×1920 at `left: -420` — a 1.78× crop nobody asked for.
  Insert at **1080×1080** and the box comes back `0,0,1080,1080` with nothing
  lost; `crop_media` resets a frame that is already wrong.

Export at 2160×3840 and crop `2160:2160:0:840` to recover the whole square.

## Rules the ninth cut is built on

- **The mixer crops the picture to 1280×616** and burns the captions into the
  band beneath, so anything a scene draws below 616 is gone. `bwfit.js`
  measures every scene at rest and fails the build rather than leaving it to
  the eye — the end card was 8px over and it did not look like it.
  Exclude `.bgfx` and the confetti canvas: the aurora, the rays and the blobs
  bleed past the frame on purpose.
- **Centred scenes need a white headline.** Only the chapter scenes were ever
  centred before, and those are blue; a centre scene on the midnight ground
  inherits dark ink and renders navy on navy. `.bwc` sets it.
- **A QR fails at one scale and not its neighbours.** This code decodes at
  1280, 854 and 480 and fails at exactly 640 — with bicubic and lanczos only;
  bilinear, area and neighbour all decode. It is the scaler ringing on hard
  module edges at that ratio, not the code being too small. Test several
  widths *and* several scalers before making the code bigger.
- **The close is side by side, not stacked.** A 16:9 frame has width to spare
  and no height: stacking the lockup, three lines and the code pushed the card
  past the crop, and shrinking the code to fit cost it its scan.
- **The class-collision guard earns its keep every time.** It caught `d1`/`d2`
  here. Prefix every new class (`bw…`) and grep the film's own sheet before
  naming one.
- **This voice mangles a bare run of product names.** "Apps Script, Workspace,
  Salesforce, Claude" came back from the Whisper check as *"up it is creeped
  workspace cells false clode"*. Put them in a sentence — "writing Apps Script,
  working in Salesforce and Google Workspace, with Claude beside you" — and it
  reads clean. "Half your day" also came back as "half a day"; "Half of your
  day" fixed it. `Claude` is still heard as "Claw", so the word is on screen in
  the same scene, the same mitigation `Akaash` → "of cash" took.

## The twelve scenes are data-driven, and the underwriter's film reuses them

Added 7 November 2026, cutting `uwadmin` for `/underwriter/`. Every `s_bw*`
scene now reads its cards, rails, rows, code and labels out of the lines file
and falls back to the administrator's values, so one set of visuals serves both
films instead of two sets drifting apart. `R_BW` maps the names; `BW` is true
for a key starting `bw` or `uw`, and `OUT` picks the folder from the prefix.

**Prove a refactor like this by rebuilding the film that already shipped.**
`build-boardfilm.py bwadmin` has to come back byte for byte identical to the
committed `buildwithus/film.html`. It did not, the first time: flattening the
three per-art flag offsets into one number moved three flags by up to 200ms.
Invisible on screen, and still wrong — the committed source no longer
reproduced the committed MP4. The offsets are back, with the reason in a
comment.

**`"ticks": false`** on the rule scene drops the green ticks that march down
the left column. They mean *and then these do themselves*, which is right where
a rule automates the manual steps and wrong where it replaces a queue: a tick
beside "wait for the release" reads as the wait being fine.

## What is still open

- **Only the 16:9 cut exists.** A 9:16 for Reels, Status and TikTok is a
  re-layout, not a re-render: the scenes are built for a 1224×540 stage.
- **The film says "thirty-six files".** The branch now has **39** `.gs` files
  and **102,973** lines. The page says 36 too; both are conservative and both
  are now stale.
- **The music is the manager's own recording**, and the licence is still not
  written down. It is not committed here for that reason: the repository root
  is published, so committing the track redistributes it.
