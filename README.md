# Stock Tracking Dashboard

A local dashboard for open stock positions. Add ticker, purchase date, shares, and cost basis, then refresh prices to see current value, 21-day EMA, Lower Structure, and unrealized gain or loss.

## Run

```bash
npm start
```

Open `http://127.0.0.1:4173`.

If that port is already in use:

```bash
PORT=4174 npm start
```

Positions are saved in `data/positions.json` and mirrored in browser storage. Quotes are pulled through the local server from Yahoo Finance public quote endpoints, so prices may be delayed or temporarily unavailable.

The 21-day EMA uses daily close prices. Lower Structure is calculated as a 21-day EMA using daily low prices.
