# Stock Tracker Project Guide

Last reviewed: 2026-06-21

This document is the durable product and architecture guide for developers and AI coding
assistants. Read it together with `AGENTS.md`, `AI_INSTRUCTIONS.md`, `HANDOFF.md`, and `CLAUDE.md`
before changing the application.

## Maintenance Rule

Update this file whenever a major feature is completed or when the architecture, persistence
model, external data sources, development workflow, known limitations, or roadmap materially
changes. Move completed roadmap items into Current Features and keep maturity labels honest. Put
time-sensitive work status in `HANDOFF.md` and normative agent rules in `AI_INSTRUCTIONS.md`.

## Project Purpose

### What the application does

Stock Tracker is a local-first dashboard for an active stock investor or swing trader. It combines
portfolio tracking, stop-loss risk management, watchlists, market breadth, sector performance, and
single-stock research in one browser application.

The application helps a user:

- Record open stock lots and their purchase date, share count, cost basis, and stop loss.
- Monitor current price, daily change, 21-day EMA, a 21-day EMA of daily lows called Lower
  Structure, RSI(14), 52-week range, and year-to-date performance.
- Measure portfolio risk through Open Heat, UER, FER, allocation, and unrealized profit/loss.
- Close all or part of a position and retain realized trade history.
- Maintain multiple watchlists and open a watched symbol directly in the Analyze workspace.
- Evaluate sector ETF performance over daily, weekly, and monthly periods.
- Evaluate market conditions through price structure, breadth, credit, volatility, currency,
  speculative appetite, McClellan indicators, and participation history.
- Analyze one ticker with a candlestick/volume chart, 21/50/200 EMAs, technical state, recent news,
  headline sentiment, and selected fundamental metrics.

This is a decision-support tool, not an order-entry system, brokerage integration, or source of
financial advice.

### Intended users

- Primary: one self-directed investor or trader running the app locally on a personal computer.
- Secondary: a developer or AI coding assistant extending the user's trading workflow.
- Not currently designed for: teams, advisers managing client accounts, public SaaS users, or
  regulated recordkeeping.

## Technology Stack

### Languages

- TypeScript for the Bun server, domain helpers, tests, and browser application.
- HTML for the static application structure and accessible controls.
- CSS for the design system, responsive layouts, tables, charts, and status states.
- SQL embedded in TypeScript for SQLite schema creation and persistence.

### Frameworks and libraries

- Bun 1.3.14 or newer: runtime, HTTP server, HTML/TypeScript/CSS bundling, hot reload, test runner,
  and built-in SQLite driver.
- Vanilla browser TypeScript: no React, Vue, routing framework, or client state library.
- TradingView Lightweight Charts 5.2: candlestick, EMA, and volume rendering in Analyze.
- Biome 2.5: formatting and linting.
- TypeScript 6 with strict compiler settings and no emitted build artifacts.

### Databases and browser storage

- Primary store: `data/portfolio.sqlite`, using Bun's `bun:sqlite` driver in WAL mode with foreign
  keys enabled.
- Tables: `portfolio_meta`, `positions`, `closed_positions`, `watchlists`, and `watchlist_items`.
- Writes replace the complete portfolio snapshot inside one SQLite transaction while preserving
  explicit sort order.
- Migration compatibility: on first database initialization, an ignored legacy
  `data/positions.json` snapshot is imported if present.
- Browser fallback: positions, history, and watchlists are mirrored in `localStorage`; the active
  tab is stored in `sessionStorage`, and the active watchlist ID is stored in `localStorage`.
- Personal data and SQLite sidecar files are excluded by `.gitignore` and must never be committed.

### External APIs and data sources

All external calls are made by the local Bun server. The browser only calls local `/api/*` routes.

- Yahoo Finance public quote endpoint: current/previous price metadata.
- Yahoo Finance public chart endpoint: daily OHLCV, EMA inputs, sector returns, market gauges, and
  index/ETF price histories.
