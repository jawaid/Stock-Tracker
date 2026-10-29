# Stock Tracking Dashboard

Local-first Bun / TypeScript / SQLite application for portfolio tracking, watchlists,
market context and technical screening. For project continuation, read [AGENTS.md](AGENTS.md),
[PROJECT_STATUS.md](PROJECT_STATUS.md) and [HANDOFF.md](HANDOFF.md). The current application
release includes R9 Swing and Minervini Technical with TT1–TT7, zigzag VCP bases,
frozen breakout levels, reset rules, and per-ticker setup history.

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

## ⚠️ Disclaimer

This project is a personal tool shared for **educational and informational
purposes only**. It is not financial, investment, or trading advice, and
nothing it produces is a recommendation to buy, sell, or hold any security.

- **May contain errors.** The code, calculations, screening logic, and data
  may contain bugs or inaccuracies. Always verify results independently.
- **Substantial risk.** Trading and investing involve substantial risk,
  including the loss of your entire investment. Past patterns do not
  guarantee future results.
- **Consult a professional.** Seek advice from a licensed financial advisor
  before making investment decisions.
- **Use at your own risk.** You are solely responsible for how you use this
  software and for any decisions or losses that result.

This software is provided "as is," without warranty of any kind. The author
accepts no liability for any losses or damages arising from its use. See the
[LICENSE](LICENSE) file for full terms.

Stock Tracker is for educational and informational purposes only. It is not financial, investment,
legal, or tax advice. The app shows a full terms acknowledgment on first use in each browser, keeps
that acknowledgment only in browser storage, and displays a short reminder at the bottom of every
tab. See the FAQ → Disclaimer topic for the complete terms.

## macOS background service

This Mac uses the per-user LaunchAgent `com.jawaid.stock-tracker` to run the app independently
of a terminal or Codex session. It starts when the Mac user session starts and restarts after
process exits, with a 10-second restart throttle. No Stock Tracker login is required. It is
available only on `127.0.0.1:3000`; the Mac must be awake and the user session active.

The machine-local configuration is `~/Library/LaunchAgents/com.jawaid.stock-tracker.plist`.
It uses the installed Bun binary and this checkout's absolute path; update the configuration
if either is moved. Logs are private files in `~/Library/Logs/StockTracker/` (`stdout.log` and
`stderr.log`). Logs append and are not automatically rotated; inspect their size periodically.
These files are outside the repository and are not installed by cloning it.

```bash
# Service status
launchctl print "gui/$(id -u)/com.jawaid.stock-tracker"
# Restart after application changes
launchctl kickstart -k "gui/$(id -u)/com.jawaid.stock-tracker"
# Stop before running bun run dev manually
launchctl bootout "gui/$(id -u)/com.jawaid.stock-tracker"
# Resume the service
launchctl bootstrap "gui/$(id -u)" "$HOME/Library/LaunchAgents/com.jawaid.stock-tracker.plist"
```

Do not run a second server on port 3000 while the service is active. To uninstall, stop the
service with `bootout` and remove its plist; keep the logs if they are needed for diagnosis.

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
selected 21-period structure reference, Wilder/RMA ATR (14 by default), ATR%, distance from structure in ATRs, average
slope, and the source price date. The table can be sorted, exported as CSV or as a TXT symbol list, and each row opens
Analyze.

The screen parameters are browser-local and can be saved or reset: EMA/SMA selection, optional
high/low 21-period structure band, ATR period, rising/slope lookbacks, shared maximum distance
above the average, and each setup's timing/count rules. **Show near misses** includes symbols that
failed exactly one rule and identifies that rule. Delayed or unavailable symbols are counted rather
than assumed to pass. The screener is an aid for reviewing candidates; it is not a buy/sell signal
or an automated order system.

**Launch Pad** is a separate sub-tab within Screener. It requires SMA21, SMA50, and EMA65 to fit
within a 3% band. The maximum spread is editable. Results sort by MA spread ascending and show all three averages,
their spread, date, and failed-rule details for one-rule near misses. CSV and symbol-only TXT
exports use the displayed order/filter.

Launch Pad uses completed prior New York sessions, excluding today's bar even after close because
its evaluator retains the prior-date-only policy. The next calendar day makes it eligible.
At least 65 valid bars are required. Insufficient history and failed downloads have separate
counts. No paid API is used.
Its parameters have a separate browser-storage key; changing the active watchlist or parameters
cancels stale Launch Pad work. FAQ → Launch Pad explains the screen and protective stop planning.

