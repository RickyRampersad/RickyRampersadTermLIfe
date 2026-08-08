# Careers & Recruiting — how the data flows

Everything the branch runs on recruiting, and what data you actually get at each step.

---

## 1. The three systems, and what each one owns

You now have three systems touching one candidate. Most recruiting messes come from
being unclear which one is the boss of a given fact. Here is the split.

| System | Owns | You control it? | Where it lives |
|---|---|---|---|
| **TalentNest** | The legal application, POP 7.0 dispatch and scoring, step advancement, candidate emails on Guardian branding | No — Head Office | `guardianlifeofthecaribbean.talentnest.com` |
| **Branch intake** | Everything TalentNest never asks: track, runway, network, vehicle, devices, household backing, source | Yes — entirely | `/careers/apply.html` → your Google Sheet |
| **Recruit Tracker** | The GSAP V4.2 file: interview scoring, BM approval, POP review, Discovery, the 17-item selection file, approval routing, onboarding, probation | Yes — entirely | Each manager's browser |

**The rule:** if Head Office needs it, TalentNest owns it. If GSAP needs it, the tracker owns it.
If neither asks for it but you need it to decide, the intake owns it.

---

## 2. The join key

Every intake mints a reference like **`RRB-K4M2XP`**. It is the one string that ties the
three systems together:

- shown to the candidate on screen and emailed to them
- carried into the TalentNest handoff as `?ref=RRB-K4M2XP`
- written to the intake sheet as column A
- stored on the tracker record at `meta.branchIntake.ref`

When someone phones and says "I applied last week," the reference finds them in all three
places. Without it you are matching on name spelling, which fails exactly when it matters.

**Codes deliberately exclude I, O, 0 and 1** so they survive being read aloud over the phone.

---

## 3. The candidate's actual path

```
Sees the ad
   ↓
/careers/                      The Selection — hero, two tracks, five gates,
                               60-second self-test. Test result is remembered.
   ↓
/careers/apply.html            Branch intake, 6 steps, ~2 minutes.
                               → POST to your Apps Script
                               → row in "Branch Careers Intake" sheet
                               → briefing email to you, cc the BMA
                               → acknowledgement email to the candidate
                               → reference code on screen
   ↓
TalentNest posting 215291      The legal application. Head Office's system.
                               Arrives tagged utm_source=branch_site&ref=RRB-XXXXXX
   ↓
Recruiting Manager calls       Within 48 hours, having already read the intake
   ↓
Recruit Tracker                Import pulls the file in complete. Stages 1–8 run from here.
```

There is a **skip link** on the intake page that goes straight to TalentNest. Some people
will not fill in a branch form and that is fine — we would rather have the application than
the data. Those arrive tagged `utm_campaign=selection_skipped`, so you can see how many.

---

## 4. What you actually get — field by field

### From the branch intake (all candidates)

| Field | Why it earns its place |
|---|---|
| Name, email, mobile | Contact |
| **Area they live** | Travel time to Chaguanas is a real first-year attrition driver |
| **Date of birth** | → Form A age band, automatically |
| **Household status** | → Form A marital row, automatically |
| **Education** | → Form A education row, automatically |
| **Track** — experienced vs new | The branch point that decides every later question |
| Commitment — full-time / transitioning / part-time | Sets the honest expectation conversation |
| Earliest start | Pipeline planning |
| **Vehicle** | → Form A car ownership row, automatically |
| Devices (BYOD) | → selection file `byod` |
| Household backing | Predicts the spouse interview before you run it |
| Year-one income needed | The single most common mismatch, surfaced on day zero |
| Network size / approachability / referral ability | Project 100 proxy, in the market survey's own wording |
| Source + who referred them | → `meta.sourceType`, and the referrer gets their credit |
| Self-test score | How they rated themselves before anyone rated them |

### Experienced track adds
Company · years in industry · **12-month API band** (against the $105k probation standard) ·
licence status · currently contracted · book portability · why they are looking.

### New-to-industry track adds
Current occupation · years in role (→ Form A employment row) · **runway if income starts
slowly** · why this, why now.

> Runway is the question nobody asks early and everybody regrets not asking. Commission income
> takes roughly 90 days to steady. A candidate with under a month of runway is not a bad
> candidate — they are a candidate you must plan differently for, and you now know on day zero.

### From TalentNest
Application ID · Candidate ID · current step · **POP 7.0 report ID and scores** (PS, EP, AP,
IP, SD, LM, CR) · probability. Record the IDs in the tracker's TalentNest card on the First
Interview screen so the file links back to the system of record.

### From the Recruit Tracker
Everything GSAP requires: personal observation scores, the track-specific interview
dimensions, RM recommendation and BM review, POP review with the score-driven question bank,
Discovery's six modules and market surveys, the 17-item selection file, approval routing
(BM 60–80 / VP 50–59 / Panel under 50), onboarding, and the 7-month probation against
$105k API and 25 settled applications.

