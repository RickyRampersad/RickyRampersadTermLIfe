# donthaveanagent.com

A standalone product for **orphan policyholders** — people whose agent retired, resigned or
simply stopped calling. It works in both directions: an agent sends a client a prefilled
link, or a client arrives on their own with no idea who looks after their policy.

Built to be white-labelled and sold to other agencies.

---

## Why it exists

Read [RESEARCH.md](RESEARCH.md) first — every claim on the site traces to a source there.

**Trinidad & Tobago leads the evidence**, because a Trinidadian reading American statistics
is entitled to ask whether any of it applies here:

- **Over 70,000** life policies underwritten by Guardian Life of the Caribbean *alone*.
- **Roughly 2,180** registered sales representatives in the entire country — every insurer,
  agency and brokerage, general *and* life combined (our tally of the Central Bank's public
  register, labelled as such on the page).
- **Individual life premiums fell 14% in 2021**, which EY attributed to policyholders
  "discontinuing their policies… as they could no longer afford the premiums". That is the
  orphan problem with a price on it: nobody explained that the policy could be reduced,
  made paid-up, or carried by its own cash value.
- **Seven years** — how long money can sit unclaimed after maturity under s.197 of the
  Insurance Act, 2018.

The wider pattern, from the largest international studies:

- **40%+** of life insurance policies have no active agent behind them.
- **43%** of policyholders have had no contact from an agent in over three years, and only
  **19%** call the relationship trusted (J.D. Power, 2025).
- **Over 90%** never updated their cover after a major life change.
- Only **29%** of beneficiaries know the insurance company's name; **1 in 600** policies is
  never claimed at all.

The emotional core, and the thing the whole design turns on: **the policy is fine. It's the
relationship that died.** Orphaned clients don't act because they assume they were dropped
for not being worth keeping. So the page leads with *your cover is still completely valid,
this happened to 40% of policyholders, and it isn't your fault.* Calm beats alarm here —
every competitor in this category shouts.

---

## The files

| File | What it is |
|---|---|
| `index.html` | The landing page. Logo, the live 60-second self-check, attributed statistics, the "what quietly goes wrong" timeline, the promise/not-promise columns, local law, FAQ. |
| **Logo** | A speech bubble with a person in it — the promise (*somebody answers*) rather than the product. The branch shield appears separately, monochrome, as the "a Ricky Rampersad Branch initiative" co-brand. |
| `review.html` | The review itself. Both origins, both plan types, policy tracing, signature, change of agent. |
| `agent/index.html` | Agent console — generate a prefilled link and send it in one tap. |
| `netlify.toml` | Deploy config and short links. |
| `RESEARCH.md` | The research brief with sources. |

The backend is shared with the branch site: `../apps-script/Service.gs`. One backend, two
front doors, one worklist.

---

## Where the data goes

Every submission writes **one row** to a Google Sheet — `Service Questionnaires` for
individuals, `Group Service Questionnaires` for company plans — plus a line in
`Service Activity`. Each question becomes its own column, and a question added to the form
tomorrow becomes a new column on its own, because the form sends its labels along with the
answers.

**Fixed columns, in order:**

| Column | What it holds |
|---|---|
| `Reference` | `DHA-260812-0007` (individual) / `DHAG-…` (group). The prefix says which front door. |
| `Timestamp` · `Priority` · `Status` | Filed time, URGENT/HIGH/ACTION/NORMAL, and Open/Filed/Handled |
| `Handled by` · `Handled on` | **You fill these in.** The accountability trail. |
| `Client` · `Company` · `Email` · `Phone` | Who it is and how to reach them |
| `Insurer` · `Policy #` | Which carrier, and the number if they had one |
| `Score` | Blank for donthaveanagent.com — only the branch service form scores |
| `Minutes taken` | How long the client spent |
| `Source` | `donthaveanagent.com` or `branch site` |
| `Arrived via` | "Agent sent the link" or "Client came on their own" |
| `Sent by` · `Link ref` | Which agent generated the link, and its reference |
| `Needs tracing` | `YES — no policy number`, so tracing work can be filtered |
| **`Declared true`** | The client's declaration that the information is correct |
| **`Consent to service`** | Their agreement that we may use it to service the policy |
| **`Marketing consent`** | Separate and optional |
| **`Coverage questions asked`** | `Yes` or `No — sales-free version served` |
| `Signed` | Whether the signature was drawn or typed |

