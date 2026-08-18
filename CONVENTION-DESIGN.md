# Convention 2028 Tracker — design & recommendation

*24th Overseas Sales Convention — Trinidad & Tobago agents' rules.*
Production period **1 Apr 2026 → 30 Sep 2027**. Persistency held to **31 Mar 2028**.

This document answers one question before any code is written: **where should this
live?** Then it sets out what the tracker actually has to compute, because the
rules are stricter than they first look and a tracker that gets them wrong is
worse than no tracker at all.

---

## 1. The recommendation, in one line

**Build it as a module of the Agent Portal in this repository — `/convention/`,
on its own Apps Script backend and private Sheet — not inside FactFind360, and
not as another standalone site.**

### Why not inside FactFind360

FactFind360 is the wrong host for three independent reasons, any one of which
would be enough.

**Audience.** FactFind is a surface a *client* sits in front of — the agent opens
it beside the client and enters that client's needs, dependants and shortfall.
Convention data is the opposite: an agent's own commissions, their lives count,
their persistency, and their rank against colleagues. Putting agent earnings and
a league table behind the same door a client walks through is a confidentiality
problem waiting for the one afternoon somebody hands over the tablet.

**Lifecycle.** FactFind is evergreen — the arithmetic of a needs analysis does
not expire. This convention is a fixed 18-month cycle with hard-coded dollar
targets and dated deadlines, all of which die on 31 Mar 2028 and are replaced by
different numbers for the 25th convention. Convention logic embedded in FactFind
becomes dead weight inside a tool that has to keep working afterwards.

**Data source.** FactFind's inputs are what the agent types about a client.
The tracker's inputs are net FYC, settled lives and persistency — figures that
come off Guardian production statements. There is no overlap in the upstream, so
there is no integration to be gained; only two unrelated schemas in one codebase.

### Why not a tenth standalone site

You already run roughly ten separate properties — xpresslifett, healthquotee,
personalaccident, employeebenefitstt, querymypolicies, donthaveanagent,
agentmgt, careerpathrrb, factfind360, plus this site. Another domain means
another sign-in to remember, another certificate and DNS entry to keep alive, and
another bookmark that competes for the same attention.

It would also be the *least* visited of the ten. An agent has no reason to open
`conventiontracker.com` on a Tuesday. They do have reason to open the Agent
Portal — it is where contracting, licensing, premium dues and the monthly review
already are. Putting the tracker there means the standings are seen in passing,
every time an agent goes for something else. For a tool whose entire job is
motivation, being *seen without being sought* is the whole game.

### Why the Agent Portal, specifically

`agent.html` is already the branch's agent-facing front door, grouped into
Contracting & Licensing, Daily Work & Reporting, and Group & Corporate. Convention
standing belongs beside Monthly Performance Review and Premium Dues — it is the
same job, on a longer clock.

The repository also already has the pattern this needs, twice over:

- `apps-script/Code.gs` — per-person access codes off a `Staff` tab, an `Activity`
  trail that logs every sign-in, scheduled daily automation, and a dashboard fed
  by `google.script.run`.
- `apps-script/Market.gs` — salted SHA-256 PINs, attempt lockout, single-session
  tokens, and a **live shared leaderboard**, which is precisely the "where do I
  stack up" mechanic, already built and already working in `market/`.

The tracker is `Market.gs`'s auth and leaderboard with `Code.gs`'s reporting, over
a different set of numbers. That is a module, not a product.

---

## 2. One thing to fix first: the access codes

`agent.html` gates on a code held in client-side JavaScript:

```js
var CODE = 'AGENT2026';     // agent.html
var CODE = 'STAFF2026';     // staff.html
```

Anyone who opens View Source sees it. That is an acceptable weight for what those
pages currently hold — a directory of Jotform links, all of which are reachable
by their own URLs anyway.

**It is not adequate for this module.** The convention tracker holds every agent's
commission figures and ranks them against each other. One shared, publicly visible
code means any agent — or anyone who ever had the link — can read everybody's
earnings.

So: the portal keeps `AGENT2026` as the front door, and `/convention/`
authenticates *separately and per-agent*, using the `Market.gs` scheme already
proven in this repo — name plus a personal PIN, salted and SHA-256 hashed before
it touches the Sheet, five attempts then a fifteen-minute lockout, one live
session per person. An agent sees their own numbers in full; they see everyone
else only as the leaderboard chooses to show them (see §6).

