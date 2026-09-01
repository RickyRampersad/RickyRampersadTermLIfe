# Branch Intelligence — setup and what it actually does

Two pieces, the same shape as the KPI tracker:

| Piece | Where | What it does |
|---|---|---|
| `intelligence/index.html` | served with the rest of the site, at `/intelligence/` | sign-in, and the ten screens |
| `intelligence/manual/index.html` | `/intelligence/manual/` | the manual everyone reads — plain language, no setup in it |
| `apps-script/Intelligence.gs` | bound to the branch workbook | reads the tabs, computes everything, checks access codes, sends the digests |

**This file is for whoever installs it.** Staff and agents get
`/intelligence/manual/` instead — same system, none of the deployment.

The workbook is `1T1SG3mgs5QV5LuF3JTpmn1zFldhGjOQNoe0YCMhWxjs`. Five questions
get asked of it every week and none of them could be answered from it directly:

1. Which premiums are actually going to lapse, and whose are they?
2. What is stuck in pending business, and what requirement is stopping it?
3. **Who is chasing it — and which cases has nobody ever chased?**
4. Which policies mature soon — pensions and life, separately?
5. Which term benefits and conversion rights expire before anybody notices?

### It reads six tabs, and only six

| What it needs | The columns it finds it by |
|---|---|
| Premium dues | `Agent`, `Client Number`, `Premium`, `Status Description` |
| In-force book | `Policy Id`, `Policy Maturity Date`, `Plan`, `Fund Value` |
| Pending business | `Policy`, `DecisionType`, `ReqtdaysLapsed` |
| Requirements | `insured_requirement_id`, `requirement_code`, `policy_number` |
| Tasks (the chase log) | `Subject`, `Task Type`, `Days O/S` |
| Access | `Email`, `Name`, `Role` + a code or password column |

**Everything else in the workbook is ignored, and deleting it is safe.** Tabs
are found by the columns they carry, not by their names or their positions, so
removing a tab the app does not read changes nothing — and removing the empty
duplicates actually makes the search more reliable, because the tie-break
between two qualifying tabs goes away.

If a tab the app *does* need is ever removed or renamed past recognition, the
screen for that domain says so plainly rather than showing zero.

---

## 1. What the review found

The tool this replaces worked, and three things about it needed fixing before
anything was added.

### There was no sign-in

The old dashboard was a single HTML file behind an unguessable URL and a
`noindex` tag. Anyone with the link got 20,392 client records — names, phone
numbers, e-mail addresses, home addresses, premiums and policy numbers. A link
pasted into a WhatsApp group is a link that has left the branch.

### The client book was baked into the file

The file carried four `<script type="application/octet-stream">` payloads —
about 2 MB of gzipped, base64-encoded client data, including the whole dues
extract. Compression is not protection; it decodes in three lines of script.

**That file must never be committed to this repository.** Every file on `main`
is served publicly at rickyrampersadbranch.com. The README says client data has
already had to be purged from this history twice.

The new app carries no data at all. Everything on screen arrives from Apps
Script after a sign-in, narrowed to what the person signing in may see, and is
gone on refresh.

### `/sheet.csv` needs the workbook world-readable

The old proxy required the workbook to be shared *Anyone with the link —
Viewer*. That share applies to the **whole workbook**, not the one tab the
proxy names: 46,000 client addresses, 9,900 client records with dates of birth,
and the Access tab with everybody's sign-in code in plain text. The workbook ID
sits in `netlify.toml`, which is in the repository.

Apps Script reads the workbook with the *owner's* permission, so once the app
is live the workbook can go back to being private. Do that.

### Access codes

Run `intelSelfTest()` and it reports how many codes are weak. Several are a
single digit. `intelIssueCodes()` replaces every weak one with a ten-character
code and prints the list to hand out; codes that are already strong are left
alone, so nobody gets re-issued twice.

---

## 2. Put the script in the workbook

1. Open the branch workbook → **Extensions → Apps Script**.
2. Add a file called `Intelligence.gs` and paste in everything from
   `apps-script/Intelligence.gs`.
3. **Project Settings → Time zone → `(GMT-04:00) Atlantic Time`.** Every
   trigger and every date reads from this. Getting it wrong moves the 2 a.m.
   rebuild and can push a maturity onto the wrong month.
4. Run **`intelSelfTest`** from the function dropdown. Authorise when Google
   asks — it is your own script in your own workbook.

The self test prints which tabs it resolved, which access lists it found, how
weak the codes are, and — the important one — **whether this project already
has a `doGet`/`doPost`**.

### If the project already has a router

