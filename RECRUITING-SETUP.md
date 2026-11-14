# Three seats, three ads — `/buildwithus/`, `/joinourbranch/`, `/clientmanager/`

Asked for over 6 November 2026, in these words:

- *"I need to hire an admin assistant … I need to have around me an innovator and
  persons maybe who are stuck where they are. They don't have the tools to work
  with, but they have ideas … **You are to create an ad for me before we do a
  video first** … create a questionnaire that will zoom into them, that will
  filter the correct candidate for me."*
- *"So it's two builds. One is the agent, so that's a separate ad … I want a nice
  theme for the agent, knowing if they're stuck in the environment. We use a lot
  of digital tools. We give them leads. We look at household … **I'm looking at a
  creative ad that has never been done in Trinidad.** They click apply there …
  Before they click apply there, can you do something so they can more or less,
  it builds in before they get to the apply there."*
- *"I'd like to also do a third ad … an underwriter with experience. We are
  launching our general insurance agency … So stuck where you don't have any
  growth, come to us, use the tools, be creative … let's filter out areas for
  data upload the resumes, filter down so we can spot a good candidate."*
- *"No it's the music and using Andrew voice you have stored."* ·
  *"Want to post on our Facebook and Instagram pages and TikTok."*
- *"I'm finding the words very difficult to read. You need to ensure it's scaled
  and professionally worded, and the fonts that pops and a lot of motion and
  wow."*

Three different people are being looked for and each gets its own door, its own
film and its own filter. Nothing is shared between them except the look, the
voice and the music.

---

## What was built

| | administrator | advisor | client manager |
|---|---|---|---|
| The page | `/buildwithus/` | `/joinourbranch/` | `/clientmanager/` |
| The film's page to post | `/buildwithusvideo/` | `/joinourbranchvideo/` | `/clientmanagervideo/` |
| The films | `buildwithus/film-w.mp4` | `joinourbranch/film-{v,f,w}.mp4` | `clientmanager/film-w.mp4` |
| Length | 86.3 s | 45.60 s | 114.7 s |
| Where it applies | this branch, `Quotes.gs` | **TalentNest** | this branch, `Quotes.gs` |
| Form key / reference | `admin` → **`QB-`** | — | `underwriter` → **`QU-`** (kept, see below) |
| CV upload | no | no | **yes**, to Drive |
| Who reads it | the Branch Manager | the Branch Manager and the Unit Manager | the Branch Manager |

**The administrator's and the client manager's films were re-cut on 7 November
2026** in the board-film look, after the first set was turned down eight times
(`tools/film/CANVA-AND-THE-EIGHT-CUTS.md`). Each replaced its own `film-w.mp4`,
so every page, poster and share card picked the new one up with no edit. The
upright (9:16) and feed (4:5) cuts on those two are **still the earlier look**
and are no longer offered: both video pages now show the wide cut alone and say
the other two are being re-laid out. Re-laying them out is a layout job, not a
re-render — the scenes are built for a 1224×540 stage. The advisor's film is
untouched and still has all three.

All three are linked from the homepage's Careers section. The advisor ad sits
beside `/careers/` rather than replacing it: `/careers/` is the whole selection
process, this is the short, sharp "here is what you would be given" door for
somebody who is already contracted somewhere and is not browsing a careers page.

**The three ad pages are hand-written**, like `/careers/`: they post `q.quote`
directly, so they are not in `tools/forms/forms.json` and `build-forms.py` does
not write them. **The three video pages are generated** — edit
`tools/adpages/adpages.json` and run `python3 tools/adpages/build-adpages.py`,
never a generated page. Three near-identical pages drift apart the moment one is
hand-edited, and the first thing to drift is the Open Graph block, which is the
only part a WhatsApp or Facebook preview reads.

### To put it live

1. Merge the branch. Every page is served the moment `main` carries it — GitHub
   Pages, no build step.
2. Paste **`apps-script/Quotes.gs`** into the Service Questionnaire project,
   then **Deploy → Manage deployments → pencil → New version**. Never *New
   deployment*: that issues a fresh `/exec` and every front end has to be
   re-wired.
3. Set the **`QUOTE_CV_FOLDER`** Script Property to the id of a Drive folder
   that will hold the client manager CVs. Make the folder somewhere **the Branch
   Manager can already open**, and share it with the account the script runs
   as: the file is created by the script, so it inherits the folder's sharing,
   and a link to a file nobody but the script can open is no use in the e-mail.
   Without the property a CV is still accepted and the application still files
   — the row's Note says the CV could not be stored and names why, rather than
   the application being lost.
   **The first run after this will ask for the Drive permission**, because
   writing the CV is the first thing in this project to touch `DriveApp`. Run
   anything in the editor once and accept it, before the ad goes out.
4. Put `TEAM_CODE` back into `Service.gs` if that file was pasted in the same
   sitting — a full paste blanks it and every wall and board locks out.
5. Check it from a browser: `?action=q.ping` answers `quotes: 1` once the live
   deployment carries the forms.

**Until step 2, every page still works.** An application that cannot reach the
backend shows the candidate a local reference and opens their mail app with
every answer in it, addressed to the Branch Manager. Nothing is lost to a bad
minute of signal — the road `/careers/` already takes.

---

# 1 · The administrator — `/buildwithus/`

## The ad

Five cuts. The first line does all the work in each, because this person is
**not** searching the words "administrative assistant" — they are scrolling
past them.

**We no longer lead with "our code is public."** Decided 6 November 2026, and
he was right: the administrator with ideas and no tools is very unlikely to
know what GitHub is, so that line reads as jargon to the person we want and as
a beacon to developers, who want a different job and would leave when they
found out half the day is petty cash and licence renewals. The asset is real,
so it stays — demoted from the hook to the proof, and in plain words: **"Most
employers show you a job description. We will show you the whole workshop."**

## The ad is the test — `/buildwithus` opens on a broken form

Decided 7 November 2026, after five cuts of a recruiting film were turned
down. The note on that is in `tools/film/beat/README.md`; the lesson that
matters here is that the films were all *about* the job, and the strongest
thing in this whole campaign was already written and had never been built:
**the interview is one question — find something here that is clumsy, or
missing, or would save somebody an hour, and say how you would fix it.**

So the page asks it on the way in. The first thing after the hero is a form
like the ones a branch runs on — `GL 114 (Rev. 2014)`, *Petty Cash &
Document Transmittal Request*, photocopied-grey, monospace, dotted rules —
under one line: **"This is the job you have now. Fix it."** Every part of it
is tappable. What they mark is the application.

**Twelve faults are planted, and the number is never shown.** Nor are the
faults named on screen. The moment a candidate can see how many there are it
stops being a judgement and becomes a puzzle hunt, and the thing being
measured is what they *notice*, not what they can guess. The explanations
live in `FIXES[]` in the page's script and travel to the Branch Manager only.

| the fault | why it is one |
|---|---|
| the date | no format; `03/04/26` is two dates depending on the reader |
| the client, three times | asked on lines 2, 7 and 10 of one sheet |
| the policy number | two formats in its own example, nothing checks either |
| the department | free text — the Log Book had 25 departments typed about 90 ways |
| one form per document | six documents is six forms, six signatures, six scans |
| the total | added by hand, nothing checks it against the three lines above it |
| the reason box | a line and a half to explain a payment |
| "receipt attached? YES / NO" | asks about the receipt instead of taking it |
| the signature | print, sign, scan, e-mail: digital until the step that matters |
| "complete a new form" | a correction means starting again, so people use a pen |
| "no copy will be sent to you" | the person who filled it has no record that they did |
| the office-use block | on a sheet anybody can type into: a hope, not a control |

**The three client-name fields count as one find.** Marking any of them is
the insight; marking all three is not three times the insight (`distinct()`).

**What the Branch Manager receives**, in the e-mail's own section, is the
score (`6 of 12 found`), what they marked **in the order they marked it**
with their own words and the branch's note on each, anything they found that
was never planted, and **what they walked past** — which is as informative as
what they caught.

**The five-question quiz it replaces is gone**, along with its stylesheet and
its script: one mechanic, not two, and a page that asks a candidate to find
dead weight should not be carrying forty lines of it.

Two things that hold whatever else changes:

- **The marks travel whether or not "Send what I found" is pressed.** They
  are the application, and a person who scrolled past that button has still
  told us what they noticed.
- **With no script the marking is hidden, not broken.** A line says so and
  the ordinary application below still works — the rule every branch form
  keeps.

Covered by `fixtest.js` in the session scratchpad (39 checks, Playwright, a
laptop and a phone: the counter, the three-names rule, that the page never
prints the answers or the total, that marks survive a reload, no sideways
scroll at 390, and the no-JS fallback), and `fixsend.js`, which fills the
whole application against a mocked backend and prints what he actually reads.

### 1 · LinkedIn (the flagship — this is where the person with a job is)

> **You already know how your office should run. Nobody has given you the tools.**
>
> I am hiring one administrator for my branch in Chaguanas, and before you scroll past that word, read what the job actually is.
>
> This branch writes and runs its own software. The client letters. The document log. The claims intake. The monthly check of an insurer's invoice against our own records, line by line. Thirty-six files and about a hundred thousand lines of it — all built in-branch, by people who were not hired as developers and did not know how when they started.
>
> So here is the seat. Half your day is the branch's administration, and it has to be right, because if it is not then an agent cannot work and a client waits. The other half is making that first half smaller: taking a job you do by hand and turning it into a form, a script, a page, and then measuring whether it actually worked.
>
> You do not need to be a developer. You do need to have already written something — a Google Apps Script, a formula that got out of hand, a Zap, a page, something you talked an AI through until it worked — because the alternative was doing it by hand forever. Apps Script, Google Workspace, Salesforce and Claude are already paid for and already connected here. You get the keys, not a request form.
>
> Two things make this different from anything else you will read today.
>
> **We show you the whole workshop before you apply.** Not a job description: everything this branch has actually built, open, for you to look through and judge for yourself.
>
> **And the interview is not a CV.** It is one question — find something here that is clumsy, missing, or that would save somebody an hour, and tell us how you would fix it.
>
> The form takes fifteen minutes and asks what you earn now, because the conversation should be honest from the first minute. I read every one myself. If you are employed today, nobody there will hear of it.
>
> **rickyrampersadbranch.com/buildwithus**
>
> — Ricky Rampersad, Branch Manager, Guardian Life of the Caribbean

### 2 · WhatsApp (your own network and the branch group)

Under 120 words, bold with single asterisks, no hard line wraps, and an ask
that is easy to answer — the house rules for a branch message.

> *We are hiring one administrator. Not a normal one.*
>
> This branch writes its own software — the letters, the claims intake, the billing checks. About a hundred thousand lines of it, built in-branch by people who were never hired as developers.
>
> So the job is half administration and half making that administration unnecessary. Not a developer's job — but you have written something already, on your own time, because nobody was going to do it for you.
>
> Before you apply we show you everything we have built, so you can judge for yourself. The form takes fifteen minutes. The interview is one question: what would you fix here?
>
> rickyrampersadbranch.com/buildwithus
>
> Do you know one person stuck in an admin job who is always fixing things nobody asked them to fix? Send them this, and send me their name.

### 3 · Facebook and Instagram (feed, read with the sound off)

> **If you have ever written a script to fix something nobody asked you to fix, this is for you.**
>
> One administrator's seat. Chaguanas. An insurance branch that writes its own software and will hand you the keys to it.
>
> Half admin. Half making the admin unnecessary.
>
> We show you everything we have built before you apply.
>
> → rickyrampersadbranch.com/buildwithus

### 4 · Job board or classified (CaribbeanJobs, the press)

> **ADMINISTRATOR & BRANCH BUILDER** — Ricky Rampersad Branch, Guardian Life of
> the Caribbean. Chaguanas, Central Trinidad.
>
> An administrator's seat in a branch that writes and runs its own software.
> Half the role is the branch's administration, done properly. The other half
> is automating it — and you are given the tools, the access and the time.
>
> No technical qualification required. We are looking for someone who has
> already improved a process with whatever they were handed, and who finishes
> what they start. Care with figures is essential; this work reaches real
> families.
>
> Apply in about fifteen minutes at **rickyrampersadbranch.com/buildwithus**.
> Applications are read by the Branch Manager personally and treated
> confidentially.

### 5 · One person, by message (the highest-yield cut of all)

The best hire for this seat is probably already known to somebody in the
branch. Send this to one person rather than broadcasting it:

> I am hiring an administrator and I thought of you. Not a normal admin job —
> half of it is building the tools instead of just using them. You can see
> exactly what you would be walking into before you decide:
> rickyrampersadbranch.com/buildwithus. Have a look and tell me honestly if it
> is you.

## Who the ad is for: the filing cabinet, 8 November 2026

Asked for in these words: *"the traditional agency where a person cannot excel
has the old way where filing cabinets, files, paper... you specifically want to
target where the work has become overwhelming for persons with filing cabinets,
manual, paper, and still depend on the emails. Where our process is that looking
at the data and pulling and scrubbing the insights and allowing our proven
systems to make and do the research for you."*

The page already showed the machine, stop by stop, in `#tech`. What it had never
done is **name the day the right person is living**. Nobody leaves a job because
of a feature list; they leave because somebody described their own Tuesday back
to them. So:

- **A ledger section, `#old`**, between the book and the seven stops: six rows,
  *Everywhere else* against *Here*. (**Superseded 9 November 2026** — the
  headers are *Your week now* / *Your week here*; see “Describe the work,
  never the workplace” below. Do not restore the old pair.) The drawer and
  last year's file in a
  different drawer; re-keying the client into the insurer's proposal form; the
  insight being whatever you happened to notice; chasing the client or losing
  the renewal; what the client holds living in your head or an e-mail thread;
  the data in four places that disagree. Each answered by the thing the branch
  actually runs.
- **The attraction line names it first and the autonomy second.** It was *"and
  have never once been allowed to change how it is run"* alone; it now opens on
  the cabinet and the inbox. Same line on the page and on all three posters,
  which is the rule.
- **The hero says there is no filing cabinet in this seat**, and that the record
  is pulled from every source and scrubbed before you read it.

**Honest about paper, which is what makes it believable.** Contracts and cheques
still arrive from the insurer and clients still sign things. The claim is not
that paper is gone — it is that **no record here can only be found on paper**:
every document that arrives is logged, routed, signed for by name and tracked
until it is answered. Claiming a paperless office to somebody who has worked in
insurance for fifteen years loses them at the first sentence.

### Three things it cost

- **The longer pull reopened the layout-shift bug, in a second element.** Three
  lines in Inter Tight and four in the metric-matched fallback at every width
  from 768 up, so the hero column reflowed by a line when the font landed and
  the buttons under it moved: **CLS 0.0127 → 0.0985 at 1366**. It is the h1's own
  0.577 bug one element down, and the lesson there holds — no `size-adjust`
  closes a gap that narrow. `.pull` now reserves `calc(4 * 1.32em)`, so the box
  is four lines tall whichever face draws it; on a phone the line genuinely is
  five and the `min-height` does nothing. **0.0985 → 0.0133.** The scan that
  finds this (`scan.js` in the session scratchpad) prints the line count per
  face per width; re-run it if these words change.
- **The longer pull put 23px of the feed poster's foot outside the frame** — the
  QR and the address simply gone. The frame gives, the copy does not: 24px came
  out of three margins in `.feed`, and nothing came out of a line.
- **The column header and every cell were both saying "Everywhere else".** The
  header row says it on a desk, a `::before` label says it on a phone, and the
  cell said it a third time in bold. Dropped from the cells, and the operative
  phrase bolded on the right instead — the same cleanup the hiring board's cards
  needed the day before.

Measured after: no sideways scroll at 360/375/390/414/768/1024/1280/1366/1920,
every row revealed with motion on **and** with `prefers-reduced-motion: reduce`,
contrast composited through translucency (worst 5.09:1, the left column on its
own tint), and each pair still stacking as a pair on a phone with its label.

**The film does not say any of this yet.** `film-w.mp4` covers the machine but
not the cabinet, and its lines are voiced — adding it means re-voicing one or
two and re-rendering. Left until asked, and recorded here so the page and the
film are known to be one beat apart rather than silently disagreeing.

### Notes on the wording

- **Never "administrative assistant" in the headline.** The person we want has
  stopped reading those. The title appears on the page, in the first section,
  where it belongs.
- **The bar is "not a developer, but you have written something", and both halves
  have to be said every time.** The brief changed on 7 November 2026, in these
  words: *"The person must have a bit of coding experience, understand Google
  scripts, Google Workplace, being able to work with, you know, different AI
  tools… Also Salesforce or any other CRM, but they get the tools if they're
  creative."* The earlier rule here was the first half alone — "you do not need
  to arrive knowing how" — written to stop the ad filtering for developers, and
  the reason for it still holds: a developer is the wrong person for this seat
  and will not take it. But the seat does need somebody who has already written
  something, so the line moved rather than went. Leave off "not a developer"
  and the only people who apply are developers; leave off "you have written
  something" and the shortlist is administrators who have never opened a script
  editor, which is what the twelve-fault form cannot screen for.
- **Do not print a salary.** The form asks what they earn and what they want,
  and the figure is agreed on the call.
- **No seat count and no closing date.** This page sits at a public URL and an
  evergreen "5 places" dates it.
- **Compliance.** The page makes no representation about Guardian Life terms,
  grading or benefits beyond "a branch appointment; terms and pay are discussed
  on the call." That is the paragraph to show Guardian HR if the ad is going
  outside the branch.

## The questionnaire, and how to read what comes back

Two gates, and neither is a CV sift.

### Gate 1 — the page: five taps, then the application

**The five taps** are behavioural rather than aspirational, scored out of 20.
The score travels with the application and leads the row's summary, so a glance
tells you whether to read the rest now or later.

| What it tests | Why it is there |
|---|---|
| What you did about a repetitive job | Builders build. Documenters document. Grinders grind. All three show in the answers. |
| **Is something you built in use by somebody else right now** | The single best filter on the page. Ideas are common; shipping is not. |
| What happened when an idea was refused | A stuck innovator has a story. "Nobody has ever asked me for an idea" scores **2**, not 0 — that is the person we want. |
| A wrong figure on a letter going to 300 clients | The care test, and the only question with a genuinely wrong answer. |
| How far you have gone with code | The lowest answer still scores **1**. Never knowing code must not sink the right person. |

**Reading the score:** 16–20, read their written answers that day. 11–15, worth
a conversation. Under 11, honest no, and the page sends them to `/careers/`.
**Any score with the careless answer on question four** stops them and does not
invite them to apply, whatever else they said.

**The application itself is six sections and about fifteen minutes**, with a
progress rail that moves on input. The length is part of the filter — the page
says so out loud: *"If fifteen minutes is too long to spend on this, then it is
honestly not the job."*

1. **You** — name, phone, e-mail, the town they live in, and how they would get
   to Chaguanas. The commute kills more admin hires than anything else.
2. **Where you have worked** — years working, current or most recent employer,
   role, dates, the employer before that, and their highest qualification. Then
   the box that matters: **"What is different there because you worked there?"**
   with the instruction *"Not your duties — anybody can list duties."*
3. **Pay, honestly, both ways** — what they earn now and what they are looking
   for, as monthly TT$ bands, plus when they could start. **"Prefer not to say"
   and "Open — tell me what the job is worth" are real options on each**, so
   nobody is barred for declining.
4. **What you can already do** — twelve tick boxes from Sheets formulas and
   pivot tables through a CRM, Zapier, AI tools and "written code of any kind",
   ending with "None of these yet". The page says plainly that **ticking
   nothing does not rule you out** — it only says where to start them.
5. **In your own words** — the three that decide it (below).
6. **Last things** — an optional link, an optional GitHub name, the best time
   to call, and where they saw the ad.

**The income bands are my assumption and yours to change**, in one place in
`buildwithus/index.html` (search `payNow`): under $4,000 · $4,000–6,000 ·
$6,000–8,000 · $8,000–10,000 · $10,000–14,000 · over $14,000, monthly TT$.
They are set to straddle what a Trinidad administrator typically earns so the
answer is informative at both ends. Change both selects together.

**The three written answers** are the real filter:

1. *One thing you built that nobody asked you to.* Score it on **specificity**.
   "I improved efficiency" is nothing. "The same eleven fields went into three
   systems so I built a form that filled all three" is the hire.
