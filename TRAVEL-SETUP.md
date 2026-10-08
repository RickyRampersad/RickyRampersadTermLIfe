# Travel insurance — setup

`travel/` captures Guardian General's **Travel Insurance Proposal Form
(GG-TIN-PRO-10/2023)** on the branch site: every question on the four-page
form, in the form's order, split into seven short steps a phone can carry.
The client gets a reference and a PDF of the completed form; the branch gets
the same PDF with a summary and a list of anything to check before quoting.

Nothing is bound on the page. The branch rates the trip, e-mails the premium
from the sheet, the client pays Guardian General, and cover starts when the
premium is paid.

## What is where

| Piece | File | Does |
|---|---|---|
| The page | `travel/index.html` | The packages compared, the proposal in seven steps, a printable copy of the form, the done screen |
| The backend | `apps-script/Travel.gs` | Files the proposal, renders the PDF, e-mails the branch and the client, e-mails the premium from the sheet |
| Home page | `index.html` | A "Travel" tile under Get a quote, and "Insure my trip" in the help sheet |

The page works before the backend exists: with `CONFIG.API_URL` empty, "Send
my proposal" opens the client's own mail app addressed to support@ with the
proposal as text, and the done screen still gives them the form to print.
Nothing is lost, but nothing is filed either, so wire the backend before the
link goes to a client.

## Part 1 — the Apps Script project (ten minutes, once)

Travel runs in **its own Google Sheet and its own Apps Script project**. An
Apps Script project may hold one `doGet` and one `doPost`, and the Service
Questionnaire, Claims and renewals projects already use theirs. Do not paste
`Travel.gs` beside `Service.gs`, `Claims.gs` or `Code.gs`.

1. Create a new Google Sheet named **Travel Proposals**.
2. **Extensions → Apps Script**, delete the placeholder, paste all of
   [`apps-script/Travel.gs`](apps-script/Travel.gs).
3. Edit the `TRAVEL` block at the top:
   - `DESK` — Guardian General's travel desk address. **Ships blank on
     purpose.** Until it is set, every proposal goes to the branch alone and
     the e-mail says so. Confirm the address with Guardian General before
     setting it.
   - `MAIL_CC` — sales support, the branch manager and support@. Already set.
   - `SITE_KEY` — change it, and change it to match in `travel/index.html`.
4. **Run → setupTravel**, approve the permissions (Sheets, Drive, Gmail). It
   builds the three tabs, the Status dropdown and the Drive folder.
5. **Deploy → New deployment → Web app**: execute as **Me**, who has access
   **Anyone**. Copy the `/exec` URL.
   (For prefill from Salesforce, set the three `SF_*` properties first; see
   Part 1b.)
6. Paste it into `CONFIG.API_URL` in `travel/index.html`, commit, push, merge.

Re-deploying after a change to the script is **Deploy → Manage deployments →
pencil → New version**. A new deployment issues a new `/exec` URL and the page
has to be re-wired.

### Test before a client sees it

From the sheet's **Travel** menu, turn **test mode ON**: every e-mail then goes
to the script owner with a `[TEST]` banner naming the real recipients. Send a
proposal from the page, read the branch e-mail and the client acknowledgement,
open the PDF, then turn test mode OFF.

## Part 1b — prefill for an existing client (Salesforce)

An existing client need not type what the branch already holds. Once the
name and date of birth are on the form, a gold panel offers **Fill from my
file**. The backend looks the name up on `CLIENT_PORTFOLIO__c` (the policy
record's own name or the Contact's) and hands back the rest **only when the
date of birth matches the record**: address, phones, e-mail, occupation (the
policy's own, else the Contact's Title) and employer. The form asks nothing
extra for it, so it still lines up with Guardian General's form question for
question. Five wrong dates on one surname inside fifteen minutes close it.
Nothing is revealed on a miss.

The filled fields carry a green "from your file" chip, the client can change
any of them, and the proposal row records **Existing client**, **Client
number** and **Prefilled from Salesforce**. The branch e-mail says it is an
existing client; the printed form carries nothing of this, because it is
Guardian General's form.

