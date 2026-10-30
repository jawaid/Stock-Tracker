# Stock Tracker Handoff

Last updated: 2026-10-29

## Latest UI-only update — 2026-10-29

- Entry Status / Reason now uses a collapsed “View explanation” disclosure. Rows size
  naturally to visible content and expand/collapse on demand, eliminating height caused
  by offscreen long explanations. Native keyboard interaction is supported.
- Follow-up validation: full check passed (264 tests / 1,627 assertions); synthetic
  desktop/mobile regression verified compact height with a long explanation, expansion,
  keyboard collapse and restored height. Compact screenshots reviewed. UI-only changes.
- User requested only the last four Contraction Depths and no explanation. The cell now
  displays up to four percentages, oldest to newest, with no count, numbering or rule text.
- Only frontend rendering changed; full input depths, evaluator, sorting, persistence,
  setup selection and lifecycle are unchanged. Existing unit/browser assertions updated.
- `bun run check` passed: 264 tests / 1,627 assertions, lint, typecheck and bundle.
  Synthetic desktop/mobile checks against the managed app passed (1440×1000, 390×844),
  including screenshot review. No personal portfolio data accessed.
- User authorized committing the UI, regression checks and all documentation. This local
  commit includes the preserved documentation refresh and updated in-app help/FAQ.
  Commit title: “Compact Minervini results and expand explanations on demand”.
  Latest pushed application commit is still `7c35977`; no push requested.
- Next: user refreshes the app and reviews the compact column; await further instructions.
  This display update supersedes historical full numbered depth display descriptions below.

## Current continuation snapshot

Read AGENTS.md and PROJECT_STATUS.md first. The latter is the concise current state;
README.md is the current feature/setup reference. Source and tests remain authoritative.

- Latest local delivery is this compact-results UI commit, including the documentation
  refresh. Latest pushed application commit is `7c35977` (geometry and volume wording).
  Check Git for the local commit hash; push only on explicit request.
- User rejected earliest-high setup selection; production `selectCandidate` still uses
  findLast. Separate geometry changes only qualifying Entry Type and optional metadata:
  high within up to 150 bars strictly before pivot, low after high through pivot, latest ties.
  Thirds classify Low cheat/Cheat/Classic pivot; pivot at/above high is Classic.
  No setup stays No setup. Row details show high/low prices and dates.
- Volume-unconfirmed breakouts display “In buy range – volume not confirmed”. This wording
  uses the latest breakout/re-breakout event; lifecycle status and rules stay unchanged.
- Current rules: seven trend checks/no RS; last four depths displayed; evaluate shrinking
  from the largest (earliest tied maximum), require one later contraction, apply 2–6
  count to that suffix, keep 115% tolerance and smallest-last ≤10%.
  Tight pauses below 3% require three bars including the high; shorter pauses show the
  pending high and source pause forming, with stop pending until a later prior low exists.
- Breakout/re-breakout uses close > Buy Point (pivot + $0.10); failure uses close ≤ Buy Point.
  Volume stays separate. Frozen levels, stop/reset/completion/expiry and research history
  remain implemented. Completion requires close above Buy Point. All setup inputs are causal.
- Setup ready now retains levels until stop touch, breakout, or a qualified newer higher
  tight pause. Stop has priority; breakout uses the old buy point before replacement.
  Above-immature-pivot closes show “No setup – new high, no pause yet” and source “new high”.
- Full check: 264 tests / 1,627 assertions, lint/typecheck/bundle passed for geometry and volume wording. Managed app
  restarted; synthetic desktop/mobile regression and screenshot review passed.
- Public October 27 scan: VSTS pivot 15.00 / stop 14.40 / buy 15.10, breakout recorded
  October 27, In buy range, volume confirmation false. SWKS shows new high/no pause;
  TMO retains Setup ready at pivot 703.20 / buy point 703.30. Older AAPL checks are historical.
- Yahoo session/trade metadata now supports same-day completion after a configurable
  30-minute delay; missing/malformed fields fail closed. Prior-date bars remain eligible.
  Provider revisions remain possible. Browser history is not a portfolio export;
  absent unfinished records are labeled Not in current replay; saved ended records can persist.
- LaunchAgent com.jawaid.stock-tracker runs the app at http://127.0.0.1:3000/ and was restarted
  after the application fix. Use README lifecycle commands; do not run a competing server.
- Latest comparison: AI contained 167 symbols, 60 all-pass, 5 unavailable at
  2026-10-29T17:22:53.616Z; all-pass signals dated October 28. All non-label entry fields,
  contractions and history matched before/after for all 167 results. Two all-pass Entry
  Types changed; 58 unchanged. These counts are dated observations, not fixed expectations.
- Exact next step: new chat reads the four documents, checks Git, summarizes and waits
  for the user’s next task. No application work remains pending; do not change rules or
  make further commits or push without a new request.
- Private comparison: `/tmp/Stock-Tracker-Entry-Geometry-AI.md`. Supporting inputs/results
  and UI screenshots are in `/tmp` and may disappear after cleanup/reboot. Do not copy
  private watchlist data into Git. Aggregate evidence is retained in this handoff.

## Historical new-chat documentation refresh — 2026-10-29

- User requested a fresh context and continuation instructions after successful push.
- Updated AGENTS.md, PROJECT_STATUS.md, HANDOFF.md and README.md only; no app/rule changes.
- Application delivery is pushed as `7c35977`. Documentation refresh remains uncommitted.
- Full check passed: 264 tests / 1,627 assertions, lint/typecheck/build. Prior desktop/mobile
  geometry verification remains applicable; no UI code changed in this refresh.
- The managed LaunchAgent continues independently of the chat. Opening a new chat does
  not require restarting it. Use the existing checkout to retain local documentation edits.

## Reviewed geometry delivery — 2026-10-29

- User authorized committing the reviewed changes after the comparison and UI report.
- Commit `7c35977` includes separate geometry labels, volume-status wording, regression tests
  and documentation. No setup base-selection or lifecycle changes.
- Validation remains 264 passing tests / 1,627 assertions, lint/typecheck/build and
  desktop/mobile UI checks. No code changed after validation.
- Private watchlist inputs and reports remain outside Git. User subsequently requested the
  push; `7c35977` was pushed successfully and local/remote heads matched.
- Next: await user instructions.

## Separate Entry Type geometry completed — 2026-10-29

- User chose to preserve existing setup base selection. `geometryLookbackBars` defaults
  to 150; high window is strictly before pivot, low window strictly after high through
  pivot. Latest tied extrema win. Geometry is applied after the complete lifecycle replay,
  affecting only qualifying Entry Type and new optional geometry metadata. No setup stays
  No setup. No persistence migration is required; legacy responses render without details.
- Read only AI watchlist ID/ticker columns in SQLite readonly mode. Current count is 167,
  versus 166 in the earlier report. Used the same loader/provider/evaluator as the API.
  Scan at 2026-10-29T17:22:53.616Z: 60 all-pass, 5 unavailable, 102 other results.
  All all-pass signal dates are October 28; this is a dated observation.
- Compared pre-change replay and current replay on identical input arrays. All non-label
  entry fields, all VCP fields and complete setup histories match for all 167 results,
  including unavailable outputs. Setup status/pivot/stop/buy point are identical.
- Two all-pass labels change; 58 do not. Full before/after rows and whole-watchlist
  invariance audit are private outside Git: `/tmp/Stock-Tracker-Entry-Geometry-AI.md`.
  Inputs and machine-readable results are `/tmp/stock-tracker-geometry-histories.json`
  and `/tmp/stock-tracker-geometry-comparison.json`, not for commit.
- Deterministic tests cover wide geometry, exact 150-bar boundary, pivot exclusion from
  high window/inclusion in low window, no future bars, thirds, ties, missing geometry,
  above-high classification, no-setup retention and lifecycle invariance.
- Full check: 264 tests / 1,627 assertions, lint/typecheck/build passed. Managed service
  restarted. Browser regression passed at 1440×1000 and 390×844 with synthetic data;
  geometry detail values/dates and old responses verified. Screenshots reviewed:
  `/tmp/minervini-geometry-desktop.png` and `/tmp/minervini-geometry-mobile.png`.
- No database writes, personal positions/history access, commits or pushes. Next: user
  reviews the report/UI before authorizing a commit.

## Finding 4 completed full watchlist comparison — 2026-10-29

- User authorized read-only SQLite retrieval of AI watchlist symbols. Opened the database
  with readonly=true/create=false; selected only matching watchlist ID and ticker column.
  Actual stored count was 166 unique symbols, not the earlier 163. No other personal data
  read, no database writes. Private inputs/results and full report remain outside Git.
- Passed all 166 to the running local Minervini route: 59 all-pass (TT1–TT7), 5 unavailable,
  102 remaining non-all-pass rows without API errors. All 59 all-pass signal dates are
  October 28, 2026; scan timestamp 2026-10-29T01:52:47.823Z.
