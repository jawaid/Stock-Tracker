import { describe, expect, test } from "bun:test";
import { buildTechnicalAnalysis, classifyHeadlineSentiment } from "./analyze";

describe("stock analysis", () => {
  test("classifies positive, negative, and neutral headlines", () => {
    expect(classifyHeadlineSentiment("Company beats estimates and raises outlook").tone).toBe(
      "positive",
    );
    expect(classifyHeadlineSentiment("Shares fall after weak warning").tone).toBe("negative");
    expect(classifyHeadlineSentiment("Company schedules annual meeting").tone).toBe("neutral");
  });

  test("recognizes bullish EMA alignment", () => {
    const candles = Array.from({ length: 30 }, (_, index) => ({
      close: 101 + index,
      high: 102 + index,
      low: 100 + index,
      volume: 1_000 + index,
    }));
    const result = buildTechnicalAnalysis({
      candles,
      price: 140,
      ema21: 130,
      ema50: 120,
      ema200: 100,
      ema21FiveSessionsAgo: 127,
      ema50FiveSessionsAgo: 119,
      ema200FiveSessionsAgo: 99,
    });

    expect(result.stance).toBe("Bullish");
    expect(result.tone).toBe("positive");
    expect(result.emas.priceVsEma200Percent).toBe(40);
    expect(result.support20).toBe(110);
    expect(result.resistance20).toBe(131);
  });
});