To switch it on, add three Script properties to the Travel project (Project
Settings → Script properties), the same three the Service Questionnaire
project holds: **`SF_KEY`**, **`SF_SECRET`** and **`SF_LOGIN_URL`** (the My
Domain address, not login.salesforce.com). Copy them from the KPI Tracker.
Then Manage deployments → New version. The page asks the backend on load
whether prefill is on (`ping` answers `prefill: true`) and shows the panel
only then.

## Part 1c — the printed proposal is Guardian General's form

The page renders the completed proposal as **form GG-TIN-PRO-10/2023 as
printed**: Guardian Group's header (head office, branch office, telephones,
website, the Guardian General logo lifted from the PDF into
`travel/gg-logo.png`), the same four pages, the same numbering, the same
words, dates in the form's MM/DD/YY, the packages table, the sums-insured
table filled only when cover outside the packages is asked for (as the form
intends), and the Summary of Cover as page four. Nothing of the branch is on
it. The client can open it at any step ("See the form" in the progress bar),
at the review, and after sending, and print or save it as PDF.

The page sends that rendering to the backend with the proposal, and
`formPdf_` turns it into the PDF that is filed and attached, after cutting
any script or event attribute and embedding the logo. If the page sends
nothing usable, the script's own rendering (`proposalPdf_`, the same header
and sections) stands in.

## Part 1d — the package adviser

At the package step the page reads the trip and suggests a package, with
reasons, over a comparison of the three: where the medical limit matters
(the United States, Canada and other countries where a hospital bill runs
high score two; Europe and the richer Caribbean islands one), the length of
the trip (over seven days scores one; over fourteen is outside the packages),
any traveller aged 60 or more, and the purpose (sport or medical treatment).
Three points or more suggests Elite, one or two Economy Plus, none Economy.
The table totals each package and says what each step up buys. **No premium
is shown or invented**; the adviser says plainly that best value depends on
the premium the branch quotes. The suggestion travels with the proposal
(**Suggested package** on the sheet) and the branch e-mail flags a client who
chose differently.

## Part 2 — what comes in

**Travel Proposals** has one row per proposal: the reference (`TRV-YYMM-NNNN`),
every answer on the form, the days of the trip, the package, the sums insured
per person, and a **Flags** column listing what to check before quoting:

- a trip over fourteen days (outside the packages);
- more than five persons (the form takes four travelling dependants; the rest
  are taken on a call);
- anyone outside the 5 to 75 age limit on departure;
- a PEP answer of yes (a PEP Memorandum must accompany the proposal);
- a health disclosure (a "no" to sound health, a "yes" to infectious contact,
  or either for a dependant);
- sums insured stated by the client rather than a package.

**Travel Persons** has one row per insured person with their limits, so a
trip can be rated per head. **Travel Log** records each event.

The PDF of the completed form is in the proposal's Drive folder (`Travel
Proposals — Ricky Rampersad Branch / <year> / <ref> — <name>`) and attached to
both e-mails. It reproduces the form's nine sections with the same numbering
and the same YES/NO boxes, so Guardian General sees the document it knows.

## Part 3 — quoting

Rate the trip, type the premium into **Premium quoted (TT$)** on the client's
row, select the row, and run **Travel → E-mail the selected client their
premium**. The client gets the premium with the trip summary and how to pay;
the row moves to *Quoted* and is stamped. The other statuses (*Awaiting
payment*, *Bound*, *Declined*, *Withdrawn*) are set by hand; **Policy number**
and **Paid on** are typed in when Guardian General issues.

## Rules the page keeps

- **Maximum five persons and fourteen days** any one trip on a package. The
  page warns on both and still sends; the branch quotes the rest on sums
  insured.
- **Age limit 5 to 75** on personal accident, medical and loss of deposits.
  The page shows each traveller's age on departure and warns; it never blocks.
- **Unspecified items are limited to $1,000**; the specified items step is
  where jewellery and anything over that is declared.
- **The 30-day automatic extension** when a trip cannot be completed through
  accident, injury, sickness or disease is printed on the page and on the
  form.
- **No premium is shown on the page.** The form carries no rates and the page
  invents none; every proposal is rated by the branch.
- The page carries the `<!-- rrb-views -->` beacon like every served page.
