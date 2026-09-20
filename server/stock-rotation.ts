import { computeRotation, rotationPresets } from "../public/sector-rotation";
import { emptyTheme, type ThemeReading, themeAssets } from "../public/sector-theme-model";
import {
  matchesStockScreen,
  rankStockCandidates,
  type StockRotationCandidate,
  type StockRotationScan,
  type StockRotationStatus,
  type StockSource,
  stockScreens,
  validStockRotation,
} from "../public/stock-rotation-model";
import type { ThemeHolding, ThemeHoldings } from "../public/theme-holdings-model";
import { fetchThemeDashboard } from "./sector-themes";
import { themeHoldingsService } from "./theme-holdings";

export function createStockRotationService(
  snapshot = () => fetchThemeDashboard.rotationSnapshot(),
  holdings = themeHoldingsService.holdings,
  quote = themeHoldingsService.quote,
  clock = () => Date.now(),
) {
  let state: StockRotationStatus = {
    loading: false,
    progress: { phase: "Not scanned", completed: 0, total: 0 },
    result: null,
    error: "",
  };
  let pending: Promise<void> | null = null;
  let expires = 0;
  async function scan() {
    if (pending) return pending;
    if (clock() < expires) return;
    state = {
      ...state,
      loading: true,
      error: "",
      progress: { phase: "Loading ETF rotation", completed: 0, total: 0 },
    };
    pending = (async () => {
      try {
        const { dashboard, benchmark, cutoff } = await snapshot();
        const reference = computeRotation(benchmark, benchmark, rotationPresets.medium, cutoff);
        if (!validStockRotation(reference, reference.asOf))
          throw new Error(
            "SPY rotation history unavailable or stale. Retry after refreshing market data.",
          );
        const asOf = reference.asOf;
        const groups = stockScreens.map((screen) => ({
          ...screen,
          etfs: dashboard.themes.filter(
            (etf) =>
              themeAssets.some((a) => a.symbol === etf.symbol) &&
              !etf.error &&
              matchesStockScreen(etf.rotation?.medium, etf.rotation?.short, screen.id, asOf),
          ),
        }));
        const eligible = groups.flatMap((g) => g.etfs);
        const issues: StockRotationScan["issues"] = [];
        for (const etf of dashboard.themes)
          if (
            etf.error ||
            !validStockRotation(etf.rotation?.medium, asOf) ||
            !validStockRotation(etf.rotation?.short, asOf)
          )
            issues.push({
              symbol: etf.symbol,
              reason: etf.error || "ETF rotation unavailable or not aligned with SPY",
            });
        state = {
          ...state,
          progress: { phase: "Loading ETF holdings", completed: 0, total: eligible.length },
        };
        const snapshots = new Map<string, ThemeHoldings>();
        await Promise.all(
          eligible.map(async (etf) => {
            try {
              const data = await holdings(etf.symbol);
              if (data.error || data.symbol !== etf.symbol || !data.asOf || data.asOf > cutoff)
                issues.push({
                  symbol: etf.symbol,
                  reason: data.error || "Invalid holdings snapshot",
                });
              else snapshots.set(etf.symbol, { ...data, holdings: data.holdings.slice(0, 10) });
            } catch {
              issues.push({ symbol: etf.symbol, reason: "Holdings provider unavailable" });
            }
            state = {
              ...state,
              progress: { ...state.progress, completed: state.progress.completed + 1 },
            };
          }),
        );
        const unique = new Map<string, ThemeHolding>();
        for (const data of snapshots.values())
          for (const h of data.holdings)
            if (h.quoteSymbol && /^[A-Z][A-Z0-9-]{0,14}$/.test(h.quoteSymbol))
              unique.set(h.quoteSymbol, h);
        const readings = new Map<string, StockRotationCandidate>();
        state = {
          ...state,
          progress: { phase: "Analyzing stocks vs SPY", completed: 0, total: unique.size },
        };
        // Four workers also bound injectable providers; shared holdings service deduplicates quotes.
        const entries = [...unique.entries()];
        let next = 0;
        await Promise.all(
          Array.from({ length: 4 }, async () => {
            while (next < entries.length) {
              const [symbol, holding] = entries[next++];
              let reading: ThemeReading;
              try {
                reading = await quote(holding);
              } catch {
                reading = emptyTheme({ symbol, name: holding.name, kind: "stock" });
              }
              const prices =
                !reading.error && reading.symbol === symbol ? reading.history || [] : [];
              const medium = computeRotation(prices, benchmark, rotationPresets.medium, cutoff);
              const short = computeRotation(prices, benchmark, rotationPresets.short, cutoff);
              if (validStockRotation(medium, asOf) && validStockRotation(short, asOf))
                readings.set(symbol, { symbol, name: holding.name, medium, short, sources: [] });
              else
                issues.push({
                  symbol,
                  reason:
                    reading.error ||
                    medium.reason ||
                    short.reason ||
                    "Stock history unavailable or mismatched",
                });
              state = {
                ...state,
                progress: { ...state.progress, completed: state.progress.completed + 1 },
              };
            }
          }),
        );
        const screens = groups.map((g) => {
          const members = new Map<string, StockSource[]>();
          let unsupported = 0;
          for (const etf of g.etfs) {
            const data = snapshots.get(etf.symbol);
            if (!data?.asOf) continue;
            for (const h of data.holdings) {
              if (!h.quoteSymbol || !unique.has(h.quoteSymbol)) {
                unsupported++;
                continue;
              }
              const sources = members.get(h.quoteSymbol) || [];
              sources.push({
                symbol: etf.symbol,
                name: etf.name,
                weight: h.weight,
                asOf: data.asOf,
                sourceUrl: data.sourceUrl,
              });
              members.set(h.quoteSymbol, sources);
            }
          }
          const candidates = [...members.entries()].flatMap(([symbol, sources]) => {
            const r = readings.get(symbol);
            return r ? [{ ...r, sources }] : [];
          });
          const ranked = rankStockCandidates(candidates, g.id, asOf);
          return {
            id: g.id,
            etfs: g.etfs.map((e) => e.symbol),
            holdingsAvailable: g.etfs.filter((e) => snapshots.has(e.symbol)).length,
            candidates: members.size,
            unavailable: members.size - candidates.length,
            unsupported,
            differentStage: candidates.length - ranked.qualifying,
            ...ranked,
          };
        });
        state = {
          loading: false,
          error: "",
          progress: { ...state.progress, phase: "Complete" },
          result: {
            fetchedAt: new Date(clock()).toISOString(),
            dashboardFetchedAt: dashboard.fetchedAt,
            cutoff,
            asOf,
            screens,
            issues: issues.sort((a, b) => a.symbol.localeCompare(b.symbol)),
          },
        };
        expires = clock() + (issues.length ? 60_000 : 300_000);
      } catch (error) {
        state = {
          ...state,
          loading: false,
          error: error instanceof Error ? error.message : "Stock scan failed",
        };
        expires = clock() + 60_000;
      }
    })();
    try {
      await pending;
    } finally {
      pending = null;
    }
  }
  return {
    scan,
    status() {
      if (!pending && clock() >= expires) void scan();
      return state;
    },
  };
}
export const stockRotationService = createStockRotationService();
