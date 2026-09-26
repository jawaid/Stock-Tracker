# Stock Tracking Dashboard

The **Deepvue** tab embeds your Deepvue dashboard inside Stock Tracker. Sign in to Deepvue
if needed; Open separately is available as a fallback. No portfolio sync or API integration is included.

Pre- and post-market narratives describe the existing 20/50 DMA participation chart readings,
including their direction versus the previous session and five sessions earlier when available.
An explicit breadth signal follows the B20/B50 five-session directions: bullish breadth expansion,
early improvement, short-term deterioration, or breadth deterioration. Flat/missing cases are
labeled separately. No separate posture score or buy/sell classification is applied. Pre-market uses prior-session
breadth; post-market requires the completed session's breadth.

**Top 5 Trade Ideas** ranks qualifying active-watchlist setups by reward/risk, then proximity to
entry. It shows at most five stocks (one setup each), with entry/stop/target, confirmation and
chart links. Fewer appear when fewer qualify; ranking does not estimate success probability.
Refresh ideas retries the scan; unavailable symbols and data timestamps are shown.

The Overall Dashboard includes **What needs my attention?** at the bottom: stop/trend reviews
for current open positions only, with reasons, data timestamps, and Open chart buttons. Missing
data is disclosed. Use Refresh data to update quotes. Watchlist-only securities are excluded.
These are review prompts; no orders, notifications, or position changes are made.

A local dashboard for open stock positions. Add ticker, purchase date, shares, cost basis, and optional stop loss, then refresh prices to see current value, 21-day EMA, Lower Structure, Open Heat, and unrealized gain or loss.

Stock Tracker is for educational and informational purposes only. It is not financial, investment,
legal, or tax advice. The app shows a full terms acknowledgment on first use in each browser, keeps
that acknowledgment only in browser storage, and displays a short reminder at the bottom of every
tab. See the FAQ → Disclaimer topic for the complete terms.

## Run

On Analyze → Chart, **Copy for ChatGPT** prepares a technical-only prompt with the selected stock's
market snapshot, indicators, recent daily candles and conditional trade setups. Paste it into your
own ChatGPT conversation and send; optionally attach a screenshot there. No AI API is used and no
holdings or calculator inputs are copied. If clipboard access fails, copy from the displayed text.

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

## Market session narratives

Market Condition starts with Pre Market Condition and Post Market Condition panels. The opening
brief uses pre-market SPY, QQQ, and IWM prices to describe the setup and what to watch after the
open. The closing recap describes the latest completed regular session and relative performance.
Both show the session date in Eastern time and the last available bar times; older or partial
sessions are labeled explicitly. The panels stack vertically on mobile.

The briefs combine delayed Yahoo Finance 5-minute ETF bars, prior-session comparisons, and
themes from recent market headlines. Expand the source headlines to see publisher links and
publication times. Headlines after the open are excluded from the pre-market snapshot; closing
coverage includes articles up to four hours after the regular close. News themes describe headline
content, not verified causes of market moves. The recent feed is not a historical news archive. Changes use the prior regular session's final
available 5-minute bar as an estimated close. A recap becomes eligible 15 minutes after the
provider's scheduled close; after-hours moves are excluded. Refresh market updates the panels
alongside other market data, subject to the existing two-minute cache. No API key is required.