Related, and worth doing in the same pass: `CONFIG.STAFF_KEY` in `Code.gs` is
correctly marked `CHANGE-ME-in-Apps-Script-only`, and the note says the previous
value was published and must be treated as burned. Confirm a fresh key was
actually set in the deployed script.

---

## 3. What the tracker must compute

The rules have more edges than a progress bar can express. These are the ones
that decide whether an agent travels.

### 3.1 Two gates, not one

Every category carries **both** a net FYC target and a **minimum lives** count,
and both must be met. An agent on $700,000 with 55 lives qualifies for nothing.

| Category | Net FYC | Min. lives | Max. from Health/Group (15%) |
|---|---:|---:|---:|
| Agent (Shared) | 525,000 | 90 | 78,750 |
| Agent (Own) | 675,000 | 90 | 101,250 |
| Agent & Spouse (Double) | 925,000 | 80 | 138,750 |
| Agent Single (Business Class) | 1,600,000 | 60 | 240,000 |
| Agent & Spouse (Business Class) | 2,100,000 | 60 | 315,000 |
| Aspirant | 325,000 | 67 | 48,750 |

Highest producer above $1.6M FYC takes superior accommodation.

Note the shape of it: as the money goes up the lives requirement comes *down*.
An agent writing large cases climbs the money ladder quickly but can sit stuck
below 90 lives — meaning the same person may clear Business Class money while
failing Shared. The UI has to make this visible, so **every category shows two
bars and qualifies only on the lower of the two.**

**A life** is any Life Assured, existing or new, sold a policy or an increase
within the period. The same life is never counted twice, **but the FYC from the
repeat business still counts.** So lives is a `COUNT(DISTINCT life_id)`, never a
count of policies — the single most common way a tracker like this ends up lying
to people.

### 3.2 The 15% Health & Group ceiling

At most 15% of the production quota may come from FYC on new Group and Individual
Health and Group Life premiums, measured on premiums received as at 30 Sep 2027.

This needs its own meter, not a footnote. An agent writing group health hard can
be building production that will not count, and will only find out at the end.
The meter should read *"$61,400 of your $78,750 Health/Group allowance used —
further group FYC will not count toward Shared."*

Because the ceiling is a percentage of the *category* quota, it moves as the agent
targets a different tier. Compute it against the category currently being tracked.

### 3.3 Persistency — a gate that stays open six months past the finish

87.5% or higher at **30 Sep 2027**, and *maintained* at **31 Mar 2028**. It is
calculated as total API in force at 31 Mar 2028 against gross API submitted and
settled within the production period, and net lapses count only business from
inside that period.

Two consequences the tracker must carry:

1. **Production does not end the race.** An agent who hits target in September
   2027 can still lose the trip in March 2028 through lapses. The tracker stays
   live through 31 Mar 2028, and after 30 Sep 2027 it switches from a production
   dashboard to a **conservation dashboard**.
2. **Show headroom in dollars, not just a percentage.** "94.2% persistent" tells
   an agent nothing actionable. *"You can absorb $18,300 more lapsed API before
   you fall below 87.5%"* tells them exactly how much they can afford to lose,
   which is the number that makes someone pick up the phone.

Health and Group Life is reviewed on the same block at 31 Mar 2028, with
adjustments if premiums decrease — so group business carries persistency risk too.

### 3.4 Early Bird — the live deadline

$540,000 FYC (single) or $740,000 (double), settled **1 Apr 2026 → 31 Dec 2026**,
earns the side trip to Turkey — subject to still qualifying at the end of the
convention period.

This is the most urgent thing on the board today, and by a wide margin:

- Production period: **547 days**. About 25% elapsed, ~408 days left.
- Early Bird window: **274 days**, of which only **135 remain**.

An agent needs to be near $273,000 *right now* to be on pace for the single Early
Bird. That gap, expressed as *"$1,971 of FYC per day, every day, to 31 December"*,
is the most motivating number the app can put on a screen this year. It should be
the first thing the page shows until 31 Dec 2026, then retire itself.

### 3.5 Aspirant — and a discrepancy to raise

