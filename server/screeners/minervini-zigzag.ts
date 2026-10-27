import type { TechnicalBar } from "./minervini";
export type Swing = { index: number; price: number; confirmedAt: number; kind: "high" | "low" };
/** Daily OHLC cannot establish intrabar order. A newly extended extreme cannot reverse
 * on that same bar: confirmation uses a later bar. Equal extremes move to the latest bar. */
export function percentageZigzag(bars: TechnicalBar[], threshold = 0.03): Swing[] {
  if (!bars.length || !(threshold > 0 && threshold < 1)) return [];
  const swings: Swing[] = [];
  let direction: "unknown" | "up" | "down" = "unknown";
  let high = 0;
  let low = 0;
  for (let i = 1; i < bars.length; i++) {
    const bar = bars[i];
    if (direction !== "down") {
      if (bar.high >= bars[high].high) high = i;
      if (i > high && bar.low <= bars[high].high * (1 - threshold)) {
        swings.push({ kind: "high", index: high, price: bars[high].high, confirmedAt: i });
        direction = "down";
        low = i;
        continue;
      }
    }
    if (direction !== "up") {
      if (bar.low <= bars[low].low) low = i;
      if (i > low && bar.high >= bars[low].low * (1 + threshold)) {
        swings.push({ kind: "low", index: low, price: bars[low].low, confirmedAt: i });
        direction = "up";
        high = i;
      }
    }
  }
  return swings;
}
