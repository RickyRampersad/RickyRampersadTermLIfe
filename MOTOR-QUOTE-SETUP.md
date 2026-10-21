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
   - Optional: `MQ_QUOTES_TO` (overrides the quotes desk), `MQ_CC` (more copies, comma-separated),
     `MQ_SF_OWNER` (the Salesforce user id that owns new Contacts and tasks), `MQ_SF_TASK_TYPE` (default
     "New Business"; a value the org refuses is left off), `MQ_DRIVE_FOLDER` (a folder id; else a "Motor Quotes"
     folder is made in the owner's Drive).
3. Run `mqSetup()` once; grant the permissions (Sheets, Drive, Gmail, external requests). It makes the four tabs
   and says what is linked.
4. Deploy → New deployment → Web app, **Execute as: Me**, **Who has access: Anyone**. Copy the `/exec` address.
5. In `motor-quote/index.html`, set `CONFIG.API_URL` to it. `CONFIG.SITE_KEY` must equal `MQ.SITE_KEY`.
6. Open the page, sign in with your own e-mail, send a request. In test mode it reaches `MQ_TEST_INBOX` only,
   banner on top saying who it would have gone to. `mqPreviewToMe()` sends the two e-mails to the owner without
   a sign-in.
7. When the manager says so: `mqGoLive()` (or set `MQ_MODE` = `live`). `mqTestMode()` turns it back.

Re-deploying after a paste: Deploy → Manage deployments → pencil → New version. *New deployment* would issue a
fresh `/exec` and the page would have to be re-wired.

## Tabs

- **Motor Quotes** — one row a request. Staff keep **Status**, **Quoted on**, **Quoted premium**, **Staff note**.
- **Quote Files** — each uploaded document and its Drive id.
- **Quote Log** — sign-ins, sends, failures.
- **Sessions** — token hashes only, pruned as they expire.

## Rules

- Test mode is the default. The quotes desk never hears from a test.
- The signed-in e-mail is the client's e-mail; the form cannot change it.
- Never put a client's name in this file, in a commit or in a code comment: the repository is public.
- Test: `node tests/test-motor-quote.js`.
