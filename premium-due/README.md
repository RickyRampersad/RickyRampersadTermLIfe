# Premium Due Engine

Tracks every premium in arrears through the 45 / 60 / 90-day lapse funnel: the
45-day client survey, the 60-day retention notice with one-click client choices,
the agent's retention case, the manager response, and every status comment
against the policy. Replaces the two JotForms
and the "Premium Due Status" comment columns.

| File | What it is |
|------|-----------|
| `index.html` | The whole app — login, dashboards, case threads, client outreach |
| `staff-manual.html` | Staff manual — the day-to-day reference |
| `process-brief.html` | Rollout brief for the team: the workflow, the actual client emails rendered, and what each role does differently |
| `../apps-script/PremiumDue.gs` | Backend — reads the portfolio, stores the log |
| `../apps-script/PremiumDueAuth.gs` | Sign-in, the roster tab, tokens and scope |
| `../apps-script/PremiumDueTemplates.gs` | Client email + WhatsApp templates and the daily send |

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

| Stage | Trigger | What's due |
|-------|---------|-----------|
| Overdue | Status 2, 1–44 days | Comment / contact |
| 45-Day | Status 2, 45–59 days | Client survey |
| 60-Day | Status 2, 60–89 days | Client picks an option · agent files by day 65 · manager answers within 5 days |
| 90-Day | Status 2 at 90+, or Status 1 | Reinstatement or win-back |
| Pending | Status 3 / underwriting incomplete | New business chase |

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
why: *What would help most right now?* (seven answers, every one a service we
provide) and *When would suit you?* (a commitment device). Nobody is asked to
account for a failure before being offered anything.

The 60-day letter carries the full **correspondence trail** — every letter sent,
whether the client replied, what they chose, and the fact find where one is
attached — so the last letter in a sequence reads like someone has been paying
attention. The `From` and `CC` addresses match the Salesforce macro *Premium Due
75 Days Client Comm*.

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
seven questions, so the definitive answer is on the record rather than assumed.

### The 60-day escalation

Day 60 the client gets an email referring back to the 45-day message, carrying
ten one-click choices in four groups, with the agent, their unit manager and
the BM copied. It quotes the day-45 questions and the client's own answers back
to them, and sets out the remaining timeline with dates.
No reply → chased every 5 days. Two internal clocks run alongside it:

| Clock | Deadline | Missed |
|-------|----------|--------|
| Agent files the case | day 65 | Emailed, manager copied; shows as *Waiting on [agent]*; hits their sign-in gate |
| Manager answers | 3 working days from filing | Emailed every 3 days, BM copied from the second; hits **their** sign-in gate |

`blocker(c)` names the single person holding each case. It runs only inside the
60-day window — a policy that lapsed in 2014 has nobody late on it, and counting
those would bury the live cases under thousands of historic ones.

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
