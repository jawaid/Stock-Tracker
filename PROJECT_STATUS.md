# Project Status

Updated: 2026-10-24. Read `AGENTS.md` for repository rules and `HANDOFF.md` for detailed history.

## Commit handoff — 2026-10-24

- User requested a local commit of the completed Minervini Technical screener, seven-rule
  qualification, prior-window pivot/stop fix, separate quality/breakout flags, UI and tests.
- Validation rerun: bun run check passed lint, typecheck, 216 tests / 1,320 assertions and build.
  Desktop/mobile browser validation from October 23 remains applicable; no code changed today.
- This commit includes code, tests and documentation only. No portfolio data or secrets.
  No new known issues from validation. GitHub push is not part of this request.
- Exact next step: refresh the app and rerun Minervini; push this commit when requested.

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

## Current Minervini behavior — RS removed (2026-10-22)

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

## Latest completed work — R9 Swing (2026-10-20)

- R9 Swing is available in Screener as an independent panel. Its eleven entry rules are
  separate from RSI/ADX/relative-strength diagnostics and the completed-close EMA10 exit.
  Existing screeners and ALL retain their calculations and source selection.
- Includes sorting, Matches Only, displayed-row CSV with individual rule states, matching-only
  TXT, explicit data failures, FAQ and README help. No portfolio/schema changes.
- Validation: `bun run check` passed lint, TypeScript, 191 tests / 1,150 assertions and build;
  41 new focused R9 tests passed. Browser workflows passed desktop 1440px and mobile 390 × 844,
  including exports, sorting/filtering, completion cutoff, optional SPY, coverage and existing
  panel checks against their unchanged evaluators. Screenshots reviewed; no page overflow.
- Managed app restarted and its served frontend passed the same isolated browser workflow.
  Live public QQQ/SPY API smoke test succeeded: 500 completed QQQ bars through 2026-10-19,
  relative-strength diagnostics available, entry false and independent EMA10 exit true.
- Limitation: today's New York candle is excluded even after close; eligible next calendar day.
  Analyze has no verified session-finality flag. No Bollinger diagnostic added. 52-week high
  requires 252 bars; other required indicators have a 200-bar minimum.
- Legacy `scripts/verify-launch-pad.mjs` passed Alex checks but stopped on its outdated expected
  match count (2 expected / 3 actual). Its evaluator and script were not modified. New browser
  coverage validates Launch Pad, MA Alignment and ALL against their existing evaluators.
- No personal portfolio data inspected or modified. User authorized a local commit of the R9
  implementation and documentation. Preexisting status-note edits are preserved. No push requested.
- Exact next step: review Screener → R9 Swing in the running app. Keep ALL integration and
  verified same-day session completion as separate follow-up decisions. If returning to the
  reliability roadmap, start with timestamped SQLite backups and synthetic restore tests.

The earlier snapshots below describe work completed before R9 and remain for context.

## Current state

Stock Tracker is a local-first, single-user Bun 1.3.14+ / strict TypeScript / SQLite app with
vanilla browser TypeScript and Lightweight Charts. It supports portfolio risk, watchlists,
market condition/breadth, sector rotation, screening, stock analysis, and trade history.
On this Mac, LaunchAgent `com.jawaid.stock-tracker` now manages http://127.0.0.1:3000/.
It starts with the Mac user session and restarts on exit. No app login is required.
Stop the service before using `bun run dev`; see README for service commands.
Health check on 2026-10-15: started with `bun run start` after finding the app offline.
The server is now running at http://127.0.0.1:3000/. Homepage, QQQ analysis, market, and
sectors endpoints returned HTTP 200; all 11 sectors returned prices without errors.
Browser verification confirmed the Market Condition view and QQQ Risk-Off gauge load.

## Completed and decisions

- Installed the authorized per-user macOS LaunchAgent outside the repository. The service uses
  the existing Bun runtime and checkout, binds to loopback, and keeps private stdout/stderr logs
  under `~/Library/Logs/StockTracker/`. No application code or database schema changed.
- Verified plist syntax, live HTTP 200, and automatic restart after terminating the server
  (new server PID and HTTP 200). Actual logout/reboot startup was not tested. Logs append
  without automatic rotation. README documents status, restart, stop, resume, and uninstall.

- Screener includes independent Alex Rules, Launch Pad, and MA Alignment screens, plus ALL
  combining selected sources with AND/OR. CSV and symbol-only TXT exports are available.
