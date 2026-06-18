import { describe, expect, test } from "bun:test";
import {
  calculateEma,
  calculateEmaSeries,
  calculateParticipationHistory,
  isAboveSma,
  percentChange,
  validChartEntries,
} from "./indicators";

describe("indicator helpers", () => {
  test("calculates EMA values from finite inputs", () => {
    expect(calculateEma([1, 2, 3, 4, 5], 3)).toBe(4);
    expect(calculateEmaSeries([1, 2, 3, 4, 5], 3)).toEqual([null, null, 2, 3, 4]);
  });

  test("calculates percentage changes with invalid guards", () => {
    expect(percentChange(110, 100)).toBe(10);
    expect(percentChange(110, 0)).toBeNull();
    expect(percentChange(null, 100)).toBeNull();
  });

  test("filters chart entries and compares SMA state", () => {
    expect(validChartEntries([1, 2, 3], [10, null, "12"])).toEqual([
      { timestamp: 1, value: 10 },
      { timestamp: 3, value: 12 },
    ]);
    expect(isAboveSma([1, 2, 3], 3)).toBe(true);
  });

  test("calculates historical participation above multiple moving averages", () => {
    const start = 1_700_000_000;
    const timestamps = [0, 1, 2, 3].map((day) => start + day * 86_400);
    const history = calculateParticipationHistory(
      new Map([
        ["UP", { timestamps, closes: [1, 2, 3, 4] }],
        ["DOWN", { timestamps, closes: [4, 3, 2, 1] }],
      ]),
      [2, 3],
      10,
    );

    expect(history.periods).toEqual([2, 3]);
    expect(history.points).toHaveLength(3);
    expect(history.points[0].above2).toBe(50);
    expect(history.points[0].above3).toBeNull();
    expect(history.points[2].above2).toBe(50);
    expect(history.points[2].above3).toBe(50);
    expect(history.points[2].valid3).toBe(2);
  });
});