- Fetched public histories and reproduced original scan cutoffs. Yahoo session metadata
  rolled forward during retrieval; applying the originally accepted signal date restored
  exact date/close/entry/VCP equality for all 59 API baselines. Both alternatives then used
  identical arrays. No displayed-scan history, positions or private browser storage accessed.
- Alternate module is isolated in /tmp and changes only candidates.findLast to find.
  Existing eligibility, forced base/reset, readiness, contraction and volume rules remain.
- Results: 27 base dates/prices and contraction lists change; 4 entry types and 5 statuses
  change; 53 historical setup counts change. Qualifying entry types drop from 10 to 6.
  VSTS’s July-base Cheat geometry does not imply qualification: 12 counted contractions
  and additional contraction failures remove its current setup in the alternative replay.
- Full private report: `/tmp/Stock-Tracker-Finding-4-AI-2026-10-28.md` (118 comparison rows,
  all depths, counts and detailed VSTS/AAPL/SWKS/TRGP sections). Inputs, scan response,
  comparison and generator are `/tmp/stock-tracker-ai-*`. These files are not for Git.
- Verified complete coverage: 59 current + 59 alternative rows; zero baseline mismatches
  or comparison errors. No production code changes for this report. The previous local
  volume label remains uncommitted. No commit or push performed in this report session.
- Next: user reviews report before any base-selection behavior decision.

## Volume label and Finding 4 preliminary comparison — 2026-10-28

- Delivered verified pivot fix first as `1244a86`. Subsequent changes remain uncommitted.
- UI only: In buy range gains “– volume not confirmed” when the latest breakout/re-breakout
  event is not volume-confirmed. Subsequent quiet bars do not erase confirmation from
  a confirmed breakout. Raw lifecycle statuses, trading rules and stored history are unchanged.
- Validation: 264 tests / 1,627 assertions, lint/typecheck/build passed. Managed app
  restarted and synthetic desktop/mobile regression passed, including the low-volume label.
- Browser inspection of the current user scan was interrupted. Requested all-pass symbols;
  do not inspect personal portfolio storage to infer the scan. Full-universe report is pending.
- Completed preliminary public-data comparison for the four explicitly named tickers.
  Report: `/tmp/Stock-Tracker-Finding-4-preliminary.md`; inputs/results/scripts are under
  `/tmp/stock-tracker-base-*`, with isolated alternate module `/tmp/stock-tracker-vcp-earliest.ts`.
  Only the temporary copy changes candidates.findLast to candidates.find. Both replay the
  same histories and retain forced-base, readiness, reset, count and other rules.
- Fresh data included October 28; report also includes October 27 replays. Four-symbol
  totals: 3 base dates/prices and depth arrays change; 1 entry type/status changes; all
  4 historical setup counts change. These are NOT full-scan totals.
- VSTS earliest base is July 16 at 16.90 / low 12.07. A fixed 15.00 pivot sits 60.66%
  up the range (Cheat geometry), but the literal rule change yields 15 contractions,
  12 counted from largest, plus tolerance/smallest-last failures. It removes the qualified
  setup rather than simply relabeling the existing breakout. AAPL displayed fields are
  unchanged (forced-base history matters); SWKS moves to October 28, 2025; TRGP to August 18.
- Next: user supplies the current scan list/date; extend the dry run. No base-rule change
  or further commit/push is authorized.

## Ready-pivot retention and new-high status — 2026-10-28

- First committed/pushed the user-verified contraction fix as `128b79e`; verified tracking
  head equality. User subsequently verified VSTS and authorized this section’s work for commit/push.
- Retrieved only public VSTS Analyze data and reproduced the original replay. October 26
  was Setup ready at October 22 pivot 15.00, stop 14.40, buy point 15.10. On October 27,
  prior-bar selection replaced it with October 26's 15.10 intraday high, forming 1/3 bars,
  pending stop and buy point 15.20. Ready candidates had no retained state before breakout.
- Actual VSTS bars from Yahoo via the local Analyze endpoint (prices rounded to cents):

  | Date | High | Low | Close | Volume |
  | --- | ---: | ---: | ---: | ---: |
  | 2026-10-22 | 15.00 | 14.42 | 14.55 | 1,023,500 |
  | 2026-10-23 | 14.81 | 14.40 | 14.75 | 876,900 |
  | 2026-10-26 | 15.10 | 14.63 | 14.96 | 822,500 |
  | 2026-10-27 | 15.23 | 14.57 | 15.16 | 1,410,200 |

- Added a ready candidate to causal replay. Keep its levels until stop touch, breakout,
  or a newer higher tight pause with configured minimum age and all setup/contraction
  checks passing. Stop touch wins; a close above the original buy point records breakout
  before replacement. Ready invalidation requires pivots after its stop bar; no new trade
  history record is created for a setup that never broke out.
- If no retained ready/active setup applies and close exceeds an immature pivot, use
  “No setup – new high, no pause yet” and source “new high”. Pending stop formatting remains.
  At/below the immature pivot still uses pause forming. No portfolio/history schema change.
- Added deterministic intraday-poke/original-buy-point breakout, stop priority/nonreuse,
  qualified higher-pause replacement, configurable age/failing contraction rejection,
  and label boundary tests. Updated synthetic descending-low fixture to establish its
  low before readiness; it must no longer silently lower a ready stop. Existing frozen
  lifecycle, expiry, volume, and causal replay tests remain passing.
- Validation: 257 tests / 1,581 assertions, lint/typecheck/build passed. Restarted managed
  LaunchAgent; synthetic 1440px/390px regression passed, including new-high label/pending
  stop, history, filters, charts and clipboard. Screenshots reviewed.
- Live public scan for October 27: VSTS retained 15.00/14.40/15.10, recorded breakout,
  In buy range, volume confirmation false (1,410,200 versus prior Avg50 1,397,128).
  SWKS new-high/no-pause label verified. TMO retains an earlier valid 703.20/662.50 setup,
  buy point 703.30, close 693.02, so it is Setup ready rather than new-high/no-pause.
- Replaying with ready retention can change historical setups; existing browser-local
  reconciliation behavior remains. No personal portfolio data or secrets were inspected.
- User verified VSTS and authorized delivery. Next: separate volume-status wording and
  report-only earliest-base comparison; do not commit that subsequent work.

## Two-contraction minimum — 2026-10-28

- Reduced the extra post-largest requirement from two later contractions to one.
  The evaluated suffix now permits 2–6 total. Largest selection/earliest ties, 115%
  tolerance, largest depth limit and smallest-last ≤10% checks are unchanged.
- Requested deterministic cases: [20, 8] passes; VSTS [5.88, 5.86, 6.05, 4.00]
  starts at #3 and passes; [13.88] alone fails. Existing boundary/lifecycle tests pass.
- Updated result failure wording, screener help, FAQ and README. No schema/history
  format change; current replay may qualify patterns that the prior minimum rejected.
- Full check: 252 tests / 1,544 assertions, lint/typecheck/build passed. Managed service
  restarted; synthetic desktop/mobile regression validation recorded in the current snapshot.
- Finding 1 was already committed/pushed as ddb5b65 before this work. Its live check
  was supplied by the user. User verified VSTS and authorized this fix for commit/push on 2026-10-28.
- Next: refresh/rerun Minervini and review VSTS, then await the user's next task.

## Finding 1: Yahoo session completion — 2026-10-27

- `fetchChartAnalysis` now attaches `chart.session` using `server/yahoo-session.ts`.
  Yahoo regular start/end establish the New York session date and close. The latest
  valid candle must match that date, regularMarketTime must reach close and not lie
  in the future, and the clock must reach close plus the configured delay (default 30
  minutes, `YAHOO_FINALITY_DELAY_MINUTES`). Missing or malformed fields keep final false.
- Prior-date bars remain eligible, including weekends/holidays. Scan summary reports
  latest available sessions included/excluded/unavailable across symbols. Other screening
  rules, frozen setup lifecycle and browser history formats remain unchanged; no migration.
- Tests cover fixed 3:30 PM exclusion, 4:45 PM inclusion, malformed/missing metadata,
  exact/configurable delay, future trades, date mismatch, early close/winter timezone,
  weekends/holidays, summary states and actual fetch-adapter-to-normalizer integration.
- Validation: 251 tests / 1,536 assertions plus lint/typecheck/build passed. Restarted
  the managed LaunchAgent. Synthetic browser regression passed on the running app at
  1440px and 390px; summary screenshots reviewed. Browser API interception used synthetic
  positions/watchlists and market data only. No personal data or secrets inspected.
- `MINERVINI_TEST_URL=http://127.0.0.1:3000` lets the browser script exercise the managed
  frontend while intercepting scans with the real handler and synthetic provider, without
  starting another server. Existing isolated ephemeral-server mode remains available.
- Same-day metadata policy is not a guarantee against Yahoo revisions; live-provider
  finality was not validated. Previous dated AAPL verification remains historical.
- Exact next step: refresh/rerun Minervini after close plus the delay and review the summary.
  User subsequently authorized commit/push of this fix and the preserved guide refresh
  on 2026-10-27. Delivery validation remains 251 passing tests plus lint/typecheck/build.