**MA Alignment** is another independent Screener sub-tab. Its defaults compare 10 EMA, 21 EMA,
and 50 SMA and require the three values to fit within a 3% band. The spread, all three periods,
and all three average types are configurable. Results use dynamic average labels, sort by spread,
and export to CSV or a symbol-only TXT list. It has its own evaluator, controller, results helpers, tests, host element, and
browser-storage key, so it can be removed without changing Launch Pad and vice versa. Like Launch
Pad, it excludes today's New York bar and requires enough valid history for its longest configured
period.

**ALL** is a separate combination sub-tab. By default it requires a ticker to pass Alex Rules,
Launch Pad, and MA Alignment with an AND condition. Users can select any nonempty subset of the
three screens and switch between AND and OR without rerunning a completed scan. ALL fetches each
ticker once and invokes the existing evaluators with their current settings; it adds no screening
formula. Alex passes when either currently selected Alex setup passes. Results show each source's
Pass, No match, or Unavailable status and its own data date, then export as detailed CSV or a
symbol-only TXT list.

Screen modules expose a name, description, defaults and an `evaluate` function. Alex Rules retains
its existing module, controller, types, indicators, settings key, and legacy registry list unchanged.
`public/screener-registry.ts` additionally exports a panel registry used by `screener-panels.ts`.
Launch Pad and MA Alignment each have their own screen module, controller, result helpers, storage,
tests, and host. ALL has separate combination logic, UI, results helpers, tests, and host while
calling those existing screen evaluators. A future screen with distinct controls/metrics can follow that isolated pattern and add
its panel to the panel registry, add a host in `index.html`, and connect its rendering in the
wrapper, without changing the Alex Rules UI. Add deterministic rule/metric tests beside the module.

`bun run check` includes Launch Pad's hand-checked indicator, rule, boundary, coverage, and export
tests. Optional browser regression: `bun scripts/verify-launch-pad.mjs` with Playwright and Chrome
available (set `PLAYWRIGHT_MODULE` to an existing Playwright package path if needed). It starts a
temporary local frontend server and intercepts API requests with synthetic data; it does not read
the portfolio database or call market providers. Screenshots are written to `/tmp/launch-pad-*.png`.

**R9 Swing** is an independent end-of-day screen using the active Watch List. Its eleven core
checks require close above SMA10/20/50/100/200, SMA20 above SMA50, positive MACD(12,26),
Wilder +DI14 above -DI14, an up close, a same-day SMA10 low touch within the latest three
bars, and volume at least the signal-inclusive 20-day average. RSI14/RSI2, ADX14, ATR,
and SPY-relative returns are diagnostics only. A completed close below EMA10 is a separate
exit status. ALL does not include R9.

R9 excludes today's New York candle even after close; it becomes eligible the next calendar
day under R9’s unchanged prior-date-only policy. It requires 200 valid OHLCV
bars and shows unavailable/load failures explicitly. The 52-week high diagnostic requires
252 bars. Missing benchmark data affects only RS diagnostics. Sort any column or filter
Matches Only; CSV contains displayed rows and all individual rule states, while TXT contains
matching symbols only. No schema or portfolio storage changes are needed.

Run focused tests with `bun test public/r9-swing.test.ts`. Run the synthetic browser workflow
with `PLAYWRIGHT_MODULE=/path/to/playwright bun scripts/verify-r9-swing.mjs`; it uses no personal
portfolio data and writes desktop/mobile screenshots to `/tmp/r9-*.png`.

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

### Minervini Technical

Independent technical-only Screener using the active Watch List. TT1–TT7 retain their existing
formulas. Each rule is evaluated when its own history requirement is available; valid histories
under 260 bars show **IPO – partial TT**, not a blanket data failure. TT6/TT7 still need 252 bars,
TT3 needs 222, and the optional 105-bar SMA200 comparison needs 305. All-pass requires 7/7.

Relative strength is not part of Minervini qualification: no TT8, RS rating, RS source, or
benchmark request. Each symbol qualifies independently. The redundant Trend Status column
is removed; short-history labeling appears in the existing Data Status column. Individual TT1–TT7 columns are hidden; Pass Count remains 7/7 with rule outcomes on hover/focus.
Immediately after Pass Count, columns are Contraction Depths (heuristic), Contractions Shrinking, Volume Dry-Up,
Entry Type (advisory), Entry Pivot and Entry Stop. Compact column widths keep these visible
together at a 1440px desktop viewport; smaller screens scroll horizontally. Buy Point and other
reset/history fields follow to the right. Contraction Depths displays the total count and every numbered depth, oldest to newest.
It identifies the largest contraction where evaluation starts and lists failures by
contraction number. Earlier depths remain visible but do not count in shrinking checks. A 7/7 trend result does not imply a valid VCP. FAQ → Screener → Minervini
Technical explains these fields, frozen setups, chart features and data limitations.