The last four are the **compliance record**. A registered agent should be able to show, per
submission, what the client declared, what they agreed to, whether they opted into
marketing, and which version of the form they were actually served. `Declared true` and
`Consent to service` are mandatory on the form, so a `No` in either means something went
wrong and that row should be treated as unusable until it is checked.

Then the emails go out — the client's copy, and the routing email to Customer Service with
the completed questionnaire and any change-of-agent letter attached as PDFs.

---

## The two doors

This is the heart of the product, and the rule is not negotiable.

### Agent-sent — `review.html?from=agent`

An agent generated the link and the client's details are already in it. Trust is borrowed
from the agent, and the client expects advice. **The coverage questions are ON**: life
changes, goals, income protection, retirement, mortgage protection, Will, and an offer of a
free needs analysis.

### Client-direct — `review.html?from=client`

They typed the domain in, usually after years of being ignored. Trust is zero. **The
coverage questions are OFF entirely** — the whole section doesn't render — and are replaced
by one open question: *what would you like help with?*

Asking somebody who came looking for help whether they'd like a retirement plan confirms
exactly what they suspected.

### Overriding it — `?sell=1` / `?sell=0`

The coverage questions are a **separate switch** from the origin, so the two aren't welded
together:

| Link | Coverage questions |
|---|---|
| `from=agent` (no `sell`) | **on** — the default for a link you send |
| `from=client` (no `sell`) | **off** — the default for someone who found the site alone |
| `from=agent&sell=0` | **off** — a deliberately gentle link for a client you know has been badly treated |
| `from=client&sell=1` | **on** — an explicit override |

**The default with no `sell` parameter never changes.** A visitor who types the domain in
after years of being ignored gets the sales-free version unless an agent has consciously
decided otherwise for that specific person.

The review's confirmation screen follows the *switch*, not the origin — so a `sell=1` link
never falsely promises "no product questions were asked". The promise on screen and the
form actually served are always the same thing.

---

## Link parameters

All optional. Everything you pass arrives prefilled.

| Parameter | Values |
|---|---|
| `from` | `agent` · `client` — skips the "how did you get here" step |
| `type` | `individual` · `group` — skips the plan-type step |
| `k` | your reference for this send, e.g. `DHA-260812-A1B2` |
| `name` `policy` `email` `phone` `insurer` | prefill the client's details |
| `company` | group only — the company name |
| `sell` | `1` forces the coverage questions on, `0` forces them off; omit to let the origin decide |
| `agent` | `1` shows the **Agent's comments** field (use when completing it with the client) |
| `agentname` `agentemail` | tags the review back to the agent who sent it |

Short links from `netlify.toml`: `/start`, `/me`, `/company`, and `/r/<ref>`.

---

## The agent console

At `/agent/`. The agent fills in what they know, and it produces:

- a **personal prefilled link** that updates live as they type
- a **message written to be forwarded as-is**, addressed by first name
- one-tap **WhatsApp** (with T&T mobile numbers normalised to `1868…`), **email**, **copy
  link** and **open it myself**
- a **recent sends list** kept on that device so a link can be re-copied
- a fresh reference number per client, rotated automatically after each send

### The choices the agent gets

| Control | Effect |
|---|---|
| **Individual / Group** | Which questionnaire the client sees. Group ends with the director + company stamp letter. |
| **Include the coverage questions** | On by default. Untick and the link carries `sell=0` — the gentle version: records, beneficiaries and one open question. The origin stays `agent` either way, so the review is still attributed to you. |
| **I'm completing this with them** | Adds `agent=1`, revealing the Agent's comments field. For phone or in-person, not for sending. |

