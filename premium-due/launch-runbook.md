# Launch Runbook — Premium Due Engine

**Target: first live run tomorrow, 8:00am.** Everything below is measured, not
guessed: the full live portfolio (20,354 rows) was run through
`dailyPremiumDueRun()` in dry-run mode on 13 August 2026, and these are its
numbers. All five test suites pass; every letter clears 3.2:1 contrast in both
themes.

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
| **Total planned** | **612** — of which **169 have no email** and are logged for a phone call |

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

## 2 · Dress rehearsal — tonight

- [ ] Run `dailyPremiumDueRun()` by hand in the deployed copy
      (`DRY_RUN: true`).
- [ ] Open **PremiumDueLog** and read the plan (~612 `outbound-dry`, ~391
      `internal-dry` rows). Spot-check three rows:
      one **s45** (amount, billing wording, MyGG button), one **mgr-commit**
      (manager name resolved — not "NO MANAGER MAPPED"), the **Servus
      group-statement** (recipient is the administrator you configured).
- [ ] Confirm no row addresses a company as a person, and no scheme member
      gets an individual letter.

## 3 · Go live — tomorrow morning

- [ ] Set `OUT.DRY_RUN = false`. Leave the caps at 60/60.
- [ ] After the 8am run, read the Logger line:
      `sent≈60 · internal≈60 · group-statements≈12 · held-by-cap` = the rest.
- [ ] **Two phone calls beat any letter today:**
      **Bertram Manhin** ($42.6k premium across two policies at the cliff) and
      **Ashsingh General Contractors** (5 policies, projected lapse this week,
      ~$24k — plus one already-lapsed $21k policy still inside reinstatement).

## 4 · The first week

- Backlog clears in ~8 runs, most-urgent-first. Expect `held-by-cap` to fall
  toward zero; from then on a normal day is well under the caps.
- Each morning: skim the log for `held-by-cap` and the **169 no-email
  policies** — that list is the agents' call sheet.
- Replies land at support@ / sales support. Until inbound automation exists,
  log them against the policy from the engine so the record stays complete.
- Managers will start answering by tap — watch the commit → thank-you →
  feedback ladder move on the dashboard.

## 5 · Safety rails already in place

One send per policy per stage, ever · every sequence stops on an answer or a
payment · urgency-sorted caps (60 client / 60 internal) · schemes get one
statement per fortnight, members never written individually · win-back only
inside 180 days · pending chased only to 120 days · the manager's commercial
questions never appear on client-copied email · contract wording quoted
verbatim or not at all · client letters carry no phone numbers — the tracked
case code instead.

## 6 · Rollback

Set `OUT.DRY_RUN = true` — sending stops instantly, planning continues, and
the log keeps recording. (Deleting the trigger stops runs entirely.) The log
is append-only; nothing is ever lost.

## 7 · Data fixes to request from ops (not launch blockers)

| Issue | Scale | Effect |
|---|---|---|
| Amount Billed all zeros | every row | letters can't show the exact figure — they degrade to "Settle it now" (never a fabricated amount) |
| Policy numbers as `5.00E+09` | 108 rows (19 chaseable) | untrackable until re-exported as text |
| Paid-to dates as `##########` | 2,597 rows | dates lost to column width |
| Mode and Send-flag blank | every row | no frequency shown; consent gate has nothing to read (blank = send) |

All four are export formatting, fixable at the source in minutes.
