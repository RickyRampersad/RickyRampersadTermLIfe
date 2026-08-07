# Branch Trading League

*A Ricky Rampersad initiative.*

A play-money investing game for the branch team. Everyone starts with the same
imaginary balance and buys or sells real listed instruments at real (delayed)
market prices. Highest portfolio value wins.

**No real money is involved anywhere.** Nobody deposits, withdraws or transfers
anything, no securities are bought or sold, and there is no brokerage account
behind this page. It is a game.

- `market/index.html` — the app the team opens
- `apps-script/Market.gs` — the backend (prices + shared leaderboard)

---

## How you "invest in the Nasdaq and the Dow"

An index is a number, not something you can buy — so the league trades the funds
that track them, the same way a real investor would:

| You want | You buy | What it tracks |
|---|---|---|
| The Dow Jones | **DIA** | Dow Jones Industrial Average |
| The Nasdaq | **QQQ** | Nasdaq 100 |
| The whole US market | **SPY** | S&P 500 |

The live level of the Dow, the Nasdaq Composite, the Nasdaq 100 and the S&P 500
runs across the ticker at the top of the page for reference.

Alongside those, players can trade about twenty large names — Apple, Microsoft,
NVIDIA, Tesla, JPMorgan, Coca-Cola, Boeing and so on. Edit the `UNIVERSE` list in
`Market.gs` to change what is on the menu.

---

## Right now: demo mode

Open `market/index.html` as it stands and it works immediately — simulated prices
and a full sign-in flow. Several people can create accounts and trade on the same
device, each with their own PIN and their own book, and they all appear on the
leaderboard together. Good for showing the team what the game is before you commit
to setting it up.

The catch is that in demo mode **everything lives in that one browser**. There is
no shared league — your phone and a colleague's phone know nothing about each
other. For a real competition, do the setup below.

---

## Setup: real prices and a shared leaderboard

About ten minutes, once.

### 1. Create the spreadsheet

1. Make a new Google Sheet (name it something like *Branch Trading League*).
2. **Extensions → Apps Script**.
3. Delete whatever is in `Code.gs`, paste in the contents of
   `apps-script/Market.gs`, and save.

### 2. Set your codes

At the top of the script:

```js
var MARKET = {
  LEAGUE_PIN: 'BRANCH',      // typed once, when someone opens an account
  ADMIN_PIN:  'CHANGE-ME',   // yours only — resets the league, clears a PIN
  STARTING_CASH: 100000,     // play money each player starts with
  COMMISSION: 5,             // charged per trade
  PIN_MIN: 4, PIN_MAX: 8,    // length of the PIN each player chooses
  MAX_ATTEMPTS: 5,           // wrong PINs before the account is held shut
  LOCKOUT_MINUTES: 15,
  ...
```

Change `ADMIN_PIN` to something only you know. `LEAGUE_PIN` is the code you give
the team — it is needed once, to open an account, not every time they sign in.

### 3. Build the sheet

Run the `setupMarket` function once from the Apps Script editor (select it from the
dropdown, press **Run**). Google will ask you to review permissions — approve them.
It needs to read and write this one spreadsheet.

It creates four tabs: **Players**, **Holdings**, **Trades** and **Prices**.

Give the sheet a minute, then run `testPrices` and check the log. You want
*"Every instrument has a price."* If some are still blank, the GOOGLEFINANCE
formulas are still calculating — wait and run it again.

### 4. Deploy it

**Deploy → New deployment → Web app**

| Setting | Value |
|---|---|
| Execute as | **Me** |
| Who has access | **Anyone** |

Copy the URL it gives you — it ends in `/exec`.

> "Anyone" sounds alarming but is what makes the page reachable without a Google
> login. The script only ever touches this one spreadsheet, and joining still
> requires your league code.

### 5. Point the app at it

In `market/index.html`, near the bottom:

```js
const CONFIG = {
  API_URL: "https://script.google.com/macros/s/XXXXX/exec"
};
```

Commit and push. The demo banner disappears and everyone shares one live league.

---

## Signing in

Anyone on the branch team can play — agents, staff, whoever you invite. Each
person has their own account and their own PIN, so everybody's book is their own
and the ranking means something.

**First time.** Send the team the link and the league code. Each person taps
*Create your account*, enters their name, the league code, and a PIN of their own
choosing (4–8 digits). The league code is only needed here, once.

**After that.** Name and PIN. Nothing else.

**How the PIN is held.** It is salted and hashed with SHA-256 before it touches
the spreadsheet, so the sheet holds a scramble, not the PIN. Nobody can read it
back — not the team, not you. Five wrong PINs in a row and the account is held
shut for fifteen minutes, so nobody can sit and guess four digits.

**Forgotten PIN.** You clear it, they choose a new one:

```
POST  {"action":"resetPin","adminPin":"YOUR-ADMIN-CODE","name":"Anisa"}
```

Or, more simply, open the **Players** tab and blank that person's *PIN hash* and
*Salt* cells. Either way their cash, positions and history are untouched — the
next time they sign in the page asks them to set a new PIN, and they need the
league code to do it, so a cleared account cannot be claimed by someone else in
the meantime.

Signing in issues a fresh token, which quietly signs them out anywhere else
they were signed in. Their place is remembered on the device until they sign out.

---

## The ranking

Everyone is ranked by what their portfolio is worth right now — cash plus every
position valued at the current price. The **Leaderboard** on the page lists the
whole league in order, marks the person looking at it, and shows each player's
cash, holdings, total and return. Your own standing also sits at the top of the
page, under your total, so you can see where you are without scrolling.

Because everybody starts at the same balance and trades off the same prices, the
order is a straight comparison — no handicaps, nothing to configure.

---

## House rules

- **Prices** come from Google Finance and are delayed, typically up to about
  20 minutes for US listings. Everyone trades off the same delayed prices, so the
  competition stays fair.
- **Commission** of $5 per trade is deducted so nobody can churn for free.
- **Whole shares only.** No fractional shares, no short selling, no borrowing —
  you cannot spend cash you do not have or sell shares you do not hold.
- **Prices refresh** on the page every minute.

### Starting a new round

Change `ADMIN_PIN` in the script, then POST `{"action":"reset","pin":"..."}` to the
web app URL. Simpler in practice: open the sheet and delete the rows under the
header on the **Players**, **Holdings** and **Trades** tabs. Everyone starts fresh
at the opening balance.

### Watching from the sheet

Every trade is logged on the **Trades** tab with a timestamp, who placed it, the
side, the price and the resulting cash. Useful for a Friday recap — or for
settling an argument.

---

## Notes

- **A PIN is not a password.** Four digits, guarded by a lockout, is the right
  weight for a play-money game among colleagues and keeps the friction near zero.
  It is not what you would put in front of anything real. Nothing sensitive lives
  in this spreadsheet — imaginary balances and a list of first names — so the
  exposure if a PIN were guessed is that somebody's game gets meddled with.
- **Names are the identity**, and they are what the ranking shows. People can
  enter a full name if you want the board to read that way. Two players called
  Kevin need to be *Kevin B* and *Kevin R*, or the second cannot open an account.
- **GOOGLEFINANCE covers US listings well.** It does not cover the Trinidad and
  Tobago Stock Exchange, so a TTSE league is not possible on this setup.
- **Free and quota-friendly.** No API key, no signup, no billing. Prices come from
  formulas sitting in the sheet, which Google refreshes on its own, and the script
  just reads the values.
- The page carries a plain disclaimer in the footer: imaginary money, delayed
  prices, not advice, not a Guardian product.
