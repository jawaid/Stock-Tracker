import { expect, test } from "bun:test";
import {
  type LaunchPadRow,
  launchPadBarsFromAnalysis,
  launchPadCsv,
  visibleLaunchPadRows,
} from "./launch-pad-results";
import { movingAverage, movingAverageSeries } from "./screener-indicators";
import { screenerPanelRegistry, screenerRegistry } from "./screener-registry";
import type { DailyBar } from "./screener-types";
import { alexRulesScreen } from "./screens/alex-rules";
import {
  launchPadDefaults,
  launchPadScreen,
  normalizeLaunchPadParameters,
} from "./screens/launch-pad";

function bars(closes: number[]): DailyBar[] {
  const date = new Date("2025-01-01T00:00:00Z");
  return closes.map((close) => {
    do {
      date.setUTCDate(date.getUTCDate() + 1);
    } while ([0, 6].includes(date.getUTCDay()));
    return {
      time: date.toISOString().slice(0, 10),
      open: close,
      high: close + 0.4,
      low: close - 0.4,
      close,
    };
  });
}
const rising = () => Array.from({ length: 120 }, (_, index) => 100 + index * 0.04);
const evaluate = (closes: number[], parameters = launchPadDefaults) =>
  launchPadScreen.evaluate(bars(closes), parameters)[0];
function phases(a: number, b: number, c: number) {
  let value = 100;
  const closes = Array.from({ length: 120 }, (_, i) => {
    value += i < 65 ? a : i < 100 ? b : c;
    return value;
  });
  closes[119] += 1;
  return closes;
}

test("SMA and SMA-seeded EMA match hand-calculated nonlinear series", () => {
  const values = [2, 4, 6, 10, 8, 12];
  expect(movingAverageSeries(values, 3, "EMA")).toEqual([null, null, 4, 7, 7.5, 9.75]);
  expect(movingAverage(values, 3, "SMA")).toBe(10);
  expect(movingAverage(values.slice(0, 4), 3, "SMA")).toBeCloseTo(20 / 3, 12);
  expect(movingAverage(values.slice(0, 2), 3, "EMA")).toBeNull();
});

test("Launch Pad passes all four rules and matches independently derived linear averages", () => {
  // For a line advancing .04 per bar, the mean lags by (period - 1)/2 bars.
  const result = evaluate(rising());
  expect(result.passed).toBe(true);
  expect(result.failedRules).toEqual([]);
  expect(result.metrics?.sma21).toBeCloseTo(104.76 - 10 * 0.04, 10);
  expect(result.metrics?.sma50).toBeCloseTo(104.76 - 24.5 * 0.04, 10);
  expect(result.metrics?.ema65).toBeCloseTo(104.76 - 32 * 0.04, 10);
  expect(result.metrics?.maxDistancePercent).toBeCloseTo((1.28 / 103.48) * 100, 10);
  expect(result.metrics?.rangeHigh).toBeCloseTo(105.16, 10);
  expect(result.metrics?.rangeLow).toBeCloseTo(104, 10);
  expect(result.metrics?.rangeWidthPercent).toBeCloseTo((1.16 / 104) * 100, 10);
});

test("each single-rule failure is a near miss with the correct failed rule", () => {
  const far = rising();
  far[119] = 112;
  const below = rising();
  below[119] = 104.2;
  const cases = [
    ["Proximity", far],
    ["Alignment", phases(-0.15, -0.05, 0.1)],
    ["Rising", phases(-0.05, 0.1, -0.05)],
    ["Above support", below],
  ] as const;
  for (const [rule, closes] of cases) {
    const evaluation = evaluate(closes);
    expect(evaluation.passed).toBe(false);
    expect(evaluation.failedRules).toHaveLength(1);
    expect(evaluation.failedRules[0].startsWith(`${rule}:`)).toBe(true);
    const rows = [{ ticker: rule, evaluation }];
    expect(visibleLaunchPadRows(rows, false)).toHaveLength(0);
    expect(visibleLaunchPadRows(rows, true)).toHaveLength(1);
  }
});