2. *The slim-down.* They pick one of the two real undone jobs named on the page
   and say how they would halve it. We are reading **how they think about an
   unfamiliar system**, not for a right answer.
3. *What they want on their CV in two years.* Vague here means they want a job,
   not this seat.

### Gate 2 — one thing you would fix here (this is the interview)

If the form reads like them, ask for exactly one thing:

> Look through what we have built, find something clumsy, missing, or that
> would save somebody an hour, and tell me about it — what is wrong, why it
> matters, and roughly how you would fix it. You do not have to write the fix
> and you do not have to be right.

**They can send it any way they like** — an e-mail, a voice note, a page of
writing. If they happen to use GitHub they can post it there as an issue and
you will see it in one place, but the page says plainly that almost nobody does
and that it counts for nothing either way. That change was made on 6 November
2026: requiring a GitHub issue filtered for developers, who are the wrong
person for this seat.

**Why this is the right test.** It is the job, almost exactly: walk into an
unfamiliar system, find a real problem, and explain it clearly enough that
somebody else can act. It cannot be faked by a CV, it cannot be bought, and it
costs effort — which alone removes everybody applying to forty things this
week.

**Read each answer for, in this order:** is the problem real; is it explained
so a third person would understand it; is the fix proportionate (a small
finishable thing beats a grand rewrite); and did they notice something you had
not. The last is the strongest signal there is.

### Gate 3 — twenty minutes on the phone

Their issue and their written answers, terms and pay openly, and a straight
answer either way.

## The two jobs the page points at

He asked for a project to point candidates at. Both of these are genuinely
undone in the branch today, both are described in `CLAUDE.md` in the branch's
own words, and either would be a real first fortnight:

1. **The nineteen staff forms still on an outside form builder** — petty cash,
   the fuel log, licence renewals, the visitors book. Four of them are the
   administrator's own. There are five finished branch forms in the repository
   to copy the shape from.
2. **The view counter that has never recorded a view.** 157 beacons are in place
   across the site and `gs/views-counter.gs` was never deployed, so the branch
   publishes constantly and is guessing about what anybody reads. One
   afternoon's work with a permanent payoff — and it needs a browser, which is
   why nobody in a session has been able to do it.

Naming real undone work rather than inventing an exercise is deliberate: it is
honest about the state of the branch, and it tells the right candidate
immediately that there is room to do something that matters.


## The form would not send — 14 November 2026

Reported in these words: *"when persons applying for the admin it's sticking
and not allowing it to click submit ... it [goes] in red and not going
through."* He was describing it exactly, and it was three faults with one
cause.

**A form has three things that each decide whether an answer is good enough,
and they had drifted apart:** the **gate** that refuses the send, the
**progress rail** that tells the person how far along they are, and the
**scroll** that is supposed to take them to the field at fault — which works
by asking the RAIL which field is unfilled.

So on the administrator's page:

| | the gate wanted | the rail counted it at |
|---|---|---|
| `w_cv` — what you want on your CV | **10 characters** | **any single character** |
| `w_built`, `w_slim` | 40 | 40, agreed |
| `emp_changed` | 20 | 20, agreed |
| phone, e-mail | a valid format | any text at all |

**Type "IT skills" — nine characters — and this is what happens.** The rail
says **"18 of 18 answered · ready to send"**. The gate refuses. The red line
reads *"What do you want on your CV in two years?"*, which is the question
they have just answered, so it reads as the page being broken. And the scroll
asks the rail which field is empty, the rail says none, **so the page does not
move.** Press again and it does the same thing for ever. That is the
"sticking".

The phone and e-mail did it too: both are "filled", so a letter in the phone
box refused with no movement and the rail still said ready to send.

And a third, quieter one: **nothing on the page ever said a minimum
existed.** The counter under each box counts up to the *maximum* — `20/700` —
so "A petty cash tracker", a perfectly good answer, was turned away by *"a few
honest lines is plenty, but we do need them"*.

### What it is now

- **One table, `MIN`, at the top of the script**, with `FMT` beside it for the
  phone and e-mail patterns. The gate, the rail, the section ticks, the scroll
  and the counters all read it. It is at the top because the counter block runs
  before the form block, and a `var` read above its own line is `undefined`.
- **Every check carries the name of its own field**, in the order the questions
  are asked. The gate returns `[field, message]`, so whatever refuses the form
  is what gets focused — there is no "find something that looks empty" step left
  to get this wrong.
- **A too-short answer is told it is too short:** *"Just a little more on this
  one — about 40 characters, and you have 20."* Restating the question to
  somebody who has just answered it is what made a working refusal read as a
  broken page.
- **The counter says what is still needed while they type** — "about 40
  characters" when empty, "20 more" in red, and nothing once it is met. This is
  the fix that prevents the whole class: a minimum nobody is told about is a
  minimum that reads as the page refusing for no reason.

### The client manager had the same fault, one step milder

`/clientmanager/` kept **three** different numbers — the gate wanted 40 on four
written answers and 30 on two, the rail counted all six at 40, and `filled`
counted any single character. Its scroll had a fallback,
`querySelector('textarea')`, so instead of freezing it sent the person to the
**first** written question rather than the one at fault — which is its own kind
of wrong. Same `MIN`/`FMT` treatment. `uw_learned` also had a 30-character
minimum and **no counter at all**, so its minimum was invisible; it has one now.

**Every field in `MIN` must have a counter row.** The test checks it, because
that is the half that is easy to forget when a question is added.

### Two things worth keeping

- **`novalidate` is on both forms, deliberately.** The browser's own validation
  cannot be reasoned with and shows a bubble the page has no say over; worse, a
  `required` control inside a collapsed or hidden section makes Chrome refuse
  the submit with a console error and **no visible message at all** — the same
  "the button does nothing" symptom from a different cause. Keep `novalidate`,
  and keep the gate as the only authority.
- **The red line is `.err` / `#jErr` (`#uErr` on the client manager).** If a
  check is ever added, add it to `checks[]` with its field name. A check that
  returns only a sentence is a check that can refuse without moving.

`tests/e2e-recruit-forms.js` covers both pages (111 checks: every stuck case,
the field each one focuses, the rail never claiming "ready to send" about
something the gate will refuse, a complete application filing on each, every
minimum stated while typing, and no sideways scroll at six widths with the
counters showing). The POST is intercepted, so running it files nothing.

---

# 2 · The advisor — `/joinourbranch/`

Asked for as *"a creative ad that has never been done in Trinidad"*, for
somebody *"stuck in the environment"* or *"thinking about the career"*.

## What is different about this one

**It does not sell the career. It strikes out how the career is usually sold.**
The page opens on a ledger: on the left, in strike-through, how this normally
goes — *a list of your friends · buy your own leads · find your own clients ·
work out the cover yourself · nobody checks it before the client sees it · a
number on a board at month end*. On the right, what this branch does instead.
That is the whole hook, and it works because every one of the struck-through
lines is what the reader is living.

**Then it builds the pitch in front of them, from their own answer.** He asked
for exactly this: *"Before they click apply there, can you do something so they
can more or less, it builds in before they get to the apply there."* Three
questions — what is in your way, where you are now, what you would want first —
and each answer assembles one proof card into a panel that is theirs, before
the TalentNest link appears at the bottom of it. Nobody reaches the apply button
without having read the three things that answer their own objection.

**It promises no earnings.** Not a figure, not a range, not "top producers
earn". The branch's own record (persistency, retention, what is given) is the
proof, and that is all that goes on a public page. This is the rule for every
recruiting page in this repository and there is no exception for a good month.

**It applies through TalentNest**, Guardian's own system — this branch's form
never touches an advisor application. The page says who reads it: the Branch
Manager and the Unit Manager.

## The ad

### 1 · Facebook and Instagram (the main cut — feed, sound off)

> **Most people start this career with a list of their friends. Not here.**
>
> Your leads come from a board — people who asked to hear from somebody.
>
> Your clients are matched to you household by household, with the whole file already read.
>
> The fact find does the arithmetic. Your client confirms the plan, and a manager signs it off before anything is placed.
>
> Your numbers are on the wall every day. Not at month end. Not as a surprise.
>
> A coach, not a clock.
>
> See the whole thing before you apply → rickyrampersadbranch.com/joinourbranch

### 2 · For somebody already contracted elsewhere (message, one to one)

> You are good at this. The question is what you are being given to work with.
>
> Leads from a board, not from your own phone contacts. Clients matched to you household by household with the file already read. A fact find that does the arithmetic, a client who confirms it, and a manager who signs it before anything is placed. Your numbers on the wall daily.
>
> Have a look before you decide anything: rickyrampersadbranch.com/joinourbranch
>
> Nobody where you are will hear of it.

### 3 · WhatsApp (the branch group, for referrals)

> *We are opening the door to advisors who are stuck.*
>
> Not stuck because they are bad at it — stuck because nowhere they have worked gave them leads, matched clients, a fact find that does the arithmetic, or a plan the client confirms and a manager signs before anything is placed.
>
> The page shows them exactly what they would be given, then builds the answer to their own objection in front of them before they apply.
>
> rickyrampersadbranch.com/joinourbranch
>
> Reply with one name of somebody who should see this.

### 4 · TikTok and Reels (the upright film, with a caption)

> They told you to start with your friends.
>
> Here is what you actually get instead.
>
> Full thing: rickyrampersadbranch.com/joinourbranch

### Notes on the wording

- **The fact find order is: you → the draft → your client confirms → a manager
  reads and signs → placed.** The first cut of the page and the film both said
  "a manager signs it off before it reaches your client", which is the order the
  branch spent a year putting right and corrected on 29 October 2026. It is an
  easy one to write backwards because it sounds more rigorous that way. It is
  not: the client confirming first is the whole point, and an ad that teaches it
  backwards teaches a new advisor the wrong process on their first day. **Third
  time this has been written the old way** — check it against `CLAUDE.md` before
  re-wording that line in anything.
- **Never a figure.** No income, no range, no "earn up to". The branch's record
  is the proof; a number is a promise nobody can keep for a stranger.
- **Never characterise anyone who left**, here least of all. The ad is about
  what this branch gives, never about what another one does not.
- **"Contracted somewhere today? Nobody there will hear of this"** stays in
  every cut. It is the single line that makes a practising advisor read on.
- **Do not promise a start date or a seat count.** The advisor door has a
  selection process behind it; the film and the page both end at "see the whole
  thing", not at "you're in".

---

# 3 · The client manager — `/clientmanager/`

**Renamed and reframed on 7 November 2026**, after the branch manager read the
underwriter page back: *"it's not really an underwriter. It's somebody who has
experience with general insurance… We already have our book… with having
underwriting experience is important, but carefully the act changes and
advising our clients properly, looking at the extension… they're fed up of
implementing something, and here we're open to ideas and changes. We already
have a book, and we're looking for someone to manage more or less that book."*

**An agency does not underwrite — the insurer does.** That is the whole reason
the first version was wrong, and it was not a title problem. The page sold
authority over risk acceptance that the seat will never have, which an
experienced underwriter catches in the first line and then discounts
everything after. It said "underwriter" thirty-two times.

What the seat actually controls is everything on the client's side of that
line: what we put up and how it is presented, the endorsement mid-term, the
renewal conversation, the advice on what the cover does and does not do, and
the Act. That is a **better** pitch to the person he described, because that
person has probably never been given control of any of it.

**`/underwriter/` and `/underwritervideo/` are redirect stubs** and stay that
way: the old address was in the setup doc and may have been shared. The form
key stays `underwriter` and the reference stays `QU-`, so `Quotes.gs` needs no
paste and no new deployment; `QC-` was not available anyway, since the critical
illness quote owns it.

## The soundtrack, and the cinematic pass

### What the music actually is, per film

*"What about the soundtrack?"* — 8 November 2026. The answer differs by film,
and only one of the three is clear:

| film | bed | licence |
|---|---|---|
| **`cmadmin`** (client manager) | **`rr-branch-theme.mp3`** | the branch's own, written for the branch. Nothing to clear. |
| `bwadmin` (administrator) | the clip sent on 6 November 2026 | **unnamed**, and still the one thing standing between that film and being posted |
| `jbadvisor` (advisor) | the same | **unnamed** |

So the client manager film can go out today. The other two are one command
each: rebuild the bed from the branch theme and re-mix — **no re-render**,
because only the audio changes.

### The score moves with the film now

A bed held at one level for two minutes is wallpaper, and that is what it was.
**`score` in `films.json` is one gain per scene**, and `usetrack.py` applies it
as a ramped envelope — never stepped, because a step in a music bed reads as a
mistake in the edit. The ramp is 1.6 s **centred on the cut**, so the lift has
already begun as the picture changes.

The shape for `cmadmin`, which is the shape of the argument: `0.55, 0.50`
quiet under the problem; `0.86, 0.96` the turn as the book arrives; `0.80,
0.80` the working middle; `1.00, 1.08, 1.00` the heart and the build; **`0.62`
a deliberate drop** under the one-line statement, so that `1.18` at the close
lands as a swell rather than more of the same.

### Two risers, and the filter they needed

`risers` in `films.json` is a list of seconds a riser **lands on**: noise
climbing through the spectrum against a tone bending up, cut dead on the
frame so the picture change is the release. One into the build, one into the
close.

It needed a filter `sfx.py` did not have. **`lp()` and `hp()` take a scalar
cutoff**; handing either an array makes the coefficient an array and the
filter's state a vector, and it dies deep inside the sample loop with
*"setting an array element with a sequence"*. `lpv()` and `hpv()` take one
cutoff per sample, which is what a sweep is.

### The cinematic layer, and why it touches nothing

Opt-in per film (`"cinematic": true` at the top of the lines file), because
turning it on changes every frame and each film must be re-rendered to pick it
up. `cmadmin` has it; the other two can take it whenever they are next cut.

Everything in it is an **overlay or a background** — nothing moves, scales or
clips the content, because `bwfit.js` has already measured that content to sit
inside the 1280×616 the mixer keeps:

