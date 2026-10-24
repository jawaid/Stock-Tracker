import { movingAverage } from "../../public/screener-indicators";

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
  baseBars: 65,
  swingRadius: 5,
  dryVolumeBars: 10,
  volumeBars: 50,
  dryVolumeRatio: 0.75,
  pivotLookbackBars: 10,
  pauseMaxRange: 0.05,
  pauseVolumeRatio: 0.8,
  lowCheatBoundary: 1 / 3,
  classicBoundary: 2 / 3,
  maximumRisk: 0.1,
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
  if (bars.length < config.minimumBars || !validTechnicalHistory(bars)) return empty;
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
export function vcpAnalysis(bars: TechnicalBar[], config = MINERVINI_DEFAULTS) {
  if (bars.length < config.minimumBars || !validTechnicalHistory(bars))
    return { contractionDepths: null, contractionsShrinking: null, volumeDryUp: null };
  const window = bars.slice(-config.baseBars);
  const depths: number[] = [];
  let pendingHigh: number | null = null;
  const r = config.swingRadius;
  for (let i = r; i < window.length - r; i++) {
    const bar = window[i];
    const left = window.slice(i - r, i);
    const right = window.slice(i + 1, i + r + 1);
    // Earliest bar of a tied plateau wins; the same bar cannot close its own contraction.
    const high = left.every((b) => b.high < bar.high) && right.every((b) => b.high <= bar.high);
    const low = left.every((b) => b.low > bar.low) && right.every((b) => b.low >= bar.low);
    if (low && pendingHigh !== null) {
      if (bar.low < pendingHigh) depths.push((pendingHigh - bar.low) / pendingHigh);
      pendingHigh = null;
    }
    if (high) pendingHigh = bar.high;
  }
  const volumes = bars.map((bar) => bar.volume);
  const recent = movingAverage(volumes, config.dryVolumeBars, "SMA");
  const average = movingAverage(volumes, config.volumeBars, "SMA");
  return {
    contractionDepths: depths,
    contractionsShrinking: depths.length >= 2 && depths.slice(1).every((d, i) => d < depths[i]),
    volumeDryUp:
      recent === null || average === null ? null : recent < config.dryVolumeRatio * average,
  };
}

