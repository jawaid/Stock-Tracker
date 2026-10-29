# Project Status

Updated: 2026-10-29. This is the concise current snapshot. Read AGENTS.md for durable
rules, HANDOFF.md for continuation details/history, and README.md for setup and features.
Source and tests are authoritative; historical handoff entries are not current instructions.

## Delivery and working tree

- Branch: `main`; repository: https://github.com/jawaid/Stock-Tracker.
- Latest previously pushed commit: `1244a86` (ready-pivot retention), pushed to
  `origin/main` after user verification. Prior commits: `128b79e` (two contractions), `ddb5b65` (same-day finality).
- Reviewed delivery: display-only “In buy range – volume not confirmed”, separate Entry Type
  geometry (default 150 bars), regression tests and documentation. User authorized committing this delivery locally. Base-selection code is unchanged.
- Finding 4 full dry run is complete for all 59 all-pass results from the running API.
  User authorized read-only access to the AI watchlist: 166 current symbols, not 163.
  Report is private/outside Git: `/tmp/Stock-Tracker-Finding-4-AI-2026-10-28.md`.
  Production base selection remains unchanged; current-rule baselines matched the API 59/59.
- User verified Finding 1 live: scan at 10:46 PM New York on 2026-10-27 showed signal
  date 2026-10-27. This is user-reported verification, not a new provider request here.

## Current Minervini behavior

- TT1–TT7 only, no RS. Individual TT columns hidden; Pass Count and filter remain 7/7.
  Trend qualification is separate from VCP qualification. R9 is unchanged; ALL combines
  only Alex Rules, Launch Pad and MA Alignment.
- Causal 3% zigzag, 15–325-bar bases and prior 120-bar/30% uptrend test. Setup selection
  uses only prior bars and swings confirmed before the signal; no future-bar lookahead.
- Tight final pauses with positive depth below 3% can supply pivot/stop after at least
  three bars including the high bar. Highest-high ties use the latest date. Shorter
  pauses display their pending high with source “pause forming” and status
  “No setup – pause forming (N of 3 bars)”; stop is the later prior low or “pending”.
  If the close exceeds the immature pivot, status is “No setup – new high, no pause yet”
  and source is “new high”.
- All depths are visible, numbered, and accompanied by total count and indexed failures.
  Shrinking starts at the largest contraction (earliest if tied). The 2–6 count applies
  to that suffix, with at least one contraction AFTER the largest: 2–6 total.
  Largest ≤35% (configurable 50% bear limit), each later depth ≤115% of its predecessor,
  last smallest within the suffix and ≤10%. Earlier depths remain visible but excluded.
  [20, 8] and VSTS [5.88, 5.86, 6.05, 4.00] pass contraction checks; VSTS starts
  at #3. A lone [13.88] fails. Trend/base/volume checks remain separate.
- Setup ready retains pivot/stop/buy point until stop touch, breakout, or a newer higher
  tight pause with minPauseBars and passing setup/contraction checks. Intraday pokes do
  not replace levels. Stop touch wins; breakout against the old buy point precedes replacement.
  Ready stop invalidation requires a subsequent replacement pivot, without a trade-history record.
- Buy Point = pivot + $0.10 by default. Breakout/re-breakout requires close strictly
  ABOVE Buy Point; failed breakout is close AT OR BELOW Buy Point after a breakout.
  Volume confirmation is separate (≥1.4× prior Avg50). Completion requires close above
  Buy Point. Frozen pivot/stop, stop-out priority, five-bar notice, re-breakout attempts,
  completion, 60-bar expiry and consumed-pivot rules remain implemented.
- Chart includes 20/50/200 SMAs, volume, prior-50 average volume, dated pivot and Copy
  chart. Browser-local research history retains up to 200 setups/ticker.

- Same-day inclusion now uses Yahoo regular-session start/end and last-trade metadata:
  latest bar must match the session New York date, last trade must reach regular end,
  and a configurable 30-minute delay must elapse. Missing/malformed metadata fails closed.
  Prior-date bars remain eligible on weekends/holidays. Scan summary reports latest available
  sessions included/excluded/unavailable per symbol. Other screener date policies are unchanged.

## Validation and operation

- Latest full validation: `bun run check` passed 264 tests / 1,627 assertions, lint,
  strict TypeScript and production bundle. Tests cover retained levels, breakout/stop
  priority, mature higher-pause replacement, rejected replacements, and status boundaries.
- Managed app restarted. Synthetic desktop/mobile regression passed, including the
  new low-volume breakout label. Latest breakout event supplies confirmation on later bars.
- Public VSTS replay and running scan verified for 2026-10-27: retained October 22 pivot
  15.00, stop 14.40, buy point 15.10; close 15.16 records breakout, status In buy range,
  volume confirmation false. Previously Oct 26's intraday 15.10 high incorrectly replaced it.
- Same scan: SWKS has “No setup – new high, no pause yet”; TMO retains Setup ready at
  pivot 703.20 / buy point 703.30. These are dated observations, not fixed ticker targets.
- Earlier AAPL verification is historical and may differ under the new ready-level replay.
- URL: http://127.0.0.1:3000/. LaunchAgent `com.jawaid.stock-tracker` manages this Mac's
  service. Do not start a competing server. README has restart/lifecycle commands.
- Only the explicitly authorized AI watchlist ID/ticker columns were read with SQLite
  readonly=true/create=false. No positions, trade history, environment files or secrets read;
  no database writes. Watchlist symbols and detailed report remain outside Git.

## Known limitations and next step

- Yahoo metadata supports the requested completion policy but does not guarantee against
  later revisions. Same-day bars remain excluded if any required metadata is unavailable.
- Research history is browser-local and excluded from portfolio JSON exports. Saved
  unfinished records absent from replay are labeled “Not in current replay”; saved
  completed outcomes can remain. Replays can change after rule changes/provider revisions.
- Reliability backlog: backups/restores, schema versioning, concurrent-tab write protection,
  provider resilience, typed contracts, broader portfolio workflow tests and module extraction.
- Legacy verify-launch-pad.mjs has a stale match-count expectation; newer R9 browser tests
  cover the unchanged Launch Pad/MA Alignment/ALL evaluators. Actual logout/reboot startup
  has not been verified; LaunchAgent logs do not rotate.
- Finding 4 results for October 28 signals: 27/59 base dates/prices and depth lists change,
  4 entry types change, 5 statuses change, and 53 historical setup counts change under the
  isolated earliest-high rule. Valid entry types decrease from 10 to 6. No rules changed.
- User rejected earliest-high setup selection. Separate Entry Type geometry is implemented:
  highest high in up to 150 bars strictly before pivot, lowest low after that high through
  pivot, with latest ties. Thirds classify qualifying setups; pivot at/above high is Classic.
  No setup remains No setup. Row details show extrema/dates; old responses need no migration.
- Fresh AI comparison at 2026-10-29T17:22:53.616Z: 167 symbols now stored, 60 all-pass,
  5 unavailable; all-pass signal date October 28. Same-input replay of before/after versions
  verified every non-label entry field, contractions and complete history identical for
  all 167 symbols, including unchanged unavailable outputs. Two all-pass labels changed,
  58 unchanged. Private report: `/tmp/Stock-Tracker-Entry-Geometry-AI.md`.
- Desktop 1440×1000 and mobile 390×844 synthetic UI checks and screenshot review passed
  against the managed app: expanded geometry prices/dates, legacy responses, overflow,
  filtering/sorting, history, chart and existing volume wording. No personal browser data used.
- Exact next step: await the user’s next task. This reviewed delivery is committed locally;
  push only when requested. Production setup base selection remains unchanged.
