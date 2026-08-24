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

## Before staff can sign in

Three things on the Access tab need your attention.

### You have no account

Every row on the Access tab is a staff member. There is no Branch Manager, so
there is nobody who can open the checkpoint or the weekly summary.

Add a row for yourself. The script treats you as manager if **either**:

- your address is the one in `MANAGER_EMAIL`, **or**
- the **Role** column says `Branch Manager` (or `Manager`, or `Admin`)

Staff see their own day and their own history. The manager sees the branch.

### The passwords are single digits

The five accounts currently use `1`, `2`, `3`, `4`, `5`. Anyone who reaches the
page is four guesses from another person's record, and the Access tab is the
only thing standing between a browser and the branch's data.

Change the **Password** column to something per-person and non-obvious before
the staff start using it. Nothing else has to change — the script reads whatever
is in that column.

The script gives an account five wrong tries and then refuses that name for
fifteen minutes, so the page cannot simply be guessed at. That is a backstop,
not a substitute for real passwords.

### Two people are on the wrong side of the Unit column

The **Unit** column disagrees with what these two have been logging since June:

| Person | Unit says | Their entries say |
|---|---|---|
| Kamla Dookran | SalesSupport | Branch Manager's Assistant · G4 |
| Ashley Rondon | Branch Managers Assistant | Sales Support Assistant · G3 |

Kamla logs *New Agent Activity*, *Escalations* and *Reporting (Production/RDAR)*
— the BMA list. Ashley logs *Pending/Lapse*, *Servicing Lines* and
*Mail Management* — the SSA list. The two look swapped.

The app goes by its own `PROFILES` map (top of `kpi/index.html`), which matches
what they have actually been logging, so the right function list shows either
way. Worth correcting the tab so the two agree.

### Elizabeth Lee

She is on the Access tab and can sign in, and she shows up in Sasha's and
Kamla's training notes. She had no entry in the app, so she is set up as
`Branch Manager's Assistant · G4`, in training, on branch hours. If any of that
is wrong, her line in `PROFILES` is the place to fix it.

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