- Yahoo Finance public spark endpoint: batched constituent histories for breadth calculations.
- Yahoo Finance public search/news endpoint: company metadata and recent headlines.
- Yahoo Finance public fundamentals time-series endpoint: revenue, income, EPS, free cash flow,
  market cap, P/E, PEG, and price/sales metrics.
- Wikipedia: S&P 500 and Nasdaq 100 constituent lists.
- iShares public IWM holdings CSV: preferred Russell 2000 proxy universe.
- Nasdaq Trader symbol directories: NYSE and all-listed fallback/sample universes.

These are public, unofficial, unauthenticated dependencies. Their schemas, availability, delays,
rate limits, and licensing can change without notice.

## Current Features

### Complete for the current local use case

- **Overall Dashboard:** invested capital, market value, unrealized P/L, daily change, open lot
  count, allocation donut, Open Heat details, and stop coverage.
- **Open Heat:** `max(0, current price - stop) * shares`, summed across positions with stops.
- **UER (Unproven Exposure Ratio):** market value of lots with unrealized P/L below 5%, divided by
  priced portfolio market value.
- **FER (Fragile Exposure Ratio):** market value of lots where
  `(current price - stop) / current price < 5%`, divided by priced portfolio market value.
- **Positions:** add on demand, edit, delete with confirmation, search, sort, per-share or total cost
  entry, stop-loss entry, current metrics, and responsive horizontal table handling.
- **Closing positions:** full or partial sale using close date, shares sold, and sale price; remaining
  shares stay open and the closed portion is added to History.
- **History:** buy/sell dates, shares, buy/sell prices, holding period, proceeds, and realized P/L.
- **Multiple watchlists:** create, rename, delete, switch, search, sort by displayed columns, add one
  or many comma/space/semicolon-separated symbols, deduplicate within a list, and delete symbols.
- **Watchlist analysis action:** opens the selected symbol directly in the Analyze tab.
- **Quote analytics:** current price, day change, 21-day close EMA, Lower Structure (21-day EMA of
  daily lows), RSI(14), 52-week high/low and distances, and YTD return.
- **Sector Performance:** all 11 SPDR sector ETFs, daily/weekly/monthly heatmaps, ranking table,
  current price, 21-day EMA, and a normalized cross-period rank score from 0 to 1.
- **Market Condition:** aggregate Engage/Caution/Do Not Engage stance derived from available
  risk-on, risk-off, and neutral signals.
- **Risk gauges:** QQQ structure, S&P 500 stocks above 5DMA and 20DMA, RSP/SPY breadth proxy,
  SHY/HYG credit ratio, VIX, DXY, and BTCUSD.
- **Normalized McClellan analysis:** MCO (19/39 EMA difference), cumulative MCSI, MCSI 10DMA,
  rolling 63-session z-scores, process steps, and selectable S&P 500, all-market, Nasdaq 100,
  Russell 2000, and NYSE proxy scopes.
- **Participation indexes and history:** QQQE, RSP, NYSE Composite, IWM trend cards and historical
  percentage of S&P 500 components above 5/20/50/200-day SMAs.
- **Analyze:** ticker search; six-month default with one- and two-year chart ranges; daily
  candlesticks; a separate volume pane; 21/50/200 EMAs; RSI, support/resistance, volume comparison,
  recent news, keyword sentiment, technical state, and selected fundamental metrics.
- **Import/export:** JSON backup and restore for positions, closed history, and watchlists, including
  compatibility with older payload shapes.
- **Persistence and recovery:** SQLite primary storage, transactional snapshot replacement, browser
  fallback, and one-time legacy JSON import.
- **Development workflow:** Bun hot reload, strict TypeScript, Biome checks, focused Bun tests, and a
  full-stack bundle validation command.

### Partially complete or intentionally approximate

- **Market breadth universes:** S&P 500 and Nasdaq 100 are component proxies; all-market, Russell
  2000, and NYSE scopes may be sampled to control request volume. Results are not official exchange
  breadth statistics.
