import { movingAverage } from "../screener-indicators";
import type { DailyBar, ScreenParameters } from "../screener-types";

export type MovingAverageType = "EMA" | "SMA";

export type MaAlignmentParameters = {
  maxMaSpreadPercent: number;
  ma1Period: number;
  ma1Type: MovingAverageType;
  ma2Period: number;
  ma2Type: MovingAverageType;
  ma3Period: number;
  ma3Type: MovingAverageType;
};

export const maAlignmentDefaults: MaAlignmentParameters = {
  maxMaSpreadPercent: 3,
  ma1Period: 10,
  ma1Type: "EMA",
  ma2Period: 21,
  ma2Type: "EMA",
  ma3Period: 50,
  ma3Type: "SMA",
};

export const maAlignmentSlots = [1, 2, 3] as const;

export function normalizeMaAlignmentParameters(value: unknown): MaAlignmentParameters {
  const result = { ...maAlignmentDefaults };
  if (!value || typeof value !== "object" || Array.isArray(value)) return result;
  const input = value as Record<string, unknown>;
  const spread = input.maxMaSpreadPercent;
  if (typeof spread === "number" && Number.isFinite(spread) && spread >= 0 && spread <= 25)
    result.maxMaSpreadPercent = spread;
  for (const slot of maAlignmentSlots) {
    const periodKey = `ma${slot}Period` as const;
    const typeKey = `ma${slot}Type` as const;
    const period = input[periodKey];
    const type = input[typeKey];
    if (typeof period === "number" && Number.isInteger(period) && period >= 1 && period <= 252)
      result[periodKey] = period;
    if (type === "EMA" || type === "SMA") result[typeKey] = type;
  }
  return result;
}

export type MaAlignmentMetrics = {
  close: number;
  ma1: number;
  ma2: number;
  ma3: number;
  maSpreadPercent: number;
  date: string;
};

export type MaAlignmentEvaluation = {
  setup: "MA Alignment";
  passed: boolean;
  failedRules: string[];
  metrics: MaAlignmentMetrics | null;
  insufficientData?: string;
};

function unavailable(reason: string): MaAlignmentEvaluation[] {
  return [
    {
      setup: "MA Alignment",
      passed: false,
      failedRules: [],
      metrics: null,
      insufficientData: reason,
    },
  ];
}

function evaluate(bars: DailyBar[], input: ScreenParameters): MaAlignmentEvaluation[] {
  const parameters = normalizeMaAlignmentParameters(input);
  const required = Math.max(parameters.ma1Period, parameters.ma2Period, parameters.ma3Period);
  if (bars.length < required)
    return unavailable(`Need ${required} valid daily bars; received ${bars.length}.`);
  for (let index = 0; index < bars.length; index++) {
    const bar = bars[index];
    if (
      ![bar.open, bar.high, bar.low, bar.close].every(
        (value) => Number.isFinite(value) && value > 0,
      ) ||
      bar.high < Math.max(bar.open, bar.close, bar.low) ||
      bar.low > Math.min(bar.open, bar.close) ||
      !bar.time ||
      !/^\d{4}-\d{2}-\d{2}$/.test(bar.time) ||
      !Number.isFinite(Date.parse(bar.time)) ||
      new Date(bar.time).toISOString().slice(0, 10) !== bar.time ||
      (index > 0 && bar.time <= (bars[index - 1].time || ""))
    )
      return unavailable("Daily history contains invalid, duplicate, or out-of-order bars.");
  }
  const closes = bars.map((bar) => bar.close);
  const values = maAlignmentSlots.map((slot) =>
    movingAverage(closes, parameters[`ma${slot}Period`], parameters[`ma${slot}Type`]),
  );
  if (values.some((value) => !Number.isFinite(value) || (value as number) <= 0))
    return unavailable("Moving averages could not be calculated from this history.");
  const [ma1, ma2, ma3] = values as [number, number, number];
  const highestAverage = Math.max(ma1, ma2, ma3);
  const lowestAverage = Math.min(ma1, ma2, ma3);
  const maSpreadPercent = ((highestAverage - lowestAverage) / lowestAverage) * 100;
  const failedRules: string[] = [];
  if (maSpreadPercent > parameters.maxMaSpreadPercent)
    failedRules.push(
      `MA spread: ${maSpreadPercent.toFixed(3)}% exceeds ${parameters.maxMaSpreadPercent}%`,
    );
  const latest = bars[bars.length - 1];
  return [
    {
      setup: "MA Alignment",
      passed: failedRules.length === 0,
      failedRules,
      metrics: {
        close: latest.close,
        ma1,
        ma2,
        ma3,
        maSpreadPercent,
        date: latest.time as string,
      },
    },
  ];
}

export function maAlignmentLabel(
  parameters: MaAlignmentParameters,
  slot: (typeof maAlignmentSlots)[number],
) {
  return `${parameters[`ma${slot}Period`]} ${parameters[`ma${slot}Type`]}`;
}

export const maAlignmentScreen = {
  id: "ma-alignment",
  name: "MA Alignment",
  description: "Find three configurable moving averages compressed within a shared band.",
  defaults: maAlignmentDefaults,
  evaluate,
};
