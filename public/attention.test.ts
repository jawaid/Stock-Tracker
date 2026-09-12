import { expect, test } from "bun:test";
import { positionAttention, recentPrice, watchAttention } from "./attention";

const now = Date.parse("2026-09-11T18:00:00Z");
const updatedAt = new Date(now).toISOString();
test("missing stops appear without quotes and for partially covered lots", () => {
  const result = positionAttention(
    [
      { ticker: "TEST", stopLossPerShare: 90 },
      { ticker: "TEST", stopLossPerShare: null },
    ],
    {},
    now,
  );
  expect(result.items.map((item) => item.title)).toEqual(["Missing stop"]);
  expect(result.items[0].updatedAt).toBe("");
  expect(positionAttention([{ ticker: "TEST", stopLossPerShare: 90 }], {}, now).items).toEqual([]);
});
test("attention excludes quotes for securities without an open position and removes closed positions", () => {
  const quotes = {
    HELD: { price: 100, ema21: 110, updatedAt },
    WATCH: { price: 100, ema21: 110, updatedAt },
  };
  expect(
    positionAttention([{ ticker: "HELD", stopLossPerShare: 90 }], quotes, now).items.map(
      (item) => item.ticker,
    ),
  ).toEqual(["HELD"]);
  expect(positionAttention([], quotes, now).items).toEqual([]);
});
test("stop priority, boundary, multiple lots and trend are explicit", () => {
  const result = positionAttention(
    [
      { ticker: "ABC", stopLossPerShare: 90 },
      { ticker: "ABC", stopLossPerShare: 98 },
    ],
    { ABC: { price: 100, ema21: 101, updatedAt } },
    now,
  );
  expect(result.items.map((i) => i.title)).toEqual(["Near stop", "Below 21-day EMA"]);
  expect(result.items[0].reason).toContain("2.00%");
  expect(
    positionAttention(
      [{ ticker: "ABC", stopLossPerShare: 100 }],
      { ABC: { price: 100, updatedAt } },
      now,
    ).items[0].priority,
  ).toBe(0);
  expect(
    positionAttention(
      [{ ticker: "ABC", stopLossPerShare: 97.99 }],
      { ABC: { price: 100, ema21: 99, updatedAt } },
      now,
    ).items,
  ).toHaveLength(0);
});
test("missing, invalid and stale data cannot produce reassuring coverage", () => {
  const result = positionAttention(
    [{ ticker: "ABC" }],
    { ABC: { price: 100, updatedAt: "2020-01-01" } },
    now,
  );
  expect(result.unavailable).toBe(1);
  expect(result.missingStops).toBe(1);
  expect(result.items.map((item) => item.title)).toEqual(["Missing stop"]);
  expect(recentPrice(NaN, updatedAt, now)).toBe(false);
  expect(recentPrice(100, new Date(now + 600000).toISOString(), now)).toBe(false);
  expect(watchAttention("ABC", {}, now)).toEqual([]);
});
test("watchlist opportunities use chart rules and require proximity", () => {
  const data = {
    security: { price: 109.5, updatedAt },
    technical: { rsi14: 55, emas: { ema21: 106, ema50: 100, ema200: 90, ema21TrendPercent: 1 } },
    chart: { candles: Array.from({ length: 21 }, () => ({ high: 110, low: 108, close: 109 })) },
  };
  expect(watchAttention("ABC", data, now).some((i) => i.title.startsWith("Breakout"))).toBe(true);
  expect(
    watchAttention("ABC", { ...data, security: { price: 107, updatedAt } }, now).some((i) =>
      i.title.startsWith("Breakout"),
    ),
  ).toBe(false);
  expect(
    watchAttention("ABC", { ...data, technical: { ...data.technical, rsi14: 80 } }, now),
  ).toEqual([]);
});
