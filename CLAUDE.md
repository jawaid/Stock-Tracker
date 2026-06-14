# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.
Codex agents should start from [AGENTS.md](./AGENTS.md), which links back to this shared guide.

## Commands

```bash
npm start          # Run on http://127.0.0.1:4173
PORT=4174 npm start  # Run on alternate port
npm run dev        # Hot reload (server restarts on server.js changes; browser reloads on public/ changes)
node --check server.js && node --check public/app.js  # Syntax check only, no test suite
```

Requires Node.js >= 20. No build step — static files served directly from `public/`.

## Architecture

This is a single-file Node.js HTTP server (`server.js`) with a vanilla JS frontend (`public/`). There is no framework, bundler, or test suite.

**server.js** handles everything: static file serving, a live-reload SSE endpoint, portfolio CRUD (`data/positions.json`), and several Yahoo Finance proxy endpoints. All Yahoo Finance requests are server-side only — the browser never calls Yahoo directly.

**Key API endpoints the server exposes:**
- `GET/POST/DELETE /api/positions` — read/write `data/positions.json`; history array is appended on close
- `GET /api/quotes?symbols=…` — proxies Yahoo Finance v7 quote API (30s cache)
- `GET /api/chart?symbol=…` — proxies Yahoo Finance v8 chart API for EMA/lower-structure metrics (per-symbol 30s cache)
- `GET /api/sector-performance` — fetches all 11 SPDR sector ETFs (5-min cache)
- `GET /api/market-condition` — comprehensive dashboard: QQQ/VIX/DXY/credit/breadth signals (2-min cache)
- `GET /api/market-breadth?scope=…` — breadth for sp500/nasdaq100/russell2000/nyse/all scopes (computed on demand; symbol lists cached 24h)
- `GET /__live` — SSE endpoint for browser hot-reload

**Technical indicators computed server-side** (all pure functions in server.js):
- `calculateEma` / `calculateEmaSeries` — 21-period EMA on daily closes
- `calculateSma` / `calculateSmaSeries` — simple moving average variants
- `calculateMcClellanBreadth` — full McClellan Oscillator (MCO) and Summation Index (MCSI) with z-scores
- `buildBreadthProcess` — maps MCO/MCSI state to actionable trading labels (timing window, test-the-turn, press, caution, trim-strength)

**Breadth symbol universe** is fetched from Wikipedia (S&P 500, Nasdaq 100), iShares CSV (Russell 2000), and Nasdaq Trader directory (NYSE). Spark data (batched 50 symbols/request) is used for breadth calculations.

**Data persistence:** `data/positions.json` stores `{ positions: [...], history: [...], watchlists: [...] }` with legacy watchlist normalization for older files. There is no database. The file is written atomically via `writeFile`. Browser `localStorage` mirrors positions, history, and watchlists as a fallback.

**Frontend** (`public/app.js`) is a single large vanilla JS file that renders all UI by DOM manipulation. `public/index.html` is the shell; `public/styles.css` handles all styling. No frontend framework or build tooling.
