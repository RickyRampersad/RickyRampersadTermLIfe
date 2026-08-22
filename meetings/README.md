# Branch Meeting Builder

The whole meeting in one place: the agenda, what each person is presenting,
who was in the room, the action tracker and the minutes.

**Signing in *is* the attendance register.** There is no separate register to
fill in and no sheet to reconcile afterwards. You open the meeting, press
*I'm here*, and that writes your row — time-stamped, once, in the branch
record.

---

## Why this exists

Three things were living in three different places:

| Was | Now |
| --- | --- |
| Attendance on a JotForm, reconciled against the minutes by hand | The login is the register |
| Presenters' reports arriving by WhatsApp and email the morning of | Uploaded against the agenda slot, with a due date and a staff check |
| Minutes as Word files scattered across two Drive folders and two Google accounts | Written in the app, against the meeting, published from there |

The Q1 review minutes of 15 April record something the old register could not:
people with **no entry at all** — neither present, absent, excused nor late.
That is not the same as being absent, and the app reports it as its own group,
because the branch treats it as a factual observation of the record.

---

## Who sees what

Roles are assigned by the branch on the **People** tab. Nobody picks their own
role when they enrol, so an agent cannot make themselves staff and open the
persistency report.

| | Agent | Staff | Branch Manager |
| --- | :-: | :-: | :-: |
| Sign in, be counted present | ● | ● | ● |
| Agenda items marked **Everyone** | ● | ● | ● |
| Material marked **Everyone** | ● | ● | ● |
| Published minutes (Everyone sections) | ● | ● | ● |
| Action items naming them, or *All Agents* | ● | ● | ● |
| Items marked **Staff only** — persistency red zones, licensing, clawback, unit performance | | ● | ● |
| The register: who was present, late, excused, absent, no entry | | ● | ● |
| Build meetings, write and publish minutes | | ● | ● |
| Items marked **Chair only** — the branch manager's talking points | | | ● |
| Add people and set roles | | | ● |

Every one of those checks runs **on the server**. Material an agent may not see
is never sent to their browser, so there is nothing to find by poking at the
page. Files sit in a private Drive folder and are handed back only after the
same check passes.

The three tiers come from the branch's own documents: the W18 agenda carries
both a *"CONFIDENTIAL — BM EYES ONLY"* footer and a *"Branch Manager's Talking
Points — not for distribution"* section, which staff should not see either.

---

## Setting it up — about ten minutes, once

1. **Make a Google Sheet** called `Branch Meetings`, then
   **Extensions → Apps Script**.
2. **Paste in** `apps-script/Meetings.gs` from this repository and save.
3. **Set three values** at the top of the file:
   - `ADMIN_EMAIL` — your work email. You are seeded as manager.
   - `JOIN_CODE` — what people type once, the first time they set a PIN.
     Change it after everyone has enrolled.
   - `LATE_AFTER_MINUTES` — how late is late. Default 10.
4. **Run `setupMeetings()`** once and grant the permissions it asks for. It
   builds every tab and creates the private Drive folder for materials.
5. **Deploy → New deployment → Web app.** Execute as **Me**, access
   **Anyone**. Copy the `/exec` URL.
6. **Paste that URL** into `CONFIG.API_URL` at the top of
   `meetings/index.html`, and commit.
7. **Add your people** — the *People* screen in the app, or the *People* tab
   in the Sheet. Email, name, role, unit. Everyone then sets their own PIN
   using the branch code.

Until step 6 is done the page shows these instructions rather than pretending
to work.

### Bringing in the past meetings

From the Sheet: **Branch Meetings → Import the meeting archive**, and paste
the Drive folder id — or several, separated by commas.

The same minutes exist in more than one folder, under more than one Google
account, sometimes with a `(1)` on the end. The import matches on the tidied
title *and* the date, not just the file link, so a meeting that appears three
times is registered once. Running it again never duplicates anything.

Documents from the same date with genuinely different names — an agenda, the
minutes, and a deep-dive of the same meeting — come in as separate entries,
which is usually what you want. Merge them by hand if you would rather not.

---

## Running a meeting

**Before.** Build it — type, date, start time, chair, location. *Use the
standing agenda* loads the order the branch runs every week (opening and
mission statement, register check, review of minutes and actions, admin
reminders, the reports, innovation, closing) so you are filling in rather than
typing out. Assign a presenter to each item, set how many minutes they get, and
mark who may see it. Tick *the presenter must upload material beforehand* on
the items that need a report in hand.

The running order carries a real clock time against every item, worked out from
the start time and the minutes allotted — the way the branch's own agendas do.
Hiding a staff-only item from an agent does not shift anyone else's times.

While it is on **Draft** only staff can see it. Move it to **Scheduled** and it
appears for the whole branch.

**Presenters** open *My Prep*, see their slots, and attach what they are
presenting — a file up to 12 MB, or a link for anything larger. Staff see
everyone's slots and who is still outstanding, and can mark a report *checked*
before the meeting: the branch's own rule that reports are reviewed beforehand,
with no corrections in the live meeting.

**On the day.** Check-in opens 30 minutes before the start and closes 90
minutes after it. Sign in and you are on the register — after the grace period
you are recorded as late, with the number of minutes. Cannot attend? Log it
beforehand and the reason goes on the record beside your name. Walk in after
logging excused, and signing in corrects the row rather than adding a second
one.

**After.** *Start from the record* opens a draft of the minutes with the parts
the system already knows filled in: present, late and by how long, excused with
reasons, absent, no entry at all, and every action item on the tracker. Each
section keeps the visibility of the agenda item it came from, so a staff-only
report cannot become an all-hands minute by accident. Publishing releases the
**Everyone** sections to the branch; staff-only and chair-only sections stay
where they are.

**Action items** carry forward with one press, keeping the meeting they were
first raised in — so an item raised on 18 March still says so five weeks later
when it is being called overdue.

---

## Where the data lives

| | Where |
| --- | --- |
| People, meetings, agendas, attendance, actions, minutes | Tabs in the private `Branch Meetings` Google Sheet |
| Uploaded material | A private Drive folder, one sub-folder per meeting |
| Audit trail — every sign-in, correction, upload and publish | The `Log` tab |
| This app | `meetings/index.html` in this repository |

**Nothing but the program is in this repository.** No names, no attendance, no
reports, no minutes. The repo is public; the Sheet and the Drive folder are
private to the account that owns the script. Signing in from the page reaches
the Sheet at runtime and nothing is stored here.

PINs are never stored. Each is salted and SHA-256 hashed, five wrong tries
holds the account shut for fifteen minutes, and a forgotten PIN is cleared by
the branch manager rather than recovered.

---

## Day to day

- **Somebody forgot to log in but was there.** *Register → Correct the
  register.* The correction records who made it, so the register stays
  auditable — the "was here earlier, forgot to log" case from the Q1 minutes.
- **Somebody has left the branch.** *People →* untick **Active**. They keep
  their history but drop out of the roll the register is measured against.
- **Somebody forgot their PIN.** *People → Clear their PIN.* They set a new one
  with the branch code.
- **Attendance for a one-on-one.** *Register* with no meeting selected shows
  every active person across every meeting — present, late, excused, absent,
  no entry, and a rate.
- **A printed copy.** Every screen prints clean to PDF — the register, the
  minutes, the action tracker.
