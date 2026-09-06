# RRB Academy — S.E.A. Practice — `/sea/`

Ricky Rampersad Branch Academy. An app for children sitting the Secondary
Entrance Assessment, and for the parents and teachers behind them. One file,
`sea/index.html`, no build step and no backend — the same shape as every other
screen in this repository. GitHub Pages serves it at
`rickyrampersadbranch.com/sea/`.

It lists every past paper the Ministry publishes, gives practice built to the
Ministry's blueprint, generates a mock Mathematics paper against the clock,
runs the fifty-minute writing paper, and keeps an answer key for the adults.

## It helps before it tells

This is the design decision the whole app turns on. A practice test that hands
over the answer teaches nothing, so every question has a four-rung ladder:

| Rung | What it gives | Opens for a student |
|---|---|---|
| 1 · What is it asking? | A reframe of the question. No method. | Always |
| 2 · The first step | The first move, and often a diagram. No numbers. | After rung 1, or after an attempt |
| 3 · Show the working | The full worked solution. | Only after a real attempt |
| 4 · The answer | The answer alone. | Only after a real attempt |

An attempt counts whether it is right or wrong — a child who tries and misses
has earned the working. **The gate is per encounter, not per lifetime.** Sitting
a mock paper marks all forty questions as attempted; that must not leave their
answers standing open afterwards, so meeting a question again re-locks it.
`tests/e2e-sea.js` checks exactly that, because it is the difference between a
practice app and an answer key with a clock on it.

Parents and teachers have all four rungs open from the start, and their own
Answer Key section. A hint that contains its own answer is not a hint, so
`tests/test-sea.js` fails if any pointer or first step contains the numeral it
is supposed to be leading towards.

## Three ways in

Three roles. `ROLES` at the top of the script names them and holds the codes.

| Role | Sees | Does not see |
|---|---|---|
| Student | Practice with the ladder, mock exam, writing, papers, syllabus | The answer key |
| Parent | Practice with everything open, answer key, papers, syllabus — and the child's progress | The mock exam |
| Teacher | Everything, plus a printable blank paper and a printable key | — |

The gate has two modes, and `const ACADEMY_API` decides which.

**Blank — the codes.** Each role has a code, and typing it is the sign-in. It
is the same pattern as `agent.html` and `staff.html`: a gate, not a login. The
site is static, so the codes are readable in the page source. It keeps the
answer key away from a child who should be practising; it does not know who
anybody is, and progress lives only in that browser's `localStorage`.

**Set — the sheet.** Paste in the `/exec` URL of `apps-script/Academy.gs`
(see `ACADEMY-SETUP.md`) and the gate asks for an e-mail instead. The Academy
adds a family to the Users tab by e-mail; the first time that e-mail is typed
in, the person chooses their own password. Role comes from the sheet, progress
is saved to it a couple of seconds after every change and comes back on any
device, and a parent signing in on their own phone lands on the child's
progress, by the child's name. The codes are ignored.

Passwords are never stored or e-mailed; what is protected and what is not is
set out in `ACADEMY-SETUP.md`.

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

Two places, both in `sea/index.html`. First the question, in `QUESTIONS`:

```js
{id:"N31", strand:"Number", topic:"Percent", proc:"Applying", sec:2, marks:2,
 q:"…",              // HTML — use F(3,4) for a fraction
 fig:"barFruit",     // optional, a key in SVG
 unit:"cm",          // optional, shown beside the answer box
 a:["36","36 cm"],   // first one is what gets displayed
 exp:"…"}            // the working — rung 3
```

Then its ladder, in `HINTS`, keyed by the same id:

```js
N31:{ask:"…",              // rung 1 — what is it really asking?
     step:"…",             // rung 2 — the first move, no numbers
     hfig:"percentGrid"}   // optional teaching diagram, shown with the step
```

A question with no hint fails the tests. So does a hint written for an id that
is not in the bank, and so does a pointer or step containing its own answer.

