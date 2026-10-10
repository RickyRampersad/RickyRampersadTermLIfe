# Query Pal — patching v10.2 → v10.3-HARDENED

Your `Code.gs` is the source of truth and stays yours. Nothing below replaces it;
every change is a small find-and-replace, and all the new code lives in a separate
file so the logo array and the 1,500 lines around it are never touched.

**Step 1.** In the Apps Script editor: `+` → `Script` → name it **`QueryPalPatch`**.
Paste the whole of `QueryPalPatch.gs` into it. Save.

**Step 2.** Make the fifteen edits below in `Code.gs`. Only the ones you need — each is independent.

**Step 3.** Deploy → Manage deployments → pencil → Version: **New version** → Deploy.

**Step 4.** Run `qpSelfCheck()` in the editor. It changes nothing and prints what loaded.

---

## The edits

### 1 — `getVersion` (line ~30)

```js
function getVersion(){ return 'v10.2-CLIENT-PORTAL'; }
```
becomes
```js
function getVersion(){ return 'v10.3-HARDENED'; }
```

---

### 2 — `doPost`: route on the server, and take sign-in off the URL

Find, near the top of `doPost`:
```js
    const d = JSON.parse(e.postData.contents);
    if (d.action === 'rai') return raiProxy_(d);           // optional AI assistant proxy
```
Replace with:
```js
    const d = JSON.parse(e.postData.contents);
    if (d.action === 'rai') return raiProxy_(d);           // optional AI assistant proxy
    if (d.action === 'agentauth') return qpAgentAuthPost_(d);   // sign-in, so no password rides in the URL
    if (d.action === 'enroll')    return qpEnroll_(d);          // company portal: enroll a member

    // Decide the destination here, from the query type. Whatever department the
    // browser claimed is discarded — the webhook is public and its URL is in the page.
    if (!qpApplyRoute_(d)) return json({ ok:false, error:'Unknown query type — nothing was sent.' });
    if (!qpRateLimit_('post', 30, 60)) return json({ ok:false, error:'Too many requests just now — try again in a minute.' });
```

---

### 3 — `doPost`: stop two submissions taking the same reference

The next number is read under a lock that is released before the row is written,
so two people submitting at once can get the same one.

Find:
```js
    const runNo = nextRunNo(sh);
```
Replace with:
```js
    const qpLock = LockService.getScriptLock();
    qpLock.waitLock(20000);
    const runNo = nextRunNo(sh);
```

Then find the end of that block:
```js
    d.reference = reference;
    if (SEND_EMAIL && d.departmentEmail) sendRoutedEmail(d);
```
Replace with:
```js
    SpreadsheetApp.flush();
    qpLock.releaseLock();

    d.reference = reference;
    if (SEND_EMAIL && d.departmentEmail) sendRoutedEmail(d);
```

---

### 4 — `doGet`: add the wall, and pass a session token to the dashboard

Find:
```js
  if (p.action === 'myqueries') return myQueries_(p.code);
```
Replace with:
```js
  if (p.action === 'myqueries') return myQueries_(p.token ? (qpAgentFromToken_(p.token)||{}).code || p.code : p.code);
  if (p.action === 'wall')      return wallStats_(p.code, p.token, p.days);
  if (p.action === 'requestcode')   return qpRequestCode_(e);   // client asks for their access code by email
  if (p.action === 'clienthistory') return qpClientHistory_(e); // client-safe case timeline (no internal notes)
  if (p.action === 'clientstats')   return qpClientStats_(e);   // response / resolution rates for the portal
```

---

### 5 — `sendRoutedEmail`: attach documents, and list them properly

Find:
```js
  var attachNote = '';
  if (d.attachPdf || d.attachId){
    var parts = [];
    if (d.attachPdf) parts.push('the completed, signed form');
    if (d.attachId) parts.push((d.attachIdName && d.attachIdName.indexOf('RCC_Card')===0) ? 'a photo of the credit card' : 'a valid photo ID');
    attachNote = row('Attached', '&#128206; ' + parts.join(' and '));
  }
```
Replace with:
```js
  var qpAtt = qpBuildAttachments_(d);
  var attachNote = qpAttachNote_(d, qpAtt, row);
```