## Historical session log — not current instructions

Everything from here through the old work logs records the state at that time. Old test
counts, commits, uncommitted/no-push statements, last-four displays, full-array shrinking,
RS/TT8 and close-above-pivot breakout rules are superseded by the current snapshot above.
The Open Issues/Risks and Recommended Next Tasks at the end are background backlog only;
consult PROJECT_STATUS.md for the current priority and do not start them automatically.

## Commit and GitHub delivery — 2026-10-27

- User authorized committing and pushing the accumulated VCP fixes: pending tight
  contractions, pause-forming pivots, full numbered depths and failure reasons,
  largest-onward shrinking, pending stops, and consistent Buy Point breakout checks.
- This delivery includes regression tests, browser checks, README/FAQ and handoff
  updates. Earlier uncommitted/no-push statements below describe historical sessions.
- Latest full validation: 244 tests / 1,494 assertions, lint, typecheck and bundle passed;
  desktop/mobile synthetic browser regression passed. Managed app restarted and AAPL
  October 26 verified: pivot 351.73, stop pending, source pause forming, status
  No setup – pause forming (1 of 3 bars); no false October 22 breakout in current replay.
- Known limitations: provider finality and browser-local history reconciliation remain
  as documented. Exact next step after delivery: refresh/rerun Minervini and await the
  user's next task. No personal data or secrets included.

## Buy-point breakout consistency (Finding 5) — 2026-10-27

- A shared buy-point calculation (pivot + configured offset, default $0.10) now drives
  initial breakout and re-breakout: close must be strictly above Buy Point. After a
  breakout, close at or below Buy Point marks Failed breakout. Completion also requires
  close above Buy Point so it cannot bypass a failure. Volume remains an independent
  confirmation; frozen levels, stop handling, expiry and pivot-based 5% extension stay intact.
- Added tests for closes at pivot, between pivot/buy point, and exactly at buy point;
  excessive volume cannot force a price breakout. Tests cover low-volume price breakout,
  configurable offset, failed/re-breakout boundary, retained frozen levels and completion
  gating. README and FAQ updated. No portfolio or history schema changes.
- Validation: bun run check passed lint, strict TypeScript, 244 tests / 1,494 assertions
  and bundle. Synthetic Chrome regression passed desktop/mobile, labels, full depths,
  pending stop, history, sorting/filtering, charts and clipboard.
- Restarted managed LaunchAgent and verified AAPL-only endpoint for signal 2026-10-26:
  pivot 351.73 dated 2026-10-23; Buy Point 351.83; stop null/display pending;
  source pause forming; status No setup – pause forming (1 of 3 bars).
  The false October 22 breakout is absent from the current server replay. The reported
  348.22 close does not exceed the previous candidate's 348.25 Buy Point.
- Browser-local saved history reconciliation remains unchanged; previously saved records
  absent from replay may still be displayed with the existing reconciliation labels.
  Only public AAPL market data was inspected. No personal data/secrets accessed.
- Exact next step: refresh and rerun Minervini to review the corrected AAPL row and history.
  Existing local work preserved; no commit or push requested or performed.

## Full depths and largest-onward shrinking (Finding 2) — 2026-10-27

- Depths now show the total and every numbered percentage, oldest to newest. The cell
  identifies the evaluated starting contraction and lists indexed failure reasons, so
  no failing contraction is hidden. Forming-pause null stops display “pending”; numeric
  stops and other missing-data states retain their behavior.
- Shrinking starts at the largest contraction (earliest occurrence on equal maxima).
  Apply the 2–6 count to that suffix and require at least two contractions AFTER the
  largest, effectively 3–6 in the evaluated suffix. Preserve the 115% tolerance,
  smallest-last / ≤10% rule and existing 35% (configurable 50%) depth limit, applied
  to the largest. Earlier contractions remain visible but are excluded from these checks.
- Deterministic SWKS example [10.79, 13.88, 5.27, 3.55] now passes. Coverage includes
  suffix counts, two-following minimum, equal maxima, tolerance boundary and indexed
  failures, full nine-depth rendering and pending stops. Lifecycle fixtures now have
  enough contractions for the new minimum; freeze/reset/history rules are unchanged.
- Validation: bun run check passed lint, TypeScript, 241 tests / 1,453 assertions and
  bundle. Synthetic real-route browser regression passed at desktop/mobile widths,
  including all nine visible depths, numbered failures, pending stop, cell overflow,
  frozen levels/history, sorting/filtering, charts and clipboard. Screenshots reviewed.
- Restarted the documented LaunchAgent and verified the AAPL-only live endpoint BEFORE
  Finding 2: October 26 signal, 351.73 October 23 pivot, pause forming (1 of 3 bars),
  null stop. The service had initially still been running older code.
- Restarted and reverified AFTER Finding 2: historical replay now qualifies an October 22
  breakout and freezes the October 13 pivot 348.15 / stop 338.70. October 26 status is
  Failed breakout, with frozen depths [4.03, 3.18, 2.71] and no contraction failures.
  This is the new qualification rule affecting historical replay, not stale pivot fallback.
- README and FAQ updated. Optional diagnostic fields preserve older response support;
  no portfolio/history schema changes. Existing browser research-history reconciliation
  remains unchanged, so saved outcomes outside current replay can still be present.
  Only public AAPL data used for live verification; no personal data/secrets inspected.
- Exact next step: refresh the app and rerun Minervini to review all depths, indexed
  reasons, and the changed historical qualification. All work remains local/uncommitted;
  do not commit or push until asked.

## Pause-forming pivot follow-up — 2026-10-27

- A pending high younger than `minPauseBars` now replaces the candidate's older pivot
  with source “pause forming” and status “No setup – pause forming (N of 3 bars)”.
  Count still includes the high bar. Stop is the lowest subsequent prior low, or null
  when none exists; dependent risk values remain null. Forming candidates cannot break
  out. Active frozen setups keep their levels and all lifecycle rules remain unchanged.
- Reproduced AAPL using only its public analysis history through signal 2026-10-26.
  Full depths (%): 4.6688, 12.9350, 3.3611, 4.9701, 4.1432, 6.3208, 4.8184,
  4.0324, 3.1824. Exact contraction failures: “contraction count must be 2–6 (found 9)”
  and “a contraction exceeds 115% of its predecessor”. The displayed last four alone
  pass; all nine must still count. No contraction rule was changed.
- Updated replay shows pivot 351.73 dated 2026-10-23, pause forming (1 of 3 bars),
  stop null. Previously showed the 341.57 confirmed pivot dated October 8.
- Added tests for latest-bar pending high, nullable stop/risk, blocked premature breakout,
  two-bar stop, three-bar readiness, and the four supplied depths versus hidden failures.
  Adjusted synthetic lifecycle fixtures to retain confirmed-swing entry coverage without
  a fresh pending high. README/FAQ explain the forming state; no storage migration needed.
- Validation: full check passed lint, TypeScript, 239 tests / 1,441 assertions and bundle;
  isolated synthetic Chrome desktop/mobile checks passed labels, null-stop rendering,
  chart/history/filter/clipboard workflows. Screenshots reviewed. No personal data or
  secrets inspected. Existing local work preserved; no commit/push or service restart.
- Exact next step: restart the managed LaunchAgent, refresh, rerun Minervini and review
  AAPL's forming pivot and full Entry Status / Reason. Provider-finality and browser-local
  history limitations remain unchanged.

## Pending final tight contraction — 2026-10-27

- Added `minPauseBars` (default 3) and a pending final contraction after the last
  confirmed swing low following the base's last confirmed high. Select the highest
  subsequent high (latest ties), require three prior bars including that high, and
  append only a positive depth strictly below `zigzagPct`. Pivot/stop and contraction
  volume now use that pending high and its subsequent low. Full contraction rules apply.
- Candidate selection receives both swing kinds and filters `confirmedAt < signal index`.
  No signal/future bars enter pending selection. Frozen levels/source, stop-out,
  re-breakout, completion, expiry and history mechanics are preserved.
- Entry Pivot displays “confirmed swing” or “tight pause (<3%)” beneath its price,
  preserving column order/widths. Optional source metadata supports older result shapes;
  history storage and portfolio schemas/imports are unchanged. README and FAQ updated.
- Validation: `bun run check` passed lint, strict TypeScript, 237 tests / 1,422 assertions
  and bundle. Five new synthetic tests cover 98.50/97 levels and 1.52% depth, breakout,
  freeze, short pause/no confirmed low, 4% no-duplicate behavior and future-bar causality.
  Synthetic real-route Chrome regression passed desktop/mobile, labels/cell overflow,
  sorting/filter/history, chart and clipboard. Desktop/mobile screenshots reviewed.
- No personal portfolio data, secrets or live providers were inspected. No commit/push.
  Existing provider-finality and browser-local research-history limitations remain.
