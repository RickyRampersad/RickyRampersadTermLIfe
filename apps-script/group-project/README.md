# The group project

Group client management, the group bills and the GI renewal desk, moved out of the Service Questionnaire project
into a project of their own (26 November 2026).

**Why:** the Service Questionnaire project loads about 2.4 MB of code on every call. The orphan campaign alone is
over 1 MB, and the group side was about 1 MB more. So a bare ping took 6 to 8 seconds, and the group side waited
behind the orphan batches for the project's single script lock. A smaller project answers faster, and the two stop
blocking each other.

## What goes where

| New group project (owned by support@) | Service Questionnaire project (stays) |
|---|---|
| `GroupClients.gs`, `GroupBilling.gs`, `GIRenewals.gs` (from `apps-script/`) | `Service.gs`, `Transition.gs`, `ServiceSalesforce.gs`, `StrategicMeeting.gs`, `Quotes.gs`, `Help868.gs`, `Letters.gs` |
| `GroupShared.gs` (this folder, generated) | `GroupKeep.gs` (`apps-script/`, generated) |
| `GroupApp.gs` (this folder) | |

- **`GroupShared.gs`** holds the 60 pieces the group side borrows from the Service Questionnaire files: the
  sign-in, the support@ mailer and the Salesforce login.
- **`GroupKeep.gs`** holds the 11 group pieces the orphan side still uses: the Claude caller, the holiday list and
  the PDF helpers.
- Both are written by `node tools/gas/split-group.js`. **Never edit them by hand.** Change the source file, run the
  tool, and paste again. `tests/test-group-split.js` fails if they are out of date.

## The move, in order

Do it in one sitting, on a day with no letters or bills due: not Monday morning, not the 25th or 26th.

**1. In the old project** (the Service Questionnaire sheet → Extensions → Apps Script)
- Add a file, `GroupMoveOut.gs`, and paste `apps-script/GroupMoveOut.gs` into it. Save.
- Run `groupMoveExport`. It writes the settings, the branch code and the group's timed jobs onto a hidden tab,
  `_move_group`, and its message gives you the sheet's ID. Copy that ID.
- Run `groupMoveStopOld`. The group's timed jobs stop here; the orphan side's keep running.

**2. Share with support@rickyrampersadbranch.com as an editor**
- The Service Questionnaire sheet.
- The Group Client Management sheet.
- The two training sheets.
- The forms folder in Drive (`GCM_FORMS_FOLDER`).

**3. In the new project** (signed in as support@ → script.google.com → New project, named "Group Client Management")
- Make five files and paste each in: `GroupClients.gs`, `GroupBilling.gs`, `GIRenewals.gs`, then `GroupShared.gs`
  and `GroupApp.gs` from this folder. File order does not matter.
- Project Settings → Script properties → Add: `SQ_SHEET_ID` = the ID from step 1.
- Run `groupMoveImport`. It carries every setting across, the secrets included:
  - the Microsoft, Salesforce and Claude keys;
  - the branch code, as `TEAM_CODE`.

  It then rebuilds the hourly refresh, the Monday 10:00 letters and the 10:30 group day, checks that every sheet
  and folder opens, and deletes the `_move_group` tab.
- Approve the permissions it asks for.
- Deploy → New deployment → Web app. Execute as: Me. Who has access: Anyone. Copy the `/exec` address.
- Open `<the /exec>?action=ping` in a browser:
  - `sheets` should say `ok` twice;
  - `settings` should be all `true`;
  - `jobs` should list `gcmRefreshTick`, `gcmMondaySend` and `gcmDay1030`.

**4. The site**
- Run `python3 tools/move/repoint-group.py <the /exec>` and commit. It changes the 10 group pages and only
  those. It refuses any page that also talks to the orphan side.
- Merge. Then check that `<the site>/groupclientmanagement/` signs in. `gcm.ping` on the new address answers
  `project: "group"`.

**5. Back in the old project**
- Delete `GroupClients.gs`, `GroupBilling.gs`, `GIRenewals.gs` and `GroupMoveOut.gs`.
- Add `GroupKeep.gs` from `apps-script/`.
- Deploy → Manage deployments → pencil → New version.
- Its ping now answers faster. Group actions sent to it answer `Unknown action`.

If the move stops half way, run `groupMoveCleanUp` in the old project. It deletes the tab and the secrets on it.
To undo step 1, run `gcmSetup` there again, and `gcmGroupDayStart` too if the 10:30 group day was on.

## After the move

- **The branch code** is the `TEAM_CODE` Script property in the group project, not a line in the code. A paste can
  no longer blank it there.
- **A change to a borrowed function** (in `Transition.gs`, `Service.gs` or `ServiceSalesforce.gs`) reaches the group
  project only once you run `node tools/gas/split-group.js` and paste `GroupShared.gs` again.
- **Mail** goes from support@ through Microsoft Graph, as before. If Graph refuses, the fallback now also sends from
  support@ (Workspace, about 1,500 a day), no longer from the personal Gmail's 100.
- **The two projects share the sheets**, not the code. Each has its own cache and its own lock, so a long orphan
  batch no longer holds up a staff member's group page.
