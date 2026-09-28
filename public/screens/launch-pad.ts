import { movingAverage } from "../screener-indicators";
import type { DailyBar, ScreenParameters } from "../screener-types";

export type LaunchPadParameters = {
  maxDistancePercent: number;
  risingLookback: number;
  requireAboveSma21: boolean;
  rangeLookback: number;
};

export const launchPadDefaults: LaunchPadParameters = {
  maxDistancePercent: 3,
  risingLookback: 5,
  requireAboveSma21: true,
  rangeLookback: 10,
};

export const launchPadParameterFields = [
  { key: "maxDistancePercent", label: "Max distance from each MA (%)", min: 0, max: 25, step: 0.1 },
  { key: "risingLookback", label: "Rising lookback (days)", min: 1, max: 60, step: 1 },
  { key: "requireAboveSma21", label: "Require close above SMA21" },
  {
    key: "rangeLookback",
    label: "Range lookback for entry/stop levels (days)",
    min: 1,
    max: 252,
    step: 1,
  },
] as const;

/** Only Launch Pad settings are read here; unknown fields and malformed values are ignored. */
export function normalizeLaunchPadParameters(value: unknown): LaunchPadParameters {
  const result = { ...launchPadDefaults };
  if (!value || typeof value !== "object" || Array.isArray(value)) return result;
  const input = value as Record<string, unknown>;
  for (const field of launchPadParameterFields) {
    const candidate = input[field.key];
    if (field.key === "requireAboveSma21") {
      if (typeof candidate === "boolean") result[field.key] = candidate;
    } else if (
      typeof candidate === "number" &&
      Number.isFinite(candidate) &&
      candidate >= field.min &&
      candidate <= field.max &&
      (field.step !== 1 || Number.isInteger(candidate))
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
  maxDistancePercent: number;
  rangeHigh: number;
  rangeLow: number;
  rangeWidthPercent: number;
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
  const required = Math.max(65 + parameters.risingLookback, parameters.rangeLookback);
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
  const previous = closes.slice(0, -parameters.risingLookback);
  const specifications = [
    [21, "SMA", "SMA21"],
    [50, "SMA", "SMA50"],
    [65, "EMA", "EMA65"],
  ] as const;
  const averages = specifications.map(([period, type, name]) => ({
    name,
    current: movingAverage(closes, period, type) as number,
    prior: movingAverage(previous, period, type) as number,
  }));
  const [sma21, sma50, ema65] = averages.map((average) => average.current);
  if (
    averages.some(
      ({ current, prior }) =>
        !Number.isFinite(current) || !Number.isFinite(prior) || current <= 0 || prior <= 0,
    )
  )
    return unavailable("Moving averages could not be calculated from this history.");
  const latest = bars[bars.length - 1];
  const distances = averages.map(
    ({ current }) => (Math.abs(latest.close - current) / current) * 100,
  );
  const maxDistancePercent = Math.max(...distances);
  const range = bars.slice(-parameters.rangeLookback);
  const rangeHigh = Math.max(...range.map((bar) => bar.high));
  const rangeLow = Math.min(...range.map((bar) => bar.low));
  const failedRules: string[] = [];
  const distant = averages.filter((_, index) => distances[index] > parameters.maxDistancePercent);
  if (distant.length)
    failedRules.push(
      `Proximity: close is more than ${parameters.maxDistancePercent}% from ${distant.map(({ name }) => name).join(", ")}`,
    );
  if (!(sma21 > sma50 && sma50 > ema65))
    failedRules.push("Alignment: SMA21 > SMA50 > EMA65 is not met");
  const notRising = averages.filter(({ current, prior }) => current <= prior);
  if (notRising.length)
    failedRules.push(
      `Rising: ${notRising.map(({ name }) => name).join(", ")} not higher than ${parameters.risingLookback} trading days ago`,
    );
  if (parameters.requireAboveSma21 && latest.close < sma21)
    failedRules.push("Above support: close is below SMA21");
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
        maxDistancePercent,
        rangeHigh,
        rangeLow,
        rangeWidthPercent: ((rangeHigh - rangeLow) / rangeLow) * 100,
        date: latest.time as string,
      },
    },
  ];
}

/** Independent module with the same name/defaults/evaluate pattern as Alex Rules. */
export const launchPadScreen = {
  id: "launch-pad",
  name: "Launch Pad",
  description: "Find rising, aligned SMA21, SMA50, and EMA65 close to price.",
  defaults: launchPadDefaults,
  evaluate,
};
