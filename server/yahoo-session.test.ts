import { expect, test } from "bun:test";
import { fetchChartAnalysis } from "./analyze";
import { loadMinerviniUniverse, minerviniBars } from "./screeners/minervini-data";
import { yahooChartSession } from "./yahoo-session";

const seconds = (date: string) => Date.parse(date) / 1000;
const start = seconds("2026-10-21T13:30:00Z");
const end = seconds("2026-10-21T20:00:00Z");
const metadata = (trade = end) => ({
  currentTradingPeriod: { regular: { start, end } },
  regularMarketTime: trade,
});
const bar = { time: "2026-10-21", open: 10, high: 11, low: 9, close: 10, volume: 100 };
function input(meta: unknown, now: Date, latest = start) {
  return {
    security: { symbol: "A" },
    chart: {
      candles: [{ ...bar, time: "2026-10-20" }, bar],
      session: yahooChartSession(meta, latest, now),
    },
  };
}
test("3:30 PM NY excludes open session; 4:45 PM includes metadata-confirmed close", () => {
  const open = new Date("2026-10-21T19:30:00Z");
  expect(minerviniBars(input(metadata(open.getTime() / 1000), open), "A", open)).toHaveLength(1);
  const closed = new Date("2026-10-21T20:45:00Z");
  for (const trade of [end, end + 60]) {
    const data = input(metadata(trade), closed);
    expect(data.chart.session.final).toBe(true);
    expect(minerviniBars(data, "A", closed)).toHaveLength(2);
  }
  expect(input(metadata(end - 1), closed).chart.session.final).toBe(false);
});
test("delay boundary is inclusive and configurable; future trades cannot certify", () => {
  expect(yahooChartSession(metadata(), start, new Date("2026-10-21T20:29:59Z")).final).toBe(false);
  expect(yahooChartSession(metadata(), start, new Date("2026-10-21T20:30:00Z")).final).toBe(true);
  expect(yahooChartSession(metadata(), start, new Date("2026-10-21T20:45:00Z"), 60).final).toBe(
    false,
  );
  expect(
    yahooChartSession(metadata(end + 3600), start, new Date("2026-10-21T20:45:00Z")).final,
  ).toBe(false);
});
test("missing, malformed, and mismatched metadata fail closed", () => {
  const now = new Date("2026-10-21T20:45:00Z");
  for (const meta of [
    null,
    {},
    { regularMarketTime: end },
    { ...metadata(), regularMarketTime: "bad" },
    { ...metadata(), regularMarketTime: null },
    { ...metadata(), regularMarketTime: Infinity },
    { currentTradingPeriod: { regular: { start: end, end: start } }, regularMarketTime: end },
    { currentTradingPeriod: { regular: { start, end: "bad" } }, regularMarketTime: end },
  ]) {
    expect(input(meta, now).chart.session.final).toBe(false);
    expect(minerviniBars(input(meta, now), "A", now)).toHaveLength(1);
  }
  for (const latest of [NaN, start - 86400])
    expect(yahooChartSession(metadata(), latest, now).final).toBe(false);
  for (const delay of [-1, NaN, Infinity])
    expect(yahooChartSession(metadata(), start, now, delay).final).toBe(false);
});
test("weekends and holidays retain prior-date latest bars without claiming same-day finality", async () => {
  for (const date of ["2026-10-24T16:00:00Z", "2026-12-25T16:00:00Z"]) {
    const now = new Date(date);
    const data = input({}, now);
    expect(data.chart.session.final).toBe(false);
    expect(minerviniBars(data, "A", now)).toHaveLength(2);
    const rows = await loadMinerviniUniverse(
      ["A"],
      async () => data,
      new AbortController().signal,
      now,
    );
    expect(rows[0]?.latestSession).toBe("included");
  }
});
test("session summary distinguishes included, excluded and unavailable histories", async () => {
  const now = new Date("2026-10-21T20:45:00Z");
  const rows = await loadMinerviniUniverse(
    ["A", "B", "C"],
    async (symbol) => {
      if (symbol === "C") throw new Error("fixture");
      return { ...input(symbol === "A" ? metadata() : {}, now), security: { symbol } };
    },
    new AbortController().signal,
    now,
  );
  expect(rows.map((row) => row.latestSession)).toEqual(["included", "excluded", undefined]);
});
test("Yahoo fetch adapter supplies session metadata to the actual Minervini normalization", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (async () =>
    Response.json({
      chart: {
        result: [
          {
            meta: { ...metadata(), symbol: "A" },
            timestamp: [start - 86400, start],
            indicators: {
              quote: [
                {
                  open: [10, 10],
                  high: [11, 11],
                  low: [9, 9],
                  close: [10, 10],
                  volume: [100, 100],
                },
              ],
            },
          },
        ],
      },
    })) as unknown as typeof fetch;
  try {
    const now = new Date("2026-10-21T20:45:00Z");
    const data = await fetchChartAnalysis("A", undefined, now);
    expect(data.chart.session).toEqual({
      date: "2026-10-21",
      regularEnd: "2026-10-21T20:00:00.000Z",
      final: true,
    });
    expect(minerviniBars(data, "A", now)).toHaveLength(2);
  } finally {
    globalThis.fetch = original;
  }
});
test("early close and winter timezone use provider session times", () => {
  const winterStart = seconds("2026-11-27T14:30:00Z");
  const winterEnd = seconds("2026-11-27T18:00:00Z");
  const meta = {
    currentTradingPeriod: { regular: { start: winterStart, end: winterEnd } },
    regularMarketTime: winterEnd,
  };
  expect(yahooChartSession(meta, winterStart, new Date("2026-11-27T18:30:00Z")).final).toBe(true);
});