- Exact next step: restart the managed LaunchAgent to load the changed backend, refresh
  the app and rerun Minervini to review tight-pause pivots. The managed service was not
  restarted during this session; browser validation used an isolated synthetic server.

## Local commit delivery — 2026-10-26

- User authorized committing the accumulated Minervini implementation, chart, history,
  compact last-four display, tests and documentation. This snapshot is included in that
  local commit; earlier statements about uncommitted work are historical.
- Pre-commit full check passed: 232 tests, 1,395 assertions, lint, typecheck and bundle.
  Earlier desktop/mobile screener and FAQ checks passed. Known provider-finality and
  browser-local research-history limitations remain as documented below.
- Next: await the user's next task. Push only when requested; this delivery is local.

## Minervini documentation audit — 2026-10-26

- Added the missing FAQ → Screener → Minervini Technical guide: seven-rule count versus
  VCP qualification, last-four display, full contraction checks, pivot/stop, volume,
  frozen/reset history, chart and provider-finality limitation.
- README now explains the last-four display and links to the in-app guide. Screener help
  explicitly says hidden contractions still count. Marked the older continuation snapshot
  historical; dated implementation entries remain as history.
- Validation: full check passed 232 tests, lint/typecheck/bundle. Isolated FAQ desktop/mobile
  navigation, content and overflow checks passed using no portfolio or provider data.
- Next: refresh and open FAQ → Screener → Minervini Technical. Calculations unchanged;
  local work preserved, no commit/push requested.

## Last four displayed contractions — 2026-10-26

- Contraction Depths now shows at most the last four percentages, oldest to newest
  within that selection. Older values are hidden; the full array, sorting, VCP rules,
  qualification, pivot and stop remain unchanged. Expandable help explains the limit.
- Validation: 232 tests / 1,395 assertions, lint/typecheck/bundle and synthetic
  desktop/mobile browser checks passed. Direct six-value check confirms only the last
  four render and full data remains intact.
- Next: refresh and rerun Minervini to review SWKS. No commit or push; prior work preserved.

## Contraction Depths spacing — 2026-10-26

- Widened Contraction Depths from 160px to 240px and kept plain comma-separated
  percentages. Each percentage stays intact; longer lists wrap only between values.
  All six requested contraction/entry columns remain visible together at desktop width.
- No calculations changed. Full check passed all 232 tests, lint, typecheck and bundle;
  synthetic desktop/mobile browser checks passed and desktop screenshot reviewed.
- Next: refresh the app and review the simpler percentage list. No commit/push requested;
  earlier local work preserved.

## Compact rule display — 2026-10-26

- Removed individual TT1–TT7 table columns at the user's request. Pass Count and the 7/7
  filter still use the unchanged seven calculations. Rule outcomes are available on hover/focus
  of Pass Count, and definitions remain in the expandable help.
- The six contraction/entry columns now follow Pass Count. This frees 336px in the main table.
  Added a plain-language Contraction Depth formula/example to the help, including chronological
  ordering and preservation of original contraction depths on frozen breakout rows.
- Validation: full check passed 232 tests / 1,395 assertions, lint/typecheck/build. Browser
  regression checks absence of all TT columns, original six-column order and visibility,
  desktop/mobile layout, filtering, chart/clipboard and history.
- Next: refresh and rerun Minervini to review the compact table. No calculations changed;
  no commit or push requested. Earlier local work preserved.

## Visible VCP columns fixed — 2026-10-26

- Corrected the incomplete prior screen restoration: column order was present, but automatic
  table sizing and long missing-data cells pushed the six requested fields off-screen. A stale
  nth-child style also gave Entry Stop an unnecessary 220px minimum width.
- Added scoped fixed column widths and wrapping; removed the stale positional style. At 1440px,
  Contraction Depths, Contractions Shrinking, Volume Dry-Up, Entry Type, Entry Pivot and Entry Stop
  are all visible consecutively after TT7 without horizontal scrolling. Smaller screens retain
  contained horizontal scrolling; additional fields remain to the right.
- No formulas, qualification, history or API changes. Full check passed 232 tests / 1,395
  assertions, lint/typecheck/build. Desktop/mobile browser checks passed; new desktop assertions
  verify all six header bounding boxes are inside the visible table area. Screenshot reviewed.
- Next: refresh and rerun Minervini to review the visible columns. Changes remain local and
  uncommitted; no commit or push requested.

## Seven-rule screen restored — 2026-10-26

- At the user's request, removed TT8/RS scoring, ranking, SPY fallback, benchmark fetch,
  RS Rating/RS Source columns and the redundant Trend Status column. Qualification/count/filter
  are TT1–TT7 and 7/7 again; other symbols cannot change a ticker's qualification.
- Restored the consecutive columns immediately after TT7: Contraction Depths (heuristic),
  Contractions Shrinking, Volume Dry-Up, Entry Type (advisory), Entry Pivot, Entry Stop.
  Buy Point and the newer status/reset fields follow. Chart and History remain available.
- Preserved the new zigzag VCP, frozen pivot/stop, stop-out/re-breakout/completion/expiry
  rules and browser-saved history. IPO partial-history behavior remains, with its label
  moved into existing Data Status. No portfolio/schema changes.
- Validation: bun run check passed lint/typecheck, 232 tests / 1,395 assertions and bundle.
  Browser verification covers exact column order, absent RS/TT8/Trend Status, seven-rule
  filtering, reset history, chart/clipboard and desktop/mobile layout with synthetic data.
- Next: refresh the managed app and rerun Minervini to review the restored screen.
  No commit/push requested; all earlier local chart/code/documentation work preserved.

## Previous VCP/reset implementation — 2026-10-25 (RS superseded above)

- Supersedes the old seven-rule/no-RS, five-neighbor swings and rolling-10-bar price rules.
  Added 3% zigzag with latest ties, 15–325-bar bases, prior 120-bar/30% uptrend test, and 2–6
  contractions with 35% first / 15% tolerance / smallest-last ≤10% constraints.
- Base choice: newest confirmed high satisfying age and 5% tolerance, then evaluate prior
  uptrend and contractions; do not skip failing patterns to force qualification. New extreme
  cannot reverse on its own OHLC candle. The final contraction low may remain unconfirmed.
- Pivot is final contraction high, stop its later low, buy point pivot+$0.10, wide stop >8%.
  Prior-only Avg50 and final-contraction mean drive volume flags; chart volume line matches.
- Deterministic prefix replay freezes levels at the first qualifying close above pivot.
  Later stop touch wins, shows five-bar dated notice and restricts replacements to pivots after
  stop date while allowing earlier BH. Failed closes keep levels; recovery increments attempt
  count and retests volume. A post-breakout high/contraction completes a successful setup and
  starts a new BH. Otherwise expire after 60 bars. Consumed pivots are not reused.
- Added visible breakout date, setup status, attempts, stop notice, buy point and History.
  Browser stores up to 200 research setups/ticker in a versioned key, preserving outcomes
  across resets/reloads. These are not portfolio trades or part of portfolio JSON exports.
- TT1–TT7 formulas preserved; IPO histories evaluate available rules individually. TT8 uses
  weighted 63-session-quarter returns, tied 1–99 percentiles on same-date watchlist scores,
  or aligned 252-session SPY relative-high fallback. All-pass is 8/8, with RS source disclosed.
- Same-day normalization accepts explicitly certified final bars after matching regular close.
  LIMITATION: Yahoo adapter lacks that assertion; live same-day bars still remain excluded.
  Do not infer finality merely from wall-clock time. No provider/portfolio data was inspected.
- Validation: bun run check passed lint, TypeScript, 235 tests / 1,405 assertions and bundle.
  Synthetic Chrome desktop/mobile passed TT8/IPO/status/history, sorting/filter/list changes,
  frozen-anchor preview, SMA/volume lines, PNG clipboard and denial recovery, and Analyze lines.
  Screenshots reviewed. No personal data or live market providers used for verification.
- Exact next step: refresh the managed app, rerun Minervini, and review Setup Status and History.
  Work is local/uncommitted, including earlier chart/docs changes; no commit/push requested.

Older entries below describe superseded behavior where they differ from this snapshot.

## Chart preview follow-up — 2026-10-24

- Added Copy chart: writes the visible chart as PNG with symbol and scan date, including both
  panes and overlays. Disabled until loaded; reports success or clipboard-denied guidance.
- Added 20/50/200 close-based SMAs for display only, with exact warmup and no future bars.
  Dialog now uses nearly the full viewport. Pivot uses a finite segment from the most recent
  matching high in its prior 10-bar window through the signal bar. No screening changes.
- Validation: bun run check passed 221 tests / 1,345 assertions, lint/typecheck/build.
  Synthetic Chrome desktop/mobile workflows passed actual PNG clipboard reads, denial recovery,
  chart layout and prior regression checks. Screenshots visually reviewed.
- Next: refresh managed app and review Chart / Copy chart. All work remains uncommitted;
  no push requested. Existing local documentation changes remain preserved.

## Minervini chart preview — 2026-10-24

