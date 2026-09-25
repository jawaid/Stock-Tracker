import { expect, test } from "bun:test";
import { buildChatGPTPrompt, buildChatGPTPromptInstructions } from "./chatgpt-prompt";

test("prompt uses selected stock and excludes unrelated account data", () => {
  const data = {
    security: { symbol: "TEST", price: 100, updatedAt: "2026-09-11T15:00:00Z" },
    positions: "PRIVATE HOLDINGS",
    budget: "PRIVATE BUDGET",
    chart: {
      candles: Array.from({ length: 80 }, () => ({ high: 101, low: 99, close: 100, volume: 123 })),
    },
  };
  const prompt = buildChatGPTPrompt(data, Date.parse("2026-09-11T16:00:00Z"));
  expect(prompt).toContain('"symbol": "TEST"');
  expect(prompt).not.toContain("PRIVATE");
  expect(prompt.match(/"close": 100/g)).toHaveLength(60);
  expect(prompt).toContain("2026-09-11T15:00:00Z");
  expect(prompt).toContain("No chart image is included");
  expect(prompt).toContain("Rising 21 EMA + price within one ATR of the 21 EMA");
  expect(prompt).not.toContain("assume my holdings");
  expect(prompt).not.toContain("Current fundamentals");
  expect(prompt).not.toContain("Latest news and events");
  expect(prompt).toContain("Buy, Hold, or Sell");
  expect(prompt).toContain("next buy price");
  expect(prompt).toContain("completed bullish reversal is still required");
  expect(prompt).toContain("recovered above it on a bullish candle");
});

test("prompt uses configurable app-wide entry setups in neutral language", () => {
  const prompt = buildChatGPTPrompt({ security: { symbol: "TEST", price: 100 } }, 0, {
    promptText: `${"Custom entry framework. ".repeat(4)}Current app-detected condition: {{currentCondition}}`,
  });
  expect(prompt).toContain("Custom entry framework");
  expect(prompt).toContain("Current app-detected condition:");
  expect(prompt).not.toContain("I may attach");
});

test("settings preview contains the full instruction set but no stock-specific snapshot", () => {
  const preview = buildChatGPTPromptInstructions({
    promptText: `${"Review both configured setups. ".repeat(4)}Current: {{currentCondition}}`,
  });
  expect(preview).toContain("Review both configured setups.");
  expect(preview).toContain("Calculated from the selected stock");
  expect(preview).not.toContain('"recentDailyCandles"');
});

test("prompt identifies the current pullback and reclaim conditions separately", () => {
  const bars = Array.from({ length: 21 }, (_, index) => ({
    open: 100,
    high: index === 2 ? 110 : 101,
    low: 99,
    close: 100,
    volume: 100,
  }));
  const common = {
    security: { symbol: "TEST", price: 100.2, updatedAt: "1970-01-01T00:00:00.000Z" },
    technical: { rsi14: 50, emas: { ema21: 100, ema50: 99, ema200: 98, ema21TrendPercent: 1 } },
    chart: { candles: bars },
  };
  expect(buildChatGPTPrompt(common, 0)).toContain("Setup 1 — rising 21 EMA pullback");
  const reclaimBars = bars.map((bar) => ({ ...bar }));
  reclaimBars[18].close = 99;
  reclaimBars[20] = { open: 99, high: 102, low: 98, close: 101, volume: 100 };
  expect(
    buildChatGPTPrompt(
      { ...common, security: { ...common.security, price: 101 }, chart: { candles: reclaimBars } },
      0,
    ),
  ).toContain("Setup 2 — reclaim/reversal");
});
test("missing and invalid indicators remain unavailable", () => {
  const prompt = buildChatGPTPrompt({ technical: { rsi14: NaN } }, 0);
  expect(prompt).toContain('"rsi14": null');
  expect(prompt).toContain('"priceAsOf": "Unavailable"');
  expect(prompt).toContain("A recent, valid price is required");
});
