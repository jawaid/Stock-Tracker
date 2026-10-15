# Project Status

Updated: 2026-10-14. Read `AGENTS.md` for repository rules and `HANDOFF.md` for detailed history.

## Current state

Stock Tracker is a local-first, single-user Bun 1.3.14+ / strict TypeScript / SQLite app with
vanilla browser TypeScript and Lightweight Charts. It supports portfolio risk, watchlists,
market condition/breadth, sector rotation, screening, stock analysis, and trade history.
Run `bun run dev` (development) or `bun run start` at http://127.0.0.1:3000/.
The server was restarted after the latest fix; verify availability in a new session.

## Completed and decisions

- Screener includes independent Alex Rules, Launch Pad, and MA Alignment screens, plus ALL
  combining selected sources with AND/OR. CSV and symbol-only TXT exports are available.
- Latest completed task: fixed QQQ vs 21 EMA incorrectly showing Mixed when price was below
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
- Last commit: `14f954be5f65420b576472f7c6b498fadb70f46b` — `Fix QQQ risk gauge below 21 EMA`.
- Fix committed and pushed; local HEAD equals cached `origin/main`, and push success was verified.
- Working tree was clean before this status-document request. This new file is uncommitted;
  no code was changed for this request. Do not commit/push further work without a new request.

## Known issues and next step

No confirmed remaining regression in the QQQ fix. Engineering backlog: whole-snapshot SQLite
writes can overwrite changes from concurrent tabs; automatic backups/restores and schema
versioning are absent; provider failures/stale data remain possible; browser workflow coverage
and API typing need improvement. Breadth/McClellan are proxies. Large server/frontend modules
still need gradual extraction. HANDOFF's Current Status test count (146) predates the latest
fix; its recent-change entry and the 150-test result above are newer.

**Exact next step:** no implementation task is currently pending. Wait for the user's next
priority. If asked to continue the roadmap, read `server/portfolio-store.ts` and its tests,
then implement timestamped SQLite backups and a tested restore workflow using synthetic
fixtures, followed by schema versioning. Do not inspect personal `data/` or environment files.
Run `bun run check` before finishing changes and verify meaningful UI changes at desktop/mobile
widths. Keep `HANDOFF.md` and this snapshot current at the next handoff.