A script project may declare `doGet` and `doPost` exactly once, and a second
declaration silently wins. If `BranchEngine.gs` is in the same project:

- **Delete** the `doGet`/`doPost` block at the very bottom of `Intelligence.gs`
  (it is marked, and it is the last thing in the file).
- Add one line inside the existing `doPost`, straight after it parses the body:

  ```js
  var hit = intelRoute_(b); if (hit) return hit;
  ```

`intelRoute_` returns `null` for anything that is not an `intel.*` action, so
the rest of that function keeps working exactly as it did.

If the self test says no other router was found, leave the block where it is.

---

## 3. Deploy and point the site at it

**Deploy → New deployment → Web app**, Execute as **Me**, Who has access
**Anyone**. Copy the `/exec` URL.

The app lives at `/intelligence/`, alongside `/kpi/`, `/claims/` and
`/renewal/`. The Branch Intelligence landing page currently offers a *Legacy
dashboard (analysis tools)* button pointing at `/legacy.html` — repoint that at
`/intelligence/`, and **take `legacy.html` down**. It carries about 2 MB of
embedded client data and no sign-in; see section 1.

Two places take it:

- `intelligence/index.html`, the `API` constant near the top of the script.
- Script Properties, `INTEL_APP_URL` = `https://rickyrampersadbranch.com/intelligence/`
  — the address the digest e-mails link back to.

Then run **`intelSetup`** once. It creates the working tabs, does the first
rebuild, installs the four triggers and prints the self test.

Every code change needs **Deploy → Manage deployments → Edit → New version**.
Saving the file is not deploying it.

### Script Properties worth setting

| Property | What it does |
|---|---|
| `INTEL_MANAGER_EMAIL` | who the Monday digest goes to. Commas for several. Unset, it goes to everyone with a manager-ish role on an access list. |
| `INTEL_APP_URL` | the address the e-mails link to. |
| `INTEL_TEST_TO` | **test mode.** Every message goes here instead, subject-tagged `[TEST]` and banner-marked with who it was really for. Agents and clients cannot receive test traffic while this is set. |
| `INTEL_TAB_DUES` etc. | point a domain at a named tab if the column search ever picks the wrong one. Keys: `DUES`, `INFORCE`, `PENDING`, `REQS`, `TASKS`, `ACCESS`. |

---

## 3a. The one screen that does not read the cache

**Find a client** goes to the workbook live, and it is the only part that does.

The cache holds lists — overdue premiums, maturities, leads. A client's
policies mostly are not on any of them: a premium paid on time is on no list at
all. So the lookup reads the dues book directly, then enriches from the
in-force book, pending business, requirements and the action log. It is a
little slower than the other screens and the answer is current rather than last
night's, which for a phone call is the right trade.

It searches on a name, a policy number, a client number, a phone number or an
e-mail — whatever the caller happens to give. Several matches return a
shortlist; one match returns the whole picture.

**Searching by policy returns the client, not the policy.** Somebody reading a
number off a letter still wants their other eighteen policies, so the lookup
widens from the row that matched to every row that client has.

Scoping is the same as everywhere else and applies to the shortlist as well as
the record: an agent finds their own clients. A client whose policies all sit
on another book does not appear at all — being told a client exists but is
withheld is itself the disclosure. Where a client is shared across two agents,
the agent sees their own policies and a **count** of the others, so nobody is
misled into thinking they have the whole picture.

## 4. How it is put together

A nightly trigger reads every source tab once, computes all five domains, and
writes the result to a hidden `_Intel Cache` tab as JSON. The web app only ever
reads the cache.

That indirection is not decoration. The requirements extract alone is 66,000
rows; recomputing it inside a page load times out. The rebuild takes a couple
of seconds against the whole workbook and a sign-in is instant.

The rebuild also writes five ordinary tabs — `Watchlist — Dues`, `— Pending`,
`— Requirements`, `— Maturities`, `— Expiry` — carrying exactly the figures the
app shows. Anyone who would rather sort in Sheets can, without a sign-in.
**They are rebuilt from scratch every night, so nothing typed into them
survives.** Decisions go in `Intel Actions`, which is never overwritten.

### Tabs are found by their columns, not their names

The branch renames tabs. The KPI tracker learned that expensively. Every lookup
here searches for the columns a tab carries, and where two tabs qualify the
fuller one wins — the workbook keeps empty duplicates of several extracts, and
reading one of those reports "nothing outstanding".

Header cells are trimmed before matching. The Access tab's first header is
literally `"Email "` with a trailing space, and an untrimmed lookup misses it,
which locks out everyone on that tab.

