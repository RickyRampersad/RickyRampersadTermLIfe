# Blank PDF — cause and fix

**Affects:** the PDF emailed to the client, agent and manager on submission, and
the copy the agent downloads via "Download for Manager". Both were blank.

**File:** the fact-find form served at `factfind360.com/ffproject`
(same file as `factfinds.netlify.app/FFPROJECT.html` — identical etag, one
Netlify site, two domains, so fixing it once fixes both).

## Cause

Both render paths made the print layout visible and then hid it from the user by
making it almost fully transparent (`opacity:0.01`). That is a real bug —
html2canvas honours computed opacity and would rasterise the page at 1% alpha —
but it is **not** what was producing the blank PDFs.

Measured in a real browser:

```
#printLayout WITHOUT body.preview-open : 0 × 0
#printLayout WITH    body.preview-open : 794 × 7597   (7 pages)
```

**The print layout has no dimensions at all on a normal screen.** Every rule
that gives `.pf-page` its size lives inside `@media print` or under
`body.preview-open`:

```css
#printLayout { display: none; }
@media print { #printLayout { display: block !important; … } }
body.preview-open #printLayout { display: block; max-width: 210mm; … }
```

The inline `display:block !important` made the *container* a block, but its
children stayed unsized. html2canvas was photographing a zero-height element, so
the PDF came out correctly paginated and completely empty.

Fixing the opacity alone changes nothing — verified: it still produced a 4KB
blank PDF, byte-for-byte as useless as before.

Neither existing guard could catch it. The client checks `b64.length < 500`, the
server's `ffBuildPdfAttachment_` checks `< 100`; a blank A4 page is still several
KB, so both passed.

## Fix

Three things, in both `generateFactFindPdfBase64()` and `downloadForManager()`:

1. **Add `preview-open` to `<body>` during generation**, so the layout has a
   size. Restore the original `className` afterwards.
2. **Keep opacity at 1.** Hide it from the user with `z-index:-1` behind the
   page instead — not with transparency, and not off-screen, because
   html2canvas needs it in the viewport.
3. **Drop `windowWidth: 794` / `width: 794`** from the html2canvas options. Once
   the preview padding applies, forcing a 794px capture clips the left edge off
   every page.

The `.preview-backdrop` also needs neutralising (`position:fixed; left:0; top:0;
z-index:-1`) because `#printLayout` is a child of it, and its original style must
be restored too.

Restore state in a `finally`, not only on the success path — the old download
code left the print layout stuck over the form whenever a render failed.

## Verified

Running the page's own `generateFactFindPdfBase64()` under headless Chromium,
before and after:

| | PDF produced |
|---|---|
| live file | **3,252 bytes** — blank |
| fixed file | **2,677,689 bytes** — 7 pages of content |

After generation, `body.className` and the element's inline style both return to
their original values, on both the success and error paths.

## Page breaks — also fixed

Initially each page boundary bled the next page's header onto the one before.
Same root shape as the main bug: the layout already declares what it wants,

```css
.pf-page { page-break-after: always; }
```

but that rule lives inside `@media print`, so on screen it computes to `auto`.
html2pdf's `css` break mode found nothing to break on and sliced one tall canvas
at fixed A4 intervals instead — 1123px slices against ~1085px pages, so every
page drifted.

Fix: set `pageBreakAfter = 'always'` inline on each `.pf-page` except the last
during generation, and clear it in `restoreLayout()`. Page 1 then ends cleanly at
its own footer.

Two alternatives were tried and rejected: `pagebreak: { before: '.pf-page' }`
alone behaved identically, and combining it with the inline rule produced 14
pages with blanks inserted.

## Expect 8 pages, not 7

The Guardian form is 7 pages. The 8th is the **RR Branch Addendum overflowing** —
the RAI Branch Manager Intelligence section plus the Sales Support checklist run
longer than one A4 sheet. That is real content, not a blank.

The split currently lands mid-heading, so the addendum title is clipped at the
top of page 8. Shortening that section, or introducing a break within it, would
tidy it. Cosmetic only.

---

# Submit speed

Once the PDF actually contained something, submission got slow — it had been
fast only because it was uploading a blank 4KB file.

Measured end-to-end on a real fact find:

| | PDF | Uploaded (base64) | Render |
|---|---|---|---|
| scale 2, quality 0.92 | 2.61 MB | 3.47 MB | 15.1s |
| **scale 1.25, quality 0.80** | **1.02 MB** | **1.40 MB** | 14.0s |

Now uses the lighter setting on both PDF paths. Page 1 was checked visually at
the new quality — these pages are text and rules, not photographs, so there is
no visible loss.

Note the render time barely moved. The ~15 seconds is html2canvas walking the
DOM, not pixel count, so quality settings cannot fix it. What the change buys is
the upload, which is where the time actually goes on branch mobile data.

## Progress feedback

Fifteen silent seconds reads as a hung page, and agents press submit twice. The
submit step now counts elapsed seconds, states the expected duration, and shows
the payload size while uploading.

## Not done: non-blocking submit

Making submit feel instant means POSTing the fact find first and sending the PDF
in a second request. That needs a new server-side stage: `ffProcessAgentSubmit`
currently sends the manager and client emails in the same call, so splitting it
naively either sends them with no PDF attached or sends them twice.

Worth doing, but it is a server change with an email-timing failure mode — not
the small tweak it first looked like.