Then find, further down:
```js
  // Attachments
  var attachments = [];
  if (d.attachPdf){ try{ attachments.push(Utilities.newBlob(Utilities.base64Decode(d.attachPdf),'application/pdf', d.attachPdfName||'form.pdf')); }catch(e){} }
  if (d.attachId){ try{ attachments.push(Utilities.newBlob(Utilities.base64Decode(d.attachId),'image/jpeg', d.attachIdName||'ID.jpg')); }catch(e){} }
```
Replace with:
```js
  var attachments = qpAtt.blobs;      // built above — documents as well as photos
```

---

### 6 — `sendRoutedEmail`: escape what people typed

Names, subjects and policy numbers go into the HTML body unescaped, so a stray
`<` in a client name breaks the layout of what the department receives. Find:
```js
  +     row('Subject', d.subject)
  +     row('Logged by', d.loggedBy + (d.client||d.name ? ' &mdash; '+(d.client||d.name) : ''))
  +     row('Policy / App', d.policy)
  +     row('Servicing agent', d.agent)
```
Replace with:
```js
  +     row('Subject', esc(d.subject))
  +     row('Logged by', esc(d.loggedBy) + (d.client||d.name ? ' &mdash; '+esc(d.client||d.name) : ''))
  +     row('Policy / App', esc(d.policy))
  +     row('Servicing agent', esc(d.agent))
```

And the description, which currently escapes `<` only:
```js
white-space:pre-wrap;">'+ (d.description||'').replace(/</g,'&lt;') +'</div>'
```
becomes
```js
white-space:pre-wrap;">'+ esc(d.description) +'</div>'
```

---

### 7 — `managerForAgent`: reach the ten agents it currently misses

Find the whole function:
```js
function managerForAgent(agentName){
  if(!agentName) return DEFAULT_MANAGER;
  var key = agentName.toLowerCase().replace(/[-.]/g,' ').replace(/\s+/g,' ').trim();
  return AGENT_MANAGER[key] || DEFAULT_MANAGER;
}
```
Replace with:
```js
function managerForAgent(agentName){
  return qpManagerFor_(agentName);          // alias-aware — see QueryPalPatch
}
```

---

### 8 — `agentAuth_`: require the password, throttle the guessing

Find the whole function:
```js
function agentAuth_(code, pwd) {
  var me = findAgent_(code);
  if (!me && pwd) me = findAgent_(pwd);          // master code typed in the password box
  if (!me) return json({ ok: false });
  if (me.src === 'tab') {                        // sheet rows need the matching password
    var want = String(me.pwd || '').trim().toUpperCase();
    var got = String(pwd || '').trim().toUpperCase();
    if (want && got !== want) return json({ ok: false, why: 'pwd' });
  }
  return json({ ok: true, code: me.code, name: me.name, email: me.email, role: me.role });
}
```
Replace with:
```js
function agentAuth_(code, pwd) {
  var tried = String(code || pwd || '').toUpperCase().substring(0, 24);
  if (!qpRateLimit_('auth_' + tried, QP_AUTH_MAX, QP_AUTH_WIN)) return json({ ok: false, why: 'rate' });

  var me = findAgent_(code);
  if (!me && pwd) me = findAgent_(pwd);          // master code typed in the password box
  if (!me) return json({ ok: false });
  if (me.src === 'tab') {                        // sheet rows carry their own password
    var want = String(me.pwd || '').trim().toUpperCase();
    var got = String(pwd || '').trim().toUpperCase();
    if (want && got !== want) return json({ ok: false, why: 'pwd' });
  } else {
    var why = qpCheckPassword_(me, pwd);         // script-list codes: hashed password
    if (why) return json({ ok: false, why: why });
  }
  return json({ ok: true, token: qpIssueToken_(me), code: me.code, name: me.name, email: me.email, role: me.role });
}
```

