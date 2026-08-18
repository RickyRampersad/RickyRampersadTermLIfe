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
| `example-flows.html` | The worked examples: Saira through the dues flow, Javed through the pending flow — every step showing what the client, agent, manager and support each see, with the real letters inline |
| `flow-map.html` | The whole lifecycle drawn out on one page — the two-phase manager handover, every loop and every exit. The picture to put in front of the team |
| `journey-map.html` | The journey, photographed: both flows walked day by day with the real letters and the signed-in engine screens framed at every stage, ending in the three-step pilot checklist |
| `launch-runbook.md` | Go-live checklist with the measured day-one numbers: pre-flight config, the staged rollout (dry run → pilot to one test inbox → live), caps, first week, rollback |
| `letter-preview.html` | The day-45 letter in all six colour schemes, with a picker |
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

**At day 60 the case is handed to the manager in two phases.** First a
*commitment* email — will you call, review the fact find, speak to the advisor,
and when will you report back — copied to the advisor, branch manager and the
client, repeating every 3 days until all four are confirmed. The moment they
are, a one-time thank-you reassures the client and a separate *feedback* clock
begins, following up every 7 days for what actually happened. **At day 90, 95
and 100** the client gets the closing letter, which asks them to rate the
advisor and the manager. See below — and `flow-map.html` for the whole thing
drawn out.

| Stage | Trigger | What's due |
|-------|---------|-----------|
| Overdue | Status 2, 1–44 days | Nothing automated — agent contact only |
| 45-Day | Status 2, 45–59 days | First letter: two questions, answered by tapping |
| 60-Day | Status 2, 60–89 days | **Commitment** to the manager (cc advisor + client) every 3 days until confirmed → thank-you (once) → **feedback** every 7 days · advisor files by day 65 |
| 88 | Status 2, 88–89 days | Short final notice |
| 90 / 95 / 100 | Any status | The closing letter, with service ratings. Three sends, then it stops |
| Win-back | Status 1, from day 110 | Reinstatement, once the closing sequence has finished |
| Pending | Status 3 / underwriting incomplete | New business chase |
| **Group scheme** | Company-owned, any member ≥ 45 days | **One consolidated remittance statement per company**, repeating every 14 days · never the individual ladder |

### Colour — six schemes, one switch

`PD_THEME` at the top of `PremiumDueTemplates.gs`:

| | | |
|---|---|---|
| `navy` | Navy | From the branch website. **Default.** |
| `teal` | Teal | Guardian corporate — closer to head office |
| `charcoal` | Charcoal | Most neutral; closest to a bank statement |
| `burgundy` | Oxblood | Most traditional; reads like a solicitor's letter |
| `forest` | Forest | Warmer than navy without losing weight |
| `slate` | Slate | Most contemporary |

**There is no yellow in any of them**, by instruction. Accents on white use the
scheme's own mid tone; accents on the dark field use its light tint. Colour on
the badge is reserved for the two that mean something — red for the final
notice, green for an account back in order.

Every letter, badge, table header and rule follows it; the crest, the layout and
the wording are shared. All six clear 3.2:1 on every text node.

**`letter-preview.html`** renders the same day-45 letter in all six with a
picker — open it, tap through, choose.

### The letter as a letter

It is laid out as correspondence, not as a notification:

- **Serif masthead** (Georgia) over the carrier in letterspaced small caps. A
  webfont in an email is a webfont that does not load, so both faces are ones
  every device already has.
- **Date, then the addressee block** — name and postal address, from the
  portfolio's `Address` column. This is the single thing that most separates a
  letter from a system email, and the data was there all along.
- **A rule, then the subject in serif**, with the policy number and client
  reference beneath it — the "Re:" line of a real letter.
- **Section headings in serif over hairlines**, not tinted boxes.
- **Options as quiet rows** with a thin left edge in the scheme's mid tone and
  a chevron. The previous version put a coloured slab beside every one of ten
  choices, which is what a form looks like, not a letter.
- **Figures set in serif** at 22px across a hairline strip.
- **A signature block and a branch footer** — name, title, branch, carrier,
  place, telephone, email.

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

Navy field, the branch shield carrying a **checkmark** — the actual mark on
rickyrampersadbranch.com; an earlier draft wrongly used a heart, which is a
different icon on the site — the branch name over **Guardian Life of the
Caribbean · Chaguanas, Trinidad**, and a hairline rule in the scheme's tint.

