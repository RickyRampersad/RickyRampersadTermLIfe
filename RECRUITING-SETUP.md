# Three seats, three ads — `/buildwithus/`, `/joinourbranch/`, `/underwriter/`

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

| | administrator | advisor | underwriter |
|---|---|---|---|
| The page | `/buildwithus/` | `/joinourbranch/` | `/underwriter/` |
| The film's page to post | `/buildwithusvideo/` | `/joinourbranchvideo/` | `/underwritervideo/` |
| The films | `buildwithus/film-w.mp4` | `joinourbranch/film-{v,f,w}.mp4` | `underwriter/film-w.mp4` |
| Length | 86.3 s | 45.60 s | 87.5 s |
| Where it applies | this branch, `Quotes.gs` | **TalentNest** | this branch, `Quotes.gs` |
| Form key / reference | `admin` → **`QB-`** | — | `underwriter` → **`QU-`** |
| CV upload | no | no | **yes**, to Drive |
| Who reads it | the Branch Manager | the Branch Manager and the Unit Manager | the Branch Manager |

**The administrator's and the underwriter's films were re-cut on 7 November
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
   that will hold the underwriter CVs. Make the folder somewhere **the Branch
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

# 3 · The underwriter — `/underwriter/`

Asked for as *"an experienced underwriter … we are launching our general
insurance agency … stuck where you don't have any growth, come to us, use the
tools, be creative … let's filter out areas for data upload the resumes, filter
down so we can spot a good candidate."*

## What is different about this one

**The hook is the paperwork, because that is what an experienced underwriter
actually resents.** The whole argument of the page is one sentence: *your
judgement on the risk, not on the paperwork* — and the branch can say it
because the paperwork genuinely is already built, and the page names each
piece. The quote fills itself from the record. Guardian's own proposal form and
the customer due-diligence checklist are filled by the system, field by field.
The renewal desk reads every term since the policy began before anyone opens
it. A claim is checked against the cover that was in force on the day of the
loss, not against this year's.

Everything in that list is in `CLAUDE.md` and running. **Nothing on that page
was invented to make the ad better**, which matters more here than anywhere:
this reader will check.

**It takes a CV**, which the other two do not. He asked for it in those words.
PDF, DOC or DOCX, up to 6 MB, straight into a Drive folder, with the link on
the row and in the Branch Manager's e-mail. A CV that cannot be stored never
loses the application: the row says why and the answers are all there.

## The filter

Five sections, and the ones that do the work are the last two.

1. **You** — name, phone, e-mail, where they are.
2. **Your underwriting** — years; **twelve classes to tick** (motor, property,
   liability, marine, engineering, bonds, group health, group life, travel,
   personal accident, commercial package, agriculture); their **authority
   limit**, as a band; the systems they have worked in; their qualifications
   (CII, ACII, local, none).
3. **Where you are** — current employer and role, what they earn and what they
   want as monthly TT$ bands with "prefer not to say" and "open" on each, and
   when they could start. The bands are $8,000–30,000, set for an experienced
   underwriter rather than an administrator, in `underwriter/index.html`.
4. **Three judgement questions.** These are the filter:
   - *A risk you declined that you would decline again, and one you accepted
     that you would not accept now.* The second half is the whole question. An
     underwriter who cannot name a decision they got wrong has either not
     carried a book or will not tell you the truth.
   - *Something about how a risk was written, rated or documented where you
     worked that you thought was wrong — and what you did about it.* This is the
     "stuck where there is no growth" question, asked without the self-pity.
   - *What you want to be doing in two years that you cannot do where you are.*
5. **Your CV and last things** — the upload, where they saw the ad, and the best
   time to call.

**Read in this order:** the classes ticked against the authority band (an
authority far above the classes is a flag either way); then the second
judgement question, which is the only one that cannot be prepared; then the CV,
last, and only to check the dates against what they said.

## The ad

### 1 · LinkedIn (this is where this person is)

