# Recruiting app — migration notes

The Recruit Tracker is being brought across from a claude.ai Project into this
repository. This file records what arrived, what it contains, and what has to be
settled before any of it is served from rickyrampersadbranch.com.

## What arrived (6 September 2026)

One archive, uploaded from the Project, holding the **Netlify deploy bundle** of the
tracker:

| File | Size | What it is |
|---|---|---|
| `index.html` | 872 KB | The whole app: React 18 production build, ReactDOM, lucide icons, compiled Tailwind 3.4.14, and 364 KB of app code — all inline, one file |
| `felicia-seed-part1.json` | 2.4 MB | One candidate's record: profile, every stage, and three uploaded documents as base64 |
| `felicia-seed-part2.json` | 2.4 MB | Five more documents for the same candidate |
| `felicia-seed-part3.json` | 0.8 MB | Ten more documents, including the index sheet, Form A, and a police certificate |

The bundle stamps itself **`v5.5-B3 · Netlify standalone · auto-seed · Multi-part`**.
That is later than the v5.1 described in the Project conversation, so this build — not
the transcript — is the reference for what the app is.

**Not in the archive:** the onboarding course (a separate single-file HTML artifact,
about 327 KB, course version `2026-06-03d`). It still has to come across.

## The app, as built

**Source.** The app code is a production build: JSX compiled to
`React.createElement`, whitespace stripped, but top-level names kept. Run through
Prettier it becomes ~14,000 readable lines with 104 named components
(`AccountabilityMatrix`, `DiscoveryStage`, `CandidateDetail`, `BmApprovalStage`,
`ConfidentialReportSection`, …) and it parses. It is workable as source; there is no
separate JSX file.

**Storage.** IndexedDB, database `recruit-tracker-db`, one object store, with a
`recruit-tracker-backup-…` export path. Per browser, per device — nothing is shared
between two managers' machines.

**Seed.** On first load, if the store is empty, the app fetches
`./felicia-seed-part1..3.json` from beside itself and imports each part into
IndexedDB. A missing part is skipped (`if(!t.ok)continue`), so the app runs — empty —
without the seed files present.

**Stages.** `firstInterview → bmApproval → pop7Review → discovery → selectionFile →
approval → onboarding → induction`.

**Roster, as coded in `BRANCH_ROSTER`:**

| Name | Role in the deployed app |
|---|---|
| Ricky Rampersad | Branch Manager (also listed as acting RM) |
| Kerwyn Ramroach | **Asst. Branch Manager (formerly Unit Manager)** |
| Gary **Sookdeo** | Unit Manager |
| Akaash Kalladeen | Unit Manager |
| Kamla | Branch Manager Assistant |

Two things the Project conversation had wrong, corrected by the deployed code: the
surname is Sookdeo, not Gookdeo; and there *is* an ABM — Kerwyn. The v5.1 build that
removed the ABM seat was mistaken.

**Selection file checklist.** The tracker uses 19 items numbered 0–18 (0 is the index
sheet itself; 6 splits into 6.a and 6.b; item 9 is the GGLDC Discovery Report). The
onboarding course was later corrected to the official Revised Jun 2021 index of 17
items, which drops item 9 and renumbers 10–18 down by one. **The tracker and the
course currently disagree on form numbers.** The seed data uses the tracker's 0–18
scheme.

**Form A language.** The tracker still carries the Feb 2021 routing — "Selection
Panel" (12 mentions) and "VP Sales" (3). The Feb 2023 revision routes to the Office
of the Head of Sales; that update went into the course only.

**The AI calls are dead outside the sandbox.** Two places POST straight to
`https://api.anthropic.com/v1/messages` with `claude-sonnet-4-20250514` and no
authentication header at all. That works inside a claude.ai artifact, where the
platform proxies the call, and nowhere else. On Netlify those buttons already fail. A
key can never go in the page (the page is public), so these have to move behind Apps
Script or another server-side proxy.

## Personal data — settled 6 September: split code from data

This repository is public and GitHub Pages serves it at rickyrampersadbranch.com. The
`.gitignore` already says why client data never goes here: anything committed is
published twice, once on the site and once through GitHub, and git history keeps it
after deletion.

The bundle **as it stands cannot be committed** without publishing:

- **In the seed files:** one real candidate's complete selection file — phone, two
  email addresses, home address, a parent's name, and eighteen scanned documents
  including the POP 7 report, financial statements, two confidential reports naming
  the referee, the inspection report, an income analysis, and a police certificate of
  character.
- **In `index.html` itself, hard-coded as data:** 11 agents' production records by
  name and agent number (applications, settled API, lapses); 18 POP cohort entries by
  name, year, recruiting manager and every sub-score; four coaching lists with
  `repeat_offenders` arrays; narrative coaching notes on named agents. 23 people in
  all.

