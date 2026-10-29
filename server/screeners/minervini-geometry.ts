import type { TechnicalBar } from "./minervini";

export type EntryGeometry = {
  high: number;
  highDate: string;
  low: number;
  lowDate: string;
  position: number | null;
  lookbackBars: number;
};
/** Label-only geometry, anchored to the pivot. Never reads any bar after the pivot.
 * Highest-high window excludes the pivot; subsequent-low window includes it.
 * Equal highs/lows use the latest occurrence, matching the chart's tie convention. */
export function entryGeometry(
  bars: TechnicalBar[],
  pivotIndex: number,
  pivot: number,
  lookbackBars: number,
): EntryGeometry | null {
  if (
    !Number.isInteger(lookbackBars) ||
    lookbackBars < 1 ||
    !Number.isInteger(pivotIndex) ||
    pivotIndex < 1 ||
    pivotIndex >= bars.length ||
    !Number.isFinite(pivot) ||
    pivot <= 0
  )
    return null;
  let highIndex = Math.max(0, pivotIndex - lookbackBars);
  for (let i = highIndex + 1; i < pivotIndex; i++)
    if (bars[i].high >= bars[highIndex].high) highIndex = i;
  let lowIndex = highIndex + 1;
  for (let i = lowIndex + 1; i <= pivotIndex; i++)
    if (bars[i].low <= bars[lowIndex].low) lowIndex = i;
  const high = bars[highIndex].high,
    low = bars[lowIndex].low;
  return {
    high,
    highDate: bars[highIndex].time,
    low,
    lowDate: bars[lowIndex].time,
    position: high > low ? (pivot - low) / (high - low) : null,
    lookbackBars,
  };
}
export function geometryEntryType(pivot: number, geometry: EntryGeometry | null) {
  if (!geometry) return null;
  if (pivot >= geometry.high) return "Classic pivot";
  if (geometry.position === null) return null;
  return geometry.position < 1 / 3
    ? "Low cheat"
    : geometry.position < 2 / 3
      ? "Cheat"
      : "Classic pivot";
}
