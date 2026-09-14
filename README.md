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

## Run

On Analyze → Chart, **Copy for ChatGPT** prepares a prompt with the selected stock's market
snapshot, indicators, recent daily candles and conditional trade setups. Paste it into your own
ChatGPT conversation and send; optionally attach a screenshot there. The prompt also asks for
current fundamentals, valuation, latest news and upcoming catalysts with dated sources; enable
web search in that conversation for current research. No AI API is used and no
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
rankings (1D/1W/1M initially, with 3M/6M/1Y options). Top cards provide SPY/QQQ/IWM, BTC/ETH,
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

A dedicated `/api/sector-themes` endpoint uses four concurrent requests, 12-second per-request
timeouts, shared in-flight work and a five-minute cache (one minute on partial failure). The view
loads on selection, refreshes every five minutes while visible, and retains panel selections in
session storage. No portfolio data or credentials are involved. Definitions/types and ranking rules
live in `public/sector-theme-model.ts`, provider normalization/cache in `server/sector-themes.ts`,
and rendering/controller logic in `public/sector-themes-view.ts`. The secondary holdings drill-down
is intentionally deferred until the primary screen has been reviewed and debugged.
