# Branch Intelligence — setup and what it actually does

Two pieces, the same shape as the KPI tracker:

| Piece | Where | What it does |
|---|---|---|
| `intelligence/index.html` | served with the rest of the site, at `/intelligence/` | sign-in, the **Today** list, and the ten screens behind it |
| `intelligence/manual/index.html` | `/intelligence/manual/` | the manual everyone reads — plain language, no setup in it |
| `apps-script/Intelligence.gs` | bound to the branch workbook | reads the tabs, computes everything, checks access codes, sends the digests |

**This file is for whoever installs it.** Staff and agents get
`/intelligence/manual/` instead — same system, none of the deployment.

The workbook is `1T1SG3mgs5QV5LuF3JTpmn1zFldhGjOQNoe0YCMhWxjs`. Five questions
get asked of it every week and none of them could be answered from it directly:

1. Which premiums are actually going to lapse, and whose are they?
2. What is stuck in pending business, and what requirement is stopping it?
3. **Who is chasing it — and which cases has nobody ever chased?**
4. Which policies mature soon — pensions and life, separately?
5. Which term benefits and conversion rights expire before anybody notices?

### It reads eight tabs, and only eight

| What it needs | The branch calls it | The columns it finds it by |
|---|---|---|
| Premium dues | `Branch Portfolio` | `Agent`, `Client Number`, `Premium`, `Status Description` |
| In-force book | `Export` | `Policy Id`, `Policy Maturity Date`, `Plan`, `Fund Value` |
| Pending business | `Requirement Management` | `Policy`, `DecisionType`, `ReqtdaysLapsed` |
| Requirements | `URPPBIEX - Reqt` | `insured_requirement_id`, `requirement_code`, `policy_number` |
| Tasks (the chase log) | `SFTASK MGT` | `Subject`, `Task Type`, `Days O/S` |
| Settled production | `Branch Settlement Exp PBI Production` | `API_AMT`, `COUNT`, `YEAR`, `MONTH` |
| Underwriting decisions | `RR_UWPRO_MAGNUM` | `overall_decision_code`, `policy_number` |
| Access | `Agent Codes`, `App Users` | `Email`, `Name`, `Role` + a code or password column |

The middle column is what those tabs happen to be called today. Nothing reads
the names — they are here so a person can find the tab, not so the script can.

Two tabs carry those settlement columns — the current one and an older
`Settled` that stops at July. The search breaks the tie on row count, so it
picks the fuller one on its own.

**Everything else in the workbook is ignored, and deleting it is safe.** Tabs
are found by the columns they carry, not by their names or their positions, so
removing a tab the app does not read changes nothing — and removing the empty
duplicates actually makes the search more reliable, because the tie-break
between two qualifying tabs goes away.

If a tab the app *does* need is ever removed or renamed past recognition, the
screen for that domain says so plainly rather than showing zero.

---

## 1. What the review found

The tool this replaces worked, and three things about it needed fixing before
anything was added.

### There was no sign-in

The old dashboard was a single HTML file behind an unguessable URL and a
`noindex` tag. Anyone with the link got 20,392 client records — names, phone
numbers, e-mail addresses, home addresses, premiums and policy numbers. A link
pasted into a WhatsApp group is a link that has left the branch.

### The client book was baked into the file

The file carried four `<script type="application/octet-stream">` payloads —
about 2 MB of gzipped, base64-encoded client data, including the whole dues
extract. Compression is not protection; it decodes in three lines of script.

**That file must never be committed to this repository.** Every file on `main`
is served publicly at rickyrampersadbranch.com. The README says client data has
already had to be purged from this history twice.

The new app carries no data at all. Everything on screen arrives from Apps
Script after a sign-in, narrowed to what the person signing in may see, and is
gone on refresh.

### `/sheet.csv` needs the workbook world-readable

The old proxy required the workbook to be shared *Anyone with the link —
Viewer*. That share applies to the **whole workbook**, not the one tab the
proxy names: 46,000 client addresses, 9,900 client records with dates of birth,
and the Access tab with everybody's sign-in code in plain text. The workbook ID
sits in `netlify.toml`, which is in the repository.

Apps Script reads the workbook with the *owner's* permission, so once the app
is live the workbook can go back to being private. Do that.

### Access codes

Run `intelSelfTest()` and it reports how many codes are weak. Several are a
single digit. `intelIssueCodes()` replaces every weak one with a ten-character
code and prints the list to hand out; codes that are already strong are left
alone, so nobody gets re-issued twice.

---

## 2. Put the script in the workbook

1. Open the branch workbook → **Extensions → Apps Script**.
2. Add a file called `Intelligence.gs` and paste in everything from
   `apps-script/Intelligence.gs`.
3. **Project Settings → Time zone → `(GMT-04:00) Atlantic Time`.** Every
   trigger and every date reads from this. Getting it wrong moves the 2 a.m.
   rebuild and can push a maturity onto the wrong month.
4. Run **`intelSelfTest`** from the function dropdown. Authorise when Google
   asks — it is your own script in your own workbook.