export type EntryAnalysis = {
  entryReason?: string;
  isTight: boolean | null;
  volumeQuiet: boolean | null;
  pauseContainsBaseLow: boolean | null;
  breakoutPriceOnly: boolean | null;
  entryType: "Low cheat" | "Cheat" | "Classic pivot" | "none" | null;
  entryPivot: number | null;
  entryStop: number | null;
  baseHigh: number | null;
  baseLow: number | null;
  riskPct: number | null;
  stopTooWide: boolean | null;
  pctFromPivot: number | null;
  breakoutToday: boolean | null;
  pauseBars: number | null;
};
/** Price levels use a fixed prior-bar window and are independent of entry quality. */
export function entryAnalysis(bars: TechnicalBar[], config = MINERVINI_DEFAULTS): EntryAnalysis {
  const n = config.pivotLookbackBars;
  const empty: EntryAnalysis = {
    entryReason: `Need ${n + 1} valid bars for a ${n}-bar prior price window.`,
    entryType: null,
    entryPivot: null,
    entryStop: null,
    baseHigh: null,
    baseLow: null,
    riskPct: null,
    stopTooWide: null,
    pctFromPivot: null,
    breakoutToday: null,
    breakoutPriceOnly: null,
    isTight: null,
    volumeQuiet: null,
    pauseContainsBaseLow: null,
    pauseBars: null,
  };
  if (!Number.isInteger(n) || n < 1)
    return { ...empty, entryReason: "Pivot lookback must be a positive integer." };
  if (bars.length < n + 1 || !validTechnicalHistory(bars.slice(-n - 1))) return empty;
  const signal = bars[bars.length - 1];
  const prior = bars.slice(0, -1);
  const window = prior.slice(-n);
  const pivot = Math.max(...window.map((bar) => bar.high));
  const stop = Math.min(...window.map((bar) => bar.low));
  const risk = (pivot - stop) / pivot;
  const volumeHistory = bars.slice(-config.volumeBars);
  const averageVolume =
    volumeHistory.length === config.volumeBars && validTechnicalHistory(volumeHistory)
      ? movingAverage(
          volumeHistory.map((bar) => bar.volume),
          config.volumeBars,
          "SMA",
        )
      : null;
  const windowVolume = window.reduce((sum, bar) => sum + bar.volume, 0) / n;
  const priceBreakout = signal.close > pivot;
  const result: EntryAnalysis = {
    ...empty,
    entryPivot: pivot,
    entryStop: stop,
    riskPct: risk,
    stopTooWide: risk > config.maximumRisk,
    pctFromPivot: (signal.close - pivot) / pivot,
    breakoutPriceOnly: priceBreakout,
    breakoutToday: !priceBreakout
      ? false
      : averageVolume === null
        ? null
        : signal.volume >= config.breakoutVolumeRatio * averageVolume,
    isTight: risk <= config.pauseMaxRange,
    volumeQuiet:
      averageVolume === null ? null : windowVolume < config.pauseVolumeRatio * averageVolume,
    pauseBars: n,
    entryReason: `Price levels available; need ${config.baseBars} valid prior bars to classify the base.`,
  };
  const base = prior.slice(-config.baseBars);
  if (base.length < config.baseBars || !validTechnicalHistory(base)) return result;
  const high = Math.max(...base.map((bar) => bar.high));
  const highIndex = base.findLastIndex((bar) => bar.high === high);
  const after = base.slice(highIndex + 1);
  result.baseHigh = high;
  result.entryType = "none";
  result.entryReason = "No completed pullback after the base high.";
  if (!after.length) return result;
  const low = Math.min(...after.map((bar) => bar.low));
  const lowIndex = highIndex + 1 + after.findLastIndex((bar) => bar.low === low);
  result.baseLow = low;
  result.pauseContainsBaseLow = prior.length - base.length + lowIndex >= prior.length - n;
  if (result.pauseContainsBaseLow)
    return { ...result, entryReason: "still in pullback, no tight area yet" };
  if (signal.low <= low)
    return { ...result, entryReason: "The signal bar touched or breached the base low." };
  if (high <= low) return { ...result, entryReason: "The base has no positive price range." };
  const position = (pivot - low) / (high - low);
  return {
    ...result,
    entryType:
      position < config.lowCheatBoundary
        ? "Low cheat"
        : position < config.classicBoundary
          ? "Cheat"
          : "Classic pivot",
    entryReason: `${n}-bar price window classified by position in the base. Review the separate quality flags.`,
  };
}
export type MinerviniResult = {
  symbol: string;
  date: string | null;
  error: string | null;
  close: number | null;
  rules: TrendRules;
  passCount: number;
  allPass: boolean;
  sma200RisingStrong: boolean | null;
  values: TrendValues;
  vcp: ReturnType<typeof vcpAnalysis>;
  entry: EntryAnalysis;
};
export function evaluateMinerviniUniverse(
  histories: { symbol: string; bars: TechnicalBar[]; error?: string | null }[],
  config = MINERVINI_DEFAULTS,
): MinerviniResult[] {
  return histories.map((row) => {
    const values = trendValues(row.bars, config);
    const rules = trendRules(values, config);
    const passes = Object.values(rules).map((rule) => rule.pass);
    return {
      symbol: row.symbol,
      date: values.close === null ? null : row.bars[row.bars.length - 1].time,
      error:
        row.error ||
        (values.close === null
          ? `Insufficient data: need ${config.minimumBars} valid completed OHLCV bars.`
          : null),
      close: values.close,
      values,
      rules,
      passCount: passes.filter((pass) => pass === true).length,
      allPass: passes.every((pass) => pass === true),
      sma200RisingStrong:
        values.sma200 === null || values.sma200StrongPrior === null
          ? null
          : values.sma200 > values.sma200StrongPrior,
      vcp: vcpAnalysis(row.bars, config),
      entry: entryAnalysis(row.bars, config),
    };
  });
}