> **Your judgement on the risk. Not on the paperwork.**
>
> We are opening a general insurance agency in Chaguanas and we need one experienced underwriter.
>
> Before you read any further, here is what you would actually be walking into. The quote fills itself from the client's own record. Guardian's proposal form and the customer due-diligence checklist are filled by the system, field by field, and attached. The renewal desk reads every term since the policy began — not just this year's — before anyone opens the file. A claim arrives already checked against the cover that was in force on the day of the loss.
>
> None of that is a plan. It is built and it is running, and you can see it before you apply.
>
> So the part of the day that is yours is the part only you can do: whether we write it, on what terms, and at what price.
>
> If you are somewhere with no room to move — where the work is the same every year and nobody is building anything — that is exactly who this is for.
>
> Send your CV and about fifteen minutes of honest answers: **rickyrampersadbranch.com/underwriter**
>
> Read by me personally. If you are employed today, nobody there will hear of it.
>
> — Ricky Rampersad, Branch Manager

### 2 · WhatsApp and one-to-one

> *We need one experienced underwriter.*
>
> We are opening a general insurance agency, and the paperwork side of it is already built — the quote, the proposal form and the customer checks fill themselves from the record, and a claim is already matched to the cover that was in force on the day of the loss.
>
> So the job is the judgement, not the typing.
>
> rickyrampersadbranch.com/underwriter — your CV and fifteen minutes. If you are somewhere with no room to grow, this is the one to look at.

### 3 · Job board or classified

> **UNDERWRITER — GENERAL INSURANCE** · Ricky Rampersad Branch, Guardian Life of
> the Caribbean · Chaguanas, Central Trinidad.
>
> An experienced underwriter for a new general insurance agency. Motor,
> property, liability and commercial classes. You will carry real authority and
> work in a branch where the quote, the proposal form and the customer
> due-diligence checks are already automated, so the work is the risk
> assessment and the pricing.
>
> We are looking for somebody who has carried a book and can explain a decision
> they got wrong. Professional qualifications welcome; a track record matters
> more.
>
> CV and application at **rickyrampersadbranch.com/underwriter**. Read by the
> Branch Manager personally and treated confidentially.

### Notes on the wording

- **Never say the agency is open.** It is being opened. Every cut says "we are
  opening".
- **Do not print the authority limit the seat will carry.** The form asks
  theirs; ours is agreed on the call.
- **Do not name the systems by brand in a public ad** beyond what the page
  already shows. The page's screens are the branch's own with sample data.
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

**⚠ The music licence is still not cleared, and this is the one thing standing
between the films and being posted.** The track is the clip sent on 6 November
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

## Still to do

- **Clear the music licence**, or swap the bed for the branch theme. See above —
  this is the one thing standing between the films and being posted.
- **Set `QUOTE_CV_FOLDER`** before the underwriter ad runs, or CVs are reported
  as not stored (the applications still arrive in full).
- **Compliance sight of the wording**, in particular the underwriter ad, which
  names a general insurance agency that is not yet open.

Everything else is in place. Each of the six pages carries its own share card —
its film's wide poster — so a link pasted into WhatsApp previews with the
film's own opening frame rather than the homepage's generic one.

## The underwriter's seat — `/underwriter/`, rebuilt 7 November 2026

Asked for as a deep dive: *"We're looking to hire somebody for the underwriting
for the general insurance agency… the person must be qualified… they must have
experience with insurance and have a qualification… but stuck where they
currently are, they need to grow… let it spark what an underwriter and the
tools that they'll be looking for and look to develop that we have."*

**This is the one seat on the site where the bar is a qualification**, and the
page says so in as many words. The administrator's page deliberately says *"you
do not need to be a developer"*; this one says the opposite about insurance
papers, because the person in the seat is the technical voice in front of an
insurer, a broker and a client. The qualification is asked as a status
(`uw_qstatus`: fully qualified, Diploma, Certificate, part-qualified, studying,
none) **and** as "which one, and what is left" — a Diploma with M93
outstanding is a different candidate from a Diploma finished, and only the
second question separates them.

**The spark is the tools, named.** An underwriter stuck re-keying will not be
moved by adjectives. So the page names what is actually running: the renewal
desk reading every term since inception with its claims and payment history,
Guardian General's own notice read on the device and checked figure by figure
against Salesforce, Guardian's own PDFs filled exactly (the private motor
proposal, Know Your Policy, the Motor Quotation Request, the company CDD
checklist, EB0010, GIO001), the claim matched to the term the loss fell in,
group health arriving with its claims experience and loss ratio by plan year,
and the duplicate-term merge that only ever merges on a real identity.