---

### 9 — `autoSweep`: keep chasing work that is in progress

A query moved to "In Progress", "Pending" or "Acknowledged" is never chased
again and never surveyed — it sits silently forever. Find:
```js
    if (status && status.indexOf('open') === -1) continue;   // blank or Open = live case
```
Replace with:
```js
    // anything not closed is still owed an answer — "In Progress", "Pending" and
    // "Acknowledged" all keep getting chased. Only these opt out.
    if (/cancel|withdraw|duplicate|on hold/.test(status)) continue;
```

---

### 10 — `doGet`: stop anyone ending an employee's cover with a URL

**Do this one first.** `action=terminate` is a GET on a webhook whose URL is
printed in the page, and it carries nothing that says who is asking. Anyone who
viewed source could end an employee's Group Life and Health cover — and send
that person a conversion notice — by pasting a link. Opening terminations to
employers (edit 12) multiplies who can reach it, so the lock goes on first.

In `doGet`, find the line that handles the termination — it looks like:
```js
  if (p.action === 'terminate') return terminate_(e);
```
Replace with:
```js
  if (p.action === 'terminate') {
    if (!qpGetTerminateOk_(p)) return json({ ok:false, err:'Please sign in and use the portal — this link no longer works on its own.' });
    return terminate_(e);
  }
```

`qpGetTerminateOk_` accepts a signed-in agent (session token *or* agent code)
and a company code. Nothing else. `terminate_()` itself is untouched.

> The agent page now has to send its code, which edit 13 does. Passing a code in
> a URL is still not ideal — edit 2 moved sign-in off the URL for exactly that
> reason. The clean end state is the agent path moving to POST like the company
> path. Send me `Code.gs` and I will do that properly; this edit is the part
> that can be done safely without seeing it.

---

### 11 — `doGet`: same guard on the roster and lookup

`grouproster` returns an employer's staff list and `grouplookup` returns a named
employee's policy numbers and email. Both take an optional `code` today, so both
answer callers who supply nothing.

Find:
```js
  if (p.action === 'grouproster') return groupRoster_(e);
  if (p.action === 'grouplookup') return groupLookup_(e);
```
(the names may differ slightly — match whatever your file calls them) and wrap
each the same way:
```js
  if (p.action === 'grouproster') {
    if (!qpGetTerminateOk_(p)) return json({ ok:false, err:'Sign-in required.' });
    return groupRoster_(e);
  }
  if (p.action === 'grouplookup') {
    if (!qpGetTerminateOk_(p)) return json({ ok:false, err:'Sign-in required.' });
    return groupLookup_(e);
  }
```

If those functions already check the code themselves, this is belt and braces —
harmless, and it makes the requirement explicit at the routing layer.

---

### 12 — `doPost`: the company leaver run

In `doPost`, alongside the `enroll` line added in edit 2:
```js
    if (d.action === 'enroll')    return qpEnroll_(d);          // company portal: enroll a member
```
add:
```js
    if (d.action === 'leavers')   return qpLeavers_(d);         // company portal: report leavers
```

POST only, company sign-in required, rate limited to 10 submissions an hour and
25 members a submission. One case per member, because the department closes them
one at a time and the conversion notice is per person.

---

### 13 — `index.html`: the agent termination call sends its code

One line, so edit 10 does not lock agents out. Find in `termSubmit()`:
```js
  var q=SHEET_WEBHOOK_URL+'?action=terminate'
```
Replace with:
```js
  var q=SHEET_WEBHOOK_URL+'?action=terminate'
    +'&code='+encodeURIComponent((agentAuth&&agentAuth.code)||(clientAuth&&clientAuth.code)||'')
```

The updated `index.html` in this folder already has this change, along with the
company-facing leaver run. If you are pasting files wholesale you can skip this
edit — it is here for the record.

---

### 14 — `autoSweep`: tell the client when their case goes on hold

Edit 9 stopped the chasers for cases marked On Hold — but nobody tells the
client, so a hold feels like being forgotten. This sends one branded
"your request is on hold" note (the template lives in the patch as
`qpHoldNotice_`) the day the hold appears, then stays quiet.

