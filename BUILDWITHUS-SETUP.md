# The administrator's seat — `/buildwithus/`

Asked for on 6 November 2026, in these words: *"I need to hire an admin
assistant … I need to have around me an innovator and persons maybe who are
stuck where they are. They don't have the tools to work with, but they have
ideas. But in the current environment where they work, those ideas are not
transformed into some amazing things. We do have the tools, we do have the
environment, we do drive digital, we drive AI … You are to create an ad for me
before we do a video first that will target the person I want to. You can
probably look at Git if they can post in terms of how they solve any issues …
create a questionnaire that will zoom into them, that will filter the correct
candidate for me."*

The ad is below. The video comes after it, as asked.

---

## What was built

| | |
|---|---|
| The page | `buildwithus/index.html` → **rickyrampersadbranch.com/buildwithus** |
| The backend | the `admin` form key in `apps-script/Quotes.gs`, code **`QB`** |
| Where applications land | **Quote Requests** tab, and one e-mail to the Branch Manager alone |
| Linked from | the homepage's Careers section, as its own block |

**It is a separate page from `/careers/`, on purpose.** `/careers/` is the
advisor path: the five LIMRA gates, POP7, the career ladder, seven places in
FY27's first class. This is a different job for a different person, and folding
it in would have muddied both. The low verdict on this page's test sends
somebody to `/careers/` when that is plainly the better door for them.

**It is hand-written, not generated.** Like `/careers/`, it posts `q.quote`
directly, so it is **not** in `tools/forms/forms.json` and `build-forms.py` does
not write it. There is also no `sync.py` step: `/careers/` is mirrored from
`agentmgt/` because agentmgt.com serves the same page, and this page has no
second home.

### To put it live

1. Merge the branch. The page is served the moment `main` carries it — GitHub
   Pages, no build step.
2. Paste **`apps-script/Quotes.gs`** into the Service Questionnaire project,
   then **Deploy → Manage deployments → pencil → New version**. Never *New
   deployment*: that issues a fresh `/exec` and every front end has to be
   re-wired.
3. Put `TEAM_CODE` back into `Service.gs` if that file was pasted in the same
   sitting — a full paste blanks it and every wall and board locks out.
4. Check it from a browser: `?action=q.ping` answers `quotes: 1` once the live
   deployment carries the forms.

**Until step 2, the page still works.** An application that cannot reach the
backend shows the candidate a local `QB-` reference and opens their mail app
with every answer addressed to the Branch Manager. Nothing is lost to a bad
minute of signal — the road `/careers/` already takes.

---

## The ad

Four cuts of one ad. The first line is doing all the work in each of them,
because this person is **not** searching for the words "administrative
assistant" — they are scrolling past them.

### 1 · LinkedIn (the flagship — this is where the person with a job is)

> **You already know how your office should run. Nobody has given you the tools.**
>
> I am hiring one administrator for my branch in Chaguanas. Before you scroll past the word "administrator", read what the job is.
>
> We write our own software. Thirty-six backend files, about 100,000 lines of Google Apps Script, 331 pages — all of it running the branch every day. The client letters. The document log. The claims intake. The monthly billing check against the insurer's own invoice, line by line. We read and write Salesforce from our own code. There is an AI agent live on our WhatsApp line. Every bit of it was built in-branch, by people who were not hired as developers.
>
> So here is the seat. Half your day is the branch's administration, and it has to be right, because if it is not then an agent cannot work and a client waits. The other half is making that first half smaller — taking a job you do by hand and turning it into a form, a script, a page, and then measuring whether it actually worked.
>
> You do not need to arrive knowing how. You need to be the person who has already built something out of whatever you were given, because the alternative was doing it by hand forever.
>
> Two things make this different from any other advertisement you will read today.
>
> **Our code is public.** Go and read it before you apply: github.com/RickyRampersad/RickyRampersadTermLIfe — every claim above is in there, including the parts we have not finished.
>
> **Reading it is how you apply.** There is no CV sift. Ten minutes of honest answers, and if it reads like you I will ask you for one thing: open a GitHub issue on our code saying what you would fix and why. That is the whole interview, because that is the job.
>
> I read every application myself. If you are employed today, nobody there will hear of it.
>
> **rickyrampersadbranch.com/buildwithus**
>
> — Ricky Rampersad, Branch Manager, Guardian Life of the Caribbean