Four things bite:

1. **The first answer in `a` is displayed.** Put the readable form first —
   `"1 3/8"`, not `"13/8"`; `"1, 2, 3, 4, 6, 8, 12, 24"`, not the run-together
   form. Both were caught this way, having been written the wrong way round.
2. **Marks are decided by the section**, not by taste. Section I is 1, Section
   II is 2 or 3, Section III is 4. The test enforces it.
3. **Add the arithmetic to `RECOMPUTED` in `tests/test-sea.js`.** The test
   fails on any plain-numeric answer that no one has independently recomputed.
   That is the whole point of it — a wrong answer here is a child taught the
   wrong thing and marked right for it.
4. **Never put the answer in the pointer or the step.** It is easy to do by
   accident when the number is small. The test catches it, but the habit is
   to write the rungs as though the answer were not known yet.

## Figures

`SVG` holds sixteen diagrams. Some ask the question; the rest exist only to be
shown with rung 2 — the picture that makes the move obvious without making it
for them. `lshapeSplit` completes the L into a rectangle and shades the corner;
`fracEighths` puts quarters and eighths on the same bar; `sharing3` draws the
three boxes. Add wide ones to `WIDE_FIGS` so they are not capped at 300px.

Every figure a question names must exist, and every figure in `SVG` must be used
by something. The test enforces both, so a diagram cannot rot unnoticed.

## Tests

```bash
node tests/test-sea.js    # the bank: shape, blueprint coverage, arithmetic, marking
node tests/e2e-sea.js     # the app in a browser (needs playwright)
```

Both are picked up by `tests/run.sh`.

`test-sea.js` recomputes all 58 numeric answers and both list answers from the
question stems, in its own file, and compares. It does not ask the bank whether
the bank is right. It also checks every question has a ladder, that no pointer
or step gives its own answer away, that every figure named exists and every
figure defined is used, that the three roles have distinct codes, and that the
branch mark is where CLAUDE.md says it must be.

`test-academy.js` runs the real `Academy.gs` under the fake Sheets — see
`ACADEMY-SETUP.md`.

`e2e-sea.js` signs in as each of the three roles and drives the app. It then
points the page at a fake of the backend and walks a family through the
sheet-backed gate: a fresh e-mail choosing a password, an answer pushed up and
coming back on reload, a wrong password refused, and the parent landing on the
child's progress. It
generates three mock papers and checks each is 40 items and 75 marks in the
20/39/16 and 19/6/9/6 split; that a paper answered from the bank scores full
marks and a blank one scores nothing and returns all forty questions with all
four rungs; and that nothing typed is lost on reload.

Most of all it holds the ladder to its promise: the answer rung shut before an
attempt, still shut after only reading the pointer, open the moment a real
attempt is made right or wrong, and **shut again on the next question**. It
checks a student is neither offered the answer key nor able to reach it by
typing `#key` into the address bar, and that a parent and a teacher get the
whole ladder without attempting anything.

## The mark

`logo-mark.png` — the gold shield with the white check — on the gate, in the
header and in the footer, with the palette from `IBRAND` in `Intelligence.gs`:
navy `#07131f`, gold `#efc24b` into `#c9942c`, teal `#00CFEA`.

Nothing here draws a substitute. `tests/test-sea.js` asserts the file is
referenced at least three times, that no `<text>` element renders a monogram in
its place, and that the `.mark` rule still matches what CLAUDE.md sets out.
That check exists because a screen has twice shipped with an invented mark
beside three screens carrying the real one.

## Before this is sold

With the backend deployed, the app knows who a person is, keeps their progress,
and refuses them after a date — which is enough to sell a season by hand: the
family pays, you put a date in Paid Until, and the app does the rest. What it
does not do is take the money. Payment stays outside the app until there is a
reason to bring it in; the sheet is the billing system at this scale.
