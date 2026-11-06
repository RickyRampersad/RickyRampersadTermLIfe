# The renewal desk (general insurance) — setup

Every Guardian General policy renewing in a month, from last year to delivery:
the staff member picks the month, opens a renewal, reads last year and the
history since the policy began, reads Guardian General's renewal notice out of
support@, confirms the values, drafts the letter (with AI if they like), has it
approved, and the client approves on their own page. One press then writes the
new year into Salesforce and instructs Guardian General; the desk follows up and
books the delivery.

| Page | Who | Signs in with |
|---|---|---|
| `/renewaldesk/` | staff, the Branch Manager's Assistant and the branch manager | agent number and password from the Agent Skill Bank (the group client management sign-in), or from the branch app |
| `/myrenewal/` | a client the letter went to: their renewal and every year since the policy began | a six-digit code sent to that e-mail |
| `/groupclientmanagement/client.html`, tab **Your renewals** | an employer group | its list bill and access code |

Nothing on the pages holds client data. Everything comes from
`apps-script/GIRenewals.gs`, a sixth file in the Service Questionnaire project.
`GroupClients.gs` routes its `gcm.ren*` actions, so **Service.gs needs no paste**.

## Once

1. **Paste two files** in the Service Questionnaire project:
   - a new file **`GIRenewals.gs`**, this repository's copy;
   - **`GroupClients.gs`** (it gained the `gcm.ren*` routes, the hourly hook and
     `renewals` in its ping).
   Then **Deploy → Manage deployments → pencil → New version**.
   Check from a browser: `…/exec?action=gcm.ping` answers `renewals: { live: false, … }`.

2. **Script properties** (Project Settings → Script properties). Already there
   for group client management: `SF_KEY`, `SF_SECRET`, `SF_LOGIN_URL`,
   `MS_TENANT`, `MS_CLIENT`, `MS_SECRET`, `ANTHROPIC_API_KEY`, `GCM_SHEET_ID`.
   New, all optional:
   - `GIR_TEST_TO`: where test copies go besides the person who pressed
     (comma-separated). Blank: the branch manager.
   - `GIR_DELIVERY`: who gets the delivery appointment, as an e-mail or a
     Salesforce user id. Blank: the active Salesforce user whose first name is
     Pawan.
   - `GIR_GG_TO`: Guardian General's renewal desks as JSON, only if they change:
     `{"personal":["CRMSRenewals@…","CRMSSALSupport@…"],"commercial":["CRMSRenewals@…","CRMSCommercial@…"]}`.
   - `GIR_REQ_POOL`: who on the sales support team follows up what Guardian
     General's notice asks for (names as the Agent Skill Bank writes them,
     comma-separated). Blank: Sasha Lalla-Jagassar, Azariah Griffith, Elizabeth Lee.

3. **The support@ inbox is read** for Guardian General's notices and replies, with
   the same Entra app and Graph permission (**Mail.Read**) the transition inbox
   reader already uses. Nothing in the mailbox is changed.

4. **Who signs in.** Pawan, and anyone helping him, must be on the **Agent Skill
   Bank** with a Role the board reads as staff (Staff, Sales Support, Client
   Support…) and a Password. A role of *Driver* signs in to the Delivery Book
   only and is refused here. The branch manager and the Branch Manager's
   Assistant approve letters.

## Test mode, then live

Until **`girGoLive`** is run from the editor:
- the letter, the reminders and the instruction to Guardian General go to the
  person who pressed and the test inbox, marked **TEST**, with a banner naming
  who would have received them;
- Salesforce is written only when the person ticks "really going ahead" on the
  approve or proceed step;
- a group never sees a letter sent in test mode.

`girTestMode` puts it back. `girTickNow` runs the hourly follow-ups at once.

## Training: a practice run

Test mode is where staff train, on this month's real renewals, read from
Salesforce. Nothing practised reaches a client, Guardian General or Salesforce:

- the test letter goes to whoever approves it, the person who has the renewal
  and the test inbox. Each of them can open **rickyrampersadbranch.com/myrenewal**,
  enter their own e-mail, and answer it as the client. The client's page says
  "Practice letter";
- a comment, or an answer given as the client, stays on the desk's log. It never
  goes onto a real Salesforce task;
- every e-mail to the team says **[TEST]**;
- a staff address cannot be saved as the client's e-mail;
- leave "really going ahead" **unticked** on the approve and proceed steps. Ticked,
  Salesforce is written for real, and that renewal can no longer be started again.

**One session, start to finish** (about 30 minutes a person):

1. The trainee signs in at **rickyrampersadbranch.com/renewaldesk**, picks next
   month and a line, opens a renewal and presses **Take it**.
