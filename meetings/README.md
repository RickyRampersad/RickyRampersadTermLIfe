# Branch Meeting Builder

Lives at **rickyrampersadbranch.com/meetings**

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
| Attendance on a JotForm, reconciled against the minutes by hand | The login is the register; no login is absent |
| Presenters' reports arriving by WhatsApp and email the morning of | Uploaded against the agenda slot, with a due date and a staff check |
| Minutes as Word files scattered across two Drive folders and two Google accounts | Written in the app, against the meeting, published from there |

The Q1 review minutes of 15 April record something the old register could not:
people with **no entry at all** — neither present, absent, excused nor late.
That is not the same as being absent, and the app reports it as its own group,
because the branch treats it as a factual observation of the record.

---

## The branch code

People type it once, when they set a PIN. Set it from the sheet:
**Branch Meetings → 🔑 Set the branch code.** The same menu shows the current
one, so nobody is ever locked out of their own system.

It is kept in Script Properties rather than in the file, for two reasons.
This repository is public, so a value committed here would be public. And the
check runs inside `doPost`, which serves a **pinned snapshot** of the code —
editing the constant and saving changes nothing until a new version is
deployed. A property is read live, so the menu takes effect immediately.

> **Redeploying, when you do need it.** Anything that changes `doGet` or
> `doPost` — the API the browser talks to — needs
> **Deploy → Manage deployments → ✏️ → Version: New version → Deploy**. That
> keeps the same `/exec` URL. *New deployment* issues a different URL and
> disconnects the page. Menu items and sheet-side work take effect on save.

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

**Your agent number and password** is the second, and it cannot be dropped. A
shared code cannot tell you who walked in, and the whole point of this app is
that signing in *is* the attendance register. The branch code gets you to the
door; your own number is what puts your name on the record.

Both come from the **Agent Skill Bank** — the same number and password the
agent and staff portals use. There is no second secret to invent and no PIN to
forget. Fill the roster in one press: *Branch Meetings → Pull the roster from
the Agent Skill Bank*, then paste the link to the sheet that holds that tab.

The pull takes across name, agent number, e-mail, role, unit and active, adds
anybody who is not on the meeting roster yet, and reports who is left without
a password — because that is exactly who cannot sign in, and under the new
rule they would be marked absent for a reason that is not theirs.

**The password is hashed on the way in and never stored here.** The meeting
sheet holds a salted SHA-256 hash and no password, so there is no second
plaintext copy of a credential to keep in step or to leak. Change it on the
skill bank and pull again; that is what changes it here. A blank password cell
leaves whatever the person already had, so an empty cell never locks anybody
out.

Two things the pull will not do. It never demotes the branch manager — the
skill bank calls everybody an agent, and a pull that quietly took away the
access of the one person who can put it back would be unrecoverable. And it
never deletes anybody; taking someone off is done on the People tab.

### Leavers have to be taken off, or the register lies

The pull adds and updates; it never removes. That is deliberate — an automatic
delete driven by a spreadsheet would be the easiest way to lose somebody's
history. But it means **a person who has left stays Active here until somebody
marks them inactive on the People tab**, and under the no-login-is-absent rule
they are recorded absent every single week. That drags the branch attendance
rate down with names that should not be on the roll at all, and those names go
up on the wall.

This is not hypothetical. Salesforce on 9 October 2026 shows **ten agents with
a termination date of 21 September 2026** and one on 10 September, including
both the Gary Sookdeo and Kerwyn Ramroach unit heads. Checked against
`Contact.Employment_Status__c`, the branch's active roll is **28 agents across
two live units** — 20 in the Ricky Rampersad unit, 7 in Akaash Kalladeen's and
1 left in Kerwyn Ramroach's. Gary Sookdeo's unit has none.

So: **mark the leavers inactive on the Agent Skill Bank, then pull again.**
That tab carries an `Active` column, `pullRoster` reads it, and it writes
`Active` onto the People tab for every row it walks. The skill bank is where
the branch already keeps the roll, so it is the right place to do this and it
is a one-press fix from there.

Two gaps a pull will not close, and both need a hand:

- **Somebody taken off the skill bank entirely is never touched.** The pull
  walks the skill bank's rows; a person who is not on it is not visited at all.
  They stay Active on the People tab until somebody sets `Active` to `no`
  there. Removing a leaver from the skill bank is therefore the *wrong* way to
  do it — mark them inactive instead, and leave the row.
- **The skill bank itself has to be true.** On 9 October 2026 it carried 23
  rows against Salesforce's 28 active agents, so the two were already out of
  step in both directions. Reconcile it against `Contact.Employment_Status__c`
  before the first meeting, not just after a departure.

Anyone with no agent number can type their work e-mail in the first box
instead, and anyone who set a PIN here before October 2026 can still use it.
Agent numbers are matched with punctuation and leading zeros ignored, so
`0745444`, `745444` and `745-444` are the same person.

Change the branch access codes in `meetings/index.html` (`DOOR_CODES`) if you
ever change them on the portals.

### One known weakness, recorded on purpose

The passwords on the Agent Skill Bank are short and sequential, and some
repeat between people. Because the sign-in *is* the attendance register, a
person who guesses a colleague's number and password can sign in as them and
mark them present — which is the one thing the register exists to prevent.

The branch decided on 9 October 2026 to launch as it stands and revisit this,
so it is written down here rather than left to be rediscovered. Nothing in the
app depends on it staying that way, and there are two cheap fixes whenever the
branch wants one:

- **Force a change on first sign-in.** The skill-bank password gets them in
  once, then the app makes them set their own. Nothing to re-type on the skill
  bank. The enrol flow that does this already exists.
- **Replace the passwords on the skill bank** with proper ones and pull again.
  No code change at all.

What the app already does: five wrong tries locks the account for fifteen
minutes, every sign-in is logged with a time, and the meeting sheet stores a
salted hash rather than the password itself.

## The template — the standing shape of a Wednesday

`meetings/template.html`, served at **`/meetings/template.html`** and linked
from the app's nav and from the framework page. It is the page to send anybody
who asks what the new meetings look like.

It carries the standing agenda — **eleven slots, 9:00 to 10:30** — with the
minutes and the owner against each, the four-week cycle that fills the one
rotating slot, the arithmetic that holds the chair to 15 of the 90 minutes,
the register rule, and the live unit roster. Sixteen of those ninety minutes
belong to the room rather than to anybody on the agenda: the open floor, and
one client each. The four stages of how a
meeting is run stay on `framework.html`; this page is the shape of the hour
itself, and the two link to each other.

The cadence colours are the same validated four-colour set as the framework
page and carry the same guarantee — every cadence is written in words as well,
so the page reads in greyscale and to a colour-blind reader. On a phone the
agenda table re-lays itself as a stack of cards, because a sideways-scrolling
table hides the *who* and *how often* columns and those are the two an agent
opens the page to read.

Figures on it are dated 9 October 2026. Re-check them against Salesforce before
quoting them in a later quarter.

## The two films

`meetings/walkthrough.html` plays both, and is linked from the app's nav, the
template and the framework page.

| Film | Source page | MP4 | Length |
|---|---|---|---|
| Inside Wednesday | `wednesday-film.html` | `rrb-inside-wednesday.mp4` | 2:39 |
| How a week becomes a meeting | `builder-film.html` | `rrb-meeting-builder.mp4` | 2:12 |
| What you do | `meeting-film.html` | `rrb-meeting-walkthrough.mp4` | 1:33 |

**Inside Wednesday is the one that shows the meeting running.** The builder film
answers *where did this agenda come from*; it names who holds each slot but not
what is in it, which is a different question and was the gap. This one runs the
clock from 8:30 to 10:30 across the top of every scene and shows the screen at
each slot: the three carried-forward actions with two closed and one slipped
twice, the pipeline figures with the oldest application named, an agent saying
he is waiting on an underwriter and that becoming an action before he finishes,
the premium-owed question put to the room and somebody taking it, Neil's case in
his own words, a point raised on the open floor turning into a dated action, the
twenty-one names, the actions read back, and the minutes already written.

