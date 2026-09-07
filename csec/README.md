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
| `planner.html` | Form 1–5 roadmap, CSEC countdown, and the full syllabus strand browser |
| `papers.html` | Verified links to official syllabuses, past papers and Ministry resources |
| `settings.html` | Subject selection, profile, backup / restore, data clearing |

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
4. **Past-paper practice log** — a place to record scores on real CXC papers
   worked under time, which is the Form 4–5 half of preparation.
5. **SBA tracker** for Forms 4–5, since SBA deadlines cost more grades than
   content gaps do.
