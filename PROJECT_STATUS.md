# Project Status

Updated: 2026-10-30. This is the concise current snapshot. Read AGENTS.md for durable
rules, HANDOFF.md for continuation details/history, and README.md for setup and features.
Source and tests are authoritative; historical handoff entries are not current instructions.

## Minervini table display update — 2026-10-30

- Moved Signal Date, Breakout Date, Attempts, Recent Stop-Out, Entry Status / Reason,
  Risk %, Prior Avg50 Volume, Final Contraction Avg Volume, Breakout / Re-breakout Bar,
  Breakout + Volume, Stop Too Wide, SMA200 Rising (~5m), and Data Status into a collapsed
  View explanation disclosure under Action. Main table now shows the requested 17 columns,
  including % From Pivot, Base High and Base Low.
- Display only. AI watchlist comparison used the same provider-fetched bars for the pre-change
  and updated renderers. All 167 result objects and every result/display field matched; all
  58 sort orders matched. Scan timestamp 2026-10-30T17:52:07.918Z; 58 all-pass, 5 unavailable.
  Only AI watchlist ID/ticker columns were read; private comparison data remains under /tmp.
- Synthetic browser regression passed at desktop/mobile, covering exact table headers, all 13
  detail values, compact/expanded behavior, existing filters/sort/chart/history flows. Full
  `bun run check` passed: 264 tests / 1,627 assertions, lint, typecheck and production build.
  Screenshots reviewed. Managed service was not restarted; synthetic regression ran against it.
- Known limitation: mobile and desktop tables retain horizontal scrolling for the 17 columns.
  No calculations, API, persisted data or sorting behavior changed. No commit made.
- Exact next step: user reviews the display in the managed app; wait for feedback.

## GitHub delivery — 2026-10-30

- User authorized committing the preserved documentation and pushing all pending work.
- Application commit `7b7b5fe` has been pushed to `origin/main` successfully.
- This documentation delivery includes the previously uncommitted README/HANDOFF/status
  refresh and updates the continuation prompt. Earlier unpushed/uncommitted snapshots
  below are historical and superseded by this delivery.
- Fresh `bun run check` passed: 264 tests / 1,627 assertions, lint, typecheck and build.
  The initial restricted run could not create synthetic SQLite test files; rerunning with
  temporary-file access passed. No personal database or secrets were accessed.
- No application changes in this session. Prior desktop/mobile UI checks remain applicable;
  browser checks were not repeated. The managed service was not restarted.
- Known limitations remain as listed below. Exact next step: verify the documentation
  delivery commit matches GitHub main and the working tree is clean, then await the user.

## New-chat handoff — 2026-10-29

- Verified HEAD: `7b7b5fe` on `main`; UI changes and prior documentation committed locally.
  Not pushed; latest recorded pushed application commit remains `7c35977`.
- This subsequent handoff refresh changes only README.md, HANDOFF.md and PROJECT_STATUS.md
  and remains uncommitted. AGENTS.md and in-app help/FAQ are current; preserve all local edits.
- No application work remains pending. Exact next step: open a new chat in this same
  checkout, paste the README continuation prompt, read the four documents, check Git,
  summarize and await the next task. Do not commit or push without a new request.
- The managed service continues independently; opening a chat does not require a restart.

## Latest UI change — 2026-10-29

- Entry Status / Reason now uses a collapsed “View explanation” disclosure. Rows size
  naturally to visible content and expand/collapse on demand, eliminating height caused
  by offscreen long explanations. Native keyboard interaction is supported.
- Follow-up validation: full check passed (264 tests / 1,627 assertions); synthetic
  desktop/mobile regression verified compact height with a long explanation, expansion,
  keyboard collapse and restored height. Compact screenshots reviewed. UI-only changes.
- Contraction Depths now shows only the last four percentages in chronological order
  (or all available when fewer than four), without totals, numbering or explanations.
  Full contraction data, evaluation rules, sorting and lifecycle remain unchanged.
- Commit `7b7b5fe` packages the UI changes, regression updates, in-app help/FAQ, README,
  current snapshots and the preserved AGENTS.md documentation refresh.
  Latest pushed application commit remains `7c35977`; `7b7b5fe` is local only.
- Validation: `bun run check` passed 264 tests / 1,627 assertions, lint, typecheck and
  bundle. Synthetic browser regression against the managed app passed at 1440×1000
  and 390×844; depth screenshots reviewed. No personal data accessed.
- Next step: refresh the app to view the compact column; await the user's next request.
  Commit authorized; push not requested. Known limitations below remain unchanged.

## Delivery and working tree

- Branch: `main`; repository: https://github.com/jawaid/Stock-Tracker.
- Latest local delivery: `7b7b5fe`, “Compact Minervini results and expand explanations on demand”.
  Latest pushed application commit: `7c35977` (Entry Type geometry and volume wording).
  Prior fixes: `1244a86` ready-pivot retention, `128b79e` two contractions,
  `ddb5b65` same-day finality.
- The prior four-file documentation refresh is included in this local commit.
- Finding 4 full dry run is complete for all 59 all-pass results from the running API.
  At that earlier scan, the authorized read-only AI watchlist contained 166 symbols.
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
- The UI shows only the last four depths without explanation; evaluation uses all depths.
  Shrinking starts at the largest contraction (earliest if tied). The 2–6 count applies
  to that suffix, with at least one contraction AFTER the largest: 2–6 total.
  Largest ≤35% (configurable 50% bear limit), each later depth ≤115% of its predecessor,
  last smallest within the suffix and ≤10%. Depths before the largest are excluded from shrinking checks.
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
- Exact next step: open a new chat in this same local checkout, read the four continuation
  documents, inspect Git state, summarize and wait for the next task. No application work
  remains pending from this session. Push only if the user requests it.
- Reports under `/tmp` are temporary and may disappear after cleanup/reboot. Aggregate
  verification is recorded here and in HANDOFF.md; private watchlist/report data stays outside Git.