- Added Chart beside Close in the Minervini results. Opens a native dialog with daily
  candlesticks, a volume pane, signal-inclusive 50-bar SMA volume, and the scanned entry pivot.
  Data ends at the scan date; latest provider bars cannot move the chart past that date.
- Reuses the local Analyze API and existing volume SMA helper. No screener formulas,
  qualification rules, price levels, persistence or API changes. Existing Analyze action remains.
- Explicit loading/error states, request timeout/cancellation, chart disposal and responsive
  sizing with autoSize:false. Close/Escape preserves the table state.
- Validation: bun run check passed 219 tests / 1,330 assertions, lint/typecheck/build.
  Synthetic browser regression passed desktop/mobile, rendered chart labels, dismissal,
  existing sorting/filtering/universe checks and four Analyze chart lines. Screenshots reviewed.
- Implementation and documentation are local/uncommitted. Earlier documentation edits preserved.
  Next: refresh the managed app and review Screener → Minervini Technical → Chart.

## Previous continuation snapshot — 2026-10-24 (historical, superseded)

Read PROJECT_STATUS.md first for the concise, authoritative handoff. Application commit
635b510 is on main and was pushed to GitHub; local and remote heads were verified equal.
The documentation refresh for this handoff is local and uncommitted. No application changes
or implementation tasks are pending. Latest full validation passed 216 tests / 1,320 assertions,
lint, typecheck and build; desktop/mobile checks passed October 23.

Minervini now uses seven independent trend rules with RS removed. Pivot and stop always use
the fixed previous N bars (default 10), excluding the latest bar, with N+1 bars sufficient.
Entry classification and quality flags are separate. A base low inside the window yields
“still in pullback, no tight area yet” while prices remain visible. Price-only and
volume-confirmed breakout are separate. README documents the exact current rules.

For a new chat, use this same local project directory. Read AGENTS.md, PROJECT_STATUS.md,
this file and README.md; inspect Git status and wait for the user's next task. Keep today's
New York bar excluded, preserve the seven rules and do not tune rules to force ticker matches.
The next engineering priority, if requested, is tested backups/restores and schema versioning.
See the open risks and roadmap at the end of this file. No fresh commit/push is authorized
by the documentation refresh itself.

## Historical work log

The dated entries below are retained as history, not current instructions. Older uncommitted/
unpushed statements were superseded by commit 635b510 and its October 24 push. Earlier TT8,
RS, longest-qualifying-pause, and missing-pivot behavior were superseded by the October 22–23
changes and the current summary above. Historical test counts are not the current total.

## Fixed prior-window pivot and stop — 2026-10-23

- Supersedes the entry-status-only fix below: entry levels no longer depend on a qualifying
  pause. Pivot is max high and stop is min low of the previous N bars, excluding the signal
  bar; N defaults to 10 via MINERVINI_DEFAULTS.pivotLookbackBars. N+1 valid bars suffice.
- Tightness, quiet volume and stop width are separate flags. Added pauseContainsBaseLow;
  when true, entryType is none with “still in pullback, no tight area yet,” retaining prices.
  The UI shows the reason and all flags. Price breakout is separate from 1.4x volume confirmation.
  TT1–TT7 and existing base classification thresholds remain unchanged. No persistence changes.
- Added AAPL-like regression coverage, configurable-window and N+1 boundary tests, latest-bar
  exclusion, and UI regression assertions for numeric levels when no entry qualifies.
- Validation: bun run check passed lint, typecheck, 216 tests / 1,320 assertions and bundle.
  Synthetic browser regression passed desktop/mobile, sorting/filtering and four chart lines.
  Restarted managed app; AAPL-only live route returned Oct 22 pivot 348.15, stop 330.70,
  entryType none with pullback reason, price breakout true (+0.02%), volume breakout false.
  isTight=false, volumeQuiet=false, stopTooWide=false, pauseContainsBaseLow=true.
- Exact next step: refresh the app and rerun Minervini to see the new levels and flags.
  Changes remain local and uncommitted; no commit or push performed in this session.

## Minervini entry-status fix — 2026-10-22

- Root cause: the UI formatted every null field as “Insufficient data,” including intentionally
  absent pivot/stop levels when valid history yielded entryType=none. Passing all seven trend
  rules does not imply a qualifying advisory entry pause.
- Pivot/stop now show “No setup” for evaluated nonqualifying entries; dependent risk/distance
  fields show “Not applicable.” Truly missing/invalid history retains “Insufficient data.”
  Qualifying entries retain their numeric pivot/stop. An Entry Status / Reason column explains
  base/pause rejection (range, volume, chronology, or base-low violation).
- Added optional entryReason metadata with fallback for legacy results. Entry selection,
  formulas, trend qualifications, and chart prices are unchanged. Removed stale percentile
  wording left behind after RS removal. No persisted data or migration changes.
- Validation: bun run check passed lint/typecheck, 214 tests / 1,280 assertions, and build.
  Browser regression passed desktop/mobile, explicit no-setup vs missing-history cell labels,
  numeric pivot/stop for qualifying fixtures, sorting/filtering, and four chart lines.
  Managed app restarted. Public-symbol smoke checks reproduced valid history and explained
  nonqualifying entry pauses; there was no missing-data error for those examples.
- Exact next step: refresh the app and rerun Minervini, then read Entry Status / Reason beside
  Entry Pivot/Stop. No commit or push requested or performed.

## Historical RS removal (2026-10-22)

- At the user's explicit request, removed the RS criterion completely from Minervini Technical:
  TT8, weighted return scores, percentile ranking, 50-symbol minimum, configuration constants,
  result fields, table column, and RS help/status wording. Qualification is now TT1–TT7 only.
- Counts and filtering now use 7/7 and “All 7 rules pass only.” Each symbol qualifies independently
  of other symbols or provider failures. The 260-bar history requirement, seven trend formulas,
  VCP/entry advisory logic, dated chart lines, other screeners, and ALL remain unchanged.
- Replaced obsolete RS tests with regressions proving a single symbol can pass, comparison-list
  changes cannot affect it, and RS fields are absent. Browser coverage confirms no TT8/RS columns,
  seven-rule filtering, one-symbol qualification, desktop/mobile layout and all four chart lines.
- Validation: bun run check passed lint, strict TypeScript, 212 tests / 1,264 assertions, and
  production build. Updated Minervini browser regression passed. Managed server restarted;
  the reported public ticker now returned 7/7, allPass=true, and no RS fields in a live smoke test.
- Compatibility: results are transient, with no database or saved-settings migration required.
  The internal result shape intentionally drops RS fields; refresh existing app tabs and rerun
  scans to load the matching frontend. README reflects the new behavior. Earlier RS investigation
  and eight-rule implementation notes below are historical and superseded by this change.
- Exact next step: refresh the app, select Screener → Minervini Technical, and rerun the active
  Watch List. No commit or push requested or performed; all Minervini work remains local.

## RS exclusion investigation — 2026-10-22

- Reproduced the reported Minervini exclusion with the full user-authorized watchlist scan.
  The full universe had sufficient valid scores; the reported candidate failed TT8's >=70
  threshold while passing TT1–TT7. Independently checked its percentile from the count of
  lower/tied scores. The all-eight-pass filter therefore excludes it as designed.
- Earlier single-symbol troubleshooting produced an insufficient-universe result that did
  not describe the full scan. This was a diagnostic-context mistake, not a reproduced ranking
  defect. Do not use a single-symbol request to diagnose universe-relative qualification.
- No formula/filter changes. Private watchlist membership and scan results are not recorded
  here. Validation: bun run check passed, 214 tests / 1,274 assertions, lint/typecheck/build.
- Exact next step: user reviews the full scan with the all-eight-pass filter cleared to see
  failed candidates. Keep the requested RS threshold unchanged unless explicitly instructed.
  Minervini work remains uncommitted; no commit or push requested for this investigation.

## Minervini Technical completed — 2026-10-21

- Added an independent technical-only Screener panel and `POST /api/screeners/minervini`.
  Pure formulas live in `server/screeners/minervini.ts`; configurable named defaults preserve
  existing indicators and screeners. No fundamentals, personal data, schema changes, or ALL integration.
- TT1–TT8 include tri-state rule outcomes and numeric inputs, 260-bar minimum, 252-bar extremes,
  22-bar SMA200 slope, and weighted return-score universe percentiles (1–99, tied midranks).
  Fewer than 50 valid scores makes TT8 null. Strong SMA200 slope needs 305 bars.
- VCP is explicitly heuristic, with confirmed five-neighbor swings and volume dry-up. Entry
  types are advisory. User approved the prior-bar pause interpretation: the base and longest
  qualifying 5–10-bar pause are frozen before the signal bar, then the signal close and volume
  test breakout. This prevents breakout from redefining its own pivot. A signal-bar base-low
  breach invalidates entry. The 50-bar volume average includes the signal bar.
