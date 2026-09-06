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
asked. That sets up:

- **3pm checkpoint**, weekdays — who has logged, who has not, who is behind, and
  every blocker raised so far
- **Weekly summary**, Friday 5pm — the week against the week before

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

**"Session expired. Sign in again."** — tokens last 12 hours. Expected each
morning.

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
