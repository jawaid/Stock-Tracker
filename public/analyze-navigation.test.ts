import { describe, expect, test } from "bun:test";
import { nextAnalyzeSymbol } from "./analyze-navigation";

describe("nextAnalyzeSymbol", () => {
  test("returns the next symbol in the displayed watch list order", () => {
    expect(nextAnalyzeSymbol(["MSFT", "AAPL", "NVDA"], "AAPL")).toBe("NVDA");
  });

  test("normalizes symbols before matching", () => {
    expect(nextAnalyzeSymbol([" msft ", "aapl"], "MSFT")).toBe("AAPL");
  });

  test("returns null at the end of the sequence", () => {
    expect(nextAnalyzeSymbol(["MSFT", "AAPL"], "AAPL")).toBeNull();
  });

  test("returns null when the current symbol is not in the sequence", () => {
    expect(nextAnalyzeSymbol(["MSFT", "AAPL"], "NVDA")).toBeNull();
  });
});
