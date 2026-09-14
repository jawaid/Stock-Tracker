import type { ThemeReading } from "./sector-theme-model";

export type ThemeHolding = {
  symbol: string;
  name: string;
  weight: number;
  // Only identified US listings are quoted. Never substitute an ADR or guess an exchange.
  quoteSymbol: string | null;
};
export type ThemeHoldings = {
  symbol: string;
  holdings: ThemeHolding[];
  asOf: string | null;
  fetchedAt: string;
  sourceUrl: string;
  error: string;
};
export type ThemeHoldingDetail = ThemeHoldings & {
  quotes: Record<string, ThemeReading>;
  quotesFetchedAt: string;
};

export function holdingSnapshotNote(asOf: string | null, now = Date.now()) {
  if (!asOf) return "Holdings date unavailable";
  const age = Math.floor((now - Date.parse(`${asOf}T00:00:00Z`)) / 86400000);
  return `Holdings as of ${asOf}${age > 7 ? " · Older snapshot; composition and weights may have changed" : ""}`;
}
