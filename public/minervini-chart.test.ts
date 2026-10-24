import { expect, test } from "bun:test";
import { minerviniChartLevels, selectMinerviniChart } from "./minervini-chart";

test("Minervini chart lines are labeled, scoped to the selected symbol, and clearable", () => {
  selectMinerviniChart({
    symbol: "TEST",
    date: "2026-10-20",
    entryPivot: 100,
    entryStop: 96,
    baseHigh: 110,
    baseLow: 80,
  });
  const lines = minerviniChartLevels("TEST");
  expect(lines).toHaveLength(4);
  expect(lines.map((line) => line.price)).toEqual([100, 96, 110, 80]);
  expect(lines.every((line) => line.title.includes("2026-10-20") && line.axisLabelVisible)).toBe(
    true,
  );
  expect(minerviniChartLevels("OTHER")).toEqual([]);
  selectMinerviniChart(null);
  expect(minerviniChartLevels("TEST")).toEqual([]);
});
