# HELP 868: the WhatsApp assistant, wired to the tracker

Built 2 November 2026. The assistant lives in respond.io. It never reads a sheet, Salesforce or this repository. It makes two
HTTP calls to the tracker (`apps-script/Help868.gs`, beside `KPI.gs`), and the tracker decides what comes back.

## 1. Tracker (Branch Intelligence project)
1. Paste `KPI.gs` and the new `Help868.gs`. Manage deployments, pencil, **New version** (never New deployment).
2. Script properties: `HELP868_KEY` (a long random string, 16 characters or more; nothing answers without it) and
   `HELP868_OWNER` (who is e-mailed about an enquiry; blank means the Branch Manager).
3. Check: `<exec URL>?action=help868.ping` answers `{"ok":true,"on":true,"agents":N}`.
4. Make the tab **HELP868 Agents** with the header `Agent no. | Name | WhatsApp number | Active | Pendings`. **The tab is the pilot
   list.** Only a number on it gets pending-application status, and only about that agent's own cases. Put three or four agents
   on it first. `Pendings` = No keeps an agent on the list but off the status route.
5. "Pendings Chase" must exist (the tracker writes it every ten minutes on weekdays from the newest pending report).

## 2. What the two calls return
| call | for | returns |
|---|---|---|
| `help868.pendings` (`key`, `phone`, `agentNo`) | a listed agent only | counts, overdue, no open task, and up to 12 cases: policy last four digits, open tasks, overdue, due date, who has it (first name), when it was last noted. **No note text, client name, money or full policy number.** |
| `help868.enquiry` (`key`, `phone`, `category`, `summary`, `name`) | anyone | files a row on **HELP868 Enquiries**, e-mails the owner, returns a reference `H8-yymmdd-nnn`. Numbers, e-mails and links are stripped from the summary. The same words from the same number inside 12 minutes return the first reference. |

A wrong agent number and an unknown number get the same reply. One number is limited to 20 calls an hour.

## 3. respond.io (AI agent "HELP 868 Assistant.")
Needs the AI agent's **HTTP request** action. I could not confirm your plan includes it: check Actions on the agent.
- Endpoint 1, GET `<exec URL>`: params `action=help868.pendings`, `key=<HELP868_KEY>`, `phone={{$contact.phone}}`, data input `agentNo`.
- Endpoint 2, GET `<exec URL>`: params `action=help868.enquiry`, `key=<HELP868_KEY>`, `phone={{$contact.phone}}`, data inputs `category` (pending, payment, general, other), `summary`, `name`.
- Instruction lines to add: quote a reference **only** if the call returned one; never promise a time; say "counts and who has it, a team member explains why"; if `verified` is false, say a team member will help and file an enquiry.
- Fix the prompt order (the agent-or-client block sits inside the category list) and merge the Pendings pilot agent into this one.
- Keep the workflow limited to the `HELP868-PILOT` tag until the week of testing is done.

## 4. The branch app
The **HELP 868 on WhatsApp** tile (`rroperations/index.html`) opens `wa.me/18684357868`. It is shown to the branch manager only
(`to: 'm'`). Widen it to `'alsm'` the day the workflow answers more than the test number, so no agent taps it and gets silence.
Confirm 868-435-7868 is the right customer-facing number before widening.

Tests: `node tests/test-help868.js` (23 checks).