### 2 · WhatsApp (your own network and the branch group)

Under 120 words, bold with single asterisks, no hard line wraps, and it ends in
an ask that is easy to answer — the house rules for a branch message.

> *We are hiring one administrator. Not a normal one.*
>
> This branch writes its own software — the letters, the claims intake, the billing checks. About 100,000 lines of it, all built in-branch by people who were never hired as developers.
>
> So the job is half administration and half making that administration unnecessary. Apps Script, Salesforce, respond.io, AI. You do not need to arrive knowing how.
>
> Here is the part nobody else does: our code is public, and reading it is how you apply. No CV sift.
>
> rickyrampersadbranch.com/buildwithus
>
> Do you know one person stuck in an admin job who is always fixing things nobody asked them to fix? Send them this, and send me their name.

### 3 · Facebook and Instagram (feed, read with the sound off)

> **If you have ever built a spreadsheet to fix something nobody asked you to fix, this is for you.**
>
> One administrator's seat. Chaguanas. An insurance branch that writes its own software and will hand you the keys to it — Apps Script, Salesforce, AI.
>
> Half admin. Half making the admin unnecessary.
>
> Our code is public. Reading it is how you apply.
>
> → rickyrampersadbranch.com/buildwithus

### 4 · Job board or classified (CaribbeanJobs, the press)

> **ADMINISTRATOR & BRANCH BUILDER** — Ricky Rampersad Branch, Guardian Life of
> the Caribbean. Chaguanas, Central Trinidad.
>
> An administrator's seat in a branch that writes and runs its own software:
> Google Apps Script, Salesforce, respond.io on WhatsApp, and AI, all in
> production today. Half the role is the branch's administration, done
> properly. The other half is automating it — and you are given the tools, the
> access and the time to do that.
>
> No development qualification required. We are looking for someone who has
> already improved a process with whatever they were handed, and who finishes
> what they start. Care with figures is essential; this work reaches real
> families.
>
> **Our codebase is public and reading it is part of applying.** Apply in about
> ten minutes at **rickyrampersadbranch.com/buildwithus**. Applications are read
> by the Branch Manager personally and treated confidentially.

### 5 · One person, by message (the highest-yield cut of all)

The best hire for this seat is somebody already known to somebody in the branch.
Send this to one person rather than broadcasting it:

> I am hiring an administrator and I thought of you. Not a normal admin job —
> half of it is building the tools instead of using them. Our code is public, so
> you can see exactly what you would be walking into before you decide:
> rickyrampersadbranch.com/buildwithus. Have a look and tell me honestly if it
> is you.

### Notes on the wording

- **Never "administrative assistant" in the headline.** The person we want has
  stopped reading those. The job title appears on the page, in the first
  section, where it belongs — and the page says plainly what the job is before
  it asks for anything.
- **The public repository is the whole hook.** Every recruiting advertisement
  claims a great environment; almost none can be checked. Ours can be, in ten
  seconds, by anyone. That one line does more work than every adjective.
- **Say "you do not need to arrive knowing how" every time.** Leave it out and
  the ad filters for developers, who are a different person wanting a different
  job. The seat is for someone with the instinct and no outlet.
- **Do not print a salary.** It is discussed on the call, and the page says so.
- **No seat count, no closing date.** This page sits at a public URL and an
  evergreen "5 places" dates it. `/careers/` carries a dated class with a
  reason, which is the only form that holds up.
