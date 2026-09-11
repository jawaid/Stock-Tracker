import { expect, test } from "bun:test";
import { buildChatGPTPrompt } from "./chatgpt-prompt";

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
});
test("missing and invalid indicators remain unavailable", () => {
  const prompt = buildChatGPTPrompt({ technical: { rsi14: NaN } }, 0);
  expect(prompt).toContain('"rsi14": null');
  expect(prompt).toContain('"priceAsOf": "Unavailable"');
  expect(prompt).toContain("A recent, valid price is required");
});
