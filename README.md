# Stock Tracking Dashboard

A local dashboard for open stock positions. Add ticker, purchase date, shares, cost basis, and optional stop loss, then refresh prices to see current value, 21-day EMA, Lower Structure, Open Heat, and unrealized gain or loss.

## Run

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
