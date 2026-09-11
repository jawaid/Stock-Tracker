import { expect, test } from "bun:test";
import { buildTradeIdeas, type IdeaAnalysis } from "./trade-ideas";

const now = Date.parse("2026-09-10T21:00:00Z");
function fixture(price = 100, center = 100, ema = 98): IdeaAnalysis {
  return {
    security: { symbol: "TEST", price, updatedAt: "2026-09-10T20:00:00Z" },
    technical: {
      rsi14: 55,
      volumeVsAverage: 125,
      emas: { ema21: ema, ema50: ema - 5, ema200: ema - 10, ema21TrendPercent: 1 },
    },
    chart: {
      candles: Array.from({ length: 22 }, (_, i) => ({
        high: i === 21 ? price + 1 : center + 2,
        low: i === 21 ? price - 1 : center - 2,
        close: i === 21 ? price : center,
      })),
    },
  };
}
test("breakout uses prior resistance and a labeled 2R planning target", () => {
  const r = buildTradeIdeas(fixture(), now);
  const idea = r.ideas[0];
  expect(idea?.name).toContain("Breakout");
  expect(idea?.entryLow).toBeCloseTo(102.4);
  expect(idea?.stop).toBe(98);
  expect(idea?.rewardRisk).toBeCloseTo(2);
  expect(idea?.targetLabel).toContain("not a forecast");
});
test("pullback is suggested only with room to resistance", () => {
  const r = buildTradeIdeas(fixture(104, 110, 103), now);
  const idea = r.ideas.find((i) => i.name.includes("Pullback"));
  expect(idea?.entryLow).toBe(103);
  expect(idea?.target).toBe(112);
  expect(idea?.rewardRisk).toBeCloseTo(1.6);
  expect(buildTradeIdeas(fixture(), now).ideas.some((i) => i.name.includes("Pullback"))).toBe(
    false,
  );
});
test("does not force ideas in weak, extended, stale or incomplete conditions", () => {
  const weak = fixture();
  if (weak.technical?.emas) weak.technical.emas.ema21TrendPercent = -1;
  expect(buildTradeIdeas(weak, now).ideas).toEqual([]);
  const extended = fixture();
  if (extended.technical) extended.technical.rsi14 = 80;
  expect(buildTradeIdeas(extended, now).reason).toContain("extended");
  expect(buildTradeIdeas(fixture(), now + 6 * 86400000).ideas).toEqual([]);
  expect(buildTradeIdeas({}, now).ideas).toEqual([]);
  const short = fixture();
  short.chart = { candles: [] };
  expect(buildTradeIdeas(short, now).reason).toContain("20 valid");
});
test("latest candle does not move the breakout reference", () => {
  const data = fixture();
  if (data.chart?.candles) data.chart.candles[21] = { high: 500, low: 90, close: 100 };
  expect(buildTradeIdeas(data, now).ideas[0]?.entryLow).toBeCloseTo(102.4);
});
test("missing volume remains an explicit confirmation requirement", () => {
  const data = fixture();
  if (data.technical) delete data.technical.volumeVsAverage;
  const r = buildTradeIdeas(data, now);
  expect(r.notes.join(" ")).toContain("Volume data is unavailable");
  expect(r.ideas[0]?.trigger).toContain("volume above");
});
test("invalid prior candles and no volatility produce wait", () => {
  const data = fixture();
  if (data.chart?.candles) data.chart.candles[5] = { high: 90, low: 100, close: 95 };
  expect(buildTradeIdeas(data, now).ideas).toEqual([]);
  const flat = fixture();
  flat.chart = { candles: Array.from({ length: 22 }, () => ({ high: 100, low: 100, close: 100 })) };
  expect(buildTradeIdeas(flat, now).reason).toContain("too small");
});