The second is the Meeting Builder itself: the two daily checks, the 7am
Salesforce read, what sales support files, and how those become an agenda with
a name against every item. The third is the short one for an agent who only
needs to know how to sign in and what their own slot is for.

**Every figure in the builder film is illustrative and the film says so** — a
gold *Sample figures* badge sits on every data scene. The MP4s are at public
URLs even though the pages are `noindex`, so no real client name or client
count goes in one, and agents appear by first name only rather than with a full
name against a production figure.

### The music in the builder film is not cleared

The bed is built from a track the branch supplied (`Music_Motivation.m4a`,
28 seconds, looped with crossfades). **Its licence is unknown**, so unlike
`tools/film/audio/inspired-kevin-macleod.mp3` it is deliberately NOT committed
here — the repository root is published, and putting unlicensed music on the
web is a different thing from using it in an internal film. Before this film
goes anywhere public, establish what the track is licensed for; if it will not
clear, rebuild the bed from the Kevin MacLeod track with
`python3 usetrack.py audio/inspired-kevin-macleod.mp3` and re-run `mixany.py`.

**`usetrack.py` names the bed after the films.json KEY, not the `music` field** —
key `wednesday` writes `bed-wednesday.wav`, so a config saying `bed-wed.wav`
fails to find it. Name them to match.

A 28-second bed under a 132-second film loops about five times, and about six
under the 159-second one. `usetrack.py`
crossfades each lap at 1.2s, but it is audible; a longer cue would sit better.

All three source pages are recorded rather than served. Build config is the
`meetingwalk`, `builder` and `wednesday` entries in `tools/film/films.json`; the pipeline and
its traps are in the root `CLAUDE.md`.

**A caption reads back whatever was fed to the voice.** The BME line was
narrated as `B M E` so the letters are spelled, which put *"The B M E"* on
screen. The fix is to edit the word in the scene's `.vtt` and re-mix — the VTT
carries the caption text and the timing, never the audio, so the narration is
untouched.

Two things this film taught the pipeline, both worth keeping:

- **Fifteen scenes of centred text on one navy background are invisible to a
  frame differencer.** `mixany.py` recovers the capture's timeline from scene
  transitions and refuses to encode when it cannot match enough of them; the
  first cut matched 4 of 15 and was correctly rejected. The fix is the wipe
  that crosses the frame on every cut — it is in the stylesheet with a note
  saying so. Do not take it out to tidy the film without re-running the mix.
- **The capture is not always stretched.** The pipeline was written against a
  recorder that ran about 1.13× real time, and `mixany.py` only searched slopes
  from 1.05 up. This container captures at very nearly real time: the true fit
  was `video_t = 1.95 + 1.017 × film_t`, matching all 15 transitions with a
  0.03s residual, and it was rejected only for having a slope below the search
  floor. The floor is now 0.97. **The residual check is untouched** — that is
  the guard that actually catches a corrupted recording, and this was not one.

Narrated on `en-US-AndrewNeural` at `-12%`, the house voice and rate for a
walkthrough. Never the Multilingual variant.

**edge-tts needs the proxy CA on a fresh container.** It fails with
`CERTIFICATE_VERIFY_FAILED` because aiohttp reads certifi's bundle and not
`SSL_CERT_FILE`; appending `/root/.ccr/ca-bundle.crt` to `certifi/cacert.pem`
fixes it. The WebSocket itself goes through fine.

## The rota — so the meeting is not one person's

Read the five meetings on record from 22 July to 11 September and one shape
comes out of all of them. "Branch Manager's Presentation" is a standing
section that is the manager's alone, and it carried fourteen distinct topics
across those five sessions. The whole Key Person Insurance workshop on
7 August was his. The opening, the correspondence, the compliance section and
the closing are his every time. Admin carry the operational reports. **Agents
presented twice in five meetings** — Rajiv on 21 August, Felicia on 7 August —
and both were "share your approach" slots rather than items anybody owned.

The seeder used to put that in code: of twelve standing items, six defaulted
to the chair and six were left blank for whoever ended up holding them, which
in practice was the chair again.