- **McClellan indicators:** calculated from available component close-to-close advances/declines,
  not an official NYSE/Nasdaq advance-decline feed. Missing symbols and sampled universes affect
  values.
- **Market-condition classifications:** deterministic heuristics based on user-defined thresholds;
  they are useful workflow signals but are not validated forecasting models.
- **News sentiment:** a small positive/negative keyword dictionary applied to headlines. It does not
  understand context, negation, source quality, or article body text.
- **Fundamental analysis:** presents a selected set of Yahoo time-series values and simple growth,
  margin, and quality checks. It is not a complete financial statement model or valuation engine.
- **External-data resilience:** individual sectors, signals, news, or fundamentals can degrade to an
  unavailable state, but there is no secondary quote provider or durable offline market-data cache.
- **Responsive tables:** layouts adapt and wide tables scroll horizontally; there is no compact
  mobile-specific row/card view.
- **Ticker validation:** input format is validated, but a symbol's existence is only discovered when
  market data is requested.

## Application Architecture

### Runtime shape

The project is a single-process Bun full-stack application. `server.ts` imports `public/index.html`;
Bun serves the HTML and bundles the linked TypeScript and CSS at runtime. The same process exposes
the local JSON API and writes SQLite data. No production build step is required.

### Major modules and key files

- `server.ts`: application entry point, Bun routes, response/error helpers, quote/sector/market data
  fetchers, in-memory caches, constituent-universe loaders, breadth and market-condition
  orchestration, and API handlers.
- `server/analyze.ts`: two-year stock chart acquisition, EMA/volume/RSI technical analysis, news and
  keyword sentiment, fundamentals time-series parsing, and five-minute analysis cache.
- `server/indicators.ts`: reusable finite-number guards, EMA/SMA/RSI calculations, rolling z-scores,
  percent change, chart normalization, and participation-history calculations.
- `server/portfolio-types.ts`: persisted portfolio, closed trade, watchlist, and API response types.
- `server/portfolio-normalization.ts`: input validation, legacy aliases, watchlist normalization,
  ID handling, and payload limits at the domain boundary.
- `server/portfolio-store.ts`: SQLite lifecycle, schema initialization, first-run legacy migration,
  row mapping, and transactional snapshot reads/writes.
- `public/index.html`: semantic structure for the top toolbar and seven tabs: Overall Dashboard,
  Market Condition, Sector Performance, Positions, Watch List, Analyze, and History.
- `public/app.ts`: browser state, storage fallback, formatting, portfolio formulas, all renderers,
  forms, sorting/filtering, import/export, API refresh orchestration, chart lifecycle, and event
  binding.
- `public/styles.css`: design tokens, layouts, tables, state colors, charts, controls, and responsive
  breakpoints at 1400px and 760px.
- `server/*.test.ts`: focused unit/persistence tests for normalization, SQLite round trips,
  indicators, sentiment, and technical alignment.
- `README.md`: short setup and product introduction.
- `AGENTS.md`: repository instruction entry point and documentation reading order.
- `AI_INSTRUCTIONS.md`: coding standards and development rules for future AI agents.
- `HANDOFF.md`: current status, recent changes, open issues, and recommended next tasks.
- `CLAUDE.md`: concise commands, architecture, persistence, and implementation notes.
- This file: durable product, architecture, feature, limitation, debt, and roadmap context.
- `package.json`, `tsconfig.json`, and `biome.json`: runtime scripts, strict compiler policy, and
  formatting/lint policy.

### Local API routes

- `GET /api/positions`: read the full SQLite portfolio snapshot.
- `PUT /api/positions`: validate and replace positions, history, and watchlists.
- `GET /api/quotes?symbols=...`: quote and one-year chart-derived metrics for at most 40 symbols per
  request.
