# Branch Recognition Tracker — design & recommendation

One app, three programmes: **Guardian Sales Awards**, the **24th Overseas Sales
Convention**, and **MDRT**. This document is the architecture, the decoded rules
of all three, and the build order.

*Supersedes the convention-only design. The convention material is now §6.*

---

## 1. The recommendation

**Yes — build an awards tracker, but build it as one Recognition Tracker with the
programmes as data, not as an awards app beside a convention app.**

And to answer the earlier question again now that there are three programmes:
still `/convention/` → **`/recognition/`** inside the Agent Portal in this
repository, on the Apps Script + private Sheet pattern already proven here.
Not inside FactFind360, not as another standalone site. The reasoning in §2
holds and gets stronger with every programme added.

The decisive fact is that all three programmes are **different questions asked of
the same events**. A settled application produces one row — agent, life, date,
gross FYC, net FYC, API, sum assured, coverage type, product class. From that one
row:

- **Awards** ask *"how much in this calendar year, and how many apps and lives?"*
- **Convention** asks *"how much net FYC between 1 Apr 2026 and 30 Sep 2027, and how many distinct lives?"*
- **MDRT** asks *"how much eligible commission in this calendar year, converted to USD?"*

Three separate apps would mean importing the same production statement three
times, into three schemas, that then disagree with each other by the second month.
One ledger with a **programme registry** on top means a new award — or the 2027
rules, or the 25th convention — is a row of configuration, not a rewrite.

This is also the honest answer to "and other awards". There are **25 awards** in
the 2025 rules alone. Hard-coding 25 award engines is not maintainable; building
one rules engine that reads 25 rule definitions is. The awards themselves are
mostly the same five primitives in different combinations (§4.2).

---

## 2. Why the Agent Portal, and not the alternatives

**Not FactFind360.** Three independent reasons, each sufficient.

- **Audience.** FactFind is a surface a *client* sits in front of. Recognition
  data is an agent's own commissions and their rank against colleagues. Putting
  agent earnings behind the door a client walks through is a confidentiality
  problem waiting for the one afternoon somebody hands over the tablet.
- **Lifecycle.** A needs analysis never expires. These programmes are dated and
  disposable — the 2025 award rules are already superseded, the convention dies
  on 31 Mar 2028, and MDRT republishes every January. That logic becomes dead
  weight inside a tool that must keep working afterwards.
- **Data source.** FactFind's inputs are what the agent types about a client. The
  tracker's inputs are settled production off the branch portfolio. No overlap
  upstream, so nothing to integrate — only two unrelated schemas in one codebase.

**Not a tenth standalone site.** You already run roughly ten properties. Another
domain is another sign-in, another certificate, another bookmark — and it would
be the least visited of them. Nobody opens `awardstracker.com` on a Tuesday. They
do open the Agent Portal, because contracting, premium dues and the monthly review
are already there. For a tool whose whole job is motivation, being **seen without
being sought** is the entire game.

**The Agent Portal, because the pattern already exists here twice.**
`apps-script/Code.gs` has per-person access codes off a `Staff` tab, an `Activity`
trail, scheduled daily automation and a `google.script.run` dashboard.
`apps-script/Market.gs` has salted SHA-256 PINs, attempt lockout, single-session
tokens and a **live shared leaderboard** — which is exactly the "where do I stack
up" mechanic, already built and running in `market/`. The tracker is `Market.gs`'s
auth and leaderboard over `Code.gs`'s reporting, on different numbers.

### One thing to fix first

`agent.html` gates on a code held in client-side JavaScript — `var CODE =
'AGENT2026'`, visible in View Source (`staff.html` likewise, `STAFF2026`). That is
acceptable weight for a directory of Jotform links, all reachable by their own URLs
anyway.

**It is not adequate here.** This module holds every agent's commissions and ranks
them. One shared, publicly visible code means anyone who ever had the link can read
everybody's earnings. So the portal keeps `AGENT2026` as the outer door, and
`/recognition/` authenticates **separately and per-agent** on the `Market.gs`
scheme — name plus personal PIN, salted and hashed before it touches the Sheet,
five attempts then a fifteen-minute lockout, one live session per person.

Related: `CONFIG.STAFF_KEY` in `Code.gs` is correctly marked
`CHANGE-ME-in-Apps-Script-only` with a note that the previous value was published
and must be treated as burned. Confirm a fresh key was actually set in the
deployed script.

---

## 3. The three traps in merging these

These are the things that make a merged tracker quietly wrong. Each one has to be
a distinct field in the ledger, not a conversion done at read time.

