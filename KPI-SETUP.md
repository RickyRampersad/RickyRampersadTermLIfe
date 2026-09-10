# Daily KPI & Innovation Tracker — setup

The tracker is two pieces:

| Piece | Where | What it does |
|---|---|---|
| `kpi/index.html` | served with the rest of the site, at `/kpi/` | sign-in, the daily form, and the manager's three reports |
| `apps-script/KPI.gs` | bound to the KPI workbook | reads and writes the sheet, checks passwords, sends the 3pm and weekly emails |

---

## 1. Put the script in the workbook

1. Open the KPI workbook → **Extensions → Apps Script**.
2. Add a file called `KPI.gs` and paste in everything from `apps-script/KPI.gs`.
3. **Project Settings → Time zone → `(GMT-04:00) Atlantic Time`** — the 3pm
   trigger and every date in the reports read from this. Getting it wrong moves
   the checkpoint an hour and can push entries onto the wrong day.
   Set the **workbook's** zone to match, in the Sheet itself under
   **File → Settings → Time zone**. Date cells are stored against that zone;
   the script reads them back in it, so the two agreeing keeps every entry on
   the day it was logged.
4. **Project Settings → Script Properties → Add** `MANAGER_EMAIL` = the address
   the reports should go to. Several addresses, separate them with commas.
   Leave it unset and the reports go to whoever owns the workbook.

The script finds the tabs by the columns they carry, not by their names, so
renaming a tab will not break it. It needs:

- a tab with **StaffId** and **KPI1_Actioned** — the daily log
- a tab with **Email** and **Password** — the Access tab

It creates `KPI Training` itself the first time somebody logs a training session.

## 2. Clear out the duplicate rows — once

The old script *tried* to update one row per person per day. It matched like
this:

```js
if (String(data[i][1]) === String(e.date) && ...)
```

The app posts the date as the text `2026-06-22`. Sheets parses that into a real
date cell on the way in — so reading it back gives a Date object, and
`String(...)` on it returns `Mon Jun 22 2026 00:00:00 GMT-0400 (…)`. That never
equals `2026-06-22`, so the match always failed and the row was appended
instead of updated. Every save, every time.

The workbook holds **63 rows for 32 actual reports**: 16 days are byte-identical
copies of one submission, 3 more are edits that landed as new rows rather than
replacing the original. One of Azariah's days is in there five times over. Every
total built on that sheet — closed, overdue, the pivot — has been counting some
days twice and others five times.

The new script normalises both sides to a plain `yyyy-mm-dd` before comparing,
reading date cells in the spreadsheet's own time zone, so it matches whether the
column holds text, a date cell, or `6/22/2026`.

In the Apps Script editor pick **`dedupeLog`** from the function dropdown and
press **Run**. It keeps the newest row for each person and day and deletes the
rest, and tells you how many it removed. Take a copy of the workbook first if
you want a way back (**File → Make a copy**).

From then on the script updates a person's row for the day instead of adding
another, so this does not need doing again.

## 3. Deploy it

**Deploy → New deployment → Web app**

- Execute as: **Me**
- Who has access: **Anyone**

Copy the `/exec` URL and paste it into `APPS_SCRIPT_URL` near the top of
`kpi/index.html`.

> "Anyone" here means anyone may *call* the script — not that anyone may read
> the branch's data. Every request other than sign-in has to carry a token the
> script issued, and staff only ever get their own rows back.

Re-deploy after any change to `KPI.gs`: **Deploy → Manage deployments → edit →
Version: New version**. Skipping this is the usual reason a change appears to do
nothing.

### Handing the redeploy to somebody else

**rickyrampersadbranch.com/redeploy** is that job written out for a person who
does not work in code: five steps, each saying what they should see when it has
worked, and a button that asks the workbook which version is answering and
times it. They find out themselves whether it took, instead of messaging
somebody and waiting.

