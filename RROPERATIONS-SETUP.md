# RR Operations — setup

**rickyrampersadbranch.com/rroperations** is the branch team's sign-in and app
launcher. The first app on it is the **Delivery Book**. The Gas Receipt Tracker
and the Petty Cash Tracker are listed as "coming soon" until they are built.

| Piece | Where |
|---|---|
| Launcher (sign-in, the app tiles) | `rroperations/index.html` |
| Delivery Book | `rroperations/delivery-book/index.html` |
| The one shared setting (the backend address) | `rroperations/ops-config.js` |
| Backend | `apps-script/DeliveryBook.gs`, as the **RR Operations** Apps Script project |
| Tests | `tests/test-deliverybook.js` (backend), `tests/e2e-deliverybook.js` (phone, end to end) |

No client data lives in this repository. Deliveries, signatures, photos and
ratings are kept in the Delivery Book sheet and its Drive folder.

---

## 1. Create the backend

1. Open the **Delivery Book** Google Sheet → **Extensions → Apps Script**.
   Name the project **RR Operations**.
2. Paste in `apps-script/DeliveryBook.gs`, replacing everything there.
3. **Project Settings → Script Properties.** Add:

   | Property | Value |
   |---|---|
   | `SF_KEY` | Copy from the KPI tracker's Script Properties |
   | `SF_SECRET` | Copy from the KPI tracker's Script Properties |
   | `SF_LOGIN_URL` | Copy from the KPI tracker (the org's My Domain address) |
   | `DB_TEST_INBOX` | The inbox that receives test e-mails |
   | `DB_SF_OWNER` | Kamla's Salesforce User Id. It owns a new contact when the person logging has none on the Access tab. |

   Leave `DB_MODE` unset for now. Unset means test mode.

   The Connected App's Run As user must be able to **create Contacts and
   Tasks** and **update a Contact's e-mail**.
4. Reload the sheet. From the new **RR Operations** menu, choose **Check setup**.
   This creates the tabs (Deliveries, Access, Sessions, Ratings), asks for
   permissions (Sheets, Drive, Mail, Maps, external requests), and reports
   whether Salesforce signs in.

## 2. Fill in the Access tab

Each person gets one row:

| Name | Email | Access Code | Role | Salesforce User Id | Active | Apps |
|---|---|---|---|---|---|---|
| Pawan Probhu | … | (their code) | Staff | (their user id, if they have one) | Yes | delivery-book, gas-receipts, petty-cash |
| Ricky Rampersad | … | (code) | Branch Manager | … | Yes | |

- **Apps** lists the apps the person can open, separated by commas. A blank
  cell means every app. The ids are `delivery-book`, `gas-receipts` and
  `petty-cash`.
- A **Role** containing "Manager" also sees clients' comments and the links to
  signatures and photos in the book. Everyone else sees the stars only.
- The **Salesforce User Id** makes the Salesforce task (and any new contact)
  theirs. Without one, the task belongs to the Connected App's Run As user.
- Set **Active** to `No` to switch a person off.

## 3. Deploy and connect the site

1. **Deploy → New deployment → Web app.** Set *Execute as* to **Me** and *Who
   has access* to **Anyone**. Copy the `/exec` URL.
2. Paste the URL into `rroperations/ops-config.js` as `API_URL`, then commit.
3. For every later change, use **Deploy → Manage deployments → pencil → New
   version**. Choosing *New deployment* instead issues a new URL, and the site
   would have to be re-pointed.

The star links in client e-mails use this same `/exec` address. The script
records it the first time it is called; to set it by hand, use `DB_EXEC_URL`.

## 4. Bring the Jotform history across

**RR Operations → Import the Jotform history.** This copies each row of the
Jotform's "Form responses" tab into Deliveries once, so the book and the map
start from the first delivery. Gaps are flagged (no signature, incomplete
collector name, no GPS). Nothing is e-mailed and nothing goes to Salesforce.
Running it again copies nothing new.

## 5. Test, then go live

In test mode:
- every client e-mail goes to `DB_TEST_INBOX`, with a banner naming who it
  would have gone to;
- nothing is written to Salesforce, and a new client is not created;
- ratings tapped on test e-mails are recorded but never count towards anyone's
  average.

To test, log one delivery from a phone, open the test e-mail, and tap a star.

To go live, set `DB_MODE` to `live`. Then switch the Jotform off so there is
only one book.

**Mail limits:** a consumer Google account sends to about 100 recipients a
day. Once the limit is reached, a delivery is still recorded, its e-mail
status reads "Held: daily mail limit reached", and nobody is e-mailed until
the next day.

---

## How it works

**Finding the client.** A policy number is matched however it was typed. The
org stores "TT FCP 0100001" and "TTFHO0100002" side by side, so the likely
spellings are all queried and a normalised comparison decides. A name is
searched with SOSL across name fields.

**Duplicate records.** Two contacts sharing one e-mail address are flagged as
"filed twice", and the policies from both are listed. Neither is picked
silently.

**The client's policies.** Once a client is chosen, every policy they hold
(as `Contact__c` or `Contact_Person__c` on `CLIENT_PORTFOLIO__c`) is listed by
record type: Life, Pension, Health, Motor, Property, then the rest. The policy
that found the client is ticked already. Life, Pension and Health default to
"Policy Contract"; everything else defaults to "Certificate". A policy not on
record can be added by hand, and it is flagged as such.

**Required at the handover:**
- the collector's first and last name;
- their relationship to the client;
- a signature;
- the phone's GPS, or a written reason it could not be captured;
- a photo, whenever a cheque is handed over.

**Location.** The GPS becomes a Google Maps pin and a street address (using
Apps Script's own Maps service, with no key), plus the distance from the
client's address on file. A delivery more than 15 km from that address is
flagged. None of this appears in the client's e-mail.

**Salesforce, when live.**
- A completed **Servicing** task is filed on the client, against the first
  policy delivered.
- A client with no e-mail on file gets the one typed at the handover saved to
  their record.
- An e-mail typed over one already on file is never used; it is flagged
  instead.
- A new contact is created only when the person logging taps "Not in
  Salesforce", and even then not if the e-mail already belongs to someone on
  file.

**The record comes first.** The delivery rows are written before Salesforce or
mail is touched. A failure in either shows as a status on the row; the
delivery itself is never lost.

**Stars.** The confirmation e-mail asks "How did <name> do?" with five tappable
stars. The links are signed, so an edited link is refused. One tap records the
rating and opens a thank-you page with an optional comment box. Tapping again
changes the rating; each delivery holds one. The book shows the stars and each
person's average. Comments are shown to managers only.

## Adding the next app

1. Build it as `rroperations/<id>/index.html`, reading `ops-config.js` and the
   shared session (`rrb-ops-session`), as the Delivery Book does.
2. Add its backend file to the **same** RR Operations Apps Script project.
3. In `OPS_APPS` in `DeliveryBook.gs`, change its `status` from `soon` to
   `live`, and gate its actions with `opsCanUse_(who, '<id>')` in `doPost`.
   Hiding a tile on the launcher is not access control; the server check is.

## Approvals — cash and cheque collection

`rroperations/approvals/` (short link `/approvals`) and
`apps-script/Approvals.gs`. Replaces the "Branch Managers Approval" Jotform.

**The flow.**
1. The agent types the client's name (and the policy number if they have it).
   Every earlier request comes back first: the old Jotform rows and this
   app's own, matched by name in any case or order, or by a policy number in
   common. Test rows are left out. Same surname and initial is shown as a
   possible match, never counted.
2. Only then can the agent ask: cash or cheque, policy, amount, the reason
   from the list **and in their own words** (a full sentence). A client with
   history also needs a tick ("I have read …") and *what is different this
   time*.
3. The Branch Manager is e-mailed a link to the request. The review shows the
   reason, the flags and the whole history side by side, and **the exact
   e-mail GL Customer Service will receive** before anything is sent.
4. Approve, decline, or ask for more (a note is required for the last two).
   Approve sends GL Customer Service one of two e-mails:
   - **History**: every earlier request on this client in a table (date,
     agent, type, reason, amount, policy, status), with a line summing it up;
   - **First-time**: when there is none on record.
   The agent and the manager's Outlook are copied; replies go to the manager.

**Flags** (shown to both): 3 or more requests in 90 days (this one counted);
asked again within a week; the same reason given before; the same amount
already requested; declined before.

**Setup.**
1. Paste `Approvals.gs` as a new file in the RR Operations Apps Script project,
   and paste the updated `DeliveryBook.gs` over the old one.
2. Deploy → Manage deployments → pencil → **New version** (never New
   deployment: the address in `ops-config.js` must not change).
3. Run **RR Operations → Check approvals setup** once and allow the new
   permission (the script opens the Branch Managers Approval spreadsheet).
4. Access tab: add **approvals** to the Apps cell of each agent and of the
   Branch Manager (a blank cell already means every app). The person who
   decides must have **Branch Manager** in the Role column.
5. Script properties:
   - `APR_GL_CS_TO` — GL Customer Service address(es). Live approval is
     refused until it is set.
   - `APR_TEST_INBOX` — test e-mails (blank: `DB_TEST_INBOX`, then the owner).
   - `APR_BM_EMAIL` — defaults to Ricky.Rampersad@myguardiangroup.com.
   - `APR_MODE` = `live` when the test run has been read.

**Test mode is the default.** Every e-mail (the manager's alert, the GL
approval, the agent's notice) goes only to the test inbox, with a banner
naming who it was for.

**Where it writes.** A tab **Approval Requests** in the Branch Managers
Approval spreadsheet, beside the Jotform's own. Every decision is on the row:
status, who, when, the note, the GL e-mail's status and which template.

**Outlook.** Apps Script cannot send as a Microsoft 365 mailbox. The e-mails go
from the script owner's Google account under the name "Ricky Rampersad — Branch
Manager", with the manager's Outlook as reply-to and in copy, so every approval
is in his Outlook.

**Retire the Jotform** once live: disable "Branch Managers Approval" so agents
have one door. Its rows stay where they are and keep counting as history.
