# Motor Quote — setup

The client-facing motor quote at rickyrampersadbranch.com/motor-quote/ (short address `/motorquote`),
replacing the " Motor Quotation" JotForm (id 223376649264061) on 21 October 2026. The page is
`motor-quote/index.html`; the backend is `apps-script/MotorQuote.gs`, **its own Apps Script project on its
own Google Sheet** (it has its own `doGet`/`doPost`, so never paste it beside `Claims.gs` or `Service.gs`).

## What it does

1. The client signs in with their e-mail and a six-digit code sent to that inbox. No passwords.
2. Salesforce is read by that e-mail: the Contact, their motor policies (`CLIENT_PORTFOLIO__c`, MOTOR record
   type) and their vehicles (`Risk_Details__c`). An existing client sees their vehicles and picks one or adds
   a new one; name, mobile, occupation, date of birth, make, model, year, cover and sum insured are filled in.
3. The page asks what the quote needs that we do not hold: every question the JotForm asked, in six short steps,
   with the driver's permit and certified copy photographed on the phone.
4. Send: a row on the **Motor Quotes** tab (`MQ-yyMMdd-nnn`), the documents into Drive (**Motor Quotes /
   year / ref**), one e-mail to **CRMSQuotes@guardianonline.onmicrosoft.com** from
   support@rickyrampersadbranch.com with sales support and support@ copied and the documents attached, a receipt
   to the client with the reference, and a Salesforce task on the Contact. A client not in Salesforce gets a
   Contact created at this point (`Contact_Type__c` Prospect), when we hold a name.
5. Signing in again shows the client every request they made and its **Status** (kept by staff on the tab; fill
   **Quoted on** and **Quoted premium** when the quote comes back and the client sees them too).

## Three doors (21 October 2026)

- **Upload the invoice.** The client photographs the dealer's quotation or invoice, or picks a PDF. The script sends
  it to Claude (`ANTHROPIC_API_KEY`), which reads the make, model, year, value, condition and the rest. The page fills
  the quick quote with them, each marked "from your document", for the client to check. The document is attached to
  the desk's e-mail and what was read is on the row (**Invoice read**). The buyer's name on the document never replaces
  the signed-in client's. Without the key the document is still attached and the client types the details.
- **Quick quote.** The minimum to price: name, mobile, make, model, year, value, cover, years driving, no-claim
  discount and the lender. "New vehicle, not registered yet" is allowed. The permit and the certified copy follow
  when the client takes the quote.
- **Renewal first.** A client whose vehicle's cover ends within 60 days (or ended in the last 45) sees it first:
  the days left, every term on file with its cover, value and premium, and what the record shows. One tap renews as
  it is, or with changes. At the send the script reads the vehicle again from Salesforce, so the desk gets the dates,
  the premium and the terms from the record, never from the page. It goes to `MQ_RENEW_TO`, else the quotes desk.
- **Every detail** is the original six steps, a link under the two doors.
- **Take the quote** ("Got your quotation? Take it", or "Take this quote" on a request). The client uploads the
  quotation from Guardian General, the certified copy (or the dealer's invoice for a new vehicle) and the driver's
  permit. Each is read and fills Guardian's own **Private Motor proposal (GG-MOT-APV-PRO-02/2025v2)** and **Know Your
  Policy** form, which sit in `motor-quote/forms/` exactly as Guardian issues them. The client answers every
  declaration and every Know Your Policy point with a tap, none pre-ticked. They then sign on the screen. The two forms
  are filled on the phone (`motor-quote/forms.js`, with pdf-lib kept in `motor-quote/vendor/`), and the desk gets one
  e-mail with the signed proposal, the Know Your Policy form, the quotation, the certified copy and the permit. Any Yes
  an underwriter must see, and any Know Your Policy point answered No, is listed first. The client gets their signed
  forms back. Each proposal is a row on the **Motor Proposals** tab (`MP-yyMMdd-nnn`). The representative's half of the
  Know Your Policy form is left for the branch. Compliance must confirm the signed-on-screen proposal is accepted.
  When Guardian revises a form, replace the PDF and re-measure: the positions in `forms.js` are taken off its characters.
- **Existing or new, and the Opportunity.** The sign-in e-mail decides. A client found on file sees "We found your
  record": name, mobile, date of birth, occupation and the driver's permit as the Contact holds it (`DP__c`,
  `Drivers_Permit_Issue_Date__c`, `Driver_s_Permit_Expiry__c`), with whether it is valid, expiring within 60 days or
  expired. Anyone else is asked once, "Are you already a Guardian client?": **No** creates a Contact at the send, with
  the permit they gave; **Yes** takes an optional policy or client number, and the request is matched to a Contact by
  that number **and** the surname, never by the number alone; unmatched, no Contact is made (it would be a duplicate)
  and the Opportunity says to link it by hand. Nothing found that way is ever shown on the page. Every new quote (not
  a renewal) is an **Opportunity**, as the branch writes them by hand: record type GENERAL INSURANCE, "OPP Motor -
  <client> (<vehicle> <reg>)", stage Proposal/Price Quote, close date 30 days on, Contact, account, Vehicle #, New
  Business, lead source Existing Client or Web, owner `MQ_SF_OWNER`, producer `MQ_SF_PRODUCER`. Its task sits on it.
  Taking the quote moves it to Negotiation/Review.