**The Rota tab is the fix.** Fifteen standing items, each with an owner, a
backup and a cadence:

| Cadence | Who presents it |
| --- | --- |
| **fixed** | The named owner, every time. Their item, not a favour. |
| **rotate** | The agent who has presented least recently — so it comes round the room instead of landing on whoever volunteers. |
| **chair** | The chair of that meeting. Only the opening and the closing. |

Set it up once: *Branch Meetings → Set up the standing rota*, then put an
Owner Email against each item. Every meeting built after that arrives already
owned. Two items need no owner at all because they rotate by themselves:
**What worked for me this month** and **Training — one point, taught by one of
us**. Those two are the whole point; they are how an agent presents without
being asked.

**Backup matters more than it looks.** On 7 August a report was "presented on
her behalf" because its owner was away and nobody else held it. Naming a
backup is how that stops being a surprise on the morning.

### The load meter

A rota drifts back to one person quietly — an owner is away, an item is added
in a hurry, and a year later it is a broadcast again. So the meeting page
counts it every time it is opened: what share of the minutes is the chair's,
how many people are presenting, and how many items nobody owns. Over about a
third and it says so in words. The point is that the drift is arguable on the
day rather than in next year's minutes.

## The daily note — how Wednesday gets built

The branch meets **Wednesday morning**. On each working morning the app sends
every person one short note that counts down to it and asks for the one thing
only they can bring:

- **Your item on Wednesday** — and whether your material is in. An item marked
  *materials required* is not ready until a file is on it.
- **Your action items** — open, and which are past the date.
- **Your own measures**, from the KPI tab.
- **One ask, every day:** add something to Wednesday's agenda. A question, a
  concern, something that worked.

Turn it on once: *Branch Meetings → Turn on the daily note*. Read it before the
branch does with *Send me today's note*.

**It stays quiet when it has nothing to say.** No notes at weekends, none when
the meeting is more than two working days off, and none to a person who owes
nothing, has no open actions and no measures. A note that arrives every morning
regardless is a note people filter.

### Why it is not a daily production chase

This was decided against the evidence rather than by preference. Chung,
Narayandas and Chang (*Management Science*, 2021) ran daily against monthly
quotas as a field experiment: daily quotas lifted the **bottom quartile by
11.7%**, and pushed **top performers toward low-ticket business so their sales
fell 8.1%** — and firm profit with them. A daily number shouted at a room of
agents makes the weakest a little better and the strongest worse.

So the daily note carries only what a person controls that day, with **no
league table and nobody else's figures in it**. The strategy argument happens
once a week, in the room. That split — operational daily, strategic weekly — is
also the standard practitioner recommendation.

### The KPI tab

One row per person per measure, not a column per KPI. The branch's measures
move — July to September alone the minutes talk about fact finds, persistency,
scripts, contracts, 75-day responses and licensing — and a shape needing a new
column each time is a shape nobody maintains.

| Column | |
| --- | --- |
| **Agent No** or **Email** | Either matches a person |
| **Measure** | "Fact finds this month" |
| **Value**, **Target**, **Unit** | Target may be blank |
| **Direction** | `up` (higher is better) or `down` |
| **As Of**, **Note**, **Active** | `Active = N` hides a row without deleting it |

Fill it from wherever the branch already has the number — a paste, an
IMPORTRANGE, or a Salesforce pull. A person with no rows simply gets no figures
rather than an invented one.

**What Salesforce can and cannot give you**, checked on 9 October 2026 against
the live org:

- **Book and tenure: yes.** `CLIENT_PORTFOLIO__c` holds 55,165 policies with
  `AGENT__c` well populated — book size per agent, and `ISSUE_DATE__c` gives
  the tenure of that book.
- **New business by agent: no.** `Writing_Agent__c` is filled for two agents
  and nine policies since October 2025, against the 496 applications the
  minutes report for January to June. Production has to come from the branch's
  own figures, not from this field.
- **Premium owing: no.** `PREMIUM_OWING__c` aggregates to null across the org.

## The daily time blocks — two notes a day, fifteen seconds each

Separate from the daily note, and answering a different question. The note
tells a person what is owed before Wednesday. The time blocks ask what they
actually did.

