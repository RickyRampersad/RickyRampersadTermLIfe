# Branch Meeting Builder

Lives at **rickyrampersadbranch.com/managementmeetings**

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

## Enforce HTTPS — do this once, for the whole site

**Repository → Settings → Pages → tick "Enforce HTTPS".**

Without it GitHub Pages answers on plain `http` as well as `https` and never
redirects between them. Safari on iOS tries `http` first for a typed address,
lands on the insecure copy and warns that the connection is not secure — which
is exactly what it should do, because on that copy a PIN travels in the clear.

It is not this app's problem alone. Every page is affected, and `/claims/`
and `/service/` matter more: they take ID documents, bank particulars and
client signatures. One checkbox fixes all of them.

This page carries its own guard — it sends the browser to `https` before
drawing anything, so a PIN is never typed into an `http` page. That is belt
and braces, not the fix. Tick the box.

## Seeing it work before it matters

Signing in to an empty app shows nothing, and nothing is hard to judge. From
the sheet: **Branch Meetings → Create a sample meeting.**

It builds one finished meeting — a running order with real clock times, a
register with all five groups (including the no-entry group, which is the
point), eight contributions on the floor, an action tracker with one item
deliberately overdue, and published minutes. It uses the real People tab,
because a register full of invented names tells you nothing about how yours
will look.

The meeting is titled **SAMPLE**, its purpose says plainly that it did not
happen and the attendance is invented, and **Remove the sample meeting**
takes every row of it back out.

## Getting in

Two doors, and they do different jobs.

**The branch access code** is the same one the Staff and Agent portals use —
`STAFF2026` or `AGENT2026`. It is the front door, exactly as on the rest of
the site, and it says you belong to the branch.

**Your own email and PIN** is the second, and it cannot be dropped. A shared
code cannot tell you who walked in, and the whole point of this app is that
signing in *is* the attendance register. The code gets you to the door; the
PIN is what puts your name on the record.

You set your PIN once, the first time, against an email the branch has already
put on the People tab. Change the access codes in `managementmeetings/index.html`
(`DOOR_CODES`) if you ever change them on the portals.

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
   builds every tab, creates the private Drive folder and seeds the topics.
   It takes about forty seconds and writes its summary to the execution log.

   > It shows no dialog, on purpose. A dialog from the script editor draws in
   > the *sheet's* window, so it would sit waiting for a click nobody is
   > looking at until the six-minute limit killed it — a timeout that looks
   > like a failure long after the work has finished. The same job from the
   > sheet's own **Branch Meetings** menu does show a dialog, because whoever
   > clicked the menu is looking at the sheet.
5. **Deploy → New deployment → Web app.** Execute as **Me**, access
   **Anyone**. Copy the `/exec` URL.
6. **Paste that URL** into `CONFIG.API_URL` at the top of
   `managementmeetings/index.html`, and commit.
7. **Add your people** — the *People* screen in the app, or the *People* tab
   in the Sheet. Email, name, role, unit. Everyone then sets their own PIN
   using the branch code.

Until step 6 is done the page shows these instructions rather than pretending
to work.

### Bringing in the past meetings

Two steps, because they do different things.

**1. Import** — from the Sheet: **Branch Meetings → Import the meeting
archive**, and paste the Drive folder id, or several separated by commas.
This registers each document as a past meeting.

The same minutes exist in more than one folder, under more than one Google
account, sometimes with a `(1)` on the end. The import matches on the tidied
title *and* the date, not just the file link, so a meeting that appears three
times is registered once. Only Word documents, Google Docs and PDFs are
considered — a spreadsheet that happens to be in the folder is skipped.
Running it again never duplicates anything.

**2. Index** — **Branch Meetings → Index the archive for searching**. This is
the step that makes search work: it reads the *words* out of each document and
keeps them in the sheet.

Until a document is indexed it is only a link, and a link is no use to anyone
without Drive permission on the file. Once indexed, the branch can search five
months of minutes for "clawback" or a client's name and get the meetings back
inside the app, with the passage quoted, without anybody touching Drive.

Indexing converts each document through Drive — a PDF is OCR'd on the way, so
scanned minutes become searchable too. It is slow enough that it works in
batches of 15 and reports what is left; press it again to continue. It never
runs past Google's six-minute limit and never re-reads a document it has
already done.

Documents from the same date with genuinely different names — an agenda, the
minutes, and a deep-dive of the same meeting — come in as separate entries,
which is usually what you want. Merge them by hand if you would rather not.

