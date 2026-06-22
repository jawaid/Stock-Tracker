# Stock Tracker Repository Guide

Stock Tracker is a local-first, single-user Bun application for portfolio tracking, risk
management, watchlists, market breadth, sector performance, and stock research. It is a
decision-support tool, not a brokerage or financial-advice product.

Read [HANDOFF.md](./HANDOFF.md) for current status, open issues, and immediate priorities. Treat
the source and tests as authoritative, and keep `HANDOFF.md` current at logical handoff points.

## Architecture

- Bun 1.3.14+, strict TypeScript, vanilla browser TypeScript, Biome, Lightweight Charts, and
  SQLite. Do not add a frontend framework for narrow work.
- `server.ts` is the entry point and route composition root; focused server logic belongs under
  `server/`. The browser calls local `/api/*` routes only.
- `public/index.html`, `public/app.ts`, and `public/styles.css` own structure, behavior, and
  presentation respectively.
- `data/portfolio.sqlite` is the primary store; `localStorage` is a fallback. Keep SQLite writes
  transactional, foreign keys enabled, and legacy import payloads compatible.
- External market data is unofficial, delayed, nullable, and untrusted. Preserve source/freshness
  context and degrade individual failures without blanking unrelated data.

## Working Rules

- Follow existing patterns, keep changes tightly scoped, and never overwrite unrelated user work.
- Never inspect unnecessarily, expose, stage, or commit personal portfolio data, secrets, `data/`,
  or environment files. Do not commit or push unless explicitly asked.
- Validate and normalize API/persistence inputs, cap payloads, escape external text used in HTML,
  and keep numeric values numeric until rendering.
- Preserve the quiet, dense, accessible dashboard style, active-tab behavior, responsive layouts,
  and explicit chart sizing (`autoSize: false`). Confirm destructive actions and do not rely on
  color alone.
- Add focused deterministic tests for changed formulas, normalization, persistence, and analysis.
  Do not make tests depend on live providers or real portfolio data.
- Schema or user-facing metric changes require migration/backward-compatibility coverage and a
  `HANDOFF.md` update. Update `README.md` when setup or top-level capabilities change.

Stable definitions unless explicitly changed: 21-day EMA uses closes; Lower Structure uses a
21-day EMA of lows; RSI uses 14 daily periods; Open Heat is
`max(0, current price - stop) * shares`; UER is the priced value below 5% unrealized profit divided
by priced portfolio value; FER is the priced value with a price-to-stop gap below 5% divided by
priced portfolio value. Label sampled breadth and McClellan results as proxies.

## Commands

```bash
bun install
bun run dev       # http://127.0.0.1:3000
bun run start
bun run format
bun run check     # lint, typecheck, tests, and bundle validation
```

Run `bun run check` before finishing and verify meaningful UI changes in the running app at desktop
and mobile widths. Report anything that could not be validated.

## Direction

Favor reliability before expansion: backups/restores, schema migrations, write-conflict protection,
provider resilience, and workflow tests. Then split the large server/frontend modules, strengthen
typed contracts, and centralize tested financial formulas before adding alerts, position sizing,
performance history, or journal features.