- **a slow push on the background only** (`bfPush`, 1.015→1.075 over the
  scene's own `--D`), so the frame breathes and the words stay exactly where
  they were measured. Pushing `.inner` instead would have moved measured
  content toward the crop;
- **a vignette**, which is the thing that makes a flat screen read as a lens;
- **grain** — one 96px noise tile written by the builder itself, stepped eight
  ways at 0.9 s, 3.5% on `overlay`. It is the cheapest effect here and the one
  the eye reads as *shot*;
- **a fade up from black** on the first scene only.

**No letterbox bars**, deliberately: the mixer already crops to 1280×616 and
pads back with the caption strip, so bars inside that band would either double
the letterbox or eat a scene's own top and bottom.

**The class guard earned its keep again** — `.grain` and `.vig` are both
styled by the film shell, so they are `.bfgrain` and `.bfvig`. That is the
sixth time it has caught one.

**And a copy bug the new length exposed:** the cover's "Watch — …" line banded
at 120 s and 160 s, so a 2:03 film announced itself as *two and a half
minutes*. There is a `just over two minutes` band now.

## Two doors, three charts, the town, and a section cut

Asked for on 8 November 2026: *"a little more motions with percentages and a
little more graphics and a little more charts and a little more tightening up,
condense a little more shorter. Don't say Chaguanas... it will prompt someone
with the experience to apply, as well as somebody without the experience, but
they do possess the skill set that they can learn fast because it's a
tech-driven environment."*

### Two doors, and why they have to be separate

He wants the career-changer as well as the experienced hand. **An ad that says
"experience required" and then "apply anyway" collapses its own filter**: it
buys a flood with no way to sort it. So `#you` is now two labelled doors —
*1 · You have done this* (years on a book, time actually underwriting, papers,
judgement) and *2 · You have the head for it* (something you taught yourself
and then used, systems instinct, people under pressure, and you will sit the
exams, which we pay for). Door 2 says plainly that the first year is harder and
that the tools carry a great deal of what experience used to carry — **not all
of it**.

The filter follows the door all the way to his inbox:

- the form asks **`uw_door`** first, before anything else in section 2;
- **`bar()` scores each door on its own terms.** Door 2 is not marked down for
  the experience the door exists to let past; it is scored on systems named,
  depth in the written answers, whether they read the file and how closely,
  papers or papers in progress, and any insurance exposure at all. It reads
  *"Door 2 · 4 of 5 · read the file lightly"*;
- `scan_bar` is still the first line of the e-mail and still **never shown to
  the candidate**, so the door never reads as a rejection on the page.

### Three charts, and one that is deliberately not a chart

- **86% ring** on `#tech`: six of the seven stops take themselves. It is the
  measured version of the "ninety per cent re-keying" claim, and it draws
  itself on `animation-timeline: view()`.
- **72% bar** under the Log Book figure in `#service`.
- **The twelve months, lit and not measured.** The record does carry the
  month-by-month shape of the book — and it is not going on a public page,
  because it tells a competitor exactly when to go at us. Every month is lit
  at the same height; the caption carries the true and safe claim, that
  renewals fall in all twelve and there is no quiet season.

### The town

*"Don't say Chaguanas."* It had been in the badge, the hero's practical line,
both meta descriptions and the footer. It now appears **once**, in the apply
section, where somebody actually deciding will look for it — because **a
recruiting ad that never says where the office is loses people who cannot
judge the drive**. Everywhere it used to lead, it reads *Central Trinidad*, and
the posters' mastheads changed with it (`where` in `tools/ads/build-ad.py`).

### What was cut

**`#different` is gone**, six cards and 3,502 bytes of it. `#tech`'s seven
stops tell the same story better and in order; the two facts it carried that
the pipeline does not — Guardian's actual PDFs rather than retyped versions,
and the record cleaned before you quote it — folded into the pipeline's own
small print.

### A third instance of one bug

`.ring86 figcaption span{display:block}` caught the counter's own span inside
`.r-pct` and put *86* and *%* on two lines. That is the same fault as the
`<em>` that became a third flex column in `#fit`: **a descendant selector on a
generic tag inside a component catches the inline elements the copy uses**.
Scope to the direct child (`figcaption > span`), or wrap the text.

## The book drawn, the renewal drawn, and the service with figures under it

Asked for on 8 November 2026: *"a lot of graphics, building in the book in
terms of commercial and personal, and with the focus of customer service and
technology... we adopt all technologies. We are technology driven and looking
to continue enhancing this book."*

Three sections, and each one shows something instead of asserting it.

**`#lines` — the book, drawn.** The flat ten-item list is now the two sides it
is actually written on, with a spine between them that draws itself on scroll:
*personal* (private motor, household and private dwelling) and *commercial*
(fleet, commercial property and fire, public and products liability, workers'
compensation, machinery and plant, bonds), then endorsements and extensions
across both and marine and cargo as the room to grow.

**No proportion is printed, and that is a decision rather than an omission.**
`Cover_Type__c` is empty on every term, and the record types mix private and
commercial inside both Motor and Property, so a personal/commercial split would
be a guess on the one page where a guess is least affordable. What the record
does carry, for choosing words only: 688 terms in force, Motor 525, Property
140, Workers Compensation 15, Public Liability 6, Bond 1, Machinery 1, and no
marine — which is why the page says marine sits in the system with nothing
written on it.

**`#tech` — one renewal, end to end, seven stops.** The notice found and read,
every figure checked against our record, the whole history opened, **the call**,
the forms filled, the client signing in, the file writing itself. Six are
automatic and the fourth is marked *This one is yours*. It is technology shown
rather than claimed, it is all running today, and the closing line is the
offer: *the next stop on that line is the one you tell us about*.

**`#service` — the service machinery, with measured figures.** 3,634 documents
through the Log Book in twelve months and 72% on to Guardian inside one working
day (both measured off the old book, Nov 2025 to Oct 2026); every delivery
signed for by name and relationship and then rated; a 24-hour route for a
client question tracked against a turnaround; the 45/60/75/90-day letters
before a lapse; and one screen the whole branch can see. The copy says plainly
that this is the **branch's** machinery and the general insurance book sits
inside it — it is not claimed as the agency's own.

**What is NOT claimed here, deliberately:** that clients rate us. The client
rating e-mail in `Claims.gs` is built and **held** pending the branch manager's
approval of its wording, so the page says deliveries are rated and stops there.

### A capture artifact that reads exactly like missing content

An element screenshot of a section taller than the viewport shows the lower
part **blank**, because anything driven by `animation-timeline: view()` with a
backwards fill is still at opacity 0 at that scroll position. Two stops of the
pipeline and the whole foot of the book section "vanished" this way, and both
were fine: measured in the browser, every one reaches opacity 1 when scrolled
to, and with motion off or without `view()` support none of them animates at
all. **Shoot at viewport size, scrolled to the part you want** (`cmlook/vp.js`
in the session scratchpad) rather than taking an element screenshot of a tall
section, or you will chase content that is not missing.

## The frame: an established book that has outgrown one man — not a new agency

Corrected on 8 November 2026, and this is the one to read before touching any
word of this ad. The page had said *"The branch has opened its own general
insurance agency, and it is not a start-up."* He struck it out:

> *"Don't focus on opening an agency... I'm in the business for 35 years and
> I've built a substantial general insurance book. My time is needed
> elsewhere, but focusing on the reliable person of advising what we have
> built, the tools that we use, with the goal of attracting the right
> candidates for us to continue. So it's not that we're now doing this. We've
> always had very great successes."*

He is right, and the fault was worse than tone. **"We have opened our own
agency" tells a candidate who already has a job that he would be the
experiment**, and *"it is not a start-up"* is the giveaway — a sentence written
only because the doubt is already there, which plants it. The strongest thing
this ad has is the opposite of novelty: the book exists, it has renewed year
after year, the clients and the income are already in it. That removes the risk
of moving, which is the single biggest reason a stuck person stays stuck.

**The reason the seat exists is now the ad's best paragraph.** It is in his own
words, signed, in the `#why` section straight under the hero: he built the book
himself, it has done well, he is running a branch and his time is needed across
all of it, and the book deserves somebody whose whole attention it is. **It
must never read as a book being handed over neglected** — it is a book being
promoted. That distinction is the whole difference between an attractive seat
and a suspicious one, and every rewrite has to keep it.

**What the record supports, and what it does not.** `Risk_Details__c` holds
general insurance terms from October 2013, but only a handful before 2018; it
is substantial from 2020 and runs to 2,661 terms. So the *record* is about six
years deep, which is not the same as the book's age, and **no figure is printed
for how old the book is**. The ad says *"written and renewed here year after
year"*, which the record does support, and the thirty-five years are stated as
**his own years in the business, in the first person**. Salesforce has his hire
date as December 1993 — thirty-two years with Guardian — and the two are not
the same claim; that was put to him.

Phrases that are now wrong everywhere and must not come back: *opened its own
general insurance agency*, *it is not a start-up*, *we are building the team*,
*this agency is being built now*, *there is no queue yet*.

## The mindset filter, and why it cannot be adjectives

Asked for in the same message:

> *"I don't want the 8 to 4 person. I want persons who are creative, who will
> look at the processes, and that's the challenge I'm having — the mindset of
> the persons coming into work today... they have the general insurance
> experience, but they're stuck, they're not going anywhere, and they want to
> learn and excel."*

**You cannot filter mindset with adjectives.** Every applicant writes that they
are a self-starter who thrives on change; the word costs nothing to type, so it
sorts nobody. Two things do work, and both are now on the page:

- **Naming the wrong person plainly.** `#fit` is two lists — *probably not you*
  and *probably you* — in the candidate's own sentences, not ours: *you would
  rather be told the rule than be the one who decides it*; *you have been
  saying this would work better if… for years, to people who wrote it down and
  did nothing*. Naming the wrong person is the one thing that makes them leave,
  and it is what makes the right person feel recognised. Its headline states
  the rule outright: **this is not an eight-to-four job, and that is not about
  hours** — the hours are genuinely his to set; what is not optional is that
  the process is never finished being improved.
- **The work itself.** The real filter was already built: fifteen minutes, a
  real renewal file to read, four written answers, and the bar line that says
  who actually opened the file. `uw_renewals` (*what would you change about how
  a general agency handles renewals*) and `uw_stopped` (*something you tried to
  change and could not — what stopped it?*) are the two that separate this
  person, and they were already there. **No new question was added**: the form
  is already at fifteen minutes and lengthening it costs more applications than
  the extra question would sort.

## The book: how to count it, and what may be published

Asked on 7 November whether the ad could name the book's size, he chose *"name
its size and classes"*; shown the counted figures the same evening he changed
his mind: **"don't mention the amount of clients. Give an assumption in terms
of all the lines we write and our specialties."**

**So no client count and no policy count appears anywhere** — not on the page,
not in the film, not in the ads, and **not in this file**, which sits at the
repository root and is therefore served on the open web. The house rule in
`CLAUDE.md` already says per-book client counts are not published; this is that
rule, applied to a recruiting page.

What the ad says instead: **seven lines in force and three more written here,
personal and commercial, renewals falling in every month of the year**, the
lines named, fleet called out as a capability rather than a number, and the
classes with nothing current on them named as room. Plus the specialty he asked
to lead on — endorsements and extensions, written to the Act.

**To re-derive the figures when somebody needs them internally** (an interview,
a conversation with the insurer), this is the count, and it takes one query:

```sql
SELECT COUNT_DISTINCT(Client_Portfolio_Look_Up__r.Contact__c),
       COUNT_DISTINCT(Policy__c), COUNT(Id)
FROM Risk_Details__c
WHERE RecordType.Name IN ('Motor','Property','Public Liability',
      'Workers Compensation','Machinery','Bond','MARINE')
  AND To__c >= TODAY
  AND (Vehicle_Status__c = null OR Vehicle_Status__c != 'Sold')
```

Three things learned counting it, which the next person will hit too:

- **Quote the policy count, not the term count.** One motor policy carries many
  `Risk_Details__c` rows, one per vehicle, so terms run far ahead of policies.
  Part of the gap is also the duplicate-term problem `girDedupe_` exists to
  clean, so the term count overstates twice over.
- **`Vehicle_Status__c = 'Sold'` has to be excluded** or the book looks bigger
  than it is.
- **Marine reads as a live class and is not one.** It is in `GIR_LINES` with
  nothing in force, so an ad listing "eight classes" off the config would be
  claiming a class we do not write. Count, do not read the config.

## What the page says now

- **The hero** leads on the book: *"The book is already there. What it has
  never had is you."*
- **`#lines`** is the book by its real numbers, with one paragraph making the
  relationship exact: this is the **branch's own** general insurance agency,
  the insurer carries the risk and holds the underwriting authority, and the
  branch's group health and group life book sits beside this one with its own
  team and is **not** part of this seat.
- **`#work` is new** and is the thing he asked for: endorsements and
  extensions, the renewal conversation, telling clients plainly what the cover
  does and does not do, **the Act and what changes in it**, the claim from the
  client's side, and a record the next person can read. The Act card carries
  the one line that matters most here — nobody may cause a policyholder to
  discontinue or replace a policy without first discussing the advantages
  **and** the disadvantages — with no section number, by the house rule.
- **`#build`** became *"You will not be raising a ticket. You will be making
  the change,"* aimed squarely at *"fed up of implementing something"*: a
  change asked for here is written into the desk and runs that week.
- **`#you`** now requires **both** general insurance experience and
  underwriting experience, at his explicit choice, with the papers asked as a
  status and *which one and what is left*. That is a narrow field in a market
  this size and he was told so; one line changes it back.
- **`#file` is unchanged**, because a renewal file and *what would you act on
  before you quote it* is exactly a client manager's judgement. The nine
  findings are still ones `girInsights_` genuinely computes.

## The filter: what he actually receives

Asked on 7 November: *"have you filtered in the questions correctly so I will
get who applies?"* Half the answer was no, and the half that was wrong is worth
recording: **the written questions were still the underwriter's** after the
seat had been reframed. They tested whether somebody could rate a risk, and
nothing tested the job he had just described.

Section 4 is now **four written questions plus a tick row**, and each one is
there because it separates people:

1. **A risk you turned away, or advised a client against, that you could have
   placed.** Unchanged in substance: the one question nobody can prepare.
2. **An endorsement or extension that went wrong where you worked — late,
   missed, or written loosely.** The technical heart of the seat. Anybody who
   has really carried a book has one of these, and the answer shows at once
   whether they think in cover or in paperwork.
3. **A time the right thing and the easy thing were different.** This is the
   compliance question, and it is deliberately **not** "what does the Act say":
   that tests memory, which anybody can look up, and a good candidate resents
   it. A scenario shows the instinct.
4. **Something you tried to change where you worked and could not. What
   stopped it?** The literal test of *"fed up of implementing something"*. It
   also tells him whether they push or give up, which matters more here than
   anywhere, since the whole offer is that a change gets built.
5. **What would you change about how a general agency handles renewals** —
   kept.

Plus a tick row, *which of these have you actually had to handle*: a
replacement or cancellation, non-disclosure at claim, a formal complaint,
underinsurance or average, a regulator or compliance query, client data or
privacy, none yet. Cheap to answer, very revealing, and it cross-checks
question 3.

### The scan line, so a row can be triaged from the e-mail

The e-mail printed the answers section by section and left him to read the
whole thing. The page now sends an **At a glance** section first — Quotes.gs
prints sections in the order it is given them, so this needed no backend
change — computed from what the candidate actually did:

| | |
|---|---|
| **Fit** | years · qualification status · how many classes · *and whether motor and property are both among them*, since that is where this book lives |
| **The file** | how many findings they ticked, the first two in their order, and their premium decision |
| **Compliance** | how many of the six situations they have handled |
| **Depth** | how many of the five written answers are substantial rather than short |

That is enough to sort an application without opening the row, and every part
of it is the candidate's own work rather than a score we invented.

### Volume over scarcity, and the bar that takes its place

Asked on 8 November 2026: *"we are opening our insurance agency in Chaguanas
and looking for staff — the target is really persons who are in these agencies
and want to move, as they are stuck."* Offered the choice between keeping *one
vacancy* (scarcity, fewer but more serious applications) and dropping it
(volume), he chose volume, in these words: **"leave a number out as you want as
much application, and you need to ensure you have a proper filtering system as
well the questions section."**

So the seat count is gone from this ad everywhere — the page title, the
`og:description`, the badge, the hero, the homepage card, the film's own page
metas and all three posters — and the filter had to carry the weight the
scarcity was carrying. Two things were added for it:

- **A direct question that was never asked.** Underwriting experience is
  *required* and nothing on the form asked for it: `uw_uwexp` (with an insurer
  / under delegated authority at an agency / some, informally / no) and
  `uw_uwwhere`. Answering **no** shows a note saying so plainly rather than
  blocking the application — somebody strong without it is still worth a call,
  and he should make that call himself.
- **A bar line at the top of the e-mail.** `scan_bar` is the first field he
  sees: *Meets the bar · 5 of 5*, or *Check · 3 of 5 · no underwriting
  experience, did not read the file*. The five are: three years or more, a
  qualification or studying, three classes or more, underwriting experience,
  and having opened the file on the page. **It is never shown to the
  candidate** — it is a sorting aid for one reader, and a page that tells
  somebody they failed a bar they did not know existed is a page that gets
  screenshotted.

`scan_bar` is also the first value in `QUOTE.SUMMARY['underwriter']`, and the
team e-mail's subject now appends that summary, so a phone's notification reads
*New Client Manager request · QU-… · <name> · Meets the bar · 5 of 5* without
the e-mail being opened.

**Volume cuts both ways, and the bar is what pays for it.** Dropping the count
will bring applications from people the seat is not for; the bar is the thing
that stops those costing him an evening each.

### What does need a Quotes.gs paste

The backend uses its own `line` and `title`, not the ones the page posts, so
until it is pasted and a **New version** published:

- the team e-mail is headed *"New Underwriter request"*;
- **the candidate's own confirmation is headed "Underwriter, general
  insurance"**, which is the one a stranger sees;
- the highlighted summary band reads years · classes · authority rather than
  the bar line · years · qualification, and the subject carries no summary at
  all.

The form key stays `underwriter` and the reference stays `QU-` on purpose:
renaming the key would strand the rows already on the tab for nothing.

## Why somebody would actually move

The same message asked to *"introduce virtual etc, things that will make a
person move — focus on the technology and show how this improves."* The
technology was already most of the page, so what was missing was the part that
is not technology at all.

**Virtual needed splitting in two, and only one half is true.** Virtual *for
the client* is live today — the quote, the forms, the renewal desk, the
signature — and the page already said so. Virtual *for the staff* is not: the
branch runs fixed hours per desk with an attendance register, marks a desk
absent five minutes after its start and moves its work to a colleague at thirty
(`SCHEDULE` and the cover rules in `KPI.gs`). Promising remote work to this
seat would have been a promise the branch's own systems contradict on day one.

Offered the four honest versions, he chose **fully flexible hours**: the seat
sets its own, judged on the book rather than on the clock. That is now the
badge on every poster (*We are hiring · hours that suit you · Chaguanas*), a
line in the hero, and the first of the four cards in **`#move`** — the section
written against the four sentences this person actually says about where they
work now:

| they say | the page answers |
|---|---|
| *I am measured by the clock* | judged on the book, hours yours to set |
| *Nothing I suggest ever happens* | a change you ask for gets built that week |
| *There is nowhere above me* | the person who runs this book from the start runs what it becomes |
| *The systems fight me* | the paperwork side is already built, and you can see it before you apply |

Two more decisions in the same breath, both in the page and in all three ad
cuts:

- **Pay is negotiable on experience.** Said rather than hinted; no figure, no
  band, since the branch has not set one.
- **"One thing we are not asking you for: your clients."** This matters more
  than it looks. Everybody recruiting from an agency in this market is
  assumed to be shopping for a book, and saying plainly that we are not
  removes the one reason a good person would not reply. It is also the truth:
  the book is already here.

**The attendance register is the open question, and it is his.** A seat on
fully flexible hours does not fit the register, the absent-at-start-plus-five
rule or the automatic cover pass as they stand. Either this seat is marked
exempt in `SCHEDULE`, or the promise quietly stops being true the first week.
Nothing has been changed in `KPI.gs` for it.

## The film — `cmadmin`, 2:03, cut 7 November 2026 and re-framed on the 8th

Eleven scenes on the same engine, replacing `uwadmin` at the same path. Three
things the reframe forced, all of them real faults in the cut before it:

- **Scene 3's eyebrow read "Guardian Life of the Caribbean"** over a voice
  saying *"we are opening a general insurance agency"* — which reads as
  Guardian Life opening one, the exact thing he says it is not. It is **"The
  Ricky Rampersad Branch"** now, and the insurer appears only where it belongs,
  as the carrier whose notice the renewal desk reads.
- **"Build the book"** was the closing line. We have a book. It is *"Look after
  the book."*
- **Scene 4 is what we write** (`bwstack`: the seven classes as chips, and
  **7 lines** and **12 months with renewals in them** as the counters). It began
  as the book by its client count and was changed the same evening — see the
  book section above for why no count is published anywhere.

**Two lines came back slurred in ways that changed the meaning** and were
re-worded off the shape rather than around it, which is the rule this voice
keeps teaching: *"a ticket in a queue at head office"* was heard as **"a queue
ahead office"**, and *"an endorsement nobody has to retype"* as **"nobody has
to retive"**, with *"a sum insured"* as *"some insured"*. They are now *"a
ticket that joins a queue somewhere else"* and *"an endorsement nobody types in
twice… when the sum insured has not moved."*

**`"ticks": false`** is on the rule scene for the reason recorded in
`tools/film/CANVA-AND-THE-EIGHT-CUTS.md`: a green tick beside *"wait for the
release"* reads as the wait being fine.

**`importvox.py` leaves the timing file in a shape the builder cannot read.**
It writes `lines[i].words` in **seconds**; `build-boardfilm.py` reads a
top-level `words` in **milliseconds**. So after every re-voice the file needs
one conversion pass before the build, and until that pass runs the committed
timing file does not build — which is how `cmadmin-timing.json` sat in the
repository for a day in the wrong shape. Convert it, and write the file back
**compact**, the way it was: re-indenting turns a one-line change into a
1,200-line diff nobody will read.

A cue word in the lines file has to appear **in the spoken line, inflected the
same way**: `at2: "retypes"` against a line that says *retyping* stops the
build with `no word 'retypes'`. That guard is worth keeping — it is the only
thing that catches a reveal landing on a word that is never said.

**Two lines were re-voiced for the 8 November reframe.** Scene 3 was the only
one in the film that carried the wrong claim — *"The branch has opened its own
general insurance agency. And it already has a book."* It now reads *"The book
is not a new one. We have written it for years, and renewed it year after year.
The Branch Manager built it himself, and his time is needed across the
branch."* And the close picked up the mindset filter: *"...If you are good at
this, and you have stopped learning, come and look after the book."* Scene 3
went 6.0s → 11.6s and scene 11 8.4s → 11.2s, so the film is **2:03**.

**Every `hits` value moves when any scene's length changes**, because they are
seconds into the film while `dark` is scene indices. Derive them from the built
page rather than guessing: each counter carries `data-at` in milliseconds from
the start of its scene, and the scene starts come from `durs`. Here both are in
scene 4, so [28.65, 33.61] became **[34.15, 39.11]**.

**The close said "One seat." and does not any more.** When the ad dropped its
seat count on 8 November, the film still ended on *"One seat, for a client
manager"*, on screen and in the voice — a promise kept in one place and broken
in the other, which is the rule this repository keeps relearning. One line
re-voiced (`cmclose`), one scene's eyebrow and reveals changed, and the whole
film re-rendered: it now closes on *"Client manager, general insurance.
Chaguanas. Come and look after the book."* Scene 11 went from 8.1 s to 8.4 s,
so the film is 115.0 s; nothing before it moved, so `hits` and `dark` in
`films.json` are unchanged. Whisper hears *Chaguanas* as "Chagwanis" on every
take — a transcription artifact, not a read fault, and the word is on screen
in the same scene.

## The ad



### 4 · Facebook — the branch page

Asked for on 8 November 2026: *"very compact and relevant as this is a
Facebook ad on our page."* Half the length of the LinkedIn cut, because
Facebook folds a caption behind **See more** after about two lines on a
phone: the hiring line and the hook both have to land before that fold, and
everything after it is for somebody who has already decided to keep reading.

> WE ARE HIRING — Client Manager, General Insurance. Central Trinidad.
>
> A general insurance book across ten lines, written and renewed here year after year. It has never had one person whose whole job it is.
>
> An established book: seven lines in force, three more written here, personal and commercial, with renewals in every month. No system on a PC, no spreadsheet beside it: the branch writes its own software, it reaches into every system we deal with, and it changes every week. Every term since the policy began is on one screen before you open the file.
>
> So the day goes to the advice, the endorsements and the renewal conversation. Here a client is not a transaction. They are a journey.
>
> General insurance and underwriting experience both required. Hours are yours to set. Pay negotiable on experience. We are not asking you to bring clients.
>
> Your CV and fifteen minutes: rickyrampersadbranch.com/clientmanager
>
> Read by the Branch Manager personally, and treated confidentially.

**Post the video, never a link to it.** `clientmanager/film-w.mp4` uploaded
to the page autoplays in the feed; a link to the film's own page does not.
`ad-feed.jpg` is the alternative if a picture is wanted instead.

**Boosting it is a different set of fields**, each with its own truncation:

| field | text |
|---|---|
| Primary text | A general insurance book across ten lines, written and renewed here year after year. It has never had one person whose whole job it is. |
| Headline | Client Manager — General Insurance |
| Description | Your CV and fifteen minutes. |
| Website | https://rickyrampersadbranch.com/clientmanager |
| Button | Apply now |

**A job ad has to be declared a Special Ad Category — Employment — in Ads
Manager**, and an undeclared one is rejected or pulled. Declaring it takes
most of the targeting away: no age or gender, a far shorter interest list,
and a wider minimum radius. That is the trade and it is not optional.
Confirm the current rules in Ads Manager before spending: Meta moves them,
and most of what is written about them elsewhere is out of date.

**Instagram** takes the same words, but a link in a caption is not tappable
there — say *scan the code on the picture, or the link is in our bio*, which
is what the QR on the poster is for.

## Who the ad is for: the filing cabinet, 8 November 2026

Asked for in these words: *"the traditional agency where a person cannot excel
has the old way where filing cabinets, files, paper... you specifically want to
target where the work has become overwhelming for persons with filing cabinets,
manual, paper, and still depend on the emails. Where our process is that looking
at the data and pulling and scrubbing the insights and allowing our proven
systems to make and do the research for you."*

The page already showed the machine, stop by stop, in `#tech`. What it had never
done is **name the day the right person is living**. Nobody leaves a job because
of a feature list; they leave because somebody described their own Tuesday back
to them. So:

- **A ledger section, `#old`**, between the book and the seven stops: six rows,
  *Everywhere else* against *Here*. (**Superseded 9 November 2026** — the
  headers are *Your week now* / *Your week here*; see “Describe the work,
  never the workplace” below. Do not restore the old pair.) The drawer and
  last year's file in a
  different drawer; re-keying the client into the insurer's proposal form; the
  insight being whatever you happened to notice; chasing the client or losing
  the renewal; what the client holds living in your head or an e-mail thread;
  the data in four places that disagree. Each answered by the thing the branch
  actually runs.
- **The attraction line names it first and the autonomy second.** It was *"and
  have never once been allowed to change how it is run"* alone; it now opens on
  the cabinet and the inbox. Same line on the page and on all three posters,
  which is the rule.
- **The hero says there is no filing cabinet in this seat**, and that the record
  is pulled from every source and scrubbed before you read it.

**Honest about paper, which is what makes it believable.** Contracts and cheques
still arrive from the insurer and clients still sign things. The claim is not
that paper is gone — it is that **no record here can only be found on paper**:
every document that arrives is logged, routed, signed for by name and tracked
until it is answered. Claiming a paperless office to somebody who has worked in
insurance for fifteen years loses them at the first sentence.

### Three things it cost

- **The longer pull reopened the layout-shift bug, in a second element.** Three
  lines in Inter Tight and four in the metric-matched fallback at every width
  from 768 up, so the hero column reflowed by a line when the font landed and
  the buttons under it moved: **CLS 0.0127 → 0.0985 at 1366**. It is the h1's own
  0.577 bug one element down, and the lesson there holds — no `size-adjust`
  closes a gap that narrow. `.pull` now reserves `calc(4 * 1.32em)`, so the box
  is four lines tall whichever face draws it; on a phone the line genuinely is
  five and the `min-height` does nothing. **0.0985 → 0.0133.** The scan that
  finds this (`scan.js` in the session scratchpad) prints the line count per
  face per width; re-run it if these words change.
- **The longer pull put 23px of the feed poster's foot outside the frame** — the
  QR and the address simply gone. The frame gives, the copy does not: 24px came
  out of three margins in `.feed`, and nothing came out of a line.
- **The column header and every cell were both saying "Everywhere else".** The
  header row says it on a desk, a `::before` label says it on a phone, and the
  cell said it a third time in bold. Dropped from the cells, and the operative
  phrase bolded on the right instead — the same cleanup the hiring board's cards
  needed the day before.

Measured after: no sideways scroll at 360/375/390/414/768/1024/1280/1366/1920,
every row revealed with motion on **and** with `prefers-reduced-motion: reduce`,
contrast composited through translucency (worst 5.09:1, the left column on its
own tint), and each pair still stacking as a pair on a phone with its label.

**The film does not say any of this yet.** `film-w.mp4` covers the machine but
not the cabinet, and its lines are voiced — adding it means re-voicing one or
two and re-rendering. Left until asked, and recorded here so the page and the
film are known to be one beat apart rather than silently disagreeing.

### Notes on the wording

- **Never "administrative assistant" in the headline.** The person we want has
  stopped reading those. The title appears on the page, in the first section,
  where it belongs.
- **The bar is "not a developer, but you have written something", and both halves
  have to be said every time.** The brief changed on 7 November 2026, in these
  words: *"The person must have a bit of coding experience, understand Google
  scripts, Google Workplace, being able to work with, you know, different AI
  tools… Also Salesforce or any other CRM, but they get the tools if they're
  creative."* The earlier rule here was the first half alone — "you do not need
  to arrive knowing how" — written to stop the ad filtering for developers, and
  the reason for it still holds: a developer is the wrong person for this seat
  and will not take it. But the seat does need somebody who has already written
  something, so the line moved rather than went. Leave off "not a developer"
  and the only people who apply are developers; leave off "you have written
  something" and the shortlist is administrators who have never opened a script
  editor, which is what the twelve-fault form cannot screen for.
- **Do not print a salary.** The form asks what they earn and what they want,
  and the figure is agreed on the call.
- **No seat count and no closing date.** This page sits at a public URL and an
  evergreen "5 places" dates it.
- **Compliance.** The page makes no representation about Guardian Life terms,
  grading or benefits beyond "a branch appointment; terms and pay are discussed
  on the call." That is the paragraph to show Guardian HR if the ad is going
  outside the branch.

## The questionnaire, and how to read what comes back

Two gates, and neither is a CV sift.

### Gate 1 — the page: five taps, then the application

**The five taps** are behavioural rather than aspirational, scored out of 20.
The score travels with the application and leads the row's summary, so a glance
tells you whether to read the rest now or later.

| What it tests | Why it is there |
|---|---|
| What you did about a repetitive job | Builders build. Documenters document. Grinders grind. All three show in the answers. |
| **Is something you built in use by somebody else right now** | The single best filter on the page. Ideas are common; shipping is not. |
| What happened when an idea was refused | A stuck innovator has a story. "Nobody has ever asked me for an idea" scores **2**, not 0 — that is the person we want. |
| A wrong figure on a letter going to 300 clients | The care test, and the only question with a genuinely wrong answer. |
| How far you have gone with code | The lowest answer still scores **1**. Never knowing code must not sink the right person. |

**Reading the score:** 16–20, read their written answers that day. 11–15, worth
a conversation. Under 11, honest no, and the page sends them to `/careers/`.
**Any score with the careless answer on question four** stops them and does not
invite them to apply, whatever else they said.

**The application itself is six sections and about fifteen minutes**, with a
progress rail that moves on input. The length is part of the filter — the page
says so out loud: *"If fifteen minutes is too long to spend on this, then it is
honestly not the job."*

1. **You** — name, phone, e-mail, the town they live in, and how they would get
   to Chaguanas. The commute kills more admin hires than anything else.
2. **Where you have worked** — years working, current or most recent employer,
   role, dates, the employer before that, and their highest qualification. Then
   the box that matters: **"What is different there because you worked there?"**
   with the instruction *"Not your duties — anybody can list duties."*
3. **Pay, honestly, both ways** — what they earn now and what they are looking
   for, as monthly TT$ bands, plus when they could start. **"Prefer not to say"
   and "Open — tell me what the job is worth" are real options on each**, so
   nobody is barred for declining.
4. **What you can already do** — twelve tick boxes from Sheets formulas and
   pivot tables through a CRM, Zapier, AI tools and "written code of any kind",
   ending with "None of these yet". The page says plainly that **ticking
   nothing does not rule you out** — it only says where to start them.
5. **In your own words** — the three that decide it (below).
6. **Last things** — an optional link, an optional GitHub name, the best time
   to call, and where they saw the ad.

**The income bands are my assumption and yours to change**, in one place in
`buildwithus/index.html` (search `payNow`): under $4,000 · $4,000–6,000 ·
$6,000–8,000 · $8,000–10,000 · $10,000–14,000 · over $14,000, monthly TT$.
They are set to straddle what a Trinidad administrator typically earns so the
answer is informative at both ends. Change both selects together.

**The three written answers** are the real filter:

1. *One thing you built that nobody asked you to.* Score it on **specificity**.
   "I improved efficiency" is nothing. "The same eleven fields went into three
   systems so I built a form that filled all three" is the hire.
2. *The slim-down.* They pick one of the two real undone jobs named on the page
   and say how they would halve it. We are reading **how they think about an
   unfamiliar system**, not for a right answer.
3. *What they want on their CV in two years.* Vague here means they want a job,
   not this seat.

### Gate 2 — one thing you would fix here (this is the interview)

If the form reads like them, ask for exactly one thing:

> Look through what we have built, find something clumsy, missing, or that
> would save somebody an hour, and tell me about it — what is wrong, why it
> matters, and roughly how you would fix it. You do not have to write the fix
> and you do not have to be right.

**They can send it any way they like** — an e-mail, a voice note, a page of
writing. If they happen to use GitHub they can post it there as an issue and
you will see it in one place, but the page says plainly that almost nobody does
and that it counts for nothing either way. That change was made on 6 November
2026: requiring a GitHub issue filtered for developers, who are the wrong
person for this seat.

**Why this is the right test.** It is the job, almost exactly: walk into an
unfamiliar system, find a real problem, and explain it clearly enough that
somebody else can act. It cannot be faked by a CV, it cannot be bought, and it
costs effort — which alone removes everybody applying to forty things this
week.

**Read each answer for, in this order:** is the problem real; is it explained
so a third person would understand it; is the fix proportionate (a small
finishable thing beats a grand rewrite); and did they notice something you had
not. The last is the strongest signal there is.

### Gate 3 — twenty minutes on the phone

Their issue and their written answers, terms and pay openly, and a straight
answer either way.

## The two jobs the page points at

He asked for a project to point candidates at. Both of these are genuinely
undone in the branch today, both are described in `CLAUDE.md` in the branch's
own words, and either would be a real first fortnight:

1. **The nineteen staff forms still on an outside form builder** — petty cash,
   the fuel log, licence renewals, the visitors book. Four of them are the
   administrator's own. There are five finished branch forms in the repository
   to copy the shape from.
2. **The view counter that has never recorded a view.** 157 beacons are in place
   across the site and `gs/views-counter.gs` was never deployed, so the branch
   publishes constantly and is guessing about what anybody reads. One
   afternoon's work with a permanent payoff — and it needs a browser, which is
   why nobody in a session has been able to do it.

Naming real undone work rather than inventing an exercise is deliberate: it is
honest about the state of the branch, and it tells the right candidate
immediately that there is room to do something that matters.

---

# 2 · The advisor — `/joinourbranch/`

Asked for as *"a creative ad that has never been done in Trinidad"*, for
somebody *"stuck in the environment"* or *"thinking about the career"*.

## What is different about this one

**It does not sell the career. It strikes out how the career is usually sold.**
The page opens on a ledger: on the left, in strike-through, how this normally
goes — *a list of your friends · buy your own leads · find your own clients ·
work out the cover yourself · nobody checks it before the client sees it · a
number on a board at month end*. On the right, what this branch does instead.
That is the whole hook, and it works because every one of the struck-through
lines is what the reader is living.

**Then it builds the pitch in front of them, from their own answer.** He asked
for exactly this: *"Before they click apply there, can you do something so they
can more or less, it builds in before they get to the apply there."* Three
questions — what is in your way, where you are now, what you would want first —
and each answer assembles one proof card into a panel that is theirs, before
the TalentNest link appears at the bottom of it. Nobody reaches the apply button
without having read the three things that answer their own objection.

**It promises no earnings.** Not a figure, not a range, not "top producers
earn". The branch's own record (persistency, retention, what is given) is the
proof, and that is all that goes on a public page. This is the rule for every
recruiting page in this repository and there is no exception for a good month.

**It applies through TalentNest**, Guardian's own system — this branch's form
never touches an advisor application. The page says who reads it: the Branch
Manager and the Unit Manager.

## The ad

### 1 · Facebook and Instagram (the main cut — feed, sound off)

> **Most people start this career with a list of their friends. Not here.**
>
> Your leads come from a board — people who asked to hear from somebody.
>
> Your clients are matched to you household by household, with the whole file already read.
>
> The fact find does the arithmetic. Your client confirms the plan, and a manager signs it off before anything is placed.
>
> Your numbers are on the wall every day. Not at month end. Not as a surprise.
>
> A coach, not a clock.
>
> See the whole thing before you apply → rickyrampersadbranch.com/joinourbranch

### 2 · For somebody already contracted elsewhere (message, one to one)

> You are good at this. The question is what you are being given to work with.
>
> Leads from a board, not from your own phone contacts. Clients matched to you household by household with the file already read. A fact find that does the arithmetic, a client who confirms it, and a manager who signs it before anything is placed. Your numbers on the wall daily.
>
> Have a look before you decide anything: rickyrampersadbranch.com/joinourbranch
>
> Nobody where you are will hear of it.

### 3 · WhatsApp (the branch group, for referrals)

> *We are opening the door to advisors who are stuck.*
>
> Not stuck because they are bad at it — stuck because nowhere they have worked gave them leads, matched clients, a fact find that does the arithmetic, or a plan the client confirms and a manager signs before anything is placed.
>
> The page shows them exactly what they would be given, then builds the answer to their own objection in front of them before they apply.
>
> rickyrampersadbranch.com/joinourbranch
>
> Reply with one name of somebody who should see this.

### 4 · TikTok and Reels (the upright film, with a caption)

> They told you to start with your friends.
>
> Here is what you actually get instead.
>
> Full thing: rickyrampersadbranch.com/joinourbranch

### Notes on the wording

- **The fact find order is: you → the draft → your client confirms → a manager
  reads and signs → placed.** The first cut of the page and the film both said
  "a manager signs it off before it reaches your client", which is the order the
  branch spent a year putting right and corrected on 29 October 2026. It is an
  easy one to write backwards because it sounds more rigorous that way. It is
  not: the client confirming first is the whole point, and an ad that teaches it
  backwards teaches a new advisor the wrong process on their first day. **Third
  time this has been written the old way** — check it against `CLAUDE.md` before
  re-wording that line in anything.
- **Never a figure.** No income, no range, no "earn up to". The branch's record
  is the proof; a number is a promise nobody can keep for a stranger.
- **Never characterise anyone who left**, here least of all. The ad is about
  what this branch gives, never about what another one does not.
- **"Contracted somewhere today? Nobody there will hear of this"** stays in
  every cut. It is the single line that makes a practising advisor read on.
- **Do not promise a start date or a seat count.** The advisor door has a
  selection process behind it; the film and the page both end at "see the whole
  thing", not at "you're in".

---

# 3 · The client manager — `/clientmanager/`

**Renamed and reframed on 7 November 2026**, after the branch manager read the
underwriter page back: *"it's not really an underwriter. It's somebody who has
experience with general insurance… We already have our book… with having
underwriting experience is important, but carefully the act changes and
advising our clients properly, looking at the extension… they're fed up of
implementing something, and here we're open to ideas and changes. We already
have a book, and we're looking for someone to manage more or less that book."*

**An agency does not underwrite — the insurer does.** That is the whole reason
the first version was wrong, and it was not a title problem. The page sold
authority over risk acceptance that the seat will never have, which an
experienced underwriter catches in the first line and then discounts
everything after. It said "underwriter" thirty-two times.

What the seat actually controls is everything on the client's side of that
line: what we put up and how it is presented, the endorsement mid-term, the
renewal conversation, the advice on what the cover does and does not do, and
the Act. That is a **better** pitch to the person he described, because that
person has probably never been given control of any of it.

**`/underwriter/` and `/underwritervideo/` are redirect stubs** and stay that
way: the old address was in the setup doc and may have been shared. The form
key stays `underwriter` and the reference stays `QU-`, so `Quotes.gs` needs no
paste and no new deployment; `QC-` was not available anyway, since the critical
illness quote owns it.

## The soundtrack, and the cinematic pass

### What the music actually is, per film

*"What about the soundtrack?"* — 8 November 2026. The answer differs by film,
and only one of the three is clear:

| film | bed | licence |
|---|---|---|
| **`cmadmin`** (client manager) | **`rr-branch-theme.mp3`** | the branch's own, written for the branch. Nothing to clear. |
| `bwadmin` (administrator) | the clip sent on 6 November 2026 | **unnamed**, and still the one thing standing between that film and being posted |
| `jbadvisor` (advisor) | the same | **unnamed** |

So the client manager film can go out today. The other two are one command
each: rebuild the bed from the branch theme and re-mix — **no re-render**,
because only the audio changes.

### The score moves with the film now

A bed held at one level for two minutes is wallpaper, and that is what it was.
**`score` in `films.json` is one gain per scene**, and `usetrack.py` applies it
as a ramped envelope — never stepped, because a step in a music bed reads as a
mistake in the edit. The ramp is 1.6 s **centred on the cut**, so the lift has
already begun as the picture changes.

The shape for `cmadmin`, which is the shape of the argument: `0.55, 0.50`
quiet under the problem; `0.86, 0.96` the turn as the book arrives; `0.80,
0.80` the working middle; `1.00, 1.08, 1.00` the heart and the build; **`0.62`
a deliberate drop** under the one-line statement, so that `1.18` at the close
lands as a swell rather than more of the same.

### Two risers, and the filter they needed

`risers` in `films.json` is a list of seconds a riser **lands on**: noise
climbing through the spectrum against a tone bending up, cut dead on the
frame so the picture change is the release. One into the build, one into the
close.

It needed a filter `sfx.py` did not have. **`lp()` and `hp()` take a scalar
cutoff**; handing either an array makes the coefficient an array and the
filter's state a vector, and it dies deep inside the sample loop with
*"setting an array element with a sequence"*. `lpv()` and `hpv()` take one
cutoff per sample, which is what a sweep is.

### The cinematic layer, and why it touches nothing

Opt-in per film (`"cinematic": true` at the top of the lines file), because
turning it on changes every frame and each film must be re-rendered to pick it
up. `cmadmin` has it; the other two can take it whenever they are next cut.

Everything in it is an **overlay or a background** — nothing moves, scales or
clips the content, because `bwfit.js` has already measured that content to sit
inside the 1280×616 the mixer keeps:

- **a slow push on the background only** (`bfPush`, 1.015→1.075 over the
  scene's own `--D`), so the frame breathes and the words stay exactly where
  they were measured. Pushing `.inner` instead would have moved measured
  content toward the crop;
- **a vignette**, which is the thing that makes a flat screen read as a lens;
- **grain** — one 96px noise tile written by the builder itself, stepped eight
  ways at 0.9 s, 3.5% on `overlay`. It is the cheapest effect here and the one
  the eye reads as *shot*;
- **a fade up from black** on the first scene only.

**No letterbox bars**, deliberately: the mixer already crops to 1280×616 and
pads back with the caption strip, so bars inside that band would either double
the letterbox or eat a scene's own top and bottom.

**The class guard earned its keep again** — `.grain` and `.vig` are both
styled by the film shell, so they are `.bfgrain` and `.bfvig`. That is the
sixth time it has caught one.

**And a copy bug the new length exposed:** the cover's "Watch — …" line banded
at 120 s and 160 s, so a 2:03 film announced itself as *two and a half
minutes*. There is a `just over two minutes` band now.

## Two doors, three charts, the town, and a section cut

Asked for on 8 November 2026: *"a little more motions with percentages and a
little more graphics and a little more charts and a little more tightening up,
condense a little more shorter. Don't say Chaguanas... it will prompt someone
with the experience to apply, as well as somebody without the experience, but
they do possess the skill set that they can learn fast because it's a
tech-driven environment."*

### Two doors, and why they have to be separate

He wants the career-changer as well as the experienced hand. **An ad that says
"experience required" and then "apply anyway" collapses its own filter**: it
buys a flood with no way to sort it. So `#you` is now two labelled doors —
*1 · You have done this* (years on a book, time actually underwriting, papers,
judgement) and *2 · You have the head for it* (something you taught yourself
and then used, systems instinct, people under pressure, and you will sit the
exams, which we pay for). Door 2 says plainly that the first year is harder and
that the tools carry a great deal of what experience used to carry — **not all
of it**.

The filter follows the door all the way to his inbox:

- the form asks **`uw_door`** first, before anything else in section 2;
- **`bar()` scores each door on its own terms.** Door 2 is not marked down for
  the experience the door exists to let past; it is scored on systems named,
  depth in the written answers, whether they read the file and how closely,
  papers or papers in progress, and any insurance exposure at all. It reads
  *"Door 2 · 4 of 5 · read the file lightly"*;
- `scan_bar` is still the first line of the e-mail and still **never shown to
  the candidate**, so the door never reads as a rejection on the page.

### Three charts, and one that is deliberately not a chart

- **86% ring** on `#tech`: six of the seven stops take themselves. It is the
  measured version of the "ninety per cent re-keying" claim, and it draws
  itself on `animation-timeline: view()`.
- **72% bar** under the Log Book figure in `#service`.
- **The twelve months, lit and not measured.** The record does carry the
  month-by-month shape of the book — and it is not going on a public page,
  because it tells a competitor exactly when to go at us. Every month is lit
  at the same height; the caption carries the true and safe claim, that
  renewals fall in all twelve and there is no quiet season.

### The town

*"Don't say Chaguanas."* It had been in the badge, the hero's practical line,
both meta descriptions and the footer. It now appears **once**, in the apply
section, where somebody actually deciding will look for it — because **a
recruiting ad that never says where the office is loses people who cannot
judge the drive**. Everywhere it used to lead, it reads *Central Trinidad*, and
the posters' mastheads changed with it (`where` in `tools/ads/build-ad.py`).

### What was cut

**`#different` is gone**, six cards and 3,502 bytes of it. `#tech`'s seven
stops tell the same story better and in order; the two facts it carried that
the pipeline does not — Guardian's actual PDFs rather than retyped versions,
and the record cleaned before you quote it — folded into the pipeline's own
small print.

### A third instance of one bug

`.ring86 figcaption span{display:block}` caught the counter's own span inside
`.r-pct` and put *86* and *%* on two lines. That is the same fault as the
`<em>` that became a third flex column in `#fit`: **a descendant selector on a
generic tag inside a component catches the inline elements the copy uses**.
Scope to the direct child (`figcaption > span`), or wrap the text.

## The book drawn, the renewal drawn, and the service with figures under it

Asked for on 8 November 2026: *"a lot of graphics, building in the book in
terms of commercial and personal, and with the focus of customer service and
technology... we adopt all technologies. We are technology driven and looking
to continue enhancing this book."*

Three sections, and each one shows something instead of asserting it.

**`#lines` — the book, drawn.** The flat ten-item list is now the two sides it
is actually written on, with a spine between them that draws itself on scroll:
*personal* (private motor, household and private dwelling) and *commercial*
(fleet, commercial property and fire, public and products liability, workers'
compensation, machinery and plant, bonds), then endorsements and extensions
across both and marine and cargo as the room to grow.

**No proportion is printed, and that is a decision rather than an omission.**
`Cover_Type__c` is empty on every term, and the record types mix private and
commercial inside both Motor and Property, so a personal/commercial split would
be a guess on the one page where a guess is least affordable. What the record
does carry, for choosing words only: 688 terms in force, Motor 525, Property
140, Workers Compensation 15, Public Liability 6, Bond 1, Machinery 1, and no
marine — which is why the page says marine sits in the system with nothing
written on it.

**`#tech` — one renewal, end to end, seven stops.** The notice found and read,
every figure checked against our record, the whole history opened, **the call**,
the forms filled, the client signing in, the file writing itself. Six are
automatic and the fourth is marked *This one is yours*. It is technology shown
rather than claimed, it is all running today, and the closing line is the
offer: *the next stop on that line is the one you tell us about*.

**`#service` — the service machinery, with measured figures.** 3,634 documents
through the Log Book in twelve months and 72% on to Guardian inside one working
day (both measured off the old book, Nov 2025 to Oct 2026); every delivery
signed for by name and relationship and then rated; a 24-hour route for a
client question tracked against a turnaround; the 45/60/75/90-day letters
before a lapse; and one screen the whole branch can see. The copy says plainly
that this is the **branch's** machinery and the general insurance book sits
inside it — it is not claimed as the agency's own.

**What is NOT claimed here, deliberately:** that clients rate us. The client
rating e-mail in `Claims.gs` is built and **held** pending the branch manager's
approval of its wording, so the page says deliveries are rated and stops there.

### A capture artifact that reads exactly like missing content

An element screenshot of a section taller than the viewport shows the lower
part **blank**, because anything driven by `animation-timeline: view()` with a
backwards fill is still at opacity 0 at that scroll position. Two stops of the
pipeline and the whole foot of the book section "vanished" this way, and both
were fine: measured in the browser, every one reaches opacity 1 when scrolled
to, and with motion off or without `view()` support none of them animates at
all. **Shoot at viewport size, scrolled to the part you want** (`cmlook/vp.js`
in the session scratchpad) rather than taking an element screenshot of a tall
section, or you will chase content that is not missing.

## The frame: an established book that has outgrown one man — not a new agency

Corrected on 8 November 2026, and this is the one to read before touching any
word of this ad. The page had said *"The branch has opened its own general
insurance agency, and it is not a start-up."* He struck it out:

> *"Don't focus on opening an agency... I'm in the business for 35 years and
> I've built a substantial general insurance book. My time is needed
> elsewhere, but focusing on the reliable person of advising what we have
> built, the tools that we use, with the goal of attracting the right
> candidates for us to continue. So it's not that we're now doing this. We've
> always had very great successes."*

He is right, and the fault was worse than tone. **"We have opened our own
agency" tells a candidate who already has a job that he would be the
experiment**, and *"it is not a start-up"* is the giveaway — a sentence written
only because the doubt is already there, which plants it. The strongest thing
this ad has is the opposite of novelty: the book exists, it has renewed year
after year, the clients and the income are already in it. That removes the risk
of moving, which is the single biggest reason a stuck person stays stuck.

**The reason the seat exists is now the ad's best paragraph.** It is in his own
words, signed, in the `#why` section straight under the hero: he built the book
himself, it has done well, he is running a branch and his time is needed across
all of it, and the book deserves somebody whose whole attention it is. **It
must never read as a book being handed over neglected** — it is a book being
promoted. That distinction is the whole difference between an attractive seat
and a suspicious one, and every rewrite has to keep it.

**What the record supports, and what it does not.** `Risk_Details__c` holds
general insurance terms from October 2013, but only a handful before 2018; it
is substantial from 2020 and runs to 2,661 terms. So the *record* is about six
years deep, which is not the same as the book's age, and **no figure is printed
for how old the book is**. The ad says *"written and renewed here year after
year"*, which the record does support, and the thirty-five years are stated as
**his own years in the business, in the first person**. Salesforce has his hire
date as December 1993 — thirty-two years with Guardian — and the two are not
the same claim; that was put to him.

Phrases that are now wrong everywhere and must not come back: *opened its own
general insurance agency*, *it is not a start-up*, *we are building the team*,
*this agency is being built now*, *there is no queue yet*.

## The mindset filter, and why it cannot be adjectives

Asked for in the same message:

> *"I don't want the 8 to 4 person. I want persons who are creative, who will
> look at the processes, and that's the challenge I'm having — the mindset of
> the persons coming into work today... they have the general insurance
> experience, but they're stuck, they're not going anywhere, and they want to
> learn and excel."*

**You cannot filter mindset with adjectives.** Every applicant writes that they
are a self-starter who thrives on change; the word costs nothing to type, so it
sorts nobody. Two things do work, and both are now on the page:

- **Naming the wrong person plainly.** `#fit` is two lists — *probably not you*
  and *probably you* — in the candidate's own sentences, not ours: *you would
  rather be told the rule than be the one who decides it*; *you have been
  saying this would work better if… for years, to people who wrote it down and
  did nothing*. Naming the wrong person is the one thing that makes them leave,
  and it is what makes the right person feel recognised. Its headline states
  the rule outright: **this is not an eight-to-four job, and that is not about
  hours** — the hours are genuinely his to set; what is not optional is that
  the process is never finished being improved.
- **The work itself.** The real filter was already built: fifteen minutes, a
  real renewal file to read, four written answers, and the bar line that says
  who actually opened the file. `uw_renewals` (*what would you change about how
  a general agency handles renewals*) and `uw_stopped` (*something you tried to
  change and could not — what stopped it?*) are the two that separate this
  person, and they were already there. **No new question was added**: the form
  is already at fifteen minutes and lengthening it costs more applications than
  the extra question would sort.

## The book: how to count it, and what may be published

Asked on 7 November whether the ad could name the book's size, he chose *"name
its size and classes"*; shown the counted figures the same evening he changed
his mind: **"don't mention the amount of clients. Give an assumption in terms
of all the lines we write and our specialties."**

**So no client count and no policy count appears anywhere** — not on the page,
not in the film, not in the ads, and **not in this file**, which sits at the
repository root and is therefore served on the open web. The house rule in
`CLAUDE.md` already says per-book client counts are not published; this is that
rule, applied to a recruiting page.

What the ad says instead: **seven lines in force and three more written here,
personal and commercial, renewals falling in every month of the year**, the
lines named, fleet called out as a capability rather than a number, and the
classes with nothing current on them named as room. Plus the specialty he asked
to lead on — endorsements and extensions, written to the Act.

**To re-derive the figures when somebody needs them internally** (an interview,
a conversation with the insurer), this is the count, and it takes one query:

```sql
SELECT COUNT_DISTINCT(Client_Portfolio_Look_Up__r.Contact__c),
       COUNT_DISTINCT(Policy__c), COUNT(Id)
FROM Risk_Details__c
WHERE RecordType.Name IN ('Motor','Property','Public Liability',
      'Workers Compensation','Machinery','Bond','MARINE')
  AND To__c >= TODAY
  AND (Vehicle_Status__c = null OR Vehicle_Status__c != 'Sold')
```

Three things learned counting it, which the next person will hit too:

- **Quote the policy count, not the term count.** One motor policy carries many
  `Risk_Details__c` rows, one per vehicle, so terms run far ahead of policies.
  Part of the gap is also the duplicate-term problem `girDedupe_` exists to
  clean, so the term count overstates twice over.
- **`Vehicle_Status__c = 'Sold'` has to be excluded** or the book looks bigger
  than it is.
- **Marine reads as a live class and is not one.** It is in `GIR_LINES` with
  nothing in force, so an ad listing "eight classes" off the config would be
  claiming a class we do not write. Count, do not read the config.

## What the page says now

- **The hero** leads on the book: *"The book is already there. What it has
  never had is you."*
- **`#lines`** is the book by its real numbers, with one paragraph making the
  relationship exact: this is the **branch's own** general insurance agency,
  the insurer carries the risk and holds the underwriting authority, and the
  branch's group health and group life book sits beside this one with its own
  team and is **not** part of this seat.
- **`#work` is new** and is the thing he asked for: endorsements and
  extensions, the renewal conversation, telling clients plainly what the cover
  does and does not do, **the Act and what changes in it**, the claim from the
  client's side, and a record the next person can read. The Act card carries
  the one line that matters most here — nobody may cause a policyholder to
  discontinue or replace a policy without first discussing the advantages
  **and** the disadvantages — with no section number, by the house rule.
- **`#build`** became *"You will not be raising a ticket. You will be making
  the change,"* aimed squarely at *"fed up of implementing something"*: a
  change asked for here is written into the desk and runs that week.
- **`#you`** now requires **both** general insurance experience and
  underwriting experience, at his explicit choice, with the papers asked as a
  status and *which one and what is left*. That is a narrow field in a market
  this size and he was told so; one line changes it back.
- **`#file` is unchanged**, because a renewal file and *what would you act on
  before you quote it* is exactly a client manager's judgement. The nine
  findings are still ones `girInsights_` genuinely computes.

## The filter: what he actually receives

Asked on 7 November: *"have you filtered in the questions correctly so I will
get who applies?"* Half the answer was no, and the half that was wrong is worth
recording: **the written questions were still the underwriter's** after the
seat had been reframed. They tested whether somebody could rate a risk, and
nothing tested the job he had just described.

Section 4 is now **four written questions plus a tick row**, and each one is
there because it separates people:

1. **A risk you turned away, or advised a client against, that you could have
   placed.** Unchanged in substance: the one question nobody can prepare.
2. **An endorsement or extension that went wrong where you worked — late,
   missed, or written loosely.** The technical heart of the seat. Anybody who
   has really carried a book has one of these, and the answer shows at once
   whether they think in cover or in paperwork.
3. **A time the right thing and the easy thing were different.** This is the
   compliance question, and it is deliberately **not** "what does the Act say":
   that tests memory, which anybody can look up, and a good candidate resents
   it. A scenario shows the instinct.
4. **Something you tried to change where you worked and could not. What
   stopped it?** The literal test of *"fed up of implementing something"*. It
   also tells him whether they push or give up, which matters more here than
   anywhere, since the whole offer is that a change gets built.
5. **What would you change about how a general agency handles renewals** —
   kept.

Plus a tick row, *which of these have you actually had to handle*: a
replacement or cancellation, non-disclosure at claim, a formal complaint,
underinsurance or average, a regulator or compliance query, client data or
privacy, none yet. Cheap to answer, very revealing, and it cross-checks
question 3.

### The scan line, so a row can be triaged from the e-mail

The e-mail printed the answers section by section and left him to read the
whole thing. The page now sends an **At a glance** section first — Quotes.gs
prints sections in the order it is given them, so this needed no backend
change — computed from what the candidate actually did:

| | |
|---|---|
| **Fit** | years · qualification status · how many classes · *and whether motor and property are both among them*, since that is where this book lives |
| **The file** | how many findings they ticked, the first two in their order, and their premium decision |
| **Compliance** | how many of the six situations they have handled |
| **Depth** | how many of the five written answers are substantial rather than short |

That is enough to sort an application without opening the row, and every part
of it is the candidate's own work rather than a score we invented.

### Volume over scarcity, and the bar that takes its place

Asked on 8 November 2026: *"we are opening our insurance agency in Chaguanas
and looking for staff — the target is really persons who are in these agencies
and want to move, as they are stuck."* Offered the choice between keeping *one
vacancy* (scarcity, fewer but more serious applications) and dropping it
(volume), he chose volume, in these words: **"leave a number out as you want as
much application, and you need to ensure you have a proper filtering system as
well the questions section."**

So the seat count is gone from this ad everywhere — the page title, the
`og:description`, the badge, the hero, the homepage card, the film's own page
metas and all three posters — and the filter had to carry the weight the
scarcity was carrying. Two things were added for it:

- **A direct question that was never asked.** Underwriting experience is
  *required* and nothing on the form asked for it: `uw_uwexp` (with an insurer
  / under delegated authority at an agency / some, informally / no) and
  `uw_uwwhere`. Answering **no** shows a note saying so plainly rather than
  blocking the application — somebody strong without it is still worth a call,
  and he should make that call himself.
- **A bar line at the top of the e-mail.** `scan_bar` is the first field he
  sees: *Meets the bar · 5 of 5*, or *Check · 3 of 5 · no underwriting
  experience, did not read the file*. The five are: three years or more, a
  qualification or studying, three classes or more, underwriting experience,
  and having opened the file on the page. **It is never shown to the
  candidate** — it is a sorting aid for one reader, and a page that tells
  somebody they failed a bar they did not know existed is a page that gets
  screenshotted.

`scan_bar` is also the first value in `QUOTE.SUMMARY['underwriter']`, and the
team e-mail's subject now appends that summary, so a phone's notification reads
*New Client Manager request · QU-… · <name> · Meets the bar · 5 of 5* without
the e-mail being opened.

**Volume cuts both ways, and the bar is what pays for it.** Dropping the count
will bring applications from people the seat is not for; the bar is the thing
that stops those costing him an evening each.

### What does need a Quotes.gs paste

The backend uses its own `line` and `title`, not the ones the page posts, so
until it is pasted and a **New version** published:

- the team e-mail is headed *"New Underwriter request"*;
- **the candidate's own confirmation is headed "Underwriter, general
  insurance"**, which is the one a stranger sees;
- the highlighted summary band reads years · classes · authority rather than
  the bar line · years · qualification, and the subject carries no summary at
  all.

The form key stays `underwriter` and the reference stays `QU-` on purpose:
renaming the key would strand the rows already on the tab for nothing.

## Why somebody would actually move

The same message asked to *"introduce virtual etc, things that will make a
person move — focus on the technology and show how this improves."* The
technology was already most of the page, so what was missing was the part that
is not technology at all.

**Virtual needed splitting in two, and only one half is true.** Virtual *for
the client* is live today — the quote, the forms, the renewal desk, the
signature — and the page already said so. Virtual *for the staff* is not: the
branch runs fixed hours per desk with an attendance register, marks a desk
absent five minutes after its start and moves its work to a colleague at thirty
(`SCHEDULE` and the cover rules in `KPI.gs`). Promising remote work to this
seat would have been a promise the branch's own systems contradict on day one.

Offered the four honest versions, he chose **fully flexible hours**: the seat
sets its own, judged on the book rather than on the clock. That is now the
badge on every poster (*We are hiring · hours that suit you · Chaguanas*), a
line in the hero, and the first of the four cards in **`#move`** — the section
written against the four sentences this person actually says about where they
work now:

| they say | the page answers |
|---|---|
| *I am measured by the clock* | judged on the book, hours yours to set |
| *Nothing I suggest ever happens* | a change you ask for gets built that week |
| *There is nowhere above me* | the person who runs this book from the start runs what it becomes |
| *The systems fight me* | the paperwork side is already built, and you can see it before you apply |

Two more decisions in the same breath, both in the page and in all three ad
cuts:

- **Pay is negotiable on experience.** Said rather than hinted; no figure, no
  band, since the branch has not set one.
- **"One thing we are not asking you for: your clients."** This matters more
  than it looks. Everybody recruiting from an agency in this market is
  assumed to be shopping for a book, and saying plainly that we are not
  removes the one reason a good person would not reply. It is also the truth:
  the book is already here.

**The attendance register is the open question, and it is his.** A seat on
fully flexible hours does not fit the register, the absent-at-start-plus-five
rule or the automatic cover pass as they stand. Either this seat is marked
exempt in `SCHEDULE`, or the promise quietly stops being true the first week.
Nothing has been changed in `KPI.gs` for it.

## The film — `cmadmin`, 2:03, cut 7 November 2026 and re-framed on the 8th

Eleven scenes on the same engine, replacing `uwadmin` at the same path. Three
things the reframe forced, all of them real faults in the cut before it:

- **Scene 3's eyebrow read "Guardian Life of the Caribbean"** over a voice
  saying *"we are opening a general insurance agency"* — which reads as
  Guardian Life opening one, the exact thing he says it is not. It is **"The
  Ricky Rampersad Branch"** now, and the insurer appears only where it belongs,
  as the carrier whose notice the renewal desk reads.
- **"Build the book"** was the closing line. We have a book. It is *"Look after
  the book."*
- **Scene 4 is what we write** (`bwstack`: the seven classes as chips, and
  **7 lines** and **12 months with renewals in them** as the counters). It began
  as the book by its client count and was changed the same evening — see the
  book section above for why no count is published anywhere.

**Two lines came back slurred in ways that changed the meaning** and were
re-worded off the shape rather than around it, which is the rule this voice
keeps teaching: *"a ticket in a queue at head office"* was heard as **"a queue
ahead office"**, and *"an endorsement nobody has to retype"* as **"nobody has
to retive"**, with *"a sum insured"* as *"some insured"*. They are now *"a
ticket that joins a queue somewhere else"* and *"an endorsement nobody types in
twice… when the sum insured has not moved."*

**`"ticks": false`** is on the rule scene for the reason recorded in
`tools/film/CANVA-AND-THE-EIGHT-CUTS.md`: a green tick beside *"wait for the
release"* reads as the wait being fine.

**`importvox.py` leaves the timing file in a shape the builder cannot read.**
It writes `lines[i].words` in **seconds**; `build-boardfilm.py` reads a
top-level `words` in **milliseconds**. So after every re-voice the file needs
one conversion pass before the build, and until that pass runs the committed
timing file does not build — which is how `cmadmin-timing.json` sat in the
repository for a day in the wrong shape. Convert it, and write the file back
**compact**, the way it was: re-indenting turns a one-line change into a
1,200-line diff nobody will read.

A cue word in the lines file has to appear **in the spoken line, inflected the
same way**: `at2: "retypes"` against a line that says *retyping* stops the
build with `no word 'retypes'`. That guard is worth keeping — it is the only
thing that catches a reveal landing on a word that is never said.

**Two lines were re-voiced for the 8 November reframe.** Scene 3 was the only
one in the film that carried the wrong claim — *"The branch has opened its own
general insurance agency. And it already has a book."* It now reads *"The book
is not a new one. We have written it for years, and renewed it year after year.
The Branch Manager built it himself, and his time is needed across the
branch."* And the close picked up the mindset filter: *"...If you are good at
this, and you have stopped learning, come and look after the book."* Scene 3
went 6.0s → 11.6s and scene 11 8.4s → 11.2s, so the film is **2:03**.

**Every `hits` value moves when any scene's length changes**, because they are
seconds into the film while `dark` is scene indices. Derive them from the built
page rather than guessing: each counter carries `data-at` in milliseconds from
the start of its scene, and the scene starts come from `durs`. Here both are in
scene 4, so [28.65, 33.61] became **[34.15, 39.11]**.

**The close said "One seat." and does not any more.** When the ad dropped its
seat count on 8 November, the film still ended on *"One seat, for a client
manager"*, on screen and in the voice — a promise kept in one place and broken
in the other, which is the rule this repository keeps relearning. One line
re-voiced (`cmclose`), one scene's eyebrow and reveals changed, and the whole
film re-rendered: it now closes on *"Client manager, general insurance.
Chaguanas. Come and look after the book."* Scene 11 went from 8.1 s to 8.4 s,
so the film is 115.0 s; nothing before it moved, so `hits` and `dark` in
`films.json` are unchanged. Whisper hears *Chaguanas* as "Chagwanis" on every
take — a transcription artifact, not a read fault, and the word is on screen
in the same scene.

## The ad

### 1 · LinkedIn (this is where this person is)

> **WE ARE HIRING · HOURS THAT SUIT YOU · CHAGUANAS**
>
> **The book is already there. What it has never had is you.**
>
> *If you know general insurance well enough to look at a book this size, across ten lines, and see exactly what it has been missing — this is the one to read.*
>
> I have spent thirty-five years in this business, and the general insurance book at the Ricky Rampersad Branch is one I built myself. It has done well, and it has renewed year after year. But I am running a branch, and my time is needed across all of it.
>
> So this book needs somebody whose whole attention it is. Seven lines in force — motor and fleet, household, commercial property and fire, public and products liability, workers' compensation and employers' liability, machinery, plant and contract works, and bonds — personal and commercial, with renewals falling in every month of the year. Three more have been written here and have nothing current on them: marine and cargo, money, burglary. Cyber has never been written here at all. All of it sits inside the seven classes of general insurance business the Insurance Act 2018 prescribes, and that is room — it would be yours.
>
> Here is what you would be walking into. The quote fills itself from the client's own record. Guardian's proposal form and the customer due-diligence checklist are filled by the system, field by field, and attached — the insurer's actual PDFs, not retyped versions. The renewal desk reads every term since the policy began — not just this year's — before anyone opens the file. The insurer's notice is read and checked figure by figure against our own record, and where the two disagree the desk says which and by how much.
>
> And it does the reading for you. The record is pulled out of every place it lives and scrubbed before you see it — duplicate terms, a mid-term change kept as its own policy, a vehicle carried under a changed number — and then the desk tells you what to raise first: the value carried unchanged two terms running, the sum insured that no longer means anything, the premium paid late last year, the claim still open. The client is reminded at fourteen days and again at ten, a call opens itself at seven, and the client signs in with a code to their own inbox and reads every year of their own history themselves.
>
> None of that is a plan. It is built and it is running, and you can see it before you apply. We did not buy any of it: the branch writes its own software, it reaches into every system we deal with, and it changes every week.
>
> Which is the difference. A client here is not a transaction — a renewal keyed, a premium taken, a file closed until next year. A client here is a journey, and the system is built to carry it.
>
> So the part of the day that is yours is the part only a person can do: the endorsement done properly, the renewal conversation, telling a client plainly what the cover does and does not do, and knowing when the Act moves.
>
> And one more thing, if you have spent years saying *this would work better if…* to somebody who wrote it down and did nothing: here, a change you ask for is not a ticket in a queue. It gets built that week.
>
> General insurance experience and underwriting experience both required.
>
> Hours are yours to set. Pay is negotiable on experience. The book is established; how it is run is not, and the person who takes it on decides that.
>
> One thing to be plain about: this is not an eight-to-four seat. The hours genuinely are yours. What is not optional is that the process here is never finished being improved, and in this seat you are the one who answers what should change.
>
> One thing we are not asking you for: your clients.
>
> Send your CV and about fifteen minutes of honest answers: **rickyrampersadbranch.com/clientmanager**
>
> Read by me personally. If you are employed today, nobody there will hear of it.
>
> — Ricky Rampersad, Branch Manager

### 2 · WhatsApp and one-to-one

> *WE ARE HIRING — Client Manager, general insurance, Chaguanas. Hours that suit you.*
>
> *If you can run a general insurance book and have never once been allowed to change how it is run, read this one.*
>
> Not a new book: one that has been written and renewed here year after year. Seven lines in force, personal and commercial, with renewals every month — and three more written here with nothing current on them, marine among them, with cyber never written at all. That is room. The Branch Manager built it himself and his time is needed across the branch, so it needs its own person.
>
> The quote and Guardian's own forms fill themselves from the record, every term since the policy began is on the screen before you open the file, and the record is pulled from every place it lives and scrubbed before you see it — then the desk tells you what to raise first. The client is reminded at fourteen days and ten, a call opens itself at seven, and they sign in and read their own history.
>
> We write the software ourselves and it changes every week. So the job is the advice, the endorsements and the renewal conversation — and a client here is not a transaction, they are a journey.
>
> Hours are yours to set, pay is negotiable on experience, and we are not asking you to bring clients with you. This is not an eight-to-four seat, and that is about the work rather than the hours: the process here is yours to argue with.
>
> rickyrampersadbranch.com/clientmanager — your CV and fifteen minutes. If you are somewhere with no room to grow, this is the one to look at.

### 3 · Job board or classified

> **VACANCY · CLIENT MANAGER — GENERAL INSURANCE** · Ricky Rampersad Branch ·
> Chaguanas, Central Trinidad.
>
> To take on an established general insurance book, written and renewed over
> years: seven lines in force — motor and fleet, household, commercial
> property and fire, public and products liability, workers' compensation and
> employers' liability, machinery, plant and contract works, and bonds — with
> marine and cargo, money and burglary written here and nothing current on
> them, inside the seven classes of general insurance business prescribed by
> Schedule 1 of the Insurance Act, 2018. Renewals,
> endorsements and extensions, the advice that goes with them, and the market
> conduct obligations under the Insurance Act.
>
> Required: general insurance experience on a real book, and time actually
> spent underwriting. Professional qualifications (ACII, CII Diploma or
> Certificate, or part-qualified) are asked for and count.
>
> The branch has written its own
> software, so the quote, Guardian's own forms, the full renewal history
> since inception and the claim checks are already automated, the record is
> pulled from every source and scrubbed before you read it, and the system
> says what to raise first — and a change you ask for is built, not queued.
>
> CV and application at **rickyrampersadbranch.com/clientmanager**. Read by the
> Branch Manager personally and treated confidentially.

## The page got its graphics — the stage, the ticker, the figures

Asked for on 8 November 2026: *"more graphics, more motions, something that'll
pop across the screen, scaled properly on any devices."*

**The hero is the stage, and it is the homepage's own composition in this
page's dark palette.** The branch's mark at the centre with **the ten lines
of business circling it** on two rings — four inside, six outside — over a
dot mesh, two drawn rings, two arcs sweeping against the spin and three pings
leaving the shield. The check strokes itself on when the page opens, and the
whole scene tilts to the pointer on a mouse or trackpad, which is what reads
as hovering. It is a diagram of the book, not decoration, and **nothing sits
on the mark**.

Under it, a **ticker** of what the book covers, paused on hover and on
focus-within; it is also what carries the names on a phone, where the ring is
icons only because labels cannot fit around a circle that size. Then a band of
five **figures that count up to the number already in the markup** — 7 lines,
12 months, 39 files, 100,000 lines, 48 hours — so no script, a thrown error or
motion turned off still leaves the right figure on screen. Cards lift on hover
by moving an **opacity on a `::after`**, never a `box-shadow`; the statement
grows as it crosses the screen on `animation-timeline: view()`; and the top bar
draws how far down the page you are on `scroll(root)`. All of it lives inside
`prefers-reduced-motion: no-preference`, and the loops park by a class added
**on exit** (`.hero.rest`) rather than one added on entry, which would freeze
every backwards-filled entrance at its invisible first frame if the script
never ran.

Measured after: no sideways scroll at 360/375/390/414/768/1024/1280/1366/1536/
1920, every ring label upright at four points in the cycle, contrast composited
through translucency (worst 5.09:1 on the figure captions), every real touch
target 24px or more, no typed field under 16px, **16.7ms a frame over three
passes with both rings spinning**, and the whole page readable with JavaScript
off.

### Two faults it turned up, both older than this change

**The chips' counter-spin does not cancel on the outer ring if you use one
keyframe.** `.ring{animation:oSpin}` with `.spin{animation:oSpin … reverse}`
looks right on ring-in and is wrong on ring-out, where
`.ring-out,.ring-out .spin{animation-direction:reverse}` lands on both and the
two angles **add**: the outer four labels turn over with the ring. It needs
**two keyframes**, `oSpin` to `360deg` and `oUnspin` to `-360deg`, both running
forward, with the direction flipped on the pair together — which is what the
homepage does. Caught by composing each label's matrices in the browser and
reading the angle, not by eye.

**The headline sat exactly on a line-break boundary, and the page's layout
shift was 0.577.** The fallback fitted the h1 in four lines and Inter Tight in
five, so the hero jumped a full 77px line when the font landed, moving
everything below it. A sub-one-per-cent metric difference flips it, so **no
`size-adjust` can hold a break that close** — the fallback was re-measured and
corrected (below) and the headline still flipped. What fixed it was choosing a
column width where both faces break the same way: widths from 360 to 1920 were
scanned in Inter Tight and in both fallbacks, and `1.3fr .7fr` is the first
ratio where all three agree at every one of them. **Cumulative layout shift
0.577 → 0.02.** Re-run that scan (`cmlook/scan.js` in the session scratchpad)
if the headline's words ever change.

### The metric-matched fallbacks are several per cent too narrow, site-wide

Measured in a browser on 8 November 2026 — the real face's average advance over
an English-frequency-weighted sample against each fallback, per weight bucket.
These are the values `size-adjust` should carry:

| face | bucket | vs Arial / Liberation | vs Roboto |
|---|---|---|---|
| Inter | 100–500 | **106.20%** (is 106.88) | **112.58%** (is 107.37) |
| Inter | 600–900 | **101.77%** (is 101.96) | **109.35%** (is 108.69) |
| Inter Tight | 100–500 | **101.51%** (is 96.22) | **107.61%** (is 96.66) |
| Inter Tight | 600–900 | **99.57%** (is 95.31) | **106.99%** (is 101.60) |

The Inter (body) values against Arial are right, which is why body text has
never shifted. **Every Inter Tight value is too low**, the Roboto one by eleven
per cent — and Roboto is what an Android phone falls back to, which is most of
this audience. `/clientmanager/` now carries the corrected eight; the other 139
pages still carry the old ones and should be swept deliberately rather than by
find-and-replace, because each page has its own copy of the block.

**Two things about measuring this in a container.** `local('Arial')` does not
resolve on Linux even though `font-family: Arial` does, so a fallback face can
be inert here while working on a phone — check which face is really in use with
CDP's `CSS.getPlatformFontsForNode` rather than assuming. And `document.fonts
.check()` answers true for a family fontconfig merely aliases, so it is not
evidence that `local()` matched.

**One width is still not stable:** at exactly 600px the Roboto fallback breaks
the headline differently from Inter Tight. Phones (360–414) and tablets (768)
all agree, so it is left.

### One pre-existing thing removed

The form CSS had been pasted in from `/buildwithus/` **twice** — 31 identical
lines, `.rail` through `.rail-bar i`. Dropped the second copy.

## The posters — `tools/ads/`, 8 November 2026

Asked for in those words: *"want to see the ad with a more punch and impact."*
He was right that there was nothing to see: the branch had three recruiting
pages and three films and **no still ad**. A page is where somebody lands; a
poster is what makes them land, and it is what actually gets posted.

**Nine posters, three per seat**, written by `tools/ads/build-ad.py` and shot
by `tools/ads/shoot-ad.js`:

| shape | size | where it goes |
|---|---|---|
| `ad-feed.jpg` | 1080×1350 | Facebook, Instagram, LinkedIn |
| `ad-story.jpg` | 1080×1920 | WhatsApp Status, Stories, a Reels cover |
| `ad-wide.jpg` | 1200×630 | a link preview, and a slide in a room |

They are built in **the board films' own midnight blue**, from the same
embedded IBM Plex, the same blue shield and the same QR codes, so the poster,
the film and the page read as one campaign. Everything is drawn: no
photographs, no faces, no stock. Shot at `deviceScaleFactor: 2`, so the files
are 2160 wide and survive being re-compressed by whatever posts them.

**Every line on a poster is the page's own line.** A poster that promises
something the page does not say is the fastest way to lose the candidate at
the moment they arrive.

To re-cut after a copy change:

```bash
cd tools/ads
python3 build-ad.py clientmanager          # or buildwithus, joinourbranch
node shoot-ad.js clientmanager ../../clientmanager
```

### Four things it taught

- **The frame gives, the copy does not.** `shoot-ad.js` measures every element
  against the poster's own box and fails the shot by name and by pixels. It
  caught the foot 63px below the bottom of the feed frame — the QR and the
  address simply gone — and 5px on the administrator's story, whose headline
  is the longest of the three. Tighten the type and the padding; do not cut the
  line.
- **`<i>` is italic.** The chips were marked up as `<i class="chip">` and
  rendered oblique, which reads as a mistake rather than a style. `font-style:
  normal`.
- **The masthead is the ad's own.** The first cut put *Guardian Life of the
  Caribbean* under the branch name on all three. On the client manager's ad
  that is the one thing it must not say — the general insurance agency is the
  branch's own. It reads *General insurance · Chaguanas* there, and keeps
  Guardian Life on the administrator's and the advisor's, which are the
  branch's own seats.
- **Decode the code, not the poster.** Scaling the whole 2400px poster down and
  running a detector over it reported failures that are not real: the detector
  struggles to *find* a 300px code inside a 2400px image, which is not how
  anybody scans. `shoot-ad.js` now measures the code's own box in the page and
  writes that crop, and all nine decode. The earlier "wide fails at 720" was
  this, not the code — although the wide frame is still the tight one, so its
  code is 152px against the feed's 176px and the story's 214px.

The advisor's poster also had the town twice — *Advisors · Chaguanas ·
Chaguanas* — because the template appends it and the copy carried it too.
Worth a look at the rendered file rather than the data.

## The ad reads as a hiring ad at a glance

Asked for on 7 November 2026: *"the ad should have a powerful attraction line
as a hiring. We know hiring. It must pop, so it must be somebody like we're
looking for vacancy."*

Every one of the three recruiting pages now opens with two things above the
headline that were not there before:

- **the vacancy badge** — a pill reading *We are hiring · one vacancy ·
  Chaguanas* (*advisors* on `/joinourbranch/`; *hours that suit you* on
  `/clientmanager/`, which carries no count — see below), with a dot that pulses only
  inside `prefers-reduced-motion: no-preference`. It says **hiring in words**,
  never by colour alone;
- **the attraction line** (`.pull`) — one sentence, large, against an accent
  rule, naming the person rather than the job: *"If you can run a general
  insurance book, and have never once been allowed to change how it is run —
  this is the one to read."* The administrator's and the advisor's each have
  their own.

Measured, composited through translucency and up to the first opaque ancestor:
badge 9.21:1 on the dark heroes, 6.89:1 on the light one; the attraction line
17.37:1 and 10.53:1. **The dot is not tested as text** and must never become
the only thing that says "vacancy".

**And it turned up a real bug that predates all of this.** `strong,b{color:
var(--ink)}` paints bold text the light ground's deep blue, so **every bold
phrase inside the dark hero was rendering at 1.56:1** — present on the page
since it was built and invisible to anyone reading it. `.hero strong` and
`.dark strong` are white now. This is the **third** time that one rule has
bitten this repository (the agentmgt tab labels were the first two): when a
page has a dark section and a light ground, a global `strong` colour is a bug
waiting for its first bold word.

**Measure contrast composited, or the measurement lies in both directions.** A
first pass compared the badge's text against its own `rgba(…, .14)` background
and reported 1.33:1 — a failure that does not exist — while the light hero's
own text came back at 1.82:1 because its background sits on an ancestor. The
check in the session scratchpad walks up to the first opaque ancestor and
flattens the stack; the same trap is already recorded for the homepage audit.

### Notes on the wording

- **The agency is the branch's own, and Guardian Life is not the employer in
  this ad.** Said in those words on 7 November 2026: *"it has nothing to do
  with Guardian Life, but the branch is opening their general insurance
  agency."* Name the branch. The insurer appears only as the carrier whose
  notices and forms the desk already handles. The job-board cut above no
  longer carries "Guardian Life of the Caribbean" after the branch name.
- **Never print the client count or the policy count.** Said in those words on
  7 November 2026: *"don't mention the amount of clients."* The ad says the
  lines we write and what we are known for; the figures stay in Salesforce,
  and the query to re-derive them for an interview is in the book section
  above.
- **Compliance is a selling point here, not a footnote.** *"Our endorsements,
  our everything is compliant and we drive compliance."* It leads the Act card,
  it is in the hero, and it closes the film's "what we write" scene.
- **Do not print the authority limit the seat will carry.** The form asks
  theirs; ours is agreed on the call.
- **Compliance.** A general insurance agency is a separate registration; show
  this wording to Guardian before it runs outside the branch.

---

# The films

**One film per ad, three shapes each, nine files.** Asked for after the first
silent cut: *"No it's the music and using Andrew voice you have stored"* and
*"Want to post on our Facebook and Instagram pages and TikTok."*

| | upright `-v` | feed `-f` | wide `-w` |
|---|---|---|---|
| Size | 1080×1920 | 1080×1350 | 1920×1080 |
| For | Reels, TikTok, WhatsApp Status, Stories | the Facebook and Instagram feed | YouTube, LinkedIn, a wall screen |

Each video page carries all three with a switch and **opens on the upright cut
on a phone held upright**, which is where most of these will be opened. The
share card is always the **wide** poster: every platform crops a 16:9 card
itself, and an upright one is letterboxed into a grey band in a WhatsApp
preview.

## The type was rebuilt once, and this is the rule that came out of it

The first cut was turned down in these words: *"I'm finding the words very
difficult to read."* He was right, and the fault is nameable: the type was
sized as a share of the frame's **short edge**, which is fine on a television
and wrong in a feed.

**A feed video is shown about 400 px wide whatever its pixel size, so what
decides whether a word can be read is its share of the frame WIDTH.** Nothing
below about **3.4% of the frame width** survives it. The engine therefore sets
one unit, `--u`, as a share of the frame width, and every size is a multiple of
it: the headline is 132 u, the sub 62 u, a stacked line 72 u, a counter 116 u,
the eyebrow 38 u. At 1080 wide that is a 132 px headline, which reads on a
phone held at arm's length.

**One type scale cannot serve all three frames, so each scene fits itself.**
The wide cut has a third of the height of the upright one and the same words,
and the longest headline — the underwriter's opening — came out filling 93% of
it, with the eyebrow 55 px from the top edge. It was legible and nothing was
clipped, but a card with no margin reads as cramped, and that frame is the one
the poster is cut from. So after the font has loaded, each scene measures the
sum of its own children and shrinks its **own** `--u` until it fits inside 88%
of the frame. On these three films that touches one scene in each wide cut and
nothing else, by about 5%. Nothing is hand-tuned per scene, which is what keeps
a re-worded line from quietly overflowing later; a render reports every scene
it shrank and warns below 62%.

**The upright and feed cuts have the opposite problem, and the same pass
fixes it.** The wide frame is tight; the upright one is 1080 × 1920 with the
same words, so a scene sized to the width floated in the middle of it with a
third of the frame empty above and below — which reads as an accident rather
than as composition. After shrinking, those two shapes grow `--u` back up in
5.5% steps until the scene fills about three quarters of its frame, capped at
1.3×, **re-measuring at every step** (bigger type wraps to more lines, which
adds height) and backing off the moment the height would exceed the frame or
anything would run off the side. The wide cut never grows: it has no room.

**Measure the children, not `scrollHeight`**, and **measure before `SEEK`.**
The pad is a centred flex column, so it overflows equally at both ends and
`scrollHeight` reports half of it; and `SEEK` puts a `scale(1.022)` on the
scene for its entrance, which inflates every child's `getBoundingClientRect`
by 2.2% and makes a scene that fits look as though it does not.

## The colour and the motion were rebuilt once too

Asked for in these words: *"you can have more soft colors that is apealing and
easy on the eyes also lots of cutting edge motion an dgraphivs and graphics and
movements."*

**The dark ground came off near-black, which is the sixth time this branch has
asked for that.** It was `#0b1b2d`; it is `#17334a` now, with every dark scene
a soft 168° wash from `#1b3b55` into `#132b40` rather than one flat fill. The
light scenes wash `#fbfaf5` into `#eef2ee`. No flat black anywhere and no
`rgba(0,0,0,…)`: shadows take their hue from the ground.

**The accent came off electric cyan.** `#00CFEA` on a dark ground is a screen
colour, not an easy one. The film's teal is `#2e8296`, accent text on dark is
`#a9e4ea` (4.5:1 on `#17334a`) and accent text on light stays `#00728d`
(5.25:1 on `#faf9f2`) — the branch's own token, because that is the one value
that works on a light ground and the arithmetic for it is in CLAUDE.md.

**Every moving thing is a function of `t`**, drawn from `SEEK(t)` and never a
CSS animation, because `render.js` seeks the film frame by frame and a CSS
timeline cannot be seeked. Four layers:

- **A canvas per scene**, at half resolution because it is blurred anyway and
  nine full-frame canvases is memory the renderer should not spend. It carries
  three large radial blobs drifting on their own sine paths with
  `globalCompositeOperation = 'lighter'`, and a dot grid with a band of light
  travelling across it. Every path is seeded from the scene index, so two
  renders of the same frame are identical.
- **A blurred light band** that crosses the frame on every cut, over the push.
- **A real tilt in three dimensions** on the device frames: `perspective` on
  the stage, `rotateY`/`rotateX` easing out of the entrance and then breathing,
  so the screenshots turn toward the camera instead of sitting flat.
- The entrances, counters, bars, strikes and stamps that were already there.

Watch two traps. The canvas has to sit **inside** each scene, above that
scene's own background and below the words — one global canvas is covered by
the first scene's fill, and during a cut two scenes with different grounds
overlap. And `ctx.filter = 'blur(...)'` is the whole cost of the layer: at half
resolution it is cheap, at full resolution it is not.

## The voice and the music

**Andrew Expressive** (`en-US-AndrewMultilingualNeural` at `+0%`), the voice he
chose for the wall and the FY27 film, made on the `tts-run` GitHub Actions
runner, because Microsoft's speech service is refused by the session's network.
The three films are twenty-six clips (8 + 9 + 9), and every one was
transcribed with Whisper and checked **word by word**, not just for its
language — which took ten re-takes in all.

The one worth writing down from the first pass: *"So are mine"* came back as
*"So, or mine"* twice, on two different takes. **When a
re-word comes back with the same fault, stop re-wording around it and change the
shape of the line** — it became *"The managers' numbers are up there too"* and
read clean. Four more differences were judged to be transcription artifacts and
left alone (numerals written as digits, "you're", "guard rails", "judgment").

**The advisor film's fact-find line took four re-takes**, and it is the
clearest example in this repository of how this voice fails, so it is worth
having in one place:

| | written | what came back |
|---|---|---|
| 1 | "The fact **find does** the arithmetic…" | "the fact **fine** does" |
| 2 | "The arithmetic is already done **by the fact find.** …" | clean — but 9.2 s, which made a 10.3 s card |
| 3 | "…Your client **confirms, then a manager signs.**" | "confirms **been** a manager **science**" |
| 4 | "The numbers are done for you. … a manager **signs it off**." | clean, 5.7 s |

Both failures are the same one: **a word whose final consonant has to hand off
to the next word's opening consonant** — *find/does*, and *signs* with nothing
after it to carry the s. The fix is never a synonym. It is to give the
consonant somewhere to land ("signs **it off**") or to end the clause on the
word ("…by the fact **find.**"). And when the card already says the phrase,
**the voice does not have to repeat it** — dropping "fact find" from the
narration is what finally brought a ten-second card back to six and a half.

**It is cut to the music's own beat.** The track was measured rather than
guessed: **98.7 BPM, a beat every 0.608 s, bars of 2.432 s, first beat at
0.289 s.** `timing.py` reads the real length of each narration clip, adds its
air, rounds **up to a whole number of beats** and writes the result straight
into the film's config — so no scene change ever lands between beats, and no
duration is typed by hand. The voice is ducked under the bed with
`sidechaincompress`, and the whole track is normalised to −14 LUFS.

**⚠ The music licence is still not cleared for the administrator and advisor
films, and it is the one thing standing between those two and being posted.**
(The client manager film was moved to the branch's own `rr-branch-theme.mp3` on
8 November 2026 and is clear.) The track is the clip sent on 6 November
2026. **I do not know its licence.** Every other film in this repository uses
either the branch's own `rr-branch-theme.mp3` or Kevin MacLeod's "Inspired"
under CC BY with the credit attached, precisely because an MP4 at a public URL
is a redistribution. Before posting: confirm the track is licensed for this, or
say the word and the bed is swapped for the branch theme — it is one command
per film, `python3 mix.py <key> ../../rr-branch-theme.mp3`, and then a re-render
is not even needed: only the audio changes, so `mux.py` alone puts the new bed
on the nine cuts.

## What is on screen

**Every screen in them is a real branch screen**, taken from `wall/img/` —
screens already public on `/wall/`, each carrying sample data. The names and
figures on them are invented. **No client appears anywhere**, which is the
standing rule for an MP4 at a public URL, and no figure is invented: the
administrator film's counters (36 backend files, about 100,000 lines, the pages,
the test files) are counted from the repository on the day of the cut, with
`ls apps-script/*.gs | wc -l` and friends.

**For print there is `buildwithus/qr.svg`**, the same code as a vector, for a
poster or a classified. The other two have only the one burned into the film;
regenerate either the same way (`segno`, with the page address and nothing else
in it).

**Each QR is checked, not assumed.** They encode the three page addresses, and
each was decoded back out of the **finished, encoded video** — at full size and
again from a 405 px phone-sized preview — so they are known to scan.

**A QR is sized as a share of the frame's WIDTH, like the type, and the wide
cut needs its own number.** At the same unit size as the other two shapes it
came out 14% of a 1920-wide frame — 53 px once a feed plays it at ~405 px, and
it decoded as nothing. It stacks over its caption in the wide cut now, at about
a third of the width. The upright and feed cuts were never affected: the frame
is 1080 wide, so the same units are already a much larger share of it.

**The check samples five moments, not one, and that is what found the real
fault.** `/joinourbranch` is the longest of the three addresses, so its code
carries the most modules and is the first to fail — and at 405 px it decoded at
four timestamps in the closing scene and not at the fifth, in several shapes.
Making the code bigger did not fix that, because size was not the cause.

**The camera was.** Every scene pushes in slowly, `scale(1.015)` to
`scale(1.07)` across its length, which is what keeps a held frame alive. On a
QR it is poison: a continuously changing, non-integer scale resamples the
code's modules differently on every single frame, so one frame decodes and the
next does not once a feed has shrunk the picture. **The closing scene now holds
its camera at exactly 1**, and takes its motion from the moving ground, the
scan line and the words instead; the code arrives on an opacity fade rather
than the usual scale-up pop, and its width is rounded to whole pixels after the
fit pass (490 u of a 1.315 px unit is 644.35, and a fractional size resamples
every module edge). With nothing scaling it, every frame of that scene is
identical in the code's region: it decodes at all of them or none, which is
what makes the check meaningful rather than lucky.

Every shape must decode at all five timestamps, at both sizes, or the run
fails.

## Re-cutting one

Everything lives in the session scratchpad under `film/`:

| | |
|---|---|
| `engine.html` + `engine.js` | the engine. Every frame is a pure function of `t`, so a frame-by-frame render and a real-time play are identical and there is no capture drift to measure and undo. |
| `cfg-<key>.js` | one film: its scenes, their words and their durations. |
| `timing.py <key> <vox-dir>` | writes the durations from the real clip lengths, snapped to the beat. |
| `mix.py` | the soundtrack: voice, bed, ducking, loudness. |
| `render2.js <key> <v\|f\|w>` | renders frame by frame **straight into ffmpeg** — nine renders of 1,500 frames each is about 3 GB of JPEGs and this session's writable disk is a fixed allowance. |
| `mux.py` | puts the soundtrack on each cut, cuts the poster and drops all nine into the repository. |
| `peek2.js <key> <shape>` | one frame per scene, for checking a change without rendering fifteen hundred. |
| `fitprobe.js <key> <shape>` | what each scene had to shrink by, and the measured need against the frame. |
| `qrcheck.py` | decodes all nine QRs back out of the finished MP4s, full size and at 405 px. Needs `cv2`. |

**The shape and the film come from the URL, before the scenes are built.**
Reading a property the renderer sets after load silently gave the upright cut
the wide layout once already, and nothing complained.

To change a line: edit `cfg-<key>.js`, re-voice only the lines that changed
(push a `tts/job.json` to the `tts-run` branch under a key of its own and map
the clips back onto their real indices — the runner numbers a job's lines from
01), run `timing.py`, `mix.py`, `render2.js` three times and `mux.py`.

---

## The filter: what the application asks, and how it is weighed

Asked for on 8 November 2026, in these words: *"the kind of questions that you
have really placed that will filter towards getting that correct candidate and
weighing it properly, so I will ensure I got a correct fit, somebody who don't
study the hours, passionate about learning, and can also understand all of
these systems that we are building and what we're trying to achieve. Was that
done, and can I see it? And a follow-up in terms of unsuitable applicants will
not be acknowledged as well."*

**Two of his three criteria were not being tested at all.** Reading the form
against his own words found the gaps:

- **Learning appetite** was never asked. The form asked about papers, which is
  credentialing, not appetite: somebody can hold a Diploma from 2009 and have
  learned nothing since. `uw_learned` is the fix — *"What have you taught
  yourself in the last two years — in this work or outside it — and what did it
  change about how you work?"* It works on both doors, and "outside it" is
  deliberate: somebody who taught themselves a trade, a language or a piece of
  software is telling you how they learn.
- **Nothing tested whether they understood our system.** `uw_renewals` asked
  *"what would you change about how a general insurance agency handles
  renewals?"*, which can be answered without reading one word of the page. It
  now reads *"Further up this page there are seven stops a renewal goes through
  here. What would you change about it, and what would you leave exactly as it
  is?"* — pointed at `#tech`, which is on the same page. One question tests
  four things: did they read it, did they understand it, can they think about a
  process, and have they a view worth hearing. And *"what would you leave
  alone"* catches the person who changes things for the sake of it.

**Mindset cannot be asked for, only paid for.** There is no question that
separates the 8-to-4 candidate, because everybody writes that they are a
self-starter. What separates them is the **cost of applying**: fifteen minutes,
a live renewal file with nine faults in it, and six written answers. The person
who watches the clock does not finish the form. Do not add a "are you a
self-starter?" question; it would weaken the filter by giving that person an
easy way to claim it.

### The weighted score — `weigh()`, and it never reaches the candidate

Five dimensions out of 100, with the weights flipped by door:

| | door 1, has done this | door 2, has the head for it |
|---|---|---|
| Technical depth | 30 | 5 |
| The file | 25 | 25 |
| Judgement | 20 | 15 |
| Learning | 15 | 30 |
| The system | 10 | 25 |

**The flip is the point.** Scored on door 1's weights, door 2 always loses and
the second door is decoration.

Each dimension reads only what a machine can honestly see: ticks, how closely
the file was read, word counts against a 70-word mark, and a **specificity**
count — whether an answer names a figure, a date, a class, a party. Generic
enthusiasm names none of them.

It lands **first** in the e-mail and in the subject line, as
`scan_score`, so his phone sorts the row before he opens it:

```
Fit 65/100 · door 1 · depth 27/30 · file 18/25 · judge 5/20 · learn 9/15
· system 6/10 · a sorting aid, not a verdict: the four written answers are
  yours to read
```

**It carries its own caveat in every e-mail, and that line is not decoration.**
A machine can see length and specificity; it cannot see judgement. Without the
caveat a number at the top of the e-mail becomes the decision, and a strong
candidate who writes briefly is lost to it.

**The score and the bar line are never rendered on the page.** A candidate who
can read the scoring writes to it, and the questions stop separating anybody.
The same reason the renewal file never says which of its nine faults matter and
never shows a score: printing that turns a judgement into a quiz with the
answers at the bottom.

### Unsuitable applicants are told before they start

He asked for it, and it goes **above** the form rather than being left as
silence afterwards (`.straight`):

> Mr Rampersad reads every application himself and replies within two working
> days to everyone he wants to speak to. **If you have not heard from him in
> that time, it has been read and it has not gone forward, and there will be no
> further letter.** We would rather tell you that now than leave you watching
> an inbox.

The same sentence is in `QUOTE.FORMS.underwriter.client` in `Quotes.gs`, so the
confirmation e-mail says it too and nobody can say they were not told. Warning
somebody is kinder than leaving them refreshing an inbox for a fortnight, and it
protects the branch's name with every person he does not hire — which is most of
them, and some of whom are clients.

**The brief for him is a private Artifact, not a page in this repository**, for
the reason above: the weighting must not be public, and the repository root is
served. Nothing about the scoring goes in a served page, a film or an ad.

---

## The hiring board — `/hiring`, 8 November 2026

Asked for as *"anything further we can enhance for the ultimate
experience"*. The honest answer was that the filter had become better than
the thing receiving it: every application lands on the `Quote Requests` tab
beside a client's property quote and an OAS enrolment, in the order it
arrived, and is read in Gmail. Three seats, a weighted score nothing can
sort on, no way to compare two people, no record of who was called, and
nothing at all measuring the two working days the three pages promise in
writing.

`q.board` and `q.hire` in `Quotes.gs` read that tab and show the recruiting
rows alone. **Service.gs already routes anything starting `q.` to
`Quotes.gs`**, so the board carries no Service.gs change of its own: it goes
live with the paste he already owed for the confirmation wording.

**It opens for the Branch Manager signed in as himself and nobody else.**
Not the ABM, not staff, and **not the branch code**, which is the wall's
code and is handed around the branch. That is the promise the three pages
make — *"Nobody else in the branch sees it, and nothing reaches your current
employer"* — and a man applying for the client manager's seat is employed
somewhere today. The test is `tAs_`'s own shape: `user` (a real person, not
the bare code), not `viaBranch` (not the code with a name typed after it),
and `canTell`, which `tAs_` sets for `bm` alone. Signing in through the
branch app satisfies it. Do not widen it without changing the pages first.

