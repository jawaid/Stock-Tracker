import { expect, test } from "bun:test";
import { evaluateMinerviniUniverse } from "../server/screeners/minervini";
import { appendBars, vcpFixture } from "../server/screeners/minervini-fixtures";
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

test("all depths remain visible with numbering; only forming null stops show pending", () => {
  const row = evaluateMinerviniUniverse([{ symbol: "TEST", bars: [] }])[0];
  row.vcp.contractionDepths = [0.04, 0.12, 0.03, 0.05, 0.04, 0.0632, 0.0482, 0.0403, 0.0318];
  expect(minerviniDisplay(row, "depths")).toBe(
    "9 total: #1 4.00%, #2 12.00%, #3 3.00%, #4 5.00%, #5 4.00%, #6 6.32%, #7 4.82%, #8 4.03%, #9 3.18%",
  );
  row.entry.pivotSource = "pause forming";
  expect(minerviniDisplay(row, "entryStop")).toBe("pending");
  row.entry.pivotSource = "new high";
  expect(minerviniDisplay(row, "entryStop")).toBe("pending");
  row.entry.entryStop = 97;
  expect(minerviniDisplay(row, "entryStop")).toBe("97.00");
});

test("buy-range label uses the latest breakout volume, including subsequent quiet bars", () => {
  const evaluate = (bars: ReturnType<typeof vcpFixture>) =>
    evaluateMinerviniUniverse([{ symbol: "TEST", bars }])[0];
  const lowVolume = appendBars(vcpFixture(), [97], 1);
  for (const bars of [lowVolume, appendBars(lowVolume, [97], 1)]) {
    const row = evaluate(bars);
    expect(row.entry.status).toBe("In buy range");
    expect(minerviniDisplay(row, "status")).toBe("In buy range – volume not confirmed");
  }
  const confirmed = appendBars(vcpFixture(), [97], 10000);
  expect(minerviniDisplay(evaluate(appendBars(confirmed, [97], 1)), "status")).toBe("In buy range");
  const failed = evaluate(appendBars(lowVolume, [96]));
  expect(minerviniDisplay(failed, "status")).toBe("Failed breakout");
  const rebreakout = appendBars(appendBars(confirmed, [96]), [97], 1);
  expect(minerviniDisplay(evaluate(appendBars(rebreakout, [97])), "status")).toBe(
    "In buy range – volume not confirmed",
  );
});
