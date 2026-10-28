/** Yahoo metadata-based completion policy; elapsed time alone is insufficient. */
export const YAHOO_FINALITY_DELAY_MINUTES = 30;
const nyDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
function timestamp(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  const milliseconds = value * 1000;
  return Number.isFinite(new Date(milliseconds).getTime()) ? milliseconds : null;
}
export function yahooChartSession(
  metadata: unknown,
  latestBarTimestamp: unknown,
  now = new Date(),
  delayMinutes = YAHOO_FINALITY_DELAY_MINUTES,
): { date: string | null; regularEnd: string | null; final: boolean } {
  const unavailable = { date: null, regularEnd: null, final: false };
  if (!metadata || typeof metadata !== "object") return unavailable;
  const meta = metadata as {
    currentTradingPeriod?: { regular?: { start?: unknown; end?: unknown } };
    regularMarketTime?: unknown;
  };
  const start = timestamp(meta.currentTradingPeriod?.regular?.start);
  const end = timestamp(meta.currentTradingPeriod?.regular?.end);
  const trade = timestamp(meta.regularMarketTime);
  const latest = timestamp(latestBarTimestamp);
  if (start === null || end === null || start >= end) return unavailable;
  const date = nyDate.format(new Date(start));
  if (nyDate.format(new Date(end)) !== date) return unavailable;
  return {
    date,
    regularEnd: new Date(end).toISOString(),
    final:
      latest !== null &&
      trade !== null &&
      nyDate.format(new Date(latest)) === date &&
      trade >= end &&
      trade <= now.getTime() &&
      Number.isFinite(delayMinutes) &&
      delayMinutes >= 0 &&
      now.getTime() >= end + delayMinutes * 60_000,
  };
}
