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
| `/myrenewal/` | a client the letter went to | a six-digit code sent to that e-mail |
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
