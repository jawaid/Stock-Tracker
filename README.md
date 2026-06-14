# Stock Tracking Dashboard

A local dashboard for open stock positions. Add ticker, purchase date, shares, cost basis, and optional stop loss, then refresh prices to see current value, 21-day EMA, Lower Structure, Open Heat, and unrealized gain or loss.

## Run

```bash
bun run start
```

Open `http://127.0.0.1:4173`.

If that port is already in use:

```bash
PORT=4174 bun run start
```

For development with hot reload:

```bash
bun run dev
```

`bun run dev` restarts the server when `server.js` changes. The browser also reloads automatically when files in `public/` change.

Positions are saved in `data/positions.json` and mirrored in browser storage. Quotes are pulled through the local server from Yahoo Finance public quote endpoints, so prices may be delayed or temporarily unavailable.

The 21-day EMA uses daily close prices. Lower Structure is calculated as a 21-day EMA using daily low prices.

Open Heat is calculated from stop losses as the total current dollars at risk if every open position hit its stop today.
