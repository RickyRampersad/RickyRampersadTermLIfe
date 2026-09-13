# Recruit Tracker — setup

The tracker lives at **rickyrampersadbranch.com/recruiting**. The page is
`recruiting/index.html` and `recruiting/app.js`, served by GitHub Pages like every
other screen here. What it shows comes from a private Google Sheet, **RRB Recruit
Tracker**, through `apps-script/Recruiting.gs`, and reaches a browser only after a
sign-in against that workbook's Access tab.

That split is the whole design. This repository is public and GitHub Pages serves
every file in it, so nothing about a candidate or an agent is in the page — not a
name, not a score, not a file. The Netlify build this replaced carried one
candidate's complete selection file and eighteen people's production, POP and
coaching figures inside `index.html`. It could not be committed here as it was.

---

## 1. Make the workbook

1. In the branch Google account, make a new Sheet called **RRB Recruit Tracker**.
   Use the account that should own the candidates' files — the script will make a
   Drive folder in the same account.
2. **Extensions → Apps Script.** Delete what is in `Code.gs`, paste the whole of
   `apps-script/Recruiting.gs`, and save.
3. In the function dropdown pick **`setup`** and press **Run**. Google asks for
   permission the first time — Sheets, Drive, and "connect to an external service",
   which is the call to Claude. Allow all three.
4. Open **Execution log**. It tells you what it made and what is still missing.

`setup()` creates every tab with its header row, the Drive folder **RRB Recruit
Tracker — Documents**, and one row on the Access tab for whoever ran it, with the
password `change-me`. Running it again touches nothing that exists.

| Tab | Holds |
|---|---|
| **Access** | who may sign in, their role, their password |
| **Candidates** | one row per candidate — index columns, then the record as JSON in 45,000-character chunks |
| **Documents** | one row per uploaded file — candidate, item number, the Drive file id |
| **Production** | agent production by agent number |
| **Cohort** | POP scores by recruit and year, with the outcome |
| **ManagerPulse** | the weekly coaching summary per manager |
| **Variance** | projected against actual, by agent and month |
| **MarketSurveys** | market survey quality by agent |
| **AiLog** | every call to Claude: who asked, about whom, what it cost |

The files themselves are in the Drive folder, one sub-folder per candidate, named
by item number — `3 — Form A.pdf`, `12 — Inspection Report.pdf`, `pop — POP7.pdf`.
A cell holds 50 KB; a POP report is 1.5 MB. The Documents tab is the index.

## 2. The Access tab

| Column | What goes in it |
|---|---|
| **Name** | as the person will type it to sign in — `Gary Sookdeo` |
| **Role** | written the way you would say it; abbreviations are understood |
| **Password** | per person, not obvious. Changed here, it changes at once |
| **Email** | optional; also accepted at sign-in |
| **Active** | leave blank or `Yes`; `No` turns the account off without deleting it |

The Role column decides what the tracker calls you and what it shows you:

| Role column says | Signs in as | Sees |
|---|---|---|
| Branch Manager, BM | Branch Manager | every candidate; may delete |
| Assistant Branch Manager, ABM, Assit Branch Mgr | Recruiting Manager | every candidate |
| Unit Manager, UM, Unit Mgr | Recruiting Manager | candidates they recruit or created |
| Branch Manager Assistant, BMA | BM Assistant | every candidate |
| Investigator | Investigator | every candidate |

The branch as it stands: Ricky Rampersad — Branch Manager; Kerwyn Ramroach —
Assistant Branch Manager; Gary Sookdeo and Akaash Kalladeen — Unit Managers; Kamla
— Branch Manager Assistant. A Unit Manager's sign-in also filters the figures: their
own cohort, their own coaching summary, their own agents.

Managers are matched by first name where the data only has a first name (`rm:
"Gary"`). That is safe until two managers share one. When that day comes, put the
full name in every `rm` and `manager` column and tighten `samePerson_` in the script.

**Change the `change-me` password before anyone else signs in.** Five wrong tries
locks a name for fifteen minutes; that is a backstop, not a password policy. A
sign-in lasts six hours, then the page asks again.

## 3. The Claude key

Three buttons call Claude: the POP 7 drill-down from a PDF, the same from pasted
text, and the coaching brief. They run on the server, with the key in the script,
never in the page.

**⚙️ Project Settings → Script Properties → Add script property:**

| Property | Value |
|---|---|
| `ANTHROPIC_API_KEY` | a key from console.anthropic.com |

Until it is set the buttons say so and nothing else breaks. The model is
`claude-opus-5`, with Anthropic's server-side fallback switched on so a request the
model's safety classifiers decline is re-run on a suitable model rather than coming
back empty. Every call is written to the **AiLog** tab with its token counts, so the
bill can be read off the sheet.

