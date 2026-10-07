# Group Client Management — setup

The employers' weekly service report: staff check each group's open Salesforce
items and send the group a letter; the group signs in, reads each item and our
note on it, says whether it is right, and rates us; the branch manager sees
how every group is being serviced; the wall shows it to the branch.

| Page | Who | Signs in with |
|---|---|---|
| `/groupclientmanagement/` | staff (their groups) and the branch manager (every group, the dashboard) | e-mail and password from the Group Staff tab |
| `/groupclientmanagement/client.html` | a group (the "Group Client Portal" tile on the home page) | its list bill and its access code |
| `/groupclientmanagement/wall.html` | the wall screen | the wall code (the Wall row's password) |

The pages hold no client data. Everything comes from `apps-script/GroupClients.gs`,
to someone who has signed in.

**One sheet, one script, nothing shared.** The script lives in the
**Group Client Management** Google Sheet's own Apps Script project, beside the
tabs it reads and writes. It has its own sign-in (the Group Staff tab), its own
copy of the Salesforce and Microsoft 365 properties, and its own web app
address. It touches nothing in the Service Questionnaire project, and must
never be pasted there: it defines `doGet` and `doPost`, and two of each in one
project would take the questionnaire, the assignment board and the walls off
the air.

## Once

1. **Open the script.** In the Group Client Management sheet: Extensions →
   Apps Script. Replace whatever is in `Code.gs` with this repository's
   `apps-script/GroupClients.gs` (or add it as a file of that name and empty
   `Code.gs`). Save.
2. **Script properties** (Project Settings, the gear → Script properties). Copy
   the values from the Service Questionnaire project's own Script properties:
   - `SF_KEY`, `SF_SECRET`, `SF_USER`, `SF_PASS` (and `SF_LOGIN_URL` if it is
     there): Salesforce. Without them nothing can be read.
   - `MS_TENANT`, `MS_CLIENT`, `MS_SECRET`: Microsoft 365, so letters go from
     support@. Without them, Send opens the letter in the staff member's own
     Outlook as plain text instead, and still logs it.
3. **Reload the sheet.** A **Group clients** menu appears. Choose
   **Set up** (authorise when asked). It adds the `Group Tasks`, `Group Sends`,
   `Group Responses`, `Group Shares` and `Group Staff` tabs, puts you (as
   Manager) and the wall on Group Staff with a password each, and installs the
   hourly refresh.
4. **Group clients → Refresh from Salesforce.** It fills Group Tasks, writes
   each group's account owner onto the register, and adds every account owner
   to Group Staff with Salesforce's name and e-mail and a password of their own.
5. **Deploy → New deployment → Web app**: execute as **Me**, who has access
   **Anyone**. Copy the `/exec` address it gives into
   `groupclientmanagement/api.js` (or send it to Claude, who will). That is the
   only time **New deployment** is right: afterwards, every change is Manage
   deployments → pencil → **New version**, which keeps the address.
6. **Hand out the passwords** from Group Staff, each to its own person.
   **Group clients → Who can sign in** lists everyone and why anyone cannot,
   never a password.

## Group Staff

| Column | What it does |
|---|---|
| Name | for staff, the name exactly as Salesforce has it: a staff member sees the groups whose account they own, matched by this name. The refresh writes it, so leave it as it is |
| E-mail | what they sign in with (any capitals). It also gets the note when one of their groups answers |
| Role | **Staff** (their own groups), **Manager** (every group and the dashboard), **Wall** (the wall code: opens the wall and nothing else) |
| Password | at least eight characters, or nothing opens. Set up and the refresh make ten-digit ones; type your own over any of them |
| Active | N (or No, Inactive, Left) shuts a person out without deleting the row |

Ten wrong passwords on one e-mail close it for fifteen minutes.

## The register

| Column | What it does |
|---|---|
| Group | the name the letters and pages use |
| Account Ids | the group's Salesforce account(s): exact, so preferred |
| List bills | how the group signs in, and how its employees' policies are found (any spelling: "TGM 1099" and "TGM1099" are one) |
| Match words | words in task subjects that name the group. One word must stand alone ("ACME" never matches "Acmeline"); several words may run on ("ACME & CO" matches "ACME & COMPANY") |
| Owner in Salesforce, Owner active | written by the refresh, never by hand: the staff member a group is assigned to is its account's owner in Salesforce. To move a group, change the account owner in Salesforce; the next refresh (hourly, or "Refresh from Salesforce") moves it on the board. A group on two accounts takes the first owner still active. An owner who is no longer an active user puts the group at the top of the manager's "To act on" |
| To, Cc, Greeting | who the letter goes to. A group with no To cannot be sent |
| Code | the group's access code. Under ten characters opens nothing |
| Enabled | N stops a group without deleting it |

A group cannot sign in without a list bill and a code, and cannot be sent a
letter without a To.

## What a group sees, and what it never sees

- **Never** an item naming a member's health or a claim (`GCM_PRIVATE`): it
  stays with staff whatever is ticked.
- Items on the group's own account, its billing records, or naming it: shown,
  unless staff untick them.
- Items reached only through an employee (their own policy or contact record):
  hidden, unless staff tick them.
- Chatter comments: only those staff tick to share, and notes staff write for
  the group from the page (posted to the task's Chatter and shared at once).
  Chatter is where staff write to each other.
- Salesforce's logged copies of e-mails and the birthday flow's e-mails are not
  work and are never counted (`GCM_LOGGED`).

## The week

- **Every hour**, 6:00 to 18:00 Monday to Saturday, the refresh rereads
  Salesforce. Staff can refresh by hand from the page.
- **Tuesday is send day** (`GCM.SEND_DAY`). Each staff member opens their
  groups marked "Letter due", checks every item against Salesforce and the
  latest billing, ticks what the group sees, previews the letter (written from
  the group's own numbers, with an optional opening line of their own), ticks
  that they checked, and sends. Every letter is logged on `Group Sends` with
  who, when, to whom, the items and the letter itself, and a blind copy goes to
  sales support.
- **The group answers by Friday** (`GCM.RESPOND_DAY`): correct, needs a change,
  or not ours, with a note, which goes onto that task's Chatter; and a rating.
  The staff member, sales support and the branch manager get an internal
  e-mail at once.
- **The manager's dashboard and the wall** show letters sent against due,
  open and past-target items, completed this year, the share done by its due
  date, average days, answers, ratings and accuracy (the share of items groups
  marked correct) by staff, task type and week, and what to act on.

## Tests

The script is tested in Node on its own, nothing else loaded, on made-up
groups (74 checks: the tabs, Group Staff and the passwords, the refresh, who
sees what, sharing, the letter, sending, answers, the wall, its own web app),
and the three pages in Chromium against the same backend (29 checks, including
what each page says before its address is in `api.js`). The queries the
refresh builds from the real register were run read-only against Salesforce on
7 October 2026: every one valid.
