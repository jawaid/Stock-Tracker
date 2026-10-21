import { expect, test } from "bun:test";
import { directionalMovement } from "./directional-movement";
import { r9BarsFromAnalysis, r9Csv, r9SymbolText, visibleR9Rows } from "./r9-results";
import { movingAverage } from "./screener-indicators";
import { screenerPanelRegistry } from "./screener-registry";
import {
  evaluateR9,
  type R9Bar,
  type R9Metrics,
  r9Exit,
  r9Rules,
  recentSma10Touch,
  relativeReturn,
} from "./screens/r9-swing";

function history(length = 260): R9Bar[] {
  const date = new Date("2024-01-01T00:00:00Z");
  return Array.from({ length }, (_, i) => {
    do {
      date.setUTCDate(date.getUTCDate() + 1);
    } while ([0, 6].includes(date.getUTCDay()));
    const close = 100 + i;
    return {
      time: date.toISOString().slice(0, 10),
      open: close,
      high: close + 1,
      low: close - 5,
      close,
      volume: 1000,
    };
  });
}
function metrics(): R9Metrics {
  return evaluateR9(history()).metrics as R9Metrics;
}
test("R9 rising fixture meets exactly eleven entry checks and reports all indicators", () => {
  const result = evaluateR9(history());
  expect(result.passed).toBe(true);
  expect(Object.keys(result.rules ?? {})).toHaveLength(11);
  expect(Object.values(result.rules ?? {}).every(Boolean)).toBe(true);
  expect(result.failedRules).toEqual([]);
  expect(result.metrics?.sma200).toBe(259.5);
  expect(result.metrics?.rsi14).toBe(100);
  expect(result.metrics?.rsi2).toBe(100);
  expect(result.metrics?.adx).toBeCloseTo(100, 9);
  expect(result.metrics?.ema10).toBeCloseTo(354.5, 9);
  expect(result.metrics?.macd).toBeCloseTo(7, 9);
});
for (const period of [10, 20, 50, 100, 200] as const) {
  for (const offset of [-1, 0, 1])
    test(`Close vs SMA${period}: offset ${offset}`, () => {
      const m = metrics();
      m[`sma${period}`] = m.close - offset;
      expect(r9Rules(m)[`close_above_sma${period}`]).toBe(offset > 0);
    });
}
for (const difference of [-1, 0, 1]) {
  test(`Trend, MACD, DMI, up-day strict boundaries ${difference}`, () => {
    const m = metrics();
    m.sma20 = m.sma50 + difference;
    m.macd = difference;
    m.diPlus = m.diMinus + difference;
    m.previousClose = m.close - difference;
    const rules = r9Rules(m);
    for (const key of [
      "sma20_above_sma50",
      "macd_above_zero",
      "di_plus_above_di_minus",
      "up_day",
    ] as const)
      expect(rules[key]).toBe(difference > 0);
  });
  test(`Volume includes equality: ${difference}`, () => {
    const m = metrics();
    m.volume = m.avgVolume20 + difference;
    expect(r9Rules(m).volume_at_least_avg20).toBe(difference >= 0);
  });
  test(`Exit is strict close below EMA: ${difference}`, () =>
    expect(r9Exit(100 + difference, 100)).toBe(difference < 0));
}
for (const offset of [0, 1, 2, 3, 4])
  test(`SMA10 touch ${offset} trading bars ago`, () => {
    const bars = history();
    for (const bar of bars) bar.low = bar.close - 1;
    bars[bars.length - 1 - offset].low -= 5;
    const result = evaluateR9(bars);
    expect(result.metrics?.barsSinceTouch).toBe(offset);
    expect(result.rules?.recent_sma10_touch_3bars).toBe(offset < 3);
  });
