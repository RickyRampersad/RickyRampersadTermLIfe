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

## 3. How a family gets in

A parent registers their own child from the sign-in screen. They give their
name and e-mail, the child's first name and class, the school if they care to,
and a password. That writes two rows — the parent and the child — and signs
them in on the spot.

**What is asked for, and why.** Only what the app needs to teach:

| Asked | Why |
|---|---|
| Child's **first name** | To greet them, and to label the progress a parent sees |
| Child's **class** | To serve the right questions, and to move them up every September |
| **School** — optional | So a teacher can find their class, and the parent sees it on their own screen |
| Parent's **name and e-mail** | To sign in, and to reach them |

**What is never asked for, deliberately:** the child's surname, date of birth,
address or photograph; the parent's occupation, employer, income or address. A
free practice app has no business holding those, and an agency that collected
them here would be collecting them under false pretences. The fact find is
where that conversation belongs, after a parent has asked for it.
`tests/test-academy.js` sends an occupation, an employer, an income and an
address at registration and fails if any of them reaches the sheet.

**The opt-in.** Registration carries one **unticked** box: may the branch tell
them about education savings plans. Ticking writes `yes` and a timestamp to the
Consent columns and puts them on the dashboard's interest list. Leaving it alone
writes nothing, and is the default. **Nobody who left it alone may be contacted
about insurance, ever** — that is the bargain that makes the app free and
trusted, and it is worth more than any lead list.

A child registered this way has no password and an id beginning `child:` — the
parent practises alongside them from their own account, which is what an
Infant 1 needs anyway. Give a child a real e-mail in the Email column instead
and they can sign in on their own.

## 4. The dashboard

Sign in with a row whose Role is `academy` and the first thing in the nav is a
dashboard: families and children, how many signed in this month, questions
attempted, mock papers sat, children by class, children by school, and
registrations month by month.

**It counts children; it does not name them.** No child's name appears on it and
no child's record can be opened from it. The only names on the page are the
parents who ticked the box, and every one of them asked to be there. The tests
fail if a child's name reaches the dashboard, and it is refused to every role
but `academy` — a parent and a teacher included.

## 5. The tabs

**Users** — the only one you touch.

| Column | You fill in | Notes |
|---|---|---|
| Email | yes | Any case, any spacing — it is normalised |
| Name | yes | First name is shown in the app: *Student · Aisha* |
| Role | yes | `student`, `parent` or `teacher` |
| Student Email | for a parent | Links the parent to one child. That child's progress is what the parent sees. |
| Status | to switch off | `disabled` refuses them at once — even a sign-in already open |
| Paid Until | to sell a season | A date. Access runs to the end of that day, then they are refused with a message naming the Academy. Blank = no end. |
| School | optional | Written from registration. Optional there, and optional here. |
| Consent | never by hand | `yes` if the parent ticked the box at registration |
| Consent At | never by hand | When they ticked it |
| Registered By | never by hand | The parent's e-mail, written on the child's row |
| SEA Year | yes, for a child | The year they will sit the S.E.A. — e.g. `2029`. One number, never updated: the app works out the class and moves them up every September. A parent's row needs none; they are placed where their child is. |
| Salt, Hash | **never** | Filled in when they choose a password |
| Created, Last Sign-in, Note | no | |

**Progress** — one row per person: `Email | Updated | JSON`. Leave it alone.

**Activity** — `At | Email | Did | Note`. Every sign-in, refusal and
password choice. Never a password.

## 6. Day to day

| To… | Do |
|---|---|
| Add a family | Normally you do not — the parent registers themselves. To add one by hand: a row for the child (`student`, with the S.E.A. year) and a row for the parent (`parent`, with the child's e-mail in Student Email). |
| Give yourself the dashboard | A row with Role `academy`. |
| Take someone off the interest list | Clear their **Consent** cell. They asked to be removed; that is all it takes. |
| Reset a password | Clear the **Salt** and **Hash** cells on their row. Next sign-in they choose a new one. |
| Switch someone off | `disabled` in Status. |
| Sell a season | A date in Paid Until. Extend it when they pay again. |
| See who is using it | The Activity tab, or Last Sign-in on Users. |

## 7. What is protected, and what is not

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

## 8. Tests

```bash
node tests/test-academy.js     # the real Academy.gs under the fake Sheets, with real SHA-256 and HMAC
node tests/e2e-sea.js          # the page against a fake of the backend (needs playwright)
```

`test-academy.js` adds rows the way you would, chooses a password, refuses it
five times and locks the sixth, tampers with the token, expires it, disables
the row under a live token, lets Paid Until pass, and asks for the child as
the parent. It also checks the sheet never holds a password and the log never
records one.

It then holds the line the product is sold on: registration refuses to store an
occupation, an employer, an income or an address even when they are sent; the
consent box is empty unless a parent ticked it; a parent may write their own
child's record and no other family's; and the dashboard counts children without
naming one, and is refused to everybody but the Academy.
