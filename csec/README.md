# CSEC Study Hub

A CSEC / CXC exam-preparation module for Trinidad and Tobago secondary students,
covering **Form 1 through Form 5**. Built for a Form 2 student at Lakshmi Girls'
Hindu College, St Augustine, and general enough for any T&T secondary school.

Live path: `/csec/` on rickyrampersadbranch.com (GitHub Pages).

---

## What it does

| Page | Purpose |
|---|---|
| `index.html` | Front door — student / parent / teacher sign-in and profile creation |
| `student.html` | The student's desk: daily plan, mastery rings, streak, study timer |
| `practice.html` | The practice engine — CSEC-style questions with reasoning and exam technique |
| `parent.html` | Read-only progress view with a plain-language summary and session history |
| `teacher.html` | Class roster, class-wide weak strands, and focus-topic assignment |
| `journey.html` | The guided journey — what this term is for, what is new this year, what is carried forward, every milestone ahead |
| `test.html` | Timed mock tests under examination conditions — no feedback until submission |
| `kpi.html` | Readiness index, projected grade bands, and the Form 1–5 term-by-term record |
| `guides.html` | Guided worked methods — how to attack the highest-value question types |
| `planner.html` | Syllabus browser — every strand, the forms it is taught in, and progress on it |
| `papers.html` | Verified links to official, international and Ministry resources |
| `settings.html` | Subject selection, form promotion, profile, backup / restore, data clearing |

---

## The three logins, honestly described

**These are device profiles, not accounts.** The site is static HTML on GitHub
Pages — there is no server, no database and no authentication behind it. A
profile and its PIN live in `localStorage` in one browser on one device.

That is enough to keep a younger sibling out of the wrong profile and to keep
three people's progress apart on a shared laptop. It is **not** a security
boundary: anyone with the device and a browser console can read it. This is
stated on the sign-in page and again in Settings, so nobody is misled.

Consequences worth knowing:

- Progress does **not** sync between devices. Use **Settings → Export backup**
  and restore the JSON file on the other device.
- Clearing browser data erases everything. The backup file is the only copy.
- Parent and teacher views read the student profiles **on that same device**.
  A parent on their own phone will see nothing until a backup is restored there.

Making these real accounts would need a backend. The natural fit for this repo is
an Apps Script + Sheets endpoint, the same pattern already used by
`gs/views-counter.gs` — see *Next steps* below.

---

## Past papers — what is here and what is not

The request behind this module was to "scrape the ministry sites and pull in all
the past papers". That is not what this does, deliberately:

