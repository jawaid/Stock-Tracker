import type { TechnicalBar } from "./minervini";
/** Synthetic only; shared deterministic route/browser fixture. */
export function vcpFixture(): TechnicalBar[] {
  const prices = Array.from({ length: 300 }, (_, i) => 30 + (i * 60) / 299);
  prices.push(100);
  for (const [end, count] of [
    [80, 10],
    [96, 10],
    [90, 4],
    [95, 3],
  ]) {
    const start = prices[prices.length - 1];
    for (let i = 1; i <= count; i++) prices.push(start + ((end - start) * i) / count);
  }
  return prices.map((price, i) => ({
    time: new Date(Date.UTC(2024, 0, i + 1)).toISOString().slice(0, 10),
    open: price,
    high: price,
    low: price,
    close: price,
    volume: i >= 320 ? 100 : 1000,
  }));
}
export function appendBars(bars: TechnicalBar[], prices: number[], volume = 1600) {
  const start = Date.parse(bars[bars.length - 1].time);
  return [
    ...bars,
    ...prices.map((price, i) => ({
      time: new Date(start + (i + 1) * 86400000).toISOString().slice(0, 10),
      open: price,
      high: price,
      low: price,
      close: price,
      volume,
    })),
  ];
}