**What it shows:** the promise clock across the top (applications, still
open, due today, past the two days) and it opens on whichever seat has
somebody past it; then a card each, strongest first — the weighted score
drawn as a ring with its five parts as bars, the bar line, what they did
with the renewal file *in their order*, every written answer in full, the
CV, and their number as a tap. One press invites them to a conversation, in
his name from support@, with a line of his own if he wants one.

Three things it deliberately does not do:

- **"Not this time" sends nothing.** The page promised silence inside two
  working days and *"no further letter"*. A rejection e-mail would
  contradict the branch's own written word to somebody who has already
  understood it.
- **It never recomputes the score.** The page that took the application is
  the only place it is worked out, so the board and the e-mail can never
  disagree about the same person.
- **It keeps nothing about a candidate on the device.** Only the sign-in is
  in `localStorage`.

Two things found while building it, both now fixed in `Quotes.gs`:

- **Every answer was cut at 600 characters**, in the cell and in the e-mail
  both, while `weigh()` scored the whole thing. So the score could say
  "long and specific" above an answer that stopped mid-sentence. A new
  `Full` column keeps every answer exactly as typed; `Answers` stays as it
  was, because that is what a person skims and what the e-mail prints. Rows
  filed before it have no `Full`, and the card **says their answers are
  clipped** rather than passing them off as whole.
