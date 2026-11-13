# Claims TT — Setup Guide

## Go live — the short version

The page is **already published** at
<https://rickyrampersadbranch.com/claims/>. What it has not got is a backend:
`CONFIG.API_URL` is empty, so nothing a client types reaches anybody. Six
steps, and only three of them are yours.

| # | Who | What | How long |
|---|---|---|---|
| 1 | **You** | Merge the branch so the live page is the current one | 1 min |
| 2 | **You** | New Google Sheet **Claims TT** → Extensions → Apps Script → paste `apps-script/Claims.gs` → Run **setupClaims** → Deploy → New deployment → Web app (Execute as **Me**, Who has access **Anyone**) → copy the `/exec` URL | 10 min |
| 3 | Claude | Paste that URL into `claims/index.html` and `claims/staff.html`, push | 1 min |
| 4 | **You** | Claims TT menu → **Turn test mode ON**, then file a claim against yourself and read what arrives | 10 min |
| 5 | **You** | Salesforce Connected App → Claims TT menu → **Connect Salesforce** (Part 4) | 15 min |
| 6 | **You** | Add the staff who need the dashboard to the **Staff** tab, then **test mode OFF** | 5 min |

**Step 5 is optional for day one.** Without Salesforce the site works — the
claimant types their own policy number instead of it filling itself in, and
nothing writes back to `Claims__c`. Everything else is unchanged.

**Before step 2, read "Moving it on to the Workspace" below.** The sheet is on
the personal Gmail today, and which account owns it decides the `/exec` — so
doing the move first saves re-wiring the two pages twice.

### Re-paste `Claims.gs` — 4 November 2026 · **DONE, and verified live**

Pasted and deployed on 4 November. The same `/exec` was kept, so nothing had
to be re-wired. Test claim **CLM-2611-6840** confirmed both fixes on the live
backend: the desk notice carried five attachments, with
`Guardian accident report form.pdf` second after the branch's own claim form,
and the incident read **01 Nov 2026 at 14:30** — the time as it was typed.

What the paste carried:

- **The documents now travel with the e-mail.** The desk notice used to
  attach the branch's own claim form and nothing else, so Guardian's own
  accident report form — the one document the motor desk works from — arrived
  as a Drive link. Guardian's forms are attached first, then the papers an
  assessor reads, then the photographs, up to 18 MB; anything that did not fit
  is named in the body with its link. The client gets their own forms back,
  not their own photographs.
- **The time of loss was wrong on the desk notice.** A client who typed
  **14:30** had `Sat Dec 30 1899 18:30:00` printed to the claims desk, and the
  claim form PDF said the same, and `Date_of_Service__c` was written as
  **null** in Salesforce on every claim. One root cause — see the house note
  in `CLAUDE.md` — fixed at the one place both fields are read.

The staff card also gains a **When it happened** row, which it never had.

### The pages went light — 5 November 2026 · nothing to paste

Asked for in these words: *"also i dint like the dark website and please some
alterations"*. Both claims pages are off graphite and copper and on to the
branch homepage's own light palette, and the staff header, the hero and the
mark changed with it — the reasoning is in `CLAUDE.md`. These are HTML and CSS
only, so they go live when the branch is merged. **No paste, no new version.**

### Re-paste `Claims.gs` — 5 November 2026 · **health, and a real data loss**

**Paste `apps-script/Claims.gs` again and publish a New version** (Deploy →
Manage deployments → ✏️ → Version: **New version** → Deploy). What it carries:

- **Fifteen answers were being thrown away.** Only motor's fields were on the
  list of things worth storing, so a health claim collected the patient's
  name, their relationship to the member, their date of birth, whether the
  treatment was pre-authorised and whether another plan covers it — and
  discarded all five. Property lost four and life six the same way.
- **The health desk is now `healthclaimstt@myguardiangroup.com`**, with
  EB Customer Care copied rather than addressed.
- **The desk notice is per line.** It printed motor's questions at every desk.
- **The subject follows the branch's own convention**, which these desks
  already file by: `RRB CLAIMS SUBMISSION - <type> - <client> - <reference>`.
- **Ninety days.** Guardian's health form asks whether ninety days or less
  have passed; we hold the date, so the client is told on the review step and
  the desk at the top of the notice.
- The cosmetic fix from 4 November: an attachment reached the desk as
  `Driver's permit  front and back.pdf`, with two spaces where the em-dash
  was stripped out. `attachName_` collapses the gap.

The page half (the ninety-day check) is HTML and goes live on merge.

**Verified live** on CLM-2611-9805: the subject read `RRB CLAIMS SUBMISSION -
Prescription/Pharmacy Claim - …`, the notice opened on the red ninety-day
banner, the field block was health's with no motor rows in it, and the
*would have gone to* line named `healthclaimstt@myguardiangroup.com` with
EB Customer Care copied. `preauth` was correctly absent — it is only asked for
hospitalisation, overseas treatment and physiotherapy, and the blank row was
cut as designed.

### Re-paste `Claims.gs` once more — 5 November 2026 · **the printed form**

Reading that same claim's own PDF back showed the morning's fix had reached
the email body and not the attachment. **Paste `apps-script/Claims.gs` again
and publish a New version.** What it carries:

- **The printed claim form is per line of business.** It was motor's shape for
  every line: a health claim headed THE INCIDENT, printing *Date*, *Location*
  and *Estimated amount* for a treatment whose amount is a receipt total and
  not an estimate, and carrying the patient's name, relationship and date of
  birth nowhere except buried in the free text.
- **The ninety-day banner is on the form too**, not only in the covering email.
- **The client's words print once.** The block the site folds onto the end of
  the description is stripped before printing, now that every line of it has a
  labelled row above it. The sheet's Description column is untouched.

Nothing to do on the site for this one; it is all backend.

## Moving it on to the Workspace — 7 November 2026

Asked for in these words: *"the work code claims is on my personal and would
like to move to workspace"*. He is right, and it is the same move the motor
quote made on 21 October — see `CLAUDE.md`, which has the one sentence that
matters: **the sheet has to be OWNED by support@, not shared with it.** An
editor can run the script, and then Deploy refuses with *"You do not have
permission to perform this action"*, which looks like a Google fault and is
not.

**Where it is now.** "CLAIMSTT — Claims Tracker",
`1taKGaSprdP_BCt4KCNQiQNcXt1ZRubC4CAtlrdxlKHo`, owned by the personal Gmail,
made 6 August 2026. Three test claims on it and nothing real.

**Re-measured 12 November 2026, and it changes the route.** Every tab was read:
three test claims, seven test document rows, eight log lines, one Staff row —
and **Vehicle Register and Policy Register are header-only**, because Salesforce
has never been connected, so the registers have never synced. There is nothing
on this sheet to carry. That makes **starting fresh** better than copying
(below), and it makes this the cheapest moment the move will ever have.