## 4. Deploy it

1. **Deploy → New deployment.** Type: **Web app**. Execute as: **Me**. Who has
   access: **Anyone**. Deploy.
2. Copy the **Web app URL**.
3. Open `recruiting/app.js`, find `APPS_SCRIPT_URL` near the top, paste the URL in
   place of `PASTE_THE_WEB_APP_URL_HERE`. Commit and push. GitHub Pages picks it up
   in a minute or two.

"Anyone" is what lets a browser read the reply. It does not let anyone read the
sheet: every request after sign-in carries a token, and the script checks it before
it answers anything.

**After any change to `Recruiting.gs`:** Deploy → Manage deployments → ✏️ →
Version: **New version** → Deploy. The URL does not change. Bump `SCRIPT_VERSION`
at the top of the file in the same commit; the page prints it in its footer, so you
can see from the site whether the redeploy took.

## 5. Connect Salesforce (optional, but it is the point of the induction screen)

The induction stage measures a new agent against the probation quota, and the
panel above it has always been labelled *Live data from BRANCH SETTLED*. Until
now it was not live — the figures came from a Production tab somebody pasted.

It reads Salesforce directly now, the same object the wall board reads:
`CLIENT_PORTFOLIO__c`, settled rows, summed on `Total_API__c` and grouped by
agent. Four Script Properties, the same four the renewal sync and the wall board
already use:

| Property | What it is |
|---|---|
| `SF_KEY` | Consumer Key from the Connected App |
| `SF_SECRET` | Consumer Secret |
| `SF_USER` | Salesforce username |
| `SF_PASS` | password with the security token appended, no space |

If the renewal sync works, these are the values it already has — copy them
across. `RT_SF_TOKEN` and `RT_SF_TOKEN_AT` appear on their own; those are the
cached session, not something you set.

Run **`rtSfTest()`** from the editor before trusting a screen to it. It prints
every agent with settled production this year and what it makes of them, so you
can see the names Salesforce uses before anybody signs in.

**Without these four the tracker works exactly as before** — the Production tab
is used, and the panel says so instead of claiming to be live. Salesforce being
down does the same thing rather than emptying the screen.

### Adding somebody already contracted

A recruit who has signed and started producing does not need walking through
eight stages. Run this from the editor:

```
addRecruit('Rajiv Soodoo', 'Akaash Kalladeen', { stage: 'induction' })
```

and again with the dates once somebody has them in front of them — it will not
make a second record for a name already there:

```
addRecruit('Rajiv Soodoo', 'Akaash Kalladeen', {
  stage: 'induction', agentNumber: 'A#####',
  probationStart: '2026-08-01', probationEnd: '2027-03-01'
})
```

Only what you pass is written; everything else is left blank rather than
guessed, and the execution log names the fields still waiting for somebody. A
POP score or a contract date invented at this point would be indistinguishable
on screen from one that was measured.

Until the probation dates are set the induction screen says *Probation dates not
set* rather than judging the recruit against a clock that has not been started.
The production figures are there from the first sign-in regardless.

### How an agent's figures find their way to a recruit

Salesforce knows agents by **name**; the tracker looks production up by **agent
number**. The Production tab is what joins the two: its `agentId` and `name`
columns are the roster, and the live figure replaces whatever is pasted in the
row. Names are matched on first and last word, so a double space or a middle
initial on one side does not break the join.

An agent settling business who has **no row on the Production tab** is named in
`productionSource.unplaced` rather than dropped.

The agent number can wait, though. The live figures are also sent keyed by the
agent's name, and the induction screen falls back to that — so a recruit
contracted this month has their settled production on screen before anybody has
typed a number anywhere. Rajiv Soodoo's $89,303 shows on his induction screen
with the agent number field still empty.

### Policy increases

`RT_SF.COUNT_INCREASES` is **on** — the branch's decision, 13 September 2026. A
probation figure is settled new business plus increases, the increases coming
from `Policy_Increases__c` on `API_Increase__c`, which is the branch's confirmed
Total API basis. Do not swap it for `Increase_API__c`; that is the joint-split
field, and the wall board's note about it applies here too.

One difference worth knowing when a figure looks higher than expected: **new
business counts when it settles, an increase counts when it is picked up.** That
is how the wall board has always measured them, so the two screens agree with
each other. Setting `COUNT_INCREASES` to `false` returns to new business alone.

### What it costs Salesforce

A sign-in builds the whole screen, so the first one after a quiet ten minutes is
one login and three queries — the year, the month and the week. Everything after
that comes out of a ten-minute cache, so a branch full of managers opening the
tracker is still about six queries an hour.

