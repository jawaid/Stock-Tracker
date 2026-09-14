# Stock Tracker Handoff

Last updated: 2026-09-13

This file is the current working snapshot. Read `AGENTS.md` for durable repository guidance before
making changes. Update this file when active work, known issues, recent changes, or immediate
priorities change.

## Current Status

- Branch: `main`.
- Repository: `https://github.com/jawaid/Stock-Tracker`.
- Default local URL: `http://127.0.0.1:3000/` when `bun run start` or `bun run dev` is running.
- Runtime: Bun 1.3.14 or newer; dependencies are locked in `bun.lock`.
- Persistence: local SQLite at ignored path `data/portfolio.sqlite`, mirrored to browser storage.
- Application tabs: Overall Dashboard, Market Condition, Sector Performance, US Sectors & Themes,
  Positions, Watch List, Analyze, History, and Deepvue.
- Current feature work: primary US Sectors & Themes dashboard verified and approved for local commit.
  Email-alert work was reverted and its stash deleted; chart baseline is e407870.
  No GitHub push requested for this feature.
- Current user-facing blocker: none reported. The Watch List Analyze action and Analyze workspace
  were tested successfully by the user.
- Validation baseline: `bun run check` passes with 64 tests and 291 assertions.
- Documentation: `AGENTS.md` is the durable guide and this handoff tracks current work.

Do not assume a local server is running merely because the repository is healthy. Start it with
`bun run dev` for development or `bun run start` for normal local use.

## Recent Changes

- Added primary US Sectors & Themes tab in the existing light style: 20 reference ETFs, six
  market-context cards and tracked-ETF participation; three independently ranked period panels.
  Desktop columns/mobile stacking, preserved selections, automatic visible-tab refresh and manual
  refresh. No secondary drill-down, portfolio changes, or new dependencies.
- Focused model/provider/view modules reuse the public Yahoo daily-chart request pattern. Two-year
  history supports 1D/1W/1M/3M/6M/1Y; defined trading-observation horizons and crypto calendar-day
  horizons. Missing/short/stale data remain unavailable; different-session ETF rankings excluded.
  Four workers, request timeouts, five-minute cache (one minute partial), in-flight deduplication.
  Explicit source dates and performance-versus-fund-flow distinction. No persistent schema change.
- Rechecked the 1D/1W/1M return math against the live API on the 2026-09-11 session. Returns use
  `(latest close / close N elapsed trading observations earlier - 1) × 100`; the 1D value is the
  immediately prior session, 1W is five observations earlier, and 1M is twenty-one observations
  earlier. Added the exact reference date and price to each reading for hover-audit details. No
  formula change was needed. The holiday week explains why an older reference screen can differ.
- Validation: all 64 tests pass; live 20/20 ETF coverage. Desktop/mobile fit, independent selectors,
  refresh and reload persistence verified, with no page errors or overflow. Simulated partial
  failure shows 19/20 coverage; full refresh failure retains prior readings and dates. Holdings
  screen deferred.
  Approved for local commit; no GitHub push requested.


- Removed right-axis Support/Resistance/Next/Higher names only; prices, line colors,
  dash styles and anchored segments remain unchanged.


- Hid the 21/50/200 EMA highlighted axis labels and values; EMA lines and legend remain.


- Removed the current-price horizontal chart line; retained the latest-price axis label.


- Shortened the green Support line to start at the latest bar matching the existing 20-session
  support low and end at the latest bar, matching the Resistance segment behavior.


- Renamed the existing 20-day chart line back to Resistance, colored it blue, and replaced
  the full-width price line with a segment from the most recent bar matching that high to
  the latest bar. Same 20-session value; equal highs use the latest occurrence.


- Chart adds up to two significant overhead resistance lines using the existing full daily history.
  Peaks require thirty sessions on each side, a 5% pullback within the next thirty sessions,
  and no subsequent close above the peak. Group levels within 1%; show the nearest two above
  the latest displayed close. Blue dotted segments start at the peak (clipped at visible range);
  original dates and prices are listed below, with expandable rules. No provider, persistence,
  trade-idea, or existing 20-day level changes. Requires 61 bars; invalid history yields no levels.
  Verified ARE: June 26 $56.20 and January 23 $59.76. All 59 tests pass, desktop/mobile browser
  checks pass without overflow or page errors. Approved for local commit; no GitHub push requested.


- Current percentages now appear inline beside each indicator direction, without additional rows.
- Extended both session summaries to the Overall Condition Matrix: Short Term B5/B20,
  Intermediate Term B20/B50, Long Term B50/B200, with user-specified labels and expandable rules.
  Reuses existing participation history and five-session comparisons for all pairs; flat-first
  cases remain Flat/Mixed, missing data is isolated by pair. Retains legacy signal response.
  No new fetches, indicator calculations, or persistence changes. Approved for local commit; no push requested.
  Full check passes; restarted local server and verified all three pairs in both live API summaries.
  Desktop/mobile visual verification remains incomplete: browser control returned tab state but
  did not provide interaction documentation in this session.

Newest functional changes first:

- Replaced the external Deepvue shortcut with an internal Deepvue dashboard tab. It embeds
  `https://app.deepvue.com/dashboard` and includes an Open separately fallback. No credentials,
  portfolio sync or API integration. Browser verified the tab and fallback; the user subsequently
  confirmed embedded content works after login. The earlier blank frame did not establish an
  embedding restriction. Deepvue handles its own authentication.