---

## 5. Form A prefills itself

The selection Form A scores eight rows. The intake fills five of them, using
character-identical labels, so they score without anyone retyping anything:

| Row | Source | When |
|---|---|---|
| Age | Branch intake (from DOB) | Day zero |
| Education | Branch intake | Day zero |
| Employment years | Branch intake | Day zero |
| Marital status | Branch intake | Day zero |
| Car ownership | Branch intake | Day zero |
| Discovery summary | Discovery evaluation | Week 7 |
| POP 7.0 | TalentNest | After BM authorises |
| Income potential | Market surveys | During Discovery |

A typical candidate arrives at **35–45 of 80 points before their first interview**. That is
not a verdict — the three missing rows are the heavy ones — but it does tell you immediately
whether someone is heading for BM approval or a Selection Panel.

**Every prefilled row is the candidate's own unverified claim.** The tracker labels each one
"From branch intake RRB-XXXXXX" in its notes field. Vehicle and employment history still get
verified at inspection. Do not let a prefilled form feel like a checked form.

---

## 6. Pulling intakes into the tracker

Once per morning:

1. Open `<your Apps Script /exec URL>?export=new&key=<EXPORT_KEY>` in a browser
2. Save the JSON file it returns
3. In the Recruit Tracker, click **Import** and choose that file

Candidates arrive complete — contact details, source, background notes, five Form A rows, and
a full intake summary written into the First Interview outcome notes. `export=new` only
returns candidates you have not pulled before; use `export=all` to re-pull everything, or
`export=ref&ref=RRB-XXXXXX` for one.

---

## 7. What is on the site now

| Path | What it is | Access |
|---|---|---|
| `/careers/` | The Selection — the public recruitment ad | Public |
| `/careers/apply.html` | Branch intake, 6 steps | Public, not indexed |
| `/recruiting/` | Manager hub | Code: `RECRUIT2026` |
| `/recruiting/tracker/` | Recruit Tracker v5.6 (build B5) | Behind the hub |
| `/recruiting/onboarding/` | GSAP V4.2 Manager Onboarding Course | Behind the hub |
| `apps-script/careers-intake.gs` | Intake webhook — sheet, emails, tracker export | Deploy to script.google.com |
| `apps-script/recruit-tracker-webhook.gs` | Tracker's stage-completion emails and log | Deploy separately |

---

## 8. Setup still to do

1. **Deploy `apps-script/careers-intake.gs`** — instructions are in the file header.
   Paste the `/exec` URL into `CONFIG.WEBHOOK_URL` at the top of `careers/apply.html`.
   Until you do, the intake still works end to end for the candidate: they get their
   reference, their acknowledgement screen and the TalentNest handoff. You just do not get
   the sheet row or the briefing email.
2. **Set `EXPORT_KEY`** in that script's properties. Without it the export endpoint refuses
   to serve, which is the safe default — that URL returns candidate data.
3. **Change the access code** if `RECRUIT2026` is too guessable. It is in
   `recruiting/index.html`, near the bottom.
4. **Deploy `apps-script/recruit-tracker-webhook.gs`** separately if you want stage-completion
   emails, then paste its URL into the tracker's Integrations panel.
5. **TalentNest API key** — when Head Office provides one, both scripts can send candidate
   emails through TalentNest on company branding instead of Gmail.

---

## 9. Things worth knowing

**Tracker data is per-browser.** The Recruit Tracker stores candidate files in IndexedDB on
the machine you open it on. Nothing uploads. A file the BMA builds on her laptop is not
visible on your phone. Use **Export** to hand a file over, and export a backup before anyone
clears their browser or changes machines. This is also why putting the tracker on a public
URL is safe — the app is public, the data never is.

**The AI drill-down does not run here.** The tracker's AI POP analysis calls the Anthropic API
directly with no key, which only worked in the environment it was authored in. On the branch
site it returns a plain message saying so. Everything else works normally, including the
score-driven question bank that the drill-down was summarising.

**Felicia's file was not published.** The demo seed shipped with the tracker was ~5.6 MB of a
real candidate file. This repository is public, so it was left out. To load it locally, use
the tracker's Import button with those seed JSON files directly.

**`data/fleet-register.csv` is still in this public repo** and predates this work. Worth a look
— you removed a client property schedule for the same reason back in April.

**The intake is not the application.** Say it on the phone the way the page says it: the
branch intake is ours, the Guardian Life application is the legal one. If someone completes
the intake and abandons TalentNest, they have not applied — the acknowledgement email tells
them so, and the sheet shows you who to chase.

---

# Part 2 — The Branch Portal

