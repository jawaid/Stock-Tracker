# Project Status

Updated: 2026-10-27. This is the concise current snapshot. Read AGENTS.md for durable
rules, HANDOFF.md for continuation details/history, and README.md for setup and features.
Source and tests are authoritative; historical handoff entries are not current instructions.

## Delivery and working tree

- Branch: `main`; repository: https://github.com/jawaid/Stock-Tracker.
- Current delivery: Finding 1 Yahoo session completion fix plus the preserved guide refresh.
  User authorized committing and pushing this work on 2026-10-27. See `git log -1`
  for the delivery commit; preceding application commit is `cb917a7` on `origin/main`.
- Delivery includes session metadata, scan summary, deterministic tests, browser regression
  support and documentation. No personal data or secrets are included.

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
- All depths are visible, numbered, and accompanied by total count and indexed failures.
  Shrinking starts at the largest contraction (earliest if tied). The 2–6 count applies
  to that suffix, with at least two contractions AFTER the largest: effectively 3–6.
  Largest ≤35% (configurable 50% bear limit), each later depth ≤115% of its predecessor,
  last smallest within the suffix and ≤10%. Earlier depths remain visible but excluded.
  Synthetic SWKS [10.79, 13.88, 5.27, 3.55] passes these contraction checks.
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

- Latest full validation: `bun run check` passed 251 tests / 1,536 assertions, lint,
  strict TypeScript and production bundle. Fixed-clock coverage includes adapter integration,
  open/closed sessions, delay boundaries, missing/malformed metadata, early close and prior dates.
- Managed app restarted for Finding 1. Synthetic desktop/mobile browser regression passed
  session summary, full depths, indexed failures, pending stops, history, filters, charts
  and clipboard. Summary screenshots reviewed; no live-provider finality claim was tested.
- Managed app was restarted after the Buy Point fix. Verified public AAPL endpoint for
  signal 2026-10-26: pivot 351.73 dated October 23, Buy Point 351.83, stop pending,
  source pause forming, status No setup – pause forming (1 of 3 bars). No false October 22
  breakout in current replay. This is a dated verification, not a permanent ticker target.
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
- Exact next step: refresh Minervini and rerun a scan after the regular close plus 30 minutes
  to review the latest-session inclusion summary. Await the next user task; do not commit
  or push further work without a request.
