# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.
Codex agents should start from [AGENTS.md](./AGENTS.md), which links back to this shared guide.

## Commands

```bash
bun install            # Install TypeScript tooling from bun.lock
bun run start          # Run on Bun's default port, http://127.0.0.1:3000
PORT=3001 bun run start  # Use only if the default port is unavailable
bun run dev            # Bun hot mode for server updates plus frontend HMR
bun run lint           # Biome lint/format check
bun run format         # Apply Biome formatting
bun run typecheck      # Strict TypeScript check, no emit
bun run check          # Biome, TypeScript, and Bun full-stack bundle check
```

Requires Bun >= 1.3.14. There is no required production build step. `server.ts` runs directly in Bun, imports `public/index.html`, and lets Bun bundle/transpile the linked `public/app.ts` and `public/styles.css` assets.

## Architecture

This is a Bun full-stack TypeScript app: `server.ts` uses `Bun.serve({ routes })`, serves `public/index.html` as an HTML import route, and exposes API endpoints from the same route table. The frontend is vanilla TypeScript (`public/app.ts`). Bun tests cover focused server persistence behavior, and TypeScript is checked with `strict: true` in `tsconfig.json`.

**server.ts** handles Bun HTML import serving, route wiring, portfolio CRUD, and several Yahoo Finance proxy endpoints. Portfolio persistence is backed by `server/portfolio-store.ts` using Bun's built-in SQLite driver. All Yahoo Finance requests are server-side only — the browser never calls Yahoo directly.

**Key API endpoints the server exposes:**
- `GET/PUT /api/positions` — read/write the SQLite-backed portfolio snapshot; history array is appended on close
- `GET /api/quotes?symbols=…` — proxies Yahoo Finance v7 quote API (30s cache)
- `GET /api/sectors` — fetches all 11 SPDR sector ETFs (5-min cache)
- `GET /api/market` — comprehensive dashboard: QQQ/VIX/DXY/credit/breadth signals (2-min cache)
- `GET /api/market/breadth?scope=…` — breadth for sp500/nasdaq100/russell2000/nyse/all scopes (computed on demand; symbol lists cached 24h)
- `GET /api/analyze?symbol=…` — two-year OHLC/volume/EMA chart data, technical state, news sentiment, and valuation/fundamental metrics for one ticker

**Technical indicators computed server-side**:
- `calculateEma` / `calculateEmaSeries` — 21-period EMA on daily closes
- `calculateSmaSeries` — simple moving average series
- `calculateMcClellanBreadth` — full McClellan Oscillator (MCO) and Summation Index (MCSI) with z-scores
- `buildBreadthProcess` — maps MCO/MCSI state to actionable trading labels (timing window, test-the-turn, press, caution, trim-strength)

**Breadth symbol universe** is fetched from Wikipedia (S&P 500, Nasdaq 100), iShares CSV (Russell 2000), and Nasdaq Trader directory (NYSE). Spark data (batched 50 symbols/request) is used for breadth calculations.

**Data persistence:** `data/portfolio.sqlite` stores open positions, closed-position history, watchlists, and watchlist items in SQLite tables. On first database initialization, an existing ignored `data/positions.json` file is imported once as the initial snapshot for migration compatibility. Browser JSON import/export is still supported, and browser `localStorage` mirrors positions, history, and watchlists as a fallback.

**Frontend** (`public/app.ts`) is a single large vanilla TypeScript file that renders all UI by DOM manipulation. `public/index.html` links to `./app.ts` and `./styles.css`; Bun rewrites those to generated bundled asset routes at runtime. `public/styles.css` handles all styling.
