import { expect, test } from "bun:test";
import { minerviniPreviewData } from "./minervini-preview-data";

const bars = Array.from({ length: 60 }, (_, i) => ({
  time: new Date(Date.UTC(2025, 0, i + 1)).toISOString().slice(0, 10),
  open: 100,
  high: 102,
  low: 99,
  close: 101,
  volume: i + 1,
}));
test("preview ends at scan date and plots prior-only 50-bar volume means", () => {
  const result = minerviniPreviewData(bars, bars[54].time);
  expect(result.bars).toHaveLength(55);
  expect(result.average).toHaveLength(5);
  expect(result.average[0]).toEqual({ time: bars[50].time, value: 25.5 });
  expect(result.average.at(-1)).toEqual({ time: bars[54].time, value: 29.5 });
  expect(bars).toHaveLength(60);
});
test("short histories retain price and volume without inventing an average", () => {
  expect(minerviniPreviewData(bars, bars[9].time).average).toEqual([]);
});
test("missing scan dates and invalid history fail explicitly", () => {
  expect(() => minerviniPreviewData(bars, null)).toThrow();
  expect(() => minerviniPreviewData(bars, "2026-01-01")).toThrow();
  expect(() => minerviniPreviewData([...bars].reverse(), bars[59].time)).toThrow();
  expect(() => minerviniPreviewData([{ ...bars[0], volume: null }], bars[0].time)).toThrow();
});

test("chart SMAs use completed closes with exact warmup and no future bars", () => {
  const history = Array.from({ length: 220 }, (_, i) => ({
    time: new Date(Date.UTC(2024, 0, i + 1)).toISOString().slice(0, 10),
    open: i + 1,
    high: i + 2,
    low: i + 1,
    close: i + 1,
    volume: 100,
  }));
  const result = minerviniPreviewData(history, history[209].time);
  for (const sma of result.smas) {
    expect(sma.points).toHaveLength(211 - sma.period);
    expect(sma.points[0].value).toBe((sma.period + 1) / 2);
    expect(sma.points.at(-1)?.value).toBe((211 - sma.period + 210) / 2);
    expect(sma.points.at(-1)?.time).toBe(history[209].time);
  }
});
test("pivot segment starts at the frozen pivot date and ends at signal", () => {
  const history = bars.map((bar) => ({ ...bar }));
  history[40].high = 110; // Outside the 10 prior bars.
  history[51].high = 110;
  history[55].high = 110; // Latest tied pivot anchor.
  history[59].high = 120; // Signal high must not redefine the pivot.
  expect(
    minerviniPreviewData(history, history[59].time, 110, history[40].time).pivotPoints,
  ).toEqual([
    { time: history[40].time, value: 110 },
    { time: history[59].time, value: 110 },
  ]);
  expect(minerviniPreviewData(history, history[59].time, 120).pivotPoints).toEqual([]);
  expect(minerviniPreviewData(history, history[59].time, null).pivotPoints).toEqual([]);
});