**The access code is a doorway, not a lock.** Everything runs in the browser, so treat it
as "keeps the console out of clients' way". Nothing secret sits behind it and no client
data is stored there beyond the recent-links list. Change `CONFIG.ACCESS_CODE` in
`agent/index.html` before handing it to anybody.

---

## Group plans and the company stamp

Group works exactly as the paper EBD process does, because the insurer requires it to:

1. The director or authorised officer completes the review and signs on screen.
2. `Service.gs` generates the **Request for Change of Agent** letter — GROUP LIFE POLICY #,
   FROM, TO, EFFECTIVE DATE, director's name and title — already filled in.
3. It is emailed to them marked **PLEASE PRINT ON COMPANY LETTER HEAD**, to print, stamp,
   sign and return.
4. The digital request reaches Customer Service the same day, so nothing waits on the post.

The stamp can't be digitised — the carrier requires the physical letterhead and stamp.
What *can* be removed is the typing, the errors and the week of delay.

---

## Deploying

### The site

1. Netlify → **Add new site** → import this repo.
2. Set the **base/publish directory** to `donthaveanagent`.
3. Add `donthaveanagent.com` as the custom domain and let Netlify issue the certificate.

The branch site (`rickyrampersadbranch.com`) publishes from the repo root and is unaffected
— same pattern as `renewalpal/`.

### The backend

`../apps-script/Service.gs` serves both sites. Follow [the setup guide](../service/README.md),
then paste the deployed `/exec` URL into `CONFIG.API_URL` in **both**:

- `service/index.html`
- `donthaveanagent/review.html`

Until you do, nothing breaks — the review falls back to a pre-filled email so no client is
ever turned away.

---

## White-labelling it

Three edits re-skin the whole product:

1. **`:root` in each file's stylesheet** — the colour tokens. The palette is **Ivory &
   Forest**: warm paper `#F6F3EC`, deep green `#1E6F52`, clay `#B4522F` as the warm
   secondary, Montserrat + DM Sans. Deliberately **no yellow and no blue**. **Green means
   resolved, slate `#9AA9A1` means the empty agent slot** — the design uses that pairing as
   a narrative, so keep them semantically opposed.

   Re-theming is that one block in each of the three files and nothing else. Three
   alternates were built and previewed — Porcelain & Oxblood (light, formal), Graphite &
   Coral (dark, warm) and Ink & Champagne (dark, understated) — and any of them is a
   token-block swap away.

   If you switch to a **dark** palette, three rules also need flipping back: the
   translucent overlays are currently `rgba(21,32,27,…)` (ink on paper) and would become
   `rgba(255,255,255,…)`; the nav/footer veils are paper-tinted; and `.q` in `review.html`
   uses `--surface`/`--surface2` for its card gradient.
2. **`BRAND` / `CONFIG.BRAND`** at the top of each script — agency, agent, carrier, email,
   phone, country, regulator. Every disclaimer, signature and footer is generated from it.
3. **The logo** — an inline SVG in each file plus the favicon data URI. The mark is a person
   in a dashed ring (unassigned) with a check badge (claimed); the landing page animates
   dashed → solid on load. That one idea is the brand.

What shouldn't be changed when reselling: the client-direct **default** stays sales-free,
and the statistics stay attributed — including the honesty note on our own tally of the
Central Bank register. Both are why it works.

---

## What is deliberately not collected

No national ID numbers, no bank details, no medical history. None of it belongs in a
service review, and asking for it online invites trouble. Drafts are saved to the client's
own browser, cleared on submit, and expire after 30 days.

---

## Known limits

- The **access code** on the agent console is client-side only. Real authentication would
  need the Apps Script layer to gate it.
- **Policy tracing is a promise, not a lookup.** The form captures name, date of birth,
  former name, insurer and rough year, then a human searches. There is no carrier API.
- Research figures are **United States** data describing an industry pattern, not Trinidad &
  Tobago statistics. The site says so where they appear.
- The consumer statistics are point-in-time (2020–2025). Re-check them before a big
  campaign, and update `RESEARCH.md` and the four counters together.
