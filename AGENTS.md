# Stock Tracker Repository Guide

Stock Tracker is a local-first, single-user Bun application for portfolio tracking, risk
management, watchlists, market breadth, sector performance, and stock research. It is a
decision-support tool, not a brokerage or financial-advice product.

Read [PROJECT_STATUS.md](./PROJECT_STATUS.md) first for the concise current state, then
[HANDOFF.md](./HANDOFF.md) for continuation details, open issues and history. Read
[README.md](./README.md) for setup and feature definitions. Historical log entries are
not current instructions; inspect Git status and the latest commit before work. Treat
the source and tests as authoritative, and keep `HANDOFF.md` current at logical handoff points.

At the end of every meaningful work session or handoff to the user, update `PROJECT_STATUS.md`
with the latest project state, completed work, validation results, known issues, and exact next
recommended step.

For a new-chat handoff, refresh the continuation prompt in README.md and the current
snapshots in PROJECT_STATUS.md/HANDOFF.md. Distinguish pushed application commits from
local documentation edits. Preserve all local changes; historical commit/push authorization
does not authorize new commits or rule changes. Temporary reports under `/tmp` may disappear;
keep aggregate findings and validation in the documents, without copying private watchlists.

Minervini setup selection and Entry Type geometry are intentionally separate. Preserve the
most-recent eligible setup base. The 150-bar geometry is advisory label metadata only and
must not affect contractions, pivot, stop, buy point, status or lifecycle/history.

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

On this Mac, LaunchAgent `com.jawaid.stock-tracker` manages port 3000. Do not start a
competing server. After backend changes, restart the managed service when validating
the running app; README documents the commands. A new chat does not restart the service.

Run `bun run check` before finishing and verify meaningful UI changes in the running app at desktop
and mobile widths. Report anything that could not be validated.

## Direction

Favor reliability before expansion: backups/restores, schema migrations, write-conflict protection,
provider resilience, and workflow tests. Then split the large server/frontend modules, strengthen
typed contracts, and centralize tested financial formulas before adding alerts, position sizing,
performance history, or journal features.
