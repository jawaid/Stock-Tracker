import { movingAverage } from "../screener-indicators";
import type { DailyBar, ScreenParameters } from "../screener-types";

export type LaunchPadParameters = {
  maxMaSpreadPercent: number;
};

export const launchPadDefaults: LaunchPadParameters = {
  maxMaSpreadPercent: 3,
};

export const launchPadParameterFields = [
  { key: "maxMaSpreadPercent", label: "Maximum MA spread (%)", min: 0, max: 25, step: 0.1 },
] as const;

/** Only Launch Pad settings are read here; unknown fields and malformed values are ignored. */
export function normalizeLaunchPadParameters(value: unknown): LaunchPadParameters {
  const result = { ...launchPadDefaults };
  if (!value || typeof value !== "object" || Array.isArray(value)) return result;
  const input = value as Record<string, unknown>;
  for (const field of launchPadParameterFields) {
    const candidate = input[field.key];
    if (
      typeof candidate === "number" &&
      Number.isFinite(candidate) &&
      candidate >= field.min &&
      candidate <= field.max
    )
      result[field.key] = candidate;
  }
  return result;
}

export type LaunchPadMetrics = {
  close: number;
  sma21: number;
  sma50: number;
  ema65: number;
  maSpreadPercent: number;
  date: string;
};

export type LaunchPadEvaluation = {
  setup: "Launch Pad";
  passed: boolean;
  failedRules: string[];
  metrics: LaunchPadMetrics | null;
  insufficientData?: string;
};

function unavailable(reason: string): LaunchPadEvaluation[] {
  return [
    {
      setup: "Launch Pad",
      passed: false,
      failedRules: [],
      metrics: null,
      insufficientData: reason,
    },
  ];
}

function evaluate(bars: DailyBar[], input: ScreenParameters): LaunchPadEvaluation[] {
  const parameters = normalizeLaunchPadParameters(input);
  const required = 65;
  if (bars.length < required)
    return unavailable(`Need ${required} valid daily bars; received ${bars.length}.`);
  // Do not silently drop invalid rows: doing so changes the requested trading-day windows.
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
  const specifications = [
    [21, "SMA", "SMA21"],
    [50, "SMA", "SMA50"],
    [65, "EMA", "EMA65"],
  ] as const;
  const averages = specifications.map(([period, type, name]) => ({
    name,
    current: movingAverage(closes, period, type) as number,
  }));
  const [sma21, sma50, ema65] = averages.map((average) => average.current);
  if (averages.some(({ current }) => !Number.isFinite(current) || current <= 0))
    return unavailable("Moving averages could not be calculated from this history.");
  const latest = bars[bars.length - 1];
  const highestAverage = Math.max(sma21, sma50, ema65);
  const lowestAverage = Math.min(sma21, sma50, ema65);
  const maSpreadPercent = ((highestAverage - lowestAverage) / lowestAverage) * 100;
  const failedRules: string[] = [];
  if (maSpreadPercent > parameters.maxMaSpreadPercent)
    failedRules.push(
      `MA spread: ${maSpreadPercent.toFixed(3)}% exceeds ${parameters.maxMaSpreadPercent}%`,
    );
  return [
    {
      setup: "Launch Pad",
      passed: failedRules.length === 0,
      failedRules,
      metrics: {
        close: latest.close,
        sma21,
        sma50,
        ema65,
        maSpreadPercent,
        date: latest.time as string,
      },
    },
  ];
}

/** Independent module with the same name/defaults/evaluate pattern as Alex Rules. */
export const launchPadScreen = {
  id: "launch-pad",
  name: "Launch Pad",
  description: "Find SMA21, SMA50, and EMA65 compressed within a shared band.",
  defaults: launchPadDefaults,
  evaluate,
};
