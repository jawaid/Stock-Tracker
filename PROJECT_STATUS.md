# Project Status

Updated: 2026-10-28. This is the concise current snapshot. Read AGENTS.md for durable
rules, HANDOFF.md for continuation details/history, and README.md for setup and features.
Source and tests are authoritative; historical handoff entries are not current instructions.

## Delivery and working tree

- Branch: `main`; repository: https://github.com/jawaid/Stock-Tracker.
- Latest commit: `128b79e` (two-contraction minimum), pushed to `origin/main`.
  The user verified VSTS passes from #3. Finding 1 was previously pushed as `ddb5b65`.
- Current delivery: ready-pivot retention and new-high status, tests, help and documentation.
  User verified VSTS and authorized commit/push on 2026-10-28. See git log for delivery.
  Volume-status wording and Finding 4 dry-run comparison are separate subsequent work.
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

- Latest full validation: `bun run check` passed 257 tests / 1,581 assertions, lint,
  strict TypeScript and production bundle. Tests cover retained levels, breakout/stop
  priority, mature higher-pause replacement, rejected replacements, and status boundaries.
- Managed app restarted. Synthetic desktop/mobile regression passed; screenshots reviewed.
- Public VSTS replay and running scan verified for 2026-10-27: retained October 22 pivot
  15.00, stop 14.40, buy point 15.10; close 15.16 records breakout, status In buy range,
  volume confirmation false. Previously Oct 26's intraday 15.10 high incorrectly replaced it.
- Same scan: SWKS has “No setup – new high, no pause yet”; TMO retains Setup ready at
  pivot 703.20 / buy point 703.30. These are dated observations, not fixed ticker targets.
- Earlier AAPL verification is historical and may differ under the new ready-level replay.
- URL: http://127.0.0.1:3000/. LaunchAgent `com.jawaid.stock-tracker` manages this Mac's
  service. Do not start a competing server. README has restart/lifecycle commands.
- No personal portfolio data, environment files or secrets inspected in this audit.

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
- Exact next step: refresh/rerun Minervini and review the VSTS October 27 breakout and
  retained levels. Next: volume-status wording and report-only Finding 4 comparison;
  do not change base-selection behavior or commit subsequent work.