- **The permit on the Contact.** A blank is filled; a later expiry (a renewed permit) replaces the old one with its
  issue date; an earlier expiry is never written; a **different permit number is never written**: it goes to staff
  (on the row, the task, and from the home screen a task "Confirm driver's permit") to confirm with the client. The
  client can update the permit from the home screen, by the same rules. In test mode nothing is written; the row says
  what would have been.
- **Guardian's Motor Quotation Request form.** Every new quote (quick or full, never a renewal) carries Guardian's own
  fillable request form (`motor-quote/forms/gg-motor-quotation-request.pdf`), filled in on the phone from the client's
  answers and attached to the desk e-mail as `motor-quotation-request.pdf`. It stays fillable, so the desk can add or
  correct anything. The client can preview it before sending.

## Install (once, about ten minutes)

1. **Signed in as support@rickyrampersadbranch.com (the Google Workspace account), not the personal Gmail**, make a
   new Google Sheet called **Motor Quotes**. Extensions → Apps Script. Paste `MotorQuote.gs` over the default file.
   Save. Owned by the Workspace account, every e-mail the script sends goes from support@ by itself, with the
   Workspace's allowance (about 1,500 a day), and the `MS_*` properties below are not needed. (A consumer Gmail owner
   gets about 100 recipients a day and sends from its own address with support@ only as reply-to.)
2. **Script properties** (Project settings → Script properties):
   - `SF_KEY`, `SF_SECRET`, `SF_LOGIN_URL` — copied from the KPI Tracker project (client credentials; the login
     URL is the My Domain address). Without them the page still works; nothing is pre-filled and no task is made.
   - `MS_TENANT`, `MS_CLIENT`, `MS_SECRET` — only if the script is NOT owned by the support@ Workspace account:
     copied from the Service Questionnaire project, so e-mail goes from support@ through Microsoft Graph. Owned by
     support@, leave them out.
   - `MQ_TEST_INBOX` — where every e-mail goes in test mode (default: the script owner).
   - `ANTHROPIC_API_KEY` — turns on the invoice reader. Each signed-in e-mail may have 15 documents read a day.
     `MQ_AI_MODEL` changes the model (default `claude-sonnet-5-5`).
   - `MQ_RENEW_TO` — where renewals go (default: the quotes desk).
   - `MQ_BIND_TO` — where signed proposals go (default: the quotes desk).
   - Optional: `MQ_QUOTES_TO` (overrides the quotes desk), `MQ_CC` (more copies, comma-separated),
     `MQ_SF_OWNER` (the Salesforce user id that owns new Contacts, Opportunities and tasks; the branch's motor
     opportunities are owned by the BMA), `MQ_SF_PRODUCER` (the Contact id put in Producer on every Opportunity; the
     branch's own are the branch manager's agent record), `MQ_SF_TASK_TYPE` (default
     "New Business"; a value the org refuses is left off), `MQ_DRIVE_FOLDER` (a folder id; else a "Motor Quotes"
     folder is made in the owner's Drive).
3. Run `mqSetup()` once; grant the permissions (Sheets, Drive, Gmail, external requests). It makes the four tabs
   and says what is linked.
4. Deploy → New deployment → Web app, **Execute as: Me**, **Who has access: Anyone**. Copy the `/exec` address.
   If Deploy says "You do not have permission to perform this action", the sheet is owned by another account
   and support@ is only an editor: File → Make a copy as support@, enter the Script properties again, deploy the copy.
5. In `motor-quote/index.html`, set `CONFIG.API_URL` to it. `CONFIG.SITE_KEY` must equal `MQ.SITE_KEY`.
6. Open the page, sign in with your own e-mail, send a request. In test mode it reaches `MQ_TEST_INBOX` only,
   banner on top saying who it would have gone to. `mqPreviewToMe()` sends the two e-mails to the owner without
   a sign-in.
7. When the manager says so: `mqGoLive()` (or set `MQ_MODE` = `live`). `mqTestMode()` turns it back.

**Updating the script:** paste the new `MotorQuote.gs` over all of the old code, save, run `mqSetup()` once (it adds
the new columns to the end of the Motor Quotes tab and says whether the reader is on), then publish a new version as
below. Paste and publish the script before the page that needs it goes live.

Re-deploying after a paste: Deploy → Manage deployments → pencil → New version. *New deployment* would issue a
fresh `/exec` and the page would have to be re-wired.

## Tabs

- **Motor Proposals** — one row a proposal: the quote it takes, the vehicle, what needs attention, the answers.
- **Motor Quotes** — one row a request. Staff keep **Status**, **Quoted on**, **Quoted premium**, **Staff note**. **Client status**, **Client says**, **SF opportunity**, **Permit on file** and **Permit update** say who the client is to us and what changed on the Contact.
- **Quote Files** — each uploaded document and its Drive id.
- **Quote Log** — sign-ins, sends, failures.
- **Sessions** — token hashes only, pruned as they expire.

## Rules

- Test mode is the default. The quotes desk never hears from a test.
- The signed-in e-mail is the client's e-mail; the form cannot change it.
- Never put a client's name in this file, in a commit or in a code comment: the repository is public.
- Test: `node tests/test-motor-quote.js`.
