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