The self test prints which tabs it resolved, which access lists it found, how
weak the codes are, and — the important one — **whether this project already
has a `doGet`/`doPost`**.

### If the project already has a router

A script project may declare `doGet` and `doPost` exactly once, and a second
declaration silently wins. If `BranchEngine.gs` is in the same project:

- **Delete** the `doGet`/`doPost` block at the very bottom of `Intelligence.gs`
  (it is marked, and it is the last thing in the file).
- Add one line inside the existing `doPost`, straight after it parses the body:

  ```js
  var hit = intelRoute_(b); if (hit) return hit;
  ```

`intelRoute_` returns `null` for anything that is not an `intel.*` action, so
the rest of that function keeps working exactly as it did.

If the self test says no other router was found, leave the block where it is.

---

## 3. Deploy and point the site at it

**Deploy → New deployment → Web app**, Execute as **Me**, Who has access
**Anyone**. Copy the `/exec` URL.

The app lives at `/intelligence/`, alongside `/kpi/`, `/claims/` and
`/renewal/`. The Branch Intelligence landing page currently offers a *Legacy
dashboard (analysis tools)* button pointing at `/legacy.html` — repoint that at
`/intelligence/`, and **take `legacy.html` down**. It carries about 2 MB of
embedded client data and no sign-in; see section 1.

Two places take it:

- `intelligence/index.html`, the `API` constant near the top of the script.
- Script Properties, `INTEL_APP_URL` = `https://rickyrampersadbranch.com/intelligence/`
  — the address the digest e-mails link back to.

Then run **`intelSetup`** once. It creates the working tabs, does the first
rebuild, installs the four triggers and prints the self test.

Every code change needs **Deploy → Manage deployments → Edit → New version**.
Saving the file is not deploying it.

### Script Properties worth setting

| Property | What it does |
|---|---|
| `INTEL_MANAGER_EMAIL` | who the Monday digest goes to. Commas for several. Unset, it goes to everyone with a manager-ish role on an access list. |
| `INTEL_APP_URL` | the address the e-mails link to. |
| `INTEL_TEST_TO` | **test mode.** Every message goes here instead, subject-tagged `[TEST]` and banner-marked with who it was really for. Agents and clients cannot receive test traffic while this is set. |
| `INTEL_TAB_DUES` etc. | point a domain at a named tab if the column search ever picks the wrong one. Keys: `DUES`, `INFORCE`, `PENDING`, `REQS`, `TASKS`, `ACCESS`. |

---

## 3a. The one screen that does not read the cache

**Find a client** goes to the workbook live, and it is the only part that does.

The cache holds lists — overdue premiums, maturities, leads. A client's
policies mostly are not on any of them: a premium paid on time is on no list at
all. So the lookup reads the dues book directly, then enriches from the
in-force book, pending business, requirements and the action log. It is a
little slower than the other screens and the answer is current rather than last
night's, which for a phone call is the right trade.

It searches on a name, a policy number, a client number, a phone number or an
e-mail — whatever the caller happens to give. Several matches return a
shortlist; one match returns the whole picture.

**Searching by policy returns the client, not the policy.** Somebody reading a
number off a letter still wants their other eighteen policies, so the lookup
widens from the row that matched to every row that client has.

Scoping is the same as everywhere else and applies to the shortlist as well as
the record: an agent finds their own clients. A client whose policies all sit
on another book does not appear at all — being told a client exists but is
withheld is itself the disclosure. Where a client is shared across two agents,
the agent sees their own policies and a **count** of the others, so nobody is
misled into thinking they have the whole picture.

## 3b. How old is each source

The extracts do not refresh together, and until this was measured nobody could
see that. On the day it was built the requirements tab was **one day** old and
the Salesforce task export was **sixty-one** — so "10 pending cases being
chased" was being read off two-month-old data with nothing on screen saying so.

Every rebuild now measures each source and puts the result at the top of
**Data health**, with anything over 14 days also raised as an issue and listed
in the Monday digest.

**What it actually measures.** Not when the tab was refreshed — a spreadsheet
does not record that per tab — but **the newest business event in it**, read
from a column that only ever looks backwards: an issue date, a dispatch date,
the date a requirement was raised. A tab refreshed this morning whose branch
genuinely wrote nothing for a fortnight reads as a fortnight old. That is the
honest limit: it says *nothing here has happened in N days*, which is either a
stale extract or a quiet fortnight, and either is worth knowing before the
figure is quoted.

Forward-looking columns are excluded deliberately. `Paid To Date` is what cover
is paid up **to** — its maximum sits in 2028 and it says nothing about
recency. Using it was the first thing tried and it reported every source as
fresh.

## 3c. Five levels, and the day each of them gets

The **Unit column on the access list is the org chart**, and nothing was
reading it. Every one of the 29 agents has it filled in:

