# Property Renewal Module — setup

Adds a full property renewal journey alongside the motor one: an invitation
email showing the schedule of values, a client portal that teaches **excess**
and **average** before asking for an instruction, routing to the **CRMS
renewals team**, a thank-you, and a **progress tracker** with automatic
follow-ups until the schedule is delivered.

## 1. Add the two files in Apps Script

| File | How |
|---|---|
| `Property.gs` | **＋ → Script**, name it `Property`, paste `apps-script/Property.gs` |
| `PropertyPortal.html` | **＋ → HTML**, name it `PropertyPortal`, paste `apps-script/PropertyPortal.html` |

`Property.gs` reuses helpers from `Code.gs` (`esc_`, `fmtMoney_`, `sendMail_`,
`brandWrap_`, `createTask_`, `logActivity_`…), so keep both files in the same
project.

## 2. Two small edits in `Code.gs`

**a) Route the property links.** In `doGet`, add the `p` branch:

```js
function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.staff) return staffPage_(p);
  if (p.p) return propertyPage_(p);      // <-- add this line
  return clientPage_(p);
}
```

**b) Add the property menu.** At the end of `onOpen`, add:

```js
  propertyMenu_(SpreadsheetApp.getUi()).addToUi();
```

Optionally, add property follow-ups to the daily run — at the end of
`dailyAutomation()`:

```js
  try { dailyPropertyFollowUps(); } catch (err) { Logger.log(err); }
```

## 3. Create the `Property Renewals` tab

Run **🏠 Property Renewals → Fill property portal links** once and the tab is
created with these columns (fill them from your property book):

`Renewal Date · Days Left · Client · Contact · Email · Mobile · Risk Location ·
Occupancy · Policy # · Carrier · Building Cover · Stock · General Contents ·
Plant, Equipment & Machinery · Electronic Equipment · Total Value · Premium ·
Excess · Token · Portal Link · Renewal Status · Stage · Stage Updated ·
Last Client Update · Last Staff Nudge · Reminders Sent · Assigned To`

The value columns mirror the branch's renewal email exactly, so the portal and
the emails present figures the way your clients already recognise.

## 4. Redeploy

**Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy.**
The `/exec` URL stays the same; client links keep working.

---

## How it runs

```
🏠 Property Renewals → Send renewal invite (selected rows)
        │   email shows the value table + current premium
        ▼
Client opens ?p=TOKEN
        │   • adjusts any value line on the fly
        │   • average-clause calculator runs on their own figures
        │   • excess and cover explained in plain language
        ▼
Client submits
        ├── instruction email → CRMS renewals team (CC branch team)
        ├── thank-you email → client
        ├── progress record opens at "Instruction received"
        └── task created for the assigned staff member
        ▼
Staff advance the stage as it moves
        advancePropertyStage(token, 'crms'|'terms'|'accepted'|'issued', note, by)
        each stage emails the client an update
        ▼
Automatic follow-ups until "Schedule issued"
        • staff nudge every 3 days (task)
        • client progress note every 5 days
```

The client returns to the same link at any time to see exactly where their
renewal stands — that progress screen is what stops the "any update?" calls.

## Advancing stages

Until a dashboard button exists, advance a file from the Apps Script editor:

```js
advancePropertyStage('TOKEN', 'crms', 'Sent to Guardian for terms', 'you@myguardiangroup.com');
```

Stages: `instructed` → `crms` → `terms` → `accepted` → `issued`.

## Test mode

`Property.gs` sends through `sendMail_`, so the existing **🧪 test mode**
switch covers property emails too — everything reroutes to your inbox with a
`[TEST]` subject while it's on.

## Before going live

- [ ] Confirm `PROP.CRMS_TO` is the correct CRMS renewals address
- [ ] Fill the `Excess` column — the portal teaches excess, so show the real figure
- [ ] Sanity-check `Building Cover` values against today's rebuilding costs
