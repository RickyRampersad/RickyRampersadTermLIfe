# HELP 868: the WhatsApp assistant, wired to the tracker

Built 2 November 2026. The assistant lives in respond.io. It never reads a sheet, Salesforce or this repository. It makes two
HTTP calls to the tracker (`apps-script/Help868.gs`, beside `KPI.gs`), and the tracker decides what comes back.

## 1. Tracker (Branch Intelligence project)
1. Paste `KPI.gs` and the new `Help868.gs`. Manage deployments, pencil, **New version** (never New deployment).
2. Script properties: `HELP868_KEY` (a long random string, 16 characters or more; nothing answers without it) and
   `HELP868_OWNER` (who is e-mailed about an enquiry; blank means the Branch Manager).
3. Check: `<exec URL>?action=help868.ping` answers `on`, `agents` (the rows on the tab), `pendingReport` (the newest "Branch Pendings" tab was found), `pendingsChase` and `salesforce`. Any false tells you which piece is missing; no data is in the answer.
4. Make the tab **HELP868 Agents** with the header `Agent no. | Name | WhatsApp number | Active | Pendings`. **The tab is the pilot
   list.** Only a number on it gets pending-application status, and only about that agent's own cases. Put three or four agents
   on it first. `Pendings` = No keeps an agent on the list but off the status route.
5. "Pendings Chase" must exist (the tracker writes it every ten minutes on weekdays from the newest pending report).

## 2. What the calls return
| call | for | returns |
|---|---|---|
| `help868.code` (`key`, `phone`, `agentNo`) | an agent on the pilot tab | e-mails a 6-digit code to the address the Skill Bank holds for that agent number. The reply is the same words whether or not a code was sent. One code a minute. |
| `help868.verify` (`key`, `phone`, `agentNo`, `code`) | the same agent | signs this WhatsApp number in for 30 minutes. Five wrong tries or ten minutes voids the code. Switching the agent off on the tab ends the session. |
| `help868.pendings` (`key`, `phone`) | signed in only | the agent's own cases: policy last four digits, open tasks, overdue, due, who has it (first name), when last noted. |
| `help868.case` (`key`, `phone`, `policy`) | signed in only | one of the agent's policies, typed in full or by its last digits: days since submission, underwriting decision, each open requirement (code, name, status, who acts next), and the Pendings task. **No money, client name, note words, date of birth or other agent's case.** Staff notes and e-mails are not returned. |
| `help868.increases` (`key`, `phone`) | signed in only | the agent's increases whose Salesforce status is **Pending**: policy last four, submitted, days outstanding, requirement text, who supports it. No amounts. Premium Paying with no Date Settled is counted apart as records to tidy. |
| `help868.groups` (`key`, `phone`) | signed in only | the agent's Group Life, Group Health and Pension policy records (one per member, so records, not employers) by in force, pending, ended and unrecorded, and the Pending ones by last four digits and days since received. |
| `help868.enquiry` (`key`, `phone`, `category`, `summary`, `name`) | anyone | files a row on **HELP868 Enquiries**, e-mails the owner, returns a reference `H8-yymmdd-nnn`. Numbers, e-mails and links are stripped from the summary. The same words from the same number inside 12 minutes return the first reference. |

One number is limited to 40 calls an hour.

**Salesforce logging** is off until the Script property `HELP868_SF` = `on`. Then a case look-up is noted on the policy's open
Pendings task ("asked for an update on WhatsApp", nothing about the client), and an enquiry opens a Servicing task on the agent's
Contact when exactly one Contact matches. The summary and reference go to Salesforce; the full conversation stays in respond.io.

## 3. respond.io (AI agent "HELP 868 Assistant.")
Needs the AI agent's **HTTP request** action. I could not confirm your plan includes it: check Actions on the agent.
All five are GET `<exec URL>` with `key=<HELP868_KEY>` and `phone={{$contact.phone}}`:
- `action=help868.code`, data input `agentNo`.
- `action=help868.verify`, data inputs `agentNo`, `code`.
- `action=help868.pendings`, no data input.
- `action=help868.case`, data input `policy`.
- `action=help868.enquiry`, data inputs `category` (pending, payment, general, other), `summary`, `name`.
- Instruction lines to add: quote a reference **only** if the call returned one; never promise a time; say "counts and who has it, a team member explains why"; if `verified` is false, say a team member will help and file an enquiry.
- Fix the prompt order (the agent-or-client block sits inside the category list) and merge the Pendings pilot agent into this one.
- Keep the workflow limited to the `HELP868-PILOT` tag until the week of testing is done.

## 4. The branch app
The **HELP 868 on WhatsApp** tile (`rroperations/index.html`) opens `wa.me/18684357868`. It is shown to the branch manager only
(`to: 'm'`). Widen it to `'alsm'` the day the workflow answers more than the test number, so no agent taps it and gets silence.
Confirm 868-435-7868 is the right customer-facing number before widening.

Tests: `node tests/test-help868.js` (59 checks).