**The growth is the part most underwriters never get, and it is a section of
its own.** Because the branch writes its own software, an underwriting rule is
not a ticket in a queue at head office: it is a decision, written into the desk,
running that week. The page offers the five an underwriter actually wants — own
referral rules, an underinsurance flag that fires on the trend, a rating sanity
check, an appetite list the agents can see, and the evidence that the judgement
was right. It also states the division of labour plainly: **you are not expected
to write code and nobody will ask you to.**

### The file is the interview, and it is on the page

The administrator's page asks the candidate to find the faults in a broken form.
The underwriter's asks the thing an underwriter actually does: **here is a
renewal file, what would you act on before you quote it?** Nine findings, every
one of them something `girInsights_` genuinely computes — sums unchanged since
2019, the notice and the record disagreeing by forty per cent, two claims in
the term with one open, the premium within two per cent all the same, a bank on
the policy, forty-seven days late last year, declarations outstanding, an item
with no end date, and the same term on file twice.

- **The order is the answer.** Which ones, and in what order, is what separates
  an underwriter from an administrator: a strong one opens on the values, the
  disagreement and the claims; a weak one starts with the missing end date.
- **The page never prints a score and never says which ones matter.** Same rule
  as the broken form: printing the answers turns a judgement into a quiz.
  `uwtest.js` fails the build if a verdict ever appears on the page.
- Then two more: *what would you ask the client for before you quote it*, and
  *what would you do about the premium* (hold / load / refer / decline / not
  until I have more).
- The Branch Manager receives the order, the ask, the premium decision **and
  what they walked past**, which is as telling as what they ticked.
- The ticks survive a reload, travel with the application, and with JavaScript
  off the file is hidden rather than broken — question four asks the same thing
  in words.

### The film — `uwadmin`, 87 seconds, cut 7 November 2026

Built on the same engine as the administrator's ninth cut, which is the look he
accepted: `tools/film/build-boardfilm.py uwadmin`, from
`tools/film/uwadmin-lines.json`. Everything is drawn — no photographs, no
faces, no stock — because that is what he asked for in those words after the
eighth cut (`tools/film/CANVA-AND-THE-EIGHT-CUTS.md` has the whole history, and
should be read before anything is re-cut).

**The twelve administrator scenes are now data-driven, and the underwriter's
ten are the same functions with different content.** A scene reads its cards,
rails, rows and code from the lines file and falls back to the administrator's
values, so there is one set of visuals to maintain rather than two drifting
sets. The refactor is proved by rebuilding `bwadmin`: it comes back **byte for
byte identical** to the committed film, which is the only test that means
anything here.

The ten scenes: the seat (priced in ten minutes, typed all day) · where you are
now (the proposal form retyped, a referral on day three, the broker's e-mail as
the only history) · the agency opening in Chaguanas · the book (motor, property,
liability, engineering, marine, bonds) · every term since the policy began ·
the insurer's notice read and checked against our record, with the one row that
disagrees in amber · a rule is not a ticket (`rule('unoccupied', …)` typed into
the desk, badge **Running**) · three rules you would write in your first month ·
the paperwork is finished, the underwriting is not · the close with the QR.

**Two things learned cutting it**, both now in the builder:

- **`"ticks": false` on the rule scene.** The administrator's version ticks the
  manual rows off once the rule is written, because there the rule *automates*
  them. Here the left column is a queue the rule *replaces*, and a green tick
  beside "wait for the release" reads as the wait being fine.
- **The flag on a card lands after that card's own art, not on a fixed
  offset.** Flattening the three offsets to one number while making the scene
  data-driven moved the administrator's flags by up to 200ms — invisible on
  screen, but it meant the committed `film.html` no longer reproduced the
  committed MP4. A film's source has to rebuild to the film that shipped.

### Two things only Mr Rampersad can settle

- **Study support.** If the branch will fund CII papers, that is the single
  strongest line that could go on this page for a part-qualified underwriter,
  and it is not on it, because nothing in the record says it is true.
- **The music licence.** The bed is his own recording, from a free site he has
  not yet named. Until it is written down the track is not committed — the
  repository root is published, so committing it redistributes it.

### The sticky bar ate every anchor

`--bar` is 4rem and the topbar is sticky, so `#file`, `#apply` and every other
anchored heading parked underneath it when tapped. None of the three recruiting
pages had `scroll-margin-top`; all three do now. It is the same fault recorded
for the claims page, and it is invisible until somebody taps a link.
