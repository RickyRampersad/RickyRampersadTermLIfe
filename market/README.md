# Branch Trading League

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

Open `market/index.html` as it stands and it works immediately — simulated prices,
a portfolio saved in that browser, a sample leaderboard. Good for showing people
what the game looks like.

The catch is that in demo mode **each person's portfolio lives on their own
device**, so there is no shared leaderboard. For a real competition, do the setup
below.

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
  LEAGUE_PIN: 'BRANCH',      // what the team types to join
  ADMIN_PIN:  'CHANGE-ME',   // only you — lets you reset the league
  STARTING_CASH: 100000,     // play money each player starts with
  COMMISSION: 5,             // charged per trade
  ...
```

Change `ADMIN_PIN` to something only you know. `LEAGUE_PIN` is the code you give
the team.

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

## Running it

Send the team the link and the league code. They enter a name, and they are in —
no account, no password, no app to install. Their place is remembered on their
device.

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

- **Same name = same account.** Someone rejoining on a second device gets their
  existing portfolio rather than a duplicate. It also means anyone who knows a
  colleague's name and the league code could trade as them. Among a branch team
  that is a reasonable trade for having no passwords; if you would rather it were
  tighter, that is a change worth making before you widen the group.
- **GOOGLEFINANCE covers US listings well.** It does not cover the Trinidad and
  Tobago Stock Exchange, so a TTSE league is not possible on this setup.
- **Free and quota-friendly.** No API key, no signup, no billing. Prices come from
  formulas sitting in the sheet, which Google refreshes on its own, and the script
  just reads the values.
- The page carries a plain disclaimer in the footer: imaginary money, delayed
  prices, not advice, not a Guardian product.