Ricky chose the split. What was built:

1. **Split code from data** (done) — the same shape as every other app here. The page holds
   the app; the candidate records, agent production, POP cohort and coaching lists live
   in a private Google Sheet and come down through Apps Script to a signed-in user. The
   seed files are imported into that Sheet once and never committed. This also fixes
   storage: shared, not per-browser.
2. **Keep it private elsewhere** — a private repository without Pages, or Netlify with
   password protection. Then it is not part of this site.

Committing the bundle unchanged to this repository is not one of the options.

## Still open

1. Which of the two form numberings is right for the tracker — the 0–18 it uses, or the
   17-item official index the course was moved to.
2. Whether the tracker's Form A routing should be updated to the Feb 2023 language.
3. The onboarding course file has not arrived.

## What was done (6 September 2026)

- `recruiting/index.html` — the page shell: compiled Tailwind, React, ReactDOM and
  lucide inline, the branch mark, `app.js`.
- `recruiting/app.js` — the v5.5-B3 app, prettified, with the IndexedDB backend
  replaced by an Apps Script one behind the same key/value interface, a sign-in
  screen, datasets loaded after sign-in, the three Claude calls routed through the
  server, the felicia auto-seed removed, and the four prose passages that named
  former recruits with their scores anonymised.
- `apps-script/Recruiting.gs` — the backend: Access-tab sign-in with tokens,
  role-scoped candidate CRUD, files to Drive, datasets from five tabs, Claude via
  `UrlFetchApp` with the key in Script Properties, an AiLog.
- `RECRUITING-SETUP.md` — how to stand it up.
- The five dataset CSVs and the seed JSON stay out of the repository; the CSVs were
  handed over privately and `.gitignore` refuses both under `recruiting/`.

Still open, unchanged by the move: the 0–18 versus 17-item numbering, the Form A
routing language, and the onboarding course has still not arrived.

## Tested (13 September 2026)

`tests/test-recruiting.js` — 106 checks against the backend on a fake Sheets and
Drive with Google's real limits enforced, 111 with the real seed. `tests/
e2e-recruiting.js` — 28 checks driving the page in a browser against that same
backend through `doPost`, 30 with the real seed, so nothing rests on a mock
written to match. `tests/harness.js` was extended to serve both scripts; the
eight existing KPI tests still pass unchanged.

Two things the tests found and fixed:

- **A record over about 765 KB could not be saved.** Nine headers plus eighteen
  chunks fills a new sheet's 26 columns exactly, and `getRange` past the grid
  throws rather than growing it. `ensureJsonColumns_` now widens the sheet
  first. Nothing would have met this until somebody wrote a long enough
  coaching note.
- **An unreadable POST body was answered with a cheerful `ping`.** It now says
  the body was not readable.

Two things the tests established rather than changed: selection-file item 10
carries no bytes of its own — it *is* the POP report, marked `sharedWithPop`,
and the page already falls back to the `pop` key for it; and a sign-in lasts six
hours, not the twelve the config asks for, because Google caps a cache entry
there.

Not covered: Google's own Sheets, Drive, quotas and the six-minute execution
limit. The first real deploy is still the first real test of those.

## Salesforce (13 September 2026)

The induction panel's *Live data from BRANCH SETTLED* label was not true: the
figures came from a pasted Production tab. It reads Salesforce now —
`CLIENT_PORTFOLIO__c`, settled rows, `SUM(Total_API__c)` grouped by
`AGENT__r.Name`, which is the query `WallBoard.gs` already runs for the wall
board, on the same four Script Properties the renewal sync uses.

Salesforce knows agents by name and the tracker looks them up by agent number,
so the Production tab is now the join between the two rather than the source of
the numbers. An agent producing with no row there is reported by name instead of
being dropped — which is what a newly contracted recruit looks like before
anybody adds them.

Policy increases count toward the probation quota — the branch's decision, 13
September 2026. `Policy_Increases__c` on `API_Increase__c`, counted when picked
up, where new business is counted when it settles; that is how the wall board
measures them, so the two screens agree.

**Rajiv Soodoo**, the newest recruit, is what drove the rest of it. He is
contracted and producing — 3 apps, $89,303 — but the induction screen looked
production up by agent number alone, so a recruit contracted before anybody
typed that number in had no figures at all, on the one screen that exists to
watch a new agent. Live production is now sent keyed by name as well and the
screen falls back to it. `addRecruit()` puts somebody already contracted
straight in at the induction stage with nothing invented.

His agent number, contract dates and POP scores are still not in this
repository, and are not things to guess. The screen asks for them rather than
filling them in.