- **CSEC past papers are copyright CXC**, which sells them as eBooks through
  [cxc-store.com](https://cxc-store.com/past-papers/csec). Scraping and
  republishing them on a public site owned by an insurance branch would be
  copying someone else's product without permission.
- **What CXC gives away free is the more useful half**: the full syllabus for
  every subject, plus specimen papers, mark schemes and subject reports, at
  [cxc-store.com/syllabuses-subject-reports](https://cxc-store.com/syllabuses-subject-reports).
  The syllabus states exactly what an examiner may ask.
- **The Ministry of Education (T&T)** publishes worked CSEC solutions and CPDD
  activity sheets on its own learning platform, [learn.moe.gov.tt](https://learn.moe.gov.tt/).

So `papers.html` is a **verified link directory** to those sources (every URL
checked reachable on 7 September 2026), with a per-subject syllabus download
checklist. The practice content in this hub is **original** — written for the hub
in CSEC Paper 01 style and tagged to syllabus strands.

### International resources

The same page lists 12 free international sources — Khan Academy, BBC Bitesize,
PhET, OpenStax, Desmos, GeoGebra, LibreTexts, Project Gutenberg, CommonLit,
Wolfram Alpha, MIT OpenCourseWare and Save My Exams. **None is written for CXC**,
so each carries an honest note on how well it aligns and where it does not:
Khan Academy's mathematics maps almost directly, BBC Bitesize's GCSE science
overlaps heavily, English literature set texts do not transfer at all. CK-12 and
Quizlet were excluded because they returned 403 to verification.

---

## How the study model works

**Strands, not subjects.** Progress is tracked against CSEC syllabus sections —
`Consumer Arithmetic`, `Resistance & Revolt`, `Waves & Optics` — because "Maths
62%" tells a student nothing actionable.

**Spaced repetition (SM-2 lite).** In `recordAnswer()`:

- Correct → ease rises by 0.08 (capped 2.8), interval grows by the ease factor
  (capped 30 days), and the strand is scheduled forward.
- Wrong → ease drops by 0.2 (floor 1.3) and the interval resets to 0, so the
  strand is due again immediately and appears in tomorrow's plan.

**The daily plan** (`planFor()`) scores every strand the student carries, using
inaccuracy, how overdue it is, and how little it has been practised. Untouched
strands score 70 so they surface early. A day-seeded jitter breaks ties, so a
student who has not practised yet does not get the identical six strands every
morning. Output is capped at two strands per subject so the plan spreads.

**Form gating.** `questionsFor()` will not serve material more than one form
ahead of the student, and the plan only draws strands taught in the student's
current form. A Form 2 student is never handed Form 5 vectors.

---

## The guided journey

The form is the input that drives everything, so it is chosen deliberately: the
create-profile screen has **no pre-selected form**. A silently wrong default
would mis-set the syllabus, the milestones and the countdown for five years, so
creation is blocked until a form is tapped, and each option says what that year
means before you pick it.

From that one input, `journey.html` pulls in what is relevant:

- **Where you are standing.** Form, stage, school year, and which of the three
  terms is running now — derived from the date, not typed in.
- **What this term is for.** Every form is broken into T1/T2/T3, each with an
  aim and three concrete things to do. The current term is highlighted; past
  terms dim.
- **New to you this year.** `newThisYear()` returns strands taught in this form
  but *not* in the one below — the material nobody has covered yet, which is
  where a term goes wrong quietly. Form 3 has 20 of them; Form 5 has none, and
  the page says so rather than showing an empty list.
- **Carried forward.** `carriedForward()` returns strands from earlier forms
  still under 60%. This is the debt that sinks a Form 4, and it is far cheaper
  to clear in Form 2.
- **Milestones ahead**, nearest first, with the current term's flagged:
  Form 3 T3 subject selection, Form 4 T1 SBA begins, Form 5 T2 SBA submission,
  Form 5 T3 the examinations.

The page works signed out too, with a form selector, so a parent can look at
what Form 1 or Form 4 involves before anyone has a profile.

---

## Joining the primary site

`curriculum.js` carries a `stages` array — the spine from Infant 1 to CSEC:

| Stage | Years | Ends at | |
|---|---|---|---|
| `primary` | Infant 1 - Standard 5 | SEA | `external: true` |
| `lower` | Form 1 - Form 3 | Subject selection | forms 1-3 |
| `upper` | Form 4 - Form 5 | CSEC | forms 4-5 |

Primary is listed but marked `external`, and renders dashed on the journey
spine, because it is served by a separate site. It sits in the data so a student
can see where they came from, and so the two can be joined without reshaping
anything.

**To join the primary site**, in rough order of effort:

1. Give `primary` a `forms` array (or an equivalent `standards` array) and a
   `url`. The spine renders whatever stages it is given; drop the `external`
   flag and it stops rendering dashed.
2. Extend `roadmap` with entries for the primary years in the same shape —
   `terms[]` with `aim` and `do[]`, plus `milestones[]`. `journeyNow()`,
   `newThisYear()` and `carriedForward()` are written against the shape, not
   against Forms 1-5, so they work unchanged.
3. `examYear()` and `countdown()` in `csec.js` assume five forms to CSEC and are
   the one place that hard-codes the ladder. A primary student needs a countdown
   to **SEA**, not to CSEC, so that function needs a stage check.
4. Add primary subjects to `subjects` with `forms` values on the primary scale,
   keeping the strand-id prefixes distinct.

Nothing else in the hub knows how many years there are.

---

## Tracking a student across five years

The form is not just a filter — it is the spine of the record.

**Term snapshots.** Every practice session and test writes a snapshot for the
current school term (T1 Sept–Dec, T2 Jan–Mar, T3 Apr–Jul), overwritten as the
term goes on so it always reflects where the term finished. Fifteen terms
across Forms 1–5 become fifteen points on the KPI timeline.

**Promotion.** Settings → *Moving up a form* moves a student up. Mastery carries
forward — she has not forgotten Form 2 mathematics — but a `history` entry
records the date, the term, and the accuracy and coverage she left the year on.
The syllabus for the new form opens up, which means **coverage correctly drops**
on promotion: 5 of 7 Maths strands as a Form 2 is 5 of 9 as a Form 5.

**The timeline chart** on `kpi.html` plots accuracy and syllabus coverage per
term, with shaded bands showing which form each term belonged to.

---

## The KPI model

`readiness(studentId, subjId)` returns a **Readiness Index** from 0 to 100:

| Component | Weight | What it asks |
|---|---|---|
| Accuracy | 40% | Can she do it at all |
| Syllabus coverage | 25% | Has she met the syllabus taught to her form |
| Retention | 20% | Can she still do it a week later |
| Timed tests | 15% | Can she do it against the clock |

**Retention is the interesting one.** It is accuracy on attempts made at least
seven days after a strand was first seen — the difference between a student who
has revised and one who crammed. It needs a per-attempt log, which is why each
strand keeps a capped `log` array rather than running totals alone.

Where retention or timed data is missing, a discounted proxy stands in
(accuracy × 0.85 and × 0.80) and the result is flagged `provisional` rather than
quietly inflated.

**Bands are named for the grade they track towards, never stated as the grade.**
≥80 Grade I track, ≥65 Grade II, ≥50 Grade III, ≥35 below pass, under that a
serious gap. CSEC awards Grades I–VI; I, II and III are passes.

### Honesty rules built into the model

- **It is not a CXC prediction.** It is derived from practice inside this hub,
  which flatters: multiple choice, no time pressure, an explanation after every
  question. The disclaimer sits above the numbers on `kpi.html`, not in a footnote.
- **Thin evidence shows no band at all.** Below 5 answers in a subject (15
  overall) `readiness()` returns `thin: true` and `band: null`, and the UI says
  "too early to say". Without this, one lucky answer displayed as "Grade II
  track" — which it did, until the browser screenshot caught it.
- **The distinction board ranks on evidence, not score.** Well-evidenced
  subjects sort above thin ones, so a thin 75 never outranks a practised 68 and
  send her to the wrong subject. `onTrack` ignores thin subjects entirely.

---

## Timed tests

`test.html` runs 10/20/30 questions at roughly the CSEC Paper 01 pace of 90
seconds each. No feedback until submission, a clock that auto-submits at zero, a
question map with flagging, and a full review of every question afterwards.
Answers still feed the mastery model, and the result is stored in `progress.tests`
and weighted into the readiness index.

The verdict after a test comments on **pace as well as score** — finishing in
under half the time is reported as a problem, because it usually is.

---

## Guided methods

`data/guides.js` holds 16 worked methods for the question types that carry the
most marks. Each is: when to use it, the method as numbered steps, one fully
worked example with every line explained, and the mistakes that lose marks.

A strand with a guide gets a **📐 method** link on the daily plan, and a weak
topic in a test result links straight to it. Same shape as a question:

```js
{ id:'g-ma-quad', subj:'mathematics', strand:'ma-algebra', form:3,
  title:'…', when:'…',
  steps:[{do:'…', note:'…'}],
  worked:{ problem:'…', lines:[{work:'…', note:'…'}] },
  pitfalls:['…'] }
```

---

## The chart palette

The KPI timeline uses `#b8862a` (accuracy) and `#0093ad` (coverage) — **not** the
branch display gold and teal, which fail the dark-surface lightness band. These
two pass all six checks of the dataviz validator against the `#163553` card
surface: lightness band, chroma floor, CVD separation (ΔE 17.3 protan / 21.0
tritan), normal-vision separation (ΔE 21.8) and 3:1 contrast. Re-run before
changing them:

```bash
node scripts/validate_palette.js "#b8862a,#0093ad" --mode dark --surface "#163553"
```

Identity is never colour alone: two series carry a legend, direct value labels on
the final point, and a table view toggle.

---

## Adding questions

Append to `data/questions.js`. Every field is required except `tech`:

```js
{ id:'ma21',                    // unique across the whole bank
  subj:'mathematics',           // must be a key in curriculum.js subjects
  strand:'ma-consumer',         // must belong to that subject
  form:3,                       // earliest form this fits
  diff:2,                       // 1 easy, 2 typical, 3 stretch
  q:'…',                        // the question stem
  opts:['…','…','…','…'],       // exactly four
  a:0,                          // index of the correct option
  why:'…',                      // why it is right — shown after answering
  tech:'…' }                    // optional exam-technique note
```

**Write the correct option first (`a:0`).** Every question in the bank does, which
makes the file quick to author and quick to review. The practice engine shuffles
the four options every time a question is displayed and maps the click back to
the original index, so on screen the answer lands in a different position each
time — including when a student meets the same question twice. Never rely on the
stored order when reading the UI; `orderFor()` in `practice.html` owns it.

Validate before committing — this catches wrong strand tags, duplicate ids and
malformed options:

```bash
node -e "
global.window={};
require('./csec/data/curriculum.js'); require('./csec/data/questions.js');
var C=window.CSEC_CURRICULUM,Q=window.CSEC_QUESTIONS,ids={},bad=[],st={};
Object.keys(C.subjects).forEach(s=>C.subjects[s].strands.forEach(t=>st[t.id]=s));
Q.forEach(q=>{
  if(ids[q.id])bad.push('duplicate id '+q.id); ids[q.id]=1;
  if(st[q.strand]!==q.subj)bad.push(q.id+': strand not in subject');
  if(!Array.isArray(q.opts)||q.opts.length!==4)bad.push(q.id+': needs 4 options');
  if(typeof q.a!=='number'||q.a<0||q.a>3)bad.push(q.id+': bad answer index');
});
console.log(bad.length?bad.join('\n'):'OK — '+Q.length+' questions valid');"
```

---

## Subjects

`curriculum.js` carries **23 subjects and 131 syllabus strands**. Fourteen are
selected by default, inferred from the student's spoken subject list and
cross-checked against the subjects Lakshmi Girls' Hindu College offers:

> English A · English B · Mathematics · Spanish · French · Physics · Chemistry ·
> Biology · Geography · History · Social Studies · Visual Arts · Physical
> Education · Information Technology

**This default is an inference and should be corrected.** Settings → Subjects
lists all 23 (Integrated Science, Food & Nutrition, POB, POA, Additional
Mathematics, Music, Religious Education, Technical Drawing, Agricultural Science
are the rest) — tick the real timetable and save. Everything downstream follows.

---

## House conventions observed

- Every page carries the `<!-- rrb-views -->` beacon before `</body>`.
- Every page uses `logo-mark.png` via the standard `.mark` block. Nothing draws
  a substitute mark.
- Palette is the branch palette: navy `#07131f`, gold `#efc24b`→`#c9942c`,
  teal `#00CFEA`.

---

## Next steps, in the order they would pay off

1. **Fix the subject list** in Settings if the inferred 14 are not exact.
2. **More questions.** 122 across 14 subjects is a working seed, not a full bank.
   Maths, English A and English B are deepest; Visual Arts and PE are thinnest.
3. **Real accounts and cross-device sync** via an Apps Script + Sheets endpoint,
   following `gs/views-counter.gs`. That would let a parent see progress from
   their own phone and turn the teacher view into a real class register.
4. **More guided methods.** 16 covers the highest-value question types; English B,
   Spanish, French, Social Studies and PE have none yet.
5. **Join the primary site** — see *Joining the primary site* above. The data
   model is ready; the countdown is the one function needing a stage check.
6. **Past-paper practice log** — a place to record scores on real CXC papers
   worked under time, alongside the hub's own timed tests.
7. **SBA tracker** for Forms 4–5, since SBA deadlines cost more grades than
   content gaps do.
8. **Calibrate the readiness weights** once there is a real CSEC result to check
   them against. The 40/25/20/15 split is a considered starting point, not a
   fitted model, and it should be corrected by evidence when evidence exists.