- **The advisor seat is not on this tab at all.** `/joinourbranch/` sends
  applications to Guardian's own TalentNest posting; only the "Talk first"
  booking reaches us. The board says so, because an empty column reads as
  "nobody applied".

`tests/test-hiring.js` covers it: 119 checks, the backend in Node against a
Sheets made of nothing with every role tried against the gate, then the page
in a browser on a laptop and a phone.

---

## Ten lines, not seven — and the Act's seven are a different seven, 8 November 2026

Asked for in these words: *"review all the types of insurance. It's do not
limit 7 lines. There's cyber risk, there's marine, there's, all the different
lines of insurance that we really write, because what we do is try to ensure
that all our corporate clients have the correct policies to them. So do deep
dive and see the types of policies persons are allowed to write in Trinidad and
Tobago."*

He was right, and the page was wrong in two directions at once.

**The book is wider than the page said, and in force it is narrower.** Two
questions, two different answers, and conflating them is how this nearly shipped
wrong.

*What has been written here* comes from the `TRANSACTIONS__c` record types — the
billing records — and on 8 November 2026 the branch's general insurance taxonomy
is **nine**: Motor, Property, Workmen's Compensation & Employers' Liability,
Public Liability, Machinery, Bond, Marine, **Money** and **Burglary**. The page
carried neither of the last two. With household and commercial property counted
apart, as the branch talks about them, that is **ten lines written here**.