It hinges on `SCRIPT_VERSION` at the top of `KPI.gs`. **Bump it in the same
commit as any change to that file**, and change `WANT` in
`redeploy/index.html` to match. A deployed script is invisible from outside —
this is the only way anybody can tell which one is running, and not being able
to tell is what cost a day in September: the redeploy was done, it was still
slow, and nobody could say whether the new code was live or the old.

If the check reports the old script, it is nearly always **New deployment**
used in place of **Manage deployments → pencil → New version** — which quietly
creates a *second* web address while the tracker carries on talking to the
first.

## 4. Turn on the emails

Run **`installTriggers`** once from the editor and grant it permission when
asked. That sets up five triggers:

- **3pm checkpoint**, weekdays — who has logged, who has not, who is behind, and
  every blocker raised so far
- **Staff nudges**, weekdays at noon and three
- **Weekly summary**, Friday 5pm — the week against the week before
- **Warm-up**, every ten minutes in office hours

The checkpoint and the nudges are one daily trigger each and skip the weekend
themselves. They used to be five weekday copies each, fifteen triggers, and a
script project holds at most twenty — the day Branch Intelligence joined this
project its own six could not be installed ("This script has too many
triggers"). Re-running `installTriggers` on a project that still has the
fifteen replaces them with the five.

Apps Script fires a time trigger within the hour it is given, so the checkpoint
lands between 3 and 4 — while the last block is still running and there is
something you can do about it.

To read either one without waiting, run **`sendCheckpoint`** or **`sendWeekly`**
from the editor. To see one without anybody being emailed, run
**`previewCheckpoint`** or **`previewWeekly`** and open **Execution log**.

---

## Roles come from the Access tab

The **Role** column decides which KPI list a person gets and whether they can
read anyone else's entries. Abbreviations are expanded before matching, so write
it the way you would say it — `Branch Mgr`, `Assit Branch Mgr`, `Unit Mgr` and
`Branch Mgr Assistant` all land correctly.

| Role column says | Gets | Sees |
|---|---|---|
| Branch Mgr | Branch Manager list | the whole branch |
| Assit Branch Mgr | Assistant Branch Manager list | own entries |
| Unit Mgr | Unit Manager list | own entries |
| Branch Mgr Assistant | BMA list | own entries |
| Sales Support | SSA list | own entries |

The Branch Manager alone can read other people's records. Seniority does not
come into it — the ABM and the Unit Managers see their own work, same as
everyone else.

Change somebody's job in the sheet and the tool follows. Nothing in the script
needs editing, and there are no hard-coded exceptions.

Run **`checkSchedule()`** after any change to the tab. It reports two things:
anyone whose Role column disagrees with what they actually log, and any
scheduled block pointing at a KPI that person's role does not have. A clean run
says *"Schedule is consistent"* and nothing else.

### The passwords are single digits

The accounts use `1`, `2`, `3`, `4`, `5`, `7`, `8`. Anyone who reaches the page
is a few guesses from another person's record, and the Access tab is the only
thing standing between a browser and the branch's data.

Change the **Password** column to something per-person and non-obvious before
staff start using it. Nothing else has to change — the script reads whatever is
in that column.

The script gives an account five wrong tries and then refuses that name for
fifteen minutes. That is a backstop, not a substitute for real passwords.

---

## Connecting Salesforce

Optional. Without it everything still works — sign-in, blocks, the checkpoint,
the weekly summary. What you lose is the part that reads people's real task
position instead of asking them to count it: open, overdue, aged and closed
today, plus the Needs-a-reason, Billing check and Waiting-on views.

Two Script Properties, under **⚙️ Project Settings → Script Properties**:

| Property | What it is |
|---|---|
| `SF_KEY` | Consumer Key from the app |
| `SF_SECRET` | Consumer Secret from the same app |

That is the whole of it. No password, no security token.

`SFK_TOKEN` and `SFK_TOKEN_AT` appear on their own once it works — those are the
cached session, not something you set.

### The app

**Setup** → **External Client App Manager** → **New External Client App**.

- API Name takes letters, numbers and underscores only — `RRB_KPI_Tracker`. The
  label can have spaces
- Tick **Enable OAuth**
- Callback URL: `https://login.salesforce.com/services/oauth2/success` — nothing
  calls back, but the field is required
- OAuth Scopes: **Manage user data via APIs (api)**
- Flow Enablement: tick **Enable Client Credentials Flow**
- Save, then **wait ten minutes**. Salesforce needs that long to propagate, and
  trying sooner fails in a way that reads like a wrong key

Then open the app → **Policies** → **Enable Client Credentials Flow** → set
**Run As** to a user with API access.

**That Run As user is not optional.** Client credentials has no person signing
in, so without it Salesforce has no identity to issue a token for and returns
`invalid_grant` — which reads like a credentials problem and is not one. It also
decides what the tracker can see: it reads as that user, so it needs visibility
of the branch's tasks.

Consumer Key and Secret are under the app's **Settings** → **OAuth Settings** →
**Consumer Key and Secret**, behind an emailed verification code.

### Why not a password

Older builds of this script used the username-password flow, and the setup notes
here used to explain how to append a security token. Salesforce has withdrawn
that flow: it is absent from the Flow Enablement list on an External Client App,
and an org on that model records **Username-Password Flow Disabled** in Login
History regardless of the credentials sent, regardless of the org-level toggle
still being ticked in OAuth and OpenID Connect Settings.

The script still supports it, for an org where it survives. Set `SF_USER` and
`SF_PASS` and it is used automatically. Nothing needs `SF_AUTH` unless you want
to force one or the other.

Client credentials is the better arrangement in any case. Nothing expires when a
password changes, no security token goes stale, no refresh token rotates, and
the credentials in Script Properties are the app's rather than a person's.

### If the org still refuses

**Setup** → **Identity** → **Login History** is the place to look, not the error
text. It records Salesforce's own reason for every attempt — the flow being
disabled, the Run As user missing, an IP restriction — where the OAuth response
gives you `invalid_grant` for all of them.

### Checking it### Checking it

Run **`sfKpiTest()`**. It maps each person on the Access tab to their Salesforce
user and prints what it found. On failure it prints Salesforce's own words
rather than a summary, so the message names the actual problem.

Two things it is built to survive, both real in this org: one person having more
than one user record on the same address, and an address shared with Site Guest
Users that own nothing. Guests are dropped by `UserType`; among what remains the
active record wins, but an inactive one is still used rather than dropping
somebody who owns this month's work.

---

## One thing the old script did that this one doesn't

The script being replaced also had a second endpoint, for course results:

```js
if (e.kind === "training") { ... }   // Name, Role, Course, Score, Outcome
```

That is what wrote the two `Daily KPI & Innovation Tracker · 6/6 · PASS` rows on
the workbook's first tab. Nothing in the site posts to it — the new tracker
never has — so replacing the script is safe as far as this repository goes. But
if you have a quiz or sign-off page **outside** the repo pointing at that same
`/exec` URL, it will stop recording once you deploy. Say so and it takes ten
minutes to carry across.

That first tab is left exactly as it is either way. The new training register is
a separate tab, `KPI Training`, and records something different: who delivered
training to whom, on what, and whether it was tested.

## Reporting after each block

The tracker now takes a block at a time. This is the thing that has been asked
for since 21 August — *"please amend to have reporting done after each KPI as
customary"* — and it is why the entry screen looks different.

Each person opens their own day and sees their four blocks, with the times and
the focus straight off the DILO: Ashley's 9–10 is *Client Portfolio creation,
Macros, Surveys*, her 10–1 is *Scripts / Clawbacks / Servicing Lines*. The KPI
for the block is already chosen, so opening a block is a confirmation rather
than a blank page. They write what they did and press **Submit block**.

That block, and only that block, is written. The other three are untouched, and
the day is still one row. A block submitted at 10:04 is stamped 10:04, so the
3pm report reads what was actually done by 3pm rather than what someone recalls
at four o'clock.

**The schedule lives in the script**, in `SCHEDULE` near the top of `KPI.gs` —
hours, lunch, and what each block is for, per person. The app reads it from
there. Changing somebody's day is one edit in one place, and it stops the DILO
being retyped into a mail every morning. Anyone not listed gets neutral blocks
and an empty KPI.

### Who gets emailed, and when

| | When | Who | What |
|---|---|---|---|
| Block receipt | on every Submit block | the person who submitted | their own words back, and how many blocks are in |
| Midday nudge | weekdays 12:00 | anyone whose morning is blank | which morning blocks are outstanding |
| 3pm chase | weekdays 15:00 | anyone short of blocks 1–3 | what is missing, and a request for the final block |
| 3pm Checkpoint | weekdays 15:00 | you | the branch at the cut |
| Weekly Summary | Friday 17:00 | you | the week against the week before |

The receipt is the thing to paste into the branch group — no retyping what they
just wrote.

**A person who is up to date is never written to.** The nudges look at what has
actually been submitted and skip anyone who is current. A reminder that arrives
when you have already done the thing is how people learn to ignore reminders.

`Pawan Probhu` is on the DILO but not on the Access tab, so he is not in the
app and gets none of this. Add him to Access if he should be.

## Performance: the tabs the form lives in

The Performance Evaluation form's contents are Guardian's HR papers. They live
in the workbook, never in this repository, which is public. The script reads
two tabs you paste in and creates five it writes to.

**You paste these** (a TSV for each was provided — new tab, exact name, click
A1, paste):

| Tab | Columns | What it is |
|---|---|---|
| `Goals` | Role · Order · Goal · Description · TargetType · Weight · Target · KpiTypes | The performance goals per role, weights summing to 100. `KpiTypes` is the comma-separated list of tracker KPI types whose activity is evidence for the goal. Only `ssa` is supplied; add the other roles' forms as rows. |
| `Competencies` | Order · Competency · Definition · Behaviours | The eight core competencies and the dictionary. Behaviours separated by ` · `. |

**The script creates these** on first use: `Reviews`, `Review Goals`,
`Review Competencies`, `Development`, `Training Plan`. The training plan can
also be pasted in (a TSV was provided as the example) — one row per activity,
`StaffId` as on the Access tab.

Roles come from the Access tab as before. Note that "Sales Support Assistant"
is now read as a support desk (`ssa`); it used to fall through to the BMA.

The People Leader is whoever the person reports to in `REPORTS_TO`, plus the
Branch Manager for everyone. Each side writes only its own half of a review.

## Closing a task from the tracker

`KPI-Write.gs` closes a task as well as writing the reason and the due
date: `updateTask` with `field: close` sets `Status = Completed` and
appends the person's line, stamped and signed, to the task's Description.
Fewer than four words is refused; a closed task cannot be closed again;
own task or the Branch Manager only; every attempt is audited on the
`KPI Salesforce Writes` tab. The cached position — counts, reasons,
billing and the open book — is dropped so the next read is honest.

## The order of service, and the mail sweep

Every list is served in one order, whatever the KPI: Branch Manager,
Assistant Branch Manager, Unit Managers, Executive Agents, then agents.
Salesforce cannot say who is who — its contact titles are free text — so
the rank comes from the branch: the `Access` tab's roles for the managers,
and a `Ranks` tab (`Name · Rank`) for the Executive Agents and anyone the
roster does not cover. Names are matched to the task's Agent, case
insensitive; a name the tab lacks is an agent.

The morning and afternoon mail sweeps land on the day's row as `MailAM`
and `MailPM` — `08:25|bm:done,abm:none,um:done,ea:done,ag:done` — written
by the `saveMail` action. They feed Responsiveness and Courtesy in the
quarter and the 3pm checkpoint.

## Your quarter and moments

`standing` reads the quarter so far for one person — every goal on the
`Goals` tab for their role with what the record says under it (blocks,
landed, closed in Salesforce, open, untouched), and every competency on the
`Competencies` tab with signals read by its name (reliability from the
`Attendance` tab and the blocks; responsiveness from untouched, late and
no-reason; quality from landed and billing flags; customer service from
value-added lines and servicing closed; growth from `KPI Training` and the
development actions; innovation from the innovation lines). A competency
whose name matches nothing carries moments only.

`Moments` is a tab the script creates on first use: `MomentId · StaffId ·
Date · Competency · What · By · UpdatedAt`. A person or their People Leader
notes a line against a competency on the day; reviews show the moments that
fall in their period.

## What a person was written to about

A "moment" used to be one line against a competency. On 8 September the branch
asked the sharper question: somebody had been reminded four times that morning
about the same spreadsheet, and nothing in the record could say so.

A moment now carries three more things:

| | |
|---|---|
| **Was it** | *Asked or reminded* · *Where I fell short* · *Thanked or commended* · *Noted for the record* |
| **Who from** | Branch Manager · Unit Manager · Head office · A client · A colleague · Myself |
| **About** | a few words naming the subject — required on an ask, optional on the rest |

**Where I fell short** is the one the branch asked for by name. It is not the
same as being asked: an ask comes from outside, a shortfall is owned before
anybody has had to write about it, and in a review those are not the same
sentence. It is counted the same way — the second time the same thing is
missed is the finding — and it reads against the same competency and the same
job document.

**The subject is the part that matters**, because it is what makes a repeat
countable. Nobody ever writes "this is the fourth reminder"; they write "the
spreadsheet" four times, and the tracker counts. Use the same few words each
time and the quarter card reads *"Morning spreadsheet — asked 4 times · by the
Branch Manager · last on 8 Sep"*. The matching ignores case, spacing and
punctuation, so "morning spreadsheet." and "Morning  Spreadsheet" are one thing.

The question is put at the end of every day, on the close-the-day card —
*"Anything you were written to about, or fell short on, today?"* — because that
is the last screen of the day and the answer is still in the person's head. It
is not a gate: a quiet day closes with nothing written.

## The branch works around the clock

Nothing in the tracker keeps office hours any more.

- **The script is kept warm every ten minutes, at every hour, on every day.**
  It used to stand down overnight and at weekends, which meant the container
  was cold at exactly the times somebody working late or on a Saturday came to
  sign in — half a minute of "Signing in" for the person least able to ask
  anybody about it.
- **The checkpoint and the two nudges no longer ask what day it is.** They ask
  the day's own record: nobody signed in and nothing filed means there is
  nothing to send, on any day of the week; one person at a desk means there is,
  on any day of the week. A Saturday the branch worked gets its checkpoint. If
  the record cannot be read the mail goes out anyway — a checkpoint nobody
  needed is a smaller failure than a day that went unreported.

One thing still assumes a five-day week and is left that way deliberately: the
quarter's **"days in, days left"** counts Mondays to Fridays, and the mail-sweep
ratios on the competencies are measured against that. Counting weekends there
would quietly raise everybody's denominator and make the same work look worse.
Say the word and it changes.

All of it lands on the **Moments** tab and feeds the competency it names, so
the quarterly is a read-off rather than a memory test. The three columns are
added to whatever is already on that tab, and every write goes through the
header rather than a fixed position, so nothing already recorded moves and a
tab somebody has reordered by hand still lands correctly. Moments written
before this change read as *Noted for the record*, which is what they were.

---

## Attendance

Signing in opens the day and signing out closes it. Those two times are the
hours the register shows. The script creates an `Attendance` tab on first
sign-in: `Date · StaffId · Name · FirstSignIn · LastSeen · SignedOut ·
Status · Reason · MarkedBy · UpdatedAt`. The first sign-in of the day is the
start time; later ones refresh `LastSeen`. "Not in today" writes `Status =
absent` with the reason, by the person or their People Leader. Start time is
compared with the first token of the person's `hours` in `SCHEDULE`, with a
ten-minute grace. The JotForm register can be retired once this is live.

### Signing out

**Close the day** sits at the foot of a person's own day, under their job
document, and names what is still unreported before it asks — blocks not
submitted, an afternoon sweep not marked. It writes `SignedOut`, then signs
the device out; the sign-in screen says the day was closed and at what time.
The **Sign out** button in the header records the same thing, but always lets
a person leave even if the sheet does not answer.

Only your own: a manager may mark somebody absent, because that is a fact they
can know, but nobody else can say when you finished. Signing back in leaves the
morning untouched, and closing again simply moves the time later, which is what
somebody who stepped out and came back would want it to say. Somebody who
closes a day they never opened gets one row with both times the same, rather
than a day that was closed but never started.

A register created before September 2026 has no `SignedOut` column. It is added
on the end the first time the tab is read, so the columns already there keep
their places.

## Two o'clock — the branch's own message

A daily trigger at 14:00 writes the message for the WhatsApp group from the
day's own record and e-mails it to you ready to send, with a green button that
opens WhatsApp with the text already typed. Pick the group, press send.

**The last tap has to be yours, and that is not a shortcut.** Nothing can post
into a WhatsApp group. Meta's WhatsApp Business API sends to individual
numbers and has never supported groups, and neither does any reseller built on
it. The libraries that *do* post to groups drive a logged-in copy of WhatsApp
Web from a server — against WhatsApp's terms, and the number that gets banned
for it is the branch's. Two taps is the honest version.

**What it says.** The house rules for a group message are at the top of
`CLAUDE.md`, and the message follows them: under 120 words, a bold one-line
headline, the number nobody in the room already knows in the first line,
**one** finding, and an ask that can be answered in a line.

It names **who is in front**, never who is behind. A daily naming of who is
last in a group chat is read once. Where a shortfall is the finding it is
always a count — *"one of us is short of three blocks"*, never a name.

The finding is whichever of these is first and true:

1. tasks overdue across the branch
2. desks that have logged nothing at all yet
3. tasks untouched for sixty days
4. desks short of three blocks with two hours left
5. nothing wrong — which is said out loud rather than skipped

Each one carries its own ask, so the last line always follows from the one
before it.

```javascript
branchPulse()        // read today's message without sending anything
sendBranchPulse()    // build it and mail it over, as the 14:00 trigger does
```

Two o'clock and not three: the 3pm checkpoint is the manager's read of the
day. This is the branch's, and it lands with two working hours left in it —
which is the difference between a prompt and a report. A day nobody opened
gets no message.

## Before you leave — the close-out

The register said a person was here. It never said what they left behind them.
The close-out is the other half: a short list, the same one every evening, of
what has to be true before somebody goes home.

**It never asks what the sheet can already see.** Blocks reported, the
afternoon mail sweep, anything written to you today — all three tick
themselves and show the evidence they read (`4 of 4 reported`, `swept at
14:10`). Only what cannot be seen is put as a question. A checklist that makes
a person re-assert what the system already knows is one they learn to tick
without reading.

**The list is yours, not the script's.** It lives on a `Closeout Items` tab,
created with four seeded lines the first time anything asks for it:

| Column | What it holds |
|---|---|
| `ItemId` | A short key. Anything unique; `closeoutAdd` makes one from the wording. |
| `Item` | What the person reads. |
| `Who` | `All`, a role (`bm`, `um`, `bma`, `abm`, `ssa`, `pa`), a name, or a staff id. A comma-separated list works. |
| `Auto` | Blank for a question. `blocks`, `mail` or `written` for a line that checks itself. |
| `Order` | Where it sits in the list. |
| `Active` | `No` takes it off tonight's list without deleting it. |
| `Note` | For whoever edits the tab. Nobody on the floor sees it. |

The fourth seeded line — *Branch portfolio uploaded* — ships with `Active =
No` on purpose. It is the shape of a branch rule rather than a branch rule.
Switch it on, narrow `Who` to the desk it belongs to, or write your own.

From the editor, one line does it:

```javascript
closeoutAdd('Upload the branch portfolio', 'azariah')   // or a role, or All
closeoutList()                                          // what is on the list, and for whom
closeoutDay()                                           // what the branch left behind today
```

**It is asked in two places, and one tick answers both.** On the screen, under
**Close the day**, while the person is signing out. And by e-mail at a quarter
to four — because the people who most need the question are the ones who have
not opened the tracker since lunch. Every open line in that mail is a link;
tapping it records the line at the minute it was tapped and shows what is
left, from the phone, with nobody signed in. The link is signed, and it is
good for one person on one day.

Nobody who did not sign in is written to. A day that was never opened is
absent, and an absent day has nothing to close. Nobody already clear is
written to either.

It is **not a gate**. A person may sign out with things open and the register
says so. What they can no longer do is leave without being asked.

Answers land on a `Closeout Log` tab: `Date · StaffId · Name · ItemId · Item ·
Status · Reason · At · Source`, one row per line per day, rewritten in place.
`Source` says whether it came from the screen or the mail. Where somebody
ticked an automatic line the sheet disagrees with, the list reads *said done
at 15:47* rather than the count that contradicts them — their word, marked as
their word.

## What changed

**Submit now tells you the truth.** It used to post with `mode: "no-cors"`,
which returns a reply the page is not allowed to read — so it said "Saved ✓"
without ever having been told whether the save landed. Now it waits for the
sheet's answer and shows it, including the reason when a save fails.

**Save draft is gone.** One button. Submitting again on the same day updates
that day rather than adding a second row.

**One row per person per day.** See §2.

**Training is kept.** The form has always asked who was trained, on what,
against which objectives, and whether they were tested. There was nowhere in the
sheet to put any of it, so all of it was dropped on save. It now goes to the
`KPI Training` tab, one line per session.

**Staff sign in**, and only see their own days. The password check happens in
the script; the Access tab is never sent to a browser.

**Three reports** where there was one:

- **3pm Checkpoint** — the day at the cut. Blocks 1–3 are behind them by 3pm and
  the last runs to 4, so anyone under three blocks is flagged while the day can
  still be rescued. Names who has logged nothing, who is behind, and every
  blocker raised.
- **Weekly summary** — Monday to Friday against the week before: closed,
  overdue, aged 60+, value added, ideas, training delivered, blockers. Each
  person's week as five squares. Where the hours actually went, by KPI. Then
  every value-add, idea, blocker and system flag in the person's own words.
- **Day review** — the original end-of-day view, kept.

Both manager reports have a **Print** button that drops the controls and prints
the page as it stands.

---

## If something looks wrong

**"Session expired. Sign in again."** — tokens last 12 hours, so this is
expected each morning: the page goes back to the sign-in screen and says so.
Before 7 September the page could show it *under a button* while the day was
still on screen — every call added since the reviews (the mail sweep, the
quarter, the register, the job document, closing a task) was sent without the
token, so a person who had just signed in was told they had not. The token is
attached to every call now. Anyone still seeing it that way is on a page
loaded before the fix: reload.

**A report dated "Thursday 1 January 1970", with every desk marked "No
entry"** — the checkpoint or the weekly summary ran with a trigger's event
object where a date belongs, matched no rows, and formatted the unparseable
value as the epoch. Fixed in `2026-09-07a`; if you see it again, the workbook
is running an older script, so redeploy.

**"Unreadable reply from the sheet."** — the deployment is not set to
**Anyone**, or the last change was never published as a new version. See §3.

**Somebody's day is missing from a report** — check the **Date** column on their
row. The script reads `2026-08-24` text and real date cells equally, but a date
typed in another format lands on its own day.

**The 3pm email never came** — check the time zone (§1), then **Executions** in
the editor. A trigger that threw is listed there with the reason.

**The counts look too high** — `dedupeLog` has not been run yet (§2). The app's
own screens collapse duplicates as they read, so the app and an untouched sheet
will disagree until you run it.


## One hosting fact that bites

This site is **GitHub Pages**. The `netlify.toml` in the repository is inert —
Pages ignores its redirects *and its headers*, which means the `/kpi/*`
security headers declared there are not applied in production. The short links
(`/wall`, `/training`) are real folders containing redirect stubs, because that
is the only kind of redirect Pages honours. `/manual` is the branch's own
manual, a separate page; the KPI manual lives at `/kpi/manual/` and is linked
from the training page and the app.
