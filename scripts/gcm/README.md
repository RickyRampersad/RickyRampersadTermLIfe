# Group Client Management — Ricky Rampersad Branch (Branch 26000)

| | |
|---|---|
| Client door | https://rickyrampersadbranch.com/groupclientmanagement/client.html (the "Group Client Portal" tile on the home page) |
| Client pages | https://rickyrampersadbranch.com/groupclientmanagement/<slug>.html |
| Staff page | https://rickyrampersadbranch.com/groupclientmanagement/ (linked from the Staff Portal) |

Every Monday at 6:00 AM (Trinidad time) GitHub pulls Salesforce, rebuilds the staff
page, the client door and every client page, and commits them to `main`. GitHub Pages
publishes `main` as rickyrampersadbranch.com, so the commit is the release.
Every page is locked with a code: without the right code, nothing on it can be read.

**This site is on GitHub Pages, not Netlify.** Do not add rickyrampersadbranch.com to
Netlify and do not change its DNS: that would take every other page of the branch site
off the air, the letters' `/your-policy/` links included. Netlify serves factfind360.com
from another repository; the two never touch.

## What is in this repository

| Path | Purpose |
|---|---|
| `scripts/gcm/build.py` | Pulls Salesforce tasks and builds the pages |
| `scripts/gcm/templates/` | Staff page, client page and client door designs |
| `scripts/gcm/new_codes.py` | Generates staff and client access codes |
| `.github/workflows/group-client-management.yml` | The Monday 6:00 AM schedule, plus a manual "Run workflow" button |
| `groupclientmanagement/` | Built pages (written by the build; do not edit by hand) |

**Not in this repository, ever:** the group register (`GCM_CLIENTS`) and the codes
(`GCM_CODES`). The repository is public and its root is the website, so a file here is
readable by anyone. Both live as GitHub secrets.

## What a client and the staff see

- **A client** opens the door, types their code, and lands on their own page: every
  open item, who is handling it, its target date and what has been done; the service
  record for the year (completed, share on time, average days); a Correct / Needs a
  change / Not ours answer per item, a star rating and a comment. Send opens their own
  e-mail to the sales support inbox, copied to the branch manager.
- **Staff** sign in with their own code and see every group, most urgent first. The
  Send button stays locked until they tick that they have checked every item against
  Salesforce and the latest billing. The e-mail then opens in their Outlook with the
  client's link and code, blind-copied to sales support as the record of who sent it.

## What the build leaves out, and why

- **Another group's or person's task.** Salesforce `LIKE` finds a match word inside other
  words, so every task is checked again: it must sit on the group's own account, or the
  match word must start a word in its subject or record name, and a single match word
  must also end one. A name of several words may run on ("ACME & CO" finds
  "ACME & COMPANY").
- **A member's health.** An item naming a medical requirement, a claim, a diagnosis and
  similar stays on the staff page, marked "Not shown to the client", and is left off the
  client's page and its counts. Add patterns with `privateSubjectPatterns` in the register.
- **Logged e-mails and birthday wishes.** Salesforce logs every e-mail as a closed task
  ("Email: …"), and the birthday flow does the same. They close the moment they are
  logged, so counting them would show a client an on-time record the work does not have.
  In 2026 they were more than half of the groups' completed tasks.

## One-time setup

### 1. Salesforce connected app (gives the build its own read-only login)
1. Salesforce Setup > App Manager > New Connected App.
2. Name: `Group Client Management Build`. Contact email: support@rickyrampersadbranch.com.
3. Tick **Enable OAuth Settings**. Callback URL: `https://login.salesforce.com/services/oauth2/success`.
   Scope: **Manage user data via APIs (api)**.
4. Tick **Enable Client Credentials Flow**. Save, then wait about 10 minutes.
5. App Manager > the app > **Manage** > **Edit Policies** > Client Credentials Flow > **Run As**:
   choose a user who can read Tasks for all group accounts.
6. App Manager > the app > **View** > **Manage Consumer Details**: copy the Consumer Key and Consumer Secret.

### 2. The register and the codes
The register is JSON:

    {"branch": "...", "baseUrl": "https://rickyrampersadbranch.com/groupclientmanagement",
     "responseInbox": "...", "responseCc": "...",
     "excludeTypes": ["HR"], "excludeSubjectPatterns": ["..."], "privateSubjectPatterns": [],
     "clients": [{"name": "...", "slug": "abcd-0123456789", "match": ["..."], "accountIds": ["001..."],
                  "to": ["..."], "cc": ["..."], "greeting": "...", "primaryContactName": "...",
                  "enabled": true}]}

Keep it in a file outside the repository, then make the codes:

    python scripts/gcm/new_codes.py --clients /path/outside/register.json \
        --keep <slug>=<a code a client already holds> \
        "Ricky Rampersad" "Kamla Dookran" "Sasha Lalla-Jagassar" "Azariah Griffith" "Elizabeth Lee"

A new code is four letters of the group's name and twelve random characters. Keep the
output somewhere safe, never in this repository.

### 3. GitHub settings (Settings > Secrets and variables > Actions)
Secrets:
- `SF_DOMAIN` = the org's My Domain, e.g. `<name>.my.salesforce.com`
- `SF_CLIENT_ID` = Consumer Key from step 1
- `SF_CLIENT_SECRET` = Consumer Secret from step 1
- `GCM_CODES` = the full output from step 2
- `GCM_CLIENTS` = the register from step 2

Variables tab:
- `GCM_BASE_URL` = `https://rickyrampersadbranch.com/groupclientmanagement`

### 4. First run
GitHub > Actions > **Group Client Management build** > **Run workflow**.
When it finishes, open the staff page and sign in with your staff code.

## Weekly use
- Pages refresh by themselves every Monday at 6:00 AM. For a same-day refresh, use **Run workflow**.
- Staff open a group, check every item, tick the verification box, then press
  **Prepare email to client**.
- Client responses and star ratings arrive by e-mail at the sales support inbox.

## Adding or changing a group
Edit the register and save it again as the `GCM_CLIENTS` secret:
- `match`: words that appear in that group's Salesforce task subjects or record names
- `accountIds`: the group's Salesforce Account Id. Prefer it: it is exact.
- `to` / `cc` / `greeting`: who receives the client e-mail. A group with no `to` contact can be
  viewed by staff but cannot be sent.
- `enabled`: set to `false` to stop building a page for that group.

A new group also needs a code added to the `GCM_CODES` secret.

## Removing someone's access
Delete their line from `GCM_CODES` and run the workflow. Their code stops working on the
next build. Client codes work the same way. A copy of an older page stays in the
repository's public history, still locked with the old code, so a code that has leaked
should be replaced, not only removed.