**It landed on `support002@`, and that is settled.** On 12 November the browser
doing this was signed in as `support002@rickyrampersadbranch.com`, a second
account in the same Workspace, and Google answered the sheet with "You need
access" — which reads as a broken link and is not. It then turned out to be the
only account in the domain that can be signed in to, so **support002@ owns the
project**. What that costs, and what was done about it:

- **The ping still reads `onWorkspace: true`.** It compares the *domain* against
  `CLAIMS.OWNER_DOMAIN`, not the mailbox, so the move registers either way — and
  the daily mail allowance and the Drive recoverability, which are the two
  reasons for the move, belong to the Workspace whichever account holds it.
- **Test mail goes to support002@**, because `TEST_INBOX` is blank and falls
  back to the owner. Fine as long as somebody reads that inbox; set `TEST_INBOX`
  to send it elsewhere.
- **`MailApp` sends as the owner, so a client's acknowledgement would come From
  support002@** — an address no client has ever seen, and a reply to it would
  land in a mailbox nobody watches. **Fixed in build `2026-11-12a`:** `sendMail_`
  puts `CLAIMS.REPLY_TO` (`support@rickyrampersadbranch.com`, which is read
  every five minutes) on every e-mail that does not already name one. The desk
  notice *does* name one — the client's own address, so that a Guardian claims
  desk replying reaches the person who filed — and an explicit `replyTo` wins.
- **Worth asking a Workspace admin for, if it is ever easy:** add
  `support@rickyrampersadbranch.com` as a verified *Send mail as* alias on
  support002@. The From would then read support@ as well, which is the Log
  Book's own pattern (`lbGmailFrom_` reads `GmailApp.getAliases()`). The
  reply-to above makes that a nicety rather than a blocker.

**Why it is worth doing, beyond tidiness.** Two things, and the second is the
one that bites later:

- **The daily mail allowance.** A personal Google account allows about a
  hundred recipients a day, and every claim copies three addresses, so about
  thirty claims' notices in a day — before the acknowledgement, the chases and
  the follow-up run. That exact ceiling is why `MailRelay.gs` had to be built
  for the tracker. Under the Workspace it is roughly 1,500 and `MailApp` sends
  as support@ by itself, so the `MS_*` Graph properties are never needed here.
- **Every claim document lives in that account's Drive.** The folder is
  "Claims TT — Ricky Rampersad Branch" and the claim rows link into it. On a
  personal account nobody at the branch can reach a client's documents if the
  account is ever lost, and there is no admin who can recover it.

### First, thirty seconds that could save the whole job

Open the sheet → **Share** → add `support@rickyrampersadbranch.com` as an
editor → then the ⋮ beside that name and look for **Transfer ownership**.

- **Offered?** Take it. The file id, the data, the Drive folder, the bound
  script and every Script Property stay exactly as they are, and the `/exec`
  URL does not change, so nothing on the site has to be re-wired. Then sign in
  as support@, open Extensions → Apps Script, and publish **Deploy → Manage
  deployments → ✏️ → New version** so the web app runs as the new owner.

  **Then deal with the triggers, which a transfer does not move.** An Apps
  Script trigger belongs to the person who installed it, not to the file, so a
  transferred sheet goes on firing under the Gmail account and goes on spending
  its mail allowance — the very thing this move exists to escape. Delete all
  three on the old account (⏰ **Triggers**) and run **1. Set up / repair
  everything** as support@ to install them again. Measure both halves rather
  than assume: the ping's `runsAs` says whether the web app moved, and the
  Triggers screen, opened as each account in turn, says whether the triggers
  did.
- **Not offered?** That is the likely answer — Google does not generally allow
  an ownership transfer across the line between a personal account and a
  Workspace in another organisation. Do the copy below instead.

Either way, **check it took**: open
`…/exec?action=ping` and read **`runsAs`**. It should say
`rickyrampersadbranch.com`. `gmail.com` means the move has not happened, and
`""` means the deployment is not *Execute as: Me* and nothing can be stored at
all. That field is new in build `2026-11-07a` — a bound script keeps its own
`/exec`, so until now a moved project and an un-moved one looked identical
from outside, which is the failure this guide has already paid for twice.

### Start fresh — the route to take while the sheet is empty

Sign in as **support@rickyrampersadbranch.com and nothing else** — not a
second account in the same browser, which is what breaks Apps Script pages.
Then:

1. **A new blank Google Sheet**, named **Claims TT**. Extensions → Apps Script,
   name the project **Claims TT**, select everything in the default `Code.gs`
   and paste the current `apps-script/Claims.gs` over it. Save.

   Not **File → Make a copy**. A copy brings the three test claims, the two junk
   tabs named *Untitled* and *Copy of Untitled*, and — worse — rows whose Drive
   links point into the personal Drive, so support@ opens a claim and cannot
   read its own documents. `setupClaims` builds all seven tabs out of nothing,
   so the copy buys you only the rubbish; and the script has to be pasted either
   way, because the live one is four pastes behind. Copy instead of starting
   fresh **only if real claims are on the sheet by then**, and delete those rows
   and both junk tabs on the copy before anything else.
2. **Reload the sheet tab in the browser.** `onOpen` has never run on a sheet
   this new, so the **Claims TT** menu is not there yet. One reload and it
   appears. (Everything below can also be run from the Apps Script editor's own
   Run button, which is the way through if the menu still does not show.)
3. **Set test mode before you deploy anything.** A new project has no
   `TEST_MODE` property, and no property means **live** — so the first claim
   through it would e-mail Guardian's real health and motor desks. Claims TT
   menu → **Turn test mode ON**; or, if the menu has not appeared yet,
   Extensions → Apps Script → Run **`turnTestModeOn`**, which is new in this
   build for exactly that gap.
4. Run **1. Set up / repair everything** and grant the permissions. This is
   where the new Drive folder is made in support@'s own Drive, the triggers are
   installed, and support@ is added to the **Staff** tab.
5. **Enter the Script Properties. A new project has none of them, and neither
   would a copy.** This is the step that gets missed:

   | Property | How | If it is missing |
   |---|---|---|
   | `SF_DOMAIN`, `SF_CLIENT_ID`, `SF_CLIENT_SECRET` | Claims TT menu → **Connect Salesforce**, which prompts for all three — you never type the property names | No prefill, no ledger row, no task. The ping says so. |
   | `TEST_MODE` | step 3 above | **Live on day one** |
   | `CLAIMS_TASK_OWNER` | only if the task should not go to sales support | The task files on the default |
   | `CLAIMS_TESTERS` | see the note below | Your Gmail stops being a trusted tester |

   **Do not copy `CLAIMS_ROOT_ID`.** It points at a folder in the personal
   Drive. It is the one property that is safe either way — `rootFolder_` tries
   the id, fails, and makes a fresh folder — but leaving it out is cleaner.
   **Do not copy `CLAIM_SURVEY_SECRET`** either: it only signs feedback links,
   and no claim has been closed yet, so there is nothing to break.
