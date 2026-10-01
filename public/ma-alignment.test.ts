import { expect, test } from "bun:test";
import {
  type MaAlignmentRow,
  maAlignmentBarsFromAnalysis,
  maAlignmentColumns,
  maAlignmentCsv,
  visibleMaAlignmentRows,
} from "./ma-alignment-results";
import { screenerPanelRegistry } from "./screener-registry";
import type { DailyBar } from "./screener-types";
import {
  maAlignmentDefaults,
  maAlignmentScreen,
  normalizeMaAlignmentParameters,
} from "./screens/ma-alignment";

function bars(closes: number[]): DailyBar[] {
  const date = new Date("2025-01-01T00:00:00Z");
  return closes.map((close) => {
    do date.setUTCDate(date.getUTCDate() + 1);
    while ([0, 6].includes(date.getUTCDay()));
    return {
      time: date.toISOString().slice(0, 10),
      open: close,
      high: close + 0.4,
      low: close - 0.4,
      close,
    };
  });
}

const line = (step = 0.04) => Array.from({ length: 120 }, (_, index) => 100 + index * step);
const evaluate = (closes: number[], parameters = maAlignmentDefaults) =>
  maAlignmentScreen.evaluate(bars(closes), parameters)[0];

test("MA Alignment defaults are independent and calculate 10 EMA, 21 EMA, and 50 SMA", () => {
  const result = evaluate(line());
  expect(result.passed).toBe(true);
  expect(result.metrics?.ma1).toBeCloseTo(104.76 - 4.5 * 0.04, 10);
  expect(result.metrics?.ma2).toBeCloseTo(104.76 - 10 * 0.04, 10);
  expect(result.metrics?.ma3).toBeCloseTo(104.76 - 24.5 * 0.04, 10);
  expect(result.metrics?.maSpreadPercent).toBeCloseTo(((104.58 - 103.78) / 103.78) * 100, 10);
  expect(maAlignmentDefaults).toEqual({
    maxMaSpreadPercent: 3,
    ma1Period: 10,
    ma1Type: "EMA",
    ma2Period: 21,
    ma2Type: "EMA",
    ma3Period: 50,
    ma3Type: "SMA",
  });
});

test("all periods and average types are configurable and drive warmup and labels", () => {
  const parameters = {
    ...maAlignmentDefaults,
    ma1Period: 5,
    ma1Type: "SMA" as const,
    ma2Period: 8,
    ma2Type: "SMA" as const,
    ma3Period: 13,
    ma3Type: "EMA" as const,
  };
  expect(evaluate(line().slice(0, 12), parameters).insufficientData).toContain("Need 13");
  expect(evaluate(line().slice(0, 13), parameters).metrics).not.toBeNull();
  expect(
    maAlignmentColumns(parameters)
      .map(({ label }) => label)
      .slice(2, 5),
  ).toEqual(["5 SMA", "8 SMA", "13 EMA"]);
});

test("spread rule is inclusive and does not require direction, ordering, or price position", () => {
  const flat = evaluate(Array(120).fill(100));
  expect(flat.passed).toBe(true);
  const falling = evaluate(line(-0.01));
  expect(falling.passed).toBe(true);
  const spread = evaluate(line()).metrics?.maSpreadPercent as number;
  expect(evaluate(line(), { ...maAlignmentDefaults, maxMaSpreadPercent: spread }).passed).toBe(
    true,
  );
  expect(
    evaluate(line(), { ...maAlignmentDefaults, maxMaSpreadPercent: spread - 1e-8 }).failedRules,
  ).toHaveLength(1);
});

test("normalization accepts bounded settings and rejects malformed values", () => {
  for (const value of [null, [], "bad", { ma1Period: 0, ma2Type: "WMA" }])
    expect(normalizeMaAlignmentParameters(value)).toEqual(maAlignmentDefaults);
  expect(
    normalizeMaAlignmentParameters({
      maxMaSpreadPercent: 4.5,
      ma1Period: 7,
      ma1Type: "SMA",
      ma2Period: 34,
      ma2Type: "EMA",
      ma3Period: 100,
      ma3Type: "EMA",
    }),
  ).toEqual({
    maxMaSpreadPercent: 4.5,
    ma1Period: 7,
    ma1Type: "SMA",
    ma2Period: 34,
    ma2Type: "EMA",
    ma3Period: 100,
    ma3Type: "EMA",
  });
  expect(normalizeMaAlignmentParameters({ ma1Period: 1.5, ma3Period: 253 })).toEqual(
    maAlignmentDefaults,
  );
});

test("invalid history remains unavailable and does not mutate input", () => {
  const original = bars(line());
  const invalid = structuredClone(original);
  invalid[119].close = NaN;
  expect(maAlignmentScreen.evaluate(invalid, maAlignmentDefaults)[0].metrics).toBeNull();
  const duplicate = structuredClone(original);
  duplicate[119].time = duplicate[118].time;
  expect(maAlignmentScreen.evaluate(duplicate, maAlignmentDefaults)[0].metrics).toBeNull();
  const before = JSON.stringify(original);
  maAlignmentScreen.evaluate(original, maAlignmentDefaults);
  expect(JSON.stringify(original)).toBe(before);
});

test("result helpers sort, filter, label CSV, and neutralize spreadsheet formulas", () => {
  const pass = evaluate(line());
  if (!pass.metrics) throw new Error("Expected metrics");
  const excluded = {
    ...pass,
    passed: false,
    failedRules: ["MA spread: 5.000% exceeds 3%"],
    metrics: { ...pass.metrics, maSpreadPercent: 5 },
  };
  const rows: MaAlignmentRow[] = [
    { ticker: "WIDE", evaluation: excluded },
    { ticker: "TIGHT", evaluation: pass },
  ];
  expect(visibleMaAlignmentRows(rows, false).map(({ ticker }) => ticker)).toEqual(["TIGHT"]);
  expect(visibleMaAlignmentRows(rows, true).map(({ ticker }) => ticker)).toEqual(["TIGHT", "WIDE"]);
  const csv = maAlignmentCsv(visibleMaAlignmentRows(rows, true), maAlignmentDefaults);
  expect(csv).toContain('"10 EMA","21 EMA","50 SMA"');
  expect(csv).toContain("Excluded: MA spread");
  expect(maAlignmentCsv([{ ticker: "=BAD", evaluation: pass }], maAlignmentDefaults)).toContain(
    "'=BAD",
  );
});

test("provider parsing excludes current/future NY sessions and rejects wrong symbols", () => {
  const data = bars(line());
  data[data.length - 1].time = "2026-09-25";
  const payload = {
    security: { symbol: "TEST" },
    chart: { candles: [...data, { ...data[119], time: "2026-09-26" }] },
  };
  expect(
    maAlignmentBarsFromAnalysis(payload, "TEST", new Date("2026-09-26T00:30:00Z")),
  ).toHaveLength(119);
  expect(
    maAlignmentBarsFromAnalysis(payload, "TEST", new Date("2026-09-26T12:00:00Z")),
  ).toHaveLength(120);
  expect(() => maAlignmentBarsFromAnalysis(payload, "OTHER", new Date())).toThrow();
});

test("MA Alignment is registered as its own isolated panel", () => {
  expect(screenerPanelRegistry.map(({ screen }) => screen.id)).toEqual([
    "alex-rules",
    "launch-pad",
    "ma-alignment",
    "all",
  ]);
  expect(screenerPanelRegistry.map(({ hostId }) => hostId)).toEqual([
    "screenerContent",
    "launchPadContent",
    "maAlignmentContent",
    "allContent",
  ]);
});