- Table supports default all-pass/count/absolute-pivot-distance sorting, column sorting,
  all-eight-pass filter, clear missing-data states, and numeric rule tooltips/accessibility text.
  Analyze draws four labeled, dated Lightweight Charts price lines. autoSize remains false.
- Three bounded technical chart requests, 20-second provider timeout, 400-symbol / 16-KiB
  request limits, duplicate-symbol removal, cancellation, and one active universe scan. The
  Minervini route disables only its own idle timeout so longer valid scans can finish.
- Validation: `bun run check` passed lint, strict TypeScript, 214 tests / 1,274 assertions,
  and production bundle. New tests cover formulas, entry types, boundaries, missing data,
  ranking, route isolation, payload limits, sorting, and chart selection.
- `scripts/verify-minervini.mjs` passed with real route and synthetic provider data: desktop
  1440px and mobile 390 × 844, no page overflow, sorting/filtering, universe changes, failure
  isolation, and all four actually rendered chart labels. Screenshots visually reviewed.
- Existing R9 browser regression passed, including Launch Pad, MA Alignment and ALL checks.
  Managed app restarted; live QQQ/SPY API smoke test returned HTTP 200, October 20 signal dates,
  no load errors, and null TT8 for the two-symbol universe as expected.
- Limitation: same conservative completion policy as R9 excludes today's New York bar even
  after close. Scanned symbols may have different last-available dates, displayed per row.
  Thresholds are configuration constants/evaluator arguments, not new interactive settings.
- Exact next step: refresh the running app and review Screener → Minervini Technical using
  an active Watch List (50+ valid symbols for RS). Review Analyze price lines for entry rows.
  No commit or push requested or performed for Minervini. Changes remain local for user review.

## Previous completed feature snapshot (R9)

- Branch: `main`.
- Repository: `https://github.com/jawaid/Stock-Tracker`.
- Default local URL: `http://127.0.0.1:3000/` when `bun run start` or `bun run dev` is running.
- Runtime: Bun 1.3.14 or newer; dependencies are locked in `bun.lock`.
- Persistence: local SQLite at ignored path `data/portfolio.sqlite`, mirrored to browser storage.
- Application tabs: Overall Dashboard, Market Condition, Sector Performance, US Sectors & Themes,
  Positions, Watch List, Screener, Analyze, History, Deepvue, Settings, and FAQ.
- Current feature work: R9 Swing is implemented as an independent Screener panel with its own
  evaluator, controller, diagnostics, rule states, CSV/TXT exports, and tests. ALL is unchanged.
- Current user-facing blocker: none found in R9 verification. Same-day New York candles remain
  excluded even after close because Analyze does not certify session finality.
- Current validation: `bun run check` passes (191 tests, 1,150 assertions), including lint,
  strict TypeScript and production bundling. R9 browser workflows passed at 1440px desktop
  and 390 × 844 mobile, both with a temporary frontend and the restarted managed app.
- Documentation: `AGENTS.md` is the durable guide and this handoff tracks current work.

On this Mac, LaunchAgent `com.jawaid.stock-tracker` manages the local server. It starts with
the Mac user session and restarts on exit. Stop it before running `bun run dev` manually;
README documents lifecycle commands. Other checkouts still use `bun run start` normally.

## Recent Changes

- 2026-10-20: Added independent R9 Swing using the active Watch List. Exactly eleven entry
  checks implement the requested SMA10/20/50/100/200, SMA20>SMA50, MACD>0, Wilder +DI>-DI,
  up close, same-day SMA10 low touch within three bars, and signal-inclusive average-volume
  requirements. RSI14/RSI2, ADX14, ATR, returns and SPY-relative diagnostics do not affect entry.
  Close<EMA10 is a separate technical exit status regardless of holdings. Existing screeners,
  ALL source selection, portfolio formulas, storage and schemas are unchanged.
  Reuses existing SMA/EMA, Wilder ATR and RSI helpers; adds a focused Wilder DMI/ADX helper.
  Requires 200 valid OHLCV bars; missing history/load failures are unavailable, not failed matches.
  Uses the existing conservative completion policy: today's New York candle becomes eligible
  the next calendar day, even after market close. 52-week high requires 252 bars. Benchmark
  endpoints align by date; missing SPY only removes optional diagnostics.
  Added 41 deterministic tests, sortable columns, Matches Only, displayed-row CSV with rule
  states, matching-only TXT, keyboard-scrollable result table, FAQ and README documentation.
  Browser checks verified dates, unavailable coverage, sorting, filtering, both downloads,
  missing SPY, panel retention, FAQ, and no page overflow at desktop/mobile widths. Separate
  checks compared Launch Pad/MA Alignment rows and ALL AND/OR results to unchanged evaluators.
  The older `verify-launch-pad.mjs` script passed its Alex checks but stopped at a stale fixture
  expectation (two Launch Pad matches versus three produced by the unchanged evaluator).
  This legacy script remains unchanged; the new `verify-r9-swing.mjs` regression passed.
  Restarted the managed service. Live QQQ/SPY smoke check used 500 completed bars through
  2026-10-19, with RS available and independent entry/exit statuses. No personal holdings were
  read or modified; browser checks intercepted portfolio APIs with synthetic fixtures.
  User authorized a local commit; no push requested. Next: user review in Screener → R9 Swing;
  decide separately whether to
  add verified same-day completion metadata or future ALL integration.


- Installed per-user LaunchAgent `com.jawaid.stock-tracker` on 2026-10-15 at the user's request.
  Configuration is `~/Library/LaunchAgents/com.jawaid.stock-tracker.plist`; private logs are
  `~/Library/Logs/StockTracker/{stdout,stderr}.log`. Loopback binding and existing startup
  behavior are preserved. Verified plist syntax, HTTP 200, and automatic recovery after
  terminating the server. Actual logout/reboot startup remains untested; logs append without
  automatic rotation. No application code changed. README documents service management.
  Next step: confirm availability after the next normal Mac sign-in; no reboot needed now.

- 2026-10-15 health check: `bun run check` passed (150 tests / 1,049 assertions, lint,
  TypeScript, production build). Found the local app offline, then started it with
  `bun run start` at the user's request. Homepage, QQQ analysis, market, and sectors
  endpoints returned HTTP 200; all 11 sectors had prices without errors. Browser confirmed
  Market Condition data and the QQQ Risk-Off gauge. Server left running; no application
  code changed. Full workflow/mobile regression and personal database integrity were not
  checked. Next step: use the app and await the user's next priority; data safety remains
  the first engineering roadmap item.

- Fixed the QQQ risk gauge: price below the 21 EMA now shows Risk-Off regardless of EMA
  slope, including when slope is unavailable. Above-EMA classification retains its rising-trend
  requirement; equality remains Mixed. Extracted a pure classifier with deterministic regression
  coverage for the reported values, trend directions, equality, and missing inputs. No stored
  data/schema changes; existing chart payloads remain compatible. Validation: `bun run check`
  passes (150 tests, 1,049 assertions). Restarted the local server and verified the reported
  $728.95 price / $740.69 EMA / +$0.29 trend shows Risk-Off in the live UI at 1280px and
  390px widths, with no mobile horizontal overflow.

- Added ALL as an independent Screener combination panel. It defaults to AND across Alex Rules,
  Launch Pad, and MA Alignment; supports AND/OR and any nonempty source subset; and uses each
  screen's current settings and original evaluator. Each ticker is fetched once and displayed once
  with source statuses and dates. CSV and symbol-only TXT exports follow the combined view.

- Added Export TXT to Alex Rules, Launch Pad, and MA Alignment. Each download contains only the
  currently displayed ticker symbols in comma-separated order, with duplicate Alex setup rows
  collapsed to one symbol. Screening calculations and existing CSV exports are unchanged.

- Added an independent MA Alignment screen with its own evaluator, controller, results/CSV helpers,
  host, storage key, FAQ, and deterministic tests. It qualifies symbols when three configurable
  averages fit within a configurable band; defaults are 10 EMA, 21 EMA, 50 SMA, and 3%. It excludes
  today's New York bar, requires the longest configured period, and does not depend on Launch Pad
  files or state.

- Fixed watch-list refresh silently omitting symbols after the quotes API’s 40-symbol cap. Browser refresh now requests sequential batches of at most 40, deduplicates tickers, and reports failed/missing responses while continuing later batches. Regression coverage includes ANF as the 81st symbol. Validation: all 134 tests pass; live 41-symbol request returns ANF in the second batch. With user-approved browser access, verified ANF populates in the 111-symbol AI watch list and remains populated after manual Refresh data (price, EMA, lower structure, RSI, and other metrics).

- Refined Pre-Market/Post-Market briefs with concise narrative commentary and dated breadth
  context. Both panels have independently collapsed Key news, View details about breadth,
  and Upcoming economic releases sections with matching 14px labels and expansion state
  preserved during refresh. Sources, timestamps, feed limitations, and calculations remain
  unchanged. User reviewed and approved the layout and authorized commit/push on 2026-09-30.
  Validation: bun run check passes (132 tests, 1,015 assertions); browser DOM confirms both
  panels' collapsed controls and matching fonts. Full automated responsive visual checks
  remained blocked by the terms dialog; user supplied screenshots and approved the result.