*What is in force* comes from `Risk_Details__c` — the cover terms the renewal
desk actually reads — and it is **seven**. Checked by the latest `To__c` per
record type: Motor to Nov 2027, Property to Nov 2027, Machinery to Nov 2027,
Public Liability to Oct 2027, Workers Compensation to Jul 2027, Bond to Feb
2027 — and **Marine to August 2022**. Money and Burglary have *no cover terms at
all*: billing records only, newest 2023 and 2017, every one of them on an
account owned by branch staff, so they are genuinely ours and genuinely dormant.

**So the page says seven in force and ten written, and never conflates them.**
The first draft of this change said "ten lines ... with renewals falling in every
month", which reads as ten renewing and is not true of three of them. A general
insurance person is exactly the reader who would check that. The hero ring keeps
ten chips, because it is a diagram of what the book has been written across, and
its label and the hero's own foot say which is which.

**Marine was described as empty and is not quite.** The page said marine *"sits
in the system with nothing written on them yet"*. It has been written twice,
with nothing in force since 2022. That is better than a zero because it is
checkable, and it is still room.

The machinery line now names contract works (CAR and EAR) explicitly, which its
own plan-code prefixes in `GIR_LINES` have always included.

**The Act's count is seven, and they are not those seven.** Schedule 1, Type A
of the **Insurance Act, 2018** prescribes exactly seven classes of general
insurance business: Liability; Marine, Aviation and Transport; Motor Vehicle;
Pecuniary Loss; Personal Accident Short-Term; Property; and Workers
Compensation. Read from the Central Bank's own published PDF of the Act, not
from memory. The payoff — and the reason the page now carries a section of its
own for it — is that the two taxonomies do not line up:

