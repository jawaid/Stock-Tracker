import { expect, test } from "bun:test";
import {
  entryAnalysis,
  evaluateMinerviniUniverse,
  MINERVINI_DEFAULTS,
  type TechnicalBar,
  trendRules,
  trendValues,
  vcpAnalysis,
} from "./minervini";

function history(length = 320, descending = false): TechnicalBar[] {
  const date = new Date("2024-01-01T00:00:00Z");
  return Array.from({ length }, (_, i) => {
    do {
      date.setUTCDate(date.getUTCDate() + 1);
    } while ([0, 6].includes(date.getUTCDay()));
    const close = descending ? 500 - i : 100 + i;
    return {
      time: date.toISOString().slice(0, 10),
      open: close,
      high: close + 1,
      low: close - 1,
      close,
      volume: 1000,
    };
  });
}
test("Stage 2 uptrend passes all seven rules without a comparison universe", () => {
  const v = trendValues(history());
  expect(Object.values(trendRules(v)).map((r) => r.pass)).toEqual(Array(7).fill(true));
  expect(v.sma200).toBe(319.5);
  expect(v.sma200Prior).toBe(297.5);
  expect(v.sma200StrongPrior).toBe(214.5);
  expect(v.high52).toBe(420);
  expect(v.low52).toBe(167);
});
test("Downtrend fails all seven rules", () => {
  expect(Object.values(trendRules(trendValues(history(320, true)))).map((r) => r.pass)).toEqual(
    Array(7).fill(false),
  );
});
test("Too short and missing OHLCV produce null rules", () => {
  for (const bars of [
    [],
    history(259),
    history().map((b, i) => (i === 50 ? { ...b, volume: NaN } : b)),
  ]) {
    expect(Object.values(trendRules(trendValues(bars))).map((r) => r.pass)).toEqual(
      Array(7).fill(null),
    );
    expect(vcpAnalysis(bars).contractionsShrinking).toBe(null);
  }
});
test("Only TT2 fails when SMA150 is below SMA200 and other conditions pass", () => {
  const values = {
    close: 150,
    sma50: 140,
    sma150: 120,
    sma200: 130,
    sma200Prior: 125,
    sma200StrongPrior: 110,
    low52: 100,
    high52: 160,
  };
  expect(Object.values(trendRules(values)).map((r) => r.pass)).toEqual([
    true,
    false,
    true,
    true,
    true,
    true,
    true,
  ]);
});
test("TT6 and TT7 include equality, strict MA comparisons do not", () => {
  const values = trendValues(history());
  expect(trendRules({ ...values, close: 130, low52: 100 }).TT6.pass).toBe(true);
  expect(trendRules({ ...values, close: 129.99, low52: 100 }).TT6.pass).toBe(false);
  expect(trendRules({ ...values, close: 150, high52: 200 }).TT7.pass).toBe(true);
  expect(trendRules({ ...values, close: 149.99, high52: 200 }).TT7.pass).toBe(false);
  expect(trendRules({ ...values, close: values.sma50 }).TT5.pass).toBe(false);
  expect(trendRules({ ...values, sma200Prior: values.sma200 }).TT3.pass).toBe(false);
});
test("105-bar SMA200 comparison is unavailable until bar 305", () => {
  expect(trendValues(history(260)).sma200StrongPrior).toBe(null);
  expect(trendValues(history(304)).sma200StrongPrior).toBe(null);
  expect(trendValues(history(305)).sma200StrongPrior).toBe(199.5);
});
test("Confirmed VCP swings yield shrinking depths and unconfirmed tail is ignored", () => {
  const bars = history();
  // Unique highs/lows separated by more than five neighbors.
  const points = [
    [0, 95],
    [7, 100],
    [18, 80],
    [30, 98],
    [42, 90],
    [54, 96],
    [64, 94],
  ];
  for (let i = 0; i < 65; i++) {
    let j = 0;
    while (j + 1 < points.length - 1 && points[j + 1][0] < i) j++;
    const [x, y] = points[j];
    const [nx, ny] = points[j + 1];
    const close = y + ((ny - y) * (i - x)) / (nx - x);
    Object.assign(bars[bars.length - 65 + i], {
      open: close,
      close,
      high: close,
      low: close,
      volume: i >= 55 ? 100 : 1000,
    });
  }
  const result = vcpAnalysis(bars);
  expect(result.contractionDepths).toHaveLength(2);
  expect(result.contractionDepths?.[0]).toBeCloseTo(0.2, 12);
  expect(result.contractionDepths?.[1]).toBeCloseTo(8 / 98, 12);
  expect(result.contractionsShrinking).toBe(true);
  expect(result.volumeDryUp).toBe(true);
  expect(vcpAnalysis(history()).volumeDryUp).toBe(false);
});
function baseFixture(pivot = 110): TechnicalBar[] {
  const bars = history();
  for (let i = bars.length - 66; i < bars.length; i++)
    Object.assign(bars[i], { open: 125, high: 126, low: 124, close: 125, volume: 1000 });
  Object.assign(bars[bars.length - 61], { open: 155, high: 160, low: 154, close: 155 });
  Object.assign(bars[bars.length - 41], { open: 102, high: 103, low: 100, close: 102 });
  for (let i = bars.length - 11; i < bars.length - 1; i++)
    Object.assign(bars[i], {
      open: pivot - 1,
      high: pivot,
      low: pivot - 2,
      close: pivot - 1,
      volume: 100,
    });
  Object.assign(bars[bars.length - 1], {
    open: pivot - 1,
    high: pivot + 3,
    low: pivot - 1,
    close: pivot + 2,
    volume: 2000,
  });
  return bars;
}
test("Prior-bar pause yields low/middle/upper-third entries and exact pivot/stop", () => {
  for (const [pivot, type] of [
    [110, "Low cheat"],
    [130, "Cheat"],
    [150, "Classic pivot"],
  ] as const) {
    const entry = entryAnalysis(baseFixture(pivot));
    expect(entry.entryType).toBe(type);
    expect(entry.entryPivot).toBe(pivot);
    expect(entry.entryStop).toBe(pivot - 2);
    expect(entry.baseHigh).toBe(160);
    expect(entry.baseLow).toBe(100);
    expect(entry.pauseBars).toBe(10);
    expect(entry.riskPct).toBeCloseTo(2 / pivot, 12);
    expect(entry.pctFromPivot).toBeCloseTo(2 / pivot, 12);
    expect(entry.breakoutToday).toBe(true);
    expect(entry.stopTooWide).toBe(false);
  }
});
test("Third boundaries classify equality into Cheat and Classic pivot", () => {
  expect(entryAnalysis(baseFixture(120)).entryType).toBe("Cheat");
  expect(entryAnalysis(baseFixture(140)).entryType).toBe("Classic pivot");
});
test("Quality flags do not hide price levels or filter classification", () => {
  const bars = baseFixture();
  for (let i = bars.length - 11; i < bars.length - 1; i++) bars[i].low = 95;
  const result = entryAnalysis(bars);
  expect(result.entryPivot).toBe(110);
  expect(result.entryStop).toBe(95);
  expect(result.isTight).toBe(false);
  expect(result.stopTooWide).toBe(true);
  expect(result.entryType).toBe("none");
  expect(result.pauseContainsBaseLow).toBe(true);
  const loose = baseFixture();
  for (let i = loose.length - 11; i < loose.length - 1; i++) loose[i].low = 102;
  expect(entryAnalysis(loose).entryType).toBe("Low cheat");
  expect(entryAnalysis(loose).isTight).toBe(false);
  for (const bar of loose) bar.volume = 1000;
  expect(entryAnalysis(loose).volumeQuiet).toBe(false);
  expect(entryAnalysis(loose).entryPivot).toBe(110);
});
test("N+1 bars suffice for levels even without trend or base history", () => {
  expect(entryAnalysis(history(10)).entryPivot).toBeNull();
  const result = entryAnalysis(history(11));
  expect(result.entryPivot).toBe(110);
  expect(result.entryStop).toBe(99);
  expect(result.entryType).toBeNull();
  expect(result.volumeQuiet).toBeNull();
  expect(result.breakoutPriceOnly).toBe(false);
  const bars = history(11);
  Object.assign(bars[10], { high: 999, low: 1, close: 111 });
  expect(entryAnalysis(bars).entryPivot).toBe(110);
  expect(entryAnalysis(bars).entryStop).toBe(99);
  expect(entryAnalysis(bars).breakoutPriceOnly).toBe(true);
  expect(entryAnalysis(bars).breakoutToday).toBeNull();
});
test("Breakout requires close above pivot and qualifying signal volume", () => {
  const lowVolume = baseFixture();
  lowVolume[lowVolume.length - 1].volume = 100;
  expect(entryAnalysis(lowVolume).entryType).toBe("Low cheat");
  expect(entryAnalysis(lowVolume).breakoutToday).toBe(false);
  const equality = baseFixture();
  equality[equality.length - 1].close = 110;
  expect(entryAnalysis(equality).breakoutToday).toBe(false);
  const newHigh = baseFixture(158);
  newHigh[newHigh.length - 1].close = 162;
  newHigh[newHigh.length - 1].high = 163;
  expect(entryAnalysis(newHigh).baseHigh).toBe(160);
  expect(entryAnalysis(newHigh).breakoutToday).toBe(true);
});
test("Fixed window never shortens to improve quality; N is configurable", () => {
  const bars = baseFixture();
  for (let i = bars.length - 11; i < bars.length - 6; i++) bars[i].high = 140;
  expect(entryAnalysis(bars).pauseBars).toBe(10);
  expect(entryAnalysis(bars).entryPivot).toBe(140);
  expect(entryAnalysis(bars).isTight).toBe(false);
  const shorter = entryAnalysis(bars, { ...MINERVINI_DEFAULTS, pivotLookbackBars: 5 });
  expect(shorter.pauseBars).toBe(5);
  expect(shorter.entryPivot).toBe(110);
});
test("AAPL-like pullback retains 348.15 pivot and separates price/volume breakout", () => {
  const bars = baseFixture();
  for (const bar of bars.slice(-66))
    Object.assign(bar, { open: 330, close: 330, high: 331, low: 329, volume: 1000 });
  const highs = [341.57, 338.61, 342.63, 348.15, 347.09, 347.85, 347.82, 346, 343.06, 345.25];
  const lows = [335.9, 330.7, 337.6, 340.74, 341.72, 341.6, 340.46, 340.12, 338.7, 338.83];
  highs.forEach((high, i) => {
    Object.assign(bars[bars.length - 11 + i], {
      high,
      low: lows[i],
      open: (high + lows[i]) / 2,
      close: (high + lows[i]) / 2,
    });
  });
  const signal = bars[bars.length - 1];
  Object.assign(signal, { open: 344, high: 348.36, low: 342.28, close: 348.22 });
  for (const volume of [1000, 2000]) {
    signal.volume = volume;
    const result = entryAnalysis(bars);
    expect(result.entryPivot).toBe(348.15);
    expect(result.entryStop).toBe(330.7);
    expect(result.baseHigh).toBe(348.15);
    expect(result.baseLow).toBe(338.7);
    expect(result.pauseContainsBaseLow).toBe(true);
    expect(result.entryType).toBe("none");
    expect(result.entryReason).toBe("still in pullback, no tight area yet");
    expect(result.breakoutPriceOnly).toBe(true);
    expect(result.pctFromPivot).toBeCloseTo(0.07 / 348.15, 12);
    expect(result.breakoutToday).toBe(volume === 2000);
  }
});
test("A single symbol can pass all seven rules without RS fields", () => {
  const row = evaluateMinerviniUniverse([{ symbol: "ONE", bars: history() }])[0];
  expect(row.passCount).toBe(7);
  expect(Object.keys(row.rules)).toEqual(["TT1", "TT2", "TT3", "TT4", "TT5", "TT6", "TT7"]);
  expect("rsScore" in row).toBe(false);
  expect("rsPercentile" in row).toBe(false);
  expect("rsUniverse" in row).toBe(false);
  expect(row.allPass).toBe(true);
  expect(row.sma200RisingStrong).toBe(true);
  const missing = evaluateMinerviniUniverse([{ symbol: "MISSING", bars: [] }])[0];
  expect(missing.passCount).toBe(0);
  expect(Object.values(missing.rules).every((r) => r.pass === null)).toBe(true);
});

test("Other symbols and missing histories cannot change qualification", () => {
  const target = { symbol: "TARGET", bars: history() };
  const alone = evaluateMinerviniUniverse([target])[0];
  const together = evaluateMinerviniUniverse([
    target,
    { symbol: "MISSING", bars: [] },
    { symbol: "DOWN", bars: history(320, true) },
  ])[0];
  expect(together).toEqual(alone);
  expect(alone.allPass).toBe(true);
});

test("Entry reasons explain classification separately from available prices", () => {
  expect(entryAnalysis(history()).entryReason).toContain("No completed pullback");
  const falling = baseFixture();
  falling[falling.length - 1].low = 99;
  expect(entryAnalysis(falling).entryReason).toContain("breached the base low");
  expect(entryAnalysis(falling).entryPivot).toBe(110);
  expect(entryAnalysis(falling).entryStop).toBe(108);
  expect(entryAnalysis(baseFixture()).entryReason).toContain("separate quality flags");
  expect(entryAnalysis(history(10)).entryReason).toContain("11 valid bars");
});
