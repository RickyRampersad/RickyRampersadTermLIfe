# HELP 868: the WhatsApp assistant, wired to the Service Questionnaire

Built 2 November 2026, moved 3 November 2026 into the **Service Questionnaire** project (`apps-script/Help868.gs`, beside
`Service.gs`, `Transition.gs`, `ServiceSalesforce.gs` and `GroupClients.gs`), because that is where the Salesforce and Claude keys,
the Agent Skill Bank and the support@ mailbox already are. The tracker is not touched. The assistant lives in respond.io. It never
reads a sheet, Salesforce or this repository: it makes HTTP calls to the Service Questionnaire's `/exec` address and that project
decides what comes back.

## 1. Service Questionnaire project
1. Add the new file `Help868.gs` (File, then New, Script). For `Service.gs`, **do not paste the whole file**: add three lines by hand,
   which leaves `TEAM_CODE` and everything else as it is. In `doGet`, directly under the `gcm.` line, add:
   `if (/^help868\./.test(String(p.action || '')) && typeof help868Route_ === 'function') { try { return json_(help868Route_(p)); } catch (err) { return json_({ ok: false, error: 'HELP 868 could not answer.' }); } }`
   and in `doPost`, directly under its `gcm.` line, the same with `body` in place of `p`. (The repository copy of `Service.gs` already has them.)
   If you paste the whole file instead, put the branch code back into `TEAM_CODE` before the next step, or every wall and board locks out.
2. Manage deployments, pencil, **New version** (never New deployment, which would change the address every front end holds).
3. Script properties: `HELP868_KEY` (a long random string, 16 characters or more; nothing answers without it), `HELP868_OWNER`
   (who is e-mailed about an enquiry; blank means the first `TRANSITION.CC` address) and, later, `HELP868_SF` = `on`.
   Salesforce (`SF_*`), `ANTHROPIC_API_KEY` and the Microsoft 365 properties are already here.
4. Check: `<exec URL>?action=help868.ping` answers `on`, `agents` (rows on the tab), `salesforceReady`, `claudeReady`, `mailReady`
   (support@ can send the code), `pendingReport` (the newest "Branch Pendings" tab was found in the Branch Portfolio),
   `pendingsChase` and `salesforce` (HELP868_SF is on). Only true or false, never a key. Any false says which piece is missing.
5. Make the tab **HELP868 Agents** in the Service Questionnaire sheet, header `Agent no. | Name | WhatsApp number | Active | Pendings`.
   **The tab is the pilot list.** Only a number on it can get anything about a case. `Pendings` = No keeps an agent on the list but
   off the case routes. For the first test put only the branch manager's row on it.
6. "Pendings Chase" is rebuilt every ten minutes by the tracker from the newest pending report; it must exist in the Branch Portfolio.

## 2. What the calls return
| call | for | returns |
|---|---|---|
| `help868.code` (`key`, `phone`, `agentNo`) | an agent on the pilot tab | sends a 6-digit code from support@ to the e-mail the Agent Skill Bank holds for that agent number. The reply is the same words whether or not a code was sent. One a minute. |
| `help868.verify` (`key`, `phone`, `agentNo`, `code`) | the same agent | signs this WhatsApp number in for 30 minutes. Five wrong tries or ten minutes voids the code. Switching the agent off on the tab ends the session. |
| `help868.pendings` (`key`, `phone`) | signed in only | the agent's own cases: policy last four digits, open tasks, overdue, due, who has it (first name), when last noted. |
| `help868.case` (`key`, `phone`, `policy`) | signed in only | one of the agent's policies, in full or by last digits: days since submission, decision, each open requirement (code, name, status, who acts next), the Pendings task, and `stall`: what is holding it up, chosen from fixed reasons and next steps after reading the task's Chatter notes and support@ e-mails that name the policy. **No money, client name, note or e-mail wording, date of birth or other agent's case.** |
| `help868.increases` (`key`, `phone`) | signed in only | the agent's increases whose Salesforce status says **Pending**, and nothing else. No amounts. |
| `help868.groups` (`key`, `phone`) | signed in only | the agent's Group Life, Group Health and Pension policy records whose status says **Pending**, and nothing else: a count by line, then each by last four digits and days since received. Records, not employers. |
| `help868.enquiry` (`key`, `phone`, `category`, `summary`, `name`) | anyone | files a row on **HELP868 Enquiries**, e-mails the owner, returns a reference `H8-yymmdd-nnn`. Numbers, e-mails and links are stripped from the summary. The same words from the same number inside 12 minutes return the first reference. |

One number is limited to 40 calls an hour. **Salesforce logging** is off until `HELP868_SF` = `on`: then a case look-up is noted on
the policy's open Pendings task and an enquiry opens a Servicing task on the agent's Contact. Summary and reference only; the full
conversation stays in respond.io.

## 3. respond.io (the test copy first)
Needs the AI agent's **HTTP request** action (not confirmed for your plan). The seven calls are all GET on the Service
Questionnaire `/exec` with `key=<HELP868_KEY>` and `phone={{$contact.phone}}`; the data inputs are `agentNo`, `code`, `policy`,
`category`, `summary` and `name`. The agent "HELP 868 — Phase 2 Test" carries the agent-number-and-code instructions and is switched
off. Switch it on only for the branch manager's own contact. Keep the live workflow limited to the `HELP868-PILOT` tag.

## 4. The branch app
The **HELP 868 on WhatsApp** tile (`rroperations/index.html`) opens `wa.me/18684357868`. It is shown to the branch manager only
(`to: 'm'`). Widen it to `'alsm'` the day the workflow answers more than the test number. Confirm 868-435-7868 is the
customer-facing number first.

Tests: `node tests/test-help868.js` (69 checks).

## Why this cannot disturb the existing scripts
- The only change to a live file is those three lines. They act only on actions starting `help868.`, are guarded by `typeof`, and sit in
  a try/catch, so with `Help868.gs` missing or `HELP868_KEY` unset they do nothing.
- `Help868.gs` has 58 top-level names, all starting `help868`/`H868`; none matches a name in any other file (checked), so nothing is
  redefined and nothing changes meaning.
- No trigger is added or changed. No new tab is made except "HELP868 Enquiries" on the first enquiry, and no existing tab is touched.
- The enquiry route takes no script lock, so it neither waits on the letter batches nor holds anything up for them.