- Renamed the B20/B50 section Intermediate-term breadth signal in both session summaries per
  user request. Direction comparisons and signal mapping remain unchanged.
- Added user-requested B20/B50 signal mapping to both summaries: rising/rising = bullish breadth
  expansion; rising/flat-or-falling = early improvement; falling/rising-or-flat = short-term
  deterioration; falling/falling = breadth deterioration. Uses existing five-session direction;
  exact equality is Flat. Flat/flat is Flat breadth, other B20-flat cases Mixed breadth. Missing
  comparison gives unavailable. No new indicator or numeric posture thresholds. Mapping tested.
- Pre/post narratives now reuse the existing 20/50 DMA chart values and describe direction versus
  the previous session and five sessions earlier. Removed the added posture scoring, thresholds,
  minimum-400-stock rule and 11-observation requirement per user clarification. Missing readings
  remain individually unavailable. Pre excludes same-day data; post requires matching session date.
  No indicator recalculation, new fetch or persistent schema change.

- Added Top 5 Trade Ideas above the bottom attention panel, sourced from the active watchlist.
  Reuses Chart rules; ranks reward/risk descending then distance to entry in daily ranges, with
  deterministic ties. At most five unique symbols, one setup per stock; fewer if fewer qualify.
  Displays levels, confirmation, source timestamps and chart links. Two concurrent requests,
  20-second timeout, five-minute client cache, explicit unavailable coverage and manual retry.
  Generation guard prevents old watchlist scans from replacing current results. No schema changes.
  Attention remains open-position-only. All changes since `e2969ab` are approved for a local commit.
  Browser verified completed 16-symbol scan with exactly five cards, correct chart navigation,
  desktop/mobile layout without overflow, and no console errors.
- Open Heat rows now show Stop breached / At stop and distance below the recorded stop instead
  of a misleading zero-percent label when price is at/below stop. Other rows explicitly label
  Open Heat as a percentage of position value. Aggregate Open Heat retains its nonnegative formula.
- Missing stops now produce an individual attention item per open-position symbol, including
  partially covered lots and unavailable quotes. These items identify position records as the source.
- Restricted attention panel to current open positions per user clarification. Removed watchlist
  scan and watchlist trade cards; retained stop/trend checks and chart links. Added regression
  coverage for unrelated quotes and closed positions. Panel remains at the bottom. No schema change.
- Moved What needs my attention? below the summary, Open Heat, Heat Snapshot and Allocation.
  This changes placement only; attention rules and interactions are unchanged.
- Expanded the copied prompt to request current fundamentals, valuation, latest news and upcoming
  catalysts using web search and dated direct sources. Distinguishes facts, estimates and analysis,
  adapts to ETFs, and requires disclosure when browsing is unavailable. The app still only copies
  text; research happens in the user's ChatGPT conversation. No API connection or data schema change.

- Chart now has Copy for ChatGPT: copies a structured prompt with selected-symbol market data,
  timestamps, EMA/RSI/support/resistance, up to 60 daily candles and the current app trade setups.
  Explicit whitelist excludes holdings and calculator drafts. No AI API or automatic sending;
  user pastes and sends in their own ChatGPT conversation. Screenshot attachment is optional and
  manual. Clipboard denial displays a selected readonly textarea for manual copying. Changing
  ticker clears old copy status/fallback. No persistence/schema changes. Tests cover selected data,
  bounded history, privacy exclusions and missing values. Browser verified successful copy,
  desktop/mobile fit (1280/390px), and no console errors; clipboard-denial path not browser-tested.

- Added What needs my attention? to Overall Dashboard: reached/near stops (gap <=2% of price),
  latest price below 21 EMA (explicitly not a confirmed closing signal), and nearby qualifying
  setups in the active watchlist. Multiple lots use the highest valid stop; missing stop/EMA/price
  data is disclosed. Prices older than five days are excluded and source timestamps are shown.
  Watchlist scan reuses Chart setup rules and requires proximity within half a daily range;
  breakout entries beyond their zone are excluded. Scans cover the first 50 unique active-list
  symbols, use two workers with 20-second timeouts, and cache for five minutes. Manual scan retries;
  upstream caching still applies. Partial coverage is explicit; failures do not blank position items.
  Scan follows quote refresh; no persistent settings, notifications, orders, or schema changes.
  Pure rules/tests and controller live in public/attention*.ts. Tests cover boundaries, multiple
  lots, missing/stale data and setup proximity. Browser verified live scan, correct chart navigation,
  desktop/mobile (1280/390px) without overflow, and no console errors.

- Calculator reward/risk is editable, defaulting to 2:1 for manual plans. Imported ideas retain
  their proposed target and derive the ratio. Editing ratio updates target; editing target updates
  ratio. Entry/stop edits follow the last chosen target/ratio mode. Invalid ratios clear dependent
  targets and prevent results. Existing idea rounding and budget/capital behavior are preserved.
  Drafts remain memory-only, with no persistence migration needed. Added deterministic coverage
  for defaults, synchronization, idea compatibility, decimal ratios, and invalid inputs.
  Verified actual browser calculations and desktop/mobile layout (1280/390px), no horizontal
  overflow. Browser logs showed only Bun reload/restart warnings, no errors. Local server restarted.

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

Review and debug the primary sector/theme dashboard before adding holdings drill-down.
Primary dashboard approved for local commit; no GitHub push requested.
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