Find the line edit 9 installed:
```js
    if (/cancel|withdraw|duplicate|on hold/.test(status)) continue;
```
Replace with:
```js
    if (/on hold/.test(status)) { try { qpHoldNotice_(sh, r, row); } catch (he) {} continue; }
    if (/cancel|withdraw|duplicate/.test(status)) continue;
```

---

### 15 — `findAgent_`: manage staff and agents from the Agent Codes tab

Right now the hard-coded `AGENT_ACCESS` list is checked *first*, so for the 35
people already in the script the sheet is ignored — you cannot set their
password, change a role, or revoke them without editing code. This makes the
**Agent Codes tab the master list**; anyone not in it still falls back to the
script list, so nothing breaks the day you deploy.

Find the top of `findAgent_`:
```js
function findAgent_(code) {
  code = String(code || '').trim().toUpperCase();
  if (!code) return null;
  for (var k in AGENT_ACCESS) {                              // the script list wins
```
Replace with:
```js
function findAgent_(code) {
  code = String(code || '').trim().toUpperCase();
  if (!code) return null;
  var fromSheet = qpSheetAgent_(code);        // the Agent Codes tab wins — edit people there
  if (fromSheet) return fromSheet.revoked ? null : fromSheet;
  for (var k in AGENT_ACCESS) {                              // then the script list
```

After deploying, run **`auditAgentCodes`** from the editor. It prints every row
the sheet governs, marks who still falls back to the script list, and flags
missing agent numbers, passwords under 4 characters, and any password used by
two people (which lets one sign in as the other).

---

### 16 — `findAgent_`: stop a name being a password  ·  **do this one first**

Verified against the live webhook on 24 Aug 2026. Typing an agent's **full name**
into the number box with the **password left blank** signed straight in:

```text
?action=agentauth&num=Kamla%20Dookran&pwd=
  → {"ok":true,"code":"KAMLA DOOKRAN","role":"staff"}
```

The last thing `findAgent_` tries is a loose scan: if the typed text matches any
cell in any tab except `Queries`, that row is accepted as the person signing in,
with no password checked. The Comments and KPI tabs hold staff names in ordinary
rows, so **every member of staff can be impersonated by anyone who knows their
name** — and the branch webhook URL is printed in the page source.

Find, near the end of `findAgent_`:
```js
  if (code.length < 3) return null;                          // loose scan stays strict
  var rows = codeRows_();
  for (var i = 0; i < rows.length; i++) {
    for (var c = 0; c < rows[i].length; c++) {
      if (rows[i][c].toUpperCase() === code) return parseRow_(rows[i], code);
    }
  }
  return null;
}
```
Replace with:
```js
  return qpLooseAgent_(code);        // people-tabs only; never a name, email or date
}
```

After deploying, confirm it is closed — this must come back `{"ok":false}`:
```text
?action=agentauth&num=Kamla%20Dookran&pwd=
```

---

### 16 — `sendFollowUp_`: actually land inside the thread

This is the reported bug. The follow-up looks for the original email with a
single Gmail search on the reference — and a reference like
`RRB/2026/214/Anita Maharaj/Tax statem` is not one search term to Gmail. When
the search misses, the empty `catch` swallows it and the chase goes out as a
fresh `Re:` email with no day-1 underneath it. Find, inside `sendFollowUp_`:

```js
    var threads = (function(){ var th = deptThread_(ref, row[14]); return th ? [th] : []; })();  // dept-locked
    if (threads && threads.length) {
      threads[0].replyAll(plain, { htmlBody: html, name: 'RR Branch Query Pal',
        inlineImages: img ? { qplogo: img } : undefined });
      sent = true;                                               // true threaded reply — full trail
    }
  } catch (ge) {}
```
Replace with:
```js
    var found = qpFindThread_(ref, row[14], subjectBase);        // four searches, not one
    if (found.thread) {
      found.thread.replyAll(plain, { htmlBody: html, name: 'RR Branch Query Pal',
        inlineImages: img ? { qplogo: img } : undefined });
      sent = true;                                               // true threaded reply — full trail
    } else {
      try { cmtSheet_().appendRow([new Date(), ref, 'Query Pal', 'system',
        '⚠️ Follow-up sent outside the thread (' + found.how + ')', 'internal']); } catch (ce) {}
    }
  } catch (ge) {}
```