- `GET /api/sectors`: cached sector ETF performance.
- `GET /api/market`: cached market condition, S&P 500 breadth, and participation history.
- `GET /api/market/breadth?scope=...`: on-demand McClellan process for a selected breadth scope.
- `GET /api/analyze?symbol=...`: chart, technicals, news/sentiment, and fundamentals for one symbol.

### Cache behavior

- Quotes: 30 seconds per symbol.
- Market condition: 2 minutes.
- Sector performance: 5 minutes.
- Analyze payload: 5 minutes per symbol.
- Constituent symbol lists: 24 hours.
- All caches are process memory only and reset when the server restarts.

### Data flow

1. On startup, the browser binds events, requests `/api/positions`, and falls back to browser-saved
   data if the local API cannot be reached.
2. The UI renders immediately from in-memory state, then `refreshDashboard()` loads quotes,
   sectors, and market conditions in parallel.
3. The server fetches and normalizes external data, computes indicators and classifications, caches
   responses, and returns JSON with explicit unavailable/error fields where possible.
4. The browser stores quote/market payloads in memory, derives portfolio-level dollar and risk
   metrics, escapes external text before HTML insertion, and rerenders the active tab.
5. Portfolio and watchlist edits update browser state and `localStorage` first, then send the entire
   normalized snapshot to `PUT /api/positions`; SQLite replaces it transactionally.
6. Analyze requests switch to the Analyze tab, clear the prior chart, fetch one symbol, and render
   chart and research panels. Chart range changes filter the already-fetched two-year series.
7. The dashboard refreshes every 60 seconds while visible and refreshes again when the document
   returns to the foreground.

## Development Standards

### Required workflow

```bash
bun install
bun run dev       # local development with hot reload at http://127.0.0.1:3000
bun run format
bun run check     # lint, typecheck, tests, and Bun bundle validation
```

- Use Bun, not npm/Node scripts, for the documented workflow.
- Run `bun run check` before committing. SQLite tests need permission to create temporary files.
- Keep personal files under `data/` out of Git.
- Add focused tests when changing indicator math, normalization, persistence, or server-side
  analysis logic. Expand to browser interaction tests for user workflows when test infrastructure
  is added.
- Verify meaningful UI changes in the running app at desktop and mobile widths.
- Do not commit automatically unless the user asks for a commit.

### Coding conventions

- Strict TypeScript, ES modules, target ES2023, and no emitted typecheck output.
- Biome formatting: 2-space indentation, 100-character line width, double quotes, and semicolons.
- Prefer existing helpers and server-side structured calculations over duplicated ad hoc logic.
- Normalize and validate data at API/persistence boundaries; treat all external payloads as
  untrusted and nullable.
- Keep values numeric internally and format currency, percentages, dates, and compact numbers only
  at the render boundary.
- Escape dynamic/external text before interpolating it into `innerHTML`.
- Preserve backward compatibility for imported portfolio/watchlist payloads unless a migration is
  explicitly planned.
- Use succinct comments only for non-obvious math or control flow.

### UI/UX guidelines

- Preserve the quiet, information-dense operational dashboard style; this is a working tool, not a
  marketing site.
- Reuse CSS variables in `:root`, the 8px radius, restrained shadow, and existing surface/line
  hierarchy.
- Use blue for primary actions, teal/green for constructive or risk-on states, amber for caution,
  red for loss/risk-off/destructive states, and muted gray for unavailable/secondary information.
- Keep forms hidden until requested, retain the active tab after actions, and avoid redirecting the
  user away from their current workflow unless the action explicitly opens another view.
- Use segmented controls for view/range choices, searchable sortable tables for dense data, status
  text for asynchronous operations, and confirmation dialogs for destructive actions.
- Maintain semantic headings, labeled controls, `role="status"`, visually hidden legends, and active
  state attributes. Do not rely on color alone where a text label can clarify the state.
- Keep the 1540px content maximum, 1400px layout reduction, and 760px mobile breakpoint unless a
  deliberate responsive redesign replaces them.
