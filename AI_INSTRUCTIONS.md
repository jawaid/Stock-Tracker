# AI Development Instructions

These are the repository-specific working rules for future AI coding agents. They supplement the
top-level `AGENTS.md` instructions. If instructions conflict, follow the higher-priority system,
developer, or nearest-directory `AGENTS.md` rule.

## Required Reading Order

Before changing code:

1. Read `AGENTS.md`.
2. Read this file.
3. Read `PROJECT.md` for product intent, architecture, implemented features, formulas, limitations,
   technical debt, and roadmap.
4. Read `HANDOFF.md` for current status, recent changes, open issues, and immediate priorities.
5. Read `CLAUDE.md` for commands and concise implementation notes.
6. Inspect the relevant source and tests. Do not rely only on documentation because code is the
   final authority for current behavior.

## Core Working Principles

- Preserve the local-first, single-user product model unless the user explicitly requests a
  platform change.
- Implement requested changes end to end: understand, edit, test, visually verify when relevant,
  and report the outcome.
- Prefer the repository's existing patterns and helpers over new frameworks or broad rewrites.
- Keep changes tightly scoped. Do not mix feature work with unrelated refactors or metadata churn.
- Treat the working tree as shared. Never revert or overwrite changes you did not make.
- Do not commit or push automatically. Only do so when the user explicitly asks.
- Never expose, inspect unnecessarily, stage, or commit personal portfolio data or secrets.

## Runtime and Commands

- Use Bun 1.3.14 or newer. Do not introduce npm- or Node-specific workflow commands without a clear
  need and documentation update.
- Default app URL: `http://127.0.0.1:3000/`.
- Use another port only when 3000 is genuinely unavailable: `PORT=3001 bun run start`.
- Development server with hot reload: `bun run dev`.
- Normal local server: `bun run start`.
- Format: `bun run format`.
- Lint: `bun run lint`.
- Typecheck: `bun run typecheck`.
- Tests: `bun test`.
- Required final validation: `bun run check`.
- The SQLite persistence tests create temporary directories and may require filesystem permission in
  a restricted execution environment.

## Code Style

- Write TypeScript, HTML, CSS, and embedded SQL consistent with surrounding files.
- Follow strict TypeScript and ES module conventions. Avoid increasing `any` usage; introduce real
  interfaces at touched boundaries when practical.
- Follow Biome: 2 spaces, 100-character line width, double quotes, and semicolons.
- Use ASCII unless an existing file or user-facing term clearly requires Unicode.
- Use succinct comments only where math, data normalization, fallback behavior, or control flow is
  not self-explanatory.
- Keep domain values numeric until rendering; centralize currency, percent, date, and compact-number
  formatting.
- Escape all dynamic or external text before interpolating it into `innerHTML`.
- Prefer structured parsers and response objects over ad hoc string manipulation.
- Preserve compatibility with legacy import payloads unless a planned migration explicitly removes
  it.

## Architecture Boundaries

### Server

- `server.ts` is the Bun entry point and route composition root. Avoid adding more large domain
  blocks there when a focused module can own them.
- Put reusable indicator math in `server/indicators.ts` or a new focused domain module and add unit
  tests.
- Put single-stock research behavior in `server/analyze.ts` until it is deliberately split into
  provider/technical/fundamental services.
- Keep portfolio types, normalization, and SQLite access in their existing `server/portfolio-*`
  modules.
- The browser must call local `/api/*` routes. Do not call Yahoo or constituent providers directly
  from frontend code.
- Keep route handlers thin when adding new endpoints: validate input, invoke a service, and return a
  consistent response.

### Frontend

- `public/index.html` defines stable semantic structure and IDs; `public/app.ts` owns state and DOM
  rendering; `public/styles.css` owns presentation.
- Do not add a frontend framework to solve a narrow feature. Modularize vanilla TypeScript first.
- Reuse the existing state/render/event pattern until a deliberate architecture migration is
  approved.
- Retain the active tab after add/edit actions. Only navigate when the action's purpose is explicit,
  such as Watch List Analyze opening the Analyze tab or closing a trade opening History.
- Give charts stable explicit dimensions. Keep Lightweight Charts `autoSize: false` and use the
  existing explicit resize path to avoid ResizeObserver loop errors.

### Persistence

- Primary personal data lives in ignored `data/portfolio.sqlite`; browser storage is a fallback, not
  a replacement for durable server persistence.
- Keep SQLite foreign keys enabled and writes transactional.
- Any schema change must include a migration plan, backward-compatibility test, and update to
  `PROJECT.md` and `HANDOFF.md`.
- Preserve server payload limits unless a documented need changes them: 500 open positions, 2,000
  history records, 30 watchlists, and 1,000 total watchlist items.
- Never add real portfolio fixtures to tests. Use synthetic symbols, prices, and temporary databases.

## Financial and Market-Data Rules

