import { movingAverage } from "../../public/screener-indicators";
import { walkForwardVcp } from "./minervini-vcp";

export type TechnicalBar = {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};
export const MINERVINI_DEFAULTS = {
  minimumBars: 260,
  smaFast: 50,
  smaMiddle: 150,
  smaSlow: 200,
  yearBars: 252,
  risingBars: 22,
  strongRisingBars: 105,
  aboveLowMultiplier: 1.3,
  nearHighMultiplier: 0.75,
  baseBars: 325,
  minimumBaseBars: 15,
  priorUptrendBars: 120,
  priorUptrendGain: 0.3,
  baseHighTolerance: 0.05,
  zigzagPct: 0.03,
  minimumContractions: 2,
  maximumContractions: 6,
  firstContractionMax: 0.35,
  contractionTolerance: 1.15,
  lastContractionMax: 0.1,
  volumeBars: 50,
  dryVolumeRatio: 0.75,
  buyPointOffset: 0.1,
  buyRangePct: 0.05,
  freezeBars: 60,
  stopNoticeBars: 5,
  lowCheatBoundary: 1 / 3,
  classicBoundary: 2 / 3,
  maximumRisk: 0.08,
  breakoutVolumeRatio: 1.4,
};
export type MinerviniConfig = typeof MINERVINI_DEFAULTS;
export type Rule = { pass: boolean | null; values: Record<string, number | null> };
export type TrendRules = Record<"TT1" | "TT2" | "TT3" | "TT4" | "TT5" | "TT6" | "TT7", Rule>;
export type TrendValues = {
  close: number | null;
  sma50: number | null;
  sma150: number | null;
  sma200: number | null;
  sma200Prior: number | null;
  sma200StrongPrior: number | null;
  high52: number | null;
  low52: number | null;
};
export function validTechnicalHistory(bars: TechnicalBar[]) {
  return bars.every(
    (bar, i) =>
      bar &&
      typeof bar.time === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(bar.time) &&
      Number.isFinite(Date.parse(bar.time)) &&
      new Date(bar.time).toISOString().slice(0, 10) === bar.time &&
      (i === 0 || bar.time > bars[i - 1].time) &&
      [bar.open, bar.high, bar.low, bar.close].every(
        (v) => typeof v === "number" && Number.isFinite(v) && v > 0,
      ) &&
      typeof bar.volume === "number" &&
      Number.isFinite(bar.volume) &&
      bar.volume >= 0 &&
      bar.high >= Math.max(bar.open, bar.low, bar.close) &&
      bar.low <= Math.min(bar.open, bar.close),
  );
}
export function trendValues(bars: TechnicalBar[], config = MINERVINI_DEFAULTS): TrendValues {
  const empty: TrendValues = {
    close: null,
    sma50: null,
    sma150: null,
    sma200: null,
    sma200Prior: null,
    sma200StrongPrior: null,
    high52: null,
    low52: null,
  };
  if (!bars.length || !validTechnicalHistory(bars)) return empty;
  const closes = bars.map((bar) => bar.close);
  const sma = (period: number, offset = 0) =>
    movingAverage(closes.slice(0, closes.length - offset), period, "SMA");
  return {
    close: closes[closes.length - 1],
    sma50: sma(config.smaFast),
    sma150: sma(config.smaMiddle),
    sma200: sma(config.smaSlow),
    sma200Prior: sma(config.smaSlow, config.risingBars),
    sma200StrongPrior: sma(config.smaSlow, config.strongRisingBars),
    high52:
      bars.length >= config.yearBars
        ? Math.max(...bars.slice(-config.yearBars).map((b) => b.high))
        : null,
    low52:
      bars.length >= config.yearBars
        ? Math.min(...bars.slice(-config.yearBars).map((b) => b.low))
        : null,
  };
}
export function trendRules(v: TrendValues, config = MINERVINI_DEFAULTS): TrendRules {
  const rule = (values: Rule["values"], predicate: () => boolean): Rule => ({
    values,
    pass: Object.values(values).some((value) => value === null) ? null : predicate(),
  });
  const { close: c, sma50: f, sma150: m, sma200: s, sma200Prior: p, high52: h, low52: l } = v;
  return {
    TT1: rule(
      { close: c, sma150: m, sma200: s },
      () => Number(c) > Number(m) && Number(c) > Number(s),
    ),
    TT2: rule({ sma150: m, sma200: s }, () => Number(m) > Number(s)),
    TT3: rule({ sma200: s, sma200Prior: p }, () => Number(s) > Number(p)),
    TT4: rule(
      { sma50: f, sma150: m, sma200: s },
      () => Number(f) > Number(m) && Number(f) > Number(s),
    ),
    TT5: rule({ close: c, sma50: f }, () => Number(c) > Number(f)),
    TT6: rule(
      { close: c, low52: l, threshold: l === null ? null : config.aboveLowMultiplier * l },
      () => Number(c) >= config.aboveLowMultiplier * Number(l),
    ),
    TT7: rule(
      { close: c, high52: h, threshold: h === null ? null : config.nearHighMultiplier * h },
      () => Number(c) >= config.nearHighMultiplier * Number(h),
    ),
  };
}
export type { EntryAnalysis, SetupHistory } from "./minervini-vcp";
export function vcpAnalysis(bars: TechnicalBar[], config = MINERVINI_DEFAULTS) {
  return walkForwardVcp(bars, config).vcp;
}
export function entryAnalysis(bars: TechnicalBar[], config = MINERVINI_DEFAULTS) {
  return walkForwardVcp(bars, config).entry;
}
export type MinerviniResult = {
  symbol: string;
  date: string | null;
  error: string | null;
  close: number | null;
  rules: TrendRules;
  dataStatus: string;
  passCount: number;
  allPass: boolean;
  sma200RisingStrong: boolean | null;
  values: TrendValues;
  vcp: ReturnType<typeof vcpAnalysis>;
  entry: ReturnType<typeof entryAnalysis>;
  setupHistory: import("./minervini-vcp").SetupHistory[];
};
export function evaluateMinerviniUniverse(
  histories: { symbol: string; bars: TechnicalBar[]; error?: string | null }[],
  config = MINERVINI_DEFAULTS,
): MinerviniResult[] {
  const unique = [...new Map(histories.map((row) => [row.symbol, row])).values()];
  return unique.map((row) => {
    const values = trendValues(row.bars, config);
    const rules = trendRules(values, config);
    const passes = Object.values(rules).map((rule) => rule.pass);
    const analysis = walkForwardVcp(row.bars, config);
    return {
      symbol: row.symbol,
      date: values.close === null ? null : row.bars[row.bars.length - 1].time,
      error:
        row.error || (values.close === null ? "Daily OHLCV history is missing or invalid." : null),
      close: values.close,
      values,
      rules,
      dataStatus:
        values.close === null
          ? "Unavailable"
          : row.bars.length < config.minimumBars
            ? "IPO – partial TT"
            : "Available",
      passCount: passes.filter((pass) => pass === true).length,
      allPass: passes.every((pass) => pass === true),
      sma200RisingStrong:
        values.sma200 === null || values.sma200StrongPrior === null
          ? null
          : values.sma200 > values.sma200StrongPrior,
      vcp: analysis.vcp,
      entry: analysis.entry,
      setupHistory: analysis.history,
    };
  });
}
