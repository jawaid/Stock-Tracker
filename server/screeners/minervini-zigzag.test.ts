import { expect, test } from "bun:test";
import { percentageZigzag } from "./minervini-zigzag";

const bars = (prices: number[]) =>
  prices.map((price, i) => ({
    time: String(i),
    open: price,
    high: price,
    low: price,
    close: price,
    volume: 1,
  }));
test("zigzag confirms 3% reversals and uses latest tied extrema", () => {
  const swings = percentageZigzag(bars([90, 100, 100, 97, 90, 90, 92.7, 99, 96]));
  expect(swings.filter((s) => s.kind === "high").map((s) => [s.index, s.confirmedAt])).toEqual([
    [2, 3],
    [7, 8],
  ]);
  expect(swings.find((s) => s.kind === "low" && s.index === 5)?.confirmedAt).toBe(6);
});
test("new intrabar extremes do not invent a same-bar reversal", () => {
  const history = bars([90, 100]);
  history[1].low = 80;
  expect(percentageZigzag(history)).toEqual([]);
});
test("no future bars enter prefix swing confirmation", () => {
  const history = bars([100, 102, 101, 100, 98]);
  expect(percentageZigzag(history.slice(0, 4)).filter((s) => s.kind === "high")).toEqual([]);
  expect(percentageZigzag(history).find((s) => s.kind === "high")?.confirmedAt).toBe(4);
});