**Two sends a day, weekdays only.** 10:00 asks about *3pm yesterday to 10am
today*; 15:00 asks about *10am to 3pm*. Nobody is ever asked to remember more
than five hours back, which is the only window people answer honestly. Menu →
*Turn on the daily time blocks*, and *Send me a time-block check to read* to
see one first.

**Asked of agents and the manager.** Staff keep their own KPI block and are not
asked these questions yet; add `'staff'` to `ACTIVITY.SEND_TO` when that
changes. The staff category set is already written.

### Why the e-mail carries one button and not one link per activity

The obvious design is a grid of links in the message — tap *Prospecting* and it
is logged without opening anything. **It cannot be built that way.** Microsoft
Defender and most corporate mail gateways fetch every link in a message to
check it before the recipient sees it, and this branch is on Microsoft 365. A
link that recorded an activity would be recorded by the scanner, for everybody,
every morning, and the branch's first time-use model would be made of work
nobody did.

So the e-mail holds one link to a page and the clicking happens there, where a
tap is a person. A scanner that follows it marks the row opened and nothing
else. It is still one tap from the inbox to the chips.

Everything on that page is a `GET`, including the save. An HtmlService page is
served from a different origin than `/exec`, so a `POST` from it is a CORS
problem with no good answer; a plain `method="get"` form has none of that and
needs no JavaScript, which is also why it works inside the in-app browser of
every mail client.

### What is asked

Eleven work chips for an agent, ten for the manager — prospecting, calls, seen
a client, fact find, leads, application in, serviced a client, and so on. Then
**five asked of everybody**: family time, personal time, recreation, rest or
unwell, travelling. Then two optional one-line boxes: *what went well* and
*what is in the way*.

The life chips are the half the branch has never had. A model built on work
categories alone says a person who spent the morning at a funeral did nothing.

### The rule that makes the answers worth having

**Personal time is counted for the branch and never shown against a name.**
Anything in a group listed in `ACTIVITY.PRIVATE_GROUPS` is stripped from every
per-person figure unless the person asking *is* that person. The branch total
still includes it, so the work/life split is real; what nobody gets is a list of
who rested on Tuesday.

This is not decoration and it is tested — `activityStats_` is the only way in,
and it filters on the way out. Take the rule away and the honest answers go with
it: people do not log family time twice a day for a system that reports it
upwards. If the branch ever does want per-person personal time, say so out loud
to the branch first; do not do it by deleting a line in a config.

### Reading it back

`activityStats_(days, viewerEmail)` returns the response rate, who has been
silent, the branch's category totals, the work/life split, each person's own top
categories, and the free-text notes. `?action=activity&token=…` serves it: an
agent sees only their own row and no silent list; staff and the manager see the
branch.

**A block closes after `ACTIVITY.OPEN_HOURS` (20).** After that the row stands,
so last week's figures cannot move once the week is counted.

The tab is long and thin — one row per person per block per day, about 280 rows
a week for a branch of 28 — because the categories will change and a column per
activity is a shape nobody maintains.

## Attendance, from 6 October 2026

The JotForm register is disbanded. There is one register and it is this app.

- **Signing in is the register.** Open the meeting, press *I am here*. It is
  time-stamped and there is nothing else to sign.
- **No login is absent.** Anyone on the branch list who does not sign in is
  recorded absent — not "no entry", not a blank. When the meeting closes, the
  app writes those rows itself, marked `no-login`, so the sheet carries the
  whole roll rather than leaving it to be worked out later.
- **If you cannot come, you still log in.** You pick a reason from a list and
  that is your apology. You will **not** get the meeting pack: no agenda, no
  materials, no minutes, no floor. If it changes, sign in and it opens.
- **The reason is picked, never typed.** A typed reason gives "personal" and
  "busy", which cannot be counted. A picked one can be, which is what lets the
  wall show which reason is the one worth doing something about. Only
  *Something else* takes a line of free text. The list lives in
  `APOLOGY_REASONS` in `Meetings.gs` and the app reads it from there, so the
  two can never drift apart.