- **Property is far wider than a product list suggests.** Household, commercial
  property and fire, machinery and plant, contract works, money and burglary are
  all *one class* under the Act, and business interruption is expressly inside it.
- **Bonds are Pecuniary Loss**, not property and not liability. Credit and trade
  are in the same class, and the branch writes none of them.
- **Cargo and goods in transit are Marine**, not Property — the class covers
  transit *"by sea, inland water, land or air"*.
- **Business interruption is expressly excluded from Pecuniary Loss**, which is
  the trap in the schedule most likely to be got wrong.
- **Cyber has no class of its own**: it is liability and pecuniary loss, with a
  property and business-interruption component depending on the wording. Three
  classes and a judgement, which is exactly why it gets missed.

Two provisions of the schedule went on the page because they are judgement calls
the seat would actually make: **incidental business** (a policy spanning classes
may be classified by its predominant risk — the Act's own example is a home
policy carrying legal liability, still property), and **market practice** (an
insurer may classify by normal market practice as well as by the definitions, the
Act naming major petroleum risks and some construction projects as business
conventionally treated as marine, provided it is done consistently).

And one compliance fact that belongs in a recruiting ad for this seat: **a sales
representative cannot be registered for a class the insurer, agency or brokerage
behind them is not itself registered to write.** Registration is per class and
per type. The section says so without a section number, which is this
repository's standing rule — compliance supplies numbers if they are ever wanted.

