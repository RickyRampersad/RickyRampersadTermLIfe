# Query Pal: let HELP 868 log tickets (two small edits)

Query Pal's backend is the Apps Script behind querymypolicy.com ("Query Pal Backend v7.0" in Drive). The WhatsApp assistant
posts a ticket to it, and Query Pal returns the reference (`RRB/2026/NNN/...`) and e-mails the department as it does for the
website form. Nothing else in Query Pal changes.

## 1. Script property
Project Settings → Script properties → add `HELP868_KEY` with the key the branch manager was given (never put it in this repository).

## 2. In `doPost`, right after the line `if (d.action === 'rai') return raiProxy_(d);`, add

```js
    // HELP 868 (WhatsApp): needs the key, and may arrive without a timestamp.
    if (d.source === 'HELP868') {
      if (!d.key || d.key !== PropertiesService.getScriptProperties().getProperty('HELP868_KEY')) {
        return json({ ok: false, error: 'not allowed' });
      }
      delete d.key;
      if (!d.timestamp) d.timestamp = new Date().toISOString();
    }
```

Then Deploy → Manage deployments → pencil → New version (never New deployment: the address would change).

## What this does not do
The website form does not send `source`, so it still works as before. It also means the route is still open to a request that does
not claim to be HELP 868. Closing that fully needs the same key in the form's own page, which is a separate change.

## While the pilot runs
Every ticket the assistant logs goes to **RR Branch Sales Support** (the branch's own inbox), with the department it belongs to in the
description. Staff re-route it in Query Pal. When the routing proves right, the assistant can send straight to the department.

---

## 3. Client confirmation e-mail from Query Pal (added 4 November 2026)

Query Pal v7.4 ("QUIET-ACK") sends the client nothing when a ticket arrives: the client's address is only copied on the
department's routing e-mail, and a client who skipped the e-mail question is copied on nothing. A WhatsApp client therefore had a
reference in the chat and no e-mail. This sends the client their own short "we have your request" e-mail with the reference, from
Query Pal, for tickets that come from HELP 868 only. The website form is untouched.

### 3a. Add this function anywhere in the script (for example below `sendRoutedEmail`)

```js
/* HELP 868: one short confirmation to the client, with the reference. Only for source HELP868 and a real client address. */
function sendClientAck_(d) {
  var to = String(d.email || '').trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return;
  if (to.toLowerCase() === BRANCH_SUPPORT.toLowerCase() || to.toLowerCase() === RR_SUPPORT.toLowerCase()) return; // they skipped
  var F = 'font-family:Segoe UI,Helvetica,Arial,sans-serif;';
  var first = clean(d.client || d.name).split(' ')[0] || 'there';
  var img = null;
  try { img = Utilities.newBlob(Utilities.base64Decode(LOGO_B64), 'image/png', 'querypal-logo.png'); } catch (e) {}
  var days = String(d.turnaround || '').replace(/[^0-9]/g, '');
  var html =
    '<div style="background:#eef6fc;padding:28px 12px;' + F + '">'
    + '<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:18px;overflow:hidden;border:1px solid #e1ebf4;">'
    + '<div style="background:linear-gradient(128deg,#0a2f4f,#0b6ab4);padding:18px 26px;">'
    + (img ? '<img src="cid:qplogo" width="34" height="34" alt="Rampersad Branch" style="vertical-align:middle;margin-right:10px;border:0;">' : '')
    + '<span style="' + F + 'font-size:16px;font-weight:800;color:#fff;">Ricky Rampersad Branch</span></div>'
    + '<div style="padding:26px;">'
    + '<p style="margin:0 0 8px;' + F + 'font-size:19px;color:#0a2138;font-weight:800;">Thank you, ' + first + '. We have your request.</p>'
    + '<p style="margin:0 0 16px;' + F + 'font-size:13.5px;color:#5e7a93;line-height:1.6;">Our team has it and will follow up'
    + (days ? ' (target: ' + days + ' working day' + (days === '1' ? '' : 's') + ')' : '') + '. Keep this reference for any follow-up.</p>'
    + '<div style="background:#0a2f4f;border-radius:12px;padding:13px 16px;margin:0 0 16px;">'
    + '<div style="' + F + 'font-size:9px;color:#9fc9ec;font-weight:800;letter-spacing:.2em;text-transform:uppercase;">Your reference</div>'
    + '<div style="font-family:Consolas,Menlo,monospace;font-size:13px;font-weight:700;color:#fff;margin-top:4px;word-break:break-all;">' + d.reference + '</div></div>'
    + '<p style="margin:0;' + F + 'font-size:13px;color:#0a2138;line-height:1.6;"><b>Request:</b> ' + clean(d.queryType) + '</p>'
    + '<p style="margin:14px 0 0;' + F + 'font-size:12px;color:#8fa6ba;line-height:1.6;">Reply to this e-mail or WhatsApp us on HELP 868 any time. Please do not send ID numbers, bank or card details by e-mail.</p>'
    + '</div>'
    + '<div style="background:#f6fafd;border-top:1px solid #e4eef6;padding:14px 26px;text-align:center;' + F + 'font-size:11.5px;color:#8fa6ba;">Ricky Rampersad Branch &middot; ' + BRANCH_SUPPORT + '</div>'
    + '</div></div>';
  var plain = 'Thank you, ' + first + '. We have your request.\n\nYour reference: ' + d.reference + '\nRequest: ' + clean(d.queryType)
    + '\n\nKeep this reference for any follow-up. Reply to this e-mail or WhatsApp HELP 868 any time.\n\nRicky Rampersad Branch';
  var mail = { to: TEST_MODE ? TEST_EMAIL : to, cc: BRANCH_SUPPORT, replyTo: BRANCH_SUPPORT, name: 'Ricky Rampersad Branch',
    subject: (TEST_MODE ? '[TEST] ' : '') + 'We have your request - ' + d.reference, body: plain, htmlBody: html };
  if (img) mail.inlineImages = { qplogo: img };
  MailApp.sendEmail(mail);
}
```

### 3b. In `doPost`, change the e-mail line

From:

```js
    if (SEND_EMAIL && d.departmentEmail) sendRoutedEmail(d);
```

To:

```js
    if (SEND_EMAIL && d.departmentEmail) sendRoutedEmail(d);
    if (SEND_EMAIL && d.source === 'HELP868') { try { sendClientAck_(d); } catch (ackErr) {} }
```

A failure in the client e-mail never stops the ticket or the reference coming back. Then Deploy → Manage deployments → pencil →
New version.

### Check
Send a WhatsApp ticket with a real e-mail: the client gets "We have your request" with the reference, support@ is copied, and
the department e-mail still goes as before. With the e-mail skipped, no client e-mail is sent and the WhatsApp message says so.