- Updated FAQ navigation to Screener → Alex Rules / Launch Pad, matching product labels. Clarified that Buying Weakness tests proximity rather than a confirmed pullback/reversal, and Alex can use unfinished daily bars. Fixed Alex summary matches to follow selected setups, excluding near misses; no qualification rules changed.

- Buying Weakness audit (default settings, 2026-09-29 bars): 111 symbols, 110 usable, 29 Buying Weakness and 2 Buying Strength matches; SPX failed to load. Independent calculations agreed, including 1,000 synthetic scenarios and boundary checks. The summary-count issue found in this audit is now corrected to follow selected setups. No additional pullback/reversal requirement was added.

- Alex Rules now uses Wilder/RMA ATR (14 by default), including distance and low-touch selection rules. Added ATR% = ATR / Close × 100; removed Status from the table. Near-miss reasons remain under Setup matched; CSV includes ATR% and Failed rules. Saved ATR periods remain respected. Analyze reference ideas and Launch Pad are unchanged. Validation: 132 tests / 1,015 assertions and browser regression passed, including ATR% display and removal of Status. User tested and approved these screener changes; authorized local commit and GitHub push on 2026-09-30.

- Added Alex Rules Risk R = Close - EMA-low stop, and %R = Risk R / Close × 100, with sortable columns and raw numeric CSV fields. Shortened Stop loss header with explanatory tooltip. Optional metrics preserve older result compatibility. Values use the same bar as Close and retain negative results. No selection-rule changes. Validation: bun run check passed (130 tests / 1,004 assertions); browser regression passed including risk values, CSV, sorting, and mobile/desktop layout. Included in the user-approved screener changes.

- Added Alex Rules Stop loss (21 EMA of lows) for both setups, using the existing seeded EMA helper and the same daily history/date as each result. Sorting and CSV include the value. Fixed EMA independent of SMA/band settings; no match-rule or chart change. Optional metric field preserves older result compatibility. Validation: bun run check passes (129 tests / 992 assertions). Extended browser regression verifies displayed EMA-low values, sorting, CSV column, responsive layout, and preservation of Launch Pad/Alex workflows; desktop/mobile screenshots reviewed. Included in the user-approved screener changes.

- Added Launch Pad under Screener. Pure `public/screens/launch-pad.ts` tests whether SMA21, SMA50,
  and EMA65 fit within a shared percentage band. The default maximum spread is 3%. Results sort by
  MA spread ascending. Symbols outside the band can be displayed with their failed spread; no implicit volume,
  relative-strength, new-high, entry, stop, or range qualification is added.
  Launch Pad has its own panel/controller/storage, three bounded requests, timeout/cancellation,
  and uses the existing Analyze endpoint and indicator helpers unchanged. The new panel registry
  and wrapper provide navigation while leaving the legacy Alex registry list/controller intact.
  Analyze does not expose verified session finality, so Launch Pad excludes today's New York bar
  even after close; it becomes eligible the next calendar day. The warmup is 65 valid bars for
  EMA65, with distinct insufficient/load-failure counts.
  README and FAQ document the behavior and limitations. `scripts/verify-launch-pad.mjs` provides
  the synthetic browser regression workflow; see README for its optional Playwright dependency.

- Added an app-wide Disclaimer and Terms of Use experience. The full terms appear as a dedicated
  FAQ topic and in a first-launch browser dialog; acceptance is stored only in that browser and
  requires the **I have read and agree** button. A short educational-use reminder now appears at
  the bottom of every app tab. This does not alter any calculation, market-data request, Screener
  result, or portfolio data.

- Expanded the FAQ with a **Stock Screener** topic using the existing topic-button and card layout.
  It documents the active Watch List scan, Alex Rules, every exact parameter label/default,
  structure-band behavior, result-table fields, near misses, CSV export, unavailable data,
  troubleshooting and candidate-only disclaimer. Documentation only; no Screener calculations,
  data loading or behavior changed. Full validation remains 118 tests and 887 assertions.

- Added an active-Watch-List **Screener** tab. The self-contained `Alex Rules` screen evaluates
  Buying Weakness and Buying Strength separately using daily bars, selectable EMA/SMA 21-period
  structure, an optional high/low structure band, simple 14-period ATR, rising/slope lookbacks,
  a shared maximum distance above structure, and all requested defaults. It scans with three
  bounded requests, reports unavailable symbols, supports one-rule near misses, sortable results,
  CSV export and Analyze navigation. Parameters save only in the current browser and Reset restores
  defaults. Pure indicator/screen/registry modules keep future screens independent of the UI.
  Deterministic tests cover EMA/SMA, ATR, both setups, extension/near-miss behavior, structure-band
  reference selection and registry behavior. Full validation passes with 118 tests and 887
  assertions plus lint, strict type checking and production bundling.

- Added browser-saved ChatGPT Prompt Settings under Settings. One validated, editable, app-wide
  complete prompt now feeds every Copy for ChatGPT request. It includes a rising-21EMA pullback into
  structure and a lost-structure reclaim/reversal, each requiring price within one ATR of the
  rising 21 EMA. Each prompt describes the current app-detected
  Setup 1, Setup 2, both, or neither condition using current price, 21DMA and daily-candle data.
  Prompt wording is neutral app language and explicitly excludes personal holdings, budget and
  risk-tolerance assumptions. Defaults can be restored without affecting Rotation Settings or any
  market calculations. The prompt is technical-only: it does not request fundamentals, news, or a
  combined fundamental assessment. For each setup, it requests a Buy/Hold/Sell decision and, when
  not Buy, the next buy price plus the required price-action confirmation. Settings now shows a
  read-only complete instruction preview; a stock-specific snapshot and condition are added only
  when Copy for ChatGPT runs from Analyze. The editable text uses `{{currentCondition}}` as a
  placeholder for the app-calculated condition. The default prompt also explicitly states that
  Setup 1 needs a completed bullish reversal in the pullback zone and Setup 2 needs a recent close
  below the rising 21 EMA followed by a bullish recovery above it.
  Full validation passes with 112 tests and 874 assertions, plus lint, strict type checking and a
  production bundle build.

- Fixed a live U.S. Sectors & Themes outage caused by Yahoo returning a trailing current-session
  timestamp with a null close for every U.S. ETF. Normalization now discards trailing unpriced
  placeholders and uses the most recent completed close, while interior gaps remain invalid for
  returns and rotation. A focused regression test reproduces the provider response. Live endpoint
  and browser verification restored 20/20 ETF readings on the Sep 18 completed session. Full
  validation passes with 107 tests and 853 assertions.
- Added a Settings tab with local slider controls for each Rotation horizon’s smoothing,
  normalization, and momentum lag. Save and Reset to defaults affect both Rotation and Stock Leaders.
  The server validates every query setting, caches raw market history privately, recalculates only
  rotation outputs for a distinct settings profile, and keeps histories out of public API responses.
  Defaults remain Short 10/20/3, Medium 60/60/5, Long 6/6/1. New deterministic coverage rejects
  malformed settings and proves configured recalculation uses the existing cached provider data.
- Expanded the informational FAQ tab into an investor guide for Performance, Rotation, and Stock
  Leaders. It now explains the sector-to-stock workflow, current browser-saved Rotation settings,
  RS-Ratio/RS-Momentum, all four Stock Leader combinations, their research priority, result-row
  fields, caps and limitations. It adds one clearly labeled external RRG education link and makes
  no data requests or calculations. Full automated validation passes: 106 tests and 849 assertions.
  Desktop browser checks covered all three FAQ sub-tabs and the external link; mobile visual review
  remains pending.

- Final clarification: “OR” refers to instrument type (stock or ETF), NOT stage matching. Restored
  strict Medium AND Short criteria. All 20 ETFs themselves plus their top-ten holdings are scanned.
  ETFs reuse the existing dashboard rotation; stocks retain their independent SPY calculations.
- One combined ranking, up to ten results per screen. ETF rows count toward their own ETF group’s
  two-result cap alongside assigned stocks. ETF holding entries are not requoted or duplicated.
  New optional instrumentType preserves legacy stock row compatibility. UI labels Stock/ETF and
  renders ETF own readings without fictitious holdings weights. No storage/schema/formula changes.
- Final validation: 103 tests / 835 assertions, lint/typecheck/build and mixed-row browser checks
  pass. Live scan covers 175 instruments (155 stocks + 20 ETFs), one unavailable history. Results
  are 2 Recovering, 6 Confirmed (including ETF IGV), 2 Emerging, 6 Early after group caps. All live
  rows verified against AND rules, unique tickers, caps and displayed API metrics; desktop/mobile
  screenshots reviewed. No commit or push requested for these changes yet.