$325,000 FYC and 67 lives, for agents who have never qualified or have not
qualified in the last three conventions, and who have not previously come as an
aspirant. **Only the top five** qualifying agents attend; persistency of 87.5% at
31 Mar 2028 applies and is monitored up to departure, with the next in line
replacing anyone who falls short.

⚠️ **The source document is internally inconsistent here.** It describes the
aspirant target as "75% of Shared Qualification". 67 lives is 75% of 90 rounded down (67.5) —
but $325,000 is 62% of $525,000, not 75% ($393,750 would be). The explicit figure
should govern, so the tracker uses **$325,000**, but this is worth a note to the
Convention Committee before any agent plans a year around it.

The "top five" rule also changes what the tracker owes an aspirant. Hitting the
number is not qualification — being in the first five who hit it is. So an
aspirant's screen needs a **rank among eligible aspirants**, not just a progress
bar, and it needs to show the sixth-place agent breathing behind them.

### 3.6 Disqualifiers that no amount of production overrides

Three rules can end a qualification regardless of the numbers, and each deserves
a visible status chip on the agent's own page rather than being buried:

- **Financial standing.** Any debit balance must be *actively serviced*; only
  agents in positive standing may attend.
- **Market conduct.** A Code of Ethics breach or any unresolved formal complaint
  during the qualification period could disqualify, notwithstanding production.
- **Contracted at the time of the Convention.** An agent not contracted when the
  convention is held is ineligible for attendance *and* for any cash payment.

And one that reaches into the next cycle: **Lapse, Not Proceeded With, Not Taken,
Postponed or Declined cases from this convention's block are deducted from the
production of the *following* convention.** Whatever the tracker records now
becomes the opening liability of the next one, so the data model should keep case
outcomes rather than only totals.

FYC credits may not be transferred between agents; discovery means the cases are
disallowed and disciplinary action follows. The tracker should therefore never
offer an "assign credit" affordance of any kind.

### 3.7 The deadline calendar

These are attendance-critical and mostly cluster in January 2028. The app should
carry them as a countdown list that surfaces from late 2027:

| Date | What is due |
|---|---|
| 1 Jan 2028 | Hall of Fame confirmation of attendance |
| 14 Jan 2028 | Requests for special consideration |
| 31 Jan 2028 | Written confirmation of attendance |
| 31 Jan 2028 | All travel documents to the Committee |
| 31 Jan 2028 | Valid passport — 6 months' validity, 6 blank pages |
| 31 Jan 2028 | Request to pay for spouse/guest (Own category, or Hall of Fame in Shared) |
| 31 Mar 2028 | Payment for self-funded guests; persistency re-measured |

Missing the 31 January document deadline is read as no longer being interested in
attending. That is a hard loss after eighteen months of work, and it is exactly
the kind of thing an app should refuse to let happen quietly.

---

## 4. Where the numbers come from

This is the part that decides whether the app is trusted, and it deserves more
thought than the UI.

Recommended: **two layers, always shown separately.**

**Official (authoritative).** Net FYC, settled lives and persistency, pasted or
imported monthly from the Guardian production statement into the private Sheet by
you. One writer, one source, no argument. Every import stamped with its statement
date so the page can say *"official figures as at 31 July 2026."*

**Pipeline (provisional).** What each agent has submitted but not yet settled,
self-entered — the branch already runs on Jotform, so this can be an existing
form writing to the same Sheet. Shown in a distinct, visibly-provisional style and
**never** counted toward qualification, only toward a projection.

Two layers rather than one because each alone fails. Official-only is accurate but
a month stale, so it feels dead and nobody opens it. Self-report-only drifts
upward and quietly turns the leaderboard into fiction. Together they give an agent
a live picture — *"$312,400 settled, $84,000 in the pipeline"* — while keeping
qualification anchored to the only figures that actually decide anything. Each
monthly import reconciles the pipeline automatically: anything that settled moves
across, and anything still sitting there after 90 days gets queried, the same way
`Code.gs` already chases stalled renewal instructions.

---

## 5. Data model

New tabs in a **private** Sheet — a separate spreadsheet from the renewals book is
cleaner, since the audience and the retention are different.

- **`Convention Agents`** — agent id, display name, PIN hash, salt, category being
  targeted, aspirant eligibility flag, prior-aspirant flag, Hall of Fame flag,
  financial standing, conduct status, contracted status, active.
