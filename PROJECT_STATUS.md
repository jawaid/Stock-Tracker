# Project Status

Updated: 2026-10-26. Read AGENTS.md for rules, HANDOFF.md for continuation context,
and README.md for setup and feature documentation. Source and tests are authoritative.

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

## Current VCP/reset implementation — 2026-10-25

- Supersedes the old five-neighbor swings and rolling-10-bar price rules.
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
- TT1–TT7 formulas preserved; qualification is 7/7 with no RS. IPO histories evaluate available
  rules individually and label partial history in Data Status, without an extra Trend Status column.
- Same-day normalization accepts explicitly certified final bars after matching regular close.
  LIMITATION: Yahoo adapter lacks that assertion; live same-day bars still remain excluded.
  Do not infer finality merely from wall-clock time. No provider/portfolio data was inspected.
- Validation: bun run check passed lint, TypeScript, 232 tests / 1,395 assertions and bundle.
  Synthetic Chrome desktop/mobile passed seven-rule/IPO/status/history, sorting/filter/list changes,
  frozen-anchor preview, SMA/volume lines, PNG clipboard and denial recovery, and Analyze lines.
  Screenshots reviewed. No personal data or live market providers used for verification.
- Exact next step: refresh the managed app, rerun Minervini, and review Setup Status and History.
  Work is local/uncommitted, including earlier chart/docs changes; no commit/push requested.

## Earlier chart-preview work — 2026-10-24 (before VCP rewrite)

- Added a Chart column beside Close in Minervini Technical. It opens an accessible,
  dismissible chart dialog while preserving the screener results, sorting and filters.
- Daily candlesticks share the time axis with volume bars and a 50-bar simple average-volume
  line. The chart ends at the selected scan date, and the entry pivot uses the existing row value.
  No qualification, pivot/stop, entry, persistence or API calculations changed.
- Follow-up: Copy chart copies a PNG of the visible chart with symbol and scan date.
  Clipboard denial gives retry guidance. Added close-based 20/50/200 SMA overlays and expanded
  the dialog to nearly the full viewport. Pivot is a segment from the latest matching high
  in the prior 10-bar window through the signal bar; its scanned value is unchanged.
- Validation: bun run check passed lint, TypeScript, 221 tests / 1,345 assertions and bundle.
  Synthetic Chrome workflow passed at 1440px desktop and 390px mobile, including rendered
  volume/average/pivot labels, dialog dismissal, and existing Analyze lines; screenshots reviewed.
  Actual PNG clipboard reads passed at both widths; permission-denied feedback also passed.
  Focused tests cover SMA warmup/values/cutoff and pivot segment anchors/ties.
- Changes are local and uncommitted. Earlier local documentation updates were preserved.
- Exact next step: refresh the app, open Minervini Technical → Chart, and review the SMAs, pivot segment
  and Copy chart action.
  Await user review; no commit/push requested. Existing reliability backlog remains unchanged.

## Current delivery and Git state

- Branch: main. Repository: https://github.com/jawaid/Stock-Tracker.
- Application commit: 635b510 — Add Minervini Technical screener with independent pivot and stop levels.
  Pushed to origin/main and verified against GitHub on October 24. R9 Swing is also committed/pushed.
- The earlier handoff documentation edits remain local. The chart-preview implementation above
  now also differs from the delivered commit; nothing new has been committed or pushed.
- VCP/reset rewrite and chart preview are ready for review. No confirmed new regression from the latest checks.

## Current screener behavior

- Panels: Alex Rules, Launch Pad, MA Alignment, R9 Swing, Minervini Technical, ALL.
  ALL still combines only the first three. R9 remains unchanged.
- Current Minervini behavior is defined in the VCP/reset snapshot above and README.
  Old rolling-window price rules are superseded; the latest request restores no-RS qualification.

## Validation and operation

- Latest full check, October 26: bun run check passed lint, TypeScript, 232 tests /
  1,395 assertions and production bundle validation.
- October 26 synthetic browser regression passed desktop/mobile, sorting/filtering,
  seven-rule/IPO/reset history, clipboard copying and chart lines.
- App URL: http://127.0.0.1:3000/. On this Mac, LaunchAgent com.jawaid.stock-tracker
  manages the service. Do not start a competing server; see README for lifecycle commands.
- No portfolio data, environment files or secrets were inspected or changed for this handoff.

## Known limitations and next step

- Legacy verify-launch-pad.mjs has an outdated expected match count; the newer R9 browser
  regression checks the unchanged Launch Pad/MA Alignment/ALL evaluators successfully.
- Existing engineering backlog: automatic backups/restores, schema versioning, protection
  against concurrent-tab snapshot overwrites, provider resilience, typed API contracts,
  broader portfolio workflow tests and gradual extraction of large modules.
- LaunchAgent startup after an actual logout/reboot has not been verified; logs do not rotate.
- Exact next step: open a new local Codex chat in this same project, read AGENTS.md,
  PROJECT_STATUS.md, HANDOFF.md and README.md, inspect Git status, then take the user's next task.
  Do not change screener rules to match a ticker. Do not start backlog work
  or commit/push these documentation edits without a request.