Now a miss is written on the case trail instead of vanishing.

> **Run `qpThreadCheck()` first.** It sends nothing and tells you in one line
> whether Gmail access is the problem. Deploying never asks for permissions —
> only *running* a function does, so a project that was deployed but never run
> since the threading feature was added has been posting stray mail ever since.

---

### 17 — `autoSweep`: chase our own side too

A department that replies asking for a document is waiting on **us**. Nothing
currently notices. Find the line that skips cases inside the reply grace window:

```js
    var extAt = (reply && reply.at) ? reply.at : (row[27] ? new Date(row[27]) : null);
    if (extAt && (now - extAt) < REPLY_GRACE_DAYS * 86400000) continue;
```
Replace with:
```js
    var extAt = (reply && reply.at) ? reply.at : (row[27] ? new Date(row[27]) : null);
    if (extAt) { try { qpOwedSweep_(sh, r, row, now); } catch (oe) {} }   // do WE owe a reply?
    if (extAt && (now - extAt) < REPLY_GRACE_DAYS * 86400000) continue;
```

The department chasers are untouched — this only adds a nudge to the assigned
person on the next working day when a department is waiting on us, and copies
their manager the day after. A reply that reads as a resolution owes nothing.

---

### 18 — reply watch: put the insight on the trail

Wherever the reply watcher stamps the department's reply (the block that sets
column AB and calls `classifyReply_`), add one line after the stamp:

```js
    try { qpReplyInsight_(row[0], replyText, replyFrom); } catch (ie) {}
```

Use whatever the local variables for the reply body and sender are called. This
writes a plain-language note onto the case — what the department said, what they
are asking for, and what to do next — so whoever opens the case can act without
reading the whole thread.

---

### 19 — `doGet`: let anyone check whether it is up

One person built this and one person keeps it running, so the useful question
is "did my last change break something, and can I tell in ten seconds". Add to
`doGet`, beside the other actions:

```js
  if (p.action === 'health')    return json(qpHealth_());
```

Then `…/exec?action=health` answers from a phone, and `qpHealth()` run from the
editor prints the same thing in plain words. It reports the sheets, the sign-in
list, the routing table, whether the autopilot trigger is installed, how much
email quota is left today, and whether Gmail threading is authorised.

---

## Two more worth doing, not required

**`raiProxy_`** — the assistant endpoint is unauthenticated and spends your
Anthropic credits. Right after `try {`, add:
```js
    if (!qpRateLimit_('rai_all', 200, 3600)) return json({ reply: null, why: 'rate' });
```
And the model id `claude-sonnet-4-6` should be `claude-sonnet-5`.

**The duplicate `normName_`.** It is declared twice — once near the roles section
and again in the v8.1 block as `replace(/[^a-z]/g,'')`. The second wins
everywhere, so `"Ricky Rampersad"` normalises to `rickyrampersad` with no space,
while `roleFromHierarchy_` and the manager branch of `myQueries_` compare against
`mv.split('@')[0].replace(/\./g,' ')`, which keeps the space. Those comparisons
can never match, so a manager whose codes row has no email never resolves their
team. Deleting the **second** definition restores the intended behaviour — but
check your codes tab first, since some matching may have grown to depend on the
stricter version.

---

## The client portal upgrade (rides on the same edits)

The lines added in edits 2 and 4 switch on four portal features that the new
site files use:

- **Get my code by email** — a client enters the email on their policy; if it
  matches the Client Codes tab or the Group Clients roster, the code is emailed
  to that address only. The reply is identical whether the email is known or
  not, so the endpoint cannot be used to probe your records. Company codes stay
  branch-issued — their scope is an account name, not an email.