VCP uses a 3% high/low percentage zigzag. Equal extremes choose the latest occurrence. A new
extreme cannot confirm a reversal on the same daily candle because OHLC does not reveal intrabar
order. The final low may be unconfirmed. Setup evaluation sees only bars BEFORE the signal candle.
Choose the most recent confirmed high meeting the 15–325-bar base age and no-later-high-above-105%
criteria. Then test its prior uptrend: BH must be at least 30% above the lowest low of its 120
preceding bars. Do not skip failed contraction/uptrend rules to search for a more favorable base.
The base low is the lowest low inside that base, with latest ties.

Contractions run from each confirmed high to the lowest subsequent low before the next high,
with the final contraction ending on the bar before the signal. Shrinking evaluation starts
at the largest contraction (earliest occurrence if tied). Apply the 2–6 count to that
suffix, and require at least one contraction after the largest (2–6 total
in the evaluated suffix). The largest depth must be ≤35%, each later depth ≤115% of
its predecessor, and the final depth smallest within that suffix and ≤10%. Named defaults allow a 50% first-depth limit for a deliberately configured bear-market
mode; no market regime is inferred automatically. No setup lists failed rules.

A pending final contraction also captures tight pauses below the 3% zigzag threshold.
After the last confirmed swing low following the last confirmed high, use the highest
subsequent high (latest tie). Require at least `minPauseBars` bars (default 3), counting
that high bar through the end of the prior history. The lowest low strictly after it
sets the pending depth. Append only positive depths below 3%; larger declines use the
normal confirmed swings. All contraction checks still apply. Only swings confirmed
before the signal and bars before the signal can participate.

Pivot is the high starting the final contraction; stop is the subsequent final-contraction low.
The Entry Pivot cell labels its source as **confirmed swing** or **tight pause (<3%)**.
Before the minimum pause age, the pending high is displayed with source **pause forming**
and status **No setup – pause forming (N of 3 bars)**. The count includes the high bar;
the stop is the lowest subsequent prior low, or **pending** if no later prior bar exists.
If the latest close exceeds a forming pivot, the status is **No setup – new high, no pause yet**
and the pivot source is **new high**. Otherwise the forming status remains. Neither state can
trigger a breakout or replace an already frozen active setup.
Once **Setup ready**, retain the pivot, stop and buy point until the stop is touched,
a close exceeds the retained buy point, or a newer tight pause above the retained pivot
has at least `minPauseBars` prior bars and passes all setup/contraction checks. A mere
intraday high cannot move ready levels. Stop touch has priority; a close above the old
buy point records breakout before considering replacement. Invalidated ready pivots
cannot be reused; replacement highs must be later than the stop bar.
The pending pivot and stop freeze on breakout just like confirmed swing levels; volume
uses the selected pivot bar onward. Existing history storage and portfolio formats are unchanged.
Buy Point = pivot + $0.10. Risk % = (pivot − stop) / pivot × 100; Stop Too Wide means >8%.
Entry Type uses separate label-only geometry: the highest high within up to
`geometryLookbackBars` (default 150) bars strictly before the pivot, then the lowest low
strictly after that high through the pivot bar. Ties use the latest date. Pivot position
below 1/3 is Low cheat, from 1/3 to below 2/3 is Cheat, and at least 2/3 is Classic pivot.
A pivot at or above the geometry high is Classic pivot. Row details show both extrema
and dates. Unqualified setups retain No setup. Geometry does not change setup base
selection, contractions, status, pivot, stop, buy point or history. Legacy responses
without geometry remain supported; no database or history migration is needed.
The 50-bar volume average excludes the signal candle. Volume Dry-Up compares mean volume from
pivot-high candle through the preceding candle against 75% of that prior Avg50.

The first close strictly above a valid setup's Buy Point (pivot + $0.10) freezes its pivot and stop and records Breakout Date.
Breakout + Volume requires that breakout/re-breakout candle's volume ≥1.4× prior Avg50.
Later bars merely remaining above the Buy Point are not new breakout events.
The UI labels In buy range as **In buy range – volume not confirmed** when the latest
breakout/re-breakout lacks volume confirmation; a later quiet bar does not undo prior confirmation. Frozen status is In buy
range above Buy Point through pivot×1.05, Extended above that, or Failed breakout at or below Buy Point.

- A later low ≤stop takes priority: record Stopped out and display its dated notice for five bars
  including the stop candle. Search immediately, but replacement pivot highs must be strictly
  AFTER that candle; BH may predate the stop.
- A failed close alone retains frozen levels. A subsequent close >Buy Point becomes
  Re-breakout (attempt N), with a fresh prior-50-volume comparison.
- Following a successful breakout, a later confirmed swing high above the frozen pivot with a
  contraction releases the old setup as Completed only while it is not failed and the current
  close is above Buy Point. Evaluate the new base from that high, subject
  to the normal age/uptrend/contraction rules. Confirmation must already be known before the
  current signal; failed setups remain frozen until recovery, stop, or expiry.