6. **Deploy → New deployment → Web app**, Execute as **Me**, Who has access
   **Anyone**. Copy the new `/exec`.
7. Send me that URL. It goes in **two** places — the `API_URL` near the top of
   `claims/index.html` and of `claims/staff.html` (lines 1362 and 410 as this is
   written; find them by searching for `API_URL`, never by line number) — and
   they have to change together, or the client page and the staff desk talk to
   two different backends.

   **Each of those two files holds a second `/exec` further down**
   (`claims/index.html` line 3693, `claims/staff.html` line 789). That one is
   the view-counter beacon, a different Apps Script entirely; overwrite it and
   every visitor fires an unauthenticated request at the claims backend, which
   is the fault six other pages already carried for weeks. Change `API_URL`
   only.
8. **Switch the old one off, and that means its triggers too.** On the personal
   account: Extensions → Apps Script → ⏰ **Triggers**, and delete all three —
   `sweepAbandonedParts` (every 6 hours), `claimsFollowUp` (daily at 9) and
   `salesforceNightlySync` if it is there. Then Deploy → Manage deployments →
   archive the deployment, and turn test mode on as a belt.

   **Archiving alone is not enough, and the sheet proves it.** The Claim Log
   shows `auto-chase · Reminder 2` firing on **12 November**, eight days after a
   test claim was filed and four days after Reminder 1 — still running, still
   spending the personal account's mail allowance on a claim marked *TEST CLAIM
   — please delete*. A trigger left behind chases for ever out of an inbox
   nobody reads, against the exact quota this move exists to escape. And the old
   `/exec` keeps answering, so a client holding an old link files into a sheet
   nobody is watching — the kind of failure that looks like a handled claim
   until somebody asks why nothing happened.

### Two things that change under support@, and are easy to miss

Both come from the same line of code: the script trusts the account that owns
it, and that account is about to be a different person.

- **Test-mode mail goes to support@, not to your Gmail.** `TEST_INBOX` is
  blank, so the test inbox falls back to the owner. If you would rather keep
  reading the tests in Gmail, set `TEST_INBOX` to your own address.
- **Your Gmail stops being a trusted tester.** `claimsTester_` trusts the
  staff list, the three `MAIL_CC` addresses and the owner — so
  `Ricky.Rampersad@myguardiangroup.com` is still trusted and
  `rampersadricky@gmail.com` is not. That matters for two things only: a
  sign-in code reaching you in test mode, and the client door answering you
  plainly instead of "if we have that on file". Either test from your Guardian
  address, or put the Gmail in `CLAIMS_TESTERS`.

### Testing the Salesforce link

Setting `SF_LOGIN_URL`, `SF_KEY` and `SF_SECRET` does not fill the registers —
**run the menu item** *Claims TT → Sync registers from Salesforce now*. It
reports how many vehicles and policies it wrote. Until it has run, the number
plate lookup on the claims page misses every real plate, which looks exactly
like a broken connection.

**What it should find**, checked against the live org on 5 November 2026, with
every field name in both queries confirmed to resolve: about **1,600
vehicles** and about **54,000 policies**.

**The vehicle count is now a count of COVER TERMS, not of vehicles**, and it
will be several times larger: one row per vehicle per year of cover, so a car
insured with us for five years is five rows. The menu says so. That is what
lets a claim for an accident in an earlier term be assessed against that
year's sum insured instead of being told the loss is before the policy
started. Two new columns at the end of the tab, **Term** and **Risk Id**, tell
one year's row from another's — and `Years Insured` now says how many terms
are on file, which it never did before.

**Vehicles sync first, on purpose.** Those two sizes are very different — the
policy half is 28 pages of SOQL and half a million cells — and Apps Script
stops an execution at six minutes. **A timeout is not catchable**, so whichever
register runs second is the one that silently never happens, and the plate
lookup is both the cheap one and the one the motor page leans on. Policies
have a fallback the plates do not: `sfFindPortfolio_` asks Salesforce directly
for any policy the register has not seen.

So if the run ends in a timeout rather than a count, the vehicles are already
in. *Sync vehicles only (fast)* on the same menu does that half on its own.

Then test it from the page: open `/claims/`, pick Motor, continue to the
details step and type a registration into **Number plate or policy number**.
A synced register answers with the vehicle and a way to confirm it is yours.

### Before you turn test mode off: the desk addresses

A claim is only forwarded to a line's claims desk when that line is listed in
`CLAIMS.DESK_OK`. **`health`, `life` and `motor` are**, because only those
three addresses are confirmed.

**Health** is `healthclaimstt@myguardiangroup.com`, with
`EBCustomercare@myguardiangroup.com` copied. That ordering is the branch's own
— every health claim sales support has filed by hand goes To: Health Claims TT
with EB Customer Care in copy, not the other way round. EB Customer Care is the
right address for a change of cover or a billing question, which is what the
renewal desk uses it for.

**Motor** is `GGILPCClaims@myguardiangroup.com` — GGIL P&C Claims, at Guardian
General, which is a different company from Guardian Life — with
`CRMSClaims@myguardiangroup.com` copied. Confirmed 5 November 2026 off the
branch's own record rather than off a department list: one motor claim ran from
14 August to 2 November 2026 on a single e-mail thread, and GGIL PC Claims is on
every message of it, in the To line beside the Motor Claims Department
representative who handled it. The branch's own first notification of loss went
to the same desk. Only department inboxes are configured, never the individual
representative on one claim — people move, and a desk is what gets read.

**Life** is `GLOC.IndividualLifeClaims@myguardiangroup.com`, with **nothing
copied beside it**. Confirmed 13 November 2026 by the branch manager — *"yes
that is the life claims"* — and by the branch's own record, where that inbox
both sends and receives on death and critical-illness threads. It covers life
and CI. `GLOC.AnnuityPaymentsQueries@` turned up in the same search and is not
it: a payments queries desk, not a claims one. No second department inbox
appears on those threads, so none is configured — a Cc added on a hunch is a
mailbox nobody has agreed to read.

