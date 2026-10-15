# Project Status

Updated: 2026-10-15. Read `AGENTS.md` for repository rules and `HANDOFF.md` for detailed history.

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