- Otherwise the freeze expires 60 bars after the original breakout. A consumed pivot cannot
  immediately trigger another setup; wait for a new swing high.

**History** shows pivot/stop, base/pivot/breakout dates, attempts, dated events and outcomes.
Each scan deterministically replays the available provider history. Up to 200 setups per ticker
are retained in this browser under a separate versioned research-history key; current replay
updates matching records. Older saved outcomes may lie outside the replay. Unfinished records
absent from the latest replay are labeled accordingly. Browser storage errors do not block scans.
This is research history, not recorded trades, and is not included in portfolio JSON exports.

**Chart**, beside Close, opens a large dialog with candlesticks, 20/50/200 SMAs, volume bars,
a prior-50-bar average-volume line, and a pivot segment anchored to the evaluator's exact pivot
date. Later highs cannot move the frozen anchor. **Copy chart** copies a PNG with symbol/date.
Close/Escape preserves table state; Analyze retains its four dated price-level overlays.

Same-day candles require Yahoo's regular-session start/end metadata, a latest bar with the
same New York session date, a last-trade timestamp at or after regular end, and at least
30 minutes since that end. The delay is configurable via `YAHOO_FINALITY_DELAY_MINUTES`
in `server/yahoo-session.ts`. Missing or malformed metadata keeps `final: false`; elapsed
clock time alone never certifies a bar. Prior-date bars remain eligible on weekends and
holidays. The scan summary counts symbols whose latest available session was included,
excluded, or unavailable. This is an app completion policy using Yahoo metadata, not a
provider guarantee against later revisions. R9 and other screener date policies are unchanged.

Defaults live in `server/screeners/minervini.ts`, causal base/replay logic in `minervini-vcp.ts`,
and zigzag detection in `minervini-zigzag.ts`.
No portfolio schema or legacy import changes; the new research-history key ignores older formats.
ALL still combines only Alex Rules, Launch Pad and MA Alignment.

`POST /api/screeners/minervini` accepts `{ "symbols": ["AAPL", "MSFT"] }`, capped at 400 input
symbols and 16 KiB. Three technical-only requests run concurrently with 20-second timeouts; only
one scan runs at once. Individual provider failures remain separate rows. The UI supports
cancellation, sorting, IPO/data status, breakout/reset fields, history and an all-seven-pass filter.

Run `bun test server/screeners public/minervini-results.test.ts public/minervini-chart.test.ts`
and `PLAYWRIGHT_MODULE=/path/to/playwright bun scripts/verify-minervini.mjs` for deterministic
and synthetic browser checks. Browser fixtures use no personal data or live market providers.

## Continue in a new Codex chat

Use the local project folder `/Users/jawaidekram/Documents/Stock Tracking` on this Mac.
Start a new chat associated with that folder and paste:

```text
Continue Stock Tracker in /Users/jawaidekram/Documents/Stock Tracking.
Read AGENTS.md, PROJECT_STATUS.md, HANDOFF.md and README.md.
Check Git status and the latest commit; preserve all local changes.

Finding 1 is committed/pushed as ddb5b65 and user-verified live on October 27.
The two-contraction minimum is committed/pushed as 128b79e. Ready-pivot retention
and new-high status are committed/pushed as 1244a86. Volume-status wording is
local/uncommitted; Finding 4 base selection is report-only. Inspect Git state.

Minervini uses TT1–TT7 (no RS), causal zigzag VCP and tight final pauses.
Pause forming shows the pending high and a pending stop if no later prior low exists.
All depths are shown and numbered. Shrinking starts at the largest contraction;
require one later contraction and apply the 2–6 count to that suffix. Preserve the 115% tolerance and smallest-last ≤10% rules.
Breakout/re-breakout requires close > Buy Point (pivot + $0.10); failed breakout
uses close ≤ Buy Point. Volume confirmation is separate. Preserve frozen levels,
stop-out/re-breakout/completion/60-bar expiry and browser-local research history.

Latest full check: 258 tests passed, plus lint, typecheck and bundle. Desktop/mobile
browser checks passed on the managed app with synthetic data. Same-day bars now require
Yahoo session/trade metadata plus a configurable 30-minute delay; missing metadata fails
closed. Scan summary reports latest sessions included/excluded/unavailable. Read the
current snapshot for provider-revision and saved-history limitations. The app is managed by a LaunchAgent;
do not start another server or inspect personal portfolio data/secrets.

Summarize the current state, then wait for my next task. Do not modify files,
change rules, commit or push until I ask.
```

Use the existing local checkout so the new chat can read uncommitted handoff documents.
The macOS background service runs independently of the chat; see the service section above.

## License

Released under the MIT License. See LICENSE for details.
