import { calculateRsi } from "../../server/indicators";
import { directionalMovement } from "../directional-movement";
import { averageTrueRange, movingAverage, movingAverageSeries } from "../screener-indicators";
import type { DailyBar } from "../screener-types";

export const SMA_TOUCH_LOOKBACK_BARS = 3;
export const DMI_PERIOD = 14;
export const RSI_PERIOD = 14;
export const RSI_SHORT_PERIOD = 2;
export const AVG_VOLUME_PERIOD = 20;
export const EXIT_EMA_PERIOD = 10;
export const RSI_DIAGNOSTIC_THRESHOLD = 58;
export const ADX_DIAGNOSTIC_THRESHOLD = 24;
export type R9Bar = DailyBar & { time: string; volume: number };
export type R9Metrics = {
  date: string;
  close: number;
  previousClose: number;
  sma10: number;
  sma20: number;
  sma50: number;
  sma100: number;
  sma200: number;
  ema10: number;
  macd: number;
  diPlus: number;
  diMinus: number;
  adx: number;
  adxAbove24: boolean;
  rsi14: number;
  rsiAbove58: boolean;
  rsi2: number;
  upDay: boolean;
  recentTouch: boolean;
  barsSinceTouch: number | null;
  volume: number;
  avgVolume20: number;
  volumeRatio: number | null;
  exitSignal: boolean;
  dailyReturn: number;
  return5: number;
  distanceSma20: number;
  distanceSma50: number;
  distanceSma50Atr: number | null;
  distanceHigh52: number | null;
  atr: number;
  atrPercent: number;
  stockReturn60: number;
  spyReturn60: number | null;
  rs60: number | null;
  rs20: number | null;
  rs120: number | null;
};
export function r9Rules(m: R9Metrics) {
  return {
    close_above_sma10: m.close > m.sma10,
    close_above_sma20: m.close > m.sma20,
    close_above_sma50: m.close > m.sma50,
    close_above_sma100: m.close > m.sma100,
    close_above_sma200: m.close > m.sma200,
    sma20_above_sma50: m.sma20 > m.sma50,
    macd_above_zero: m.macd > 0,
    di_plus_above_di_minus: m.diPlus > m.diMinus,
    up_day: m.close > m.previousClose,
    recent_sma10_touch_3bars: m.recentTouch,
    volume_at_least_avg20: m.volume >= m.avgVolume20,
  };
}
export const r9RuleLabels: Record<keyof ReturnType<typeof r9Rules>, string> = {
  close_above_sma10: "Close <= SMA10",
  close_above_sma20: "Close <= SMA20",
  close_above_sma50: "Close <= SMA50",
  close_above_sma100: "Close <= SMA100",
  close_above_sma200: "Close <= SMA200",
  sma20_above_sma50: "SMA20 <= SMA50",
  macd_above_zero: "MACD <= 0",
  di_plus_above_di_minus: "+DI <= -DI",
  up_day: "Close <= previous close",
  recent_sma10_touch_3bars: "No SMA10 touch in last 3 bars",
  volume_at_least_avg20: "Volume < average 20",
};
export type R9Evaluation = {
  passed: boolean | null;
  metrics: R9Metrics | null;
  rules: ReturnType<typeof r9Rules> | null;
  failedRules: string[];
  insufficientData?: string;
};
export function r9Exit(close: number, ema10: number) {
  return close < ema10;
}
export function recentSma10Touch(bars: DailyBar[], averages: (number | null)[]) {
  for (let offset = 0; offset < bars.length; offset++) {
    const index = bars.length - 1 - offset;
    const average = averages[index];
    if (average != null && bars[index].low <= average) return offset;
  }
  return null;
}
function validHistory(bars: R9Bar[], requireVolume = true) {
  return bars.every(
    (bar, i) =>
      /^\d{4}-\d{2}-\d{2}$/.test(bar.time) &&
      Number.isFinite(Date.parse(bar.time)) &&
      new Date(bar.time).toISOString().slice(0, 10) === bar.time &&
      (i === 0 || bar.time > bars[i - 1].time) &&
      [bar.open, bar.high, bar.low, bar.close].every((v) => Number.isFinite(v) && v > 0) &&
      bar.high >= Math.max(bar.open, bar.close, bar.low) &&
      bar.low <= Math.min(bar.open, bar.close) &&
      (!requireVolume || (Number.isFinite(bar.volume) && bar.volume >= 0)),
  );
}
const change = (end: number, start: number) => (end / start - 1) * 100;
/** Benchmark endpoints must match the stock's exact trading dates. Missing diagnostics never fail entry. */
export function relativeReturn(bars: R9Bar[], benchmark: R9Bar[], period: number) {
  if (bars.length <= period || !validHistory(benchmark, false)) return null;
  const start = bars[bars.length - 1 - period];
  const end = bars[bars.length - 1];
  const first = benchmark.find((bar) => bar.time === start.time);
  const last = benchmark.find((bar) => bar.time === end.time);
  if (!first || !last) return null;
  const benchmarkReturn = change(last.close, first.close);
  return { benchmarkReturn, relative: change(end.close, start.close) - benchmarkReturn };
}
export function evaluateR9(bars: R9Bar[], benchmark: R9Bar[] = []): R9Evaluation {
  const unavailable = (reason: string): R9Evaluation => ({
    passed: null,
    metrics: null,
    rules: null,
    failedRules: [],
    insufficientData: reason,
  });
  if (!validHistory(bars))
    return unavailable("Invalid, missing, duplicate, or unordered OHLCV history.");
  if (bars.length < 200)
    return unavailable(`Need 200 completed daily bars; received ${bars.length}.`);
  const closes = bars.map((bar) => bar.close);
  const sma = (period: number) => movingAverage(closes, period, "SMA") as number;
  const ema = (period: number) => movingAverage(closes, period, "EMA") as number;
  const latest = bars[bars.length - 1];
  const previousClose = bars[bars.length - 2].close;
  const dmi = directionalMovement(bars, DMI_PERIOD);
  if (!dmi) return unavailable("Insufficient DMI/ADX history.");
  const barsSinceTouch = recentSma10Touch(bars, movingAverageSeries(closes, 10, "SMA"));
  const avgVolume20 = movingAverage(
    bars.map((bar) => bar.volume),
    AVG_VOLUME_PERIOD,
    "SMA",
  ) as number;
  const rsi14 = calculateRsi(closes, RSI_PERIOD) as number;
  const rsi2 = calculateRsi(closes, RSI_SHORT_PERIOD) as number;
  const atr = averageTrueRange(bars, DMI_PERIOD) as number;
  const rs60 = relativeReturn(bars, benchmark, 60);
  const metrics: R9Metrics = {
    date: latest.time,
    close: latest.close,
    previousClose,
    sma10: sma(10),
    sma20: sma(20),
    sma50: sma(50),
    sma100: sma(100),
    sma200: sma(200),
    ema10: ema(EXIT_EMA_PERIOD),
    macd: ema(12) - ema(26),
    ...dmi,
    adxAbove24: dmi.adx >= ADX_DIAGNOSTIC_THRESHOLD,
    rsi14,
    rsi2,
    rsiAbove58: rsi14 >= RSI_DIAGNOSTIC_THRESHOLD,
    upDay: latest.close > previousClose,
    recentTouch: barsSinceTouch !== null && barsSinceTouch < SMA_TOUCH_LOOKBACK_BARS,
    barsSinceTouch,
    volume: latest.volume,
    avgVolume20,
    volumeRatio: avgVolume20 > 0 ? latest.volume / avgVolume20 : null,
    exitSignal: r9Exit(latest.close, ema(EXIT_EMA_PERIOD)),
    dailyReturn: change(latest.close, previousClose),
    return5: change(latest.close, closes[closes.length - 6]),
    distanceSma20: change(latest.close, sma(20)),
    distanceSma50: change(latest.close, sma(50)),
    distanceSma50Atr: atr > 0 ? (latest.close - sma(50)) / atr : null,
    distanceHigh52:
      bars.length >= 252
        ? change(latest.close, Math.max(...bars.slice(-252).map((bar) => bar.high)))
        : null,
    atr,
    atrPercent: (atr / latest.close) * 100,
    stockReturn60: change(latest.close, closes[closes.length - 61]),
    spyReturn60: rs60?.benchmarkReturn ?? null,
    rs60: rs60?.relative ?? null,
    rs20: relativeReturn(bars, benchmark, 20)?.relative ?? null,
    rs120: relativeReturn(bars, benchmark, 120)?.relative ?? null,
  };
  const rules = r9Rules(metrics);
  const failedRules = (Object.keys(rules) as (keyof typeof rules)[])
    .filter((key) => !rules[key])
    .map((key) => r9RuleLabels[key]);
  return { passed: failedRules.length === 0, metrics, rules, failedRules };
}
export const r9SwingScreen = { id: "r9-swing", name: "R9 Swing", evaluate: evaluateR9 };
