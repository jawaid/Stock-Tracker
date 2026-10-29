import { expect, test } from "bun:test";
import { MINERVINI_DEFAULTS as c, type TechnicalBar } from "./minervini";
import { appendBars, vcpFixture } from "./minervini-fixtures";
import { entryGeometry, geometryEntryType } from "./minervini-geometry";
import { walkForwardVcp } from "./minervini-vcp";

function series(prices: number[]): TechnicalBar[] {
  return prices.map((price, i) => ({
    time: new Date(Date.UTC(2026, 0, i + 1)).toISOString().slice(0, 10),
    open: price,
    high: price,
    low: price,
    close: price,
    volume: 100,
  }));
}
test("VSTS-like wide geometry labels a 15 pivot Cheat", () => {
  const bars = series([16.9, 14, 12.1, 14.5, 15]);
  const g = entryGeometry(bars, 4, 15, 150);
  expect(g).toMatchObject({ high: 16.9, highDate: bars[0].time, low: 12.1, lowDate: bars[2].time });
  expect(g?.position).toBeCloseTo((15 - 12.1) / (16.9 - 12.1), 10);
  expect(geometryEntryType(15, g)).toBe("Cheat");
});
test("lookback excludes an older high and includes its exact boundary", () => {
  const bars = series([100, 20, 15, 18]);
  expect(entryGeometry(bars, 3, 18, 2)?.high).toBe(20);
  expect(entryGeometry(bars, 3, 18, 3)?.high).toBe(100);
  const long = series([100, ...Array(150).fill(20), 18]);
  expect(entryGeometry(long, 151, 18, 150)?.high).toBe(20);
  expect(entryGeometry(long, 151, 18, 151)?.high).toBe(100);
});
test("geometry excludes pivot from highs, includes pivot in lows, and ignores later bars", () => {
  const bars = series([20, 18, 19, 25, 100]);
  bars[0].low = 1;
  bars[3].low = 16;
  bars[4].low = 2;
  const g = entryGeometry(bars, 3, 25, 150);
  expect(g).toMatchObject({ high: 20, highDate: bars[0].time, low: 16, lowDate: bars[3].time });
  expect(g).toEqual(entryGeometry(bars.slice(0, 4), 3, 25, 150));
  expect(geometryEntryType(25, g)).toBe("Classic pivot");
});
test("third boundaries, at-high override, equal extrema and missing geometry", () => {
  const bars = series([40, 10, 20]);
  for (const [pivot, label] of [
    [19.99, "Low cheat"],
    [20, "Cheat"],
    [29.99, "Cheat"],
    [30, "Classic pivot"],
    [40, "Classic pivot"],
    [41, "Classic pivot"],
  ] as const)
    expect(geometryEntryType(pivot, entryGeometry(bars, 2, pivot, 150))).toBe(label);
  const ties = series([20, 20, 10, 10, 15]);
  expect(entryGeometry(ties, 4, 15, 150)).toMatchObject({
    highDate: ties[1].time,
    lowDate: ties[3].time,
  });
  expect(entryGeometry(bars, 0, 40, 150)).toBeNull();
  expect(entryGeometry(bars, 2, 20, 0)).toBeNull();
  expect(geometryEntryType(20, null)).toBeNull();
  expect(geometryEntryType(20, entryGeometry(series([20, 20]), 1, 20, 150))).toBe("Classic pivot");
});
test("AAPL-like pivot above geometry high remains Classic, and No setup stays No setup", () => {
  const bars = series([335, 300, 351.73]);
  expect(geometryEntryType(351.73, entryGeometry(bars, 2, 351.73, 150))).toBe("Classic pivot");
  const invalid = walkForwardVcp(appendBars(vcpFixture(), [95]), { ...c, minimumContractions: 6 });
  expect(invalid.entry.entryType).toBe("none");
  expect(invalid.entry.status.startsWith("No setup")).toBe(true);
});
test("changing geometry cannot change any setup, history, or contraction fields", () => {
  const bars = appendBars(vcpFixture(), [95, 97, 98, 96, 97, 90, 92, 98, 94, 97, 96, 96, 99]);
  const strip = (result: ReturnType<typeof walkForwardVcp>) => {
    const { entryType: _type, geometry: _geometry, ...entry } = result.entry;
    return { ...result, entry };
  };
  for (let end = vcpFixture().length; end <= bars.length; end++) {
    const prefix = bars.slice(0, end);
    expect(strip(walkForwardVcp(prefix, { ...c, geometryLookbackBars: 3 }))).toEqual(
      strip(walkForwardVcp(prefix, c)),
    );
  }
  const ready = walkForwardVcp(appendBars(vcpFixture(), [95]), c).entry.geometry;
  expect(walkForwardVcp(appendBars(vcpFixture(), [95, 97, 98]), c).entry.geometry).toEqual(ready);
});
