import { describe, expect, test } from "bun:test";
import { classifyQqqRisk } from "./market-risk";

describe("QQQ risk gauge", () => {
  test("below the EMA is Risk-Off regardless of EMA trend", () => {
    for (const smaTrend of [0.29, 0, -0.29, null]) {
      expect(classifyQqqRisk({ price: 728.95, sma21: 740.69, smaTrend })).toEqual({
        status: "risk-off",
        label: "Risk-Off",
        detail: "Below 21 EMA",
      });
    }
  });

  test("above the EMA preserves the rising-trend requirement", () => {
    expect(classifyQqqRisk({ price: 101, sma21: 100, smaTrend: 1 }).status).toBe("risk-on");
    for (const smaTrend of [0, -1]) {
      expect(classifyQqqRisk({ price: 101, sma21: 100, smaTrend }).label).toBe("Mixed");
    }
    expect(classifyQqqRisk({ price: 101, sma21: 100, smaTrend: null }).status).toBe("unavailable");
  });

  test("exact equality stays Mixed and just below is Risk-Off", () => {
    expect(classifyQqqRisk({ price: 100, sma21: 100, smaTrend: 1 }).label).toBe("Mixed");
    expect(classifyQqqRisk({ price: 99.999, sma21: 100, smaTrend: 1 }).label).toBe("Risk-Off");
  });

  test("missing price or EMA remains unavailable", () => {
    for (const [price, sma21] of [
      [null, 100],
      [100, null],
      [null, null],
    ]) {
      expect(
        classifyQqqRisk({ price: price ?? null, sma21: sma21 ?? null, smaTrend: 1 }).status,
      ).toBe("unavailable");
    }
    expect(
      classifyQqqRisk({ price: null, sma21: null, smaTrend: null, error: "Provider unavailable" })
        .detail,
    ).toBe("Provider unavailable");
  });
});
