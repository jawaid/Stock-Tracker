import { expect, test } from "bun:test";
import { averageTrueRange, movingAverage } from "./screener-indicators";
import { screenerRegistry } from "./screener-registry";
import { alexRulesScreen } from "./screens/alex-rules";

function bars(closes: number[]) {
  return closes.map((close, index) => ({
    time: `2026-01-${String(index + 1).padStart(2, "0")}`,
    open: close - 0.25,
    high: close + 1,
    low: close - 1,
    close,
  }));
}

test("indicators calculate EMA/SMA and 14-day ATR without invalid bars", () => {
  expect(movingAverage([1, 2, 3], 3, "SMA")).toBe(2);
  expect(movingAverage([1, 2, 3], 3, "EMA")).toBe(2);
  expect(averageTrueRange(bars(Array.from({ length: 16 }, () => 100)), 14)).toBe(2);
});

test("Alex setup one passes only inside the rising one-ATR pullback zone", () => {
  const closes = Array.from({ length: 45 }, (_, index) => 80 + index * 0.5);
  closes[44] = 98.5;
  const result = alexRulesScreen.evaluate(bars(closes), alexRulesScreen.defaults)[0];
  expect(result.metrics?.distanceAtr).toBeGreaterThanOrEqual(0);
  expect(result.metrics?.distanceAtr).toBeLessThanOrEqual(1);
  expect(result.passed).toBe(true);
});

test("Alex setup one reports the exact failed extension rule", () => {
  const closes = Array.from({ length: 45 }, (_, index) => 80 + index * 0.5);
  closes[44] = 120;
  const result = alexRulesScreen.evaluate(bars(closes), alexRulesScreen.defaults)[0];
  expect(result.passed).toBe(false);
  expect(result.failedRules.join(" ")).toContain("ATR above");
});

test("Alex setup two requires a reclaim after prior structural weakness", () => {
  const closes = [
    ...Array.from({ length: 40 }, (_, index) => 120 - index * 0.6),
    98,
    99,
    100,
    101,
    102,
    103,
  ];
  const result = alexRulesScreen.evaluate(bars(closes), alexRulesScreen.defaults)[1];
  expect(result.passed).toBe(true);
  expect(result.metrics?.distanceAtr).toBeLessThanOrEqual(1);
});

test("high-low structure band changes the setup's structure reference", () => {
  const closes = Array.from({ length: 45 }, (_, index) => 80 + index * 0.5);
  closes[44] = 98.5;
  const line = alexRulesScreen.evaluate(bars(closes), alexRulesScreen.defaults)[0].metrics
    ?.average21;
  const band = alexRulesScreen.evaluate(bars(closes), {
    ...alexRulesScreen.defaults,
    structureBand: true,
  })[0].metrics?.average21;
  expect(band).toBeGreaterThan(line || 0);
});

test("registry keeps screen modules independent from UI", () => {
  expect(screenerRegistry.map((screen) => screen.id)).toEqual(["alex-rules"]);
  expect(typeof screenerRegistry[0].evaluate).toBe("function");
});

test("Alex stop uses full-precision 21 EMA of lows for both setups regardless of MA settings", () => {
  const lows = [...Array(21).fill(100), 111, 90, 100, 100, 100];
  const history = lows.map((low, i) => ({
    time: String(i),
    open: 120,
    high: 121,
    low,
    close: 120,
  }));
  // Seed = 100; next = 101; next = 100; remaining lows leave EMA at 100.
  for (const averageType of ["EMA", "SMA"]) {
    for (const structureBand of [false, true]) {
      const results = alexRulesScreen.evaluate(history, {
        ...alexRulesScreen.defaults,
        averageType,
        structureBand,
      });
      for (const result of results) expect(result.metrics?.stopLoss).toBeCloseTo(100, 12);
    }
  }
  const next = [...history, { time: "26", open: 120, high: 121, low: 101, close: 120 }];
  const results = alexRulesScreen.evaluate(next, alexRulesScreen.defaults);
  for (const result of results) {
    expect(result.metrics?.stopLoss).toBeCloseTo(100 + 1 / 11, 12);
    expect(result.metrics?.date).toBe("26");
  }
  expect(
    alexRulesScreen.evaluate(history.slice(0, 20), alexRulesScreen.defaults)[0].metrics,
  ).toBeNull();
});

test("Alex risk is close minus stop and percent uses close for both setups", () => {
  for (const close of [105, 100, 95]) {
    const history = Array.from({ length: 30 }, (_, i) => ({
      time: String(i),
      open: 110,
      high: 120,
      low: i === 29 ? Math.min(100, close) : 100,
      close: i === 29 ? close : 110,
    }));
    const expectedStop = close < 100 ? 100 + (close - 100) / 11 : 100;
    for (const result of alexRulesScreen.evaluate(history, alexRulesScreen.defaults)) {
      expect(result.metrics?.riskR).toBeCloseTo(close - expectedStop, 12);
      expect(result.metrics?.riskPercent).toBeCloseTo(((close - expectedStop) / close) * 100, 12);
    }
  }
});

test("Wilder ATR seeds then smooths all subsequent true ranges and gaps", () => {
  const history = bars(Array(15).fill(100));
  expect(averageTrueRange(history, 14)).toBe(2);
  history.push({ time: "shock", open: 100, high: 108, low: 92, close: 100 });
  expect(averageTrueRange(history, 14)).toBe(3);
  history.push({ time: "normal", open: 100, high: 101, low: 99, close: 100 });
  expect(averageTrueRange(history, 14)).toBeCloseTo(41 / 14, 12);
  expect(averageTrueRange(history.slice(0, 14), 14)).toBeNull();
  const gap = [
    ...bars(Array(15).fill(100)),
    { time: "gap", open: 110, high: 112, low: 109, close: 111 },
  ];
  expect(averageTrueRange(gap, 14)).toBeCloseTo((2 * 13 + 12) / 14, 12);
});

test("Alex uses Wilder ATR consistently for percent and selection distance", () => {
  const history = bars(Array.from({ length: 45 }, (_, i) => 80 + i * 0.5));
  history[44].close = 101.5;
  const expected = 2;
  // Initial ranges are all 2; the last previous close is 101.5 and last high is 103.
  for (const result of alexRulesScreen.evaluate(history, alexRulesScreen.defaults)) {
    if (!result.metrics) throw new Error("Expected valid metrics");
    expect(result.metrics.atr).toBeCloseTo(expected, 12);
    expect(result.metrics?.atrPercent).toBeCloseTo((expected / 101.5) * 100, 12);
    expect(result.metrics?.distanceAtr).toBeCloseTo(
      (101.5 - result.metrics.average21) / expected,
      12,
    );
  }
});