| Unit | People | Led by |
|---|---|---|
| Ricky Rampersad | 13 | Branch Manager |
| Gary Sookdeo | 8 | Unit Manager |
| Kerwyn Ramroach | 6 | Assistant Branch Manager |
| Akaash Kalladeen | 6 | Unit Manager |
| SalesSupport | 3 | the pending desk |
| Branch Managers Assistant | 1 | |

A unit manager runs a team, not the branch. Before this they were handed every
other unit's arrears and every other unit's clients — both more than they need
and more than they should have. The map is rebuilt nightly, so moving an agent
between units is one cell in the sheet and nothing else.

| Role on the access list | Resolves to | Sees | Their day |
|---|---|---|---|
| Branch Manager, Assistant Branch Manager, manager | `branch` | everything | what moved · stale sources · serious data issues · worst arrears · branch leads |
| **Unit Manager**, Team Manager | `unit` | **their unit only** | their unit's arrears past 90 days · who in the team is carrying a heavy share · unit pendings nobody chased · unit leads · unit pensions maturing |
| **Sales Support Manager**, BMA, Managers Assistant | `staff-lead` | the branch | never-chased pending · chases gone quiet · **how the desk's work is spread** · money held · old requirements |
| Staff, Sales Support | `staff` | the branch | never-chased pending · money held · chases closed with the case open · old requirements |
| Agent, advisor, anything else | `agent` | their own book | lapses · arrears past 90 days · suspense · cross-sell ready · pensions maturing |

Order matters in the test, and a loose regex gets all of it wrong: "Assistant
Branch **Manager**" contains both *assistant* and *manager*, and "**Unit**
Manager" contains *manager*. Each pattern is anchored and the most specific
runs first.

An agent's own totals are one person's. A unit manager's are the **sum** of
their team's, which is why Akaash's 294 chase-list policies reconcile exactly
to the six members of his unit added together.

### One cell to set before Kamla gets the right view

The sheet currently records **Kamla Dookran** and **Sasha Lalla Jagassar**
identically — both `Staff`, both `SalesSupport`. Nothing in the workbook says
Kamla supervises the desk, so she gets the same screen as the people she
manages.