- **Enroll a new member** — company sign-ins get an Enroll button: member
  details, plan(s), effective date, up to three documents. GIA receives the
  branded request, the case is logged under the company's scope, assigned to
  Sasha, and chased by the autopilot like everything else.
- **Client-safe history** — IMPORTANT: the old History button called
  `casehistory`, which needs no sign-in and returns INTERNAL staff notes; it was
  also reading the wrong field, so it always showed "No history entries yet."
  The new endpoint requires the client's code, verifies the case is theirs, and
  shows only milestones plus trail/client comments. Internal notes never leave
  the branch.
- **Stats tiles** — response rate, resolution rate, average resolution days and
  on-time %, computed over only the cases that code can see.

## After deploying

1. Open the webhook URL — it should say `v10.3-HARDENED`.
2. Run `qpSelfCheck()` — confirms 60 routes, lists any agent still without a manager.
3. Set `TEST_MODE = true`, send one query with a PDF attached, confirm it arrives, set it back.
4. Passwords, when you are ready: run `bootstrapAgentPasswords()` (prints every
   password **once**), hand them out, then set `QP_REQUIRE_PASSWORD = true` in
   QueryPalPatch and redeploy. Until that flag flips, anyone without a password
   signs in exactly as before, so nobody is locked out mid-rollout.
5. Six agents still have no manager on the hierarchy — Diane Lutchman-Statham,
   Ganesh Khodai, Jonathan Pantin, Janice Phillip, Kamla Dookran, Roberta Laltoo.
   Add them to `AGENT_MANAGER` and their routed emails will copy the right person.

## One small thing on the site

`Motor or Home Claim - Follow-up` routes to `GGILPCClaims@myguardiangroup.com`,
which has no entry in the `DEPT` map in `index.html` — so that request type
currently shows the raw email address as its department name. Adding
`'GGILPCClaims@myguardiangroup.com':'GGIL P&C Claims',` to that map fixes it.
The patch file already carries the name for the emails it sends.

---

### 20 — `autoSweep`: chase on what the department actually needs

Four small edits, all inside `autoSweep`. Together they stop the autopilot
chasing work that was never going to be done in the time we promised, and
turn the three wasted emails into one phone call.

**20a — the chase point is not the client's promise.**

Find:
```js
    var due = deadlineAt_(logged, row[15]);
```
Replace with:
```js
    var due = qpChaseDue_(logged, row);   // measured; row[15] stays the client's promise
```

**20b — two chases, then a person calls.**

Find:
```js
    if (count >= (sup ? FOLLOWUP_MAX_SUPPORT : FOLLOWUP_MAX)) {
```
Replace with:
```js
    if (count >= qpChaseCap_(row)) {
```

**20c — stop the daily chase on health and claims.** It was the biggest
single source of wasted volume: one case had thirteen.

Find:
```js
    if (now <= due) {                                    // not overdue yet…
      // …but support cases demand a reply: chase from the next working day if the thread is silent
      if (!(sup && workedDaysSince_(logged) >= 1 && !extAt)) continue;
    }
```
Replace with:
```js
    if (now <= due) continue;   // the measured point has not passed yet
```

**20d — our own desk gets a list, not an email each.**

Find:
```js
    try {
      sendFollowUp_(row, count + 1, due, sup);
      sh.getRange(r + 1, 23).setValue(count + 1);
      sh.getRange(r + 1, 24).setValue(now);
    } catch (fe) {}
  }
}
```
Replace with:
```js
    try {
      if (qpInternalDesk_(row)) qpDeskQueue_(row, count + 1, due);
      else sendFollowUp_(row, count + 1, due, sup);
      sh.getRange(r + 1, 23).setValue(count + 1);
      sh.getRange(r + 1, 24).setValue(now);
    } catch (fe) {}
  }
  qpDeskFlush_();            // one worklist for Sales Support, not an email a case
}
```

Nothing here changes what the client is told, and nothing changes how the wall
scores on-time: `row[15]` is still the promise and still what the branch is
measured against. What changes is when the machine speaks.

