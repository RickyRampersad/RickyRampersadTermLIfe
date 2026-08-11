# Premium Due Engine

Tracks every premium in arrears through the 45 / 60 / 75 / 90-day lapse funnel:
the 45-day client letter, the day-60 handover that makes the policy a manager's,
the agent's retention case, the manager's structured response, the day-75 letter
the manager signs, and the day-88 final notice that hands the client their own
file. Replaces the two JotForms and the "Premium Due Status" comment columns.

| File | What it is |
|------|-----------|
| `index.html` | The whole app — login, dashboards, case threads, client outreach |
| `staff-manual.html` | Staff manual — the day-to-day reference |
| `process-brief.html` | Rollout brief for the team: the workflow, the actual client emails rendered, and what each role does differently |
| `../apps-script/PremiumDue.gs` | Backend — reads the portfolio, stores the log |
| `../apps-script/PremiumDueAuth.gs` | Sign-in, the roster tab, tokens and scope |
| `../apps-script/PremiumDueTemplates.gs` | The letters, the manager brief and the daily send |

## Which sheet is which

| Sheet | Role |
|-------|------|
| [**Branch Portfolio**](https://docs.google.com/spreadsheets/d/1T1SG3mgs5QV5LuF3JTpmn1zFldhGjOQNoe0YCMhWxjs/edit) | Read-only source. Tab `gid=0` = "Premium Due status". Set as `PORTFOLIO_ID` |
| [**Premium Due Tracker**](https://docs.google.com/spreadsheets/d/1OuVG4NIsOd_O1LmmZ2gUYXCr1R59Atsfqv0yOvqFVgo/edit) | Write target. Holds `PremiumDueLog` and `Roster`. Bind the Apps Script to this one |
| Motor Renewal Book — Schedule | A different system (`Code.gs`). Not used here |

Note both files are written in Artifact format — no `<!DOCTYPE>`, since the
artifact host supplies one. Served straight from this repo a browser falls into
quirks mode; the styling is explicit enough to survive it, but publish them as
artifacts or add a doctype if you host them yourself.

## ⚠️ The copy in this repository is a demo

This repository is public and publishes to rickyrampersadbranch.com, so the
committed copy deliberately reaches nothing real:

- `DEPLOY.SHEET_URL` is **blank**. The Apps Script deployment is readable by
  "Anyone", so a URL committed here would hand the entire live portfolio —
  10,000+ policies with client names, emails and phone numbers — to anyone who
  opened this page, before any login.
- `DEPLOY.CODES` is **blank**, so the app runs in demo mode: any name signs in
  with `DEMO-000` and sees only invented data.
- `SEED` / `SEED_RECORDS` are invented — 555 phone numbers, example.com
  addresses, and a `9004-1000xx` policy range that cannot collide with a real
  policy number.

**Do not paste the real `/exec` URL or the real access codes into this file
while the repository is public.**

## Going live (private deployment)

1. Deploy `../apps-script/PremiumDue.gs` — setup steps are in the file header.
   Set `PORTFOLIO_ID` to the Branch Portfolio spreadsheet id.
2. Create a **private** Netlify site (Site settings → Access control → password,
   or Identity) from this directory. Do not serve the engine from
   rickyrampersadbranch.com — that domain is public.
3. Run `pdSetupRoster()` once, fill in the `Roster` tab, and re-deploy.
4. On that build only, set the one field:

   ```js
   const DEPLOY = { SHEET_URL: 'https://script.google.com/macros/s/…/exec', CODES: {} };
   ```

   Leave `CODES` empty — with a sheet connected the engine asks the server and
   never holds a code. Alternatively leave the file alone and use **Connect
   sheet** in the top bar, which stores the URL in that browser only.

## How it stages a policy

Off the **status flags**, not a raw day count — for a Status 0 "Premium Paying"
policy the Days column is age-on-book, not arrears, and would otherwise drag
thousands of healthy policies into the lapse funnel.

**The cycle is 45 / 60 / 75 / 90.** Nothing goes out before day 45 — a premium a
few days late is a banking timing difference, not a conversation. Between the
milestones, a reminder every 5 days while the client has said nothing; it stops
on any answer. Day 75 is signed by the unit manager personally. The final notice
sends at day 88 so it lands before the cliff, not on it.

**At day 60 one email goes to the manager with the client copied**, and repeats
every three days until the manager has answered. **At day 90, 95 and 100** the
client gets the closing letter, which asks them to rate the advisor and the
manager. See below.

| Stage | Trigger | What's due |
|-------|---------|-----------|
| Overdue | Status 2, 1–44 days | Nothing automated — agent contact only |
| 45-Day | Status 2, 45–59 days | First letter: two questions, answered by tapping |
| 60-Day | Status 2, 60–89 days | One email to the manager, **cc advisor + client**, repeating every 3 days until answered · advisor files by day 65 |
| 88 | Status 2, 88–89 days | Short final notice |
| 90 / 95 / 100 | Any status | The closing letter, with service ratings. Three sends, then it stops |
| Win-back | Status 1, from day 110 | Reinstatement, once the closing sequence has finished |
| Pending | Status 3 / underwriting incomplete | New business chase |

### Colour

`PD_THEME` at the top of `PremiumDueTemplates.gs` — `'navy'` (default, from the
branch site), `'teal'` (Guardian corporate) or `'charcoal'` (most formal). Every
letter, badge, table header and rule follows it; the gold, the crest and the
layout are shared. All three clear 3.2:1 on every text node.

### Short letters

Every client letter fits roughly two screens. The day-45 letter is a greeting, a
three-figure strip, the choices, the cover table and one paragraph on what
happens next — half the length it was, because the version before it was
accurate and nobody would have read it.

`pdGlance_` is the strip: **amount outstanding**, premium and frequency, and
premiums paid to, at 20px across the top. If those three are not legible in two
seconds the rest of the letter does not get read either.

Answer labels are deliberately short — *Settle it now · Review my premium ·
Change my payment date or bank details · Pause briefly, keep the cover · Have
someone call me · Something else*. A choice you have to read twice is a choice
nobody taps.

### The letterhead

Navy field, the gold shield with a heart, the branch name over **Guardian Life
of the Caribbean · Chaguanas, Trinidad**, and a gold rule — taken from
rickyrampersadbranch.com rather than invented, so a client who has seen the
website recognises the letter as the same house.

Top right is a **status badge**: `PREMIUM DUE · 45 DAYS OVERDUE`, in the day
count off the portfolio, going amber at 75 and red at `FINAL NOTICE`. A letter
about a lapsing policy should say what it is before a word of it has been read.

The crest is built from HTML, not SVG. **Gmail strips inline SVG and Outlook
does not render it at all**, so an SVG crest is a blank space in the two clients
most of this book reads mail in. Gold takes dark type and never white — white on
this gold is 2.7:1.

### What the letter carries from the portfolio

Fields that were already mapped and never reached a client. Each answers a
question they would otherwise telephone to ask:

| In the letter | From | Why |
|---|---|---|
| **Amount outstanding** | `AmountBilled` | The commonest thing a policyholder wants is the figure. The letter used to make them ask, and asking is where people stop |
| **Premiums paid to** | `PaidToDate` | Where the cover actually stands today |
| **Collected by** | `Billing` | The most useful field in the book — see below |
| Frequency | `Mode` | Changes what a payment plan can even look like |
| **Years in force** | `IssueDate` | "In force 15 years" is what they are being asked to give up |
| Plan, benefit, total cover | `PlanCode` `SumAssured` `InsType` | In the table, with a **total in force** line |
| Postal address | `Address` | On the manager's day-60 brief — for the 52 policies with neither phone nor email it is the only channel left |

`pdBillingNote_` is the one that pays for the rest. **"This premium is collected
by bankers order"** turns a missed payment into a stopped instruction, which for
the **60 clients behind on one policy while paying another** is what actually
happened. It offers to re-lodge the mandate — a five-minute fix rather than a
retention negotiation.

### One channel

**Email only**, everywhere — the templates, the engine's outreach panel and the
brief. Two versions of the branch's position going out on two channels means the
one nobody logged is the one the client remembers, and the engine's copy-out
messages are written as letters rather than as text messages for the same
reason.

### Contact data

`pdValidEmail_` strips whitespace before validating. **1,288 addresses in the
book are broken by a single stray space** — `AFISHALEWISNAILS@GMAIL.CO M` — an
export artefact. Repairing them takes email reach in the save window from 51% to
69%, which is 132 more clients we simply were not writing to. The repair is
whitespace only; nothing is guessed and no domain is corrected.

`pdMayEmail_` honours the portfolio's **Send Y or N** column. Anything explicitly
N is suppressed and no sequence overrides it.

Coverage in the 45/60 window: 93% have a usable phone, 69% a usable email after
repair, and **7% (52 policies) have neither** — those are a phone call somebody
has to make, and the log records them as unreachable rather than skipping quietly.

`Address`, `AmountBilled`, `PaidToDate` and `Mode` are now mapped too.

### Answers need no browser

Every answer in every letter is a link. With `OUT.ENGINE_URL` set it is a
one-tap link that records instantly. With it blank — the state this ships in —
it is a `mailto:` that pre-fills the policy number, the question and the answer,
addressed to the branch with sales support copied, so the client taps and
presses send. Two taps, no website, no password, works on any phone.

That is not a stopgap. A share of clients will not open a web page from an
email, and the branch's own submissions show a third were never reached at all.

The questions are deliberately **not** the old JotForm's. That form ran three
years, drew 152 responses, and its top answer to "what steps do you plan to
take" was *Other* — it read like an audit. Two questions now, and neither asks
why: *How would you like us to handle this?* and *When would you like us to
action it?*

Nothing is worded so that choosing it is an admission — "I would like the
premium reviewed", not "a smaller amount I can keep up with". **Every question
ends in an open option** ("Something else — I will reply and explain"), because
a list without an escape forces anybody who does not fit it into a wrong answer
or none at all, and **no question runs past six options**, which is where
accuracy peaks before people start picking at random.

**Day 88 asks a different three**, because by then we have asked twice and a
manager has been asked to telephone; a third round of the same questions reads
as though nobody had been listening. So the last letter asks about us: *has
anyone from the branch spoken with you about this?* (the one nobody here has
ever put to a lapsing client — 47 of 137 volunteered it unasked), *what would
you like to happen with the policy?*, and *is there anything we could have done
better?*

The `From` and `CC` addresses match the Salesforce macro *Premium Due 75 Days
Client Comm*.

The answers are the **first section** of every letter. Nobody scrolls past a
formal preamble to reach them.

### Day 90 is not the same for every policy

**Cover does not simply end if the policy has built a value.** Under the
contract's non-forfeiture terms the cost of cover can be met from that value,
and an automatic premium loan may already be running. Saying "your cover ends"
to that client is a misstatement about their contract.

`pdValueStatus_` reads **Issue Date** and **APLamount** from the portfolio and
picks one of four positions — `none` (under ~2 years, lapses outright), `likely`
(old enough to have value, agent confirms), `apl` (a loan is already running,
named with its amount), `unknown` (no issue date). `pdLapseMeaning_` writes the
matching paragraph, and the day-90 timeline row changes with it.

The engine cannot compute a surrender value — that comes from the contract and
the carrier. **The manager is required to state the position** as one of their
eight questions, and `pdLapseMeaningFor_` prefers that answer over the
inference: once a manager has confirmed the position, the client's day-88 letter
says *"we have checked the position on this policy — confirmed by [manager]"*
rather than *"your agent will confirm"*.

### Day 60 — one email, and the client is on it

**The day-60 email is addressed to the manager and copied to the advisor, the
branch manager and the client.** That last one is the design, not an oversight.
Up to day 60 the policyholder is asked to act and hears nothing back but
reminders; from day 60 they watch the branch work — who holds the policy, what
they have been asked, and by when.

It repeats **every three days** until every question has an answer, and each
repeat asks only what is still outstanding while showing what has already been
answered. `pdOutstandingQuestions_` does the filtering, `state.rounds` numbers
the reminders.

Because a client reads these, the manager's questions are split in two:

| | Asked in the email | |
|---|---|---|
| `MANAGER_QUESTIONS` | **Yes** | Have you spoken with the client · What was the outcome · Have you spoken with the advisor · Have you reviewed the fact find · What is the non-forfeiture position · By when will this be resolved |
| `MANAGER_PRIVATE` | **Never** | The commercial decision (including *allow the policy to lapse*), the outlook, and whether the BM is needed |

Putting "allow the policy to lapse — documented" in front of a policyholder as a
menu option would be indefensible. Those three are answered in the engine.

`pdWhatWeHave_` carries the day-45 answer into the email — **or says plainly
that there was no reply**, which is the sentence that makes a manager pick up
the phone.

### Day 90, 95, 100 — the closing letter

The grace period has run out. `PD_TEMPLATES.close` sets out every follow-up,
every answer, and everything the manager recorded, then asks four questions —
two of which are **star ratings for the advisor and for the manager**. It goes
at day 90, again at 95, again at 100, and then never again; a fourth letter
asking a lapsed policyholder to rate us would be the branch talking to itself.
Any answer to a closing question stops it (`state.closingAnswered`).

**Win-back is held back to day 110** (`OUT.WIN_BACK_OPENS`). Without that gate
the lapse status flips at day 90 and win-back interleaves with the closing
letters — closing on 90, win-back on 92, closing on 95 — and the closing letter
already offers reinstatement.

### The old day-60 handover

**Day 60 sends the client nothing.** It sends the *manager* the brief, and asks
them to telephone. `pdInternalChase_` fires `pdManagerLetter_(p, s, {activation:
true})` once per policy, logged as `manager-60`, and it fires **whether or not
the agent has filed a retention case**.

That last part is the fix. Under the old design a manager only saw a policy once
an agent filed on it, so a case nobody filed reached nobody: the agent was late,
the manager never saw it, the manager was therefore not late either, and the
policy lapsed with two clean records. The branch's own submissions are what this
is answering — **47 of 137 clients said nobody had contacted them at all**, and
a fourth well-written letter is what we do instead of the intervention.

The handover email carries the client's phone, email **and address**, flags a
`Send = N` consent suppression, and says plainly that the client will not
receive another letter until day 88.

Two internal clocks run from there:

| Clock | Deadline | Missed |
|-------|----------|--------|
| Manager calls and answers | 3 working days from the **handover** | Emailed every 3 days, BM copied from the second; hits **their** sign-in gate; shows in the client's day-88 letter as a record with nothing in it |
| Agent files the case | day 65 | Emailed, manager copied; shows as *Waiting on [agent]*; hits their sign-in gate |

The two are independent — the agent's clock must not swallow the manager's on
the way past, which is what an early `return` in `pdInternalChase_` used to do.

`blocker(c)` names the single person holding each case, and now names the
**manager first**: from day 60 the policy is theirs. It runs only inside the
60-day window — a policy that lapsed in 2014 has nobody late on it, and counting
those would bury the live cases under thousands of historic ones. The manager
queue is likewise every handed-over policy with no response, not only the cases
an agent got round to filing.

### Day 88 — the client's own file

The final notice carries `pdInteractionLog_`: every letter sent, every answer the
client gave, the day the policy went to a manager, and everything that manager
recorded — in date order, with three tinted row types (us / you / a manager
acted). Then the three closing questions.

Sending a client their own file is unusual and that is the point. Where the
branch did the work it is the only place the client ever sees it; three months of
process happen entirely out of their sight and all they experience is post
arriving. Where the branch did not, the letter says so, in a red box, over both
names:

> **Reading that back, we do not think we did enough.** The record above shows
> letters from us and little else. If nobody from this branch spoke to you about
> this policy, say so in the first question above.

Three things are deliberately withheld:

- **Internal working notes are counted, not quoted.** The client is told how many
  are on the file and that they can ask for them. They are notes between
  colleagues and can carry a judgement nobody wrote expecting the client to read.
- **`MGR_SAID_CLIENT` is a whitelist.** Compliance and staffing decisions —
  possible replacement of in-force cover, reassigning an orphan, a documented
  decision to allow the lapse — never appear.
- The letter is signed by the **agent and the manager side by side**. Asking
  "did anyone from us reach you?" under the single name of the person who may not
  have called is the wrong way round.

Log rows store the question *text* and the answer *label*, not keys — that is
what the engine has always written. `pdDecodeAnswer_` reads them back into keys
via `PD_QKEY_BY_TEXT` / `PD_AKEY_BY_LABEL`, so nothing already in the sheet is
orphaned.

The constants live in `SLA` in `index.html` and `SLA` in
`PremiumDueTemplates.gs`. **Change both** — they are not shared.

Duplicate and churn detection keys on **Client Number**: several policies under
one client on the same plan code flags a possible replacement written over
in-force cover; an active policy alongside a lapsed one flags repeat churn.

## Sign-in and scope

The roster lives in a **`Roster`** tab in the same sheet — name, role, agentId,
code, manager, active. Run `pdSetupRoster()` once to create it.

The browser never receives anybody's code. It fetches `?type=roster` for names
and roles to build the dropdown, posts the typed code to `?type=auth`, and gets
back a signed token. Every read that returns client data carries that token, and
**the server decides what comes back**:

| Role | Sees | Typical payload |
|------|------|-----------------|
| Agent | Their own book, behind the accountability gate | tens of policies |
| Unit Manager | Their unit, resolved down the `manager` column | hundreds |
| ABM | Their whole reporting line | hundreds |
| Sales Support / BM | The whole branch + manager queue + scorecard | all of it |

That scoping is why the payload problem went away as well as the security one —
an agent downloads their own book rather than 3.67 MB of the branch's.

Set `active` to `FALSE` to revoke someone. It takes effect on their next request;
role and scope are looked up fresh each time rather than baked into the token.
Tokens last 12 hours and live in `sessionStorage`, so closing the tab ends it.

Two endpoints are deliberately open, because a client has no sign-in and should
not need one: `?type=roster` (names and roles, no codes) and a survey or
one-click reply POST. Everything else returns `{ok:false, error:'auth'}` without
a valid token, and the engine drops back to the login card when it sees that.

On a staff write the server takes the author from the token and ignores whatever
the browser claimed, so a posted record cannot be attributed to someone else.

The **accountability gate** cuts both ways. An agent with cases past day 65 and
no retention form, or 90-day lapses with nothing logged, must type a commitment
(15 characters minimum) before reaching their dashboard. A **manager with
responses past the 3-day TAT meets the same gate** — an agent who files on
time and waits three weeks has been let down, not the other way round. Either
way the commitment is written to the policy thread under that person's name,
once per policy per day.

## Known gaps

Tracked in the build review; none of these are fixed here.

- **A code is still a shared secret typed into a browser.** Server-side sign-in
  stops code harvesting and out-of-scope reads; it does not stop someone using a
  code they were given, or one they were shown. Google sign-in is the right end
  state if this ever holds more than it does now.
- **The daily send has never run live.** `PremiumDueTemplates.gs` ships with
  `OUT.DRY_RUN = true`, so it writes an `outbound-dry` plan to the log and emails
  nobody. Read a full dry run before setting it false — the book holds ~6,000
  lapsed policies and a misconfigured live run would mail all of them. The cap
  (`MAX_SENDS_PER_RUN`) and the win-back age limit exist for the same reason.
- **Survey links use bare policy numbers**, so anyone who guesses one can file a
  response as that client. Signed short tokens (the `/r/<token>` pattern the
  renewal portal already uses) would close it.
- **The day-88 interaction log is only as complete as the log.** With
  `OUT.ENGINE_URL` blank — the state this ships in — a client's answers arrive as
  email to the branch and never reach `PremiumDueLog`, so the record shows the
  letters we sent and the manager's tapped answers but not the client's replies,
  and the letter will say *"we have had no reply from you"* to someone who did
  reply by email. **Deploy the engine and set `ENGINE_URL` before day 88 letters
  go live**, or route those inbound replies into the log by hand. The manager's
  side is unaffected — managers answer from a link that records directly.
- **The roster covers 25 people; the live book names 89 agents.** 61 of them,
  holding ~3,260 policies, sit outside every agent and unit view, and 8 people
  who appear in `UNITS`/`HIERARCHY` have no code and cannot sign in at all.
- **The branch view truncates at 300 rows** with no indication of what's behind
  it. It already hides lapsed policies by default, so it opens on roughly 4,000 —
  still more than ten times the cap.
- **The engine's `SLA` and the Apps Script's `SLA` are separate copies.** They
  must be changed together; nothing enforces that.
- **`MANAGER_OF` and `STAFF_EMAIL` in the templates file are hand-maintained**
  mirrors of `UNITS`/`HIERARCHY` in the engine. A missing entry means that
  person is silently not copied — no error, just no email.
