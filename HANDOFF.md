# Stock Tracker Handoff

Last updated: 2026-09-10

This file is the current working snapshot. Read `AGENTS.md` for durable repository guidance before
making changes. Update this file when active work, known issues, recent changes, or immediate
priorities change.

## Current Status

- Branch: `main`.
- Repository: `https://github.com/jawaid/Stock-Tracker`.
- Default local URL: `http://127.0.0.1:3000/` when `bun run start` or `bun run dev` is running.
- Runtime: Bun 1.3.14 or newer; dependencies are locked in `bun.lock`.
- Persistence: local SQLite at ignored path `data/portfolio.sqlite`, mirrored to browser storage.
- Application tabs: Overall Dashboard, Market Condition, Sector Performance, Positions, Watch
  List, Analyze, and History.
- Current feature work: Potential Trade Ideas now connect to an editable Position Size Calculator
  below the ideas. Reviewed locally; ready for a local commit. Do not push without a new request.
  Previous work is pushed through `5c3e1c9`.
- Current user-facing blocker: none reported. The Watch List Analyze action and Analyze workspace
  were tested successfully by the user.
- Validation baseline: `bun run check` passes with 39 tests and 126 assertions.
- Documentation: `AGENTS.md` is the durable guide and this handoff tracks current work.

Do not assume a local server is running merely because the repository is healthy. Start it with
`bun run dev` for development or `bun run start` for normal local use.

## Recent Changes

Newest functional changes first:

- Potential Trade Ideas below chart/volume now suggests conditional breakout and 21 EMA pullback
  setups, with entry zones, stops, targets, reward/risk, confirmation and invalidation. The earlier
  uncommitted manual calculator was replaced following user clarification; no position inputs needed.
- Long-only rules require bullish EMA order, rising 21 EMA, RSI below 75, recent prices, and valid
  history. Extended or nonqualifying stocks show Wait. Prior 20-bar resistance and a simple mean
  of 14 true ranges exclude the latest displayed bar. Breakout targets are hypothetical 2R levels;
  pullback targets use prior resistance and require at least 1.5R at the upper entry.
- Rules are disclosed, unbacktested, and do not claim win probabilities. Daily data is delayed;
  confirmation remains conditional. No earnings or broader market filter, persistence, or orders.
- Pure setup calculations and view are in public/trade-ideas*.ts. Position sizing lives in
  public/position-sizing*.ts. All 39 tests / 126 assertions pass.
  Browser verified a live generated breakout idea, rejected pullback explanation, expandable rules,
  placement below volume, mobile layout without overflow, and no console warnings/errors.
- Each qualifying idea has a Calculate position size button. It fills entry, stop, and target while
  preserving editable risk budget and capital limit fields. Levels are rounded conservatively;
  drafts remain per ticker in memory and do not create positions or orders.

- Richer Market Condition narratives now compare each ETF with the previous regular session and
  show headline themes with expandable, dated publisher links. News is selected by session window:
  pre-market ends before the open; closing coverage ends four hours after the regular close.
  Themes are deterministic headline classifications, not causal claims or an LLM-written report.
- Added Upcoming Economic Releases using official BEA JSON and BLS iCalendar feeds. Displays up
  to four events within 31 days, Eastern times, source links, retrieval times, and coverage gaps.
  Calendar requests are cached for one hour when healthy or five minutes on partial failure.
  This is a limited release schedule, not a complete calendar, results feed, or consensus forecast.
- Live verification: BEA works; BLS returns HTTP 403 and is explicitly unavailable. Yahoo provides
  closing-session headlines but no matching pre-open headlines in its current recent feed. No
  historical news archive is persisted; an older panel can lose news as the source feed rolls over.
- All 29 deterministic tests pass. Browser verified desktop columns, mobile stacking without
  horizontal overflow, expandable headline links, and no console errors/warnings. Screen recording
  was not used for this verification. Local app restarted on port 3000 for review.

- Analyze → Research now shows Technical Analysis and Fundamental Analysis before Latest News
  & Sentiment, preserving the desktop columns and mobile stacking. Reviewed by the user.

- Added two narrative panels at the top of Market Condition, side by side on desktop and stacked
  on mobile. Pre Market Condition describes the opening setup using only pre-open bars; Post
  Market Condition summarizes the latest completed regular session, excluding after-hours prices.
- Narratives use delayed Yahoo 5-minute SPY/QQQ/IWM bars with explicit Eastern session dates,
  last-bar times, partial/unavailable states, and prior-session labels. They are deterministic
  price summaries, not news/macro/earnings briefs. Previous closes are 5-minute bar estimates.
  Provider regular-session schedules handle holidays and early closes; completed recaps wait
  15 minutes after the scheduled close. Refresh uses the existing two-minute market cache.