**What is deliberately NOT claimed.** Guardian General launched a **CyberGuard**
product in 2021; what is confirmed in public sources is availability in
**Barbados**, and the Trinidad product page that search still indexes
(`…/business-solutions/cyberguard-insurance`) now returns 404. So the page says
cyber is an exposure every commercial client carries and that **this book has
none written on it** — a fact about our own record — and says nothing about what
Guardian General will place in Trinidad today. **If the branch does place cyber
now, that is one line on the page to change, and it should be changed.**

No policy counts are on the page. The statuses on the classes section describe
our own book as the record stood on 8 November 2026; the counts behind them stay
off a public page for the same reason the month-by-month shape of the book does.

**The film's scene 3 was re-voiced** for it — one line, `cmadmin` scene 3, from
*"seven lines"* to *"ten lines"*.

### Three things it cost, worth not paying twice

- **Ten labels do not fit a ring drawn for seven, and the cause was a unit
  mismatch.** Every dimension on that stage is `cqw` — the radii, the chip, the
  mark — except the label, which was a fixed `7rem`. The stage is at its
  *narrowest* at 1024px, not on a phone, because that is where the hero's
  `1.3fr/.7fr` split kicks in and the art column drops to 325px; a 112px label
  around a 70px inner radius then overlapped its neighbour and landed on the
  shield. The label is `min(7rem, 28cqw)` now, the four upper-half nodes carry
  their label above the chip rather than below it, and the 3 and 9 o'clock nodes
  are anchored inward because a centred label there ran past the stage's own
  edge. Measured at eleven widths in both motion settings by `lines.js` in the
  session scratchpad (139 checks: chips present, nothing hidden, nothing outside
  the stage, no two labels touching, no label on the mark, plus CLS, sideways
  scroll and the new section's contrast).
- **`shoot-ad.js` writes to its own `out/` unless a destination is given**, and
  it prints a cheerful `ok feed 1080x1350 · 554 KB` either way. The posters read
  "Seven lines" for a full build cycle because of it. It is
  `node shoot-ad.js clientmanager ../../clientmanager`, and the thing to check
  is the published JPEG's own timestamp, not the tool's output.
- **`importvox.py` and `build-boardfilm.py` disagree about the timing file.**
  The first writes per-line word times in *seconds* under `lines`; the second
  reads a top-level `words` of `[ms, word]` and dies with `KeyError: 'words'`.
  The conversion is one line and it is needed after every re-voice:
  `d['words'] = [[[int(round(t*1000)), w] for t, w in ln['words']] for ln in d['lines']]`.

## Describe the work, never the workplace — 9 November 2026

Asked for in these words: *"Ok so should we bash an old system, I need to
study my PR and you need to guide me as I should not be bashing!!"*

He was right, and it was the sharper of the two risks on that page. The ad had
drifted from describing a job into reviewing other people's.

**The rule, and it governs every recruiting page from here:**

> **Describe the work, never the workplace. Claim only what is ours.**

Three tests for any line:

1. **Does it name, or point at, somebody else?** A named third-party product is
   a factual claim about a company we would have to stand behind. *"Everywhere
   else"* is a claim about an entire market we cannot evidence — and it is not
   even true; some agencies here are well run and well systemised.
2. **Could the reader's own employer recognise themselves being insulted?**
   Then reframe it as the reader's week. *"Everywhere else it is a PC in the
   corner"* is a verdict on them. *"The system is on one PC, and the
   spreadsheet beside it holds everything the system will not do"* is a
   description of his Tuesday, which he owns and will nod at. Same facts, and
   the second one actually recruits.
3. **Does it make the reader feel stupid for the years he has already given?**
   *"Neither has changed since you arrived"* tells a man with fifteen good
   years that he wasted them. Nobody applies to the company that just
   insulted their CV.

**Why it matters more here than it would for most advertisers:**

- **It is a regulated entity's advertising.** The page carries Guardian's
  branch name, and the CBTT Market Conduct Guideline governs how a registrant
  presents itself. Disparaging a named third-party product in that context is
  the kind of thing Compliance stops — and Compliance had not yet seen this
  wording when it went live.
- **It is a small market.** The agencies running those systems refer business
  to this branch, sit on the same TTAIFA panels, and some of them are
  Guardian's own. A screenshot of a branch mocking their software travels
  further than the advertisement does.
- **The branch already had the right principle written down** and broke it.
  The transition letters state Guardian Life's notice and nothing else —
  *nothing characterises anyone, the facts answer them.* That is the same rule.

**What came off, and none of it was doing any work:**

| was | is |
|---|---|
| three competitor products named in the ledger's first row | the row describes the desk, and names nobody |
| column headers *Everywhere else* / *Here* | *Your week now* / *Your week here* |
| *"Neither has changed since you arrived"* | cut |
| *"Everywhere else a client is a transaction"* | *"A client here is not a transaction"* |
| the film's scene 2 eyebrow, *The old way* | *If this is your week* |
| the film's spoken *"A system that runs on a PC in the corner"* | *"The system on one PC"* — three words, and the sneer was all of it |

The positive claims were never the problem and all of them stayed: we write our
own software, it changes every week, every term opens on one screen, Guardian's
own PDFs fill themselves, the client reads their own history. Those are ours,
they are checkable, and they are what actually sells the seat. The comparison
was doing nothing the facts were not already doing.

**The product names were also in an HTML comment**, quoting his own words, in a
file the site serves — so view-source published them just as surely as the page
did. They are elided there too. This is the same lesson the registration plates
taught in `CLAUDE.md`: *redact the value from the note that records the
redaction, and grep every served directory, not only the page you were looking
at.* `RECRUITING-SETUP.md` is served from the repository root as well, which is
why no product is named anywhere above.

**Two lines were left in deliberately, and he should know they are judgement
calls rather than oversights:**

- **The hero's own hook** — *"and nobody has ever let you change any of it"*.
  It characterises an employer as not listening. It is also the truest line on
  the page for this audience and the single strongest reason the right person
  applies. It names nobody and it describes what was done *to the reader*. Kept.
- **The film's scene 9** — *"a change you ask for is not a ticket that goes
  somewhere else to wait"*. That is about a process, not about people. Kept.

If either is to go, both are cheap: the first is one line of HTML, the second
is one line to re-voice.

## Describing the misery IS the bashing — 9 November 2026, the same day

The pass above took the product names and the *Everywhere else* headers off,
and left the structure standing. He came straight back:

> *"why are you saying still lives in a cabinet, I asked for creativity and
> not bash"*

He was right, and the correction is the more useful of the two.

**A ledger whose left column is the reader's own miserable week is a verdict
on his employer however politely the column is headed.** Renaming the header
to *Your week now* changed who the sentence pointed at and not what it said:
seven rows of drawer, duplicate file, retyping and an inbox he never reaches
the bottom of. Taking the nouns out of a bashing ad leaves a bashing ad.

Three things were wrong with it, and only the first is about tone:

- **It still insults the employer**, by description rather than by name.
- **It insults the reader.** He has given those years to that desk. A page
  that opens by telling him his working life is primitive is asking him to
  agree that he has wasted it, and nobody applies to the company that just
  said so.
- **It is not creative, which is what he actually asked for.**
  Misery-then-rescue is the oldest shape an advertisement has. It also loses
  to the one true thing this ad already owned — *the book is already there,
  and it has never had one person.*

**So the misery came out whole, not reworded.** What was left was the half
that had been doing the work all along:

| | was | is |
|---|---|---|
| section | `#old`, *If this is your Tuesday* | `#desk`, *Before you sit down* |
| headline | "The filing cabinet, the re-keying, the chasing. None of that is the job here." | "Seven things this desk has already done by the time you open the file." |
| body | seven ✕/✓ rows, their week against ours | the same seven capabilities, numbered 01–07, in our own voice |
| hero hook | "If you can run a general insurance book out of a filing cabinet and an inbox that never empties — and nobody has ever let you change any of it" | "If you know general insurance well enough to look at a book this size, across ten lines, and see exactly what it has been missing" |
| poster chip | "Seven lines in force, ten written, no filing cabinet" | "Ten lines written here, seven in force today" |

**The headline rule that falls out of it: say what the job IS, never what it
is not.** "None of that is the job here" needs the reader to picture the bad
thing first. "Seven things this desk has already done" needs nothing.
`cmcheck.js` now fails a headline containing *not*, *none of* or *cabinet*.

**Watch for the negation in our own copy too.** Four post cuts opened
"No filing cabinet, no re-keying, no spreadsheet holding what the system
will not do" — describing our own desk by what it lacks, which plants the
cabinet in the reader's head just as firmly and is weaker besides. They
state what the desk does.

### The film lost a scene, and that made it better

Scene 2 was the ledger in motion: a PC, a spreadsheet, a retyped proposal
form, an endorsement on day three, last year's file in a drawer with a red
flag on it. With the misery gone it had no content left, so it was **cut
whole** rather than rewritten, and scene 1 was reframed from *"knows general
insurance inside out, and still runs the book out of a filing cabinet"* to
*"knows general insurance inside out — who can read a schedule and see
exactly what is missing."* The film opens on the reader's expertise and goes
straight to the book. Ten scenes became nine, 2:01 became 1:50, and nothing
of value was lost.

**The closing line was carrying a grievance nobody had noticed**: *"if you
are good at this and you have stopped learning, come and look after the
book."* It is a dig at his employer, and read aloud it is ambiguous enough
to land as a dig at him. It is now *"if you are good at this, there is a
book here big enough for it."*

**Cutting a scene means rebuilding every cue list, and they are in different
units.** `durs` and `dur` are the obvious ones; `risers` are absolute scene
*starts*, `hits` are absolute *seconds* inside a scene, `dark` is a 0-based
*index* into the scene-start array, and `score` is one value per scene. All
four move when a scene is removed, none of them complains, and a stale
`hits` lands a punch in the wrong place with nothing on screen. Derive them
from the new scene starts rather than nudging the old numbers:

```
old starts [0, 8.7, 22.5, 35.7, 45.7, 56.8, 72.7, 90.1, 102.5, 111.2]
new starts [0, 10.5, 23.7, 33.7, 44.8, 60.7, 78.1, 90.5, 99.2]
hits  27.21/31.7  (4.71s and 9.2s into the book scene)  ->  15.21/19.7
risers 56.8/111.2 (starts of scenes 6 and 10)           ->  44.8/99.2
dark  [9]         (index of the closing scene)          ->  [8]
score 10 values   (drop the cut scene's)                ->  9
```

**Build the staging vox directory from scratch, never by shifting.** Walk
the new scene list and copy each unchanged clip from its old index: new 1 is
the re-voice, new 2–8 are old 3–9, new 9 is the re-voice. `importvox.py`
then returned 13.2, 10.0, 11.1, 15.9, 17.4, 12.4, 8.7 for the untouched
scenes — identical to their old durations, which is how the mapping was
checked.

**"a book" came back as "to book".** The closing line's first take was
*"you want a book big enough to put it into"* and Whisper heard *"you want
to book big enough"* — this voice swallows an unstressed article after a
verb, the same fault as *into* after *know* on the rise film. Re-worded off
the shape, not around it: *"there is a book here big enough for it."*

**A test pinned to the old markup throws instead of failing.** `cmcheck.js`
asserted *"every row has both columns"* and *"the headline names the
cabinet"*, so it died on a missing element rather than reporting a clean
failure — the second time in one day a test of mine made a deliberate fix
look like a regression. It now guards the rule: seven numbered rows, **no
`.o` column anywhere in the section**, no verdict on anyone in the section's
text, and a headline that does not define the job by what it is not.

## The film is the hero now, 9 November 2026

Asked for in these words: *"fix the career page ti have the film on top! A
person should nit scroll, what do you think and I want to see the video!"*

He was right, and it was true of all four recruiting pages: the film sat
**44% to 61% down** the page on `/clientmanager/`, `/buildwithus/`,
`/joinourbranch/` and `/careers/`. The strongest asset on the page was below
two screenfuls of copy.

**What I think, since he asked.** The film goes high, but the headline has to
survive it — a video is what convinces, a headline is what stops the scroll,
and giving up the second to get the first is a bad trade. So the hero is now
three blocks instead of two:

| | |
|---|---|
| `.hero-lead` | the vacancy pill, the eyebrow, the headline |
| `.hero-film` | the player, and one line on what it is |
| `.hero-rest` | the qualifying line, the long copy, the buttons, the trust row |

On a phone they fall in that order, so the film is on screen under the
headline before any scrolling. On a laptop `.hero-film` takes the right column
and spans both rows beside them. **Measured at eight real device sizes** —
360×640 through 1920×1080 — and the whole player is above the fold at every
one of them, with the headline fully visible at every one too (`fold.js` in
the session scratchpad).

**Two measurements changed the design.** `align-self:center` on the film put
it at y=673 on a 1366×768 laptop, less than half of it above the fold, because
it was centring against a tall left column: it is `align-self:start`. And the
qualifying line (`.pull`) sitting above the film pushed it to y=563 on a
375×667 phone, 54% visible: it moved below the film, so the order reads
headline, film, then who it is for. That lifted it to y=425 and 100%.

**The ring did not die, it moved — and it reads better where it is.** It was
the hero's right column; it now has its own dark band, `#drawn`, where the
`#film` section used to be. It could not simply drop into `#lines`, which is
`.alt` and light: the ring is drawn for a dark ground — navy chips, cyan
icons, light labels — so on `--bg2` it would have been close to invisible.
In its own band it is wider than it ever was in the hero, and all ten labels
are legible at a glance.

**Three things moved with it, and each would have broken silently:**

- **The pause rules were scoped `.hero.rest`.** `.rest` is put on whichever
  section has left the screen, and there are two of them now — the hero still
  owns its colour field, `#drawn` owns the ring — so the selector is `.rest X`.
  The polarity is unchanged and must stay: the loops park by a class added on
  **exit**, never removed on entry, or every backwards-filled entrance freezes
  at its invisible first frame when the script does not run.
- **The tilt listened on `#hero`.** It listens on `stage.closest('section')`
  now, so it follows the ring wherever it lives.
- **The IntersectionObserver watched `#hero` alone.** It watches the stage's
  host *and* the hero, de-duplicated, so a page where they are still the same
  element gets one observer rather than two.

**The second player is gone.** The `#film` section carried the same MP4
halfway down the page; one page, one player. Nothing linked to `#film`, so no
anchor broke — checked before removing it.

**Not yet mirrored** to `/buildwithus/`, `/joinourbranch/` or `/careers/`.
They have the same defect and the same hero pattern; `/careers/` is generated,
so that one is an edit to `agentmgt/index.html` plus `tools/careers/sync.py`.

### The layout-shift defect, found 8 November and fixed by the 9 November hero

**Found.** Measured on a free machine with every shift attributed to the
element that moved: **CLS 0.17 at 375px and 0.73 at 768px**, against a 0.1
budget, all of it before any scroll. Identical numbers on the 7 November
commit, so it was not from the ten-lines work — it had been live all along.
It was never caught because the harness measured CLS at **390 and 1366 only**,
and both of those happened to pass.

**What it was not.** Not the webfonts: blocking `fonts.g*` entirely gave the
same numbers to four decimal places, and `display=optional` changed nothing,
which retired the font-swap theory I had been working from. Not the reveal
animations: every shift landed before any scroll. A line-count scan does show
`.hsub` wrapping differently between the two faces at 414 and 768 — real, and
not what drove the score.

**What it was.** The hero's text column lost about 28px between ~400ms and
~870ms and got it back, so everything below reflowed twice — and `.field`, the
decorative gradient, is `position:absolute` with `height:130%`, so it was
2,239px tall at 768 and resized with the hero. The layout-shift API counts an
absolutely positioned element whose rect changes, so most of the 0.73 was a
soft gradient nobody perceives moving.

**Fixed, as a side effect of putting the film on top.** Splitting the hero into
three grid blocks — so the long copy sits in its own row rather than above
everything — and moving the ring out of the hero removed the reflow entirely.
Measured across nine widths after:

| | before | after |
|---|---|---|
| 360 | — | 0.0043 |
| 375 | **0.1746** | **0.0037** |
| 390 | 0.0383 | 0.0122 |
| 414 | 0.0316 | 0.0299 |
| 768 | **0.7306** | **0.0266** |
| 1024 | — | 0.0067 |
| 1280 | — | 0.0050 |
| 1366 | 0.0176 | 0.0177 |
| 1920 | — | 0.0017 |

**Two things to keep.** Measure CLS at **375 and 768** as well as 390 and 1366
— those two widths are where this hid, and `cls2.js` in the session scratchpad
measures with attribution rather than returning a bare number. And remember
that `.field` at `height:130%` of a box that can change height is a score
amplifier on every page that copies this hero: `/buildwithus/`,
`/joinourbranch/` and `/careers/` all still have the two-block hero and have
not been measured.


## Still to do

- **Clear the music licence for `bwadmin` and `jbadvisor`**, or swap their beds
  for the branch theme. `cmadmin` is already on `rr-branch-theme.mp3` and needs
  nothing. See the soundtrack section — for the other two it is one command each
  and no re-render, since only the audio changes.
- **Set `QUOTE_CV_FOLDER`** before the client manager ad runs, or CVs are
  reported as not stored (the applications still arrive in full).
- **Compliance sight of the wording**, in particular the client manager ad,
  which advertises the branch's own general insurance agency.
- **Confirm whether Guardian General places cyber in Trinidad today.** The page
  names cyber as an exposure with nothing written on this book, and claims
  nothing about the product shelf, because the only confirmable public source
  puts **CyberGuard** in Barbados and the Trinidad product page now 404s. If it
  is placeable here, say so and it becomes one line on
  `clientmanager/index.html` — in the room list under the book — and one line in
  the long post. Same question for aviation, which sits inside the Marine class
  and is on neither the book nor the page.
- **Paste `Quotes.gs` and publish a New version**, or the client manager's own
  confirmation is still headed *"Underwriter, general insurance"* — the one a
  stranger reads — and the team e-mail carries no bar line in its subject.
- **Decide what fully flexible hours means for the register.** The ad now
  promises them; `SCHEDULE` in `KPI.gs` gives every desk fixed hours, marks it
  absent five minutes after its start and moves its work at thirty. Either this
  seat is exempt there or the promise stops being true in week one. Nothing was
  changed in `KPI.gs` for it, deliberately: it is an operating decision, not a
  build.
- **Set a pay band, or keep saying negotiable.** The ad says *negotiable on
  experience* because no band exists. That is honest and it works; a band would
  work better, and it is his to set.

Everything else is in place. Each of the six pages carries its own share card —
its film's wide poster — so a link pasted into WhatsApp previews with the
film's own opening frame rather than the homepage's generic one.

## What the 7 November reframe superseded

The seat was built that morning as **the underwriter's**, and rebuilt the same
afternoon as the client manager's after he read it back (see section 3). What
is still true from the first build, and worth keeping:

- **The file exercise survived the reframe untouched**, which is the test of
  whether it was ever an underwriter's question. It is not: *here is a renewal
  file, what would you act on before you quote it* is what a client manager
  does every day, and the nine findings are still ones `girInsights_` genuinely
  computes. The order is the answer; the page never prints a score and never
  says which ones matter, and `cmtest.js` fails the build if a verdict ever
  appears.
- **The twelve administrator scenes became data-driven** so the second and
  third films reuse them rather than forking; proved by rebuilding `bwadmin`
  byte for byte. The flag offsets and `"ticks": false` are recorded in
  `tools/film/CANVA-AND-THE-EIGHT-CUTS.md`.
- **The sticky bar ate every anchor.** `--bar` is 4rem and the topbar is
  sticky, so `#file`, `#apply` and every other anchored heading parked
  underneath it when tapped. None of the three recruiting pages had
  `scroll-margin-top`; all three do now. Same fault as the claims page, and
  invisible until somebody taps a link.

### Two things only Mr Rampersad can settle

- **Study support.** If the branch will fund CII papers, that is the single
  strongest line that could go on this page for a part-qualified candidate,
  and it is not on it, because nothing in the record says it is true. It
  matters more now than it did, because the bar is both kinds of experience
  *and* papers.
- **The music licence.** The bed is his own recording, from a free site he has
  not yet named. Until it is written down the track is not committed — the
  repository root is published, so committing it redistributes it.
