import { type RotationSettings, rotationSettingsKey } from "../public/rotation-settings";
import { computeRotation, rotationPresets } from "../public/sector-rotation";
import { emptyTheme, type ThemeReading, themeAssets } from "../public/sector-theme-model";
import {
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
  snapshot: (
    settings?: RotationSettings,
  ) => ReturnType<typeof fetchThemeDashboard.rotationSnapshot> = (settings = rotationPresets) =>
    fetchThemeDashboard.rotationSnapshot(settings),
  holdings = themeHoldingsService.holdings,
  quote = themeHoldingsService.quote,
  clock = () => Date.now(),
  settings: RotationSettings = rotationPresets,
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
        const { dashboard, benchmark, cutoff } = await snapshot(settings);
        const reference = computeRotation(benchmark, benchmark, settings.medium, cutoff);
        if (!validStockRotation(reference, reference.asOf))
          throw new Error(
            "SPY rotation history unavailable or stale. Retry after refreshing market data.",
          );
        const asOf = reference.asOf;
        // ETF stages describe context, not eligibility: classify every stock independently.
        const eligible = themeAssets;
        const groups = stockScreens.map((screen) => ({ ...screen, etfs: eligible }));
        const issues: StockRotationScan["issues"] = [];
        const etfReadings: StockRotationCandidate[] = [];
        const tracked = new Set(eligible.map((e) => e.symbol));
        for (const asset of eligible) {
          const etf = dashboard.themes.find((e) => e.symbol === asset.symbol);
          const medium = etf?.rotation?.medium;
          const short = etf?.rotation?.short;
          if (
            !etf?.error &&
            medium?.horizon === "medium" &&
            short?.horizon === "short" &&
            validStockRotation(medium, asOf) &&
            validStockRotation(short, asOf)
          ) {
            etfReadings.push({
              symbol: asset.symbol,
              name: asset.name,
              instrumentType: "etf",
              medium,
              short,
              sources: [],
            });
          } else
            issues.push({
              symbol: asset.symbol,
              reason: etf?.error || "ETF rotation unavailable or not aligned with SPY",
            });
        }
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
            if (
              h.quoteSymbol &&
              !tracked.has(h.quoteSymbol) &&
              /^[A-Z][A-Z0-9-]{0,14}$/.test(h.quoteSymbol)
            )
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
              const medium = computeRotation(prices, benchmark, settings.medium, cutoff);
              const short = computeRotation(prices, benchmark, settings.short, cutoff);
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
              if (h.quoteSymbol && tracked.has(h.quoteSymbol)) continue;
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
          const ranked = rankStockCandidates([...candidates, ...etfReadings], g.id, asOf);
          return {
            id: g.id,
            etfs: g.etfs.map((e) => e.symbol),
            holdingsAvailable: g.etfs.filter((e) => snapshots.has(e.symbol)).length,
            candidates: members.size + eligible.length,
            unavailable: members.size - candidates.length + eligible.length - etfReadings.length,
            unsupported,
            differentStage: candidates.length + etfReadings.length - ranked.qualifying,
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
const stockRotationServices = new Map<string, ReturnType<typeof createStockRotationService>>();
export function stockRotationServiceFor(settings: RotationSettings = rotationPresets) {
  const key = rotationSettingsKey(settings);
  let service = stockRotationServices.get(key);
  if (!service) {
    service = createStockRotationService(undefined, undefined, undefined, undefined, settings);
    stockRotationServices.set(key, service);
  }
  return service;
}
export const stockRotationService = stockRotationServiceFor();
