import type { DailyBar } from "./screener-types";

/** Wilder sums seeded from the first period transitions; ADX seeds from period DX values. */
export function directionalMovement(bars: DailyBar[], period = 14) {
  if (!Number.isInteger(period) || period < 1 || bars.length < period * 2) return null;
  let tr = 0;
  let plus = 0;
  let minus = 0;
  let diPlus = 0;
  let diMinus = 0;
  let adx = 0;
  let count = 0;
  for (let i = 1; i < bars.length; i++) {
    const bar = bars[i];
    const previous = bars[i - 1];
    const up = bar.high - previous.high;
    const down = previous.low - bar.low;
    const range = Math.max(
      bar.high - bar.low,
      Math.abs(bar.high - previous.close),
      Math.abs(bar.low - previous.close),
    );
    const positive = up > down && up > 0 ? up : 0;
    const negative = down > up && down > 0 ? down : 0;
    tr = i <= period ? tr + range : tr - tr / period + range;
    plus = i <= period ? plus + positive : plus - plus / period + positive;
    minus = i <= period ? minus + negative : minus - minus / period + negative;
    if (i < period) continue;
    diPlus = tr === 0 ? 0 : (100 * plus) / tr;
    diMinus = tr === 0 ? 0 : (100 * minus) / tr;
    const dx = diPlus + diMinus === 0 ? 0 : (100 * Math.abs(diPlus - diMinus)) / (diPlus + diMinus);
    count++;
    adx = count <= period ? adx + dx / period : adx + (dx - adx) / period;
  }
  return { diPlus, diMinus, adx };
}
