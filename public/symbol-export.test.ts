import { describe, expect, test } from "bun:test";
import { symbolText } from "./symbol-export";

describe("symbolText", () => {
  test("exports only symbols in displayed order", () => {
    expect(symbolText([{ ticker: "GOOGL" }, { ticker: "EBAY" }, { ticker: "CRWV" }])).toBe(
      "GOOGL,EBAY,CRWV",
    );
  });

  test("removes duplicate and blank symbols without adding a header or newline", () => {
    expect(
      symbolText([{ ticker: " ANET " }, { ticker: "ANET" }, { ticker: "" }, { ticker: "APLD" }]),
    ).toBe("ANET,APLD");
  });
});