Run `qpChaseReview()` from the editor in a month to re-measure.

### 21 — `doPost`: never tell a client a department has it when it has not

**This is the one to do today if you do nothing else.**

`doPost` writes the row and then sends the routed email. If the send throws —
and the daily sending limit is the usual reason — the whole request answered
`{ok:false}`, the page showed a success screen anyway, and the client walked
away with a reference for a request no department had ever received. The page
is fixed and will now say so honestly. This edit means it rarely has to.

Find, near the end of `doPost`:
```js
    if (SEND_EMAIL && d.departmentEmail) sendRoutedEmail(d);
    return json({ok:true, reference:reference, runNo:runNo});
```
Replace with:
```js
    var mailed = true;
    if (SEND_EMAIL && d.departmentEmail) mailed = qpSendRouted_(d, sh, reference);
    return json({ok:true, reference:reference, runNo:runNo, mailed:mailed});
```

That is the whole edit. What it buys, from `QueryPalPatch.gs` section 13:

- **Copies are shed before the request is.** One request spends up to six of
  the day's hundred recipients: the department, sales support, branch support,
  the agent and the client. Five of those are courtesy; one is the request.
  Under twelve recipients left, the internal copies are held back and the
  client's own copy is kept. Under four, the department alone. The request
  gets through on the last of the quota instead of being the thing that fails.
- **A case that could not be sent is flagged** as an internal note on its
  trail — never in a sheet column, because columns 23 to 29 are the
  autopilot's own and a word written into the Follow-ups count would stop
  every chase in the branch. No alert email is attempted: the quota is the
  usual cause, so the alert would fail with it.
- **`qpUnsentReport()`** lists what is waiting, so those few can go by hand.

Run `qpUnsentReport()` from the editor on any day the limit was reached.

---

### 22 to 25 — `doGet`: a reference is not a credential

**Five single-word edits. Double-click the word, type the new one, nothing else.**

The agent dashboard reads a case's notes through `comments`, its timeline
through `casehistory`, and the department-reply map through `replies`. None of
the three asked who was calling. Tested against the live backend on 10 October
2026: `action=replies` with no sign-in returned the open references waiting on
a department, and `action=comments` with one of those references returned nine
comments, every one of them an internal note. The two chain — the first call
hands you the references, the second turns a reference into the branch's
private notes on that case.

`addcomment` had the gap from the other side. It checked for a valid code but
never that the case belonged to the person holding it, so any signed-in agent
could write onto any case in the branch and, with the trail option, push that
text to the client and the department. The client portal already guards this
("prevent commenting on someone else's case"); the staff path never did.

Each edit is one word. Use **Ctrl+F**, paste the search text, then double-click
the function name after `return` and type the replacement.

| # | Search for | Double-click | Type |
|---|---|---|---|
| 22 | `p.action === 'comments'` | `comments_` | `qpComments_` |
| 23 | `p.action === 'addcomment'` | `addComment_` | `qpAddComment_` |
| 24 | `p.action === 'casehistory'` | `history_` | `qpHistory_` |
| 25 | `p.action === 'replies'` | `replies_` | `qpReplies_` |

Each search text appears exactly once. Double-click selects the whole function
name because `_` is part of a word in this editor — the four lines should read:

```js
  if (p.action === 'comments')   return qpComments_(e);
  if (p.action === 'addcomment') return qpAddComment_(e);
  if (p.action === 'casehistory') return qpHistory_(e);
  if (p.action === 'replies')    return qpReplies_(e);
```

Nothing is replaced. Each wrapper in `QueryPalPatch.gs` section 14 checks who
is asking, then calls the original function that already does the work. The
scope is the same one `myQueries_` uses, so what a person can read and write on
a case now matches what their list shows them: the branch everything, a manager
their team, an agent their own book, a staff member whatever is assigned to
them. A client or company code cannot reach these at all — the portal has its
own scoped endpoints, and internal notes stay inside the branch.

