import { averageTrueRange, movingAverageSeries, validDailyBars } from "../screener-indicators";
import type {
  DailyBar,
  ScreenEvaluation,
  ScreenerScreen,
  ScreenMetric,
  ScreenParameters,
} from "../screener-types";

const numeric = (value: unknown, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;
const integer = (value: unknown, fallback: number) =>
  Math.max(1, Math.round(numeric(value, fallback)));
const averageTypeFor = (parameters: ScreenParameters) =>
  parameters.averageType === "SMA" ? "SMA" : "EMA";

function structureSeries(bars: DailyBar[], parameters: ScreenParameters) {
  const type = averageTypeFor(parameters);
  const closes = bars.map((bar) => bar.close);
  const upper = movingAverageSeries(
    parameters.structureBand === true ? bars.map((bar) => bar.high) : closes,
    21,
    type,
  );
  const lower =
    parameters.structureBand === true
      ? movingAverageSeries(
          bars.map((bar) => bar.low),
          21,
          type,
        )
      : upper;
  return { closes, upper, lower, closeAverage: movingAverageSeries(closes, 21, type) };
}

function metricsFor(bars: DailyBar[], parameters: ScreenParameters): ScreenMetric | null {
  const valid = validDailyBars(bars);
  const atrPeriod = integer(parameters.atrPeriod, 14);
  if (
    valid.length < 21 + Math.max(5, integer(parameters.risingLookback, 5)) ||
    valid.length < atrPeriod + 1
  )
    return null;
  const { closes, upper, closeAverage } = structureSeries(valid, parameters);
  const average21 = upper.at(-1);
  const slopeLookback = integer(parameters.slopeLookback, 3);
  const previous = closeAverage.at(-(slopeLookback + 1));
  const atr = averageTrueRange(valid, atrPeriod);
  const close = closes.at(-1);
  if (
    average21 === null ||
    average21 === undefined ||
    previous === null ||
    previous === undefined ||
    atr === null ||
    !close ||
    atr <= 0
  )
    return null;
  return {
    close,
    average21,
    atr,
    distanceAtr: (close - average21) / atr,
    slope: average21 - previous,
    date: valid.at(-1)?.time || "Unavailable",
  };
}

function unavailable(setup: string): ScreenEvaluation {
  return { setup, passed: false, failedRules: ["Insufficient valid daily history"], metrics: null };
}

function setupOne(bars: DailyBar[], parameters: ScreenParameters): ScreenEvaluation {
  const metrics = metricsFor(bars, parameters);
  if (!metrics) return unavailable("1 — Buying Weakness");
  const valid = validDailyBars(bars);
  const { closes, upper, closeAverage } = structureSeries(valid, parameters);
  const risingLookback = integer(parameters.risingLookback, 5);
  const current = closeAverage.at(-1);
  const earlier = closeAverage.at(-(risingLookback + 1));
  const daysAbove = integer(parameters.setup1DaysAbove, 8);
  const lookback = integer(parameters.setup1Lookback, 10);
  const aboveCount = closes.slice(-lookback).filter((close, index) => {
    const average = upper[upper.length - lookback + index];
    return average !== null && close > average;
  }).length;
  const maxDistance = numeric(parameters.maxDistanceAtr, 1);
  const failedRules: string[] = [];
  if (aboveCount < daysAbove)
    failedRules.push(`Uptrend: only ${aboveCount} of last ${lookback} closes above 21 MA`);
  if (current == null || earlier == null || current <= earlier)
    failedRules.push(`21 MA is not rising over ${risingLookback} days`);
  if (metrics.distanceAtr < 0 || metrics.distanceAtr > maxDistance)
    failedRules.push(`Close is not between 0 and ${maxDistance} ATR above 21 MA`);
  if (parameters.requireSetup1LowTouch === true) {
    const touch = numeric(parameters.setup1LowTouchAtr, 0.25);
    const latestLow = valid.at(-1)?.low;
    if (latestLow === undefined || Math.abs(latestLow - metrics.average21) / metrics.atr > touch)
      failedRules.push(`Low did not come within ${touch} ATR of 21 MA`);
  }
  return { setup: "1 — Buying Weakness", passed: !failedRules.length, failedRules, metrics };
}

function setupTwo(bars: DailyBar[], parameters: ScreenParameters): ScreenEvaluation {
  const metrics = metricsFor(bars, parameters);
  if (!metrics) return unavailable("2 — Buying Strength");
  const valid = validDailyBars(bars);
  const { closes, upper, lower, closeAverage } = structureSeries(valid, parameters);
  const recentDays = integer(parameters.setup2RecentDays, 15);
  const minimumBelow = integer(parameters.setup2BelowDays, 3);
  const slopeDays = integer(parameters.slopeLookback, 3);
  const priorSlopeDays = integer(parameters.setup2PriorSlopeDays, 3);
  const comparisonStart = Math.max(0, lower.length - recentDays);
  const belowCount = closes.slice(-recentDays).filter((close, index) => {
    const average = lower[comparisonStart + index];
    return average !== null && close < average;
  }).length;
  const current = closeAverage.at(-1);
  const currentEarlier = closeAverage.at(-(slopeDays + 1));
  const priorEnd = closeAverage.at(-(slopeDays + 1));
  const priorStart = closeAverage.at(-(slopeDays + priorSlopeDays + 1));
  const maxDistance = numeric(parameters.maxDistanceAtr, 1);
  const failedRules: string[] = [];
  if (belowCount < minimumBelow)
    failedRules.push(
      `Lost structure: only ${belowCount} closes below 21 MA in last ${recentDays} days`,
    );
  if (
    current == null ||
    currentEarlier == null ||
    priorEnd == null ||
    priorStart == null ||
    current - currentEarlier < 0 ||
    priorEnd - priorStart >= 0
  )
    failedRules.push("21 MA has not flattened or curled up after prior weakness");
  if (metrics.close <= (upper.at(-1) || Infinity))
    failedRules.push("Close has not reclaimed the 21 MA");
  if (metrics.distanceAtr > maxDistance)
    failedRules.push(`Close is more than ${maxDistance} ATR above 21 MA`);
  return { setup: "2 — Buying Strength", passed: !failedRules.length, failedRules, metrics };
}

export const alexRulesScreen: ScreenerScreen = {
  id: "alex-rules",
  name: "Alex Rules",
  description: "Buying weakness near a rising 21 MA, or buying strength after a reclaim.",
  defaults: {
    averageType: "EMA",
    structureBand: false,
    atrPeriod: 14,
    risingLookback: 5,
    slopeLookback: 3,
    maxDistanceAtr: 1,
    setup1DaysAbove: 8,
    setup1Lookback: 10,
    requireSetup1LowTouch: false,
    setup1LowTouchAtr: 0.25,
    setup2BelowDays: 3,
    setup2RecentDays: 15,
    setup2PriorSlopeDays: 3,
  },
  evaluate: (bars, parameters) => [setupOne(bars, parameters), setupTwo(bars, parameters)],
};
