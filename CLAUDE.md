# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.
Codex agents should start from [AGENTS.md](./AGENTS.md), which links back to this shared guide.

## Commands

```bash
bun install            # Install TypeScript tooling from bun.lock
bun run start          # Run on http://127.0.0.1:4173
PORT=4174 bun run start  # Run on alternate port
bun run dev            # Bun hot mode for server updates plus frontend HMR
bun run typecheck      # Strict TypeScript check, no emit
bun run check          # Typecheck plus Bun full-stack bundle check
```

Requires Bun >= 1.3.14. There is no required production build step. `server.ts` runs directly in Bun, imports `public/index.html`, and lets Bun bundle/transpile the linked `public/app.ts` and `public/styles.css` assets.

## Architecture

This is a Bun full-stack TypeScript app: `server.ts` uses `Bun.serve({ routes })`, serves `public/index.html` as an HTML import route, and exposes API endpoints from the same route table. The frontend is vanilla TypeScript (`public/app.ts`). There is no framework or test suite. TypeScript is checked with `strict: true` in `tsconfig.json`.

**server.ts** handles everything: Bun HTML import serving, portfolio CRUD (`data/positions.json`), and several Yahoo Finance proxy endpoints. All Yahoo Finance requests are server-side only — the browser never calls Yahoo directly.

**Key API endpoints the server exposes:**
- `GET/PUT /api/positions` — read/write `data/positions.json`; history array is appended on close
- `GET /api/quotes?symbols=…` — proxies Yahoo Finance v7 quote API (30s cache)
- `GET /api/sectors` — fetches all 11 SPDR sector ETFs (5-min cache)
- `GET /api/market` — comprehensive dashboard: QQQ/VIX/DXY/credit/breadth signals (2-min cache)
- `GET /api/market/breadth?scope=…` — breadth for sp500/nasdaq100/russell2000/nyse/all scopes (computed on demand; symbol lists cached 24h)

**Technical indicators computed server-side** (all pure functions in `server.ts`):
- `calculateEma` / `calculateEmaSeries` — 21-period EMA on daily closes
- `calculateSma` / `calculateSmaSeries` — simple moving average variants
- `calculateMcClellanBreadth` — full McClellan Oscillator (MCO) and Summation Index (MCSI) with z-scores
- `buildBreadthProcess` — maps MCO/MCSI state to actionable trading labels (timing window, test-the-turn, press, caution, trim-strength)

**Breadth symbol universe** is fetched from Wikipedia (S&P 500, Nasdaq 100), iShares CSV (Russell 2000), and Nasdaq Trader directory (NYSE). Spark data (batched 50 symbols/request) is used for breadth calculations.

**Data persistence:** `data/positions.json` stores `{ positions: [...], history: [...], watchlists: [...] }` with legacy watchlist normalization for older files. There is no database. The file is written atomically via `writeFile`. Browser `localStorage` mirrors positions, history, and watchlists as a fallback.

**Frontend** (`public/app.ts`) is a single large vanilla TypeScript file that renders all UI by DOM manipulation. `public/index.html` links to `./app.ts` and `./styles.css`; Bun rewrites those to generated bundled asset routes at runtime. `public/styles.css` handles all styling.
