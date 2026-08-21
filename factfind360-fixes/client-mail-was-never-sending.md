# The client emails were never sending

An agent reported it in the branch WhatsApp group: *"Client said she didn't
receive the FF correspondence yet."*

Two separate faults were doing this. The first was found and fixed weeks ago.
The second was underneath it, and the fix for the first could not have worked
while it was there.

## Fault one — the address was never found

A Specific Need Only case captures the client in section 1, so the address
lands in `adviceClientEmail`. The send read only `email` and `clientEmail`, so
for every limited-scope case it found nothing and returned early. Fixed by
`rrbClientEmail_`, which tries all four fields.

That fix was real, and it was not enough.

## Fault two — nothing was being sent at all

```js
var RRB_DRY_RUN = true;
var RRB_REDIRECT_MAIL_TO = 'rampersadricky@gmail.com';
```

Two test-harness settings, left on after testing. `rrbMail_` reads both: with
dry-run set it writes the message to the log and returns without sending
anything.

Everything routed through `rrbMail_` was going to the log:

- the client draft, sent when a fact find is submitted
- the notice raised when a client asks for a change
- the client progress reminders
- the manager chase and its escalation

## Why nobody noticed

The system has two mail paths, and only one of them was gated.

| Path | Used by | State during the outage |
|---|---|---|
| `MailApp.sendEmail` direct | manager review, agent copy, approval to agent, approval to client, case chase | **sending normally** |
| `rrbMail_` | client draft, change notice, progress reminders, manager reminders | **silently discarded** |

So mail was plainly arriving. Managers got their reviews, agents got their
copies, clients got their approvals. The only thing missing was the first
message a client ever receives — and the person best placed to notice was the
one person not on the distribution.

That is the shape of the bug worth remembering: **a partial outage on a system
with two paths reads as a working system.** The evidence that it was fine was
real mail in a real inbox; it just came down the other path.

## The check that would have caught it

None existed. `rrbSecurityCheck()` proved tokens were refused and accepted
correctly and said nothing about whether mail left the building.

It now ends with `rrbMailCheck_()`, which asserts three things and names the
consequence rather than printing a value:

```
5. dry run         -> false (live, correct)
6. redirect        -> (none) (real recipients, correct)
7. daily quota     -> 1438 remaining (ok)
```

The quota line is there because it is the same class of failure: Apps Script
drops mail silently once the daily quota is gone, and a branch that suddenly
stops hearing from clients would have no reason to suspect it.

## Turning it back on safely

The reminder loops are properly throttled — one chase per case per day, one
client nudge every few days, hard caps on both. But every throttle reads a
stamp written when a message was last *sent*, and during the dry-run period
nothing was ever sent, so no stamp was ever written.

The first live run would therefore have read every open case as
never-contacted and chased all of them at once: a 54-day-old case and one
submitted this morning, in the same burst, to real clients.

`rrbSuppressBacklog()` stamps every currently-open case as contacted today
without sending anything. Normal pacing resumes from that point and nothing is
backfilled. Run it once, immediately after going live.

## Note on the CC

`RRB_REDIRECT_MAIL_TO` also dropped the CC while it was set — one flag
silently changing both who receives a message and who is copied. With it
cleared, `RRB_ALWAYS_CC` applies again, so the branch manager address is copied
on client mail as originally intended.