- Previous AND-stock-only counts below describe the earlier audit, not the final mixed screen.
- Corrected Stock Leaders: scan the available top ten holdings of all 20 tracked ETFs, independent
  of ETF stage or missing ETF rotation readings. Each stock qualifies solely on its own Medium/Short
  readings against SPY. Shared quote deduplication, rank order, maximum ten results and maximum two
  per primary source ETF remain unchanged. No formula, storage or schema changes.
- Updated coverage/empty-state wording and README so source ETFs are not described as matching
  the stock screen. Regression coverage proves all four stock stages are found despite Lagging or
  unavailable ETF readings, excludes holdings beyond the top ten, and checks shared quote reads,
  source caps, provider failures and partial scan recovery. Existing browser checks pass at eight widths.
- Live Sep 18 closing-data scan: holdings loaded for 20/20 ETFs; 155 supported unique stocks,
  one insufficient-history stock (SPCX), six unsupported foreign holding entries. Displayed counts:
  Recovering 2, Confirmed 5 (8 qualify before caps), Emerging 2, Early 6. Counts are a dated snapshot.
  GOOG and GOOGL are distinct share-class tickers, not distinct company exposures; existing selection
  deduplicates tickers, not issuers. Broader industry/issuer diversification remains a limitation.
- Independent calculations from fresh SPY/stock histories matched all four RS metrics for all
  15 displayed stocks (1e-8 tolerance). Live browser values/counts matched the API across all four
  screens; desktop/mobile screenshots verified. App restarted locally for review.

- Rotation emerging/fading leadership summaries now display ticker prefixes such as $XLI.
  Display-only change across all three horizons; underlying symbols and calculations unchanged.

- Added Stock Leaders beside Performance/Rotation. Four screens: Leader Recovering (Medium
  Leading / Short Improving), Confirmed Leader (Leading / Leading), Emerging Leader (Improving /
  Leading), Early Improvement (Improving / Improving). Both ETF and stock must match the combination.
  Rows show each stock's own seven requested fields plus source ETF and dated holdings snapshot.
- Scan only the top ten available holdings of matching ETFs. Deduplicate quote symbols across
  ETFs and compute stock Medium/Short using the existing pure rotation function against the same
  SPY history and cutoff as the ETF snapshot. Require valid aligned endpoints and sufficient history.
- Rank by Medium RS-Ratio, Medium RS-Momentum, Short RS-Momentum, Short RS-Ratio descending,
  then ticker. Up to ten unique stocks per screen, at most two per source ETF. Primary source is
  highest holding weight among matching ETFs, ticker breaks ties; never reassign to evade cap.
  Conflicting duplicate metrics are excluded. ETF overlap remains possible and is disclosed.
- Server-only dashboard snapshot accessor retains benchmark history. Stock history is retained in
  the existing quote cache; public holdings/dashboard responses still omit history arrays. No schema,
  portfolio changes, credentials, dependencies or changes to established rotation formulas.
- On-demand GET /api/stock-rotation starts/joins a bounded in-memory scan and returns progress.
  Four stock workers, shared holdings/quote caches, five-minute result cache (one minute partial).
  UI polls while active, retains dated results on failure, preserves selected screen across visits,
  and displays explicit empty, unsupported and unavailable counts. Desktop table/mobile cards.
- Initial live scan: 17 unique stocks from matching IGV/CIBR; six Confirmed Leader matches,
  three selected after source cap (NET, RBRK, PANW). Other screens had no matching ETFs. This is
  a dated observation (Sep 18 closes), not a fixed expected output or advice.
- Validation: stock-screen browser checks passed all seven fields for 40 synthetic rows, source
  dates, keyboard navigation, polling/retry, late responses, no screen-switch refetch, empty states,
  escaping and eight viewport widths. Existing ETF Rotation and holdings browser suites also pass.
  Independent live calculations from fresh SPY/stock histories matched NET, RBRK and PANW on all
  four numeric RS readings (tolerance 1e-8). Server restarted with the final code for local review.

- Added Performance/Rotation switch inside US Sectors & Themes, maintaining existing light styling.
  Short/Medium/Long presets share pure `public/sector-rotation.ts`. SMA/normalization/lag are
  10/20/3 daily, 60/60/5 daily and 6/6/1 monthly; warmups 51 sessions, 183 sessions, 17 months.
  Population z-scores centered at 100, Neutral for boundaries/constant windows. Explicitly an
  RRG-style approximation, not proprietary JdK or actual dollar flows. No performance guarantees.
- Existing ETF requests use standard five-year range for monthly history; all other assets retain
  two years. Compute once per cached snapshot, remove raw history from API. No extra per-horizon
  fetches or persistent changes. NY current day is excluded, including after close; monthly mode
  excludes current month. Align on SPY dates, preserve gaps, reject conflicting duplicates and stale
  benchmark endpoints, trim pre-inception dates. Missing history is unclassified, never zero-filled.
- Quadrant chart has up to eight trailing observations and per-symbol highlighting; emerging and
  fading leadership summaries, exact values/dates, stage and momentum sorting, per-horizon filter
  retention, and mobile cards. Legacy responses without rotation show unavailable gracefully.
- Validation includes independent streaming formula oracle, all four stages, causal tails, exact
  warmups, month-end alignment, NaN/duplicates/gaps, provider isolation and snapshot caching.
  Browser fixture suite checks every displayed value across horizons, filters, selection, refresh
  failure and recovery, legacy data, escaping and eight viewport widths. Existing holdings browser
  regression suite also passed. Live initial check: 20/20 ETFs across all three horizons, daily
  signals Sep 11 and monthly signals Aug 31 (performance can show Sep 14 partial prices).
  Final live API-to-UI check matched all 20 sector stages in all horizons. Browser tests also
  verify chart quadrant coordinates and independent horizon filter retention. Final server is
  running on port 3000. User approved local commit after review.

- Investigated reported AI → Back → Energy confusion. Live holdings switched correctly, but the
  unchanged full leaderboard order and generic heading made selection unclear. The active ETF and
  its holdings now appear first, with the ETF/name in the heading; the other sectors remain sorted
  by the chosen period. Back clears selection, and every new visit starts at the selected sector.
  Reject mismatched-symbol detail responses. Browser regressions use distinct per-ETF holdings and
  quotes and explicitly cover AIS → Energy and AIQ → Energy, including repeated visits.

- Primary theme cards now show SPY, QQQ, SMH, IWM, BTC, VIX, Participation. ETH was replaced by
  SMH per user request. SMH's card and sector row reuse a single provider reading per refresh.

- Added the secondary sector/theme leaderboard within the existing tab and light style. Primary
  row buttons open the selected ETF expanded, sorted by the originating panel's period. The Back
  button preserves primary periods, scroll and keyboard focus. Six return columns sort both ways,
  missing values last; expand/collapse rows show up to ten holdings. Mobile table becomes cards.
- Both screens use the same in-memory ETF snapshot and return normalization. Added nullable volume
  and Wilder ATR(14)% to the existing response, without altering return formulas; missing legacy
  fields remain supported. No storage/schema change or portfolio data use.
- Public Stock Analysis holdings tables supply names, literal percentage weights and snapshot dates.
  The local catalog/detail endpoints allow only the 20 configured ETF symbols. Structural HTML
  parsing validates headers, weights and dates, caps downloads at 1MB, and never evaluates scripts.
  Snapshots cache one hour; holding quotes five minutes; failures one minute. Four shared workers,
  in-flight deduplication and a bounded quote cache limit provider traffic. Holding prices reuse
  Yahoo daily normalization; foreign listings are not guessed or substituted with US ADRs.
- Live check: all 20 ETFs / 200 holdings loaded, 193 entries with daily/weekly prices. Six foreign
  entries are unsupported (AIS/AIQ Korean listings; SHLD UK/German/French/Italian listings); APGE
  had no valid latest daily price. Snapshot dates range July 30–September 4 while equity price data
  is September 11. Dates, older-snapshot notices and quote coverage are explicit. Source availability
  and delayed holdings remain material limitations, not claims of current fund composition.
- Expanded tests cover ATR seeding/gaps/smoothing, unchanged returns, volume compatibility, holdings
  parsing, malformed payloads, duplicate weights, symbol restrictions, cache expiry and concurrency.
  Optional fixture browser suite: scripts/verify-theme-drilldown.mjs; see README. Tests cover keyboard
  navigation, all 114 available ETF return cells, both sort directions, unavailable rows, ten holdings,
  escaping, delayed responses, retry/error retention, back scroll/focus, reload and mobile/desktop fit.
- Final visual checks verified live XOP and AIS at 1440/820/390px. Fixed holdings text wrapping,
  contained the wide tablet table and its accessible labels, and wrapped app tabs at tablet widths.
  The Back header remains available while scrolling. Independently verified XOP/AIS/SMH ATR%, volume
  and 1D/1W/1M returns against raw daily provider bars. User approved local commit; no push requested.

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

1. `public/app.ts` remains large, with substantial browser state, rendering, forms, storage
   and interactions despite existing extracted modules.
2. `server.ts` remains large, combining route wiring and market orchestration alongside
   focused modules under `server/`.
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
