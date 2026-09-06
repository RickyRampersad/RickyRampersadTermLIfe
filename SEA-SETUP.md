# S.E.A. Past Papers & Practice — `/sea/`

An app for children sitting the Secondary Entrance Assessment. One file,
`sea/index.html`, no build step and no backend — the same shape as every other
screen in this repository. GitHub Pages serves it at
`rickyrampersadbranch.com/sea/`.

It does four things: lists every past paper the Ministry publishes, gives timed
practice built to the Ministry's blueprint, generates a mock Mathematics paper,
and runs the fifty-minute writing paper with a clock.

## Nothing is re-hosted

Every past paper link points at the Ministry of Education's own file on
`storage.moe.gov.tt`. **No PDF is committed here and none should be.** The
papers are the Ministry's copyright; linking is free, hosting is not, and a
copy in this repository would go stale the first time the Ministry replaces a
file. `tests/test-sea.js` fails if a PDF ever appears in `sea/`.

The same line applies to the commercial preparation booklets — Enco, Caribbean
Tutorial Publishing and the rest. Their papers stay in the printed booklet.
They are not typed into the bank and must not be.

The twelve items marked **SEA 2001** in the bank are typed from the 2001
Mathematics paper in the RD's Academy 2001–2017 binder. That is an official
Ministry examination paper, twenty-five years old and long out of circulation.

## Where the papers came from

Two Ministry pages, read on **6 September 2026**, and every link checked for a
`206` before it went in:

- <https://www.moe.gov.tt/primary-school-resources/> — 2021 to 2023, specimens, frameworks
- <https://moe.gov.tt/sea-2024-and-2025-past-papers/> — 2024 and 2025

Papers before 2021 are not on the public download pages. They sit behind a free
login on the Ministry's SLMS (`learn.moe.gov.tt`), which also carries its own
SEA Mathematics practice sets for 2010–2019. The app links there rather than
pretending the files are open.

When the Ministry posts a new year, add a row to `PAPERS` in `sea/index.html`.
Check the URL returns a `206` first:

```bash
curl -s -o /dev/null -w "%{http_code}\n" -L -r 0-1024 "<url>"
```

## The paper the mock is built from

Everything below is from the **Assessment Framework for SEA 2025–2028**, not
from memory. If the Ministry publishes a new framework, these numbers move and
`BLUEPRINT` in `sea/index.html` moves with them.

| Paper | Time | Items | Marks | Weighting |
|---|---|---|---|---|
| ELA Writing | 50 min | 1 of 3 prompts | — | 40 % |
| Mathematics | 75 min | 40 | 75 | 100 % |
| English Language Arts | 75 min | 36 | 64 | 60 % |

Mathematics, by section and strand:

| Strand | Section I | Section II | Section III | Items | Marks |
|---|---|---|---|---|---|
| Number | 10 | 8 | 1 | 19 | 34 |
| Geometry | 3 | 2 | 1 | 6 | 11 |
| Measurement | 4 | 4 | 1 | 9 | 18 |
| Statistics | 3 | 2 | 1 | 6 | 12 |
| **Total** | **20** | **16** | **4** | **40** | **75** |

Section I items are worth 1 mark, Section II 2 or 3, Section III 4 — which is
why Section II has to come out at 39 marks over 16 items. The generator picks
by strand and then swaps items of the same strand until it lands on 39 exactly.

## Adding a question

Append to `QUESTIONS` in `sea/index.html`:

```js
{id:"N31", strand:"Number", topic:"Percent", proc:"Applying", sec:2, marks:2,
 q:"…",              // HTML — use F(3,4) for a fraction
 fig:"barFruit",     // optional, a key in SVG
 unit:"cm",          // optional, shown beside the answer box
 a:["36","36 cm"],   // first one is what the student is shown
 exp:"…"}            // the working, not just the answer
```

Three things bite:

1. **The first answer in `a` is displayed.** Put the readable form first —
   `"1 3/8"`, not `"13/8"`; `"1, 2, 3, 4, 6, 8, 12, 24"`, not the run-together
   form. Both were caught this way, having been written the wrong way round.
2. **Marks are decided by the section**, not by taste. Section I is 1, Section
   II is 2 or 3, Section III is 4. The test enforces it.
3. **Add the arithmetic to `RECOMPUTED` in `tests/test-sea.js`.** The test
   fails on any plain-numeric answer that no one has independently recomputed.
   That is the whole point of it — a wrong answer here is a child taught the
   wrong thing and marked right for it.

## Tests

```bash
node tests/test-sea.js    # the bank: shape, blueprint coverage, arithmetic, marking
node tests/e2e-sea.js     # the app in a browser (needs playwright)
```

Both are picked up by `tests/run.sh`.

`test-sea.js` recomputes all 58 numeric answers and both list answers from the
question stems, in its own file, and compares. It does not ask the bank whether
the bank is right.

`e2e-sea.js` generates three mock papers and checks each is 40 items and 75
marks in the 20/39/16 and 19/6/9/6 split, that a paper answered from the bank
scores full marks, that a blank one scores nothing and returns all forty
explanations, and that nothing typed is lost on reload.

## Two things left open

**The logo.** RD's Academy is not the branch, so the gold shield in
`logo-mark.png` is not its mark and does not appear here — the header uses a
plain type tile instead. No emblem has been invented for the academy. If it has
a real one, drop it in and replace the tile.

**Contact details.** The binder label carries a phone number, an e-mail address
and a Facebook page. None of them are in the committed file. This repository is
public, and publishing a business's contact details is the owner's call to make,
not something to be assumed from a photograph.
