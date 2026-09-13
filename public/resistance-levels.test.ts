import { expect, test } from "bun:test";
import { significantResistance } from "./resistance-levels";

function history() {
  return Array.from({ length: 210 }, (_, i) => ({
    time: new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10),
    high: 100,
    low: 95,
    close: 98,
  }));
}
test("keeps two nearest confirmed overhead highs and their original dates", () => {
  const bars = history();
  bars[30].high = 125;
  bars[90].high = 115;
  bars[150].high = 110;
  expect(significantResistance(bars)).toEqual([
    { time: bars[150].time, price: 110 },
    { time: bars[90].time, price: 115 },
  ]);
});
test("excludes broken levels, minor peaks, and unconfirmed recent highs", () => {
  const bars = history();
  bars[30].high = 110;
  bars[90] = { ...bars[90], high: 115, close: 112 };
  bars[205].high = 120;
  expect(significantResistance(bars)).toEqual([{ time: bars[90].time, price: 115 }]);
  const shallow = history().map((b) => ({ ...b, low: 99, close: 100 }));
  shallow[90].high = 102;
  expect(significantResistance(shallow)).toEqual([]);
});
test("clusters nearby levels and does not infer resistance from invalid history", () => {
  const bars = history();
  bars[30].high = 110.5;
  bars[90].high = 110;
  expect(significantResistance(bars)).toEqual([{ time: bars[90].time, price: 110 }]);
  bars[0].high = NaN;
  expect(significantResistance(bars)).toEqual([]);
  expect(significantResistance([])).toEqual([]);
});
