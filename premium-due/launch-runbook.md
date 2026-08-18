# Launch Runbook — Premium Due Engine

**The rollout runs in stages, and nothing reaches a client until the stage
that says so.** Everything below is measured, not guessed: the full live
portfolio (20,354 rows) was run through `dailyPremiumDueRun()` on 13 August
2026, and these are its numbers. All six test suites pass; every letter clears
3.2:1 contrast in both themes.

**The gates, in order:**

| Stage | Setting | What happens |
|---|---|---|
| 0 · Dry run | `DRY_RUN: true` | Nothing emailed. The full plan is written to the log to read. |
| 1 · **Pilot** | `DRY_RUN: false` + `TEST_INBOX` + `PILOT_AGENTS` | Real emails for two books — **every one to your own inbox**, stamped `[TEST]`, banner naming the real recipient. No client, agent or manager hears anything. |
| 2 · Live | `TEST_INBOX: ''`, `PILOT_AGENTS: []`, **`GO_LIVE_CONFIRM: true`** | The branch is live under the caps. |

**A client can only ever be emailed when all three keys are thrown** —
`DRY_RUN` off, `TEST_INBOX` empty, `GO_LIVE_CONFIRM` true. Any lesser
combination falls back to a dry run and says so in the log. A dry-run row can
never suppress a later live send, and a pilot send stops counting the moment
`TEST_INBOX` is cleared — so each stage starts the next one clean. All three
facts are covered by tests.

---

## What the first run will do

| Client letters | Count |
|---|---|
| Day-45 first letter | 235 |
| Day-75 manager letter | 116 |
| Pending underwriting (≤120 days) | 89 |
| Win-back (lapsed ≤180 days) | 72 |
| 5-day reminder | 48 |
| Day-90/95/100 closing letter | 34 |
| Day-88 final notice | 18 |
| Free-look watch (dispatch → delivery, Export tab) | 9 — 2 at day 18, 2 at day 19, 3 expiry letters, 2 "has it arrived?"; ~12/day for a fortnight after |
| **Total planned** | **~621** — of which **169 have no email** and are logged for a phone call |

| Internal / schemes | Count |
|---|---|
| Manager handovers (day-60 commitment) | 379 |
| Group remittance statements | 12 — incl. Servus (50 members, $26.5k), Bankers (38, $11.2k), Ashsingh (5, $24.0k) |

**Under the live caps (60 client / 60 internal per run):** day one sends ~132
emails; the backlog drains **most-urgent-first** (live cover nearest day 90,
then freshest lapses, then newest pending) and clears in about **8 daily
runs**. Held letters are simply due again next morning — nothing is lost.

---

## 1 · Pre-flight — fill these in the DEPLOYED copy only (never the repo)

The repo is public. Real keys, URLs, client numbers and addresses live only in
the deployed Apps Script.

- [ ] **Rotate `STAFF_KEY`** (Apps Script → Project Settings → Script
      properties). The old value appeared in a public commit and must die.
- [ ] Deploy `PremiumDue.gs`, `PremiumDueAuth.gs`, `PremiumDueTemplates.gs`
      bound to the **Premium Due Tracker** sheet; deploy the web app; note the
      private `/exec` URL.
- [ ] `OUT.ENGINE_URL` ← the private engine URL.
- [ ] `OUT.BRANCH_MANAGER_EMAIL`.
- [ ] `OUT.STAFF_EMAIL` — every agent **and** manager.
- [ ] `OUT.MANAGER_OF` — agent → manager, mirroring the engine's UNITS. *The
      dry run shows 379 handovers currently reading NO MANAGER MAPPED — this
      map is what routes them.*
- [ ] `OUT.GROUP_CLIENTS` — at minimum the Servus account number.
- [ ] `OUT.GROUP_ADMIN` — payroll/administrator contacts for Servus, Bankers
      Insurance, JMMB. *Until an entry exists, that scheme's statement goes to
      the servicing agent instead — by design, never to the address on the
      company record.*
- [ ] `OUT.LOGO_URL` ← the hosted `crest-burgundy.png` once the site deploys
      (blank is fine — letters fall back to the type crest).
- [ ] `OUT.CONTRACT_NOTE` ← the plan's grace/non-forfeiture clause **verbatim,
      or leave blank**. Never paraphrase a contract.
- [ ] Run `pdSetupRoster()` once if the Roster tab doesn't exist; confirm
      roster emails and scopes.
- [ ] Run `pdInstallTrigger()` — daily at 8am. `DRY_RUN` is still `true`.

## 2 · Stage 0 — dry run (tonight)

- [ ] Run `dailyPremiumDueRun()` by hand in the deployed copy
      (`DRY_RUN: true`).
- [ ] Open **PremiumDueLog** and read the plan (~612 `outbound-dry`, ~391
      `internal-dry` rows). Spot-check three rows:
      one **s45** (amount, billing wording, MyGG button), one **mgr-commit**
      (manager name resolved — not "NO MANAGER MAPPED"), the **Servus
      group-statement** (recipient is the administrator you configured).
- [ ] Confirm no row addresses a company as a person, and no scheme member
      gets an individual letter.
- [ ] Free-look rows (`fl_*`): only cases **≤ 22 days from dispatch** appear —
      the 162-case undelivered backlog must show in the digest only, never as
      planned letters.

## 3 · Stage 1 — the pilot: two books, one inbox

Set, in the deployed copy:

```
DRY_RUN: false,
TEST_INBOX: '<your own email>',
PILOT_AGENTS: ['Ricky Rampersad', 'Neil Ramnanan'],
```

**The pilot runs in a fixed order, so nothing gets confused:**