Upcoming Economic Releases shows up to four scheduled events within 31 days from the official
[BEA calendar](https://www.bea.gov/news/schedule/full) and
[BLS calendar](https://www.bls.gov/schedule/). Dates are Eastern time. Source failures are shown
explicitly without blanking the price narratives. Calendar coverage is limited to these agencies;
it does not include consensus forecasts, release results, Fed meetings, or company earnings.
Calendar responses are cached for one hour when both sources work, or five minutes on partial
failure. Live validation found BLS access unavailable (HTTP 403); BEA is working.

## Potential trade ideas

Analyze → Chart suggests conditional long setups below the chart and volume pane. Breakout and
21 EMA pullback ideas include proposed entry zones, stops, targets, reward/risk, the confirmation
needed before entry, and what would invalidate the setup. Stocks without qualifying conditions
show Wait. No position entries or calculator inputs are required.

Each qualifying idea includes a **Calculate position size** button. Selecting it fills the Position
Size Calculator below the ideas with the setup's entry, stop, and target. You can edit those values,
enter a risk budget, and optionally set a capital limit. The calculator rounds to whole shares and
keeps drafts separate by ticker during the page session. It does not save a position or place an order.

The expandable methodology describes the app's default trend, distance, volatility, and reward/risk
rules. Resistance uses 20 prior daily bars excluding the latest displayed bar. Volatility is a simple
mean of 14 true ranges, not Wilder ATR. Breakout targets are hypothetical 2R planning levels;
pullback targets use prior resistance. These rules are not backtested and imply no success probability.
Daily prices are delayed; confirmation is not automatic. Earnings and broader market conditions
are not screened. Nothing is persisted or executed, and portfolio metrics are unchanged.

## Screener

The **Screener** tab scans every symbol in the active Watch List in one run. Its first registered
screen, **Alex Rules**, evaluates two daily-chart setups: Buying Weakness near a rising 21-period
average, and Buying Strength after a reclaim of that average. Results show the closing price,
selected 21-period structure reference, 14-period ATR, distance from structure in ATRs, average
slope, and the source price date. The table can be sorted, exported as CSV, and each row opens
Analyze.

The screen parameters are browser-local and can be saved or reset: EMA/SMA selection, optional
high/low 21-period structure band, ATR period, rising/slope lookbacks, shared maximum distance
above the average, and each setup's timing/count rules. **Show near misses** includes symbols that
failed exactly one rule and identifies that rule. Delayed or unavailable symbols are counted rather
than assumed to pass. The screener is an aid for reviewing candidates; it is not a buy/sell signal
or an automated order system.

Each screen is a self-contained module registered in `public/screener-registry.ts`. To add a
future screen, create a module with its name, description, defaults and `evaluate` function, then
add it to that registry; the shared Screener UI will expose it automatically.

### Significant resistance on the chart

Analyze → Chart draws up to two blue dotted overhead resistance levels from the existing daily
history, with original high dates shown below the chart. The rule requires a thirty-session peak
on each side, a subsequent 5% pullback within thirty sessions, and no later close above the high.
Nearby levels within 1% are grouped. New peaks need thirty subsequent sessions to qualify.
Changing the visible range preserves the selected levels; older anchors are clipped to the left
edge. Expand **Significant resistance rules** for details. Existing 20-day levels and trade ideas
keep their original rules. These are potential resistance levels, not guaranteed barriers.

### US Sectors & Themes

The primary dashboard compares 20 US-listed sector/theme ETFs in three independently selectable
rankings (1D/1W/1M initially, with 3M/6M/1Y options). Top cards provide SPY/QQQ/SMH/IWM, BTC,
VIX and the count of tracked ETFs with positive daily returns. It uses the existing light theme.
This basket matches the reference screen; it omits Materials/Real Estate and includes overlapping
industry/theme funds, some with global holdings. It is not an all-sector or official breadth index.

Returns compare provider daily closes over 1/5/21/63/126/252 trading observations for ETFs and
1/7/30/90/180/365 UTC observations for crypto. They exclude dividend reinvestment and may include
the partial current daily bar. 52-week location uses 252/365 daily high/low observations. Missing
history is unavailable. Different-session ETF readings are excluded from rankings/participation;
ETF data over five calendar days old and crypto over two days old is flagged stale. Each card shows
its data date; hover over a 1W/1M value to see the exact reference date and starting price. Crypto
can update while the equity market is closed. Performance is a rotation
proxy, not actual dollar fund flows. Screenshot values may differ due to dates and period definitions.
An unpriced current-session placeholder from the provider is ignored; the latest completed daily
close remains available until a valid new daily close arrives.

A dedicated `/api/sector-themes` endpoint uses four concurrent requests, 12-second per-request
timeouts, shared in-flight work and a five-minute cache (one minute on partial failure). The view
loads on selection, refreshes every five minutes while visible, and retains panel selections in
session storage. No portfolio data or credentials are involved. Definitions/types and ranking rules
live in `public/sector-theme-model.ts`, provider normalization/cache in `server/sector-themes.ts`,
and rendering/controller logic in `public/sector-themes-view.ts`.

Choose **Rotation** beside Performance for a relative-rotation chart against SPY. Short, Medium,
and Long tabs show Leading/Weakening/Lagging/Improving, neutral boundaries, dated tails, exact
values, emerging/fading leadership summaries and independently retained stage/sort filters.
Select a symbol to highlight its trail. Phone tables become readable cards. This is an RRG-style
approximation of price leadership, not proprietary JdK values or measured money flows.

Pure math lives in `public/sector-rotation.ts`; the view is `public/sector-rotation-view.ts`.
RS = sector close / SPY close × 100; smooth with SMA, then normalize with a population z-score
centered at 100. Normalize the lagged percentage ratio of RS-Ratio the same way for momentum.
Presets (SMA / normalization / momentum lag) are Short 10/20/3 daily observations,
Medium 60/60/5 daily observations, Long 6/6/1 monthly observations. They require respectively
51 aligned sessions, 183 aligned sessions and 17 completed month-end observations. All windows
include their current observation and use no future data. Constant windows become Neutral (100).
Missing dates/prices interrupt windows, conflicting duplicate dates are excluded, and pre-inception
dates are not counted as missing. Monthly dates match the last SPY session of each completed month.
Today's New York session is excluded even after close, becoming eligible the next calendar day.
Long-term excludes the current calendar month. Dates are separate from partial performance dates.

The **Settings** tab provides sliders for each horizon’s smoothing window, recent normalization
baseline, and momentum comparison lag. Save applies the settings to both Rotation and Stock Leaders;
**Reset to defaults** restores 10/20/3, 60/60/5, and 6/6/1. Settings are validated and stored only
in the current browser, so another browser or computer starts with the tested defaults.

The same tab also provides **ChatGPT Prompt Settings**. Its one editable complete prompt applies
to every Copy for ChatGPT request in that browser. The default includes a pullback into a rising
21-day moving-average structure, with price within one ATR of the 21 EMA, and a lost-structure
reclaim/reversal under the same proximity condition. Each prompt states whether
the app currently detects Setup 1, Setup 2, both, or neither. The app replaces the
`{{currentCondition}}` placeholder and adds the selected symbol's market snapshot only when Copy
for ChatGPT is used from Analyze. Prompts identify these as app criteria and do not include
positions, account balances, budget, or personal risk tolerance.

The **FAQ** tab is an informational guide for Performance, Rotation, and Stock Leaders. Its three
sub-tabs describe a practical sector-to-stock research workflow, the current browser-saved Rotation
settings, the meaning of RS-Ratio and RS-Momentum, and how to prioritize the four Stock Leader
screens. It links to one external RRG education resource and does not fetch data or perform
calculations.

The existing ETF request uses the provider's standard five-year daily range to leave adequate
monthly warmup and trail history; stocks/crypto/VIX keep two years. No additional per-horizon
requests are made. Raw histories stay only in the local server cache, where Rotation can be
recalculated for saved settings; they are removed from every dashboard response. Older responses
without rotation remain renderable. No
schema, portfolio, API credentials or dependencies change. These are unbacktested descriptive
signals: a leading sector can still lose value, and rotation can reverse or skip quadrants.

Choose **Stock Leaders** for four mixed stock/ETF screens: Leader Recovering (Medium Leading AND
Short Improving), Confirmed Leader (Leading AND Leading), Emerging Leader (Improving AND Leading),
and Early Improvement (Improving AND Improving). Both stages must match, with valid current
readings versus SPY. The instrument can be a stock or an ETF. Each row labels its type and shows its
own Medium/Short stage, RS-Ratio and RS-Momentum. Stock rows include source ETF and holdings date;
ETF rows reuse the existing dashboard rotation without extra price requests or holdings weights.

The universe includes all 20 tracked ETFs themselves and their available top ten holdings. ETF
stage does not exclude its stocks. Rank the combined candidates by Medium RS-Ratio, Medium
RS-Momentum, Short RS-Momentum and Short RS-Ratio descending, then ticker ascending, using unrounded
values. Each ticker appears once. Legacy rows without instrument type render as stocks.
A stock's primary source is the tracked ETF with the highest holding weight (ticker breaks ties).
An ETF belongs to its own group. Show up to ten combined results with at most two per ETF group,
counting the ETF itself and assigned stocks together. Sources are assigned before applying caps
and are not reassigned to fill slots. Overlapping ETFs can still share exposure. Fewer than ten
results, including zero, are possible when qualification is narrow.

The on-demand `/api/stock-rotation` status endpoint starts or joins one in-memory scan. It returns
progress immediately; the browser polls while viewing Stock Leaders, and the completed result is
shared across the four screens. It reuses the dashboard's SPY history/cutoff and holdings/quote
caches, with at most four stock requests at once. Stock histories are two years; no new formulas,
credentials or portfolio storage are introduced. Public dashboard/holdings responses omit raw
histories. Completed scans cache five minutes (one minute on partial failure); existing holdings
cache one hour. Failed requests retain dated prior results; missing or unsupported listings and
coverage gaps are disclosed. Prices and ETF holdings are delayed public data, so these screens
are descriptive research candidates, not entry signals or guaranteed returns.

Calculation/selection contracts live in `public/stock-rotation-model.ts`, scan orchestration in
`server/stock-rotation.ts`, and UI in `public/stock-rotation-view.ts`. Optional browser regression:
`PLAYWRIGHT_MODULE=/path/to/installed/playwright bun scripts/verify-stock-rotation.mjs`.

Select any sector/theme row to open the linked leaderboard with that ETF expanded and that panel's
period selected for sorting. The selected ETF and holdings appear first with its name in the heading;
other ETFs are sorted below it. Return using **Back to Dashboard** to restore the original periods,
scroll position and keyboard focus. The leaderboard shares the primary ETF data and offers
bidirectional sorting, 52-week position, Wilder ATR(14)% and daily volume. ATR uses the first fourteen
true ranges as a seed, Wilder smoothing thereafter, and divides by the latest close. Missing or
invalid bars require a new seed; insufficient history produces a dash. Volume can be partial.

Expand an ETF to see up to ten holdings, daily/weekly stock returns and each stock's weight in the
ETF. Holdings come from public Stock Analysis tables, whose stated source is Finnhub. These are
dated snapshots and can lag price data by weeks. The app shows the snapshot date and warns when
older than seven days. Unsupported international listings remain visible with unavailable quotes;
the app never guesses an exchange or substitutes an ADR. Weights are not personal portfolio weights
and stock returns do not measure actual dollar flows or return attribution.

`/api/sector-theme-holdings` loads the twenty snapshot summaries; `/api/sector-theme-detail?symbol=XOP`
loads a supported ETF's top holdings and quotes. The provider module `server/theme-holdings.ts`
caps public HTML responses, validates visible table data, limits concurrent requests to four and
deduplicates requests. Holdings cache for one hour; quotes for five minutes; failures for one minute.
The UI provides Refresh holdings; it respects these caches. No new credentials or dependencies are
needed to use the feature, and it does not modify portfolio storage.

For optional repeatable browser checks, start the app and run
`PLAYWRIGHT_MODULE=/path/to/installed/playwright bun scripts/verify-theme-drilldown.mjs`.
Run `PLAYWRIGHT_MODULE=/path/to/installed/playwright bun scripts/verify-sector-rotation.mjs`
for rotation values, all horizon/filter combinations, refresh failure/recovery and responsive checks.
This requires a separately installed Playwright package and Chrome. It uses isolated synthetic
market and empty portfolio responses, and writes screenshots only under `/tmp`. `THEME_TEST_URL`
can override the default local URL. Normal `bun run check` includes the deterministic calculation,
parser, cache and failure tests and does not require a live market provider or browser package.
