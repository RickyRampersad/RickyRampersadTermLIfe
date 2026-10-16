# English B essay workshop — `/englishb/`

A guided workshop for writing a five-paragraph CSEC English B essay on the theme of
fear in John Wickham's short story *Blood Brothers*. Asked for on 15 October 2026:
"the objective is not to do this but to guide her and make think to do this", with a
student log in and a teacher log in, each with a code.

One page, `englishb/index.html`, and its own backend, `apps-script/EssayWorkshop.gs`,
in **its own Apps Script project on its own Google Sheet**. It is not part of the RRB
Academy (`/sea/`) and shares nothing with it: no tab, no secret, no sign-in, no `/exec`
address. Asked for the same evening: "dont wan this in my acadeny module as this is
different".

## What the student does

Six stages, in order, each with its own checklist and the teacher's note at the top:

| Stage | The student | The page helps with |
|---|---|---|
| 1 · Find the fear | Logs every moment of fear: who, what sets it off, Wickham's exact words | Five hints, one at a time, each pointing at a place in the story |
| 2 · Ask why | Answers eight open questions in their own words | An "I'm stuck" nudge per question that points, never answers |
| 3 · Your big idea | Sorts the moments into three kinds of fear they name, says what Wickham is saying, writes a thesis | The thesis is checked as they type; a model thesis about a *different* story |
| 4 · Plan the paragraphs | Point, evidence, technique, effect and link for each body paragraph; hook, context, restate, so-what | Logged moments drop into the evidence; each technique explained with an everyday example |
| 5 · Write it | Five paragraphs, each beside its plan | Word counts with a target; a tick list; the coach reads a paragraph and asks questions about it |
| 6 · Check and hand in | Reads it whole, checks it against a list, answers two reflection questions, hands in | A hand-in locks it until the teacher returns it |

**The coach never writes.** It is Claude (Opus 5.5), called from `EssayWorkshop.gs` so its
rules travel with every request and nothing in a browser can change them: no thesis,
no sentence, no rewrite, no quotation from the story, no list of points, at most two
questions a reply. The teacher reads every word of it. Forty questions and twenty
paragraph checks per student every six hours, so a stuck afternoon cannot run up a bill.

**The story is not in the repository.** It is under copyright and the repository root
is the website. The coach works from a summary in `EssayWorkshop.gs` that quotes a few words
at a time; the student works from their own book. `tests/test-englishb.js` fails if any
quotation in the page or the summary runs past nine words. What a strong essay would
argue is not written anywhere a student can open: a teacher who wants the coach to
steer towards particular points types them into **Notes for the coach** on the teacher
page, which only the script and the teacher read.

## What the teacher does

Signs in at the teacher door with the teacher code, then:

- **Adds a student** by first name. The page shows the code to hand out (`PIGEON-6MXS`
  style: a word, then four characters).
- **Watches the class**: each student's progress through the six stages, words
  written, questions asked, hints opened, and any large block of text pasted in.
- **Opens a student** and reads every stage, the whole coach conversation and the
  activity; leaves a note on any stage and marks it *ready to move on* or *needs more
  thought*. The student sees both at the top of that stage.
- **Returns** a handed-in essay with a note, which opens it again.
- **New code** for a student who lost theirs (the old one stops at once), **rename**,
  **switch off**.
- Sets the **essay question**, the **due date** and the **notes for the coach**.

A teacher sees only their own class: the Class column on the Essay Codes tab ties a
student to a teacher.

## Putting it live (about ten minutes)

| Step | What |
|---|---|
| Make a **new** Google Sheet | Call it *English B Essay Workshop*. Not the Academy's sheet and not the branch's: this one holds a student's work. |
| Extensions → Apps Script | Name the project, and paste `apps-script/EssayWorkshop.gs` in as its only file. It has its own `doGet` and `doPost`, so it must never go into another project. |
| Project Settings → Script properties | Add **`ANTHROPIC_API_KEY`**. The Service Questionnaire project already holds one for the group letters; a new key from the Anthropic Console works the same. Without it everything runs and the coach says it is off. |
| Run `essaySetup()` | Authorise when asked. Makes the five tabs, the signing secret and the first teacher code, and **shows you the code**. Safe to run again; it never makes a second teacher code. |
| Deploy → **New deployment** → Web app | *Execute as:* Me · *Who has access:* Anyone. Copy the `/exec` address. |
| `englishb/index.html` | Put the address into `const ESSAY_API = ""` near the top of the script (or send it over and it goes in for you). Commit, push, merge to `main`. |
| Run `essaySelfTest()` | A throwaway student: sign-in, save, hand-in, lock. It must say **ALL GOOD**, and it deletes what it made. |
| Open `/englishb/` → teacher door | Add the student, and give them their code. Do not send anybody the link before the merge. |

Until the address is in the page, the gate says *"The workshop is not connected yet."*
Later changes to the script: paste, then Deploy → Manage deployments → pencil →
**New version**, so the address the page holds never changes.

## The tabs

| Tab | Columns | Notes |
|---|---|---|
| Essay Codes | Code, Role, Name, Class, Status, Id, Created, Last Used | Role `teacher` or `student`. `off` in Status switches a code off. A row typed in by hand works; its Id is filled at first sign-in. Never paste a code anywhere public. |
| Essay Work | Id, Updated, Work, Review Updated, Review | One row per student. The student's notebook and the teacher's notes are separate cells, so neither save overwrites the other. |
| Essay Coach | At, Id, Stage, Who, Text | Every question and every answer. |
| Essay Classes | Class, Question, Due, Coach Notes, Updated | One row per class. |
| Essay Activity | At, Who, Did, Note | Sign-ins, refused codes, hand-ins, returns, new codes. Never a code. |

## What is kept

The student's first name, everything they write, every coach question and answer,
when they signed in, and when a block of fifteen words or more was pasted (outside
Stage 1, where copying the story's words is the task). The teacher sees all of it; the
page tells the student so on the sign-in screen, including that their question and their
work so far go to Anthropic for the coach to answer. Nothing else is asked for.

## Tests

```bash
node tests/test-englishb.js   # the real EssayWorkshop.gs under the fake Sheets and a fake Claude
node tests/e2e-englishb.js    # the page in a browser against the real EssayWorkshop.gs (needs playwright)
```

`test-englishb.js` covers the codes (wrong doors, case and spacing, thirty wrong tries,
a new code ending the old sign-in, switched off), the lock after a hand-in that a page
cannot lift by itself, a teacher who cannot reach another class, the exact request the
coach is sent (model, effort, fallback, the rules in the system prompt, the student's
words inside tags, no thinking blocks sent back), refusals and outages as sentences, the
six-hour limit, and that the page and the script agree on every stage, question and
check key. It also fails if anything of the workshop appears in `Academy.gs`, or if the
page points at the Academy's address. `e2e-englishb.js` walks a teacher and a student through all six stages,
the return and a phone, with no console errors.