Top right is a **status badge**: `PREMIUM DUE · 45 DAYS OVERDUE`, in the day
count off the portfolio, going amber at 75 and red at `FINAL NOTICE`. A letter
about a lapsing policy should say what it is before a word of it has been read.

The crest is built from HTML, not SVG. **Gmail strips inline SVG and Outlook
does not render it at all**, so an SVG crest is a blank space in the two clients
most of this book reads mail in. Tint fields take dark type, never white.

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

### Check my case — the client's structured view

A client's **first answer issues a personal access code** (shown on screen the
moment it records, stored in the log row's `code` column). With policy number +
code, **Check my case** opens from the engine's login card or the
`#case=POLICY&code=XXXX` deep link:

- a **progress bar** — *We wrote to you → You answered → With a manager →
  Manager responded → Resolved*
- **the record**, client-safe, in date order
- **a comment box** — posts as `clientnote`, visible to support, the advisor
  and the manager

The backend serves it at `?type=case&policy&code` and refuses any code that was
never issued for that policy; `clientnote` writes are gated the same way. No
staff commentary, no commercial decisions, no other policies in the payload.

**No telephone numbers in client letters**, by instruction — the flow is
structured through the code instead. Every letter carries the tracking block in
place of the old "call us" line; the manager's internal brief still carries the
client's own phone number, because the manager has to make the call. Client
letters are signed **Sasha Lalla — Branch Support, Premium Dues**
(`OUT.SUPPORT_NAME`), with the advisor named beneath.

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

### Day 60 — the handover, in two phases

**The day-60 email is addressed to the manager and copied to the advisor, the
branch manager and the client.** That last one is the design, not an oversight.
Up to day 60 the policyholder is asked to act and hears nothing back but
reminders; from day 60 they watch the branch work — who holds the policy, what
they have committed to, and by when.

It comes in two deliberately separate steps, so a case can never sit and the two
clocks never overlap (`pdManagerLetter_(p, state, {phase})`):

**Phase 1 — the commitment** (`MANAGER_COMMIT`, `phase: 'commit'`). Four things
the manager can confirm the same day, because none of them needs the call to
have happened yet: *will you call this client, will you review the fact find,
will you discuss it with the advisor, and when will you have feedback.* It
carries **the full record so far** — `pdManagerHistory_` attaches the day-45
letter, the reminders and the client's own reply, or says plainly there was
none. It repeats **every 3 days** (`SLA.MANAGER_CHASE_EVERY`), each repeat asking
only what is still blank via `pdOutstandingQuestions_`, and stops the moment all
four are in.

**The thank-you** (`phase: 'ack'`) fires exactly once, the run after the four
are confirmed. It thanks the manager, restates what they committed to, and tells
the client their manager has taken charge and that feedback is now awaited to
bring the policy up to date. It is not a chase and never repeats.

**Phase 2 — the feedback** (`MANAGER_FEEDBACK`, `phase: 'feedback'`). A separate
**7-day** clock (`SLA.FEEDBACK_CHASE_EVERY`) that begins only once the manager
has committed: *did you reach the client, where does the policy stand, the
non-forfeiture position, and where did the fact find land.* The non-forfeiture
answer goes verbatim into the client's day-88 letter.

Because a client reads all of these, the manager's questions are split three ways:

| | Client-copied | The questions |
|---|---|---|
| `MANAGER_COMMIT` | **Yes** — phase 1 | Will you call · review the fact find · discuss with the advisor · when will you report back |
| `MANAGER_FEEDBACK` | **Yes** — phase 2 | Did you reach the client · where does the policy stand · the non-forfeiture position · where did the fact find land |
| `MANAGER_PRIVATE` | **Never** | The commercial decision (including *allow the policy to lapse*), the outlook, and whether the BM is needed |

Putting "allow the policy to lapse — documented" in front of a policyholder as a
menu option would be indefensible. Those three are answered in the engine only.

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

### Group schemes — Servus is one conversation, not sixty-five

The book carries **company-owned schemes**: Servus Limited (222 member policies
on one client number), Bankers Insurance, JMMB Bank and some thirty smaller
employers. One missed payroll remittance puts dozens of member policies "in
arrears" on the same day — and the individual process would get every part of
that wrong: 65 letters into one payroll inbox, a 222-row policy table, 65
tracking codes to one clerk, and at day 90 a company asked to rate its advisor
out of five.

