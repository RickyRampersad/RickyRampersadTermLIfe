# The group project

Group client management, the group bills and the GI renewal desk, moved out of the Service Questionnaire project
into a project of their own (26 November 2026).

**Why:** the Service Questionnaire project loads about 2.4 MB of code on every call. The orphan campaign alone is
over 1 MB, and the group side was about 1 MB more. So a bare ping took 6 to 8 seconds, and the group side waited
behind the orphan batches for the project's single script lock. A smaller project answers faster, and the two stop
blocking each other.

## What goes where

| New group project | Service Questionnaire project (stays) |
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
- Run `groupMoveExport`. It writes the settings, the branch code and the group's timed jobs into a small new sheet
  in your Drive, "Group move: settings for the new project", and its message names the time zone. Not into the
  Service Questionnaire workbook: that one is so large that adding a tab to it failed on 26 November with Google's
  "An unknown error has occurred". Each step is tried three times, and a step that still fails says which it was.
- Run `groupMoveStopOld`. The group's timed jobs stop here; the orphan side's keep running.

**2. Who owns the new project**
- Make it under the same Google account that owns the sheets. Then nothing needs sharing.
- support@rickyrampersadbranch.com has no Google account behind it (Drive refused to share with it on 26 November
  2026), so it cannot own the project.
- A different account (a Workspace one later) needs the Service Questionnaire sheet, the Group Client Management
  sheet, the two training sheets and the "Group Client Management forms" folder shared with it as an editor.
  `groupMoveImport` names anything it cannot open, and `groupMoveCheck` asks again after sharing.

**3. In the new project** (script.google.com → New project, named "Group Client Management")
- Make five files and paste each in: `GroupClients.gs`, `GroupBilling.gs`, `GIRenewals.gs`, then `GroupShared.gs`
  and `GroupApp.gs` from this folder. File order does not matter.
- The clock: Project Settings → tick "Show appsscript.json manifest file in editor" → open `appsscript.json` →
  set `"timeZone"` to the zone `groupMoveExport` named, exactly as written (`America/Puerto_Rico` on the branch's project: the same clock as Port of Spain, but the import compares the name) → Save. A new project
  takes the time zone of the account that made it, and every timed job runs by it. `groupMoveImport` refuses, and
  changes nothing, until the two match.
- Run `groupMoveImport`, and approve the permissions it asks for the first time. It finds the settings sheet in your
  Drive by itself and sets `SQ_SHEET_ID` from it (only if it says it cannot, add the Script property `MOVE_SHEET_ID`
  with the ID the export named). It carries every setting across, the secrets included:
  - the Microsoft, Salesforce and Claude keys;
  - the branch code, as `TEAM_CODE`.

  It then rebuilds the hourly refresh, the Monday 10:00 letters and the 10:30 group day, checks that every sheet
  and folder opens, and empties and bins the settings sheet.
- Deploy → New deployment → Web app. Execute as: Me. Who has access: Anyone. Copy the `/exec` address.
- Open `<the /exec>?action=ping` in a browser:
  - `sheets` should say `ok` twice;
  - `settings` should be all `true`;
  - `jobs` should list `gcmRefreshTick`, `gcmMondaySend` and `gcmDay1030`;
  - `timeZone` should be the zone the export named (`America/Puerto_Rico`).

**4. The site**
- Run `python3 tools/move/repoint-group.py <the /exec>` and commit. It changes the 10 group pages and only
  those. It refuses any page that also talks to the orphan side.
- Merge. Then check that `<the site>/groupclientmanagement/` signs in. `gcm.ping` on the new address answers
  `project: "group"`.

**5. Back in the old project**, only once step 4 works
- Add `GroupKeep.gs` from `apps-script/` FIRST, and save. Its pieces are `var`s and functions copied word for word, so
  the minute it sits beside the group files is harmless, and the orphan side's five-minute runs never find
  `gcmClaude_` missing.
- Then delete `GroupClients.gs`, `GroupBilling.gs`, `GIRenewals.gs` and `GroupMoveOut.gs`.
- Deploy → Manage deployments → pencil → New version. Never New deployment: that issues a new `/exec`, and every
  orphan page, the walls and the forms would lose the backend.
- Its ping now answers faster. Group actions sent to it answer `Unknown action`.

If the move stops half way, run `groupMoveCleanUp` in the old project. It empties and bins the settings sheet, and the
secrets on it.
To undo step 1, run `gcmSetup` there again, and `gcmGroupDayStart` too if the 10:30 group day was on.

## After the move

- **The branch code** is the `TEAM_CODE` Script property in the group project, not a line in the code. A paste can
  no longer blank it there.
- **A change to a borrowed function** (in `Transition.gs`, `Service.gs` or `ServiceSalesforce.gs`) reaches the group
  project only once you run `node tools/gas/split-group.js` and paste `GroupShared.gs` again.
- **Mail** goes from support@ through Microsoft Graph, as before. If Graph refuses, the fallback sends from the
  account that owns the project, as it does today.
- **The two projects share the sheets**, not the code. Each has its own cache and its own lock, so a long orphan
  batch no longer holds up a staff member's group page.
