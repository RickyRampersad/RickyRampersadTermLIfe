# Manager insights — what to measure, and why

Written from the branch manager's seat. Every metric below is mapped to fields
that already exist in `ffRevised`, so none of this needs new data capture.

The organising principle: a production report tells you **what was sold**. A
fact find tells you **what was found**. The gap between those two is where a
branch actually leaks money, and it is invisible in every standard report.

---

## 1. The leak nobody measures: need found vs need recommended

**Fields:** `insuranceNeed_calc`, `totalCoverage_calc`, `fi_coverageGap`,
`rec1Prem`…`rec6Prem`, `fi_packageTotal`, `retGap_calc`

Three numbers, per agent and per unit:

| | Meaning |
|---|---|
| **Need identified** | Σ `insuranceNeed_calc` — what the fact find proved the client needs |
| **Need recommended** | Σ `fi_packageTotal` / the `rec*` lines — what the agent actually proposed |
| **Need placed** | Same, filtered to `approved` / signed |

The ratio **recommended ÷ identified** is the single most useful coaching number
you can put in front of an agent. An agent who uncovers $800k of protection gap
and recommends $75k of cover is not under-performing on activity — they are
under-recommending, which is a completely different conversation and a
completely different fix.

Watch for the agent whose *activity* looks fine and whose *conversion* looks
fine, but whose recommend-ratio is 15%. They are working hard and leaving most
of it on the table.

**Trend to track:** recommend-ratio by agent, month over month. It should climb
with confidence and coaching. If it falls, something changed — a product
withdrawal, a compliance scare, or a confidence knock.

---

## 2. The best lapse predictor you already own

**Fields:** `cashSurplus_calc`, `fi_surplusRatio`, `fi_dti`, `monthlyExpenses`,
Σ `rec*Prem`, `lapseRisk`

Compare **total recommended monthly premium** against the client's own disclosed
**monthly cash surplus**.

If the recommended premium exceeds the surplus, that policy is going to lapse.
Not might — will, usually inside twelve months, and usually after the commission
is clawed back.

Almost nobody checks this at point of sale, because the fact find and the
application live in different systems. Yours don't.

Suggested banding:

| Premium ÷ surplus | Read |
|---|---|
| under 30% | comfortable |
| 30–50% | watch |
| 50–80% | fragile — expect lapse on any income shock |
| over 80% | will not persist; rewrite before submission |

Put the count of **fragile + over-committed cases** on the manager's daily view.
Catching one of these before submission is worth more than any leaderboard.

**Trend to track:** branch-level share of cases in the top two bands. Rising
share means the branch is chasing premium over suitability, which shows up as a
persistency problem two quarters later.

---

## 3. Where the case actually sits — and who is the bottleneck

**Fields:** `submittedAt`, `lastUpdated`, `advisorSigDate`, `status`

Managers consistently underestimate their own contribution to cycle time.
Measure it explicitly:

- **Median days in `pending_review`** — this is the manager's number, not the agent's
- **Oldest unsigned case**, with owner and age, named
- **Count breaching SLA** (suggest 3 working days for review, 7 for signature)
- **Aged buckets:** 0–2 / 3–5 / 6–10 / 10+ days

Show median, not mean. One case stuck for 40 days drags a mean into fiction.

**Trend to track:** median review time, week over week. If it climbs, either
volume grew or a manager is under-covering. Both are actionable, and neither is
visible from a production number.

---

## 4. Compliance signals that need to surface same-day

**Fields:** `repDetected`, `fi_uwEvidence`, `naqScore`, `medical`, `ins1Co`,
`ins1Status`, `ins1Year`

- **`repDetected` — replacements.** Any case replacing existing cover needs
  manager eyes before it moves. This is the one that becomes a regulatory
  problem, not just a service problem. It belongs on the daily view, always,
  even when the count is zero.
- **`fi_uwEvidence`** — cases needing medical evidence, so underwriting delays
  are anticipated rather than discovered.
- **`naqScore`** — you already compute it. Show the distribution, not the
  average: a branch average of 78 hides the four cases sitting at 40.
- **Incomplete fact finds** — blank `dob`, `monthlyIncome`, `medical` or
  `occupation`. These are the cases that bounce back from underwriting and cost
  a fortnight.

---

## 5. Product concentration — the coaching signal hiding in plain sight

**Fields:** `rec1Rec`…`rec6Rec`, `productFit`, `appType`, `ffScope`

Per agent: what share of their recommendations is a single product?

An agent recommending the same product in 90% of cases is not doing needs-based
selling, whatever the fact find says. They have one comfortable conversation and
they are steering every client into it. That is both a suitability risk and a
capped-income problem for that agent.

Also track **average recommendation lines per case** (`fi_packageLines`). One
line per fact find means the fact find is being completed as paperwork after the
sale, not used as a discovery tool before it.

**Trend to track:** lines per case by agent. Rising = the fact find is being
used properly. Flat at 1.0 = it is being back-filled.

---

## 6. Who is actually working

**Fields:** `agentCode`, `submittedAt`, `interviewDate`, `unitKey`

- Fact finds per agent, rolling 7 and 30 days
- **Quiet agents** — zero submissions in 14+ days, named
- Interview-to-submission lag (`interviewDate` → `submittedAt`). A widening lag
  means fact finds are being written up days later from memory, which shows up
  as thin, low-quality data.

---

## 7. Book shape — the slow trends that decide the next three years

**Fields:** `dob`, `monthlyIncome`, `maritalStatus`, `empStatus`, `occupation`,
`employer`, `retGap_calc`

These move slowly and matter enormously:

- **Client age mix.** A branch writing only 45+ has premium now and no book in
  ten years. A branch writing only under-30s has a book and no revenue. You want
  to see the shape and correct it deliberately.
- **Income mix.** Concentration in one band caps average case size.
- **Employer concentration.** Three employers making up half the book is a
  worksite opportunity — and a concentration risk if one of them restructures.
- **Aggregate `retGap_calc`.** The total retirement shortfall your branch has
  already identified and documented. That is a pension pipeline sitting in a
  spreadsheet that nobody is working.

---

## What goes where

### Daily digest (5pm email) — five blocks, nothing more

1. **Today:** submitted / approved / signed
2. **On your desk:** awaiting your signature, oldest case age, named
3. **Red flags:** replacements, over-committed premium, missing evidence
4. **Quiet agents:** 14+ days silent
5. **Week to date vs last week:** submissions, approvals, recommended premium

If it does not fit on a phone screen without scrolling, it will not be read.

### Dashboard — two tabs

**Tab 1 — Needs you today.** Review queue by age, red flags, quiet agents,
over-committed cases. Nothing else. This is the landing view.

**Tab 2 — Analytics.** Everything above, with the existing panels folded in.

---

## A caveat worth stating plainly

At 38 submissions across 11 agents, per-agent samples are 2–5 cases. That is
enough for **facts** ("3 of this agent's cases have sat over 7 days") and not
enough for **verdicts** ("this agent is under-recommending").

Build the measures now so the history accumulates. Show per-agent trend lines
only once an agent has 10+ cases, and say so on the panel rather than drawing a
confident line through four points. Managers forgive missing data. They do not
forgive being told something confident that turns out to be wrong, and once they
stop trusting the page they stop opening it.