So company-owned policies **never enter the individual ladder**. `pdIsGroup_`
detects them (company-looking name, or a client number in `OUT.GROUP_CLIENTS` —
the roster wins), `pdGroupKey_` folds the spelling variants into one cluster
("Jmmb Bank Limited" / "Jmmb Bank( T & T ) Limited" / "Jmmb Bank (T&T)"), and
`pdStageDue_` / `pdInternalChase_` both refuse them outright. Instead,
`pdGroupChase_` sends **one consolidated remittance statement per company**:

- **Fires when any member policy reaches day 45** (`SLA.GROUP_OPENS`) — a
  scheme at day 20 is a payroll run in transit, and the engine says nothing.
  Repeats every **14 days** (`SLA.GROUP_STATEMENT_EVERY`) while anything stays
  unpaid, logged against `GROUP:<key>` with the same round/cadence machinery as
  every other clock.
- **The statement carries the diagnosis, not just the list**: when most of the
  live block is paid to the same date it says so — *"32 of the 34 are paid to
  exactly 1 July, which reads as one remittance not yet received rather than 34
  separate difficulties."* Members near day 90 drive a red warning; positions
  more than six months in arrears are **counted, not listed** (a reconciliation
  exercise, not this remittance); recent member lapses are flagged while
  reinstatement is still simple.
- **Recipients**: `OUT.GROUP_ADMIN[key]` (the scheme administrator), falling
  back to the **servicing agent** — never to whatever address sits on the
  company's client record, which on this book can be an individual's personal
  mailbox. Agents and branch support are copied; the **branch manager joins
  from the second notice**.
- The engine mirrors all of it: scheme policies are badged *Group scheme*,
  excluded from the manager clocks, the ribbon and the late counts, and get
  their own filter chip — while a missed remittance surfaces in the insights as
  one line per company.

Before go-live, fill in the two maps: `OUT.GROUP_CLIENTS` (client number →
scheme name — at minimum the Servus account) and `OUT.GROUP_ADMIN` (scheme key →
the payroll/administrator email). Real client numbers and addresses belong only
in the deployed copy, never in this public repository.

### The pending flow — a separate clock, never confused with dues

Premium dues and pending new business are **different problems on different
clocks, and the engine never mixes them**. A status-2 policy (cover in force,
premium behind) lives on the 45/60/90 ladder. A status-3 application (no cover
yet) lives on the pending clock: **first letter at day 21, then one per
fortnight to day 120** (`pdPendRound_` dedupes the rounds), and nothing else
ever writes to it.

The pending letter reads the portfolio workbook's own **Requirement
Management** tab (`pdRequirements_`) and names the exact outstanding
document — *"One thing completes your application: Proof of Address —
outstanding 34 days"* — with the ES400 manual's status codes decoded
(`pdPendingMeaning_`): `PCRC`/`PERC` mean **underwriting is complete**, so the
letter says plainly that one paper stands between the client and a policy in
force; suspense money already paid is named as reassurance; a Future Premium
Payment requirement carries the MyGG pay button. No requirement data → the
generic letter still stands.

**Replacement identification** — implemented to GLOC's own
*Replacement/Churn Guidelines* (Sept 2022, V5), supplied by the branch.
The official definition (§6): a policy **issued within 5 years** is
surrendered/lapsed and a new policy is taken on the same policyowner
**within 12 months after** — or the application is made up to **6 months
before** the lapse. `pdReplacementRisk_` flags a pending application beside
in-force cover in the arrears funnel (the before-window forming live) or a
lapse inside 12 months, applying the guideline's exclusions (Xpress Life /
non-adjustable plans, §4.5; replaced policies older than 5 years, §4.1), and
marks the **same-agent** case — 0% commission and 0% production credit if
confirmed (§7.2). Every confirmed replacement requires the signed
**Replacement Declaration Form** with the application, or the case is "Not
Proceeded With" (§9). Surfaced internally only: the digest, the engine's red
pill and insight on both policies — never a client-copied email.

**The structured close:** a policy the engine chased as pending that is next
seen in force gets `nbclose`, once — *"Your policy is in force"*, named by
product, with the received-date-to-issue timeline, MyGG onboarding, and the
agent and manager on the copy line. No application ever just quietly stops
being talked about.

