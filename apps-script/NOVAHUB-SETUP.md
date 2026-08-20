# NovaHub import — setup

Pulls your branch's feeds out of Guardian's NovaHub Agent Data API straight
into this spreadsheet, on a schedule, so the manager's book sits beside the
renewal pipeline instead of in a separate download.

| Feed | Endpoint | Lands on |
|---|---|---|
| Agent activities | `/Activities/GetManagerBranchActivities` | `Agent Activities` |
| Agent opportunities | `/Opportunities/GetManagerBranchOpportunities` | `Agent Opportunities` |

## Why not a sheet formula

`=IMPORTDATA()` and friends send a bare anonymous request — there is nowhere
to put a key or a token. NovaHub is authenticated, so the call has to be made
from Apps Script, where the credentials travel in the request headers.

## 1. Add the file in Apps Script

Open the spreadsheet → **Extensions → Apps Script** → **＋ → Script**, name it
`NovaHub`, and paste `apps-script/NovaHub.gs`.

It reuses `ss_()` and `BRAND` from `Code.gs`, so keep both in the same project.

## 2. Store the key and token — in Script Properties, never in the file

**Project Settings (⚙) → Script Properties → Add script property:**

| Property | Value |
|---|---|
| `NOVAHUB_KEY` | your company API key — sent as the Basic **username** |
| `NOVAHUB_TOKEN` | your company token — sent as the Basic **password** |

⚠️ Do **not** put either one in `NovaHub.gs`, in `CONFIG`, or in a cell. This
repository is served on the public website — anything committed here is
published. The staff key that once sat in `Code.gs` had to be burned for
exactly this reason.

Script Properties are visible only to editors of the script, and they survive
redeployments, so the credentials never have to be re-entered.

## 3. Add the menu (one line in `Code.gs`)

Already done in this repo — at the end of `onOpen`:

```js
try { if (typeof novaHubMenu_ === 'function') novaHubMenu_(SpreadsheetApp.getUi()).addToUi(); } catch (err) { Logger.log(err); }
```

Reload the spreadsheet and a **📊 NovaHub** menu appears.

## 4. How NovaHub wants the credentials — already answered

No guesswork needed: the service says so itself. An unauthenticated call to
the activities endpoint returns

```
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Basic realm="novahub.myguardiangroup.com"
Content-Type: application/json

{"Errors":["Basic Authentication required."],"StatusCode":401}
```

and `OPTIONS` on the same route returns `Allow: GET`. So:

- **Auth** — HTTP Basic. Your **key is the username**, your **token is the
  password**, sent as `Authorization: Basic base64(key:token)`.
- **Method** — plain `GET`.
- **Replies** — JSON, wrapped as `{ …, "Errors": […], "StatusCode": n }`.

Two useful consequences. The endpoint answered from the public internet, so
Apps Script on Google's servers can reach it — no VPN or IT allow-listing
needed. And because NovaHub can report a failure *inside* a `200` through that
`Errors` array, the script checks the envelope as well as the HTTP status, and
surfaces the message rather than writing an empty tab.

The script sends Basic by default, so **📊 NovaHub → 1. Test the connection**
should pass on the first try. If the pair was issued the other way round it
retries with token-as-username, then the other common header shapes, reports
what each answered, shows the fields in the first record, and offers to
remember whichever worked. That first authorised run is also what reveals the
real column names.

Google will ask you to authorise the script the first time it reaches out to
an external service. That is expected.

### If it is still refused

| What you see | What it usually means |
|---|---|
| `Basic Authentication required` | The header did not arrive — check both properties are actually saved in Script Properties, with no stray spaces. |
| 401 with a different message | The key/token pair is wrong or expired, or not entitled to the manager-branch scope. Your NovaHub contact can confirm. |
| 403 | Credentials are valid but this login is not a branch manager on the API's side. |
| 404 | The path is right but the method needs parameters — a branch code, a manager id, a date range. Fill them into `NOVA.PARAMS` in `NovaHub.gs`. |
| 200 with an `Errors` message | The call reached the service and it declined the request — the message names the reason. |

## 5. Import

**📊 NovaHub → 2. Import agent activities.** The tab is created if it does not
exist, cleared, and rewritten from the response.

Columns are taken from the API's own field names, so nothing is dropped
because it was unexpected: nested objects become dotted columns
(`client.name`), lists are joined with `·`, and dates — ISO strings or .NET
`/Date(…)/` ticks — are converted to real dates so they sort and chart.

## 6. Keep it current

**📊 NovaHub → 4. Install daily sync (7am)** adds a time trigger that refreshes
both feeds each morning before the branch starts work. **Sync status** shows
what is stored and when each feed last ran.

The import replaces the tab's contents each run, so build any analysis in a
*separate* tab that references `Agent Activities` — a pivot table, a QUERY, or
formulas — and it will follow the fresh data instead of being overwritten.

## Optional: date windows and branch filters

If the endpoint accepts a date range, set `NOVA.LOOKBACK_DAYS` in `NovaHub.gs`
and every run asks for that many days back. Anything else the method needs —
branch code, manager id — goes in `NOVA.PARAMS`, and is sent as a query string
on GET or a JSON body on POST. The script tries GET first and falls back to
POST automatically if the server answers `405 Method Not Allowed`.