test("support toggle changes only that rule; proximity uses absolute distance and inclusive limit", () => {
  const closes = rising();
  closes[119] = 104.2;
  expect(evaluate(closes, { ...launchPadDefaults, requireAboveSma21: false }).passed).toBe(true);
  const distance = evaluate(rising()).metrics?.maxDistancePercent as number;
  expect(evaluate(rising(), { ...launchPadDefaults, maxDistancePercent: distance }).passed).toBe(
    true,
  );
  expect(
    evaluate(rising(), { ...launchPadDefaults, maxDistancePercent: distance - 1e-8 }).failedRules,
  ).toHaveLength(1);
  const flat = evaluate(Array(120).fill(100));
  expect(flat.failedRules.map((rule) => rule.split(":")[0])).toEqual(["Alignment", "Rising"]);
  expect(visibleLaunchPadRows([{ ticker: "FLAT", evaluation: flat }], true)).toHaveLength(0);
});

test("warmup needs EMA65 plus rising lag and the full configured range", () => {
  for (const length of [0, 64, 65, 69]) {
    const result = evaluate(rising().slice(0, length));
    expect(result.insufficientData).toContain("Need 70");
    expect(result.metrics).toBeNull();
    expect(visibleLaunchPadRows([{ ticker: "SHORT", evaluation: result }], true)).toHaveLength(0);
  }
  expect(evaluate(rising().slice(0, 70)).passed).toBe(true);
  expect(evaluate(rising().slice(0, 66), { ...launchPadDefaults, risingLookback: 1 }).passed).toBe(
    true,
  );
  expect(
    evaluate(rising(), { ...launchPadDefaults, rangeLookback: 121 }).insufficientData,
  ).toContain("Need 121");
});

test("range includes current high/low, excludes older outliers, and uses configured lookback", () => {
  const data = bars(rising());
  data[109].high = 300;
  data[109].low = 1;
  const ten = launchPadScreen.evaluate(data, launchPadDefaults)[0];
  expect(ten.metrics?.rangeHigh).toBeCloseTo(105.16, 10);
  expect(ten.metrics?.rangeLow).toBeCloseTo(104, 10);
  const eleven = launchPadScreen.evaluate(data, { ...launchPadDefaults, rangeLookback: 11 })[0];
  expect(eleven.metrics?.rangeHigh).toBe(300);
  expect(eleven.metrics?.rangeLow).toBe(1);
  expect(eleven.passed).toBe(ten.passed); // Range width ranks; it does not add a fifth rule.
});

test("invalid, duplicate, and reordered bars cannot become false matches; inputs remain unchanged", () => {
  const original = bars(rising());
  for (const patch of [
    { close: NaN },
    { close: Infinity },
    { low: 0 },
    { high: 1 },
    { time: "2025-02-30" },
    { time: undefined },
  ]) {
    const data = structuredClone(original);
    Object.assign(data[119], patch);
    expect(launchPadScreen.evaluate(data, launchPadDefaults)[0].metrics).toBeNull();
  }
  const duplicate = structuredClone(original);
  duplicate[119].time = duplicate[118].time;
  expect(launchPadScreen.evaluate(duplicate, launchPadDefaults)[0].metrics).toBeNull();
  expect(
    launchPadScreen.evaluate([...original].reverse(), launchPadDefaults)[0].metrics,
  ).toBeNull();
  const before = JSON.stringify(original);
  launchPadScreen.evaluate(original, launchPadDefaults);
  expect(JSON.stringify(original)).toBe(before);
});

