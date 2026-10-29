import type { TechnicalBar } from "./minervini";
/** Synthetic only; shared deterministic route/browser fixture. */
export function vcpFixture(): TechnicalBar[] {
  const prices = Array.from({ length: 300 }, (_, i) => 30 + (i * 60) / 299);
  prices.push(100);
  for (const [end, count] of [
    [80, 10],
    [94, 4],
    [86, 2],
    [96, 2],
    // Establish the low before readiness; later bars must not breach the retained stop.
    [90, 1],
    [91.5, 3],
    // Keep the final low unconfirmed so this fixture exercises confirmed-high entries.
    [92, 3],
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
    volume: i >= 318 ? 100 : 1000,
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

/** A 6% contraction followed by an unconfirmed 1.52% tight pause. */
export function tightPauseFixture(): TechnicalBar[] {
  const base = vcpFixture().slice(0, 301);
  return appendBars(
    base,
    [99, 98, 97, 96, 95, 94, 98, 94, 94.5, 95, 96, 97, 98.5, 98, 97, 97.5, 98, 98],
    100,
  );
}