- **Compliance.** The page makes no representation about Guardian Life terms,
  grading or benefits beyond "a branch appointment; terms and pay are discussed
  on the call." If Guardian HR want the wording seen before it is advertised
  outside the branch, this is the paragraph to show them.

---

## The questionnaire, and how to read what comes back

Two gates, and neither is a CV sift.

### Gate 1 — the page: five taps, then three written answers

**The five taps** are behavioural rather than aspirational, and they are scored
out of 20. The score travels with the application and is the **first** column of
the row's summary, so a glance tells you whether to read the rest now or later.

| What it tests | Why it is there |
|---|---|
| What you did about a repetitive job | Builders build. Documenters document. Grinders grind. All three are visible in the answers. |
| **Is something you built in use by somebody else right now** | The single best filter on the page. Ideas are common; shipping is not. |
| What happened when an idea was refused | A stuck innovator has a story here. "Nobody has ever asked me for an idea" scores **2**, not 0 — that is the person we are looking for. |
| A wrong figure on a letter going to 300 clients | The care test, and the only question with a genuinely wrong answer. |
| How far you have gone with code | Lowest answer still scores **1**. Never knowing code must not sink the right person. |

**Reading the score:**

- **16–20** — the person this was written for. Read their written answers that
  day.
- **11–15** — worth a conversation. The thing the taps cannot show is whether
  they finish, so read the first written answer closely.
- **Under 11** — honest no, and the page sends them to `/careers/` instead,
  which is often the right door.
- **Any score at all, with the careless answer on question four** — the page
  stops them and does not invite them to apply, whatever the rest said.
  Somebody who would send a figure they already suspect is wrong to three
  hundred families is wrong for an insurance branch, and no other strength
  makes up for it.

**The three written answers** are the real filter, and all three are required:

1. *One thing you built that nobody asked you to.* Score it on **specificity**.
   "I improved efficiency" is nothing. "The same eleven fields went into three
   systems so I built a form that filled all three" is the hire.
2. *The slim-down.* They pick one of the two real undone jobs named on the page
   and say how they would halve it. We are reading for **how they think about
   an unfamiliar system**, not for a correct answer — they have not seen ours.
3. *What they want on their CV in two years.* If this is vague, they do not
   actually want this seat; they want a job.

The page also takes a GitHub username and one link, both optional.

### Gate 2 — the GitHub issue (this is the interview)

If the form reads like them, ask for exactly one thing:

> Go into our public repository, find something that is clumsy, missing, or
> would save somebody an hour, and open a GitHub issue about it. Say what is
> wrong, why it matters, and roughly how you would fix it. You do not have to
> write the fix.

**Why this is the right test.** It is the job, almost exactly: read an
unfamiliar system, find a real problem in it, and explain it clearly enough that
somebody else can act. It cannot be faked by a CV, it cannot be bought, and it
costs effort — which by itself removes everybody who is applying to forty things
this week. And the issues are all in one place for you to compare.

**Read each issue for, in this order:** is the problem real; is it explained so
a third person would understand it; is the suggested fix proportionate (a small
finishable thing beats a grand rewrite); and did they notice something we had
not. The last one is the strongest signal there is.

All of this works **today** — the repository is public, issues are on, and
nothing new has to be built for it. Filter them with a label, say
`candidate`, once the first few arrive.

### Gate 3 — twenty minutes on the phone

Their issue and their written answers, terms and pay openly, and a straight
answer either way.

---

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

## Still to do

- **The video**, as asked — the ad first, the film after. The recruiting film
  pipeline in `tools/film/` is the road: a `buildwithus-lines.json`, Andrew
  Expressive on the `tts-run` runner with the Whisper English-and-words check,
  and the page's own screens as the picture. The strongest 6-second hook for a
  feed cut is the first line of the LinkedIn ad.
- **A share card** (`og-image`). The page currently falls back to the
  homepage's, which is correct but generic; its own card would preview better
  in WhatsApp.
- **Compliance sight of the wording**, if the ad is going outside the branch.