test("Launch Pad settings reject malformed values without changing defaults or Alex settings", () => {
  const originalAlex = structuredClone(alexRulesScreen.defaults);
  for (const value of [
    null,
    [],
    "bad",
    { risingLookback: 0, rangeLookback: 1.5, maxDistancePercent: NaN, requireAboveSma21: "false" },
  ])
    expect(normalizeLaunchPadParameters(value)).toEqual(launchPadDefaults);
  expect(
    normalizeLaunchPadParameters({
      ...launchPadDefaults,
      maxDistancePercent: 2.5,
      requireAboveSma21: false,
      rangeLookback: 15,
      risingLookback: 10,
    }),
  ).toEqual({
    maxDistancePercent: 2.5,
    requireAboveSma21: false,
    rangeLookback: 15,
    risingLookback: 10,
  });
  expect(screenerRegistry).toEqual([alexRulesScreen]);
  expect(screenerPanelRegistry.map(({ screen }) => screen.id)).toEqual([
    "alex-rules",
    "launch-pad",
  ]);
  expect(alexRulesScreen.defaults).toEqual(originalAlex);
});

test("result ordering and CSV preserve numeric metrics, date, near-miss reasons, and trigger direction", () => {
  const pass = evaluate(rising());
  if (!pass.metrics) throw new Error("Expected valid fixture metrics");
  const wide = { ...pass, metrics: { ...pass.metrics, rangeWidthPercent: 10 } };
  const rows: LaunchPadRow[] = [
    { ticker: "WIDE", evaluation: wide },
    { ticker: "TIGHT", evaluation: pass },
  ];
  expect(visibleLaunchPadRows(rows, false).map(({ ticker }) => ticker)).toEqual(["TIGHT", "WIDE"]);
  expect(
    visibleLaunchPadRows(rows, false, "rangeWidthPercent", "desc").map(({ ticker }) => ticker),
  ).toEqual(["WIDE", "TIGHT"]);
  expect(visibleLaunchPadRows(rows, false, "ticker").map(({ ticker }) => ticker)).toEqual([
    "TIGHT",
    "WIDE",
  ]);
  const csv = launchPadCsv(visibleLaunchPadRows(rows, false));
  expect(csv.split("\n")).toHaveLength(3);
  expect(csv).toContain('"SMA21","SMA50","EMA65"');
  expect(csv).toContain(`"Above ${pass.metrics.rangeHigh}"`);
  expect(csv).toContain(`"Below ${pass.metrics.rangeLow}"`);
  expect(csv).toContain(pass.metrics.date);
  expect(launchPadCsv([{ ticker: '=HYPERLINK("x")', evaluation: pass }])).toContain("'=HYPERLINK");
});

test("provider parsing excludes current/future NY sessions and rejects wrong-symbol data", () => {
  const data = bars(rising());
  data[data.length - 1].time = "2026-09-25";
  const payload = {
    security: { symbol: "TEST" },
    chart: { candles: [...data, { ...data[119], time: "2026-09-26" }] },
  };
  const parsed = launchPadBarsFromAnalysis(payload, "TEST", new Date("2026-09-26T00:30:00Z")); // Still Sep 25 in NY.
  expect(parsed).toHaveLength(119);
  expect(launchPadBarsFromAnalysis(payload, "TEST", new Date("2026-09-26T12:00:00Z"))).toHaveLength(
    120,
  );
  expect(() => launchPadBarsFromAnalysis(payload, "OTHER", new Date())).toThrow("does not match");
  expect(() => launchPadBarsFromAnalysis({}, "TEST", new Date())).toThrow();
  const broken = { ...payload, chart: { candles: [...data, null] } };
  expect(
    launchPadScreen.evaluate(
      launchPadBarsFromAnalysis(broken, "TEST", new Date("2026-09-26T12:00:00Z")),
      launchPadDefaults,
    )[0].metrics,
  ).toBeNull();
  for (const time of ["invalid-date", "2026-02-30", "9999-99-99"]) {
    const malformed = { ...payload, chart: { candles: [...data, { ...data[119], time }] } };
    expect(
      launchPadScreen.evaluate(
        launchPadBarsFromAnalysis(malformed, "TEST", new Date("2026-09-26T12:00:00Z")),
        launchPadDefaults,
      )[0].metrics,
    ).toBeNull();
  }
});
