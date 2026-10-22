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

---

## The Log Book — rickyrampersadbranch.com/logbook

The second app. Agents log the documents they hand in; staff receive and sign
for them, build the transmittal for each department, print it and send it.
Anything received and not sent the same working day is chased by e-mail for a
reason. It replaces the Log Book Digital Jotform.

| Piece | Where |
|---|---|
| The page (agents and staff) | `rroperations/logbook/index.html` |
| The short address | `logbook/index.html` forwards to it |
| Backend | `apps-script/LogBook.gs`, a **second file in the same RR Operations project** |
| Tests | `tests/test-logbook.js` (backend), `tests/e2e-logbook.js` (phone and desk, against the real script) |

### Install (about ten minutes)

1. In the **RR Operations** Apps Script project, **+ → Script**, name it
   `LogBook`, paste in `apps-script/LogBook.gs`.
2. Paste the current `apps-script/DeliveryBook.gs` over the old one too: it now
   hands every Log Book action to `LogBook.gs` and lists the Log Book tile.
3. **Deploy → Manage deployments → pencil → New version.** Never "New
   deployment": the address in `ops-config.js` must not change.
4. Reload the sheet → **RR Operations → Log Book: set up**. This makes the tabs
   (Log Book, Transmittals, Agents, Departments), fills Departments from the
   history, and installs the hourly chase.
5. **Everyone signs in with their agent number and the password they use for
   the fact find**: the Log Book reads the **Access** tab of the Confidential
   Fact Find Form workbook (Agent Number, Password, Role, Unit, Active). Only staff
   and the branch manager get the staff side (receiving, transmittals, insights);
   agents, unit managers and the assistant branch manager log their own documents. "Not Active" cannot sign in.
   The script owner must be able to open that workbook. Anyone not on it can be
   added on the **Agents** tab here.
6. **Staff** use their RR Operations access code. A blank Apps cell on the
   Access tab already includes the Log Book; otherwise add `logbook` to it.
   Each staff member's Email on the Access tab is where their chase goes.
7. Optional: set `LB_HISTORY_ID` to the Log Book Digital workbook's ID and run
   **Log Book: import the old book** once, so the insights start with the
   3,600 lines already logged.
8. **The bag rota.** Nothing to add: the script already rotates the bag
   between the three who do transmittals, Azariah, then Elizabeth, then Sasha,
   one week each from Monday 19 October 2026 (Sasha goes home at 2 pm, Liz at
   3 pm, Azariah at 4 pm). Kamla does not do transmittals and is not on it. To
   change the order later, add a tab named **Bag Rota** with the columns
   `Staff | Order | Leaves At | Active`; while it has rows it replaces the
   built-in rota. The **Bag Log** tab makes itself the first time someone
   presses Bag in.

9. **The training** (`/logbook/training`). The questions are in the private Google Sheet
   **Log Book Questions (private)** in the branch manager's Drive; `LogBook.gs` already knows it
   (`LB_TRAIN.SHEET`), so there is nothing to import. Paste the new `LogBook.gs` and publish a New
   version. The script must run as the account that owns that sheet. Each attempt lands on a
   **Log Book Training** tab here, made the first time. To change a question, edit that sheet: the next
   test uses it. Keep the right answer off the longest option.

10. **Every e-mail from support@rickyrampersadbranch.com.** Copy the three Microsoft 365 properties
    from the Service Questionnaire project into this one (Project Settings → Script properties):
    `MS_TENANT`, `MS_CLIENT`, `MS_SECRET`. From then on every Log Book and Delivery Book e-mail
    (training results, the 11:00 and 12:00 e-mails, the reason requests, the department check,
    the 5 pm digest, the client's delivery confirmation) goes from support@ and sits in its Sent
    Items. Without them, or if Microsoft refuses one, it still goes, from this script's account.
    **Or through Gmail, with no Microsoft 365 at all:** either own the RR Operations script from the
    support@rickyrampersadbranch.com Google account, or, in the owning Gmail, add support@ under
    Settings → Accounts and Import → Send mail as, and confirm the code Google sends to it. The script
    finds that address by itself and sends from it. Publishing the new version asks once to allow Gmail.

### Settings

| Property | Default | What it does |
|---|---|---|
| `LB_BAG_CUTOFF` | 12 | Papers in before this hour go on that day's bag |
| `LB_BAG_HOUR` | 13 | The bag exchange; a received line still here after it missed its bag |
| `LB_SALES_SUPPORT` | sales support | Copied on every chase and every return |
| `LB_MANAGER` | the branch manager | Told when a contract passes 20 days with the agent |
| `LB_AGENTS_SHEET_ID` | the fact find workbook | Other workbooks to sign in from, comma-separated |
| `LB_HISTORY_ID` | — | The old Log Book, for the one-off import |

E-mail follows `DB_MODE`: in test mode (the default) every Log Book e-mail goes
to `DB_TEST_INBOX` with a banner naming who it was for.

### The departments

The **Departments** tab is the list the routing uses. Add a row for a new
department, put a name in **Attention** to print it on that department's
transmittals, or set **Active** to No to retire one.

**Email** is where the 3-working-day "did you receive these documents?" goes,
with Yes and No buttons. Fill it in for each department; a blank one sends the
question to sales support instead. A **No** goes to sales support for a
response, copying everyone, and opens a Salesforce task for the staff member
who collected the papers.

To send these from **support@rickyrampersadbranch.com**, copy `MS_TENANT`,
`MS_CLIENT` and `MS_SECRET` from the Service Questionnaire project's Script
Properties into this one. Without them they go from this account with
support@ as the reply address.