---

## Past meetings

The **Past Meetings** tab is the branch's own record, searchable.

**Searching** looks inside the documents, not at their names. Type `clawback`
and you get every meeting that discussed it, ranked by how much it came up,
with the passage quoted and the word marked. Narrow by year or by meeting
type. Open a result and the whole document is there to read, with your search
term still highlighted.

**Browsing** with an empty search box gives you the shelf: every meeting
grouped by year, newest first.

**Adding one** — staff press *Add a past meeting*, pick a Word document, Google
Doc or PDF, and it is read, filed and searchable in one step. The date is taken
from the file name if you do not set one.

**Who can read them.** An indexed document is **staff-only** by default,
deliberately: past minutes name agents against persistency red zones, clawback
and licensing. Staff can open any single document up to the whole branch, or
close it again, from the document itself. Agents only ever see what has been
opened up — a staff-only document does not appear in their list and does not
match their searches, because the filtering happens on the server before
anything is sent.

---

## Running the meeting

**Start it.** The clock starts when you press start, not at the time the
meeting was scheduled for. A running meeting shows the elapsed time against
the total the agenda allowed, and turns red once it is over. The branch's own
agendas say "25 MIN STRICT"; this is that, kept honestly.

Starting also asks you to confirm the room has been told it is being recorded.
Tick it only if it is true — it goes on the session record as the branch's
evidence that notice was given.

**On now.** Press it beside an agenda item and everyone's screen shows what
the room is on, and how long it has been on it.

**Finish it.** The run time goes on the record beside the allotted time, the
meeting closes and check-in ends.

### The floor

Signing in says you were there. The floor says what you brought.

Anyone the register shows as present or late can put a **Point, Question,
Answer, Decision, Concern, Commitment or Apology** on the record while the
meeting runs. Each is stamped with the minute of the meeting and the item it
came under, so the record reads in order afterwards instead of as a pile of
notes. Tag it with a topic and it joins the thread across every other meeting.

Nobody can log a contribution in somebody else's name: the author comes from
who is signed in, not from anything the browser says. You can correct your
own; staff can correct any. A correction is stamped as edited.

Staff also see **who held the floor** — and, more to the point, who was in the
room with nothing on the record.

### Recording

Two things, because they are different jobs.

**The full meeting** is whatever Teams already records and transcribes. Paste
the recording and transcript links onto the session and they sit with the
record instead of somewhere else entirely. An eighty-minute audio file cannot
be assembled inside Apps Script's memory, so the app does not pretend to be
the place it lives.

**Short clips** record in the app — a decision as it was worded, an agent's
contribution, a segment worth keeping. Press record, speak, stop; the clip
attaches to the next thing you put on the record, so the audio and the words
go on together. It stops itself at fifteen minutes. Clips are private in
Drive and served only to people allowed to see them, like every other file.

---

## Who a meeting is for

Visibility hides one agenda item. **Scope** decides whether the meeting exists
at all for a given person, which is a different question.

| Scope | Who it exists for |
| --- | --- |
| **Branch** | Everyone. The weekly branch meeting. |
| **Staff** | Staff and the manager. An agent does not see the meeting, the register, or that it happened. |
| **One-to-one** | The two people in the room, plus the branch manager. A manager reviewing an agent's persistency is not branch business. |
| **Client** | The agent whose client it is, plus the branch manager. Not other agents, and not branch staff. |

A meeting outside your scope returns the same "no longer exists" as one that
was deleted — telling someone a meeting exists but is not for them tells them
it happened.

Only branch meetings count toward an attendance rate. A one-to-one is not
something the rest of the branch failed to attend.

---

## Topics

Clawback, persistency, the 85-day report, fact find compliance and licensing
come back week after week. Spelled differently each time, they stay thirty
separate mentions.

**Topics** is one shared list — seeded with the subjects the branch's own
minutes return to — and a meeting, an agenda item or a contribution is tagged
from it. Open a topic and you get every meeting that touched it, newest first,
with the agenda items and the contributions underneath.

That answers the question minutes cannot: not "what happened on 21 August"
but "what has this branch actually said about clawback since March".

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
| The words of every past meeting, for searching | The `Archive` tab, split across chunk rows past the 50,000-character cell limit |
| Uploaded material | A private Drive folder, one sub-folder per meeting; past meetings under `Past meetings` |
| Audit trail — every sign-in, correction, upload and publish | The `Log` tab |
| This app | `managementmeetings/index.html` in this repository |

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