To fix it, change Kamla's **Role** cell on `Agent Codes` to **`Sales Support
Manager`**. The app also accepts `BMA`, `Staff Manager` or `Managers
Assistant`. That one cell gives her the two things a supervisor needs and a
staff member does not: **chases that have gone quiet** and **how the desk's
work is spread**.

The same applies to anyone else whose real job the sheet does not record. The
Role column is the only place the app can learn it.

### The digests follow the same rule

The digests follow the same rule — staff and managers are skipped by the agent,
cross-sell and horizon mails rather than sent an empty list. That alone stopped
ten pointless e-mails a day.

### Today

`Today` is the landing screen and the answer to "ten screens is too many". It is
a ranked list of jobs — a count, a reason it is urgent now rather than later,
and a button onto the screen holding it — with the first job already loaded
underneath so the common case needs no navigation. It is computed in the browser
from data already on the page, so it costs nothing to serve and cannot disagree
with the screen it points at.

Nothing is hidden by role. Every screen stays one click away; only the order and
the emphasis change.

## 3e. Production — the only screen about something going right

Every other screen is arrears, lapses, stuck cases and requirements nobody
chased. An agent could work in this app all year and never see a number that
went their way. **Settled** is the other half: what actually made it onto the
books, scoped like everything else — an agent's own, a unit manager's team,
the branch.

Three things about that extract decide whether the figures come out right, and
all three were found the hard way:

**COUNT is a flag, not a quantity.** 1 on the base coverage, 0 on each rider
attached to it, −1 on a reversal. Applications are the **sum** of the column,
so August is 126 rows and 70 applications. Counting rows overstates it by
four fifths.

**The tab totals itself.** One row reads `EFFECTIVE_DT` = "Total" with COUNT
742 and no policy, followed by a filter caption. Including it doubles the year.
It is dropped, and the sum of what remains is checked back against it — 742
either way, and the API agrees to the cent. That check is shown on the screen,
because a total that reconciles against the source is worth more than one that
merely looks plausible.

**`EFFECTIVE_DT` is day-first.** It writes `22/05/2026`. The task log writes
`10/17/2025`, which can only be month-first. So the date parser now reads
whichever component is impossible as a month and only falls back to a hint when
both are under thirteen. Before that, month 22 rolled the year forward and
settlement dates came out in **2028**, sorting to the top of "latest settled".

### One habit this screen depends on

Agent codes are folded — `A00427` and `U00427` are one person, four agents in
this extract appear under both, and grouping on the raw code split Varun
Seegolam's August into TT$296,745 and TT$65,393 when he had written
TT$362,138.

## 3f. First time — why half the work exists

The pending desk, the 1,425 open requirements and everything the desk chases
all begin in the same place: **a case that did not go through first time**.
Only about a third of what the branch submits is accepted as it stands.

`RR_UWPRO_MAGNUM` holds 3,438 decisions in five columns, with no date and no
agent. Both come from the dues book, which the policy number joins at **99%**.

| Decision | 2026 share |
|---|---|
| Referred | 46% |
| Standard — accepted as submitted | **36%** |
| Additional Information | 11% |
| Terms Offered | 6% |

**Rates are the current year's, deliberately.** A decision from three years ago
says nothing about how somebody prepares a case today, and the two views
genuinely disagree — one agent sits at 33% across four years and 8% across this
one. The four-year figure is kept beside it, labelled for comparison only.

**The direction is wrong.** Straight-through ran 39%, 39%, 42% and is 36% so
far in 2026, with referrals up from 43% to 46%. The backlog is being fed faster
this year than last.

### Before treating a low rate as a verdict

The obvious explanation is that some agents write bigger, more complex cases.
It does not hold: the correlation between an agent's straight-through rate and
their median sum assured is **−0.28**. Five agents all write a median case of
TT$1,000,000 with rates from 7% to 53%.

What the screen cannot see is **client age and health**, which genuinely do
drive referrals. So the median case size sits in the table beside every rate,
and the number is a question to ask an agent rather than a judgement on them.
An agent below ten decisions in the year is not shown at all — below that a
rate is noise.

## 3g. The 45-day wall

`/intelligence/wall/` — **one screen**, not a slideshow, about premiums crossing
the 45-day line. Same design system as `/board/` and the benefits wall.

Forty-five days is the line worth watching. Past the grace period, so the policy
is genuinely in trouble; early enough that a phone call still fixes it.

Everything is on at once: the count and the premium behind it, the wave still
ahead, tenure, how they pay, the units, the agents, and the survey. **Click any
bar and the whole wall holds to it** — click Bankers Order and every other panel
re-reads for those 18 policies; `Esc` clears it; `F` is full screen.

It is one screen rather than seven slides because the seven-slide version put
"which unit is worst on bank orders" seven slides away from the question, and
nobody at a wall waits ninety seconds for a panel to come round.

### Clicking into it never touches a row

Ship the 41 policies as rows and a screen in a public room can be filtered down
to a single line — agent, tenure, premium — which for a cohort this small is a
client in all but name. So the wall holds **no rows at all**. Every filtered
view is a cross-tab the server computed: eighteen small aggregate objects, one
per unit, band and billing method, each already broken down by the other
dimensions. Clicking re-renders from those.

### It has no sign-in, so it must not carry anything worth signing in for

A wall screen cannot sign itself in, and a token written into a page served from
a **public repository** is a token anyone can read. So `intel.wall` takes **no
token**, and returns **only aggregates** — counts, money, bands, and the names
of our own agents and units. Never a client name, policy number or phone number.

**That is the rule to keep if you extend this.** Before adding a field to
`iBuildWall45_`, ask whether it could identify a client. If it could, it belongs
behind the app's sign-in instead. The same logic covers the room the screen
hangs in, where clients walk past it.

### Arrears come from Paid To Date, not the Days column

This decides whether the wall is right or a week and a half wrong. The tab's own
`Days` column is **frozen at the moment the extract was cut**. When this was
built the extract was ten days old, so the policies genuinely at 45 days that
morning read **35** in the sheet, and the twelve rows showing 45 were at 55.

`Paid To Date` is a fact about the policy rather than about the export, so
`today − Paid To Date` stays right however stale the tab is. What staleness
still costs is the **set** of policies — a premium paid since the cut is not in
the file — so every count is an **upper bound** and the wall says so. `asOf` is
derived by taking `Paid To Date + Days` across the book and using the date
thousands of rows agree on, rather than the newest date present, which is only
a floor.

### Narration

`audio/build-voice.sh` renders ten lines in the branch voice — Andrew at −3%,
the same as the films — and `audio/embed-audio.py` folds them in as data URIs.
They **must** be inline: the wall shows in an iframe and a linked MP3 is silent
there. Until they are built the Narrate button stays disabled and says why.

Both scripts have to run on a machine with direct network. `edge-tts` talks to
the speech endpoint over a WebSocket, which the sandboxed session that wrote
this cannot open.

### Pointing it at live data

Paste the `/exec` URL into `WALL45_URL` at the top of `intelligence/wall/index.html`.
It refreshes every 30 minutes and falls back to the committed snapshot if the
feed is unreachable, so the screen is never blank. The header badge reads `live`
or `snapshot`, so nobody quotes a stale figure believing it is current.

### Taking an agent out of the branch view

Set `INTEL_EXCLUDE_AGENTS` to a comma-separated list of names **as the dues book
writes them** — matching is on the same normalised key used everywhere, so
capitals and punctuation do not matter.

```
INTEL_EXCLUDE_AGENTS = Aleema Mohammed-Ali, Javid Ali
```

**Excluding an agent does not settle their premiums.** On the current book those
two carry **420 overdue policies and TT$360,782** between them, across 268
clients. Taking them out removes that from every screen and every count — the
money is still owed, and now nobody is looking at it. So an exclusion is a
decision to hand that book to somebody, not a way to make it disappear.

Because that is easy to forget three months later, nothing about it is silent:
the wall's footer names how many agents are excluded and exactly what they took
with them, and the client survey skips their clients rather than sending a
letter signed by somebody who has left.

## 3h. The client survey

One letter per client on the 45-day line, asking for a single click, copying the
agent, the support desk and the unit manager.

### It is not a collections letter, and that is deliberate

Thirty-four of the forty-one were on a standing instruction that failed. Opening
with money owed treats a broken bank mandate like a refusal to pay, and that is
how it reads to somebody who has held cover for seven years. So the letter opens
with the years, mentions the collection as a piece of admin we noticed **on
their behalf**, and asks one question about the service. The premium usually
fixes itself once somebody rings the bank. The goodwill does not come back if
the first contact in seven years was a demand.

### Six letters, by how long they have held cover

| Band | Letter | Opens with |
|---|---|---|
| Under 1 year | `first-year` | the first year tells us whether we explained things properly |
| 1–2 years | `settling` | long enough that we should be getting this right |
| 2–5 years | `established` | a decision you have quietly renewed every month |
| 5–10 years | `longstanding` | premiums went out without you having to think about it |
| 10–20 years | `decade-plus` | most things do not last that long |
| 20 years + | `lifetime` | you were a client before most of us arrived |

Each merges the client's actual tenure, issue month, agent, and **how they pay**
in the client's own terms — "a standing order from your bank", "a deduction from
your salary". One letter per client, not per policy: somebody holding four gets
one note about the longest-standing of them.

### One click

Five numbered links, nothing else. The rating lands, and only then does the
thank-you page ask the optional second question — have you heard from your agent
this year. Progressive, because a form in an e-mail gets no responses at all.

### It is built so that following it carelessly cannot hurt

An insurance e-mail saying a payment failed is exactly the shape a phishing mail
takes. So this one asks for nothing a forged copy could use: no password field,
no payment link, no attachment, no request for a number the client already gave
us. The landing page shows **nothing about the client** — a leaked link tells
the finder that somebody is a client of this branch and no more. The letter says
in plain words that we will never ask for a password or a card number by e-mail.

Set `INTEL_BRANCH_PHONE` and the letter tells clients where to ring instead.

### Sending to clients is off, and stays off until somebody types a sentence

`iSend_` routes staff mail to `INTEL_TEST_TO`. That is the right guard for
digests and the **wrong** one here: the day somebody clears it to let the agent
digests go live, client mail would start flowing too. So client mail has its own
switch, unrelated to the internal one:

```
INTEL_SURVEY_LIVE = send to clients
```

Exactly that phrase. Anything else — unset, `yes`, `true`, `1` — and the run is
a rehearsal: it builds every letter, writes every row, and delivers to
`INTEL_TEST_TO`, or to nobody at all if that is unset too, while still reporting
what it would have done.

| Function | What it does |
|---|---|
| `intelSurveyPreview()` | mails **you** one real letter per tenure band, rendered from live data. Nothing reaches a client. **Run this first.** |
| `intelSurveySend()` | the run. Obeys the switch above. Stops outright above 60 clients — that means a billing cohort has landed, not a normal day |

Also excluded: anyone with no usable address, anyone surveyed in the last 120
days, and any policy under 90 days old — a brand-new client whose first
collection failed needs a call from their agent, not a letter about how long
they have been with us.

### After they answer — the thank-you and getting back to them

A survey that collects a complaint and does nothing with it is worse than no
survey. `intelSurveyFollowUp()` runs at 09:00 daily and closes that gap.

**Everyone who answers gets a thank-you the next morning**, so they know it
arrived. A 4 or 5 with nothing else flagged gets a plain thank-you and no
promise — telling a contented client somebody will ring is how a good survey
becomes a nuisance.

**Two answers open a follow-up:**

| Trigger | Why |
|---|---|
| A rating of **3 or less** | they are telling you plainly |
| **"No"** to hearing from their agent | a servicing gap, whatever the rating |

Those clients get a different thank-you that says **somebody from the branch
will call within two working days — and not their own agent, one of the
managers**. That is a promise the branch has now made in writing, so the
follow-up carries an owner (the unit manager, never the agent being rated), a
due date, and it stays on the wall until closed.

The desk and the manager get an alert the same day, listing what was said, the
agent and the unit — **no client names**, just a reference; the app looks the
client up behind the sign-in.

```
intelSurveyOpen()                              what is still open, oldest first
intelSurveyClose("<ref>", "your name", "what you did")
```

**Never run this without working the list.** An unkept written promise is worse
than the silence it replaced, which is exactly why overdue follow-ups are shown
in the warning colour on the wall rather than quietly counted.

The thank-you wording sits under the same approval fingerprint as the survey
itself, so a reviewer who clears the letter has also cleared the reply.

### What the wall shows

Counts and rates: sent, clicked, response rate, average rating, the 1–5
distribution, and the heard-from-your-agent split. **No comment text and no
client** — a comment is one person's words about a named colleague and belongs
in the app behind the sign-in, not on a screen in a room clients walk through.

Before anything is sent, the panel shows what *would* go: how many clients are
ready, how they split across the six letters, and how many are on the line with
no usable address. Today that is **26 ready, 13 unreachable**.

## 4. How it is put together

A nightly trigger reads every source tab once, computes all five domains, and
writes the result to a hidden `_Intel Cache` tab as JSON. The web app only ever
reads the cache.

That indirection is not decoration. The requirements extract alone is 66,000
rows; recomputing it inside a page load times out. The rebuild takes a couple
of seconds against the whole workbook and a sign-in is instant.

The rebuild also writes five ordinary tabs — `Watchlist — Dues`, `— Pending`,
`— Requirements`, `— Maturities`, `— Expiry` — carrying exactly the figures the
app shows. Anyone who would rather sort in Sheets can, without a sign-in.
**They are rebuilt from scratch every night, so nothing typed into them
survives.** Decisions go in `Intel Actions`, which is never overwritten.

### Tabs are found by their columns, not their names

The branch renames tabs. The KPI tracker learned that expensively. Every lookup
here searches for the columns a tab carries, and where two tabs qualify the
fuller one wins — the workbook keeps empty duplicates of several extracts, and
reading one of those reports "nothing outstanding".

Header cells are trimmed before matching. The Access tab's first header is
literally `"Email "` with a trailing space, and an untrimmed lookup misses it,
which locks out everyone on that tab.

### Who sees what

There are **two** access-looking tabs — one with an *Access Code* column, one
with a *Password* column — and the branch uses both. Sign-in searches every
list and accepts either column, so nobody is locked out by which tab they
happen to be on. People sign in with their Guardian e-mail, their agent number,
or the name beside it.

The Role column decides. Manager, admin, support, assistant, BMA and branch see
the whole branch; everyone else sees their own book.

**The filtering happens on the server, before anything is serialised.** An
agent's response contains their rows and nobody else's — including every
derived figure. Their ageing bands, their suspense, their requirement ages are
recomputed from their own rows, not carried over from the branch. Hiding rows
in the browser is not hiding them.

Agent names are matched loosely, because the extracts disagree with each other:
`Meera Persad-Khan` in the dues tab, `MEERA PERSAD KHAN` in the in-force book,
and `GARY SOOKDEO INSURANCE SOLUTIONS LTD` against `Gary Sookdeo` for the same
person. Surname plus first initial is the test.

### Some agents are a company, and no name test finds them

Three of them, and they are the branch's three most senior people:

| Code | In the in-force book as | Is |
|---|---|---|
| `A00427` | ADVANCED INVESTMENTS MANAGEMENT LIMITED | Ricky Rampersad |
| `A01363` | ARCHITECTS FOR INSURANCE & FINANCIAL SERVICES LTD | Kerwyn Ramroach |
| `A06869` | EXPERT ADVISORS COMPANY LTD | Akaash Kalladeen |

No amount of cleverness gets from "Ricky Rampersad" to "Advanced Investments
Management Limited". Before this was handled, each of the three saw their dues
book — which is filed under their own name — and **none of their in-force
book**: no maturities, no expiring cover, no cross-sell leads, and a fund-held
figure of zero against a real TT$3.5m. Their monthly e-mails went out empty.

The agent code joins them, and the workbook holds both halves: the in-force
book has code → agency name, the access lists have code → person. `intelRebuild`
joins those two every night into an alias table — **33 groups** on the current
book — and scoping consults it. Nothing is hard-coded, so an agency Guardian
adds next year is picked up on the next rebuild with nothing typed in here.

Relying on the agent number alone would not have been enough: Ricky's row on the
96-row access list carries no number at all, and that tab has no number column.
The alias comes from the data, which is why it works for him.

Sessions last 12 hours and the token lives in `sessionStorage`, not
`localStorage` — a refresh keeps you signed in, closing the tab does not. These
are shared machines.

---

## 5. The automations

| Function | When | What it sends |
|---|---|---|
| `intelRebuild` | 02:00 nightly | nothing — recomputes everything, and fingerprints the book so tomorrow can tell what moved |
| `intelAgentDigest` | 07:00 weekdays | what lapsed overnight, arrears past 60 days, pending cases holding money, and follow-ups they said they would make |
| `intelManagerDigest` | 07:30 Monday | the branch's week: overnight movement, ageing, billing-method failure, the agent league, what is coming, and the data-health panel |
| `intelHorizonWatch` | 08:00 on the 1st | maturities within 18 months and conversion rights within 3 years, to the servicing agent |
| `intelCrossSellDigest` | 08:00 on the 8th | ten clients worth a call, with the opening question for each |

An agent with nothing outstanding is **not** mailed. A digest that arrives
empty stops being read.

`intelManagerDigest` writes a row to `Intel Trend` each week, which is where
"the chase list grew by 40 since last Monday" comes from. That line appears
from the second Monday onward.

### What moved overnight

The rebuild sees the book fresh each night and has no memory of yesterday, so a
policy that slid from overdue to lapsed looks exactly like one that was always
lapsed. Nobody notices, and the reinstatement window shortens while they don't.

So each rebuild leaves a fingerprint — policy number against a one-letter
status — on the hidden `_Intel State` tab, and the next one compares. Out of
that comes newly lapsed, slipped into arrears, came good, new pending, and
policies that left the extract entirely (usually a surrender nobody mentioned).

The fingerprint is on a tab rather than in Script Properties, which caps at
9 KB and would truncate silently at about a tenth of this book. **The first
night after installing produces no movements** — there is nothing to compare
against yet. They appear from the second night.

---

## 6. Reading the numbers correctly

### Premium is modal, not annual

The `Premium` column is **one instalment**. The `Mode` column that would say
which frequency — monthly, quarterly, annual — is **empty in all 20,392 rows**,
so the book cannot be annualised, and this app never pretends otherwise.

Confirmed rather than assumed: where a dues row joins the in-force book, its
`Premium` equals that policy's `Modal Premium` exactly, and the `Annual
Premium` beside it is about twelve times larger.

Summing the column and calling it annual premium understates monthly business
roughly twelvefold. The figure means nothing at all — which is the same shape
as the mistake that once produced a branch "cover recommended" total of
TT$121m.

**Ask Guardian to add `Mode` to the export.** It is one column and it unlocks
the only figure the branch actually wants.

### The status codes are not self-explanatory

| Status | Means | In the app |
|---|---|---|
| `0` | no premium problem — read `Status Description` | not a dues case |
| `1` | Lapsed | reinstatement, not collection |
| `2` | **Overdue and still premium-paying** | the collectable book |
| `3` | Pending, underwriting incomplete | pending business |

Status `2` carries the Status Description **"Premium Paying"**. A filter on the
description misses every case that matters. It is the single easiest mistake to
make in this workbook.

The chase list is Status `2` past **31 days** — below that a premium is inside
its grace period and chasing it annoys a client who is not late.

### Only life cover counts as life cover

The classification table in `Intelligence.gs` (`IPLANS`) is deliberately
explicit, because three plans in this book read as life and are not:

- **`LIFE SECURE` / `LIFSECURE CO`** — deferred annuity, a savings target
- **`PA DTH/DIS`** — personal accident, pays a monthly income
- **`EVOL - CRIT`** — critical illness, reimburses on diagnosis

None is payable on death, so none is ever added to a sum-assured total. They
appear under *Expiring cover*, because they end.

A plan not in the table comes back **unclassified** and is counted separately
rather than guessed at. Add plans from the product sheet as Guardian adds them;
do not widen the prefixes.

### Pending age is recomputed

The pending tab's own `ReqtdaysLapsed` reaches **8,128** — a stale cell, not a
case that waited twenty-two years. Age is measured from the requirement and
submission dates, and anything over ten years is shown as unknown rather than
as a number.

### Requirements are counted once

The requirements extract repeats a requirement once per history row. Counting
rows makes the open list four times worse than it is, so each
`insured_requirement_id` is taken once. Open means no `closed_date`.

### Cross-sell is scored on whether the call will happen

Every client is measured against what they already hold. Measured on the
branch's own 2,153 in-force clients before any of the rules were written:

| | |
|---|---|
| hold exactly one policy | **1,780** (83%) |
| hold life cover and no retirement plan | **1,249** |
| hold a retirement fund and **no death benefit at all** | **357**, carrying TT$31.6m of fund value |
| hold term cover and nothing permanent | **311**, covering TT$429m |
| hold no critical illness or accident benefit | **1,963** (91%) |

Six rules fire off those. Four are **call lists** — small and sharp. Two are
**campaigns** — they cover most of the book and are a mailing, not a phone list;
the app labels which is which.

A client appears **once**, under their strongest reason, with the others riding
along as "also needs". A name repeated six times is a list nobody works.

The score is out of 100 and it is mostly about whether the call will happen:
the sharpness of the gap is worth up to 40, and being reachable, paid up, the
right age and demonstrably able to afford it is worth the other 60. Two
conditions score zero rather than low, because they are not leads:

- **no phone and no e-mail** — nothing can start
- **more than 30 days behind on what they already hold** — that is a
  collections call, and pitching them is how a branch loses both

The reasons travel with the score, so an adviser can see why a name is near the
top instead of being asked to trust a number.

**The caveat is on every screen and in every e-mail, and it is not decoration.**
These are gaps in *this branch's* in-force book. A client shown without a
retirement plan may hold one with another company, another branch, or through
their employer. An adviser who opens with "you have no retirement plan" will be
wrong roughly as often as the branch's share of that client's wallet. The
opening question the app supplies asks instead of telling, every time.

To add or change a rule, edit `IXSELL_RULES` near the top of the cross-sell
section. Each rule declares who it fires on, why it matters, the question to
open with, what number to show, the age band it suits, and its weight.

### The lists fold into clients

Nearly half the chase list is the same client twice or more — 2,536 policies
across 1,838 clients — and the worst of it is corporate: one scheme carries
**34 policies behind one phone number**, another 24, another 22. Worked as
policies, an agent rings the same company all afternoon.

So the chase list, the unreachable list and the three movement lists all carry
a **Group into clients** toggle. Folded, a row is one client: how many policies,
the total instalments, the worst arrears among them, every billing method in
play and every policy number, so the whole conversation is on one line. The CSV
follows whichever view is on screen.

### Three chase states, not two

The Tasks tab is the branch's own record of chasing head office — every row is
a follow-up on a pending case. The policy number sits inside the Subject line
rather than in a column, so it is pulled out with a pattern and joined to
pending business. That join answers the question nothing else in the workbook
can, and it has **three** answers, not two:

| State | Means | What to do |
|---|---|---|
| **Being chased now** | an open follow-up task names this policy | wait, or ask the person named |
| **Chase closed, case open** | somebody chased it and closed the task, but the case is still pending | find out why — closed too early, or the case moved and nobody updated it |
| **Never chased** | no task, open or closed, has ever named this policy | raise one |

Collapsing the last two into a single "unchased" number hides the difference,
and they need different actions — so they are counted separately.

The chase log itself is staff business. An agent sees the chase marks on their
own cases and nothing else.

---

## 7. What is wrong with the extract

Every figure below was measured on the live workbook, not estimated, and is
shown on the app's **Data health** screen so a manager can see the size of the
doubt without asking anybody.

| What | Rows | Why it matters | Where it gets fixed |
|---|---|---|---|
| Policy numbers as `5.00E+09` | 107 | Excel's scientific notation destroyed the digits. These rows cannot be matched to a policy at all. | Format the Number column as **Plain text** before the export is pasted |
| `Mode` column empty | 20,392 | the book cannot be annualised | add `Mode` to the export |
| `Paid To Date` as `##########` | 2,612 | a column too narrow at export; the date is not recoverable | widen it, or export CSV rather than copying off the screen |
| `Projected Lapse Date` as `30 Mar 1900` | 2,612 | spreadsheet epoch zero — an empty cell that looks like a date. Sorting on it puts the real lapses last. A few rows hold a status word in the date column instead. | leave it blank when there is no date |
| E-mail with a space inside | 2,745 | `NAME@GMAIL.CO M` — a line wrap baked in. These bounce. | strip spaces on export; the app already ignores them when mailing |
| Chase-list clients with no phone **and** no e-mail | 351 | no collection effort of any kind can start | *Dues → Nobody can reach these* |
| Requirements open over a year | 869 | usually cases that ended without anybody closing the record | close what is dead so the live list is believable |
| Servicing agent inactive or vested | 152 | nobody is calling those clients — and some of them are maturing | reassign servicing on the Guardian record |