**A motor claim's subject is Guardian General's own, not ours.** Their desk has
filed this branch's claims under `Vehicle # - <plate> Insured - <name> Date of
Accident - <date>` for years, and every reply quotes it, so a thread that does
not match it starts life detached from the way they work. Motor keeps their
shape with our reference on the end; health and the rest keep
`RRB CLAIMS SUBMISSION - <type> - <client> - <ref>`, the form sales support has
always used. One format for all five would be wrong on four of them.

**Property and pension are blank**, and a claim on either still files, still
goes into Drive, still acknowledges the client, and still e-mails you and
sales support — with a red banner saying **"Pass this on by hand"** and which
address to set. Nothing is ever sent to an address nobody has confirmed: a
claim landing in an unwatched mailbox reads as handled, to us and to the
client, until somebody asks why nothing happened.

**Both are blank because the record has no desk inbox for them**, not because
nobody looked. A property claim ran three months in mid-2026, and a
death-and-pension claim ran from 10 to 25 August 2026 over some twenty
messages, and every message on both went to **named representatives** — no
department inbox in To or Cc on any of them. P&C does mean Property &
Casualty, so for property the department is right and the inbox is the open
question; and "Individual Life" is not pension, so the life desk above is not
assumed to cover it.

**So it is two questions to Guardian**, and the whole of it:

1. Does `GGILPCClaims@` take a **property first notification of loss**?
2. Which inbox takes a **pension** one?

**Find the answer the way all three confirmed desks were found: open a real
claim thread of the branch's own and read the To line.** Not the Log Book's
Departments tab — it gives a department's *name* and not its mailbox — and not
Query Pal's routing labels, which are labels in a table. And never a search
for a guess at the name: on 8 November this mailbox was searched for
`lifeclaims`, `LifeClaimsTT` and `GLOCClaims`, all three came back empty, and
"life has no claims desk" was written down as a finding. It is
`GLOC.IndividualLifeClaims@`, which none of those three matches, and it was on
the branch's own threads the whole time. A search that misses proves nothing.

That is the pattern on both motor claims in the record too: the first
notification goes to a department inbox, and the thread after it runs with the
one representative assigned. The intake only ever sends a first notification,
so a department inbox is the right target — and an individual, who moves, is
the wrong one.

Once an answer is in: put the address in `CLAIMS.DESK`, add the key to
`CLAIMS.DESK_OK`, and file one test claim on that line to watch it arrive.

### Where claimstt.com fits

Nowhere, yet — and it is not in the way. GitHub Pages takes **one** custom
domain per site and this one is `rickyrampersadbranch.com`, so claimstt.com
can only redirect there until hosting moves. Go live on
`rickyrampersadbranch.com/claims/` and treat the domain as a separate job;
see *Pointing claimstt.com at it* below.

---

The custom claims intake for **claimstt.com**, replacing the Jotform hand-off.

A client picks their claim type, answers only the questions that apply to it,
photographs their documents with their phone, and submits. What comes out the
other end:

- a **claim reference** they can quote and track,
- a **Google Drive folder** per claim holding every document,
- a **row on the Claims tab** of a private Google Sheet,
- a rendered **claim form PDF** filed with the documents and attached to the
  desk email,
- an email to the **claims desk for that line of business**, CC'd to **sales
  support** and to you,
- a **thank-you and acknowledgement** to the client listing what arrived and
  what is still outstanding,
- **passwordless sign-in**: clients see all their claims and upload
  outstanding documents directly; staff get a full dashboard at
  `/claims/staff.html`,
- **automatic follow-up** that chases the client for missing documents and
  nudges the desk on stalled claims, and stops the moment the claim closes.

Everything runs on free tiers: Netlify (hosting) + Google Apps Script
(storage, email, PDF). No servers, no monthly cost.

---

## ⚠️ Read this first — how this site is actually published

**The live site is GitHub Pages, serving this public repository's root.**
(`server: GitHub.com` on rickyrampersadbranch.com — verified.) That has two
consequences that shape everything below:

1. **Anything committed here is public twice over** — once on the website and
   once through GitHub itself (`raw.githubusercontent.com`). There is no
   server-side blocking on GitHub Pages: `netlify.toml` does nothing unless
   hosting moves to Netlify. The only protection is never committing client
   data, which is why `data/*.csv` is now gitignored.

2. **Git history is public too.** The client data files that used to live in
   `data/` were removed from the current tree, but the commits that carried
   them (`b3b8771`, `8f51b58`) remain reachable — a raw URL at those commit
   ids still serves the files today. Removing them for real means a history
   rewrite (`git filter-repo` + force push, then a GitHub support request to
   drop cached views), **or** making the repository private — which is
   instant, but GitHub Pages on a free personal plan requires a public repo,
   so the site would go down until hosting moves (Netlify imports private
   repos free, and this repo already carries a working `netlify.toml`).
   One of the two should happen; which one is your call.

3. **Rotate the staff key.** `apps-script/Code.gs` is served on the public
   site and previously contained the live `STAFF_KEY` for the renewals staff
   dashboard. Treat that key as burned: open the Apps Script copy of Code.gs
   and set a fresh long private value. The repo copy now holds a placeholder.

Nothing under `data/` is ever read by the website at runtime — the claims
lookup goes to Apps Script, which reads the private spreadsheet.

---

## Part 1 — Publish the site (nothing to do)

The claims site is `claims/index.html`, a static page. GitHub Pages already
serves this repository, so the moment this lands on `main` it is live at:

```
https://rickyrampersadbranch.com/claims/
https://rickyrampersadbranch.com/claim          ← the short one, for WhatsApp
```

### Is it safe to send a client to it? Ask the ping — 5 November 2026

Asked in three words — *"can I use this now"* — and it could not be answered
from outside. The ping returned the file-size limits and nothing else, so test
mode, the desk addresses and the Salesforce link were all invisible, and the
honest answer was a guess. `?action=ping` now answers:

```json
{ "ok": true, "service": "claims-tt", "build": "2026-11-05f",
  "testMode": true, "live": false,
  "desks": { "motor": true, "property": false, "health": true,
             "life": false, "pension": false },
  "desksReady": ["health", "motor"], "staffCanSignIn": 4,
  "salesforce": false,
  "says": "TEST MODE. Every e-mail goes to the test inbox — a real client
           would hear nothing. Claims TT menu → \"Turn test mode OFF\"…" }
```

**`says` is the whole answer in one sentence**, so nobody has to read flags. It
has three forms: test mode; live with lines that have no desk, which it names;
and live with every line routed, plus a sentence each for Salesforce not being
connected and for nobody being on the staff list.

**Probe with GET and the ping; do NOT read a POST's refusal as a verdict on the
build.** `doPost` rejects any body whose `siteKey` does not match
`CLAIMS.SITE_KEY`, and the wording it uses is *"This form is out of date.
Please refresh the page and try again."* — which is right for a client holding
a stale page, and badly misleading for anyone probing with `curl`, because a
hand-made POST never carries the key. On 8 November 2026 two such probes were
read as proof that client and staff sign-in were dead on the live deployment.
They were not: the same two probes return the same message against a
brand-new, correctly deployed backend. The ping's `build` field had already
dated that deployment independently and honestly; the POST added nothing but a
wrong conclusion. If a POST must be probed, send `siteKey` (it is in
`claims/index.html`, so it is public by construction — an anti-abuse token, not
a credential), and note that a `requestCode` probe really does send, so in test
mode a `[TEST]` copy lands in the test inbox.

**`staffCanSignIn` is a count, never the addresses** — this endpoint needs no
sign-in. **Zero is the state to look for**: the staff sign-in then answers
every address with "a code is on its way" and sends nothing, which is exactly
what happened on 5 November 2026. Run **1. Set up / repair everything**.

**`build` is how a browser tells which copy is running.** It is `CLAIMS.BUILD`,
a date in this file's own header. From outside, "never pasted", "pasted but
never deployed" and "a later paste of an older copy won the same function name"
look identical — that is the standing Apps Script trap, and a build marker is
the only cheap way through it. **Change `CLAIMS.BUILD` with any change worth
deploying.**

It leaks nothing: the desk addresses are already in this public file, so the
ping reports only *whether* each line has one.

**A key in `DESK_OK` is not enough on its own.** `deskFor_` wants an address
*and* the flag, which is the right rule — it is what stops a half-finished
switch-on from silently routing claims into the void.

### How a person finds it without being sent a link — 5 November 2026

Reported in these words: *"I am not seeing claims in my site!"* He was right,
and nothing was broken. Both pages answered **200**, and the homepage carried
five links to them. They were simply nowhere a person looks:

- the top nav read Quotes | Apply | Clients | Careers | Portals | FAQ — **no
  Claims**, and the phone menu behind the burger is a *separate* list of links
  that had none either;
- the only claim tile sat **ten screens down** on a phone (8,240px into a
  17,483px page), behind a full-width orphan-policy panel;
- the footer link is at screen 20, which is nobody's route;
- and the branch app had **no claims tile at all**, so `claims/staff.html` —
  the desk the staff are supposed to work from — could not be reached.

What changed: **Claims** in the nav and **File a claim** in the phone menu,
both pointing at `#claim`; the "Make a claim" group moved above the orphan
panel, so it is the first thing in Clients, as that section's own lede already
promised ("File a claim, respond to a premium notice…"); a `/claim` stub for
the address a person actually types; and two tiles in the branch app under
Clients and queries — **File a claim** for everyone, **Claims desk** for staff
and the branch manager.

**The anchor needs `scroll-margin-top`.** The nav is `position: sticky` and the
page sets no scroll margin anywhere, so without it a jump to `#claim` parks the
heading *under* the bar. It is on the heading, inline, at `6rem`.

**A `.row rise` at `opacity: 0` is not a bug.** Measuring the live page without
scrolling showed both tiles at zero and it reads like the known failure mode in
CLAUDE.md. It is not: the reveal is `animation-timeline: view()`, and both
reach opacity 1 as soon as they are scrolled to — with motion off they are at 1
from the start. Scroll to it before concluding anything, and sample for
`>= 0.9`, since a reading taken mid-animation comes back at 0.997.

Deep links pre-select the claim type — this is what to put in an SMS to a
client who has just called about an accident:

| Link | Opens |
| --- | --- |
| `/claims/?type=motor` | motor claim |
| `/claims/?type=motor&sub=theft` | motor, vehicle stolen |
| `/claims/?type=health` | health claim |
| `/claims/#track` | claim tracking |

(The prettier `/claim/motor` short links in `netlify.toml` only work if
hosting moves to Netlify — GitHub Pages cannot do redirects.)

### Pointing claimstt.com at it

**claimstt.com is not a placeholder, and since the JotForms were switched off
it is a dead end for clients.** Found 10 November 2026, when the branch
manager opened it expecting the new page: it serves a **GoDaddy** site (DNS
resolves to GoDaddy's IPs, not GitHub's `185.199.108-111.153`) with one of the
retired JotForms embedded in it, so the page now shows JotForm's own
*"Form not found. This form is disabled."* card. Anybody who goes to
claimstt.com cannot file a claim, and nothing on the page says where to go
instead.

**This repository has never served that domain and cannot fix it from here.**
The GoDaddy site is outside the repository and outside Apps Script; the fix is
in the GoDaddy account.

**The two-minute fix: GoDaddy domain forwarding.** My Products → claimstt.com
→ Manage → **Forwarding** → forward to `https://rickyrampersadbranch.com/claims`,
**Permanent (301)**, and **Forward only — never "Forward with masking"**.
Masking serves the page inside a frame under the old address, which breaks the
sign-in (the six-digit code), the uploads and the claim reference, and leaves
every link pointing at a domain the page does not know. If GoDaddy refuses
because a Websites + Marketing site is published on the domain, unpublish that
site first — it is the thing showing the dead form.

**Or keep the GoDaddy page** and edit it: delete the JotForm section and put a
button to `https://rickyrampersadbranch.com/claims` in its place. Slower to
maintain, and it leaves two pages telling clients two things.

**The end state, when there is time:**

- **Stay on GitHub Pages:** GoDaddy DNS → CNAME `claimstt.com` (and `www`) to
  `rickyrampersad.github.io`. But a GitHub Pages site takes **one** custom
  domain, and this one already uses rickyrampersadbranch.com — so claimstt.com
  redirects to the branch **homepage**, not to `/claims/`. That is worse than
  forwarding, which lands on the exact page.
- **Move hosting to Netlify** (free, imports this repo directly): both
  domains can then point at the same site, the `netlify.toml` short links
  and `/data/*` blocking come alive, and the repo could go private without
  taking the site down. This is the better end state.

Until then everything works at `rickyrampersadbranch.com/claims/`, which is
live and current — check the live page before assuming otherwise.

---

## Part 2 — The Apps Script backend (10 minutes)

Claims runs in **its own Google Sheet and its own Apps Script project** — an
Apps Script project may only have one `doGet` and one `doPost`, and `Code.gs`
(renewals) and `Market.gs` (trading league) already use theirs.

1. Create a new Google Sheet named **Claims TT**.
2. **Extensions → Apps Script**, delete the placeholder, paste all of
   [`apps-script/Claims.gs`](apps-script/Claims.gs).
3. Edit the `CLAIMS` config at the top:
   - `DESK` — the claims address for each line of business. **Check these
     before going live**; the health, life and pension addresses are best
     guesses and the motor/property one is the general claims desk.
   - `MAIL_CC` — already set to you, sales support and the branch inbox.
   - `SITE_KEY` — change it, and change it to match in `claims/index.html`.
4. **Run → setupClaims**, and approve the permissions (Sheets, Drive, Gmail).
   This creates the tabs, the Drive folder, and installs the daily follow-up.
5. **Deploy → New deployment → Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Deploy, and copy the URL ending in `/exec`.

## Part 3 — Connect the site (1 minute)

Open [`claims/index.html`](claims/index.html), find `CONFIG` near the bottom of
the file, and set both values:

```js
const CONFIG = {
  API_URL: "https://script.google.com/macros/s/XXXXXXXX/exec",
  SITE_KEY: "claims-tt-2026-rrb",   // must equal CLAIMS.SITE_KEY in Claims.gs
  ...
```

Commit and push — GitHub Pages rebuilds in a minute or two (this repository is
served by Pages, not Netlify; see Part 1). The orange "Preview mode"
banner disappears once `API_URL` is set; that is how you know it is live.

**Test it safely:** in the sheet, **Claims TT menu → 🧪 Turn test mode ON**
— every email (desk, client, chase) is then rerouted to your own inbox with a
`[TEST]` banner naming the real recipients, so nothing can reach a client or a
claims desk while you experiment. File a claim against yourself with a photo
attached: you should get the acknowledgement with the PDF and the desk email
with the Drive folder link, both marked `[TEST]`. Turn test mode OFF from the
same menu when you go live.

**One exception: a staff sign-in code.** Rerouting that one makes the staff
dashboard impossible to test — the code arrives somewhere the person signing in
cannot use it, which is precisely what stopped the branch manager signing in on
5 November 2026. So in test mode a sign-in code for an address the branch
already trusts goes **to that address**, marked `[TEST]`, with the test inbox
copied: anyone active on the **Staff** tab, anyone on `CLAIMS.MAIL_CC`, the
Google account that owns the script, and anything listed in the
**`CLAIMS_TESTERS`** Script Property (comma separated). **A client's own
sign-in code still reroutes**, so no client hears from a test.

---

## Part 4 — Switch on policy prefill

This is the part that removes most of the pain. A claimant types their number
plate; the vehicle, chassis number, engine number, policy number, cover type
and their own contact details fill themselves in.

### Connect Salesforce — no CSVs, ever

The system reads Salesforce itself. Once connected:

- the **registers rebuild themselves nightly (~3am)** from `CLIENT
  PORTFOLIO` (policies — Record Type separates health/life/pension) and
  `Risk Details` (vehicles — **one row per vehicle per year of cover** since
  5 November 2026, so a claim for an accident in an earlier term is assessed
  against that year's sum insured and policy number),
- a policy the sync hasn't seen yet is **looked up live** at claim time,
- every filed claim **writes itself into `Claims__c`** — Opened, dated,
  policy-linked — so the branch ledger stops depending on manual typing, and
- every filed claim **opens one Task**, due in two working days, on the
  client's Contact and on the policy record (for motor, on the cover term the
  loss falls in), with the reference in the subject so a reply finds the file.

Both writes are skipped automatically in test mode.

**Who owns the task.** It goes to `rickyrampersadsalessupport@` unless the
**`CLAIMS_TASK_OWNER`** Script Property names someone else. Whoever it is must
be an **active standard** Salesforce user with that e-mail — the branch
manager's address also sits on four *site guest* users in this org, and a task
owned by a guest user is a task nobody will ever open, so the lookup insists on
exactly one standard match. If it cannot resolve one, the task still opens
(owned by the integration user) and the claim's Internal Notes say so.

**One-time admin step in Salesforce** (Setup → App Manager → New Connected
App):

1. Enable OAuth Settings; callback URL can be `https://localhost` (unused).
2. Scopes: *Manage user data via APIs (api)*.
3. Tick **Enable Client Credentials Flow**, and under the app's *Manage →
   Edit Policies*, set the **Run As** user — an integration (or your own)
   user with read access to `CLIENT_PORTFOLIO__c`, `Risk_Details__c` and
   `User`, and create access to `Claims__c` and `Task`.
4. Copy the **Consumer Key** and **Consumer Secret**.

`SF_WRITE_CLAIMS=off` turns off the ledger row and `SF_WRITE_TASKS=off` the
task, either as a Script Property, without touching the code.

Then in the Claims TT sheet: **Claims TT menu → ☁️ Connect Salesforce**,
paste your My Domain URL (`https://yourorg.my.salesforce.com`), the key and
the secret. They are stored in Script Properties — never in code, because
`Claims.gs` sits in a public repository. The menu's *Sync registers from
Salesforce now* fills both tabs immediately; the nightly trigger keeps them
fresh from then on.

### Fallback: building registers by hand

Until Salesforce is connected (or if the Connected App is ever down), the
registers can be built from report exports with the two scripts below —
the same tabs, the same behavior, just manual. The export is **not kept in
this repository** (client data, public repo). Put your local copy at
`data/risk-details.csv` — the path is gitignored — then:

```bash
python3 data/build-vehicle-register.py
```

It writes `data/vehicle-register.csv` (also gitignored — import it, then
delete it). Output from the August 2026 export:

```
495 risk rows  ->  429 distinct vehicles
quarantined: 24 rows whose registration is not a registration

  Policy #      87%     Chassis #   64%
  Make          80%     Engine #    60%
  Model         84%     Email       33%
  Year          95%     Mobile      37%

  full prefill (make + model + chassis)   58%
  usable prefill (make + model)           78%
  639 lookup keys (plate + policy number)
```

Risk Details holds one row per vehicle *per policy year*, each carrying a
different fragment of the truth. The script merges them, which is what lifts
chassis coverage — a number recorded once in 2019 and never again comes back
into the current record. It also folds `TAA-1234` and `TAA 1234` into one
vehicle, which is where 66 of the duplicate records went.

### Import it

In the **Claims TT** sheet, open the `Vehicle Register` tab, then
**File → Import → Upload → `vehicle-register.csv` → Replace current sheet**.
Prefill is live immediately; no redeploy needed.

Re-run the script and re-import whenever you refresh the Salesforce export.

### The policy register — health, life, pension prefill

Motor answers to a number plate; every other line answers to its **policy or
plan number**, served from the `Policy Register` tab. It is built from
Salesforce `CLIENT PORTFOLIO` (the Record Type column is what separates
HEALTH / LIFE / PENSION) by `data/build-policy-register.py`:

```bash
# from a Salesforce report export (Record Type, POLICY #, Product Name,
# Contact: Full Name, Email, Home Tele, Home Phone, Date Of Birth):
python3 data/build-policy-register.py --report portfolio-export.csv
```

Import `policy-register.csv` into the **`Policy Register`** tab the same way.
The first build (September 2026, health only) came out at **1,915 distinct
policies — 80% verifiable online**: the claimant proves the policy is theirs
with the last four digits of the mobile on file **or their date of birth**
(76% of health policies carry a DOB). The lookup uses an indexed exact-match
search, so the tab can grow to the full 55,000-portfolio book without
slowing down.

The same two-stage privacy rule applies: a policy number alone reveals only
the line and product name — never a name or contact detail — until the
verification question is answered, and five wrong answers lock the policy
out for fifteen minutes.

### How the privacy split works

A number plate is public — anyone can read one off a bumper. So the lookup is
deliberately two-stage:

1. **`findPolicy`** returns only what is visible from the pavement anyway:
   *"2025 Toyota RAV 4 — Private Comprehensive. Is that your vehicle?"*
   No name, no email, no phone, no policy number.
2. **`verifyPolicy`** asks for the last four digits of the mobile on file, or
   the policy number. Only a correct answer returns the record.

Five wrong answers on the same plate inside fifteen minutes and it stops
responding.

Without that split, typing a stranger's plate would return their name, home
email and phone number. Note that only **37% of vehicles have a mobile on
file** and **87% have a policy number** — so most clients verify with their
policy number. Every client can skip the lookup entirely and type their
details in; prefill is a convenience, never a gate.

### The quarantine list

The script also writes `data/vehicle-register-quarantine.csv` (locally, not
committed): 24 rows whose "Vehicle Reg" field does not hold a registration —
chassis numbers, a make, placeholders like `TBA`. Those clients cannot be
found by plate until the Salesforce records are corrected. The file lists
each one with the client name and policy number so they can be fixed at
source.

---

## What the client sees

```
1. Type        motor / health / property / life / pension
                 ↓ then the sub-type, which decides the whole checklist
2. Details     only the questions that apply — with the policy lookup on top
3. Documents   a checklist per sub-type, drag-drop or phone camera,
                 photos compressed in the browser before upload,
                 "I don't have this yet" on anything they cannot produce
4. About you   contact details and (optionally) settlement bank details
5. Review      everything laid out as an assessor reads it, plus three
                 declarations that must be ticked
                 ↓
   Reference   CLM-2608-4821, printable, trackable
```

Two details worth knowing:

**Deferring a document is a first-class action.** Waiting until you have every
paper is the single biggest cause of a slow claim, so the form actively invites
filing without the police report and records what is outstanding.

**Photos are compressed in the browser** — longest edge 1800px, JPEG q0.75 —
before they leave the phone. A claim with ten 6MB photos becomes a few hundred
KB, which is the difference between an upload that works on mobile data and one
that times out. Files upload in 1.5MB chunks and are reassembled server-side,
and one bad file never sinks the whole claim.

**If the backend is unreachable**, the page opens a pre-addressed email
containing the entire claim and a list of the documents to attach. Nothing is
ever lost to a dropped connection.

---

## Logins — how sign-in works with no passwords

Nobody in this system has a password. Signing in means: give us your email
(clients may also use their mobile number), we email a **6-digit code**, you
type it back. Codes last 10 minutes, allow 5 attempts, and at most 3 are sent
per hour per person — so there is nothing to forget, reset, phish, or leak.

**Clients** sign in on the claims page under *Your claims*. They see every
claim they have (matched by the email or mobile on their claims), its status
on a progress line, what is still outstanding — and an **Upload now** button
beside each outstanding document that puts the file straight into the claim's
Drive folder, marks it received, and logs it. When the last outstanding
document arrives, a claim waiting on documents moves itself back to *Under
review*. Sessions last 30 days on that device. Clients with no email on file
can't receive codes — for them the **quick check** (reference + last 4 mobile
digits) still works, so nobody is locked out.

**The client sign-in only knows an address or mobile number that is already on
a filed claim.** Anything else gets the deliberately vague *"if we have that on
file, a code is on its way"* and nothing is sent — that is what stops the page
being used to find out whether we hold a given person. **One exception: one of
the branch's own addresses** (the `Staff` tab, `CLAIMS.MAIL_CC`, the script
owner, `CLAIMS_TESTERS`) **is told plainly** that there is no claim under it,
because that is somebody testing rather than a stranger fishing. So to try the
client side on yourself, **file a claim carrying your own address first** —
until then there is nothing for the client door to find.

**Staff** sign in at `/claims/staff.html` — but only emails listed on the
**`Staff` tab** of the Claims TT sheet (`Email, Name, Role, Active`) with
`Active=Y` ever receive a code. **An address that is not on the tab is told
so plainly**, and the page does not then ask for a code: the deliberately
vague "if we have that on file" answer is for the *client* door, where it
stops a stranger fishing for whether we hold somebody, and there is no client
behind a staff address. **Run 1. Set up / repair everything** and it puts
every address on `CLAIMS.MAIL_CC` and the Google account that owns the script
on the tab as `Admin`, adding only what is missing — an address already there
is left exactly as it is, `Active = N` included. Add each team member as a
row. Removing someone = set Active to `N` (their next sign-in fails; their
current session dies within 12 hours). The dashboard
gives them the pipeline (counts by status), search, and per-claim: full
detail, the documents with Drive links, editing what's outstanding, a
one-click chase email, status changes (optionally emailing the client),
assignment, and internal notes the client never sees. **Every staff action is
written to the Claim Log with the staff member's name** — that's the
accountability trail.

**You** are simply staff with the `Admin` role — and you keep the Google
Sheet itself as the master console for anything the dashboard doesn't cover.

Uploads are locked accordingly: during filing the browser holds a one-time
upload key, and after filing only a signed-in owner of the claim, or staff,
can add files. A guessed claim reference alone can do nothing.

## Day-to-day: the Claims TT menu

| Menu item | What it does |
| --- | --- |
| Set up / repair everything | Rebuilds tabs, folder and triggers. Safe to re-run. |
| Open the claims Drive folder | Where every document lives |
| Email the client their new status | Change `Status` on the row, then run this |
| Chase outstanding documents now | Manual chase for the selected row(s) |
| Run the follow-up sweep now (test) | Runs the daily automation immediately |
| Clean up abandoned uploads | Sweeps parts from uploads that were interrupted |

### The tabs

**`Claims`** — one row per claim. `Status` is a dropdown; changing it is what
drives everything else. `Missing Documents` is what the automation chases.

**`Claim Files`** — one row per uploaded document, with its Drive link.

**`Claim Log`** — the audit trail. Every submission, every automatic email,
every failure.

**`Vehicle Register`** — the prefill source. Nothing writes to it but you.

### The automatic follow-up

Runs daily at ~9am.

- **The 10-working-day review.** Every acknowledgement promises the client a
  review within 10 working days — the same turnaround the old health e-form
  promised — and the system holds the branch to it. Each claim gets a
  `Review Due` date on filing (weekends and the T&T holidays in
  `CLAIMS.HOLIDAYS` skipped; top up the moveable holidays once a year). On
  that day, the assigned staff member (or the desk, if unassigned) receives
  the review checklist: check the carrier portal, deal with anything
  outstanding, update the status, tell the client. The staff dashboard flags
  the claim with **⚑ review due** until it moves.
- **Chasing the client** at 3, 7, 14, 21 and 30 days while anything is
  outstanding. One email per claim per day, never a burst. The last one says
  it is the last and hands over to a phone call.
- **Nudging the desk** at 10, 25 and 45 days without movement on an open claim,
  with the folder link and whether the hold-up is the client or us.
- **It stops** the moment `Status` becomes `Settled`, `Declined` or `Closed`.

Cadences are `REVIEW_WORKING_DAYS`, `CHASE_DAYS` and `DESK_NUDGE_DAYS` in the
config.

---

## The claim form PDF

Every claim renders one: the answers laid out as a form on branded paper, saved
into the claim's Drive folder and attached to both the desk email and the
client's acknowledgement. It carries the declaration the client accepted
online, so nothing needs printing or signing.

**It is laid out per line of business**, the same split the desk notice makes.
A health claim is headed *The member · The patient · The treatment* and prints
the patient, their relationship to the member and their date of birth as rows
of their own; property is headed *The property · The incident*; life is *The
life assured · The claimant*; motor keeps *The claimant · The incident*. A row
with nothing in it is cut, never printed as a dash.

That matters more than the email's layout does. The email is read once; **the
PDF is what gets filed, forwarded and opened again six weeks later**, and on a
health claim the person treated is often not the member, so the patient has to
be the first thing an assessor sees.

**A health claim's form carries the ninety-day banner too**, so whoever opens
it later can see the date was known and flagged on the day it was filed.

**The client's own words print once.** The site folds every type-specific
answer onto the end of the description under a rule of dashes, because for a
long time that was the only way those answers reached anybody. They now have
labelled rows, so the appended block is stripped before printing — on the form
and in the email alike. The sheet's **Description** column still holds the whole
folded text, untouched: that is the raw record of what was submitted, and
**Answers (JSON)** holds the same answers structured.

### Filling Guardian's own AcroForm instead

`Claim Form Motor.pdf` is a real fillable AcroForm with 154 named fields
(`INSUREDNAME`, `ACCIDENTDATE`, `TPDREGNOINSUR1`, …). Pushing values into
those named fields — rather than rendering our own layout — is the better
long-run answer for the motor desk, and it has already been proven to work.

Apps Script cannot manipulate AcroForms natively, so that step needs one small
service alongside this one (a Netlify or Cloud Function running `pdf-lib` or
`pypdf`, called from `saveClaimForm_` with the claim JSON, returning the filled
PDF). The renderer in `Claims.gs` is what runs today and is what keeps the desk
working from day one.

Two defects in that template need fixing once, whichever route is taken:

- the page `/Annots` arrays were stripped, so an ordinary PDF reader shows a
  blank form even though the fields are present;
- six third-party fields are anchored to page one instead of page two, which
  collides text at *Registration No.* and *Sum Insured*.

The other three forms (Living Benefit, Newlife Living Benefits, and the
Guardian General property peril form) have **no form fields at all** — two are
pure scans with no text layer. Each needs its field boxes mapped by hand once,
roughly half a day per form.

---

## Adding a claim type

Everything the site asks is data, in `claims/index.html`:

```js
TYPES.pension = {
  label: "Pension / Annuity", icon: "📈",
  blurb: "...",
  subtypes: [{ id: "maturity", label: "Plan reaching maturity" }, ...],
  fields:   [{ id: "planNumber", label: "Plan number", type: "text", half: true }, ...],
  docs:     [{ id: "birthcert", label: "Birth certificate", req: ["maturity"] }, ...],
};
```

- `req` and `show` take `true`, `false`, or a **list of sub-type ids** — that
  is how the same type asks for a police report on a theft but not on a
  windscreen chip.
- Any field with no dedicated column on the sheet is folded neatly into the
  description, so the backend schema never has to change.

Add the matching entry to `CLAIM_TYPES` and `DESK` in `Claims.gs` and it is
done.

---

## Client feedback — every closed claim is asked

A claim is the moment a client finds out whether any of this was worth
paying for, and until October 2026 Claims TT was the only platform in the
branch that never asked how it went. It does now.

**When.** The moment a claim reaches `Settled`, `Declined` or `Closed` from
the staff dashboard. Claims closed by hand on the sheet are caught by the
daily 9am sweep, because the status dropdown fires no code.

**What is asked.** Three questions on the same 1-to-5 scale the renewal
portal uses — overall, how easy, how fast — so the two books can be added
together into one branch service rating.

**The first click is the answer.** Five scored links ride in the email, so
rating the claim costs one tap from the inbox. The page then asks the other
two and takes a comment. A survey that needs a form loaded before it records
anything mostly records nothing.

**A declined claim is still asked**, and asked in different words. Surveying
only the clients who were paid measures the policy wording, not the branch.

**A score of 3 or less** on overall or speed writes a service-recovery note
onto the claim and emails the branch the same day. The note is visible beside
the claim on the staff dashboard; the call is the part the system cannot do.

**The link is signed.** `?survey=REF&k=…` carries an HMAC of the reference,
so a reference on its own cannot be used to file somebody else's rating. An
invalid token and an unknown reference return a byte-identical page, so the
link cannot be used to find out which references exist. The secret is created
on first use and never leaves Script Properties.

The survey page is served by `Claims.gs`'s own `doGet`, so the rating works
even while `claims/index.html` is still in preview mode — though with the
front door unwired there are no claims to survey yet.

Menu: *Claims TT → Preview the feedback request* shows exactly what a client
would get without sending it. Turn test mode on and *Send feedback requests
now* to receive one yourself.

---

## Still to plug in

- [x] **Apps Script `/exec` URL** → `CONFIG.API_URL` in **both**
      `claims/index.html` **and** `claims/staff.html`. Set 13 November 2026 to
      the Workspace project. Until it is set the site is in preview mode:
      nothing is filed, nothing is chased, the ten-working-day clock never
      starts, and the page tells every visitor so.
- [x] **The feedback link finds its own address** — `surveyUrl_()` reads the
      running web app's own `/exec` and notes it in the `CLAIMS_EXEC_URL`
      Script Property, so `CLAIMS.SURVEY_URL` no longer has to be pasted after
      every deploy. It never was, which is why client feedback had been off
      from the day it was built. Needs build `2026-11-13b` or later.
- [ ] **`SITE_KEY`** changed from the default, in both files
- [ ] **Claims desk addresses** — health, life and motor are confirmed;
      **property and pension** are the two still open
- [ ] **Staff emails** added to the `Staff` tab (Active=Y) so the team can
      sign in at `/claims/staff.html`
- [ ] **Salesforce Connected App** created by an admin (see *Connect
      Salesforce* above) and its key/secret entered via the Claims TT menu —
      this switches on nightly register sync, live policy lookup, and the
      `Claims_Revised__c` record and its task. (**Not `Claims__c`** — that
      object was abandoned in 2016 and holds one record from this year; the
      live one is `Claims_Revised__c`.) Until then the registers stay empty,
      so a signed-in client sees no vehicles and a motor claim cannot be
      judged against the cover in force on the day of loss.
- [ ] **Moveable T&T holidays** topped up in `CLAIMS.HOLIDAYS` each January
- [x] **Rotate `STAFF_KEY`** — now read from Script Properties
      (`RENEWAL_STAFF_KEY`) rather than from `Code.gs`, and the published
      `CHANGE-ME` placeholder can no longer authorise anything. Run *Guardian
      Renewals → Issue a new staff key* once; every old dashboard link dies
      with it, so send the team the new one.
- [ ] **Git history**: purge the client-data commits, or make the repo
      private and move hosting to Netlify — see *Read this first*
- [ ] **claimstt.com forwarded** — it is a live GoDaddy site serving a retired
      JotForm, so it tells every client the form is disabled. Two minutes in
      the GoDaddy account; see *Pointing claimstt.com at it*
- [ ] **Guardian compliance sign-off** before the site takes live client data

That last one is not a formality. The system holds names, addresses, policy
numbers, medical detail, bank particulars and ID documents — that carries real
obligations under Trinidad & Tobago's Data Protection Act, and the answers to
"where is it stored, who can see it, how long is it kept" should be Guardian's,
not ours. Worth starting that conversation now rather than after launch.
