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