- Latest health review: Bun 1.3.14 and all automated checks passed; app started and live smoke checks passed.
- Latest functional change: fixed QQQ vs 21 EMA incorrectly showing Mixed when price was below
  a rising EMA. Below EMA now means **Risk-Off**, regardless of slope or missing slope.
- Above EMA still requires positive slope for Risk-On; flat/negative slope gives Mixed.
  Equality with known slope remains Mixed. Missing price/EMA, or missing slope at/above EMA,
  remains Unavailable. Other gauges and participation rules were not changed.
- Legacy `sma21`/`smaTrend` fields represent the existing EMA data; payload compatibility is
  preserved. No persistence/schema changes. The 21-day EMA continues to use closes.

## Files changed by latest fix

- `server/market-risk.ts`: extracted pure QQQ classifier with corrected below-EMA rule.
- `server/market-risk.test.ts`: four deterministic regression tests covering the reported
  values, slope directions/missing slope, above/equal/below boundaries, and unavailable inputs.
- `server.ts`: wires the QQQ gauge to the extracted classifier; removes the old classifier.
- `HANDOFF.md`: records the fix and validation.
- `PROJECT_STATUS.md`: this documentation-only continuation snapshot.

## Validation

- `bun run check`: passed lint, strict TypeScript, all **150 tests / 1,049 assertions**, and
  production bundle validation after the fix. Initial import-order lint issue was corrected.
- Live browser: QQQ $728.95 versus EMA $740.69 with +$0.29 slope now shows Risk-Off and
  “Below 21 EMA”; verified at 1280px desktop and 390 × 844 mobile with no horizontal overflow.
- `git diff --check`: passed. No live-provider dependency in the regression tests.

## Git

- Branch: `main`; remote: https://github.com/jawaid/Stock-Tracker.git.
- Previous commit before this documentation update: `a703261` — `Require project status updates at handoff`; committed and pushed.
- Working tree was clean at the start of this health review; HEAD matches cached `origin/main`.
  Health-review and service documentation changes are authorized for commit and push.
  The LaunchAgent and runtime logs remain machine-local, outside Git.
- No application code changed. No personal data files or environment files inspected;
  normal app startup and browser rendering used the existing local store.
- Health-review validation: `bun run check` passed on 2026-10-15 (150 tests / 1,049 assertions,
  lint, strict TypeScript, and production bundle validation). `git diff --check` passed.
- Live Market Condition UI and representative public-data endpoints passed smoke checks.
  Full workflow/mobile regression and personal database integrity checks were not performed.

## Known issues and next step

No confirmed remaining regression in the QQQ fix. Engineering backlog: whole-snapshot SQLite
writes can overwrite changes from concurrent tabs; automatic backups/restores and schema
versioning are absent; provider failures/stale data remain possible; browser workflow coverage
and API typing need improvement. Breadth/McClellan are proxies. Large server/frontend modules
still need gradual extraction. HANDOFF's Current Status test count (146) predates the latest
fix; its recent-change entry and the 150-test result above are newer.

**Exact next step:** use the managed app; after the next normal Mac sign-in, confirm
http://127.0.0.1:3000/ opens automatically without a terminal. No reboot is needed now.
Await the user's next priority. If continuing the roadmap, inspect `server/portfolio-store.ts`
and its tests, then implement timestamped SQLite backups and a restore workflow tested with
synthetic fixtures, followed by schema versioning. Do not commit/push without a new request.
Keep `HANDOFF.md` and this snapshot current at the next handoff.

## Status review — 2026-10-20

- Local homepage responds HTTP 200. No application changes made.
- Fresh `bun run check` passed: lint, strict TypeScript, 150 tests / 1,049 assertions,
  and production bundle validation. Initial sandbox run could not complete SQLite tests;
  rerun with temporary-file write access passed all checks.
- Working tree was clean before this status update; main matches cached origin/main at
  `67571ce` (no remote fetch performed).
- Existing engineering risks remain unchanged. Browser workflows, provider endpoints,
  database integrity, and startup after sign-in were not reverified in this review.
- Exact next recommended engineering step: inspect `server/portfolio-store.ts` and its tests,
  then implement timestamped SQLite backups and a restore workflow using synthetic fixtures,
  followed by schema versioning. Await user direction before implementation.