2. **Last year**: read the history and what the record says.
3. **Notice**: find Guardian General's notice in support@ and read it, or type its
   figures; check every one and save.
4. **Values**: confirm each vehicle's or property's value.
5. **Letter**: Draft with AI, read every word, change what is needed, preview,
   then **Send for approval**.
6. **The approver** (the branch manager or the Branch Manager's Assistant) opens the
   e-mail's link, reads it, sends it back once with a note, then approves it.
7. **The trainee as the client**: the letter is in their inbox. They sign in at
   /myrenewal with the code, read the history, ask a question, then approve with a
   changed value.
8. **Proceed to renew**, unticked: the instruction comes to the team marked TEST.
   Mark Guardian General's reply, delivered and paid by hand.
9. **Start again** for the next trainee: under "Every step so far", **Practice:
   back to the letter** (the next person starts at the approval) or **Practice:
   start from the beginning**. The branch manager, the Branch Manager's Assistant,
   or the person who has the renewal can press them.

Between sessions, **`girClearPractice`** in the editor puts every practice renewal
back to its letter at once.

**`girGoLive` clears the practice first.** Every renewal practised in test mode
goes back to its letter, which must be sent for approval again before it goes, so
nothing practised reads as sent. Any staff address left as a client's e-mail is
taken off. A renewal Salesforce was written for is left as it is and named in the
message.

**The day you run `girGoLive`, clients get one door.** The homepage's "Renew my
policy" opens the old renewal page, which then shows "Renewing this month? Sign in
with my e-mail" above its access-code box, so a client with a new letter and a
client holding an old access code both get in. Nothing changes on that page while
the desk is in test mode. After a full month live, retire the old portal and point
the homepage at `/myrenewal/`.

## What Guardian General asks for: a task for sales support

When a notice lists documents ("Submission of the undermentioned required…",
a Certificate of Incorporation, annual returns, directors' and signatories'
IDs) or asks for outstanding **Know Your Customer** documents, the notice step
shows them under **What Guardian General needs before it renews**, and one
**Servicing** task opens in Salesforce for a person on the sales support team:

- **Where:** on last year's billing record for the policy (else its cover term),
  with the client's contact.
- **Who:** the account owner when they are on the team, else whoever on the team
  has the fewest open requirement tasks. The desk can choose someone else.
- **Subject:** `Renewal Due <d/m/yyyy> - Renewal Requirements and KYC Documents -
  <policy> - <client>`. It is due ten days before the renewal, never sooner than
  two working days.
- **Description:** every item as a box to tick.
- **Who is told:** a Chatter post mentions the owner, and the owner and the sales
  support inbox each get an e-mail.
- **The form, for a company:** Guardian General's **Customer Due Diligence Check
  List** (GGIL-CDD, Incorporated Entities) is filled from the account and the
  notice and attached to the task. It is `renewaldesk/forms/GGIL-CDD-Company.pdf`;
  a file of that name in the `GCM_FORMS_FOLDER` Drive folder wins, so a new
  edition is a file swap.
  - Filled: broker, policy, the company's name, place of business, telephone,
    fax, e-mail, Company, the policy type, the annual premium, the value insured,
    the renewal in Section H and the salesperson's name.
  - Left blank: the date and place of incorporation, the registered office, the
    company type, the documents, the signature and the date. The registered
    salesperson signs it, never the client.

**Live**, the task opens when the notice is saved. **In test mode**, it opens
only from the notice step's **Open the task for sales support** with "This is
real" ticked, or at Proceed when Salesforce is written. **Download the due
diligence form, filled** works any time and opens nothing. One task a renewal,
never a second.

## What runs by itself

From the hourly group refresh (`gcmRefreshTick`), working days 8:00 to 17:00:
- an instruction with no reply from Guardian General in **2 working days** gets
  a follow-up with the trail, every 2 working days, posted on the follow-up
  task's Chatter; at the fourth the approvers are told;
- Guardian General's reply in support@ is read; "ready for collection" moves the
  delivery appointment to the next working day;
- a letter with no answer gets a reminder at **14** and **10** days; at **7** a
  call task opens and the approvers are told to decide. **Nothing renews without
  the client's yes.**

## The record

- **GI Renewals** (group sheet): one row a renewal: the notice read, the values,
  the letter, the approvals, the client's answer, the instruction, the follow-ups,
  delivery and payment.
- **GI Renewal Log**: one row a step, with who and when.
- Salesforce: the renewal task on last year's billing record ("Risk to Renew for
  -CLIENT Line Renewal Date m/d/yyyy Policy # …"), the client's answers and every
  step on its Chatter; on proceed, the new TRANSACTIONS record, a cover term per
  item with the confirmed values, the follow-up task and the delivery Event.