### Who sees what

There are **two** access-looking tabs — one with an *Access Code* column, one
with a *Password* column — and the branch uses both. Sign-in searches every
list and accepts either column, so nobody is locked out by which tab they
happen to be on. People sign in with their Guardian e-mail, their agent number,
or the name beside it.

The Role column decides. Manager, admin, support, assistant, BMA and branch see
the whole branch; everyone else sees their own book.

**The filtering happens on the server, before anything is serialised.** An
agent's response contains their rows and nobody else's — including every
derived figure. Their ageing bands, their suspense, their requirement ages are
recomputed from their own rows, not carried over from the branch. Hiding rows
in the browser is not hiding them.

Agent names are matched loosely, because the extracts disagree with each other:
`Meera Persad-Khan` in the dues tab, `MEERA PERSAD KHAN` in the in-force book,
and `GARY SOOKDEO INSURANCE SOLUTIONS LTD` against `Gary Sookdeo` for the same
person. Surname plus first initial is the test.

### Some agents are a company, and no name test finds them

Three of them, and they are the branch's three most senior people:

| Code | In the in-force book as | Is |
|---|---|---|
| `A00427` | ADVANCED INVESTMENTS MANAGEMENT LIMITED | Ricky Rampersad |
| `A01363` | ARCHITECTS FOR INSURANCE & FINANCIAL SERVICES LTD | Kerwyn Ramroach |
| `A06869` | EXPERT ADVISORS COMPANY LTD | Akaash Kalladeen |

No amount of cleverness gets from "Ricky Rampersad" to "Advanced Investments
Management Limited". Before this was handled, each of the three saw their dues
book — which is filed under their own name — and **none of their in-force
book**: no maturities, no expiring cover, no cross-sell leads, and a fund-held
figure of zero against a real TT$3.5m. Their monthly e-mails went out empty.

The agent code joins them, and the workbook holds both halves: the in-force
book has code → agency name, the access lists have code → person. `intelRebuild`
joins those two every night into an alias table — **33 groups** on the current
book — and scoping consults it. Nothing is hard-coded, so an agency Guardian
adds next year is picked up on the next rebuild with nothing typed in here.

Relying on the agent number alone would not have been enough: Ricky's row on the
96-row access list carries no number at all, and that tab has no number column.
The alias comes from the data, which is why it works for him.

Sessions last 12 hours and the token lives in `sessionStorage`, not
`localStorage` — a refresh keeps you signed in, closing the tab does not. These
are shared machines.

---

## 5. The automations

| Function | When | What it sends |
|---|---|---|
| `intelRebuild` | 02:00 nightly | nothing — recomputes everything, and fingerprints the book so tomorrow can tell what moved |
| `intelAgentDigest` | 07:00 weekdays | what lapsed overnight, arrears past 60 days, pending cases holding money, and follow-ups they said they would make |
| `intelManagerDigest` | 07:30 Monday | the branch's week: overnight movement, ageing, billing-method failure, the agent league, what is coming, and the data-health panel |
| `intelHorizonWatch` | 08:00 on the 1st | maturities within 18 months and conversion rights within 3 years, to the servicing agent |
| `intelCrossSellDigest` | 08:00 on the 8th | ten clients worth a call, with the opening question for each |

An agent with nothing outstanding is **not** mailed. A digest that arrives
empty stops being read.

`intelManagerDigest` writes a row to `Intel Trend` each week, which is where
"the chase list grew by 40 since last Monday" comes from. That line appears
from the second Monday onward.

### What moved overnight

The rebuild sees the book fresh each night and has no memory of yesterday, so a
policy that slid from overdue to lapsed looks exactly like one that was always
lapsed. Nobody notices, and the reinstatement window shortens while they don't.

So each rebuild leaves a fingerprint — policy number against a one-letter
status — on the hidden `_Intel State` tab, and the next one compares. Out of
that comes newly lapsed, slipped into arrears, came good, new pending, and
policies that left the extract entirely (usually a surrender nobody mentioned).

The fingerprint is on a tab rather than in Script Properties, which caps at
9 KB and would truncate silently at about a tenth of this book. **The first
night after installing produces no movements** — there is nothing to compare
against yet. They appear from the second night.

---

## 6. Reading the numbers correctly

### Premium is modal, not annual

The `Premium` column is **one instalment**. The `Mode` column that would say
which frequency — monthly, quarterly, annual — is **empty in all 20,392 rows**,
so the book cannot be annualised, and this app never pretends otherwise.