- **The chair can still correct the register.** A correction records who made
  it, so a person marked absent by hand stays distinguishable from a person who
  never logged in.

The register is on the wall at `intelligence/wall/register.html` — who is in
the room, who apologised and why, and who is absent. It opens with the branch
code, once per device.

## Who sees what

Roles are assigned by the branch on the **People** tab. Nobody picks their own
role when they enrol, so an agent cannot make themselves staff and open the
persistency report.

| | Guest | Agent | Staff | Branch Manager |
| --- | :-: | :-: | :-: | :-: |
| Sign in, be counted present | ● | ● | ● | ● |
| Make a contribution to the meeting | ● | ● | ● | ● |
| Agenda items marked **Everyone** | ● | ● | ● | ● |
| Material marked **Everyone** | ● | ● | ● | ● |
| Published minutes (Everyone sections) | ● | ● | ● | ● |
| Action items naming them, or *All Agents* | | ● | ● | ● |
| Every branch meeting, not just the one they were invited to | | ● | ● | ● |
| Counted on the roll, and marked absent for not signing in | | ● | ● | ● |
| Items marked **Staff only** — persistency red zones, licensing, clawback, unit performance | | | ● | ● |
| The register: who was present, late, who apologised, who is absent | | | ● | ● |
| Build meetings, write and publish minutes | | | ● | ● |
| Items marked **Chair only** — the branch manager's talking points | | | | ● |
| Add people and set roles | | | | ● |

**A guest is invited to one meeting, not to the branch.** They sign in with the
rest of the room and are counted present when they do, but they are not on the
roll, so they are never marked absent for staying away — the 30 July meeting
had the President and two VPs in it, and a roll that counted them would have
dropped the branch's attendance rate for a month. They see the meeting that
names them and nothing else.

**Presenter is a fifth role, and it is not on the People tab.** You hold it for
one meeting because the agenda names you against an item, and you stop holding
it when that meeting closes. Storing it would mean maintaining it, and a stored
list of presenters goes stale the first time an item changes hands.

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
3. **Set two values** at the top of the file:
   - `ADMIN_EMAIL` — your work email. You are seeded as manager.
   - `LATE_AFTER_MINUTES` — how late is late. Default 10.

   The branch code is **not** set here — see below.
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
   `meetings/index.html`, and commit.
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
| **Branch** | Everyone on the roll. The weekly branch meeting. |
| **Unit** | One unit, named in the meeting's **Unit** box, plus staff and the manager. Akaash's unit meeting is not Gary's unit's business and never appears in their list. |
| **Staff** | Staff and the manager. An agent does not see the meeting, the register, or that it happened. |
| **Invited** | Only the people named in **Participants**, plus the chair and the manager. A working group, a panel, anything that is nobody else's. |
| **One-to-one** | The two people in the room, plus the branch manager. A manager reviewing an agent's persistency is not branch business. |
| **Client** | The agent whose client it is, plus the branch manager. Not other agents, and not branch staff. |

A meeting outside your scope returns the same "no longer exists" as one that
was deleted — telling someone a meeting exists but is not for them tells them
it happened.

**The type sets the scope unless you change it.** A Managers Meeting and a
Staff Meeting default to *staff*, a One-on-One to *one-to-one*, a Client
Meeting to *client*, everything else to *branch*. Nobody has to remember a
second dropdown for a meeting to be closed to the people it is not for.

**Scope also decides the roll, and this is the part that matters.** The
register is measured against who was *expected*, not against the whole branch.
Closing a unit meeting of eight against the full roll would write a permanent,
false absence onto the twenty-five people who were never invited — so a unit
meeting marks its unit, a staff meeting marks staff, and an invited meeting
marks the people named. Only a branch meeting is measured against everybody.

A unit meeting with no unit set opens for staff only and marks staff only. It
deliberately does *not* fall back to the whole branch: an empty box should
close a meeting, never throw it open.

Units are matched loosely, because they are typed by hand on two sheets —
"Akaash Kalladeen", "akaash" and "Akaash's unit" are one unit. Participants
may be listed by e-mail or by agent number.

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