- **`Convention Production`** — one row per settled case: agent id, statement
  date, settled date, policy ref, **life id** (the distinct-life key), new or
  increase, product class (`individual_life` / `health_group`), net FYC, API.
- **`Convention Pipeline`** — agent-submitted, unsettled: same shape, plus
  submitted date and status; rows retire on reconciliation.
- **`Convention Persistency`** — agent id, measurement date, API in force, gross
  API submitted, computed rate.
- **`Convention Imports`** — audit of every official import: who, when, statement
  date, rows added, totals, so any figure can be traced to its source.
- **`Convention Rules`** — the table in §3.1 as data, not code, so the 25th
  convention is a new row set rather than a rewrite.

The `life id` needs a deliberate key — national ID where available, otherwise
normalised name plus date of birth. Get this wrong and the lives count, which is
half of every qualification, is wrong. `Code.gs` already has a `normName_()`
helper worth reusing.

---

## 6. The analytics that actually motivate

Ranked by how much behaviour each one changes.

1. **Days-to-Early-Bird counter with a daily FYC rate.** Live now, gone after
   31 December 2026. Highest urgency on the board.
2. **The binding constraint, named.** One sentence at the top: *"Lives is what is
   holding you — you are 22 lives short of Shared, and $61,000 ahead on FYC."*
   Agents who know they need lives rather than money sell differently.
3. **Distance to the next rung.** Not just progress within the current category
   but the reach to the next: *"Own is $48,200 and 6 lives away."* Tier upgrades
   are the cheapest motivation in the whole scheme, because the agent is already
   most of the way there.
4. **Pace against the clock.** Required run-rate versus achieved run-rate, and a
   projected landing figure if the current pace holds. Pace beats totals — a
   total says where you have been, a pace says whether you will make it.
5. **Leaderboard.** The direct answer to "where they stack up". Suggest ranking by
   **percentage of own target**, not raw FYC — otherwise the same two agents lead
   for eighteen months and everyone else stops looking. Percentage-of-target keeps
   an aspirant on $180,000 genuinely competitive with a Business Class agent on
   $900,000, which is both fairer and far better fuel.
6. **Persistency headroom in dollars.** §3.3. Becomes the whole dashboard between
   October 2027 and March 2028.
7. **Health/Group ceiling meter.** §3.2. Warns before the work is wasted, not after.
8. **Qualified-so-far badge.** The categories cleared *today* if the period ended
   now. Turns eighteen abstract months into something already earned and losable —
   loss aversion does more work here than any target ever will.
9. **Branch aggregate.** How many the branch is sending, and who is within 10% of
   a rung. That is your management view, and the prompt for where to push.

On tone: the leaderboard shows the whole field, but consider showing rank and
percentage-of-target rather than everyone's dollar figures. It answers "where do I
stand" fully while keeping one agent's earnings from becoming branch gossip. If
the team would rather see the money, that is a call for you and them — but the
default should be the private one.

---

## 7. Build order

1. `Convention.gs` — Sheet setup, per-agent auth ported from `Market.gs`, the
   rules table, and the qualification engine (both gates, 15% cap, persistency).
2. `/convention/index.html` — the agent's own page: two-gate bars, binding
   constraint, next rung, Early Bird counter, pace.
3. Monthly official import — paste-a-range or CSV, with the `Convention Imports`
   audit trail.
4. Leaderboard and branch aggregate view.
5. Pipeline capture, reconciliation, and the 90-day stall query.
6. Deadline calendar and conservation mode — needed by late 2027, not now.

Steps 1–3 are what make the app real. A tracker with accurate official figures and
no leaderboard is useful; a leaderboard over figures nobody trusts is worse than
nothing.

---

## 8. Non-negotiable: no production data in this repository

`README.md` already records that client data reached this public repo twice and
needed a full history rewrite. **Agent production data is in the same class** —
FYC, lives, persistency and rankings are confidential compensation information,
and every file on `main` is downloadable by anyone.

What lives here: the rules constants from the published PDF, the page markup, and
the Apps Script source. What never lives here: a single agent's figures, in any
format, however temporarily. The numbers stay in the private Sheet and reach the
page at runtime, behind per-agent auth — exactly as the renewal portals already
handle client data.