Confirmed rather than assumed: where a dues row joins the in-force book, its
`Premium` equals that policy's `Modal Premium` exactly, and the `Annual
Premium` beside it is about twelve times larger.

Summing the column and calling it annual premium understates monthly business
roughly twelvefold. The figure means nothing at all — which is the same shape
as the mistake that once produced a branch "cover recommended" total of
TT$121m.

**Ask Guardian to add `Mode` to the export.** It is one column and it unlocks
the only figure the branch actually wants.

### The status codes are not self-explanatory

| Status | Means | In the app |
|---|---|---|
| `0` | no premium problem — read `Status Description` | not a dues case |
| `1` | Lapsed | reinstatement, not collection |
| `2` | **Overdue and still premium-paying** | the collectable book |
| `3` | Pending, underwriting incomplete | pending business |

Status `2` carries the Status Description **"Premium Paying"**. A filter on the
description misses every case that matters. It is the single easiest mistake to
make in this workbook.

The chase list is Status `2` past **31 days** — below that a premium is inside
its grace period and chasing it annoys a client who is not late.

### Only life cover counts as life cover

The classification table in `Intelligence.gs` (`IPLANS`) is deliberately
explicit, because three plans in this book read as life and are not:

- **`LIFE SECURE` / `LIFSECURE CO`** — deferred annuity, a savings target
- **`PA DTH/DIS`** — personal accident, pays a monthly income
- **`EVOL - CRIT`** — critical illness, reimburses on diagnosis

None is payable on death, so none is ever added to a sum-assured total. They
appear under *Expiring cover*, because they end.

A plan not in the table comes back **unclassified** and is counted separately
rather than guessed at. Add plans from the product sheet as Guardian adds them;
do not widen the prefixes.

### Pending age is recomputed

The pending tab's own `ReqtdaysLapsed` reaches **8,128** — a stale cell, not a
case that waited twenty-two years. Age is measured from the requirement and
submission dates, and anything over ten years is shown as unknown rather than
as a number.

### Requirements are counted once

The requirements extract repeats a requirement once per history row. Counting
rows makes the open list four times worse than it is, so each
`insured_requirement_id` is taken once. Open means no `closed_date`.

### Cross-sell is scored on whether the call will happen

Every client is measured against what they already hold. Measured on the
branch's own 2,153 in-force clients before any of the rules were written:

| | |
|---|---|
| hold exactly one policy | **1,780** (83%) |
| hold life cover and no retirement plan | **1,249** |
| hold a retirement fund and **no death benefit at all** | **357**, carrying TT$31.6m of fund value |
| hold term cover and nothing permanent | **311**, covering TT$429m |
| hold no critical illness or accident benefit | **1,963** (91%) |

Six rules fire off those. Four are **call lists** — small and sharp. Two are
**campaigns** — they cover most of the book and are a mailing, not a phone list;
the app labels which is which.

A client appears **once**, under their strongest reason, with the others riding
along as "also needs". A name repeated six times is a list nobody works.

The score is out of 100 and it is mostly about whether the call will happen:
the sharpness of the gap is worth up to 40, and being reachable, paid up, the
right age and demonstrably able to afford it is worth the other 60. Two
conditions score zero rather than low, because they are not leads:

- **no phone and no e-mail** — nothing can start
- **more than 30 days behind on what they already hold** — that is a
  collections call, and pitching them is how a branch loses both

The reasons travel with the score, so an adviser can see why a name is near the
top instead of being asked to trust a number.

**The caveat is on every screen and in every e-mail, and it is not decoration.**
These are gaps in *this branch's* in-force book. A client shown without a
retirement plan may hold one with another company, another branch, or through
their employer. An adviser who opens with "you have no retirement plan" will be
wrong roughly as often as the branch's share of that client's wallet. The
opening question the app supplies asks instead of telling, every time.

To add or change a rule, edit `IXSELL_RULES` near the top of the cross-sell
section. Each rule declares who it fires on, why it matters, the question to
open with, what number to show, the age band it suits, and its weight.

### The lists fold into clients

Nearly half the chase list is the same client twice or more — 2,536 policies
across 1,838 clients — and the worst of it is corporate: one scheme carries
**34 policies behind one phone number**, another 24, another 22. Worked as
policies, an agent rings the same company all afternoon.

So the chase list, the unreachable list and the three movement lists all carry
a **Group into clients** toggle. Folded, a row is one client: how many policies,
the total instalments, the worst arrears among them, every billing method in
play and every policy number, so the whole conversation is on one line. The CSV
follows whichever view is on screen.

### Three chase states, not two

The Tasks tab is the branch's own record of chasing head office — every row is
a follow-up on a pending case. The policy number sits inside the Subject line
rather than in a column, so it is pulled out with a pattern and joined to
pending business. That join answers the question nothing else in the workbook
can, and it has **three** answers, not two:

| State | Means | What to do |
|---|---|---|
| **Being chased now** | an open follow-up task names this policy | wait, or ask the person named |
| **Chase closed, case open** | somebody chased it and closed the task, but the case is still pending | find out why — closed too early, or the case moved and nobody updated it |
| **Never chased** | no task, open or closed, has ever named this policy | raise one |

Collapsing the last two into a single "unchased" number hides the difference,
and they need different actions — so they are counted separately.

The chase log itself is staff business. An agent sees the chase marks on their
own cases and nothing else.

---

## 7. What is wrong with the extract

Every figure below was measured on the live workbook, not estimated, and is
shown on the app's **Data health** screen so a manager can see the size of the
doubt without asking anybody.

| What | Rows | Why it matters | Where it gets fixed |
|---|---|---|---|
| Policy numbers as `5.00E+09` | 107 | Excel's scientific notation destroyed the digits. These rows cannot be matched to a policy at all. | Format the Number column as **Plain text** before the export is pasted |
| `Mode` column empty | 20,392 | the book cannot be annualised | add `Mode` to the export |
| `Paid To Date` as `##########` | 2,612 | a column too narrow at export; the date is not recoverable | widen it, or export CSV rather than copying off the screen |
| `Projected Lapse Date` as `30 Mar 1900` | 2,612 | spreadsheet epoch zero — an empty cell that looks like a date. Sorting on it puts the real lapses last. A few rows hold a status word in the date column instead. | leave it blank when there is no date |
| E-mail with a space inside | 2,745 | `NAME@GMAIL.CO M` — a line wrap baked in. These bounce. | strip spaces on export; the app already ignores them when mailing |
| Chase-list clients with no phone **and** no e-mail | 351 | no collection effort of any kind can start | *Dues → Nobody can reach these* |
| Requirements open over a year | 869 | usually cases that ended without anybody closing the record | close what is dead so the live list is believable |
| Servicing agent inactive or vested | 152 | nobody is calling those clients — and some of them are maturing | reassign servicing on the Guardian record |