- Treat all external values as nullable, delayed, and untrusted.
- Preserve source and freshness metadata when adding data to APIs or UI.
- Do not silently substitute one financial definition for another. Document formulas and labels in
  code/tests and update `PROJECT.md` when a user-facing metric changes.
- Current definitions that must remain stable unless the user requests a change:
  - 21-day EMA uses daily closes.
  - Lower Structure uses a 21-day EMA of daily lows.
  - RSI uses 14 daily periods.
  - Open Heat is `max(0, current price - stop) * shares`.
  - UER uses market value of open lots below 5% unrealized profit divided by priced market value.
  - FER uses market value of open lots with a current-price-to-stop gap below 5% divided by priced
    market value.
- Label breadth and McClellan outputs as proxies when they use component samples rather than official
  exchange advance/decline feeds.
- Keep provider failures isolated. One bad symbol, sector, news request, or fundamental request
  should degrade to an unavailable state rather than blanking unrelated data.
- Do not present heuristic sentiment or market classifications as factual predictions or financial
  advice.

## UI and UX Standards

- Preserve the quiet, dense dashboard style. Build working product surfaces, not marketing sections.
- Reuse CSS tokens in `:root`, the 8px radius, restrained shadows, and existing color semantics.
- Blue: primary action. Teal/green: constructive, gain, or risk-on. Amber: caution. Red: loss,
  risk-off, or destructive. Gray: secondary or unavailable.
- Forms for occasional workflows should stay hidden until requested.
- Use segmented controls for modes/ranges and sortable/searchable tables for dense financial data.
- Confirm destructive actions. Prefer accessible in-app dialogs if replacing current
  `window.confirm`/`window.prompt` flows.
- Maintain semantic headings, labels, keyboard-operable controls, active/pressed states,
  `role="status"`, and visually hidden legends.
- Do not rely on color alone; pair it with labels, signs, or status text.
- Preserve responsive behavior at 1400px and 760px. Wide data tables may scroll horizontally, but
  controls and text must not overlap or clip.
- Use Loading, Unavailable, and error states that preserve the last usable data where practical.

## Error Handling and Security

- Validate and normalize at API and persistence boundaries.
- Keep local API responses `no-store` and use consistent 400/404/405/500/502 semantics.
- Cap request bodies and collection sizes before persistence.
- Use `try/catch/finally` for frontend async state so loading controls always recover.
- Show concise user-facing messages; do not render raw stack traces or provider payloads.
- Use partial degradation for external APIs and `Promise.allSettled` where optional data sources are
  independent.
- Validate outbound news links and escape provider text.
- Do not add credentials to source. Use ignored environment files for any future provider keys and
  document required variable names without secret values.
- Do not weaken `.gitignore` protections for `data/`, `.env*`, logs, or build output.

## Testing and Verification

- Add or update focused tests for changed formulas, normalization, persistence, classifications, or
  server-side analysis.
- Use deterministic fixtures. Do not make unit tests depend on live Yahoo, Wikipedia, iShares, or
  Nasdaq Trader responses.
- For UI changes, test the exact user workflow in the running app, including the resulting tab,
  symbol, persisted state, loading state, and browser console.
- Test desktop and mobile widths when layout, tables, controls, or charts change.
- Before finishing, run `bun run check`, which must pass lint, strict typecheck, all Bun tests, and
  the full-stack Bun bundle.
- If a check cannot run, state that clearly; do not claim validation from inspection alone.

## Git and Change Management

- Inspect `git status` and the diff before editing and before committing.
- Keep unrelated user changes intact and out of the commit when possible.
- Use focused commit messages that describe behavior, not implementation trivia.
- Never use destructive Git commands unless the user explicitly requests them.
- After a requested push, verify the working tree is clean and `git rev-parse HEAD` matches
  `git rev-parse origin/main`.
- Report the commit hash and push result to the user.

## Documentation Responsibilities

- `PROJECT.md`: durable architecture, stack, implemented features, formulas, limitations, debt, and
  roadmap. Update after major features or architecture/data-source changes.
- `HANDOFF.md`: current status, recent changes, active issues, and recommended next work. Update at
  logical handoff points and after meaningful commits.
- `AI_INSTRUCTIONS.md`: normative coding and development guidance. Update only when repository
  policy, workflow, or standards change.
- `CLAUDE.md`: concise commands and implementation notes. Keep it synchronized with architecture or
  workflow changes.
- `README.md`: user-facing setup and short product introduction. Update when installation, startup,
  or top-level capabilities change.

## Definition of Done

A change is complete when:

1. Requested behavior works end to end and preserves existing relevant workflows.
2. Data definitions and fallbacks are explicit and correct.
3. Tests appropriate to the risk are added or updated.
4. `bun run check` passes.
5. UI behavior is verified in the running app when applicable.
6. `PROJECT.md` and `HANDOFF.md` are updated if the feature, architecture, limitations, or current
   status changed.
7. The final response concisely states what changed, what was verified, and anything not completed.