Two columns, `APLamount` and `Amount Billed`, are zero in every row, and
`Send Y or N` is empty in every row. Nothing reads them.

### Why rider expiry comes from the in-force book

The obvious home for rider expiry is the coverage extract — 44,595 `CVG_*`
records. It cannot be used:

- `CVG_AD_XPRY_DT`, the accidental-death expiry, is **zero in every row**
- `CONN_POL_ID` is filled on **171 of 44,595 rows**, so there is no policy key
  to join on

`CVG_CNVR_XPRY_DT` does hold 1,406 real conversion-expiry dates and they are
unusable for the same reason: nothing says whose they are.

Expiry therefore comes from the in-force book, where the plan name and the
maturity date are both present and both joinable. That is plan-derived rather
than per-coverage — good enough to run the conversation, not good enough to
quote from.

**If that extract is ever re-pulled, ask for `POL_ID` and `PLAN_ID` in it.**
One change, and per-rider expiry becomes exact.

### The dues sheet and the in-force book barely overlap

2,625 of 20,392 dues rows join the in-force book, and only **3 of the 2,533**
chase-list policies do. They are different populations: the in-force book is
what is current and paid up, the dues extract is largely what is not. Do not
expect a figure from one to reconcile against the other.

---

## 8. When something looks wrong

Run **`intelSelfTest`** first — from the editor, or **Branch Intelligence →
Self test** in the workbook menu. It names the problem in a sentence.

| Symptom | Usually |
|---|---|
| "No intelligence has been built yet" | `intelRebuild` has not run. Run it, or wait for 2 a.m. |
| A whole screen says "not found" | the tab search matched nothing — set the `INTEL_TAB_*` property for that domain |
| "That login and code do not match" | the code, or the row is marked inactive. The message is deliberately the same for a wrong code and an unknown person — telling them apart tells an outsider which logins exist |
| Sign-in works, screens are empty | the person signed in as an agent and their Agent Name column does not match the extracts. Check the spelling against the dues tab |
| Digests arrive an hour out | the project time zone is not Atlantic Time |
| Digests do not arrive at all | `INTEL_TEST_TO` is still set, or the triggers were never installed |
| A number changed and nobody knows why | the cache is rebuilt nightly; `Intel Trend` has the week-by-week headline figures |
