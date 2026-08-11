# Premium Due Engine

Tracks every premium in arrears through the 45 / 75 / 90-day lapse funnel: the
45-day client survey, the 75-day agent retention case with fact find, the manager
response, and every status comment against the policy. Replaces the two JotForms
and the "Premium Due Status" comment columns.

| File | What it is |
|------|-----------|
| `index.html` | The whole app — login, dashboards, case threads, client outreach |
| `staff-manual.html` | Staff manual. Open it in a browser or host it; send the link to the team |
| `../apps-script/PremiumDue.gs` | Backend — reads the portfolio, stores the log |
| `../apps-script/PremiumDueTemplates.gs` | Client email + WhatsApp templates and the daily send |

## Which sheet is which

| Sheet | Role |
|-------|------|
| **Branch Portfolio** | Read-only source. Tab `gid=0` = "Premium Due status". Set as `PORTFOLIO_ID` |
| **Premium Due Tracker** | Write target. Holds the `PremiumDueLog` tab. Bind the Apps Script to this one |
| Motor Renewal Book — Schedule | A different system (`Code.gs`). Not used here |

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
3. On that build only, fill in the `DEPLOY` block at the top of the `<script>`:

   ```js
   const DEPLOY = {
     SHEET_URL: 'https://script.google.com/macros/s/…/exec',
     CODES: { 'Ricky Rampersad': 'RR-123', 'Anthony Simmons': 'AS-456', … }
   };
   ```

   With `CODES` filled in the demo banner disappears and real codes apply.
   Alternatively leave the file alone and use **Connect sheet** in the top bar,
   which stores the URL in that browser's localStorage only.

## How it stages a policy

Off the **status flags**, not a raw day count — for a Status 0 "Premium Paying"
policy the Days column is age-on-book, not arrears, and would otherwise drag
thousands of healthy policies into the lapse funnel.

| Stage | Trigger | What's due |
|-------|---------|-----------|
| Overdue | Status 2, 1–44 days | Comment / contact |
| 45-Day | Status 2, 45–74 days | Client survey |
| 75-Day | Status 2, 75–89 days | Agent retention case + fact find → manager |
| 90-Day | Status 2 at 90+, or Status 1 | Reinstatement or win-back |
| Pending | Status 3 / underwriting incomplete | New business chase |

Duplicate and churn detection keys on **Client Number**: several policies under
one client on the same plan code flags a possible replacement written over
in-force cover; an active policy alongside a lapsed one flags repeat churn.

## Roles

| Role | Sees |
|------|------|
| Agent | Their own book, behind the accountability gate |
| Unit Manager | Their unit's book + manager queue |
| ABM | Their reporting line, resolved recursively |
| Sales Support / BM | The whole branch + manager queue + scorecard |

The **accountability gate** stops an agent at sign-in if they have 75-day cases
with no retention form or 90-day lapses with nothing logged. They must type a
commitment (15 characters minimum) to enter, and it is written to the policy
thread — once per policy per day, not once per sign-in.

## Known gaps

Tracked in the build review; none of these are fixed here.

- **Authentication is browser-side.** `DEPLOY.CODES` keeps codes out of this
  repository, but a signed-in user can still read every code from the page.
  The fix is a `?type=auth` endpoint in the Apps Script that returns a session
  and scope, so the roster never reaches the browser.
- **The daily send has never run live.** `PremiumDueTemplates.gs` ships with
  `OUT.DRY_RUN = true`, so it writes an `outbound-dry` plan to the log and emails
  nobody. Read a full dry run before setting it false — the book holds ~6,000
  lapsed policies and a misconfigured live run would mail all of them. The cap
  (`MAX_SENDS_PER_RUN`) and the win-back age limit exist for the same reason.
- **Survey links use bare policy numbers**, so anyone who guesses one can file a
  response as that client. Signed short tokens (the `/r/<token>` pattern the
  renewal portal already uses) would close it.
- **The roster covers 25 people; the live book names 89 agents.** 61 of them,
  holding ~3,260 policies, sit outside every agent and unit view, and 8 people
  who appear in `UNITS`/`HIERARCHY` have no code and cannot sign in at all.
- **The branch view opens on everything** and truncates at 300 rows with no
  indication of what's behind it. Most of the book is historic lapses; the live
  save work is the ~750 cases in the 45 and 75-day windows.
