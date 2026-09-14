import { expect, test } from "bun:test";
import {
  contextAssets,
  emptyTheme,
  rankedThemes,
  type ThemeAsset,
  themeAssets,
} from "../public/sector-theme-model";
import { createThemeLoader, normalizeTheme } from "./sector-themes";

const asset: ThemeAsset = { symbol: "TEST", name: "Test", kind: "etf" };
const now = Date.parse("2026-09-11T20:00:00Z");
function fixture(length = 400) {
  const end = now / 1000 - 4 * 3600;
  return {
    chart: {
      result: [
        {
          meta: { regularMarketTime: now / 1000 },
          timestamp: Array.from({ length }, (_, i) => end - (length - 1 - i) * 86400),
          indicators: {
            quote: [
              {
                close: Array.from({ length }, (_, i) => 100 + i),
                high: Array.from({ length }, (_, i) => 102 + i),
                low: Array.from({ length }, (_, i) => 98 + i),
              },
            ],
          },
        },
      ],
    },
  };
}
test("daily observations drive independent ETF and crypto horizons and range position", () => {
  const row = normalizeTheme(asset, fixture(), now);
  expect(row.returns["1D"]).toBeCloseTo((499 / 498) * 100 - 100);
  expect(row.returns["1W"]).toBeCloseTo((499 / 494) * 100 - 100);
  expect(row.returns["1Y"]).toBeCloseTo((499 / 247) * 100 - 100);
  expect(row.range52?.high).toBe(501);
  expect(row.range52?.low).toBe(246);
  expect(row.asOf).toBe("2026-09-11");
  const crypto = normalizeTheme({ ...asset, kind: "crypto" }, fixture(), now);
  expect(crypto.returns["1W"]).toBeCloseTo((499 / 492) * 100 - 100);
  expect(crypto.returns["1M"]).toBeCloseTo((499 / 469) * 100 - 100);
});
test("weekly and monthly returns use elapsed sessions, preserving holiday gaps and reference dates", () => {
  const dates = [];
  for (let day = Date.parse("2026-08-10T16:00:00Z"); day <= now; day += 86400000) {
    const date = new Date(day);
    if (![0, 6].includes(date.getUTCDay()) && date.toISOString().slice(0, 10) !== "2026-09-07")
      dates.push(day / 1000);
  }
  const data = fixture(dates.length);
  const result = data.chart.result[0];
  result.timestamp = dates;
  const closes = result.indicators.quote[0].close;
  const prices: Record<string, number> = {
    "2026-08-12": 178.58,
    "2026-08-13": 179.17,
    "2026-09-03": 192.33,
    "2026-09-04": 190.71,
    "2026-09-10": 195.52,
    "2026-09-11": 195.72,
  };
  dates.forEach((time, i) => {
    const value = prices[new Date(time * 1000).toISOString().slice(0, 10)];
    if (value !== undefined) closes[i] = value;
  });
  const row = normalizeTheme(asset, data, now);
  expect(row.references["1D"]).toEqual({ date: "2026-09-10", price: 195.52 });
  expect(row.references["1W"]).toEqual({ date: "2026-09-03", price: 192.33 });
  expect(row.references["1M"]).toEqual({ date: "2026-08-12", price: 178.58 });
  expect(row.returns["1D"]).toBeCloseTo((195.72 / 195.52 - 1) * 100, 8);
  expect(row.returns["1W"]).toBeCloseTo(1.762594, 5);
  expect(row.returns["1M"]).toBeCloseTo(9.597939, 5);
});
test("short history, invalid endpoints and stale data remain unavailable", () => {
  const short = normalizeTheme(asset, fixture(10), now);
  expect(short.returns["1M"]).toBeNull();
  expect(short.range52).toBeNull();
  const data = fixture();
  data.chart.result[0].indicators.quote[0].close[399] = NaN;
  expect(normalizeTheme(asset, data, now).price).toBeNull();
  const gap = fixture();
  gap.chart.result[0].indicators.quote[0].close[394] = NaN;
  expect(normalizeTheme(asset, gap, now).returns["1W"]).toBeNull();
  expect(normalizeTheme(asset, fixture(), now + 10 * 86400000).error).toBe("Stale daily data");
  expect(
    normalizeTheme(asset, { chart: { error: { description: "failure" } } }, now).price,
  ).toBeNull();
});
test("rankings sort by selected period with stable ties and exclude mismatched sessions", () => {
  const a = { ...normalizeTheme(asset, fixture(), now), symbol: "A", name: "Alpha" };
  const b = { ...a, symbol: "B", name: "Beta", returns: { ...a.returns, "1D": -2, "1W": 20 } };
  const c = { ...a, symbol: "C", name: "Older", asOf: "2026-09-10" };
  expect(rankedThemes([b, c, a], "1D", a.asOf).map((r) => r.symbol)).toEqual(["A", "B", "C"]);
  expect(rankedThemes([a, b], "1W", a.asOf)[0].symbol).toBe("B");
  expect(rankedThemes([c], "1D", a.asOf)[0].value).toBeNull();
});
test("loader limits concurrency, deduplicates simultaneous loads, caches and tolerates failure", async () => {
  let active = 0,
    max = 0,
    calls = 0;
  let clock = now;
  const loader = createThemeLoader(
    async (a) => {
      calls++;
      active++;
      max = Math.max(max, active);
      await Promise.resolve();
      active--;
      if (a.symbol === "AIS") throw new Error("offline");
      return { ...emptyTheme(a, ""), asOf: "2026-09-11" };
    },
    () => clock,
  );
  const [first, second] = await Promise.all([loader(), loader()]);
  expect(first).toBe(second);
  expect(max).toBeLessThanOrEqual(4);
  expect(calls).toBe(themeAssets.length + contextAssets.length);
  expect(first.themes.length).toBe(20);
  expect(first.themes.find((r) => r.symbol === "AIS")?.error).toBe("Data unavailable");
  await loader();
  expect(calls).toBe(26);
  clock += 61_000;
  await loader();
  expect(calls).toBe(52);
});
