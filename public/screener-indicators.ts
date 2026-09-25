import type { DailyBar } from "./screener-types";

const finite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

export function validDailyBars(bars: DailyBar[]) {
  return bars.filter(
    (bar) =>
      finite(bar.open) &&
      finite(bar.high) &&
      finite(bar.low) &&
      finite(bar.close) &&
      bar.high >= bar.low &&
      bar.close >= bar.low &&
      bar.close <= bar.high,
  );
}

export function movingAverage(values: number[], period: number, type: "EMA" | "SMA") {
  if (values.length < period || period < 1) return null;
  if (type === "SMA") return values.slice(-period).reduce((sum, value) => sum + value, 0) / period;
  let average = values.slice(0, period).reduce((sum, value) => sum + value, 0) / period;
  const multiplier = 2 / (period + 1);
  for (let index = period; index < values.length; index += 1)
    average = (values[index] - average) * multiplier + average;
  return average;
}

export function movingAverageSeries(values: number[], period: number, type: "EMA" | "SMA") {
  return values.map((_, index) => movingAverage(values.slice(0, index + 1), period, type));
}

export function averageTrueRange(bars: DailyBar[], period = 14) {
  if (bars.length < period + 1) return null;
  const ranges = bars.slice(1).map((bar, index) => {
    const previousClose = bars[index].close;
    return Math.max(
      bar.high - bar.low,
      Math.abs(bar.high - previousClose),
      Math.abs(bar.low - previousClose),
    );
  });
  if (ranges.length < period) return null;
  return ranges.slice(-period).reduce((sum, value) => sum + value, 0) / period;
}
