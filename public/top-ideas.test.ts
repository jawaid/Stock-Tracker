import { expect, test } from "bun:test";
import { rankTradeIdeas } from "./top-ideas";

const now = Date.parse("2026-09-11T18:00:00Z");
const data = {
  security: { price: 109.5, updatedAt: new Date(now).toISOString() },
  technical: { rsi14: 55, emas: { ema21: 106, ema50: 100, ema200: 90, ema21TrendPercent: 1 } },
  chart: { candles: Array.from({ length: 21 }, () => ({ high: 110, low: 108, close: 109 })) },
};
test("ranking limits results to five distinct symbols with stable ties", () => {
  const entries = ["G", "F", "E", "D", "C", "B", "A", "A"].map((symbol) => ({ symbol, data }));
  const result = rankTradeIdeas(entries, now);
  expect(result).toHaveLength(5);
  expect(new Set(result.map((i) => i.symbol)).size).toBe(5);
  expect(result.map((i) => i.symbol)).toEqual(["A", "B", "C", "D", "E"]);
});
test("ranking prefers higher reward/risk then closer entry and excludes stale or invalid setups", () => {
  const result = rankTradeIdeas(
    [
      { symbol: "FAR", data: { ...data, security: { ...data.security, price: 107 } } },
      { symbol: "NEAR", data },
    ],
    now,
  );
  expect(result[0].symbol).toBe("NEAR");
  for (let i = 1; i < result.length; i++)
    expect(result[i - 1].idea.rewardRisk).toBeGreaterThanOrEqual(result[i].idea.rewardRisk);
  expect(
    rankTradeIdeas(
      [
        {
          symbol: "OLD",
          data: { ...data, security: { ...data.security, updatedAt: "2020-01-01" } },
        },
        { symbol: "BAD", data: {} },
      ],
      now,
    ),
  ).toEqual([]);
  expect(rankTradeIdeas([{ symbol: "ONE", data }], now)).toHaveLength(1);
});
