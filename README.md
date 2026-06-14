# Stock Tracking Dashboard

A local dashboard for open stock positions. Add ticker, purchase date, shares, cost basis, and optional stop loss, then refresh prices to see current value, 21-day EMA, Lower Structure, Open Heat, and unrealized gain or loss.

## Run

Install dependencies:

```bash
bun install
```

```bash
bun run start
```

Open `http://127.0.0.1:3000`.

If that port is already in use:

```bash
PORT=3001 bun run start
```

For development with hot reload:

```bash
bun run dev
```

`bun run dev` uses Bun hot mode for server updates and Bun's frontend HMR for files linked from `public/index.html`.

Run quality checks:

```bash
bun run lint
bun run typecheck
bun run check
```

The app uses strict TypeScript and Biome for linting/formatting. `server.ts` runs directly in Bun as a full-stack app: it imports `public/index.html`, and Bun bundles/transpiles the linked `public/app.ts` and `public/styles.css` assets.

Positions are saved in `data/portfolio.sqlite` through Bun's built-in SQLite driver and mirrored in browser storage. On first run after the SQLite migration, an existing ignored `data/positions.json` file is imported once as the initial database snapshot. Browser import/export still uses JSON files. Quotes are pulled through the local server from Yahoo Finance public quote endpoints, so prices may be delayed or temporarily unavailable.

The 21-day EMA uses daily close prices. Lower Structure is calculated as a 21-day EMA using daily low prices.

Open Heat is calculated from stop losses as the total current dollars at risk if every open position hit its stop today.