Added after the careers site: a shared place where **recruits sign in and see their own
journey**, and **managers sign in and see their recruits**. Same login box; the account
decides which app you get.

## Why this needed a backend

The Recruit Tracker keeps files in one browser. That is fine for a manager working alone —
and impossible the moment a recruit needs to see their own progress, because they are on a
different device. Shared logins need shared storage.

The portal uses **one Google Sheet behind one Apps Script web app**. Free, no new accounts,
no hosting bill, and you already run two Apps Scripts. `apps-script/branch-portal-api.gs`
has the whole setup in its header.

**Be clear-eyed about what this is.** PINs in a spreadsheet are right for twenty people
sharing progress data and wrong for anything sensitive. Keep ID numbers, medical details and
financial statements in the Recruit Tracker's selection file, not here.

## What a recruit sees

- Where they are across the eight GSAP stages, and how long they have been at this one
- Plain-language "what happens next / what you do" for their current stage
- Discovery: 6 modules, 21 sessions, 96 checkpoints, with a live percentage
- **Due now** — sessions assigned to them, flagged red once overdue
- A debrief form for every session they have reached
- Their scores — but only the ones their manager has released
- Everything they have done, dated, since the day they applied

## What a manager sees

- Every recruit as a card: stage, days at that stage, Discovery progress, flags
- **Needs you now** — debriefs waiting, overdue sessions, anyone stalled past 14 days
- Inside a recruit: the full Discovery grid, every submission with the recruit's actual
  answers, the history, and a stage selector
- Score a submission 0–4, write feedback, then **release** it. Nothing reaches the recruit
  until you release — so a half-finished thought is never visible to them.
- Their own tick-off of each session's checkpoints, separate from the recruit's

RMs see their own recruits. The BM and BMA see the whole branch.

## The session debrief

This is the form you asked for after each session. It is generated from the curriculum, so
it is never out of step with the Manager's Guide:

1. **The session's own checkpoints**, ticked by the recruit. The manager ticks their own
   copy separately — where the two disagree is usually the conversation worth having.
2. **Module-specific questions**, written against that module's stated objective. Module 3
   asks how many calls and what happened on the worst one. Module 4 asks whether, having
   watched it done, they can see themselves doing it. Module 5 asks for the decision in one
   sentence.
3. **Confidence, 1–5**, and what they will have done before the next session.

Submit → the RM gets an email, the BM is copied → the manager scores and releases → the
recruit gets an email and sees the feedback.

## Discovery, as the system holds it

| Module | Sessions | Checkpoints |
|---|---|---|
| M1 · A Sales Representative's Week | 4 | 18 |
| M2 · Identifying Markets | 4 | 17 |
| M3 · Meeting Your Marketplace | 4 | 17 |
| M4 · Making a Sales Presentation | 4 | 19 |
| M5 · Making a Career Decision | 2 | 10 |
| M6 · Discovery Marketing Plan | 3 | 15 |
| **Total** | **21** | **96** |

Lifted verbatim from Recruit Tracker v5.6 into `portal/discovery.js`, so the portal, the
tracker and the Manager's Guide cannot drift apart. Change a session title in one place and
change it in the other.

## Demo mode

Until you paste your `/exec` URL into `API.BASE` in `portal/api.js`, the portal runs on a
sample branch — three recruits at three different points, one mid-Discovery with debriefs
waiting. Sign in as `recruit@demo` or `rm@demo`, any PIN. Nothing is saved. Click through
both sides before you set anything up.

## The recruiting ad

The main site's careers section now leads with the ad and a QR code. **The QR points at the
branch intake, not straight at TalentNest** — deliberately. A code that jumps to TalentNest
throws away everything the intake collects. The intake hands off to TalentNest at the end,
so the candidate still lands in Head Office's system; you just get the data on the way past.

## Setup for the portal

1. Deploy `apps-script/branch-portal-api.gs` — full instructions in the file header
2. Set `PORTAL_SECRET` in Script Properties, then run `setupPortal()` once
3. Paste the `/exec` URL into `API.BASE` at the top of `portal/api.js`
4. Open the Sheet, People tab: fill in manager emails, **change every seeded PIN**, and add
   your recruits

## Still open

- **agentmgt.com** — you mentioned it and I do not know what it is. If it is a domain you own
  and want the portal on, point it at this site and everything works unchanged; nothing is
  hard-coded to rickyrampersadbranch.com except the QR code's target.
- **The Jotform library isn't wired in yet.** You have ~25 digital forms. The portal can
  surface the right one at the right stage — but I need the list of which form belongs to
  which step before I can place them.
- **Induction is stubbed.** The probation stage shows in the stage bar and the tracker holds
  the full contract model, but the portal does not yet show a recruit their API and settled-
  application numbers against the $105k / 25 targets. That is the natural next build.