- Give charts stable explicit dimensions and manually resize Lightweight Charts; do not re-enable
  its `autoSize` option because it previously triggered ResizeObserver loop errors.
- Ensure long tables remain readable through stable column widths and horizontal scrolling.

### Error-handling patterns

- API JSON and text responses set `cache-control: no-store`; unsupported methods return 405 and an
  `Allow` header, unknown API routes return 404, and uncaught server errors become JSON 500s.
- Request bodies are capped at 1 MB. Portfolio payloads are normalized and constrained to 500 open
  positions, 2,000 history rows, 30 watchlists, and 1,000 total watchlist items.
- Quote, sector, market, and breadth fetchers generally convert source failures into unavailable
  records so one bad symbol does not blank an entire page.
- Analyze requires chart data but uses `Promise.allSettled` so news or fundamentals can fail without
  losing the chart.
- Frontend async functions use loading flags plus `try/catch/finally`, preserve the last usable
  state where practical, and show concise status/error text instead of raw exceptions.
- Persistence failures retain the browser copy and tell the user that the workspace database could
  not be updated.
- Destructive position/watchlist actions require browser confirmation.

## Known Limitations

- No authentication, authorization, encryption-at-rest, user separation, or remote synchronization.
- Designed for one local process and one user; concurrent browser writes use last-write-wins whole
  snapshot replacement.
- No formal schema migration/versioning system beyond `CREATE TABLE IF NOT EXISTS` and the one-time
  JSON bootstrap marker.
- Yahoo Finance and source-list endpoints are unofficial dependencies with no availability or
  correctness SLA; market prices may be delayed or missing.
- Fixed USD formatting even when a returned security uses another currency.
- Portfolio analytics do not account for commissions, fees, dividends, splits, taxes, cash, short
  positions, options, or multi-currency conversion.
- Day change and technical values use daily/public endpoint data and are not streaming intraday
  analytics.
- Open Heat clamps positions whose stop is above current price to zero rather than reporting a
  negative distance or modeling gap/slippage risk.
- UER and FER are position-value ratios based only on priced open lots; unavailable quotes can
  reduce the effective denominator.
- Sector performance is represented by SPDR ETFs, not direct constituent aggregation.
- Breadth sampling and missing symbols can change MCO/MCSI and participation values between data
  refreshes or source changes.
- Analyze supports daily bars and up to two years only; no drawing tools, indicator configuration,
  comparisons, earnings markers, or intraday timeframes.
- History is a simple ledger with no filters, aggregation, journal notes, tags, or tax-lot methods.
- Test coverage is focused server-side; there are no committed browser end-to-end, accessibility,
  visual-regression, API-contract, or external-provider fixture tests.

## Technical Debt

### Areas needing refactoring

1. **Split `public/app.ts` (about 4,000 lines):** extract typed state/models, API client, portfolio
   calculations, storage, reusable table sorting, and per-tab render/controller modules.
2. **Split `server.ts` (about 2,500 lines):** extract route handlers, Yahoo client, caches,
   constituent providers, breadth calculations, market classifiers, sector service, and
   configuration.
3. **Reduce `any`:** strict mode is enabled, but broad `AnyRecord`/`any` usage weakens contracts.
   Define schemas for Yahoo responses and local API payloads, ideally with runtime validation.
4. **Remove duplicated normalization:** position/watchlist compatibility logic exists in both the
   browser and server. Establish one shared domain module usable by both bundles.
5. **Replace full-snapshot writes:** add row-level repository methods or optimistic versioning to
   prevent lost updates and reduce unnecessary database churn.
6. **Add schema migrations:** version database changes and test upgrades from prior schemas.
7. **Create provider boundaries:** wrap Yahoo and universe sources behind interfaces, add fixtures,
   centralize retries/timeouts, and allow a supported paid provider later.
8. **Centralize formulas and signal definitions:** portfolio formulas are client-side while market
   formulas are server-side. Move domain math into tested shared/server modules with documented
   threshold configuration.
