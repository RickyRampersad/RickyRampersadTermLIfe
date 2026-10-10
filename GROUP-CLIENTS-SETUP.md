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
| `/groupclientmanagement/training.html` | staff before they start, and the branch manager (every result) | agent number and password, or the branch code |

The pages hold no client data. Everything comes from `apps-script/GroupClients.gs`
in the Service Questionnaire project, to someone who has signed in.

**Two spreadsheets, one script.** The group tabs (the register, the Salesforce
snapshot, the letters sent, the groups' answers, what is shared) live in their
own Google Sheet, **Group Client Management**. The script lives in the Service
Questionnaire project, because that is where the staff sign-in (the Agent Skill
Bank), the Salesforce login, the support@ mailbox and the web address already
are; it opens the group sheet by its ID, held in the `GCM_SHEET_ID` Script
property and never in the code, since the `.gs` files are public.

## Once

1. **Paste the scripts.** In the Service Questionnaire Apps Script project (the
   one with `Service.gs`, `Transition.gs` and `ServiceSalesforce.gs`):
   - add a new file `GroupClients.gs` and paste this repository's copy;
   - paste `Service.gs` from this repository. It differs only by two lines, one
     in `doGet` and one in `doPost`, that hand every `gcm.*` request to
     `GroupClients.gs`. **Put the branch code back into `TEAM_CODE`**: the
     repository copy ships it empty.
2. **Check the Script properties** (Project Settings → Script properties):
   - `SF_KEY`, `SF_SECRET`, `SF_LOGIN_URL`: the Salesforce sign-in, copied
     from the RRB KPI Tracker's own Script properties. The org has retired the
     username-password flow, so there is no `SF_USER` or `SF_PASS`: the app
     signs in with client credentials, as the KPI Tracker does, and
     `SF_LOGIN_URL` must be its My Domain address. Without them nothing can be
     read, and ServiceSalesforce.gs must be the repository copy (7 October
     2026 or later) to sign in this way.
   - `ANTHROPIC_API_KEY`: a Claude API key (console.anthropic.com → API keys),
     for the "Draft with AI" button. Without it the button does not appear
     and staff write each reason themselves.
   - `MS_TENANT`, `MS_CLIENT`, `MS_SECRET`: Microsoft 365, so letters go from
     support@. Without them, Send opens the letter in the staff member's own
     Outlook as plain text instead, and still logs it.
   - `GCM_TRAIN_SHEET_ID`: the ID of the private **Group Client Training** sheet that holds the test's
     questions, answers and marking guides (see "Training and the test" below). Without it the training
     page says the test is not linked.
   - `GCM_SHEET_ID`: the ID of the **Group Client Management** sheet (the long
     part of its address between `/d/` and `/edit`; pasting the whole address
     works too). That sheet starts with one tab, `Group Register`, built
     outside the repository: each group's Salesforce account, list bills,
     match words, contact and code. The script owner must be able to edit it.
3. **Run `gcmSetup`** from the editor, with `GroupClients.gs` open (authorise
   when asked). It adds the `Group Tasks`, `Group Sends`, `Group Responses`,
   `Group Shares` and `Group Queue` tabs to the group sheet, says which sheet
   it used, and installs the hourly refresh and the Monday 10:00 send. Then **run `gcmRefresh`** once to fill
   `Group Tasks`.
4. **Deploy → Manage deployments → pencil → New version.** Never New
   deployment: that changes the address every page uses.
5. **Staff on the Agent Skill Bank** need a Password of at least eight
   characters and a Role. Staff ("Sales Support", "Staff", "Assistant") see the
   groups whose Salesforce account they own, matched by e-mail first (the
   refresh writes the owner's Salesforce e-mail onto the register as Owner
   e-mail) and else by name, allowing for capitals and a double-barrelled
   surname ("SASHA LALLA" on the Skill Bank is "Sasha Lalla-Jagassar" in
   Salesforce). "Branch Manager" and "Assistant Branch Manager" see every
   group and the dashboard. Agents and unit managers are refused.

## The register

| Column | What it does |
|---|---|
| Group | the name the letters and pages use |
| Account Ids | the group's Salesforce account(s): exact, so preferred |
| List bills | how the group signs in, and how its employees' policies are found (any spelling: "TGM 1099" and "TGM1099" are one) |
| Match words | words in task subjects that name the group. One word must stand alone ("ACME" never matches "Acmeline"); several words may run on ("ACME & CO" matches "ACME & COMPANY") |
| Owner in Salesforce, Owner active | written by the refresh, never by hand: the staff member a group is assigned to is its account's owner in Salesforce. To move a group, change the account owner in Salesforce; the next refresh (hourly, or "Refresh from Salesforce") moves it on the board. A group on two accounts takes the first owner still active. An owner who is no longer an active user puts the group at the top of the manager's "To act on" |
| Contact in Salesforce, Contact e-mail, Contact greeting | written by the refresh, never by hand: the letter goes to the account's **Contact Person** in Salesforce, or, when it has none, to the account's own e-mail. To change who receives the letter, change the Contact Person in Salesforce and refresh. The greeting is "Ms. Smith" from the salutation and surname, or the name in full |
| To, Cc, Greeting | To is read only for a group whose account has no contact with an e-mail in Salesforce. Cc is always copied. A Greeting typed here is used instead of Salesforce's |
| Code | the group's access code. Under ten characters opens nothing |
| Enabled | N stops a group without deleting it |

A group cannot sign in without a list bill and a code, and cannot be sent a
letter without a contact: a Contact Person with an e-mail on its Salesforce
account, the account's own e-mail, or, failing both, a To on the register. The
group page and the preview say who the letter goes to and where that came from,
and point out a personal mailbox (gmail, hotmail and the like): the letter
carries the group's access code, and a personal address on an account may
belong to someone who has since left the company.

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

## Why an item is still open

Every open item carries its own story, rebuilt at each refresh from
Salesforce (the `History` and `Mails` columns of `Group Tasks`):

- **Where it stands**, one line: waiting on the group since the last e-mail
  we sent them, with the person handling it since a date, not started and
  past its target, and so on. A reply from the group says so.
- **How it got here**: when it opened, the e-mails filed against it by
  subject line and date, who it was handed to, when it was last worked on,
  and the target first set against the target now. The group sees only the
  e-mails that went to or came from its own contacts (the register's To and
  Cc, or their company's domain); drafts, forwards and notices between
  colleagues are staff-only. Staff also see how many times the target moved,
  and a flag when a payment confirmation was e-mailed but the item is still
  open.
- **A reason, written by staff**: an item the group sees that has been open
  more than 30 days needs a note for the group shared in the last 30 days.
  Until each one has it, Preview says so and Send stays locked. **Draft with
  AI** writes a first draft from the item's history, e-mail subject lines and
  internal Chatter (Claude, `claude-opus-5-5`; server-side fallbacks on).
  Nothing is shared until a person reads it, edits it and presses Post, which
  puts it on the task's Chatter and on the group's page. The AI is told never
  to mention an employee's health or a claim, never to quote internal notes,
  and never to blame anyone.

## The week

- **Every hour**, 6:00 to 18:00 Monday to Saturday, the refresh rereads
  Salesforce. Staff can refresh by hand from the page.
- **The letters go out by themselves at 10:00 on Monday** (`GCM.SEND_DAY`,
  `GCM.SEND_HOUR`). During the week each staff member opens their groups marked
  "Approve for Monday". For each one they check every item against Salesforce
  and the latest billing, tick what the group sees, and preview the letter
  (written from the group's own numbers, with an optional opening line of
  their own). Then they tick that they checked and press **Approve for
  Monday**; the group reads "Approved" on the board and the wall.
  - **The 10:00 run.** It rereads Salesforce, rebuilds each approved letter
    and sends it from support@. A letter waits, and its approver is told why,
    if something arrived after the check that nobody looked at. The hourly
    refresh catches up a missed run.
  - **The log.** Every letter is logged on `Group Sends` with who approved it,
    when, to whom, the items and the letter itself. A blind copy goes to sales
    support.
  - **Approvals.** Each approval is a row on `Group Queue`. `gcmSetup` makes
    that tab and the Monday trigger.
  - **Sending at once.** Only the branch manager can send a letter at once.
- **The group answers by Friday** (`GCM.RESPOND_DAY`): correct, needs a change,
  or not ours, with a note, which goes onto that task's Chatter; and a rating.
  The staff member and the branch get an internal e-mail at once.
- **The manager's dashboard and the wall** show letters sent against due,
  open and past-target items, completed this year, the share done by its due
  date, average days, answers, ratings and accuracy (the share of items groups
  marked correct) by staff, task type and week, and what to act on.

## Training and the test

`/groupclientmanagement/training.html` is the staff manual and the test, asked for on 8 October 2026 so that
nobody sends a group a letter before they have read how and passed.

- **The manual** has nine sections: the job, the week, the six checks before Send, escalations, what the
  group sees, writing to the group, follow-up, taking initiative, and how you are appraised. Each section is
  ticked as read; the test opens when all nine are, and the result records how many were read and for how long.
- **The test** has 18 questions worth 100 marks: 15 multiple choice and 3 written scenarios, each counted under
  one appraisal competency. Process accuracy is 30, initiative and problem solving 20, follow-up and ownership 20,
  client communication 15, confidentiality and compliance 15. A pass is 80% overall, every critical question
  right (the three on confidentiality), and no competency under 60%. Each competency is rated Exceeds (90%+),
  Meets (75–89%), Developing (60–74%) or Not yet.
- **The questions and answers are never in the repository** (it is public): they live in the private Group
  Client Training sheet, one row a question (Id, Competency, Points, Critical, Type, Question, A–D, Answer,
  Why, Rubric, Manual). Edit a question there and the next test uses it; a question's Points are its weight.
  The page is sent the questions without their answers, and every answer is marked by the backend.
- **Written answers** are marked by the Claude API against the question's Rubric and stay provisional until the
  branch manager confirms or changes the mark on the page (Team results). Without the API key they simply wait
  for the manager.
- **Every attempt is logged** on the training sheet's Results tab (made the first time): who, when, the score,
  the result, each competency, the critical questions missed, strengths, what to work on, the manual read, the
  minutes, every answer as marked, and the manager's marks and note. The result is e-mailed to the person and
  the branch manager, never to a shared inbox. Staff may retake it; every attempt is kept.

## Tests

The scripts are tested in Node on made-up groups (61 checks: the refresh, who
sees what, sharing, the letter, sending, answers, the wall, the routing), and
the four pages in Chromium against the same backend (26 checks). The queries
the refresh builds from the real register were run read-only against
Salesforce on 7 October 2026: every one valid.
