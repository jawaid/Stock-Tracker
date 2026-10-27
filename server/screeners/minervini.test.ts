import { expect, test } from "bun:test";
import {
  evaluateMinerviniUniverse,
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
  for (const bars of [[], history().map((b, i) => (i === 50 ? { ...b, volume: NaN } : b))]) {
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
test("A single symbol passes seven rules without RS or benchmark data", () => {
  const row = evaluateMinerviniUniverse([{ symbol: "ONE", bars: history() }])[0];
  expect(row.passCount).toBe(7);
  expect(Object.keys(row.rules)).toEqual(["TT1", "TT2", "TT3", "TT4", "TT5", "TT6", "TT7"]);
  expect("rsScore" in row).toBe(false);
  expect("rsPercentile" in row).toBe(false);
  expect("rsUniverse" in row).toBe(false);
  expect("rsRating" in row).toBe(false);
  expect("rsSource" in row).toBe(false);
  expect("ttStatus" in row).toBe(false);
  expect(row.allPass).toBe(true);
  expect(row.sma200RisingStrong).toBe(true);
  const missing = evaluateMinerviniUniverse([{ symbol: "MISSING", bars: [] }])[0];
  expect(missing.passCount).toBe(0);
  expect(Object.values(missing.rules).every((r) => r.pass === null)).toBe(true);
});

test("Other symbols cannot change qualification or VCP results", () => {
  const target = { symbol: "TARGET", bars: history() };
  const alone = evaluateMinerviniUniverse([target])[0];
  const together = evaluateMinerviniUniverse([
    target,
    { symbol: "MISSING", bars: [] },
    { symbol: "DOWN", bars: history(320, true) },
  ])[0];
  for (const key of ["TT1", "TT2", "TT3", "TT4", "TT5", "TT6", "TT7"] as const)
    expect(together.rules[key]).toEqual(alone.rules[key]);
  expect(together).toEqual(alone);
  expect(alone.allPass).toBe(true);
});

test("IPO histories still evaluate available rules; status belongs in existing Data Status", () => {
  const row = evaluateMinerviniUniverse([{ symbol: "IPO", bars: history(200) }])[0];
  expect(row.dataStatus).toBe("IPO – partial TT");
  expect(row.error).toBeNull();
  expect(row.rules.TT1.pass).toBe(true);
  expect(row.rules.TT3.pass).toBeNull();
  expect(row.rules.TT6.pass).toBeNull();
  expect(row.rules.TT7.pass).toBeNull();
  expect(row.allPass).toBe(false);
});