Two columns, `APLamount` and `Amount Billed`, are zero in every row, and
`Send Y or N` is empty in every row. Nothing reads them.

### Why rider expiry comes from the in-force book

The obvious home for rider expiry is the coverage extract — 44,595 `CVG_*`
records. It cannot be used:

- `CVG_AD_XPRY_DT`, the accidental-death expiry, is **zero in every row**
- `CONN_POL_ID` is filled on **171 of 44,595 rows**, so there is no policy key
  to join on

`CVG_CNVR_XPRY_DT` does hold 1,406 real conversion-expiry dates and they are
unusable for the same reason: nothing says whose they are.

Expiry therefore comes from the in-force book, where the plan name and the
maturity date are both present and both joinable. That is plan-derived rather
than per-coverage — good enough to run the conversation, not good enough to
quote from.

**If that extract is ever re-pulled, ask for `POL_ID` and `PLAN_ID` in it.**
One change, and per-rider expiry becomes exact.

### The dues sheet and the in-force book barely overlap

2,625 of 20,392 dues rows join the in-force book, and only **3 of the 2,533**
chase-list policies do. They are different populations: the in-force book is
what is current and paid up, the dues extract is largely what is not. Do not
expect a figure from one to reconcile against the other.

---

## 8. When something looks wrong

Run **`intelSelfTest`** first — from the editor, or **Branch Intelligence →
Self test** in the workbook menu. It names the problem in a sentence.

| Symptom | Usually |
|---|---|
| "No intelligence has been built yet" | `intelRebuild` has not run. Run it, or wait for 2 a.m. |
| A whole screen says "not found" | the tab search matched nothing — set the `INTEL_TAB_*` property for that domain |
| "That login and code do not match" | the code, or the row is marked inactive. The message is deliberately the same for a wrong code and an unknown person — telling them apart tells an outsider which logins exist |
| Sign-in works, screens are empty | the person signed in as an agent and their Agent Name column does not match the extracts. Check the spelling against the dues tab |
| Digests arrive an hour out | the project time zone is not Atlantic Time |
| Digests do not arrive at all | `INTEL_TEST_TO` is still set, or the triggers were never installed |
| A number changed and nobody knows why | the cache is rebuilt nightly; `Intel Trend` has the week-by-week headline figures |