### 3.1 Three different clocks

| Programme | Window | Measured at |
|---|---|---|
| Guardian Awards | Calendar year, 1 Jan – 31 Dec | 31 Dec |
| Convention | **18 months**, 1 Apr 2026 – 30 Sep 2027 | persistency held to 31 Mar 2028 |
| MDRT | Calendar year | prior-year production certified the following year |

The convention's 18-month window straddles two award years and two MDRT years. A
case settled in May 2027 counts toward the convention, the 2027 awards, and 2028
MDRT — three programmes, one row. This is why the ledger stores **dates, not
period totals**, and every total is derived on read.

### 3.2 Three different FYC bases — the one that will bite

The same phrase means three different numbers:

| Programme | Basis | Source wording |
|---|---|---|
| Awards | **Gross** FYC | *"Minimum of $500,000 in Gross First Year Commissions"* (net FYC used only as tiebreaker) |
| Convention | **Net** FYC | *"measured primarily by NET First Year Commissions"* |
| MDRT | **Eligible commissions paid** | excludes overrides, training allowances, bonuses |

They are close enough to look interchangeable on a dashboard and far enough apart
to make an agent miss a target they thought they had. The ledger stores
`fyc_gross`, `fyc_net` and `fyc_mdrt_eligible` as three columns, and every screen
labels which one it is showing.

Compounding it, each programme carves out its own exclusions:

- **Awards** — commission credit for own-life and immediate-family policies is
  capped at **5% of total FYC** (Top Producer and Rookie).
- **Convention** — max **15%** of the quota may come from Group/Individual Health
  and Group Life FYC.
- **MDRT** — overrides, training allowances and bonuses never count; group health
  counts in the **first year of the policy only**, and additions in later years do
  not.

### 3.3 Three different persistency definitions

- **Awards** — *average persistency for the competition year*, thresholds of
  **90%** (most), **95%** (Rookie), **97%** (Quality Club, Quality Award).
- **Convention** — **87.5%**, and not an average at all: total API in force at
  31 Mar 2028 against gross API submitted and settled in the production period.
- **MDRT** — no persistency test; instead a chargeback rule, where annualised
  commissions clawed back reduce that year's credit.

Storing one "persistency" number per agent and showing it against all three is
wrong. Store the components — API in force, gross API, lapses by month — and
compute each definition separately.

---

## 4. The Guardian Awards, decoded

Source: *Awards Rules for Production Year 2025, revised 1 January 2025.*

⚠️ **These are the 2025 rules and we are in the 2026 production year.** Get the
2026 revision before launch. This is the strongest possible argument for
rules-as-data: when the 2026 sheet arrives it should be a new row set in a
`Programme Rules` tab, not a code change.

### 4.1 The individual awards

Everything an agent can win personally. Thresholds are TTD.

| # | Award | Wins on | Gates |
|---|---|---|---|
| 1 | **Top Producer** | Highest gross FYC | ≥$500k FYC · 25 settled apps · 90% pers. · not Rookie-eligible · 18 mths service |
| 2 | **Rookie of the Year** | Highest gross FYC | **95%** pers. · **75 lives** · **100 apps** · <24 mths selling experience |
| 3 | **Agent of the Year** | Highest **points** (§4.3) | 120 apps · 100 lives · $400k FYC · $800k API · 90% pers. · 3 of 5 FSCP modules · 24 mths service |
| 4 | **Chairman's Club** | Tier by FYC | Ruby $1.5M · Palladium $1M · Platinum $600k · Diamond $400k — all need 25 apps · 90% pers. |
| 5 | **President's Club** | Tier by FYC | Gold $330k · Silver $275k · Bronze $220k — all need **80 apps** · 90% pers. |
| 6 | **War on Poverty** | Tier by **sum assured** | Lords 150M · Knights 100M · Marshalls 75M · Cavalry 50M — 50 apps · 90% pers. |
| 7 | **Quality Club** | Threshold | **97%** pers. · 80 apps · 24 mths service |
| 8 | **Activity Club** | Tier by **apps** | (i) 100–149 · (ii) 150–199 · (iii) 200–249 · (iv) 250+ · 90% pers. |
| 9 | **Quality Award — Persistency** | Highest persistency | ≥$220k FYC · **97% this year and last** · 80 apps · 36 mths service |
| 10 | **Super Achiever** | Most settled **lives** | >200 lives · 90% pers. |
| 11 | **Andre Redman Consistency** | KPI 1.2 apps/week | **≥5 apps *every* month** · **90% pers. *each* month** |
| 12 | **Norris Lovelace Cross Sell** | Highest **product density** | 60 cross-sold apps · 90% pers. · 18 mths service |
| 13 | **Top Producer — Group & Health** | Highest FY premiums | ≥$250k net premiums |