- New normalization/session tests cover separation of pre/regular/post hours, missing/stale bars,
  partial coverage, prior sessions, early close, mixed direction, and Eastern dates.
- Verified live data, desktop side-by-side panels, mobile stacked panels, and no browser console
  warnings/errors. Restarted the local app on port 3000. User approved a local commit only.

- Increased Analyze chart height by 50%: 600 to 900 pixels on desktop and 500 to 750 pixels
  on mobile, preserving responsive width and explicit chart sizing.

- Added contextual Next navigation when Analyze is opened from a Watch List row. The sequence
  follows the currently displayed Watch List order and is not shown for direct Analyze navigation.
- Added dashed 20-day support and resistance price lines to the Analyze chart, using the existing
  technical support/resistance values.
- `292a720` - Added an Analyze action beside Delete in every Watch List row. It switches to Analyze
  and loads the selected ticker.
- `319539b` - Replaced Lightweight Charts automatic sizing with explicit resize handling to prevent
  `ResizeObserver loop completed with undelivered notifications` runtime errors.
- `eebbb2f` - Added the Analyze workspace: 6M/1Y/2Y candlestick chart, separate volume pane,
  21/50/200 EMAs, news and keyword sentiment, technical analysis, and fundamental metrics including
  P/E, PEG, and price/sales.
- `ccfe7a7` - Added historical S&P 500 participation charts for stocks above 5/20/50/200-day moving
  averages.
- `b475842` - Added sortable Watch List columns.
- `cdae67f` - Split short-term 5DMA and 20DMA breadth into separate Market Condition cards.
- `f25bfda` and preceding extraction commits - Converted the app to the current Bun full-stack
  architecture, SQLite persistence, and tested server helper modules.

The documentation set added after these changes records the resulting architecture and roadmap. It
does not alter runtime behavior.

## Open Issues and Risks

There are no confirmed active regressions, but these engineering risks remain open:

1. `public/app.ts` is about 4,000 lines and owns nearly all browser state, rendering, forms, storage,
   and interactions.
2. `server.ts` is about 2,500 lines and combines route wiring, external providers, caches, breadth
   math, classifications, and market orchestration.
3. SQLite writes replace the complete portfolio snapshot. Concurrent tabs can overwrite newer data
   because there is no revision check or row-level update API.
4. Database schema initialization has no formal migration/versioning system.
5. Yahoo Finance, Wikipedia, iShares, and Nasdaq Trader are public external dependencies without an
   availability or schema SLA.
6. Market breadth and McClellan values are component-based proxies; some universes are sampled and
   are not official exchange breadth feeds.
7. News sentiment is keyword-based and intentionally simplistic.
8. Portfolio formulas, close workflows, import/export, and frontend navigation lack committed
   browser end-to-end tests.
9. Runtime/API types still use broad `any`/`AnyRecord` contracts in many places despite strict
   TypeScript settings.
10. Personal data has no automatic backup/restore flow beyond manual JSON export and the local
    SQLite file.

## Recommended Next Tasks

Await user review of the automatic potential-trade ideas. No commit or push is currently authorized.
Work in this order unless the user chooses a product feature first:

1. **Data safety:** add timestamped SQLite backups, a tested restore command/workflow, and database
   schema versioning.
2. **Regression coverage:** add route and browser workflow tests for position CRUD, partial closes,
   watchlists, import/export, tab retention, Watch List to Analyze navigation, and chart resizing.
3. **Server extraction:** move market-data clients, caches, constituent providers, breadth logic,
   and route handlers out of `server.ts` without changing behavior.
4. **Frontend extraction:** move shared types, API calls, portfolio formulas, storage, and tab
   render/controllers out of `public/app.ts` incrementally.
5. **Shared contracts:** define typed request/response models and runtime validation for local APIs
   and external provider payloads; remove duplicated browser/server normalization.
6. **Highest-value product feature:** build a planned-trade position-sizing workspace using entry,
   stop, account value, and maximum allowed risk.
7. **Next product features:** configurable alerts, portfolio equity/drawdown history, and richer
   trading-journal fields in History.

## Handoff Checklist

Before ending future work:

- Run `bun run check`.
- Test changed user workflows in the running app when UI behavior changed.
- Update `AGENTS.md` when durable architecture, workflow, or repository policy changes.
- Update this file with current status, recent changes, open issues, and the next recommended task.
- Never commit `data/portfolio.sqlite`, its sidecars, legacy personal JSON, `.env` files, or logs.
- Commit and push only when the user asks; report the commit hash and verify `HEAD` equals
  `origin/main` after a requested push.