**The Pendings workspace** — every login now carries a *Pendings* tab
(agents get the panel under their book), showing new business from submission
to settled: a pipeline strip (fresh · replacement gate · errors-ours ·
settle-ready · stale) and a work queue ordered by what settles a case
fastest. Each row is a specific action with an owner:

| Priority | Tag | What support does |
|---|---|---|
| 1 | **GATE** | Replacement check — signed Declaration Form + client ID with the application, or Not Proceeded With |
| 2 | **SETTLE** | UW complete — land the one outstanding document and the case issues |
| 3 | **FIX** | Entry errors are ours — correct on Ingenium, no client needed |
| 4 | **COLLECT** | First premium unpaid — MyGG link via the agent, or collect at branch |
| 5 | **CHASE** | Get the named document from the client through the agent, oldest first |
| — | VERIFY | No requirement on file — confirm with underwriting, then log it |

The fortnightly pending letters chase the same items automatically; the queue
is the human push that beats the letter. Scoping is the login's own: an agent
sees their applications, a unit manager their line's, support and the BM the
branch.

**Stats before letters:** `pdPilotStats()` emails one digest of everything
the engine believes — the dues funnel, the schemes, the decoded pending book,
the free-look watch, the week's production — to the test inbox (branch email
once live), writing nothing to the log. It is the pilot's first act and a
daily sanity check: when a number disagrees with what the branch knows, the
letters wait.

### The free-look watch — dispatch to the client's hands

The fourth machine, on a fourth dataset: the **Export** tab's dispatch record.
Head office stamps a `Dispatch Date` the day an issued policy leaves; the
client's free-look window — the Insurance Act's period to read the policy and
return it if it is not what they intended — runs from that day; the
`Acknowledgement Date` is the client's signature saying it arrived. The gap
between those two dates is where policies go to sit in car trunks. On the
live tab, **59% of acknowledged policies were signed for after the window had
already run out**, and 179 were never signed for at all.

The clock, counted in days since dispatch (`pdFlStage_`):

| Day | No acknowledgement on file | Acknowledgement on file |
|-----|---------------------------|------------------------|
| 0–4 | `fl_dispatch` — the welcome: dispatched, expect it, here is what the free-look provision is | same letter — it teaches the window even when delivery was same-day |
| 5 / 10 / 15 | `fl_remind` — "has it reached you?", each round a shade firmer, 3-day catch-up windows | quiet — the ladder stopped the moment the date was filled in |
| 18 / 19 | `fl_final` — daily countdown: "closes in 2 days", "closes tomorrow", naming that the policy is sitting with the advisor | quiet |
| 20 | `fl_final` round 3 — the window has closed **and no delivery was ever recorded**: said plainly, branch manager copied, "our problem to fix, not yours" | `fl_end` — delivered on the signed date, window ran its course, welcome aboard |
| 23+ | **nothing mails** — an expired window is a management case; the digest carries those names, grouped by servicing agent | — |

Every letter goes to the **client**, with the advisor, their manager, the BM
and branch support copied — a policy rotting in a bag is visible to five
people from day 5, which is the entire point: the rationale is catching the
agents who fail to deliver, and doing it in front of everyone before the
client's window burns out rather than in an audit afterwards.

Rails, same as everywhere: one-tap answers in every letter ("it is in my
hands" / "it has not arrived" / "I have a concern"), rounds deduped in the
log so a rerun cannot double-send, group-owned dispatches skipped entirely
(members are never written to), the pilot gate and the three-key interlock
apply unchanged, and `FL_MAX_DAYS` keeps launch day from writing to the
year-old backlog — those 162 cases surface in the digest only. Column lookup
is by header name and tolerates both spellings of "Acknowledgement" plus the
tab's own "Servcing Agent Name"; staff lookups match names case-insensitively
because the Export tab writes the same humans in capitals.

### How the handover fires

**Day 60 sends the client no letter of their own** — it drives the *manager*
thread, and asks them to telephone. `pdInternalChase_` runs the two phases,
logging each send as `mgr-commit`, `mgr-ack` or `mgr-feedback`, and it fires
**whether or not the agent has filed a retention case**.

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
| Manager commits | 3 working days from the **handover** | Commitment email every 3 days, BM copied; hits **their** sign-in gate; an empty record shows in the client's day-88 letter |
| Manager reports back | 7 days from the commitment | Feedback follow-up every 7 days; the feedback is what becomes the client's day-88 record |
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