Awards 14–25 are unit, branch, trainee-manager and assistant-branch-manager
titles. They matter to you as Branch Manager but not to an individual agent's
screen, so they belong in the **branch view** (§9.10), computed from the same ledger
by aggregating over agents rather than filtering to one.

**Two awards referenced but not defined in this document:** *Top Producer Club*
(quarterly) and *Agent of the Month* both feed Agent of the Year points, but their
own qualification rules are not in the 2025 rules PDF. Request them — without
them, the Agent of the Year points total cannot be computed correctly.

### 4.2 Why 25 awards is not 25 engines

Nearly every award above is a combination of five primitives over a date window:

`gross FYC` · `settled applications` · `distinct lives` · `API` · `sum assured`

filtered by a persistency gate and a service-tenure gate. Three awards need one
extra primitive each — **product density** across coverage types (Cross Sell),
**monthly** granularity (Andre Redman), and **group/health premium** (award 13).

So the rules engine needs exactly one shape:

```
{ metric, window, aggregation, threshold | rank, gates: [persistency, tenure, eligibility] }
```

Twenty-five awards become twenty-five rows. The 2026 revision becomes a new sheet.

### 4.3 Agent of the Year — the only real points engine

Everything else is a threshold or a ranking. This one accumulates:

| Source | Points |
|---|---|
| Apps | 1 per 10% over 120 |
| API | 1 per 10% over $800,000 |
| FYC | 1 per 10% over $400,000 |
| Persistency | 1 per **3%** over 90% |
| Top Producer Club | 1 per quarter qualified |
| Agent of the Month | 1 per month won (by apps **or** FYC) |
| Chairman's Club Ruby | 1 on qualification |

Tie → highest **net** FYC. Sales Managers not eligible.

Note the leverage: persistency scores a point every 3% while production scores one
every 10%. Moving persistency from 90% to 99% is worth 3 points — the same as
lifting FYC from $400k to $520k. **Agent of the Year is won on quality, not
volume**, and almost nobody realises it. Surfacing that one fact is worth more
than any leaderboard.

---

## 5. MDRT — the Million Dollar Round Table

The global standard for life insurance and financial services producers, founded
1927. Membership runs one calendar year and is earned annually on the **prior
year's** production — 2026 membership is certified on 2025 production. Three
tiers, at **1× / 3× / 6×** the base requirement.

### 5.1 Trinidad & Tobago figures

MDRT sets requirements per market in local currency. Published T&T figures:

| Method | MDRT | Court of the Table (3×) | Top of the Table (6×) |
|---|---:|---:|---:|
| **Commission** | **TTD 344,400** | TTD 1,033,200 | TTD 2,066,400 |
| **Premium** | TTD 688,800 | TTD 2,066,400 | TTD 4,132,800 |
| **Income** | TTD 596,500 | TTD 1,789,500 | TTD 3,579,000 |

*2026 membership, on 2025 production. An agent qualifies under **one** method —
whichever suits how they are paid.*

Production is certified in USD using MDRT's conversion factors (**3.9586** for
commission and premium, **3.9503** for income), which are processing constants,
not exchange rates: TTD 344,400 ÷ 3.9586 = **USD 87,000**.

For reference, the prior year was TTD 312,800 commission / 625,600 premium — so
the bar **rose 10.1%** in one year. It is not a fixed target and the tracker must
never treat it as one.

### 5.2 What actually counts

MDRT credit is not Guardian FYC, and the gaps are specific:

- **Never counts:** override commissions, training allowances, bonuses, and other
  sales or expense allowances.
- **Group business** (life, health, CI, PA, DI) — 100% of first-year commission,
  but only **10% of first-year premium**, and **first year of the policy only**;
  additions in later years earn nothing.
- **Individual life** — 100% of first-year commission up to target premium;
  amounts above target ("top up") earn 100% of commission paid but only **6%** of
  the excess premium.
- **Annuities, mutual funds, securities, wrap accounts** — 100% of commissions,
  but only **6%** of new money invested.
- **Individual health** — 100% of both first-year commission and premium.
- **Financial planning fees** — 100% of the net fee (commission) or gross fee
  (premium).