### 26 — `normName_` is declared twice, and the wrong one wins

This one is why managers quietly see only their own cases.

`Code.gs` declares `normName_` twice. Line 1231 keeps spaces between names;
the v8.1 section near the bottom declares it again and strips every character
that is not a letter. The second declaration wins, because in JavaScript the
last one in a file is the one that runs. Every comparison that normalises both
sides still works — but three comparisons test against a literal **written
with a space**, and those can now never be true:

```js
if (normName_(name) === 'ricky rampersad') return 'branch';
if (mv.split('@')[0].replace(/\./g,' ') === normName_(name)) return 'manager';
```

`'Ricky Rampersad'` becomes `rickyrampersad`, which does not equal
`ricky rampersad`. So `roleFromHierarchy_` cannot grant the manager role by
name, and in `myQueries_` a manager whose row carries no email address gets an
empty team list and sees only their own cases — looking exactly like an agent
with no error anywhere.

Search for `[^a-z]` — one hit, this line:

```js
function normName_(s){ return String(s||'').toLowerCase().replace(/[^a-z]/g,''); }
```

Double-click `normName_` on **that** line and type `normNameTight_`.

Do not delete the line. Renaming it is enough — nothing calls that name, so the
line becomes dead and the line-1231 version takes over everywhere, which is
what every comparison in the file was written for. Renaming also avoids the
whole-block deletes that went wrong before.

Then run `qpAuditTrailScope()` from the editor. It prints one line per code —
role, how many cases that code can see, how many team keys it resolved — with
no client text in the output. A manager showing `1 key` and a case count equal
to their own book has not been matched to their team; the fix for that is their
email in the Email column of the Agent Codes tab, or their address as a value
in `AGENT_MANAGER`.

---

## URGENT — rotate the branch master codes

**Do this today, and do it before anything else on this page.**

Until 9 October 2026 the two branch master codes sat in plain text in
`index.html` (an offline sign-in bypass) and in `404.html` (a stale copy of
the whole app). Both pages are public. The backend honoured the codes
completely:

```
…/exec?action=agentauth&num=<code>   -> {"ok":true,"name":"Ricky Rampersad","role":"branch"}
…/exec?action=myqueries&code=<code>  -> all 99 cases, every client name and request
```

Anyone who opened View Source on querymypolicy.com could read the branch's
entire case log. The site was posted on Facebook that morning.

The pages are fixed. **That is only half of it** — the codes were published,
so they must be treated as known to strangers. Removing them from the page
does not un-publish them: they are in anyone's browser cache, in archive
crawls, and in the page anybody saved.

In `Code.gs`, find the sign-in map near line 79:

```js
  '260026':  ['Ricky Rampersad', 'ricky.rampersad@myguardiangroup.com', 'branch'],
  'RRB2026': ['Rampersad Branch', '', 'branch'],                    // shared branch master
```

Replace **both** codes with new ones, then redeploy (Deploy → Manage
deployments → pencil → New version):

```js
  '<new six digits>': ['Ricky Rampersad', 'ricky.rampersad@myguardiangroup.com', 'branch'],
  '<new word+digits>': ['Rampersad Branch', '', 'branch'],
```

Pick something not derived from the branch number or the year — `260026` is
the branch number and `RRB2026` the branch and year, so both were guessable
even without reading the page.

Then:

- **Tell the team the new code by WhatsApp or in person, never by email.**
- The shared `RRB2026`-style code is worth retiring rather than replacing. A
  code everyone knows is a code that ends up written down; the per-agent codes
  in the Agent Codes sheet already do this job and say who did what.
- Six test files under `tests/` still hold the old code and will fail after
  the rotation. They are not published — the `_redirects` catch-all swallows
  that folder — so this is tidying, not exposure.
- `tests/secrets.test.mjs` fails if a sign-in literal is ever published
  again. Run it before a deploy.

There is no sign the codes were used by anyone outside the branch — the log
shows 99 cases and no unexplained sign-ins — but that is not something the
system can prove either way, which is the reason to rotate rather than hope.
