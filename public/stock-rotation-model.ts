import { type RotationResult, rotationQuadrant } from "./sector-rotation";

export const stockScreens = [
  {
    id: "recovering",
    name: "1 — Leader Recovering",
    medium: "Leading",
    short: "Improving",
    purpose: "Medium-term leader whose short-term relative strength is improving.",
  },
  {
    id: "confirmed",
    name: "2 — Confirmed Leader",
    medium: "Leading",
    short: "Leading",
    purpose: "Leading relative strength on both horizons.",
  },
  {
    id: "emerging",
    name: "3 — Emerging Leader",
    medium: "Improving",
    short: "Leading",
    purpose: "Medium-term relative strength improving; short term already leading.",
  },
  {
    id: "early",
    name: "4 — Early Improvement",
    medium: "Improving",
    short: "Improving",
    purpose: "Both horizons improving; earlier and less confirmed.",
  },
] as const;
export type StockScreenId = (typeof stockScreens)[number]["id"];
export type StockSource = {
  symbol: string;
  name: string;
  weight: number;
  asOf: string;
  sourceUrl: string;
};
export type StockRotationCandidate = {
  instrumentType?: "stock" | "etf";
  symbol: string;
  name: string;
  medium: RotationResult;
  short: RotationResult;
  sources: StockSource[];
};
export type StockRotationRow = StockRotationCandidate & { source: StockSource };
export type StockRotationScreen = {
  id: StockScreenId;
  etfs: string[];
  holdingsAvailable: number;
  candidates: number;
  unavailable: number;
  unsupported: number;
  differentStage: number;
  qualifying: number;
  rows: StockRotationRow[];
};
export type StockRotationScan = {
  fetchedAt: string;
  dashboardFetchedAt: string;
  asOf: string | null;
  cutoff: string;
  screens: StockRotationScreen[];
  issues: { symbol: string; reason: string }[];
};
export type StockRotationStatus = {
  loading: boolean;
  progress: { phase: string; completed: number; total: number };
  result: StockRotationScan | null;
  error: string;
};
export function validStockRotation(
  r: RotationResult | undefined,
  asOf: string | null,
): r is RotationResult & { rsRatio: number; rsMomentum: number } {
  return (
    !!r &&
    !!asOf &&
    r.asOf === asOf &&
    !r.reason &&
    r.rsRatio !== null &&
    r.rsMomentum !== null &&
    Number.isFinite(r.rsRatio) &&
    Number.isFinite(r.rsMomentum) &&
    r.quadrant === rotationQuadrant(r.rsRatio, r.rsMomentum)
  );
}
export function matchesStockScreen(
  medium: RotationResult | undefined,
  short: RotationResult | undefined,
  id: StockScreenId,
  asOf: string | null,
) {
  const screen = stockScreens.find((s) => s.id === id);
  return (
    !!screen &&
    medium?.horizon === "medium" &&
    short?.horizon === "short" &&
    validStockRotation(medium, asOf) &&
    validStockRotation(short, asOf) &&
    medium.quadrant === screen.medium &&
    short.quadrant === screen.short
  );
}
/** Ranking is deterministic, unrounded and descriptive; it is not a return forecast. */
export function rankStockCandidates(
  candidates: StockRotationCandidate[],
  id: StockScreenId,
  asOf: string | null,
) {
  const unique = new Map<string, StockRotationCandidate>();
  const conflicts = new Set<string>();
  for (const candidate of candidates) {
    if (
      !/^[A-Z][A-Z0-9-]{0,14}$/.test(candidate.symbol) ||
      !matchesStockScreen(candidate.medium, candidate.short, id, asOf)
    )
      continue;
    const existing = unique.get(candidate.symbol);
    if (existing) {
      if (
        (existing.instrumentType || "stock") !== (candidate.instrumentType || "stock") ||
        existing.medium.rsRatio !== candidate.medium.rsRatio ||
        existing.medium.rsMomentum !== candidate.medium.rsMomentum ||
        existing.short.rsRatio !== candidate.short.rsRatio ||
        existing.short.rsMomentum !== candidate.short.rsMomentum
      )
        conflicts.add(candidate.symbol);
      existing.sources.push(...candidate.sources);
    } else unique.set(candidate.symbol, { ...candidate, sources: [...candidate.sources] });
  }
  const ranked = [...unique.values()]
    .filter((candidate) => !conflicts.has(candidate.symbol))
    .flatMap((candidate) => {
      if (candidate.instrumentType === "etf") {
        return [
          {
            ...candidate,
            sources: [],
            source: {
              symbol: candidate.symbol,
              name: candidate.name,
              weight: 0,
              asOf: candidate.medium.asOf || "",
              sourceUrl: "",
            },
          },
        ];
      }
      const sources = [
        ...new Map(
          candidate.sources
            .filter((s) => s.weight > 0 && s.weight <= 100 && Number.isFinite(s.weight))
            .sort((a, b) => a.weight - b.weight || a.asOf.localeCompare(b.asOf))
            .map((s) => [s.symbol, s]),
        ).values(),
      ].sort((a, b) => b.weight - a.weight || a.symbol.localeCompare(b.symbol));
      return sources.length ? [{ ...candidate, sources, source: sources[0] }] : [];
    })
    .sort(
      (a, b) =>
        (b.medium.rsRatio as number) - (a.medium.rsRatio as number) ||
        (b.medium.rsMomentum as number) - (a.medium.rsMomentum as number) ||
        (b.short.rsMomentum as number) - (a.short.rsMomentum as number) ||
        (b.short.rsRatio as number) - (a.short.rsRatio as number) ||
        a.symbol.localeCompare(b.symbol),
    );
  const counts = new Map<string, number>();
  const rows: StockRotationRow[] = [];
  for (const row of ranked) {
    const count = counts.get(row.source.symbol) || 0;
    if (count >= 2) continue;
    rows.push(row);
    counts.set(row.source.symbol, count + 1);
    if (rows.length === 10) break;
  }
  return { qualifying: ranked.length, rows };
}