- **Levelized commissions** may be reported as the present value of up to five
  years discounted at 10%, capped at 55% of first-year premium.
- **Annualised commissions** count when paid, but a later chargeback reduces that
  year's credit.

The premium method's weightings are the reason it is not simply "twice the
commission target" in practice: an agent writing mostly group business is far
better off on the commission method.

### 5.3 Why MDRT belongs in the same app — the unified ladder

This is the single most valuable output of merging the programmes. Put every
calendar-year FYC threshold in one ascending column and the ladder is remarkable:

| TTD | Rung |
|---:|---|
| 220,000 | President's Club **Bronze** |
| 275,000 | President's Club **Silver** |
| 330,000 | President's Club **Gold** |
| **344,400** | **MDRT** |
| 400,000 | Chairman's Club **Diamond** · Agent of the Year minimum |
| 500,000 | **Top Producer** minimum |
| 600,000 | Chairman's Club **Platinum** |
| 1,000,000 | Chairman's Club **Palladium** |
| **1,033,200** | **MDRT Court of the Table** |
| 1,500,000 | Chairman's Club **Ruby** |
| **2,066,400** | **MDRT Top of the Table** |

Two findings fall straight out of that table, and both are the kind of thing that
changes what an agent does in December:

- **MDRT sits just $14,400 above President's Club Gold.** An agent who reaches
  Gold is within **4%** of a globally recognised credential and almost certainly
  does not know it.
- **Court of the Table sits just $33,200 above Chairman's Palladium.** A Palladium
  qualifier is within **3%** of COT.

Neither fact is visible while the programmes live in separate documents — or
separate apps. That is the argument for one tracker, stated in dollars.

The convention runs on a different clock so it cannot share the column, but
pro-rated to twelve months it lines up alongside: Shared ($525k / 18 mths) is
**$350,000 a year**, Own is **$450,000 a year**. So an agent holding Chairman's
Diamond pace is comfortably on convention Own pace, and roughly at MDRT.

### 5.4 Caveats to carry in the UI

- MDRT figures **change every year** and are published each January. The current
  year's target is provisional until then; label it so.
- The tracker's MDRT number is an **estimate off Guardian FYC** and the eligible
  basis differs (§5.2). Show it as a projection, never as certification.
- Certification is the agent's own application to MDRT, with dues, on their
  company's certifying letter. The app tracks the number; it does not confer
  membership.

---

## 6. The Convention 2028 programme

Production period **1 Apr 2026 → 30 Sep 2027**, persistency held to **31 Mar 2028**.
The rules have more edges than a progress bar can express. These are the ones
that decide whether an agent travels.

### 6.1 Two gates, not one

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

### 6.2 The 15% Health & Group ceiling

At most 15% of the production quota may come from FYC on new Group and Individual
Health and Group Life premiums, measured on premiums received as at 30 Sep 2027.

This needs its own meter, not a footnote. An agent writing group health hard can
be building production that will not count, and will only find out at the end.
The meter should read *"$61,400 of your $78,750 Health/Group allowance used —
further group FYC will not count toward Shared."*

Because the ceiling is a percentage of the *category* quota, it moves as the agent
targets a different tier. Compute it against the category currently being tracked.

### 6.3 Persistency — a gate that stays open six months past the finish

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

### 6.4 Early Bird — the live deadline

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

### 6.5 Aspirant — and a discrepancy to raise

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

### 6.6 Disqualifiers that no amount of production overrides

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

### 6.7 The deadline calendar

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

## 7. The ledger

One event table serves all three programmes. Everything else is derived.

**`Production Ledger`** — one row per settled application:

| Field | Feeds |
|---|---|
| `agent_id`, `settle_date`, `policy_ref` | everything |
| `life_id` | distinct-lives counts (Convention, Rookie, Agent of Year, Super Achiever) |
| `fyc_gross` | all Guardian awards |
| `fyc_net` | Convention target, award tiebreakers |
| `fyc_mdrt_eligible` | MDRT projection |
| `api` | Agent of the Year, unit/branch awards |
| `sum_assured` | War on Poverty |
| `coverage_type` (Life/Term/Annuity/PA/CI/Health) | Cross Sell product density |
| `product_class` (individual_life / group_life / health) | Convention 15% cap, award 13, MDRT weightings |
| `is_own_or_family` | the 5% own-life cap |
| `is_cross_sold` | Cross Sell 60-app gate |
| `status` (settled / lapsed / NTU / NPW / postponed / declined) | persistency, and next convention's opening deduction |

Supporting tabs:

- **`Agents`** — id, name, PIN hash, salt, licence date, **service start** (drives
  every tenure gate: 18 / 24 / 36 months), prior selling experience months (Rookie
  eligibility), FSCP modules completed, unit, financial standing, conduct status,
  contracted status, convention aspirant flags, Hall of Fame flag.
- **`Persistency`** — agent, **month**, API in force, gross API, lapses. Monthly,
  not annual, because Andre Redman tests *each month* and the convention needs a
  point-in-time API ratio.
- **`Monthly Activity`** — agent, month, apps settled. Feeds Andre Redman's
  5-apps-every-month test and Agent of the Month.
- **`Programme Rules`** — every threshold from §4, §5 and §6 as data, versioned by
  year. The 2026 award revision and the 25th convention are new row sets.
- **`Imports`** — who imported, when, statement date, rows, totals. Every figure
  traceable to its source.

`life_id` needs a deliberate key — national ID where available, else normalised
name plus date of birth. Get it wrong and every lives-based award is wrong.
`Code.gs` already has `normName_()` worth reusing.

**Retention note.** `status` must keep case outcomes, not just totals: convention
rule 1 deducts this block's lapses, NTUs, NPWs, postponements and declines from
the *following* convention's production. Today's ledger is the next cycle's
opening liability.

---

## 8. Where the data comes from

You said the branch portfolio already has this. That is the single biggest thing
in this project's favour, and it changes the build: the importer targets a real
export rather than manual entry.

**What I need from you to build step 3:** one sample export from the branch
portfolio — headers and a few rows, **with client and agent identifiers removed**.
From that I can write the column mapping and reconciliation. Until I see it, the
importer is guesswork.

Recommended shape, whatever the source:

**Official (authoritative).** Settled production imported from the branch
portfolio on a schedule, stamped with its statement date so every screen can say
*"official figures as at 31 July 2026."* One writer, one source, no argument.

**Pipeline (provisional).** Submitted-not-yet-settled, agent-entered — the branch
already runs on Jotform, so it can write to the same Sheet. Shown in a visibly
provisional style and **never** counted toward qualification, only projection.

Both layers, because each alone fails. Official-only is accurate but a month
stale, so it feels dead and nobody opens it. Self-report-only drifts upward and
turns the leaderboard into fiction. Together an agent sees *"$312,400 settled,
$84,000 in the pipeline"* while qualification stays anchored to the only figures
that decide anything. Each import reconciles the pipeline automatically —
what settled moves across, what has sat 90 days gets queried, exactly as
`Code.gs` already chases stalled renewal instructions.

---

## 9. The analytics that motivate

Ranked by how much behaviour each one actually changes.

1. **The next rung, across all programmes at once.** §5.3's ladder, personalised:
   *"You are $18,600 from President's Gold, $33,000 from MDRT, and $88,600 from
   Chairman's Diamond."* Three named prizes in one sentence, the nearest of them
   close enough to reach. Nothing else in this app will move production more.
2. **Days-to-Early-Bird, with a daily rate.** Convention Early Bird closes
   **31 Dec 2026** — 135 days left of a 274-day window, and on-pace today is
   ~$273,000 with **$1,971 of FYC per day** needed from here. Highest urgency on
   the board, and it retires itself on 1 January.
3. **The binding constraint, named.** One sentence at the top: *"Lives is what is
   holding you — 22 short for convention Shared, and you are $61,000 ahead on
   FYC."* Most awards have two or three gates and agents track only the money.
4. **Persistency's leverage, made visible.** Agent of the Year scores a point per
   3% of persistency against a point per 10% of production (§4.3); Quality Club
   and the Quality Award need 97%; the convention needs 87.5% held to March 2028.
   A single "persistency is worth 3 points to you right now" line reframes what
   agents think of as an admin metric.
5. **Pace against the clock.** Required run-rate versus achieved, and a projected
   landing figure at current pace, per programme. A total says where you have
   been; a pace says whether you will make it.
6. **Qualified-so-far.** Every award and tier already cleared *if the year ended
   today*, per programme. Turns twelve abstract months into something already
   earned and losable — loss aversion does more work here than any target.
7. **Leaderboard.** The direct answer to "where do I stack up". Rank by
   **percentage of own target**, not raw FYC — otherwise the same two agents lead
   all year and everyone else stops looking. Percentage-of-target keeps a rookie
   on $180,000 genuinely competitive with a Chairman's Club agent on $900,000,
   which is both fairer and much better fuel.
