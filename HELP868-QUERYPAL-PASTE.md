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