**First — the numbers. Run `pdPilotStats`.** One digest email arrives with
everything the engine believes about the book, in four clearly separated
sections: the **premium-due flow** (in-force cover on the 45/60/90 clock),
the **group schemes** (one statement per company), the **pending flow** (new
business on its own day-21-then-fortnightly clock, decoded from the
Requirement Management tab), and **this week's production**. Check every
number against what the branch knows. If anything disagrees, stop there —
the letters wait until the numbers are right. Stats never write to the log
and never send anything to anyone but you.

**Then — the letters. Run `dailyPremiumDueRun`.** What arrives (measured on
the live book): **~63 client letters** (day-45s, day-75s, a final notice, a
closing letter, a win-back, pending chases — 24 more are logged as a
no-email call sheet), **59 manager handovers**, and **7 scheme statements**
including Servus (50 members), Bankers (38) and both Bertram entries. Every
template the engine can send, rehearsed on real data — and not one email
leaves the building: `[TEST]` on every subject, a banner naming the true
recipients, no copies.

**The two flows never cross:** a status-2 policy (cover in force, premium
behind) lives on the 45/60/90 ladder; a status-3 application (no cover yet,
requirements outstanding) lives on the pending clock — day 21, then every
fortnight to day 120, each letter naming the exact outstanding document from
the Requirement Management tab, with underwriting-complete cases told
plainly that one paper stands between them and a policy in force. One
policy, one flow, never both.

Run it for **2–3 days** and check, in your own inbox and the engine:

- [ ] The digest's numbers match the branch's own (day-45 count, window
      totals, scheme counts, pending book, the week's production).
- [ ] The day-45 letter reads right: the figures, the billing wording, the
      four questions, the MyGG button, Sasha's signature, the case code —
      and the plan named in English ("Flexiterm Convertible (20 years)").
- [ ] A pending letter names the actual outstanding document and, where
      underwriting is complete, says so.
- [ ] Tap an answer — the reply opens pre-written; the case tracker shows it.
- [ ] The manager ladder moves: commitment → (answer it) → thank-you →
      feedback, on the real 3-day / 7-day clocks.
- [ ] The Servus statement: whole scheme listed, diagnosis line correct,
      administrator named as the would-be recipient.
- [ ] The free-look ladder: the dispatch note teaches the window; a day-18/19
      letter names the advisor holding the policy; the day-20 letter differs
      by acknowledgement (delivered → "ran its course"; blank → "no delivery
      on record", BM visibly copied). Fill an Acknowledgement Date mid-ladder
      and confirm the reminders stop.
- [ ] Cadence: nothing repeats a day early, nothing you answered chases again.
- [ ] Anything that reads wrong — wording, figures, layout on your phone —
      gets fixed **now**, while no client has seen it.

- [ ] **Closing the pilot:** clear `TEST_INBOX` (test rows stop counting
      automatically), and **archive or clear the PremiumDueLog data rows** so
      live day one starts with a clean ledger — any answers you tapped during
      the pilot are test data, not client history.

## 4 · Stage 2 — go live

- [ ] `TEST_INBOX: ''` and `PILOT_AGENTS: []` (or keep
      `['Ricky Rampersad', 'Neil Ramnanan']` for a soft launch — your two
      books go live to real clients first, the branch follows).
- [ ] **`GO_LIVE_CONFIRM: true`** — the deliberate third key. Without it the
      run refuses to email a client and falls back to a dry plan.
- [ ] Leave the caps at 60/60.
- [ ] After the 8am run, read the Logger line:
      `sent≈60 · internal≈60 · group-statements≈12 · held-by-cap` = the rest.
- [ ] **Two phone calls beat any letter that morning:**
      **Bertram Manhin** ($42.6k premium across two policies at the cliff) and
      **Ashsingh General Contractors** (5 policies, projected lapse this week,
      ~$24k — plus one already-lapsed $21k policy still inside reinstatement).

## 5 · The first week

- Backlog clears in ~8 runs, most-urgent-first. Expect `held-by-cap` to fall
  toward zero; from then on a normal day is well under the caps.
- Each morning: skim the log for `held-by-cap` and the **169 no-email
  policies** — that list is the agents' call sheet.
- Replies land at support@ / sales support. Until inbound automation exists,
  log them against the policy from the engine so the record stays complete.
- Managers will start answering by tap — watch the commit → thank-you →
  feedback ladder move on the dashboard.

## 6 · Safety rails already in place

A client can only be emailed with all three keys thrown — anything less runs
dry and says so · one send per policy per stage, ever · every sequence stops
on an answer or a payment · urgency-sorted caps (60 client / 60 internal) ·
schemes get one statement per fortnight, members never written individually ·
win-back only inside 180 days · pending chased only to 120 days · the
manager's commercial questions never appear on client-copied email · contract
wording quoted verbatim or not at all · client letters carry no phone numbers
— the tracked case code instead.

## 7 · Rollback

Set `OUT.DRY_RUN = true` — sending stops instantly, planning continues, and
the log keeps recording. (Deleting the trigger stops runs entirely.) There is
also a half-step back: setting `TEST_INBOX` again pulls every send back to
your own inbox without stopping the machine. The log is append-only; nothing
is ever lost.

## 8 · Data fixes to request from ops (not launch blockers)

| Issue | Scale | Effect |
|---|---|---|
| Amount Billed all zeros | every row | letters can't show the exact figure — they degrade to "Settle it now" (never a fabricated amount) |
| Policy numbers as `5.00E+09` | 108 rows (19 chaseable) | untrackable until re-exported as text |
| Paid-to dates as `##########` | 2,597 rows | dates lost to column width |
| Mode and Send-flag blank | every row | no frequency shown; consent gate has nothing to read (blank = send) |

All four are export formatting, fixable at the source in minutes.