9. **Improve frontend feedback:** replace prompt/confirm flows with accessible modals and distinguish
   browser-only saves from durable SQLite saves more persistently.
10. **Expand automated coverage:** cover close/partial-close math, UER/FER/Open Heat, sector scores,
    McClellan calculations, route validation, import/export, tab retention, watchlist actions, and
    chart resize behavior.

## Missing Features

- Supported brokerage import/synchronization and reconciliation.
- User-configurable alert rules for stops, EMA/Lower Structure breaks, RSI, and market-condition
  changes.
- Position sizing and planned-trade risk calculator before entry.
- Portfolio equity curve, realized/unrealized performance over time, drawdown, benchmark comparison,
  and contribution analysis.
- Trading journal fields such as setup, thesis, tags, screenshots, mistakes, and review notes.
- Corporate-action, dividend, fee, tax-lot, cash, short, option, and multi-currency handling.
- Saved Analyze studies, configurable indicators/timeframes, symbol comparison, and chart drawings.
- Richer fundamental history, estimates, earnings calendar, valuation history, and source dates.
- Official breadth data or a configurable professional market-data provider.
- Automated database backup/restore, remote sync, authentication, and deployment documentation.
- First-class mobile table/card experiences and broader keyboard/accessibility testing.

## Future Roadmap

### Recommended next features

The next user-facing investments should be a planned-trade position-sizing workspace, configurable
alerts, portfolio performance history, and a richer trading journal. Before those features expand
the data model, complete the P0 backup/migration work and begin the P1 modular extraction so new
functionality does not deepen the current monoliths.

### Prioritized backlog

#### P0: Reliability and data safety

1. Add automated timestamped SQLite backups plus a tested restore flow before expanding persistence.
2. Add database schema versioning/migrations and optimistic revision checks for snapshot writes.
3. Introduce external-request timeouts, bounded retries with backoff, rate-limit handling, and clear
   data-freshness/source metadata throughout the UI.
4. Add route and browser workflow tests for position CRUD, partial closes, import/export, multiple
   watchlists, Watch List to Analyze navigation, and server-unavailable browser fallback.

#### P1: Maintainability

1. Extract `server.ts` services and `public/app.ts` tab modules without changing behavior.
2. Introduce shared typed domain/API contracts and runtime payload validation; steadily eliminate
   `any` from persistence and market-data boundaries.
3. Move Open Heat, UER, FER, position derivation, sector scoring, and market classifications into
   small tested domain modules.
4. Add fixture-based Yahoo/provider tests so calculations can be verified without live network
   access.

#### P2: Highest-value user features

1. Add a planned-trade/position-sizing workspace using entry, stop, account value, and maximum risk.
2. Add configurable in-app alerts for stop proximity, EMA/Lower Structure events, RSI, breadth, and
   market stance transitions.
3. Add portfolio performance history with an equity curve, drawdown, realized P/L summaries, and
   SPY/QQQ benchmark comparison.
4. Add trade journal metadata and richer History filtering, sorting, tagging, and CSV export.
5. Add watchlist columns/preferences so users can choose, order, and save displayed metrics.

#### P3: Research and market-data depth

1. Add configurable Analyze indicators/timeframes, comparison symbols, earnings/dividend markers,
   and saved layouts.
2. Expand fundamentals with estimates, revisions, earnings history, valuation history, and explicit
   period/source labeling.
3. Replace keyword sentiment with a clearly sourced, testable model or provider while retaining
   article links and methodology disclosure.
4. Support an optional official/paid provider for quotes and breadth, with Yahoo retained as a
   fallback where permitted.

#### P4: Platform expansion

1. Add optional authentication and encrypted remote synchronization only after the local data model
   and migrations are stable.
2. Add brokerage integrations behind explicit import/reconciliation boundaries; do not make a
   brokerage feed the sole source of truth.
3. Document supported deployment, observability, secrets, backups, and privacy controls if the app
   moves beyond localhost.