---

## 6. Bring the data in

### The figures

Five CSV files were handed over privately with this change — `Production.csv`,
`Cohort.csv`, `ManagerPulse.csv`, `Variance.csv`, `MarketSurveys.csv`. They are the
tables the old page carried inside itself. They are not in this repository and
must never be committed; `.gitignore` refuses `recruiting/*.csv` and
`recruiting/*.json` for that reason.

For each: click the tab of the same name → **File → Import → Upload** → Import
location: **Replace current sheet** → Separator: **comma** → Import. Column order
does not matter; header names do. From then on the sheet is the source — edit a
figure there and the page shows it on the next sign-in.

### The seeded candidate

The three `felicia-seed-part*.json` files hold one candidate's record and eighteen
documents. Sign in as the Branch Manager, press **Import** in the header, choose
part 1, wait for "Import complete", then part 2, then part 3. Each part sends the
record and its files to the sheet and to Drive; a part takes a minute or two on
branch signal. The files are then in the Drive folder, and the JSON files can be
deleted from wherever they were kept.

Every candidate after that is made in the page.

---

## What changed from the Netlify build

- **Storage.** Was IndexedDB in each browser — Kerwyn's laptop and Gary's laptop
  held separate copies that never met. Now one workbook, shared.
- **Sign-in.** There was none. Now the Access tab.
- **The figures.** Were hard-coded in the page. Now five tabs, read on sign-in,
  filtered to what the signed-in person is entitled to see.
- **Claude.** The page called `api.anthropic.com` directly with no key, which only
  works inside a claude.ai artifact. Now the script calls it with the key in
  Script Properties.
- **The mark.** The header drew its own shield. It now carries `logo-mark.png`.
- **Saving.** A keystroke was a free IndexedDB write; now it is a round trip, so a
  record is written about a second after typing stops, and "Saved" in the header
  appears only when the sheet has it. Leaving the page flushes what is pending.
- **Teaching prose.** Four passages in the Manager's Guide cited former recruits
  by name with their POP scores. The names are gone; the lessons are not.

Two questions from the Project are still open and unchanged by this move: the
tracker numbers the selection file 0–18 while the onboarding course was corrected to
the official 17-item index, and the tracker's Form A routing still says "Selection
Panel" where the Feb 2023 sheet says "Office of the Head of Sales".

## Checking it

```
node tests/test-recruiting.js      # the backend, on a fake Sheets and Drive
node tests/e2e-recruiting.js       # the page driving that backend in a browser
./tests/run.sh                     # everything, including the KPI tests
```

Both run on invented fixtures, so they work on a fresh clone with no branch data
anywhere near them. To run the same walk against the real seeded candidate:

```
RRB_SEED_DIR=/path/to/the/seed/folder node tests/test-recruiting.js
RRB_SEED_DIR=/path/to/the/seed/folder node tests/e2e-recruiting.js
```

The e2e test needs playwright and a chromium on disk, and skips itself when
there is neither. `tests/harness.js` fakes Sheets, Drive, Properties, the cache
and the lock with Google's real limits switched on — a new sheet is 26 columns
wide, a cell holds 50,000 characters, and a cache entry dies at six hours
however long you ask for. That is not decoration: the 26-column limit is what
caught a record over about 765 KB failing to save, which nothing would have
found until somebody wrote a long enough coaching note.

**What these cannot tell you.** They do not run Google's Sheets, Drive, quotas
or the six-minute execution limit. Deploy it and watch the first import — a POP
report is 1.5 MB going up and the analysis can take minutes, which is the part
most likely to meet a limit nobody here predicted.

---

## If something looks wrong

| You see | It means |
|---|---|
| *No Apps Script URL is set* | step 4.3 has not been done |
| *Unreadable reply from the workbook* | the deployment is not set to **Anyone** |
| *Your sign-in has expired* | six hours passed; sign in again |
| *Could not save to the branch workbook* | the sheet is unreachable or the row is locked; the edit is still on screen — wait and change something again |
| *Not recognised* | the name does not match the Access tab exactly |
| *No ANTHROPIC_API_KEY* | step 3 |
| Files missing from a candidate | look in the Drive folder; the id is in the Documents tab; `RT_DOC_FOLDER` in Script Properties points at the folder |

Two people editing the same candidate at the same time: the later save wins, whole.
The lock in the script stops two rows being made for one candidate; it does not merge
two people's typing.

## One hosting fact that bites

GitHub Pages serves this repository from its root, and the repository is public.
Anything under `recruiting/` is on the internet. The rule for this directory is that
it holds the app and nothing the app shows: no seed file, no CSV, no export. If a
backup is taken with **Export**, it goes to Drive, not here.
