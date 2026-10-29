# Study Hub — launch pack

Launching to **Ricky Rampersad Branch client families** with children in
primary school — **Standard 1 to Standard 5**, five years to the SEA. Free, no
app, works in any browser.

Since 16 October 2026 the hub is for the SEA alone. The switch is
`CSEC_SCOPE` at the top of `csec/data/curriculum.js`; `csec/tests/scope.js`
holds every page to it.

---

## 1. Before you announce anything

The hub works today without sync. **Sync needs one deployment step**, and the
announcement below promises it, so do this first.

| | Step | Where |
|---|---|---|
| ✅ | ~~Create a Google Sheet named **RRB CSEC Sync**~~ — done, ID already in the script | [open it](https://docs.google.com/spreadsheets/d/1b5kOwEP9sJSyIzgp6YeyBEi-KZO2DaacaGKNOOJMCJE/edit) |
| ☐ | Paste `gs/csec-sync.gs` into a new Apps Script project (`SHEET_ID` is already set) | script.google.com |
| ☐ | Run `setup` once and authorise | Apps Script editor |
| ☐ | Deploy → Web app → Execute as **Me**, access **Anyone** | Apps Script |
| ☐ | Open `<exec URL>?action=ping` — expect `{"ok":true,...}` | browser |
| ☐ | Paste the `/exec` URL into `csec/assets/csec-config.js` | this repo |
| ☐ | Paste the views `/exec` URL over `RRB_VIEWS_URL` in the new pages | this repo |
| ☐ | Commit and push; confirm GitHub Pages has rebuilt | this repo |

**Then test it yourself, end to end, before a single client sees it:**

| | Check |
|---|---|
| ☐ | On your phone: create a parent profile, **write down the recovery code** |
| ☐ | Settings → create a family group, note the code |
| ☐ | Create a student profile, pick the year (Standard 1 to 5), check the subject list |
| ☐ | Create a second profile at Standard 3 and confirm it counts down to the SEA |
| ☐ | Do ten practice questions |
| ☐ | On a **different** device: create a profile, join with the code |
| ☐ | Confirm the student and their progress appear |
| ☐ | Change something on device two, sync, confirm it reaches device one |
| ☐ | Create a profile and confirm it asks for no password at all |
| ☐ | Sign out, sign back in by name, then check **Settings → Who signed in** lists both |
| ☐ | With sync deployed: put an e-mail on a profile, ask for a code, enter a wrong one, then the right one |
| ☐ | Print `csec/flyer.html` — check the QR scans with a real phone |

If sync is not deployed by launch day, the hub still runs device-local and says
so honestly in Settings. In that case **cut the sync sentence from the WhatsApp
message** and tell families to use Settings → Export backup.

---

## 2. The WhatsApp message

House rules (see `CLAUDE.md`): under ~120 words, addressed to the agent, one
finding, one specific ask. Bold is `*single asterisks*`. Do not hard-wrap
paragraphs — WhatsApp reflows and wrapped text arrives ragged.

```
*Only one of the four marks on the SEA writing paper is for answering the question. A child who writes beautifully about the wrong topic loses it whole.*

That is the commonest way a capable child drops marks on the paper that places them in a secondary school, and nobody tells the family.

The Study Hub is live and free for your client families. Ten minutes a night on whatever their child is weakest at, the Ministry's own past papers, and a guided method for reading the topic before writing a word. Standard 1 to Standard 5, nothing to install.

Reply with one family you are sending it to this week.

rickyrampersadbranch.com/csec
```

*(104 words. The finding is from the Ministry's own writing rubric: Content is
the one criterion scored against the topic; Language Use, Grammar and
Mechanics, and Organisation are scored on the writing itself. A Standard 5
sits the SEA in about 136 days from 16 October 2026, if you want a countdown
instead — the hub's own is on `csec/journey.html`.)*

---

## 3. What goes where

| Audience | Send them | Why |
|---|---|---|
| Agents | The WhatsApp message above | They forward it to their own client families |
| Client families | `rickyrampersadbranch.com/csec` → Start here | Setup, guides and FAQ all on one page |
| A family in person | Printed `csec/flyer.html` | One A4 page, QR code, fridge-ready |
| A teacher | Start here → **For teachers** tab | Class codes, roster, focus topics |

The main site now carries the hub as a tile in **Existing Clients**, and the
four public pages are in `sitemap.xml`.

---

## 4. The three questions you will be asked

**"Is it really free?"** Yes. No advertising, nothing sold, no account needed.

**"What is the password?"** There isn’t one — choose the name. If you want a
check, put an e-mail on the profile and the hub sends a six-digit code instead;
on a child’s profile use a parent’s address, so the parent is told about every
sign-in. Codes need the Apps Script deployed. **Settings → Who signed in**
lists every sign-in and every refusal either way.

**"Is my child's data safe?"** Be straight, in these words: *if you use a sync
group, the names and scores in it sit on a branch-owned Google Sheet, and anyone
holding your group code can read and change them — the code is the only lock.
Share it with family and your child's teacher, nobody else. If you would rather
nothing left your device, don't create a group: the hub works fully without one.*

Never soften that third answer. It is the one that costs trust if it turns out
to have been oversold.

---

## 5. Known limits on launch day

State these rather than waiting to be caught out:

- **309 questions across 44 strands.** Every strand in every default subject
  carries at least four, with a median of about eight. Enough for a nightly
  habit; **not** a bank a Standard 5 can revise a whole subject from. Say this
  rather than letting families find it.
- **SEA papers: 4 complete Mathematics papers and 2 complete ELA papers.**
  Twelve practice papers and two mocks are offered in each subject, all built to
  the Ministry's published blueprint. Beyond the fourth Maths and second ELA
  paper, questions start reappearing across papers — never twice inside one
  paper — and the page says so on screen. All 14 **Writing** papers are
  complete: 42 prompts, none repeated.
- **The Writing paper is marked by you, not by the app.** Three prompts, a
  50-minute clock, then the Ministry's four criteria and a link to its marked
  exemplars. This is deliberate: no program can mark a child's story honestly.
- **18 guided methods, 12 of them for the writing paper.** A question tells a
  child they were wrong; a method tells them how to be right. The writing
  paper is covered end to end — reading the topic, the letter, the report,
  given sentences, opening, middle and ending, showing not telling, speech,
  how long and how to spend the fifty minutes. Mathematics and ELA reading
  have a handful each; Science, Social Studies, Spanish, Visual Arts and PE
  have none yet.
- **The readiness band is unvalidated.** It has never been checked against a
  real SEA result, because there has not been one. It is an internal indicator
  and the page says so above the number.
- **The real past papers are the Ministry's, and they are free.** The 2024
  and 2025 SEA papers, the specimen papers and the mark schemes are published
  by the Ministry of Education and linked on the Resources page. For a
  Standard 4 or 5 that is the most valuable thing in the hub, and it is worth
  saying so in the announcement. The hub's own practice questions are
  original; it copies nothing.
- **Sync is last-write-wins per profile.** Two devices editing the same student
  in the same minute: the later write wins. Fine for a family, worth knowing for
  a class of thirty.

---

## 6. First fortnight

| | |
|---|---|
| ☐ | Watch the view counter for `/csec/` pages |
| ☐ | Ask the first five families what broke or confused them |
| ☐ | Collect "the questions ran out in X" reports — that is the top-up list |
| ☐ | Check the Sync sheet is growing and that no group is filling with junk |
| ☐ | Re-read the readiness bands once real students have real data behind them |