8. **Persistency headroom in dollars.** *"You can absorb $18,300 more lapsed API
   before you fall below 87.5%"* beats "94.2% persistent" — it is the number that
   makes someone pick up the phone. Becomes the whole dashboard between October
   2027 and March 2028.
9. **Cap and ceiling meters.** Convention's 15% Health/Group ceiling and the
   awards' 5% own-life cap, shown as meters that warn *before* the work is
   wasted rather than after.
10. **Branch view.** Awards 14–25 are branch and unit titles you compete for as
    Branch Manager: settled API against the $10M branch minimum, apps against
    agents × 60, the 75%-of-agents-at-$400k-API test, manpower net growth, and
    the branch points table. Same ledger, aggregated over agents instead of
    filtered to one. This is also where you see who is within 10% of a rung and
    where to push.

On tone: show rank and percentage-of-target rather than everyone's dollar figures
by default. It answers "where do I stand" fully while keeping one agent's earnings
from becoming branch gossip. If the team would rather see the money, that is a
call for you and them — but the private default is the right starting point.

---

## 10. Build order

1. **`Recognition.gs`** — Sheet setup, per-agent auth ported from `Market.gs`, the
   `Programme Rules` registry, and the rules engine (§4.2's single shape, plus the
   three-basis FYC handling from §3.2).
2. **`/recognition/index.html`** — the agent's own page: the unified ladder and
   next rung, binding constraint, pace, qualified-so-far.
3. **The branch portfolio importer** — needs your sample export (§8), with the
   `Imports` audit trail.
4. **Leaderboard**, ranked by percentage of target.
5. **Convention module** — Early Bird counter, two-gate bars, 15% ceiling,
   persistency headroom. Early Bird is urgent, so this may justify jumping ahead
   of 4.
6. **MDRT projection** — the estimate, clearly labelled, with the January refresh.
7. **Branch view** — awards 14–25 and the branch points table.
8. **Deadline calendar and conservation mode** — needed by late 2027, not now.

Steps 1–3 are what make the app real. A tracker with accurate official figures and
no leaderboard is useful; a leaderboard over figures nobody trusts is worse than
nothing.

---

## 11. Open items

| # | Item | Why it blocks |
|---|---|---|
| 1 | **Sample export** from the branch portfolio, identifiers removed | The importer cannot be written without the column shape |
| 2 | **2026 Awards rules** revision | We hold only the 2025 rules; thresholds may have moved |
| 3 | **Top Producer Club** and **Agent of the Month** rules | Both feed Agent of the Year points and are undefined in the 2025 PDF |
| 4 | Confirm the aspirant FYC figure with the Convention Committee | The PDF calls $325,000 "75% of Shared" but 75% of $525,000 is $393,750 (the 67-lives figure *does* match 75%) |
| 5 | Confirm the burned `STAFF_KEY` was rotated in the deployed script | Noted as published in `Code.gs`; §2 |
| 6 | Decide: leaderboard shows dollars, or rank and % of target only | §9 — a branch culture call, not a technical one |

---

## 12. Non-negotiable: no production data in this repository

`README.md` records that client data reached this public repo twice and needed a
full history rewrite. **Agent production data is in the same class** — FYC, lives,
persistency and rankings are confidential compensation information, and every file
on `main` is downloadable by anyone.

What lives here: the published rule constants, the page markup, the Apps Script
source. What never lives here: a single agent's figures, in any format, however
temporarily — including the sample export in §8, which is why it must have its
identifiers removed and must not be committed. The numbers stay in the private
Sheet and reach the page at runtime behind per-agent auth, exactly as the renewal
portals already handle client data.

---

## Sources

- Guardian Life *Awards Rules for Production Year 2025* (revised 1 January 2025) — supplied.
- Guardian Life *24th Overseas Sales Convention — Sales Agents' Qualifications, Rules for Trinidad and Tobago* — supplied.
- MDRT, *Commission and Premium Production Requirements for Membership* (2025 and 2026 conversion factor table) — [assets.ctfassets.net](https://assets.ctfassets.net/udv0p7armmmz/2P3sPvMst045hnc532CFyF/3410e2db5ab113a270151392308e2d64/2025_and_2026_MDRT_Conversion_Factor_Final__1_.pdf)
- MDRT, *Membership Information for the 2026 MDRT Academy* (product credit tables and clarifications) — [app.mdrtacademy.org](https://app.mdrtacademy.org/public/documents/membership_requirements_en)
- MDRT membership requirements overview — [mdrt.org/join](https://www.mdrt.org/join)
