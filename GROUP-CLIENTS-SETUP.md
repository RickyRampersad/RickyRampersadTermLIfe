# Group Client Management — setup

The employers' weekly service report: staff check each group's open Salesforce
items and send the group a letter; the group signs in, reads each item and our
note on it, says whether it is right, and rates us; the branch manager sees
how every group is being serviced; the wall shows it to the branch.

| Page | Who | Signs in with |
|---|---|---|
| `/groupclientmanagement/` | staff (their groups) and the branch manager (every group, the dashboard) | agent number and password from the Agent Skill Bank, or the branch code |
| `/groupclientmanagement/client.html` | a group (the "Group Client Portal" tile on the home page) | its list bill and its access code |
| `/groupclientmanagement/wall.html` | the wall screen | the branch code |

The pages hold no client data. Everything comes from `apps-script/GroupClients.gs`
in the Service Questionnaire project, to someone who has signed in.

## Once

1. **Paste the scripts.** In the Service Questionnaire Apps Script project (the
   one with `Service.gs`, `Transition.gs` and `ServiceSalesforce.gs`):
   - add a new file `GroupClients.gs` and paste this repository's copy;
   - paste `Service.gs` from this repository. It differs only by two lines, one
     in `doGet` and one in `doPost`, that hand every `gcm.*` request to
     `GroupClients.gs`. **Put the branch code back into `TEAM_CODE`**: the
     repository copy ships it empty.
2. **Check the Script properties** (Project Settings → Script properties):
   - `SF_KEY`, `SF_SECRET`, `SF_USER`, `SF_PASS`: the Salesforce sign-in the
     assignment board already uses. Without them nothing can be read.
   - `MS_TENANT`, `MS_CLIENT`, `MS_SECRET`: Microsoft 365, so letters go from
     support@. Without them, Send opens the letter in the staff member's own
     Outlook as plain text instead, and still logs it.
3. **Import the Group Register** as a new tab named exactly `Group Register`
   (File → Import → Upload → Insert new sheet). The file is built outside the
   repository; it carries each group's Salesforce account, list bills, match
   words, contact and code.
4. **Run `gcmSetup`** from the editor (authorise when asked). It makes the
   `Group Tasks`, `Group Sends`, `Group Responses` and `Group Shares` tabs and
   the hourly refresh. Then **run `gcmRefresh`** once to fill `Group Tasks`.
5. **Deploy → Manage deployments → pencil → New version.** Never New
   deployment: that changes the address every page uses.
6. **Staff on the Agent Skill Bank** need a Password of at least eight
   characters and a Role. Staff ("Sales Support", "Staff", "Assistant") see the
   groups whose Salesforce account they own (matched by name: the name on the
   Agent Skill Bank must be the same person's name in Salesforce); "Branch Manager" and "Assistant Branch Manager" see
   every group and the dashboard. Agents and unit managers are refused.

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
  The staff member and the branch get an internal e-mail at once.
- **The manager's dashboard and the wall** show letters sent against due,
  open and past-target items, completed this year, the share done by its due
  date, average days, answers, ratings and accuracy (the share of items groups
  marked correct) by staff, task type and week, and what to act on.

## Tests

The scripts are tested in Node on made-up groups (61 checks: the refresh, who
sees what, sharing, the letter, sending, answers, the wall, the routing), and
the four pages in Chromium against the same backend (26 checks). The queries
the refresh builds from the real register were run read-only against
Salesforce on 7 October 2026: every one valid.
