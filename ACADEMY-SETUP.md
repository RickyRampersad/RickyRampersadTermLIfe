# RRB Academy — sign-in backend — setup

`apps-script/Academy.gs` turns the `/sea/` code gate into real sign-in: the
Academy adds a family to a Google Sheet by e-mail, the family chooses its own
password the first time it signs in, and a child's progress follows them
between devices — and their parent can see it from their own phone.

Nobody e-mails a password to anybody, and no password is ever stored.

## 1. A new sheet, not the branch sheet

Make a **new** Google Sheet for the Academy. The branch sheet holds client
data; this one will hold children's names. They must never be the same file,
and this script must never be pasted into the branch engine's project — an
Apps Script project can have only one `doGet` and one `doPost`, and this file
owns its own.

## 2. Paste, run once, deploy

| Step | What |
|---|---|
| Extensions → Apps Script | **＋ → Script**, name it `Academy`, paste `apps-script/Academy.gs` |
| Run `academySetup()` once | Authorise when asked. Creates the three tabs and generates the signing secret. |
| Deploy → New deployment → Web app | **Execute as: Me** · **Who has access: Anyone**. Copy the `/exec` URL. |
| `sea/index.html` | Paste the URL into `const ACADEMY_API = ""` near the top of the script. Commit, push, merge to `main`. |
| Users tab | Add yourself as a `teacher` and sign in. |

From then on the three codes in the page are ignored. Until then they are
the gate, so the live site never stops working.

## 3. The tabs

**Users** — the only one you touch.

| Column | You fill in | Notes |
|---|---|---|
| Email | yes | Any case, any spacing — it is normalised |
| Name | yes | First name is shown in the app: *Student · Aisha* |
| Role | yes | `student`, `parent` or `teacher` |
| Student Email | for a parent | Links the parent to one child. That child's progress is what the parent sees. |
| Status | to switch off | `disabled` refuses them at once — even a sign-in already open |
| Paid Until | to sell a season | A date. Access runs to the end of that day, then they are refused with a message naming the Academy. Blank = no end. |
| Salt, Hash | **never** | Filled in when they choose a password |
| Created, Last Sign-in, Note | no | |

**Progress** — one row per person: `Email | Updated | JSON`. Leave it alone.

**Activity** — `At | Email | Did | Note`. Every sign-in, refusal and
password choice. Never a password.

## 4. Day to day

| To… | Do |
|---|---|
| Add a family | A row for the child (`student`) and a row for the parent (`parent`, with the child's e-mail in Student Email). Tell them the site address. |
| Reset a password | Clear the **Salt** and **Hash** cells on their row. Next sign-in they choose a new one. |
| Switch someone off | `disabled` in Status. |
| Sell a season | A date in Paid Until. Extend it when they pay again. |
| See who is using it | The Activity tab, or Last Sign-in on Users. |

## 5. What is protected, and what is not

Passwords: a random salt and 5 000 rounds of salted SHA-256, the strongest
hash Apps Script will run inside a request. Five wrong tries per e-mail per
fifteen minutes, then a wait. A sign-in hands the page a token signed with a
secret that lives only in Script Properties; it carries the e-mail and role,
lasts 30 days, and is checked on every call — signature, expiry, and whether
the person is still on the list, still enabled and still paid up. Disabling a
row or letting Paid Until pass cuts off a token that is already in use.

The web app runs as you with access "Anyone", so the endpoints are public and
the token is what makes a call somebody's. The `lookup` call answers whether
an e-mail is on the list — that is what lets a child sign up without being
e-mailed a password, and it is acceptable for an invitation-only sheet you
fill in by hand. Nothing in this script can read the branch sheet.

A Sheets cell holds 50 000 characters; a person's progress is a few thousand.
A save that would not fit is refused with a reason rather than truncated.

## 6. Tests

```bash
node tests/test-academy.js     # the real Academy.gs under the fake Sheets, with real SHA-256 and HMAC
node tests/e2e-sea.js          # the page against a fake of the backend (needs playwright)
```

`test-academy.js` adds rows the way you would, chooses a password, refuses it
five times and locks the sixth, tampers with the token, expires it, disables
the row under a live token, lets Paid Until pass, and asks for the child as
the parent. It also checks the sheet never holds a password and the log never
records one.
