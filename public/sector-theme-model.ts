import type { RotationHorizon, RotationPrice, RotationResult } from "./sector-rotation";
export const themePeriods = ["1D", "1W", "1M", "3M", "6M", "1Y"] as const;
export type ThemePeriod = (typeof themePeriods)[number];
export type ThemeAsset = { symbol: string; name: string; kind: "etf" | "crypto" | "vix" | "stock" };
export const themeAssets: ThemeAsset[] = [
  ["AIS", "AI Infrastructure"],
  ["SMH", "Semiconductors"],
  ["AIQ", "AI & Big Data"],
  ["XRT", "Retail"],
  ["XLK", "Technology"],
  ["XLI", "Industrials"],
  ["XLC", "Communication Services"],
  ["XLY", "Consumer Discretionary"],
  ["XLF", "Financials"],
  ["XAR", "Aerospace & Defense"],
  ["XLP", "Consumer Staples"],
  ["IGV", "Software"],
  ["XLE", "Energy"],
  ["CIBR", "Cybersecurity"],
  ["IYT", "Transports"],
  ["XOP", "Oil & Gas"],
  ["SHLD", "Defense Tech"],
  ["XLV", "Healthcare"],
  ["XLU", "Utilities"],
  ["XBI", "Biotechnology"],
].map(([symbol, name]) => ({ symbol, name, kind: "etf" }));
export const contextAssets: ThemeAsset[] = [
  { symbol: "SPY", name: "SPY", kind: "etf" },
  { symbol: "QQQ", name: "QQQ", kind: "etf" },
  { symbol: "SMH", name: "SMH", kind: "etf" },
  { symbol: "IWM", name: "IWM", kind: "etf" },
  { symbol: "BTC-USD", name: "BTC", kind: "crypto" },
  { symbol: "^VIX", name: "VIX", kind: "vix" },
];
export type ThemeReading = ThemeAsset & {
  history?: RotationPrice[];
  rotation?: Record<RotationHorizon, RotationResult>;
  price: number | null;
  volume: number | null;
  atrPercent: number | null;
  returns: Record<ThemePeriod, number | null>;
  references: Partial<Record<ThemePeriod, { date: string; price: number }>>;
  range52: { low: number; high: number; position: number } | null;
  asOf: string | null;
  updatedAt: string | null;
  error: string;
};
export type ThemeDashboard = {
  themes: ThemeReading[];
  context: ThemeReading[];
  session: string | null;
  fetchedAt: string;
  source: string;
};
export function emptyTheme(asset: ThemeAsset, error = "Data unavailable"): ThemeReading {
  return {
    ...asset,
    price: null,
    volume: null,
    atrPercent: null,
    returns: { "1D": null, "1W": null, "1M": null, "3M": null, "6M": null, "1Y": null },
    references: {},
    range52: null,
    asOf: null,
    updatedAt: null,
    error,
  };
}
export function rankedThemes(rows: ThemeReading[], period: ThemePeriod, session: string | null) {
  return rows
    .map((row) => ({
      ...row,
      value: !row.error && session && row.asOf === session ? row.returns[period] : null,
    }))
    .sort((a, b) =>
      a.value === null
        ? b.value === null
          ? a.name.localeCompare(b.name)
          : 1
        : b.value === null
          ? -1
          : b.value - a.value || a.name.localeCompare(b.name),
    );
}
