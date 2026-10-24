import { expect, test } from "bun:test";
import { evaluateMinerviniUniverse } from "../server/screeners/minervini";
import { minerviniCell, minerviniDisplay, sortMinervini } from "./minervini-results";

test("Default sort prioritizes all-pass, count, then absolute pivot distance; missing is last", () => {
  const empty = evaluateMinerviniUniverse([{ symbol: "EMPTY", bars: [] }])[0];
  const a = {
    ...empty,
    symbol: "A",
    allPass: true,
    passCount: 7,
    entry: { ...empty.entry, pctFromPivot: 0.1 },
  };
  const b = { ...empty, symbol: "B", passCount: 6, entry: { ...empty.entry, pctFromPivot: -0.02 } };
  const c = { ...b, symbol: "C", entry: { ...b.entry, pctFromPivot: 0.01 } };
  expect(sortMinervini([empty, b, a, c]).map((r) => r.symbol)).toEqual(["A", "C", "B", "EMPTY"]);
  expect(minerviniCell(empty, "TT1")).toBe(null);
  expect(minerviniCell(empty, "depths")).toBe(null);
});

test("Entry pivot/stop distinguish no setup, missing history, and numeric levels", () => {
  const missing = evaluateMinerviniUniverse([{ symbol: "SHORT", bars: [] }])[0];
  const noSetup = {
    ...missing,
    entry: { ...missing.entry, entryType: "none" as const, entryReason: "Pause range exceeds 5%." },
  };
  for (const key of ["entryPivot", "entryStop"]) {
    expect(minerviniDisplay(missing, key)).toBe("Insufficient data");
    expect(minerviniDisplay(noSetup, key)).toBe("No setup");
  }
  expect(minerviniDisplay(noSetup, "riskPct")).toBe("Not applicable");
  expect(minerviniDisplay(noSetup, "baseLow")).toBe("Not formed");
  expect(minerviniDisplay(noSetup, "entryReason")).toBe("Pause range exceeds 5%.");
  const qualified = {
    ...noSetup,
    entry: { ...noSetup.entry, entryType: "Cheat" as const, entryPivot: 100, entryStop: 97 },
  };
  expect(minerviniDisplay(qualified, "entryPivot")).toBe("100.00");
  expect(minerviniDisplay(qualified, "entryStop")).toBe("97.00");
  const legacy = { ...noSetup, entry: { ...noSetup.entry, entryReason: undefined } };
  expect(minerviniDisplay(legacy, "entryReason")).toBe("No qualifying entry setup.");
});
