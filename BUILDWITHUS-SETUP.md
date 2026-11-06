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
| The film | `buildwithus/buildwithus.mp4` (wide) and `buildwithus-story.mp4` (upright) |
| The film's page to post | `buildwithusvideo/index.html` → **/buildwithusvideo** |
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

Five cuts of one ad. The first line does all the work in each, because this
person is **not** searching the words "administrative assistant" — they are
scrolling past them.

**We no longer lead with "our code is public."** Decided 6 November 2026, and
he was right: the administrator with ideas and no tools is very unlikely to
know what GitHub is, so that line reads as jargon to the person we want and as
a beacon to developers, who want a different job and would leave when they
found out half the day is petty cash and licence renewals. The asset is real,
so it stays — demoted from the hook to the proof, and in plain words: **"Most
employers show you a job description. We will show you the whole workshop."**

### 1 · LinkedIn (the flagship — this is where the person with a job is)

> **You already know how your office should run. Nobody has given you the tools.**
>
> I am hiring one administrator for my branch in Chaguanas, and before you scroll past that word, read what the job actually is.
>
> This branch writes and runs its own software. The client letters. The document log. The claims intake. The monthly check of an insurer's invoice against our own records, line by line. Thirty-six files and about a hundred thousand lines of it — all built in-branch, by people who were not hired as developers and did not know how when they started.
>
> So here is the seat. Half your day is the branch's administration, and it has to be right, because if it is not then an agent cannot work and a client waits. The other half is making that first half smaller: taking a job you do by hand and turning it into a form, a script, a page, and then measuring whether it actually worked.
>
> You do not need to arrive knowing how. You need to be the person who has already built something out of whatever they were given — a spreadsheet, a WhatsApp group, a template — because the alternative was doing it by hand forever.
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
> So the job is half administration and half making that administration unnecessary. You do not need to arrive knowing how.
>
> Before you apply we show you everything we have built, so you can judge for yourself. The form takes fifteen minutes. The interview is one question: what would you fix here?
>
> rickyrampersadbranch.com/buildwithus
>
> Do you know one person stuck in an admin job who is always fixing things nobody asked them to fix? Send them this, and send me their name.

### 3 · Facebook and Instagram (feed, read with the sound off)

> **If you have ever built a spreadsheet to fix something nobody asked you to fix, this is for you.**
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
- **Say "you do not need to arrive knowing how" every time.** Leave it out and
  the ad filters for developers, who are the wrong person for this seat.
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

## The film

**Thirty seconds (29.18s), two cuts, no voice-over.** `buildwithus.mp4` is
1920×1080 for a feed; `buildwithus-story.mp4` is 1080×1920 for WhatsApp Status,
Reels and Stories. Posters beside each. `/buildwithusvideo/` plays both with a
switch, carries the Open Graph tags so a pasted link previews properly, and
offers both files to download for posting.

**Why no narration.** Feed video is watched with the sound off, so the words are
on screen and the track carries the rhythm. It also means no voice to re-record
when a line changes.

**It is cut to the music's own beat.** The track was measured rather than
guessed: 98.7 BPM, a beat every 0.608s, bars of 2.432s, first beat at 0.289s.
Every scene change, every word and every counter lands on a beat. 29.18s is
exactly 48 beats, and it is under the 30-second WhatsApp Status limit on
purpose.

**⚠ The music is yours to clear before this is posted publicly.** The track is
the 19-second "Western Avenue 15" clip sent on 6 November 2026, looped to
29.18s with a crossfade on the beat. **I do not know its licence.** Every other
film in this repository uses either the branch's own `rr-branch-theme.mp3` or
Kevin MacLeod's "Inspired" under CC BY with the credit attached, precisely
because an MP4 at a public URL is a redistribution. Before posting: confirm the
track is licensed for this, or say the word and the bed is swapped for the
branch theme in one command.

**Every screen in it is real**, taken from `wall/img/` — screens already public
on `/wall/`, each carrying sample data. The names and figures on them are
invented. No client appears anywhere, which is the standing rule for an MP4.

**The QR is checked, not assumed.** It encodes
`https://rickyrampersadbranch.com/buildwithus`, and it was decoded back out of
the finished video — both at full size and from a 405×720 phone-sized preview —
so it is known to scan.

### Re-cutting it

Everything lives in the session scratchpad under `film/`:

- `film.html` — every frame is a pure function of `t`, so a frame-by-frame
  render and a real-time play are identical and there is no capture drift to
  measure and undo. The shape comes from the URL (`?shape=v`), **not** from a
  property set after load — reading it after load silently gave the upright cut
  the wide layout.
- `render.js <v|w> <fps>` — renders the frames.
- `peek.js <v|w>` — one frame per scene, for checking a change without
  rendering nine hundred.
- The bed is built with ffmpeg from the beat grid above, loudness-normalised to
  −14 LUFS, then encoded at CRF 19.

To change a line, edit the scene in `film.html` and re-render. Nothing is
timed by hand: the beats are `b(n)`.

## Still to do

- **Clear the music licence**, or swap the bed for the branch theme. See the
  film section above — this is the one thing standing between the film and
  being posted.
- **A share card** (`og-image`). The page currently falls back to the
  homepage's, which is correct but generic; its own card would preview better
  in WhatsApp.
- **Compliance sight of the wording**, if the ad is going outside the branch.
