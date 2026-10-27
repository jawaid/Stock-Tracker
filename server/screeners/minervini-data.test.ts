import { expect, test } from "bun:test";
import {
  loadMinerviniUniverse,
  minerviniBars,
  minerviniSymbols,
  readMinerviniRequest,
} from "./minervini-data";

const bar = { time: "2026-10-20", open: 10, high: 11, low: 9, close: 10, volume: 100 };
const payload = (symbol: string) => ({
  security: { symbol },
  chart: { candles: [bar, { ...bar, time: "2026-10-21" }] },
});
test("Normalize universe and reject malformed or oversized inputs", async () => {
  expect(minerviniSymbols([" aapl ", "AAPL", "BRK-B"])).toEqual(["AAPL", "BRK-B"]);
  for (const input of [[], null, ["<script>"], [2], Array(401).fill("A")])
    expect(() => minerviniSymbols(input)).toThrow();
  expect(
    await readMinerviniRequest(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({ symbols: ["AAPL"] }),
      }),
    ),
  ).toEqual(["AAPL"]);
  await expect(
    readMinerviniRequest(
      new Request("http://localhost", { method: "POST", body: "x".repeat(16385) }),
    ),
  ).rejects.toThrow("too large");
});
test("Completed-date normalization excludes unfinished bars and preserves volumes", () => {
  const now = new Date("2026-10-21T20:30:00Z");
  expect(minerviniBars(payload("A"), "A", now)).toEqual([bar]);
  expect(() => minerviniBars(payload("A"), "B", now)).toThrow();
  expect(() =>
    minerviniBars({ security: { symbol: "A" }, chart: { candles: [null] } }, "A", now),
  ).toThrow();
});
test("Bounded workers isolate provider failures and abort without returning partial rank universe", async () => {
  let active = 0;
  let peak = 0;
  const result = await loadMinerviniUniverse(
    ["A", "B", "FAIL", "D", "E"],
    async (symbol) => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 1));
      active--;
      if (symbol === "FAIL") throw new Error("fixture");
      return payload(symbol);
    },
    new AbortController().signal,
    new Date("2026-10-21T12:00:00Z"),
  );
  expect(peak).toBeLessThanOrEqual(3);
  expect(result).toHaveLength(5);
  expect(result.filter((r) => r.error)).toHaveLength(1);
  expect(result.find((r) => r.symbol === "A")?.bars).toEqual([bar]);
  const controller = new AbortController();
  controller.abort();
  await expect(
    loadMinerviniUniverse(["A"], async () => payload("A"), controller.signal),
  ).rejects.toThrow();
});

test("same-day signal needs explicit finality and a matching session already closed", () => {
  const input = {
    ...payload("A"),
    chart: {
      ...payload("A").chart,
      session: { date: "2026-10-21", regularEnd: "2026-10-21T20:00:00Z", final: true },
    },
  };
  expect(minerviniBars(input, "A", new Date("2026-10-21T20:01:00Z"))).toHaveLength(2);
  expect(minerviniBars(input, "A", new Date("2026-10-21T19:59:00Z"))).toHaveLength(1);
  input.chart.session.final = false;
  expect(minerviniBars(input, "A", new Date("2026-10-21T21:00:00Z"))).toHaveLength(1);
  input.chart.session.final = true;
  input.chart.session.date = "2026-10-20";
  expect(minerviniBars(input, "A", new Date("2026-10-21T21:00:00Z"))).toHaveLength(1);
});
