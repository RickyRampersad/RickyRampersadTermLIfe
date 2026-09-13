# CSEC Study Hub — launch pack

Launching to **Ricky Rampersad Branch client families** with secondary-school
children. Free, no app, works in any browser.

---

## 1. Before you announce anything

The hub works today without sync. **Sync needs one deployment step**, and the
announcement below promises it, so do this first.

| | Step | Where |
|---|---|---|
| ☐ | Create a Google Sheet named **RRB CSEC Sync**, copy its ID | Drive |
| ☐ | Paste `gs/csec-sync.gs` into a new Apps Script project, set `SHEET_ID` | script.google.com |
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
| ☐ | Create a student profile, pick the form, check the subject list |
| ☐ | Do ten practice questions |
| ☐ | On a **different** device: create a profile, join with the code |
| ☐ | Confirm the student and their progress appear |
| ☐ | Change something on device two, sync, confirm it reaches device one |
| ☐ | Deliberately enter a wrong PIN, then recover with the recovery code |
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
*A Form 3 student sits CSEC in 961 days. That is 961 nights, and most of them go to waste.*

CXC gives the full syllabus away free — the exact document the examiner works from. It is the most useful thing in the whole process and almost nobody in a family home has opened one.

The CSEC Study Hub is live and free for your client families. Ten minutes a night aimed at whatever their child is weakest on, Form 1 to Form 5, nothing to install. It is a reason to call a client that has nothing to do with selling them anything.

Reply with one family you are sending it to this week.

rickyrampersadbranch.com/csec
```

*(96 words. Update the 961 if you send this much later — a Form 3 countdown is
on `csec/journey.html`.)*

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

**"We forgot the PIN."** Sign-in → *Forgotten the PIN?* → the six-character
recovery code. Failing that, anyone else signed in on the device can reset it in
Settings. Failing that, if they are in a sync group they can start fresh on
another device and join with the group code.

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

- **176 questions across 14 subjects.** Enough for a nightly habit, not enough
  for a Form 5 to revise from alone. Maths is deepest at 20.
- **16 worked methods.** English B, Spanish, French, Social Studies and PE have
  none yet.
- **The readiness band is unvalidated.** It has never been checked against a real
  CSEC result, because there has not been one. It is an internal indicator and
  the page says so above the number.
- **No past papers.** By choice — they are copyright CXC. The Resources page
  links the official free syllabuses, specimen papers and mark schemes, the
  Ministry's worked solutions, and twelve international sites.
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
