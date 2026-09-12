import { expect, test } from "bun:test";
import { breadthSignal, buildBreadthPosture } from "./breadth-posture";

test("signal follows the requested B20/B50 direction table", () => {
  const baseline = { date: "2026-09-01", above20: 50, above50: 50 };
  for (const [b20, b50, label] of [
    [51, 51, "🟢 Bullish breadth expansion"],
    [51, 50, "🟡 Early improvement"],
    [51, 49, "🟡 Early improvement"],
    [49, 51, "🟡 Short-term deterioration"],
    [49, 50, "🟡 Short-term deterioration"],
    [49, 49, "🔴 Breadth deterioration"],
    [50, 50, "🟡 Flat breadth"],
    [50, 51, "🟡 Mixed breadth"],
    [50, 49, "🟡 Mixed breadth"],
  ] as const)
    expect(breadthSignal({ ...baseline, above20: b20, above50: b50 }, baseline).label).toBe(label);
  expect(breadthSignal(baseline).label).toBe("Breadth signal unavailable");
  expect(breadthSignal({ ...baseline, above20: null }, baseline).label).toBe(
    "Breadth signal unavailable",
  );
});

const series = (start: number, step: number) =>
  Array.from({ length: 13 }, (_, i) => ({
    date: `2026-09-${String(i + 1).padStart(2, "0")}`,
    above20: start + i * step,
    above50: start + i * step,
    valid20: 503,
    valid50: 503,
  }));
test("pre excludes same-day and future data; post requires matching completed date", () => {
  const data = series(45, 2);
  expect(buildBreadthPosture(data, "2026-09-13", "pre").date).toBe("2026-09-12");
  expect(buildBreadthPosture(data, "2026-09-12", "post").date).toBe("2026-09-12");
  expect(buildBreadthPosture(data, "2026-09-14", "post").date).toBeNull();
  expect(buildBreadthPosture(data, "2026-09-21", "pre").date).toBeNull();
});
test("uses existing chart values without posture scoring or coverage thresholds", () => {
  const data = series(60, -3);
  data[12].above20 = 24.65;
  data[12].above50 = 38.77;
  data[12].valid20 = 300;
  const result = buildBreadthPosture(data, "2026-09-13", "post");
  expect(result.readings[0]).toContain("24.65%");
  expect(result.readings[1]).toContain("38.77%");
  expect(result).not.toHaveProperty("posture");
  expect(result).not.toHaveProperty("rules");
});
test("short and partial history still displays available existing values", () => {
  const data = [{ date: "2026-09-13", above20: 24.65, above50: null }];
  const result = buildBreadthPosture(data, "2026-09-13", "post");
  expect(result.readings[0]).toContain("24.65%");
  expect(result.readings[1]).toContain("unavailable");
  expect(buildBreadthPosture([], null, "pre").date).toBeNull();
});