test("No touch fails; each historical low compares with its own historical SMA", () => {
  const bars = history();
  for (const bar of bars) bar.low = bar.close - 1;
  expect(evaluateR9(bars).rules?.recent_sma10_touch_3bars).toBe(false);
  expect(recentSma10Touch(bars.slice(-3), [100, 101, 400])).toBe(0);
  expect(recentSma10Touch(bars.slice(-3), [100, 101, 102])).toBe(null);
  // Yesterday low 358 is below today's SMA 359, but above yesterday's SMA 357.
  bars[bars.length - 2].low = 358;
  expect(recentSma10Touch(bars.slice(-3), [355, 357, 359])).toBe(0);
  const last = bars.slice(-3);
  last[2] = { ...last[2], low: 360 };
  expect(recentSma10Touch(last, [355, 357, 359])).toBe(null);
});
test("Low below EMA but close above it never exits", () => {
  const result = evaluateR9(history());
  expect(history()[259].low).toBeLessThan((result.metrics as R9Metrics).ema10);
  expect(result.metrics?.exitSignal).toBe(false);
});
test("Insufficient history and invalid OHLCV are unavailable, not failed matches", () => {
  expect(evaluateR9(history(199)).passed).toBe(null);
  expect(evaluateR9(history(199)).insufficientData).toContain("200");
  for (const invalid of [null, NaN, -1, Infinity]) {
    const bars = history();
    bars[200].volume = invalid as number;
    expect(evaluateR9(bars).passed).toBe(null);
  }
  const bars = history();
  bars[200].time = bars[199].time;
  expect(evaluateR9(bars).insufficientData).toContain("unordered");
});
test("Unfinished current-day and future candles are excluded even after close", () => {
  const bars = history();
  const last = bars[bars.length - 1];
  const payload = {
    security: { symbol: "TEST" },
    chart: {
      candles: [
        ...bars,
        { ...last, time: "2026-10-20", close: 9999 },
        { ...last, time: "2026-10-21" },
      ],
    },
  };
  for (const timestamp of ["2026-10-20T15:00:00Z", "2026-10-20T23:00:00Z"]) {
    const completed = r9BarsFromAnalysis(payload, "TEST", new Date(timestamp));
    expect(completed).toEqual(bars);
    expect(evaluateR9(completed)).toEqual(evaluateR9(bars));
  }
  expect(() => r9BarsFromAnalysis(payload, "OTHER", new Date())).toThrow();
});
test("Previous close is prior trading bar across weekends", () => {
  const bars = history();
  while (new Date(bars[bars.length - 1].time).getUTCDay() !== 1) bars.pop();
  expect(new Date(bars[bars.length - 2].time).getUTCDay()).toBe(5);
  expect(evaluateR9(bars).metrics?.previousClose).toBe(bars[bars.length - 2].close);
});
test("RSI14 under 58, RSI2, ADX under 24, and RS never alter entry rules", () => {
  const m = metrics();
  const expected = r9Rules(m);
  Object.assign(m, {
    rsi14: 20,
    rsi2: 1,
    rsiAbove58: false,
    adx: 5,
    adxAbove24: false,
    rs60: -99,
    rs20: -99,
    rs120: -99,
    exitSignal: true,
  });
  expect(r9Rules(m)).toEqual(expected);
});
test("Benchmark endpoints align by date; optional missing SPY preserves entry", () => {
  const bars = history();
  const spy = history().map((bar) => ({ ...bar, close: 100, open: 100, high: 101, low: 99 }));
  expect(relativeReturn(bars, spy, 60)?.relative).toBeCloseTo((359 / 299 - 1) * 100, 9);
  expect(relativeReturn(bars, spy.slice(0, -1), 60)).toBe(null);
  expect(evaluateR9(bars, spy).passed).toBe(evaluateR9(bars).passed);
  expect(evaluateR9(bars).metrics?.rs60).toBe(null);
});
test("Wilder DMI14 is numeric, mutually exclusive, and ADX is seeded correctly", () => {
  const bars = history(28);
  const dmi = directionalMovement(bars) as NonNullable<ReturnType<typeof directionalMovement>>;
  expect(dmi.diPlus).toBeCloseTo(100 / 6, 10);
  expect(dmi.diMinus).toBe(0);
  expect(dmi.adx).toBeCloseTo(100, 10);
  expect(directionalMovement(bars.slice(1))).toBe(null);
  const flat = bars.map((bar) => ({ ...bar, open: 100, close: 100, high: 100, low: 100 }));
  expect(directionalMovement(flat)).toEqual({ diPlus: 0, diMinus: 0, adx: 0 });
});
test("Wilder directional ties produce zero DM; independently calculated smoothing fixture", () => {
  const bars = [
    { high: 10, low: 8, close: 9 },
    { high: 12, low: 7, close: 10 },
    { high: 13, low: 6, close: 10 },
    { high: 12, low: 4, close: 8 },
  ].map((bar, i) => ({ ...bar, open: bar.close, time: `2026-01-0${i + 1}` }));
  // First two transitions: TR=12, +DM=2, -DM=0 (second is a tie).
  // Next: smoothed TR=14, +DM=1, -DM=2; DX=100/3; seed ADX=(100+100/3)/2.
  const result = directionalMovement(bars, 2) as NonNullable<
    ReturnType<typeof directionalMovement>
  >;
  expect(result.diPlus).toBeCloseTo(100 / 14, 10);
  expect(result.diMinus).toBeCloseTo(200 / 14, 10);
  expect(result.adx).toBeCloseTo(200 / 3, 10);
});
test("SMA/EMA/volume diagnostics use complete signal-bar-inclusive windows", () => {
  const bars = history();
  bars[bars.length - 1].volume = 2000;
  const result = evaluateR9(bars).metrics as R9Metrics;
  expect(result.avgVolume20).toBe(1050);
  expect(result.volumeRatio).toBeCloseTo(2000 / 1050, 10);
  expect(result.sma10).toBe(
    movingAverage(
      bars.map((b) => b.close),
      10,
      "SMA",
    ),
  );
  expect(evaluateR9(history(200)).metrics?.distanceHigh52).toBe(null);
});
test("Panel is independent; sorting/filtering, safe CSV, and matching-only TXT", () => {
  expect(screenerPanelRegistry.find((p) => p.screen.id === "r9-swing")?.hostId).toBe("r9Content");
  const matched = { ticker: "MATCH", evaluation: evaluateR9(history()) };
  const excluded = {
    ticker: "NO",
    evaluation: { ...matched.evaluation, passed: false, failedRules: ["MACD <= 0"] },
  };
  const missing = { ticker: "SHORT", evaluation: evaluateR9(history(20)) };
  const rows = [missing, excluded, matched];
  expect(visibleR9Rows(rows).map((r) => r.ticker)).toEqual(["MATCH", "NO", "SHORT"]);
  expect(visibleR9Rows(rows, true)).toEqual([matched]);
  expect(visibleR9Rows(rows, false, "ticker", "asc").map((r) => r.ticker)).toEqual([
    "MATCH",
    "NO",
    "SHORT",
  ]);
  expect(r9SymbolText(rows)).toBe("MATCH");
  const csv = r9Csv(rows);
  expect(csv).toContain("close_above_sma200");
  expect(csv).toContain("EMA10 Exit Signal");
  expect(csv).toContain("Unavailable");
  expect(csv).toContain("MACD <= 0");
  expect(r9Csv([{ ...matched, ticker: '=HYPERLINK("x")' }])).toContain("'=HYPERLINK");
});
